/**
 * mesh-builder.js — Construye la geometría 3D de las tres piezas (soporte de
 * mesa, llavero, placa de pared) a partir del código QR, un texto y un
 * emoji. Depende solo de geom.js y heightmap.js (nada de three.js), para que
 * el resultado sea directamente exportable a STL/3MF sin pasar por ningún
 * motor de render.
 *
 * Salida: dos "partes" (colores) — 'base' (cuerpo del objeto) y 'relief'
 * (QR + texto + emoji en relieve, el segundo color). Cada parte es un mesh
 * ya fusionado (mismas coordenadas de mundo, superficies coincidentes o
 * solapadas) listo para que el exportador de 3MF le asigne un color propio.
 */
(function (global) {
  'use strict';

  const G = global.Geom;
  const H = global.Heightmap;

  // Parámetros físicos por defecto (mm). Pensados para impresión FDM de
  // dos colores: relieve de al menos ~3 capas (0.9mm a 0.2mm/capa) y grosor
  // de módulo objetivo >= 0.6mm.
  const RELIEF_HEIGHT = 0.9;
  const BASE_THICKNESS = 3.2;
  const CORNER_RADIUS = 4;

  // Nº de columnas de rejilla para rasterizar texto/emoji en función del
  // tamaño físico real de la región (mm). Evita dos problemas a la vez:
  // celdas más finas que un ancho de boquilla FDM (~0.4mm, poco fiables al
  // imprimir) y un número de cajas desproporcionado (archivos 3MF/STL
  // enormes) cuando el objeto es grande.
  const MIN_CELL_MM = 0.55;
  function targetCols(spanMM) {
    return Math.max(16, Math.min(64, Math.round(spanMM / MIN_CELL_MM)));
  }

  function layoutFront(faceW, faceH, hasText, hasEmoji) {
    const margin = Math.min(faceW, faceH) * 0.08;
    const gap = margin * 0.6;
    const emojiH = hasEmoji ? faceH * 0.16 : 0;
    const textH = hasText ? faceH * 0.13 : 0;
    const contentW = faceW - margin * 2;
    const qrAvailH = faceH - margin * 2 - emojiH - textH - (hasEmoji ? gap : 0) - (hasText ? gap : 0);
    const qrSize = Math.max(4, Math.min(contentW, qrAvailH));
    let y = margin;
    let textRegion = null, qrRegion, emojiRegion = null;
    if (hasText) { textRegion = { u0: margin, v0: y, u1: faceW - margin, v1: y + textH }; y += textH + gap; }
    const qu0 = (faceW - qrSize) / 2;
    qrRegion = { u0: qu0, v0: y, u1: qu0 + qrSize, v1: y + qrSize };
    y += qrSize + gap;
    if (hasEmoji) { emojiRegion = { u0: margin, v0: y, u1: faceW - margin, v1: y + emojiH }; }
    return { qrRegion, textRegion, emojiRegion };
  }

  function addQrRelief(builder, frame, region, qr) {
    const n = qr.getModuleCount();
    const size = region.u1 - region.u0;
    const cell = size / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        const u0 = region.u0 + c * cell;
        const v1 = region.v1 - r * cell; // fila 0 del QR = arriba = v alto
        G.addFrameBox(builder, frame, u0, v1 - cell, u0 + cell, v1, 0, RELIEF_HEIGHT);
      }
    }
    return cell;
  }

  function addGridRelief(builder, frame, region, gridInfo) {
    if (!gridInfo) return;
    const { grid, cols, rows } = gridInfo;
    const regionW = region.u1 - region.u0, regionH = region.v1 - region.v0;
    const cell = Math.min(regionW / cols, regionH / rows);
    const usedW = cell * cols, usedH = cell * rows;
    const ou = region.u0 + (regionW - usedW) / 2;
    const ov = region.v0 + (regionH - usedH) / 2;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        if (!grid[ry][rx]) continue;
        const u0 = ou + rx * cell;
        const v1 = ov + usedH - ry * cell; // fila 0 (arriba de la imagen) = v alto
        G.addFrameBox(builder, frame, u0, v1 - cell, u0 + cell, v1, 0, RELIEF_HEIGHT);
      }
    }
  }

  /**
   * @param {Object} opts
   * @param {'stand'|'keychain'|'plaque'} opts.archetype
   * @param {Object} opts.qr - instancia de qrcode-generator ya generada (qr.make() llamado)
   * @param {string} opts.text
   * @param {string} opts.emoji
   * @param {number} opts.sizeMM - tamaño nominal (ancho de cara, mm)
   */
  function build(opts) {
    const warnings = [];
    const base = G.newBuilder();
    const relief = G.newBuilder();
    const hasText = !!(opts.text && opts.text.trim());
    const hasEmoji = !!(opts.emoji && opts.emoji.trim());
    let dims;

    if (opts.archetype === 'stand') {
      const width = opts.sizeMM;
      const heightV = width * 1.25; // alto de la cara (a lo largo del talud)
      const tiltDeg = 21;
      const depth = heightV * Math.tan(tiltDeg * Math.PI / 180);
      // Perfil (plano XZ): trasero-abajo, delantero-abajo, trasero-arriba (triángulo rectángulo, CCW).
      const BBp = [0, 0], FBp = [depth, 0], BTp = [0, heightV];
      G.extrudeProfileAlongY(base, [BBp, FBp, BTp], -width / 2, width / 2);
      const L = Math.hypot(depth, heightV);
      const frame = {
        origin: [depth, -width / 2, 0],
        uDir: [0, 1, 0],
        vDir: [-depth / L, 0, heightV / L],
        nDir: [heightV / L, 0, depth / L],
      };
      const layout = layoutFront(width, L, hasText, hasEmoji);
      const cell = addQrRelief(relief, frame, layout.qrRegion, opts.qr);
      if (hasText) addGridRelief(relief, frame, layout.textRegion, H.rasterizeText(opts.text, { cols: targetCols(layout.textRegion.u1 - layout.textRegion.u0) }));
      if (hasEmoji) addGridRelief(relief, frame, layout.emojiRegion, H.rasterizeEmoji(opts.emoji, { cols: targetCols(layout.emojiRegion.v1 - layout.emojiRegion.v0) }));
      if (cell < 0.6) warnings.push('Los módulos del QR miden menos de 0.6mm: aumenta el tamaño para que se pueda escanear bien.');
      dims = { width, height: heightV, depth };
    } else if (opts.archetype === 'keychain') {
      const faceW = opts.sizeMM;
      const faceH = faceW * 1.15;
      const ringOuter = faceW * 0.11, ringInner = ringOuter * 0.52;
      G.addRoundedPlate(base, faceW, faceH, BASE_THICKNESS, CORNER_RADIUS, 6);
      // La arandela se solapa con el borde superior de la placa (mismo rango Z: se funden).
      G.addAnnulus(base, 0, faceH / 2 + ringOuter * 0.55, 0, BASE_THICKNESS, ringOuter, ringInner, 32);
      const frame = {
        origin: [-faceW / 2, -faceH / 2, BASE_THICKNESS],
        uDir: [1, 0, 0], vDir: [0, 1, 0], nDir: [0, 0, 1],
      };
      const layout = layoutFront(faceW, faceH, hasText, hasEmoji);
      const cell = addQrRelief(relief, frame, layout.qrRegion, opts.qr);
      if (hasText) addGridRelief(relief, frame, layout.textRegion, H.rasterizeText(opts.text, { cols: targetCols(layout.textRegion.u1 - layout.textRegion.u0) }));
      if (hasEmoji) addGridRelief(relief, frame, layout.emojiRegion, H.rasterizeEmoji(opts.emoji, { cols: targetCols(layout.emojiRegion.v1 - layout.emojiRegion.v0) }));
      if (cell < 0.5) warnings.push('Los módulos del QR son muy finos para un llavero pequeño: prueba con un tamaño mayor o un enlace más corto.');
      dims = { width: faceW, height: faceH + ringOuter * 1.6, depth: BASE_THICKNESS };
    } else { // plaque
      const faceW = opts.sizeMM;
      const faceH = faceW * 1.3;
      const loopOuter = faceW * 0.09, loopInner = loopOuter * 0.5, loopDepth = BASE_THICKNESS * 0.9;
      G.addRoundedPlate(base, faceW, faceH, BASE_THICKNESS, CORNER_RADIUS * 1.2, 6);
      // Lazo para colgar, en la parte trasera (protruye hacia -Z desde la cara trasera z=0).
      G.addAnnulus(base, 0, faceH / 2 - loopOuter * 1.3, -loopDepth, 0, loopOuter, loopInner, 28);
      const frame = {
        origin: [-faceW / 2, -faceH / 2, BASE_THICKNESS],
        uDir: [1, 0, 0], vDir: [0, 1, 0], nDir: [0, 0, 1],
      };
      const layout = layoutFront(faceW, faceH, hasText, hasEmoji);
      const cell = addQrRelief(relief, frame, layout.qrRegion, opts.qr);
      if (hasText) addGridRelief(relief, frame, layout.textRegion, H.rasterizeText(opts.text, { cols: targetCols(layout.textRegion.u1 - layout.textRegion.u0) }));
      if (hasEmoji) addGridRelief(relief, frame, layout.emojiRegion, H.rasterizeEmoji(opts.emoji, { cols: targetCols(layout.emojiRegion.v1 - layout.emojiRegion.v0) }));
      if (cell < 0.6) warnings.push('Los módulos del QR miden menos de 0.6mm: aumenta el tamaño para que se pueda escanear bien.');
      dims = { width: faceW, height: faceH, depth: BASE_THICKNESS + loopDepth };
    }

    return {
      parts: [
        { color: 'base', mesh: G.finalize(base) },
        { color: 'relief', mesh: G.finalize(relief) },
      ],
      dims,
      warnings,
    };
  }

  global.MeshBuilder = { build, RELIEF_HEIGHT, BASE_THICKNESS };
})(window);
