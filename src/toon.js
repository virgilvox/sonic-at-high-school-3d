// Toon materials and ink outlines shared by every character and set piece.
import * as THREE from 'three';

let ramp = null;
function gradient() {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 170, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...opts.mat });
  if (opts.emissive) m.emissive = new THREE.Color(opts.emissive);
  if (!opts.unique) cache.set(key, m);
  return m;
}

export function flat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

// Inverted hull: the same geometry pushed out along its normals, back faces only, drawn black.
const inkMat = new THREE.ShaderMaterial({
  uniforms: { thick: { value: 0.012 } },
  vertexShader: `uniform float thick;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * thick * clamp(-mv.z * 0.25, 0.6, 3.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `void main() { gl_FragColor = vec4(0.06, 0.05, 0.08, 1.0); }`,
  side: THREE.BackSide,
});

export function ink(mesh) {
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  o.raycast = () => {};
  o.userData.ink = true;
  mesh.add(o);
  return mesh;
}

// Make a toon mesh, optionally outlined, attached to a parent with a transform.
export function part(geo, mat, parent, { pos, rot, scale, outline = true, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(...scale);
  m.castShadow = shadow;
  if (outline) ink(m);
  if (parent) parent.add(m);
  return m;
}

// Geometry cache so 30 characters do not build 30 copies of every sphere.
const geos = new Map();
export function geo(kind, ...a) {
  const k = kind + a.join(',');
  if (geos.has(k)) return geos.get(k);
  const g = {
    sphere: () => new THREE.SphereGeometry(a[0] ?? 1, a[1] ?? 24, a[2] ?? 16),
    cone: () => new THREE.ConeGeometry(a[0] ?? 1, a[1] ?? 1, a[2] ?? 12),
    cyl: () => new THREE.CylinderGeometry(a[0] ?? 1, a[1] ?? 1, a[2] ?? 1, a[3] ?? 12),
    capsule: () => new THREE.CapsuleGeometry(a[0] ?? 1, a[1] ?? 1, 6, 14),
    box: () => new THREE.BoxGeometry(a[0] ?? 1, a[1] ?? 1, a[2] ?? 1),
    torus: () => new THREE.TorusGeometry(a[0] ?? 1, a[1] ?? 0.1, 8, 24, a[2] ?? Math.PI * 2),
    circle: () => new THREE.CircleGeometry(a[0] ?? 1, 24),
  }[kind]();
  geos.set(k, g);
  return g;
}
