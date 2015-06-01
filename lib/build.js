'use strict';

var child_process = require('child_process');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var _ = require('lodash');
var Promise = require('bluebird');
var XRegExp = require('xregexp').XRegExp;

var SaveConfirmView = require('./save-confirm-view');
var TargetsView = require('./targets-view');
var BuildView = require('./build-view');
var GoogleAnalytics = require('./google-analytics');
var tools = require('./tools');

function NoToolError() {
  this.message = 'No tool can provide any build configurations.';
  this.name = 'NoToolSelected';
  Error.captureStackTrace(this, NoToolError);
}

NoToolError.prototype = Object.create(Error.prototype);
NoToolError.prototype.constructor = NoToolError;

module.exports = {
  config: {
    panelVisibility: {
      title: 'Panel Visibility',
      description: 'Set when the build panel should be visible.',
      type: 'string',
      default: 'Toggle',
      enum: [ 'Toggle', 'Keep Visible', 'Show on Error' ],
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
    stealFocus: {
      title: 'Steal Focus',
      description: 'Steal focus when opening build panel.',
      type: 'boolean',
      default: true,
      order: 4
    },
    monocleHeight: {
      title: 'Monocle Height',
      description: 'How much of the workspace to use for build panel when it is "maximized".',
      type: 'number',
      default: 0.75,
      minimum: 0.1,
      maximum: 0.9,
      order: 5
    },
    minimizedHeight: {
      title: 'Minimized Height',
      description: 'How much of the workspace to use for build panel when it is "minimized".',
      type: 'number',
      default: 0.15,
      minimum: 0.1,
      maximum: 0.9,
      order: 6
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
    atom.commands.add('atom-workspace', 'build:trigger', this.build.bind(this));
    atom.commands.add('atom-workspace', 'build:select-active-target', this.selectActiveTarget.bind(this));
    atom.commands.add('atom-workspace', 'build:error-match', this.errorMatch.bind(this));
    atom.commands.add('atom-workspace', 'build:error-match-first', this.errorMatchFirst.bind(this));
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
          var workspaceElement = atom.views.getView(atom.workspace);
          atom.commands.dispatch(workspaceElement, 'build:trigger');
        }
      });
    });

    GoogleAnalytics.sendEvent('core', 'activated');
  },

  deactivate: function() {
    GoogleAnalytics.sendEvent('core', 'deactivated');
    if (this.customFileWatcher) {
      this.customFileWatcher.close();
    }
    if (this.child) {
      this.child.kill('SIGKILL');
    }
    clearTimeout(this.finishedTimer);
  },

  activePath: function () {
    var textEditor = atom.workspace.getActiveTextEditor();
    if (!textEditor || !textEditor.getPath()) {
      /* default to building the first one if no editor is active */
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
      .bind(this)
      .then(function () {
        this.customFileWatcher = fs.watch(customFile, function () {
          this.refreshTargets();
        }.bind(this));
      })
      .catch(function(err) { /* Unable to watch file. Updates to custom file will require manual refresh */ })
      .then(function () {
        return _.filter(tools, function (tool) {
          return tool.isEligable(path);
        });
      })
      .then(function (tools) {
        return Promise.all(_.map(tools, function (tool) {
          return tool.settings(path);
        }));
      })
      .then(_.flatten)
      .then(function (settings) {
        if (0 === _.size(settings)) {
          throw new NoToolError();
        }

        prioritizedTarget = settings[0].name;
        return _.map(settings, function (s) {
          return [ s.name, _.defaults(s, this.cmdDefaults(path)) ];
        }.bind(this));
      })
      .then(_.zipObject)
      .then(function (targets) {
        if (_.isNull(this.activeTarget) || _.isUndefined(targets[this.activeTarget])) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          this.activeTarget = prioritizedTarget;
        }
        return (this.targets = targets);
      });
  },

  selectActiveTarget: function() {
    var targetsView = new TargetsView();
    targetsView.setLoading('Loading project build targets...\u2026');

    this.refreshTargets().bind(this).then(function (targets) {
      targetsView.setActiveTarget(this.activeTarget);
      targetsView.setItems(_.keys(targets));
      return targetsView.awaitSelection();
    }).then(function(newTarget) {
      this.activeTarget = newTarget;

      var workspaceElement = atom.views.getView(atom.workspace);
      atom.commands.dispatch(workspaceElement, 'build:trigger');
    }).catch(NoToolError, function (error) {
      targetsView.setError(error.message);
    }).catch(function (error) {
      targetsView.setError(error.message);
    });
  },

  replace: function(value) {
    var env = _.extend(_.clone(process.env), this.cmd.env);
    value = value.replace(/\$(\w+)/, function(match, name) {
      return name in env ? env[name] : match;
    });

    var editor = atom.workspace.getActiveTextEditor();
    if (editor && 'untitled' !== editor.getTitle()) {
      var activeFile = fs.realpathSync(editor.getPath());
      value = value.replace('{FILE_ACTIVE}', activeFile);
      value = value.replace('{FILE_ACTIVE_PATH}', path.dirname(activeFile));
      value = value.replace('{FILE_ACTIVE_NAME}', path.basename(activeFile));
      value = value.replace('{FILE_ACTIVE_NAME_BASE}', path.basename(activeFile, path.extname(activeFile)));
    }

    value = value.replace('{PROJECT_PATH}', fs.realpathSync(atom.project.getPaths()[0]));
    if (atom.project.getRepositories[0]) {
      value = value.replace('{REPO_BRANCH_SHORT}', atom.project.getRepositories()[0].getShortHead());
    }

    return value;
  },

  errorParse: function() {
    this.match = [];
    var regex = XRegExp(this.cmd.errorMatch);

    var matchErr, matchOut;

    matchErr = XRegExp.forEach(this.stderr.toString('utf8'), regex, function (match) {
      return this.push(match);
    }, []);

    matchOut = XRegExp.forEach(this.stdout.toString('utf8'), regex, function (match) {
      return this.push(match);
    }, []);

    this.match = matchErr.concat(matchOut);
  },

  errorMatchGoTo: function () {
    var file = this.replace(this.cmd.cwd) + path.sep + this.match[0].file;
    if (!this.match[0].file) {
      file = this.match[0].absFile;
    }
    var row = this.match[0].line ? this.match[0].line - 1 : 0; /* Because atom is zero-based */
    var col =  this.match[0].col ? this.match[0].col - 1 : 0; /* Because atom is zero-based */

    fs.exists(file, function (exists) {
      if (!exists) {
        this.buildView.errorMessage('Error matching failed:', 'Matched file does not exist: ' + file);
        return;
      }

      atom.workspace.open(file, {
        initialLine: row,
        initialColumn: col
      });
    }.bind(this));
  },

  errorMatch: function() {
    GoogleAnalytics.sendEvent('errorMatch', 'match');
    if (!this.cmd.errorMatch) {
      return;
    }

    if (this.match.length === 0) {
      this.errorParse();
      if (this.match.length === 0) {
        return;
      }
    }

    this.errorMatchGoTo();
    this.match.push(this.match.shift());
  },

  errorMatchFirst: function() {
    GoogleAnalytics.sendEvent('errorMatch', 'first');
    if (!this.cmd.errorMatch) {
      return;
    }
    this.errorParse();
    if (this.match.length === 0) {
      return;
    }

    this.errorMatchGoTo();
    this.match.push(this.match.shift());
  },

  startNewBuild: function() {
    this.cmd = {};
    this.match = [];

    Promise.resolve()
      .bind(this)
      .then(function () {
        return (this.activeTarget) ? this.targets : this.refreshTargets();
      })
      .then(function (targets) {
        this.cmd = targets[this.activeTarget];
        GoogleAnalytics.sendEvent('build', 'triggered');

        if (!this.cmd.exec) {
          this.buildView.errorMessage('Invalid build file.', 'No executable command specified.');
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
          this.buildView.append((this.cmd.sh ? 'Unable to execute with sh: ' : 'Unable to execute: ') + this.cmd.exec);
          this.buildView.append(/\s/.test(this.cmd.exec) ? '`cmd` cannot contain space. Use `args` for arguments.' : '');
        }.bind(this));

        this.child.on('close', function(exitCode) {
          this.buildView.buildFinished(0 === exitCode);
          if (0 === exitCode) {
            GoogleAnalytics.sendEvent('build', 'succeeded');
            this.finishedTimer = setTimeout(function() {
              this.buildView.detach();
            }.bind(this), 1000);
          } else {
            GoogleAnalytics.sendEvent('build', 'failed');
          }
          this.child = null;
        }.bind(this));

        this.buildView.buildStarted();
        this.buildView.append((this.cmd.sh ? 'Executing with sh: ' : 'Executing: ') + this.cmd.exec + [ ' ' ].concat(args).join(' '));
      }).catch(NoToolError, function (error) {
        /* Maybe we should show the build-panel with an error message here? */
      }).catch(SyntaxError, function (error) {
        this.buildView.errorMessage('You have a syntax error in your build file.', error.message);
      }).catch(function (error) {
        this.buildView.errorMessage('Ooops. Something went wrong.', error.message + (error.stack ? '\n' + error.stack : ''));
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
    this.child.kill();
    this.child.killed = true;
  },

  build: function() {
    clearTimeout(this.finishedTimer);

    this.doSaveConfirm(this.unsavedTextEditors(), function() {
      if (this.child) {
        this.abort(this.startNewBuild.bind(this));
      } else {
        this.startNewBuild();
      }
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
      if (this.child.killed){
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
  }
};
