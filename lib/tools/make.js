'use babel';
'use strict';

var path = require('path');
var fs = require('fs');

module.exports.niceName = 'GNU Make';

module.exports.isEligable = function (cwd) {
  return fs.existsSync(path.join(cwd, 'Makefile'));
};

module.exports.settings = function (cwd) {
  return [ {
    name: 'GNU Make: default',
    exec: 'make',
    sh: false
  } ];
};
