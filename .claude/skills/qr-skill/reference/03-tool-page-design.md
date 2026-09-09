# Tool Page Design — the tool IS the hero

Marketing sites seduce; tool pages **serve**. A visitor searching "comprimir
imagen online" wants to drop a file within 3 seconds, not admire a splash
screen. This file defines the layout, SEO and monetization shell every
archetype shares. The recipes plug the tool's machinery into this shell.

---

## 1. Page anatomy (top to bottom)

```
┌──────────────────────────────────────────────┐
│ header: logo · [más herramientas] · (lang)   │  compact, no mega-nav
├──────────────────────────────────────────────┤
│ H1 (the search intent) + 1-line subtitle     │
│ ┌──────────────────────────────────────────┐ │
│ │           THE TOOL CARD                  │ │  above the fold, always
│ │  dropzone / form / big action button     │ │
│ │  → progress → RESULT + download/copy     │ │
│ └──────────────────────────────────────────┘ │
│ 🔒 privacy badge («tus archivos no salen     │
│    de tu dispositivo») + honest limits       │
├──────────────────────────────────────────────┤
│ [ad-slot: leaderboard]  ← placeholder        │
├──────────────────────────────────────────────┤
│ Cómo funciona (3 pasos, iconos inline SVG)   │
│ Texto SEO (300–600 palabras, útil de verdad) │
│ [ad-slot: in-content]   ← placeholder        │
│ FAQ (5–8 preguntas long-tail, <details>)     │
│ Más herramientas (cards de otras páginas)    │
├──────────────────────────────────────────────┤
│ footer: privacidad · aviso legal · cookies   │
└──────────────────────────────────────────────┘
```

Rules:

- **The tool works above the fold** on a 375×812 phone. No scrolling to act.
- **No splash loader. Ever.** Tool pages paint instantly; heavy engines load
  on first action (invariant 5 in `SKILL.md`), never on page load.
