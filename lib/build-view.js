var _ = require('underscore');
var View = require('space-pen').View;
var cscompatability = require('./cscompatability');
var Convert = require('ansi-to-html');

module.exports = (function() {
  'use strict';

  function BuildView() {
    View.apply(this, arguments);
    this.titleLoop = [
      'Building',
      'Building.',
      'Building..',
      'Building...'
    ];
    this.titleLoopIndex = 0;
    this.a2h = new Convert();
    this.monocle = false;

    atom.config.observe('build.keepVisible', _.bind(this.visibleFromConfig, this));
    atom.config.observe('build.monocleHeight', _.bind(this.heightFromConfig, this));
    atom.config.observe('build.minimizedHeight', _.bind(this.heightFromConfig, this));
  }

  cscompatability.extends(BuildView, View);

  BuildView.content = function() {
    BuildView.div({ tabIndex: -1, class: 'build tool-panel panel-bottom' }, function() {
      BuildView.div({ class: 'btn-container pull-right' }, function() {
        BuildView.button({ class: 'btn btn-default icon icon-x', outlet: 'closeButton', click: 'close' });
        BuildView.button({ class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle' });
        BuildView.button({ class: 'btn btn-default icon icon-trashcan new-row', outlet: 'clearButton', click: 'clear' });
        BuildView.button({ class: 'btn btn-default icon icon-zap', outlet: 'triggerButton', click: 'build', title: 'Build current project' });
      });

      BuildView.div(function() {
        BuildView.ol({ class: 'output panel-body', outlet: 'output' });
      });

      BuildView.div(function() {
        BuildView.h1({ class: 'title panel-heading', outlet: 'title' }, 'Ready');
      });
    });
  };

  BuildView.prototype.attach = function() {
    this.panel = atom.workspace.addBottomPanel({ item: this });
  };

  BuildView.prototype.detach = function(force) {
    force = force || false;
    atom.workspaceView.focus();
    if (force || !(atom.config.get('build.keepVisible'))) {
      if (this.panel) {
        this.panel.destroy();
        this.panel = null;
      }
    }
  };

  BuildView.prototype.heightFromConfig = function(val) {
    if (this.monocle) {
      this.setHeightPercent(atom.config.get('build.monocleHeight'));
    } else {
      this.setHeightPercent(atom.config.get('build.minimizedHeight'));
    }
  };

  BuildView.prototype.visibleFromConfig = function(val) {
    val ? this.attach() : this.detach();
  };

  BuildView.prototype.reset = function() {
    clearTimeout(this.titleTimer);
    this.titleTimer = 0;
    this.title.removeClass('success error warning');
    this.output.empty();
    this.title.text('Cleared.');
    this.detach();
  };

  BuildView.prototype.updateTitle = function() {
    this.title.text(this.titleLoop[this.titleLoopIndex]);
    this.titleLoopIndex = (this.titleLoopIndex + 1) % this.titleLoop.length;
    this.titleTimer = setTimeout(_.bind(this.updateTitle, this), 200);
  };

  BuildView.prototype.close = function(event, element) {
    this.detach(true);
  };

  BuildView.prototype.clear = function(event, element) {
    this.reset();
    this.attach();
  };

  BuildView.prototype.build = function(event, element) {
    atom.workspaceView.trigger('build:trigger');
  };

  BuildView.prototype.setHeightPercent = function(percent) {
    var newHeight = percent * (this.output.offset().top + this.output.height());
    this.output.css('height', newHeight + 'px');
  };

  BuildView.prototype.toggleMonocle = function(event, element) {
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
    this.reset();
    this.attach();
    this.focus();
    this.updateTitle();
  };

  BuildView.prototype.buildFinished = function(success) {
    this.title.text(success ? 'Build finished.' : 'Build failed.');
    this.title.addClass(success ? 'success' : 'error');
    clearTimeout(this.titleTimer);
  };

  BuildView.prototype.buildAbortInitiated = function() {
    this.title.text('Build process termination imminent...');
    clearTimeout(this.titleTimer);
    this.title.addClass('error');
  };

  BuildView.prototype.buildAborted = function() {
    this.title.text('Aborted!');
  };

  BuildView.prototype.errorMessage = function(title, error) {
    this.title.text(title);
    if (error) {
      this.title.addClass('error');
    }
    this.attach();
  };

  BuildView.prototype.append = function(line) {
    line = _.escape(line.toString());
    this.output.append('<li>' + (this.a2h.toHtml(line)) + '</li>');
    this.output.scrollTop(this.output[0].scrollHeight);
  };

  return BuildView;
})();
