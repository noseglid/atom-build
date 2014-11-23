var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');

var BuildView = require('./build-view');
var SaveConfirmView = require('./save-confirm-view');

module.exports = {
  config: {
    monocleHeight: {
      type: 'number',
      default: 0.75
    },
    minimizedHeight: {
      type: 'number',
      default: 0.15
    },
    keepVisible: {
      type: 'boolean',
      default: false
    },
    saveOnBuild: {
      type: 'boolean',
      default: false
    }
  },

  activate: function(state) {
    'use strict';

    // Manually append /usr/local/bin as it may not be set on some systems,
    // and it's common to have node installed here. Keep it at end so it won't
    // accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin';

    this.buildView = new BuildView();
    atom.workspaceView.command('build:trigger', _.bind(this.build, this));
    atom.workspaceView.command('build:stop', _.bind(this.stop, this));

    if (atom.config.get('build.keepVisible')) {
      this.buildView.attach();
    }
  },

  deactivate: function() {
    'use strict';

    if (this.child) {
      this.child.kill('SIGKILL');
    }
    clearTimeout(this.finishedTimer);
  },

  buildCommand: function() {
    'use strict';

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
    'use strict';

    if (atom.workspace.getActiveEditor()) {
      var activeFile = fs.realpathSync(atom.workspace.getActiveEditor().getPath());
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
    'use strict';
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

    this.child.stdout.on('data', _.bind(this.buildView.append, this.buildView));
    this.child.stderr.on('data', _.bind(this.buildView.append, this.buildView));
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
    'use strict';
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
    'use strict';

    clearTimeout(this.finishedTimer);

    var self = this;
    this.doSaveConfirm(this.unsavedEditors(), function() {
      if (self.child) {
        self.abort(_.bind(self.startNewBuild, self));
      } else {
        self.startNewBuild();
      }
    });
  },

  doSaveConfirm: function(modifiedEditors, continuecb, cancelcb) {
    'use strict';

    if (0 === _.size(modifiedEditors)) {
      continuecb();
      return;
    }

    var saveConfirmView = new SaveConfirmView();
    saveConfirmView.show(continuecb, cancelcb);
  },

  unsavedEditors: function() {
    'use strict';

    return _.filter(atom.workspace.getTextEditors(), function(editor) {
      return editor.isModified();
    });
  },

  stop: function() {
    'use strict';

    clearTimeout(this.finishedTimer);
    if (this.child) {
      if (this.child.killed){
        // This child has been killed, but hasn't terminated. Hide it from user.
        this.child.removeAllListeners();
        this.child = null;
        this.buildView.buildAborted();
        return;
      }

      this.abort(_.bind(this.buildView.buildAborted, this.buildView));

      this.buildView.buildAbortInitiated();
    } else {
      this.buildView.reset();
    }
  }
};
