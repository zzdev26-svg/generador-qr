# The Micro-SaaS Catalog — 25 archetypes, 7 technical patterns

Every archetype here runs **100% in the visitor's browser** on plain shared
hosting. No backend, no API keys, no per-use cost.

**How to use this file:** match the user's ask to an archetype → note its
pattern letter → open the recipe file for that pattern. If the ask is a NEW
idea, map it to the closest pattern and reuse that recipe's machinery. The
catalog is a launchpad, not a fence.

**Niche multiplier:** almost every archetype gets stronger when niched.
"Generador de QR" is a red ocean; "Generador de QR para restaurantes con
soporte imprimible en 3D" is a blue one. When the user gives a niche, bend the
copy, examples and extras of the archetype to that niche.

---

## The 7 technical patterns

| Pattern | Machinery | Recipe file |
|---|---|---|
| **A. Keyless external lookup** | one `fetch()` to a whitelisted free service | `11-recipes-network-and-generators.md` |
| **B. Network measurement** | timed transfers against public test files | `11-recipes-network-and-generators.md` |
| **C. Pure generators** | canvas/SVG/DOM + small vendored lib | `11-recipes-network-and-generators.md` |
| **D. Calculators** | pure JS + forms, zero dependencies | `11-recipes-network-and-generators.md` |
| **E. Light file processing** | Canvas API + small libs (jsPDF, pdf-lib…) | `05-recipes-files-and-media.md` |
| **F. Heavy WASM processing** | ffmpeg.wasm and friends, lazy-loaded | `05-recipes-files-and-media.md` |
| **G. AI in the browser** | on-device models (OCR, segmentation) | `06-recipes-ai-in-browser.md` |

Rule of thumb for effort: A–D ship in one sitting; E in one or two; F–G need
the recipe followed to the letter (worker paths, lazy loading, progress UI).

---

## The 25 archetypes

### Pattern A — Keyless external lookup

**1. Cuál es mi IP** · `mi-ip`
Shows public IP, city, ISP, browser and screen data. Massive evergreen search
volume ("cual es mi ip"). Machinery: one fetch to the whitelisted IP services
(primary + fallback, see recipe). Extras that lift it above competitors: copy
button, IPv4/IPv6 both, "what your browser reveals" panel (user-agent, locale,
screen) — all local data, no extra calls.

### Pattern B — Network measurement

**2. Test de velocidad de internet** · `test-velocidad`
Download / upload / latency with a big animated gauge. Huge search volume.
Machinery: timed transfers against public speed-test files (recipe lists the
exact URLs and sizes). Honest-limits note: results are indicative, not
lab-grade — say so in the FAQ. Extras: history of past runs (localStorage),
shareable result card rendered to canvas.

### Pattern C — Pure generators

**3. Generador de códigos QR** · `generador-qr`
QR with custom colors, shapes and center logo. Machinery: vendored
`qr-code-styling`. Killer extra for niches (restaurants!): **3D-printable
stand** — extrude the QR into a 3D preview and export STL for printing
(three.js + STL export, in the recipe). PNG/SVG download always; STL when the
niche wants a physical object.

**4. Generador de contraseñas** · `generador-contrasenas`
Length + character sets + "pronounceable" mode + strength meter. Machinery:
`crypto.getRandomValues` — zero libs. Privacy pitch writes itself (generated
locally, never transmitted). Extras: bulk generate, passphrase mode
(diceware-style word list vendored as JS array).

**5. Contador de días entre fechas** · `contador-dias`
Days between dates, countdowns, age calculator, "días hasta [evento]".
Machinery: native `Date` + `Intl` — zero libs. SEO gold: each popular countdown
(new year, summer…) can be its own pre-rendered page. Extras: shareable
countdown link (params in URL hash, rendered client-side).

**6. Paleta de colores desde imagen** · `paleta-colores`
Drop a photo → dominant palette with HEX/RGB/HSL, one-click copy. Machinery:
canvas pixel sampling + tiny quantizer (in-recipe snippet, no lib). Extras:
export palette as CSS variables / Tailwind config text / PNG swatch card.

**7. Generador de favicons** · `generador-favicons`
One image → all favicon sizes + manifest snippet, zipped. Machinery: canvas
resize to the standard size set + vendored zip lib; modern set is SVG+PNG
(recipe covers the optional .ico encoding). Audience: site builders — the
"más herramientas" cross-link block works extra hard here.

**8. Visor y formateador de JSON** · `visor-json`
Paste/drop JSON → pretty print, syntax colors, collapse/expand, validate with
line numbers, minify. Machinery: native `JSON.parse` + a small highlighter
(in-recipe snippet). Loyal developer audience. Extras: JSON⇄CSV conversion,
sharable via URL hash for small payloads.

### Pattern D — Calculators

**9. Conversor de unidades y tallas** · `conversor-unidades`
Length, weight, temperature, volume, clothing/shoe sizes. Machinery: pure JS
conversion tables. SEO machine: every pair ("cm a pulgadas") can be its own
page generated from the same engine. Keep each page's copy specific.

**10. Calculadora de sueldo neto** · `calculadora-sueldo`
Gross→net with current-year brackets. Machinery: pure JS + a `lib/manifest.js`
data table with rates. **Honesty invariant:** label the tax year visibly and
add an "aproximado, no es asesoría" line. One country per page; the user picks
which country at build time.

