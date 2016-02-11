'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('AtomCommandName', () => {
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' }));
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.notificationOnRefresh', true);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(() => {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return atom.packages.activatePackage('build');
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when atomCommandName is specified in build config', () => {
    it('it should register that command to atom', () => {
      fs.writeFileSync(`${directory}/.atom-build.json`, JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        atomCommandName: 'someProvider:customCommand'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'someProvider:customCommand'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });
    });
  });
});
