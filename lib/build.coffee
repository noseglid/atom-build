child_process = require 'child_process'
fs = require 'fs'
qs = require 'querystring'
_ = require 'underscore'

buildTargets = require './build-targets'
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
    buildTargets.activate @

  deactivate: ->
    @child.kill('SIGKILL') if @child

  buildCommand: ->
    cmd = "make" if fs.existsSync @root + "/Makefile"
    return cmd

  startNewBuild: (opts) ->
    {cmd, args, env, cwd} = opts

    args = []    unless args
    env  = {}    unless env
    cwd  = @root unless cwd

    env = _.extend {}, process.env, env

    if !cmd
      cmd = @buildCommand()
      return if !cmd

      args = (atom.config.get('build.arguments').split(' ')).filter((e) -> '' != e)
      env  = (qs.parse (atom.config.get 'build.environment'), ' ')

    console.log cmd, args, { cwd: @root, env: env }

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
