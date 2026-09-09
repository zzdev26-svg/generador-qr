# Library Pinning — the law of versions, vendoring and the ESM bridge

Every library choice in the recipes was verified in July 2026 (real HTTP
checks against jsdelivr, real CORS checks against endpoints). **Do not
improvise different libraries or newer versions mid-build** — if an upgrade is
ever needed, it happens here first, then in the recipes.

---

## 1. Vendoring policy

**Default: vendor at build time, same-origin at runtime.** Engines are
downloaded ONCE while building (by `scripts/descargar-librerias.py`) into the
project's `lib/vendor/`, and the deployed site never depends on a CDN being
up. This is invariant: workers and wasm are picky about origins, and a
CDN outage must not kill the owner's tools.

**Documented exceptions (the ONLY runtime remote calls allowed):**

| What | Why it's allowed | Pin |
|---|---|---|
| `@huggingface/transformers` ESM chunks | chunked ESM package, brittle to self-host; loaded by pinned URL | `https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0` |
| Tesseract core + language defaults | the lib resolves its own matching core/langs from jsdelivr — battle-tested; main JS + worker ARE vendored | library defaults (v7.0.0) |
| IP lookup endpoints | that's the tool | whitelist in `11` §A |
| Cloudflare speed-test endpoints | that's the tool | whitelist in `11` §B |
| Google Fonts | shared stack convention (`01`) | `<link>` with preconnect |

Nothing else. No other `<script src="https://…">` in shipped HTML.

## 2. The ESM bridge (how modern ESM-only libs fit the classic-script stack)

The page skeleton stays **classic `<script defer>` + IIFE** (`01`). Three
sanctioned ways to consume a library, in order of preference:

1. **UMD/IIFE vendored** → `loadScript("lib/vendor/…")`, lazily on first
   action. Most pins below have real UMD builds — use them.
2. **Dynamic `import()` from a classic script** → for ESM-only files vendored
   same-origin (pdf.js) or the one CDN exception (transformers.js). Works in
   every 2026 browser, keeps the skeleton classic, and is lazy by nature.
3. **An import map in `<head>` + dynamic `import()` from a classic script** →
   for the three.js feature, whose addons use **bare specifiers**
   (`import ... from "three"`, `"three/addons/…"`). An import map resolves
   those bare specifiers **for dynamic `import()` too** — you do **NOT** need a
   `<script type="module">` island (verified working jul-2026 in the QR 3D
   build). Keep the skeleton classic and lazy-load:

   ```html
   <!-- in <head>, before the classic scripts -->
   <script type="importmap">
   { "imports": {
       "three": "./lib/vendor/three/three.module.min.js",
       "three/addons/": "./lib/vendor/three/addons/"
   } }
   </script>
   ```
   ```js
   // inside a classic IIFE, called on first need (e.g. IntersectionObserver):
   const THREE = await import("three");
   const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
   const { STLExporter } = await import("three/addons/exporters/STLExporter.js");
   ```
   This is the approach the SKILL.md ESM-bridge invariant mandates. An import
   map is **not** a `<script type="module">`, so the `verify` grep for
   `type="module"` stays clean.

Consequences you must respect: dynamic import + import maps do NOT work on
`file://` → **preview via `python -m http.server`, always** (already an
invariant). The import map must be **inline in `<head>`, before** the classic
scripts that will call `import()`. And `.mjs` must be served as JS — the
shipped `.htaccess` template includes `AddType application/javascript .mjs` and
`AddType application/wasm .wasm`; keep both lines. The vendored `three`,
`pdfjs` and addon files legitimately contain `import`/`export` — that is fine
**inside `lib/vendor/`**; the "no import/export" verify grep must exclude that
folder (it targets your own `main.js`/`qr3d.js`, not vendored engines).

## 3. COOP/COEP: BANNED

Never set `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`
headers on these sites. They would enable SharedArrayBuffer (multithread
ffmpeg, faster ONNX) **but they break third-party iframes — including
AdSense**, which is the whole monetization model. Single-thread engines only.
This is why the pins below say `@ffmpeg/core` (st) and wasm/WebGPU ONNX.

