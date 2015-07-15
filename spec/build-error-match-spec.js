var fs = require('fs-extra');
var temp = require('temp');

describe('Error Match', function() {
  'use strict';

  var errorMatchAtomBuildFile = __dirname + '/fixture/.atom-build.error-match.json';
  var errorMatchNoFileBuildFile = __dirname + '/fixture/.atom-build.error-match-no-file.json';
  var errorMatchNLCAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-no-line-col.json';
  var errorMatchMultiAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple.json';
  var errorMatchMultiFirstAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple-first.json';

  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.scrollOnError', false);
    atom.notifications.clear();

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(function() {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(function() {
      return atom.packages.activatePackage('build');
    });
  });

  afterEach(function() {
    fs.removeSync(directory);
  });

  describe('when output is captured to show editor on error', function () {
    it('should place the line and column on error in correct file', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should give an error if matched file does not exist', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNoFileBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.notifications.getNotifications().length > 0;
      });

      runs(function() {
        var notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Error matching failed!');
      });
    });

    it('should open just the file if line and column is not available', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNLCAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        expect(editor.getTitle()).toEqual('.atom-build.json');
      });
    });

    it('should cycle through the file if multiple error occurred', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(4);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should jump to first error', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiFirstAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(4);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(function() {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should open the the file even if tool gives absolute path', function () {
      var atomBuild = {
        cmd: 'echo __' + directory + '.atom-build.json__ && return 1',
        errorMatch: '__(?<file>.+)__'
      };
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify(atomBuild));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        return atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(function () {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        expect(editor.getPath()).toEqual(directory + '.atom-build.json');
      });
    });

    it('should auto match error on failed build when config is set', function () {
      atom.config.set('build.scrollOnError', true);

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      waitsFor(function () {
        return atom.workspace.getActiveTextEditor();
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        var bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should show an error if regex is invalid', function () {

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'return 1',
        errorMatch: '(invalidRegex'
      }));

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        expect(atom.notifications.getNotifications().length).toEqual(1);

        var notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Error matching failed!');
        expect(notification.options.detail).toMatch(/Unterminated group/);
      });
    });
  });
});
