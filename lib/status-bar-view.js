'use babel';

import { View } from 'atom-space-pen-views';

export default class StatusBarView extends View {
  constructor(statusBar, ...args) {
    super(...args);
    this.statusBar = statusBar;
    atom.config.observe('build.statusBar', () => this.attach());
    atom.config.observe('build.statusBarPriority', () => this.attach());
  }

  attach() {
    this.destroy();

    const orientation = atom.config.get('build.statusBar');
    if ('Disable' === orientation) {
      return;
    }

    this.statusBarTile = this.statusBar[`add${orientation}Tile`]({
      item: this,
      priority: atom.config.get('build.statusBarPriority')
    });

    this.tooltip = atom.tooltips.add(this, {
      title: () => this.tooltipMessage()
    });
  }

  destroy() {
    if (this.statusBarTile) {
      this.statusBarTile.destroy();
      this.statusBarTile = null;
    }

    if (this.tooltip) {
      this.tooltip.dispose();
      this.tooltip = null;
    }
  }

  static content() {
    this.div({ id: 'build-status-bar', class: 'inline-block' }, () => {
      this.a({ click: 'clicked', outlet: 'message'});
    });
  }

  tooltipMessage() {
    return `Current build target is '${this.element.textContent}'`;
  }

  setClasses(classes) {
    this.removeClass('status-unknown status-success status-error');
    this.addClass(classes);
  }

  setTarget(t) {
    if (this.target === t) {
      return;
    }

    this.target = t;
    this.message.text(t || '');
    this.setClasses();
  }

  buildAborted() {
    this.setBuildSuccess(false);
  }

  setBuildSuccess(success) {
    this.setClasses(success ? 'status-success' : 'status-error');
  }

  buildStarted() {
    this.setClasses();
  }

  onClick(cb) {
    this.onClick = cb;
  }

  clicked() {
    this.onClick && this.onClick();
  }
}
