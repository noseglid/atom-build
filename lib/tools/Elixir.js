'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/mix.exs');
};

module.exports.settings = function (path) {
  return {
    exec: 'mix',
    args: [ 'compile' ]
  };
};
