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

  goto(id) {
    const match = this.currentMatch.find(m => m.id === id);
    if (!match) {
      this.emit('error', 'Can\'t find match with id ' + id);
      return;
    }

    // rotate to next match
    while (this.currentMatch[0] !== match) {
      this.currentMatch.push(this.currentMatch.shift());
    }
    this.currentMatch.push(this.currentMatch.shift());

    let file = match.file;
    if (!file) {
      this.emit('error', 'Did not match any file. Don\'t know what to open.');
      return;
    }

    const path = require('path');
    if (!path.isAbsolute(file)) {
      file = this.cwd + path.sep + file;
    }

    const row = match.line ? match.line - 1 : 0; /* Because atom is zero-based */
    const col = match.col ? match.col - 1 : 0; /* Because atom is zero-based */

    require('fs').exists(file, (exists) => {
      if (!exists) {
        this.emit('error', 'Matched file does not exist: ' + file);
        return;
      }
      atom.workspace.open(file, {
        initialLine: row,
        initialColumn: col,
        searchAllPanes: true
      });
      this.emit('matched', match);
    });
  }

  _parse() {
    this.currentMatch = [];
    const self = this;
    const matchFunction = function (match, i, string, regex) {
      match.id = 'error-match-' + self.regex.indexOf(regex) + '-' + i;
      this.push(match);
    };
    this.regex.forEach((regex) => {
      if (typeof regex === 'function') {
        regex(this.output).forEach(function (match) {
          this.push(match);
        }.bind(this.currentMatch));
      } else {
        require('xregexp').forEach(this.output, regex, matchFunction.bind(this.currentMatch));
      }
    });

    this.currentMatch.sort((a, b) => a.index - b.index);

    this.firstMatchId = (this.currentMatch.length > 0) ? this.currentMatch[0].id : null;
  }

  set(regex, cwd, output) {
    regex = regex || [];
    regex = (regex instanceof Array) ? regex : [ regex ];

    this.regex = regex.map((r) => {
      if (typeof r === 'function') {
        return r;
      }
      try {
        const XRegExp = require('xregexp');
        return XRegExp(r);
      } catch (err) {
        this.emit('error', 'Error parsing regex. ' + err.message);
        return null;
      }
    }).filter(Boolean);

    this.cwd = cwd;
    this.output = output;
    this.currentMatch = [];

    this._parse();
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

  hasMatch() {
    return 0 !== this.currentMatch.length;
  }

  getMatches() {
    return this.currentMatch;
  }
}
