Build = require '../lib/build'
{WorkspaceView} = require 'atom';
fs = require 'fs'
_ = require 'underscore'

describe "Build", ->
  promise = null
  makefile = __dirname + '/Makefile'
  gruntfile = __dirname + '/Gruntfile.js'
  pkgjsonfile = __dirname + '/package.json'
  goodMakefile = __dirname + '/fixture/Makefile.good'
  badMakefile = __dirname + '/fixture/Makefile.bad'
  longMakefile = __dirname + '/fixture/Makefile.long'
  goodGruntfile = __dirname + '/fixture/Gruntfile.js'
  goodNodefile = __dirname + '/fixture/package.json.node'
  goodAtomfile = __dirname + '/fixture/package.json.atom'

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    promise = atom.packages.activatePackage('build')
    _.each([makefile, gruntfile, pkgjsonfile], (file) ->
      fs.unlinkSync file if fs.existsSync file)

  afterEach ->
    _.each([makefile, gruntfile, pkgjsonfile], (file) ->
      fs.unlinkSync file if fs.existsSync file)

    delete require.cache[pkgjsonfile]

  describe "when build is triggered with Makefile", ->
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
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Surprising is the passing of time\nbut not so, as the time of passing/;

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
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Building, this will take some time.../
        atom.workspaceView.trigger 'build:stop'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('error')

      waitsFor ->
        /Terminated/.test(atom.workspaceView.find('.build .output').text())

      runs ->
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Terminated/
        atom.workspaceView.trigger 'build:stop'
        expect(atom.workspaceView.find('.build')).not.toExist()

  describe "when build is triggered with grunt file", ->
    it "should show the build window", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(gruntfile, fs.readFileSync(goodGruntfile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('success')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Surprising is the passing of time. But not so, as the time of passing/;

  describe "when build is triggered with package.json file", ->
    it "should show the build window if it is node engine", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(pkgjsonfile, fs.readFileSync(goodNodefile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('success')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /^Executing: npm/
        fs.unlinkSync pkgjsonfile

    it "should show the build window if it is atom engine", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(pkgjsonfile, fs.readFileSync(goodAtomfile))
      atom.workspaceView.trigger 'build:trigger'

      waitsFor (-> atom.workspaceView.find('.build .title').hasClass('success')),
        "build to be successful", 10000

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /^Executing: apm/

  describe "when multiple build options are available", ->
    it "should prioritise grunt over make", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(gruntfile, fs.readFileSync(goodGruntfile));
      fs.writeFileSync(makefile, fs.readFileSync(goodMakefile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('success')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /Running "default" task/

    it "should prioritise node over grunt", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(gruntfile, fs.readFileSync(goodGruntfile));
      fs.writeFileSync(pkgjsonfile, fs.readFileSync(goodNodefile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor ->
        atom.workspaceView.find('.build .title').hasClass('success')

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /^Executing: npm/

    it "should prioritise atom over grunt", ->
      expect(atom.workspaceView.find('.build')).not.toExist()

      fs.writeFileSync(gruntfile, fs.readFileSync(goodGruntfile));
      fs.writeFileSync(pkgjsonfile, fs.readFileSync(goodAtomfile));
      atom.workspaceView.trigger 'build:trigger'

      waitsFor (-> atom.workspaceView.find('.build .title').hasClass('success')),
        "build to be successful", 10000

      runs ->
        expect(atom.workspaceView.find('.build')).toExist()
        expect(atom.workspaceView.find('.build .output').text()).toMatch /^Executing: apm/
