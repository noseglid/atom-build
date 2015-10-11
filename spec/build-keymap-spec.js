'use babel';
'use strict';

var fs = require('fs-extra');
var temp = require('temp');
var specHelpers = require('atom-build-spec-helpers');

describe('Keymap', function() {
  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);

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

  describe('when custom keymap is defined in .atom-build.json', function () {
    it('should trigger the build when that key combination is pressed', function () {

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        targets: {
          'keymapped build': {
            cmd: 'echo keymapped',
            keymap: 'ctrl-alt-k'
          }
        }
      }));

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      waitsFor(function() {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(function () {
        specHelpers.keydown('k', { ctrl: true, alt: true, element: workspaceElement });
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/keymapped/);
      });
    });

    it('should not changed the set active build', function () {

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        targets: {
          'keymapped build': {
            cmd: 'echo keymapped',
            keymap: 'ctrl-alt-k'
          }
        }
      }));

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      waitsFor(function() {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(function () {
        specHelpers.keydown('k', { ctrl: true, alt: true, element: workspaceElement });
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/keymapped/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      waitsFor(function() {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });
    });

    it('should dispose keymap when reloading targets', function () {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        targets: {
          'keymapped build': {
            cmd: 'echo keymapped',
            keymap: 'ctrl-alt-k'
          }
        }
      }));

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      waitsFor(function() {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(function () {
        specHelpers.keydown('k', { ctrl: true, alt: true, element: workspaceElement });
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/keymapped/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          name: 'The default build',
          cmd: 'echo default',
          targets: {
            'keymapped build': {
              cmd: 'echo ctrl-x new file',
              keymap: 'ctrl-x'
            }
          }
        }));
      });

      waits(300); // .atom-build.json is reloaded automatically

      runs(function () {
        specHelpers.keydown('k', { ctrl: true, alt: true, element: workspaceElement });
      });

      waits(300);

      runs(function () {
        expect(workspaceElement.querySelector('.build')).not.toExist();
        specHelpers.keydown('x', { ctrl: true, element: workspaceElement });
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
            workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/ctrl-x new file/);
      });
    });
  });
});
