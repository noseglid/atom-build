'use babel';

import fs from 'fs';
import path from 'path';

const uniquifySettings = (settings) => {
  const genName = (name, index) => `${name} - ${index}`;
  const newSettings = [];
  settings.forEach(setting => {
    let i = 0;
    let testName = setting.name;
    while (newSettings.find(ns => ns.name === testName)) { // eslint-disable-line no-loop-func
      testName = genName(setting.name, ++i);
    }
    newSettings.push({ ...setting, name: testName });
  });
  return newSettings;
};

const activePath = () => {
  const textEditor = atom.workspace.getActiveTextEditor();
  if (!textEditor || !textEditor.getPath()) {
    /* default to building the first one if no editor is active */
    if (0 === atom.project.getPaths().length) {
      return false;
    }

    return atom.project.getPaths()[0];
  }

  /* otherwise, build the one in the root of the active editor */
  return atom.project.getPaths().sort((a, b) => (b.length - a.length)).find(p => {
    try {
      const realpath = fs.realpathSync(p);
      return textEditor.getPath().substr(0, realpath.length) === realpath;
    } catch (err) {
      /* Path no longer available. Possible network volume has gone down */
      return false;
    }
  });
};

const getDefaultSettings = (cwd, setting) => {
  return Object.assign({}, setting, {
    env: setting.env || {},
    args: setting.args || [],
    cwd: setting.cwd || cwd,
    sh: (undefined === setting.sh) ? true : setting.sh,
    errorMatch: setting.errorMatch || ''
  });
};

const replace = (value = '', targetEnv) => {
  if (!(typeof value === 'string')) {
    return value;
  }

  const env = Object.assign({}, process.env, targetEnv);
  value = value.replace(/\$(\w+)/g, function (match, name) {
    return name in env ? env[name] : match;
  });

  const editor = atom.workspace.getActiveTextEditor();

  const projectPaths = atom.project.getPaths().map(projectPath => {
    try {
      return fs.realpathSync(projectPath);
    } catch (e) { /* Do nothing. */ }
    return null;
  });

  let projectPath = projectPaths[0];
  if (editor && (undefined !== editor.getPath())) {
    const activeFile = fs.realpathSync(editor.getPath());
    const activeFilePath = path.dirname(activeFile);
    projectPath = projectPaths.find(p => activeFilePath && activeFilePath.startsWith(p));
    value = value.replace(/{FILE_ACTIVE}/g, activeFile);
    value = value.replace(/{FILE_ACTIVE_PATH}/g, activeFilePath);
    value = value.replace(/{FILE_ACTIVE_NAME}/g, path.basename(activeFile));
    value = value.replace(/{FILE_ACTIVE_NAME_BASE}/g, path.basename(activeFile, path.extname(activeFile)));
    value = value.replace(/{SELECTION}/g, editor.getSelectedText());
  }
  value = value.replace(/{PROJECT_PATH}/g, projectPath);
  if (atom.project.getRepositories[0]) {
    value = value.replace(/{REPO_BRANCH_SHORT}/g, atom.project.getRepositories()[0].getShortHead());
  }

  return value;
};

export { uniquifySettings, activePath, getDefaultSettings, replace };
