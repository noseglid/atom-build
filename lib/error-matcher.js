'use babel';
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
    this.firstMatchId = null;

    atom.commands.add('atom-workspace', 'build:error-match', this.match.bind(this));
    atom.commands.add('atom-workspace', 'build:error-match-first', this.matchFirst.bind(this));
  }

  util.inherits(ErrorMatcher, EventEmitter);

  ErrorMatcher.prototype._gotoNext = function () {
    if (0 === this.currentMatch.length) {
      return;
    }

    this.goto(this.currentMatch[0].id);
  };

  ErrorMatcher.prototype.goto = function (id) {
    var match = _.findWhere(this.currentMatch, { id: id });
    if (!match) {
      return this.emit('error', 'Can\'t find match with id ' + id);
    }

    // rotate to next match
    while (this.currentMatch[0] !== match) {
      this.currentMatch.push(this.currentMatch.shift());
    }
    this.currentMatch.push(this.currentMatch.shift());

    if (!match.file) {
      return this.emit('error', 'Did not match any file. Don\'t know what to open.');
    }

    if (!path.isAbsolute(match.file)) {
      match.file = this.cwd + path.sep + match.file;
    }

    var row = match.line ? match.line - 1 : 0; /* Because atom is zero-based */
    var col =  match.col ? match.col - 1 : 0; /* Because atom is zero-based */

    fs.exists(match.file, function (exists) {
      if (!exists) {
        return this.emit('error', 'Matched file does not exist: ' + match.file);
      }
      atom.workspace.open(match.file, {
        initialLine: row,
        initialColumn: col,
        searchAllPanes: true
      });
      this.emit('matched', match.id);
    }.bind(this));
  };

  ErrorMatcher.prototype._parse = function () {
    this.currentMatch = [];
    var self = this;
    var matchFunction = function (match, i, string, regex) {
      match.id = 'error-match-' + self.regex.indexOf(regex) + '-' + i;
      this.push(match);
    };
    this.regex.forEach((regex) => {
      XRegExp.forEach(this.output, regex, matchFunction, this.currentMatch);
    });

    this.currentMatch.sort(function(a, b) {
      return a.index - b.index;
    });

    this.firstMatchId = (this.currentMatch.length > 0) ? this.currentMatch[0].id : null;

    _.forEach(this.currentMatch, (match, index) => {
      this.emit('match', match[0], match.id);
    });
  };

  ErrorMatcher.prototype.set = function (regex, cwd, output) {
    if (!regex) {
      regex = [];
    }
    regex = (regex instanceof Array) ? regex : [ regex ];

    this.regex = _.compact(regex.map(function(r) {
      try {
        return XRegExp(r);
      } catch (err) {
        this.emit('error', 'Error parsing regex. ' + err.message);
        return null;
      }
    }.bind(this)));

    this.cwd = cwd;
    this.output = output;
    this.currentMatch = [];

    this._parse();
  };

  ErrorMatcher.prototype.match = function () {
    GoogleAnalytics.sendEvent('errorMatch', 'match');

    this._gotoNext();
  };

  ErrorMatcher.prototype.matchFirst = function () {
    GoogleAnalytics.sendEvent('errorMatch', 'first');

    if (this.firstMatchId) {
      this.goto(this.firstMatchId);
    }
  };

  return ErrorMatcher;
})();
