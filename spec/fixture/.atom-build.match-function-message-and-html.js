module.exports = {
  cmd: 'echo',
  args: [ 'pancake' ],
  name: 'from js',
  sh: true,
  functionMatch: function (terminal_output) {
    return [
      {
        file: '.atom-build.js',
        line: '5',
        type: 'Warning',
        message: 'something happened in plain text',
        html_message: 'something happened in <b>html</b>',
      }
    ];
  }
};
