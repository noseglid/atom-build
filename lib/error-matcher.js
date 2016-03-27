'use babel';

import { EventEmitter } from 'events';

export default class ErrorMatcher extends EventEmitter {

  constructor() {
    super();
    this.regex = null;
    this.cwd = null;
    this.stdout = null;
    this.stderr = null;
    this.currentMatch = [];
    this.firstMatchId = null;

    atom.commands.add('atom-workspace', 'build:error-match', ::this.match);
    atom.commands.add('atom-workspace', 'build:error-match-first', ::this.matchFirst);
  }

  _gotoNext() {
    if (0 === this.currentMatch.length) {
      return;
    }

    this.goto(this.currentMatch[0].id);
  }

  focusMatch(match) {
    let file = match.file;
    if (!file) {
      return this.emit('error', 'Did not match any file. Don\'t know what to open.');
    }

    const path = require('path');
    if (!path.isAbsolute(file)) {
      file = this.cwd + path.sep + file;
    }

    const row = match.line ? match.line - 1 : 0; /* Because atom is zero-based */
    const col = match.col ? match.col - 1 : 0; /* Because atom is zero-based */

    require('fs').exists(file, (exists) => {
      if (!exists) {
        return this.emit('error', 'Matched file does not exist: ' + file);
      }
      atom.workspace.open(file, {
        initialLine: row,
        initialColumn: col,
        searchAllPanes: true
      });
      this.emit('matched', match);
    });
  }

  goto(id) {
    const match = this.currentMatch.find(m => m.id === id);
    if (!match) {
      return this.emit('error', 'Can\'t find match with id ' + id);
    }

    // rotate to next match
    while (this.currentMatch[0] !== match) {
      this.currentMatch.push(this.currentMatch.shift());
    }
    this.currentMatch.push(this.currentMatch.shift());

    this.focus(match);
  }

  _parse(output) {
    const self = this;
    const matchFunction = function (match, i, string, regex) {
      match.id = 'error-match-' + self.regex.indexOf(regex) + '-' + i;
      match.line = parseInt(match.line);
      match.col = parseInt(match.col);
      this.push(match);
    };
    this.regex.forEach((regex) => {
      require('xregexp').XRegExp.forEach(output, regex, matchFunction, this.currentMatch);
    });

    this.currentMatch.sort((a, b) => a.index - b.index);

    if (!this.firstMatchId) {
      this.firstMatchId = (this.currentMatch.length > 0) ? this.currentMatch[0].id : null;
    }
  }

  set(regex, cwd) {
    this.currentMatch = [];
    regex = regex || [];
    regex = (regex instanceof Array) ? regex : [ regex ];

    this.regex = regex.map((r) => {
      try {
        const XRegExp = require('xregexp').XRegExp;
        return XRegExp(r);
      } catch (err) {
        this.emit('error', 'Error parsing regex. ' + err.message);
        return null;
      }
    }).filter(Boolean);

    this.cwd = cwd;
  }

  parse(output) {
    this.currentMatch = [];
    this._parse(output);
  }

  parseAdd(output) {
    this._parse(output);
  }

  match() {
    require('./google-analytics').sendEvent('errorMatch', 'match');

    this._gotoNext();
  }

  matchFirst() {
    require('./google-analytics').sendEvent('errorMatch', 'first');

    if (this.firstMatchId) {
      this.goto(this.firstMatchId);
    }
  }

  matchLast() {
    require('./google-analytics').sendEvent('errorMatch', 'last');

    focusMatch(this.currentMatch[this.currentMatch.length - 1]);
  }

  hasMatch() {
    return 0 !== this.currentMatch.length;
  }

  getMatches() {
    return this.currentMatch;
  }
}
