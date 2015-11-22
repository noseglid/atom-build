'use babel';

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import CSON from 'cson-parser';

export const niceName = 'Custom file';

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

export function isEligable(cwd) {
  this.files = [ '.atom-build.json', '.atom-build.cson' ]
    .map(file => path.join(cwd, file))
    .filter(fs.existsSync);
  return 0 < this.files.length;
}

export function settings() {
  const config = [];
  this.files.map(getConfig).forEach(build => {
    config.push(
      createBuildConfig(build, build.name || 'default'),
      ..._.map(build.targets, (target, name) => createBuildConfig(target, name))
    );
  });

  return config;
}

export function on(ev, cb) {
  this.fileWatchers = this.fileWatchers || [];
  if ('refresh' !== ev || !this.files) {
    return;
  }

  this.fileWatchers.push(...this.files.map(file => fs.watch(file, cb)));
}

export function off(ev) {
  this.fileWatchers = this.fileWatchers || [];
  if ('refresh' !== ev) {
    return;
  }

  this.fileWatchers.forEach(watcher => watcher.close());
  this.fileWatchers = [];
}
