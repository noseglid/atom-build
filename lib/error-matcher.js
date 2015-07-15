'use strict';

var fs = require('fs');
var path = require('path');
var XRegExp = require('xregexp').XRegExp;
var GoogleAnalytics = require('./google-analytics');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');

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
    var match = this.currentMatch[0];
    if (match.absFile) {
      atom.notifications.addWarning('`absFile` is deprecated.', {
        detail: 'You should name your match `file` only. It handles both relative and absolute paths.'
      });
    }

    if (!match.file && !match.absFile) {
      return this.emit('error', 'Did not match any file. Don\'t know what to open.');
    }

    var file = match.file ? match.file : match.absFile;
    if (!path.isAbsolute(file)) {
      file = this.cwd + path.sep + file;
    }

    var row = match.line ? match.line - 1 : 0; /* Because atom is zero-based */
    var col =  match.col ? match.col - 1 : 0; /* Because atom is zero-based */

    this.currentMatch.push(this.currentMatch.shift());

    fs.exists(file, function (exists) {
      if (!exists) {
        return this.emit('error', 'Matched file does not exist: ' + file);
      }
      atom.workspace.open(file, {
        initialLine: row,
        initialColumn: col,
        searchAllPanes: true
      });
      this.emit('scroll', match.type, match.id);
    }.bind(this));
  };

  ErrorMatcher.prototype._parse = function () {
    this.currentMatch = XRegExp.forEach(this.output, this.regex, function (match, i) {
      match.type = 'error';
      match.id = i;
      this.push(match);
    }, []);
    var output = _.escape(this.output);
    var matchIndex;
    for (matchIndex in this.currentMatch) {
      var search = _.escape(this.currentMatch[matchIndex][0]);
      var replace = '<b class=\"' + this.currentMatch[matchIndex].type + '\" id=\"' + this.currentMatch[matchIndex].id + '\">$&</b>';
      output = output.replace(search, replace);
    }
    this.emit('replace', output);
    return this.currentMatch.length;
  };

  ErrorMatcher.prototype.set = function (regex, cwd, output) {
    try {
      this.regex = XRegExp(regex);
    } catch (err) {
      this.regex = null;
      return this.emit('error', 'Error parsing regex:\n' + err);
    }
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
