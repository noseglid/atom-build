'use babel';

import _ from 'lodash';
import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Target', () => {
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.notificationOnRefresh', true);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');
    jasmine.attachToDOM(workspaceElement);

    waitsForPromise(() => {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then((dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then((dir) => {
        directory = dir + '/';
        atom.project.setPaths([ directory ]);
        return atom.packages.activatePackage('build');
      });
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when multiple targets exists', () => {
    it('should list those targets in a SelectListView (from .atom-build.json)', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json')
          .then(() => specHelpers.refreshAwaitTargets());
      });

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(() => {
        const targets = _.map(workspaceElement.querySelectorAll('.select-list li.build-target'), el => el.textContent);
        expect(targets).toEqual([ 'Custom: The default build', 'Custom: Some customized build' ]);
      });
    });

    it('should mark the first target as active', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json')
          .then(() => specHelpers.refreshAwaitTargets());
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(() => {
        const el = workspaceElement.querySelector('.select-list li.build-target'); // querySelector selects the first element
        expect(el).toHaveClass('selected');
        expect(el).toHaveClass('active');
      });
    });

    it('should run the selected build', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json')
          .then(() => specHelpers.refreshAwaitTargets());
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:confirm');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
      });
    });

    it('should run the default target if no selection has been made', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json')
          .then(() => specHelpers.refreshAwaitTargets());
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
      });
    });

    it('run the selected target if selection has changed, and subsequent build should run that target', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json')
          .then(() => specHelpers.refreshAwaitTargets());
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:move-down');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.selected').textContent === 'Custom: Some customized build';
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement.querySelector('.select-list'), 'core:confirm');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/customized/);
        atom.commands.dispatch(workspaceElement.querySelector('.build'), 'build:stop');
      });

      waitsFor(() => {
        return !workspaceElement.querySelector('.build');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/customized/);
      });
    });
  });
});
