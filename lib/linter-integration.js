'use babel';

class Linter {
  constructor(registry) {
    this.linter = registry.register({ name: 'Build' });
  }
  destroy() {
    this.linter.dispose();
  }
  clear() {
    this.linter.deleteMessages();
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
    this.linter.setMessages(messages.map(match => ({
      type: match.type || 'Error',
      text: !match.message && !match.html_message ? 'Error from build' : match.message,
      html: match.message ? undefined : match.html_message,
      filePath: normalizePath(match.file),
      severity: typeToSeverity(match.type),
      range: extractRange(match),
      trace: match.trace && match.trace.map(trace => ({
        type: trace.type || 'Trace',
        text: !trace.message && !trace.html_message ? 'Trace in build' : trace.message,
        html: trace.message ? undefined : trace.html_message,
        filePath: trace.file && normalizePath(trace.file),
        severity: typeToSeverity(trace.type) || 'info',
        range: extractRange(trace)
      }))
    })));
  }
}

export default Linter;
