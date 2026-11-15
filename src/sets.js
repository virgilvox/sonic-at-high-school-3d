// Procedural sets. A set is one table entry: a room or an outdoor lot, its colours, a prop list and named spots.
// buildSet() turns it into a scene group, a world-space statics group for the director's sightlines, and spots
// the stage uses for placing actors (center, door, bed, seats).
import * as THREE from 'three';
import { toon, part, geo } from './toon.js';
import { KIT } from './kit-assets.js';

// ---------------------------------------------------------------- kit models (Kenney, CC0)
const kitScenes = new Map();
// Parse every embedded kit model once at boot. bank: { 'pack__name': base64 glb }.
export async function loadKit(bank, loader) {
  for (const [file, b64] of Object.entries(bank || {})) {
    const raw = atob(b64), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const gltf = await loader.parseAsync(bytes.buffer, '');
    gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    kitScenes.set(file.replace('__', '/'), gltf.scene);
  }
}
const hash = (x, z) => Math.abs(Math.round(x * 7.31 + z * 13.7)) ;
// Fit one kit piece into g: scaled to its real size, centred on x/z, sitting on y (a number or the top of the last piece).
function kitPiece(g, spec, o, x, z, prevTop = 0) {
  const files = [spec.file, ...(spec.variants || [])].filter((f) => kitScenes.has(f));
  if (!files.length) return null;
  const obj = kitScenes.get(files[hash(x, z) % files.length]).clone(true);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  let sc;
  if (spec.size) {
    const want = spec.size.map((v) => (v === 'w' ? o.w || 1 : v === 'd' ? o.d || 1 : v));
    sc = new THREE.Vector3(want[0] / size.x, want[1] / size.y, want[2] / size.z);
  } else {
    const [k, v] = Object.entries(spec.fit)[0], dim = { w: size.x, h: size.y, d: size.z }[k];
    sc = new THREE.Vector3().setScalar(v / dim);
  }
  obj.scale.copy(sc);
  const y = spec.y === 'top' ? prevTop : spec.y || 0;
  obj.position.set(-(box.min.x + size.x / 2) * sc.x, y - box.min.y * sc.y, -(box.min.z + size.z / 2) * sc.z + (spec.z || 0));
  g.add(obj);
  return y + size.y * sc.y;
}
function kitProp(g, type, o, x, z) {
  const spec = KIT[type];
  if (!spec) return false;
  if (spec.parts) { let top = 0; for (const p of spec.parts) top = kitPiece(g, p, o, x, z, top) ?? top; return g.children.length > 0; }
  if (spec.repeat && o.w) {   // a run of units filling the width
    const unit = new THREE.Group(); kitPiece(unit, spec, o, x, z);
    const w = new THREE.Box3().setFromObject(unit).getSize(new THREE.Vector3()).x || 0.8, n = Math.max(1, Math.round(o.w / w));
    for (let i = 0; i < n; i++) { const u = unit.clone(true); u.position.x = (i - (n - 1) / 2) * w; g.add(u); }
    return true;
  }
  return kitPiece(g, spec, o, x, z) != null;
}

const BOX = (w, h, d) => geo('box', w, h, d);

