'use babel';
'use strict';

var path = require('path');
var fs = require('fs');

module.exports.niceName = 'npm or apm';

module.exports.isEligable = function (cwd) {
  if (!fs.existsSync(path.join(cwd, 'package.json'))) {
    return false;
  }

  var realPackage = fs.realpathSync(path.join(cwd, 'package.json'));
  delete require.cache[realPackage];
  var pkg = require(realPackage);

  if (!pkg.engines || (!pkg.engines.atom && !pkg.engines.node)) {
    return false;
  }

  return true;
};

module.exports.settings = function (cwd) {
  var realPackage = fs.realpathSync(path.join(cwd, 'package.json'));
  var pkg = require(realPackage);

  var executableExtension = /^win/.test(process.platform) ? '.cmd' : '';
  var config = [ {
    name: pkg.engines.node ? 'npm: default' : 'apm: default',
    exec: (pkg.engines.node ? 'npm' : 'apm') + executableExtension,
    args: [ '--color=always', 'install' ],
    sh: false
  } ];

  for (var script in pkg.scripts) {
    config.push({
      name: 'npm: ' + script,
      exec: 'npm',
      args: [ '--color=always', 'run', script ],
      sh: false
    });
  }
  return config;
};
