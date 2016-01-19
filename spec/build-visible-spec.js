'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Visible', () => {
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.stealFocus', true);
    atom.config.set('build.notificationOnRefresh', true);
    atom.notifications.clear();

    workspaceElement = atom.views.getView(atom.workspace);
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
      });
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when package is activated with panel visibility set to Keep Visible', () => {
    beforeEach(() => {
      atom.config.set('build.panelVisibility', 'Keep Visible');
      waitsForPromise(() => {
        return atom.packages.activatePackage('build');
      });
    });

    it('should not show build window', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
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

        waitsForPromise(() => specHelpers.refreshAwaitTargets());

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });

        runs(() => {
          fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
            cmd: 'echo "Very bad..." && exit 2'
          }));
        });

        // .atom-build.json is updated asynchronously... give it some time
        waits(200);

        runs(() => {
          atom.commands.dispatch(workspaceElement, 'build:trigger');
        });

        waitsFor(() => {
          return workspaceElement.querySelector('.build');
        });

        runs(() => {
          expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Very bad\.\.\./);
        });
      });
    });

    describe('when panel visibility is set to Hidden', () => {
      it('should not show the build panel if build succeeeds', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));

        waitsForPromise(() => specHelpers.refreshAwaitTargets());

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should not show the build panel if build fails', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo "Very bad..." && exit 2'
        }));

        waitsForPromise(() => specHelpers.refreshAwaitTargets());

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        /* Give it some reasonable time to show itself if there is a bug */
        waits(200);

        runs(() => {
          expect(workspaceElement.querySelector('.build')).not.toExist();
        });
      });

      it('should show the build panel if it is toggled', () => {
        atom.config.set('build.panelVisibility', 'Hidden');

        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
        }));

        waitsForPromise(() => specHelpers.refreshAwaitTargets());

        runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

        waits(200); // Let build finish. Since UI component is not visible yet, there's nothing to poll.

        runs(() => {
          atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
        });

        waitsFor(() => {
          return workspaceElement.querySelector('.build .title') &&
            workspaceElement.querySelector('.build .title').classList.contains('success');
        });

        runs(() => {
          expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
        });
      });
    });
  });
});
