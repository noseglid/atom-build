'use strict';

var fs = require('fs');
var _ = require('lodash');
var Task = require('atom').Task;
var Promise = require('bluebird');

var originalNodePath = process.env.NODE_PATH;

module.exports.niceName = 'Grunt';

module.exports.isEligable = function (path) {
  return fs.existsSync(path + '/Gruntfile.js');
};

module.exports.createConfig = function(path, args) {
  var exec =  fs.existsSync(path + '/node_modules/.bin/grunt') ? path + '/node_modules/.bin/grunt' : 'grunt';
  return {
    exec: exec,
    sh: false,
    args: args
  };
};

module.exports.settings = function (path) {
  return new Promise(function(resolve, reject) {
    process.env.NODE_PATH = path + '/node_modules:' + originalNodePath;
    Task.once(require.resolve('./grunt-parser-task.js'), path, function (result) {

      var config = this.createConfig(path);
      if (result.tasks) {
        config.targets = _.zipObject(_.map(result.tasks, function(task) {
          return [ 'Grunt: ' + task, this.createConfig(path, [ task ]) ];
        }.bind(this)));
      }

      return resolve(config);
    }.bind(this));
  }.bind(this)).finally(function () {
    process.env.NODE_PATH = originalNodePath;
  });
};
