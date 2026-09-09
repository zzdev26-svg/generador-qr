/**
 * preview3d.js — Puente entre la geometría neutra (mesh-builder.js) y
 * three.js, solo para la vista previa interactiva (girar con el ratón). Es
 * el ÚNICO archivo que depende de three.js; los exportadores STL/3MF no lo
 * tocan, así que lo que se descarga es siempre exactamente lo que generó
 * geom.js, no una reinterpretación del motor de render.
 */
import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

let scene, camera, renderer, controls, canvasEl;
let meshBase, meshRelief;
let resizeObserver;
let available = false;

/**
 * Puede fallar (WebGL no disponible, contexto perdido, navegador restringido).
 * Esto NUNCA debe tumbar el resto de la app: la herramienta 2D es la
 * funcionalidad principal y tiene que seguir funcionando igual. Por eso
 * init() atrapa cualquier error y deja `available=false`; el resto de
 * funciones se convierten en no-ops seguros.
 */
function init(canvas) {
  try {
    initInternal(canvas);
    available = true;
  } catch (err) {
    console.warn('Vista previa 3D no disponible en este navegador:', err);
    available = false;
    showFallback(canvas);
  }
}

function showFallback(canvas) {
  const ctx = canvas.getContext && canvas.getContext('2d');
  canvas.width = canvas.clientWidth || 300;
  canvas.height = canvas.clientHeight || 300;
  if (!ctx) return;
  ctx.fillStyle = '#1a1f2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#98a1b5';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Vista previa 3D no disponible', canvas.width / 2, canvas.height / 2 - 8);
  ctx.fillText('en este navegador (la descarga sí funciona)', canvas.width / 2, canvas.height / 2 + 12);
}

function initInternal(canvas) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight || 1, 0.1, 2000);
  camera.position.set(0, -120, 90);
  camera.up.set(0, 0, 1);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  resize();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(60, -80, 120);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
  dir2.position.set(-60, 80, -40);
  scene.add(dir2);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  const geoBase = new THREE.BufferGeometry();
  const geoRelief = new THREE.BufferGeometry();
  const matBase = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
  const matRelief = new THREE.MeshStandardMaterial({ color: 0x1a6fd6, roughness: 0.45, metalness: 0.05 });
  meshBase = new THREE.Mesh(geoBase, matBase);
  meshRelief = new THREE.Mesh(geoRelief, matRelief);
  scene.add(meshBase, meshRelief);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement || canvas);
  }
  animate();
}

function resize() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth || 300;
  const h = canvasEl.clientHeight || 300;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function setMesh(mesh, data) {
  const geo = mesh.geometry;
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geo.computeBoundingSphere();
}

/** @param {{parts: Array<{color:string, mesh:Object}>, dims:Object}} result de MeshBuilder.build */
function update(result, colorBase, colorRelief) {
  if (!available) return;
  const base = result.parts.find((p) => p.color === 'base');
  const relief = result.parts.find((p) => p.color === 'relief');
  setMesh(meshBase, base.mesh);
  setMesh(meshRelief, relief.mesh);
  meshBase.material.color.set(colorBase);
  meshRelief.material.color.set(colorRelief);

  const d = result.dims;
  const maxDim = Math.max(d.width, d.height, d.depth * 3, 20);
  const dist = maxDim * 1.9;
  camera.position.set(dist * 0.15, -dist * 0.85, dist * 0.55);
  camera.near = maxDim * 0.02;
  camera.far = maxDim * 20;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, d.height ? d.height * 0.25 : 0);
  controls.update();
}

function setColors(colorBase, colorRelief) {
  if (!available || !meshBase) return;
  meshBase.material.color.set(colorBase);
  meshRelief.material.color.set(colorRelief);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.Preview3D = { init, update, setColors, resize };
