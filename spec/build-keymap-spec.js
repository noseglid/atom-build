'use babel';

import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';
import os from 'os';

describe('Keymap', () => {
  const originalHomedirFn = os.homedir;
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    const createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + path.sep;
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

  describe('when custom keymap is defined in .atom-build.json', () => {
    it('should trigger the build when that key combination is pressed', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        targets: {
          'keymapped build': {
            cmd: 'echo keymapped',
            keymap: 'ctrl-alt-k'
          }
        }
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const bindings = atom.keymaps.findKeyBindings({ command: 'build:trigger:Custom: keymapped build' });
        expect(bindings.length).toEqual(1);
        expect(bindings[0].keystrokes).toEqual('ctrl-alt-k');
      });
    });

    it('should dispose keymap when reloading targets', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        name: 'The default build',
        cmd: 'echo default',
        targets: {
          'keymapped build': {
            cmd: 'echo keymapped',
            keymap: 'ctrl-alt-k'
          }
        }
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));
      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const bindings = atom.keymaps.findKeyBindings({ command: 'build:trigger:Custom: keymapped build' });
        expect(bindings.length).toEqual(1);
        expect(bindings[0].keystrokes).toEqual('ctrl-alt-k');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:toggle-panel');
        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          name: 'The default build',
          cmd: 'echo default',
          targets: {
            'keymapped build': {
              cmd: 'echo ctrl-x new file',
              keymap: 'ctrl-x'
            }
          }
        }));
      });

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));
      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const bindings = atom.keymaps.findKeyBindings({ command: 'build:trigger:Custom: keymapped build' });
        expect(bindings.length).toEqual(1);
        expect(bindings[0].keystrokes).not.toEqual('ctrl-alt-x');
      });
    });
  });
});
