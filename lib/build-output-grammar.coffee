makeGrammar = require 'atom-syntax-tools'

grammar =
  name: "Build-Output"
  scopeName: "source.build-output"
  patterns: [
    {
      N: "meta.build-container"
      b: /^(\[Started at (.*\)):\s(.*)\])/
      c:
        1: "meta.info.build-output"
        2: "meta.timestamp.build-output"
        3: "meta.command.build-output"
      e: /^(?=\[(Success|Failed) at .*\]$)/
      p: [
        "#pythonTraceback"
        "#genericLocationWithColumn"
        "#genericLocation"
        "#javascriptTracebackLocation"
      ]
    }
    {
      n: "meta.success.build-output"
      m: /^\[Success at.*\]$/
    }
    {
      n: "invalid.illegal.error.build-output"
      m: /^\[Failed at.*\]$/
    }
  ]

  repository:

    genericLocationWithColumn:
      n: "invalid.illegal.result.error.build-output"
      m: /^((.*):(\d+):(\d+))$/
      c:
        1: "meta.location"
        2: "meta.file-name"
        3: "meta.line-no"
        4: "meta.column"

    javascriptTracebackLocation:
      n: "meta.result"
      m: /at \S+ \(((.*):(\d+):(\d+))\)$/
      c:
        1: "meta.location"
        2: "meta.file-name"
        3: "meta.line-no"

    genericLocation:
      n: "invalid.illegal.result.error.build-output"
      m: /^((.*):(\d+))$/
      c:
        1: "meta.location"
        2: "meta.file-name"
        3: "meta.line-no"
        4: "meta.column"

    pythonTraceback:
      n: "invalid.illegal.result.error.build-output"
      b: /^Traceback \(most recent call last\):/
      e: /^((\S[^:]*): (.*))/
      C:
        1: "meta.searchable"
        2: "meta.exception"
        3: "meta.message"
      p: [
        n: "meta.location"
        m: /^\s+File "([^"]+)", line (\d+) in (.*)/
        c:
          1: "meta.file-name"
          2: "meta.line-no"
          3: "meta.function-name"
      ]

module.exports = (buildSystem) ->
  makeGrammar grammar
