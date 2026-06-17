'use strict';

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};

  function validateFile(file, config) {
    if (!file) return { ok: false, error: 'missing_file' };
    if (config.acceptedTypes.indexOf(file.type) === -1) {
      return { ok: false, error: 'unsupported_file_type' };
    }
    if (file.size > config.maxFileBytes) {
      return { ok: false, error: 'file_too_large' };
    }
    return { ok: true };
  }

  function loadImageFile(file, config) {
    var validation = validateFile(file, config);
    if (!validation.ok) return Promise.reject(new Error(validation.error));
    return root.createImageBitmap(file).then(function (bitmap) {
      return {
        file: file,
        bitmap: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        mimeType: file.type,
        size: file.size,
        name: file.name || ''
      };
    });
  }

  app.validateFile = validateFile;
  app.loadImageFile = loadImageFile;
  root.BananaManualCleanup = app;
  return app;
});
