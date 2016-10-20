
const logger = require('../utils/logger').create('Http');
const httpBrowserify = require('http-browserify');
const httpsBrowserify = require('https-browserify');
const fakeHttp = require('../utils/fake-http');

// temp
const targets = require('../background/targets');

// wrap for logging
const realHttpWrapped = wrapForLog(httpBrowserify, 'REAL');
const realHttpsWrapped = wrapForLog(httpsBrowserify, 'REAL');
const fakeHttpWrapped = wrapForLog(fakeHttp, 'LOOPBACK');

let loopbackHost;

module.exports = {
  request(opts) {
    const http = opts.hostname === getLoopbackHost()
      ? fakeHttpWrapped
      : (opts.protocol === 'https:' ? realHttpsWrapped : realHttpWrapped);
    return http.request.apply(http, arguments);
  }
};

function getLoopbackHost() {
  if (!loopbackHost) {
    loopbackHost = new URL(targets.getLoopbackHub().serverUrl).hostname;
  }
  return loopbackHost;
}

function wrapForLog(http, prefix) {
  const origRequest = http.request;
  http.request = function (opts, callback) {
    logger.log(`${prefix} request`, opts.method, getUrl(opts));
    const req = origRequest.apply(http, arguments);
    req.on('response', response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        let data = chunks.join('').replace(/\0/g, '');
        // strip big 'screen' prop with encoded screenshot
        if (response.statusCode !== 200) {
          data = data.replace(/"screen":"[^"]+"/, '"screen":"_stripped_"');
        }
        //logger.log(`${prefix} response`, response.statusCode, JSON.parse(data));
        logger.log(`${prefix} response`, response.statusCode, data);
      });
    });

    const origWrite = req.write;
    req.write = function (data) {
      logger.log(`${prefix} request data`, data);
      return origWrite.apply(req, arguments);
    };

    return req;
  };
  return http;
}

function getUrl(options) {
  const {protocol, hostname, port, path} = options;
  return `${protocol}//${hostname}${port ? ':' + port : ''}${path}`;
}
