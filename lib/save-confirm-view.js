'use babel';

import { View } from 'atom-space-pen-views';

export default class SaveConfirmView extends View {
  static content() {
    this.div({ class: 'build-confirm overlay from-top' }, () => {
      this.h3('You have unsaved changes');
      this.div({ class: 'btn-container pull-right' }, () => {
        this.button({ class: 'btn btn-success', outlet: 'saveBuildButton', title: 'Save and Build', click: 'saveAndConfirm' }, 'Save and build');
        this.button({ class: 'btn btn-info', title: 'Build Without Saving', click: 'confirmWithoutSave' }, 'Build Without Saving');
      });
      this.div({ class: 'btn-container pull-left' }, () => {
        this.button({ class: 'btn btn-info', title: 'Cancel', click: 'cancel' }, 'Cancel');
      });
    });
  }

  destroy() {
    this.confirmcb = undefined;
    this.cancelcb = undefined;
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  }

  show(confirmcb, cancelcb) {
    this.confirmcb = confirmcb;
    this.cancelcb = cancelcb;

    this.panel = atom.workspace.addTopPanel({
      item: this
    });
    this.saveBuildButton.focus();
  }

  cancel() {
    this.destroy();
    if (this.cancelcb) {
      this.cancelcb();
    }
  }

  saveAndConfirm() {
    if (this.confirmcb) {
      this.confirmcb(true);
    }
    this.destroy();
  }

  confirmWithoutSave() {
    if (this.confirmcb) {
      this.confirmcb(false);
    }
    this.destroy();
  }
}
