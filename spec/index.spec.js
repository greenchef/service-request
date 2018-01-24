const { uriOrUrlKey, getParsedUrl } = require('../index.js');

describe('uriOrUrlKey', function() {
  it('should return "url" for empty object', function() {
    const opts = {};
    expect(uriOrUrlKey(opts)).toBe('url');
  });

  it('should prioritize "uri" over "url" if both props are present', function() {
    const opts = {
      uri: 'foo',
      url: 'foo',
    }
    expect(uriOrUrlKey(opts)).toBe('uri');
  });

  it('should return "url" if no "uri" prop is present', function() {
    const opts = {
      url: 'foo',
    }
    expect(uriOrUrlKey(opts)).toBe('url');
  });
});

describe('getParsedUrl', function() {
  beforeEach(function() {
    this.opts = {
      uri: 'https://testdoman/cache',
    }
  });

  it('should parse a hostname prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    expect(parsedUrl.hostname).toBeDefined();
  });

  it('should parse a protocol prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    expect(parsedUrl.protocol).toBeDefined();
  });

  it('should parse a auth prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    expect(parsedUrl.auth).toBeDefined();
  });

  it('should parse a path prop', function() {
    const parsedUrl = getParsedUrl(this.opts);
    expect(parsedUrl.path).toBeDefined();
  });
});
