# Atom Build package
[![Build Travis](https://travis-ci.org/noseglid/atom-build.svg?branch=master)](https://travis-ci.org/noseglid/atom-build)
[![Gitter chat](https://badges.gitter.im/noseglid/atom-build.svg)](https://gitter.im/noseglid/atom-build)

Automatically build your project inside your new favorite editor, Atom.

  * `cmd-alt-b` / `ctrl-alt-b` builds your project.
  * `cmd-alt-g` / `ctrl-alt-g` cycles through causes of build error. See [Error Matching](#error-match).
  * `cmd-alt-h` / `ctrl-alt-h` goes to the first build error. See [Error Matching](#error-match).
  * `cmd-alt-v` / `ctrl-alt-v` Toggles the build panel.
  * `cmd-alt-t` / `ctrl-alt-t` Displays the available build targets.
  * `escape` terminates build / closes the build window.

![work work](https://noseglid.github.io/atom-build.gif)

Supported build tools:

  1. Custom by [specifying your own build command](#custom-build-command)
    * Supports multiple targets.
    * Supports error matching.
  1. [NodeJS](http://nodejs.org) (runs `npm install`) - if `package.json` exists where `engines['node']` is set
  1. [Atom](http://atom.io) (runs `apm install`) - if `package.json` exists where `engines['atom']` is set
  1. [Grunt](http://gruntjs.com/) - if `Gruntfile.js` exists
    * Supports multiple targets.
  1. [Gulp](http://gulpjs.com/) - if `gulpfile.js` exists
    * Supports multiple targets.
  1. [GNU Make](https://www.gnu.org/software/make/) - if `Makefile` exists
  1. [Elixir](http://elixir-lang.org/) - if `mix.exs` exists
  1. [Cargo](http://doc.crates.io) - if `Cargo.toml` exists
    * Supports error matching.

If multiple viable build options are found, `atom-build` will
prioritise according to the list above. For instance, if `package.json` and
`Gruntfile.js` are both available in the root folder, `npm install` will be
executed by `atom-build`.

If you need to run `grunt`, `gulp` or other tool to build your project, then you can utilize the [postinstall-script](https://www.npmjs.org/doc/misc/npm-scripts.html) of package.json. This will also help you if grunt is run as a node module since it
will be downloaded (via `npm install`) prior.

<a name="custom-build-command"></a>
## Specifying a custom build command

If the built-in defaults are not enough to suit your needs, you can specify
exactly what to execute. Create a file named `.atom-build.json` in your project root:

    {
      "cmd": "<command to execute>",
      "name": "<name of target>",
      "args": [ "<argument1>", "<argument2>", ... ],
      "sh": true,
      "cwd": "<current working directory for `cmd`>",
      "env": {
        "VARIABLE1": "VALUE1",
        "VARIABLE2": "VALUE2",
        ...
      },
      "errorMatch": [
        "^regexp1$",
        "^regexp2$"
        ]
      "keymap": "<keymap string>",
      "targets": {
        "<name of target>": {
          "cmd": "<command to execute>",
          ... (all previous options are viable here except `targets`)
        }
      }
    }

Note that if `sh` is false `cmd` must only be the executable - no arguments here. If the
executable is not in your path, either fully qualify it or specify the path
in you environment (e.g. by setting the `PATH` var appropriately on UNIX-like
systems).

<a name="custom-build-config"></a>
### Configuration options

Option       | Required       | Description
-------------|----------------|-----------------------
`cmd`        | **[required]** | The executable command
`name`       | *[optional]*   | The name of the targets. Viewed in the targets list (toggled by `build:select-active-target`).
`args`       | *[optional]*   | An array of arguments for the command
`sh`         | *[optional]*   | If `true`, the combined command and arguments will be passed to `/bin/sh`. Default `true`.
`cwd`        | *[optional]*   | The working directory for the command. E.g. what `.` resolves to.
`env`        | *[optional]*   | An object of environment variables and their values to set
`errorMatch` | *[optional]*   | A (list of) regular expressions to match output to a file, row and col. See [Error matching](#error-match) for details.
`keymap`     | *[optional]*   | A keymap string as defined by [`Atom`](https://atom.io/docs/latest/behind-atom-keymaps-in-depth). Pressing this key combination will trigger the target. Examples: `ctrl-alt-k` or `cmd-U`.
`targets`    | *[optional]*   | Additional targets which can be used to build variations of your project.

### Replacements

The following parameters will be replaced in `cmd`, any entry in `args`, `cwd` and
values of `env`. They should all be enclosed in curly brackets `{}`

  * `{FILE_ACTIVE}` - Full path to the currently active file in Atom. E.g. `/home/noseglid/github/atom-build/lib/build.js`
  * `{FILE_ACTIVE_PATH}` - Full path to the folder where the currently active file is. E.g. `/home/noseglid/github/atom-build/lib`
  * `{FILE_ACTIVE_NAME}` - Full name and extension of active file. E.g., `build.js`
  * `{FILE_ACTIVE_NAME_BASE}` - Name of active file WITHOUT extension. E.g., `build`
  * `{PROJECT_PATH}` - Full path to the root of the project. This is normally the path Atom has as root. E.g `/home/noseglid/github/atom-build`
  * `{REPO_BRANCH_SHORT}` - Short name of the current active branch (if project is backed by git). E.g `master` or `v0.9.1`.

<a name="error-match"></a>
## Error matching

Error matching let's you specify a single regular expression or a list of
regular expressions, which capture the output of your build command and open the
correct file, row and column of the error. For instance:

```bash
../foo/bar/a.c:4:26: error: expected ';' after expression
  printf("hello world\n")
                         ^
                         ;
1 error generated.
```

Would be matched with the regular expression: `\n(?<file>[\\/0-9a-zA-Z\\._]+):(?<line>\\d+):(?<col>\\d+)`.
After the build has failed, pressing `cmd-alt-g` (OS X) or `ctrl-alt-g` (Linux/Windows), `a.c` would be
opened and the cursor would be placed at row 4, column 26.

Note the syntax for match groups. This is from the [XRegExp](http://xregexp.com/) package
and has the syntax for named groups: `(?<name> RE )` where `name` would be the name of the group
matched by the regular expression `RE`.

The following named groups can be matched from the output:
  * `file` - **[required]** the file to open. May be relative `cwd` or absolute. `(?<file> RE)`.
  * `line` - *[optional]* the line the error resides on. `(?<line> RE)`.
  * `col` - *[optional]* the column the error resides on. `(?<col> RE)`.

Since the regular expressions are written in a JSON file, backslashes must be escaped.

The `file` should be relative the `cwd` specified. If no `cwd` has been specified, then
the `file` should be relative the project root (e.g. the top most directory shown in the
Atom Editor).

If your build outputs multiple errors, all will be matched. Press `cmd-alt-g` (OS X) or `ctrl-alt-g` (Linux/Windows)
to cycle through the errors (in the order they appear, first on stderr then on stdout).

Often, the first error is the most interesting since other errors tend to be secondary faults caused by that first one.
To jump to the first error you can use `cmd-alt-h` (OS X) or `ctrl-alt-h` (Linux/Windows) at any point to go to the first error.

## Service API (for package developers)

Another package may provide build information to the `build`-package by implementing its service API.
The package should integrate via the service API. This is typically done in `package.json`:

```json
{
  <other stuff>
  "providedServices": {
    "builder": {
      "description": "Description of the build configurations this package gives",
      "versions": {
        "1.0.0": "providingFunction"
      }
    }
  }
},
```

The `build`-package will then call `providingFunction` when activated and expects an
object in return:
```javascript
{
  niceName: 'string',
  isEligable: function (path) {},
  settings: function (path) {}
}
```

The `niceName` is esthetic only and should be a `string` which is a human readable
description of the build configuration is provided.

`isEligable` should be a function which must return synchronously. It will get one
argument, `path`, which is the root folder of the currently active project in Atom.
It should return `true` or `false` indicating if it can build that folder into something
sensible. Typically look for the existence of a build file such as `gulpfile.js` or `Makefile`.

`settings` must return a promise. It is called when it is time to build the project.
It can provide anything which is allowed by the [custom build configuration](#custom-build-config).
This includes the command, `cmd`, to execute, any arguments, `args`, and so on.

## Analytics

The `atom-build` package uses google analytics to keep track of which features are in use
and at what frequency. This gives the maintainers a sense of what parts of the
package is most important and what parts can be removed.

The data is fully anonymous and can not be tracked back to you in any way.
This is what is collected

  * Version of package used.
  * Build triggered, succeeded or failed.
  * Which build tool was used.
  * Visibility of UI components.

If you really do not want to share this information, you can opt out by disabling
the [metrics package](https://atom.io/packages/metrics). This will disable all analytics
collection, including the one from `atom-build`.
