# Recipes — Patterns A, B, C, D: lookups, measurement, generators, calculators

Verified July 2026 (all endpoints re-tested with real CORS checks). These are
the fastest archetypes to ship — most need zero or one small vendored lib.

---

## A · `mi-ip` — public IP + geo, keyless

**The whitelist (the ONLY external services this archetype may call):**

| Order | URL | Gives | Notes (verified) |
|---|---|---|---|
| Primary | `https://ipwho.is/` | IP + full geo + ISP | CORS `*`, ~1.000 req/día, JSON has `success` flag |
| Fallback 1 | `https://ipapi.co/json/` | IP + geo | CORS ok, free tier throttles (429) |
| Fallback 2 | `https://1.1.1.1/cdn-cgi/trace` | IP + country only | CORS `*`, effectively unlimited, plain text `key=value` lines |
| IP-only helper | `https://api64.ipify.org?format=json` | IPv6/IPv4 | CORS `*`, unlimited-ish |

**NEVER use `ip-api.com`** — its free tier has NO HTTPS (403 on https, and
http is mixed content from an https page). Dead end, verified.

```js
async function getIpInfo() {
  const cached = sessionStorage.getItem("ipinfo");
  if (cached) return JSON.parse(cached);              // don't burn quotas
  let info = null;
  try {
    const r = await (await fetch("https://ipwho.is/")).json();
    if (r.success) info = { ip: r.ip, city: r.city, country: r.country,
      isp: r.connection && r.connection.isp, flag: r.flag && r.flag.emoji };
  } catch (_) {}
  if (!info) try {
    const r = await (await fetch("https://ipapi.co/json/")).json();
    if (r.ip) info = { ip: r.ip, city: r.city, country: r.country_name, isp: r.org };
  } catch (_) {}
  if (!info) try {
    const t = await (await fetch("https://1.1.1.1/cdn-cgi/trace")).text();
    const kv = Object.fromEntries(t.trim().split("\n").map(l => l.split("=")));
    info = { ip: kv.ip, country: kv.loc };
  } catch (_) {}
  if (info) sessionStorage.setItem("ipinfo", JSON.stringify(info));
  return info;                                        // null → error state
}
```

Extras (all LOCAL, no more calls): IPv4 vs IPv6 (compare `api.ipify.org` vs
`api64`), «what your browser reveals» panel (userAgent, language, screen,
timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`), copy button.

## B · `test-velocidad` — download / upload / latency

**The only serious keyless option (verified: CORS `*` both ways):**
Cloudflare's `https://speed.cloudflare.com/__down?bytes=N` (GET, returns
exactly N bytes, no-store) and `https://speed.cloudflare.com/__up` (POST body,
preflight OK).

Method (mirror this exactly):

1. **Latency:** 12× `fetch(".../__down?bytes=0")`, `performance.now()` around
   each; DISCARD the first (TCP/TLS warm-up); report the **median**.
2. **Download:** progressive rounds — 100 kB → 1 MB → 10 MB → 25 MB. Time
   from before `fetch` until `await res.arrayBuffer()` resolves. Stop when a
   round exceeds ~5 s. Mbps = `bytes*8/seconds/1e6`; subtract median latency
   on the small rounds. Run the biggest round 2-3× and report the best.
3. **Upload:** `POST` `new Blob([new Uint8Array(N)])` with
   `Content-Type: application/octet-stream`, N = 100 kB → 1 MB → 10 MB, same
   math.

UI: big animated gauge (rAF + eased needle — one of the few places animation
earns its keep), phase label (ping → bajada → subida), then a result card.
Extras: history in localStorage, «compartir resultado» card rendered to
canvas → PNG. FAQ honesty: results are indicative (wifi, VPN, device — not
lab-grade).

## C.1 · `generador-qr` — the flagship (QR + real 3D-print export)

This is the skill's showcase archetype: a live QR designer that also exports a
**print-ready 3D object with the color baked in**. It was built and shipped
end-to-end (QR3D) — the notes below are the hard-won version, not the sketch.
Read it whole before writing a line; the naïve implementation (plain square
relief, STL, no warnings) looks fine on screen and fails on the print bed.

