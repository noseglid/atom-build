'use babel';
'use strict';

var _ = require('lodash');
var fs = require('fs-extra');
var temp = require('temp');
var specHelpers = require('./spec-helpers');

describe('Build', function() {
  var goodGruntfile = __dirname + '/fixture/Gruntfile.js';
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

    waitsForPromise(function() {
      return specHelpers.vouch(temp.mkdir, 'atom-build-spec-').then(function (dir) {
        return specHelpers.vouch(fs.realpath, dir);
      }).then(function (dir) {
        directory = dir + '/';
        atom.project.setPaths([ directory ]);
        return atom.packages.activatePackage('build');
      });
    });
  });

  afterEach(function() {
    fs.removeSync(directory);
  });

  describe('when package is activated', function() {
    it('should not show build window if panelVisibility is Toggle ', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();
    });
  });

  describe('when building', function () {
    it('should show build failed if build fails', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Very bad... && exit 1'
      }));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Very bad\.\.\./);
      });
    });

    it('should cancel build when stopping it, and remove when stopping again', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo "Building, this will take some time..." && sleep 30 && echo "Done!"'
      }));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      // Let build run for one second before we terminate it
      waits(1000);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Building, this will take some time.../);
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(function() {
        return (workspaceElement.querySelector('.build .title .title-text').textContent == 'Aborted!');
      });
    });

    it('should not show the build panel if no build file exists', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      /* Give it some time here. There's nothing to probe for as we expect the exact same state when done. */
      waits(200);

      runs(function() {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });
  });

  describe('when build is triggered twice', function() {
    it('should not leave multiple panels behind', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo hello world'
      }));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      /* Give it some time here. There's nothing to probe for as we expect the exact same state when done. */
      waits(200);

      runs(function() {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
      });
    });
  });

  describe('when build is triggered with grunt file', function() {
    it('should show the build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      waitsForPromise(function () {
        return Promise.resolve()
          .then(specHelpers.setupNodeModules(directory))
          .then(specHelpers.setupGrunt(directory));
      });

      runs(function () {
        fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time. But not so, as the time of passing/);
      });
    });

    it('should run default target if grunt is not installed', function () {
      fs.writeFileSync(directory + 'Gruntfile.js', fs.readFileSync(goodGruntfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/^Executing: grunt/);
      });
    });
  });

  describe('when build is triggered with package.json file', function() {
    it('should show the build window if it is node engine', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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

    it('should list scripts as build targets', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodNodefile));
      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(function () {
        var targets = _.map(workspaceElement.querySelectorAll('.select-list li.build-target'), function (el) {
          return el.textContent;
        });
        expect(targets).toEqual([ 'npm: default', 'npm: custom script' ]);
      });
    });

    it('should list package.json files with engine atom scripts as run by NPM', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + 'package.json', fs.readFileSync(goodAtomfile));
      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(function () {
        var targets = _.map(workspaceElement.querySelectorAll('.select-list li.build-target'), function (el) {
          return el.textContent;
        });
        expect(targets).toEqual([ 'apm: default', 'npm: custom script' ]);
      });
    });
  });

  describe('when custom .atom-build.json is available', function() {
    it('should show the build window', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
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
        return atom.notifications.getNotifications().length > 0;
      });

      runs(function() {
        var notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Invalid build file.');
        expect(notification.options.detail).toMatch(/Unexpected token t/);
      });
    });

    it('should not cache the contents of the build file', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo first'
      }));

      atom.commands.dispatch(workspaceElement, 'build:trigger');
      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/first/);
      });

      waitsFor(function () {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(function () {
        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo second'
        }));
      });

      waits(100);

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/second/);
      });
    });
  });

  describe('when replacements are specified in the atom-build.json file', function() {
    it('should replace those with their dynamic value', function() {

      expect(workspaceElement.querySelector('.build')).not.toExist();

      process.env.FROM_PROCESS_ENV = '{FILE_ACTIVE}';
      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(replaceAtomBuildFile));

      waitsForPromise(function() {
        return atom.workspace.open('.atom-build.json');
      });

      runs(function() {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        var output = workspaceElement.querySelector('.build .output').textContent;

        expect(output.indexOf('PROJECT_PATH=' + directory.substring(0, -1))).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FROM_ENV=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FROM_PROCESS_ENV=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME=.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME_BASE=.atom-build')).not.toBe(-1);
      });
    });
  });

  describe('when the text editor is saved', function() {
    it('should build when buildOnSave is true', function() {
      atom.config.set('build.buildOnSave', true);

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(function() {
        return atom.workspace.open('dummy');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.save();
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
      });
    });

    it('should not build when buildOnSave is false', function() {
      atom.config.set('build.buildOnSave', false);

      fs.writeFileSync(directory + '.atom-build.json', {
        cmd: 'echo "hello, world"'
      });

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

    it('should not attempt to build if buildOnSave is true and no build tool exists', function () {
      atom.config.set('build.buildOnSave', true);

      waitsForPromise(function() {
        return atom.workspace.open('dummy');
      });

      runs(function() {
        var editor = atom.workspace.getActiveTextEditor();
        editor.save();
      });

      waits(200);

      runs(function() {
        expect(atom.notifications.getNotifications().length).toEqual(0);
      });
    });
  });

  describe('when multiple project roots are open', function () {
    it('should run the second root if a file there is active', function () {
      var directory2 = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
      atom.project.addPath(directory2);
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory2 + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      waitsForPromise(function () {
        return atom.workspace.open(directory2 + '/main.c');
      });

      runs(function() {
        atom.workspace.getActiveTextEditor().save();
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function() {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function() {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/"cmd": "dd"/);
      });
    });
  });

  describe('when build panel is toggled and it is not visible', function() {
    it('should show the build panel', function() {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

      expect(workspaceElement.querySelector('.build')).toExist();
    });
  });

  describe('when build is triggered, focus should adhere the stealFocus config', function () {
    it('should focus the build panel if stealFocus is true', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build');
      });

      runs(function() {
        expect(document.activeElement).toHaveClass('build');
      });
    });

    it('should leave focus untouched if stealFocus is false', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.config.set('build.stealFocus', false);
      var activeElement = document.activeElement;

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return workspaceElement.querySelector('.build');
      });

      runs(function() {
        expect(document.activeElement).toEqual(activeElement);
        expect(document.activeElement).not.toHaveClass('build');
      });
    });
  });

  describe('when no build tools are available', function () {
    it('should show a warning', function () {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(function() {
        return atom.notifications.getNotifications().length > 0;
      });

      runs(function() {
        var notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('warning');
        expect(notification.getMessage()).toEqual('No eligible build tool.');
      });
    });
  });
});
