'use babel';
'use strict';

var View = require('atom-space-pen-views').View;
var cscompatability = require('./cscompatability');

module.exports = (function() {
  function SaveConfirmView() {
    View.apply(this, arguments);
  }

  cscompatability.extends(SaveConfirmView, View);

  SaveConfirmView.content = function() {
    SaveConfirmView.div({ class: 'build-confirm overlay from-top' }, function() {
      SaveConfirmView.h3('You have unsaved changes');
      SaveConfirmView.div({ class: 'btn-container pull-right' }, function() {
        SaveConfirmView.button({ class: 'btn btn-success', outlet: 'saveBuildButton', title: 'Save and Build', click: 'saveAndConfirm' }, 'Save and build');
        SaveConfirmView.button({ class: 'btn btn-info', title: 'Build Without Saving', click: 'confirmWithoutSave' }, 'Build Without Saving');
      });
      SaveConfirmView.div({ class: 'btn-container pull-left' }, function() {
        SaveConfirmView.button({ class: 'btn btn-info', title: 'Cancel', click: 'cancel' }, 'Cancel');
      });
    });
  };

  SaveConfirmView.prototype.destroy = function() {
    this.confirmcb = undefined;
    this.cancelcb = undefined;
    if (this.panel) {
      this.panel.destroy();
      this.panel = null;
    }
  };

  SaveConfirmView.prototype.show = function(confirmcb, cancelcb) {
    this.confirmcb = confirmcb;
    this.cancelcb = cancelcb;

    this.panel = atom.workspace.addTopPanel({
      item: this
    });
    this.saveBuildButton.focus();
  };

  SaveConfirmView.prototype.cancel = function() {
    this.destroy();
    if (this.cancelcb) {
      this.cancelcb();
    }
  };

  SaveConfirmView.prototype.saveAndConfirm = function() {
    if (this.confirmcb) {
      this.confirmcb(true);
    }
    this.destroy();
  };

  SaveConfirmView.prototype.confirmWithoutSave =  function() {
    if (this.confirmcb) {
      this.confirmcb(false);
    }
    this.destroy();
  };

  return SaveConfirmView;
})();
