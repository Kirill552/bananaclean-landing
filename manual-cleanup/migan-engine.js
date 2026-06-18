'use strict';

// MI-GAN pipeline_v2 engine: 2 входа uint8 (image[1,3,H,W] + mask[1,1,H,W]),
// ДИНАМИЧЕСКОЕ разрешение — прогон в нативном размере без ужатия в 512.
// Маска: 0 = дырка (чистить), 255 = оставить. Выход result[1,3,H,W] uint8
// композитится обратно ТОЛЬКО в зону мазка (остальной кадр не трогаем).

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};
  var MODEL_CACHE_NAME = 'banana-clean-manual-migan-v2';
  var DEFAULT_MODEL_VERSION = '2026-06-18-pipeline-v2';
  var DEFAULT_MODEL_URL = '/models/migan/migan-pipeline-v2.onnx';
  var DEFAULT_ORT_BASE_URL = '/manual-cleanup/ort/';
  var ORT_RUNTIME_WEBGPU = 'webgpu';
  var ORT_RUNTIME_WASM = 'wasm';
  var HOLE_ALPHA_THRESHOLD = 64;
  var sessionPromise = null;
  var sessionCacheKey = null;
  var ortScriptPromise = null;
  var ortScriptRuntime = null;

  function inpaint(imageCanvas, maskImageData, config) {
    if (!imageCanvas || !maskImageData) return Promise.reject(new Error('manual_cleanup_input_missing'));
    return loadMiganSession(config || {}).then(function (sessionState) {
      return runMiganInpaint(sessionState, imageCanvas, maskImageData, config || {});
    });
  }

  function runMiganInpaint(sessionState, imageCanvas, maskImageData, config) {
    var bounds = getMaskBounds(maskImageData);
    if (!bounds) return Promise.reject(new Error('manual_cleanup_mask_empty'));
    var session = sessionState.session;
    var ort = sessionState.ort;
    if (!session.inputNames || session.inputNames.length < 2) {
      return Promise.reject(new Error('manual_cleanup_migan_inputs_missing'));
    }
    var width = imageCanvas.width;
    var height = imageCanvas.height;
    var imageData = get2dContext(imageCanvas).getImageData(0, 0, width, height).data;
    var holeCanvas = expandMaskCanvas(maskImageDataToCanvas(maskImageData, width, height), config.miganMaskExpand);
    var holeData = get2dContext(holeCanvas).getImageData(0, 0, width, height).data;

    var feeds = {};
    feeds[session.inputNames[0]] = buildImageTensor(ort, imageData, width, height);
    feeds[session.inputNames[1]] = buildMaskTensor(ort, holeData, width, height);
    return runSession(session, feeds).then(function (resultTensor) {
      var dims = resultTensor.dims || [1, 3, height, width];
      var outW = dims[3] || width;
      var outH = dims[2] || height;
      if (outW !== width || outH !== height) {
        compositeResultBack(imageCanvas, imageData, holeData, resizeChwToFull(resultTensor.data, outW, outH, width, height), width, height, config);
      } else {
        compositeResultBack(imageCanvas, imageData, holeData, resultTensor.data, width, height, config);
      }
    });
  }

  // image -> uint8 CHW [1,3,H,W]
  function buildImageTensor(ort, imageData, width, height) {
    var area = width * height;
    var out = new Uint8Array(3 * area);
    for (var i = 0; i < area; i += 1) {
      out[i] = imageData[i * 4];
      out[area + i] = imageData[i * 4 + 1];
      out[area * 2 + i] = imageData[i * 4 + 2];
    }
    return new ort.Tensor('uint8', out, [1, 3, height, width]);
  }

  // mask -> uint8 [1,1,H,W]; 0 = дырка (где мазок), 255 = оставить
  function buildMaskTensor(ort, holeData, width, height) {
    var area = width * height;
    var out = new Uint8Array(area);
    for (var i = 0; i < area; i += 1) {
      out[i] = holeData[i * 4 + 3] > HOLE_ALPHA_THRESHOLD ? 0 : 255;
    }
    return new ort.Tensor('uint8', out, [1, 1, height, width]);
  }

  function compositeResultBack(imageCanvas, imageData, holeData, resultData, width, height, config) {
    var area = width * height;
    var feather = buildFeatheredHole(holeData, width, height, config.miganFeatherRadius);
    var ctx = get2dContext(imageCanvas);
    var out = ctx.createImageData(width, height);
    for (var i = 0; i < area; i += 1) {
      var a = feather[i];
      var o = i * 4;
      if (a <= 0) {
        out.data[o] = imageData[o];
        out.data[o + 1] = imageData[o + 1];
        out.data[o + 2] = imageData[o + 2];
      } else {
        out.data[o] = Math.round(resultData[i] * a + imageData[o] * (1 - a));
        out.data[o + 1] = Math.round(resultData[area + i] * a + imageData[o + 1] * (1 - a));
        out.data[o + 2] = Math.round(resultData[area * 2 + i] * a + imageData[o + 2] * (1 - a));
      }
      out.data[o + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  // бинарная дырка -> размытие на featherRadius -> per-pixel alpha 0..1
  function buildFeatheredHole(holeData, width, height, featherRadius) {
    var canvas = createCanvas(width, height);
    var ctx = get2dContext(canvas);
    var img = ctx.createImageData(width, height);
    var area = width * height;
    for (var i = 0; i < area; i += 1) {
      var hole = holeData[i * 4 + 3] > HOLE_ALPHA_THRESHOLD ? 255 : 0;
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 255;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = hole;
    }
    ctx.putImageData(img, 0, 0);
    var radius = Math.max(0, Math.round(Number(featherRadius) || 0));
    if (radius > 0) {
      var blurred = createCanvas(width, height);
      var bctx = get2dContext(blurred);
      bctx.filter = 'blur(' + radius + 'px)';
      bctx.drawImage(canvas, 0, 0);
      bctx.filter = 'none';
      canvas = blurred;
    }
    var fa = get2dContext(canvas).getImageData(0, 0, width, height).data;
    var out = new Float32Array(area);
    for (var j = 0; j < area; j += 1) out[j] = fa[j * 4 + 3] / 255;
    return out;
  }

  // запасной ресайз result CHW->full (модель почти всегда возвращает тот же размер)
  function resizeChwToFull(data, srcW, srcH, dstW, dstH) {
    var srcArea = srcW * srcH;
    var dstArea = dstW * dstH;
    var out = new Uint8Array(3 * dstArea);
    for (var y = 0; y < dstH; y += 1) {
      var sy = Math.min(srcH - 1, Math.floor(y * srcH / dstH));
      for (var x = 0; x < dstW; x += 1) {
        var sx = Math.min(srcW - 1, Math.floor(x * srcW / dstW));
        var s = sy * srcW + sx;
        var d = y * dstW + x;
        out[d] = data[s];
        out[dstArea + d] = data[srcArea + s];
        out[dstArea * 2 + d] = data[srcArea * 2 + s];
      }
    }
    return out;
  }

  function maskImageDataToCanvas(maskImageData, width, height) {
    var canvas = createCanvas(width, height);
    var ctx = get2dContext(canvas);
    if (maskImageData.width === width && maskImageData.height === height) {
      ctx.putImageData(maskImageData, 0, 0);
      return canvas;
    }
    var tmp = createCanvas(maskImageData.width, maskImageData.height);
    get2dContext(tmp).putImageData(maskImageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, width, height);
    return canvas;
  }

  function runSession(session, feeds) {
    if (app.runSession) return app.runSession(session, feeds);
    return session.run(feeds).then(function (outputs) {
      var keys = Object.keys(outputs || {});
      if (!keys.length || !outputs[keys[0]]) throw new Error('manual_cleanup_model_empty_output');
      return outputs[keys[0]];
    });
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

  // === ORT runtime / session loading (WebGPU -> WASM fallback) ===
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

  app.miganInpaint = inpaint;
  app.buildImageTensor = buildImageTensor;
  app.buildMaskTensor = buildMaskTensor;
  app.compositeResultBack = compositeResultBack;
  app.expandMaskCanvas = expandMaskCanvas;
  app.loadMiganSession = loadMiganSession;
  app.runMiganInpaint = runMiganInpaint;
  root.BananaManualCleanup = app;
  return app;
});
