'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/SConstruct');
};

module.exports.settings = function (path) {
  return {
    exec: 'scons',
    sh: false
  };
};
