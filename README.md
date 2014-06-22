Build System
============

This package enables you to call cake, make, apm, npm commands from command
palette.  

If you have a Cakefile with targets "foo" and "bar", you will find
"Build: Cake Foo" and "Build: Cake Bar" commands.  Commands are changed
dynamically, if you add a task to that file, it will be added to command palette.

After a build has finished, you can cycle through build results using `F4` for
next result and `shift-f4` for previous result.  Hit ENTER to open file and jump
to specified location.

**This is under development**

Extending
---------

Build-Systems searches all packages folders for a subfolder `build-systems/`.
If it exists, files from there are read and interpreted as build systems, if
suitable.  For now only "*.coffee" is fully supported.  "*.cson" and "*.json"
and "*.sublime-build" are planned.

Here `build-systems/cake.coffee` as an example:

```coffee
module.exports = (builder) ->
  {BuildSystemProvider} = builder

  class Cake extends BuildSystemProvider
    buildTool: "cake"
    buildFiles: "Cakefile"

    getCommands: ->
      @buildFile =>
        @getLines (line) ->
          if /^cake/.test line
            [cmd, desc] = line.replace(/^cake\s+/, '').split(/\s*#\s*/, 1)
            name = cmd.replace(/\W/, '-').replace(/--+/, '-')
            commands[name] = cmd.split /\s+/
```


History
-------

This package is forked from https://github.com/noseglid/atom-build.  In the
first place I wanted to contribute, but then I realized, that I rewrote almost
everything and there was only little left from original package, so I decided
to create an own package.

TODO
----

- review specs to get them work
- add more specs
- connect to travis CI
- Implement full Sublime-Like Build System
  - file_regex
  - line_regex
  - syntax
  - variants
  - name the selector-specific build system "Build: Run" and make it default
    build system, if hitting ctrl+alt+b
- add more build systems
- support more npm and apm commands
- add keyboard shortcut to stop build (ESC, if in Build Output, else via
  command palette)
