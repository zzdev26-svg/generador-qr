# Recipes — Patterns E & F: file processing (light and heavy)

Verified July 2026. Exact versions/URLs live in `14-library-pinning.md`; run
`scripts/descargar-librerias.py <archetype>` to vendor them into `lib/vendor/`.
Everything here is same-origin at runtime (no CDN hot-links) unless a recipe
explicitly says otherwise.

**Shared machinery used by every recipe in this file:**

- The dropzone + `data-state` card from `03-tool-page-design.md`.
- Lazy loading: heavy engines are injected on FIRST user action, never at page
  load. Helper (put in `main.js`):

```js
function loadScript(src) {           // classic scripts (UMD/IIFE)
  return new Promise((ok, err) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => err(new Error(src));
    document.body.appendChild(s);
  });
}
// ESM-only engines: dynamic import from a CLASSIC script (the "ESM bridge")
// const mod = await import("./lib/vendor/pdfjs/pdf.min.mjs");
```

- Download helper: `function saveBlob(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }`

---

## E.1 · `conversor-imagenes` — PNG ⇄ JPG ⇄ WebP (+ HEIC)

**Libs:** none for PNG/JPG/WebP (native canvas). `heic-to` (IIFE, ~3 MB,
LGPL-3.0) vendored, lazy-injected ONLY when a `.heic/.heif` file arrives.

**Core:**

```js
async function convertImage(file, targetType, quality) {   // "image/jpeg" etc.
  let src = file;
  if (/\.heic$|\.heif$/i.test(file.name) || file.type.includes("heic")) {
    await loadScript("lib/vendor/heic-to.js");             // global HeicTo
    if (await HeicTo.isHeic(file))
      src = await HeicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  }
  const bmp = await createImageBitmap(src);
  const canvas = Object.assign(document.createElement("canvas"),
    { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext("2d");
  if (targetType === "image/jpeg") {                       // JPG has no alpha
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bmp, 0, 0);
  return new Promise(ok => canvas.toBlob(ok, targetType, quality || 0.85));
}
```

**Gotchas (all verified):**
- **Safari cannot EXPORT WebP** — `toBlob(…,"image/webp")` silently returns
  PNG. Detect: `document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp")`.
  If unsupported: hide/disable the WebP output option with a small note
  («WebP no disponible en Safari»). Never ship a button that lies.
- Check the resulting `blob.type` before naming the download file.
- Only ever draw local `File`/`Blob` objects — never remote URLs (canvas taint).
- HEIC decode is memory-hungry; state a ~50 MB limit for HEIC in the UI.

## E.2 · `compresor-imagenes`

**Lib:** `browser-image-compression` v2.0.2 UMD (57 KB, MIT), vendored.
Global `imageCompression`.

```js
await loadScript("lib/vendor/browser-image-compression.js");
const out = await imageCompression(file, {
  maxSizeMB: targetMB, maxWidthOrHeight: 3840,
  useWebWorker: true, libURL: location.origin + basePath + "lib/vendor/browser-image-compression.js",
  onProgress: p => setProgress(p)
});
```

**Gotchas:** pass `libURL` pointing at YOUR vendored copy (the worker imports
the lib by URL; without it, it tries the CDN). Safari without OffscreenCanvas
silently falls back to main thread — fine. Show before/after sizes and the
saved %. Target-size mode is just `maxSizeMB`. Batch → JSZip (pinned) for
«descargar todo».

## E.3 · `redimensionador-rrss`

**Libs:** none. Canvas crop/resize + a format table in `lib/manifest.js`
(`{ network, label, w, h }` per format — data, not code). Crop UI: a
draggable/zoomable image inside a fixed-ratio frame (pointer events +
transform), then draw the visible region to an offscreen canvas at exact
target size and export JPG (white-fill) or PNG. Reuse the Safari-WebP rule
from E.1 if offering WebP.

## E.4 · `limpiador-metadatos`

**Lib:** `exifr` v7.1.3 (lite UMD, ~46 KB, MIT), vendored — for READING only.

```js
await loadScript("lib/vendor/exifr-lite.umd.js");
const data = await exifr.parse(file).catch(() => null);   // camera, date…
const gps  = await exifr.gps(file).catch(() => null);     // {latitude, longitude}
```

