module.exports = {
  cmd: 'echo',
  args: [ 'cake' ],
  name: 'from js',
  sh: true,
  functionMatch: function (terminal_output) {
    return [
        {
            file: '.atom-build.js',
            line: '1',
            col: '5',
        },
        {
            file: '.atom-build.js',
            line: '2',
        },
        {
            file: '.atom-build.js',
            line: '5',
        }
    ];
  }
};
