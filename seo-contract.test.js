const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, text) {
  const html = read(file);
  assert(
    html.includes(text),
    `${file} must include: ${text}`
  );
}

function assertMatches(file, pattern) {
  const html = read(file);
  assert(
    pattern.test(html),
    `${file} must match: ${pattern}`
  );
}

const pages = [
  'index.html',
  'gemini-watermark-remover.html',
  'nano-banana-watermark-remover.html',
  'blog/google-ai-studio-watermark.html',
  'blog/how-to-remove-gemini-watermark.html',
  'blog/gemini-images-copyright-commercial-use.html',
  'blog/best-gemini-watermark-remover-tools.html',
];

for (const page of pages) {
  const html = read(page);
  assert(!/<meta[^>]+noindex/i.test(html), `${page} must be indexable`);
  assertMatches(page, /<link rel="canonical" href="https:\/\/banana-clean\.app\//);
}

assertIncludes(
  'index.html',
  '<a href="/gemini-watermark-remover" class="btn-secondary" id="hero-online-tool-link">Use Online Tool</a>'
);
assertIncludes(
  'index.html',
  '<a href="/nano-banana-watermark-remover">Nano Banana Remover</a>'
);
assertIncludes(
  'gemini-watermark-remover.html',
  '<title>Gemini Watermark Remover Online - Free, No Uploads | Banana Clean</title>'
);
assertIncludes(
  'gemini-watermark-remover.html',
  '<h1><span class="accent">Gemini</span> Watermark Remover Online</h1>'
);
assertIncludes(
  'nano-banana-watermark-remover.html',
  '<title>Nano Banana Watermark Remover - Free Online Tool | Banana Clean</title>'
);
assertIncludes(
  'nano-banana-watermark-remover.html',
  '<h1><span class="accent">Nano Banana</span> Watermark Remover</h1>'
);
assertIncludes(
  'blog/google-ai-studio-watermark.html',
  '<title>Google AI Studio Watermark Remover - Free 2026 Guide</title>'
);
assertIncludes(
  'blog/gemini-images-copyright-commercial-use.html',
  '<title>Can I Use Gemini Generated Images Commercially? 2026 Rights Guide</title>'
);
assertIncludes(
  'blog/best-gemini-watermark-remover-tools.html',
  '<a href="/gemini-watermark-remover">Gemini Watermark Remover Online</a>'
);
assertIncludes(
  'sitemap.xml',
  '<loc>https://banana-clean.app/nano-banana-watermark-remover</loc>'
);
assertIncludes(
  'llms.txt',
  '[Nano Banana Watermark Remover](https://banana-clean.app/nano-banana-watermark-remover)'
);

console.log('SEO contract passed');
