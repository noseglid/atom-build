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

module.exports.settings = function (cwd) {
  var createConfig = function (name, args) {
    var exec = fs.existsSync(cwd + '/node_modules/.bin/gulp') ? cwd + '/node_modules/.bin/gulp' : 'gulp';
    return {
      name: name,
      exec: exec,
      sh: false,
      args: args
    };
  };

  return new Promise(function(resolve, reject) {
    /* This is set so that the spawned Task gets its own instance of gulp */
    process.env.NODE_PATH = util.format('%s%snode_modules%s%s', cwd, path.sep, path.delimiter, originalNodePath);

    Task.once(require.resolve('./gulp-parser-task.js'), cwd, function (result) {
      if (result.error) {
        return resolve([ createConfig('Gulp: default', [ 'default' ]) ]);
      }

      var config = [];
      /* Make sure 'default' is the first as this will be the prioritized target */
      result.tasks.sort(function (t1, t2) {
        return ('default' === t1) ? -1 : t1.localeCompare(t2);
      });
      _.forEach(result.tasks || [], function (task) {
        config.push(createConfig('Gulp: ' + task, [ task ]));
      });

      return resolve(config);
    });
  }).finally(function () {
    process.env.NODE_PATH = originalNodePath;
  });
};
