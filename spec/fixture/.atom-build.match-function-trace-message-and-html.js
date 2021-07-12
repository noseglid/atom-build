module.exports = {
  cmd: 'echo',
  args: [ 'pancake' ],
  name: 'from js',
  sh: true,
  functionMatch: function (terminal_output) {
    return [
      {
        file: '.atom-build.js',
        line: '6',
        type: 'Error',
        trace: [
          {
            type: 'Explanation',
            message: 'insert plain text explanation here',
            html_message: 'insert <i>html</i> explanation here',
          }
        ],
      }
    ];
  }
};
