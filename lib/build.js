'use babel';
'use strict';

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var Disposable = require('atom').Disposable;
var kill = require('tree-kill');

var SaveConfirmView = require('./save-confirm-view');
var TargetsView = require('./targets-view');
var BuildView = require('./build-view');
var GoogleAnalytics = require('./google-analytics');
var ErrorMatcher = require('./error-matcher');
var tools = [ require('./atom-build') ];

function BuildError(name, message) {
  this.name = name;
  this.message = message;
  Error.captureStackTrace(this, BuildError);
}

BuildError.prototype = Object.create(Error.prototype);
BuildError.prototype.constructor = BuildError;

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

  activate: function(state) {
    // Manually append /usr/local/bin as it may not be set on some systems,
    // and it's common to have node installed here. Keep it at end so it won't
    // accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin';

    this.buildView = new BuildView();

    this.targets = {};
    this.activeTarget = {};
    this.targetsLoading = {};

    this.stdout = new Buffer(0);
    this.stderr = new Buffer(0);
    this.errorMatcher = new ErrorMatcher();

    atom.commands.add('atom-workspace', 'build:refresh-targets', () => this.refreshTargets());
    atom.commands.add('atom-workspace', 'build:trigger', this.build.bind(this, 'trigger'));
    atom.commands.add('atom-workspace', 'build:select-active-target', this.selectActiveTarget.bind(this));
    atom.commands.add('atom-workspace', 'build:stop', this.stop.bind(this));
    atom.commands.add('atom-workspace', 'build:confirm', function() {
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
      editor.onDidSave((event) => {
        if (atom.config.get('build.buildOnSave')) {
          this.build('save');
        }
      });
    });

    this.errorMatcher.on('error', function (message) {
      atom.notifications.addError('Error matching failed!', { detail: message });
    });

    this.errorMatcher.on('matched', (id) => {
      this.buildView.scrollTo(id);
    });

    this.errorMatcher.on('match', (text, id) => {
      var callback = this.errorMatcher.goto.bind(this.errorMatcher, id);
      this.buildView.link(text, id, callback);
    });

    atom.packages.onDidActivateInitialPackages(() => this.refreshTargets());

    let projectPaths = atom.project.getPaths();
    atom.project.onDidChangePaths(() => {
      let addedPaths = atom.project.getPaths().filter(el => projectPaths.indexOf(el) === -1);
      this.refreshTargets(addedPaths);
      projectPaths = atom.project.getPaths();
    });
  },

  deactivate: function() {
    tools.forEach(tool => {
      if (tool.off) {
        _.forEach(tool.ctx, (ctx, path) => tool.off.apply(ctx, [ 'refresh' ]));
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
    var textEditor = atom.workspace.getActiveTextEditor();
    if (!textEditor || !textEditor.getPath()) {
      /* default to building the first one if no editor is active */
      if (0 === atom.project.getPaths().length) {
        return false;
      }

      return atom.project.getPaths()[0];
    } else {
      /* otherwise, build the one in the root of the active editor */
      return atom.project.getPaths().sort((a, b) => (b.length - a.length)).find(path => {
        var realpath = fs.realpathSync(path);
        return textEditor.getPath().substr(0, realpath.length) === realpath;
      });
    }
  },

  cmdDefaults: function (path) {
    return {
      env: {},
      args: [],
      cwd: path,
      sh: true,
      errorMatch: '',
      dispose: Function.prototype
    };
  },

  refreshTargets: function(refreshPaths) {
    refreshPaths = refreshPaths || atom.project.getPaths();

    let pathPromise = refreshPaths.map((path) => {
      this.targetsLoading[path] = true;
      this.targets[path] = this.targets[path] || [];
      let settingsPromise = tools.filter((tool) => {
        tool.ctx = tool.ctx || [];
        tool.ctx[path] = tool.ctx[path] || {};
        return tool.isEligable.apply(tool.ctx[path], [ path ]);
      }).map((tool) => {
        GoogleAnalytics.sendEvent('build', 'tool eligible', tool.niceName);

        if (tool.on) {
          tool.off.apply(tool.ctx[path], [ 'refresh' ]);
          tool.on.apply(tool.ctx[path], [ 'refresh', this.refreshTargets.bind(this, [ path ]) ]);
        }

        return Promise.resolve().then(() => {
          return tool.settings.apply(tool.ctx[path], [ path ]);
        }).catch(function (err) {
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
          _.defaults(setting, this.cmdDefaults(path))
        );

        if (_.isNull(this.activeTarget[path]) || !settings.find(s => s.name === this.activeTarget[path])) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          this.activeTarget[path] = settings[0] ? settings[0].name : undefined;
        }

        this.targets[path].forEach(target => target.dispose());

        settings.forEach((setting, index) => {
          if (!setting.keymap) {
            return;
          }

          GoogleAnalytics.sendEvent('keymap', 'registered', setting.keymap);
          var commandName = 'build:trigger:' + setting.name;
          var keymapSpec = { 'atom-workspace': {} };
          keymapSpec['atom-workspace'][setting.keymap] = commandName;
          var keymapDispose = atom.keymaps.add(setting.name, keymapSpec);
          var commandDispose = atom.commands.add('atom-workspace', commandName, this.build.bind(this, 'trigger'));
          settings[index].dispose = function () {
            keymapDispose.dispose();
            commandDispose.dispose();
          };
        });

        this.targets[path] = settings;
        this.targetsLoading[path] = false;
      });
    });

    Promise.all(pathPromise).then((entries) => {
      if (entries.length === 0) {
        return;
      }

      let rows = refreshPaths.map(path => `${this.targets[path].length} targets at: ${path}`);
      atom.notifications.addInfo('Build targets parsed.', {
        detail: rows.join('\n')
      });
    });
  },

  selectActiveTarget: function() {
    let path = this.activePath();
    let targets = this.targets[path];
    let targetsView = new TargetsView();

    if (this.targetsLoading[path]) {
      return targetsView.setLoading('Loading project build targets\u2026');
    }

    targetsView.setActiveTarget(this.activeTarget[path]);
    targetsView.setItems((targets || []).map(target => target.name));
    targetsView.awaitSelection().then((newTarget) => {
      this.activeTarget[path] = newTarget;

      let workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'build:trigger');
    }).catch(function (err) {
      targetsView.setError(err.message);
    });
  },

  replace: function(value, targetEnv) {
    var env = _.extend(_.clone(process.env), targetEnv);
    value = value.replace(/\$(\w+)/g, function(match, name) {
      return name in env ? env[name] : match;
    });

    var editor = atom.workspace.getActiveTextEditor();
    if (editor && 'untitled' !== editor.getTitle()) {
      var activeFile = fs.realpathSync(editor.getPath());
      var activeFilePath = path.dirname(activeFile);
      value = value.replace(/{FILE_ACTIVE}/g, activeFile);
      value = value.replace(/{FILE_ACTIVE_PATH}/g, activeFilePath);
      value = value.replace(/{FILE_ACTIVE_NAME}/g, path.basename(activeFile));
      value = value.replace(/{FILE_ACTIVE_NAME_BASE}/g, path.basename(activeFile, path.extname(activeFile)));
    }
    var projectPaths = _.map(atom.project.getPaths(), function(projectPath) {
      try {
        return fs.realpathSync(projectPath);
      } catch (e) {}
    });
    var projectPath = _.find(projectPaths, function(projectPath) {
      return activeFilePath && activeFilePath.startsWith(projectPath);
    }) || projectPaths[0];

    value = value.replace(/{PROJECT_PATH}/g, projectPath);
    if (atom.project.getRepositories[0]) {
      value = value.replace(/{REPO_BRANCH_SHORT}/g, atom.project.getRepositories()[0].getShortHead());
    }

    return value;
  },

  startNewBuild: function(source, targetName) {
    let path = this.activePath();

    Promise.resolve(this.targets[path]).then(targets => {
      if (!targets) {
        throw new BuildError('No eligible build target.', 'No configuration to build this project exists.');
      }

      let target = targets.find(target => (targetName) ? target.name === targetName : target.name === this.activeTarget[path]);
      GoogleAnalytics.sendEvent('build', 'triggered');

      if (!target.exec) {
        throw new BuildError('Inavlid build file.', 'No executable command specified.');
      }

      var env = _.extend(_.clone(process.env), target.env);
      _.each(env, (value, key, list) => {
        list[key] = this.replace(value, target.env);
      });

      let exec = this.replace(target.exec, target.env);
      var args = _.map(target.args, (arg) => this.replace(arg, target.env));
      let cwd = this.replace(target.cwd, target.env);

      this.child = child_process.spawn(
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

        var success = 0 === exitCode && !this.errorMatcher.hasMatch();
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
      this.buildView.append((target.sh ? 'Executing with sh: ' : 'Executing: ') + exec + [ ' ' ].concat(args).join(' ') + '\n');
    }).catch(function (err) {
      if (err instanceof BuildError) {
        if (source === 'save') {
          // If there is no eligible build tool, and cause of build was a save, stay quiet.
          return;
        }

        atom.notifications.addWarning(err.name, { detail: err.message });
      }
    });
  },

  abort: function(cb) {
    this.child.removeAllListeners('close');
    this.child.on('close', () => {
      this.child = null;
      if (cb) {
        cb();
      }
    });

    try {
      kill(this.child.pid);
    } catch (e) {
      /* Something may have happened to the child (e.g. terminated by itself). Ignore this. */
    }

    this.child.killed = true;
  },

  build: function(source, event) {
    clearTimeout(this.finishedTimer);

    this.doSaveConfirm(this.unsavedTextEditors(), () => {
      var next = this.startNewBuild.bind(this, source, event ? event.type.substr(14) : null);
      this.child ? this.abort(next) : next();
    });
  },

  doSaveConfirm: function(modifiedTextEditors, continuecb, cancelcb) {
    var saveAndContinue = function(save) {
      _.each(modifiedTextEditors, function(textEditor) {
        save && textEditor.save();
      });
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

  unsavedTextEditors: function() {
    return _.filter(atom.workspace.getTextEditors(), function(textEditor) {
      return textEditor.isModified() && ('untitled' !== textEditor.getTitle());
    });
  },

  stop: function() {

    clearTimeout(this.finishedTimer);
    if (this.child) {
      if (this.child.killed) {
        // This child has been killed, but hasn't terminated. Hide it from user.
        this.child.removeAllListeners();
        this.child = null;
        this.buildView.buildAborted();
        return;
      }

      this.abort(this.buildView.buildAborted.bind(this.buildView));

      this.buildView.buildAbortInitiated();
    } else {
      this.buildView.reset();
    }
  },

  consumeBuilder: function (builders) {
    if (!(builders instanceof Array)) {
      builders = [ builders ];
    }
    tools = _.union(tools, builders);
    return new Disposable(function () {
      tools = _.difference(tools, builders);
    });
  }
};