// ---------------------------------------------------------------- props
// Each prop builds into g at the origin facing +z; the set places and turns it.
const PROPS = {
  lockers(g, o) {
    const n = o.n || 6, col = o.color || '#3d6fb6';
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.46;
      part(BOX(0.44, 1.9, 0.45), col, g, { pos: [x, 0.95, 0] });
      part(BOX(0.06, 0.12, 0.02), '#d8dde6', g, { pos: [x + 0.12, 1.1, 0.23], outline: false });
      for (let s = 0; s < 3; s++) part(BOX(0.3, 0.02, 0.01), '#26497c', g, { pos: [x, 1.7 - s * 0.05, 0.226], outline: false });
    }
  },
  desk(g, o) {
    part(BOX(1.0, 0.05, 0.6), o.color || '#c89a62', g, { pos: [0, 0.74, 0] });
    for (const [x, z] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) part(geo('cyl', 0.025, 0.025, 0.74, 6), '#6b6f78', g, { pos: [x, 0.37, z], outline: false });
  },
  chair(g, o) {
    part(BOX(0.42, 0.05, 0.42), o.color || '#2f5f9e', g, { pos: [0, 0.46, 0] });
    part(BOX(0.42, 0.45, 0.05), o.color || '#2f5f9e', g, { pos: [0, 0.7, -0.2] });
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) part(geo('cyl', 0.02, 0.02, 0.46, 6), '#6b6f78', g, { pos: [x, 0.23, z], outline: false });
  },
  bed(g, o) {
    part(BOX(1.1, 0.35, 2.0), '#7a5236', g, { pos: [0, 0.2, 0] });
    part(BOX(1.04, 0.18, 1.94), o.sheet || '#f1f3f7', g, { pos: [0, 0.45, 0] });
    part(BOX(1.06, 0.1, 1.3), o.color || '#3b7ad1', g, { pos: [0, 0.56, 0.3] });
    part(BOX(0.6, 0.12, 0.35), '#ffffff', g, { pos: [0, 0.6, -0.72] });
    part(BOX(1.1, 0.9, 0.08), '#7a5236', g, { pos: [0, 0.45, -1.0] });
  },
  door(g, o) {   // a frame and a panel on a hinge; sets swing it open when someone comes near (updateDoors)
    for (const x of [-0.56, 0.56]) part(BOX(0.08, 2.2, 0.12), '#e9e1d2', g, { pos: [x, 1.1, 0] });
    part(BOX(1.2, 0.08, 0.12), '#e9e1d2', g, { pos: [0, 2.2, 0] });
    part(BOX(1.0, 2.12, 0.06), '#1a1414', g, { pos: [0, 1.06, -0.05], outline: false });   // the dark opening behind
    const hinge = new THREE.Group(); hinge.position.set(-0.5, 0, 0); g.add(hinge);
    part(BOX(1.0, 2.12, 0.05), o.color || '#8a5a34', hinge, { pos: [0.5, 1.06, 0.01] });
    part(geo('sphere', 0.045, 10, 8), '#e2c35a', hinge, { pos: [0.88, 1.0, 0.06] });
    g.userData.hinge = hinge;
  },
  window(g, o) {
    part(BOX(o.w || 1.6, o.h || 1.2, 0.04), o.night ? '#1d2a55' : '#9fd3ff', g, { pos: [0, 0, 0], outline: false });
    part(BOX((o.w || 1.6) + 0.12, 0.08, 0.1), '#f4f4f4', g, { pos: [0, -(o.h || 1.2) / 2, 0.04] });
    part(BOX(0.06, o.h || 1.2, 0.08), '#f4f4f4', g, { pos: [0, 0, 0.03] });
  },
  board(g, o) {
    part(BOX(3.2, 1.2, 0.05), o.color || '#2e5a46', g, { pos: [0, 1.55, 0] });
    part(BOX(3.3, 0.06, 0.12), '#b9b2a4', g, { pos: [0, 0.92, 0.04] });
  },
  table(g, o) {
    part(BOX(o.w || 2.2, 0.06, o.d || 0.9), o.color || '#d6d9de', g, { pos: [0, 0.74, 0] });
    part(BOX(0.08, 0.74, (o.d || 0.9) * 0.7), '#5a5f68', g, { pos: [-(o.w || 2.2) / 2 + 0.2, 0.37, 0], outline: false });
    part(BOX(0.08, 0.74, (o.d || 0.9) * 0.7), '#5a5f68', g, { pos: [(o.w || 2.2) / 2 - 0.2, 0.37, 0], outline: false });
  },
  bench(g, o) {
    part(BOX(o.w || 2.0, 0.06, 0.4), o.color || '#9b6b3c', g, { pos: [0, 0.45, 0] });
    part(BOX(0.06, 0.45, 0.35), '#4a4d55', g, { pos: [-(o.w || 2) / 2 + 0.15, 0.22, 0], outline: false });
    part(BOX(0.06, 0.45, 0.35), '#4a4d55', g, { pos: [(o.w || 2) / 2 - 0.15, 0.22, 0], outline: false });
  },
  sink(g) {
    part(BOX(0.7, 0.85, 0.5), '#f0f0f0', g, { pos: [0, 0.425, 0] });
    part(geo('cyl', 0.03, 0.03, 0.25, 8), '#b9c0c9', g, { pos: [0, 1.0, -0.15] });
    part(BOX(0.6, 0.8, 0.03), '#bfe6ff', g, { pos: [0, 1.6, -0.24] });
  },
  counter(g, o) {
    part(BOX(o.w || 2.4, 0.9, 0.62), o.color || '#e8e2d6', g, { pos: [0, 0.45, 0] });
    part(BOX((o.w || 2.4) + 0.04, 0.05, 0.66), '#5b5f66', g, { pos: [0, 0.92, 0] });
  },
  fridge(g) { part(BOX(0.75, 1.8, 0.7), '#f2f4f7', g, { pos: [0, 0.9, 0] }); part(BOX(0.04, 0.4, 0.04), '#9aa1aa', g, { pos: [0.3, 1.2, 0.37] }); },
  couch(g, o) {
    const c = o.color || '#9b3f4a';
    part(BOX(2.0, 0.42, 0.85), c, g, { pos: [0, 0.3, 0] });
    part(BOX(2.0, 0.55, 0.2), c, g, { pos: [0, 0.75, -0.33] });
    part(BOX(0.2, 0.3, 0.85), c, g, { pos: [-0.95, 0.62, 0] });
    part(BOX(0.2, 0.3, 0.85), c, g, { pos: [0.95, 0.62, 0] });
  },
  tv(g) { part(BOX(1.3, 0.75, 0.06), '#16181d', g, { pos: [0, 1.25, 0] }); part(BOX(1.4, 0.5, 0.4), '#5c4130', g, { pos: [0, 0.25, 0] }); },
  shelf(g, o) {
    part(BOX(1.0, 1.9, 0.35), o.color || '#8a5a34', g, { pos: [0, 0.95, 0] });
    const cols = ['#c0392b', '#2e86de', '#f1c40f', '#27ae60', '#8e44ad'];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) part(BOX(0.1, 0.28, 0.24), cols[(r * 3 + i) % 5], g, { pos: [-0.35 + i * 0.14, 0.3 + r * 0.45, 0.04], outline: false });
  },
  mirror(g) { part(BOX(0.7, 1.0, 0.03), '#d6f0ff', g, { pos: [0, 1.5, 0] }); },
  stall(g) {
    part(BOX(0.04, 1.8, 1.4), '#7fa7c9', g, { pos: [-0.5, 1.0, 0] });
    part(BOX(0.04, 1.8, 1.4), '#7fa7c9', g, { pos: [0.5, 1.0, 0] });
    part(BOX(0.96, 1.8, 0.04), '#7fa7c9', g, { pos: [0, 1.0, 0.7] });
  },
  tree(g, o) {
    part(geo('cyl', 0.14, 0.2, 2.2, 8), '#6b4a2b', g, { pos: [0, 1.1, 0] });
    part(geo('sphere', 1.1, 14, 10), o.color || '#3f9b4b', g, { pos: [0, 2.8, 0] });
    part(geo('sphere', 0.8, 14, 10), o.color || '#4fb35a', g, { pos: [0.6, 2.4, 0.3] });
  },
  bush(g) { part(geo('sphere', 0.55, 12, 8), '#3c8f45', g, { pos: [0, 0.4, 0], scale: [1.4, 0.8, 1] }); },
  lamp(g) { part(geo('cyl', 0.05, 0.07, 3.6, 8), '#3a3f47', g, { pos: [0, 1.8, 0] }); part(geo('sphere', 0.18, 10, 8), toon('#fff3b0', { emissive: '#ffe08a' }), g, { pos: [0, 3.65, 0] }); },
  car(g, o) {
    part(BOX(1.8, 0.6, 4.0), o.color || '#c0392b', g, { pos: [0, 0.6, 0] });
    part(BOX(1.6, 0.5, 2.0), o.color || '#c0392b', g, { pos: [0, 1.15, -0.2] });
    part(BOX(1.62, 0.36, 1.9), '#bfe6ff', g, { pos: [0, 1.15, -0.2], outline: false });
    for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) part(geo('cyl', 0.34, 0.34, 0.25, 14), '#1c1d21', g, { pos: [x, 0.34, z], rot: [0, 0, Math.PI / 2] });
  },
  facade(g, o) {
    const w = o.w || 16, h = o.h || 7;
    part(BOX(w, h, 0.5), o.color || '#c96f4a', g, { pos: [0, h / 2, 0] });
    for (let i = 0; i < Math.floor(w / 2.2); i++) for (let r = 0; r < 2; r++) {
      part(BOX(1.3, 1.0, 0.06), '#9fd3ff', g, { pos: [-w / 2 + 1.4 + i * 2.2, 2.2 + r * 2.4, 0.27], outline: false });
    }
    part(BOX(2.4, 2.4, 0.08), '#2f3640', g, { pos: [0, 1.2, 0.27] });
  },
  banner(g, o) {
    part(BOX(o.w || 6, 1.0, 0.04), o.color || '#f5f0e1', g, { pos: [0, 0, 0] });
    if (o.text) g.add(textPlane(o.text, o.w || 6, 1.0, o.ink || '#c0392b', 0.03));
  },
  bleachers(g, o) {
    for (let r = 0; r < 4; r++) part(BOX(o.w || 8, 0.12, 0.6), '#c9ccd2', g, { pos: [0, 0.4 + r * 0.45, -r * 0.6] });
  },
  hoop(g) {
    part(geo('cyl', 0.06, 0.06, 3.0, 8), '#7d8590', g, { pos: [0, 1.5, -0.3] });
    part(BOX(1.4, 0.9, 0.05), '#f4f6f8', g, { pos: [0, 3.1, 0] });
    part(geo('torus', 0.23, 0.02), '#e8692b', g, { pos: [0, 2.95, 0.3], rot: [Math.PI / 2, 0, 0] });
  },
  stage(g, o) {
    part(BOX(o.w || 8, 0.8, o.d || 4), '#7a4b2a', g, { pos: [0, 0.4, 0] });
    part(BOX((o.w || 8) + 1, 4.5, 0.2), '#7c1d2a', g, { pos: [0, 2.25, -(o.d || 4) / 2] });
  },
  curtain(g, o) {   // hospital privacy curtain on a rail
    part(geo('cyl', 0.02, 0.02, o.w || 2.2, 6), '#b9c0c9', g, { pos: [0, 2.1, 0], rot: [0, 0, Math.PI / 2], outline: false });
    for (let i = 0; i < 9; i++) part(BOX((o.w || 2.2) / 9, 1.7, 0.03), i % 2 ? '#bfe3dc' : '#a9d6cc', g, { pos: [-(o.w || 2.2) / 2 + (i + 0.5) * (o.w || 2.2) / 9, 1.2, i % 2 ? 0.04 : 0], outline: false });
  },
  railing(g, o) {
    const w = o.w || 4;
    part(BOX(w, 0.06, 0.08), '#f4f4f4', g, { pos: [0, 1.0, 0] });
    for (let i = 0; i <= w / 0.25; i++) part(BOX(0.03, 1.0, 0.03), '#f4f4f4', g, { pos: [-w / 2 + i * 0.25, 0.5, 0], outline: false });
  },
  booth(g, o) {   // diner booth: two padded benches either side of a table
    const c = o.color || '#c0392b';
    for (const z of [-0.75, 0.75]) { part(BOX(1.6, 0.45, 0.5), c, g, { pos: [0, 0.23, z] }); part(BOX(1.6, 0.6, 0.15), c, g, { pos: [0, 0.75, z + Math.sign(z) * 0.25] }); }
    part(BOX(1.4, 0.06, 0.8), '#e8e2d6', g, { pos: [0, 0.76, 0] });
    part(geo('cyl', 0.05, 0.05, 0.74, 8), '#9aa1aa', g, { pos: [0, 0.37, 0], outline: false });
  },
  stringlights(g, o) {
    const w = o.w || 12, cols = ['#ff5fa2', '#ffd166', '#5fd3ff', '#9b8cff', '#7bffb0'];
    for (let i = 0; i < w / 0.5; i++) part(geo('sphere', 0.05, 8, 6), toon(cols[i % 5], { emissive: cols[i % 5] }), g, { pos: [-w / 2 + i * 0.5, -Math.sin((i / (w / 0.5)) * Math.PI) * 0.5, 0], outline: false, shadow: false });
  },
  discoball(g) { part(geo('sphere', 0.35, 12, 8), toon('#dfe6ee', { emissive: '#5a6070' }), g, { pos: [0, 0, 0] }); part(geo('cyl', 0.01, 0.01, 1.2, 4), '#888', g, { pos: [0, 0.75, 0], outline: false }); },
  // film crew props for the behind-the-scenes photos
  camrig(g) {
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; part(geo('cyl', 0.02, 0.02, 1.5, 6), '#222', g, { pos: [Math.sin(a) * 0.3, 0.7, Math.cos(a) * 0.3], rot: [Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38] }); }
    part(BOX(0.35, 0.3, 0.5), '#1c1d21', g, { pos: [0, 1.55, 0] });
    part(geo('cyl', 0.09, 0.11, 0.3, 14), '#30333a', g, { pos: [0, 1.58, 0.38], rot: [Math.PI / 2, 0, 0] });
    part(BOX(0.18, 0.12, 0.02), '#7fd3ff', g, { pos: [0.2, 1.62, -0.2], rot: [0, 0.6, 0], outline: false });
  },
  lightstand(g) {
    part(geo('cyl', 0.02, 0.02, 2.2, 6), '#333', g, { pos: [0, 1.1, 0] });
    part(BOX(0.7, 0.55, 0.12), toon('#fffbe8', { emissive: '#fff4c8' }), g, { pos: [0, 2.25, 0.1], rot: [-0.3, 0, 0] });
  },
  boom(g) {
    part(geo('cyl', 0.02, 0.02, 1.8, 6), '#444', g, { pos: [0, 0.9, 0] });
    part(geo('cyl', 0.015, 0.015, 2.4, 6), '#666', g, { pos: [0, 1.8, 1.0], rot: [Math.PI / 2 - 0.25, 0, 0] });
    part(geo('capsule', 0.06, 0.28), '#2b2b2b', g, { pos: [0, 2.05, 2.15], rot: [Math.PI / 2, 0, 0] });
  },
  dchair(g) {
    part(BOX(0.6, 0.05, 0.5), '#5a3b24', g, { pos: [0, 0.6, 0] });
    part(BOX(0.62, 0.32, 0.03), '#1d1d1d', g, { pos: [0, 0.95, -0.24] });
    g.add(textPlane('DIRECTOR', 0.6, 0.18, '#ffffff', 0));
    g.children[g.children.length - 1].position.set(0, 0.95, -0.22);
    for (const x of [-0.27, 0.27]) for (const z of [-0.22, 0.22]) part(geo('cyl', 0.02, 0.02, 0.62, 6), '#5a3b24', g, { pos: [x, 0.31, z], outline: false });
  },
  clapper(g) {
    part(BOX(0.35, 0.26, 0.02), '#151515', g, { pos: [0, 0.13, 0] });
    for (let i = 0; i < 5; i++) part(BOX(0.07, 0.05, 0.025), i % 2 ? '#151515' : '#f4f4f4', g, { pos: [-0.14 + i * 0.07, 0.29, 0], outline: false });
  },
  pic(g, o) {
    part(BOX(0.5, 0.4, 0.04), '#c8a24a', g, { pos: [0, 0, 0] });
    part(BOX(0.42, 0.32, 0.01), o.color || '#f2a7c3', g, { pos: [0, 0, 0.025], outline: false });
  },
  poster(g, o) { part(BOX(0.6, 0.85, 0.01), o.color || '#e74c3c', g, { pos: [0, 0, 0], outline: false }); },
};

