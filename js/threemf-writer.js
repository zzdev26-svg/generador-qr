/**
 * threemf-writer.js — Exportador 3MF con dos colores (basematerials del
 * núcleo del estándar 3MF, sin necesitar extensiones propietarias). Cada
 * parte del objeto se escribe como un <object> independiente que referencia
 * su propio color; ambos se colocan en el mismo <build> sin transformación,
 * de forma que ocupan el mismo espacio de coordenadas y el laminador
 * (Bambu Studio / PrusaSlicer / OrcaSlicer) los interpreta como dos
 * regiones de color de una misma pieza.
 */
(function (global) {
  'use strict';

  function hexToDisplayColor(hex) {
    const h = hex.replace('#', '').toUpperCase();
    return `#${h}FF`;
  }

  function meshToXml(mesh) {
    const { positions, indices } = mesh;
    const vLines = new Array(positions.length / 3);
    for (let i = 0, v = 0; i < positions.length; i += 3, v++) {
      vLines[v] = `<vertex x="${positions[i].toFixed(4)}" y="${positions[i + 1].toFixed(4)}" z="${positions[i + 2].toFixed(4)}"/>`;
    }
    const tLines = new Array(indices.length / 3);
    for (let i = 0, t = 0; i < indices.length; i += 3, t++) {
      tLines[t] = `<triangle v1="${indices[i]}" v2="${indices[i + 1]}" v3="${indices[i + 2]}"/>`;
    }
    return `<mesh><vertices>${vLines.join('')}</vertices><triangles>${tLines.join('')}</triangles></mesh>`;
  }

  /**
   * @param {Array<{color:string, mesh:Object}>} parts - color = '#rrggbb'
   */
  function buildModelXml(parts, names) {
    const bases = parts.map((p, i) =>
      `<base name="${names[i]}" displaycolor="${hexToDisplayColor(p.color)}"/>`).join('');
    const objects = parts.map((p, i) =>
      `<object id="${i + 2}" type="model" pid="1" pindex="${i}">${meshToXml(p.mesh)}</object>`).join('');
    const items = parts.map((p, i) => `<item objectid="${i + 2}"/>`).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
      `<resources><basematerials id="1">${bases}</basematerials>${objects}</resources>` +
      `<build>${items}</build></model>`;
  }

  const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    '</Types>';

  const RELS = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
    '</Relationships>';

  /**
   * @param {Array<{color:string, mesh:Object}>} parts - dos partes: base y relieve, con su color hex.
   * @param {Array<string>} names - nombres legibles ("Base", "Relieve")
   */
  function export3MF(parts, names) {
    const modelXml = buildModelXml(parts, names);
    const zip = global.MiniZip.createZip([
      { name: '[Content_Types].xml', data: CONTENT_TYPES },
      { name: '_rels/.rels', data: RELS },
      { name: '3D/3dmodel.model', data: modelXml },
    ]);
    return zip;
  }

  global.ThreeMFWriter = { export3MF };
})(window);
