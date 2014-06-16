child_process = require 'child_process'
fs = require 'fs'
qs = require 'querystring'
{_} = require 'underscore'

buildSystemRegistry = require './build-systems'

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

    buildSystemRegistry.activate this

  addCommand: (name, command) ->
    atom.workspaceView.command name, command

  # removes command from atom workspace
  removeCommand: (name) ->
    atom.workspaceView.off name
    # see space-pen jQuery extensions
    data = atom.workspaceView.data('documentation')
    if data?.name?
      delete data[name]

  deactivate: ->
    @child.kill('SIGKILL') if @child

  buildCommand: ->
    cmd = 'make' if fs.existsSync @root + '/Makefile';
    return cmd

  startNewBuild: (buildSystem) ->
    if buildSystem?
      {cmd, args, env, cwd} = buildSystem

    args = [] unless args
    env = {} unless env
    cwd = @root unless cwd

    env = _.extend {}, process.env, env

    unless cmd
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
