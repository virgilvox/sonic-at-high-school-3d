// Build the film two ways from the same sources:
//   dist/love-story.html  one self-contained page (models, voices, music, sets embedded), opens from file://
//   dist/web/             the GitHub Pages site: index.html plus models/*.vrm and data/*.json fetched on demand
//                         (GitHub refuses files over 100 MB, and a small first page loads faster anyway)
// usage: node tools/build.mjs [--watch]
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { voiceJobs } from './voices/jobs.mjs';

const watch = process.argv.includes('--watch');
const readJson = (f, fallback = {}) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback);
const files = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : []);

// Clips the engine can ask for (keep in sync with ACTS in src/engine.js and Character's loops).
const CLIPS = ['Idle_Loop', 'Walk_Loop', 'Sprint_Loop', 'Idle_Talking_Loop', 'Sitting_Talking_Loop', 'Sitting_Idle_Loop', 'Sitting_Enter',
  'Sitting_Exit', 'Yes', 'Idle_No_Loop', 'Punch_Cross', 'Punch_Jab', 'Hit_Head', 'Hit_Chest', 'Hit_Knockback', 'Death01', 'LayToIdle',
  'NinjaJump_Start', 'OverhandThrow', 'PickUp_Table', 'Interact', 'Consume', 'Idle_FoldArms_Loop', 'Idle_TalkingPhone_Loop', 'Dance_Loop',
  'Crouch_Idle_Loop', 'Push_Loop'];

// Gather script/partNN.json into one list the app imports (src/parts.js reads script/parts.json).
function mergeParts() {
  const parts = files('script', '.json').filter((f) => /^part\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync('script/' + f, 'utf8')));
  writeFileSync('script/parts.json', JSON.stringify(parts));
  console.log('parts', parts.length, 'scenes', parts.reduce((n, p) => n + p.scenes.length, 0));
}

// Everything the page needs besides the app: data banks by name and model files by name.
function collect() {
  const anim = readJson('assets/anims_all.json');
  anim.clips = Object.fromEntries(CLIPS.filter((k) => anim.clips[k]).map((k) => [k, anim.clips[k]]));
  const b64dir = (dir, ext) => Object.fromEntries(files(dir, ext).map((f) => [f.slice(0, -ext.length), readFileSync(`${dir}/${f}`).toString('base64')]));
  const voice = {};
  for (const j of voiceJobs()) { const f = `assets/voice/lines/${j.key}.mp3`; if (existsSync(f)) voice[j.key] = readFileSync(f).toString('base64'); }
  const banks = { animData: anim, voiceBank: voice, musicBank: b64dir('assets/music', '.mp3'), sfxBank: b64dir('assets/sfx', '.mp3'), kitBank: b64dir('assets/kit', '.glb') };
  for (const k of Object.keys(banks)) if (!Object.keys(k === 'animData' ? banks[k].clips : banks[k]).length) delete banks[k];
  const models = files('assets/vrm', '.vrm').map((f) => f.slice(0, -4));
  console.log('voice lines', Object.keys(voice).length, 'models', models.length);
  return { banks, models };
}

function credits(models) {
  const C = readJson('assets/vrm/CREDITS.json'), music = readJson('assets/music/CREDITS.json');
  const people = models.filter((m) => !m.startsWith('x-')).map((m) => { const c = C[m + '.vrm'] || {}; return `${c.title || m} by ${c.author || 'unknown author'}${c.source ? ` (${c.source})` : ''}`; });
  const songs = Object.entries(music).filter(([k]) => !k.startsWith('_')).map(([, t]) => `"${t}"`).join(', ');
  return 'A fan remake of tarasdiary\'s "Sonic at High School 3: Love Story" (YouTube). Sonic the Hedgehog characters belong to SEGA. '
    + 'Not affiliated with SEGA or tarasdiary; made for fun, not for sale. Character models: ' + people.join('; ') + '. '
    + 'Background students: VRoid Project sample avatars by pixiv (CC0). Motion: Quaternius Universal Animation Library (CC0). '
    + 'Voices: Kyutai Pocket TTS built-in voices, or your browser\'s speech. '
    + (songs ? `Music: ${songs} by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0. ` : '')
    + 'Sets: Kenney Furniture, Nature, Car, Retro Urban and City kits (kenney.nl), CC0. '
    + 'Footsteps: "Footsteps on different surfaces" by congusbongus (OpenGameArt), from recordings by swuing (freesound.org), CC BY 3.0. '
    + 'Crowd ambience: "Crowd Shouting/Speaking Ambience" (OpenGameArt), CC0. School chatter made with Pocket TTS voices.';
}

