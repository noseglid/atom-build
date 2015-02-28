/*
Build tools available to atom-build.
These are sorted in order of priority
and divided into groups as seen by comments below
*/
module.exports = [
  /* generic (can be configured to do anything) */
  require('./atom-build'),

  /* semi-generic (may trigger other build scripts) */
  require('./npm_apm'),
  require('./Grunt'),
  require('./gulp'),
  require('./make'),

  /* specific (builds only one thing) */
  require('./Elixir'),
  require('./Cargo')
];
