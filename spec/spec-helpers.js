'use strict';

var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

module.exports = {
  setupNodeModules: function (directory) {
    return function () {
      return fs.copyAsync(path.join(__dirname, 'fixture', 'node_modules'), path.join(directory, 'node_modules'));
    };
  },

  setupGrunt: function (directory) {
    var binGrunt = path.join(directory, 'node_modules', '.bin', 'grunt');
    var realGrunt = path.join(directory, 'node_modules', 'grunt-cli', 'bin', 'grunt');
    return function () {
      return Promise.all([
        fs.unlinkAsync(binGrunt),
        fs.chmodAsync(realGrunt, parseInt('0700', 8)),
      ]).then(function () {
        return fs.symlinkAsync(realGrunt, binGrunt);
      });
    };
  },

  setupGulp: function (directory) {
    var binGulp = path.join(directory, 'node_modules', '.bin', 'gulp');
    var realGulp = path.join(directory, 'node_modules', 'gulp', 'bin', 'gulp.js');
    return function () {
      return Promise.all([
        fs.unlinkAsync(binGulp),
        fs.chmodAsync(realGulp, parseInt('0700', 8)),
      ]).then(function () {
        return fs.symlinkAsync(realGulp, binGulp);
      });
    };
  }
};
