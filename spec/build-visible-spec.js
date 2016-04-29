'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import os from 'os';

describe('Visible', () => {
  let directory = null;
  let workspaceElement = null;
  const waitTime = process.env.CI ? 2400 : 200;
  const originalHomedirFn = os.homedir;

  temp.track();

  beforeEach(() => {
    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.stealFocus', true);
    atom.config.set('build.notificationOnRefresh', true);
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
      });
    });
  });

  afterEach(() => {
    os.homedir = originalHomedirFn;
    fs.removeSync(directory);
  });

  describe('when package is activated with panel visibility set to Keep Visible', () => {
    beforeEach(() => {
      atom.config.set('build.panelVisibility', 'Keep Visible');
      waitsForPromise(() => {
        return atom.packages.activatePackage('build');
      });
    });

    it('should show build window', () => {
      expect(workspaceElement.querySelector('.build')).toExist();
    });
  });

  describe('when package is activated with panel visibility set to Toggle', () => {
    beforeEach(() => {
      atom.config.set('build.panelVisibility', 'Toggle');
      waitsForPromise(() => {
        return atom.packages.activatePackage('build');
      });
    });

    describe('when build panel is toggled and it is visible', () => {
      beforeEach(() => {
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });

      it('should hide the build panel', () => {
        expect(workspaceElement.querySelector('.build')).toExist();

        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });

    describe('when panel visibility is set to Show on Error', () => {
      it('should only show the build panel if a build fails', () => {
        atom.config.set('build.panelVisibility', 'Show on Error');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(waitTime);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });

        runs(() => {
          fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
            cmd: 'echo Very bad... && exit 1'
          }));
        });

        // .atom-build.json is updated asynchronously... give it some time
        waitsForPromise(() => specHelpers.refreshAwaitTargets());

        runs(() => {
          atom.commands.dispatch(workspaceElement, 'build:trigger');
        });

        waitsFor(() => {
          return workspaceElement.querySelector('.build .title') &&
            workspaceElement.querySelector('.build .title').classList.contains('error');
        });

        waits(waitTime);

        runs(() => {
          expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Very bad\.\.\./);
        });
      });
    });

    describe('when panel visibility is set to Hidden', () => {
      it('should not show the build panel if build succeeeds', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(waitTime);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should not show the build panel if build fails', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo "Very bad..." && exit 2'
        }));

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(waitTime);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should show the build panel if it is toggled', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        waits(waitTime); // Let build finish. Since UI component is not visible yet, there's nothing to poll.

        runs(() => {
          atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
        });

        waitsFor(() => {
          return workspaceElement.querySelector('.build .title') &&
            workspaceElement.querySelector('.build .title').classList.contains('success');
        });

        runs(() => {
          expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
        });
      });
    });
  });
});
