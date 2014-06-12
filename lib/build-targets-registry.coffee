$ = require 'atom'
{spawn, exec} = require 'child_process'
fs = require 'fs'
_ = require 'underscore'

###
Base class for BuildTargets provider.

Derive your build targets providers from this class.
###
class BuildTargets

  # may be null, a string or a list of build files relative to root of current
  # project
  buildFiles: null

  constructor: (@builder) ->
    @commands = {}
    @root = builder.root
    @installWatcher()
    @update()

  # installs watch on files in buildFiles
  installWatcher: ->
    if @buildFiles?
      if not (@buildFiles instanceof Array)
        @buildFiles = [ @buildFiles ]

      for f in @buildFiles
        buildfile = "#{@root}/#{f}".replace(/\/\/+/, "/")
        fs.watchFile buildfile, => @update()

  # for each buildfile in @buildFiles, there is run `handler` on each file
  #
  # absolute path of buildfile is passed to handler and  handler must return
  # an object.  either empty or it contains a dictionary
  # of command (which is something like "build:buildtoolname-targetname")
  #
  buildFile: (handler)->
    return {} if not @buildFiles?

    handle = handler

    commands = {}
    for f in @buildFiles
      buildfile = "#{@root}/#{f}".replace(/\/\/+/, "/")
      _.extend(commands, handle buildfile) if fs.existsSync buildfile

    return commands

  # returns build command, which is used for creating atom commands
  buildCommand: (name) ->
    if name instanceof Array
      => @builder.startNewBuild cmd: @buildTool, args: name
    else
      => @builder.startNewBuild cmd: @buildTool, args: [name]

  # implement this function to return a dictionary like described in buildFile
  #
  # usually you would implemnt it like this:
  #
  #    getCommands: ->
  #        @buildFile (buildfile) =>
  #            # now do something with build file
  getCommands: -> {}

  # is called from watcher on file change
  update: -> @replaceCommands(@getCommands())

  # replaces commands for build targets with new ones
  replaceCommands: (commands) ->
    for k,v of @commands
      if not k of commands
        @removeCommand k

    for k,v of commands
      if typeof v is "function"
        @addCommand k, v
      else
        @addCommand k, @buildCommand v

  # adds command to atom workspace
  addCommand: (name, command) ->
    @commands[name] = command
    atom.workspaceView.command name, command

  # removes command from atom workspace
  removeCommand: (name) ->
    if @commands[name]
      atom.workspaceView.off name
      # see space-pen jQuery extensions
      data = atom.workspaceView.data('documentation')
      if data?.name?
          delete data[name]

      delete @commands[name]

  # run buildTool and call gotline for each line from output of buildTool
  #
  # opts may have cwd, args keys and whatever child_process.exec accepts.
  # args must be an array.
  getLines: (opts, gotline) ->
    if opts typeof "function"
      opts = {}
      gotline = opts

    exec_opts =
      cwd: @root

    $.extend exec_opts, opts

    cmd = @buildTool
    if exec_opts.args
      cmd += " " + " ".join(exec_opts.args)
      delete exec_opts.args

    exec cmd, exec_opts, (error, stdout, stderr) ->
      lines = stdout.toString().replace(/\n$/, '').split(/\n/)
      for line in lines
        gotline(line)

# first register all classes and later activate it on package activation
class BuildTargetsRegistry
  constructor: ->
    @registry = []
    @containers = []

  register: (cls) ->
    @registry.push cls

  activate: (builder) ->
    for buildTargetsContainer in @registry
      @containers.push new buildTargetsContainer(builder)

module.exports =
  BuildTargets: BuildTargets
  registry: new BuildTargetsRegistry()
