'use babel';

import EventEmitter from 'events';

class TargetManager extends EventEmitter {
  constructor() {
    super();

    let projectPaths = atom.project.getPaths();

    this.pathTargets = projectPaths.map(path => this._defaultPathTarget(path));

    atom.project.onDidChangePaths(newProjectPaths => {
      const addedPaths = newProjectPaths.filter(el => projectPaths.indexOf(el) === -1);
      const removedPaths = projectPaths.filter(el => newProjectPaths.indexOf(el) === -1);
      addedPaths.forEach(path => this.pathTargets.push(this._defaultPathTarget(path)));
      this.pathTargets = this.pathTargets.filter(pt => -1 === removedPaths.indexOf(pt.path));
      this.refreshTargets(addedPaths);
      projectPaths = newProjectPaths;
    });

    atom.commands.add('atom-workspace', 'build:refresh-targets', () => this.refreshTargets());
    atom.commands.add('atom-workspace', 'build:select-active-target', () => this.selectActiveTarget());
  }

  setBusyRegistry(registry) {
    this.busyRegistry = registry;
  }

  _defaultPathTarget(path) {
    const CompositeDisposable = require('atom').CompositeDisposable;
    return {
      path: path,
      loading: false,
      targets: [],
      instancedTools: [],
      activeTarget: null,
      tools: [],
      subscriptions: new CompositeDisposable()
    };
  }

  destroy() {
    this.pathTargets.forEach(pathTarget => pathTarget.tools.map(tool => {
      tool.removeAllListeners && tool.removeAllListeners('refresh');
      tool.destructor && tool.destructor();
    }));
  }

  setTools(tools) {
    this.tools = tools || [];
  }

  refreshTargets(refreshPaths) {
    refreshPaths = refreshPaths || atom.project.getPaths();

    this.busyRegistry && this.busyRegistry.begin('build.refresh-targets', `Refreshing targets for ${refreshPaths.join(',')}`);
    const pathPromises = refreshPaths.map((path) => {
      const pathTarget = this.pathTargets.find(pt => pt.path === path);
      pathTarget.loading = true;

      pathTarget.instancedTools = pathTarget.instancedTools
        .map(t => t.removeAllListeners && t.removeAllListeners('refresh'))
        .filter(() => false); // Just empty the array

      const settingsPromise = this.tools
        .map(Tool => new Tool(path))
        .filter(tool => tool.isEligible())
        .map(tool => {
          pathTarget.instancedTools.push(tool);
          require('./google-analytics').sendEvent('build', 'tool eligible', tool.getNiceName());

          tool.on && tool.on('refresh', this.refreshTargets.bind(this, [ path ]));
          return Promise.resolve()
            .then(() => tool.settings())
            .catch(err => {
              if (err instanceof SyntaxError) {
                atom.notifications.addError('Invalid build file.', {
                  detail: 'You have a syntax error in your build file: ' + err.message,
                  dismissable: true
                });
              } else {
                const toolName = tool.getNiceName();
                atom.notifications.addError('Ooops. Something went wrong' + (toolName ? ' in the ' + toolName + ' build provider' : '') + '.', {
                  detail: err.message,
                  stack: err.stack,
                  dismissable: true
                });
              }
            });
        });

      const CompositeDisposable = require('atom').CompositeDisposable;
      return Promise.all(settingsPromise).then((settings) => {
        settings = require('./utils').uniquifySettings([].concat.apply([], settings)
          .filter(Boolean)
          .map(setting => require('./utils').getDefaultSettings(path, setting)));

        if (null === pathTarget.activeTarget || !settings.find(s => s.name === pathTarget.activeTarget)) {
          /* Active target has been removed or not set. Set it to the highest prio target */
          pathTarget.activeTarget = settings[0] ? settings[0].name : undefined;
        }

        // CompositeDisposable cannot be reused, so we must create a new instance on every refresh
        pathTarget.subscriptions.dispose();
        pathTarget.subscriptions = new CompositeDisposable();

        settings.forEach((setting, index) => {
          if (setting.keymap && !setting.atomCommandName) {
            setting.atomCommandName = `build:trigger:${setting.name}`;
          }

          pathTarget.subscriptions.add(atom.commands.add('atom-workspace', setting.atomCommandName, atomCommandName => this.emit('trigger', atomCommandName)));

          if (setting.keymap) {
            require('./google-analytics').sendEvent('keymap', 'registered', setting.keymap);
            const keymapSpec = { 'atom-workspace, atom-text-editor': {} };
            keymapSpec['atom-workspace, atom-text-editor'][setting.keymap] = setting.atomCommandName;
            pathTarget.subscriptions.add(atom.keymaps.add(setting.name, keymapSpec));
          }
        });

        pathTarget.targets = settings;
        pathTarget.loading = false;
      }).catch(err => {
        atom.notifications.addError('Ooops. Something went wrong.', {
          detail: err.message,
          stack: err.stack,
          dismissable: true
        });
      });
    });

    return Promise.all(pathPromises).then(entries => {
      this.fillTargets(require('./utils').activePath());
      this.emit('refresh-complete');
      this.busyRegistry && this.busyRegistry.end('build.refresh-targets');

      if (entries.length === 0) {
        return;
      }

      if (atom.config.get('build.notificationOnRefresh')) {
        const rows = refreshPaths.map(path => {
          const pathTarget = this.pathTargets.find(pt => pt.path === path);
          if (!pathTarget) {
            return `Targets ${path} no longer exists. Is build deactivated?`;
          }
          return `${pathTarget.targets.length} targets at: ${path}`;
        });
        atom.notifications.addInfo('Build targets parsed.', {
          detail: rows.join('\n')
        });
      }
    }).catch(err => {
      atom.notifications.addError('Ooops. Something went wrong.', {
        detail: err.message,
        stack: err.stack,
        dismissable: true
      });
    });
  }

