'use strict';

/**
 * This has to be done in a separate task since gulp depends
 * on stuff that does unsafe evals. We don't want, and are not
 * allowed to do this in the context of the Atom application.
 */

try {
  var gulp = require('gulp');
} catch (e) {}

module.exports = function (path) {
  try {
    if (!gulp) {
      throw new Error('Gulp is not installed.');
    }

    process.chdir(path);

    /* jshint -W020 */
    /* When spawning this, we are not a browser anymore. Disable these */
    navigator = undefined;
    window = undefined;
    /* jshint +W020 */

    require(path + '/gulpfile.js');
    return { tasks: Object.keys(gulp.tasks) };
  } catch (e) {
    return { error: { message: e.message } };
  }
};
