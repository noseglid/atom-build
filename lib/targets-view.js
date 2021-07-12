'use babel';

import { SelectListView } from 'atom-space-pen-views';

export default class TargetsView extends SelectListView {

  constructor() {
    super(...arguments);
    this.show();
  }

  initialize() {
    super.initialize(...arguments);
    this.addClass('build-target');
    this.list.addClass('mark-active');
  }

  show() {
    this.panel = atom.workspace.addModalPanel({ item: this });
    this.panel.show();
    this.focusFilterEditor();
  }

  hide() {
    this.panel.hide();
  }

  setItems() {
    super.setItems(...arguments);

    const activeItemView = this.find('.active');
    if (0 < activeItemView.length) {
      this.selectItemView(activeItemView);
      this.scrollToItemView(activeItemView);
    }
  }

  setActiveTarget(target) {
    this.activeTarget = target;
  }

  viewForItem(targetName) {
    const activeTarget = this.activeTarget;
    return TargetsView.render(function () {
      const activeClass = (targetName === activeTarget ? 'active' : '');
      this.li({ class: activeClass + ' build-target' }, targetName);
    });
  }

  getEmptyMessage(itemCount) {
    return (0 === itemCount) ? 'No targets found.' : 'No matches';
  }

  awaitSelection() {
    return new Promise((resolve, reject) => {
      this.resolveFunction = resolve;
    });
  }

  confirmed(target) {
    if (this.resolveFunction) {
      this.resolveFunction(target);
      this.resolveFunction = null;
    }
    this.hide();
  }

  cancelled() {
    this.hide();
  }
}
