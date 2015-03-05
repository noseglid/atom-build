var fs = require('fs-plus');
var path = require('path');
var temp = require('temp');
var _ = require('lodash');

describe('Build', function() {
  'use strict';

  var goodMakefile = __dirname + '/fixture/Makefile.good';
  var badMakefile = __dirname + '/fixture/Makefile.bad';
  var longMakefile = __dirname + '/fixture/Makefile.long';
  var escapeMakefile = __dirname + '/fixture/Makefile.escape';
  var goodGruntfile = __dirname + '/fixture/Gruntfile.js';
  var goodGulpfile = __dirname + '/fixture/gulpfile.js';
  var goodNodefile = __dirname + '/fixture/package.json.node';
  var goodAtomfile = __dirname + '/fixture/package.json.atom';
  var badPackageJsonfile = __dirname + '/fixture/package.json.noengine';
  var goodAtomBuildfile = __dirname + '/fixture/.atom-build.json';
  var shellAtomBuildfile = __dirname + '/fixture/.atom-build.shell.json';
  var replaceAtomBuildFile = __dirname + '/fixture/.atom-build.replace.json';
  var shFalseAtomBuildFile = __dirname + '/fixture/.atom-build.sh-false.json';
  var shTrueAtomBuildFile = __dirname + '/fixture/.atom-build.sh-true.json';
  var shDefaultAtomBuildFile = __dirname + '/fixture/.atom-build.sh-default.json';
  var syntaxErrorAtomBuildFile = __dirname + '/fixture/.atom-build.syntax-error.json';
  var errorMatchAtomBuildFile = __dirname + '/fixture/.atom-build.error-match.json';
  var errorMatchNLCAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-no-line-col.json';

  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.keepVisible', false);
    atom.config.set('build.saveOnBuild', false);

    // Set up dependencies
    fs.copySync(path.join(__dirname, 'fixture', 'node_modules'), path.join(directory, 'node_modules'));

    // Set up grunt
    var binGrunt = path.join(directory, 'node_modules', '.bin', 'grunt');
    var realGrunt = path.join(directory, 'node_modules', 'grunt-cli', 'bin', 'grunt');
    fs.unlinkSync(binGrunt);
    fs.chmodSync(realGrunt, parseInt('0700', 8));
    fs.symlinkSync(realGrunt, binGrunt);

    // Set up gulp
    var binGulp = path.join(directory, 'node_modules', '.bin', 'gulp');
    var realGulp = path.join(directory, 'node_modules', 'gulp', 'bin', 'gulp.js');
    fs.unlinkSync(binGulp);
    fs.chmodSync(realGulp, parseInt('0700', 8));
    fs.symlinkSync(realGulp, binGulp);

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

  describe('when package is activated', function() {
    it('should not show build window if keepVisible is false', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();
    });
  });

  describe('when build is triggered twice', function() {
    it('should not leave multiple panels behind', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.config.set('build.keepVisible', true);

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
      });
    });
  });

  describe('when build is triggered with Makefile', function() {
    it('should not show the build window if no buildfile exists', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      runs(function() {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });

    it('should show the build window if buildfile exists', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });

    it('should show build failed if build fails', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(badMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Very bad\.\.\./);
      });
    });

    it('should cancel build when stopping it, and remove when stopping again', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(longMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      // Let build run for one second before we terminate it
      waits(1000);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Building, this will take some time.../);
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(function() {
        return (workspaceElement.querySelector('.build .title').textContent == 'Aborted!');
      });
    });
  });

  describe('when build is triggered with grunt file', function() {
    it('should show the build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time. But not so, as the time of passing/);
      });
    });
  });

  describe('when build is triggered with package.json file', function() {
    it('should show the build window if it is node engine', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/^Executing: npm/);
      });
    });

    it('should show the build window if it is atom engine', function() {
      if (process.env.TRAVIS) {
        return;
      }

      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodAtomfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      }, 'build to be successful', 10000);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/^Executing: apm/);
      });
    });

    it('should not do anything if engines are not available in the file', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(badPackageJsonfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waits(1000);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });
  });

  describe('when custom .atom-build.json is available', function() {
    it('should show the build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/"cmd": "dd"/);
      });
    });

    it('should be possible to exec shell commands with wildcard expansion', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shellAtomBuildfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Good news, everyone!/);
      });
    });

    it('should show sh message if sh is true', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shTrueAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Executing with sh:/);
      });
    });

    it('should not show sh message if sh is false', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shFalseAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Executing:/);
      });
    });

    it('should show sh message if sh is unspecified', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shDefaultAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Executing with sh:/);
      });
    });

    it('should show graphical error message if build-file contains syntax errors', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(syntaxErrorAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Unexpected token t/);
        expect(workspaceElement.querySelector('.build .title').textContent).toBe('You have a syntax error in your build file.');
      });
    });
  });

  describe('when build is triggered with gulp file', function() {
    it('should show the build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'gulpfile.js', fs.readFileSync(goodGulpfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/gulp built/);
      });
    });
  });

  describe('when multiple build options are available', function() {
    it('should prioritise .atom-build.json over node', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/"cmd": "dd"/);
      });
    });

    it('should prioritise grunt over make', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Running "default" task/);
      });
    });

    it('should prioritise node over grunt', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/^Executing: npm/);
      });
    });

    it('should prioritise atom over grunt', function() {
      if (process.env.TRAVIS) {
        return;
      }
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodAtomfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      }, 'build to be successful', 10000);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/^Executing: apm/);
      });
    });
  });

  describe('when package.json exists, but without engines and Makefile is present', function() {
    it('(Issue#3) should run Makefile without any npm arguments', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(badPackageJsonfile));
      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });
  });

  describe('when replacements are specified in the atom-build.json file', function() {
    it('should replace those with their dynamic value', function() {

      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(replaceAtomBuildFile));

      waitsForPromise(function() {
        return atom.workspace.open('.atom-build.json');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        var output = workspaceElement.querySelector('.build .output').textContent;

        expect(output.indexOf('PROJECT_PATH=' + directory.substring(0, -1))).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FROM_ENV=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME=.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME_BASE=.atom-build')).not.toBe(-1);
      });
    });
  });

  describe('when output from build contains HTML characters', function() {
    it('should escape those properly so the output is not garbled or missing', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(escapeMakefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).toMatch(/&lt;script type="text\/javascript"&gt;alert\('XSS!'\)&lt;\/script&gt;/);
      });
    });
  });

  describe('when the text editor is modified', function() {
    it('should show the save confirmation', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.insertText('hello kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector(':focus');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.btn-success:focus')).toExist();
      });
    });

    it('should cancel the confirm window when pressing escape', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.insertText('hello kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector(':focus');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:no-confirm');
        expect(workspaceElement.querySelector('.btn-success:focus')).not.toExist();
      });
    });

    it('should not confirm if a TextEditor edits an unsaved file', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      waitsForPromise(function() {
        return atom.workspace.open();
      });

      runs(function() {
        var editor = _.find(atom.workspace.getTextEditors(), function(textEditor) {
          return ('untitled' === textEditor.getTitle());
        });
        editor.insertText('Just some temporary place to write stuff');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });

    it('should save and build when selecting save and build', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.insertText('dummy:\n\techo kansas\n');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector(':focus');
      });

      runs(function() {
        workspaceElement.querySelector(':focus').click();
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).toMatch(/kansas/);
        expect(!editor.isModified());
      });
    });

    it('should build but not save when opting so', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.insertText('dummy:\n\techo kansas\n');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector(':focus');
      });

      runs(function() {
        workspaceElement.querySelector('button[click="confirmWithoutSave"]').click();
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).not.toMatch(/kansas/);
        expect(editor.isModified());
      });
    });

    it('should do nothing when cancelling', function() {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.insertText('dummy:\n\techo kansas\n');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector(':focus');
      });

      runs(function() {
        workspaceElement.querySelector('button[click="cancel"]').click();
      });

      waits(2);

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).not.toExist();
        expect(editor.isModified());
      });
    });
  });

  describe('when the text editor is saved', function() {
    it('should build when buildOnSave is true', function() {
      atom.config.set('build.buildOnSave', true);

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('dummy');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.save();
      });

      waitsFor(function() {
        expect(workspaceElement.querySelector('.build ')).toExist();
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });

    it('should not build when buildOnSave is false', function() {
      atom.config.set('build.buildOnSave', false);

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('dummy');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.save();
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });
  });

  describe('when output is captured to show editor on error', function () {
    it('should place the line and column on error in correct file', function () {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('error');
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

    it('should open just the file if line and column is not available', function () {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNLCAtomBuildFile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('error');
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
  });
});
