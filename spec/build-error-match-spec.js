'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Error Match', () => {
  const errorMatchAtomBuildFile = __dirname + '/fixture/.atom-build.error-match.json';
  const errorMatchNoFileBuildFile = __dirname + '/fixture/.atom-build.error-match-no-file.json';
  const errorMatchNLCAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-no-line-col.json';
  const errorMatchMultiAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple.json';
  const errorMatchMultiFirstAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple-first.json';
  const errorMatchLongOutputAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-long-output.json';
  const errorMatchMultiMatcherAtomBuildFile = __dirname + '/fixture/.atom-build.error-match-multiple-errorMatch.json';

  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.scrollOnError', false);
    atom.config.set('build.notificationOnRefresh', true);
    atom.notifications.clear();

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

  describe('when error matcher is configured incorrectly', () => {
    it('should show an error if regex is invalid', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'return 1',
        errorMatch: '(invalidRegex'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        expect(atom.notifications.getNotifications().length).toEqual(1);

        const notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Error matching failed!');
        expect(notification.options.detail).toMatch(/Unterminated group/);
      });
    });
  });

  describe('when output is captured to show editor on error', () => {
    it('should place the line and column on error in correct file', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchAtomBuildFile));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

    it('should give an error if matched file does not exist', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNoFileBuildFile));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waitsFor(() => {
        return atom.notifications.getNotifications().length > 0;
      });

      runs(() => {
        const notification = atom.notifications.getNotifications()[0];
        expect(notification.getType()).toEqual('error');
        expect(notification.getMessage()).toEqual('Error matching failed!');
      });
    });

    it('should open just the file if line and column is not available', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchNLCAtomBuildFile));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

    it('should open the the file even if tool gives absolute path', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo __' + directory + '.atom-build.json__ && return 1',
        errorMatch: '__(?<file>.+)__'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(100);
      let firstScrollTop;
      runs(() => {
        firstScrollTop = workspaceElement.querySelector('.build .output').scrollTop;
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(100);
      runs(() => {
        expect(workspaceElement.querySelector('.build .output').scrollTop).toBeGreaterThan(firstScrollTop);
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(100);
      runs(() => {
        /* Should wrap around to first match */
        expect(workspaceElement.querySelector('.build .output').scrollTop).toEqual(firstScrollTop);
      });
    });

    it('match-first should scroll the build panel', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchLongOutputAtomBuildFile));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(100);
      let firstScrollTop;
      runs(() => {
        firstScrollTop = workspaceElement.querySelector('.build .output').scrollTop;
        atom.commands.dispatch(workspaceElement, 'build:error-match');
      });

      waits(100);
      runs(() => {
        expect(workspaceElement.querySelector('.build .output').scrollTop).toBeGreaterThan(firstScrollTop);
        atom.commands.dispatch(workspaceElement, 'build:error-match-first');
      });

      waits(100);
      runs(() => {
        expect(workspaceElement.querySelector('.build .output').scrollTop).toEqual(firstScrollTop);
      });
    });

    it('should match multiple regexes in the correct order', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', fs.readFileSync(errorMatchMultiMatcherAtomBuildFile));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

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
  });
});
