# Build package [![Build Status](https://travis-ci.org/noseglid/atom-build.svg?branch=master)](https://travis-ci.org/noseglid/atom-build)

Automatically build your project inside your new favorite editor, Atom.

  * `alt-cmd-b` builds your project
  * `escape` terminates build

![work work](http://noseglid.github.io/atom-build.gif)

Supported build tools:

  * [NodeJS](http://nodejs.org) (runs `npm install`) - if `package.json` exists where `engines['node']` is set
  * [Atom](http://atom.io) (runs `apm install`) - if `package.json` exists where `engines['atom']` is set
  * [Grunt](http://gruntjs.com/) - if `Gruntfile.js` exists
  * [GNU Make](https://www.gnu.org/software/make/) - if `Makefile` exists

If multiple viable build options are found, `atom-build` will
prioritise according to the list above. For instance, if `package.json` and
`Gruntfile.js` are both available in the root folder, `npm install` will be
executed by `atom-build`.

If you need to run `grunt` to build you project,
utilize the [postinstall-script](https://www.npmjs.org/doc/misc/npm-scripts.html) of
package.json. This will also help you if grunt is run as a node module since it
will be downloaded (via `npm install`) prior.

You can set the target and environment in settings:

  * `arguments` The argument line to the `make`-invocation, just as you write it.
  * `environment` The environment to set for `make`. Use `=`-separated key/values: `MOOD=EXCELLENT INTOXICATION=MEDIUM`

These settings are global for all projects, so currently you have to change them
when you switch project if you require different parameters for different projects.
You could use a package such as [project-switcher](https://atom.io/packages/project-switcher) or
[project-manager](https://atom.io/packages/project-manager) for saving and restoring
project specific settings.
