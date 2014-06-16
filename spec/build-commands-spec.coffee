Build = require '../lib/build'
{WorkspaceView} = require 'atom';
fs = require 'fs'

describe "Build", ->
  promise = null

  makefile = __dirname + '/Makefile'
  makefileFixture = __dirname + '/fixture/Makefile.many-targets'

  cakefile = __dirname + '/Cakefile'

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))
    promise = atom.packages.activatePackage('build')

  afterEach ->
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))

  # we exploit existence of own packages.json

  describe "packages.json handlers npm and apm", ->
    describe "when package is activated", ->
      it "npm and apm commands are created", ->
        waitsForPromise ->
          expect(atom.workspaceView.events()["build:npm-install"]).toBe "Build: Npm Install"
          expect(atom.workspaceView.events()["build:apm-install"]).toBe "Build: Apm Install"
