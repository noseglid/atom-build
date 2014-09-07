{WorkspaceView} = require 'atom';

describe "Visible", ->

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    atom.config.set('build.arguments', '')
    atom.config.set('build.environment', '')
    atom.config.set('build.keepVisible', true)
    waitsForPromise ->
      atom.packages.activatePackage('build')

  describe "when package is activated", ->
    it "should show build window", ->
      expect(atom.workspaceView.find('.build')).toExist()
