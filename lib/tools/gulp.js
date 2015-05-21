'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('lodash');
var Task = require('atom').Task;
var Promise = require('bluebird');

var originalNodePath = process.env.NODE_PATH;

module.exports.niceName = 'gulp';

module.exports.isEligable = function (cwd) {
  return fs.existsSync(cwd + '/gulpfile.js');
};

module.exports.createConfig = function (cwd, args) {
  var exec = fs.existsSync(cwd + '/node_modules/.bin/gulp') ? cwd + '/node_modules/.bin/gulp' : 'gulp';
  return {
    exec: exec,
    sh: false,
    args: args
  };
};

module.exports.settings = function (cwd) {
  return new Promise(function(resolve, reject) {
    /* This is set so that the spawned Task gets its own instance of gulp */
    process.env.NODE_PATH = util.format('%s%snode_modules%s%s', cwd, path.sep, path.delimiter, originalNodePath);

    Task.once(require.resolve('./gulp-parser-task.js'), cwd, function (result) {

      var config = this.createConfig(cwd);
      if (result.tasks) {
        config.targets = _.zipObject(_.map(result.tasks, function(task) {
          return [ 'Gulp: ' + task, this.createConfig(cwd, [ task ]) ];
        }.bind(this)));
      }

      return resolve(config);
    }.bind(this));
  }.bind(this)).finally(function () {
    process.env.NODE_PATH = originalNodePath;
  });
};