**11. Calculadora de hipoteca y préstamos** · `calculadora-hipoteca`
Monthly payment, total interest, amortization table + chart. Machinery: pure
JS French amortization + canvas chart (in-recipe snippet, no chart lib).
Best-paying ad niche of the catalog. Extras: compare two scenarios side by
side, print-friendly amortization table.

### Pattern E — Light file processing

**12. Conversor de imágenes** · `conversor-imagenes`
PNG ⇄ JPG ⇄ WebP, plus iPhone HEIC → JPG (the traffic magnet). Machinery:
canvas re-encode + vendored HEIC decoder (recipe pins the lib and its worker
files). Batch support, quality slider, all local.

**13. Compresor de imágenes** · `compresor-imagenes`
Reduce weight with visible before/after and % saved. Machinery: vendored
`browser-image-compression` (runs in a worker). Extras: target-size mode
("déjala bajo 200 KB"), batch + zip download.

**14. Redimensionador para redes sociales** · `redimensionador-rrss`
Crop/resize to每 network's exact sizes with visual crop. Machinery: canvas +
in-recipe crop UI (no lib needed). Ship a `lib/manifest.js` table of formats
(post/story/cover per network) so sizes are data, not code.

**15. Limpiador de metadatos de fotos** · `limpiador-metadatos`
Show EXIF (camera, date, GPS on a "your photo says where you live" panel) then
strip it. Machinery: vendored `exifr` to READ; canvas re-encode to STRIP
(removes everything — that's the standard method, recipe explains the quality
tradeoff). Viral privacy angle.

**16. Generador de CV** · `generador-cv`
Form → professional PDF, 2-3 templates, data kept in localStorage. Machinery:
vendored `jsPDF` (text-based, selectable PDF — not a screenshot; recipe is
strict about this). Extras: ATS-friendly plain template, ES/EN toggle.

**17. Generador de facturas** · `generador-facturas`
Invoice form → PDF with logo, VAT math, numbering. Machinery: `jsPDF` same as
CV. localStorage remembers issuer data and last invoice number. Honest line:
numbering is local to this browser.

**18. Firmar documentos PDF** · `firmar-pdf`
Draw signature on canvas → place it on any page of a PDF → download. Machinery:
vendored `pdf-lib` (edit) + `pdf.js` (render pages for placement UI) — the
recipe covers the worker path gotcha. Privacy pitch is maximal here (contracts
never leave the device).

**19. Herramientas PDF: unir, dividir, comprimir** · `herramientas-pdf`
The iLovePDF trio. Machinery: `pdf-lib` for merge/split/reorder (drag to
reorder page thumbnails rendered with `pdf.js`); "compress" = re-encode
embedded images via canvas (recipe sets honest expectations: good wins on
photo-heavy PDFs, marginal on text PDFs — say it in the UI).

### Pattern F — Heavy WASM processing

**20. Conversor de audio** · `conversor-audio`
MP3 ⇄ WAV ⇄ OGG ⇄ M4A. Machinery: ffmpeg.wasm, lazy-loaded on first use with
progress bar (the recipe's loader is mandatory — core files vendored, exact
paths matter). Limits stated in UI (~200 MB / browser memory).

**21. Conversor de vídeo a GIF** · `video-a-gif`
Clip → GIF with time range, fps and width controls + live preview. Machinery:
same vendored ffmpeg.wasm engine as `conversor-audio` (share the loader).
Warn on long clips; suggest ≤ 30 s in the UI.

**22. Recortador de MP3** · `recortador-mp3`
Waveform, drag the region, export the cut (ringtones intent). Machinery:
vendored `wavesurfer.js` (waveform + region) + export via the shared ffmpeg
engine (recipe includes the no-ffmpeg fallback to WAV via Web Audio when
memory is tight).

### Pattern G — AI in the browser

**23. Quitar fondo de imágenes** · `quitar-fondo`
Drop photo → subject cut out → transparent PNG or flat-color background.
Machinery: on-device segmentation model — **use exactly the library, version
and model the recipe pins** (licensing matters here; the recipe picks the one
that's free for commercial use). Heavy first load: progress UI + "se descarga
una vez" copy. Extras: background color/gradient picker for marketplace
photos.

**24. Extraer texto de imágenes (OCR)** · `ocr-imagenes`
Photo/screenshot → editable text, ES+EN. Machinery: vendored Tesseract.js with
language files self-hosted (recipe covers worker + traineddata paths — the #1
thing that breaks OCR deploys). Extras: copy button, plain-text download,
basic "keep line breaks" toggle.

**25. Escáner de documentos** · `escaner-documentos`
Phone photo → detected document edges → perspective crop → clean B/W → PDF.
Machinery: vendored OpenCV.js + jscanify per the recipe (mind the load size —
lazy-load like ffmpeg) + `jsPDF` for the multi-page PDF. The mobile camera
input (`<input capture>`) is first-class here — most users arrive on phones.

---

## Picking for the user (🎯 Recommend)

When asked "¿cuál creo?", weigh:

1. **Search demand**: 1, 2, 3, 12, 13, 19 are the volume monsters.
2. **Competition vs. differentiation**: prefer an archetype where the niche
   twist (their niche!) creates a defensible page. QR-for-restaurants-with-3D
   beats generic QR.
3. **Effort**: A–D archetypes ship fastest; suggest one of those for a first
   web, F–G for the "wow" second web.
4. **Ad value**: 10, 11 (finance) pay the best per visit; 1, 2 pay the least
   but get the most visits.

Recommend ONE, with a one-line reason, and offer to build it. Don't lecture
through the whole catalog.
