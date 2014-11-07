child_process = require 'child_process'
fs = require 'fs'
path = require 'path'
qs = require 'querystring'
_ = require 'underscore'

{$} = require 'atom'

BuildView = require './build-view'
SaveConfirmView = require './save-confirm-view'

module.exports =
  config:
    monocleHeight:
      type: 'number',
      default: 0.75,
    minimizedHeight:
      type: 'number',
      default: 0.15,
    keepVisible:
      type: 'boolean',
      default: false
    saveOnBuild:
      type: 'boolean',
      default: false

  activate: (state) ->
    # Manually append /usr/local/bin as it may not be set on some systems,
    # and it's common to have node installed here. Keep it at end so it won't
    # accidentially override any other node installation
    process.env.PATH += ':/usr/local/bin'

    @buildView = new BuildView()
    atom.workspaceView.command "build:trigger", => @build()
    atom.workspaceView.command "build:stop", => @stop()

    @buildView.attach() if atom.config.get 'build.keepVisible'

  deactivate: ->
    @child.kill('SIGKILL') if @child
    clearTimeout @finishedTimer

  buildCommand: ->
    @root = atom.project.getPaths()[0]
    if fs.existsSync @root + '/.atom-build.json'
      realAtomBuild = fs.realpathSync @root + '/.atom-build.json'
      delete require.cache[realAtomBuild]
      build = require realAtomBuild
      [ exec, env, args, cwd, sh ] = [ build.cmd, build.env, build.args, build.cwd, build.sh ]

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

    if !exec && fs.existsSync @root + '/gulpfile.js'
      if fs.existsSync @root + '/node_modules/.bin/gulp'
        # if gulp is installed locally, prefer this
        exec = @root + '/node_modules/.bin/gulp'
      else
        # else use global installation
        exec = 'gulp'

    if !exec && fs.existsSync @root + '/mix.exs'
      exec = 'mix'
      args = ['compile']

    if !exec && fs.existsSync @root + '/Makefile'
      exec = 'make'
      args = []

    return {
      exec: exec,
      env: env || {},
      args: args || [],
      cwd: cwd || @root,
      sh: if sh? then sh else true
    }

  replace: (value) ->
    if atom.workspace.getActiveEditor()
      activeFile = fs.realpathSync atom.workspace.getActiveEditor().getPath()
      value = value.replace '{FILE_ACTIVE}', activeFile
      value = value.replace '{FILE_ACTIVE_PATH}', path.dirname(activeFile)
      value = value.replace '{FILE_ACTIVE_NAME}', path.basename(activeFile)
      value = value.replace '{FILE_ACTIVE_NAME_BASE}', path.basename(activeFile, path.extname(activeFile))

    value = value.replace '{PROJECT_PATH}', fs.realpathSync atom.project.getPaths()[0]
    value = value.replace '{REPO_BRANCH_SHORT}', atom.project.getRepositories()[0].getShortHead() if atom.project.getRepositories[0]
    return value;

  startNewBuild: ->
    cmd = @buildCommand()
    return if !cmd.exec

    env = _.extend(process.env, cmd.env)
    _.each env, (value, key, list) =>
      list[key] = @replace value

    args = _.map cmd.args, @replace

    cmd.exec = @replace cmd.exec

    @child = child_process.spawn(
      if cmd.sh then '/bin/sh' else cmd.exec,
      if cmd.sh then [ '-c', [cmd.exec].concat(args).join(' ') ] else args,
      { cwd : @replace cmd.cwd, env: env }
    )

    @child.stdout.on 'data', @buildView.append
    @child.stderr.on 'data', @buildView.append
    @child.on 'error', (err) =>
      @buildView.append (if cmd.sh then 'Unable to execute with sh: ' else 'Unable to execute: ')  + cmd.exec
      @buildView.append '`cmd` cannot contain space. Use `args` for arguments.' if /\s/.test(cmd.exec)

    @child.on 'close', (exitCode) =>
      @buildView.buildFinished(0 == exitCode)
      @finishedTimer = (setTimeout (=> @buildView.detach()), 1000) if (0 == exitCode)
      @child = null

    @buildView.buildStarted()
    @buildView.append (if cmd.sh then 'Executing with sh: ' else 'Executing: ') + cmd.exec + [' '].concat(args).join(' ')

  abort: (cb) ->
    @child.removeAllListeners 'close'
    @child.on 'close', =>
      @child = null
      cb() if cb
    @child.kill()
    @child.killed = true;

  build: ->
    clearTimeout @finishedTimer

    @doSaveConfirm @unsavedEditors(), =>
      if @child then @abort(=> @startNewBuild()) else @startNewBuild()

  doSaveConfirm: (modifiedEditors, continuecb, cancelcb) ->
    if (0 == _.size modifiedEditors)
      continuecb()
      return

    saveConfirmView = new SaveConfirmView()
    saveConfirmView.show(continuecb, cancelcb)

  unsavedEditors: ->
    return _.filter atom.workspace.getTextEditors(), (editor) ->
      return editor.isModified()

  stop: ->
    clearTimeout @finishedTimer
    if @child
      if (@child.killed)
        # This child has been killed, but hasn't terminated. Hide it from user.
        @child.removeAllListeners()
        @child = null
        @buildView.buildAborted()
        return

      @abort =>
        @buildView.buildAborted()

      @buildView.buildAbortInitiated()
    else
      @buildView.reset()
