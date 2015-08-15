'use babel';
'use strict';

var fs = require('fs');

module.exports.niceName = 'Cargo';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Cargo.toml');
};

module.exports.settings = function (path) {
  return [ {
    name: 'Cargo: build',
    exec: 'cargo',
    args: [ 'build' ],
    sh: false,
    errorMatch: '(?<file>.+.rs):(?<line>\\d+):(?<col>\\d+):'
  },
  {
    name: 'Cargo: test',
    exec: 'cargo',
    args: [ 'test' ],
    sh: false,
    errorMatch: '(?<file>.+.rs):(?<line>\\d+):(?<col>\\d+):'
  },
  {
    name: 'Cargo: run',
    exec: 'cargo',
    args: [ 'run' ],
    sh: false,
    errorMatch: '(?<file>.+.rs):(?<line>\\d+):(?<col>\\d+):'
  }];
};
