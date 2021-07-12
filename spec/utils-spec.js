'use babel';

import { uniquifySettings, getDefaultSettings, replace } from '../lib/utils.js';

describe('utils', () => {
  describe('when uniquifying settings', () => {
    it('should append numbers on equally named settings', () => {
      const settings = [
        { name: 'name', cwd: 'cwd1' },
        { name: 'name', cwd: 'cwd2' },
        { name: 'name', cwd: 'cwd3' },
        { name: 'name', cwd: 'cwd4' }
      ];
      expect(uniquifySettings(settings)).toEqual([
        { name: 'name', cwd: 'cwd1' },
        { name: 'name - 1', cwd: 'cwd2' },
        { name: 'name - 2', cwd: 'cwd3' },
        { name: 'name - 3', cwd: 'cwd4' }
      ]);
    });

    it('should append numbers on equally named settings, but leave unique names untouched', () => {
      const settings = [
        { name: 'name', cwd: 'cwd1' },
        { name: 'name', cwd: 'cwd2' },
        { name: 'otherName', cwd: 'cwd3' },
        { name: 'yetAnotherName', cwd: 'cwd4' }
      ];
      expect(uniquifySettings(settings)).toEqual([
        { name: 'name', cwd: 'cwd1' },
        { name: 'name - 1', cwd: 'cwd2' },
        { name: 'otherName', cwd: 'cwd3' },
        { name: 'yetAnotherName', cwd: 'cwd4' }
      ]);
    });
  });

  describe('when getting default settings', () => {
    it('should prioritize specified settings', () => {
      expect(getDefaultSettings('/cwd', { cmd: 'echo hello', cwd: 'relative' })).toEqual({
        cmd: 'echo hello',
        cwd: 'relative',
        args: [],
        env: {},
        sh: true,
        errorMatch: ''
      });
    });

    it('should be possible to override any argument', () => {
      expect(getDefaultSettings('/cwd', {
        cmd: 'echo hello',
        cwd: 'relative',
        args: [ 'arg1' ],
        env: { 'key1': 'val1' },
        sh: false,
        errorMatch: '^regex$'
      })).toEqual({
        cmd: 'echo hello',
        cwd: 'relative',
        args: [ 'arg1' ],
        env: { 'key1': 'val1' },
        sh: false,
        errorMatch: '^regex$'
      });
    });

    it('should take the specifed cwd if omitted from settings', () => {
      expect(getDefaultSettings('/cwd', { cmd: 'make' })).toEqual({
        cmd: 'make',
        cwd: '/cwd',
        args: [],
        env: {},
        sh: true,
        errorMatch: ''
      });
    });

    it('should not replace values which are not strings', () => {
      expect(replace(12)).toEqual(12);
      expect(replace({a: '{FILE_ACTIVE}' })).toEqual({a: '{FILE_ACTIVE}'});
      expect(replace([ 1, 2, 3 ])).toEqual([ 1, 2, 3 ]);
    });
  });
});
