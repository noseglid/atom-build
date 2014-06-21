{$, $$, EditorView, ScrollView} = require 'atom'

module.exports =
class BuildOutputView extends EditorView
  @content: =>
    # button bar on top to show/hide debug, info, warning, error, fatal

    @div class: 'build build-output', =>
      @div =>
        @ol class: 'output', outlet: 'buildOutput'

    # @div tabIndex: -1, class: 'build overlay from-bottom', =>
    #   @button class: 'btn btn-info', outlet: 'closeButton', click: 'close' , "close"
    #   @div =>
    #     @ol class: 'output panel-body', outlet: 'output'
    #   @div =>
    #     @h1 class: 'title panel-heading', outlet: 'title'

  constructor: (builder) ->
    super()

    builder.on 'start', =>
      console.log "start", this, arguments
      @startBuild.apply this, arguments

    builder.on 'stdout', =>
      console.log "stdout", this, arguments
      @appendOutput.apply this, arguments

    builder.on 'stderr', =>
      console.log "stderr", this, arguments
      @appendError.apply this, arguments

    builder.on 'end', =>
      console.log "end", this, arguments
      @stopBuild.apply this, arguments

    @titleLoopIndex = null

    @builder = builder

  makeOutput: (type, data) ->
    data.replace /\n$/, ''

    for line in data.split /\n/
#      for r in @buildSystem.
      $$ -> @li class: type, => @text(line)

  appendOutput: (data) ->
    #for line in data.split /\n/
    console.log("appendOutput", data)

    @buildOutput.append $$ -> @li class: "info", => @text(data)

  appendError: (data) ->
    console.log("appendError", data)
    @buildOutput.append $$ -> @li class: "error", => @text(data)

  stopBuild: (errorcode, timestamp) ->
    console.log("stopBuild", errorcode, timestamp)
    summary = "[Ended at #{timestamp}, result: #{errorcode}]"
    @buildOutput.append $$ ->
      unless errorcode
        @li class: "success", => @text(summary)
      else
        @li class: "error", => @text(summary)

  startBuild: (buildSystem, timestamp) ->
    console.log("startBuild", buildSystem, timestamp)
    @buildSystem = buildSystem
    @started = timestamp

    text = "[started at #{timestamp}: #{buildSystem.cmd} #{buildSystem.args.join(' ')}]"

    @buildOutput.append $$ -> @li => @text(text)

    #@getPane().activate()

    #super()
    # @titleLoop = [
    #   "[/] Building",
    #   "[-] Building",
    #   "[\\] Building",
    #   "[|] Building",
    # ];
    # @titleLoopIndex = 0

  detach: ->
    atom.workspaceView.focus();
    super()

  reset: =>
    clearTimeout @titleTimer if @titleTimer
    clearTimeout @abortTimer if @abortTimer
    @abortTimer = null
    @titleTimer = null
    @title.removeClass('success')
    @title.removeClass('error')
    @closeButton.hide()
    @output.empty()
    @detach()

  updateTitle: =>
    @title.text @titleLoop[@titleLoopIndex]
    @titleLoopIndex = (@titleLoopIndex + 1) % @titleLoop.length
    @titleTimer = setTimeout @updateTitle, 200

  getTitle: ->
    if @titleLoop?
      @titleLoop[@titleLoopIndex]
    else
      "Build Output"

  clear: ->
    @buildOutput.children().remove()

  getUri: ->
    return "build-output://"

  close: (event, element) ->
    @detach()

  buildStarted: =>
    @reset()
    atom.workspaceView.append(this)
    @focus()
    @updateTitle()

  buildFinished: (success) ->
    @title.text(if success then 'Build finished.' else 'Build failed.')
    @title.addClass(if success then 'success' else 'error')
    @closeButton.show() if !success
    clearTimeout @titleTimer if @titleTimer

  buildAborted: =>
    @title.text('Aborted!')
    @title.addClass('error')
    clearTimeout @titleTimer if @titleTimer
    @abortTimer = setTimeout @reset, 1000

  append: (line) =>
    line = line.toString()
    debugger
    @output.append "<li>#{line}</li>"
    @output.scrollTop(@output[0].scrollHeight)
