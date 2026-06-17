'use strict';

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};

  function canvasToPng(canvas) {
    return canvas.toDataURL('image/png');
  }

  function createDataCollector(config) {
    function parseResponse(response) {
      if (response.status === 204) return Promise.resolve({ ok: true });
      if (typeof response.json !== 'function') {
        if (!response.ok) throw new Error('sample_upload_failed');
        return Promise.resolve({ ok: true });
      }
      return response.json().then(function (data) {
        if (!response.ok) {
          var serverError = new Error(data.error || 'sample_upload_failed');
          serverError.sampleUploadError = true;
          throw serverError;
        }
        return data || { ok: true };
      }).catch(function (error) {
        if (error && error.sampleUploadError) throw error;
        throw new Error('sample_upload_failed');
      });
    }

    return {
      collect: function (state) {
        if (!state || state.userConsented !== true) {
          return Promise.resolve({ skipped: true, reason: 'no_consent' });
        }
        if (state.explicitUploadRequested !== true) {
          return Promise.resolve({ skipped: true, reason: 'no_explicit_upload' });
        }

        var payload = {
          userConsented: true,
          source: state.source || 'manual_cleanup_page',
          locale: config.locale,
          imageDataUrl: canvasToPng(state.imageCanvas),
          maskDataUrl: canvasToPng(state.maskCanvas),
          meta: state.meta || {}
        };

        return root.fetch(config.sampleEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(parseResponse);
      }
    };
  }

  app.createDataCollector = createDataCollector;
  root.BananaManualCleanup = app;
  return app;
});
