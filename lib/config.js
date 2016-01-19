'use babel';

export default {
  panelVisibility: {
    title: 'Panel Visibility',
    description: 'Set when the build panel should be visible.',
    type: 'string',
    default: 'Toggle',
    enum: [ 'Toggle', 'Keep Visible', 'Show on Error', 'Hidden' ],
    order: 1
  },
  buildOnSave: {
    title: 'Automatically build on save',
    description: 'Automatically build your project each time an editor is saved.',
    type: 'boolean',
    default: false,
    order: 2
  },
  saveOnBuild: {
    title: 'Automatically save on build',
    description: 'Automatically save all edited files when triggering a build.',
    type: 'boolean',
    default: false,
    order: 3
  },
  matchedErrorFailsBuild: {
    title: 'Any matched error will fail the build',
    description: 'Even if the build has a return code of zero it is marked as "failed" if any error is being matched in the output.',
    type: 'boolean',
    default: true,
    order: 4
  },
  scrollOnError: {
    title: 'Automatically scroll on build error',
    description: 'Automatically scroll to first matched error when a build failed.',
    type: 'boolean',
    default: false,
    order: 5
  },
  stealFocus: {
    title: 'Steal Focus',
    description: 'Steal focus when opening build panel.',
    type: 'boolean',
    default: true,
    order: 6
  },
  selectTriggers: {
    title: 'Selecting new target triggers the build',
    description: 'When selecting a new target (through status-bar, cmd-alt-t, etc), the newly selected target will be triggered.',
    type: 'boolean',
    default: true,
    order: 7
  },
  notificationOnRefresh: {
    title: 'Show notification when targets are refreshed',
    description: 'When targets are refreshed a notification with information about the number of targets will be displayed.',
    type: 'boolean',
    default: false,
    order: 8
  },
  monocleHeight: {
    title: 'Monocle Height',
    description: 'How much of the workspace to use for build panel when it is "maximized".',
    type: 'number',
    default: 0.75,
    minimum: 0.1,
    maximum: 0.9,
    order: 9
  },
  minimizedHeight: {
    title: 'Minimized Height',
    description: 'How much of the workspace to use for build panel when it is "minimized".',
    type: 'number',
    default: 0.15,
    minimum: 0.1,
    maximum: 0.9,
    order: 10
  },
  panelOrientation: {
    title: 'Panel Orientation',
    description: 'Where to attach the build panel',
    type: 'string',
    default: 'Bottom',
    enum: [ 'Bottom', 'Top', 'Left', 'Right' ],
    order: 11
  },
  statusBar: {
    title: 'Status Bar',
    description: 'Where to place the status bar. Set to `Disable` to disable status bar display.',
    type: 'string',
    default: 'Left',
    enum: [ 'Left', 'Right', 'Disable' ],
    order: 12
  },
  statusBarPriority: {
    title: 'Priority on Status Bar',
    description: 'Lower priority tiles are placed further to the left/right, depends on where you choose to place Status Bar.',
    type: 'number',
    default: -1000,
    order: 13
  }
};
