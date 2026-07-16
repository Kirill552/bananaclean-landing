'use strict';

const assert = require('node:assert');
const { bindDropZone } = require('./manual-cleanup/uploader.js');

function createDropZone() {
  const listeners = {};
  return {
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type, event) {
      listeners[type](event);
    }
  };
}

function createEvent(dataTransfer) {
  return {
    dataTransfer,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    }
  };
}

function testBindDropZone() {
  const dropZone = createDropZone();
  const file = { name: 'sample.png' };
  const received = [];

  bindDropZone(dropZone, (selectedFile) => received.push(selectedFile));

  const dragover = createEvent();
  dropZone.dispatch('dragover', dragover);
  assert.strictEqual(dragover.prevented, true);

  const drop = createEvent({ files: [file, { name: 'second.png' }] });
  dropZone.dispatch('drop', drop);
  assert.strictEqual(drop.prevented, true);
  assert.deepStrictEqual(received, [file]);
}

function testEmptyDropIsIgnored() {
  const dropZone = createDropZone();
  let callbackCount = 0;

  bindDropZone(dropZone, () => {
    callbackCount += 1;
  });

  const drop = createEvent({ files: [] });
  dropZone.dispatch('drop', drop);
  assert.strictEqual(drop.prevented, true);
  assert.strictEqual(callbackCount, 0);
}

testBindDropZone();
testEmptyDropIsIgnored();
console.log('manual cleanup EN uploader contract passed');
