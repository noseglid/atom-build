'use strict';

module.exports.niceName = 'Markdown';

module.exports.isEligable = function (path) {
  var textEditor = atom.workspace.getActiveTextEditor();
  if (!textEditor || !textEditor.getPath()) {
    return false;
  }
  var path = textEditor.getPath();
  return path.endsWith('.md') || path.endsWith('.mkd');
};

module.exports.settings = function (path) {
  return [ {
    name: 'Markdown: view',
    exec: 'mark',
    args: [ '{FILE_ACTIVE}' ]
  }];
};
