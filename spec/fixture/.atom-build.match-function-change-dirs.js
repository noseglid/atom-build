module.exports = {
  cmd: 'cat',
  args: [ 'change_dir_output.txt' ],
  name: 'change dir',
  sh: true,
  functionMatch: function (output) {
    const enterDir = /^make\[\d+\]: Entering directory '([^']+)'$/;
    const error = /^([^:]+):(\d+):(\d+): error: (.+)$/;
    const array = [];
    var dir = null;
    output.split(/\r?\n/).forEach(line => {
      const dir_match = enterDir.exec(line);
      if (dir_match) {
        dir = dir_match[1];
      } else {
        const error_match = error.exec(line);
        if (error_match) {
          array.push({
            file: dir ? dir + '/' + error_match[1] : error_match[1],
            line: error_match[2],
            col: error_match[3],
            message: error_match[4],
          });
        }
      }
    });
    return array;
  }
};
