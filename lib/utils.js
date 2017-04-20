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

const getReplacements = () => {
  const editor = atom.workspace.getActiveTextEditor();

  const projectPaths = atom.project.getPaths().map(projectPath => {
    try {
      return fs.realpathSync(projectPath);
    } catch (e) { /* Do nothing. */ }
    return null;
  });

  const replacements = {
    PROJECT_PATH: projectPaths[0]
  };

  if (editor && (undefined !== editor.getPath())) {
    replacements.FILE_ACTIVE = fs.realpathSync(editor.getPath());
    replacements.FILE_ACTIVE_PATH = path.dirname(replacements.FILE_ACTIVE);
    replacements.PROJECT_PATH = projectPaths.find(p => replacements.FILE_ACTIVE_PATH && replacements.FILE_ACTIVE_PATH.startsWith(p));
    replacements.FILE_ACTIVE_NAME = path.basename(replacements.FILE_ACTIVE);
    replacements.FILE_ACTIVE_NAME_BASE = path.basename(replacements.FILE_ACTIVE, path.extname(replacements.FILE_ACTIVE));
    replacements.SELECTION = editor.getSelectedText();
  }
  if (atom.project.getRepositories[0]) {
    replacements.REPO_BRANCH_SHORT = atom.project.getRepositories()[0].getShortHead();
  }

  return replacements;
};

const replace = (value = '', targetEnv) => {
  if (!(typeof value === 'string')) {
    return value;
  }

  const env = Object.assign({}, process.env, targetEnv);
  value = value.replace(/\$(\w+)/g, function (match, name) {
    return name in env ? env[name] : match;
  });

  const replacements = getReplacements();

  Object.keys(replacements).forEach(key => {
    value = value.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
  });

  return value;
};

export { uniquifySettings, activePath, getDefaultSettings, getReplacements, replace };
