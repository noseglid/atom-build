'use strict';

var SelectListView = require('atom-space-pen-views').SelectListView;
var cscompatability = require('./cscompatability');

module.exports = (function() {
  function TargetsView() {
    SelectListView.apply(this, arguments);
  }

  cscompatability.extends(TargetsView, SelectListView);

  TargetsView.prototype.initialize = function () {
    TargetsView.__super__.initialize.apply(this, arguments);
    this.list.addClass('mark-active');
  };

  TargetsView.prototype.show = function(targets, activeTarget, cb) {
    this.panel = atom.workspace.addModalPanel({
      item: this
    });
    this.activeTarget = activeTarget;
    this.callback = cb;
    this.panel.show();
    this.setItems(targets);
    this.focusFilterEditor();
  };

  TargetsView.prototype.hide = function () {
    this.panel.hide();
  };

  TargetsView.prototype.viewForItem = function(targetName) {
    var activeTarget = this.activeTarget;
    return TargetsView.render(function() {
      var activeClass = (targetName === activeTarget ? 'active' : '');
      this.li({class: activeClass}, targetName);
    });
  };

  TargetsView.prototype.getEmptyMessage = function(itemCount, filteredItemCount) {
    if (itemCount === 0) {
      return 'No targets are specified in .atom-build.json';
    } else {
      return 'No matches';
    }
  };

  TargetsView.prototype.confirmed = function(target) {
    this.callback(target);
    this.hide();
  };

  TargetsView.prototype.cancelled = function() {
    this.hide();
  };

  return TargetsView;
})();
