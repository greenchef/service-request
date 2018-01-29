Centralized functionality for connecting to services.

# How To Include This Module
1. `cd` to the directory you want to work in.
2. `npm login` to login to npmjs from the terminal.
3. Add the package to your `package.json`: `npm install @greenchef/service-request --save`
4. Add the require statement to your files: `require('@greenchef/service-request')`

# Using This Module

## Agenda
```
const agenda = require('./lib/agenda');
const service = require('@greenchef/service-request');
return when(service.connectToAgenda('your-uri-here', agenda))
  .then(() => { ... });
```

## Mongo
```
const service = require('@greenchef/service-request');
return when(service.connectToMongo('your-uri-here'))
  .then(() => { ... });
```

## Request
```
const service = require('@greenchef/service-request');
return when(service.resolveRequest(requestOptions))
  .then((resolution) => { ... });
```

# Working with this Module

First: `npm install`

## Testing

To run: `npm test`

New spec files need to be in the `/test` directory.

## Building

`npm run build`

# More NPM info
https://confluence.greenchef.com/x/h418
