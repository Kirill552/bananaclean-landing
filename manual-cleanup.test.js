'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(file, text) {
  assert(read(file).includes(text), file + ' must include: ' + text);
}

function assertNotIncludes(file, text) {
  assert(!read(file).includes(text), file + ' must not include: ' + text);
}

function assertFileExists(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), relativePath + ' must exist');
}

assertIncludes('manual-cleanup.html', '<title>Free AI Watermark &amp; Object Remover');
assertIncludes('manual-cleanup.html', 'Brush out leftover Gemini and Nano Banana watermarks');
assertIncludes('manual-cleanup.html', 'property="og:title"');
assertIncludes('manual-cleanup.html', 'application/ld+json');
assertIncludes('manual-cleanup.html', '<link rel="canonical" href="https://banana-clean.app/manual-cleanup">');
assertIncludes('manual-cleanup.html', 'Manual Gemini watermark remover');
assertIncludes('manual-cleanup.html', 'erase it locally');
assertIncludes('manual-cleanup.html', 'id="resultPanel"');
assertIncludes('manual-cleanup.html', 'id="resultMeta"');
assertIncludes('manual-cleanup.html', 'manual-cleanup__result-grid');
assertIncludes('manual-cleanup.html', 'id="beforePreview"');
assertIncludes('manual-cleanup.html', 'id="afterPreview"');
assertIncludes('manual-cleanup.html', 'id="brushCursor"');
assertIncludes('manual-cleanup.html', 'id="brushSizeValue"');
assertIncludes('manual-cleanup.html', 'id="sampleConsent"');
assertIncludes('manual-cleanup.html', 'Send the original image and mask');
assertIncludes('manual-cleanup.html', 'Related cleanup paths');
assertIncludes('manual-cleanup.html', '/gemini-watermark-remover');
assertIncludes('manual-cleanup.html', '/nano-banana-watermark-remover');
assertIncludes('manual-cleanup.html', '/blog/manual-ai-watermark-cleanup');
assertIncludes('manual-cleanup.html', '/blog/gemini-flow-video-watermark-cleanup');
assertIncludes('manual-cleanup.html', 'FAQPage');
assertIncludes('manual-cleanup.html', 'manual-cleanup/config.js');
assertIncludes('manual-cleanup.html', 'manual-cleanup/data-collector.js?v=20260623-storage-check');
assertIncludes('manual-cleanup.html', 'manual-cleanup/migan-engine.js');
assertIncludes('manual-cleanup.html', 'manual-cleanup/migan-engine.js?v=20260618-texture-fallback');
assertIncludes('manual-cleanup.html', 'manual-cleanup/manual-cleanup.js');
assertNotIncludes('manual-cleanup.html', 'manual-cleanup/lama-engine.js');
assertNotIncludes('manual-cleanup.html', '<form');
assertNotIncludes('manual-cleanup.html', 'data-before-after');
assertNotIncludes('manual-cleanup.html', 'id="resultCompare"');
assertNotIncludes('manual-cleanup.html', 'id="compareRange"');
assertNotIncludes('manual-cleanup.html', 'manual-cleanup__hero-panel');

assertIncludes('vercel.json', '"/manual-cleanup"');
assertIncludes('vercel.json', '"/manual-cleanup.html"');
assertIncludes('sitemap.xml', '<loc>https://banana-clean.app/manual-cleanup</loc>');
assertIncludes('llms.txt', 'Manual Gemini watermark remover');
assertIncludes('llms-full.txt', 'Manual Gemini watermark remover');
assertIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__brush-cursor');
assertIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__result-grid');
assertIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__related-grid');
assertIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__dropzone input');
assertIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__editor[hidden]');
assertNotIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__compare');
assertNotIncludes('manual-cleanup/manual-cleanup.css', '.manual-cleanup__hero-panel');
assertIncludes('manual-cleanup/config.js', 'miganModelUrl');
assertIncludes('manual-cleanup/config.js', "engine: 'migan'");
assertIncludes('manual-cleanup/config.js', 'miganTextureFallbackLongSide: 1024');
assertIncludes('manual-cleanup/config.js', 'miganMaxOutputLongSide: 0');
assertIncludes('manual-cleanup/config.js', "sampleEndpoint: '/api/manual-cleanup-sample'");
assertIncludes('manual-cleanup/config.js', "analyticsEndpoint: '/collect'");
assertIncludes('manual-cleanup/manual-cleanup.js', 'app.miganInpaint');
assertIncludes('manual-cleanup/manual-cleanup.js', 'showResultPanel');
assertIncludes('manual-cleanup/manual-cleanup.js', 'resultPanel');
assertNotIncludes('manual-cleanup/manual-cleanup.js', 'showResultCompare');
assertNotIncludes('manual-cleanup/manual-cleanup.js', 'compareRange');
assertFileExists('models/migan/migan-pipeline-v2.onnx');
assertFileExists('manual-cleanup/ort/ort.webgpu.min.js');
assertFileExists('manual-cleanup/ort/ort-wasm-simd-threaded.jsep.wasm');
assertFileExists('manual-cleanup/ort/ort-wasm-simd-threaded.mjs');
assertFileExists('manual-cleanup/ort/ort-wasm-simd-threaded.wasm');
assertFileExists('manual-cleanup/ort/ort.wasm.min.js');

console.log('manual cleanup EN contract passed');
