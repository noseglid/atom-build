var WorkspaceView = require('atom').WorkspaceView;

describe('Build', function() {
  'use strict';

  beforeEach(function() {
    atom.workspaceView = new WorkspaceView();
    atom.config.set('build.keepVisible', true);

    waitsForPromise(function() {
      return atom.packages.activatePackage('build');
    });

    runs(function() {
      atom.workspaceView.attachToDom();
    });
  });

  describe('when package is activated', function() {
    it('should show build window', function() {
      expect(atom.workspaceView.find('.build')).toExist();
    });
  });
});
