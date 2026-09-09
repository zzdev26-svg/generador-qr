/**
 * geom.js — Primitivas de geometría 3D puras (sin dependencias).
 *
 * Decisión de arquitectura: este módulo NO depende de three.js. Genera un
 * formato neutro { positions: Float32Array, normals: Float32Array, indices:
 * Uint32Array } por cada "parte" (color) del objeto. Ese formato neutro lo
 * consumen tanto los exportadores (stl-writer.js, threemf-writer.js) como el
 * puente de vista previa (preview3d.js, que sí usa three.js). Así los
 * exportadores son verificables sin motor 3D de por medio.
 *
 * Todas las formas usadas son o bien polígonos CONVEXOS (fan-triangulación
 * trivial y segura) o círculos/anillos analíticos. Deliberadamente se evita
 * la triangulación general de "polígono con agujero" (ear-clipping con
 * puentes): los agujeros funcionales (anilla de llavero, lazo para colgar en
 * pared) se resuelven como una arandela (anillo) analítica fundida/solapada
 * sobre el cuerpo principal, no como un booleano de sustracción. Es más
 * simple, no tiene casos borde y es una técnica estándar en piezas
 * imprimibles reales.
 */
(function (global) {
  'use strict';

  function newBuilder() {
    return { positions: [], normals: [], indices: [] };
  }

  function finalize(b) {
    return {
      positions: new Float32Array(b.positions),
      normals: new Float32Array(b.normals),
      indices: new Uint32Array(b.indices),
    };
  }

  // Añade un triángulo con normal explícita (caras planas, sin compartir vértices).
  function pushTri(b, p0, p1, p2, n) {
    const base = b.positions.length / 3;
    b.positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    for (let i = 0; i < 3; i++) b.normals.push(n[0], n[1], n[2]);
    b.indices.push(base, base + 1, base + 2);
  }

  function sub(a, c) { return [a[0] - c[0], a[1] - c[1], a[2] - c[2]]; }
  function cross(a, c) { return [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]]; }
  function norm(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  // Cuadrilátero plano (p0,p1,p2,p3 en orden, CCW visto desde el lado de la normal saliente).
  function pushQuad(b, p0, p1, p2, p3) {
    const n = norm(cross(sub(p1, p0), sub(p2, p0)));
    pushTri(b, p0, p1, p2, n);
    pushTri(b, p0, p2, p3, n);
  }

  // Abanico convexo (todos los puntos deben formar un polígono convexo, orden CCW).
  function pushConvexFan(b, points, normal, flip) {
    const n = flip ? [-normal[0], -normal[1], -normal[2]] : normal;
    for (let i = 1; i < points.length - 1; i++) {
      if (flip) pushTri(b, points[0], points[i + 1], points[i], n);
      else pushTri(b, points[0], points[i], points[i + 1], n);
    }
  }

  /**
   * Caja ortoédrica, esquina mínima (x0,y0,z0) a máxima (x1,y1,z1).
   */
  function addBox(b, x0, y0, z0, x1, y1, z1) {
    const p = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], // z0 (abajo)
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], // z1 (arriba)
    ];
    pushQuad(b, p[0], p[3], p[2], p[1]); // -z
    pushQuad(b, p[4], p[5], p[6], p[7]); // +z
    pushQuad(b, p[0], p[1], p[5], p[4]); // -y
    pushQuad(b, p[2], p[3], p[7], p[6]); // +y
    pushQuad(b, p[1], p[2], p[6], p[5]); // +x
    pushQuad(b, p[3], p[0], p[4], p[7]); // -x
  }

  /**
   * Genera los puntos de contorno de un rectángulo con esquinas redondeadas,
   * en el plano XY, centrado en el origen, orden CCW. Polígono convexo.
   */
  function roundedRectPath(width, height, radius, segsPerCorner) {
    segsPerCorner = segsPerCorner || 6;
    const r = Math.min(radius, width / 2, height / 2);
    const hw = width / 2, hh = height / 2;
    const centers = [
      [hw - r, hh - r, 0],      // esquina sup-der: ángulo 0..90
      [-hw + r, hh - r, 90],    // sup-izq: 90..180
      [-hw + r, -hh + r, 180],  // inf-izq: 180..270
      [hw - r, -hh + r, 270],   // inf-der: 270..360
    ];
    const pts = [];
    for (const [cx, cy, startDeg] of centers) {
      for (let i = 0; i <= segsPerCorner; i++) {
        const a = (startDeg + (i / segsPerCorner) * 90) * Math.PI / 180;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    }
    return pts;
  }

  /**
   * Extruye un contorno 2D CONVEXO (array de [x,y], CCW) a lo largo de Z,
   * desde z0 a z1. Genera tapa inferior, tapa superior y paredes laterales.
   */
  function extrudeConvexPath(b, path2D, z0, z1) {
    const bottom = path2D.map((p) => [p[0], p[1], z0]);
    const top = path2D.map((p) => [p[0], p[1], z1]);
    pushConvexFan(b, bottom, [0, 0, -1], true);
    pushConvexFan(b, top, [0, 0, 1], false);
    const n = path2D.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pushQuad(b, bottom[i], bottom[j], top[j], top[i]);
    }
  }

  /** Placa con esquinas redondeadas (usada para llavero/placa de pared). */
  function addRoundedPlate(b, width, height, thickness, radius, segsPerCorner) {
    const path = roundedRectPath(width, height, radius, segsPerCorner);
    extrudeConvexPath(b, path, 0, thickness);
  }

  /**
   * Arandela / anillo analítico (sin triangulación de agujero: el "hueco" es
   * el propio agujero central del anillo, generado de forma exacta).
   * Centrado en (cx,cy), extendido en Z de z0 a z1.
   */
  function addAnnulus(b, cx, cy, z0, z1, outerR, innerR, segments) {
    segments = segments || 32;
    const outer = [], inner = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      outer.push([cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR]);
      inner.push([cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]);
    }
    // Tapas: tira de triángulos entre círculo exterior e interior.
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      // Tapa inferior (normal -Z)
      pushTri(b, [outer[i][0], outer[i][1], z0], [inner[i][0], inner[i][1], z0], [inner[j][0], inner[j][1], z0], [0, 0, -1]);
      pushTri(b, [outer[i][0], outer[i][1], z0], [inner[j][0], inner[j][1], z0], [outer[j][0], outer[j][1], z0], [0, 0, -1]);
      // Tapa superior (normal +Z)
      pushTri(b, [outer[i][0], outer[i][1], z1], [inner[j][0], inner[j][1], z1], [inner[i][0], inner[i][1], z1], [0, 0, 1]);
      pushTri(b, [outer[i][0], outer[i][1], z1], [outer[j][0], outer[j][1], z1], [inner[j][0], inner[j][1], z1], [0, 0, 1]);
      // Pared exterior
      pushQuad(b, [outer[i][0], outer[i][1], z0], [outer[j][0], outer[j][1], z0], [outer[j][0], outer[j][1], z1], [outer[i][0], outer[i][1], z1]);
      // Pared interior (agujero) — normal apunta hacia el centro
      pushQuad(b, [inner[j][0], inner[j][1], z0], [inner[i][0], inner[i][1], z0], [inner[i][0], inner[i][1], z1], [inner[j][0], inner[j][1], z1]);
    }
  }

  /**
   * Cuña/prisma: extruye un perfil 2D CONVEXO arbitrario (p.ej. un trapecio
   * visto de lado) a lo largo del eje Y (anchura del objeto), entre y0 e y1.
   * El perfil vive en el plano XZ: cada punto es [x, z].
   */
  function extrudeProfileAlongY(b, profileXZ, y0, y1) {
    const back = profileXZ.map((p) => [p[0], y0, p[1]]);
    const front = profileXZ.map((p) => [p[0], y1, p[1]]);
    // Tapa trasera (normal -Y) y delantera (normal +Y)
    pushConvexFan(b, back, [0, -1, 0], true);
    pushConvexFan(b, front, [0, 1, 0], false);
    const n = profileXZ.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pushQuad(b, back[i], back[j], front[j], front[i]);
    }
  }

  /**
   * "Marco de cara": un plano local ortonormal dentro del mundo 3D, definido
   * por un origen y tres ejes unitarios (uDir, vDir a lo largo de la
   * superficie; nDir saliente/normal). Permite colocar relieve (cajas del
   * QR/texto/emoji) sobre CUALQUIER cara —plana o inclinada— con las mismas
   * coordenadas locales (u,v,altura), sin duplicar lógica de transformación
   * por arquetipo. Es la pieza clave que desacopla "dónde está la cara" de
   * "qué se dibuja sobre ella".
   */
  function frameCorner(frame, u, v, h) {
    const [ox, oy, oz] = frame.origin;
    const [ux, uy, uz] = frame.uDir;
    const [vx, vy, vz] = frame.vDir;
    const [nx, ny, nz] = frame.nDir;
    return [
      ox + ux * u + vx * v + nx * h,
      oy + uy * u + vy * v + ny * h,
      oz + uz * u + vz * v + nz * h,
    ];
  }

  /** Añade una caja definida en coordenadas locales (u,v,h) de un marco de cara. */
  function addFrameBox(b, frame, u0, v0, u1, v1, h0, h1) {
    const c = (u, v, h) => frameCorner(frame, u, v, h);
    const p = [
      c(u0, v0, h0), c(u1, v0, h0), c(u1, v1, h0), c(u0, v1, h0),
      c(u0, v0, h1), c(u1, v0, h1), c(u1, v1, h1), c(u0, v1, h1),
    ];
    pushQuad(b, p[0], p[3], p[2], p[1]); // h0 (base, hacia el sólido)
    pushQuad(b, p[4], p[5], p[6], p[7]); // h1 (tope, hacia fuera)
    pushQuad(b, p[0], p[1], p[5], p[4]);
    pushQuad(b, p[2], p[3], p[7], p[6]);
    pushQuad(b, p[1], p[2], p[6], p[5]);
    pushQuad(b, p[3], p[0], p[4], p[7]);
  }

  global.Geom = {
    newBuilder, finalize, pushTri, pushQuad, pushConvexFan,
    addBox, roundedRectPath, extrudeConvexPath, addRoundedPlate,
    addAnnulus, extrudeProfileAlongY, frameCorner, addFrameBox,
  };
})(window);
