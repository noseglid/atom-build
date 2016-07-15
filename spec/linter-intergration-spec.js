'use babel';

import os from 'os';
import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';
import { sleep } from './helpers';

describe('Linter Integration', () => {
  let directory = null;
  let workspaceElement = null;
  let dummyPackage = null;
  const join = require('path').join;
  const originalHomedirFn = os.homedir;

  temp.track();

  beforeEach(() => {
    const createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' }));
    atom.project.setPaths([ directory ]);

    atom.config.set('build.buildOnSave', false);
    atom.config.set('build.panelVisibility', 'Toggle');
    atom.config.set('build.saveOnBuild', false);
    atom.config.set('build.scrollOnError', false);
    atom.config.set('build.notificationOnRefresh', true);
    atom.config.set('editor.fontSize', 14);

    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(() => {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return Promise.resolve()
        .then(() => atom.packages.activatePackage('build'))
        .then(() => atom.packages.activatePackage(join(__dirname, 'fixture', 'atom-build-spec-linter')))
        .then(() => (dummyPackage = atom.packages.getActivePackage('atom-build-spec-linter').mainModule));
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
    os.homedir = originalHomedirFn;
  });

  describe('when error matching and linter is activated', () => {
    it('should push those errors to the linter', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match-multiple.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'Error from build',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: undefined
          },
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [1, 4], [1, 4] ],
            text: 'Error from build',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: undefined
          }
        ]);
      });
    });

    it('should parse `message` and include that to linter', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match.message.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'very bad things',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: undefined
          }
        ]);
      });
    });

    it('should emit warnings just like errors', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-warning.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [4, 0], [4, 0] ],
            text: 'mildly bad things',
            html: undefined,
            type: 'Warning',
            severity: 'warning',
            trace: undefined
          }
        ]);
      });
    });

    it('should attach traces to matches where applicable', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-trace.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [5, 0], [5, 0] ],
            text: 'Error from build',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: [
              {
                text: 'insert great explanation here',
                html: undefined,
                severity: 'info',
                type: 'Explanation',
                range: [ [0, 0], [0, 0]],
                filePath: undefined
              }
            ]
          }
        ]);
      });
    });

    it('should clear linter errors when starting a new build', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.json'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.error-match.message.json')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.json'),
            range: [ [2, 7], [2, 7] ],
            text: 'very bad things',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: undefined
          }
        ]);
        fs.writeFileSync(join(directory, '.atom-build.json'), JSON.stringify({
          cmd: `${sleep(30)}`
        }));
      });

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          !workspaceElement.querySelector('.build .title').classList.contains('error') &&
          !workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(dummyPackage.getLinter().messages.length).toEqual(0);
      });
    });

    it('should leave text undefined if html is set', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-html.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [4, 0], [4, 0] ],
            text: undefined,
            html: 'mildly <b>bad</b> things',
            type: 'Warning',
            severity: 'warning',
            trace: undefined
          }
        ]);
      });
    });

    it('should leave text undefined if html is set in traces', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-trace-html.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [5, 0], [5, 0] ],
            text: 'Error from build',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: [
              {
                text: undefined,
                html: 'insert <i>great</i> explanation here',
                severity: 'info',
                type: 'Explanation',
                range: [ [0, 0], [0, 0]],
                filePath: undefined
              }
            ]
          }
        ]);
      });
    });

    it('should give priority to text over html when both are set', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-message-and-html.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [4, 0], [4, 0] ],
            text: 'something happened in plain text',
            html: undefined,
            type: 'Warning',
            severity: 'warning',
            trace: undefined
          }
        ]);
      });
    });

    it('should give priority to text over html when both are set in traces', () => {
      expect(dummyPackage.hasRegistered()).toEqual(true);
      fs.writeFileSync(join(directory, '.atom-build.js'), fs.readFileSync(join(__dirname, 'fixture', '.atom-build.match-function-trace-message-and-html.js')));

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const linter = dummyPackage.getLinter();
        expect(linter.messages).toEqual([
          {
            filePath: join(directory, '.atom-build.js'),
            range: [ [5, 0], [5, 0] ],
            text: 'Error from build',
            html: undefined,
            type: 'Error',
            severity: 'error',
            trace: [
              {
                text: 'insert plain text explanation here',
                html: undefined,
                severity: 'info',
                type: 'Explanation',
                range: [ [0, 0], [0, 0]],
                filePath: undefined
              }
            ]
          }
        ]);
      });
    });
  });
});