**Lib:** `qr-code-styling` v1.9.2 UMD (~48 KB, MIT, vendored, global
`QRCodeStyling`) + `JSZip` (3MF/STL packaging) + `three` (r185, preview +
STL). Vendor all with `descargar-librerias.py generador-qr` — **this pulls
`three.core.min.js` too; do not skip it** (see `14`). three.js is loaded via
import map + lazy dynamic `import()` from the classic IIFE (see `14` §2).

*(Legacy 2D-only fallback if the styling lib ever breaks: `qrcode@1.4.4` UMD —
1.5.x has NO browser bundle, verified 404. Prefer qr-code-styling.)*

### The content, the design, and the image downloads (the easy half)

- Content modes: **link/text** (normalize bare domains → `https://`) and
  **wifi** (`WIFI:T:WPA;S:<ssid>;P:<pass>;;`, escape `\ ; , : "`). Phone,
  vCard, etc. are just more payload builders.
- Design, in **one unified "style" control**, not two selects. Users don't
  think in "dots type" + "corners type" — they think "clásico / redondeado /
  puntos / elegante". Map each preset to the three underlying options at once:

  ```js
  const STYLES = {
    clasico:    { dots:"square",         corners:"square",        cornerDot:"square" },
    redondeado: { dots:"rounded",        corners:"extra-rounded", cornerDot:"dot"    },
    puntos:     { dots:"dots",           corners:"dot",           cornerDot:"dot"    },
    elegante:   { dots:"classy-rounded", corners:"extra-rounded", cornerDot:"square" }
  };
  ```
- Center **logo or emoji, applied on click** — no separate "activate" step
  (picking an emoji IS choosing it). Emoji → rasterize one glyph to a canvas
  dataURL; logo upload → dataURL. Selecting a logo clears the emoji and vice
  versa; offer a visible "Quitar". When any center image is present, bump
  `qrOptions.errorCorrectionLevel` to `"H"` (it covers modules); otherwise `"M"`
  keeps the module count low → bigger, print-friendlier squares.
- Live re-render (debounced ~130 ms) on every control change. Image downloads:
  build a fresh `QRCodeStyling` at the requested px and `getRawData("png"|"svg")`
  → `Blob` → save. Name the file from the payload host/slug
  (`qr-mirestaurante-com.png`), not `qrcode.png`.

### The 3D object — the differentiator (the hard half)

**Export format: 3MF, not STL.** STL carries no color; a printed QR only scans
with real contrast, so the deliverable is a single `.3mf` holding TWO colored
parts (base plate + raised QR/text), colors picked by the user. Every modern
slicer (Bambu Studio, PrusaSlicer, Orca, Cura) opens 3MF and maps the two parts
to two filaments automatically. STL is a **secondary** link only (two files,
zipped, "para impresoras antiguas").

**Rule #1 — the relief IS the styled QR, rasterized. Not plain squares.**
Naïve builds place a cube per dark module → the printed code ignores the chosen
dot/corner style and, worse, drifts from what the user sees. Instead keep TWO
channels from the same code:

1. **The true matrix** for sizing & warnings: read `inst._qr.getModuleCount()`
   and `inst._qr.isDark(r,c)` → `n` and a bit grid. Gives module count → mm per
   module → print warnings.
2. **A styled black/white raster ("the mask")** for the geometry: render the
   SAME styled QR (same `STYLES` preset, same center silhouette) at `~12 px`
   per module, forced pure black on white, into a canvas; read its pixels. The
   relief is built from THIS, so the print matches the on-screen image exactly —
   dot shape, rounded corners, centre logo and all.

   ```js
   // styled mask: same options as the preview, but B/W and margin 0
   const opts = qrOptions(n * 12, "canvas");
   opts.margin = 0; opts.dotsOptions.color = "#000";
   opts.cornersSquareOptions.color = "#000"; opts.cornersDotOptions.color = "#000";
   opts.backgroundOptions = { color:"#fff" }; opts.image = silhouette; // see below
   const blob = await new QRCodeStyling(opts).getRawData("png");
   // draw blob→canvas→getImageData; a pixel <128 luminance == relief here
   ```

