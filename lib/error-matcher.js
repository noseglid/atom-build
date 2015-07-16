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

  ErrorMatcher.prototype._gotoNext = function () {
    this._goto(this.currentMatch[0].id);
    this.currentMatch.push(this.currentMatch.shift());
  };

  ErrorMatcher.prototype._goto = function (id) {
    var match = _.findWhere(this.currentMatch, { id: id });
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
    this.currentMatch = [];
    var regexIndex;
    for (regexIndex in this.regex) {
      XRegExp.forEach(this.output, this.regex[regexIndex], function (match, i) {
        match.type = 'error';
        match.id = i;
        this.push(match);
      }, this.currentMatch);
    }

    var output = '';
    var lastEnd = 0;
    for (var matchIndex in this.currentMatch) {
      var match = this.currentMatch[matchIndex];

      output += _.escape(this.output.substr(lastEnd, match.index - lastEnd));
      output += '<a class=\"' + this.currentMatch[matchIndex].type + '\" id=\"' + this.currentMatch[matchIndex].id + '\">' + _.escape(match[0]) + '</a>';
      lastEnd = match.index + match[0].length;
    }
    output += _.escape(this.output.substr(lastEnd));

    this.emit('replace', output, this._goto.bind(this));
    return this.currentMatch.length;
  };

  ErrorMatcher.prototype.set = function (regex, cwd, output) {
    this.regex = [];
    for(var i in regex) {
      this.regex.push(XRegExp(regex[i]));
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

    this._gotoNext();
  };

  ErrorMatcher.prototype.matchFirst = function () {
    if (!this.regex) {
      return;
    }

    GoogleAnalytics.sendEvent('errorMatch', 'first');

    if (0 === this._parse()) {
      return;
    }

    this._gotoNext();
  };

  return ErrorMatcher;
})();
