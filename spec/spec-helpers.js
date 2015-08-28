'use babel';
'use strict';

module.exports = {
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
  },

  vouch: function vouch(fn /* args... */) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function(resolve, reject) {
      args.push(function(err, result) {
        if (err) {
          return reject(err);
        }
        resolve(result);
      });
      fn.apply(null, args);
    });
  }
};
