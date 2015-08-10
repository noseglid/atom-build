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
var tools = require('./tools');
var extra_tools = [];

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
    }
  },

  activate: function(state) {
    // Manually append /usr/local/bin as it may not be set on some systems,
    // and it's common to have node installed here. Keep it at end so it won't
    // accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin';

    this.buildView = new BuildView();

    this.cmd = {};
    this.targets = {};
    this.activeTarget = null;
    this.match = [];
    this.stdout = new Buffer(0);
    this.stderr = new Buffer(0);
    this.errorMatcher = new ErrorMatcher();

    atom.commands.add('atom-workspace', 'build:trigger', this.build.bind(this, 'trigger'));
    atom.commands.add('atom-workspace', 'build:select-active-target', this.selectActiveTarget.bind(this));
    atom.commands.add('atom-workspace', 'build:stop', this.stop.bind(this));
    atom.commands.add('atom-workspace', 'build:confirm', function() {
      GoogleAnalytics.sendEvent('build', 'confirmed');
      document.activeElement.click();
    });
    atom.commands.add('atom-workspace', 'build:no-confirm', function() {
      GoogleAnalytics.sendEvent('build', 'not confirmed');
      this.saveConfirmView.cancel();
    }.bind(this));

    atom.workspace.observeTextEditors(function(editor) {
      editor.onDidSave(function(event) {
        if (atom.config.get('build.buildOnSave')) {
          this.build('save');
        }
      }.bind(this));
    }.bind(this));

    this.errorMatcher.on('error', function (message) {
      atom.notifications.addError('Error matching failed!', { detail: message });
    });

    this.errorMatcher.on('scroll', this.buildView.scrollTo.bind(this.buildView));
    this.errorMatcher.on('replace', this.buildView.replace.bind(this.buildView));

    this.refreshTargets().catch(function(e) {});
  },

  deactivate: function() {
    if (this.customFileWatcher) {
      this.customFileWatcher.close();
    }
    if (this.child) {
      kill(this.child.pid, 'SIGKILL');
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
      return _.find(atom.project.getPaths(), function (path) {
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
      errorMatch: ''
    };
  },

  refreshTargets: function() {
    var path = this.activePath();
    var prioritizedTarget;
    var customFile = path + '/.atom-build.json';

    if (this.customFileWatcher) {
      this.customFileWatcher.close();
      this.customFileWatcher = undefined;
    }

    return Promise.resolve(tools)
      .then(function () {
        this.customFileWatcher = fs.watch(customFile, function () {
          this.refreshTargets();
        }.bind(this));
      }.bind(this))
      .catch(function(err) { /* Unable to watch file. Updates to custom file will require manual refresh */ })
      .then(function () {
        if (!path) {
          throw new BuildError('No active project', 'No project is active, don\'t know what to build...');
        }

        return _.filter(tools.concat(extra_tools), function (tool) {
          return tool.isEligable(path);
        });
      })
      .then(function (tools) {
        return Promise.all(_.map(tools, function (tool) {
          GoogleAnalytics.sendEvent('build', 'tool eligible', tool.niceName);
          return tool.settings(path);
        }));
      })
      .then(_.flatten)
      .then(function (settings) {
        if (0 === _.size(settings)) {
          throw new BuildError('No eligible build tool.', 'No tool can provide any build configurations.');
        }

        prioritizedTarget = settings[0].name;
        return _.map(settings, function (s) {
          return [ s.name, _.defaults(s, this.cmdDefaults(path)) ];
        }.bind(this));
      }.bind(this))
      .then(_.zipObject)
      .then(function (targets) {
        if (_.isNull(this.activeTarget) || _.isUndefined(targets[this.activeTarget])) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          this.activeTarget = prioritizedTarget;
        }

        _.forEach(this.targets, function (target) {
          target.dispose(); // Gets rid of keymaps and commands registered
        });

        _.forEach(targets, function (target, targetName) {
          if (!target.keymap) {
            target.dispose = _.noop;
            return;
          }

          GoogleAnalytics.sendEvent('keymap', 'registered', target.keymap);
          var commandName = 'build:trigger:' + targetName;
          var keymapSpec = { 'atom-workspace': {} };
          keymapSpec['atom-workspace'][target.keymap] = commandName;
          var keymapDispose = atom.keymaps.add(targetName, keymapSpec);
          var commandDispose = atom.commands.add('atom-workspace', commandName, this.build.bind(this, 'trigger'));
          target.dispose = function () {
            keymapDispose.dispose();
            commandDispose.dispose();
          };
        }.bind(this));

        return (this.targets = targets);
      }.bind(this));
  },

  selectActiveTarget: function() {
    var targetsView = new TargetsView();
    targetsView.setLoading('Loading project build targets...\u2026');

    this.refreshTargets().then(function (targets) {
      targetsView.setActiveTarget(this.activeTarget);
      targetsView.setItems(_.keys(targets));
      return targetsView.awaitSelection();
    }.bind(this)).then(function(newTarget) {
      this.activeTarget = newTarget;

      var workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'build:trigger');
    }.bind(this)).catch(function (err) {
      targetsView.setError(err.message);
    });
  },

  replace: function(value) {
    var env = _.extend(_.clone(process.env), this.cmd.env);
    value = value.replace(/\$(\w+)/g, function(match, name) {
      return name in env ? env[name] : match;
    });

    var editor = atom.workspace.getActiveTextEditor();
    if (editor && 'untitled' !== editor.getTitle()) {
      var activeFile = fs.realpathSync(editor.getPath());
      var activeFilePath = path.dirname(activeFile);
      value = value.replace('{FILE_ACTIVE}', activeFile);
      value = value.replace('{FILE_ACTIVE_PATH}', activeFilePath);
      value = value.replace('{FILE_ACTIVE_NAME}', path.basename(activeFile));
      value = value.replace('{FILE_ACTIVE_NAME_BASE}', path.basename(activeFile, path.extname(activeFile)));
    }
    var projectPaths = _.map(atom.project.getPaths(), function(projectPath) {
      try {
        return fs.realpathSync(projectPath);
      } catch (e) {}
    });
    var projectPath = _.find(projectPaths, function(projectPath) {
      return activeFilePath && activeFilePath.startsWith(projectPath);
    }) || projectPaths[0];

    value = value.replace('{PROJECT_PATH}', projectPath);
    if (atom.project.getRepositories[0]) {
      value = value.replace('{REPO_BRANCH_SHORT}', atom.project.getRepositories()[0].getShortHead());
    }

    return value;
  },

  startNewBuild: function(source, targetName) {
    this.cmd = {};
    this.match = [];

    Promise.resolve()
      .then(function () {
        return (this.activeTarget) ? this.targets : this.refreshTargets();
      }.bind(this))
      .then(function (targets) {
        this.cmd = targets[targetName ? targetName : this.activeTarget];
        GoogleAnalytics.sendEvent('build', 'triggered');

        if (!this.cmd.exec) {
          atom.notifications.addError('Invalid build file.', { detail: 'No executable command specified.' });
          return;
        }

        var env = _.extend(_.clone(process.env), this.cmd.env);
        _.each(env, function(value, key, list) {
          list[key] = this.replace(value);
        }.bind(this));

        var args = _.map(this.cmd.args, this.replace.bind(this));

        this.cmd.exec = this.replace(this.cmd.exec);

        this.child = child_process.spawn(
          this.cmd.sh ? '/bin/sh' : this.cmd.exec,
          this.cmd.sh ? [ '-c', [ this.cmd.exec ].concat(args).join(' ') ] : args,
          { cwd: this.replace(this.cmd.cwd), env: env }
        );

        this.stdout = new Buffer(0);
        this.child.stdout.on('data', function (buffer) {
          this.stdout = Buffer.concat([ this.stdout, buffer ]);
          this.buildView.append(buffer);
        }.bind(this));

        this.stderr = new Buffer(0);
        this.child.stderr.on('data', function (buffer) {
          this.stderr = Buffer.concat([ this.stderr, buffer ]);
          this.buildView.append(buffer);
        }.bind(this));

        this.child.on('error', function(err) {
          this.buildView.append((this.cmd.sh ? 'Unable to execute with sh: ' : 'Unable to execute: ') + this.cmd.exec + '\n');
          this.buildView.append(/\s/.test(this.cmd.exec) ? '`cmd` cannot contain space. Use `args` for arguments.\n' : '');
        }.bind(this));

        this.child.on('close', function(exitCode) {
          this.buildView.buildFinished(0 === exitCode);
          if (0 === exitCode) {
            GoogleAnalytics.sendEvent('build', 'succeeded');
            this.finishedTimer = setTimeout(function() {
              this.buildView.detach();
            }.bind(this), 1000);
          } else {
            var t = this.targets[this.activeTarget];
            this.errorMatcher.set(t.errorMatch, this.replace(t.cwd), this.buildView.output.text());
            if (atom.config.get('build.scrollOnError')) {
              this.errorMatcher.matchFirst();
            }
            GoogleAnalytics.sendEvent('build', 'failed');
          }
          this.child = null;
        }.bind(this));

        this.buildView.buildStarted();
        this.buildView.append((this.cmd.sh ? 'Executing with sh: ' : 'Executing: ') + this.cmd.exec + [ ' ' ].concat(args).join(' ') + '\n');
      }.bind(this)).catch(function (err) {
        if (err instanceof BuildError) {
          if (source === 'save') {
            // If there is no eligible build tool, and cause of build was a save, stay quiet.
            return;
          }

          atom.notifications.addWarning(err.name, { detail: err.message });
        } else if (err instanceof SyntaxError) {
          atom.notifications.addError('Invalid build file.', { detail: 'You have a syntax error in your build file: ' + err.message });
        } else {
          atom.notifications.addError('Ooops. Something went wrong.', { detail: err.message + (err.stack ? '\n' + err.stack : '') });
        }
      });
  },

  abort: function(cb) {
    this.child.removeAllListeners('close');
    this.child.on('close', function() {
      this.child = null;
      if (cb) {
        cb();
      }
    }.bind(this));

    try {
      kill(this.child.pid);
    } catch (e) {
      /* Something may have happened to the child (e.g. terminated by itself). Ignore this. */
    }

    this.child.killed = true;
  },

  build: function(source, event) {
    clearTimeout(this.finishedTimer);

    this.doSaveConfirm(this.unsavedTextEditors(), function() {
      var next = this.startNewBuild.bind(this, source, event ? event.type.substr(14) : null);
      this.child ? this.abort(next) : next();
    }.bind(this));
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
    extra_tools = _.union(extra_tools, builders);
    return new Disposable(function () {
      extra_tools = _.difference(extra_tools, builders);
    });
  }
};
