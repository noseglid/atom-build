'use babel';

import path from 'path';
import { Disposable, CompositeDisposable } from 'atom';
import kill from 'tree-kill';
import Grim from 'grim';

import config from './config';
import SaveConfirmView from './save-confirm-view';
import StatusBarView from './status-bar-view';
import TargetsView from './targets-view';
import BuildView from './build-view';
import GoogleAnalytics from './google-analytics';
import ErrorMatcher from './error-matcher';
import BuildError from './build-error';
import CustomFile from './atom-build';
import providerLegacy from './provider-legacy';
import { uniquifySettings, activePath, getDefaultSettings, replace } from './utils';

export default {
  config: config,

  activate() {
    if (!/^win/.test(process.platform)) {
      // Manually append /usr/local/bin as it may not be set on some systems,
      // and it's common to have node installed here. Keep it at end so it won't
      // accidentially override any other node installation
      process.env.PATH += ':/usr/local/bin';
    }

    this.buildView = new BuildView();

    this.tools = [ CustomFile ];
    this.instancedTools = {}; // Ordered by project path
    this.targets = {};
    this.activeTarget = {};
    this.targetsLoading = {};
    this.targetsSubscriptions = {};
    this.errorMatcher = new ErrorMatcher();

    atom.commands.add('atom-workspace', 'build:refresh-targets', () => this.refreshTargets());
    atom.commands.add('atom-workspace', 'build:trigger', () => this.build('trigger'));
    atom.commands.add('atom-workspace', 'build:select-active-target', () => this.selectActiveTarget());
    atom.commands.add('atom-workspace', 'build:stop', () => this.stop());
    atom.commands.add('atom-workspace', 'build:confirm', () => {
      GoogleAnalytics.sendEvent('build', 'confirmed');
      document.activeElement.click();
    });
    atom.commands.add('atom-workspace', 'build:no-confirm', () => {
      if (this.saveConfirmView) {
        GoogleAnalytics.sendEvent('build', 'not confirmed');
        this.saveConfirmView.cancel();
      }
    });

    atom.workspace.observeTextEditors((editor) => {
      editor.onDidSave(() => {
        if (atom.config.get('build.buildOnSave')) {
          this.build('save');
        }
      });
    });

    atom.workspace.onDidChangeActivePaneItem(() => this.updateStatusBar());

    this.errorMatcher.on('error', (message) => {
      atom.notifications.addError('Error matching failed!', { detail: message });
    });

    this.errorMatcher.on('matched', (match) => {
      this.buildView.scrollTo(match[0]);
    });

    atom.packages.onDidActivateInitialPackages(() => this.refreshTargets());

    let projectPaths = atom.project.getPaths();
    atom.project.onDidChangePaths(() => {
      const addedPaths = atom.project.getPaths().filter(el => projectPaths.indexOf(el) === -1);
      this.refreshTargets(addedPaths);
      projectPaths = atom.project.getPaths();
    });

    atom.packages.getLoadedPackages()
      .filter(p => ((((p.metadata.providedServices || {}).builder || {}).versions || {})['1.0.0']))
      .forEach(p => Grim.deprecate('Use 2.0.0 of builder service API instead', { packageName: p.name }));
  },

  deactivate() {
    Object.keys(this.instancedTools).map(cwd => this.instancedTools[cwd].forEach(tool => {
      tool.removeAllListeners && tool.removeAllListeners('refresh');
      tool.destructor && tool.destructor();
    }));

    if (this.child) {
      this.child.removeAllListeners();
      kill(this.child.pid, 'SIGKILL');
      this.child = null;
    }

    this.statusBarView && this.statusBarView.destroy();
    this.buildView && this.buildView.destroy();

    clearTimeout(this.finishedTimer);
  },

  updateStatusBar() {
    const activeTarget = this.activeTarget[activePath()];
    this.statusBarView && this.statusBarView.setTarget(activeTarget);
  },

  refreshTargets(refreshPaths) {
    refreshPaths = refreshPaths || atom.project.getPaths();

    const pathPromise = refreshPaths.map((p) => {
      this.targetsLoading[p] = true;
      this.targets[p] = this.targets[p] || [];

      this.instancedTools[p] = (this.instancedTools[p] || [])
        .map(t => t.removeAllListeners && t.removeAllListeners('refresh'))
        .filter(() => false); // Just empty the array

      const settingsPromise = this.tools
        .map(Tool => new Tool(p))
        .filter(tool => tool.isEligible())
        .map(tool => {
          this.instancedTools[p].push(tool);
          GoogleAnalytics.sendEvent('build', 'tool eligible', tool.getNiceName());

          tool.on && tool.on('refresh', this.refreshTargets.bind(this, [ p ]));
          return Promise.resolve().then(() => tool.settings()).catch(err => {
            if (err instanceof SyntaxError) {
              atom.notifications.addError('Invalid build file.', {
                detail: 'You have a syntax error in your build file: ' + err.message,
                dismissable: true
              });
            } else {
              atom.notifications.addError('Ooops. Something went wrong.', {
                detail: err.message + (err.stack ? '\n' + err.stack : ''),
                dismissable: true
              });
            }
          });
        });

      return Promise.all(settingsPromise).then((settings) => {
        settings = uniquifySettings([].concat.apply([], settings)
          .filter(Boolean)
          .map(setting => getDefaultSettings(p, setting)));

        if (null === this.activeTarget[p] || !settings.find(s => s.name === this.activeTarget[p])) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          this.setActiveTargetName(settings[0] ? settings[0].name : undefined);
        }

        // CompositeDisposable cannot be reused, so we must create a new instance on every refresh
        this.targetsSubscriptions[p] && this.targetsSubscriptions[p].dispose();
        this.targetsSubscriptions[p] = new CompositeDisposable();

        settings.forEach((setting, index) => {
          if (setting.keymap && !setting.atomCommandName) {
            setting.atomCommandName = `build:trigger:${setting.name}`;
          }

          const subscriptions = new CompositeDisposable();
          subscriptions.add(atom.commands.add('atom-workspace', setting.atomCommandName, this.build.bind(this, 'trigger')));

          if (setting.keymap) {
            GoogleAnalytics.sendEvent('keymap', 'registered', setting.keymap);
            const keymapSpec = { 'atom-workspace, atom-text-editor': {} };
            keymapSpec['atom-workspace, atom-text-editor'][setting.keymap] = setting.atomCommandName;
            subscriptions.add(atom.keymaps.add(setting.name, keymapSpec));
          }

          this.targetsSubscriptions[p].add(subscriptions);
        });

        this.targets[p] = settings;
        this.targetsLoading[p] = false;
        this.fillTargets();
        this.updateStatusBar();
      });
    });

    Promise.all(pathPromise).then(entries => {
      if (entries.length === 0) {
        return;
      }

      if (atom.config.get('build.notificationOnRefresh')) {
        const rows = refreshPaths.map(p => `${this.targets[p].length} targets at: ${p}`);
        atom.notifications.addInfo('Build targets parsed.', {
          detail: rows.join('\n')
        });
      }
    });
  },

  fillTargets() {
    if (this.targetsView) {
      const p = activePath();
      this.targetsView.setActiveTarget(this.activeTarget[p]);
      this.targetsView.setItems((this.targets[p] || []).map(target => target.name));
    }
  },

  setActiveTargetName(targetName) {
    const p = activePath();
    this.activeTarget[p] = targetName;
    if (this.variantsSubscriptions) {
      this.variantsSubscriptions.dispose();
      this.variantsSubscriptions = null;
    }
    if (targetName) {
      Promise.resolve(this.targets[p]).then(targets => {
        const newTarget = targets.find(t => t.name === targetName);
        if (newTarget && newTarget.variants) {
          this.variantsSubscriptions = atom.commands.add('atom-workspace', Object.keys(newTarget.variants).reduce((commands, variant) => {
            const commandName = 'trigger-' + variant;
            return commands[commandName] = () => this.build(commandName);
          }, {});
        }
      });
    }
  },

  selectActiveTarget() {
    const p = activePath();
    this.targetsView = new TargetsView();

    if (this.targetsLoading[p]) {
      this.targetsView.setLoading('Loading project build targets\u2026');
    } else {
      this.fillTargets();
    }

    this.targetsView.awaitSelection().then((newTarget) => {
      this.setActiveTargetName(newTarget);
      this.updateStatusBar();

      if (atom.config.get('build.selectTriggers')) {
        const workspaceElement = atom.views.getView(atom.workspace);
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      }
      this.targetsView = null;
    }).catch((err) => {
      this.targetsView = null;
      this.targetsView.setError(err.message);
    });
  },

  startNewBuild(source, atomCommandName) {
    const p = activePath();
    const [ , variant ] = source.match(/^trigger-(.+)$/) || [];

    Promise.resolve(this.targets[p]).then(targets => {
      if (!targets || 0 === targets.length) {
        throw new BuildError('No eligible build target.', 'No configuration to build this project exists.');
      }

      let target = targets.find(t => t.atomCommandName === atomCommandName);
      if (!target) {
        const targetName = this.activeTarget[p];
        target = targets.find(t => t.name === targetName);
      }
      GoogleAnalytics.sendEvent('build', 'triggered');

      if (!target.exec) {
        throw new BuildError('Invalid build file.', 'No executable command specified.');
      }
      if (variant && (!target.variants || !target.variants[variant])) {
        throw new BuildError('Invalid build file.', 'No variant specified for \'' + variant + '\'.');
      }

      return Promise.resolve().then(() => {
        if (target.preBuild && typeof target.preBuild === 'function') {
          return target.preBuild();
        }
      }).then(() => target);
    }).then(target => {
      const env = Object.assign({}, process.env, target.env);
      Object.keys(env).forEach(key => {
        env[key] = replace(env[key], target.env);
      });

      if (variant) {
        const copy = {};
        Object.assign(copy, target);
        Object.assign(copy, target.variants[variant]);
        target = copy;
      }

      const exec = replace(target.exec, target.env);
      const args = target.args.map(arg => replace(arg, target.env));
      const cwd = replace(target.cwd, target.env);
      const isWin = process.platform === 'win32';
      const shCmd = isWin ? 'cmd' : '/bin/sh';
      const shCmdArg = isWin ? '/C' : '-c';

      if (target.sh) {
        this.child = require('child_process').spawn(
          shCmd,
          [ shCmdArg, [ path.normalize(exec) ].concat(args).join(' ')],
          { cwd: cwd, env: env }
        );
      } else {
        this.child = require('cross-spawn-async').spawn(
          exec,
          args,
          { cwd: cwd, env: env }
        );
      }

      let stdout = '';
      let stderr = '';
      this.child.stdout.setEncoding('utf8');
      this.child.stderr.setEncoding('utf8');
      this.child.stdout.on('data', d => stdout += d);
      this.child.stderr.on('data', d => stderr += d);
      this.child.stdout.pipe(this.buildView.terminal);
      this.child.stderr.pipe(this.buildView.terminal);

      this.child.on('error', (err) => {
        this.buildView.terminal.write((target.sh ? 'Unable to execute with shell: ' : 'Unable to execute: ') + exec + '\n');

        if (/\s/.test(exec) && !target.sh) {
          this.buildView.terminal.write('`cmd` cannot contain space. Use `args` for arguments.\n');
        }

        if ('ENOENT' === err.code) {
          this.buildView.terminal.write(`Make sure cmd:'${exec}' and cwd:'${cwd}' exists and have correct access permissions.\n`);
          this.buildView.terminal.write(`Binaries are found in these folders: ${process.env.PATH}\n`);
        }
      });

      this.child.on('close', (exitCode) => {
        this.errorMatcher.set(target.errorMatch, cwd, stdout + stderr);

        let success = (0 === exitCode);
        if (atom.config.get('build.matchedErrorFailsBuild')) {
          success = success && !this.errorMatcher.hasMatch();
        }
        this.buildView.buildFinished(success);
        this.statusBarView && this.statusBarView.setBuildSuccess(success);

        if (atom.config.get('build.beepWhenDone')) {
          atom.beep();
        }

        if (success) {
          GoogleAnalytics.sendEvent('build', 'succeeded');
          this.finishedTimer = setTimeout(() => {
            this.buildView.detach();
          }, 1200);
        } else {
          if (atom.config.get('build.scrollOnError')) {
            this.errorMatcher.matchFirst();
          }
          GoogleAnalytics.sendEvent('build', 'failed');
        }
        this.child = null;

        if (target.postBuild && typeof target.postBuild === 'function') {
          return target.postBuild(success);
        }
      });

      this.statusBarView && this.statusBarView.buildStarted();
      this.buildView.buildStarted();
      this.buildView.setHeading([ (target.sh ? `${shCmd} ${shCmdArg} ${exec}` : exec ), ...args, '\n'].join(' '));
    }).catch((err) => {
      if (err instanceof BuildError) {
        if (source === 'save') {
          // If there is no eligible build tool, and cause of build was a save, stay quiet.
          return;
        }

        atom.notifications.addWarning(err.name, { detail: err.message });
      } else {
        atom.notifications.addError('Failed to build.', { detail: err.message });
      }
    });
  },

  abort(cb) {
    this.child.removeAllListeners('exit');
    this.child.removeAllListeners('close');
    this.child.on('exit', () => {
      this.child.removeAllListeners();
      this.child = null;
      cb && cb();
    });

    try {
      kill(this.child.pid, this.child.killed ? 'SIGKILL' : 'SIGTERM');
    } catch (e) {
      /* Something may have happened to the child (e.g. terminated by itself). Ignore this. */
    }

    this.child.killed = true;
  },

  build(source, event) {
    clearTimeout(this.finishedTimer);

    this.doSaveConfirm(this.unsavedTextEditors(), () => {
      const next = this.startNewBuild.bind(this, source, event ? event.type : null);
      this.child ? this.abort(next) : next();
    });
  },

  doSaveConfirm(modifiedTextEditors, continuecb, cancelcb) {
    const saveAndContinue = (save) => {
      modifiedTextEditors.forEach((textEditor) => save && textEditor.save());
      continuecb();
    };

    if (0 === modifiedTextEditors.length || atom.config.get('build.saveOnBuild')) {
      return saveAndContinue(true);
    }

    if (this.saveConfirmView) {
      this.saveConfirmView.destroy();
    }

    this.saveConfirmView = new SaveConfirmView();
    this.saveConfirmView.show(saveAndContinue, cancelcb);
  },

  unsavedTextEditors() {
    return atom.workspace.getTextEditors().filter((textEditor) => {
      return textEditor.isModified() && (undefined !== textEditor.getPath());
    });
  },

  stop() {
    clearTimeout(this.finishedTimer);
    if (this.child) {
      if (!this.child.killed) {
        this.buildView.buildAbortInitiated();
      }
      this.abort(() => {
        this.buildView.buildAborted();
        this.statusBarView && this.statusBarView.buildAborted();
      });
    } else {
      this.buildView.reset();
    }
  },

  consumeBuilderLegacy(builder) {
    return this.consumeBuilder(providerLegacy(builder));
  },

  consumeBuilder(builder) {
    this.tools.push(builder);
    return new Disposable(() => {
      this.tools = this.tools.filter(tool => tool !== builder);
    });
  },

  consumeStatusBar(statusBar) {
    this.statusBarView = new StatusBarView(statusBar);
    this.statusBarView.onClick(() => this.selectActiveTarget());
    this.statusBarView.attach();
  }
};
