/*
 * app.js — Three.js scene bootstrap + interaction glue.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildFigure, buildNodes, buildVessels, buildStrokeArrow, buildPumpRing, buildBreathe } from "./body.js";
import { UI } from "./ui.js";
import { ZONE_BY_ID, NODES } from "./data.js";

/* Respect the user's reduced-motion preference across the animation loop. */
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches;
motionQuery.addEventListener?.("change", e => { reduceMotion = e.matches; });

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

/* ---- demonstration-FX pools (added to root so they rotate with the body) ---- */
const arrowPool = Array.from({ length: 3 }, () => { const a = buildStrokeArrow(); root.add(a); return a; });
const ringPool = Array.from({ length: 4 }, () => { const r = buildPumpRing(); root.add(r); return r; });
const breatheFx = buildBreathe();
root.add(breatheFx);
function hideAllFx() {
  arrowPool.forEach(a => (a.visible = false));
  ringPool.forEach(r => (r.visible = false));
  breatheFx.visible = false;
}

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
    r.mat.opacity = on ? 1 : 0.4; // material is always transparent; vary opacity only
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

/* ---- per-step demonstration visuals ------------------------------------
 * Each step declares a `visual` describing HOW to move; we render the matching
 * indicator so the animation reflects the actual instruction rather than always
 * showing a travelling arrow along the whole region path.                    */
let vfx = { type: "none", arrows: [], rings: [], circle: null };

function nodePositions(nodeKeys) {
  const out = [];
  for (const key of nodeKeys || []) {
    const n = NODES[key];
    if (!n) continue;
    const ids = n.side === 0 ? [key] : [key + "_R", key + "_L"];
    for (const id of ids) if (nodeReg[id]) out.push(nodeReg[id].mesh.position.clone());
  }
  return out;
}

function setStepVisual(step) {
  hideAllFx();
  vfx = { type: "none", arrows: [], rings: [], circle: null };
  const v = step && step.visual;
  if (!v || v.type === "none") return;
  vfx.type = v.type;

  if (v.type === "stroke") {
    const ids = (v.paths || []).filter(id => vesselReg[id]);
    ids.slice(0, arrowPool.length).forEach((id, i) => {
      const arrow = arrowPool[i];
      arrow.visible = true;
      vfx.arrows.push({ arrow, curve: vesselReg[id].curve, range: v.range || [0, 1], t: 0 });
    });
  } else if (v.type === "pump" || v.type === "hold") {
    nodePositions(v.nodes).slice(0, ringPool.length).forEach((pos, i) => {
      const ring = ringPool[i];
      ring.position.copy(pos);
      ring.visible = true;
      vfx.rings.push(ring);
    });
  } else if (v.type === "circle") {
    const arrow = arrowPool[0];
    arrow.visible = true;
    vfx.circle = { arrow, center: new THREE.Vector3(...v.center), radius: v.radius || 0.7, t: 0 };
  } else if (v.type === "breathing") {
    breatheFx.position.set(...v.center);
    breatheFx.visible = true;
  }
}
function clearVisual() { hideAllFx(); vfx = { type: "none", arrows: [], rings: [], circle: null }; }

/* ---- UI wiring ---- */
const ui = new UI({
  onSelectZone: (id) => { applyHighlight(id); if (!id) clearVisual(); },
  onView: (which) => viewTo(which),
  onStep: (zone, step) => setStepVisual(step),
  onStrokeStop: clearVisual,
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
const _look = new THREE.Vector3();

/* Animate whichever demonstration visual the current step declared. Under
 * reduced motion, indicators are shown but held still. */
function updateVisual(dt, t) {
  const move = reduceMotion ? 0 : dt;
  const pulse = reduceMotion ? 1 : 0.85 + Math.sin(t * 6) * 0.15;

  if (vfx.type === "stroke") {
    for (const a of vfx.arrows) {
      a.t = reduceMotion ? 0.5 : (a.t + move * 0.3) % 1;
      const [lo, hi] = a.range;
      const tt = Math.min(0.999, lo + (hi - lo) * a.t);
      a.curve.getPointAt(tt, _pos);
      a.curve.getTangentAt(tt, _tan);
      a.arrow.position.copy(_pos);
      a.arrow.lookAt(_look.copy(_pos).add(_tan));
      a.arrow.scale.setScalar(pulse);
    }
  } else if (vfx.type === "pump") {
    const k = reduceMotion ? 1 : (Math.sin(t * 3) * 0.5 + 0.5); // press–release
    for (const g of vfx.rings) {
      g.scale.setScalar(0.7 + k * 0.6);
      g.userData.ring.material.opacity = 0.45 + k * 0.5;
    }
  } else if (vfx.type === "hold") {
    const s = reduceMotion ? 1 : 0.95 + Math.sin(t * 1.6) * 0.05;
    for (const g of vfx.rings) g.scale.setScalar(s);
  } else if (vfx.type === "circle" && vfx.circle) {
    const c = vfx.circle;
    if (!reduceMotion) c.t = (c.t + move * 0.45) % 1;
    const ang = -c.t * Math.PI * 2; // clockwise as seen from the front
    _pos.set(c.center.x + Math.cos(ang) * c.radius, c.center.y + Math.sin(ang) * c.radius, c.center.z);
    _tan.set(Math.sin(ang), -Math.cos(ang), 0); // clockwise tangent
    c.arrow.position.copy(_pos);
    c.arrow.lookAt(_look.copy(_pos).add(_tan));
    c.arrow.scale.setScalar(pulse);
  } else if (vfx.type === "breathing") {
    const k = reduceMotion ? 0.6 : (Math.sin(t * 1.2) * 0.5 + 0.5);
    breatheFx.scale.setScalar(0.7 + k * 0.9);
    breatheFx.userData.sphere.material.opacity = 0.18 + k * 0.22;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // node pulse (frozen when the user prefers reduced motion)
  for (const r of Object.values(nodeReg)) {
    const s = reduceMotion ? 1 : 1 + Math.sin(t * 2.4 + r.mesh.position.y) * (r.userData_emphasize ? 0.14 : 0.06);
    r.mesh.scale.setScalar(s);
  }

  // vessel flow particles (advance only when motion is allowed)
  for (const r of Object.values(vesselReg)) {
    const attr = r.particles.geometry.getAttribute("position");
    const speed = (r._speed || 0.12);
    for (let i = 0; i < r.count; i++) {
      if (!reduceMotion) r.offsets[i] = (r.offsets[i] + dt * speed) % 1;
      r.curve.getPointAt(r.offsets[i], _pos);
      attr.setXYZ(i, _pos.x, _pos.y, _pos.z);
    }
    attr.needsUpdate = true;
  }

  updateVisual(dt, t);

  // camera tween
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt * 1.6);
    const e = easeInOut(camTween.t);
    camera.position.lerpVectors(camTween.from, camTween.to, e);
    controls.target.lerpVectors(camTween.tFrom, camTween.tTo, e);
    if (camTween.t >= 1) camTween = null;
  }

  // gentle idle auto-rotate when nothing selected (disabled under reduced motion)
  if (!activeZone && !camTween && !reduceMotion) {
    root.rotation.y += dt * 0.05;
  } else if (activeZone || camTween) {
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
