{BuildTargets, registry} = require "./build-targets-registry"
fs = require 'fs'

{_} = require 'underscore'

###
Handle defined `npm` targets.

TODO:
- add more NPM targets
- add a publish minor, publish major, etc like APM has

Assumes that npm is in path.
###

class NpmTargets extends BuildTargets

  buildTool: "npm"

  buildTargets: [
    "install"
    "publish"
    "test"
  ]

  buildFiles: "package.json"

  canUpdate: (data) ->
    return true

  getCommands: () ->
    @buildFile (buildfile) =>
      #console.log "buildFile: #{buildfile}"
      data = JSON.parse fs.readFileSync(buildfile, "utf8")

      commands = {}

      buildToolName = @buildTool.replace(/.*\//, '').replace(/\..*$/, '')

      if @canUpdate(data)
        #console.log "can update", @buildTargets

        for target in @buildTargets
          #console.log "target", target
          cmd = target
                .replace(/\s+/, "-")
                .replace(/\W/, "-")
                .replace(/--+/, "-")

          args = target.split(/\s+/)

          #console.log cmd, args

          commands["build:#{buildToolName}-#{cmd}"] = args

      #console.log "commands", commands

      return commands

###
Handle predefined APM targets.

TODO:
- add more targets
###

class ApmTargets extends NpmTargets

  buildTool: atom.packages.getApmPath()

  buildTargets: [
    "install"
    "publish major"
    "publish minor"
    "publish patch"
    "test"
  ]

  canUpdate: (data) ->
    return false if not data
    return false if not data.engines

    return "atom" of data.engines

# register NPM targets and APM targets providers
registry.register NpmTargets
registry.register ApmTargets