Show the «what your photo reveals» panel (camera, date, GPS on a static map
LINK — plain `<a>` to openstreetmap.org with lat/lon, no embedded tiles).
**Stripping = canvas re-encode** (E.1 machinery): the browser encoder writes
zero EXIF/GPS/IPTC/XMP — this is the standard method. Honest notes for the
UI: re-encoding recompresses (use quality 0.92+ or PNG for lossless) and the
ICC profile is dropped; orientation is already applied by the decoder, so the
clean image comes out correctly rotated.

## E.5 · `generador-cv` and E.6 · `generador-facturas`

**Lib:** `jsPDF` v4.2.1 UMD (~420 KB, MIT), vendored. Global `window.jspdf`.
Tables (invoices): `jspdf-autotable` v5 plugin, vendored, loaded AFTER jsPDF.

```js
await loadScript("lib/vendor/jspdf.umd.min.js");
await loadScript("lib/vendor/jspdf.plugin.autotable.min.js"); // invoices only
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ unit: "mm", format: "a4" });
doc.setFont("helvetica", "bold"); doc.setFontSize(18);
doc.text(nombre, 20, 24);
doc.autoTable({ startY: 60, head: [["Concepto","Cant.","Precio","Total"]], body: filas });
doc.save("factura-" + numero + ".pdf");
```

**Rules:** build the PDF with **text calls, never html2canvas screenshots**
(selectable, ATS-readable, tiny files). Accents work with the built-in
helvetica for Spanish; if a template needs a custom font, embed a TTF via
`doc.addFileToVFS` + `addFont` (vendored .ttf). Persist form data in
`localStorage` (`try/catch` around it). Invoice numbering is local to the
browser — say so in the UI. VAT math in one pure function with tests in
comments. Logo upload → `doc.addImage(dataURL, "PNG", …)`.

## E.7 · `firmar-pdf`

**Libs:** `pdf-lib` v1.17.1 UMD (~525 KB, MIT) to EDIT + `pdf.js` v6.1.200
(ESM, Apache-2.0) to RENDER pages for the placement UI. Both vendored.
pdf.js goes through the **ESM bridge**:

```js
const pdfjsLib = await import("./lib/vendor/pdfjs/pdf.min.mjs");
pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/vendor/pdfjs/pdf.worker.min.mjs";
const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
// render page N to canvas at devicePixelRatio scale for the placement UI
```

Signature: `<canvas>` drawing pad (pointer events, line smoothing with
quadratic curves) → `toDataURL("image/png")` (transparent). Placement: the
user drags/resizes the PNG over the rendered page; store page + rect in **page
coordinates** (divide by your render scale). Then:

```js
await loadScript("lib/vendor/pdf-lib.min.js");             // global PDFLib
const doc = await PDFLib.PDFDocument.load(bytes);
const png = await doc.embedPng(sigDataUrl);
const page = doc.getPage(pageIndex);
// pdf-lib origin is BOTTOM-left; convert from the UI's top-left coords:
page.drawImage(png, { x, y: page.getHeight() - yTop - h, width: w, height: h });
saveBlob(new Blob([await doc.save()], { type: "application/pdf" }), "firmado.pdf");
```

**Gotchas:** pdf.js API and worker must be the SAME version (vendored pair
guarantees it); `bytes.slice(0)` because pdf.js detaches the buffer (keep the
original for pdf-lib); the Y-flip above is the #1 bug source; encrypted PDFs →
catch and show a human message. Privacy pitch is maximal here — say it.

## E.8 · `herramientas-pdf` — unir · dividir · comprimir

**Libs:** same pair as E.7 (`pdf-lib` for surgery, `pdf.js` for thumbnails).

- **Unir:** `PDFDocument.create()` → for each input `copyPages(src, src.getPageIndices())` → `addPage` each. Render small thumbnails (pdf.js,
  ~120 px) so the user can drag to reorder files/pages before merging.
- **Dividir:** page-range inputs («1-3, 7, 9-») → new doc per range with
  `copyPages`. Also «cada página un PDF» → zip with JSZip.
- **Comprimir (honest version):** pdf-lib does not recompress streams. The
  win that works: render each page with pdf.js to canvas at chosen DPI →
  re-encode JPEG quality ~0.75 → build a NEW pdf with jsPDF/pdf-lib embedding
  those images. Big wins on scanned/photo PDFs; text PDFs get bigger and lose
  selectable text — **detect and warn**: if the source is text-heavy (check
  `page.getTextContent()` length), tell the user compression suits scanned
  docs and let them cancel. Never silently rasterize a text PDF.

