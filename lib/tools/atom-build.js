'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/.atom-build.json');
};

module.exports.settings = function (path) {
  var realAtomBuild = fs.realpathSync(path + '/.atom-build.json');
  delete require.cache[realAtomBuild];

  var build = require(realAtomBuild);
  return {
    exec: build.cmd,
    env: build.env,
    args: build.args,
    cwd: build.cwd,
    sh: build.sh,
    errorMatch: build.errorMatch
  };
};
