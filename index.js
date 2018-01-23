const request = require('request-promise');
const url = require('url');
const when = require('when');
const nodefn = require('when/node');
const dns = require('dns');
const logger = require('winston');
const mongoose = require('mongoose');

/**
* Helper function for parsing the uri/url out of HTTP request options
* @param {Object} opts - HTTP request options
* @return {Object} parsedUrl
*/
function getParsedUrl(opts) {
  return url.parse(opts[opts.uri ? 'uri' : 'url']);
}

/**
* Uses dns to find the hosts for a given hostname
* @param {string} hostname
* @return {string[]} hosts (address:port)
*/
function getHosts(hostname) {
  return nodefn
    .call(dns.resolveSrv, hostname)
    .then(function(srvs) {
      return when
        .map(srvs, function(srv) {
          return nodefn
            .call(dns.resolve, srv.name)
            .then(function(a) {
              return a + ':' + srv.port;
            });
        });
    })
}

/**
* Given HTTP request options, returns the list of host urls that match
* @param {Object} opts - HTTP request options
* @return {string[]} The host urls
*/
function getHostUrls(opts) {
  const u = getParsedUrl(opts);

  return getHosts(u.hostname)
    .then(function(hosts) {
      if (!hosts) return [];

      return hosts.map(function(host) {
        return u.protocol + '//' + (u.auth ? u.auth + '@' : '') + host + u.path
      })
    });
}

function resolveUri(opts) {
  const u = getParsedUrl(opts);

  return getHosts(u.hostname)
    .then(function(hosts) {
      return u.protocol + '//' + (u.auth ? u.auth + '@' : '') + hosts.join(',') + u.path
    })
    .then(function(host) {
      opts[opts.uri ? 'uri' : 'url'] = host;
      return opts;
    });
}

function resolveRequest(opts) {
  return resolveUri(opts)
    .otherwise(function(){ return opts; } )
    .then(function(opts) {
      return when(request(opts));
    });
}

function resolveRequestForAllHosts(opts) {
  return getHostUrls(opts)
    .then(function(hostUrls) { // Map hostUrls to opts array
      return hostUrls.map(function(hostUrl) {
        return Object.assign({}, opts, {
          [opts.uri ? 'uri' : 'url']: hostUrl,
        })
      })
    })
    .then(function(optsArray) {
      return when.map(optsArray, request);
    })
    .otherwise(function(err) {
      logger.warn('Failed to resolve request for all hosts. Error: %s', err);
    })
}

function resolveMongoUri(uri) {
  var orig_uri = uri;
  return resolveUri({'uri': uri})
    .then(function(host) {
      return host.uri;
    })
    .otherwise(orig_uri);
}

function connectToMongo(uri) {
  return resolveMongoUri(uri)
    .then(function(uri) {
      return mongoose.connect(uri, {useMongoClient: true, server: {reconnectTries: 10}});
    })
    .otherwise(function(err) {
      logger.warn('Failed to connect to mongo on startup - retry in 10s: %s', err.stack, {});
      mongoose.disconnect();
      setTimeout(function () { return connectToMongo(uri).done(); }, 10000);
    });
}

function connectToAgenda(uri,agenda){
  return resolveMongoUri(uri)
    .then(function(uri) {
      agenda.agenda.agenda.database(uri, 'jobSchedule').maxConcurrency(100);
    })
    .otherwise(function(err) {
      logger.warn('failed to connect to agenda on startup - retry in 10s: %s', err.stack, {});
      setTimeout(function() { connectToAgenda(uri,agenda).done(); }, 10000);
    });
}

if(process.env.OVERRIDE_DNS) {
  console.log('using alternate nameserver:', process.env.OVERRIDE_DNS);
  dns.setServers([process.env.OVERRIDE_DNS]);
}

module.exports.resolveRequest = resolveRequest;
module.exports.resolveRequestForAllHosts = resolveRequestForAllHosts;
module.exports.connectToMongo = connectToMongo;
module.exports.connectToAgenda = connectToAgenda;
