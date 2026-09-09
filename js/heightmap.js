/**
 * heightmap.js — Convierte texto o un emoji en una rejilla booleana (mapa de
 * bits) rasterizándolo en un <canvas> oculto y umbralizando el canal alfa.
 *
 * Ventaja de este enfoque: funciona igual para texto que para emoji (que son
 * glifos a color, no vectores simples) sin depender de fuentes vectoriales
 * cargadas aparte, y produce una rejilla compatible con el mismo extrusor de
 * "cajitas" que usa el relieve del propio código QR (ver mesh-builder.js).
 */
(function (global) {
  'use strict';

  /**
   * Rasteriza `text` con la fuente indicada a una rejilla de `cols` columnas
   * (las filas se derivan manteniendo proporción). Devuelve
   * { grid: boolean[row][col], cols, rows } o null si el texto está vacío.
   */
  function rasterizeText(text, opts) {
    text = (text || '').trim();
    if (!text) return null;
    opts = opts || {};
    const fontPx = 200; // resolución de trabajo alta, luego se re-muestrea
    const fontFamily = opts.fontFamily || '"Arial Black", "Segoe UI Emoji", "Noto Emoji", sans-serif';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `900 ${fontPx}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const padding = fontPx * 0.15;
    const w = Math.ceil(metrics.width + padding * 2);
    const h = Math.ceil(fontPx * 1.3 + padding);
    canvas.width = Math.max(w, 4);
    canvas.height = Math.max(h, 4);
    ctx.font = `900 ${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, padding, fontPx + padding * 0.3);
    return sampleAlphaToGrid(ctx, canvas.width, canvas.height, opts.cols || 140);
  }

  /** Rasteriza un único emoji (glifo a color) — misma técnica, se lee el canal alfa. */
  function rasterizeEmoji(emoji, opts) {
    emoji = (emoji || '').trim();
    if (!emoji) return null;
    opts = opts || {};
    const size = 200;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = `${size * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, size, size);
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.02);
    return sampleAlphaToGrid(ctx, size, size, opts.cols || 64);
  }

  function sampleAlphaToGrid(ctx, w, h, cols) {
    const img = ctx.getImageData(0, 0, w, h).data;
    // Recorta a la caja delimitadora real del contenido para no desperdiciar rejilla en márgenes vacíos.
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = img[(y * w + x) * 4 + 3];
        if (a > 60) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // nada renderizado (glifo no soportado, etc.)
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const rows = Math.max(1, Math.round((cols * bh) / bw));
    const grid = [];
    for (let ry = 0; ry < rows; ry++) {
      const row = new Array(cols).fill(false);
      for (let rx = 0; rx < cols; rx++) {
        // Muestrea el bloque de píxeles correspondiente a esta celda (mayoría de píxeles "tinta").
        const sx0 = minX + Math.floor((rx / cols) * bw);
        const sx1 = minX + Math.floor(((rx + 1) / cols) * bw);
        const sy0 = minY + Math.floor((ry / rows) * bh);
        const sy1 = minY + Math.floor(((ry + 1) / rows) * bh);
        let dark = 0, total = 0;
        for (let y = sy0; y <= sy1 && y <= maxY; y++) {
          for (let x = sx0; x <= sx1 && x <= maxX; x++) {
            total++;
            if (img[(y * w + x) * 4 + 3] > 60) dark++;
          }
        }
        row[rx] = total > 0 && dark / total > 0.35;
      }
      grid.push(row);
    }
    return { grid, cols, rows };
  }

  global.Heightmap = { rasterizeText, rasterizeEmoji };
})(window);
