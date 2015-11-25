'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import provider from '../lib/atom-build.js';

describe('Confirm', () => {
  let directory = null;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when .atom-build.cson exists', () => {
    it('it should be eligible targets', () => {
      fs.writeFileSync(directory + '.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      const ctx = {};
      const eligible = provider.isEligable.apply(ctx, [ directory ]);

      expect(eligible).toEqual(true);
    });

    it('it should provide targets', () => {
      fs.writeFileSync(directory + '.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      const ctx = {};
      const eligible = provider.isEligable.apply(ctx, [ directory ]);
      expect(eligible).toEqual(true);

      Promise.resolve(provider.settings.apply(ctx, [ directory ])).then((settings) => {
        const s = settings[0];
        expect(s.exec).toEqual('echo');
        expect(s.args).toEqual([ 'arg1', 'arg2' ]);
        expect(s.name).toEqual('Custom: Compose masterpiece');
        expect(s.sh).toEqual(false);
        expect(s.cwd).toEqual('/some/directory');
        expect(s.errorMatch).toEqual('(?<file>\\w+.js):(?<row>\\d+)');
      });
    });
  });
});