function textPlane(text, w, h, ink, z = 0) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = Math.round(1024 * h / w);
  const x = c.getContext('2d');
  x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 ${Math.round(c.height * 0.55)}px Impact, "Arial Black", sans-serif`;
  x.fillText(text, c.width / 2, c.height / 2, c.width * 0.94);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.z = z;
  return m;
}

// ---------------------------------------------------------------- sets
// size [w, d] in metres, room walls on four sides unless outdoor. Props: [type, x, z, yawDeg, opts].
// Spots: named [x, z, yawDeg] (plus y for beds and seats). door: where entrances and exits happen.
export const SETS = {
  hallway: { size: [16, 7.5], h: 3.4, wall: '#e9e3d3', floor: '#c7b9a0', trim: '#3d6fb6', door: [0.3, -3.0, 0],
    props: [['lockers', -3.4, -3.5, 0, { n: 8 }], ['lockers', 3.8, -3.5, 0, { n: 8 }], ['door', 0.3, -3.7, 0], ['lockers', 0, 3.5, 180, { n: 10 }], ['poster', -0.2, -3.67, 0, { y: 1.5, color: '#f39c12' }]] },
  classroom: { size: [9, 8], h: 3.2, wall: '#f0ead8', floor: '#b48a5a', trim: '#2e5a46', door: [4.2, 3.3, -90],
    props: [['board', 0, -3.95, 0], ['desk', 0, -2.6, 0, { color: '#8a5a34' }],
      ...[-2.4, 0, 2.4].flatMap((x) => [0.2, 1.8].flatMap((z) => [['desk', x, z, 0], ['chair', x, z + 0.55, 180]]))],
    spots: { teacher: [0, -3.1, 0], seat1: [-2.4, 0.75, 180, 0], seat2: [0, 0.75, 180, 0] },
    seats: [-2.4, 0, 2.4].flatMap((x) => [0.75, 2.35].map((z) => [x, z, 180])), front: [0, -3.0, 0] },
  bedroom: { size: [7, 6.5], h: 2.9, wall: '#a9c8ee', floor: '#9c7a57', trim: '#ffffff', door: [2.8, 1.6, -90],
    props: [['bed', -1.8, -1.6, 0], ['desk', 1.6, -2.3, 0], ['chair', 1.6, -1.75, 180], ['window', 0, -2.7, 0, { y: 1.6 }], ['shelf', 2.5, -0.6, -90], ['rug', 0, 0.3, 0, { w: 2.2, d: 1.4 }], ['floorlamp', -3.0, 0.6, 0], ['pic', 1.3, -2.68, 0, { y: 1.4 }], ['door', 2.95, 1.6, -90]],
    spots: { bed: [-1.8, -1.9, 0, 0.62], center: [0, 0.2, 0] } },
  bathroom: { size: [6, 6], h: 2.9, wall: '#dff1f4', floor: '#ffffff', trim: '#7fa7c9', door: [2.8, 1.2, -90],
    props: [['sink', -0.6, -2.7, 0], ['sink', 0.6, -2.7, 0], ['stall', -2.3, 1.2, 90], ['toilet', -2.3, 1.2, 90], ['trash', 2.4, -2.6, 0]], spots: { mirror: [0, -1.75, 180] } },
  kitchen: { size: [7, 6], h: 2.8, wall: '#f6e7c8', floor: '#d7d2c8', trim: '#c0392b', door: [3.3, 1.5, -90],
    props: [['counter', -1.4, -2.65, 0, { w: 2.6 }], ['stove', 0.3, -2.65, 0], ['fridge', 1.8, -2.6, 0], ['table', 0, 0.4, 0, { w: 1.6, d: 1.0, color: '#b07b4c' }], ['chair', -0.5, 1.1, 180], ['chair', 0.5, -0.3, 0], ['couch', -2.2, 2.2, 180], ['tv', -2.2, 0.4, 0]] },
  livingroom: { size: [7, 6], h: 2.8, wall: '#efe0c2', floor: '#8c6a4c', trim: '#ffffff', door: [3.3, 1.5, -90],
    props: [['couch', 0, 1.6, 180], ['tv', 0, -2.6, 0], ['shelf', -3.2, -1, 90], ['rug', 0, 0, 0, { w: 2.6, d: 1.6 }], ['plant', 3.0, -2.6, 0], ['window', 2, -2.95, 0, { y: 1.6 }], ['door', 3.45, 1.5, -90]],
    spots: { couch: [0, 1.5, 180, 0.42] } },
  cafeteria: { size: [14, 10], h: 3.4, wall: '#f3e9d2', floor: '#cfcac0', trim: '#e67e22', door: [-3, 4.3, 180],
    props: [['counter', 0, -4.6, 0, { w: 6 }], ...[-4, 0, 4].flatMap((x) => [-1.4, 1.8].flatMap((z) => [['table', x, z, 0, { w: 2.4, d: 0.9 }], ['bench', x, z - 0.85, 0, { w: 2.2 }], ['bench', x, z + 0.85, 0, { w: 2.2 }]]))],
    seats: [[0, 1.8], [-4, 1.8], [4, 1.8], [0, -1.4]].flatMap(([x, z]) => [-0.6, 0.6].flatMap((dx) => [[x + dx, z - 0.88, 0], [x + dx, z + 0.88, 180]])) },
  gym: { size: [18, 12], h: 6, wall: '#e9d8b8', floor: '#d9a35f', trim: '#2e86de', door: [-6, -5.3, 0],
    props: [['hoop', 0, -5.6, 0], ['bleachers', 0, 5.4, 180, { w: 12 }], ['banner', 0, -5.9, 0, { y: 4.4, w: 6, text: 'GO MOBIUS!' }]] },
  office: { size: [6, 5], h: 2.9, wall: '#d6dbe2', floor: '#6b4f3a', trim: '#2c3e50', door: [2.8, 1.5, -90],
    props: [['desk', 0, -1.2, 0, { color: '#5b3a24' }], ['chair', 0, -1.8, 0, { color: '#1c1d21' }], ['shelf', -2.4, -2.2, 0], ['shelf', -1.3, -2.2, 0], ['window', 1.6, -2.45, 0, { y: 1.6 }], ['door', 2.95, 1.5, -90], ['plant', -2.6, 2.0, 0], ['rug', 0, -0.6, 0, { w: 2.4, d: 1.6 }]],
    spots: { boss: [0, -1.9, 0] } },
  stage: { size: [14, 12], h: 6, wall: '#2a1e2a', floor: '#6b3f2a', trim: '#7c1d2a', door: [-6.8, 3, 90],
    props: [['stage', 0, -3.8, 0, { w: 10, d: 4 }], ...[-3, -1, 1, 3].flatMap((x) => [1.5, 2.8, 4.1].map((z) => ['chair', x, z, 180, { color: '#7c1d2a' }]))],
    seats: [1.5, 2.8, 4.1].flatMap((z) => [-1, 1, -3, 3].map((x) => [x, z, 180])), front: [0, -1.3, 180] },
  lockerroom: { size: [10, 7], h: 3.0, wall: '#d9e2e8', floor: '#9aa5ad', trim: '#2e86de', door: [4.8, 2.5, -90],
    props: [['lockers', 0, -3.25, 0, { n: 14, color: '#5d6d7e' }], ['lockers', -4.75, 0, 90, { n: 8, color: '#5d6d7e' }], ['bench', 0, -1.6, 0, { w: 4 }], ['bench', 0, 1.2, 0, { w: 4 }], ['trash', 4.3, -3.0, 0]],
    seats: [[-1.2, -1.6, 0], [0, -1.6, 0], [1.2, -1.6, 0], [-1.2, 1.2, 180], [1.2, 1.2, 180]] },
  diner: { size: [12, 9], h: 3.2, wall: '#f6e2b3', floor: '#e8e2d6', trim: '#c0392b', door: [5.8, 3, -90],
    props: [['counter', -1, -4.0, 0, { w: 5.6 }], ...[-3, -1, 1].map((x) => ['stoolbar', x, -3.2, 0]), ...[-3.5, 0.5, 4.2].map((x) => ['booth', x, 2.4, 0, { color: '#c0392b' }]),
      ['window', -2, 4.45, 180, { y: 1.6, w: 3 }], ['window', 2.5, 4.45, 180, { y: 1.6, w: 3 }], ['plant', 5.4, -3.8, 0]],
    seats: [-3.5, 0.5, 4.2].flatMap((x) => [[x - 0.4, 1.65, 0], [x + 0.4, 3.15, 180]]) },
  infirmary: { size: [8, 7], h: 3.0, wall: '#eef3f6', floor: '#dfe6ea', trim: '#7fa7c9', door: [3.8, 2.4, -90],
    props: [['bed', -2.2, -2.2, 0, { sheet: '#ffffff', color: '#9fc5e8' }], ['bed', 1.0, -2.2, 0, { sheet: '#ffffff', color: '#9fc5e8' }], ['curtain', -0.6, -2.2, 90, { w: 2.2 }],
      ['shelf', 3.6, -1.2, -90], ['chair', -1.2, -1.2, -90], ['plant', 3.5, 2.8, 0], ['window', -2, -3.45, 0, { y: 1.6 }]],
    spots: { bed: [-2.2, -2.5, 0, 0.62], center: [0, 0.6, 0] } },
  garden: { outdoor: true, size: [20, 16], ground: '#6fb14f', path: '#d9c79c', door: [0, -5, 180],
    props: [['house', 0, -8, 0], ['fence', -6, 4, 0], ['fence', -2, 4, 0], ['fence', 2, 4, 0], ['fence', 6, 4, 0], ['flowers', -3, -3, 0], ['flowers', -2.4, -3.2, 0], ['flowers', 2.6, -3, 0],
      ['flowers', 3.2, -2.8, 0], ['bush', -5, -4, 0], ['bush', 5, -4, 0], ['tree', 7, -1, 0], ['parkbench', -4, 0.5, 90]],
    seats: [[-4, 0, 90], [-4, 1, 90]] },
  balcony: { outdoor: true, size: [8, 5], ground: '#8a6a4c', path: '#8a6a4c', door: [0, -2, 180],
    props: [['house', 0, -6.2, 0], ['railing', 0, 2.3, 0, { w: 7 }], ['railing', -3.6, 0, 90, { w: 4.6 }], ['railing', 3.6, 0, 90, { w: 4.6 }], ['plant', -2.8, -1.6, 0], ['plant', 2.8, -1.6, 0]] },
  prom: { size: [18, 12], h: 6, wall: '#2c1f4a', floor: '#3a2d5c', trim: '#ff5fa2', door: [-5, 5.3, 180],
    props: [['banner', 0, -5.9, 0, { y: 4.2, w: 7, text: 'PROM NIGHT', color: '#1b1236', ink: '#ff8ac2' }], ['stringlights', 0, -3, 0, { w: 16, y: 4.5 }], ['stringlights', 0, 2, 0, { w: 16, y: 4.6 }],
      ['discoball', 0, -0.5, 0, { y: 4.4 }], ['table', -7, -4, 0, { w: 2.4, d: 0.9, color: '#ffffff' }], ['table', 7, -4, 0, { w: 2.4, d: 0.9, color: '#ffffff' }], ['plant', -8.4, 5.4, 0], ['plant', 8.4, 5.4, 0]] },
  schoolfront: { outdoor: true, size: [26, 18], ground: '#79b85a', path: '#c9c2b0', door: [0, -5.4, 180],
    props: [['facade', 0, -7.5, 0, { w: 20, h: 7, color: '#c96f4a' }], ['banner', 0, -7.2, 0, { y: 5.6, w: 9, text: 'MOBIUS HIGH' }], ['tree', -8, -3, 0], ['tree', 8.5, -2, 0], ['bush', -4, -6.6, 0], ['bush', 4, -6.6, 0], ['parkbench', 6, 1, -90], ['streetlamp', -6, 2, 0], ['streetlamp', 6.5, -4, 0], ['flowers', -3, -6.4, 0], ['flowers', 3, -6.4, 0], ['trash', 7.5, -0.5, 0]] },
  street: { outdoor: true, size: [26, 14], ground: '#7fae5d', path: '#7b7f87', door: [-12, 0, 90],
    props: [['shop', -7, -8, 0], ['shop', 0.5, -8, 0], ['shop', 8, -8, 0], ['car', -4, 4.4, 90], ['car', 6, 4.4, 90], ['streetlamp', 8, -3.4, 0], ['streetlamp', -8, -3.4, 0], ['parkbench', 3.5, -3.6, 0], ['tree', 10, -3, 0], ['bush', -10, -3.5, 0]] },
  park: { outdoor: true, size: [24, 18], ground: '#6fb14f', path: '#d9c79c', door: [-11, 0, 90],
    props: [['tree', -5, -4, 0], ['tree', 6, -5, 0], ['tree', 9, 3, 0, { color: '#2f8a43' }], ['tree', -9, 4, 0], ['parkbench', 0, -2.5, 0], ['parkbench', -3, 3, 180], ['streetlamp', 2.5, -2.8, 0], ['bush', 4, 1, 0], ['flowers', -1.5, -4.2, 0], ['flowers', 1.8, -4.4, 0], ['bush', -6.5, -1, 0]],
    spots: { bench: [0, -2.4, 0, 0.42] }, seats: [[-0.5, -2.4, 0], [0.5, -2.4, 0]] },
  field: { outdoor: true, size: [30, 22], ground: '#5aa548', path: '#b8573a', door: [-14, 0, 90],
    props: [['bleachers', 0, 8.5, 180, { w: 16 }], ['banner', 0, 10, 180, { y: 3.4, w: 8, text: 'CHAMPIONSHIP' }], ['streetlamp', -12, 8, 0], ['streetlamp', 12, 8, 0]] },
  void: { outdoor: true, size: [20, 20], ground: '#1a1530', path: '#1a1530', door: [-9, 0, 90], props: [] },
};

const LIGHT = {
  day: { sky: '#bfe3ff', fog: '#d8ecff', amb: 1.15, sun: 1.6, sunC: '#fff4dd' },
  sunset: { sky: '#f7a072', fog: '#f4b98e', amb: 0.9, sun: 1.3, sunC: '#ffb27a' },
  night: { sky: '#121735', fog: '#182044', amb: 0.45, sun: 0.55, sunC: '#9db4ff' },
  dream: { sky: '#3a2154', fog: '#5b2f78', amb: 1.0, sun: 1.1, sunC: '#ffc2e6' },
};

export function buildSet(name, time = 'day') {
  const def = SETS[name] || SETS.void;
  let L = LIGHT[time] || LIGHT.day;
  if (!def.outdoor && time === 'night') L = { ...L, amb: 0.95, sun: 1.0, sunC: '#ffe2b8' };   // rooms have their own lights
  const group = new THREE.Group();
  group.name = 'set-' + name;
  const [w, d] = def.size;
  if (def.outdoor) {
    part(BOX(w + 40, 0.1, d + 40), def.ground, group, { pos: [0, -0.05, 0], outline: false, shadow: false }).receiveShadow = true;
    part(BOX(w, 0.02, 3), def.path, group, { pos: [0, 0.011, 0], outline: false, shadow: false }).receiveShadow = true;
  } else {
    const h = def.h;
    part(BOX(w, 0.1, d), def.floor, group, { pos: [0, -0.05, 0], outline: false, shadow: false }).receiveShadow = true;
    const walls = [[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, 90], [w / 2, 0, d, 90]];
    for (const [x, z, len, yaw] of walls) {
      const m = part(BOX(len, h, 0.12), def.wall, group, { pos: [x, h / 2, z], rot: [0, yaw * Math.PI / 180, 0], outline: false });
      m.receiveShadow = true; m.userData.wall = true;
      part(BOX(len, 0.14, 0.14), def.trim, group, { pos: [x, 0.07, z], rot: [0, yaw * Math.PI / 180, 0], outline: false });
    }
    part(BOX(w, 0.1, d), '#f7f5ef', group, { pos: [0, h + 0.05, 0], outline: false, shadow: false }).userData.ceiling = true;
  }
  // Every room gets a real door where people come and go: on the wall nearest the set's door spot, facing in,
  // unless the set already has one there. People enter from, and leave to, a point just inside it.
  const props = [...def.props];
  let door = def.door;
  if (!def.outdoor) {
    const [dx, dz] = def.door, walls = [[dx + w / 2, -w / 2, dz, 90], [w / 2 - dx, w / 2, dz, -90], [dz + d / 2, dx, -d / 2, 0], [d / 2 - dz, dx, d / 2, 180]];
    const [, wx, wz, yaw] = walls.sort((p, q) => p[0] - q[0])[0];
    const onX = yaw === 90 || yaw === -90, px = onX ? wx + (yaw === 90 ? 0.07 : -0.07) : wx, pz = onX ? wz : wz + (yaw === 0 ? 0.07 : -0.07);
    if (!props.some(([t, x, z]) => t === 'door' && Math.hypot(x - px, z - pz) < 1.2)) props.push(['door', px, pz, yaw]);
    const inward = [Math.sin(yaw * Math.PI / 180), Math.cos(yaw * Math.PI / 180)];
    door = [px + inward[0] * 0.75, pz + inward[1] * 0.75, yaw];
  }
  const solids = [];   // prop bounding boxes the camera must not sit in or look through
  for (const [type, x, z, yaw = 0, o = {}] of props) {
    const g = new THREE.Group();
    const opts = { ...o, night: time === 'night' };
    if (!kitProp(g, type, opts, x, z)) PROPS[type]?.(g, opts);   // kit model when there is one, else built here
    g.position.set(x, o.y || 0, z);
    g.rotation.y = yaw * Math.PI / 180;
    group.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    if (!box.isEmpty() && box.max.y > 0.3 && type !== 'door') solids.push(box);   // a door is walked up to, not around
  }
  // doors swing open (into the room) while anyone is within reach of them, and close behind
  const doors = [];
  group.traverse((o) => { if (o.userData.hinge) doors.push({ hinge: o.userData.hinge, at: o.getWorldPosition(new THREE.Vector3()), open: 0 }); });
  const updateDoors = (actors, dt) => {
    for (const d of doors) {
      const near = actors.some((a) => a.root.visible && Math.hypot(a.pos.x - d.at.x, a.pos.z - d.at.z) < 1.3);
      d.open += ((near ? 1 : 0) - d.open) * (1 - Math.exp(-(near ? 6 : 2.5) * dt));
      d.hinge.rotation.y = -d.open * 1.45;
    }
  };
  // ceilings, hidden while the viewer flies the free camera
  const ceilings = [];
  group.traverse((o) => { if (o.userData.ceiling) ceilings.push(o); });
  const showCeiling = (on) => { for (const c of ceilings) c.visible = on; };
  // world-space copies of every opaque mesh, for the director's sightline voxels
  group.updateMatrixWorld(true);
  const statics = new THREE.Group();
  group.traverse((m) => {
    if (!m.isMesh || m.userData.ink || m.material.transparent) return;
    const g2 = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (!g2.index) return;
    statics.add(new THREE.Mesh(g2, m.material));
  });
  const spots = { center: [0, def.outdoor ? 1.5 : 0.4, 0], ...def.spots };
  const m = 0.25;   // stay this far inside the walls
  const bounds = def.outdoor ? { x: [-w, w], z: [-d, d], y: 12 } : { x: [-w / 2 + m, w / 2 - m], z: [-d / 2 + m, d / 2 - m], y: def.h - 0.2 };
  return { name, def, group, statics, solids, spots, bounds, door, updateDoors, showCeiling, seats: def.seats || [], front: def.front || null, light: L, outdoor: !!def.outdoor, size: def.size };
}

// One prop on its own (kit model when there is one), for scenes built outside the set table such as the credits photos.
export function makeProp(type, o = {}) {
  const g = new THREE.Group();
  if (!kitProp(g, type, o, 0, 0)) PROPS[type]?.(g, o);
  return g;
}
