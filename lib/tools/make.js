'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Makefile');
};

module.exports.settings = function (path) {
  return {
    exec: 'make'
  };
};
