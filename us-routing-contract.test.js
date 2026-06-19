'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var landingRoot = __dirname;
var vercelJson = fs.readFileSync(path.join(landingRoot, 'vercel.json'), 'utf8');

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
  vercelJson.indexOf('"source": "/gemini-watermark-remover"') !== -1 &&
  vercelJson.indexOf('"destination": "/gemini-watermark-remover.html"') !== -1,
  'Gemini remover URL must rewrite to its SEO page'
);
assert(
  vercelJson.indexOf('"source": "/nano-banana-watermark-remover"') !== -1 &&
  vercelJson.indexOf('"destination": "/nano-banana-watermark-remover.html"') !== -1,
  'Nano Banana remover URL must rewrite to its SEO page'
);
assert(
  vercelJson.indexOf('"destination": "/manual-cleanup"') === -1,
  'SEO remover URLs must not redirect to manual cleanup'
);
assert(
  vercelJson.indexOf('https://nanobanana-clean.ru') === -1,
  'EN landing must not route API traffic to the RU backend'
);

console.log('US routing contract passed');
