var fs = require('fs-plus');
var temp = require('temp');

describe('Build', function() {
  'use strict';

  var goodMakefile = __dirname + '/fixture/Makefile.good';

  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

    atom.config.set('build.autoBuildOnSave', true);

    runs(function() {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(function() {
      return atom.packages.activatePackage('build');
    });
  });

  describe('when file is saved', function() {
    it('should build', function() {
      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('dummy');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.save();
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });
  });
});
