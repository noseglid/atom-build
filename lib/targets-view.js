'use babel';
'use strict';

var SelectListView = require('atom-space-pen-views').SelectListView;
var cscompatability = require('./cscompatability');

module.exports = (function() {
  function TargetsView() {
    SelectListView.apply(this, arguments);
    this.show();
  }

  cscompatability.extends(TargetsView, SelectListView);

  TargetsView.prototype.initialize = function () {
    TargetsView.__super__.initialize.apply(this, arguments);
    this.list.addClass('mark-active');
  };

  TargetsView.prototype.show = function() {
    this.panel = atom.workspace.addModalPanel({
      item: this
    });
    this.panel.show();
    this.focusFilterEditor();
  };

  TargetsView.prototype.hide = function () {
    this.panel.hide();
  };

  TargetsView.prototype.setItems = function () {
    TargetsView.__super__.setItems.apply(this, arguments);

    var activeItemView = this.find('.active');
    if (0 < activeItemView.length) {
      this.selectItemView(activeItemView);
      this.scrollToItemView(activeItemView);
    }
  };

  TargetsView.prototype.setActiveTarget = function (target) {
    this.activeTarget = target;
  };

  TargetsView.prototype.viewForItem = function(targetName) {
    var activeTarget = this.activeTarget;
    return TargetsView.render(function() {
      var activeClass = (targetName === activeTarget ? 'active' : '');
      this.li({ class: activeClass + ' build-target' }, targetName);
    });
  };

  TargetsView.prototype.getEmptyMessage = function(itemCount, filteredItemCount) {
    return (0 === itemCount) ? 'No targets found.' : 'No matches';
  };

  TargetsView.prototype.awaitSelection = function () {
    return new Promise(function (resolve, reject) {
      this.resolveFunction = resolve;
    }.bind(this));
  };

  TargetsView.prototype.confirmed = function(target) {
    if (this.resolveFunction) {
      this.resolveFunction(target);
      this.resolveFunction = null;
    }
    this.hide();
  };

  TargetsView.prototype.cancelled = function() {
    this.hide();
  };

  return TargetsView;
})();
