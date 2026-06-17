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
      miganModelUrl: '/models/migan/migan.onnx',
      miganModelVersion: '2026-06-16',
      miganMaskExpand: 8,
      miganFeatherRadius: 4,
      miganMaxOutputLongSide: 1024,
      ortBaseUrl: '/manual-cleanup/ort/',
      sampleEndpoint: '/api/manual-cleanup-sample',
      analyticsEndpoint: '/collect'
    };
  }

  app.createManualCleanupConfig = createManualCleanupConfig;
  root.BananaManualCleanup = app;
  return app;
});
