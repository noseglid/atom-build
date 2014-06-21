{makeGrammar} = require 'atom-sytnax-tools'

grammar =
  name: "Build-Output"
  scopeName: "source.build-output"
  patterns:
    N: "meta.build-container"
    b: /^(\[build started at (.*\)):\s(.*)\])/
    c:
      1: "meta.info.build-output"
      2: "meta.timestamp.build-output"
      3: "meta.command.build-output"
    e: /^(\[build ended at (.*\)):.*\])/
    p: [
      "#pythonTraceback"
    ]
  ]
  repository:
    pythonTraceback:
      n: "meta.result"
      b: /^Traceback (most recent call last):/
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

makeGrammar grammar, "CSON"
