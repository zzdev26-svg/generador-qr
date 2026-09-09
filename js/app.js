/**
 * app.js — Orquestador de la interfaz: conecta los controles del DOM con el
 * motor de QR (qr-render.js), el generador de malla 3D (mesh-builder.js),
 * la vista previa (preview3d.js) y los exportadores. Todo vainilla JS,
 * sin frameworks, cargado como script normal (no módulo) tras los demás.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const state = {
    mode: 'link',
    shape: 'square',
    fg: '#111111',
    bg: '#ffffff',
    logoImage: null,
    logoDataUrl: null,
    emoji2d: '',
    archetype: 'stand',
    text3d: '',
    emoji3d: '',
    colorBase: '#ffffff',
    colorRelief: '#1a6fd6',
    sizeMM: 70,
  };

  let currentQr2D = null;
  let currentMesh3D = null;

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function getPayloadText() {
    if (state.mode === 'wifi') {
      return window.QRRender.buildWifiPayload($('wifi-ssid').value, $('wifi-pass').value, $('wifi-enc').value, false);
    }
    return $('input-link').value || 'https://tu-negocio.com';
  }

  function updateQR2D() {
    const text = getPayloadText();
    const hasOverlay = !!(state.logoImage || state.emoji2d);
    currentQr2D = window.QRRender.generate(text, hasOverlay);
    window.QRRender.drawToCanvas($('qr-canvas'), currentQr2D, {
      shape: state.shape,
      fgColor: state.fg,
      bgColor: state.bg,
      sizePx: 512,
      logoImage: state.logoImage,
      emoji: state.logoImage ? '' : state.emoji2d,
    });
  }

  function update3D() {
    const text = getPayloadText();
    const qr3d = window.QRRender.generate(text, false);
    const result = window.MeshBuilder.build({
      archetype: state.archetype,
      qr: qr3d,
      text: state.text3d,
      emoji: state.emoji3d,
      sizeMM: state.sizeMM,
    });
    currentMesh3D = result;
    window.Preview3D.update(result, state.colorBase, state.colorRelief);
    const warnEl = $('mesh-warning');
    if (result.warnings.length) {
      warnEl.textContent = '⚠️ ' + result.warnings.join(' ');
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }
  }

  const update3DDebounced = debounce(update3D, 300);
  const updateBothDebounced = debounce(() => { updateQR2D(); update3D(); }, 250);

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function showAdPopup() {
    $('ad-popup-overlay').classList.remove('hidden');
  }
  function hideAdPopup() {
    $('ad-popup-overlay').classList.add('hidden');
  }

  function wireModeTabs() {
    document.querySelectorAll('.mode-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;
        $('panel-link').classList.toggle('hidden', state.mode !== 'link');
        $('panel-wifi').classList.toggle('hidden', state.mode !== 'wifi');
        updateBothDebounced();
      });
    });
  }

  function wireArchetypeCards() {
    document.querySelectorAll('.archetype-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.archetype-card').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.archetype = btn.dataset.archetype;
        update3DDebounced();
      });
    });
  }

  function wire2DControls() {
    $('input-link').addEventListener('input', updateBothDebounced);
    $('wifi-ssid').addEventListener('input', updateBothDebounced);
    $('wifi-pass').addEventListener('input', updateBothDebounced);
    $('wifi-enc').addEventListener('change', updateBothDebounced);

    $('opt-shape').addEventListener('change', (e) => { state.shape = e.target.value; updateQR2D(); });
    $('opt-fg').addEventListener('input', (e) => { state.fg = e.target.value; updateQR2D(); });
    $('opt-bg').addEventListener('input', (e) => { state.bg = e.target.value; updateQR2D(); });
    $('opt-emoji').addEventListener('input', (e) => { state.emoji2d = e.target.value; updateQR2D(); });

    $('opt-logo').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          state.logoImage = img;
          state.logoDataUrl = reader.result;
          $('btn-clear-logo').classList.remove('hidden');
          updateQR2D();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    $('btn-clear-logo').addEventListener('click', () => {
      state.logoImage = null;
      state.logoDataUrl = null;
      $('opt-logo').value = '';
      $('btn-clear-logo').classList.add('hidden');
      updateQR2D();
    });
  }

  function wire3DControls() {
    $('opt3d-text').addEventListener('input', (e) => { state.text3d = e.target.value; update3DDebounced(); });
    $('opt3d-emoji').addEventListener('input', (e) => { state.emoji3d = e.target.value; update3DDebounced(); });
    $('opt3d-colorbase').addEventListener('input', (e) => {
      state.colorBase = e.target.value;
      window.Preview3D.setColors(state.colorBase, state.colorRelief);
    });
    $('opt3d-colorrelief').addEventListener('input', (e) => {
      state.colorRelief = e.target.value;
      window.Preview3D.setColors(state.colorBase, state.colorRelief);
    });
    $('opt3d-size').addEventListener('input', (e) => {
      state.sizeMM = Number(e.target.value);
      $('opt3d-size-val').textContent = state.sizeMM;
      update3DDebounced();
    });
  }

  function wireDownloads() {
    $('dl-png').addEventListener('click', () => {
      $('qr-canvas').toBlob((blob) => {
        downloadBlob(blob, 'codigo-qr.png');
        showAdPopup();
      }, 'image/png');
    });

    $('dl-svg').addEventListener('click', () => {
      const svg = window.QRRender.toSVG(currentQr2D, {
        shape: state.shape, fgColor: state.fg, bgColor: state.bg, sizePx: 512,
        logoImageDataUrl: state.logoDataUrl, emoji: state.logoImage ? '' : state.emoji2d,
      });
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'codigo-qr.svg');
      showAdPopup();
    });

    $('dl-3mf').addEventListener('click', () => {
      if (!currentMesh3D) return;
      const parts = [
        { color: state.colorBase, mesh: currentMesh3D.parts[0].mesh },
        { color: state.colorRelief, mesh: currentMesh3D.parts[1].mesh },
      ];
      const blob = window.ThreeMFWriter.export3MF(parts, ['Base', 'Relieve QR']);
      downloadBlob(blob, `qr3d-${state.archetype}.3mf`);
      showAdPopup();
    });

    $('dl-stl').addEventListener('click', () => {
      if (!currentMesh3D) return;
      const blob = window.STLWriter.exportSTL(currentMesh3D.parts);
      downloadBlob(blob, `qr3d-${state.archetype}.stl`);
      showAdPopup();
    });
  }

  function wireAdPlaceholders() {
    $('ad-popup-close').addEventListener('click', hideAdPopup);
    $('ad-popup-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'ad-popup-overlay') hideAdPopup();
    });
    $('ad-corner-close').addEventListener('click', () => $('ad-corner').classList.add('hidden'));
    setTimeout(() => $('ad-corner').classList.remove('hidden'), 4000);
  }

  function init() {
    wireModeTabs();
    wireArchetypeCards();
    wire2DControls();
    wire3DControls();
    wireDownloads();
    wireAdPlaceholders();
    // El QR 2D es la herramienta principal: se genera pase lo que pase.
    updateQR2D();
    try {
      window.Preview3D.init($('preview3d-canvas'));
    } catch (err) {
      console.warn('No se pudo iniciar la vista previa 3D:', err);
    }
    update3D();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
