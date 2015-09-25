'use babel';
'use strict';

var fs = require('fs-extra');
var temp = require('temp');
var specHelpers = require('atom-build-spec-helpers');

describe('Visible', function() {

  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.stealFocus', true);
    atom.notifications.clear();

    workspaceElement = atom.views.getView(atom.workspace);
    jasmine.attachToDOM(workspaceElement);
    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(function() {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(function() {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then(function (dir) {
        return specHelpers.vouch(fs.realpath, dir);
      }).then(function (dir) {
        directory = dir + '/';
        atom.project.setPaths([ directory ]);
      });
    });
  });

  afterEach(function () {
    fs.removeSync(directory);
  });

  describe('when package is activated with panel visibility set to Keep Visible', function() {
    beforeEach(function () {
      atom.config.set('build.panelVisibility', 'Keep Visible');
      waitsForPromise(function () {
        return atom.packages.activatePackage('build');
      });
    });

    it('should not show build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();
    });
  });

  describe('when package is activated with panel visibility set to Toggle', function () {
    beforeEach(function () {
      atom.config.set('build.panelVisibility', 'Toggle');
      waitsForPromise(function () {
        return atom.packages.activatePackage('build');
      });
    });

    describe('when build panel is toggled and it is visible', function() {
      beforeEach(function () {
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      it('should hide the build panel', function() {
        expect(workspaceElement.querySelector('.build')).toExist();

        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });

    describe('when panel visibility is set to Show on Error', function() {
      it('should only show the build panel if a build fails', function () {
        atom.config.set('build.panelVisibility', 'Show on Error');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));
        atom.commands.dispatch(workspaceElement, 'build:trigger');

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(function() {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });

        runs(function () {
          fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
            cmd: 'echo "Very bad..." && exit 2'
          }));
        });

        // .atom-build.json is updated asynchronously... give it some time
        waits(200);

        runs(function () {
          atom.commands.dispatch(workspaceElement, 'build:trigger');
        });

        waitsFor(function() {
          return workspaceElement.querySelector('.build');
        });

        runs(function() {
          expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Very bad\.\.\./);
        });
      });
    });

    describe('when panel visibility is set to Hidden', function() {
      it('should not show the build panel if build succeeeds', function () {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));
        atom.commands.dispatch(workspaceElement, 'build:trigger');

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(function() {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should not show the build panel if build fails', function () {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo "Very bad..." && exit 2'
        }));
        atom.commands.dispatch(workspaceElement, 'build:trigger');

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(function() {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should show the build panel if it is toggled',  function () {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));
        atom.commands.dispatch(workspaceElement, 'build:trigger');

        waits(200); // Let build finish. Since UI component is not visible yet, there's nothing to poll.

        runs(function () {
          atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
        });

        waitsFor(function() {
          return workspaceElement.querySelector('.build .title') &&
            workspaceElement.querySelector('.build .title').classList.contains('success');
        });

        runs(function() {
          expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
        });
      });
    });
  });
});
