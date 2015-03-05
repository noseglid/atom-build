'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  if (!fs.existsSync(path + '/package.json')) {
    return false;
  }

  var realPackage = fs.realpathSync(path + '/package.json');
  delete require.cache[realPackage];
  var pkg = require(realPackage);

  if (!pkg.engines || (!pkg.engines.atom && !pkg.engines.node)) {
    return false;
  }

  return true;
};

module.exports.settings = function (path) {
  var realPackage = fs.realpathSync(path + '/package.json');
  var pkg = require(realPackage);

  return {
    exec: pkg.engines.node ? 'npm' : 'apm',
    args: [ '--color=always', 'install' ],
    sh: false
  };
};
