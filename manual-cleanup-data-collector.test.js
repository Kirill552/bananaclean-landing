'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

global.document = { body: { dataset: { locale: 'en' } } };

const { createManualCleanupConfig } = require('./manual-cleanup/config.js');
const { createDataCollector } = require('./manual-cleanup/data-collector.js');

const root = __dirname;
const tinyPng = 'data:image/png;base64,iVBORw0KGgo=';

function createCanvas(name) {
  return {
    width: 12,
    height: 8,
    toDataURL(type) {
      assert.strictEqual(type, 'image/png');
      return tinyPng + name;
    }
  };
}

async function withFetchStub(run) {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async function fetchStub(url, options) {
    calls.push({ url, options });
    return {
      ok: true,
      json: async function () {
        return { ok: true };
      }
    };
  };

  try {
    await run(calls);
  } finally {
    global.fetch = previousFetch;
  }
}

function createCollector() {
  return createDataCollector({
    locale: 'en',
    sampleEndpoint: '/api/manual-cleanup-sample'
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function getFunctionBody(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notStrictEqual(start, -1, startMarker + ' must exist');
  assert.notStrictEqual(end, -1, endMarker + ' must exist after ' + startMarker);
  return source.slice(start, end);
}

function testConfigContract() {
  const config = createManualCleanupConfig();

  assert.strictEqual(config.sampleEndpoint, '/api/manual-cleanup-sample');
  assert.strictEqual(config.engine, 'migan');
  assert.strictEqual(config.miganModelUrl, '/models/migan/migan-pipeline-v2.onnx');
  assert.strictEqual(config.analyticsEndpoint, '/collect');
  assert(config.acceptedTypes.includes('image/png'));
  assert(config.acceptedTypes.includes('image/jpeg'));
  assert(config.acceptedTypes.includes('image/webp'));
}

function testStaticOrchestratorContract() {
  const source = read('manual-cleanup/manual-cleanup.js');
  const runCleanupBody = getFunctionBody(source, 'function runCleanup()', 'function downloadResult()');
  const sendSampleBody = getFunctionBody(source, 'function sendSample()', 'function bind()');

  assert(source.includes('manual_cleanup_view'));
  assert(source.includes('function getManualSource()'), 'manual analytics must normalize the from source once');
  assert(source.includes('function getManualUid()'), 'manual analytics must use a stable anonymous visitor id');
  assert(source.includes('uid: getManualUid()'), 'manual analytics must not collapse all users into one locale uid');
  assert(!source.includes("uid: 'manual-cleanup-' + config.locale"), 'manual analytics must not use a shared locale uid');
  assert(source.includes('manualProperties.from = getManualSource()'), 'all manual analytics events must include popup/toast/direct attribution');
  assert(source.includes('sendSample'));
  assert(source.includes('originalCanvas'), 'orchestrator must keep an immutable original canvas');
  assert(!runCleanupBody.includes('collector.collect'), 'runCleanup must not upload samples');
  assert(sendSampleBody.includes('imageCanvas: state.originalCanvas'), 'sample upload must use original image canvas');
  assert(fs.existsSync(path.join(root, 'manual-cleanup/migan-engine.js')), 'migan-engine.js must exist');
  assert(!fs.existsSync(path.join(root, 'manual-cleanup/lama-engine.js')), 'lama-engine.js must not be shipped');
}

async function testNoConsentSkipsNetwork() {
  await withFetchStub(async function (calls) {
    const result = await createCollector().collect({ userConsented: false });

    assert.deepStrictEqual(result, { skipped: true, reason: 'no_consent' });
    assert.strictEqual(calls.length, 0);
  });
}

async function testNoExplicitUploadSkipsNetwork() {
  await withFetchStub(async function (calls) {
    const result = await createCollector().collect({
      userConsented: true,
      explicitUploadRequested: false
    });

    assert.deepStrictEqual(result, { skipped: true, reason: 'no_explicit_upload' });
    assert.strictEqual(calls.length, 0);
  });
}

async function testExplicitUploadSendsSample() {
  await withFetchStub(async function (calls) {
    await createCollector().collect({
      userConsented: true,
      explicitUploadRequested: true,
      imageCanvas: createCanvas('image'),
      maskCanvas: createCanvas('mask'),
      meta: { brushVersion: 'manual-cleanup-v1', from: 'test' },
      source: 'manual_cleanup_page'
    });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].url, '/api/manual-cleanup-sample');
    assert.strictEqual(calls[0].options.method, 'POST');
    assert.deepStrictEqual(calls[0].options.headers, { 'Content-Type': 'application/json' });

    const payload = JSON.parse(calls[0].options.body);
    assert.strictEqual(payload.userConsented, true);
    assert.strictEqual(payload.locale, 'en');
    assert.strictEqual(payload.source, 'manual_cleanup_page');
    assert.strictEqual(payload.imageDataUrl, tinyPng + 'image');
    assert.strictEqual(payload.maskDataUrl, tinyPng + 'mask');
    assert.deepStrictEqual(payload.meta, { brushVersion: 'manual-cleanup-v1', from: 'test' });
  });
}

async function testNonOkJsonUsesServerError() {
  const previousFetch = global.fetch;
  global.fetch = async function () {
    return {
      ok: false,
      status: 400,
      json: async function () {
        return { error: 'invalid_sample' };
      }
    };
  };

  try {
    await assert.rejects(
      createCollector().collect({
        userConsented: true,
        explicitUploadRequested: true,
        imageCanvas: createCanvas('image'),
        maskCanvas: createCanvas('mask')
      }),
      /invalid_sample/
    );
  } finally {
    global.fetch = previousFetch;
  }
}

async function testNoContentResponseReturnsOk() {
  const previousFetch = global.fetch;
  global.fetch = async function () {
    return { ok: true, status: 204 };
  };

  try {
    const result = await createCollector().collect({
      userConsented: true,
      explicitUploadRequested: true,
      imageCanvas: createCanvas('image'),
      maskCanvas: createCanvas('mask')
    });
    assert.deepStrictEqual(result, { ok: true });
  } finally {
    global.fetch = previousFetch;
  }
}

async function main() {
  testConfigContract();
  testStaticOrchestratorContract();
  await testNoConsentSkipsNetwork();
  await testNoExplicitUploadSkipsNetwork();
  await testExplicitUploadSendsSample();
  await testNonOkJsonUsesServerError();
  await testNoContentResponseReturnsOk();
  console.log('manual cleanup EN data collector contract passed');
}

main().catch(function (error) {
  console.error(error);
  process.exit(1);
});