Limits for the UI: ~100 MB / ~500 pages (browser memory).

---

## F · The shared ffmpeg engine (`conversor-audio`, `video-a-gif`, `recortador-mp3`)

**Libs (vendored, exact files matter):**
`lib/vendor/ffmpeg/ffmpeg.js` **and** `lib/vendor/ffmpeg/814.ffmpeg.js`
(@ffmpeg/ffmpeg 0.12.15 UMD — the worker chunk MUST sit next to ffmpeg.js,
same origin, or you get a SecurityError), `lib/vendor/ffmpeg/util.js`
(@ffmpeg/util 0.12.2 UMD), and the single-thread core
`lib/vendor/ffmpeg/ffmpeg-core.js` + `ffmpeg-core.wasm` (@ffmpeg/core 0.12.10,
~32 MB, **GPL-2.0** — note the license in the page footer credits).

**Why single-thread:** it needs NO SharedArrayBuffer and therefore **no
COOP/COEP headers** — which is mandatory for us, because COOP/COEP breaks
third-party iframes (AdSense). Never use `core-mt`. Slower, but compatible.

**The loader (write once, share across the three archetypes):**

```js
let _ffmpeg = null;
async function getFFmpeg(onProgress) {
  if (_ffmpeg) return _ffmpeg;
  await loadScript("lib/vendor/ffmpeg/ffmpeg.js");   // global FFmpegWASM
  await loadScript("lib/vendor/ffmpeg/util.js");     // global FFmpegUtil
  const { FFmpeg } = FFmpegWASM;
  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => onProgress && onProgress(progress));
  await ffmpeg.load({                                 // same-origin, no CORS
    coreURL: "lib/vendor/ffmpeg/ffmpeg-core.js",
    wasmURL: "lib/vendor/ffmpeg/ffmpeg-core.wasm",
  });
  return (_ffmpeg = ffmpeg);
}
```

Show «Descargando el motor (~30 MB)… solo la primera vez» while `load()`
runs (it caches after). `.htaccess` already ships
`AddType application/wasm .wasm` (template) — keep it.

**F.1 · `conversor-audio`:**
`await ffmpeg.writeFile("in", await FFmpegUtil.fetchFile(file))` →
`await ffmpeg.exec(["-i","in","-b:a","192k","out.mp3"])` (or `.wav`, `.ogg`,
`out.m4a` with `["-c:a","aac","-b:a","192k"]`) → `readFile` → Blob with the
right MIME. Bitrate select: 128/192/320k. Limit note: ~200 MB.

**F.2 · `video-a-gif`:**
`["-ss", start, "-to", end, "-i", "in", "-vf", "fps=" + fps + ",scale=" + width + ":-1:flags=lanczos", "out.gif"]`.
Defaults fps 10–12, width 480. `<video>` preview with range sliders for
start/end. Warn ≥ 30 s clips (GIF size explodes); suggest short clips in UI.

**F.3 · `recortador-mp3`:**
UI: `wavesurfer.js` v7.12.11 UMD + its `regions` plugin (both vendored,
BSD-3). v7 API only — don't mix v6 docs. Load audio via
`URL.createObjectURL(file)` (no CORS). Region gives `start/end` seconds.
Export path A (default): shared ffmpeg engine,
`["-ss", s, "-to", e, "-i", "in", "-c", "copy", "out.mp3"]` — instant, no
re-encode, MP3-in/MP3-out. Path B (fallback if the engine fails to load,
or for non-MP3 output): Web Audio `decodeAudioData` → slice the AudioBuffer →
encode with `@breezystack/lamejs` 1.2.7 IIFE (vendored; the ORIGINAL
`lamejs` npm package is broken — «MPEGMode is not defined» — never pin it):
Float32 → Int16 (`* 32767`), feed `Mp3Encoder` in 1152-sample blocks, flush,
Blob `audio/mpeg`. Encode clips > 2–3 min inside a Worker to avoid jank.

---

## Definition of done (per archetype)

Run the real happy path in the http preview: convert one real file of each
advertised format, watch the console, check the output opens. For ffmpeg
archetypes, ALSO reload and confirm the second run skips the big download
(cache). Then the page-level checklist in `03`.
