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

    this._goto(this.currentMatch[0].id);
  };

  ErrorMatcher.prototype._goto = function (id) {
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
      this.emit('scroll', match.type, match.id);
    }.bind(this));
  };

  ErrorMatcher.prototype._parse = function (output, htmlOutput) {
    // this parsing is a little bit tricky, because the content of the build-panel
    // can contain html-tags (from converting ansi colors)
    // output contains the pure text without html-tags, where we let the regexes search for matches
    // outputHTML contains content of the build-panel with the targets
    this.currentMatch = [];
    var matchFunction = function (match, i) {
      match.type = 'error';
      match.id = 'error-' + regexIndex + '-' + i;
      this.push(match);
    };
    for (var regexIndex in this.regex) {
      XRegExp.forEach(output, this.regex[regexIndex], matchFunction, this.currentMatch);
    }

    this.currentMatch.sort(function(a, b) {
      return a.index - b.index;
    });

    this.firstMatchId = (this.currentMatch.length > 0) ? this.currentMatch[0].id : null;

    // this assumes, there are no selfclosing tags (like <br />) in htmlOutput
    // ansi-to-html doesn't create such tags
    var tags = XRegExp.forEach(htmlOutput, /<(\/)?([a-zA-Z_]+)[^>]*?>/g, function (match) {
      match.closing = !!match[1];
      match.tagname = match[2];
      this.push(match);
    }, []);

    var newOutput = '';
    var index = 0; // index in output
    var htmlIndex = 0; // index in htmlOutput
    var tagIndex = 0; // index in tags
    var openTags = []; // currently open tags

    // the chrarcters ', " and ` are escaped by lodash
    // but, if we read the html from the build-panel, these characters aren't escaped anymore
    // so we have to write our own escape function, which only escapes the characters,
    // which stay escaped in the html (&, <, >)
    // see: https://lodash.com/docs#escape
    var escape = function (string) {
      return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var advance = function (destIndex) {
      var prevHtmlIndex = htmlIndex;
      // advance htmlIndex to be the equivalent for index in htmlOutput (minus tags)
      // it is important, that escape escapes exactly the same chars as atom, or htmlIndex is wrong
      htmlIndex += escape(output.substr(index, destIndex - index)).length;
      index = destIndex;
      while (tagIndex < tags.length && tags[tagIndex].index <= htmlIndex)
      {
        var tag = tags[tagIndex];
        if (tag.closing) {
          // we assume, that the html is well formed, because we took it directly out of the build-panel
          openTags.pop();
        } else {
          openTags.push(tag);
        }
        htmlIndex += tag[0].length;
        tagIndex += 1;
      }

      return htmlOutput.substr(prevHtmlIndex, htmlIndex - prevHtmlIndex);
    };
    for (var matchIndex in this.currentMatch) {
      var match = this.currentMatch[matchIndex];

      if (match.index < index) {
        // overlapping matches, only highlight first
        continue;
      }

      newOutput += advance(match.index);

      // close all openTags and reopen them inside the <a>-tag
      // otherwise the style of the <a> would override the style of the enclosing spans
      for (var i in openTags) {
        newOutput += '</' + openTags[i].tagname + '>';
      }
      newOutput += util.format('<a class="%s" id="%s">', match.type, match.id);
      for (i in openTags) {
        newOutput += openTags[i][0];
      }

      newOutput += advance(match.index + match[0].length);

      for (i in openTags) {
        newOutput += '</' + openTags[i].tagname + '>';
      }
      newOutput += '</a>';
      for (i in openTags) {
        newOutput += openTags[i][0];
      }
    }
    newOutput += htmlOutput.substr(htmlIndex);

    this.emit('replace', newOutput, this._goto.bind(this));
  };

  ErrorMatcher.prototype.set = function (regex, cwd, output, htmlOutput) {
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
    this.currentMatch = [];

    this._parse(output, htmlOutput);
  };

  ErrorMatcher.prototype.match = function () {
    GoogleAnalytics.sendEvent('errorMatch', 'match');

    this._gotoNext();
  };

  ErrorMatcher.prototype.matchFirst = function () {
    GoogleAnalytics.sendEvent('errorMatch', 'first');

    if (this.firstMatchId) {
      this._goto(this.firstMatchId);
    }
  };

  return ErrorMatcher;
})();
