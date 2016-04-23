# Atom Build package

[Release notes](https://github.com/noseglid/atom-build/releases)

[![Plugin installs](https://img.shields.io/apm/dm/build.svg?style=flat-square)](https://atom.io/packages/build)
[![Package version](https://img.shields.io/apm/v/build.svg?style=flat-square)](https://atom.io/packages/build)

[![Travis.ci Shield](https://img.shields.io/travis/noseglid/atom-build/master.svg?style=flat-square&label=travis%20ci)](https://travis-ci.org/noseglid/atom-build)
[![AppVeyor Shield](https://img.shields.io/appveyor/ci/noseglid/atom-build/master.svg?style=flat-square&label=appveyor )](https://ci.appveyor.com/project/noseglid/atom-build)

[![Gitter chat](https://img.shields.io/badge/gitter-noseglid%2Fatom--build-24CE66.svg?style=flat-square)](https://gitter.im/noseglid/atom-build)
[![Slack Badge](https://img.shields.io/badge/chat-atom.io%20slack-ff69b4.svg?style=flat-square)](http://atom-slack.herokuapp.com/)


Automatically build your project inside your new favorite editor, Atom.

  * <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>B</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>B</kbd> / <kbd>F9</kbd> builds your project.
  * <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>G</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>G</kbd> / <kbd>F4</kbd> cycles through causes of build error. See [Error Matching](#error-match).
  * <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>G</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>H</kbd> / <kbd>Shift</kbd> <kbd>F4</kbd> goes to the first build error. See [Error Matching](#error-match).
  * <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>V</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>V</kbd> / <kbd>F8</kbd> Toggles the build panel.
  * <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>T</kbd> / <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>T</kbd> / <kbd>F7</kbd> Displays the available build targets.
  * <kbd>Esc</kbd> terminates build / closes the build window.

#### Builds your project - configure it your way
![work work](https://noseglid.github.io/build.gif)

#### Automatically extract targets - here with [build-make](https://github.com/AtomBuild/atom-build-make).
![targets](https://noseglid.github.io/targets-make.gif)

#### Match errors and go directly to offending code - with [Atom Linter](https://atom.io/packages/linter).
![error matching](https://noseglid.github.io/error-match.gif)

(You can also use keyboard shortcuts to go to errors if you don't like Atom Linter, or want to keep package dependencies to a minimum).

## Build providers
**[Full list of build providers](https://atombuild.github.io)**

<a name="build-command"></a>
### Specify a custom build command

If no build tool is enough to suit your needs, you can create a custom build command.
Supported formats and the name of the configuration file is

  * JSON: `.atom-build.json`
  * CSON: `.atom-build.cson`
  * YAML: `.atom-build.yml`
  * JS: `.atom-build.js`

Pick your favorite format, save that file in your project root, and specify exactly
how your project is built (example in `json`)

```json
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
  ],
  "keymap": "<keymap string>",
  "atomCommandName": "namespace:command",
  "targets": {
    "<name of target>": {
      "cmd": "<command to execute>",
      ... (all previous options are viable here except `targets`)
    }
  }
}
```

Note that if `sh` is false `cmd` must only be the executable - no arguments here.  If the
executable is not in your path, either fully qualify it or specify the path
in you environment (e.g. by setting the `PATH` var appropriately on UNIX-like
systems).

If `sh` is true, it will use a shell (e.g. `/bin/sh -c`) on unix/linux, and command (`cmd /S /C`)
on windows.

Using a JavaScript (JS) file gives you the additional benefit of being able to specify `preBuild` and `postBuild` and being able to run arbitrary match functions instead of regex-matching. The
javascript function needs to return an array of matches. The fields of the matches must be the same
as those that the regex can set.

Keep in mind that the JavaScript file must `export` the configuration

```javascript
module.exports = {
  cmd: "myCommand",
  preBuild: function () {
    console.log('This is run **before** the build command');
  },
  postBuild: function () {
    console.log('This is run **after** the build command');
  },
  errorMatch: [
    // normal regexes and functions may be mixed in this array
    'this is a regex',
    function (terminal_output) {
      // this is the array of matches that we create
      var matches = [];
      terminal_output.split(/\n/).forEach(function (line, line_number, terminal_output) {
        // all lines starting with a slash
        if line[0] == '/' {
          this.push({
            file: 'x.txt',
            line: line_number.toString(),
            message: line
          });
        }
      }.bind(matches));
      return matches;
    }
  ]
};
```

<a name="custom-build-config"></a>
#### Configuration options

Option            | Required       | Description
------------------|----------------|-----------------------
`cmd`             | **[required]** | The executable command
`name`            | *[optional]*   | The name of the target. Viewed in the targets list (toggled by `build:select-active-target`).
`args`            | *[optional]*   | An array of arguments for the command
`sh`              | *[optional]*   | If `true`, the combined command and arguments will be passed to `/bin/sh`. Default `true`.
`cwd`             | *[optional]*   | The working directory for the command. E.g. what `.` resolves to.
`env`             | *[optional]*   | An object of environment variables and their values to set
`errorMatch`      | *[optional]*   | A (list of) regular expressions to match output to a file, row and col. See [Error matching](#error-match) for details. (**JS only**: pass a function instead of regex to execute your own matching code)
`keymap`          | *[optional]*   | A keymap string as defined by [`Atom`](https://atom.io/docs/latest/behind-atom-keymaps-in-depth). Pressing this key combination will trigger the target. Examples: `ctrl-alt-k` or `cmd-U`.
`atomCommandName` | *[optional]*   | Command name to register which should be on the form of `namespace:command`. Read more about [Atom CommandRegistry](https://atom.io/docs/api/v1.4.1/CommandRegistry). The command will be available in the command palette and can be trigger from there. If this is returned by a build provider, the command can programatically be triggered by [dispatching](https://atom.io/docs/api/v1.4.1/CommandRegistry#instance-dispatch).
`targets`         | *[optional]*   | Additional targets which can be used to build variations of your project.
`preBuild`        | *[optional]*   | **JS only**. A function which will be called *before* executing `cmd`. No arguments. `this` will be the build configuration.
`postBuild`       | *[optional]*   | **JS only**. A function which will be called *after* executing `cmd`. A single argument `bool buildOutcome` indicating outcome of the running `cmd`. `this` will be the build configuration.

#### Replacements

The following parameters will be replaced in `cmd`, any entry in `args`, `cwd` and
values of `env`. They should all be enclosed in curly brackets `{}`

  * `{FILE_ACTIVE}` - Full path to the currently active file in Atom. E.g. `/home/noseglid/github/atom-build/lib/build.js`
  * `{FILE_ACTIVE_PATH}` - Full path to the folder where the currently active file is. E.g. `/home/noseglid/github/atom-build/lib`
  * `{FILE_ACTIVE_NAME}` - Full name and extension of active file. E.g., `build.js`
  * `{FILE_ACTIVE_NAME_BASE}` - Name of active file WITHOUT extension. E.g., `build`
  * `{PROJECT_PATH}` - Full path to the root of the project. This is normally the path Atom has as root. E.g `/home/noseglid/github/atom-build`
  * `{REPO_BRANCH_SHORT}` - Short name of the current active branch (if project is backed by git). E.g `master` or `v0.9.1`
  * `{SELECTION}` - Selected text.

### Creating a build provider
Creating a build provider require very little code in the easiest case, and can
be as complicated as necessary to achieve the correct functionality.
Read more about building your own provider in [the create provider documentation](create-provider.md).

<a name="error-match"></a>
## Error matching

Error matching lets you specify a single regular expression or a list of
regular expressions, which capture the output of your build command and open the
correct file, row and column of the error. For instance:

```bash
../foo/bar/a.c:4:26: error: expected ';' after expression
  printf("hello world\n")
                         ^
                         ;
1 error generated.
```

Would be matched with the regular expression: `(?<file>[\\/0-9a-zA-Z\\._]+):(?<line>\\d+):(?<col>\\d+):\\s+(?<message>.+)`.
After the build has failed, pressing <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>G</kbd> (OS X) or <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>G</kbd> (Linux/Windows)
(or <kbd>F4</kbd> on either platform), `a.c` would be opened and the cursor would be placed at row 4, column 26.

Note the syntax for match groups. This is from the [XRegExp](http://xregexp.com/) package
and has the syntax for named groups: `(?<name> RE )` where `name` would be the name of the group
matched by the regular expression `RE`.

The following named groups can be matched from the output:
  * `file` - **[required]** the file to open. May be relative `cwd` or absolute. `(?<file> RE)`.
  * `line` - *[optional]* the line the error starts on. `(?<line> RE)`.
  * `col` - *[optional]* the column the error starts on. `(?<col> RE)`.
  * `line_end` - *[optional]* the line the error ends on. `(?<line_end> RE)`.
  * `col_end` - *[optional]* the column the error ends on. `(?<col_end> RE)`.
  * `message` - *[optional]* Catch the humanized error message. `(?<message> RE)`.

Backslashes must be escaped, thus the double `\\` everywhere.

The `file` should be relative the `cwd` specified. If no `cwd` has been specified, then
the `file` should be relative the project root (e.g. the top most directory shown in the
Atom Editor).

If your build outputs multiple errors, all will be matched. Press <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>G</kbd> (OS X) or <kbd>Ctrl</kbd> <kbd>Alt</kbd> <kbd>G</kbd> (Linux/Windows)
to cycle through the errors (in the order they appear, first on stderr then on stdout), or you can use the
Atom Linter integration discussed in the next section.

Often, the first error is the most interesting since other errors tend to be secondary faults caused by that first one.
To jump to the first error you can use <kbd>Cmd</kbd> <kbd>Alt</kbd> <kbd>H</kbd> (OS X) or <kbd>Shift</kbd> <kbd>F4</kbd> (Linux/Windows) at any point to go to the first error.

### Error matching and Atom Linter

Install [Atom Linter](https://atom.io/packages/linter) and all your matched errors will listed in a neat panel.

![Linter integration](https://noseglid.github.io/build-linter.png)

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
