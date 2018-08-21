'use babel';

import { CompositeDisposable } from 'atom';

class Linter {
  constructor(registry) {
    const _this = this;
    this.linter = registry({ name: 'Build' });
    this.subscriptions = new CompositeDisposable();

    // Setting and clearing messages per filePath
    this.subscriptions.add(atom.workspace.observeTextEditors(function (textEditor) {
      _this.editorPath = textEditor.getPath();
      if (!_this.editorPath) {
        return;
      }
      const subscription = textEditor.onDidDestroy(function () {
        _this.subscriptions.remove(subscription);
        _this.linter.setMessages(_this.editorPath, []);
      });
      _this.subscriptions.add(subscription);
    }));
  }
  destroy() {
    // this.linter.dispose();
    this.subscriptions.dispose();
  }
  clear() {
    this.linter.clearMessages();
  }
  processMessages(messages, cwd) {
    function extractRange(json) {
      return [
        [ (json.line || 1) - 1, (json.col || 1) - 1 ],
        [ (json.line_end || json.line || 1) - 1, (json.col_end || json.col || 1) - 1 ]
      ];
    }
    function normalizePath(p) {
      return require('path').isAbsolute(p) ? p : require('path').join(cwd, p);
    }
    function typeToSeverity(type) {
      switch (type && type.toLowerCase()) {
        case 'err':
        case 'error': return 'error';
        case 'warn':
        case 'warning': return 'warning';
        default: return null;
      }
    }
    this.linter.setMessages(this.editorPath, (messages.map(match => ({
      severity: typeToSeverity(match.type) || 'info',
      location: {
        file: normalizePath(match.file),
        position: extractRange(match)
      },
      excerpt: !match.message && !match.html_message
        ? 'Error from build'
        : match.message,
      description: match.message
        ? undefined
        : match.html_message
    }))));
  }
}

export default Linter;
