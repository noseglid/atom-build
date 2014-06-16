{BuildCommandProvider} = require "atom-build-system"
fs = require 'fs'

module.exports =
class Make extends BuildCommandProvider
  buildFiles: "Makefile"
  buildTool: "make"

  getCommands: ->
    @buildFile (buildfile) =>
      commands = {}
      data = fs.readFileSync buildfile, "utf8"

      lines = data.split /\n/
      for line in lines
        if m = /^([\w\-]+):/.exec(line)
          commands["build:make-#{m[1]}"] = [ m[1] ]

      return commands
