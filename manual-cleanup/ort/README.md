# ONNX Runtime Web assets

Place the `onnxruntime-web` browser runtime files used by `migan-engine.js` in this directory before deployment.

Serve these files from the same domain as the manual cleanup page.

Selected version: `onnxruntime-web@1.26.0`, confirmed from upstream `package.json` and `src/lib/ort.ts`.

Required files:

- `ort.webgpu.min.js`
- `ort-wasm-simd-threaded.jsep.mjs`
- `ort-wasm-simd-threaded.jsep.wasm`

Runtime binaries are not stored in git.
