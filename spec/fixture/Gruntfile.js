module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({});
  grunt.registerTask('other task', function () {
    console.log('doing heavy machinery stuff');
  });

  grunt.registerTask('default', function() {
    console.log('Surprising is the passing of time. But not so, as the time of passing');
  });

  grunt.registerTask('dev task', function () {
    console.log('doing dev build');
  });
};
