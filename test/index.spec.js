const assert = require('assert');
const sinon = require('sinon');

const sr = require('../index.js');
const { uriOrUrlKey, getParsedUrl } = sr;

describe('uriOrUrlKey', function() {
  it('should return "url" for empty object', function() {
    const opts = {};
    assert.deepStrictEqual(uriOrUrlKey(opts), 'url');
  });

  it('should prioritize "uri" over "url" if both props are present', function() {
    const opts = {
      uri: 'foo',
      url: 'foo',
    }
    assert.deepStrictEqual(uriOrUrlKey(opts), 'uri');
  });

  it('should return "url" if no "uri" prop is present', function() {
    const opts = {
      url: 'foo',
    }
    assert.deepStrictEqual(uriOrUrlKey(opts), 'url');
  });
});

describe('getParsedUrl', function() {
  beforeEach(function() {
    this.opts = {
      uri: 'https://user:pass@testdoman/cache',
    };
  });

  it('should parse a hostname prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    assert(parsedUrl.hostname);
  });

  it('should parse a protocol prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    assert(parsedUrl.protocol);
  });

  it('should parse an auth prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    assert(parsedUrl.auth);
  });

  it('should parse a path prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    assert(parsedUrl.path);
  });

  it('should call uriOrUrlKey', function() {
    const spy = sinon.spy(sr, 'uriOrUrlKey');
    const parsedUrl = getParsedUrl(this.opts);
    assert(spy.calledOnce);
  });
});
