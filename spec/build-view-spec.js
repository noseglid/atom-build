'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import specHelpers from 'atom-build-spec-helpers';

describe('BuildView', () => {
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
    jasmine.attachToDOM(workspaceElement);
    jasmine.unspy(window, 'setTimeout');
    jasmine.unspy(window, 'clearTimeout');

    runs(() => {
      workspaceElement = atom.views.getView(atom.workspace);
      jasmine.attachToDOM(workspaceElement);
    });

    waitsForPromise(() => {
      return specHelpers.vouch(temp.mkdir, { prefix: 'atom-build-spec-' }).then( (dir) => {
        return specHelpers.vouch(fs.realpath, dir);
      }).then( (dir) => {
        directory = dir + '/';
        atom.project.setPaths([ directory ]);
        return atom.packages.activatePackage('build');
      });
    });
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when output from build command should be viewed', () => {
    it('should color output according to ansi escape codes', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'printf "\\033[31mHello\\e[0m World"'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output > span').style.color.match(/\d+/g)).toEqual([ '187', '0', '0' ]);
      });
    });

    it('should output data even if no line break exists', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'printf "data without linebreak"'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build .output').textContent).toMatch(/data without linebreak/);
      });
    });

    it('should only break the line when an actual newline character appears', () => {
      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'node -e \'process.stdout.write("same"); setTimeout(function() { process.stdout.write(" line\\n") }, 200);\''
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        const el = workspaceElement.querySelector('.build .output');
        /* Now we expect one line for the 'Executing...' row, one for the actual output and an empty one at the end. */
        const lines = el.textContent.split('\n');
        expect(lines.length).toEqual(3);
        expect(lines[1]).toEqual('same line');
      });
    });

    it('should escape HTML chars so the output is not garbled or missing', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo "<script type=\"text/javascript\">alert(\'XSS!\')</script>"'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('success');
      });

      runs(() => {
        expect(workspaceElement.querySelector('.build')).toExist();
        expect(workspaceElement.querySelector('.build .output').innerHTML).toMatch(/&lt;script type="text\/javascript"&gt;alert\('XSS!'\)&lt;\/script&gt;/);
      });
    });
  });

  describe('when a build is triggered', () => {
    it('should include a timer of the build', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo "Building, this will take some time..." && sleep 30 && echo "Done!"'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      // Let build run for 1.2 second. This should set the timer at "at least" 1.2
      // which is expected below. If this waits longer than 2000 ms, we're in trouble.
      waits(1200);

      runs(() => {
        expect(workspaceElement.querySelector('.build-timer').textContent).toMatch(/1.\d/);

        // stop twice to abort the build
        atom.commands.dispatch(workspaceElement, 'build:stop');
        atom.commands.dispatch(workspaceElement, 'build:stop');
      });
    });
  });

  describe('when links are added', () => {
    it('should only add one link per text, even if multiple is requested', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo match1 match1 match1 && exit 1',
        errorMatch: 'match1'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const output = workspaceElement.querySelector('.build .output');
        expect(output.children.length).toEqual(6);
        for (let i = 0; i < output.children.length; i++) {
          expect(output.children[i].id).toEqual('error-match-0-0');
        }
      });
    });
  });

  describe('when panel orientation is altered', () => {
    it('should show the panel at the bottom spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Bottom');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const bottomPanels = atom.workspace.getBottomPanels();
        expect(bottomPanels.length).toEqual(1);
        expect(bottomPanels[0].item.constructor.name).toEqual('BuildView');
      });
    });

    it('should show the panel at the bottom spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Left');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const panels = atom.workspace.getLeftPanels();
        expect(panels.length).toEqual(1);
        expect(panels[0].item.constructor.name).toEqual('BuildView');
      });
    });

    it('should show the panel at the bottom spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Top');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const panels = atom.workspace.getTopPanels();
        expect(panels.length).toEqual(1);
        expect(panels[0].item.constructor.name).toEqual('BuildView');
      });
    });

    it('should show the panel at the bottom spot', () => {
      expect(workspaceElement.querySelector('.build')).not.toExist();
      atom.config.set('build.panelOrientation', 'Right');

      fs.writeFileSync(directory + '.atom-build.json', JSON.stringify({
        cmd: 'echo this will fail && exit 1'
      }));

      waitsForPromise(() => specHelpers.refreshAwaitTargets());

      runs(() => atom.commands.dispatch(workspaceElement, 'build:trigger'));

      waitsFor(() => {
        return workspaceElement.querySelector('.build .title') &&
          workspaceElement.querySelector('.build .title').classList.contains('error');
      });

      runs(() => {
        const panels = atom.workspace.getRightPanels();
        expect(panels.length).toEqual(1);
        expect(panels[0].item.constructor.name).toEqual('BuildView');
      });
    });
  });
});
