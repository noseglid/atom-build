{$, EditorView, View} = require 'atom'

module.exports =
class BuildView extends View
  @content: =>
    @div class: 'build overlay from-bottom', =>
      @button class: 'btn btn-info', outlet: 'closeButton', click: 'close' , "X"
      @div =>
        @ol class: 'output panel-body', outlet: 'output'
      @div =>
        @h1 class: 'title panel-heading', outlet: 'title'

  constructor: ->
    super
    @titleLoop = [
      "Building",
      "Building.",
      "Building..",
      "Building..."
    ];
    @titleLoopIndex = 0

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

  close: (event, element) ->
    @detach()

  buildStarted: =>
    @reset()
    atom.workspaceView.append(this)
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
    @output.append "<li>#{line}</li>";
    @output.scrollTop(@output[0].scrollHeight)
