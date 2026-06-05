'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var landingRoot = __dirname;
var vercelJson = fs.readFileSync(path.join(landingRoot, 'vercel.json'), 'utf8');
var squareProxyJs = fs.readFileSync(path.join(landingRoot, 'api', '_square.js'), 'utf8');

assert(
  vercelJson.indexOf('85.208.85.104') === -1,
  'EN Vercel rewrites must not point to the RU server'
);
assert(
  vercelJson.indexOf('https://api.banana-clean.app/api/:path*') !== -1,
  'EN API rewrite must point to the US API origin'
);
assert(
  vercelJson.indexOf('https://api.banana-clean.app/collect') !== -1,
  'EN analytics rewrite must point to the US analytics origin'
);
assert(
  squareProxyJs.indexOf("BACKEND_INTERNAL_BASE_URL || 'https://api.banana-clean.app'") !== -1,
  'Square proxy default backend must be the US API origin'
);
assert(
  squareProxyJs.indexOf("BACKEND_INTERNAL_BASE_URL || 'https://nanobanana-clean.ru'") === -1,
  'Square proxy must not default to the RU backend'
);

console.log('US routing contract passed');
