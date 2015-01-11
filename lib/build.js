'use strict';

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var SaveConfirmView = require('./save-confirm-view');
var BuildView = require('./build-view');

module.exports = {
  config: {
    keepVisible: {
      title: 'Keep Visisble',
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
    atom.commands.add('atom-workspace', 'build:trigger', this.build.bind(this));
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
    var build, exec, env, args, cwd, sh;
    var root = atom.project.getPaths()[0];
    if (fs.existsSync(root + '/.atom-build.json')) {
      var realAtomBuild = fs.realpathSync(root + '/.atom-build.json');
      delete require.cache[realAtomBuild];
      build = require(realAtomBuild);
      exec = build.cmd;
      env = build.env;
      args = build.args;
      cwd = build.cwd;
      sh = build.sh;
    }

    if (!exec && fs.existsSync(root + '/package.json')) {
      var realPackage = fs.realpathSync(root + '/package.json');
      delete require.cache[realPackage];
      var pkg = require(realPackage);

      if (pkg.engines && pkg.engines.atom) {
        exec = 'apm';
      }
      if (pkg.engines && pkg.engines.node) {
        exec = 'npm';
      }
      if (pkg.engines && exec) {
        args = [ '--color=always', 'install' ];
      }
    }

    if (!exec && fs.existsSync(root + '/Gruntfile.js')) {
      if (fs.existsSync(root + '/node_modules/.bin/grunt')) {
        // if grunt is installed locally, prefer this
        exec = root + '/node_modules/.bin/grunt';
      } else {
        // else use global installation
        exec = 'grunt';
      }
    }

    if (!exec && fs.existsSync(root + '/gulpfile.js')) {
      if (fs.existsSync(root + '/node_modules/.bin/gulp')) {
        // if gulp is installed locally, prefer this
        exec = root + '/node_modules/.bin/gulp';
      } else {
        // else use global installation
        exec = 'gulp';
      }
    }

    if (!exec && fs.existsSync(root + '/mix.exs')) {
      exec = 'mix';
      args = [ 'compile' ];
    }

    if (!exec && fs.existsSync(root + '/Makefile')) {
      exec = 'make';
      args = [];
    }

    return {
      exec: exec,
      env: env || {},
      args: args || [],
      cwd: cwd || root,
      sh: (undefined === sh) ? true : sh
    };
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

  startNewBuild: function() {
    var cmd = {};
    try {
      cmd = this.buildCommand();
    } catch (error) {
      this.buildView.reset();
      this.buildView.errorMessage('You have a syntax error in your build file.', true);
      this.buildView.append(error.message);
      return;
    }

    if (!cmd.exec) {
      return;
    }

    var self = this;
    var env = _.extend(process.env, cmd.env);
    _.each(env, function(value, key, list) {
      list[key] = self.replace(value);
    });

    var args = _.map(cmd.args, this.replace);

    cmd.exec = this.replace(cmd.exec);

    this.child = child_process.spawn(
      cmd.sh ? '/bin/sh' : cmd.exec,
      cmd.sh ? [ '-c', [ cmd.exec ].concat(args).join(' ') ] : args,
      { cwd: this.replace(cmd.cwd), env: env }
    );

    this.child.stdout.on('data', this.buildView.append.bind(this.buildView));
    this.child.stderr.on('data', this.buildView.append.bind(this.buildView));
    this.child.on('error', function(err) {
      self.buildView.append((cmd.sh ? 'Unable to execute with sh: ' : 'Unable to execute: ') + cmd.exec);
      self.buildView.append(/\s/.test(cmd.exec) ? '`cmd` cannot contain space. Use `args` for arguments.' : '');
    });

    this.child.on('close', function(exitCode) {
      self.buildView.buildFinished(0 === exitCode);
      if (0 === exitCode) {
        self.finishedTimer = setTimeout(function() {
          self.buildView.detach();
        }, 1000);
      }
      self.child = null;
    });

    this.buildView.buildStarted();
    this.buildView.append((cmd.sh ? 'Executing with sh: ' : 'Executing: ') + cmd.exec + [ ' ' ].concat(args).join(' '));
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
