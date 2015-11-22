'use babel';

import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import { Disposable } from 'atom';
import kill from 'tree-kill';

import SaveConfirmView from './save-confirm-view';
import TargetsView from './targets-view';
import BuildView from './build-view';
import GoogleAnalytics from './google-analytics';
import ErrorMatcher from './error-matcher';
import BuildError from './build-error';

module.exports = {
  config: {
    panelVisibility: {
      title: 'Panel Visibility',
      description: 'Set when the build panel should be visible.',
      type: 'string',
      default: 'Toggle',
      enum: [ 'Toggle', 'Keep Visible', 'Show on Error', 'Hidden' ],
      order: 1
    },
    buildOnSave: {
      title: 'Automatically build on save',
      description: 'Autmatically build your project each time an editor is saved.',
      type: 'boolean',
      default: false,
      order: 2
    },
    saveOnBuild: {
      title: 'Automatically save on build',
      description: 'Automatically save all edited files when triggering a build.',
      type: 'boolean',
      default: false,
      order: 3
    },
    scrollOnError: {
      title: 'Automatically scroll on build error',
      description: 'Automatically scroll to first matched error when a build failed.',
      type: 'boolean',
      default: false,
      order: 4
    },
    stealFocus: {
      title: 'Steal Focus',
      description: 'Steal focus when opening build panel.',
      type: 'boolean',
      default: true,
      order: 5
    },
    monocleHeight: {
      title: 'Monocle Height',
      description: 'How much of the workspace to use for build panel when it is "maximized".',
      type: 'number',
      default: 0.75,
      minimum: 0.1,
      maximum: 0.9,
      order: 6
    },
    minimizedHeight: {
      title: 'Minimized Height',
      description: 'How much of the workspace to use for build panel when it is "minimized".',
      type: 'number',
      default: 0.15,
      minimum: 0.1,
      maximum: 0.9,
      order: 7
    },
    panelOrientation: {
      title: 'Panel Orientation',
      description: 'Where to attach the build panel',
      type: 'string',
      default: 'Bottom',
      enum: [ 'Bottom', 'Top', 'Left', 'Right' ],
      order: 8
    }
  },

  activate: function () {
    // Manually append /usr/local/bin as it may not be set on some systems,
    // and it's common to have node installed here. Keep it at end so it won't
    // accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin';

    this.buildView = new BuildView();

    this.tools = [ require('./atom-build') ];
    this.targets = {};
    this.activeTarget = {};
    this.targetsLoading = {};

    this.stdout = new Buffer(0);
    this.stderr = new Buffer(0);
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

    this.errorMatcher.on('error', (message) => {
      atom.notifications.addError('Error matching failed!', { detail: message });
    });

    this.errorMatcher.on('matched', (id) => {
      this.buildView.scrollTo(id);
    });

    this.errorMatcher.on('match', (text, id) => {
      const callback = this.errorMatcher.goto.bind(this.errorMatcher, id);
      this.buildView.link(text, id, callback);
    });

    atom.packages.onDidActivateInitialPackages(() => this.refreshTargets());

    let projectPaths = atom.project.getPaths();
    atom.project.onDidChangePaths(() => {
      const addedPaths = atom.project.getPaths().filter(el => projectPaths.indexOf(el) === -1);
      this.refreshTargets(addedPaths);
      projectPaths = atom.project.getPaths();
    });
  },

  deactivate: function () {
    this.tools.forEach(tool => {
      if (tool.off) {
        _.forEach(tool.ctx, ctx => tool.off.apply(ctx, [ 'refresh' ]));
      }
    });
    if (this.child) {
      this.child.removeAllListeners();
      kill(this.child.pid, 'SIGKILL');
      this.child = null;
    }
    clearTimeout(this.finishedTimer);
  },

  activePath: function () {
    const textEditor = atom.workspace.getActiveTextEditor();
    if (!textEditor || !textEditor.getPath()) {
      /* default to building the first one if no editor is active */
      if (0 === atom.project.getPaths().length) {
        return false;
      }

      return atom.project.getPaths()[0];
    }

    /* otherwise, build the one in the root of the active editor */
    return atom.project.getPaths().sort((a, b) => (b.length - a.length)).find(p => {
      const realpath = fs.realpathSync(p);
      return textEditor.getPath().substr(0, realpath.length) === realpath;
    });
  },

  cmdDefaults: function (cwd) {
    return {
      env: {},
      args: [],
      cwd: cwd,
      sh: true,
      errorMatch: '',
      dispose: Function.prototype
    };
  },

  refreshTargets: function (refreshPaths) {
    refreshPaths = refreshPaths || atom.project.getPaths();

    const pathPromise = refreshPaths.map((p) => {
      this.targetsLoading[p] = true;
      this.targets[p] = this.targets[p] || [];
      const settingsPromise = this.tools.filter((tool) => {
        tool.ctx = tool.ctx || [];
        tool.ctx[p] = tool.ctx[p] || {};
        return tool.isEligable.apply(tool.ctx[p], [ p ]);
      }).map((tool) => {
        GoogleAnalytics.sendEvent('build', 'tool eligible', tool.niceName);

        if (tool.on) {
          tool.off.apply(tool.ctx[p], [ 'refresh' ]);
          tool.on.apply(tool.ctx[p], [ 'refresh', this.refreshTargets.bind(this, [ p ]) ]);
        }

        return Promise.resolve().then(() => {
          return tool.settings.apply(tool.ctx[p], [ p ]);
        }).catch((err) => {
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
        settings = [].concat.apply([], settings).filter(Boolean).map(setting =>
          _.defaults(setting, this.cmdDefaults(p))
        );

        if (_.isNull(this.activeTarget[p]) || !settings.find(s => s.name === this.activeTarget[p])) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          this.activeTarget[p] = settings[0] ? settings[0].name : undefined;
        }

        this.targets[p].forEach(target => target.dispose());

        settings.forEach((setting, index) => {
          if (!setting.keymap) {
            return;
          }

          GoogleAnalytics.sendEvent('keymap', 'registered', setting.keymap);
          const commandName = 'build:trigger:' + setting.name;
          const keymapSpec = { 'atom-workspace': {} };
          keymapSpec['atom-workspace'][setting.keymap] = commandName;
          const keymapDispose = atom.keymaps.add(setting.name, keymapSpec);
          const commandDispose = atom.commands.add('atom-workspace', commandName, this.build.bind(this, 'trigger'));
          settings[index].dispose = () => {
            keymapDispose.dispose();
            commandDispose.dispose();
          };
        });

        this.targets[p] = settings;
        this.targetsLoading[p] = false;
      });
    });

    Promise.all(pathPromise).then((entries) => {
      if (entries.length === 0) {
        return;
      }

      const rows = refreshPaths.map(p => `${this.targets[p].length} targets at: ${p}`);
      atom.notifications.addInfo('Build targets parsed.', {
        detail: rows.join('\n')
      });
    });
  },

  selectActiveTarget: function () {
    const p = this.activePath();
    const targets = this.targets[p];
    const targetsView = new TargetsView();

    if (this.targetsLoading[p]) {
      return targetsView.setLoading('Loading project build targets\u2026');
    }

    targetsView.setActiveTarget(this.activeTarget[p]);
    targetsView.setItems((targets || []).map(target => target.name));
    targetsView.awaitSelection().then((newTarget) => {
      this.activeTarget[p] = newTarget;

      const workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'build:trigger');
    }).catch((err) => targetsView.setError(err.message));
  },

  replace: function (value, targetEnv) {
    const env = _.extend({}, process.env, targetEnv);
    value = value.replace(/\$(\w+)/g, function (match, name) {
      return name in env ? env[name] : match;
    });

    const editor = atom.workspace.getActiveTextEditor();

    const projectPaths = _.map(atom.project.getPaths(), (projectPath) => {
      try {
        return fs.realpathSync(projectPath);
      } catch (e) { /* Do nothing. */ }
    });

    let projectPath = projectPaths[0];
    if (editor && 'untitled' !== editor.getTitle()) {
      const activeFile = fs.realpathSync(editor.getPath());
      const activeFilePath = path.dirname(activeFile);
      projectPath = _.find(projectPaths, (p) => activeFilePath && activeFilePath.startsWith(p));
      value = value.replace(/{FILE_ACTIVE}/g, activeFile);
      value = value.replace(/{FILE_ACTIVE_PATH}/g, activeFilePath);
      value = value.replace(/{FILE_ACTIVE_NAME}/g, path.basename(activeFile));
      value = value.replace(/{FILE_ACTIVE_NAME_BASE}/g, path.basename(activeFile, path.extname(activeFile)));
    }
    value = value.replace(/{PROJECT_PATH}/g, projectPath);
    if (atom.project.getRepositories[0]) {
      value = value.replace(/{REPO_BRANCH_SHORT}/g, atom.project.getRepositories()[0].getShortHead());
    }

    return value;
  },

  startNewBuild: function (source, targetName) {
    const p = this.activePath();
    targetName = targetName || this.activeTarget[p];

    Promise.resolve(this.targets[p]).then(targets => {
      if (!targets) {
        throw new BuildError('No eligible build target.', 'No configuration to build this project exists.');
      }

      const target = targets.find(t => t.name === targetName);
      GoogleAnalytics.sendEvent('build', 'triggered');

      if (!target.exec) {
        throw new BuildError('Invalid build file.', 'No executable command specified.');
      }

      const env = _.extend({}, process.env, target.env);
      _.forEach(env, (value, key, list) => {
        list[key] = this.replace(value, target.env);
      });

      const exec = this.replace(target.exec, target.env);
      const args = target.args.map(arg => this.replace(arg, target.env));
      const cwd = this.replace(target.cwd, target.env);

      this.child = require('child_process').spawn(
        target.sh ? '/bin/sh' : exec,
        target.sh ? [ '-c', [ exec ].concat(args).join(' ') ] : args,
        { cwd: cwd, env: env }
      );

      this.stdout = new Buffer(0);
      this.child.stdout.on('data', (buffer) => {
        this.stdout = Buffer.concat([ this.stdout, buffer ]);
        this.buildView.append(buffer);
      });

      this.stderr = new Buffer(0);
      this.child.stderr.on('data', (buffer) => {
        this.stderr = Buffer.concat([ this.stderr, buffer ]);
        this.buildView.append(buffer);
      });

      this.child.on('error', (err) => {
        this.buildView.append((target.sh ? 'Unable to execute with sh: ' : 'Unable to execute: ') + exec + '\n');

        if (/\s/.test(exec) && !target.sh) {
          this.buildView.append('`cmd` cannot contain space. Use `args` for arguments.\n');
        }

        if ('ENOENT' === err.code) {
          this.buildView.append('Make sure `cmd` and `cwd` exists and have correct access permissions.');
        }
      });

      this.child.on('close', (exitCode) => {
        this.errorMatcher.set(target.errorMatch, cwd, this.buildView.output.text());

        const success = (0 === exitCode) && !this.errorMatcher.hasMatch();
        this.buildView.buildFinished(success);
        if (success) {
          GoogleAnalytics.sendEvent('build', 'succeeded');
          this.finishedTimer = setTimeout(() => {
            this.buildView.detach();
          }, 1000);
        } else {
          if (atom.config.get('build.scrollOnError')) {
            this.errorMatcher.matchFirst();
          }
          GoogleAnalytics.sendEvent('build', 'failed');
        }
        this.child = null;
      });

      this.buildView.buildStarted();
      this.buildView.append([ (target.sh ? 'Executing with sh:' : 'Executing:'), exec, ...args, '\n'].join(' '));
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

  abort: function (cb) {
    this.child.removeAllListeners('close');
    this.child.on('close', () => {
      this.child = null;
      cb && cb();
    });

    try {
      kill(this.child.pid);
    } catch (e) {
      /* Something may have happened to the child (e.g. terminated by itself). Ignore this. */
    }

    this.child.killed = true;
  },

  build: function (source, event) {
    clearTimeout(this.finishedTimer);

    this.doSaveConfirm(this.unsavedTextEditors(), () => {
      const next = this.startNewBuild.bind(this, source, event ? event.type.substr(14) : null);
      this.child ? this.abort(next) : next();
    });
  },

  doSaveConfirm: function (modifiedTextEditors, continuecb, cancelcb) {
    const saveAndContinue = (save) => {
      modifiedTextEditors.forEach((textEditor) => save && textEditor.save());
      continuecb();
    };

    if (0 === _.size(modifiedTextEditors) || atom.config.get('build.saveOnBuild')) {
      return saveAndContinue(true);
    }

    if (this.saveConfirmView) {
      this.saveConfirmView.destroy();
    }

    this.saveConfirmView = new SaveConfirmView();
    this.saveConfirmView.show(saveAndContinue, cancelcb);
  },

  unsavedTextEditors: function () {
    return atom.workspace.getTextEditors().filter((textEditor) => {
      return textEditor.isModified() && ('untitled' !== textEditor.getTitle());
    });
  },

  stop: function () {
    clearTimeout(this.finishedTimer);
    if (this.child) {
      if (this.child.killed) {
        // This child has been killed, but hasn't terminated. Hide it from user.
        this.child.removeAllListeners();
        this.child = null;
        this.buildView.buildAborted();
        return;
      }

      this.abort(() => this.buildView.buildAborted());

      this.buildView.buildAbortInitiated();
    } else {
      this.buildView.reset();
    }
  },

  consumeBuilder: function (builders) {
    if (!(builders instanceof Array)) {
      builders = [ builders ];
    }
    this.tools = _.union(this.tools, builders);
    return new Disposable(() => {
      this.tools = _.difference(this.tools, builders);
    });
  }
};
