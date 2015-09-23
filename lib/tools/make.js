'use babel';
'use strict';

var path = require('path');
var fs = require('fs');

module.exports.niceName = 'GNU Make';

module.exports.isEligable = function (cwd) {
  return fs.existsSync(path.join(cwd, 'Makefile'));
};

module.exports.settings = function (cwd) {
  if (!atom.config.get('deprecated.tool.make')) {
    atom.notifications.addWarning('Bundled `make` build will be removed', {
      dismissable: true,
      detail:
      'You are using a bundled tool for `build` which will have to be installed seperately next version of `build`.\n' +
      'You can install `build-make` (apm install build-make) at this time and you will be well prepared for the next release!'
    });
    atom.config.set('deprecated.tool.make', true);
  }

  return [ {
    name: 'GNU Make: default',
    exec: 'make',
    sh: false
  } ];
};
