
describe('Build', function() {
  'use strict';

  var workspaceElement = null;

  beforeEach(function() {
    atom.config.set('build.keepVisible', true);

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
});
