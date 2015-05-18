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

  var createBuildConfig = function(build) {
    return {
      exec: build.cmd,
      env: build.env,
      args: build.args,
      cwd: build.cwd,
      sh: build.sh,
      errorMatch: build.errorMatch
    };
  };

  var build = require(realAtomBuild);
  var config = createBuildConfig(build);

  if (build.targets) {
    config.targets = _.object(_.map(build.targets, function(target, name) {
      return [ 'Custom: ' + name, createBuildConfig(target) ];
    }));
  }

  return config;
};
