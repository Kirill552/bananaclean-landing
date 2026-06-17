'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const enginePath = path.join(root, 'manual-cleanup', 'migan-engine.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(source, text) {
  assert(source.includes(text), 'migan-engine.js должен содержать: ' + text);
}

const source = read(enginePath);

assertIncludes(source, 'miganModelUrl');
assertIncludes(source, "new ort.Tensor('float32'");
assertIncludes(source, '[1, 4, MODEL_SIZE, MODEL_SIZE]');
assertIncludes(source, 'buildMiganInput');
assertIncludes(source, 'miganMaskExpand');
assertIncludes(source, 'miganFeatherRadius');
assertIncludes(source, 'expandMaskCanvas');
assertIncludes(source, 'blendMiganResultBack');
assertIncludes(source, 'mask = isInpaint ? 0.0 : 1.0');
assertIncludes(source, 'out[index] = mask - 0.5');
assertIncludes(source, '(value * 0.5 + 0.5) * 255');
assertIncludes(source, 'sessionState.session.inputNames[0]');
assert(!source.includes('sessionState.session.inputNames[1]'), 'MI-GAN 29 MB model has one input');
assert(!source.includes("new ort.Tensor('uint8'"), 'MI-GAN 29 MB model expects float32 input');
assert(!source.includes('app.blendResultBack || blendResultBack'), 'MI-GAN must not use LaMa feather blend');
assertIncludes(source, 'app.miganInpaint = inpaint');
assert(!source.includes('sampleEndpoint'), 'MI-GAN engine must not upload samples');
assert(!source.includes('analyticsEndpoint'), 'MI-GAN engine must not send analytics directly');
assertIncludes(read(path.join(root, 'manual-cleanup', 'config.js')), 'miganMaxOutputLongSide');
assertIncludes(read(path.join(root, 'manual-cleanup', 'manual-cleanup.js')), 'createDownloadCanvas');

console.log('manual cleanup MI-GAN EN contract passed');
