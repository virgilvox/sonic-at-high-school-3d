// Copy the set-dressing models listed in src/kit-assets.js from the Kenney packs into assets/kit/, embedding any
// textures the GLB references as external files (the newer kits point at Textures/colormap.png), so the page stays
// one self-contained file. usage: node tools/kit.mjs [kenney root]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { KIT_FILES } from '../src/kit-assets.js';

const ROOT = process.argv[2] || join(homedir(), 'Projects/heatsync/3d-assets/kenney');
mkdirSync('assets/kit', { recursive: true });

function findGlb(pack, name) {
  const stack = [join(ROOT, pack)];
  while (stack.length) {
    const d = stack.pop();
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) stack.push(p);
      else if (f === name + '.glb') return p;
    }
  }
  throw new Error(`no ${name}.glb in ${pack}`);
}

for (const id of KIT_FILES) {
  const [pack, name] = id.split('/');
  const src = findGlb(pack, name), b = readFileSync(src);
  const jl = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + jl).toString());
  let bin = b.subarray(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl));
  for (const im of J.images || []) {
    if (!im.uri) continue;
    const file = join(dirname(src), decodeURIComponent(im.uri));
    if (!existsSync(file)) throw new Error(`${id}: missing texture ${file}`);
    const data = readFileSync(file), pad = (4 - (bin.length % 4)) % 4;
    bin = Buffer.concat([bin, Buffer.alloc(pad)]);
    J.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: data.length });
    bin = Buffer.concat([bin, data]);
    im.bufferView = J.bufferViews.length - 1;
    im.mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    delete im.uri;
  }
  J.buffers = [{ byteLength: bin.length }];
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const js = Buffer.from(JSON.stringify(J)), jsPad = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 32)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  jh.writeUInt32LE(jsPad.length, 0); jh.write('JSON', 4); bh.writeUInt32LE(binPad.length, 0); bh.write('BIN\0', 4);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsPad.length + 8 + binPad.length, 8);
  writeFileSync(join('assets/kit', id.replace('/', '__') + '.glb'), Buffer.concat([head, jh, jsPad, bh, binPad]));
}
writeFileSync('assets/kit/CREDITS.txt', 'Set dressing: Kenney (kenney.nl) Furniture Kit, Nature Kit, Car Kit, Retro Urban Kit, City Kit (Commercial, Suburban). CC0.\n');
console.log('kit', KIT_FILES.length, 'models into assets/kit');
