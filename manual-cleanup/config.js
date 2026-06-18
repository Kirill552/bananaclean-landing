'use strict';

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};

  function getLocale() {
    var body = root.document && root.document.body;
    var marker = body && body.dataset && body.dataset.locale;
    return marker || 'en';
  }

  function createManualCleanupConfig() {
    return {
      locale: getLocale(),
      engine: 'migan',
      maxFileBytes: 20 * 1024 * 1024,
      acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      // pipeline_v2 экспорт: 2 входа uint8 (image+mask), динамическое разрешение.
      // Старый migan.onnx был fixed-512 → форс-ужатие в 512 → мыло на текстуре.
      miganModelUrl: '/models/migan/migan-pipeline-v2.onnx',
      miganModelVersion: '2026-06-18-pipeline-v2',
      miganMaskExpand: 8,
      miganFeatherRadius: 4,
      // 0 = выгружать в исходном разрешении без ужатия. >0 — необязательный максимум
      // длинной стороны. Даунскейл до 1024 (как у конкурента) убран: терял качество.
      miganMaxOutputLongSide: 0,
      ortBaseUrl: '/manual-cleanup/ort/',
      sampleEndpoint: '/api/manual-cleanup-sample',
      analyticsEndpoint: '/collect'
    };
  }

  app.createManualCleanupConfig = createManualCleanupConfig;
  root.BananaManualCleanup = app;
  return app;
});
