'use babel';
'use strict';

var fs = require('fs');

module.exports.niceName = 'Cargo';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Cargo.toml');
};

module.exports.settings = function (path) {
  if (!atom.config.get('deprecated.tool.cargo')) {
    atom.notifications.addWarning('Bundled `Cargo` build will be removed', {
      dismissable: true,
      detail:
        'You are using a bundled tool for `build` which will have to be installed seperately next version of `build`.\n' +
        'You can install `build-cargo` (apm install build-cargo) at this time and you will be well prepared for the next release!'
    });
    atom.config.set('deprecated.tool.cargo', true);
  }

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
