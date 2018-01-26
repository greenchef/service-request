function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var request = require('request-promise');
var url = require('url');
var when = require('when');
var nodefn = require('when/node');
var dns = require('dns');
var logger = require('winston');
var mongoose = require('mongoose');

/**
* Helper function to get either 'uri' or 'url' based on what field is populated
* in the HTTP request options.
* @param {Object} opts - HTTP request options (should have a uri or url prop present)
* @return {string} 'uri' or 'url'
*/
module.exports.uriOrUrlKey = function (_ref) {
  var uri = _ref.uri;
  return uri ? 'uri' : 'url';
};
// exported for testing

/**
* Helper function for parsing the uri/url out of HTTP request options
* @param {Object} opts - HTTP request options
* @return {Object} parsedUrl
*/
module.exports.getParsedUrl = function (opts) {
  return url.parse(opts[module.exports.uriOrUrlKey(opts)]);
};
// exported for testing

/**
* Uses dns to find the hosts for a given hostname
* @param {string} hostname
* @return {string[]} hosts (address:port)
*/
function getHosts(hostname) {
  return nodefn.call(dns.resolveSrv, hostname).then(function (srvs) {
    return when.map(srvs, function (srv) {
      return nodefn.call(dns.resolve, srv.name).then(function (a) {
        return String(a) + ':' + String(srv.port);
      });
    });
  });
}

/**
* Given HTTP request options, returns the list of host urls that match
* @param {Object} opts - HTTP request options
* @return {string[]} The host urls
*/
function getHostUrls(opts) {
  var u = module.exports.getParsedUrl(opts);

  return getHosts(u.hostname).then(function (hosts) {
    if (!hosts) return [];

    return hosts.map(function (host) {
      return String(u.protocol) + '//' + (u.auth ? String(u.auth) + '@' : '') + String(host) + String(u.path);
    });
  });
}

function resolveUri(opts) {
  var u = module.exports.getParsedUrl(opts);

  // Was told to keep for future Saph and Kevin work
  // if (process.env.ENVIRONMENT_NAME) {
  //   host = process.env.ENVIRONMENT_NAME + '.' + host;
  // }

  return getHosts(u.hostname).then(function (hosts) {
    return String(u.protocol) + '//' + (u.auth ? String(u.auth) + '@' : '') + String(hosts.join(',')) + String(u.path);
  }).then(function (host) {
    return Object.assign({}, opts, _defineProperty({}, module.exports.uriOrUrlKey(opts), host));
  });
}

module.exports.resolveRequest = function (opts) {
  return resolveUri(opts).otherwise(function () {
    return opts;
  }).then(function (options) {
    return when(request(options));
  });
};

module.exports.resolveRequestForAllHosts = function (opts) {
  return getHostUrls(opts).then(function (hostUrls) {
    return (// Map hostUrls to opts array
      hostUrls.map(function (hostUrl) {
        return Object.assign({}, opts, _defineProperty({}, module.exports.uriOrUrlKey(opts), hostUrl));
      })
    );
  }).then(function (optsArray) {
    return when.map(optsArray, request);
  }).otherwise(function (err) {
    logger.warn('Failed to resolve request for all hosts. Error: %s', err);
  });
};

function resolveMongoUri(uri) {
  var originalUri = uri;
  return resolveUri({ uri: uri }).then(function (host) {
    return host.uri;
  }).otherwise(originalUri);
}

module.exports.connectToMongo = function (uri) {
  return resolveMongoUri(uri).then(function (mongoUri) {
    return mongoose.connect(mongoUri, {
      useMongoClient: true,
      server: { reconnectTries: 10 }
    });
  }).otherwise(function (err) {
    logger.warn('Failed to connect to mongo on startup - retry in 10s: %s', err.stack, {});
    mongoose.disconnect();
    setTimeout(function () {
      return module.exports.connectToMongo(uri).done();
    }, 10000);
  });
};

module.exports.connectToAgenda = function (uri, agenda) {
  return resolveMongoUri(uri).then(function (mongoUri) {
    agenda.agenda.agenda.database(mongoUri, 'jobSchedule').maxConcurrency(100);
  }).otherwise(function (err) {
    logger.warn('failed to connect to agenda on startup - retry in 10s: %s', err.stack, {});
    setTimeout(function () {
      module.exports.connectToAgenda(uri, agenda).done();
    }, 10000);
  });
};

if (process.env.OVERRIDE_DNS) {
  console.log('using alternate nameserver:', process.env.OVERRIDE_DNS);
  dns.setServers([process.env.OVERRIDE_DNS]);
}