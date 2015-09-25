'use babel';
'use strict';

var _ = require('lodash');
var View = require('atom-space-pen-views').View;
var $ = require('atom-space-pen-views').$;
var ansi_up = require('ansi_up');
var cscompatability = require('./cscompatability');
var GoogleAnalytics = require('./google-analytics');

module.exports = (function() {
  function BuildView() {
    View.apply(this, arguments);
    this.titleLoop = [ 'Building', 'Building.', 'Building..', 'Building...' ];
    this.titleLoop.rotate = function () {
      /* Throttle as we don't want to update as quick as the timer is */
      this.n = this.n || 0;
      (++this.n === 3) && this.push(this.shift()) && (this.n = 0);
    };
    this.monocle = false;
    this.starttime = new Date();
    this.buffer = new Buffer(0);
    this.links = [];

    this._setMonocleIcon();

    atom.config.observe('build.panelVisibility', this.visibleFromConfig.bind(this));
    atom.config.observe('build.panelOrientation', this.orientationFromConfig.bind(this));
    atom.config.observe('build.monocleHeight', this.sizeFromConfig.bind(this));
    atom.config.observe('build.minimizedHeight', this.sizeFromConfig.bind(this));

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

      BuildView.div({ class: 'status' }, function() {
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
    let addfn = {
      Top: atom.workspace.addTopPanel,
      Bottom: atom.workspace.addBottomPanel,
      Left: atom.workspace.addLeftPanel,
      Right: atom.workspace.addRightPanel
    };
    let orientation = atom.config.get('build.panelOrientation') || 'Bottom';
    this.panel = addfn[orientation].call(atom.workspace, { item: this });
    this.sizeFromConfig();
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

  BuildView.prototype.sizeFromConfig = function() {
    this.setSizePercent(atom.config.get(this.monocle ? 'build.monocleHeight' : 'build.minimizedHeight'));
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

  BuildView.prototype.orientationFromConfig = function (val) {
    let isVisible = this.isVisible();
    this.detach(true);
    if (isVisible) {
      this.attach();
      this._setMonocleIcon();
    }
  };

  BuildView.prototype.reset = function() {
    clearTimeout(this.titleTimer);
    this.buffer = new Buffer(0);
    this.links = [];
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

  BuildView.prototype.setSizePercent = function(percent) {
    let size = 0, cssKey = 'height';
    switch (atom.config.get('build.panelOrientation')) {
      case 'Top':
      case 'Bottom':
        size = $('atom-workspace-axis.vertical').height();
        cssKey = 'height';
        break;

      case 'Left':
      case 'Right':
        size = $('atom-workspace-axis.vertical').width();
        if ($('.build').length) {
          size += $('.build').get(0).clientWidth;
        }
        cssKey = 'width';
        break;
    }
    this.output.css('width', 'auto');
    this.output.css('height', '100%');
    this.output.css(cssKey, percent * size + 'px');
  };

  BuildView.prototype._setMonocleIcon = function () {
    let iconName = () => {
      switch (atom.config.get('build.panelOrientation')) {
        case 'Top': return this.monocle ? 'icon-chevron-up' : 'icon-chevron-down';
        case 'Bottom': return this.monocle ? 'icon-chevron-down' : 'icon-chevron-up';
        case 'Right': return this.monocle ? 'icon-chevron-right' : 'icon-chevron-left';
        case 'Left': return this.monocle ? 'icon-chevron-left' : 'icon-chevron-right';
      }
    };

    this.monocleButton
      .removeClass('icon-chevron-down icon-chevron-up icon-chevron-left icon-chevron-right')
      .addClass(iconName());
  };

  BuildView.prototype.toggleMonocle = function(event, element) {
    GoogleAnalytics.sendEvent('view', 'monocle toggled');
    this.monocle = !this.monocle;
    this.setSizePercent(atom.config.get(this.monocle ? 'build.monocleHeight' : 'build.minimizedHeight'));
    this._setMonocleIcon();
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

  BuildView.prototype._render = function() {
    var string = _.escape(this.buffer.toString('utf8'));
    _.forEach(this.links, function (link, index) {
      var replaceRegex = new RegExp(_.escapeRegExp(link.text), 'g');
      string = string.replace(replaceRegex, '<a id="' + link.id + '">' + _.escape(link.text) + '</a>');
    });
    this.output.html(ansi_up.ansi_to_html(string));
    this.output.find('a').on('click', (event) => {
      var link = _.findWhere(this.links, { id: event.currentTarget.id });
      link.onClick();
    });
  };

  BuildView.prototype.append = function(data) {
    this.buffer = Buffer.concat([ this.buffer, Buffer.isBuffer(data) ? data : new Buffer(data) ]);
    this._render();
    this.output.scrollTop(this.output[0].scrollHeight);
  };

  BuildView.prototype.link = function(text, id, onClick) {
    if (_.findWhere(this.links, { text: text })) {
      /* This text already has a link to it. Ignore it. */
      return;
    }

    this.links.push({
      id: id,
      text: text,
      onClick: onClick
    });
    this._render();
  };

  BuildView.prototype.scrollTo = function(id) {
    var position = this.output.find('#' + id).position();
    if (position) {
      this.output.scrollTop(position.top + this.output.scrollTop());
    }
  };

  return BuildView;
})();
