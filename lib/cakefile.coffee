{BuildTargets, registry} = require './build-targets-registry'

###
Handles cakefiles

This package assumes cake is in path.

TODO: find cake also in @root/node_modules/.bin

`cake` is called without arguments to get targets listed.  Each line starting
with "cake" like:
```
    cake install      # installs my package
```
is assumed to describe a target.
###

class CakefileTargets extends BuildTargets
  buildTool: "cake"
  buildFiles: "Cakefile"

  getCommands: ->
    @buildFile =>
      @getLines (line) ->
        if /^cake/.test line
          [cmd, desc] = line.replace(/^cake\s+/, '').split(/\s*#\s*/, 1)
          name = cmd.replace(/\W/, '-').replace(/--+/, '-')
          commands[name] = cmd.split /\s+/

# register CakefileTargets as target provider
registry.register CakefileTargets
