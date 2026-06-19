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
  'gemini-watermark-remover.html',
  'nano-banana-watermark-remover.html',
  'blog/index.html',
  'blog/gemini-flow-video-watermark-cleanup.html',
  'blog/manual-ai-watermark-cleanup.html',
  'llms.txt',
  'llms-full.txt',
  'site.webmanifest',
  'script.js',
  'vercel.json',
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
  /RollyPay/i,
  /Square/i,
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
assertIncludes('pricing.html', 'Telegram Stars and crypto are available right now');
assertIncludes('pricing.html', 'Card checkout is unavailable');
assertIncludes('pricing.html', 'Plisio crypto checkout');
assertIncludes('pricing.html', 'Open Plisio checkout');
assertIncludes('script.js', 'bindBeforeAfterSlider');
assertIncludes('script.js', 'SLIDER_INITIAL_POSITION');
assertIncludes('script.js', '/api/plisio/create-invoice');
assertIncludes('script.js', '/api/plisio/status');
assertIncludes('style.css', '.pricing-alert');
assertIncludes('privacy.html', 'Banana Clean is a browser extension');
assertIncludes('privacy.html', 'Plisio invoice');
assertIncludes('llms.txt', 'Gemini watermark');
assertIncludes('llms.txt', 'Gemini Watermark Remover Online');
assertIncludes('llms.txt', 'Gemini and Google Flow Video Watermark Cleanup');
assertIncludes('llms.txt', 'Manual AI Watermark Cleanup');
assertIncludes('llms.txt', 'Plisio crypto checkout');
assertIncludes('llms-full.txt', 'removes the Gemini watermark');
assertIncludes('llms-full.txt', 'OMNI Video cleanup');
assertIncludes('llms-full.txt', 'Manual AI Watermark Cleanup');
assertIncludes('llms-full.txt', 'Plisio crypto checkout');

assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/gemini-watermark-remover</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/nano-banana-watermark-remover</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/pricing</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/privacy</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/blog</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/blog/gemini-flow-video-watermark-cleanup</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/blog/manual-ai-watermark-cleanup</loc>');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/blog/best-gemini-watermark-remover-tools</loc>');

assertIncludes('vercel.json', '"source": "/blog"');
assertIncludes('vercel.json', '"destination": "/blog/index.html"');
assertIncludes('vercel.json', '"source": "/gemini-watermark-remover"');
assertIncludes('vercel.json', '"destination": "/gemini-watermark-remover.html"');
assertIncludes('vercel.json', '"source": "/nano-banana-watermark-remover"');
assertIncludes('vercel.json', '"destination": "/nano-banana-watermark-remover.html"');
assertIncludes('index.html', '/gemini-watermark-remover');
assertIncludes('index.html', '/nano-banana-watermark-remover');
assertIncludes('index.html', '/blog/gemini-flow-video-watermark-cleanup');
assertIncludes('blog/index.html', '/blog/gemini-flow-video-watermark-cleanup');
assertIncludes('blog/index.html', '/blog/manual-ai-watermark-cleanup');
assertIncludes('gemini-watermark-remover.html', 'Gemini Watermark Remover Online');
assertIncludes('gemini-watermark-remover.html', '<link rel="stylesheet" href="blog.css">');
assertIncludes('gemini-watermark-remover.html', 'page-breadcrumbs');
assertIncludes('gemini-watermark-remover.html', 'FAQPage');
assertIncludes('nano-banana-watermark-remover.html', 'Nano Banana Watermark Remover');
assertIncludes('nano-banana-watermark-remover.html', '<link rel="stylesheet" href="blog.css">');
assertIncludes('nano-banana-watermark-remover.html', 'page-breadcrumbs');
assertIncludes('nano-banana-watermark-remover.html', 'FAQPage');
assertIncludes('blog/gemini-flow-video-watermark-cleanup.html', 'page-breadcrumbs');
assertIncludes('blog/gemini-flow-video-watermark-cleanup.html', 'FAQPage');
assertIncludes('blog/manual-ai-watermark-cleanup.html', 'page-breadcrumbs');
assertIncludes('blog/manual-ai-watermark-cleanup.html', 'FAQPage');

console.log('Banana Clean extension contract passed');
