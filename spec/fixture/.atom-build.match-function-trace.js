module.exports = {
  cmd: 'echo',
  args: [ 'cake' ],
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
            message: 'insert great explanation here',
          }
        ],
      }
    ];
  }
};
