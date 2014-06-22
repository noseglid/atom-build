fs = require 'fs'

module.exports = (builder) ->
  {BuildSystemProvider} = builder

  class Make extends BuildSystemProvider
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
