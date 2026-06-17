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
  'script.js',
];

const legacyTerms = [
  /Gemini image cleanup/i,
  /export cleanup/i,
  /Nano Banana Prompt Guide/i,
  /PDF guide/i,
  /50\+ prompts/i,
  /parameter cheat sheets/i,
  /download-guide/i,
  /NOWPayments/i,
  /one-time.*\$4\.99/i,
  /\$4\.99.*lifetime/i,
];

for (const page of publicPages) {
  for (const term of legacyTerms) {
    assertNotMatches(page, term);
  }
}

assertJson('site.webmanifest');
assertJson('vercel.json');

assertIncludes('index.html', '<title>Gemini Watermark Remover');
assertIncludes('index.html', 'Removes the Nano Banana logo');
assertIncludes('pricing.html', 'Unlimited watermark removals');
assertIncludes('pricing.html', 'OMNI Video is a separate 30-day plan');
assertIncludes('pricing.html', '$9.99');
assertIncludes('pricing.html', 'Your license key');
assertIncludes('pricing.html', 'Telegram Stars is the available payment method right now');
assertIncludes('pricing.html', 'Card checkout is temporarily paused');
assertIncludes('pricing.html', 'Plisio crypto checkout');
assertIncludes('pricing.html', 'Open Plisio checkout');
assertIncludes('pricing.html', 'square-checkout-btn--disabled');
assertIncludes('script.js', 'bindBeforeAfterSlider');
assertIncludes('script.js', 'SLIDER_INITIAL_POSITION');
assertIncludes('script.js', '/api/plisio/create-invoice');
assertIncludes('script.js', '/api/plisio/status');
assertIncludes('style.css', '.pricing-alert');
assertIncludes('privacy.html', 'Banana Clean is a browser extension');
assertIncludes('privacy.html', 'Plisio invoice');
assertIncludes('llms.txt', 'Gemini watermark');
assertIncludes('llms.txt', 'Plisio crypto checkout');
assertIncludes('llms-full.txt', 'removes the Gemini watermark');
assertIncludes('llms-full.txt', 'Plisio crypto checkout');

assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/pricing</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/privacy</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/blog/');

assertIncludes('vercel.json', '"source": "/blog"');
assertIncludes('vercel.json', '"destination": "/blog/index.html"');

console.log('Banana Clean extension contract passed');
