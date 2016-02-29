'use babel';

import { View, $ } from 'atom-space-pen-views';
import GoogleAnalytics from './google-analytics';
import Terminal from 'term.js';

export default class BuildView extends View {
  constructor(...args) {
    super(...args);
    this.monocle = false;
    this.starttime = new Date();
    this.terminal = new Terminal({
      cursorBlink: false,
      convertEol: true,
      useFocus: false,
      termName: 'xterm-256color'
    });
    this.terminal.getContent = function () {
      return this.lines.reduce((m1, line) => m1 + line.reduce((m2, col) => m2 + col[1], '') + '\n', '');
    };
    this.terminal.open(this.output[0]);
    this.destroyTerminal = ::(this.terminal).destroy;
    this.terminal.destroy = this.terminal.destroySoon = () => {}; // This terminal will be open forever and reset when necessary
    this.terminalEl = this.output.find('.terminal');
    this.terminalEl[0].terminal = this.terminal; // For testing purposes

    this.output[0].addEventListener('transitionend', ::this.resizeTerminal);
    this.outputWidth = this.output.width();
    this.outputHeight = this.output.height();
    setInterval(::this.detectResize, 1000);

    this._setMonocleIcon();
    this.setHeading('Atom build');

    atom.config.observe('build.panelVisibility', ::this.visibleFromConfig);
    atom.config.observe('build.panelOrientation', ::this.orientationFromConfig);
    atom.config.observe('build.monocleHeight', ::this.sizeFromConfig);
    atom.config.observe('build.minimizedHeight', ::this.sizeFromConfig);
    atom.config.observe('editor.fontFamily', ::this.fontFromConfig);
    atom.config.observe('editor.fontSize', ::this.fontFromConfig);

    atom.commands.add('atom-workspace', 'build:toggle-panel', ::this.toggle);
  }

  destroy() {
    this.destroyTerminal();
  }

  detectResize() {
    if (!this.isAttached()) {
      return;
    }
    if (this.outputWidth !== this.output.width() || this.outputHeight !== this.output.height()) {
      this.resizeTerminal();
      this.outputWidth = this.output.width();
      this.outputHeight = this.output.height();
    }
  }

  getFontGeometry() {
    const o = $('<div>A</div>')
      .addClass('terminal')
      .addClass('terminal-test')
      .appendTo(this.output);
    const w = o[0].getBoundingClientRect().width;
    const h = o[0].getBoundingClientRect().height;
    o.remove();
    return { w: w, h: h};
  }

  resizeTerminal() {
    const { w, h } = this.getFontGeometry();
    this.terminal.resize(Math.floor((this.output.width() - 6) / w), Math.floor((this.output.height() - 6) / h)); // -6 for border of terminal
    this.terminal.refresh(0, this.terminal.rows - 1);
  }

  getContent() {
    return this.terminal.getContent();
  }

  static initialTimerText() {
    return '0.0 s';
  }

  static content() {
    this.div({ tabIndex: -1, class: 'build tool-panel panel-bottom native-key-bindings' }, () => {
      this.div({ class: 'panel-heading', outlet: 'panelHeading' }, () => {
        this.div({ outlet: 'heading' });
        this.div({ class: 'control-container opaque-hover' }, () => {
          this.button({ class: 'btn btn-default icon icon-x', click: 'close' });
          this.button({ class: 'btn btn-default icon icon-chevron-up', outlet: 'monocleButton', click: 'toggleMonocle' });
          this.button({ class: 'btn btn-default icon icon-trashcan', click: 'clearOutput' });
          this.button({ class: 'btn btn-default icon icon-zap', click: 'build', title: 'Build current project' });
          this.div({ class: 'title', outlet: 'title' }, () => {
            this.span({ class: 'build-timer', outlet: 'buildTimer' }, this.initialTimerText());
          });
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
    this.resizeTerminal();
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
        if (!this.terminalEl.hasClass('error')) {
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
    }
    this._setMonocleIcon();
  }

  reset() {
    clearTimeout(this.titleTimer);
    this.buildTimer.text(BuildView.initialTimerText());
    this.titleTimer = 0;
    this.terminal.reset();

    this.panelHeading.removeClass('success error');
    this.title.removeClass('success error');

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
    this.terminal.reset();
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

  setHeading(heading) {
    this.heading.text(heading);
  }

  buildStarted() {
    this.starttime = new Date();
    this.reset();
    this.attach();
    if (atom.config.get('build.stealFocus')) {
      this.focus();
    }
    this.updateTitle();
  }

  buildFinished(success) {
    if (!success && !this.isAttached()) {
      this.attach(atom.config.get('build.panelVisibility') === 'Show on Error');
    }
    this.finalizeBuild(success);
  }

  buildAbortInitiated() {
  }

  buildAborted() {
    this.finalizeBuild(false);
  }

  finalizeBuild(success) {
    this.title.addClass(success ? 'success' : 'error');
    this.panelHeading.addClass(success ? 'success' : 'error');
    clearTimeout(this.titleTimer);
  }

  scrollTo(text) {
    const content = this.getContent();
    let endPos = -1;
    let curPos = text.length;
    // We need to decrese the size of `text` until we find a match. This is because
    // terminal will insert line breaks ('\r\n') when width of terminal is reached.
    // It may have been that the middle of a matched error is on a line break.
    while (-1 === endPos && curPos > 0) {
      endPos = content.indexOf(text.substring(0, curPos--));
    }

    if (curPos === 0) {
      // No match - which is weird. Oh well - rather be defensive
      return;
    }

    const row = content.slice(0, endPos).split('\n').length;
    this.terminal.ydisp = 0;
    this.terminal.scrollDisp(row - 1);
  }
}
