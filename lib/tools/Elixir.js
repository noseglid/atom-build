'use strict';

var fs = require('fs');

module.exports.niceName = 'Elixir';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/mix.exs');
};

module.exports.settings = function (path) {
  return {
    exec: 'mix',
    args: [ 'compile' ],
    sh: false
  };
};