## 4. The pin table

All jsdelivr URLs verified live (HTTP 200/206). `→` is the vendored path
inside the project.

### Pattern C/E — small engines (UMD/IIFE, load with `loadScript`)

| Library | Version | File → destination | Global | License |
|---|---|---|---|---|
| qr-code-styling | 1.9.2 | `npm/qr-code-styling@1.9.2/lib/qr-code-styling.js` → `lib/vendor/qr-code-styling.js` | `QRCodeStyling` | MIT |
| qrcode (fallback only) | 1.4.4 | `npm/qrcode@1.4.4/build/qrcode.min.js` | `QRCode` | MIT — 1.5.x has NO browser build (verified 404), never pin it |
| JSZip | 3.10.1 | `npm/jszip@3.10.1/dist/jszip.min.js` → `lib/vendor/jszip.min.js` | `JSZip` | MIT |
| heic-to | 1.5.2 | `npm/heic-to@1.5.2/dist/iife/heic-to.js` → `lib/vendor/heic-to.js` (~3 MB) | `HeicTo` | LGPL-3.0 |
| heic2any (fallback only) | 0.0.4 | `npm/heic2any@0.0.4/dist/heic2any.min.js` | `heic2any` | MIT — old libheif, fails modern iPhone HEIC; last resort |
| browser-image-compression | 2.0.2 | `npm/browser-image-compression@2.0.2/dist/browser-image-compression.js` → `lib/vendor/` | `imageCompression` | MIT |
| exifr (lite) | 7.1.3 | `npm/exifr@7.1.3/dist/lite.umd.js` → `lib/vendor/exifr-lite.umd.js` | `exifr` | MIT |
| jsPDF | 4.2.1 | `npm/jspdf@4.2.1/dist/jspdf.umd.min.js` → `lib/vendor/jspdf.umd.min.js` | `window.jspdf` | MIT |
| jspdf-autotable | 5.x | `npm/jspdf-autotable@5/dist/jspdf.plugin.autotable.min.js` → `lib/vendor/` | (plugin) | MIT |
| pdf-lib | 1.17.1 | `npm/pdf-lib@1.17.1/dist/pdf-lib.min.js` → `lib/vendor/pdf-lib.min.js` | `PDFLib` | MIT |
| wavesurfer.js | 7.12.11 | `npm/wavesurfer.js@7.12.11/dist/wavesurfer.min.js` + `dist/plugins/regions.min.js` → `lib/vendor/wavesurfer/` | `WaveSurfer` (+`.Regions`) | BSD-3 |
| @breezystack/lamejs | 1.2.7 | `npm/@breezystack/lamejs@1.2.7/dist/lamejs.iife.js` → `lib/vendor/lamejs.iife.js` | `lamejs` | LGPL-3.0 — the ORIGINAL `lamejs` npm pkg is broken («MPEGMode is not defined»), never pin it |
| jscanify | 1.4.3 | `npm/jscanify@1.4.3/src/jscanify.min.js` → `lib/vendor/jscanify.min.js` | `jscanify` | MIT |

### ESM-only (dynamic import / island)

| Library | Version | Files → destination | License |
|---|---|---|---|
| pdfjs-dist | 6.1.200 | `npm/pdfjs-dist@6.1.200/build/pdf.min.mjs` + `build/pdf.worker.min.mjs` → `lib/vendor/pdfjs/` — **API and worker must be the SAME version** | Apache-2.0 |
| three | 0.185.1 (r185) | `build/three.module.min.js` **and** `build/three.core.min.js` → `lib/vendor/three/` (see ⚠️ below); `examples/jsm/exporters/STLExporter.js` + `examples/jsm/controls/OrbitControls.js` → `lib/vendor/three/addons/{exporters,controls}/` — **no UMD since r160** (verified 404); import-map + dynamic `import()`, never `file://` | MIT |

