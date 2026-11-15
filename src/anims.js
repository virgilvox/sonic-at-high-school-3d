// Decodes the baked CC0 Quaternius clips (canonical frame: faces +Z) into three.js clips for one VRM's normalized rig.
import * as THREE from 'three';

function b64i16(s) {
  const raw = atob(s); const u = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i);
  return new Int16Array(u.buffer);
}

let decoded = null;
export function decodeAnimData(json) {
  if (decoded) return decoded;
  decoded = { fps: json.fps, clips: {} };
  for (const [name, c] of Object.entries(json.clips)) {
    const bones = {};
    for (const [b, s] of Object.entries(c.bones)) {
      const i = b64i16(s); const f = new Float32Array(i.length);
      for (let k = 0; k < i.length; k++) f[k] = i[k] / 32767;
      bones[b] = f;
    }
    const hp = b64i16(c.hips); const hips = new Float32Array(hp.length);
    for (let k = 0; k < hp.length; k++) hips[k] = hp[k] / 10000;
    decoded.clips[name] = { n: c.n, dur: c.dur, speed: c.speed || 0, bones, hips };
  }
  return decoded;
}

// vrm0: the normalized rig lives under a scene turned 180 degrees, so conjugate by Ry(pi): negate x and z
export function buildClips(vrm, data, hipsH) {
  const isV0 = vrm.meta?.metaVersion === '0';
  const out = {};
  const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
  const rest = hipsNode.position.clone();
  for (const [name, c] of Object.entries(data.clips)) {
    const times = new Float32Array(c.n);
    for (let i = 0; i < c.n; i++) times[i] = Math.min(c.dur, i / data.fps);
    const tracks = [];
    for (const [bone, q] of Object.entries(c.bones)) {
      const node = vrm.humanoid.getNormalizedBoneNode(bone);
      if (!node) continue;
      let v = q;
      if (isV0) { v = q.slice(); for (let i = 0; i < v.length; i += 4) { v[i] = -v[i]; v[i + 2] = -v[i + 2]; } }
      tracks.push(new THREE.QuaternionKeyframeTrack(node.name + '.quaternion', times, v));
    }
    const p = new Float32Array(c.n * 3);
    for (let i = 0; i < c.n; i++) {
      const s = isV0 ? -1 : 1;
      p[i * 3] = rest.x + s * c.hips[i * 3] * hipsH;
      p[i * 3 + 1] = rest.y + c.hips[i * 3 + 1] * hipsH;
      p[i * 3 + 2] = rest.z + s * c.hips[i * 3 + 2] * hipsH;
    }
    tracks.push(new THREE.VectorKeyframeTrack(hipsNode.name + '.position', times, p));
    const clip = new THREE.AnimationClip(name, c.dur, tracks);
    clip.userData = { speed: c.speed * hipsH };
    out[name] = clip;
  }
  return out;
}
