'use babel';

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import CSON from 'cson-parser';
import EventEmitter from 'events';

function getConfig(file) {
  const realFile = fs.realpathSync(file);
  delete require.cache[realFile];
  switch (path.extname(file)) {
    case '.json':
      return require(realFile);

    case '.cson':
      return CSON.parse(fs.readFileSync(realFile));
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
    keymap: build.keymap
  };
}

export default class CustomFile extends EventEmitter {
  constructor(cwd) {
    super();
    this.cwd = cwd;
  }

  getNiceName() {
    return 'Custom file';
  }

  isEligible() {
    console.log('eligible?', this.cwd);
    this.files = [ '.atom-build.json', '.atom-build.cson' ]
      .map(file => path.join(this.cwd, file))
      .filter(fs.existsSync);
    return 0 < this.files.length;
  }

  settings() {
    const config = [];
    this.files.map(getConfig).forEach(build => {
      config.push(
        createBuildConfig(build, build.name || 'default'),
        ..._.map(build.targets, (target, name) => createBuildConfig(target, name))
      );
    });

    return config;
  }

  on(ev, cb) {
    this.fileWatchers = this.fileWatchers || [];
    if ('refresh' !== ev || !this.files) {
      return;
    }

    this.fileWatchers.push(...this.files.map(file => fs.watch(file, cb)));
  }

  off(ev) {
    this.fileWatchers = this.fileWatchers || [];
    if ('refresh' !== ev) {
      return;
    }

    this.fileWatchers.forEach(watcher => watcher.close());
    this.fileWatchers = [];
  }
}
