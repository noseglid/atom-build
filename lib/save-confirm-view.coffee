_ = require 'underscore'
{View, Emitter} = require 'atom'

module.exports =
class SaveConfirmView extends View
  @content: =>
    @div class: 'build-confirm overlay from-top', =>
      @div =>
        @h3 'You have unsaved changes.'
      @div class: 'btn-container pull-right', =>
        @button class: 'btn btn-success', outlet: 'saveBuildButton', title: 'Save and Build', click: 'saveAndBuild', 'Save and Build'
        @button class: 'btn btn-info', title: 'Build without saving', click: 'buildWithoutSave', 'Build without Saving'
      @div class: 'btn-container pull-left', =>
        @button class: 'btn btn-info', title: 'Cancel', click: 'cancel', 'Cancel'

  destroy: ->
    @detach()

  show: (confirmcb, cancelcb) =>
    atom.workspaceView.command 'build:confirm', => @saveAndBuild()

    atom.workspaceView.append(this)
    @confirmcb = confirmcb
    @cancelcb = cancelcb

    @saveBuildButton.focus()

  cancel: ->
    @destroy()
    @cancelcb() if @cancelcb

  saveAndBuild: ->
    console.log arguments
    _.each atom.workspace.getTextEditors(), (editor) ->
      editor.save()
    @confirmcb() if @confirmcb
    @destroy()

  buildWithoutSave: =>
    @confirmcb() if @confirmcb
    @destroy()
