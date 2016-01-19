'use babel';

import _ from 'lodash';
import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('Confirm', () => {
  let directory = null;
  let workspaceElement = null;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
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

  describe('when the text editor is modified', () => {
    it('should show the save confirmation', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(() => {
        return atom.workspace.open('.atom-build.json');
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.insertText('hello kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector(':focus');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.btn-success:focus')).toExist();
      });
    });

    it('should cancel the confirm window when pressing escape', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(() => {
        return atom.workspace.open('.atom-build.json');
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.insertText('hello kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector(':focus');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:no-confirm');
        expect(workspaceElement.querySelector('.btn-success:focus')).not.toExist();
      });
    });

    it('should not do anything if issuing no-confirm whithout the dialog', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();
      atom.commands.dispatch(workspaceElement, 'build:no-confirm');
    });

    it('should not confirm if a TextEditor edits an unsaved file', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(() => {
        return Promise.all([
          specHelpers.refreshAwaitTargets(),
          atom.workspace.open('.atom-build.json'),
          atom.workspace.open()
        ]);
      });

      runs(() => {
        const editor = _.find(atom.workspace.getTextEditors(), (textEditor) => {
          return ('untitled' === textEditor.getTitle());
        });
        editor.insertText('Just some temporary place to write stuff');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
      });
    });

    it('should save and build when selecting save and build', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'catme', 'Surprising is the passing of time but not so, as the time of passing.');
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'cat catme'
      }));

      waitsForPromise(() => {
        return Promise.all([
          specHelpers.refreshAwaitTargets(),
          atom.workspace.open('catme')
        ]);
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => workspaceElement.querySelector(':focus'));

      runs(() => workspaceElement.querySelector(':focus').click());

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).toMatch(/kansas/);
        expect(!editor.isModified());
      });
    });

    it('should build but not save when opting so', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'catme', 'Surprising is the passing of time but not so, as the time of passing.');
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'cat catme'
      }));

      waitsForPromise(() => {
        return Promise.all([
          specHelpers.refreshAwaitTargets(),
          atom.workspace.open('catme')
        ]);
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('catme');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector(':focus');
      });

      runs(() => {
        workspaceElement.querySelector('button[click="confirmWithoutSave"]').click();
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).not.toMatch(/kansas/);
        expect(editor.isModified());
      });
    });

    it('should do nothing when cancelling', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'catme', 'Surprising is the passing of time but not so, as the time of passing.');
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'cat catme'
      }));

      waitsForPromise(() => {
        return Promise.all([
          specHelpers.refreshAwaitTargets(),
          atom.workspace.open('catme')
        ]);
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector(':focus');
      });

      runs(() => {
        workspaceElement.querySelector('button[click="cancel"]').click();
      });

      waits(2);

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        expect(workspaceElement.querySelector('.build')).not.toExist();
        expect(editor.isModified());
      });
    });
  });

  describe('when build is triggered without answering confirm dialog', function () {
    it('should only keep at maximum 1 dialog open', function () {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo Surprising is the passing of time but not so, as the time of passing.'
      }));

      waitsForPromise(() => {
        return Promise.all([
          specHelpers.refreshAwaitTargets(),
          atom.workspace.open('.atom-build.json')
        ]);
      });

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText(JSON.stringify({
          cmd: 'echo kansas'
        }));
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => {
        return workspaceElement.querySelector('.build-confirm');
      });

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waits(200); // Everything is the same so we can't know when second build:trigger has been handled

      runs(() => {
        expect(workspaceElement.querySelectorAll('.build-confirm').length).toEqual(1);
      });
    });
  });
});