**Rule #2 — the centre logo becomes a single-color SILHOUETTE.** Relief prints
in one color, so a full-color logo is meaningless on the bed. Convert it: if the
image has real transparency (>~4 % transparent pixels) use its **alpha** as the
mask; otherwise (a JPG/photo) threshold **luminance**. Emoji: rasterize the
glyph, same treatment. Feed the silhouette as the mask's `image` so it rises in
the QR color, exactly where it sits in the 2D preview.

**Rule #3 — merge cells into rectangles before making geometry.** A cube per
black pixel of a 350²-px mask is hundreds of thousands of boxes → a multi-MB
file and a preview that melts. Greedily merge adjacent "on" cells into the
fewest maximal rectangles first (row-run then grow down while the whole run
stays on); build one box per rectangle. Typical result: a 33-module QR drops
from thousands of cubes to a few hundred–~2 000 rectangles depending on style,
and the `.3mf` lands at ~18–140 KB.

```js
function gridRects(on, cols, rows) {           // on(r,c) → 0|1
  const used = new Uint8Array(cols*rows), out = [];
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
    if (used[r*cols+c] || !on(r,c)) continue;
    let w=1; while (c+w<cols && !used[r*cols+c+w] && on(r,c+w)) w++;
    let h=1; grow: while (r+h<rows){ for (let k=0;k<w;k++) if (used[(r+h)*cols+c+k]||!on(r+h,c+k)) break grow; h++; }
    for (let rr=r;rr<r+h;rr++) for (let cc=c;cc<c+w;cc++) used[rr*cols+cc]=1;
    out.push({c,r,w,h});
  }
  return out;                                   // ← also reused for the text/label relief
}
```

Build each rectangle as a `BufferGeometry` box-soup (positions + normals +
index, written by hand — no CSG needed). Grow every relief box a hair (~0.01 mm)
and **sink it ~0.15 mm into the base** so the slicer welds base+relief without a
hairline gap. Keep base and relief as TWO separate meshes → the two colored 3MF
objects.

**The three object formats** (base thickness/shape differ; same relief):

| Formato | Shape | Detail |
|---|---|---|
| `soporte` | inclined wedge ~38° | prints **without supports** (the QR face points up); add a small front lip so it doesn't end in a knife edge. Ideal for restaurant menus / "déjanos una reseña". |
| `llavero` | flat plate ~3 mm | ring hole via an extruded shape with a `Path` hole near the top. |
| `placa` | flat plate ~3.2 mm | two hang holes top-left/top-right. |

All take a short **text in relief** (business name) rasterized with the same
`gridRects` treatment and merged into the relief mesh — so it prints in the QR
color. (Do **not** duplicate an emoji field on the 3D panel if the centre
logo/emoji already applies to the object — one source of truth.)

