'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import CustomFile from '../lib/atom-build.js';

describe('custom provider', () => {
  let builder;
  let directory = null;

  temp.track();

  beforeEach(() => {
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);
    builder = new CustomFile(directory);
  });

  afterEach(() => {
    fs.removeSync(directory);
  });

  describe('when .atom-build.cson exists', () => {
    it('it should be eligible targets', () => {
      fs.writeFileSync(directory + '.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      expect(builder.isEligible()).toEqual(true);
    });

    it('it should provide targets', () => {
      fs.writeFileSync(directory + '.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      expect(builder.isEligible()).toEqual(true);

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
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

  describe('when .atom-build.json exists', () => {
    it('it should be eligible targets', () => {
      fs.writeFileSync(`${directory}.atom-build.json`, fs.readFileSync(`${__dirname}/fixture/.atom-build.json`));
      expect(builder.isEligible()).toEqual(true);
    });

    it('it should provide targets', () => {
      fs.writeFileSync(`${directory}.atom-build.json`, fs.readFileSync(`${__dirname}/fixture/.atom-build.json`));
      expect(builder.isEligible()).toEqual(true);

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          const s = settings[0];
          expect(s.exec).toEqual('dd');
          expect(s.args).toEqual([ 'if=.atom-build.json' ]);
          expect(s.name).toEqual('Custom: Fly to moon');
        });
      });
    });
  });

  describe('when .atom-build.yml exists', () => {
    it('it should be eligible targets', () => {
      fs.writeFileSync(`${directory}.atom-build.yml`, fs.readFileSync(`${__dirname}/fixture/.atom-build.yml`));
      expect(builder.isEligible()).toEqual(true);
    });

    it('it should provide targets', () => {
      fs.writeFileSync(`${directory}.atom-build.yml`, fs.readFileSync(`${__dirname}/fixture/.atom-build.yml`));
      expect(builder.isEligible()).toEqual(true);

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          const s = settings[0];
          expect(s.exec).toEqual('echo');
          expect(s.args).toEqual([ 'hello', 'world', 'from', 'yaml' ]);
          expect(s.name).toEqual('Custom: yaml conf');
        });
      });
    });
  });
});
