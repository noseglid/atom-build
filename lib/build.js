'use strict';

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var XRegExp = require('xregexp').XRegExp;

var SaveConfirmView = require('./save-confirm-view');
var BuildView = require('./build-view');
var tools = require('./tools');

module.exports = {
  config: {
    keepVisible: {
      title: 'Keep Visible',
      description: 'If the build panel should be kept visible at all times.',
      type: 'boolean',
      default: false
    },
    buildOnSave: {
      title: 'Automatically build on save',
      description: 'Autmatically build your project each time an editor is saved.',
      type: 'boolean',
      default: false
    },
    saveOnBuild: {
      title: 'Automatically save on build',
      description: 'Automatically save all edited files when triggering a build.',
      type: 'boolean',
      default: false
    },
    monocleHeight: {
      title: 'Monocle Height',
      description: 'How much of the workspace to use for build panel when it is "maximized".',
      type: 'number',
      default: 0.75,
      minimum: 0.1,
      maximum: 0.9
    },
    minimizedHeight: {
      title: 'Minimized Height',
      description: 'How much of the workspace to use for build panel when it is "minimized".',
      type: 'number',
      default: 0.15,
      minimum: 0.1,
      maximum: 0.9
    }
  },

  activate: function(state) {
    // Manually append /usr/local/bin as it may not be set on some systems,
    // and it's common to have node installed here. Keep it at end so it won't
    // accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin';

    var self = this;
    this.buildView = new BuildView();
    this.cmd = {};
    this.stdout = new Buffer(0);
    this.stderr = new Buffer(0);
    atom.commands.add('atom-workspace', 'build:trigger', this.build.bind(this));
    atom.commands.add('atom-workspace', 'build:error-match', this.errorMatch.bind(this));
    atom.commands.add('atom-workspace', 'build:stop', this.stop.bind(this));
    atom.commands.add('atom-workspace', 'build:confirm', function() {
      document.activeElement.click();
    });
    atom.commands.add('atom-workspace', 'build:no-confirm', function() {
      self.saveConfirmView.cancel();
    });

    atom.workspace.observeTextEditors(function(editor) {
      editor.onDidSave(function(event) {
        if (atom.config.get('build.buildOnSave')) {
          var workspaceElement = atom.views.getView(atom.workspace);
          atom.commands.dispatch(workspaceElement, 'build:trigger');
        }
      });
    });
  },

  deactivate: function() {
    if (this.child) {
      this.child.kill('SIGKILL');
    }
    clearTimeout(this.finishedTimer);
  },

  buildCommand: function() {
    var path = atom.project.getPaths()[0]; // Only support root path for now.
    var cmd = {
      env: {},
      args: [],
      cwd: path,
      sh: true,
      errorMatch: ''
    };
    _.find(tools, function (tool) {
      if (!tool.isEligable(path)) {
        return;
      }
      cmd = _.defaults(tool.settings(path), cmd);
      return true;
    });

    return cmd;
  },

  replace: function(value) {
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

  errorMatch: function() {
    if (!this.cmd.errorMatch) {
      return;
    }
    var regex = XRegExp(this.cmd.errorMatch);
    var match =
      XRegExp.exec(this.stderr.toString('utf8'), regex) ||
      XRegExp.exec(this.stdout.toString('utf8'), regex);

    if (!match) {
      return;
    }

    atom.workspace.open(match.file, {
      initialLine: match.line ? match.line - 1 : 0, /* Because atom is zero-based */
      initialColumn: match.col ? match.col - 1 : 0 /* Because atom is zero-based */
    });
  },

  startNewBuild: function() {
    this.cmd = {};
    try {
      this.cmd = this.buildCommand();
    } catch (error) {
      this.buildView.reset();
      this.buildView.errorMessage('You have a syntax error in your build file.', true);
      this.buildView.append(error.message);
      return;
    }

    if (!this.cmd.exec) {
      return;
    }

    var self = this;
    var env = _.extend(process.env, this.cmd.env);
    _.each(env, function(value, key, list) {
      list[key] = self.replace(value);
    });

    var args = _.map(this.cmd.args, this.replace);

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
      self.buildView.append((this.cmd.sh ? 'Unable to execute with sh: ' : 'Unable to execute: ') + this.cmd.exec);
      self.buildView.append(/\s/.test(this.cmd.exec) ? '`cmd` cannot contain space. Use `args` for arguments.' : '');
    });

    this.child.on('close', function(exitCode) {
      this.buildView.buildFinished(0 === exitCode);
      if (0 === exitCode) {
        this.finishedTimer = setTimeout(function() {
          this.buildView.detach();
        }.bind(this), 1000);
      }
      this.child = null;
    }.bind(this));

    this.buildView.buildStarted();
    this.buildView.append((this.cmd.sh ? 'Executing with sh: ' : 'Executing: ') + this.cmd.exec + [ ' ' ].concat(args).join(' '));
  },

  abort: function(cb) {
    this.child.removeAllListeners('close');
    var self = this;
    this.child.on('close', function() {
      self.child = null;
      if (cb) {
        cb();
      }
    });
    this.child.kill();
    this.child.killed = true;
  },

  build: function() {
    clearTimeout(this.finishedTimer);

    var self = this;
    this.doSaveConfirm(this.unsavedTextEditors(), function() {
      if (self.child) {
        self.abort(self.startNewBuild.bind(self));
      } else {
        self.startNewBuild();
      }
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
