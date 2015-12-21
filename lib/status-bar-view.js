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

    this.statusBarTile = this.statusBar[`add${orientation}Tile`]({ item: this, priority: atom.config.get('build.statusBarPriority') });

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
      this.span({ outlet: 'targetView' });
      this.a({ click: 'clicked', outlet: 'message'});
    });
  }

  tooltipMessage() {
    const statusMessage = undefined === this.success ? '' : `Last build ${this.success ? 'succeeded' : 'failed'}!`;
    return `Current build target is '${this.element.textContent}'<br />${statusMessage}`;
  }

  setTarget(t) {
    this.target = t;
    this.message.text(t);
    this.targetView.removeClass('status-unknown status-success status-error icon-check icon-flame');
  }

  setBuildSuccess(success) {
    this.success = success;
    this.targetView.removeClass('status-unknown status-success status-error icon-check icon-flame');
    this.targetView.addClass(success ? 'status-success icon-check' : 'status-error icon-flame');
  }

  onClick(cb) {
    this.onClick = cb;
  }

  clicked() {
    this.onClick && this.onClick();
  }
}
