'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import os from 'os';
import { sleep } from './helpers';

describe('BuildView', () => {
  const originalHomedirFn = os.homedir;
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.stealFocus', true);
    atom.config.set('build.notificationOnRefresh', true);
    atom.config.set('editor.fontSize', 14);
    atom.notifications.clear();

    workspaceElement = atom.views.getView(atom.workspace);
    workspaceElement.setAttribute('style', 'width:9999px');
    jasmine.attachToDOM(workspaceElement);
    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(() => {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then( (dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then( (dir) => {
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
    try { fs.removeSync(directory); } catch (e) { console.warn('Failed to clean up: ', e); }
  });

  describe('when output from build command should be viewed', () => {
    it('should output data even if no line break exists', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'node',
        args: [ '-e', 'process.stdout.write(\'data without linebreak\');' ],
        sh: false
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/data without linebreak/);
      });
    });

    it('should escape HTML chars so the output is not garbled or missing', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo "<tag>"'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/<tag>/);
      });
    });
  });

  describe('when a build is triggered', () => {
    it('should include a timer of the build', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: `echo "Building, this will take some time..." && ${sleep(30)} && echo "Done!"`
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      // Let build run for 1.5 second. This should set the timer at "at least" 1.5
      // which is expected below. If this waits longer than 2000 ms, we're in trouble.
      waits(1500);

      runs(() => {
        expect(workspaceElement.querySelector('.build-timer').textContent).toMatch(/1.\d/);

        // stop twice to abort the build
        atom.commands.dispatch(workspaceElement, 'build:stop');
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });
    });
  });

  describe('when panel orientation is altered', () => {
    it('should show the panel at the bottom spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Bottom');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const bottomPanels = atom.workspace.getBottomPanels();
        expect(bottomPanels.length).toEqual(1);
        expect(bottomPanels[0].item.constructor.name).toEqual('BuildView');
      });
    });

    it('should show the panel at the top spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Top');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const panels = atom.workspace.getTopPanels();
        expect(panels.length).toEqual(1);
        expect(panels[0].item.constructor.name).toEqual('BuildView');
      });
    });
  });

  describe('when build fails', () => {
    it('should keep the build scrolled to bottom', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo a && echo b && echo c && echo d && echo e && echo f && echo g && echo h && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toBeGreaterThan(0);
      });
    });
  });

  describe('when hidePanelHeading is set', () => {
    beforeEach(() => {
      atom.config.set('build.hidePanelHeading', true);
    });

    afterEach(() => {
      atom.config.set('build.hidePanelHeading', false);
    });

    it('should not show the panel heading', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo hello && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .heading')).toBeHidden();
      });
    });

    it('should show the heading when hidden is disabled', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo hello && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .heading')).toBeHidden();
        atom.config.set('build.hidePanelHeading', false);
        expect(workspaceElement.querySelector('.build .heading')).toBeVisible();
      });
    });
  });
});
