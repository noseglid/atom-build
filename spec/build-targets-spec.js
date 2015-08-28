'use babel';
'use strict';

var _ = require('lodash');
var fs = require('fs-extra');
var temp = require('temp');
var specHelpers = require('./spec-helpers');

describe('Target', function() {
  var directory = null;
  var workspaceElement = null;

  temp.track();

  beforeEach(function() {
    workspaceElement = atom.views.getView(atom.workspace);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');
    jasmine.attachToDOM(workspaceElement);

    waitsForPromise(function() {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then(function (dir) {
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

  describe('when multiple targets exists', function () {

    it('should list those targets in a SelectListView (from .atom-build.json)', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

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
        expect(targets).toEqual([ 'Custom: The default build', 'Custom: Some customized build' ]);
      });
    });

    it('should list those targets in a SelectListView (from Gruntfile.js)', function () {
      waitsForPromise(function () {
        return Promise.resolve()
          .then(function () {
            return specHelpers.vouch(fs.copy, __dirname + '/fixture/Gruntfile.js', directory + '/Gruntfile.js');
          })
          .then(specHelpers.setupNodeModules(directory))
          .then(specHelpers.setupGrunt(directory));
      });

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
        expect(targets).toEqual([ 'Grunt: default', 'Grunt: dev task', 'Grunt: other task', ]);
      });
    });

    it('should mark the first target as active', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(function () {
        var el = workspaceElement.querySelector('.select-list li.build-target'); // querySelector selects the first element
        expect(el).toHaveClass('selected');
        expect(el).toHaveClass('active');
      });
    });

    it('should run the selected build', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:confirm');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
      });
    });

    it('should run the default target if no selection has been made', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
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
      });
    });

    it('run the selected target if selection has changed, and subsequent build should run that target', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:move-down');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.select-list li.selected').textContent === 'Custom: Some customized build';
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:confirm');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/customized/);
        atom.commands.dispatch(workspaceElement.querySelector('.build'), 'build:stop');
      });

      waitsFor(function () {
        return !workspaceElement.querySelector('.build');
      });

      runs(function () {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(function () {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(function () {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/customized/);
      });
    });
  });

  describe('when a tool is unable to extract targets', function () {
    it('should still list the default target for Grunt', function () {
      waitsForPromise(function () {
        var file = __dirname + '/fixture/Gruntfile.js';
        return specHelpers.vouch(fs.copy, file, directory + '/Gruntfile.js');
      });

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
        expect(targets).toEqual([ 'Grunt: default' ]);
      });
    });
  });
});
