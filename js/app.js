/*
 * app.js — Three.js scene bootstrap + interaction glue.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildFigure, buildNodes, buildVessels, buildStrokeArrow, pathCurve } from "./body.js";
import { UI } from "./ui.js";
import { ZONE_BY_ID, NODES } from "./data.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05141a, 0.012);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2.5, 24);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 2.2, 0);
controls.minDistance = 10;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.92;
controls.minPolarAngle = Math.PI * 0.08;

/* ---- lights ---- */
scene.add(new THREE.AmbientLight(0x6fb6c9, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(6, 12, 10);
scene.add(key);
const rim = new THREE.DirectionalLight(0x3fa9ff, 0.8);
rim.position.set(-8, 4, -10);
scene.add(rim);
const fill = new THREE.PointLight(0x36e0c8, 0.6, 60);
fill.position.set(0, 3, 12);
scene.add(fill);

/* ---- content ---- */
const root = new THREE.Group();
scene.add(root);

const figure = buildFigure();
root.add(figure);

const { group: nodeGroup, registry: nodeReg } = buildNodes();
root.add(nodeGroup);

const { group: vesselGroup, registry: vesselReg } = buildVessels();
root.add(vesselGroup);

const strokeArrow = buildStrokeArrow();
root.add(strokeArrow);

// Ground reflection-ish disc
const disc = new THREE.Mesh(
  new THREE.CircleGeometry(9, 48),
  new THREE.MeshBasicMaterial({ color: 0x0a2731, transparent: true, opacity: 0.35 })
);
disc.rotation.x = -Math.PI / 2;
disc.position.y = -8.2;
root.add(disc);

/* ---- highlight state ---- */
let activeZone = null;
let strokeCurve = null;
let strokeT = 0;
let strokeReverse = false;

function nodeIdsForZone(zone) {
  // Expand a zone's node keys to the actual per-side registry ids present.
  const ids = [];
  for (const key of zone.nodeIds) {
    const n = NODES[key];
    if (!n) continue;
    if (n.side === 0) ids.push(key);
    else { ids.push(key + "_R", key + "_L"); }
  }
  return ids;
}
function pathIdsForZone(zone) {
  const ids = [];
  for (const key of zone.pathwayIds) {
    ids.push(key);
    // add mirrored side if a pair exists in registry
    const stem = key.endsWith("_R") ? key.slice(0, -2) : key;
    const lid = stem + "_L";
    if (vesselReg[lid]) ids.push(lid);
    else if (key.endsWith("_R") && vesselReg[key.slice(0, -2) + "_L"]) ids.push(key.slice(0, -2) + "_L");
  }
  return ids;
}

function applyHighlight(zoneId) {
  activeZone = zoneId ? ZONE_BY_ID[zoneId] : null;
  const hiNodes = new Set(activeZone ? nodeIdsForZone(activeZone) : []);
  const hiPaths = new Set(activeZone ? pathIdsForZone(activeZone) : []);
  const accent = activeZone ? new THREE.Color(activeZone.color) : null;

  for (const [id, r] of Object.entries(nodeReg)) {
    const on = !activeZone || hiNodes.has(id);
    const emphasize = activeZone && hiNodes.has(id);
    r.mat.emissiveIntensity = emphasize ? 2.6 : (on ? 1.4 : 0.35);
    r.mat.opacity = on ? 1 : 0.5;
    r.mat.transparent = !on;
    r.halo.material.opacity = emphasize ? 0.95 : (on ? 0.5 : 0.12);
    if (emphasize && accent) { r.mat.emissive.copy(accent); r.halo.material.color.copy(accent); }
    else { r.mat.emissive.setHex(0x2fd6c0); r.halo.material.color.setHex(0x39e6cf); }
    r.userData_emphasize = emphasize;
  }

  for (const [id, r] of Object.entries(vesselReg)) {
    const emphasize = activeZone && hiPaths.has(id);
    const dim = activeZone && !emphasize;
    r.tubeMat.opacity = emphasize ? 0.95 : (dim ? 0.12 : 0.5);
    r.pMat.opacity = emphasize ? 1.0 : (dim ? 0.15 : 0.85);
    r.pMat.size = emphasize ? 0.24 : 0.16;
    if (emphasize && accent) { r.tubeMat.color.copy(accent); r.pMat.color.copy(accent).lerp(new THREE.Color(0xffffff), 0.3); }
    else { r.tubeMat.color.setHex(0x2f8a9c); r.pMat.color.setHex(0x6ff0dd); }
    r._emphasize = emphasize;
    r._speed = emphasize ? 0.35 : 0.12;
  }
}

/* ---- stroke arrow along a step path ---- */
function startStroke(zone, step) {
  strokeArrow.visible = false;
  strokeCurve = null;
  if (!step.strokePath) return;
  // pick a representative curve (prefer the zone-side pathway present)
  let id = step.strokePath;
  if (!vesselReg[id] && vesselReg[id + "_R"]) id = id + "_R";
  const curve = pathCurve(id) || (vesselReg[id] && vesselReg[id].curve);
  if (!curve) return;
  strokeCurve = curve;
  strokeT = 0;
  strokeReverse = false;
  strokeArrow.visible = true;
}
function stopStroke() { strokeArrow.visible = false; strokeCurve = null; }

/* ---- UI wiring ---- */
const ui = new UI({
  onSelectZone: (id) => { applyHighlight(id); if (!id) stopStroke(); },
  onView: (which) => viewTo(which),
  onStep: (zone, step) => startStroke(zone, step),
  onStrokeStop: stopStroke,
});

/* ---- camera moves ---- */
let camTween = null;
function viewTo(which) {
  const presets = {
    front: { pos: [0, 2.5, 24], target: [0, 2.2, 0] },
    back: { pos: [0, 2.5, -24], target: [0, 2.2, 0] },
    reset: { pos: [0, 2.5, 24], target: [0, 2.2, 0] },
    left: { pos: [-24, 2.5, 2], target: [0, 2.2, 0] },
  };
  const p = presets[which] || presets.front;
  camTween = { from: camera.position.clone(), to: new THREE.Vector3(...p.pos),
               tFrom: controls.target.clone(), tTo: new THREE.Vector3(...p.target), t: 0 };
}

/* ---- raycasting for zone picking ---- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

// Build a map from node registry id -> zone id (first zone that lists it)
const nodeToZone = {};
for (const z of Object.values(ZONE_BY_ID)) {
  for (const id of nodeIdsForZone(z)) if (!nodeToZone[id]) nodeToZone[id] = z.id;
}

function pick(ev, click) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = Object.values(nodeReg).map(r => r.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length) {
    const id = hits[0].object.userData.id;
    const zoneId = nodeToZone[id];
    if (click && zoneId) { ui.selectZone(zoneId, true); return; }
    hovered = hits[0].object;
    canvas.style.cursor = "pointer";
    showTooltip(ev, hits[0].object.userData.label);
  } else {
    hovered = null;
    canvas.style.cursor = "grab";
    hideTooltip();
  }
}

canvas.addEventListener("pointermove", e => pick(e, false));
canvas.addEventListener("click", e => pick(e, true));

/* tooltip */
const tip = document.getElementById("tooltip");
function showTooltip(ev, text) {
  tip.textContent = text;
  tip.style.left = ev.clientX + 14 + "px";
  tip.style.top = ev.clientY + 12 + "px";
  tip.classList.add("show");
}
function hideTooltip() { tip.classList.remove("show"); }

/* ---- resize ---- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---- animation loop ---- */
const clock = new THREE.Clock();
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // node pulse
  for (const r of Object.values(nodeReg)) {
    const s = 1 + Math.sin(t * 2.4 + r.mesh.position.y) * (r.userData_emphasize ? 0.14 : 0.06);
    r.mesh.scale.setScalar(s);
  }

  // vessel flow particles
  for (const r of Object.values(vesselReg)) {
    const attr = r.particles.geometry.getAttribute("position");
    const speed = (r._speed || 0.12);
    for (let i = 0; i < r.count; i++) {
      r.offsets[i] = (r.offsets[i] + dt * speed) % 1;
      r.curve.getPointAt(r.offsets[i], _pos);
      attr.setXYZ(i, _pos.x, _pos.y, _pos.z);
    }
    attr.needsUpdate = true;
  }

  // stroke arrow
  if (strokeArrow.visible && strokeCurve) {
    strokeT += dt * 0.22;
    if (strokeT >= 1) { strokeT = 0; } // loop the demonstration stroke
    const tt = Math.min(0.999, strokeT);
    strokeCurve.getPointAt(tt, _pos);
    strokeCurve.getTangentAt(tt, _tan);
    strokeArrow.position.copy(_pos);
    strokeArrow.lookAt(_pos.clone().add(_tan));
    const pulse = 0.8 + Math.sin(t * 6) * 0.2;
    strokeArrow.scale.setScalar(pulse);
  }

  // camera tween
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt * 1.6);
    const e = easeInOut(camTween.t);
    camera.position.lerpVectors(camTween.from, camTween.to, e);
    controls.target.lerpVectors(camTween.tFrom, camTween.tTo, e);
    if (camTween.t >= 1) camTween = null;
  }

  // gentle idle auto-rotate when nothing selected
  if (!activeZone && !camTween) {
    root.rotation.y += dt * 0.05;
  } else {
    root.rotation.y += (0 - root.rotation.y) * Math.min(1, dt * 2);
  }

  controls.update();
  renderer.render(scene, camera);
}
function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

// Hide the loading screen once first frame is ready
requestAnimationFrame(() => {
  document.getElementById("loader")?.classList.add("hidden");
  animate();
});
