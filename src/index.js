const request = require('request-promise');
const url = require('url');
const when = require('when');
const nodefn = require('when/node');
const dns = require('dns');
const logger = require('winston');
const mongoose = require('mongoose');

/**
* Helper function to get either 'uri' or 'url' based on what field is populated
* in the HTTP request options.
* @param {Object} opts - HTTP request options (should have a uri or url prop present)
* @return {string} 'uri' or 'url'
*/
module.exports.uriOrUrlKey = ({ uri }) => (uri ? 'uri' : 'url');
// exported for testing

/**
* Helper function for parsing the uri/url out of HTTP request options
* @param {Object} opts - HTTP request options
* @return {Object} parsedUrl
*/
module.exports.getParsedUrl = (opts) => url.parse(opts[module.exports.uriOrUrlKey(opts)]);
// exported for testing

/**
* Uses dns to find the hosts for a given hostname
* @param {string} hostname
* @return {string[]} hosts (address:port)
*/
function getHosts(hostname) {
  return nodefn
    .call(dns.resolveSrv, hostname)
    .then(srvs => (
      when.map(srvs, srv => nodefn.call(dns.resolve, srv.name).then(a => `${a}:${srv.port}`))
    ));
}

/**
* Given HTTP request options, returns the list of host urls that match
* @param {Object} opts - HTTP request options
* @return {string[]} The host urls
*/
function getHostUrls(opts) {
  const u = module.exports.getParsedUrl(opts);

  return getHosts(u.hostname)
    .then(hosts => {
      if (!hosts) return [];

      return hosts.map(host => `${u.protocol}//${u.auth ? `${u.auth}@` : ''}${host}${u.path}`);
    });
}

function resolveUri(opts) {
  const u = module.exports.getParsedUrl(opts);

  // Was told to keep for future Saph and Kevin work
  // if (process.env.ENVIRONMENT_NAME) {
  //   host = process.env.ENVIRONMENT_NAME + '.' + host;
  // }

  return getHosts(u.hostname)
    .then(hosts => `${u.protocol}//${u.auth ? `${u.auth}@` : ''}${hosts.join(',')}${u.path}`)
    .then(host => ({
      ...opts,
      [module.exports.uriOrUrlKey(opts)]: host,
    }));
}

module.exports.resolveRequest = (opts) => (
  resolveUri(opts)
    .otherwise(() => opts)
    .then(options => when(request(options)))
);

module.exports.resolveRequestForAllHosts = (opts) => (
  getHostUrls(opts)
    .then(hostUrls => ( // Map hostUrls to opts array
      hostUrls.map(hostUrl => ({
        ...opts,
        [module.exports.uriOrUrlKey(opts)]: hostUrl,
      }))
    ))
    .then(optsArray => when.map(optsArray, request))
    .otherwise(err => {
      logger.warn('Failed to resolve request for all hosts. Error: %s', err);
    })
);

function resolveMongoUri(uri) {
  const originalUri = uri;
  return resolveUri({ uri })
    .then(host => host.uri)
    .otherwise(originalUri);
}

module.exports.connectToMongo = (uri) => (
  resolveMongoUri(uri)
    .then(mongoUri => mongoose.connect(mongoUri, {
      useMongoClient: true,
      server: { reconnectTries: 10 },
    }))
    .otherwise(err => {
      logger.warn('Failed to connect to mongo on startup - retry in 10s: %s', err.stack, {});
      mongoose.disconnect();
      setTimeout(() => module.exports.connectToMongo(uri).done(), 10000);
    })
);

module.exports.connectToAgenda = (uri, agenda) => (
  resolveMongoUri(uri)
    .then(mongoUri => {
      agenda.agenda.agenda.database(mongoUri, 'jobSchedule').maxConcurrency(100);
    })
    .otherwise(err => {
      logger.warn('failed to connect to agenda on startup - retry in 10s: %s', err.stack, {});
      setTimeout(() => { module.exports.connectToAgenda(uri, agenda).done(); }, 10000);
    })
);

if (process.env.OVERRIDE_DNS) {
  console.log('using alternate nameserver:', process.env.OVERRIDE_DNS);
  dns.setServers([process.env.OVERRIDE_DNS]);
}
