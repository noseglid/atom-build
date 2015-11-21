'use babel';
'use strict';

import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import CSON from 'cson-parser';

module.exports.niceName = 'Custom file';

function getConfig(file) {
  var realFile = fs.realpathSync(file);
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

module.exports.isEligable = function (cwd) {
  this.files = [ '.atom-build.json', '.atom-build.cson' ]
    .map(file => path.join(cwd, file))
    .filter(fs.existsSync);
  return 0 < this.files.length;
};

module.exports.settings = function (cwd) {

  let config = [];
  this.files.map(getConfig).forEach(build => {
    config.push(
      createBuildConfig(build, build.name || 'default'),
      ..._.map(build.targets, (target, name) => createBuildConfig(target, name))
    );
  });

  return config;
};

module.exports.on = function (ev, cb) {
  this.fileWatchers = this.fileWatchers || [];
  if ('refresh' !== ev || !this.files) {
    return;
  }

  this.fileWatchers.push(...this.files.map(file => fs.watch(file, cb)));
};

module.exports.off = function (ev) {
  this.fileWatchers = this.fileWatchers || [];
  if ('refresh' !== ev) {
    return;
  }

  this.fileWatchers.forEach(watcher => watcher.close());
  this.fileWatchers = [];
};
