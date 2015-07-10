'use strict';

var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));

module.exports = {
  setupNodeModules: function (directory) {
    return function () {
      return fs.copyAsync(path.join(__dirname, 'fixture', 'node_modules'), path.join(directory, 'node_modules'));
    };
  },

  setupGrunt: function (directory) {
    var binGrunt = path.join(directory, 'node_modules', '.bin', 'grunt');
    var realGrunt = path.join(directory, 'node_modules', 'grunt-cli', 'bin', 'grunt');
    return function () {
      return Promise.all([
        fs.unlinkAsync(binGrunt),
        fs.chmodAsync(realGrunt, parseInt('0700', 8)),
      ]).then(function () {
        return fs.symlinkAsync(realGrunt, binGrunt);
      });
    };
  },

  setupGulp: function (directory) {
    var binGulp = path.join(directory, 'node_modules', '.bin', 'gulp');
    var realGulp = path.join(directory, 'node_modules', 'gulp', 'bin', 'gulp.js');
    return function () {
      return Promise.all([
        fs.unlinkAsync(binGulp),
        fs.chmodAsync(realGulp, parseInt('0700', 8)),
      ]).then(function () {
        return fs.symlinkAsync(realGulp, binGulp);
      });
    };
  },

  _dispatchKeyboardEvent: function (type, element, key, ctrl, alt, shift, meta) {
    var charCode = key.charCodeAt(0);
    var unicode = 'U+00' + charCode.toString(16).toUpperCase();
    var e = document.createEvent('KeyboardEvent');
    e.initKeyboardEvent(type, true, true, null, unicode, 0, ctrl, alt, shift, meta);
    document.dispatchEvent(e);
  },

  keyboardEvent: function (key, opts) {
    var element = opts.element || document.activeElement;
    this._dispatchKeyboardEvent('keydown', element, key, true, true, false, false);
    this._dispatchKeyboardEvent('keypress', element, key, true, true, false, false);
    this._dispatchKeyboardEvent('keyup', element, key, true, true, false, false);
  },

  dispatchKeyboardEvent: function (target, type, eventArgs) {
    var e = document.createEvent('KeyboardEvent');
    e.initKeyboardEvent.apply(e, [ type ].concat(eventArgs));
    if (e.keyCode === 0) {
      Object.defineProperty(e, 'keyCode', {
        get: function() { return undefined; }
      });
    }
    return target.dispatchEvent(e);
  },

  keydown: function (key, opt) {
    var unicode = 'U+' + key.charCodeAt(0).toString(16);
    var element  = opt.element || document.activeElement;
    var eventArgs = [ true, true, null, unicode, 0, opt.ctrl, opt.alt, opt.shift, opt.meta ];
    this.dispatchKeyboardEvent(element, 'keydown', eventArgs);
    this.dispatchKeyboardEvent(element, 'keypress', eventArgs);
    this.dispatchKeyboardEvent(element, 'keyup', eventArgs);
  }
};
