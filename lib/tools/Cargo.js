'use strict';

var fs = require('fs');

module.exports.niceName = 'Cargo';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Cargo.toml');
};

module.exports.settings = function (path) {
  return [ {
    name: 'Cargo: default',
    exec: 'cargo',
    args: [ 'build' ],
    sh: false,
    errorMatch: '^(?<file>[^\\.]+.rs):(?<line>\\d+):(?<col>\\d+):'
  } ];
};
