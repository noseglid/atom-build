
describe('Build', function() {
  'use strict';

  var workspaceElement = null;

  beforeEach(function() {
    atom.config.set('build.panelVisibility', 'Keep Visible');

    runs(function() {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(function() {
      return atom.packages.activatePackage('build');
    });
  });

  describe('when package is activated', function() {
    it('should show build window', function() {
      expect(workspaceElement.querySelector('.build')).toExist();
    });
  });

  describe('when build window is toggled and it is visible', function() {
    it('should hide the build window', function() {
      expect(workspaceElement.querySelector('.build')).toExist();

      atom.commands.dispatch(workspaceElement, 'build:toggle-view');

      expect(workspaceElement.querySelector('.build')).not.toExist();
    });
  });
});
