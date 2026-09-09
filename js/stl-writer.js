/**
 * stl-writer.js — Exportador STL binario (formato universal, sin color).
 * Fusiona todas las partes recibidas en una sola malla, tal como esperan los
 * lectores STL clásicos de una sola pieza/color.
 */
(function (global) {
  'use strict';

  function countTriangles(parts) {
    let n = 0;
    for (const p of parts) n += p.mesh.indices.length / 3;
    return n;
  }

  /** @param {Array<{mesh:{positions,normals,indices}}>} parts */
  function exportSTL(parts) {
    const triCount = countTriangles(parts);
    const bufferSize = 80 + 4 + triCount * 50;
    const buf = new ArrayBuffer(bufferSize);
    const view = new DataView(buf);
    let offset = 80; // cabecera vacía (80 bytes), no se escribe nada (ceros)
    view.setUint32(offset, triCount, true);
    offset += 4;

    for (const part of parts) {
      const { positions, normals, indices } = part.mesh;
      for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t], ib = indices[t + 1], ic = indices[t + 2];
        // Normal: promedio de las tres normales del triángulo (ya son planas/iguales aquí).
        const nx = normals[ia * 3], ny = normals[ia * 3 + 1], nz = normals[ia * 3 + 2];
        view.setFloat32(offset, nx, true); offset += 4;
        view.setFloat32(offset, ny, true); offset += 4;
        view.setFloat32(offset, nz, true); offset += 4;
        for (const idx of [ia, ib, ic]) {
          view.setFloat32(offset, positions[idx * 3], true); offset += 4;
          view.setFloat32(offset, positions[idx * 3 + 1], true); offset += 4;
          view.setFloat32(offset, positions[idx * 3 + 2], true); offset += 4;
        }
        view.setUint16(offset, 0, true); offset += 2; // "attribute byte count"
      }
    }
    return new Blob([buf], { type: 'model/stl' });
  }

  global.STLWriter = { exportSTL };
})(window);
