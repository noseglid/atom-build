'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Hooks', () => {
  let directory = null;
  let workspaceElement = null;
  const succedingCommandName = 'build:hook-test:succeding';
  const failingCommandName = 'build:hook-test:failing';
  const dummyPackageName = 'atom-build-hooks-dummy-package';
  const dummyPackagePath = __dirname + '/fixture/' + dummyPackageName;

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
      return Promise.resolve()
        .then(() => atom.packages.activatePackage('build'))
        .then(() => atom.packages.activatePackage(dummyPackagePath));
    });

    waitsForPromise(() => specHelpers.refreshAwaitTargets());
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  it('should call preBuild', () => {
    let pkg;

    runs(() => {
      pkg = atom.packages.getActivePackage(dummyPackageName).mainModule;
      spyOn(pkg.hooks, 'preBuild');

      atom.commands.dispatch(workspaceElement, succedingCommandName);
    });

    waitsFor(() => {
      return workspaceElement.querySelector('.build .title');
    });

    runs(() => {
      expect(pkg.hooks.preBuild).toHaveBeenCalled();
    });
  });

  describe('postBuild', () => {
    it('should be called with `true` as an argument when build succeded', () => {
      let pkg;

      runs(() => {
        pkg = atom.packages.getActivePackage(dummyPackageName).mainModule;
        spyOn(pkg.hooks, 'postBuild');

        atom.commands.dispatch(workspaceElement, succedingCommandName);
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(pkg.hooks.postBuild).toHaveBeenCalledWith(true);
      });
    });

    it('should be called with `false` as an argument when build failed', () => {
      let pkg;

      runs(() => {
        pkg = atom.packages.getActivePackage(dummyPackageName).mainModule;
        spyOn(pkg.hooks, 'postBuild');

        atom.commands.dispatch(workspaceElement, failingCommandName);
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        expect(pkg.hooks.postBuild).toHaveBeenCalledWith(false);
      });
    });
  });
});
