const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

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

function extractMaskDataUrl(file, variableName) {
  const html = read(file);
  const matches = Array.from(html.matchAll(new RegExp(`var ${variableName} = '([^']+)';`, 'g')));
  assert.strictEqual(matches.length, 1, `${file} must define exactly one ${variableName}`);
  return matches[0][1];
}

function assertPngMask(file, variableName, expectedWidth, expectedHeight) {
  const dataUrl = extractMaskDataUrl(file, variableName);
  assert(
    dataUrl.startsWith('data:image/png;base64,'),
    `${file} ${variableName} must be a PNG data URL`
  );

  const buffer = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  assert(buffer.length >= 33, `${file} ${variableName} must contain PNG data`);
  assert.strictEqual(
    buffer.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${file} ${variableName} must have a PNG signature`
  );
  assert.strictEqual(buffer.readUInt32BE(16), expectedWidth, `${file} ${variableName} width`);
  assert.strictEqual(buffer.readUInt32BE(20), expectedHeight, `${file} ${variableName} height`);

  let offset = 8;
  const idatChunks = [];
  let hasIend = false;
  while (offset < buffer.length) {
    assert(offset + 12 <= buffer.length, `${file} ${variableName} has a truncated PNG chunk`);
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    assert(chunkEnd + 4 <= buffer.length, `${file} ${variableName} has a truncated ${chunkType} chunk`);

    if (chunkType === 'IDAT') {
      idatChunks.push(buffer.subarray(chunkStart, chunkEnd));
    }
    if (chunkType === 'IEND') {
      hasIend = true;
      break;
    }
    offset = chunkEnd + 4;
  }

  assert(hasIend, `${file} ${variableName} must include an IEND chunk`);
  assert(idatChunks.length > 0, `${file} ${variableName} must include IDAT data`);
  assert.doesNotThrow(
    () => zlib.inflateSync(Buffer.concat(idatChunks)),
    `${file} ${variableName} IDAT data must inflate`
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

for (const page of ['gemini-watermark-remover.html', 'nano-banana-watermark-remover.html']) {
  assertPngMask(page, 'BANANA_MASK_48_BASE64', 48, 48);
  assertPngMask(page, 'BANANA_MASK_96_BASE64', 96, 96);
}

console.log('SEO contract passed');
