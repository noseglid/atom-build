'use babel';
'use strict';

var _ = require('lodash');
var View = require('atom-space-pen-views').View;
var $ = require('atom-space-pen-views').$;
var cscompatability = require('./cscompatability');
var GoogleAnalytics = require('./google-analytics');
var Convert = require('ansi-to-html');

module.exports = (function() {
  function BuildView() {
    View.apply(this, arguments);
    this.titleLoop = [ 'Building', 'Building.', 'Building..', 'Building...' ];
    this.titleLoop.rotate = function () {
      /* Throttle as we don't want to update as quick as the timer is */
      this.n = this.n || 0;
      (++this.n === 3) && this.push(this.shift()) && (this.n = 0);
    };
    this.a2h = new Convert();
    this.monocle = false;
    this.starttime = new Date();

    atom.config.observe('build.panelVisibility', this.visibleFromConfig.bind(this));
    atom.config.observe('build.monocleHeight', this.heightFromConfig.bind(this));
    atom.config.observe('build.minimizedHeight', this.heightFromConfig.bind(this));

    atom.commands.add('atom-workspace', 'build:toggle-panel', this.toggle.bind(this));
  }

  cscompatability.extends(BuildView, View);

  BuildView.content = function() {
    BuildView.div({ tabIndex: -1, class: 'build tool-panel panel-bottom native-key-bindings' }, function() {
      BuildView.div({ class: 'btn-container pull-right' }, function() {
        BuildView.button({ class: 'btn btn-default icon icon-x', click: 'close' });
        BuildView.button({ class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle' });
        BuildView.button({ class: 'btn btn-default icon icon-trashcan new-row', click: 'clear' });
        BuildView.button({ class: 'btn btn-default icon icon-zap', click: 'build', title: 'Build current project' });
      });

      BuildView.div({ class: 'output panel-body', outlet: 'output' });

      BuildView.div(function() {
        BuildView.h1({ class: 'title panel-heading', outlet: 'title' }, function () {
          BuildView.span({ class: 'build-timer', outlet: 'buildTimer' }, '0.0 s');
          BuildView.span({ class: 'title-text', outlet: 'titleText' }, 'Ready');
        });
      });
    });
  };

  BuildView.prototype.attach = function(force) {
    if (!force) {
      switch (atom.config.get('build.panelVisibility')) {
        case 'Hidden':
        case 'Show on Error':
          return;
      }
    }

    if (this.panel) {
      this.panel.destroy();
    }
    this.panel = atom.workspace.addBottomPanel({ item: this });
    this.height = this.output.offset().top + this.output.height();
    this.heightFromConfig();
  };

  BuildView.prototype.detach = function(force) {
    force = force || false;
    if (atom.views.getView(atom.workspace)) {
      atom.views.getView(atom.workspace).focus();
    }
    if (this.panel && (force || 'Keep Visible' !== atom.config.get('build.panelVisibility'))) {
      this.panel.destroy();
      this.panel = null;
    }
  };

  BuildView.prototype.isAttached = function() {
    return !!this.panel;
  };

  BuildView.prototype.heightFromConfig = function() {
    if (this.monocle) {
      this.setHeightPercent(atom.config.get('build.monocleHeight'));
    } else {
      this.setHeightPercent(atom.config.get('build.minimizedHeight'));
    }
  };

  BuildView.prototype.visibleFromConfig = function(val) {
    switch (val) {
      case 'Toggle':
      case 'Show on Error':
        if (!this.title.hasClass('error')) {
          this.detach();
        }
        break;
    }
  };

  BuildView.prototype.reset = function() {
    clearTimeout(this.titleTimer);
    this.titleTimer = 0;
    this.title.removeClass('success error warning');
    this.output.empty();
    this.titleText.text('Cleared.');
    this.detach();
  };

  BuildView.prototype.updateTitle = function() {
    this.titleText.text(this.titleLoop[0]);
    this.titleLoop.rotate();
    this.buildTimer.text(((new Date() - this.starttime) / 1000).toFixed(1) + ' s');
    this.titleTimer = setTimeout(this.updateTitle.bind(this), 100);
  };

  BuildView.prototype.close = function(event, element) {
    this.detach(true);
  };

  BuildView.prototype.toggle = function(event, element) {
    GoogleAnalytics.sendEvent('view', 'panel toggled');
    this.isAttached() ?  this.detach(true) : this.attach(true);
  };

  BuildView.prototype.clear = function(event, element) {
    this.reset();
    this.attach();
  };

  BuildView.prototype.build = function(event, element) {
    atom.commands.dispatch(atom.views.getView(atom.workspace), 'build:trigger');
  };

  BuildView.prototype.setHeightPercent = function(percent) {
    var newHeight = percent * this.height;
    this.output.css('height', newHeight + 'px');
  };

  BuildView.prototype.toggleMonocle = function(event, element) {
    GoogleAnalytics.sendEvent('view', 'monocle toggled');
    if (!this.monocle) {
      this.setHeightPercent(atom.config.get('build.monocleHeight'));
      this.monocleButton.removeClass('icon-chevron-up').addClass('icon-chevron-down');
    } else {
      this.setHeightPercent(atom.config.get('build.minimizedHeight'));
      this.monocleButton.removeClass('icon-chevron-down').addClass('icon-chevron-up');
    }
    this.monocle = !this.monocle;
  };

  BuildView.prototype.buildStarted = function() {
    this.starttime = new Date();
    this.reset();
    this.attach();
    if (atom.config.get('build.stealFocus')) {
      this.focus();
    }
    this.updateTitle();
  };

  BuildView.prototype.buildFinished = function(success) {
    if (!success) {
      var force = (atom.config.get('build.panelVisibility') === 'Show on Error');
      this.attach(force);
    }
    this.titleText.text(success ? 'Build finished.' : 'Build failed.');
    this.title.addClass(success ? 'success' : 'error');
    clearTimeout(this.titleTimer);
  };

  BuildView.prototype.buildAbortInitiated = function() {
    this.titleText.text('Build process termination imminent...');
    clearTimeout(this.titleTimer);
    this.title.addClass('error');
  };

  BuildView.prototype.buildAborted = function() {
    this.titleText.text('Aborted!');
  };

  BuildView.prototype.append = function(data) {
    this.output.append(this.a2h.toHtml(_.escape(data)));
    this.output.scrollTop(this.output[0].scrollHeight);
  };

  BuildView.prototype.replace = function(text, onclick) {
    this.output.empty();
    this.output.append(this.a2h.toHtml(text));
    this.output.find('a').on('click', function() {
      onclick($(this).attr('id'));
    });
    this.output.scrollTop(this.output[0].scrollHeight);
  };

  BuildView.prototype.scrollTo = function(type, id) {
    var position = this.output.find('.' + type + '#' + id).position();
    if (position) {
      this.output.scrollTop(position.top + this.output.scrollTop());
    }
  };

  return BuildView;
})();
