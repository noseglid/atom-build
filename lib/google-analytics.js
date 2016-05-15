'use babel';

function uuid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export default class GoogleAnalytics {
  static getCid(cb) {
    if (this.cid) {
      cb(this.cid);
      return;
    }

    require('getmac').getMac((error, macAddress) => {
      return error ?
        cb(this.cid = uuid()) :
        cb(this.cid = require('crypto').createHash('sha1').update(macAddress, 'utf8').digest('hex'));
    });
  }

  static sendEvent(category, action, label, value) {
    const params = {
      t: 'event',
      ec: category,
      ea: action
    };
    if (label) {
      params.el = label;
    }
    if (value) {
      params.ev = value;
    }

    this.send(params);
  }

  static send(params) {
    if (!atom.packages.getActivePackage('metrics')) {
      // If the metrics package is disabled, then user has opted out.
      return;
    }

    GoogleAnalytics.getCid((cid) => {
      Object.assign(params, { cid: cid }, GoogleAnalytics.defaultParams());
      this.request('https://www.google-analytics.com/collect?' + require('querystring').stringify(params));
    });
  }

  static request(url) {
    if (!navigator.onLine) {
      return;
    }
    this.post(url);
  }

  static post(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.send(null);
  }

  static defaultParams() {
    // https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
    return {
      v: 1,
      tid: 'UA-47615700-5'
    };
  }
}

atom.packages.onDidActivatePackage((pkg) => {
  if ('metrics' === pkg.name) {
    const buildPackage = atom.packages.getLoadedPackage('build');
    require('./google-analytics').sendEvent('core', 'activated', buildPackage.metadata.version);
  }
});
