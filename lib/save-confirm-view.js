var _ = require('underscore');
var View = require('space-pen').View;
var cscompatability = require('./cscompatability');

module.exports = (function() {
  'use strict';

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
    this.detach();
  };

  SaveConfirmView.prototype.show = function(confirmcb, cancelcb) {
    this.confirmcb = confirmcb;
    this.cancelcb = cancelcb;

    if (atom.config.get('build.saveOnBuild')) {
      // Opted in to force save and build. Just do it
      return this.saveAndConfirm();
    }

    atom.workspaceView.command('build:confirm', _.bind(this.saveAndConfirm, this));
    atom.workspaceView.append(this);
    this.saveBuildButton.focus();
  };

  SaveConfirmView.prototype.cancel = function() {
    this.destroy();
    if (this.cancelcb) {
      this.cancelcb();
    }
  };

  SaveConfirmView.prototype.saveAndConfirm = function() {
    _.each(atom.workspace.getTextEditors(), function(editor) {
      editor.save();
    });

    if (this.confirmcb) {
      this.confirmcb();
    }
    this.destroy();
  };

  SaveConfirmView.prototype.confirmWithoutSave =  function() {
    if (this.confirmcb) {
      this.confirmcb();
    }
    this.destroy();
  };

  return SaveConfirmView;
})();
