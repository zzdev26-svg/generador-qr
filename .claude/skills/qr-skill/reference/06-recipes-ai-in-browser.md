# Recipes — Pattern G: AI in the browser

Verified July 2026. On-device models, no API keys, no per-use cost. These are
the heaviest archetypes in the catalog: follow the lazy-load + progress rules
religiously (`SKILL.md` invariant 5, UI states in `03`).

**Licensing is a hard gate here.** Two popular options are BANNED:

- `@imgly/background-removal` — **AGPL-3.0** (would force the owner's site
  code under AGPL; commercial license costs money) AND its fast path wants
  COOP/COEP headers, which **break AdSense iframes**. Never use it.
- BriaAI `RMBG-1.4` / `RMBG-2.0` — **non-commercial license**. A web with ads
  IS commercial use. Never use it, even though transformers.js supports it.

Everything pinned below is Apache-2.0 / MIT / BSD and ad-safe (no COOP/COEP).

---

## G.1 · `quitar-fondo` — background removal

**Stack:** `@huggingface/transformers` v4.2.0 (Apache-2.0, ESM — loaded via
the **ESM bridge**) + model **Xenova/modnet** (Apache-2.0, ONNX).

**The one allowed CDN exception:** transformers.js is a chunked ESM package —
self-hosting it is brittle, so it loads from jsdelivr by pinned URL (see
`14`). The **model** is self-hosted in the project (small: fp16 ≈ 13 MB,
quantized ≈ 6.6 MB) so the tool never depends on huggingface.co being up:

```
assets/models/Xenova/modnet/
├── config.json
├── preprocessor_config.json
└── onnx/model_fp16.onnx        (descargar-librerias.py quitar-fondo)
```

**Core (inside a classic script, lazy on first action):**

```js
let _segmenter = null;
async function getSegmenter(onStatus) {
  if (_segmenter) return _segmenter;
  onStatus("Descargando el modelo (~13 MB)… solo la primera vez");
  const t = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0");
  t.env.allowRemoteModels = false;                  // self-hosted model only
  t.env.localModelPath = "assets/models/";
  _segmenter = await t.pipeline("background-removal", "Xenova/modnet", {
    device: ("gpu" in navigator) ? "webgpu" : "wasm",   // WebGPU when present
    dtype: "fp16",
  });
  return _segmenter;
}
async function removeBg(file) {
  const seg = await getSegmenter(setStatus);
  const out = await seg(URL.createObjectURL(file));  // RawImage with alpha
  const canvas = out[0].toCanvas();
  return new Promise(ok => canvas.toBlob(ok, "image/png")); // keep alpha
}
```

**Gotchas & honesty:**
- ONNX runtime wasm (~30 MB) downloads on first run and caches — progress UI
  is mandatory, plus «se descarga una vez» copy.
- WebGPU (Chrome/Edge) is much faster; wasm works everywhere else. Feature-
  detect, never require.
- **MODNet is portrait matting**: excellent on people, mediocre on objects.
  Frame the page as «quitar fondo de fotos y retratos» and say in the FAQ
  that product-object cutouts may need touch-ups. Do NOT swap in RMBG to fix
  this — license (see gate above).
- Extras that convert: background color/gradient picker (draw fill + result
  on a canvas), before/after slider.

## G.2 · `ocr-imagenes` — extract text from images

**Stack:** `tesseract.js` **v7.0.0** (Apache-2.0). v6+ changed the API — old
`worker.loadLanguage/initialize` snippets found online are DEAD; languages go
in `createWorker`. v7 is ~15-35 % faster.

```js
await loadScript("lib/vendor/tesseract/tesseract.min.js");  // ~70 KB, vendored
async function ocr(fileOrCanvas, onStatus) {
  onStatus("Preparando el motor de lectura…");
  const worker = await Tesseract.createWorker("spa+eng", 1, {
    workerPath: "lib/vendor/tesseract/worker.min.js",   // vendored, same-origin
    // corePath/langPath: leave the library DEFAULTS (pinned-version jsdelivr).
    // This is a documented exception in 14 §1 — the lib resolves its own
    // matching core + languages; overriding them wrong is the #1 OCR breaker.
    logger: m => m.progress && onStatus("Leyendo… " + Math.round(m.progress * 100) + " %"),
  });
  const { data: { text } } = await worker.recognize(fileOrCanvas);
  await worker.terminate();
  return text;
}
```