// The hack.build YouTube channel for the title screen footer; the link is hidden while this is empty.
const HACKBUILD_YOUTUBE = '';

function page(app, data, credit) {
  let html = readFileSync('src/template.html', 'utf8').replace('/*CREDITS*/', () => credit).replace('/*DATA*/', () => data)
    .replace('/*HBLOGO*/', () => readFileSync('src/hackbuild-lockup.svg', 'utf8'));
  html = HACKBUILD_YOUTUBE ? html.replace('/*YT*/', HACKBUILD_YOUTUBE) : html.replace(/\s*<a id="ytLink"[^\n]*<\/a>/, '');
  return html.replace('/*APP*/', () => app);
}

function output() {
  const app = readFileSync('dist/app.js', 'utf8').replaceAll('</script', '<\\/script');
  const { banks, models } = collect();
  const credit = credits(models);
  // one file (skipped with WEB_ONLY=1, as on the Pages workflow)
  if (!process.env.WEB_ONLY) writeOneFile(app, banks, models, credit);
  writeWeb(app, banks, models, credit);
}

function writeOneFile(app, banks, models, credit) {
  const tags = [
    ...Object.entries(banks).map(([k, v]) => `<script id="${k}" type="application/json">${JSON.stringify(v)}</script>`),
    ...models.map((m) => `<script id="vrm-${m}" type="application/octet-stream">${readFileSync(`assets/vrm/${m}.vrm`).toString('base64')}</script>`),
  ];
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/love-story.html', page(app, tags.join('\n'), credit));
  console.log('wrote dist/love-story.html', (statSync('dist/love-story.html').size / 1e6).toFixed(1), 'MB');
}

function writeWeb(app, banks, models, credit) {
  rmSync('dist/web', { recursive: true, force: true });
  mkdirSync('dist/web/models', { recursive: true }); mkdirSync('dist/web/data', { recursive: true });
  for (const m of models) copyFileSync(`assets/vrm/${m}.vrm`, `dist/web/models/${m}.vrm`);
  for (const [k, v] of Object.entries(banks)) writeFileSync(`dist/web/data/${k}.json`, JSON.stringify(v));
  const manifest = `<script id="manifest" type="application/json">${JSON.stringify({ models, banks: Object.keys(banks) })}</script>`;
  writeFileSync('dist/web/index.html', page(app, manifest, credit));
  writeFileSync('dist/web/.nojekyll', '');
  const biggest = [...readdirSync('dist/web/models').map((f) => 'models/' + f), ...readdirSync('dist/web/data').map((f) => 'data/' + f)]
    .map((f) => [f, statSync('dist/web/' + f).size]).sort((a, b) => b[1] - a[1])[0];
  console.log('wrote dist/web (largest file', biggest[0], (biggest[1] / 1e6).toFixed(1), 'MB)');
}

mergeParts();
const opts = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2020', outfile: 'dist/app.js',
  minify: !watch, logLevel: 'warning', loader: { '.json': 'json', '.svg': 'text' },
  plugins: [{ name: 'output', setup(b) { b.onEnd((r) => { if (!r.errors.length) output(); }); } }],
};
if (watch) await (await esbuild.context(opts)).watch();
else await esbuild.build(opts);
