'use babel';
'use strict';

var _ = require('lodash');
var querystring = require('querystring');
var cid;

module.exports = (function () {
  atom.packages.onDidActivatePackage(function (pkg) {
    if ('metrics' === pkg.name) {
      var buildPackage = atom.packages.getLoadedPackage('build');
      GoogleAnalytics.sendEvent('core', 'activated', buildPackage.metadata.version);
    }
  });
  function GoogleAnalytics () {}

  GoogleAnalytics.getCid = function (cb) {
    if (cid) {
      return cb(cid);
    }

    require('getmac').getMac(function(error, macAddress) {
      if (error) {
        return cb(cid = require('node-uuid').v4());
      }

      return cb(require('crypto').createHash('sha1').update(macAddress, 'utf8').digest('hex'));
    });
  };

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

    GoogleAnalytics.getCid(function (cid) {
      _.extend(params, { cid: cid }, GoogleAnalytics.defaultParams());
      GoogleAnalytics.request('https://www.google-analytics.com/collect?' + querystring.stringify(params));
    });
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
    };
  };

  return GoogleAnalytics;
})();
