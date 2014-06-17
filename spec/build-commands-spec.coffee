Build = require '../lib/build'
{WorkspaceView} = require 'atom';
fs = require 'fs'

describe "Build", ->
  promise = null

  makefile = __dirname + '/Makefile'
  makefileFixture = __dirname + '/fixture/Makefile.many-targets'

  cakefile = __dirname + '/Cakefile'
  package_json = __dirname + '/package.json'
  apm_package_json = __dirname + '/../package.json'

  beforeEach ->
    atom.workspaceView = new WorkspaceView()
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))


  afterEach ->
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))
    fs.unlinkSync(package_json) if (fs.existsSync(package_json))

  describe "packages.json handlers npm and apm", ->
    describe "when package is activated", ->
      it "created npm and apm commands", ->
        fs.writeFileSync(package_json, fs.readFileSync(apm_package_json));

        waitsForPromise ->
          atom.packages.activatePackage('build')
          # simulate end of activatePackages
        runs ->
          atom.packages.emit 'activated'

        waits 500

        runs ->
          expect(atom.workspaceView.events()["build:npm-install"]).toBe "Build: Npm Install"
          expect(atom.workspaceView.events()["build:apm-install"]).toBe "Build: Apm Install"
