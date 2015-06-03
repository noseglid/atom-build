'use strict';

/**
 * This has to be done in a separate task since Grunt depends
 * on stuff that does unsafe evals. We don't want, and are not
 * allowed to do this in the context of the Atom application.
 */

try {
  var grunt = require('grunt');
} catch (e) {}

module.exports = function (path) {
  try {
    if (!grunt) {
      throw new Error('Grunt is not installed.');
    }

    process.chdir(path);

    /* jshint -W020 */
    /* When spawning this, we are not a browser anymore. Disable these */
    navigator = undefined;
    window = undefined;
    /* jshint +W020 */

    require(path + '/Gruntfile.js')(grunt);
    return { tasks: Object.keys(grunt.task._tasks) };
  } catch (e) {
    return { error: { message: e.message } };
  }
};
