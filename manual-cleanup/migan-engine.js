'use strict';

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};
  var MODEL_CACHE_NAME = 'banana-clean-manual-migan-v1';
  var MODEL_SIZE = 512;
  var DEFAULT_MODEL_VERSION = '2026-06-16';
  var DEFAULT_MODEL_URL = '/models/migan/migan.onnx';
  var DEFAULT_ORT_BASE_URL = '/manual-cleanup/ort/';
  var ORT_RUNTIME_WEBGPU = 'webgpu';
  var ORT_RUNTIME_WASM = 'wasm';
  var sessionPromise = null;
  var sessionCacheKey = null;
  var ortScriptPromise = null;
  var ortScriptRuntime = null;

  function inpaint(imageCanvas, maskImageData, config) {
    if (!imageCanvas || !maskImageData) return Promise.reject(new Error('manual_cleanup_input_missing'));
    return loadMiganSession(config || {}).then(function (sessionState) {
      return runMiganRoiInpaint(sessionState, imageCanvas, maskImageData, config || {});
    });
  }

  function loadMiganSession(config) {
    var modelUrl = config.miganModelUrl || DEFAULT_MODEL_URL;
    var ortBaseUrl = config.ortBaseUrl || DEFAULT_ORT_BASE_URL;
    var cacheKey = getModelRequestUrl(modelUrl, config) + '|' + ortBaseUrl;
    if (sessionPromise && sessionCacheKey === cacheKey) return sessionPromise;
    sessionCacheKey = cacheKey;
    sessionPromise = loadPreferredOrtRuntime(ortBaseUrl).then(function (runtimeState) {
      configureOrt(runtimeState.ort, ortBaseUrl, runtimeState.runtime);
      return loadModelBuffer(modelUrl, config).then(function (modelBuffer) {
        return createSessionWithFallback(runtimeState, modelBuffer, ortBaseUrl);
      });
    }).catch(function (error) { sessionPromise = null; sessionCacheKey = null; throw error; });
    return sessionPromise;
  }

  function runMiganRoiInpaint(sessionState, imageCanvas, maskImageData, config) {
    var bounds = getMaskBounds(maskImageData);
    if (!bounds) return Promise.reject(new Error('manual_cleanup_mask_empty'));
    var inputName = sessionState.session.inputNames[0];
    if (!inputName) return Promise.reject(new Error('manual_cleanup_migan_input_missing'));
    var roi = createMiganRoi(bounds, imageCanvas.width, imageCanvas.height);
    var imageRoi = extractRoi(imageCanvas, roi);
    var maskRoi = expandMaskCanvas(extractMaskRoi(maskImageData, roi), config.miganMaskExpand);
    var inputTensor = createMiganTensor(
      sessionState.ort,
      resizeCanvas(imageRoi, MODEL_SIZE, MODEL_SIZE, true),
      resizeCanvas(maskRoi, MODEL_SIZE, MODEL_SIZE, false)
    );
    var feeds = {};
    feeds[sessionState.session.inputNames[0]] = inputTensor;
    return runSession(sessionState.session, feeds).then(function (outputTensor) {
      var outputSize = getOutputSize(outputTensor, roi);
      var outputCanvas = tensorToCanvas(outputTensor.data, outputSize.width, outputSize.height);
      blendMiganResultBack(imageCanvas, roi, outputCanvas, maskRoi, config);
    });
  }

  function createMiganTensor(ort, imageCanvas, maskCanvas) {
    return new ort.Tensor('float32', buildMiganInput(imageCanvas, maskCanvas), [1, 4, MODEL_SIZE, MODEL_SIZE]);
  }

  function buildMiganInput(imageCanvas, maskCanvas) {
    var data = get2dContext(imageCanvas).getImageData(0, 0, imageCanvas.width, imageCanvas.height).data;
    var maskData = get2dContext(maskCanvas).getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    var area = imageCanvas.width * imageCanvas.height;
    var out = new Float32Array(area * 4);
    for (var index = 0; index < area; index += 1) {
      var offset = index * 4;
      var isInpaint = maskData[offset + 3] > 64;
      var mask = isInpaint ? 0.0 : 1.0;
      var r = data[offset] / 255 * 2 - 1;
      var g = data[offset + 1] / 255 * 2 - 1;
      var b = data[offset + 2] / 255 * 2 - 1;
      out[index] = mask - 0.5;
      out[area + index] = r * mask;
      out[area * 2 + index] = g * mask;
      out[area * 3 + index] = b * mask;
    }
    return out;
  }

  function runSession(session, feeds) {
    if (app.runSession) return app.runSession(session, feeds);
    return session.run(feeds).then(function (outputs) {
      var keys = Object.keys(outputs || {});
      if (!keys.length || !outputs[keys[0]]) throw new Error('manual_cleanup_model_empty_output');
      return outputs[keys[0]];
    });
  }

  function createSessionWithFallback(runtimeState, modelBuffer, ortBaseUrl) {
    if (runtimeState.runtime !== ORT_RUNTIME_WEBGPU) {
      return createWasmSession(runtimeState.ort, modelBuffer);
    }

    return runtimeState.ort.InferenceSession.create(modelBuffer, { executionProviders: ['webgpu'] }).then(function (session) {
      return { ort: runtimeState.ort, provider: 'webgpu', session: session };
    }).catch(function () {
      return loadOrtRuntime(ortBaseUrl, ORT_RUNTIME_WASM, true).then(function (wasmState) {
        configureOrt(wasmState.ort, ortBaseUrl, ORT_RUNTIME_WASM);
        return createWasmSession(wasmState.ort, modelBuffer);
      });
    });
  }

  function createWasmSession(ort, modelBuffer) {
    return ort.InferenceSession.create(modelBuffer, { executionProviders: ['wasm'] }).then(function (session) {
      return { ort: ort, provider: 'wasm', session: session };
    });
  }

  function loadPreferredOrtRuntime(ortBaseUrl) {
    return loadOrtRuntime(ortBaseUrl, shouldUseWebGpuRuntime() ? ORT_RUNTIME_WEBGPU : ORT_RUNTIME_WASM, false);
  }

  function shouldUseWebGpuRuntime() {
    return !!(root.navigator &&
      root.navigator.gpu &&
      typeof root.navigator.gpu.requestAdapter === 'function' &&
      !isProblematicWebGpuBrowser());
  }

  function isProblematicWebGpuBrowser() {
    var userAgent = root.navigator && root.navigator.userAgent ? root.navigator.userAgent : '';
    return /YaBrowser|Yowser|YaApp_Android/i.test(userAgent);
  }

  function loadOrtRuntime(ortBaseUrl, runtime, forceReload) {
    if (!forceReload && root.ort && root.ort.InferenceSession && ortScriptRuntime === runtime) {
      return Promise.resolve({ ort: root.ort, runtime: runtime });
    }
    if (!forceReload && ortScriptPromise && ortScriptRuntime === runtime) return ortScriptPromise;
    ortScriptRuntime = runtime;
    ortScriptPromise = new Promise(function (resolve, reject) {
      if (!root.document || !root.document.createElement) { reject(new Error('manual_cleanup_dom_unavailable')); return; }
      var script = root.document.createElement('script');
      script.async = true;
      script.src = resolveSameOriginAssetUrl(ortBaseUrl || DEFAULT_ORT_BASE_URL, getOrtScriptName(runtime));
      script.onload = function () {
        if (root.ort && root.ort.InferenceSession) resolve({ ort: root.ort, runtime: runtime });
        else reject(new Error('manual_cleanup_ort_missing'));
      };
      script.onerror = function () { reject(new Error('manual_cleanup_ort_load_failed')); };
      root.document.head.appendChild(script);
    }).catch(function (error) { ortScriptPromise = null; throw error; });
    return ortScriptPromise;
  }

  function getOrtScriptName(runtime) {
    return runtime === ORT_RUNTIME_WASM ? 'ort.wasm.min.js' : 'ort.webgpu.min.js';
  }

  function configureOrt(ort, ortBaseUrl, runtime) {
    if (!ort.env) return;
    ort.env.logLevel = 'warning';
    if (!ort.env.wasm) return;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = runtime === ORT_RUNTIME_WASM
      ? {
        mjs: resolveSameOriginAssetUrl(ortBaseUrl || DEFAULT_ORT_BASE_URL, 'ort-wasm-simd-threaded.mjs'),
        wasm: resolveSameOriginAssetUrl(ortBaseUrl || DEFAULT_ORT_BASE_URL, 'ort-wasm-simd-threaded.wasm')
      }
      : {
        mjs: resolveSameOriginAssetUrl(ortBaseUrl || DEFAULT_ORT_BASE_URL, 'ort-wasm-simd-threaded.jsep.mjs'),
        wasm: resolveSameOriginAssetUrl(ortBaseUrl || DEFAULT_ORT_BASE_URL, 'ort-wasm-simd-threaded.jsep.wasm')
      };
  }

  function loadModelBuffer(modelUrl, config) {
    var requestUrl = getModelRequestUrl(modelUrl || DEFAULT_MODEL_URL, config || {});
    var base = root.location && root.location.href ? root.location.href : 'http://localhost/';
    var request = new Request(new URL(requestUrl, base).href, { credentials: 'same-origin', mode: 'same-origin' });
    if (!root.caches) return fetchModel(request);
    return root.caches.open(MODEL_CACHE_NAME).then(function (cache) {
      return cache.match(request).then(function (cachedResponse) {
        if (cachedResponse) return cachedResponse.arrayBuffer();
        return fetchModel(request).then(function (buffer) {
          return cache.put(request, new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } }))
            .catch(function () {}).then(function () { return buffer; });
        });
      });
    }).catch(function () { return fetchModel(request); });
  }

  function fetchModel(request) {
    return root.fetch(request).then(function (response) {
      if (!response.ok) throw new Error('manual_cleanup_model_load_failed');
      return response.arrayBuffer();
    });
  }

  function getModelRequestUrl(modelUrl, config) {
    var url = createSameOriginUrl(modelUrl || DEFAULT_MODEL_URL);
    if (!url.searchParams.has('v')) url.searchParams.set('v', (config && config.miganModelVersion) || DEFAULT_MODEL_VERSION);
    return url.pathname + url.search + url.hash;
  }

  function getOutputSize(outputTensor, roi) {
    var dims = outputTensor && outputTensor.dims;
    if (dims && dims.length === 4 && dims[2] && dims[3]) return { width: dims[3], height: dims[2] };
    return { width: MODEL_SIZE, height: MODEL_SIZE };
  }

  function tensorToCanvas(tensorData, width, height) {
    var canvas = createCanvas(width, height);
    var ctx = get2dContext(canvas);
    var output = ctx.createImageData(width, height);
    var area = width * height;
    for (var index = 0; index < area; index += 1) {
      output.data[index * 4] = miganValueToByte(tensorData[index]);
      output.data[index * 4 + 1] = miganValueToByte(tensorData[area + index]);
      output.data[index * 4 + 2] = miganValueToByte(tensorData[area * 2 + index]);
      output.data[index * 4 + 3] = 255;
    }
    ctx.putImageData(output, 0, 0);
    return canvas;
  }

  function miganValueToByte(rawValue) {
    var value = Number(rawValue || 0);
    return clamp(Math.round((value * 0.5 + 0.5) * 255), 0, 255);
  }

  function getMaskBounds(maskImageData) {
    if (!maskImageData || !maskImageData.data) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var y = 0; y < maskImageData.height; y += 1) {
      for (var x = 0; x < maskImageData.width; x += 1) {
        if (maskImageData.data[(y * maskImageData.width + x) * 4 + 3] <= 0) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (!Number.isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function createMiganRoi(bounds, imageWidth, imageHeight) {
    var maskDim = Math.max(bounds.width, bounds.height);
    var side = Math.min(Math.max(MODEL_SIZE, maskDim * 3), imageWidth, imageHeight);
    var x = clamp(Math.round(bounds.x + bounds.width / 2 - side / 2), 0, imageWidth - side);
    var y = clamp(Math.round(bounds.y + bounds.height / 2 - side / 2), 0, imageHeight - side);
    return { x: x, y: y, width: side, height: side };
  }

  function extractRoi(imageCanvas, roi) {
    var canvas = createCanvas(roi.width, roi.height);
    get2dContext(canvas).drawImage(imageCanvas, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
    return canvas;
  }

  function extractMaskRoi(maskImageData, roi) {
    var canvas = createCanvas(roi.width, roi.height);
    var ctx = get2dContext(canvas);
    var imageData = ctx.createImageData(roi.width, roi.height);
    for (var y = 0; y < roi.height; y += 1) {
      for (var x = 0; x < roi.width; x += 1) {
        var sourceOffset = ((roi.y + y) * maskImageData.width + roi.x + x) * 4;
        var targetOffset = (y * roi.width + x) * 4;
        imageData.data[targetOffset] = 255;
        imageData.data[targetOffset + 1] = 255;
        imageData.data[targetOffset + 2] = 255;
        imageData.data[targetOffset + 3] = maskImageData.data[sourceOffset + 3] > 0 ? 255 : 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function resizeCanvas(source, width, height, smoothing) {
    var canvas = createCanvas(width, height);
    var ctx = get2dContext(canvas);
    ctx.imageSmoothingEnabled = smoothing !== false;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  function expandMaskCanvas(maskCanvas, pixels) {
    var radius = Math.max(0, Math.round(Number(pixels) || 0));
    if (!radius) return maskCanvas;
    var canvas = createCanvas(maskCanvas.width, maskCanvas.height);
    var ctx = get2dContext(canvas);
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.filter = 'blur(' + radius + 'px)';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.filter = 'none';
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (var index = 3; index < imageData.data.length; index += 4) {
      imageData.data[index] = imageData.data[index] > 1 ? 255 : 0;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function blendMiganResultBack(imageCanvas, roi, outputCanvas, maskCanvas, config) {
    var patchCanvas = outputCanvas;
    if (outputCanvas.width !== roi.width || outputCanvas.height !== roi.height) {
      patchCanvas = resizeCanvas(outputCanvas, roi.width, roi.height, true);
    }
    var binaryMask = createBinaryMask(maskCanvas);
    var featherMask = createCanvas(roi.width, roi.height);
    var featherCtx = get2dContext(featherMask);
    var featherRadius = Math.max(0, Math.round(Number(config.miganFeatherRadius) || 0));
    if (featherRadius > 0) featherCtx.filter = 'blur(' + featherRadius + 'px)';
    featherCtx.drawImage(binaryMask, 0, 0, roi.width, roi.height);
    featherCtx.filter = 'none';

    var maskedPatch = createCanvas(roi.width, roi.height);
    var maskedCtx = get2dContext(maskedPatch);
    maskedCtx.drawImage(patchCanvas, 0, 0, roi.width, roi.height);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(featherMask, 0, 0, roi.width, roi.height);
    get2dContext(imageCanvas).drawImage(maskedPatch, roi.x, roi.y);
  }

  function createBinaryMask(maskCanvas) {
    var canvas = createCanvas(maskCanvas.width, maskCanvas.height);
    var ctx = get2dContext(canvas);
    var source = get2dContext(maskCanvas).getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    var imageData = ctx.createImageData(maskCanvas.width, maskCanvas.height);
    for (var index = 0; index < source.data.length; index += 4) {
      var alpha = source.data[index + 3] > 0 ? 255 : 0;
      imageData.data[index] = 255;
      imageData.data[index + 1] = 255;
      imageData.data[index + 2] = 255;
      imageData.data[index + 3] = alpha;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function createCanvas(width, height) {
    if (root.document && root.document.createElement) {
      var canvas = root.document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      return canvas;
    }
    if (typeof root.OffscreenCanvas !== 'undefined') return new root.OffscreenCanvas(width, height);
    throw new Error('manual_cleanup_canvas_unavailable');
  }

  function get2dContext(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('manual_cleanup_canvas_2d_unavailable');
    return ctx;
  }

  function resolveSameOriginAssetUrl(baseOrUrl, fileName) {
    var raw = fileName ? joinUrl(baseOrUrl, fileName) : baseOrUrl;
    var url = createSameOriginUrl(raw);
    return url.pathname + url.search + url.hash;
  }

  function createSameOriginUrl(raw) {
    var url = new URL(raw, root.location && root.location.href ? root.location.href : 'http://localhost/');
    var currentOrigin = root.location && root.location.origin ? root.location.origin : url.origin;
    if (url.origin !== currentOrigin) throw new Error('manual_cleanup_cross_origin_asset_blocked');
    return url;
  }

  function joinUrl(baseUrl, fileName) {
    return String(baseUrl || '').replace(/\/?$/, '/') + fileName;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  app.miganInpaint = inpaint;
  app.createMiganTensor = createMiganTensor;
  app.buildMiganInput = buildMiganInput;
  app.expandMaskCanvas = expandMaskCanvas;
  app.blendMiganResultBack = blendMiganResultBack;
  app.loadMiganSession = loadMiganSession;
  app.runMiganRoiInpaint = runMiganRoiInpaint;
  root.BananaManualCleanup = app;
  return app;
});
