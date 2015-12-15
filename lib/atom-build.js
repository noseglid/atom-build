'use babel';

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import CSON from 'cson-parser';
import yaml from 'js-yaml';
import EventEmitter from 'events';

function getConfig(file) {
  const realFile = fs.realpathSync(file);
  delete require.cache[realFile];
  switch (path.extname(file)) {
    case '.json':
      return require(realFile);

    case '.cson':
      return CSON.parse(fs.readFileSync(realFile));

    case '.yml':
      return yaml.safeLoad(fs.readFileSync(realFile));
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
    this.fileWatchers = [];
  }

  destructor() {
    this.fileWatchers.forEach(fw => fw.close());
  }

  getNiceName() {
    return 'Custom file';
  }

  isEligible() {
    this.files = [ '.atom-build.json', '.atom-build.cson', '.atom-build.yml' ]
      .map(file => path.join(this.cwd, file))
      .filter(fs.existsSync);
    return 0 < this.files.length;
  }

  settings() {
    this.fileWatchers.forEach(fw => fw.close());
    this.fileWatchers = this.files.map(file => fs.watch(file, () => this.emit('refresh')));

    const config = [];
    this.files.map(getConfig).forEach(build => {
      config.push(
        createBuildConfig(build, build.name || 'default'),
        ..._.map(build.targets, (target, name) => createBuildConfig(target, name))
      );
    });

    return config;
  }
}
