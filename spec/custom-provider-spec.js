'use babel';

import fs from 'fs-extra';
import temp from 'temp';
import CustomFile from '../lib/atom-build.js';
import os from 'os';

describe('custom provider', () => {
  const originalHomedirFn = os.homedir;
  let builder;
  let directory = null;
  let createdHomeDir;

  temp.track();

  beforeEach(() => {
    createdHomeDir = temp.mkdirSync('atom-build-spec-home');
    os.homedir = () => createdHomeDir;
    directory = fs.realpathSync(temp.mkdirSync({ prefix: 'atom-build-spec-' })) + '/';
    atom.project.setPaths([ directory ]);
    builder = new CustomFile(directory);
  });

  afterEach(() => {
    os.homedir = originalHomedirFn;
    try { fs.removeSync(directory); } catch (e) { console.warn('Failed to clean up: ', e); }
  });

  describe('when there is no .atom-build config file in any elegible directory', () => {
    it('should not be eligible', () => {
      expect(builder.isEligible()).toEqual(false);
    });
  });

  describe('when .atom-build config is on home directory', () => {
    it('should find json file in home directory', () => {
      fs.writeFileSync(createdHomeDir + '/.atom-build.json', fs.readFileSync(__dirname + '/fixture/.atom-build.json'));
      expect(builder.isEligible()).toEqual(true);
    });
    it('should find cson file in home directory', () => {
      fs.writeFileSync(createdHomeDir + '/.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      expect(builder.isEligible()).toEqual(true);
    });
    it('should find yml file in home directory', () => {
      fs.writeFileSync(createdHomeDir + '/.atom-build.yml', fs.readFileSync(__dirname + '/fixture/.atom-build.yml'));
      expect(builder.isEligible()).toEqual(true);
    });
  });

  describe('when .atom-build config is on project directory', () => {
    it('should find json file in home directory', () => {
      fs.writeFileSync(directory + '/.atom-build.json', fs.readFileSync(__dirname + '/fixture/.atom-build.json'));
      expect(builder.isEligible()).toEqual(true);
    });
    it('should find cson file in home directory', () => {
      fs.writeFileSync(directory + '/.atom-build.cson', fs.readFileSync(__dirname + '/fixture/.atom-build.cson'));
      expect(builder.isEligible()).toEqual(true);
    });
    it('should find yml file in home directory', () => {
      fs.writeFileSync(directory + '/.atom-build.yml', fs.readFileSync(__dirname + '/fixture/.atom-build.yml'));
      expect(builder.isEligible()).toEqual(true);
    });
  });

  describe('when .atom-build.cson exists', () => {
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

  describe('when .atom-build.yaml exists', () => {
    it('it should provide targets', () => {
      fs.writeFileSync(`${directory}.atom-build.yaml`, fs.readFileSync(`${__dirname}/fixture/.atom-build.yml`));
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

  describe('when .atom-build.js exists', () => {
    it('it should provide targets', () => {
      fs.writeFileSync(`${directory}.atom-build.js`, fs.readFileSync(`${__dirname}/fixture/.atom-build.js`));
      expect(builder.isEligible()).toEqual(true);

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          const s = settings[0];
          expect(s.exec).toEqual('echo');
          expect(s.args).toEqual([ 'hello', 'world', 'from', 'js' ]);
          expect(s.name).toEqual('Custom: from js');
        });
      });
    });
  });
});
