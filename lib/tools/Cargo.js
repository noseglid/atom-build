'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Cargo.toml');
};

module.exports.settings = function (path) {
  return {
    exec: 'cargo',
    args: [ 'build' ]
  };
};
