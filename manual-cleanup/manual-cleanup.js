'use strict';

(function (root) {
  var app = root.BananaManualCleanup;
  if (!app) return;

  var config = app.createManualCleanupConfig();
  var els = {};
  var state = {
    imageCanvas: null,
    originalCanvas: null,
    maskCanvas: null,
    imageInfo: null,
    maskEditor: null,
    collector: null,
    resultReady: false,
    userConsented: false
  };
  var manualUid = null;

  function $(id) {
    return root.document.getElementById(id);
  }

  function copy() {
    return config.locale === 'ru'
      ? {
        loading: 'Загружаю изображение...',
        paint: 'Наведите круг кисти на водяной знак, выберите размер и проведите по нему.',
        cleaning: 'Очищаю закрашенную область...',
        done: 'Готово. Скачайте PNG.',
        missingEngine: 'Модуль локальной очистки ещё не подключён. Попробуйте позже.',
        sampleSent: 'Пример отправлен. Спасибо.',
        sampleSkipped: 'Поставьте галочку согласия и нажмите отправку ещё раз.'
      }
      : {
        loading: 'Loading image...',
        paint: 'Move the brush circle over the watermark, set the size, and drag over it.',
        cleaning: 'Cleaning the painted area...',
        done: 'Done. Download the PNG.',
        missingEngine: 'Local cleanup engine is not connected yet. Please try later.',
        sampleSent: 'Sample sent. Thank you.',
        sampleSkipped: 'Tick the consent checkbox and click send again.'
      };
  }

  function setStatus(text) {
    els.statusText.textContent = text;
  }

  function getManualSource() {
    var source = 'direct';
    try {
      source = new URLSearchParams(root.location.search).get('from') || 'direct';
    } catch (e) {}
    source = String(source || 'direct').trim().toLowerCase();
    return source ? source.slice(0, 64) : 'direct';
  }

  function generateManualUid() {
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return 'manual-cleanup-' + config.locale + '-' + root.crypto.randomUUID();
    }
    return 'manual-cleanup-' + config.locale + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function getManualUid() {
    if (manualUid) return manualUid;
    var storageKey = 'bananaManualCleanupUid:' + config.locale;
    try {
      var stored = root.localStorage && root.localStorage.getItem(storageKey);
      if (stored) {
        manualUid = stored;
        return manualUid;
      }
      manualUid = generateManualUid();
      if (root.localStorage) root.localStorage.setItem(storageKey, manualUid);
      return manualUid;
    } catch (e) {
      manualUid = generateManualUid();
      return manualUid;
    }
  }

  function buildManualProperties(properties) {
    var manualProperties = {};
    var input = properties || {};
    Object.keys(input).forEach(function (key) {
      manualProperties[key] = input[key];
    });
    manualProperties.from = getManualSource();
    return manualProperties;
  }

  function sendManualAnalytics(eventType, properties) {
    var payload = JSON.stringify({
      uid: getManualUid(),
      event: eventType,
      source: 'manual-cleanup',
      ts: Date.now(),
      v: 1,
      locale: config.locale,
      properties: buildManualProperties(properties)
    });
    if (root.navigator && root.navigator.sendBeacon) {
      root.navigator.sendBeacon(config.analyticsEndpoint, new Blob([payload], { type: 'application/json' }));
      return;
    }
    root.fetch(config.analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(function () {});
  }

  function updateSendSampleState() {
    if (!els.sendSample) return;
    els.sendSample.disabled = !(state.resultReady && state.userConsented);
  }

  function updateMaskControls(details) {
    els.runCleanup.disabled = !details.hasMask;
    els.clearMask.disabled = !details.hasMask;
    els.undoMask.disabled = !details.canUndo;
    els.redoMask.disabled = !details.canRedo;
  }

  function resetResult() {
    state.resultReady = false;
    els.downloadResult.disabled = true;
    if (els.resultActions) els.resultActions.hidden = true;
    if (els.resultPanel) els.resultPanel.hidden = true;
    if (els.resultMeta) els.resultMeta.textContent = '';
    if (els.beforePreview) els.beforePreview.removeAttribute('src');
    if (els.afterPreview) els.afterPreview.removeAttribute('src');
    if (els.samplePanel) els.samplePanel.hidden = true;
    updateSendSampleState();
  }

  function showFileMeta(imageInfo) {
    if (!els.fileMeta) return;
    var sizeKb = Math.round((imageInfo.size || 0) / 1024);
    els.fileMeta.textContent = imageInfo.name + ' · ' + sizeKb + ' KB · ' + imageInfo.width + '×' + imageInfo.height;
  }

  function getDisplaySize(width, height) {
    var maxLongSide = 1024;
    var scale = Math.min(1, maxLongSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function drawImage(bitmap) {
    state.imageCanvas.width = bitmap.width;
    state.imageCanvas.height = bitmap.height;
    state.originalCanvas = root.document.createElement('canvas');
    state.originalCanvas.width = bitmap.width;
    state.originalCanvas.height = bitmap.height;
    state.maskCanvas.width = bitmap.width;
    state.maskCanvas.height = bitmap.height;
    var displaySize = getDisplaySize(bitmap.width, bitmap.height);
    els.canvasWrap.style.setProperty('--canvas-width', displaySize.width + 'px');
    els.canvasWrap.style.setProperty('--canvas-height', displaySize.height + 'px');
    var ctx = state.imageCanvas.getContext('2d');
    var originalCtx = state.originalCanvas.getContext('2d');
    ctx.clearRect(0, 0, bitmap.width, bitmap.height);
    originalCtx.clearRect(0, 0, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    originalCtx.drawImage(bitmap, 0, 0);
    state.maskEditor.resize(bitmap.width, bitmap.height);
    if (els.uploadPanel) els.uploadPanel.hidden = true;
    if (els.editorPanel) els.editorPanel.hidden = false;
  }

  function loadSelectedFile(file) {
    setStatus(copy().loading);
    return app.loadImageFile(file, config).then(function (imageInfo) {
      state.imageInfo = imageInfo;
      drawImage(imageInfo.bitmap);
      showFileMeta(imageInfo);
      resetResult();
      setStatus(copy().paint);
      sendManualAnalytics('manual_cleanup_image_loaded', { mimeType: imageInfo.mimeType });
    }).catch(function (error) {
      setStatus(error.message);
      sendManualAnalytics('manual_cleanup_load_failed', { reason: error.message });
    });
  }

  function runCleanup() {
    if (!state.maskEditor.hasMask()) return;
    var inpaintEngine = getInpaintEngine();
    if (typeof inpaintEngine !== 'function') {
      setStatus(copy().missingEngine);
      sendManualAnalytics('manual_cleanup_failed', { engine: config.engine, reason: 'missing_inpaint_engine' });
      return;
    }

    els.runCleanup.disabled = true;
    setStatus(copy().cleaning);
    sendManualAnalytics('manual_cleanup_run_started', { engine: config.engine });
    inpaintEngine(state.imageCanvas, state.maskEditor.getMaskImageData(), config).then(function () {
      state.resultReady = true;
      els.downloadResult.disabled = false;
      if (els.resultActions) els.resultActions.hidden = false;
      if (els.samplePanel) els.samplePanel.hidden = false;
      if (els.editorPanel) els.editorPanel.hidden = true;
      showResultPanel();
      updateSendSampleState();
      setStatus(copy().done);
      sendManualAnalytics('manual_cleanup_run_completed', { engine: config.engine });
    }).catch(function (error) {
      setStatus(error.message);
      sendManualAnalytics('manual_cleanup_failed', { engine: config.engine, reason: error.message });
    }).finally(function () {
      els.runCleanup.disabled = !state.maskEditor.hasMask();
    });
  }

  function getInpaintEngine() {
    return app.miganInpaint;
  }

  function downloadResult() {
    if (!state.resultReady) return;
    var link = root.document.createElement('a');
    link.href = createDownloadCanvas().toDataURL('image/png');
    link.download = 'banana-clean-manual-cleanup.png';
    link.click();
    sendManualAnalytics('manual_cleanup_download_clicked', {});
  }

  function createDownloadCanvas() {
    var source = state.imageCanvas;
    var maxLongSide = Number(config.miganMaxOutputLongSide) || 0;
    var currentLongSide = Math.max(source.width, source.height);
    if (!maxLongSide || currentLongSide <= maxLongSide) return source;
    var scale = maxLongSide / currentLongSide;
    var canvas = root.document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function showResultPanel() {
    if (!els.resultPanel || !state.originalCanvas || !state.imageCanvas) return;
    if (els.resultMeta && state.imageInfo) showResultMeta(state.imageInfo);
    els.beforePreview.src = state.originalCanvas.toDataURL('image/png');
    els.afterPreview.src = state.imageCanvas.toDataURL('image/png');
    els.resultPanel.hidden = false;
  }

  function showResultMeta(imageInfo) {
    var sizeKb = Math.round((imageInfo.size || 0) / 1024);
    els.resultMeta.textContent = imageInfo.name + ' · ' + sizeKb + ' KB · ' + imageInfo.width + '×' + imageInfo.height;
  }

  function buildSampleMeta() {
    return {
      width: state.imageCanvas.width,
      height: state.imageCanvas.height,
      mimeType: state.imageInfo && state.imageInfo.mimeType,
      fileSize: state.imageInfo && state.imageInfo.size,
      brushVersion: 'manual-cleanup-v1',
      from: getManualSource()
    };
  }

  function sendSample() {
    if (!state.resultReady) return;
    els.sendSample.disabled = true;
    state.collector.collect({
      userConsented: state.userConsented,
      explicitUploadRequested: true,
      imageCanvas: state.originalCanvas,
      maskCanvas: state.maskCanvas,
      meta: buildSampleMeta(),
      source: 'manual_cleanup_page'
    }).then(function (result) {
      if (result && result.skipped) {
        setStatus(copy().sampleSkipped);
        return;
      }
      setStatus(copy().sampleSent);
      sendManualAnalytics('manual_cleanup_sample_uploaded', {});
    }).catch(function (error) {
      setStatus(error.message);
      sendManualAnalytics('manual_cleanup_sample_failed', { reason: error.message });
    }).finally(updateSendSampleState);
  }

  function bind() {
    els.fileInput.addEventListener('change', function () {
      if (!els.fileInput.files || !els.fileInput.files[0]) return;
      loadSelectedFile(els.fileInput.files[0]);
    });
    els.brushSize.addEventListener('input', function () {
      state.maskEditor.setBrushSize(els.brushSize.value);
      els.brushSizeValue.textContent = els.brushSize.value + 'px';
    });
    els.undoMask.addEventListener('click', function () {
      state.maskEditor.undo();
      resetResult();
    });
    els.redoMask.addEventListener('click', function () {
      state.maskEditor.redo();
      resetResult();
    });
    els.clearMask.addEventListener('click', function () {
      state.maskEditor.clear();
      resetResult();
    });
    els.runCleanup.addEventListener('click', runCleanup);
    els.downloadResult.addEventListener('click', downloadResult);
    els.sendSample.addEventListener('click', sendSample);
    if (els.newImage) {
      els.newImage.addEventListener('click', function () {
        root.location.reload();
      });
    }
    els.sampleConsent.addEventListener('change', function () {
      state.userConsented = !!els.sampleConsent.checked;
      updateSendSampleState();
      sendManualAnalytics('manual_cleanup_sample_opt_in', { enabled: state.userConsented });
    });
  }

  function init() {
    els.fileInput = $('fileInput');
    els.uploadPanel = $('uploadPanel');
    els.editorPanel = $('editorPanel');
    els.fileMeta = $('fileMeta');
    els.canvasWrap = $('canvasWrap');
    els.imageCanvas = $('imageCanvas');
    els.maskCanvas = $('maskCanvas');
    els.brushCursor = $('brushCursor');
    els.brushSize = $('brushSize');
    els.brushSizeValue = $('brushSizeValue');
    els.undoMask = $('undoMask');
    els.redoMask = $('redoMask');
    els.clearMask = $('clearMask');
    els.runCleanup = $('runCleanup');
    els.downloadResult = $('downloadResult');
    els.resultActions = $('resultActions');
    els.resultPanel = $('resultPanel');
    els.resultMeta = $('resultMeta');
    els.beforePreview = $('beforePreview');
    els.afterPreview = $('afterPreview');
    els.newImage = $('newImage');
    els.sendSample = $('sendSample');
    els.samplePanel = $('samplePanel');
    els.sampleConsent = $('sampleConsent');
    els.statusText = $('statusText');
    state.imageCanvas = els.imageCanvas;
    state.maskCanvas = els.maskCanvas;
    state.collector = app.createDataCollector(config);
    state.maskEditor = app.createMaskEditor(els.maskCanvas, {
      brushSize: Number(els.brushSize.value),
      brushCursor: els.brushCursor,
      onChange: updateMaskControls
    });
    updateSendSampleState();
    bind();
    sendManualAnalytics('manual_cleanup_view', {});
  }

  root.addEventListener('DOMContentLoaded', init);
  app.sendManualAnalytics = sendManualAnalytics;
})(window);
