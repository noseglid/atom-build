child_process = require 'child_process'
fs = require 'fs'
qs = require 'querystring'
_ = require 'underscore'

{$} = require 'atom'

BuildView = require './build-view'

module.exports =
  configDefaults:
    environment: "",
    arguments: "",
    keepVisible: true

  activate: (state) ->
    # Manually append /usr/local/bin as it may not be set on some systems,
    # and it's common to have node installed here. Keep it at end so it won't
    # accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin'

    @root = atom.project.getPath()
    @buildView = new BuildView()
    atom.workspaceView.command "build:trigger", => @build()
    atom.workspaceView.command "build:stop", => @stop()

    @buildView.attach() if atom.config.get 'build.keepVisible'

  deactivate: ->
    @child.kill('SIGKILL') if @child
    clearTimeout @finishedTimer

  buildCommand: ->
    if fs.existsSync @root + '/.atom-build.json'
      realAtomBuild = fs.realpathSync @root + '/.atom-build.json'
      delete require.cache[realAtomBuild]
      build = require realAtomBuild
      [exec, env, args] = [ build.cmd, build.env, build.args ]

    if !exec && fs.existsSync @root + '/package.json'
      realPackage = fs.realpathSync @root + '/package.json'
      delete require.cache[realPackage]
      pkg = require realPackage
      exec = 'apm' if pkg.engines?.atom
      exec = 'npm' if pkg.engines?.node
      args = [ '--color=always', 'install' ] if pkg.engines

    if !exec && fs.existsSync @root + '/Gruntfile.js'
      if fs.existsSync @root + '/node_modules/.bin/grunt'
        # if grunt is installed locally, prefer this
        exec = @root + '/node_modules/.bin/grunt'
      else
        # else use global installation
        exec = 'grunt'

    if !exec && fs.existsSync @root + '/Makefile'
      exec = 'make'
      args = []

    return {
      exec: exec,
      env: env || {},
      args: args || []
    }

  replace: (value) ->
    value = value.replace '{FILE_ACTIVE}', fs.realpathSync atom.workspace.getActiveEditor().getPath() if atom.workspace.getActiveEditor()
    value = value.replace '{PROJECT_PATH}', fs.realpathSync atom.project.getPath()
    value = value.replace '{REPO_BRANCH_SHORT}', atom.project.getRepo().getShortHead() if atom.project.getRepo()
    return value;

  startNewBuild: ->
    cmd = @buildCommand()
    return if !cmd.exec

    env = _.extend(process.env, cmd.env, (qs.parse (atom.config.get 'build.environment'), ' '))
    _.each env, (value, key, list) =>
      list[key] = @replace value

    cargs = (atom.config.get('build.arguments').split(' ')).filter((e) -> '' != e)
    args = cmd.args.concat(cargs)
    args = _.map args, @replace

    @child = child_process.spawn(
      '/bin/sh',
      [ '-c', [cmd.exec].concat(args).join(' ') ],
      { cwd : @root, env: env }
    )

    @child.stdout.on 'data', @buildView.append
    @child.stderr.on 'data', @buildView.append
    @child.on 'error', (err) =>
      @buildView.append 'Unable to execute: ' + cmd.exec
      @buildView.append '`cmd` cannot contain space. Use `args` for arguments.' if /\s/.test(cmd.exec)

    @child.on 'close', (exitCode) =>
      @buildView.buildFinished(0 == exitCode)
      @finishedTimer = (setTimeout (=> @buildView.detach()), 1000) if (0 == exitCode)
      @child = null

    @buildView.buildStarted()
    @buildView.append 'Executing: ' + cmd.exec + [' '].concat(args).join(' ')

  abort: (cb) ->
    @child.removeAllListeners 'close'
    @child.on 'close', =>
      @child = null
      cb() if cb
    @child.kill()
    @child.killed = true;

  build: ->
    clearTimeout @finishedTimer
    if @child then @abort(=> @startNewBuild()) else @startNewBuild()

  stop: ->
    clearTimeout @finishedTimer
    if @child
      if (@child.killed)
        # This child has been killed, but hasn't terminated. Hide it from user.
        @child.removeAllListeners()
        @child = null
        @buildView.buildAborted()
        return

      @abort(=>
        @buildView.buildAborted()
      )
      @buildView.buildAbortInitiated()
    else
      @buildView.reset()
