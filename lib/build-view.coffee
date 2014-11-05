{$, TextEditorView, View} = require 'atom'
Convert = require 'ansi-to-html'
_ = require 'underscore'

module.exports =
class BuildView extends View
  @content: =>
    @div tabIndex: -1, class: 'build tool-panel panel-bottom', =>
      @div class: 'btn-container pull-right', =>
        @button class: 'btn btn-default icon icon-x', outlet: 'closeButton', click: 'close'
        @button class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle'
        @button class: 'btn btn-default icon icon-trashcan new-row', outlet: 'clearButton', click: 'clear'
        @button class: 'btn btn-default icon icon-zap', outlet: 'triggerButton', click: 'build', title: 'Build current project'

      @div =>
        @ol class: 'output panel-body', outlet: 'output'
      @div =>
        @h1 class: 'title panel-heading', outlet: 'title', "Ready"

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
    atom.config.observe 'build.monocleHeight', @heightFromConfig
    atom.config.observe 'build.minimizedHeight', @heightFromConfig

  attach: ->
    if atom.workspace.addBottomPanel
      atom.workspace.addBottomPanel({ item: this })
    else
      atom.workspaceView.prependToBottom(this)

  detach: (force = false) ->
    atom.workspaceView.focus();
    super() if force || !(atom.config.get 'build.keepVisible')

  heightFromConfig: (val) =>
    if @monocle
      @setHeightPercent(atom.config.get('build.monocleHeight'))
    else
      @setHeightPercent(atom.config.get('build.minimizedHeight'))

  visibleFromConfig: (val) =>
    @attach() if val
    @detach() if !val

  reset: =>
    clearTimeout @titleTimer if @titleTimer
    @titleTimer = null
    @title.removeClass('success error warning')
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
    @attach()

  build: (event, element) ->
    atom.workspaceView.trigger 'build:trigger'

  setHeightPercent: (percent) =>
    newHeight = percent * (@output.offset().top + @output.height())
    @output.css('height', newHeight + 'px')

  toggleMonocle: (event, element) =>
    if (!@monocle)
      @setHeightPercent(atom.config.get('build.monocleHeight'))
      @monocleButton.removeClass('icon-chevron-up').addClass('icon-chevron-down');
    else
      @setHeightPercent(atom.config.get('build.minimizedHeight'))
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
    line = _.escape line.toString()
    @output.append "<li>#{@a2h.toHtml(line)}</li>";
    @output.scrollTop(@output[0].scrollHeight)
