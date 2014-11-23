var WorkspaceView = require('atom').WorkspaceView;
var fs = require('fs-plus');
var path = require('path');
var temp = require('temp');

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

  var directory = null;

  temp.track();

  beforeEach(function() {
    atom.workspaceView = new WorkspaceView();
    atom.workspace = atom.workspaceView.model;

    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

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

    waitsForPromise(function() {
      return atom.packages.activatePackage('build');
    });

    runs(function() {
      atom.workspaceView.attachToDom();
    });
  });

  afterEach(function() {
    fs.removeSync(directory);
  });

  describe('when package is activated', function() {
    it('should not show build window if keepVisible is false', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();
    });
  });

  describe('when build is triggered with Makefile', function() {
    it('should not show the build window if no buildfile exists', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      atom.workspaceView.trigger('build:trigger');

      waitsForPromise(function() {
        return atom.workspaceView.open();
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).not.toExist();
      });
    });

    it('should show the build window if buildfile exists', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });

    it('should show build failed if build fails', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(badMakefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('error');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Very bad\.\.\./);
      });
    });

    it('should cancel build when stopping it, and remove when stopping again', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(longMakefile));
      atom.workspaceView.trigger('build:trigger');

      // Let build run for one second before we terminate it
      waits(1000);

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Building, this will take some time.../);
        atom.workspaceView.trigger('build:stop');
      });

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('error');
      });

      runs(function() {
        atom.workspaceView.trigger('build:stop');
      });

      waitsFor(function() {
        return (atom.workspaceView.find('.build .title').text() == 'Aborted!');
      });
    });
  });

  describe('when build is triggered with grunt file', function() {
    it('should show the build window', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Surprising is the passing of time. But not so, as the time of passing/);
      });
    });
  });

  describe('when build is triggered with package.json file', function() {
    it('should show the build window if it is node engine', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/^Executing with sh: npm/);
      });
    });

    it('should show the build window if it is atom engine', function() {
      if (process.env.TRAVIS) {
        return;
      }

      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodAtomfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      }, 'build to be successful', 10000);

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/^Executing with sh: apm/);
      });
    });

    it('should not do anything if engines are not available in the file', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(badPackageJsonfile));
      atom.workspaceView.trigger('build:trigger');

      waits(1000);

      runs(function() {
        expect(atom.workspaceView.find('.build')).not.toExist();
      });
    });
  });

  describe('when custom .atom-build.json is available', function() {
    it('should show the build window', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/"cmd": "dd"/);
      });
    });

    it('should be possible to exec shell commands with wildcard expansion', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shellAtomBuildfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Good news, everyone!/);
      });
    });

    it('should show sh message if sh is true', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shTrueAtomBuildFile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Executing with sh:/);
      });
    });

    it('should not show sh message if sh is false', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shFalseAtomBuildFile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Executing:/);
      });
    });

    it('should show sh message if sh is unspecified', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shDefaultAtomBuildFile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Executing with sh:/);
      });
    });

    it('should show graphical error message if build-file contains syntax errors', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(syntaxErrorAtomBuildFile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('error');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Unexpected token t/);
        expect(atom.workspaceView.find('.build .title').text()).toBe('You have a syntax error in your build file.');
      });
    });
  });

  describe('when build is triggered with gulp file', function() {
    it('should show the build window', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'gulpfile.js', fs.readFileSync(goodGulpfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/gulp built/);
      });
    });
  });

  describe('when multiple build options are available', function() {
    it('should prioritise .atom-build.json over node', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/"cmd": "dd"/);
      });
    });

    it('should prioritise grunt over make', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Running "default" task/);
      });
    });

    it('should prioritise node over grunt', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/^Executing with sh: npm/);
      });
    });

    it('should prioritise atom over grunt', function() {
      if (process.env.TRAVIS) {
        return;
      }
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodAtomfile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      }, 'build to be successful', 10000);

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/^Executing with sh: apm/);
      });
    });
  });

  describe('when package.json exists, but without engines and Makefile is present', function() {
    it('(Issue#3) should run Makefile without any npm arguments', function() {
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(badPackageJsonfile));
      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').text()).toMatch(/Surprising is the passing of time\nbut not so, as the time of passing/);
      });
    });
  });

  describe('when replacements are specified in the atom-build.json file', function() {
    it('should replace those with their dynamic value', function() {

      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(replaceAtomBuildFile));

      waitsForPromise(function() {
        return atom.workspace.open('.atom-build.json');
      });

      runs(function() {
        atom.workspaceView.trigger('build:trigger');
      });

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        var output = atom.workspaceView.find('.build .output').text();

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
      expect(atom.workspaceView.find('.build')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(escapeMakefile));
      atom.workspaceView.trigger('build:trigger');

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').html()).toMatch(/&lt;script type="text\/javascript"&gt;alert\('XSS!'\)&lt;\/script&gt;/);
      });
    });
  });

  describe('when the text editor is modified', function() {
    it('should show the save confirmation', function() {
      expect(atom.workspaceView.find('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        editor.insertText('hello kansas');
        atom.workspaceView.trigger('build:trigger');
      });

      waitsFor(function() {
        return (atom.workspaceView.find('.build-confirm').length == 1);
      });

      runs(function() {
        expect(atom.workspaceView.find('.btn-success:focus')).toExist();
      });
    });

    it('should save and build when selecting save and build', function() {
      expect(atom.workspaceView.find('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        editor.insertText('dummy:\n\techo kansas\n');
        atom.workspaceView.trigger('build:trigger');
      });

      waitsFor(function() {
        return (atom.workspaceView.find('.build-confirm').length == 1);
      });

      runs(function() {
        atom.workspaceView.find(':focus').click();
      });

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').html()).toMatch(/kansas/);
        expect(!editor.isModified());
      });
    });

    it('should build but not save when opting so', function() {
      expect(atom.workspaceView.find('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        editor.insertText('dummy:\n\techo kansas\n');
        atom.workspaceView.trigger('build:trigger');
      });

      waitsFor(function() {
        return (atom.workspaceView.find('.build-confirm').length == 1);
      });

      runs(function() {
        atom.workspaceView.find('button[click="confirmWithoutSave"]').click();
      });

      waitsFor(function() {
        return atom.workspaceView.find('.build .title').hasClass('success');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        expect(atom.workspaceView.find('.build')).toExist();
        expect(atom.workspaceView.find('.build .output').html()).not.toMatch(/kansas/);
        expect(editor.isModified());
      });
    });

    it('should do nothing when cancelling', function() {
      expect(atom.workspaceView.find('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'Makefile', fs.readFileSync(goodMakefile));

      waitsForPromise(function() {
        return atom.workspace.open('Makefile');
      });

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        editor.insertText('dummy:\n\techo kansas\n');
        atom.workspaceView.trigger('build:trigger');
      });

      waitsFor(function() {
        return (atom.workspaceView.find('.build-confirm').length == 1);
      });

      runs(function() {
        atom.workspaceView.find('button[click="cancel"]').click();
      });

      waits(2);

      runs(function() {
        var editor = atom.workspaceView.getActiveView().editor;
        expect(atom.workspaceView.find('.build')).not.toExist();
        expect(editor.isModified());
      });
    });
  });
});
