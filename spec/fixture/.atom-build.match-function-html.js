module.exports = {
  cmd: 'echo',
  args: [ 'doughnut' ],
  name: 'from js',
  sh: true,
  functionMatch: function (terminal_output) {
    return [
      {
        file: '.atom-build.js',
        line: '5',
        type: 'Warning',
        html_message: 'mildly <b>bad</b> things',
      }
    ];
  }
};
