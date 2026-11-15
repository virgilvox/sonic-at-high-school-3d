// Turn a rigged glTF/GLB character (not a VRM) into a VRM 0.x file by adding the VRM extension: a humanoid bone
// map, meta with its licence and credit, and empty expression, spring bone and first person blocks. Meshes, skin
// and textures are untouched. Reports how far the arms hang from a T-pose at rest, since VRM animation assumes one.
//
//   node tools/glb2vrm.mjs in.glb out.vrm map.json
//
// map.json: { "meta": { "title", "author", "licenseName", "otherLicenseUrl" }, "suffix": "_Amy_skeleton",
//             "bones": { "hips": "HipsTranslation", "spine": "Spine", ... } }
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src, dst, mapFile] = process.argv;
const map = JSON.parse(readFileSync(mapFile, 'utf8'));
const b = readFileSync(src);
const jl = b.readUInt32LE(12);
const J = JSON.parse(b.subarray(20, 20 + jl).toString());
const binChunk = b.subarray(20 + jl);   // BIN chunk header and data, copied as is

// Plain glTF characters face +Z but VRM 0.x faces -Z (three-vrm turns VRM 0.x round on load), so converted models
// usually need yaw 180; map.yaw (degrees) turns the scene's top nodes so the rig faces the VRM way.
if (map.yaw) {
  const a = (map.yaw * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const R = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];   // rotation about +Y, column major
  const mul = (A, B) => { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) o[k * 4 + r] += A[q * 4 + r] * B[k * 4 + q]; return o; };
  for (const i of J.scenes[J.scene || 0].nodes) {
    const n = J.nodes[i];
    if (!n.matrix) { if (n.rotation || n.scale || n.translation) throw new Error('top node uses TRS; add support'); n.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
    n.matrix = mul(R, n.matrix);
  }
}
const byName = new Map(J.nodes.map((n, i) => [n.name, i]));
const humanBones = Object.entries(map.bones).map(([bone, name]) => {
  const node = byName.get(name + (map.suffix || ''));
  if (node === undefined) throw new Error(`no node named ${name}${map.suffix || ''} for ${bone}`);
  return { bone, node, useDefaultValues: true };
});

// rest pose check: world positions from node TRS (rotations applied as quaternions)
const parent = new Map();
J.nodes.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
const qmul = (a, q) => [a[3] * q[0] + a[0] * q[3] + a[1] * q[2] - a[2] * q[1], a[3] * q[1] - a[0] * q[2] + a[1] * q[3] + a[2] * q[0], a[3] * q[2] + a[0] * q[1] - a[1] * q[0] + a[2] * q[3], a[3] * q[3] - a[0] * q[0] - a[1] * q[1] - a[2] * q[2]];
const qrot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
function world(i) {
  const n = J.nodes[i], t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
  if (!parent.has(i)) return { p: t, q: r, s };
  const P = world(parent.get(i)), lp = qrot(P.q, [t[0] * P.s[0], t[1] * P.s[1], t[2] * P.s[2]]);
  return { p: [P.p[0] + lp[0], P.p[1] + lp[1], P.p[2] + lp[2]], q: qmul(P.q, r), s: [P.s[0] * s[0], P.s[1] * s[1], P.s[2] * s[2]] };
}
const pos = (bone) => world(humanBones.find((h) => h.bone === bone).node).p;
for (const side of ['left', 'right']) {
  const a = pos(side + 'UpperArm'), c = pos(side + 'LowerArm'), d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const droop = Math.atan2(-d[1], Math.hypot(d[0], d[2])) * 180 / Math.PI;
  console.log(`${side} upper arm rest: ${droop.toFixed(0)} degrees below horizontal (T-pose is 0)`);
}

const head = humanBones.find((h) => h.bone === 'head').node;
J.extensions = J.extensions || {};
J.extensions.VRM = {
  exporterVersion: 'love-story glb2vrm', specVersion: '0.0',
  meta: { title: map.meta.title, version: '', author: map.meta.author, contactInformation: '', reference: map.meta.source || '',
    allowedUserName: 'Everyone', violentUssageName: 'Disallow', sexualUssageName: 'Disallow', commercialUssageName: 'Disallow',
    licenseName: map.meta.licenseName || 'Other', otherLicenseUrl: map.meta.otherLicenseUrl || '' },
  humanoid: { humanBones, armStretch: 0.05, legStretch: 0.05, upperArmTwist: 0.5, lowerArmTwist: 0.5, upperLegTwist: 0.5, lowerLegTwist: 0.5, feetSpacing: 0, hasTranslationDoF: false },
  firstPerson: { firstPersonBone: head, firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 }, meshAnnotations: [], lookAtTypeName: 'Bone' },
  blendShapeMaster: { blendShapeGroups: [] },
  secondaryAnimation: { boneGroups: [], colliderGroups: [] },
  materialProperties: [],
};
J.extensionsUsed = [...new Set([...(J.extensionsUsed || []), 'VRM'])];
const js = Buffer.from(JSON.stringify(J)), pad = (4 - (js.length % 4)) % 4;
const jsonChunk = Buffer.concat([js, Buffer.alloc(pad, 32)]);
const head12 = Buffer.alloc(12), jh = Buffer.alloc(8);
jh.writeUInt32LE(jsonChunk.length, 0); jh.write('JSON', 4);
const total = 12 + 8 + jsonChunk.length + binChunk.length;
head12.write('glTF', 0); head12.writeUInt32LE(2, 4); head12.writeUInt32LE(total, 8);
writeFileSync(dst, Buffer.concat([head12, jh, jsonChunk, binChunk]));
console.log('wrote', dst, (total / 1e6).toFixed(1), 'MB,', humanBones.length, 'bones');