  fillTargets(path) {
    if (!this.targetsView) {
      return;
    }

    const activeTarget = this.getActiveTarget(path);
    activeTarget && this.targetsView.setActiveTarget(activeTarget.name);

    this.getTargets(path)
      .then(targets => targets.map(t => t.name))
      .then(targetNames => this.targetsView && this.targetsView.setItems(targetNames));
  }

  selectActiveTarget() {
    if (atom.config.get('build.refreshOnShowTargetList')) {
      this.refreshTargets();
    }

    const path = require('./utils').activePath();
    if (!path) {
      atom.notifications.addWarning('Unable to build.', {
        detail: 'Open file is not part of any open project in Atom'
      });
      return;
    }

    const TargetsView = require('./targets-view');
    this.targetsView = new TargetsView();

    if (this.isLoading(path)) {
      this.targetsView.setLoading('Loading project build targets\u2026');
    } else {
      this.fillTargets(path);
    }

    this.targetsView.awaitSelection().then(newTarget => {
      this.setActiveTarget(path, newTarget);

      this.targetsView = null;
    }).catch((err) => {
      this.targetsView.setError(err.message);
      this.targetsView = null;
    });
  }

  getTargets(path) {
    const pathTarget = this.pathTargets.find(pt => pt.path === path);
    if (!pathTarget) {
      return Promise.resolve([]);
    }

    if (pathTarget.targets.length === 0) {
      return this.refreshTargets([ pathTarget.path ]).then(() => pathTarget.targets);
    }
    return Promise.resolve(pathTarget.targets);
  }

  getActiveTarget(path) {
    const pathTarget = this.pathTargets.find(pt => pt.path === path);
    if (!pathTarget) {
      return null;
    }
    return pathTarget.targets.find(target => target.name === pathTarget.activeTarget);
  }

  setActiveTarget(path, targetName) {
    this.pathTargets.find(pt => pt.path === path).activeTarget = targetName;
    this.emit('new-active-target', path, this.getActiveTarget(path));
  }

  isLoading(path) {
    return this.pathTargets.find(pt => pt.path === path).loading;
  }
}

export default TargetManager;
