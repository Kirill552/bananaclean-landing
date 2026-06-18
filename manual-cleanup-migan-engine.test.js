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

function assertExcludes(source, text) {
  assert(!source.includes(text), 'migan-engine.js НЕ должен содержать (старый интерфейс): ' + text);
}

const source = read(enginePath);

// Новый pipeline_v2 интерфейс: 2 входа uint8, динамическое разрешение.
assertIncludes(source, 'miganModelUrl');
assertIncludes(source, "new ort.Tensor('uint8'");
assertIncludes(source, '[1, 3, height, width]'); // image tensor (нативное разрешение)
assertIncludes(source, '[1, 1, height, width]'); // mask tensor
assertIncludes(source, 'buildImageTensor');
assertIncludes(source, 'buildMaskTensor');
assertIncludes(source, 'session.inputNames[0]');
assertIncludes(source, 'session.inputNames[1]'); // 2 входа: image + mask
assertIncludes(source, 'miganMaskExpand');
assertIncludes(source, 'miganFeatherRadius');
assertIncludes(source, 'getWorkingSize');
assertIncludes(source, 'shouldUseTextureFallback');
assertIncludes(source, 'createScaledCanvas');
assertIncludes(source, 'resizeChwToFullBilinear');
assertIncludes(source, 'expandMaskCanvas');
assertIncludes(source, 'compositeResultBack');
// Полярность маски: 0 = дырка (чистить), 255 = оставить.
assertIncludes(source, '> HOLE_ALPHA_THRESHOLD ? 0 : 255');
assertIncludes(source, 'app.miganInpaint = inpaint');

// Старый fixed-512 / 4-канальный float32 интерфейс должен быть удалён.
assertExcludes(source, "new ort.Tensor('float32'");
assertExcludes(source, 'MODEL_SIZE');
assertExcludes(source, '[1, 4,');
assertExcludes(source, 'buildMiganInput');
assertExcludes(source, 'mask - 0.5');
// LaMa feather blend всё ещё запрещён.
assertExcludes(source, 'app.blendResultBack || blendResultBack');
// Движок не должен сам грузить семплы/аналитику.
assertExcludes(source, 'sampleEndpoint');
assertExcludes(source, 'analyticsEndpoint');

// Конфиг: новый pipeline_v2 файл + сохранён ключ нативного вывода.
const configSrc = read(path.join(root, 'manual-cleanup', 'config.js'));
assertIncludes(configSrc, 'miganTextureFallbackLongSide: 1024');
assertIncludes(configSrc, 'miganMaxOutputLongSide');
assertIncludes(configSrc, 'migan-pipeline-v2.onnx');

// Оркестратор всё ещё отдаёт скачивание исходного холста.
assertIncludes(read(path.join(root, 'manual-cleanup', 'manual-cleanup.js')), 'createDownloadCanvas');

console.log('manual cleanup MI-GAN EN contract passed');
