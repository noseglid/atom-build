Build = require '../lib/build'
{WorkspaceView} = require 'atom';
fs = require 'fs'

describe "Build", ->
  promise = null
  makefile = __dirname + '/Makefile'
  goodMakefile = __dirname + '/fixture/Makefile.good'
  badMakefile = __dirname + '/fixture/Makefile.bad'
  longMakefile = __dirname + '/fixture/Makefile.long'

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    promise = atom.packages.activatePackage('build')
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))

  afterEach ->
    fs.unlinkSync(makefile) if (fs.existsSync(makefile))

  describe "when build is triggered", ->
    it "should not show the build window if no buildfile exists", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      atom.workspaceView.trigger 'build:trigger'

      waitsForPromise ->
        atom.workspaceView.open()

      runs ->
        expect(atom.workspaceView.find('.build')).not.toExist()

    it "should show the build window if buildfile exists", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(makefile, fs.readFileSync(goodMakefile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('success')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toBe 'Surprising is the passing of time\nbut not so, as the time of passing\n';

    it "should show build failed if build fails", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(makefile, fs.readFileSync(badMakefile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('error')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Very bad\.\.\./

    it "should cancel build when stopping it, and remove when stopping again", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(makefile, fs.readFileSync(longMakefile));
      atom.workspaceView.trigger 'build:trigger'

      # Let build run for one second before we terminate it
      waits 1000

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toBe "Building, this will take some time...\n"
        atom.workspaceView.trigger 'build:stop'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('error')

      waitsFor ->
        /Terminated/.test(atom.workspaceView.find('.build .output').text())

      runs ->
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Terminated/
        atom.workspaceView.trigger 'build:stop'
        expect(atom.workspaceView.find('.build')).not.toExist()
