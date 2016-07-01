'use babel';

import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';
import os from 'os';
import { sleep } from './helpers';

describe('Error Match', () => {
  const errorMatchAtomBuildFile = __dirname + '/fixture/.atom-build.error-match.json';
  const errorMatchNoFileBuildFile = __dirname + '/fixture/.atom-build.error-match-no-file.json';
  const errorMatchNLCAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-no-line-col.json';
  const errorMatchMultiAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple.json';
  const errorMatchMultiFirstAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple-first.json';
  const errorMatchLongOutputAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-long-output.json';
  const errorMatchMultiMatcherAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple-errorMatch.json';
  const errorMatchFunction = __dirname + '/fixture/.atom-build.error-match-function.js';
  const matchFunctionWarning = __dirname + '/fixture/.atom-build.match-function-warning.js';
  const warningMatchAtomBuildFile = __dirname + '/fixture/.atom-build.warning-match.json';
  const functionChangeDirs = __dirname + '/fixture/.atom-build.match-function-change-dirs.js';
  const originalHomedirFn = os.homedir;

  let directory = null;
  let workspaceElement = null;
  const waitTime = process.env.CI ? 2400 : 200;

  temp.track();

  beforeEach(() => {
    const createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + path.sep;
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.scrollOnError', false);
    atom.config.set('build.notificationOnRefresh', true);
    atom.config.set('editor.fontSize', 14);
    atom.notifications.clear();

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
    // FIXME: try to figure out why atom still holds on to the directory/files on windows
    try {
      fs.removeSync(directory);
    } catch (err) {
      // Failed to clean up, ignore this.
    }
    os.homedir = originalHomedirFn;
  });

  describe('when error matcher is configured incorrectly', () => {
    it('should show an error if regex is invalid', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'return 1',
        errorMatch: '(invalidRegex'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const notification = atom.notifications.getNotifications().find(n => n.getMessage() === 'Error matching failed!');
        expect(notification).not.toBe(undefined);
        expect(notification.getType()).toEqual('error');
        expect(notification.options.detail).toMatch(/Unterminated group/);
      });
    });
  });

  describe('when output is captured to show editor on error', () => {
    it('should place the line and column on error in correct file', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should place the line and column on warning in correct file', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.matchedErrorFailsBuild', true);

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(warningMatchAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .title').classList.contains('error')).not.toExist();
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should give an error if matched file does not exist', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNoFileBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => atom.notifications.getNotifications().find(n => n.getMessage() === 'Error matching failed!'));

      runs(() => {
        const notification = atom.notifications.getNotifications().find(n => n.getMessage() === 'Error matching failed!');
        expect(notification).not.toBe(undefined);
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Error matching failed!');
      });
    });

    it('should open just the file if line and column is not available', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNLCAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(editor.getTitle()).toEqual('.atom-build.json');
      });
    });

    it('should cycle through the file if multiple error occurred', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
        atom.workspace.getActivePane().destroy();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(4);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should jump to first error', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiFirstAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
        atom.workspace.getActivePane().destroy();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(4);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should open the file even if tool gives absolute path', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo __' + directory + '.atom-build.json__ && exit 1',
        errorMatch: '__(?<file>.+)__'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        return atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(editor.getPath()).toEqual(directory + '.atom-build.json');
      });
    });

    it('should prepend `cwd` to the relative matched file if set', () => {
      const atomBuild = {
        cmd: 'echo __.atom-build.json__ && exit 1',
        cwd: directory,
        errorMatch: '__(?<file>.+)__'
      };
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify(atomBuild));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        return atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        // Error match one more time to make sure `cwd` isn't prepended multiple times
        atom.workspace.getActivePaneItem().destroy();
      });

      waitsFor(() => {
        return !atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        return atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(editor.getPath()).toEqual(directory + '.atom-build.json');
      });
    });

    it('should auto match error on failed build when config is set', () => {
      atom.config.set('build.scrollOnError', true);

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
      });
    });

    it('should scroll the build panel to the text of the error', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchLongOutputAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(waitTime);
      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(6);
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(waitTime);
      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(12);
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(waitTime);
      runs(() => {
        /* Should wrap around to first match */
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(6);
      });
    });

    it('match-first should scroll the build panel', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchLongOutputAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(waitTime);
      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(6);
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(waitTime);
      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(12);
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waits(waitTime);
      runs(() => {
        expect(workspaceElement.querySelector('.terminal').terminal.ydisp).toEqual(6);
      });
    });

    it('should match multiple regexes in the correct order', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiMatcherAtomBuildFile));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(7);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(0);
        expect(bufferPosition.column).toEqual(1);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(4);
      });
    });

    it('should run javascript functions that return matches', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.js', fs.readFileSync(errorMatchFunction));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.js');
        expect(bufferPosition.row).toEqual(0);
        expect(bufferPosition.column).toEqual(4);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.js');
        expect(bufferPosition.row).toEqual(1);
        expect(bufferPosition.column).toEqual(0);
        atom.workspace.getActivePane().destroyActiveItem();
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.js');
        expect(bufferPosition.row).toEqual(4);
        expect(bufferPosition.column).toEqual(0);
      });
    });

    it('should be possible to change the type of the match to something other than `Error`', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.js', fs.readFileSync(matchFunctionWarning));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.js');
        expect(bufferPosition.row).toEqual(4);
        expect(bufferPosition.column).toEqual(0);
      });
    });
  });

  describe('when using function matches', () => {
    it('should be possible to keep state from previous lines', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      fs.writeFileSync(directory + '.atom-build.js', fs.readFileSync(functionChangeDirs));
      fs.writeFileSync(directory + 'change_dir_output.txt', fs.readFileSync(__dirname + '/fixture/change_dir_output.txt'));
      fs.mkdirSync(directory + 'foo');
      fs.mkdirSync(directory + 'foo/src');
      fs.writeFileSync(directory + 'foo/src/testmake.c', 'lorem ipsum\naquarium laudanum\nbabaorum petibonum\nthe cake is a lie');

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });
      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('testmake.c');
        expect(bufferPosition.row).toEqual(2);
        expect(bufferPosition.column).toEqual(4);
      });
    });
  });

  describe('when build is cancelled', () => {
    it('should still be possible to errormatch', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: `echo ".atom-build.json:1:5." && ${sleep(30)} && echo "Done!"`,
        errorMatch: '(?<file>.atom-build.json):(?<line>1):(?<col>5)'
      }));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      // Let build run for one second before we terminate it
      waits(1000);

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        atom.commands.dispatch(workspaceElement, 'build:stop');
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.workspace.getActiveTextEditor();
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        const bufferPosition = editor.getCursorBufferPosition();
        expect(editor.getTitle()).toEqual('.atom-build.json');
        expect(bufferPosition.row).toEqual(0);
        expect(bufferPosition.column).toEqual(4);
      });
    });
  });
});
