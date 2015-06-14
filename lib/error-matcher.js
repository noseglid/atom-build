'use strict';

var fs = require('fs');
var path = require('path');
var XRegExp = require('xregexp').XRegExp;
var GoogleAnalytics = require('./google-analytics');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = (function () {

  function ErrorMatcher() {
    this.regex = null;
    this.cwd = null;
    this.stdout = null;
    this.stderr = null;
    this.currentMatch = [];

    atom.commands.add('atom-workspace', 'build:error-match', this.match.bind(this));
    atom.commands.add('atom-workspace', 'build:error-match-first', this.matchFirst.bind(this));
  }

  util.inherits(ErrorMatcher, EventEmitter);

  ErrorMatcher.prototype._goto = function () {
    var file = this.currentMatch[0].file;
    if (file) {
      var oldDir = process.cwd();
      process.chdir(this.cwd);
      try {
        file = fs.realpathSync(file);
      } catch (e) {
        file = this.cwd + path.sep + file;
      }
      process.chdir(oldDir);
    } else {
      file = this.currentMatch[0].absFile;
      if (!file) {
        return this.emit('error', 'Did not match any file. Don\'t know what to open.');
      }
    }

    var row = this.currentMatch[0].line ? this.currentMatch[0].line - 1 : 0; /* Because atom is zero-based */
    var col =  this.currentMatch[0].col ? this.currentMatch[0].col - 1 : 0; /* Because atom is zero-based */

    fs.exists(file, function (exists) {
      if (!exists) {
        return this.emit('error', 'Matched file does not exist: ' + file);
      }
      atom.workspace.open(file, {
        initialLine: row,
        initialColumn: col,
        searchAllPanes: true
      });
      this.currentMatch.push(this.currentMatch.shift());
    }.bind(this));
  };

  ErrorMatcher.prototype._parse = function () {
    this.currentMatch = XRegExp.forEach(this.output, this.regex, function (match) {
      this.push(match);
    }, []);
    return this.currentMatch.length;
  };

  ErrorMatcher.prototype.set = function (regex, cwd, output) {
    this.regex = XRegExp(regex);
    this.cwd = cwd;
    this.output = output;
    this.currentMatch = [];
  };

  ErrorMatcher.prototype.match = function () {
    if (!this.regex) {
      return;
    }

    GoogleAnalytics.sendEvent('errorMatch', 'match');

    if (0 === this.currentMatch.length && 0 === this._parse()) {
      return;
    }

    this._goto();
  };

  ErrorMatcher.prototype.matchFirst = function () {
    if (!this.regex) {
      return;
    }

    GoogleAnalytics.sendEvent('errorMatch', 'first');

    if (0 === this._parse()) {
      return;
    }

    this._goto();
  };

  return ErrorMatcher;
})();
