_ = require 'underscore'
{View, Emitter} = require 'atom'

module.exports =
class SaveConfirmView extends View
  @content: =>
    @div class: 'build-confirm overlay from-top', =>
      @div =>
        @h3 'You have unsaved changes.'
      @div class: 'btn-container pull-right', =>
        @button class: 'btn btn-success', outlet: 'saveBuildButton', title: 'Save and Build', click: 'saveAndConfirm', 'Save and Build'
        @button class: 'btn btn-info', title: 'Build without saving', click: 'confirmWithoutSave', 'Build without Saving'
      @div class: 'btn-container pull-left', =>
        @button class: 'btn btn-info', title: 'Cancel', click: 'cancel', 'Cancel'

  destroy: ->
    @confirmcb = undefined
    @cancelcb = undefined
    @detach()

  show: (confirmcb, cancelcb) =>
    @confirmcb = confirmcb
    @cancelcb = cancelcb

    if (atom.config.get 'build.saveOnBuild')
      # Opted in to force save and build. Just do it
      @saveAndConfirm()
      return

    atom.workspaceView.command 'build:confirm', => @saveAndConfirm()
    atom.workspaceView.append(this)
    @saveBuildButton.focus()

  cancel: ->
    @destroy()
    @cancelcb() if @cancelcb

  saveAndConfirm: ->
    _.each atom.workspace.getTextEditors(), (editor) ->
      editor.save()
    @confirmcb() if @confirmcb
    @destroy()

  confirmWithoutSave: =>
    @confirmcb() if @confirmcb
    @destroy()
