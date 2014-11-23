/* jshint newcap:false */
var __hasProp = {}.hasOwnProperty;

module.exports.extends = function(child, parent) {
  'use strict';
  for (var key in parent) {
    if (__hasProp.call(parent, key)) {
      child[key] = parent[key];
    }
  }
  function ctor() {
    /* jshint validthis:true */
    this.constructor = child;
  }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  child.__super__ = parent.prototype;
  return child;
};