> ⚠️ **The two-file trap that WILL bite you (verified jul-2026).** The minified
> module build is split: `three.module.min.js` starts with
> `import{...}from"./three.core.min.js"`. If you vendor only the module file
> (the obvious one), the 3D view dies at runtime with a **misleading** error
> (a bare module-resolution / "Failed to fetch dynamically imported module"
> that never names `three.core.min.js`) and you waste time looking in the wrong
> place. **Always vendor both files, side by side.** The unminified
> `build/three.module.js` is self-contained, but it is ~3× larger — prefer the
> min pair. `descargar-librerias.py` now pulls both under the `generador-qr`
> archetype; if you ever vendor three by hand, grab the core sibling too.
| @huggingface/transformers | 4.2.0 | runtime CDN exception (see §1) | Apache-2.0 |

### Heavy engines (vendored, lazy, progress UI mandatory)

| Engine | Version | Files → destination | License |
|---|---|---|---|
| @ffmpeg/ffmpeg (UMD) | 0.12.15 | `dist/umd/ffmpeg.js` **and** `dist/umd/814.ffmpeg.js` → `lib/vendor/ffmpeg/` — the worker chunk MUST sit next to ffmpeg.js, same origin, or SecurityError | MIT |
| @ffmpeg/util (UMD) | 0.12.2 | `dist/umd/index.js` → `lib/vendor/ffmpeg/util.js` | MIT |
| @ffmpeg/core (single-thread) | 0.12.10 | `dist/umd/ffmpeg-core.js` + `dist/umd/ffmpeg-core.wasm` (~32 MB) → `lib/vendor/ffmpeg/` — **never core-mt** (needs COOP/COEP → banned) | **GPL-2.0** (includes x264) — credit + license link in footer |
| tesseract.js | 7.0.0 | `dist/tesseract.min.js` + `dist/worker.min.js` → `lib/vendor/tesseract/`; core + langs via library defaults (§1 exception) | Apache-2.0 |
| OpenCV.js | 4.7.0 | `https://docs.opencv.org/4.7.0/opencv.js` → `lib/vendor/opencv/opencv.js` (~11 MB) — self-host ALWAYS, docs.opencv.org is not a production CDN | Apache-2.0 |
| Xenova/modnet (model) | main | HF `resolve/main`: `config.json`, `preprocessor_config.json`, `onnx/model_fp16.onnx` (~13 MB) → `assets/models/Xenova/modnet/` | Apache-2.0 |

### BANNED (do not use, ever)

| Library | Why |
|---|---|
| `@imgly/background-removal` | AGPL-3.0 (contaminates the owner's site) + wants COOP/COEP (kills AdSense) |
| BriaAI `RMBG-1.4` / `RMBG-2.0` | non-commercial license; an ad-funded site is commercial use |
| `@ffmpeg/core-mt` | needs COOP/COEP → kills AdSense |
| `lamejs` (original npm) | unmaintained + runtime crash; use the @breezystack fork |
| `ip-api.com` free tier | no HTTPS (verified 403) → mixed content |

## 5. Licenses in the shipped site

Add a small «Créditos y licencias» line in the footer of any page that ships
GPL/LGPL engines (ffmpeg GPL-2.0; heic-to and lamejs LGPL-3.0): name +
version + link to the license. MIT/BSD/Apache need no UI credit (keep the
headers inside the vendored files — never strip them).

## 6. `scripts/descargar-librerias.py`

```
python scripts/descargar-librerias.py --list          # see archetypes and files
python scripts/descargar-librerias.py generador-qr    # vendor libs for one archetype
python scripts/descargar-librerias.py conversor-audio video-a-gif   # several share files → downloaded once
```

Run it from the PROJECT root (it writes `lib/vendor/` + `assets/models/`
relative to cwd). It only downloads the pinned URLs above — if a URL 404s
someday, that's an upgrade decision for THIS file, not a reason to improvise
in a build. Re-runs skip files that already exist (idempotent).
