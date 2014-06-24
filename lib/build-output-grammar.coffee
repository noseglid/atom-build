makeGrammar = require 'atom-syntax-tools'

stopColors =

ansiColor = (num, extra) ->
    if num >= 40
      stop =  [ 0, 41, 42, 43, 44, 45, 46, 47, 48, 49 ]
    else
      stop =  [ 0, 31, 32, 33, 34, 35, 36, 37, 38, 39 ]

    {
      start: num
      startSuffix: "m"
      end: stop
      stopSuffix: "m"
    }

# see http://en.wikipedia.org/wiki/ANSI_escape_code
# http://www.hamiltonlabs.com/userguide/30-AnsiEscapeSequences.htm

# http://graphcomp.com/info/specs/ansi_col.html

# Sets multiple display attribute settings. The following lists standard attributes:
#
# 0	Reset all attributes
# 1	Bright
# 2	Dim
# 4	Underscore
# 5	Blink
# 7	Reverse
# 8	Hidden
#
# 	Foreground Colors
# 30	Black
# 31	Red
# 32	Green
# 33	Yellow
# 34	Blue
# 35	Magenta
# 36	Cyan
# 37	White
#
# 	Background Colors
# 40	Black
# 41	Red
# 42	Green
# 43	Yellow
# 44	Blue
# 45	Magenta
# 46	Cyan

ansiFormats =
  reset:       { start: 0}
  black:       ansiColor(30)
  red:         ansiColor(31)
  green:       ansiColor(32)
  yellow:      ansiColor(33)
  blue:        ansiColor(34)
  purple:      ansiColor(35)
  cyan:        ansiColor(36)
  white:       ansiColor(37)
  "normal-color": ansiColor(39)
  intensive:   {start: 1, end: [ 0, 2, 21, 22 ]}
  # dim:         {start: 2, end: [ 0, 23 ]}
  italic:      {start: 3, end: [ 0, 23 ]}
  underline:   {start: 4, end: [ 0, 24 ]}
#  blink:       {start: 5, end: [ 0, 24 ]}  # which often is bright bg
  "bg-black":  ansiColor(40)
  "bg-red":    ansiColor(41)
  "bg-green":  ansiColor(42)
  "bg-yellow": ansiColor(43)
  "bg-blue":   ansiColor(44)
  "bg-purple": ansiColor(45)
  "bg-cyan":   ansiColor(46)
  "bg-white":  ansiColor(47)
  "bg-normal-color": ansiColor(49)

#  italic: 2
#  "underline-single": 4
#  "crossed-out":  9




ansiFormatted = (format) ->
  if typeof format == "string"
    name = format
    format = ansiFormats[format]

  name = format.name if format.name

  {start, startSuffix, startPrefix, end, endPrefix, endSuffix, extra} = format

  endSuffix   = "" unless endSuffix
  startSuffix = "" unless startSuffix

  end = "\\d+" unless end
  if end instanceof Array
     end = "(?:"+end.join("|")+")"


  if start instanceof Array
    start = "(?:"+start.join("|")+")"

  extra = "" unless extra

  return [
    {
      b: "(?<=\\033\\[|\\d;)(#{start};)"
      c: { 1: "hidden.ansi-escape-code" }
      N: "terminal.ansi.#{name}#{extra}"
      e: "(?=\\033\\[((?!#{end};)\\d+;)*#{end}(;\\d+)*m)"
      p: [ "#ansiFormats" ]
    }
    {
      b: "(?<=\\033\\[|\\d;)(#{start}m)"
      c: { 1: "hidden.ansi-escape-code" }
      N: "terminal.ansi.#{name}#{extra}"
      e: "(?=\\033\\[((?!#{end};)\\d+;)*#{end}(;\\d+)*m)"
      p: [ "#mainPatterns" ]
    }
  ]

mainPatterns = [
  "#pythonTraceback"
  "#genericLocationWithColumn"
  "#genericLocation"
  "#javascriptTracebackLocation"
  "#ansiFormatted"
  ]

grammar =
  name: "BuildOutput"
  scopeName: "source.build-output"
  patterns: [
    {
      N: "meta.build-container"
      b: /^(\[Started at (.*\)):\s(.*)\])/
      c:
        1: "meta.info"
        2: "meta.timestamp"
        3: "meta.command"
      e: /^(?=\[(Success|Failed) at .*\]$)/
      p: [ "#mainPatterns" ]
    }
    {
      n: "meta.success.build-output"
      m: /^\[Success at .*\]$/
    }
    {
      n: "invalid.illegal.error.build-output"
      m: /^\[Failed at .*\]$/
    }
  ]

  repository:
    mainPatterns: [
      "#pythonTraceback"
      "#genericLocationWithColumn"
      "#genericLocation"
      "#javascriptTracebackLocation"
      "#ansiFormatted"
      "#comment"
      {
        n: "meta.success.build-output"
        m: /\[Success at .*\]$/
      }
      {
        n: "invalid.illegal.error.build-output"
        m: /\[Failed at .*\]$/
      }
    ]

    ansiFormatted:
      b: /(\033\[)(?=(\d+;)*\d+m)/
      c: { 1: "hidden.ansi-escape-code" }

      n: "meta.ansi-formatted"

      L: true
      e: /(?=\033\[\d+(;\d+)*m)/

      p: "#ansiFormats"

    ansiFormats: (->
      ansiformatted = []

      for n,v of ansiFormats
        for rule in ansiFormatted(n)
          ansiformatted.push rule

      ansiformatted
      )()

    comment:
      n: "comment.line.number-sign.build-output"
      b: /(#)/
      c:
        1:
          "punctuation.definition.comment.build-output"
      e: /\n/

    genericLocationWithColumn:
      n: "invalid.illegal.result.error.build-output"
      m: /^((.*):(\d+):(\d+))$/
      c:
        1: "meta.location"
        2: "meta.file-name"
        3: "meta.line-no"
        4: "meta.column"

    javascriptTracebackLocation:
      n: "invalid.illegal.result.error.build-output"
      m: /at \S+ \(((.*):(\d+):(\d+))\)$/
      c:
        1: "meta.location"
        2: "meta.file-name"
        3: "meta.line-no"
        4: "meta.column"

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
