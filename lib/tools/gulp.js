'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/gulpfile.js');
};

module.exports.settings = function (path) {
  return {
    exec: fs.existsSync(path + '/node_modules/.bin/gulp') ? path + '/node_modules/.bin/gulp' : 'gulp',
    sh: false
  };
};
