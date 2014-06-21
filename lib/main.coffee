Builder = require "./builder"
BuildOutputView = require "./build-output-view"

url = require 'url'

module.exports =
  # configDefaults:
  #   environment: "",
  #   arguments: ""

  activate: (state) ->
    @builder = new Builder()

    @packagesActivated = =>
      console.log "packages activated"
      # give packages a second to activate them selves, then start build
      # system discoverage
      setTimeout (=> @builder.discoverBuildSystems()), 1000

    atom.packages.once 'activated', @packagesActivated

    @projectPathChanged = =>
      console.log "projectPath changed"
      @builder.projectPathChanged()

    atom.project.on "path-changed", @projectPathChanged

    atom.workspace.registerOpener (uriToOpen) =>
      try
        {protocol, host, pathname} = url.parse(uriToOpen)
      catch error
        return

      return unless protocol == 'build-output:'

      new BuildOutputView(@builder)

    @builder.on 'build', (callback) =>
      @openBuildView callback

  openBuildView: (callback) ->
    uri = "build-output://"

    return if @activateBuildView(uri, callback)

    atom.workspace.getActivePane().splitDown()

    atom.workspace.open(uri, split: 'bottom', searchAllPanes: true).done =>
      console.log "open build View"
      if callback
        callback()

  activateBuildView: (uri, callback) ->
    buildOutputPane = atom.workspace.paneForUri(uri)

    if buildOutputPane
      buildOutputPane.itemForUri(uri).clear()
      buildOutputPane.activate()
      #console.log "item", item
      #buildOutputPane.destroyItem(
      if callback
        callback()
      return true

    return false

  deactivate: ->
    @builder.shutdown()
