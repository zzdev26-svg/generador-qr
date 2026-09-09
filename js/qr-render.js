/**
 * qr-render.js — Generación de la matriz QR (vía la librería vendorizada
 * qrcode-generator) y su renderizado estilizado (formas de punto, colores,
 * logo/emoji central) a <canvas> y a SVG.
 */
(function (global) {
  'use strict';

  /**
   * Genera la instancia QR con el nivel de corrección de errores adecuado.
   * Fuerza 'H' (30% de recuperación) si hay logo/emoji superpuesto, porque
   * se van a "excavar" módulos bajo esa zona y necesitan margen de sobra
   * para seguir siendo legibles.
   */
  function generate(text, hasOverlay) {
    const ec = hasOverlay ? 'H' : 'M';
    const qr = global.qrcode(0, ec); // typeNumber 0 = auto (el más pequeño que quepa)
    qr.addData(text || ' ');
    qr.make();
    return qr;
  }

  function overlayBounds(count, ratio) {
    const overlayModules = Math.floor(count * ratio);
    const start = Math.floor((count - overlayModules) / 2);
    return { start, end: start + overlayModules };
  }

  function isInOverlay(r, c, bounds) {
    return bounds && r >= bounds.start && r < bounds.end && c >= bounds.start && c < bounds.end;
  }

  function drawModuleShape(ctx, x, y, size, shape) {
    switch (shape) {
      case 'dots':
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size * 0.46, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'rounded': {
        const r = size * 0.32;
        roundRectPath(ctx, x + size * 0.06, y + size * 0.06, size * 0.88, size * 0.88, r);
        ctx.fill();
        break;
      }
      case 'classy': {
        ctx.save();
        ctx.translate(x + size / 2, y + size / 2);
        ctx.rotate(Math.PI / 4);
        const s = size * 0.62;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
        break;
      }
      default: // 'square'
        ctx.fillRect(x, y, size, size);
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} qr
   * @param {Object} style {shape, fgColor, bgColor, sizePx, logoImage, emoji, overlayRatio}
   */
  function drawToCanvas(canvas, qr, style) {
    const count = qr.getModuleCount();
    const sizePx = style.sizePx || 512;
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = style.bgColor || '#ffffff';
    ctx.fillRect(0, 0, sizePx, sizePx);

    const cell = sizePx / count;
    const hasOverlay = !!(style.logoImage || style.emoji);
    const bounds = hasOverlay ? overlayBounds(count, style.overlayRatio || 0.22) : null;

    ctx.fillStyle = style.fgColor || '#000000';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        if (isInOverlay(r, c, bounds)) continue;
        drawModuleShape(ctx, c * cell, r * cell, cell, style.shape);
      }
    }

    if (hasOverlay && bounds) {
      const px = bounds.start * cell, py = bounds.start * cell;
      const psize = (bounds.end - bounds.start) * cell;
      // Fondo de contraste tras el logo/emoji.
      ctx.fillStyle = style.bgColor || '#ffffff';
      roundRectPath(ctx, px, py, psize, psize, psize * 0.16);
      ctx.fill();
      if (style.logoImage) {
        const pad = psize * 0.08;
        ctx.drawImage(style.logoImage, px + pad, py + pad, psize - pad * 2, psize - pad * 2);
      } else if (style.emoji) {
        ctx.font = `${Math.floor(psize * 0.78)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(style.emoji, px + psize / 2, py + psize / 2 + psize * 0.02);
      }
    }
  }

  /** Devuelve un string SVG completo con las mismas reglas de estilo (sin logo, solo formas+colores). */
  function toSVG(qr, style) {
    const count = qr.getModuleCount();
    const sizePx = style.sizePx || 512;
    const cell = sizePx / count;
    const hasOverlay = !!(style.logoImageDataUrl || style.emoji);
    const bounds = hasOverlay ? overlayBounds(count, style.overlayRatio || 0.22) : null;
    let body = `<rect width="${sizePx}" height="${sizePx}" fill="${style.bgColor || '#ffffff'}"/>`;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        if (isInOverlay(r, c, bounds)) continue;
        body += svgModuleShape(c * cell, r * cell, cell, style.shape, style.fgColor || '#000000');
      }
    }
    if (hasOverlay && bounds) {
      const px = bounds.start * cell, py = bounds.start * cell;
      const psize = (bounds.end - bounds.start) * cell;
      body += `<rect x="${px}" y="${py}" width="${psize}" height="${psize}" rx="${psize * 0.16}" fill="${style.bgColor || '#ffffff'}"/>`;
      if (style.logoImageDataUrl) {
        const pad = psize * 0.08;
        body += `<image x="${px + pad}" y="${py + pad}" width="${psize - pad * 2}" height="${psize - pad * 2}" href="${style.logoImageDataUrl}"/>`;
      } else if (style.emoji) {
        body += `<text x="${px + psize / 2}" y="${py + psize / 2}" font-size="${psize * 0.78}" text-anchor="middle" dominant-baseline="central">${escapeXml(style.emoji)}</text>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">${body}</svg>`;
  }

  function escapeXml(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function svgModuleShape(x, y, size, shape, color) {
    switch (shape) {
      case 'dots':
        return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 0.46}" fill="${color}"/>`;
      case 'rounded':
        return `<rect x="${x + size * 0.06}" y="${y + size * 0.06}" width="${size * 0.88}" height="${size * 0.88}" rx="${size * 0.32}" fill="${color}"/>`;
      case 'classy': {
        const cx = x + size / 2, cy = y + size / 2, s = size * 0.62;
        return `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" fill="${color}" transform="translate(${cx},${cy}) rotate(45)"/>`;
      }
      default:
        return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}"/>`;
    }
  }

  /** Construye la carga útil WIFI: estándar para el mode "WiFi". */
  function buildWifiPayload(ssid, password, encryption, hidden) {
    const esc = (s) => (s || '').replace(/([\\;,:"])/g, '\\$1');
    const enc = encryption === 'nopass' ? 'nopass' : (encryption || 'WPA');
    return `WIFI:T:${enc};S:${esc(ssid)};${enc === 'nopass' ? '' : `P:${esc(password)};`}${hidden ? 'H:true;' : ''};`;
  }

  global.QRRender = { generate, drawToCanvas, toSVG, buildWifiPayload };
})(window);
