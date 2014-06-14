# Build package [![Build Status](https://travis-ci.org/noseglid/atom-build.svg?branch=master)](https://travis-ci.org/noseglid/atom-build)

Automatically build your project inside your new favorite editor, Atom.

  * `alt-cmd-b` builds your project
  * `escape` terminates build

![work work](http://noseglid.github.io/atom-build.gif)

Only [GNU Make](https://www.gnu.org/software/make/) is supported at the moment.
You can set the target and environment in settings:

  * `arguments` The argument line to the `make`-invocation, just as you write it.
  * `environment` The environment to set for `make`. Use `=`-separated key/values: `MOOD=EXCELLENT INTOXICATION=MEDIUM`
