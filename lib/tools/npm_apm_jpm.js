'use strict';

var path = require('path');
var fs = require('fs');

module.exports.niceName = 'npm, apm, or jpm';

module.exports.isEligable = function (cwd) {
  if (!fs.existsSync(path.join(cwd, 'package.json'))) {
    return false;
  }

  var realPackage = fs.realpathSync(path.join(cwd, 'package.json'));
  delete require.cache[realPackage];
  var pkg = require(realPackage);

  if (!pkg.engines || (!pkg.engines.atom && !pkg.engines.node && !pkg.engines.firefox)) {
    return false;
  }

  return true;
};

module.exports.settings = function (cwd) {
  var realPackage = fs.realpathSync(path.join(cwd, 'package.json'));
  var pkg = require(realPackage);

  var executableExtension = /^win/.test(process.platform) ? '.cmd' : '';

  var config = []

  if (pkg.engines.firefox) {
    name = 'jpm';
    config.push( {
      name: name + ": run",
      exec: name + executableExtension,
      args: [ 'run' ],
      sh: false
    });
    config.push( {
      name: name + ": xpi",
      exec: name + executableExtension,
      args: [ 'xpi' ],
      sh: false
    });

  } else {
    var name = 'apm';
    if (pkg.engines.node) {
      name = 'npm';
    }

    config.push( {
      name: name + ": default",
      exec: name + executableExtension,
      args: [ '--color=always', 'install' ],
      sh: false
    });

    for (var script in pkg.scripts) {
      config.push({
        name: 'npm: ' + script,
        exec: 'npm',
        args: [ '--color=always', 'run', script ],
        sh: false
      });
    }
  }

  return config;
};
