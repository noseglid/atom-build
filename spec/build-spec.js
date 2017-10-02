'use babel';

import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import os from 'os';
import { sleep, cat, shellCmd, waitTime } from './helpers';

describe('Build', () => {
  const goodAtomBuildfile = __dirname + '/fixture/.atom-build.json';
  const shellAtomBuildfile = __dirname + '/fixture/.atom-build.shell.json';
  const replaceAtomBuildFile = __dirname + '/fixture/.atom-build.replace.json';
  const shFalseAtomBuildFile = __dirname + '/fixture/.atom-build.sh-false.json';
  const shTrueAtomBuildFile = __dirname + '/fixture/.atom-build.sh-true.json';
  const shDefaultAtomBuildFile = __dirname + '/fixture/.atom-build.sh-default.json';
  const syntaxErrorAtomBuildFile = __dirname + '/fixture/.atom-build.syntax-error.json';
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
    atom.notifications.clear();

    workspaceElement = atom.views.getView(atom.workspace);
    workspaceElement.setAttribute('style', 'width:9999px');
    jasmine.attachToDOM(workspaceElement);
    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    waitsForPromise(() => {
      return specHelpers.vouch(temp.mkdir, 'atom-build-spec-').then( (dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then( (dir) => {
        directory = dir + path.sep;
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

  describe('when package is activated', () => {
    it('should not show build window if panelVisibility is Toggle ', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
    });
  });

  describe('when building', () => {
    it('should show build failed if build fails', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Very bad... && exit 1'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Very bad\.\.\./);
      });
    });

    it('should fail build, if errors are matched', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo __ERROR__ && exit 0',
        errorMatch: 'ERROR'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });
    });

    it('should cancel build when stopping it, and remove when stopping again', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: `echo "Building, this will take some time..." && ${sleep(30)} && echo "Done!"`
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      // Let build run for one second before we terminate it
      waits(1000);

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Building, this will take some time.../);
        atom.commands.dispatch(workspaceElement, 'build:stop');
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(() => {
        return (!workspaceElement.querySelector('.build .title'));
      });
    });

    it('should not show the build panel if no build file exists', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      /* Give it some time here. There's nothing to probe for as we expect the exact same state when done. */
      waits(waitTime);

      runs(() => {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });

    it('should automatically refresh if build is triggered an no targets are found', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo hello world'
      }));

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(() =>
        workspaceElement.querySelector('.build .title') &&
        workspaceElement.querySelector('.build .title').classList.contains('success'));

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/hello world/);
      });
    });
  });

  describe('when build is triggered twice', () => {
    it('should not leave multiple panels behind', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo hello world'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      waits(50);

      runs(() => {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waits(50);

      runs(() => {
        expect(workspaceElement.querySelectorAll('.bottom.tool-panel.panel-bottom').length).toBe(1);
      });
    });
  });

  describe('when custom .atom-build.json is available', () => {
    it('should show the build window', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: cat(),
        args: [ '.atom-build.json' ]
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/"args":\[".atom-build.json"\]/);
      });
    });

    it('should be possible to exec shell commands with wildcard expansion', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shellAtomBuildfile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Good news, everyone!/);
      });
    });

    it('should show sh message if sh is true', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shTrueAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .heading-text').textContent).toMatch(new RegExp(`^${shellCmd}`));
      });
    });

    it('should not show sh message if sh is false', () => {
      if (process.platform === 'win32') return;

      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shFalseAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .heading-text').textContent).toMatch(/^echo/);
      });
    });

    it('should show sh message if sh is unspecified', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(shDefaultAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .heading-text').textContent).toMatch(new RegExp(`^${shellCmd}`));
      });
    });

    it('should show graphical error message if build-file contains syntax errors', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(syntaxErrorAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return atom.notifications.getNotifications().find(n => n.getType() === 'error');
      });

      runs(() => {
        const notification = atom.notifications.getNotifications().find(n => n.getType() === 'error');
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Invalid build file.');
        expect(notification.options.detail).toMatch(/Unexpected token t/);
      });
    });

    it('should not cache the contents of the build file', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo first'
      }));

      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/first/);
      });

      waitsFor(() => {
        return !workspaceElement.querySelector('.build .title');
      });

      runs(() => {
        fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
          cmd: 'echo second'
        }));
      });

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/second/);
      });
    });
  });

  describe('when replacements are specified in the atom-build.json file', () => {
    it('should replace those with their dynamic value', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      process.env.FROM_PROCESS_ENV = '{FILE_ACTIVE}';
      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(replaceAtomBuildFile));

      waitsForPromise(() => atom.workspace.open('.atom-build.json'));

      runs(() => atom.workspace.getActiveTextEditor().setSelectedBufferRange([[1, 3], [1, 6]]));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        const output = workspaceElement.querySelector('.terminal').terminal.getContent();
        expect(output.indexOf('PROJECT_PATH=' + directory.substring(0, -1))).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FROM_ENV=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FROM_PROCESS_ENV=' + directory + '.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME=.atom-build.json')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_NAME_BASE=.atom-build')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_CURSOR_ROW=2')).not.toBe(-1);
        expect(output.indexOf('FILE_ACTIVE_CURSOR_COLUMN=7')).not.toBe(-1);
        expect(output.indexOf('SELECTION=cmd')).not.toBe(-1);
      });
    });
  });

  describe('when the text editor is saved', () => {
    it('should build when buildOnSave is true', () => {
      atom.config.set('build.buildOnSave', true);

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(() => atom.workspace.open('dummy'));

      waitsForPromise(() => {
        const editor = atom.workspace.getActiveTextEditor();
        return editor.save();
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
      });
    });

    it('should not build when buildOnSave is false', () => {
      atom.config.set('build.buildOnSave', false);

      fs.writeFileSync(directory + '.atom-build.json', {
        cmd: 'echo "hello, world"'
      });

      waitsForPromise(() => atom.workspace.open('dummy'));

      waitsForPromise(() => {
        const editor = atom.workspace.getActiveTextEditor();
        return editor.save();
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });

    it('should not attempt to build if buildOnSave is true and no build tool exists', () => {
      atom.config.set('build.buildOnSave', true);

      fs.writeFileSync(directory + '.atom-build.json', {
        cmd: 'echo "hello, world"'
      });

      waitsForPromise(() => {
        return atom.workspace.open('dummy');
      });

      runs(() => {
        atom.workspace.getActiveTextEditor().save();
      });

      waits(waitTime);

      runs(() => {
        expect(workspaceElement.querySelector('.build')).not.toExist();
      });
    });
  });

  describe('when multiple project roots are open', () => {
    it('should run the second root if a file there is active', () => {
      const directory2 = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
      atom.project.addPath(directory2);
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory2 + '.atom-build.json', JSON.stringify({
        cmd: cat(),
        args: [ '.atom-build.json' ]
      }));

      waitsForPromise(() => atom.workspace.open(directory2 + '/main.c'));

      runs(() => {
        atom.workspace.getActiveTextEditor().save();
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/"args":\[".atom-build.json"\]/);
      });
    });

    it('should scan new project roots when they are added', () => {
      const directory2 = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
      fs.writeFileSync(directory2 + '.atom-build.json', JSON.stringify({
        cmd: cat(),
        args: [ '.atom-build.json' ]
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      waitsForPromise(() => {
        const promise = specHelpers.awaitTargets();
        atom.project.addPath(directory2);
        return Promise.all([ promise, atom.workspace.open(directory2 + '/main.c') ]);
      });

      runs(() => {
        atom.workspace.getActiveTextEditor().save();
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/"args":\[".atom-build.json"\]/);
      });
    });
  });

  describe('when build panel is toggled and it is not visible', () => {
    it('should show the build panel', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.commands.dispatch(workspaceElement, 'build:toggle-panel');

      expect(workspaceElement.querySelector('.build')).toExist();
    });
  });

  describe('when build is triggered, focus should adhere the stealFocus config', () => {
    it('should focus the build panel if stealFocus is true', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build');
      });

      runs(() => {
        expect(document.activeElement).toHaveClass('build');
      });
    });

    it('should leave focus untouched if stealFocus is false', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      atom.config.set('build.stealFocus', false);
      const activeElement = document.activeElement;

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(goodAtomBuildfile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build');
      });

      runs(() => {
        expect(document.activeElement).toEqual(activeElement);
        expect(document.activeElement).not.toHaveClass('build');
      });
    });
  });

  describe('when no build tools are available', () => {
    it('should show a warning', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.commands.dispatch(workspaceElement, 'build:trigger');

      waitsFor(() => atom.notifications.getNotifications().find(n => n.getMessage() === 'No eligible build target.'));

      runs(() => {
        const notification = atom.notifications.getNotifications().find(n => n.getMessage() === 'No eligible build target.');
        expect(notification.getType()).toEqual('warning');
      });
    });
  });
});
