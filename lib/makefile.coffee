{BuildTargets, registry} = require './build-targets-registry'
fs = require 'fs'

class MakefileTargets extends BuildTargets
  buildFiles: "Makefile"
  buildTool: "make"

  getCommands: ->
    @buildFile (buildfile) =>
      commands = {}
      console.log(buildfile)
      data = fs.readFileSync buildfile, "utf8"

      lines = data.split /\n/
      for line in lines
        console.log("line", line)
        if m = /^([\w\-]+):/.exec(line)
          console.log(m)
          commands["build:make-#{m[1]}"] = [ m[1] ]

      console.log("commands", commands)
      return commands

registry.register MakefileTargets
