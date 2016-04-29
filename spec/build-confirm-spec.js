'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import os from 'os';

describe('Confirm', () => {
  let directory = null;
  let workspaceElement = null;
  const cat = process.platform === 'win32' ? 'type' : 'cat';
  const waitTime = process.env.CI ? 2400 : 200;
  const originalHomedirFn = os.homedir;

  temp.track();

  beforeEach(() => {
    const createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
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
      workspaceElement.setAttribute('style', 'width:9999px');
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return atom.packages.activatePackage('build');
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
    os.homedir = originalHomedirFn;
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
        return workspaceElement.querySelector('.build-confirm');
      });

      runs(() => {
        expect(document.activeElement.classList.contains('btn-success')).toEqual(true);
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

      waitsFor(() => workspaceElement.querySelector('.build-confirm'));

      runs(() => {
        atom.commands.dispatch(workspaceElement, 'build:no-confirm');
        expect(workspaceElement.querySelector('.build-confirm')).not.toExist();
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
          atom.workspace.open('.atom-build.json'),
          atom.workspace.open()
        ]);
      });

      runs(() => {
        const editor = atom.workspace.getTextEditors().find(textEditor => {
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
        expect(workspaceElement.querySelector('.terminal').terminal.getContent()).toMatch(/Surprising is the passing of time but not so, as the time of passing/);
      });
    });

    it('should save and build when selecting save and build', () => {
      expect(workspaceElement.querySelector('.build-confirm')).not.toExist();

      fs.writeFileSync(directory + 'catme', 'Surprising is the passing of time but not so, as the time of passing.');
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: `${cat} catme`
      }));

      waitsForPromise(() => atom.workspace.open('catme'));

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => workspaceElement.querySelector('.build-confirm'));
      runs(() => document.activeElement.click());

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
        cmd: `${cat} catme`
      }));

      waitsForPromise(() => atom.workspace.open('catme'));

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('catme');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => workspaceElement.querySelector('.build-confirm'));

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
        cmd: `${cat} catme`
      }));

      waitsForPromise(() => atom.workspace.open('catme'));

      runs(() => {
        const editor = atom.workspace.getActiveTextEditor();
        editor.setText('kansas');
        atom.commands.dispatch(workspaceElement, 'build:trigger');
      });

      waitsFor(() => workspaceElement.querySelector('.build-confirm'));

      runs(() => {
        workspaceElement.querySelector('button[click="cancel"]').click();
      });

      waits(waitTime);

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

      waitsForPromise(() => atom.workspace.open('.atom-build.json'));

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

      waits(waitTime); // Everything is the same so we can't know when second build:trigger has been handled

      runs(() => {
        expect(workspaceElement.querySelectorAll('.build-confirm').length).toEqual(1);
      });
    });
  });
});
