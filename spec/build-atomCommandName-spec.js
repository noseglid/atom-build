'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import os from 'os';

describe('AtomCommandName', () => {
  const originalHomedirFn = os.homedir;
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    const createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
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
      workspaceElement.setAttribute('style', 'width:9999px');
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return atom.packages.activatePackage('build');
    });
  });

  afterEach(() => {
    os.homedir = originalHomedirFn;
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
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/default/);
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
      });
    });
  });
});