**Gotchas (the #1 OCR deploy-breaker is paths):**
- Main JS + worker are vendored (`descargar-librerias.py ocr-imagenes`);
  core wasm + `.traineddata.gz` languages load via the library defaults —
  do NOT half-override `corePath`/`langPath` with guessed folders. Total
  first-use download ≈ 5–8 MB, cached after.
- v6 changed the API: languages go in `createWorker("spa+eng")`; any snippet
  using `worker.loadLanguage()`/`initialize()` found online is dead code.
- UX: copy button + .txt download; a «mantener saltos de línea» toggle
  (Tesseract returns `\n` per line — collapse or keep).

## G.3 · `escaner-documentos` — photo → straightened B/W PDF

**Stack:** OpenCV.js **4.7.0** (Apache-2.0, ONE file ~11 MB — self-hosted;
docs.opencv.org is not a production CDN) + `jscanify` v1.4.3 (MIT, ~10 KB) +
jsPDF (already pinned) for the multi-page PDF.

```js
async function getScanner(onStatus) {
  onStatus("Cargando el motor de escaneo (~11 MB)… solo la primera vez");
  await loadScript("lib/vendor/opencv/opencv.js");        // global cv (async init!)
  await new Promise(ok => (cv.onRuntimeInitialized ? cv.onRuntimeInitialized = ok : ok()));
  await loadScript("lib/vendor/jscanify.min.js");
  return new jscanify();
}
// per photo:
const scanner = await getScanner(setStatus);
const paper = scanner.extractPaper(imgEl, 1240, 1754);    // A4 @150dpi canvas
// B/W: cv.adaptiveThreshold on the canvas (gray → ADAPTIVE_THRESH_GAUSSIAN_C)
// (jscanify already required OpenCV, so the threshold is free)
```

**Gotchas:**
- `cv` initializes asynchronously — ALWAYS await `onRuntimeInitialized`
  before constructing jscanify, or everything is undefined.
- Mobile-first: `<input type="file" accept="image/*" capture="environment">`
  — most scanner users arrive on phones. Downscale huge camera photos
  (max ~2500 px) BEFORE OpenCV to keep memory sane on iOS.
- Detection fails on low-contrast backgrounds: show the detected outline
  (`highlightPaper`) and offer «usar la foto tal cual» as escape hatch —
  never trap the user.
- Multi-page: each scan appends a page (jsPDF `addImage` JPEG q0.8,
  A4-fitted); list of thumbnails with delete/reorder before «Descargar PDF».
- Free B/W filter: `cv.adaptiveThreshold` (blockSize 15–25, C 10) reads far
  better than a naive global threshold.

---

## Bonus pattern (not in the catalog, if a user asks)

- **Voz → texto:** Web Speech API (`window.SpeechRecognition ||
  webkitSpeechRecognition`). Chrome/Edge/Safari only (audio goes through the
  vendor's servers — say so honestly); **Firefox has NO support (2026)** —
  feature-detect and show a friendly unsupported card. Chrome 142+ can do
  on-device via `processLocally: true` — treat as progressive enhancement.
- **Texto → voz con descarga:** `speechSynthesis` CANNOT export audio. The
  only serious client-side path is `kokoro-js` (Apache-2.0, ~45–90 MB model
  download, Spanish voices exist but are weaker than English). Only offer if
  the user accepts the weight — otherwise build play-only TTS with
  `speechSynthesis` and no download button.

---

## Definition of done (pattern G)

Happy path with a REAL photo (not a synthetic image) in the http preview;
second run must hit cache (no re-download); throttle CPU 4× in DevTools once
to confirm the progress UI actually shows; console clean; then the `03`
checklist. In the FAQ, state model limits honestly (portraits vs objects,
OCR quality on handwriting = poor, scanner needs contrast).
