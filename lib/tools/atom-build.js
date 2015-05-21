'use strict';

var fs = require('fs');
var _ = require('lodash');

module.exports.niceName = 'Custom file (.atom-build.json)';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/.atom-build.json');
};

module.exports.settings = function (path) {
  var realAtomBuild = fs.realpathSync(path + '/.atom-build.json');
  delete require.cache[realAtomBuild];

  var createBuildConfig = function(build, name) {
    return {
      name: 'Custom: ' + name,
      exec: build.cmd,
      env: build.env,
      args: build.args,
      cwd: build.cwd,
      sh: build.sh,
      errorMatch: build.errorMatch
    };
  };

  var build = require(realAtomBuild);
  var config = [];

  config.push(createBuildConfig(build, build.name || 'default'));
  _.forEach(build.targets || [], function (target, name) {
    config.push(createBuildConfig(target, name));
  });

  return config;
};
