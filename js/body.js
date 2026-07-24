/*
 * body.js — builds the 3D scene content:
 *   - a translucent, stylised human figure (front/back readable)
 *   - glowing lymph-node cluster spheres (mirrored to both sides)
 *   - lymphatic vessel tubes with animated flow particles (drainage direction)
 *   - a stroke-arrow indicator that rides a pathway during guided steps
 *
 * Everything is grouped so app.js can highlight / dim per selected zone.
 */
import * as THREE from "three";
import { NODES, PATHWAYS, ZONES } from "./data.js";

/* ---- helpers ---------------------------------------------------------- */

function capsuleBetween(a, b, r, material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(r, len, 8, 16);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function mirror(points) {
  return points.map(([x, y, z]) => [-x, y, z]);
}

/* ---- skin figure ------------------------------------------------------ */

export function buildFigure() {
  const group = new THREE.Group();
  group.name = "figure";

  const skin = new THREE.MeshStandardMaterial({
    color: 0x9fb8c8,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const parts = [];
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 32), skin);
  head.position.set(0, 6.7, 0);
  head.scale.set(0.9, 1.05, 0.95);
  parts.push(head);
  // Neck
  parts.push(capsuleBetween([0, 5.9, 0], [0, 5.0, 0], 0.42, skin));
  // Torso — chest + abdomen as two tapered capsules + a rounding sphere
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), skin);
  chest.position.set(0, 3.9, 0);
  chest.scale.set(1.9, 1.35, 1.0);
  parts.push(chest);
  const abd = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), skin);
  abd.position.set(0, 2.1, 0);
  abd.scale.set(1.55, 1.4, 0.95);
  parts.push(abd);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), skin);
  pelvis.position.set(0, 0.4, 0);
  pelvis.scale.set(1.7, 1.15, 0.95);
  parts.push(pelvis);
  // Shoulders
  parts.push(capsuleBetween([-1.85, 4.9, 0], [1.85, 4.9, 0], 0.45, skin));

  // Arms (both sides)
  for (const s of [1, -1]) {
    parts.push(capsuleBetween([s * 1.9, 4.85, 0], [s * 2.45, 2.1, 0.1], 0.34, skin)); // upper arm
    parts.push(capsuleBetween([s * 2.45, 2.05, 0.1], [s * 2.55, -1.1, 0.35], 0.29, skin)); // forearm
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), skin);
    hand.position.set(s * 2.57, -1.5, 0.4);
    hand.scale.set(0.8, 1.25, 0.5);
    parts.push(hand);
  }

  // Legs (both sides)
  for (const s of [1, -1]) {
    parts.push(capsuleBetween([s * 0.85, 0.0, 0], [s * 1.0, -4.0, 0.1], 0.52, skin)); // thigh
    parts.push(capsuleBetween([s * 1.0, -4.1, 0.1], [s * 1.02, -7.6, 0.15], 0.38, skin)); // calf
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 1.3), skin);
    foot.position.set(s * 1.02, -7.85, 0.45);
    parts.push(foot);
  }

  parts.forEach(p => group.add(p));

  // A subtle inner "core" glow shape so the figure reads with depth
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x0e2a33, transparent: true, opacity: 0.25, depthWrite: false });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 5.2, 16), coreMat);
  core.position.set(0, 2.6, 0);
  group.add(core);

  return group;
}

/* ---- node clusters ---------------------------------------------------- */

export function buildNodes() {
  const group = new THREE.Group();
  group.name = "nodes";
  const registry = {}; // id (+side) -> { mesh, halo, baseColor, nodeKey }

  for (const [key, n] of Object.entries(NODES)) {
    const sides = n.side === 0 ? [[key, n.pos]] : [[key + "_R", n.pos], [key + "_L", [-n.pos[0], n.pos[1], n.pos[2]]]];
    for (const [id, pos] of sides) {
      const color = new THREE.Color(0x8ff0e0);
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: 0x2fd6c0,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.0,
        transparent: true, // kept true so runtime opacity dimming always renders
        opacity: 1
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(n.size, 24, 24), mat);
      mesh.position.set(...pos);
      mesh.userData = { nodeKey: key, id, label: n.label, major: !!n.major };

      // Soft halo sprite
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTexture(),
        color: 0x39e6cf,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      const hs = n.size * (n.major ? 9 : 6.5);
      halo.scale.set(hs, hs, 1);
      mesh.add(halo);

      group.add(mesh);
      registry[id] = { mesh, halo, mat, nodeKey: key, base: n };
    }
  }
  return { group, registry };
}

let _halo;
function haloTexture() {
  if (_halo) return _halo;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.25, "rgba(120,255,235,0.65)");
  g.addColorStop(1, "rgba(120,255,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(c);
  return _halo;
}

/* ---- vessels + flow particles ---------------------------------------- */

export function buildVessels() {
  const group = new THREE.Group();
  group.name = "vessels";
  const registry = {}; // pathwayId (+side) -> { tube, curve, particles, points }

  for (const [key, p] of Object.entries(PATHWAYS)) {
    const sides = p.side === 0 ? [[key, p.points]] : [[key, p.points], [sideFlip(key), mirror(p.points)]];
    for (const [id, pts] of sides) {
      const curve = new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)));
      const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.045, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x2f8a9c,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);

      // Flow particles
      const COUNT = 22;
      const pGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(COUNT * 3);
      pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0x6ff0dd,
        size: 0.16,
        map: haloTexture(),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const particles = new THREE.Points(pGeo, pMat);
      const offsets = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) offsets[i] = i / COUNT;

      group.add(tube);
      group.add(particles);
      registry[id] = { tube, tubeMat, curve, particles, pMat, offsets, count: COUNT };
    }
  }
  return { group, registry };
}

function sideFlip(id) {
  if (id.endsWith("_R")) return id.slice(0, -2) + "_L";
  return id + "_L";
}

/* ---- stroke arrow (rides a curve during a step) ---------------------- */

export function buildStrokeArrow() {
  const group = new THREE.Group();
  group.visible = false;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 16), mat);
  cone.rotation.x = Math.PI / 2;
  group.add(cone);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture(), color: 0xffd166, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  halo.scale.set(1.8, 1.8, 1);
  group.add(halo);
  return group;
}

/* Resolve a THREE curve for a pathway id, mirroring X for an "_L" variant
 * whose base pathway is stored as "_R" (or side-0). Used by the stroke arrow. */
export function pathCurve(id) {
  let key = id, flip = false;
  if (!PATHWAYS[id] && id.endsWith("_L")) {
    const stem = id.slice(0, -2);
    if (PATHWAYS[stem + "_R"]) { key = stem + "_R"; flip = true; }
    else if (PATHWAYS[stem]) { key = stem; flip = true; }
  }
  const p = PATHWAYS[key];
  if (!p) return null;
  const pts = flip ? mirror(p.points) : p.points;
  return new THREE.CatmullRomCurve3(pts.map(v => new THREE.Vector3(...v)));
}
