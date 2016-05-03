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
  hidePanelHeading: {
    title: 'Hide panel heading',
    description: 'Set whether to hide the build command and control buttons in the build panel',
    type: 'boolean',
    default: false,
    order: 2
  },
  buildOnSave: {
    title: 'Automatically build on save',
    description: 'Automatically build your project each time an editor is saved.',
    type: 'boolean',
    default: false,
    order: 3
  },
  saveOnBuild: {
    title: 'Automatically save on build',
    description: 'Automatically save all edited files when triggering a build.',
    type: 'boolean',
    default: false,
    order: 4
  },
  matchedErrorFailsBuild: {
    title: 'Any matched error will fail the build',
    description: 'Even if the build has a return code of zero it is marked as "failed" if any error is being matched in the output.',
    type: 'boolean',
    default: true,
    order: 5
  },
  scrollOnError: {
    title: 'Automatically scroll on build error',
    description: 'Automatically scroll to first matched error when a build failed.',
    type: 'boolean',
    default: false,
    order: 6
  },
  stealFocus: {
    title: 'Steal Focus',
    description: 'Steal focus when opening build panel.',
    type: 'boolean',
    default: true,
    order: 7
  },
  overrideThemeColors: {
    title: 'Override Theme Colors',
    description: 'Override theme background- and text color inside the terminal',
    type: 'boolean',
    default: true,
    order: 8
  },
  selectTriggers: {
    title: 'Selecting new target triggers the build',
    description: 'When selecting a new target (through status-bar, cmd-alt-t, etc), the newly selected target will be triggered.',
    type: 'boolean',
    default: true,
    order: 9
  },
  refreshOnShowTargetList: {
    title: 'Refresh targets when the target list is shown',
    description: 'When opening the targets menu, the targets will be refreshed.',
    type: 'boolean',
    default: false,
    order: 10
  },
  notificationOnRefresh: {
    title: 'Show notification when targets are refreshed',
    description: 'When targets are refreshed a notification with information about the number of targets will be displayed.',
    type: 'boolean',
    default: false,
    order: 11
  },
  beepWhenDone: {
    title: 'Beep when the build completes',
    description: 'Make a "beep" notification sound when the build is complete - in success or failure.',
    type: 'boolean',
    default: false,
    order: 12
  },
  panelOrientation: {
    title: 'Panel Orientation',
    description: 'Where to attach the build panel',
    type: 'string',
    default: 'Bottom',
    enum: [ 'Bottom', 'Top', 'Left', 'Right' ],
    order: 13
  },
  statusBar: {
    title: 'Status Bar',
    description: 'Where to place the status bar. Set to `Disable` to disable status bar display.',
    type: 'string',
    default: 'Left',
    enum: [ 'Left', 'Right', 'Disable' ],
    order: 14
  },
  statusBarPriority: {
    title: 'Priority on Status Bar',
    description: 'Lower priority tiles are placed further to the left/right, depends on where you choose to place Status Bar.',
    type: 'number',
    default: -1000,
    order: 15
  },
  terminalScrollback: {
    title: 'Terminal Scrollback Size',
    description: 'Max number of lines of build log kept in the terminal',
    type: 'number',
    default: 1000,
    order: 16
  }
};
