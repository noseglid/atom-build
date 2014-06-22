Build = require '../lib/main'
{WorkspaceView} = require 'atom';
fs = require 'fs'

describe "Build", ->
  promise = null

  makefile = __dirname + '/Makefile'
  makefileLongFixture = __dirname + '/fixture/Makefile.long'
  makefileGoodFixture = __dirname + '/fixture/Makefile.good'

  cakefile = __dirname + '/Cakefile'
  packageJson = __dirname + '/package.json'
  packageJsonApmFixture = "#{__dirname}/../package.json"
  packageJsonNpmFixture = "#{__dirname}/fixture/package.json"

  beforeEach ->
    console.log("--> begin")
    atom.workspaceView = new WorkspaceView()
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))

  afterEach ->
#    atom.packages.deactivatePackage('build')
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))
    fs.unlinkSync(packageJson) if (fs.existsSync(packageJson))
    console.log("<-- end")

  describe "packages.json handlers npm and apm", ->
    describe "when package is activated", ->

      checkTargets = (test) ->
        waitsForPromise ->
           atom.packages.activatePackage('build')
          # simulate end of activatePackages
        runs ->
           atom.packages.emit 'activated'

        waits 500

        runs ->
          test()

      it "creates npm and apm commands for packages.json with atom engine", ->
        fs.writeFileSync(packageJson, fs.readFileSync(packageJsonApmFixture));

        checkTargets ->
          expect(atom.workspaceView.events()["build:npm-install"]).toBe "Build: Npm Install"
          expect(atom.workspaceView.events()["build:apm-install"]).toBe "Build: Apm Install"

      it "creates only npm commands for packages.json without atom engine", ->
        fs.writeFileSync(packageJson, fs.readFileSync(packageJsonNpmFixture));

        checkTargets ->
          expect(atom.workspaceView.events()["build:npm-install"]).toBe "Build: Npm Install"
          expect(atom.workspaceView.events()["build:apm-install"]).toBe undefined

      it "changes commands, if targets change", ->
        fs.writeFileSync(makefile, fs.readFileSync(makefileLongFixture));

        checkTargets ->
          expect(atom.workspaceView.events()["build:make-another-target"]).toBe "Build: Make Another Target"
          expect(atom.workspaceView.events()["build:make-all"]).toBe "Build: Make All"
          expect(atom.workspaceView.events()["build:make-somefile.js"]).toBe undefined

        runs ->
          fs.writeFileSync(makefile, fs.readFileSync(makefileGoodFixture));

        waits 3500

        runs ->
          expect(atom.workspaceView.events()["build:make-another-target"]).toBe undefined
          expect(atom.workspaceView.events()["build:make-all"]).toBe "Build: Make All"
