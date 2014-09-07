{$, EditorView, View} = require 'atom'
Convert = require 'ansi-to-html'

module.exports =
class BuildView extends View
  @content: =>
    @div tabIndex: -1, class: 'build tool-panel panel-bottom', =>
      @div class: 'btn-container', =>
        @button class: 'btn btn-default icon icon-x', outlet: 'closeButton', click: 'close'
        @button class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle'
        @button class: 'btn btn-default icon icon-trashcan new-row', outlet: 'clearButton', click: 'clear'
        @button class: 'btn btn-default icon icon-zap', outlet: 'triggerButton', click: 'build', title: 'Build current project'

      @div =>
        @ol class: 'output panel-body', outlet: 'output'
      @div =>
        @h1 class: 'title panel-heading', outlet: 'title'

  constructor: ->
    super()
    @titleLoop = [
      "Building",
      "Building.",
      "Building..",
      "Building..."
    ];
    @titleLoopIndex = 0
    @a2h = new Convert()
    atom.config.observe 'build.keepVisible', @visibleFromConfig

  attach: ->
    atom.workspaceView.prependToBottom(this)

  detach: (force = false) ->

    atom.workspaceView.focus();
    super() if force || !(atom.config.get 'build.keepVisible')

  visibleFromConfig: (val) =>
    @attach() if val
    @detach() if !val

  reset: =>
    clearTimeout @titleTimer if @titleTimer
    @titleTimer = null
    @title.removeClass('success')
    @title.removeClass('error')
    @output.empty()
    @title.text 'Cleared.'
    @detach()

  updateTitle: =>
    @title.text @titleLoop[@titleLoopIndex]
    @titleLoopIndex = (@titleLoopIndex + 1) % @titleLoop.length
    @titleTimer = setTimeout @updateTitle, 200

  close: (event, element) ->
    @detach(true)

  clear: (event, element) ->
    @reset()

  build: (event, element) ->
    atom.workspaceView.trigger 'build:trigger'

  toggleMonocle: (event, element) =>
    newHeight = 3 * (@output.offset().top - @output.height()) / 4
    if (!@monocle)
      @output.css('height', newHeight + 'px')
      @monocleButton.removeClass('icon-chevron-up').addClass('icon-chevron-down');
    else
      @output.css('height', '')
      @monocleButton.removeClass('icon-chevron-down').addClass('icon-chevron-up');
    @monocle = !@monocle

  buildStarted: =>
    @reset()
    @attach()
    @focus()
    @updateTitle()

  buildFinished: (success) ->
    @title.text(if success then 'Build finished.' else 'Build failed.')
    @title.addClass(if success then 'success' else 'error')
    clearTimeout @titleTimer if @titleTimer

  buildAbortInitiated: =>
    @title.text('Build process termination imminent...')
    clearTimeout @titleTimer if @titleTimer
    @title.addClass('error')

  buildAborted: =>
    @title.text('Aborted!')

  append: (line) =>
    line = line.toString()
    @output.append "<li>#{@a2h.toHtml(line)}</li>";
    @output.scrollTop(@output[0].scrollHeight)
