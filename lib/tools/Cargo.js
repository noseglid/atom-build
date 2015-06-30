'use strict';

var fs = require('fs');
var LintHelper = require('./linthelper');

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
    errorMatch: '(?<file>.+):(?<line>\\d+):(?<col>\\d+):\\s*(?<endline>\\d+):(?<endcol>\\d+)\\s+((?<error>error|fatal error)|(?<warning>warning)|(?<info>note)):\\s+(?<message>.+)\n',
    linter: new LintHelper()
  },
  {
    name: 'Cargo: test',
    exec: 'cargo',
    args: [ 'test' ],
    sh: false,
    errorMatch: '(?<file>.+):(?<line>\\d+):(?<col>\\d+):\\s*(?<endline>\\d+):(?<endcol>\\d+)\\s+((?<error>error|fatal error)|(?<warning>warning)|(?<info>note)):\\s+(?<message>.+)\n',
    linter: new LintHelper()
  },
  {
    name: 'Cargo: run',
    exec: 'cargo',
    args: [ 'run' ],
    sh: false,
    errorMatch: '(?<file>.+):(?<line>\\d+):(?<col>\\d+):\\s*(?<endline>\\d+):(?<endcol>\\d+)\\s+((?<error>error|fatal error)|(?<warning>warning)|(?<info>note)):\\s+(?<message>.+)\n',
    linter: new LintHelper()
  }];
};