- **Animation budget: near zero.** Micro-transitions on hover/progress are
  fine; GSAP/ScrollTrigger only for below-the-fold reveals and only if the
  page feels dead without them (it won't). This is the big difference from
  the marketing-site skill — restraint reads as speed, and speed is the brand.
- The SEO text is **genuinely useful** (how the format works, when to use
  what), not keyword soup. It lives BELOW the tool.

## 2. The tool card

The one component that must feel premium. One `.tool-card` with:

- **Input zone**: `<label>` dropzone wired to a hidden `<input type="file">`
  with the right `accept=`; also handle `dragover/drop` and **paste**
  (`document.onpaste` → files/clipboard). On mobile add
  `capture="environment"` when a camera shot is the natural input (scanner,
  OCR). For form archetypes (calculators, generators) the inputs replace the
  dropzone — same card, same rhythm.
- **States** (drive with a single `data-state` on the card; CSS shows/hides):
  `idle → loading-engine (progress bar + «preparando el motor, solo la
  primera vez») → working (progress) → done (result) → error (human message +
  retry)`. Never a dead button: if the browser can't run an engine,
  feature-detect at action time and show the error state with a plain
  explanation.
- **Result zone**: the download button is the biggest element on the page
  after the H1 («Descargar JPG — 1,2 MB»: name the format and the size).
  Copy-to-clipboard buttons give visual feedback («✓ Copiado»). Show a
  before/after figure when the archetype allows it (compressor: −72 %).
- **Reset**: a subtle «convertir otro archivo» link returns to `idle` without
  reloading.

Batch-capable archetypes render a row per file with individual progress and a
«descargar todo (.zip)» button (zip lib pinned in `14`).

## 3. Files & privacy microcopy (verbatim-ready, adapt tone)

- Badge under the tool: «🔒 100 % privado — tus archivos se procesan en tu
  dispositivo y no se suben a ningún servidor.»
- Limits, visible before failure: «Funciona con archivos de hasta ~200 MB
  (depende de la memoria de tu dispositivo).»
- First heavy load: «Descargando el motor (~30 MB)… solo pasa la primera
  vez, luego queda guardado.»

Honesty is a feature: the recipes state each tool's real ceilings — put them
in the UI, not in a tooltip nobody opens.

## 4. SEO kit (every page)

- `<title>`: `[Acción] online gratis | [Marca]` → «Comprimir imágenes online
  gratis | ToolName». ≤ 60 chars.
- Meta description with the promise + privacy angle. ≤ 155 chars.
- **H1 = the search intent**, singular and literal. One H1.
- FAQ as `<details>/<summary>` blocks targeting long-tails («¿puedo comprimir
  una imagen sin perder calidad?»).
- JSON-LD: `WebApplication` (name, description, `applicationCategory`,
  `offers: 0`) **and** `FAQPage` mirroring the visible FAQ. Inline
  `<script type="application/ld+json">`.
- Canonical URL, `og:title/description/image` (og-image: render the tool card
  look as a static 1200×630 WebP — no screenshot services).
- `lang` correct; one language per page (the niche decides).
- Multi-tool sites: every extra tool is **its own page** targeting its own
  intent, cross-linked via the «más herramientas» block. Never tabs on one
  URL.

## 5. Monetization shell (placeholders only — invariant 8)

- 2–3 `.ad-slot` divs: under the tool result, mid-content, (optional) above
  footer. Each: `min-height` reserved (avoid layout shift), light dashed
  border, a placeholder label (default «Publicidad»; «ANUNCIO» is fine if the
  owner asks) — and an HTML comment `<!-- PEGA AQUÍ TU CÓDIGO DE ADSENSE -->`.
- **Default: never above the H1, never overlapping the tool card, no popups.**
  Inline slots only. This is the right default and what most owners want.
- **If the owner EXPLICITLY asks for a popup / interstitial and a corner
  notice** (some ad-funded niches do), implement them *safely* — a badly-built
  interstitial that blocks the download is worse than no ad:
  - **Download interstitial:** fire it **after the download has already
    started** (listen for your own `qr:downloaded`-style event, then
    `setTimeout(open, ~350ms)`) so it NEVER blocks the file. Use a `<dialog>`
    with a real close button (×), close on backdrop click and on Esc, and a
    «Cerrar y seguir». The slot inside is still an empty placeholder.
  - **Corner toast:** a small fixed `aside`, dismissible, and remembered for the
    session (`sessionStorage`) so it doesn't nag on every interaction; reveal it
    after a delay, not on load.
  - Still ship the slots **empty** (placeholder only) — the skill never injects
    third-party ad scripts; the owner pastes AdSense later.
- Ship `privacidad.html` and `aviso-legal.html` skeletons (AdSense requires
  them) with TODO markers for the owner's data, linked in the footer.
- Cookie consent: leave a clearly marked TODO comment in `<head>` — the skill
  does **not** ship third-party consent scripts; the owner adds their CMP
  when activating AdSense.
- Optional «Pro» tier (if the user asks for a fake pricing section): plain
  cards with placeholder buttons `href="#"` + `data-todo="pasarela"` — never
  a real checkout.

## 6. Visual identity

Free within these bounds: clean utilitarian layout, 1 accent color + neutral
scale, system-adjacent sans (Inter/Manrope) + optional display face for the
H1 only, generous whitespace, cards with soft borders (no glassmorphism over
busy backgrounds), dark-mode friendly if cheap (`prefers-color-scheme` on
custom properties). Icons: inline SVG only (no icon fonts, no external icon
CDNs). Each site still gets its own personality (palette/type pairing per the
diversity spirit of the parent skill) — but the tool card layout stays
recognizable and boring-reliable.

## 7. Definition of done (page level)

- [ ] Tool usable above the fold on mobile; happy path exercised once in
      preview via `python -m http.server` (not `file://`).
- [ ] All states reachable: idle, progress, done, error (force one error).
- [ ] Privacy badge + limits visible. Heavy engine lazy-loads with progress.
- [ ] SEO kit complete (title, H1, FAQ, JSON-LD ×2, canonical, og).
- [ ] Ad slots present-but-empty, legal page skeletons linked.
- [ ] JS off → H1, SEO text, FAQ and footer still render (the tool card may
      show «esta herramienta necesita JavaScript»).
- [ ] Console clean. `verify_project.py` passes. `.htaccess` present,
      `?v=YYYYMMDD` on assets.
