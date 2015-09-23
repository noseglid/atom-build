'use babel';
'use strict';

var fs = require('fs');

module.exports.niceName = 'Elixir';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/mix.exs');
};

module.exports.settings = function (path) {
  if (!atom.config.get('deprecated.tool.elixir')) {
    atom.notifications.addWarning('Bundled `Elixir` build will be removed', {
      dismissable: true,
      detail:
        'You are using a bundled tool for `build` which will have to be installed seperately next version of `build`.\n' +
        'You can install `build-elixir` (apm install build-elixir) at this time and you will be well prepared for the next release!'
    });
    atom.config.set('deprecated.tool.elixir', true);
  }

  return [ {
    name: 'Elixir: default',
    exec: 'mix',
    args: [ 'compile' ],
    sh: false
  } ];
};
