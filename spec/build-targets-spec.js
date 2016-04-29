'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import path from 'path';
import specHelpers from 'atom-build-spec-helpers';
import os from 'os';

describe('Target', () => {
  const originalHomedirFn = os.homedir;
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.notificationOnRefresh', true);
    atom.config.set('build.refreshOnShowTargetList', true);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    workspaceElement = atom.views.getView(atom.workspace);
    workspaceElement.setAttribute('style', 'width:9999px');
    jasmine.attachToDOM(workspaceElement);

    waitsForPromise(() => {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then((dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then((dir) => {
        directory = dir + '/';
        atom.project.setPaths([ directory ]);
        return specHelpers.vouch(temp.mkdir, 'atom-build-spec-home');
      }).then( (dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then( (dir) => {
        os.homedir = () => dir;
        return atom.packages.activatePackage('build');
      });
    });
  });

  afterEach(() => {
    os.homedir = originalHomedirFn;
    fs.removeSync(directory);
  });

  describe('when multiple targets exists', () => {
    it('should list those targets in a SelectListView (from .atom-build.json)', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:select-active-target');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.select-list li.build-target');
      });

      runs(() => {
        const targets = [ ...workspaceElement.querySelectorAll('.select-list li.build-target') ].map(el => el.textContent);
        expect(targets).toEqual([ 'Custom: The default build', 'Custom: Some customized build' ]);
      });
    });

    it('should mark the first target as active', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
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
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
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
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/default/);
      });
    });

    it('should run the default target if no selection has been made', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/default/);
      });
    });

    it('run the selected target if selection has changed, and subsequent build should run that target', () => {
      waitsForPromise(() => {
        const file = __dirname + '/fixture/.atom-build.targets.json';
        return specHelpers.vouch(fs.copy, file, directory + '/.atom-build.json');
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
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/customized/);
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
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/customized/);
      });
    });

    it('should show a warning if current file is not part of an open Atom project', () => {
      waitsForPromise(() => atom.workspace.open(path.join('..', 'randomFile')));
      waitsForPromise(() => specHelpers.refreshAwaitTargets());
      runs(() => atom.commands.dispatch(workspaceElement, 'build:select-active-target'));
      waitsFor(() => atom.notifications.getNotifications().find(n => n.message === 'Unable to build.'));
      runs(() => {
        const not = atom.notifications.getNotifications().find(n => n.message === 'Unable to build.');
        expect(not.type).toBe('warning');
      });
    });
  });
});
