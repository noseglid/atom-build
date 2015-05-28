'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('lodash');
var Task = require('atom').Task;
var Promise = require('bluebird');

var originalNodePath = process.env.NODE_PATH;

module.exports.niceName = 'Grunt';

module.exports.isEligable = function (cwd) {
  return fs.existsSync(cwd + '/Gruntfile.js');
};

module.exports.settings = function (cwd) {
  var createConfig = function (name, args) {
    var exec = fs.existsSync(cwd + '/node_modules/.bin/grunt') ? cwd + '/node_modules/.bin/grunt' : 'grunt';
    return {
      name: name,
      exec: exec,
      sh: false,
      args: args
    };
  };

  return new Promise(function(resolve, reject) {
    /* This is set so that the spawned Task gets its own instance of grunt */
    process.env.NODE_PATH = util.format('%s%snode_modules%s%s', cwd, path.sep, path.delimiter, originalNodePath);

    Task.once(require.resolve('./grunt-parser-task.js'), cwd, function (result) {
      var config = [];
      /* Make sure 'default' is the first as this will be the prioritized target */
      result.tasks.sort(function (t1, t2) {
        return ('default' === t1) ? -1 : t1.localeCompare(t2);
      });
      _.forEach(result.tasks || [], function (task) {
        config.push(createConfig('Grunt: ' + task, [ task ]));
      });

      return resolve(config);
    });
  }).finally(function () {
    process.env.NODE_PATH = originalNodePath;
  });
};
