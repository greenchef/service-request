const request = require('request-promise');
const url = require('url');
const when = require('when');
const nodefn = require('when/node');
const dns = require('dns');
const logger = require('winston');
const mongoose = require('mongoose');

function resolveUri(opts) {
  const key = opts.uri ? 'uri' : 'url';
  var u = url.parse(opts[key]);
  if(process.env.ENVIRONMENT_NAME) {
    host = process.env.ENVIRONMENT_NAME+"."+host;
  }
  return nodefn
    .call(dns.resolveSrv, u.hostname)
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
    .then(function(hosts) {
      return u.protocol + '//' + (u.auth ? u.auth + '@' : '') + hosts.join(',') + u.path
    })
    .then(function(host) {
      opts[key] = host;
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

module.exports.connectToAgenda = connectToAgenda;
module.exports.connectToMongo = connectToMongo;
module.exports.resolveRequest = resolveRequest;
