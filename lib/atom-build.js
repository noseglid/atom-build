'use babel';

import EventEmitter from 'events';

function getConfig(file) {
  const fs = require('fs');
  const realFile = fs.realpathSync(file);
  delete require.cache[realFile];
  switch (require('path').extname(file)) {
    case '.json':
      return require(realFile);

    case '.cson':
      return require('cson-parser').parse(fs.readFileSync(realFile));

    case '.yml':
      return require('js-yaml').safeLoad(fs.readFileSync(realFile));
  }
}

function createBuildConfig(build, name) {
  return {
    name: 'Custom: ' + name,
    exec: build.cmd,
    env: build.env,
    args: build.args,
    cwd: build.cwd,
    sh: build.sh,
    errorMatch: build.errorMatch,
    atomCommandName: build.atomCommandName,
    keymap: build.keymap
  };
}

export default class CustomFile extends EventEmitter {
  constructor(cwd) {
    super();
    this.cwd = cwd;
    this.filewatcher = undefined;  // Mac and Linux
    this.fileWatchers = [];  // Windows
  }

  destructor() {
    // Mac and Linux
    if (this.filewatcher && this.filewatcher.close) {
      this.filewatcher.close();
    } else {
      atom.notifications.addError('Failed to close filewatcher', {
        detail: this.filewatcher ? 'Close function is not defined' : 'Filewatcher is not initalized',
        dismissable: true
      });
    }

    // Windows
    if (this.fileWatchers) {
      this.fileWatchers.forEach(fw => fw.close());
    }
  }

  getNiceName() {
    return 'Custom file';
  }

  isEligible() {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    this.files = [
      path.join(this.cwd, '.atom-build.json'),
      path.join(this.cwd, '.atom-build.cson'),
      path.join(this.cwd, '.atom-build.yml'),
      path.join(os.homedir(), '.atom-build.json'),
      path.join(os.homedir(), '.atom-build.cson'),
      path.join(os.homedir(), '.atom-build.yml')
    ].filter(fs.existsSync);
    return 0 < this.files.length;
  }

  settings() {
    const os = require('os');
    if (os.platform() === 'win32') {
      // Windows
      const fs = require('fs');

      this.fileWatchers.forEach(fw => fw.close());
      this.fileWatchers = this.files.map(file => fs.watch(file, () => this.emit('refresh')));
    } else {
      // Mac and Linux
      const watchr = require('watchr');

      watchr.watch({
        paths: this.files,
        listeners: {
          change: () => this.emit('refresh')
        },
        next: (err, watcher) => {
          this.filewatcher = watcher;
        }
      });
    }

    const config = [];
    this.files.map(getConfig).forEach(build => {
      config.push(
        createBuildConfig(build, build.name || 'default'),
        ...Object.keys(build.targets || {}).map(name => createBuildConfig(build.targets[name], name))
      );
    });

    return config;
  }
}
