# Build package [![Build Status](https://travis-ci.org/noseglid/atom-build.svg?branch=master)](https://travis-ci.org/noseglid/atom-build)

Automatically build your project inside your new favorite editor, Atom.

  * `alt-cmd-b` builds your project
  * `escape` terminates build

![work work](http://noseglid.github.io/atom-build.gif)

Supported build tools:

  1. Custom by [specifying your own build command](#custom-build-command)
  1. [NodeJS](http://nodejs.org) (runs `npm install`) - if `package.json` exists where `engines['node']` is set
  1. [Atom](http://atom.io) (runs `apm install`) - if `package.json` exists where `engines['atom']` is set
  1. [Grunt](http://gruntjs.com/) - if `Gruntfile.js` exists
  1. [GNU Make](https://www.gnu.org/software/make/) - if `Makefile` exists

If multiple viable build options are found, `atom-build` will
prioritise according to the list above. For instance, if `package.json` and
`Gruntfile.js` are both available in the root folder, `npm install` will be
executed by `atom-build`.

If you need to run `grunt` to build you project,
utilize the [postinstall-script](https://www.npmjs.org/doc/misc/npm-scripts.html) of
package.json. This will also help you if grunt is run as a node module since it
will be downloaded (via `npm install`) prior.

You can set the arguments and environment in settings:

  * `arguments` The argument line to the build tool invocation. These will simply be appended.
  * `environment` The environment to set for the build tool. Use `=`-separated key/values: `MOOD=EXCELLENT INTOXICATION=MEDIUM`

These settings are global for all projects, so currently you have to change them
when you switch project if you require different parameters for different projects.

<a name="custom-build-command"></a>
## Specifying your own build command

If the built-in defaults are not enough to suit your needs, you can specify
exactly what to execute. Create a file named `.atom-build.json` in your project root:

    {
      "cmd": "<command to execute>",
      "args": [ "<argument1>", "<argument2>", ... ],
      "env" {
        "VARIABLE1": "VALUE1",
        "VARIABLE2": "VALUE2",
        ...
        ...
        ...
      }
    }

Note that `cmd` must only be the executable - no arguments here. If the
executable is not in your path, either fully qualify it or specify the path
in you environment (e.g. by setting the `PATH` var appropriately on UNIX-like
systems).
