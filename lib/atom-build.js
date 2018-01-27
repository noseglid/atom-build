'use babel';

import EventEmitter from 'events';

function getConfig(file) {
  const fs = require('fs');
  const realFile = fs.realpathSync(file);
  const contents = fs.readFileSync(realFile);

  function fromScript(script) {
    const globals = {
      __dirname: require('path').dirname(realFile),
      __filename: realFile,
      module: { exports: {} },
      require
    };
    globals.exports = globals.module.exports;
    const scriptFn = new Function(...Object.keys(globals), script);
    scriptFn(...Object.keys(globals).map(n => globals[n]));
    return globals.module.exports;
  };

  switch (require('path').extname(file)) {
    case '.json':
      return JSON.parse(contents);

    case '.js':
      return fromScript(contents);

    case '.coffee':
      let coffee;
      try
      {
        coffee = require('coffeescript');
      }
      catch (e) {}
      if (coffee === undefined)
      {
        coffee = require('coffee-script');
      }
      return fromScript(coffee.compile(contents, { bare: true }));

    case '.cson':
      return require('cson-parser').parse(contents);

    case '.yaml':
    case '.yml':
      return require('js-yaml').safeLoad(contents);
  }

  return {};
}
function createBuildConfig(build, name) {
  const conf = {
    name: 'Custom: ' + name,
    exec: build.cmd,
    env: build.env,
    args: build.args,
    cwd: build.cwd,
    sh: build.sh,
    errorMatch: build.errorMatch,
    functionMatch: build.functionMatch,
    warningMatch: build.warningMatch,
    atomCommandName: build.atomCommandName,
    keymap: build.keymap,
    killSignals: build.killSignals
  };

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
    this.files = [].concat.apply([], [ 'json', 'cson', 'yaml', 'yml', 'js', 'coffee' ].map(ext => [
      path.join(this.cwd, `.atom-build.${ext}`),
      path.join(os.homedir(), `.atom-build.${ext}`)
    ])).filter(fs.existsSync);
    return 0 < this.files.length;
  }

  settings() {
    const fs = require('fs');
    this.fileWatchers.forEach(fw => fw.close());
    // On Linux, closing a watcher triggers a new callback, which causes an infinite loop
    // fallback to `watchFile` here which polls instead.
    this.fileWatchers = this.files.map(file =>
      (require('os').platform() === 'linux' ? fs.watchFile : fs.watch)(file, () => this.emit('refresh'))
    );

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
