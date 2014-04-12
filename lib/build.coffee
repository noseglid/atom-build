child_process = require 'child_process'
fs = require 'fs'
qs = require 'querystring'

BuildView = require './build-view'

module.exports =
  configDefaults:
    environment: "",
    arguments: ""

  activate: (state) ->
    @root = atom.project.getPath()
    @buildView = new BuildView()
    atom.workspaceView.command "build:trigger", => @build()
    atom.workspaceView.command "build:stop", => @stop()

  buildCommand: ->
    cmd = 'make' if fs.existsSync @root + '/Makefile';
    return cmd

  startNewBuild: ->
    cmd = @buildCommand()
    return if !cmd

    args = (atom.config.get('build.arguments').split(' ')).filter((e) -> '' != e)
    env = (qs.parse (atom.config.get 'build.environment'), ' ')

    @child = child_process.spawn(cmd, args, { cwd : @root, env: env })
    @child.stdout.on 'data', @buildView.append
    @child.stderr.on 'data', @buildView.append
    @child.on 'close', (exitCode) =>
      @buildView.buildFinished(0 == exitCode)
      @finishedTimer = (setTimeout (=> @buildView.detach()), 1000) if (0 == exitCode)
      @child = null

    @buildView.buildStarted()

  abort: (cb) ->
    @child.removeAllListeners 'close'
    @child.on 'close', =>
      @child = null
      cb() if cb
    @child.kill()

  build: ->
    clearTimeout @finishedTimer
    if @child then @abort(=> @startNewBuild()) else @startNewBuild()

  stop: ->
    if @child
      @abort()
      @buildView.buildAborted()
    else
      @buildView.reset()