**Building the 3MF by hand (it's a zip of XML — only JSZip needed):**

```
archivo.3mf  (ZIP, DEFLATE)
├── [Content_Types].xml
├── _rels/.rels                  → relationship to /3D/3dmodel.model
└── 3D/3dmodel.model             → the XML below
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="es-ES"
       xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
      <base name="Base"    displaycolor="#F2F1ECFF"/>  <!-- user color 1, ALPHA byte required -->
      <base name="Codigo"  displaycolor="#1B1B22FF"/>  <!-- user color 2 -->
    </basematerials>
    <object id="2" type="model" pid="1" pindex="0"><mesh>…base…</mesh></object>
    <object id="3" type="model" pid="1" pindex="1"><mesh>…QR+text relief…</mesh></object>
  </resources>
  <build><item objectid="2"/><item objectid="3"/></build>
</model>
```

Non-obvious 3MF gotchas learned the hard way:

- **`displaycolor` needs 8 hex digits** (`#RRGGBBFF`) — the alpha byte is not
  optional; several slicers ignore a 6-digit color.
- **Translate every vertex to the positive octant** (compute min x/y/z across
  both parts, subtract). Slicers place the model from the origin; negative
  coords drop half the piece under the build plate.
- **Weld vertices** — dedupe by a `Map` keyed on rounded-to-µm coords before
  writing `<vertex>`; shrinks the file and yields a cleaner (near-manifold)
  mesh. Skip degenerate triangles (two shared indices).
- `[Content_Types].xml`:
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
- `_rels/.rels`: one `Relationship` `Type=".../3dmodel"` `Target="/3D/3dmodel.model"`.
- Zip with JSZip (`generateAsync({ type:"blob", mimeType:"model/3mf", compression:"DEFLATE" })`), extension `.3mf`.
- **Verify by re-parsing your own output**: unzip the produced blob, parse
  `3D/3dmodel.model`, assert exactly 2 `<object>`, 2 `displaycolor`s, non-zero
  `<triangle>` per part. This is the definition-of-done check for this tool —
  do it in the http preview AND once on the live URL.

**STL fallback (secondary link only):** `new STLExporter().parse(mesh, {binary:true})`
per part → two `.stl` + a short `LEEME.txt` ("import both, place both at 0,0,
assign a filament to each") zipped together.

### Preview = truth (three.js) — and its five robustness traps

The preview shows the SAME two user-picked colors as the exported materials
(two `MeshStandardMaterial`s) — what they see is what prints. Show BOTH the 2D
image and the 3D object at once (stacked) rather than hiding one behind a tab;
users compared them constantly. Traps that each cost real debugging time:

1. **Lazy-load the engine, never on page load.** The three payload is ~750 KB;
   loading it up front wrecks first paint (invariant 5). Gate init behind an
   `IntersectionObserver` on the viewer, `rootMargin:"200px"`, and only start
   the render loop while visible (`isVisible` flag + bail on `document.hidden`)
   to spare the phone battery.
2. **Background-tab `innerHeight === 0`.** If the page opens in a tab that is
   not fronted, the viewer has **no size** and the IntersectionObserver may
   never fire → the 3D view stays on "Preparando…" forever. Guard it: a retry
   timer that bails while `innerHeight` is 0 and re-checks, **plus** a
   `visibilitychange` listener that kicks the init when the tab is first shown.
   (Verified failure mode in the QR3D build.)
3. **WebGL feature-detect → graceful fallback.** Some Windows/RDP/VM setups
   have no WebGL. Detect at activation; if absent, show a plain message and keep
   the PNG/SVG downloads working — never a dead 3D box (see `07` §2.7).
4. **Async rebuild race.** The styled mask is produced async; fast typing fires
   several rebuilds. Use a generation counter — increment on entry, bail if it
   changed after the `await` — so a stale model never overwrites the newest.
5. **Don't reset the user's camera on every rebuild.** Fit the camera only when
   the **format** changes (soporte↔llavero↔placa), not on every keystroke, or
   the object jumps back while they type. Orient per format: show the `soporte`
   resting on the plate, but the flat `llavero`/`placa` **face-on** (rotate the
   group) so the code is readable, not seen edge-wise.

### Print-quality rules (surface them live in the UI, don't bury them)

Compute on every change and show as inline warnings — this is what makes the
tool trustworthy:

- **Contrast** (WCAG luminance ratio of the two colors) < 3:1 → "won't scan,
  pick a light base + dark code". `lum > lum_base` (code lighter than base) →
  inverted-QR warning ("most phones read it, some old ones don't").
- **Module size** ≥ **1.5 mm** or the nozzle rounds the corners and the code
  smears. Show the live mm/module figure; turn it red under 1.5 and tell them to
  enlarge the object or shorten the link.
- **Relief height** 1–2 mm (1.2 mm is the sweet spot).
- **Centre logo** present → it covers modules; ECC is already at "H", but advise
  a test-scan before printing a batch.
- Default to a light base + dark code; **test-scan the 2D preview with a phone**
  before claiming done.

## C.2 · `generador-contrasenas`

Zero libs. `crypto.getRandomValues(new Uint32Array(n))` mapped to the chosen
charset — NEVER `Math.random()`. Modes: characters (length 8–64, sets
toggles), passphrase (vendored ES word list in `lib/manifest.js`, 4–8 words,
separator choice). Strength meter: entropy bits = `length * log2(poolSize)`
→ label thresholds (<45 débil, <80 buena, ≥80 excelente). Copy button +
«generar 10» bulk mode. Privacy line: generated locally, nothing transmitted.

## C.3 · `contador-dias`

Zero libs. Native `Date` + `Intl.DateTimeFormat`. Compute in UTC midnights to
dodge DST off-by-one: `Math.round((utcB - utcA) / 864e5)`. Modes: between
dates (± workdays count), countdown to date (live tick), age calculator.
Shareable countdown: encode `{title, date}` in `location.hash`
(encodeURIComponent JSON) and render on load — no backend, links just work.
SEO: pre-render a static page per evergreen countdown (año nuevo, verano…).

## C.4 · `paleta-colores`

Zero libs — a compact median-cut quantizer over canvas pixels:
draw image scaled to ≤120×120 → `getImageData` → median-cut to 6 colors →
sort by luminance. Show swatches with HEX/RGB/HSL, click-to-copy, plus
one-click exports: CSS custom properties block, JSON, and a 1200×630 PNG
swatch card (canvas). Only local files (taint rule).

## C.5 · `generador-favicons`

**Lib:** JSZip v3.10.1 UMD (MIT, vendored) for the bundle. Canvas-resize the
uploaded square image to: 16, 32, 48, 180 (apple-touch), 192, 512. Modern
truth: **SVG+PNG is the 2026 set — .ico is optional**; if wanted, build a
valid multi-size .ico by hand (ICONDIR + embedded PNGs — ~30 lines, PNG-in-ICO
is valid since Vista; snippet lives in this repo's script comments). Output:
zip with the PNGs + `site.webmanifest` + the copy-paste `<link>` block shown
on screen. Warn when the source is < 512 px.

## C.6 · `visor-json`

Zero libs. `JSON.parse` in try/catch → on error, show line/column (compute
from the `at position N` of the error + counting newlines) with the offending
line highlighted. Pretty print `JSON.stringify(obj, null, 2)` rendered
through a ~40-line tokenizer for syntax colors (string/number/bool/null/key)
— NO highlight.js needed. Collapse/expand: render objects/arrays as nested
`<details>`. Extras: minify, JSON⇄CSV for flat arrays, «compartir» via URL
hash for payloads < 2 KB. Escape everything with `escHTML` (XSS — JSON is
user input!). Big-file guard: > 5 MB → offer plain validate-only mode.

## D.1 · `conversor-unidades`

Zero libs. One conversion table in `lib/manifest.js`
(`{ magnitude: { unit: factorToBase } }`) + one pure `convert(value, from,
to)`. Temperature is affine (offset), not a factor — special-case it.
Clothing/shoe sizes are lookup tables, not math. SEO machine: generate one
static page per popular pair («cm a pulgadas») reusing the same engine with
preselected units and pair-specific copy + FAQ.

## D.2 · `calculadora-sueldo`

Zero libs. Bracket table + rates as DATA in `lib/manifest.js` with a visible
`year` field. Honesty invariants: label the tax year in the UI, «cálculo
aproximado, no es asesoría fiscal» line, and a `<!-- TODO: revisar tramos
AAAA -->` comment. One country per page (build-time choice). Output: net
monthly/annual, effective rate, and a stacked bar (CSS, no chart lib).

## D.3 · `calculadora-hipoteca`

Zero libs. French system: `cuota = P * r / (1 - (1+r)^-n)` (r = monthly
rate). Outputs: monthly payment, total interest, full amortization table
(virtualize > 360 rows: render in chunks) + a canvas line/area chart
(~60 lines: axes, two series — pending capital & paid interest; no chart
lib). Extras: two-scenario compare side by side; print-friendly table
(`@media print`). The best ad-value archetype — mind slot placement rules
from `03` (never inside the table).

---

## Definition of done (A–D)

Real run in http preview (a real IP lookup, a real speed round, a scannable
QR — scan it with a phone; for the 3D twist, **re-parse the exported `.3mf`**:
2 objects, 2 colors, non-zero triangles, and confirm the same on the live URL;
a verified calculation against one hand-computed case written in a code
comment). Console clean, offline behavior sane for A/B (error state, not
blank), then the `03` checklist.
