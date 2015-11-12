'use babel';
'use strict';

import _ from 'lodash';
import querystring from 'querystring';
var cid;

export default class GoogleAnalytics {
  static getCid(cb) {
    if (cid) {
      return cb(cid);
    }

    require('getmac').getMac(function(error, macAddress) {
      if (error) {
        return cb(cid = require('node-uuid').v4());
      }

      return cb(require('crypto').createHash('sha1').update(macAddress, 'utf8').digest('hex'));
    });
  }

  static sendEvent(category, action, label, value) {
    var params = {
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

    GoogleAnalytics.getCid(function (cid) {
      _.extend(params, { cid: cid }, GoogleAnalytics.defaultParams());
      this.request('https://www.google-analytics.com/collect?' + querystring.stringify(params));
    });
  }

  static request(url) {
    if (!navigator.onLine) {
      return;
    }
    this.post(url);
  }

  static post(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.send(null);
  }

  static defaultParams() {
    // https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
    return {
      v: 1,
      tid: 'UA-47615700-5',
    };
  }
}

atom.packages.onDidActivatePackage((pkg) => {
  if ('metrics' === pkg.name) {
    var buildPackage = atom.packages.getLoadedPackage('build');
    GoogleAnalytics.sendEvent('core', 'activated', buildPackage.metadata.version);
  }
});
