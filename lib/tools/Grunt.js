'use strict';

var fs = require('fs');

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Gruntfile.js');
};

module.exports.settings = function (path) {
  return {
    exec: fs.existsSync(path + '/node_modules/.bin/grunt') ? path + '/node_modules/.bin/grunt' : 'grunt'
  };
};
