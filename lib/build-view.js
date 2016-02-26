'use babel';

import _ from 'lodash';
import { View, $ } from 'atom-space-pen-views';
import ansiUp from 'ansi_up';
import GoogleAnalytics from './google-analytics';

export default class BuildView extends View {
  constructor() {
    super(...arguments);
    this.monocle = false;
    this.starttime = new Date();
    this.buffer = new Buffer(0);
    this.links = [];

    this._setMonocleIcon();

    atom.config.observe('build.panelVisibility', this.visibleFromConfig.bind(this));
    atom.config.observe('build.panelOrientation', this.orientationFromConfig.bind(this));
    atom.config.observe('build.monocleHeight', this.sizeFromConfig.bind(this));
    atom.config.observe('build.minimizedHeight', this.sizeFromConfig.bind(this));
    atom.config.observe('editor.fontFamily', this.fontFromConfig.bind(this));
    atom.config.observe('editor.fontSize', this.fontFromConfig.bind(this));

    atom.commands.add('atom-workspace', 'build:toggle-panel', this.toggle.bind(this));
  }

  static initialTimerText() {
    return '0.0 s';
  }

  static content() {
    this.div({ tabIndex: -1, class: 'build tool-panel panel-bottom native-key-bindings' }, () => {
      this.div({ class: 'control-container pull-right opaque-hover' }, () => {
        this.button({ class: 'btn btn-default icon icon-x', click: 'close' });
        this.button({ class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle' });
        this.button({ class: 'btn btn-default icon icon-trashcan new-row', click: 'clearOutput' });
        this.button({ class: 'btn btn-default icon icon-zap', click: 'build', title: 'Build current project' });
        this.div({ class: 'title new-row', outlet: 'title' }, () => {
          this.span({ class: 'icon icon-gear', outlet: 'gear' });
          this.span({ class: 'build-timer', outlet: 'buildTimer' }, this.initialTimerText());
        });
      });

      this.div({ class: 'output panel-body', outlet: 'output' });
    });
  }

  attach(force) {
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
    const addfn = {
      Top: atom.workspace.addTopPanel,
      Bottom: atom.workspace.addBottomPanel,
      Left: atom.workspace.addLeftPanel,
      Right: atom.workspace.addRightPanel
    };
    const orientation = atom.config.get('build.panelOrientation') || 'Bottom';
    this.panel = addfn[orientation].call(atom.workspace, { item: this });
    this.sizeFromConfig();
    this.fontFromConfig();
    this.output.scrollTop(this.output[0].scrollHeight);
  }

  detach(force) {
    force = force || false;
    if (atom.views.getView(atom.workspace)) {
      atom.views.getView(atom.workspace).focus();
    }
    if (this.panel && (force || 'Keep Visible' !== atom.config.get('build.panelVisibility'))) {
      this.panel.destroy();
      this.panel = null;
    }
  }

  isAttached() {
    return !!this.panel;
  }

  sizeFromConfig() {
    this.setSizePercent(atom.config.get(this.monocle ? 'build.monocleHeight' : 'build.minimizedHeight'));
  }

  fontFromConfig() {
    this.output.css('font-family', atom.config.get('editor.fontFamily'));
    this.output.css('font-size', atom.config.get('editor.fontSize'));
  }

  visibleFromConfig(val) {
    switch (val) {
      case 'Toggle':
      case 'Show on Error':
        if (!this.title.hasClass('error')) {
          this.detach();
        }
        break;
    }
  }

  orientationFromConfig() {
    const isVisible = this.isVisible();
    this.detach(true);
    if (isVisible) {
      this.attach();
      this._setMonocleIcon();
    }
  }

  reset() {
    clearTimeout(this.titleTimer);
    this.buildTimer.text(BuildView.initialTimerText());
    this.titleTimer = 0;
    this.clearOutput();

    this.title.removeClass('success error');
    this.gear.removeClass('spin spin-flash');
    this.removeClass('success error');

    this.detach();
  }

  updateTitle() {
    this.buildTimer.text(((new Date() - this.starttime) / 1000).toFixed(1) + ' s');
    this.titleTimer = setTimeout(this.updateTitle.bind(this), 100);
  }

  close() {
    this.detach(true);
  }

  toggle() {
    GoogleAnalytics.sendEvent('view', 'panel toggled');
    this.isAttached() ? this.detach(true) : this.attach(true);
  }

  clearOutput() {
    this.buffer = new Buffer(0);
    this.links = [];
    this.output.empty();
  }

  build() {
    atom.commands.dispatch(atom.views.getView(atom.workspace), 'build:trigger');
  }

  setSizePercent(percent) {
    let size = 0;
    let cssKey = 'height';
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
  }

  _setMonocleIcon() {
    const iconName = () => {
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
  }

  toggleMonocle() {
    GoogleAnalytics.sendEvent('view', 'monocle toggled');
    this.monocle = !this.monocle;
    this.setSizePercent(atom.config.get(this.monocle ? 'build.monocleHeight' : 'build.minimizedHeight'));
    this._setMonocleIcon();
  }

  buildStarted() {
    this.starttime = new Date();
    this.reset();
    this.attach();
    if (atom.config.get('build.stealFocus')) {
      this.focus();
    }
    this.gear.addClass('spin');
    this.updateTitle();
  }

  buildFinished(success) {
    if (!success && !this.isAttached()) {
      this.attach(atom.config.get('build.panelVisibility') === 'Show on Error');
    }
    this.finalizeBuild(success);
  }

  buildAbortInitiated() {
    this.gear.removeClass('spin').addClass('spin-flash');
  }

  buildAborted() {
    this.finalizeBuild(false);
  }

  finalizeBuild(success) {
    this.title.addClass(success ? 'success' : 'error');
    this.addClass(success ? 'success' : 'error');
    this.gear.removeClass('spin spin-flash');
    clearTimeout(this.titleTimer);
  }

  getOutputString() {
    return _.escape(this.buffer.toString('utf8'));
  }

  _render() {
    let string = this.getOutputString();
    this.links.forEach((link) => {
      const replaceRegex = new RegExp(_.escapeRegExp(_.escape(link.text)), 'g');
      string = string.replace(replaceRegex, '<a id="' + link.id + '">' + _.escape(link.text) + '</a>');
    });
    this.output.html(ansiUp.ansi_to_html(string));
    this.output.find('a').on('click', (event) => {
      this.links.find(l => l.id === event.currentTarget.id).onClick();
    });
  }

  append(data) {
    const shouldScroll = (this.output[0].scrollHeight - this.output[0].scrollTop === this.output[0].offsetHeight);
    this.buffer = Buffer.concat([ this.buffer, Buffer.isBuffer(data) ? data : new Buffer(data) ]);
    this._render();
    if (shouldScroll) {
      this.output.scrollTop(this.output[0].scrollHeight);
    }
  }

  link(text, id, onClick) {
    if (this.links.find(l => l.text === text)) {
      return;
    }

    this.links.push({
      id: id,
      text: text,
      onClick: onClick
    });
    this._render();
  }

  scrollTo(id) {
    const position = this.output.find('#' + id).position();
    if (position) {
      this.output.scrollTop(position.top + this.output.scrollTop());
    }
  }
}
