'use babel';

import EventEmitter from 'events';
import _ from 'lodash';

function getConfig(file) {
  const fs = require('fs');
  const realFile = fs.realpathSync(file);
  delete require.cache[realFile];
  switch (require('path').extname(file)) {
    case '.json':
    case '.js':
      return require(realFile);

    case '.cson':
      return require('cson-parser').parse(fs.readFileSync(realFile));

    case '.yml':
      return require('js-yaml').safeLoad(fs.readFileSync(realFile));
  }
}

function createBuildConfig(build, name, defaultTarget) {
  const conf = _.defaultsDeep({
    name: 'Custom: ' + name,
    exec: build.cmd,
    env: build.env,
    args: build.args,
    cwd: build.cwd,
    sh: build.sh,
    errorMatch: build.errorMatch,
    atomCommandName: build.atomCommandName,
    keymap: build.keymap
  }, defaultTarget);
  console.log('createBuildConfig', build, name, defaultTarget, conf);

  if (typeof build.postBuild === 'function') {
    conf.postBuild = build.postBuild;
  }

  if (typeof build.preBuild === 'function') {
    conf.preBuild = build.preBuild;
  }

  return conf;
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
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    this.files = [].concat.apply([], [ 'json', 'cson', 'yml', 'js' ].map(ext => [
      path.join(this.cwd, `.atom-build.${ext}`),
      path.join(os.homedir(), `.atom-build.${ext}`)
    ])).filter(fs.existsSync);
    return 0 < this.files.length;
  }

  settings() {
    const fs = require('fs');
    this.fileWatchers.forEach(fw => fw.close());
    this.fileWatchers = this.files.map(file => fs.watch(file, () => this.emit('refresh')));

    const config = [];
    this.files.map(getConfig).forEach(build => {
      var defaultTarget = createBuildConfig(build, build.name || 'default');
      config.push(
        defaultTarget,
        ...Object.keys(build.targets || {}).map(name => createBuildConfig(build.targets[name], name, defaultTarget))
      );

    });

    return config;
  }
}
