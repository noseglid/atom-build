'use strict';

var _ = require('lodash');
var querystring = require('querystring');
var cid = require('node-uuid').v4();

module.exports = (function () {
  function GoogleAnalytics () {}

  GoogleAnalytics.sendEvent = function(category, action, label, value) {
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

    GoogleAnalytics.send(params);
  };

  GoogleAnalytics.send = function (params) {
    if (!atom.packages.getActivePackage('metrics')) {
      // If the metrics package is disabled, then user has opted out.
      return;
    }

    _.extend(params, GoogleAnalytics.defaultParams());
    GoogleAnalytics.request('https://www.google-analytics.com/collect?' + querystring.stringify(params));
  };

  GoogleAnalytics.request = function (url) {
    if (!navigator.onLine) {
      return;
    }
    GoogleAnalytics.post(url);
  };

  GoogleAnalytics.post = function (url) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.send(null);
  };

  GoogleAnalytics.defaultParams = function () {
    // https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
    return {
      v: 1,
      tid: 'UA-47615700-5',
      cid: cid
    };
  };

  return GoogleAnalytics;
})();
