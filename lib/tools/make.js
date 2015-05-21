'use strict';

var fs = require('fs');

module.exports.niceName = 'GNU Make';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Makefile');
};

module.exports.settings = function (path) {
  return [ {
    name: 'GNU Make: default',
    exec: 'make',
    sh: false
  } ];
};
