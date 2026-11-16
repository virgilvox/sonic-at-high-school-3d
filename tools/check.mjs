// Validate script/partNN.json files against the vocabulary the engine understands.
// usage: node tools/check.mjs [files...]   (defaults to every part). Exits 1 on any error.
import { readFileSync, readdirSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const CAST = new Set([...src('cast.js').matchAll(/\{ id: '([a-z0-9_]+)'/g)].map((m) => m[1]));
const SETS = new Set([...src('sets.js').matchAll(/^  ([a-z]+): \{/gm)].map((m) => m[1]));
const actsBlock = src('engine.js').match(/const ACTS = \{([\s\S]*?)\n\};/)[1];
const ACTS = new Set([...actsBlock.matchAll(/([a-z]+): \{/g)].map((m) => m[1]).concat(['walk', 'run', 'approach', 'turn', 'face', 'wake', 'getup']));
const emoBlock = src('engine.js').match(/const EMOTES = \{([\s\S]*?)\n\};/)[1];
const EMOTES = new Set([...emoBlock.matchAll(/([a-z]+): \{/g)].map((m) => m[1]));
const SFX = new Set([...src('audio.js').matchAll(/^      ([a-z]+): \(\) =>/gm)].map((m) => m[1]));
const TIMES = new Set(['day', 'sunset', 'night', 'dream']);
const MOODS = new Set(['sad', 'love', 'happy', 'tense', 'dream']);
const FX = new Set(['flash', 'shake', 'dream', 'fadeout', 'fadein']);
const SPOTS = new Set(['bed', 'couch', 'bench', 'teacher', 'seat1', 'seat2', 'mirror', 'boss', 'center', 'railing']);
const KINDS = ['say', 'think', 'do', 'enter', 'exit', 'sfx', 'card', 'song', 'fx', 'wait', 'shot'];

const files = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(new URL('../script/', import.meta.url)).filter((f) => /^part\d+\.json$/.test(f)).map((f) => 'script/' + f);
let errors = 0, beats = 0, lines = 0;
for (const f of files) {
  const err = (where, msg) => { errors++; console.log(`${f} ${where}: ${msg}`); };
  let p;
  try { p = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { err('json', e.message); continue; }
  if (!Number.isInteger(p.part)) err('part', 'missing part number');
  if (!Array.isArray(p.scenes) || !p.scenes.length) { err('scenes', 'none'); continue; }
  p.scenes.forEach((sc, si) => {
    const w = `scene ${si + 1}`;
    if (!SETS.has(sc.set)) err(w, `unknown set "${sc.set}"`);
    if (sc.time && !TIMES.has(sc.time)) err(w, `unknown time "${sc.time}"`);
    if (sc.game && sc.game !== 'dodgeball') err(w, `unknown game "${sc.game}"`);
    if (sc.coach && !CAST.has(sc.coach)) err(w, `unknown coach "${sc.coach}"`);
    for (const id of sc.onstage || []) if (!CAST.has(id)) err(w, `unknown onstage "${id}"`);
    for (const id of sc.cast || []) if (!CAST.has(id)) err(w, `unknown cast "${id}"`);
    for (const [id, spot] of Object.entries(sc.at || {})) { if (!CAST.has(id)) err(w, `unknown cast "${id}"`); if (!SPOTS.has(spot) && !/^seat:\d+$/.test(spot)) err(w, `unknown spot "${spot}"`); }
    (sc.beats || []).forEach((b, bi) => {
      beats++;
      const at = `${w} beat ${bi + 1}`;
      const kind = KINDS.find((k) => k in b);
      if (!kind) return err(at, 'no beat kind: ' + JSON.stringify(b).slice(0, 80));
      for (const k of ['say', 'think', 'enter', 'exit', 'who']) if (b[k] && !CAST.has(b[k])) err(at, `unknown cast "${b[k]}"`);
      if (b.to && !CAST.has(b.to) && !SPOTS.has(b.to) && !['off', 'door'].includes(b.to)) err(at, `unknown target "${b.to}"`);
      if ((b.say || b.think)) { lines++; if (typeof b.text !== 'string' || !b.text.trim()) err(at, 'line without text'); }
      if (b.do && !ACTS.has(b.do)) err(at, `unknown action "${b.do}"`);
      if (kind === 'do' && !b.who) err(at, 'do without who');
      if (b.emote && !EMOTES.has(b.emote)) err(at, `unknown emote "${b.emote}"`);
      if (b.sfx && !SFX.has(b.sfx)) err(at, `unknown sfx "${b.sfx}"`);
      if (b.song && !MOODS.has(b.song)) err(at, `unknown song mood "${b.song}"`);
      if (b.fx && !FX.has(b.fx)) err(at, `unknown fx "${b.fx}"`);
    });
  });
}
console.log(`${files.length} files, ${beats} beats, ${lines} lines, ${errors} errors`);
process.exit(errors ? 1 : 0);
