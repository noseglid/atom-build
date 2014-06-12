# Build package [![Build Status](https://travis-ci.org/noseglid/atom-build.svg?branch=master)](https://travis-ci.org/noseglid/atom-build)

Automatically build your project inside your new favorite editor, Atom.

  * `alt-cmd-b` builds your project
  * `escape` terminates build

![work work](http://noseglid.github.io/atom-build.gif)

For this only [GNU Make](https://www.gnu.org/software/make/) is supported at the moment.
You can set the target and environment in settings:

  * `arguments` The argument line to the `make`-invocation, just as you write it.
  * `environment` The environment to set for `make`. Use `=`-separated key/values: `MOOD=EXCELLENT INTOXICATION=MEDIUM`

Additionally there are added known targets for following build tools:

- *apm* if `packages.json` present in project root and contains "atom" in engines
- *npm* if `packages.json` present
- *cake* if `Cakefile` present.  There are available all targets, 
  which are listed on a cake run without arguments.
