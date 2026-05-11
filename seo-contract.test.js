const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, text) {
  const body = read(file);
  assert(body.includes(text), `${file} must include: ${text}`);
}

function assertNotMatches(file, pattern) {
  const body = read(file);
  assert(!pattern.test(body), `${file} must not match: ${pattern}`);
}

function assertJson(file) {
  assert.doesNotThrow(() => JSON.parse(read(file)), `${file} must be valid JSON`);
}

const publicPages = [
  'index.html',
  'pricing.html',
  'privacy.html',
  'llms.txt',
  'llms-full.txt',
  'site.webmanifest',
];

const legacyTerms = [
  /\bwatermark\b/i,
  /\bremover\b/i,
  /Chrome Web Store/i,
  /extension popup/i,
  /license key/i,
  /Gemini image cleanup/i,
  /export cleanup/i,
];

for (const page of publicPages) {
  for (const term of legacyTerms) {
    assertNotMatches(page, term);
  }
}

assertJson('site.webmanifest');
assertJson('vercel.json');

assertIncludes('index.html', '<title>Nano Banana Prompt Guide');
assertIncludes('index.html', 'Instant PDF download');
assertIncludes('index.html', 'Free bonus tool included');
assertIncludes('pricing.html', 'Download PDF guide');
assertIncludes('pricing.html', '/api/download-guide?key=');
assertIncludes('pricing.html', 'Your bonus tool key');
assertIncludes('privacy.html', 'paid Nano Banana Prompt Guide');
assertIncludes('llms.txt', 'Nano Banana Prompt Guide');
assertIncludes('llms-full.txt', 'The PDF guide is delivered as a direct download');

assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/pricing</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/privacy</loc>');
assertNotMatches('sitemap.xml', /\/blog/i);
assertNotMatches('sitemap.xml', /watermark|remover/i);

assertIncludes('vercel.json', '"source": "/blog/:path*"');
assertIncludes('vercel.json', '"destination": "/"');
assertNotMatches('vercel.json', /"destination": "\/blog/i);

console.log('Prompt guide contract passed');
