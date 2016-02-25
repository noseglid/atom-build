'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Hooks', () => {
  let directory = null;
  let workspaceElement = null;
  let target = null;
  const commandName = 'build:hook-test:trigger-build';

  function getBuildModule() {
    return atom.packages.getLoadedPackage('build').mainModule;
  }

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

    runs(() => {
      fs.writeFileSync(directory + '/.atom-build.json', fs.readFileSync(__dirname + '/fixture/.atom-build.hooks.json'));
    });

    waitsForPromise(() => specHelpers.refreshAwaitTargets());
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  it('should call preBuild', () => {
    runs(() => {
      target = getBuildModule().targets[directory].find(t => t.atomCommandName === commandName);
      target.preBuild = () => {};
      spyOn(target, 'preBuild');

      atom.commands.dispatch(workspaceElement, commandName);
    });

    waitsFor(() => {
      return workspaceElement.querySelector('.build .title');
    });

    runs(() => {
      expect(target.preBuild).toHaveBeenCalled();
    });
  });

  describe('postBuild', () => {
    it('should be called with `true` as an argument when build succeded', () => {
      runs(() => {
        target = getBuildModule().targets[directory].find(t => t.atomCommandName === commandName);
        target.postBuild = () => {};
        spyOn(target, 'postBuild');

        atom.commands.dispatch(workspaceElement, commandName);
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(target.postBuild).toHaveBeenCalledWith(true);
      });
    });

    it('should be called with `false` as an argument when build failed', () => {
      runs(() => {
        target = getBuildModule().targets[directory].find(t => t.atomCommandName === commandName);
        target.postBuild = () => {};
        spyOn(target, 'postBuild');

        target.args = ['1'];

        atom.commands.dispatch(workspaceElement, commandName);
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        expect(target.postBuild).toHaveBeenCalledWith(false);
      });
    });
  });
});
