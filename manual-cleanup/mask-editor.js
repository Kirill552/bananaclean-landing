'use strict';

(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var app = root.BananaManualCleanup || {};

  function createMaskEditor(maskCanvas, options) {
    var ctx = maskCanvas.getContext('2d');
    var brushSize = options.brushSize || 44;
    var drawing = false;
    var maskPainted = false;
    var lastPoint = null;
    var undoStack = [];
    var redoStack = [];
    var onChange = options.onChange || function () {};
    var brushCursor = options.brushCursor || null;

    function hideBrushCursor() {
      if (brushCursor) brushCursor.hidden = true;
    }

    function updateBrushCursorSize() {
      if (!brushCursor) return;
      var diameter = Math.max(5, brushSize);
      brushCursor.style.width = diameter + 'px';
      brushCursor.style.height = diameter + 'px';
    }

    function getCanvasBrushSize() {
      var rect = maskCanvas.getBoundingClientRect();
      if (!rect.width || !maskCanvas.width) return brushSize;
      return brushSize * (maskCanvas.width / rect.width);
    }

    function moveBrushCursor(event) {
      if (!brushCursor || !brushCursor.parentElement) return;
      var wrapRect = brushCursor.parentElement.getBoundingClientRect();
      brushCursor.style.left = (event.clientX - wrapRect.left) + 'px';
      brushCursor.style.top = (event.clientY - wrapRect.top) + 'px';
      updateBrushCursorSize();
      brushCursor.hidden = false;
    }

    function notify() {
      onChange({
        hasMask: maskPainted,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0
      });
    }

    function snapshot() {
      undoStack.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
      if (undoStack.length > 20) undoStack.shift();
      redoStack = [];
    }

    function updateMaskState() {
      var pixels = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
      maskPainted = false;
      for (var i = 3; i < pixels.length; i += 4) {
        if (pixels[i] > 0) {
          maskPainted = true;
          break;
        }
      }
      notify();
    }

    function getPoint(event) {
      var rect = maskCanvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (maskCanvas.width / rect.width),
        y: (event.clientY - rect.top) * (maskCanvas.height / rect.height)
      };
    }

    function paintTo(point) {
      var canvasBrushSize = getCanvasBrushSize();
      ctx.strokeStyle = 'rgba(255, 64, 128, 0.62)';
      ctx.fillStyle = 'rgba(255, 64, 128, 0.62)';
      ctx.lineWidth = canvasBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (lastPoint) {
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else {
        ctx.arc(point.x, point.y, canvasBrushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      lastPoint = point;
      maskPainted = true;
      notify();
    }

    function finishDrawing() {
      if (!drawing) return;
      drawing = false;
      lastPoint = null;
      updateMaskState();
    }

    maskCanvas.addEventListener('pointerdown', function (event) {
      drawing = true;
      if (maskCanvas.setPointerCapture) maskCanvas.setPointerCapture(event.pointerId);
      moveBrushCursor(event);
      snapshot();
      paintTo(getPoint(event));
      event.preventDefault();
    });

    maskCanvas.addEventListener('pointerenter', function (event) {
      moveBrushCursor(event);
    });

    maskCanvas.addEventListener('pointermove', function (event) {
      moveBrushCursor(event);
      if (!drawing) return;
      paintTo(getPoint(event));
      event.preventDefault();
    });

    maskCanvas.addEventListener('pointerup', finishDrawing);
    maskCanvas.addEventListener('pointercancel', finishDrawing);
    maskCanvas.addEventListener('pointerleave', function () {
      finishDrawing();
      hideBrushCursor();
    });
    root.addEventListener('resize', updateBrushCursorSize);

    return {
      resize: function (width, height) {
        maskCanvas.width = width;
        maskCanvas.height = height;
        ctx.clearRect(0, 0, width, height);
        undoStack = [];
        redoStack = [];
        maskPainted = false;
        hideBrushCursor();
        notify();
      },
      setBrushSize: function (value) {
        brushSize = Math.max(5, Math.min(150, Number(value) || 44));
        updateBrushCursorSize();
      },
      clear: function () {
        if (!maskPainted) return;
        snapshot();
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        updateMaskState();
      },
      undo: function () {
        if (!undoStack.length) return;
        redoStack.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
        ctx.putImageData(undoStack.pop(), 0, 0);
        updateMaskState();
      },
      redo: function () {
        if (!redoStack.length) return;
        undoStack.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
        ctx.putImageData(redoStack.pop(), 0, 0);
        updateMaskState();
      },
      getMaskImageData: function () {
        return ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      },
      hasMask: function () {
        return maskPainted;
      }
    };
  }

  app.createMaskEditor = createMaskEditor;
  root.BananaManualCleanup = app;
  return app;
});
