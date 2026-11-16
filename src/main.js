// Love Story: tarasdiary's "Sonic at High School 3" acted out by VRM characters, voiced by the browser.
// Boot: renderer and lights, the part list, then actors load on demand as each scene needs them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Director } from './director.js';
import { loadKit } from './sets.js';
import { decodeAnimData } from './anims.js';
import { Character } from './character.js';
import { Runner } from './engine.js';
import { Voices } from './voice.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { VoicePanel } from './voicepanel.js';
import { Gallery } from './gallery.js';
import { Credits } from './credits.js';
import { ColdOpen } from './coldopen.js';
import { CAST, TINTABLE, DEFAULT_HEIGHT } from './cast.js';
import { PARTS } from './parts.js';
import { hasModel, model, bank } from './assets.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer, camera, lights
// Phones and tablets: lighter pixels, shadows and textures (the page carries a lot of models).
const MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: !MOBILE });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
const hemi = new THREE.HemisphereLight('#ffffff', '#6b5a48', 1);
const sun = new THREE.DirectionalLight('#fff4dd', 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
sun.shadow.bias = -0.0004;
scene.add(hemi, sun, sun.target);
const lights = {
  apply(set) {
    const L = set.light;
    scene.background = new THREE.Color(set.outdoor ? L.sky : '#000000');
    scene.fog = set.outdoor ? new THREE.Fog(L.fog, 22, 70) : null;
    hemi.intensity = L.amb; sun.intensity = L.sun; sun.color.set(L.sunC);
    sun.position.set(6, 14, 8);
  },
};

function resize() {
  const c = $('view'), w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ actors
let animData = null;   // decoded in boot()
const loader = new GLTFLoader();
loader.register((p) => new VRMLoaderPlugin(p));
const info = new Map(CAST.map((c) => [c.id, c]));
const actors = new Map();

// Cap texture size: several characters can share one big stand-in model, each with its own copy.
function shrinkTextures(vrm, max = MOBILE ? 512 : 1024) {
  const done = new Map();
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) for (const k of ['map', 'shadeMultiplyTexture', 'emissiveMap', 'normalMap', 'matcapTexture', 'rimMultiplyTexture']) {
      const tex = m[k], img = tex?.image;
      if (!img || !(img.width > max || img.height > max)) continue;
      if (!done.has(tex)) {
        const f = max / Math.max(img.width, img.height), c = document.createElement('canvas');
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const t2 = new THREE.CanvasTexture(c);
        Object.assign(t2, { colorSpace: tex.colorSpace, flipY: tex.flipY, wrapS: tex.wrapS, wrapT: tex.wrapT });
        done.set(tex, t2);
        tex.dispose();
      }
      m[k] = done.get(tex); m.needsUpdate = true;
    }
  });
}

// Some exports leave MToon's shade texture empty with a white shade colour, so every surface in shadow renders as a
// flat white layer (Unity falls back to the main texture there; three-vrm does not). Shade with the main texture,
// a little darker, instead.
function fixShade(vrm) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m.isMToonMaterial || m.shadeMultiplyTexture || !m.map) continue;
      m.shadeMultiplyTexture = m.map;
      const c = m.shadeColorFactor;
      if (c && c.r > 0.9 && c.g > 0.9 && c.b > 0.9) c.setRGB(0.74, 0.72, 0.8);
      m.needsUpdate = true;
    }
  });
}

// Recolour a stand-in: paint the target colour in 'color' blend mode, which keeps the texture's shading.
function tint(vrm, color) {
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (/eye|iris|mouth|brow|line|teeth|tongue|highlight/i.test(m.name) || m.userData.tinted) continue;
      m.userData.tinted = true;
      const tex = m.map;
      if (!tex?.image) { m.color?.set(color); continue; }
      const img = tex.image, c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      // a partial multiply lets near-white textures take the colour; the 'color' pass then sets hue, keeps shading
      x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.55; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      x.globalAlpha = 1; x.globalCompositeOperation = 'color'; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
      const t2 = new THREE.CanvasTexture(c);
      Object.assign(t2, { colorSpace: tex.colorSpace, flipY: tex.flipY, wrapS: tex.wrapS, wrapT: tex.wrapT });
      if (m.shadeMultiplyTexture === tex) m.shadeMultiplyTexture = t2;
      m.map = t2; m.needsUpdate = true;
    }
  });
}

async function loadActor(id) {
  if (actors.has(id)) return actors.get(id);
  const c = info.get(id);
  if (!c) return null;
  const file = c.model && hasModel(c.model) ? c.model : c.standin;
  if (!file || !hasModel(file)) return null;
  const gltf = await loader.parseAsync(await model(file), '');
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  const raw = new URLSearchParams(location.search).has('raw');
  window.__freeze = new URLSearchParams(location.search).has('freeze');   // debug: load models untouched
  if (!raw) { fixShade(vrm); shrinkTextures(vrm); }
  if (file !== c.model && c.tint && TINTABLE.has(file)) tint(vrm, c.tint);
  // Scale to the character's height from the real skinned bounds (head-bone heights vary too much between rigs:
  // big-headed models came out giant), and stand the soles on the floor.
  vrm.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene, true);
  const scale = (c.height || DEFAULT_HEIGHT) / Math.max(0.01, box.max.y - box.min.y);
  vrm.scene.position.y = -box.min.y * scale;
  const a = new Character(vrm, animData, { ...c, scale, walkSpeed: 1.5 });
  a.bulk = c.bulk || 0.55;
  a.root.visible = false;
  scene.add(a.root);
  actors.set(id, a);
  return a;
}

// Load any model file as a standalone actor (for the gallery): untinted, fitted to 1.6 m.
const galleryCache = new Map();
async function loadFile(file) {
  if (galleryCache.has(file)) return galleryCache.get(file);
  const gltf = await loader.parseAsync(await model(file), '');
  const vrm = gltf.userData.vrm;
  VRMUtils.rotateVRM0(vrm);
  fixShade(vrm); shrinkTextures(vrm);
  vrm.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene, true), h = file.startsWith('x-') ? 1.72 : 1.6;
  const scale = h / Math.max(0.01, box.max.y - box.min.y);
  vrm.scene.position.y = -box.min.y * scale;
  const a = new Character(vrm, animData, { id: file, name: file, scale, voice: {} });
  galleryCache.set(file, a);
  if (galleryCache.size > 4) galleryCache.delete(galleryCache.keys().next().value);
  return a;
}

// ------------------------------------------------------------------ runtime
const director = new Director(camera);
const sound = new Sound();
const voices = new Voices({ sound, cast: CAST });   // banks arrive in boot()
const state = { part: 0, scene: 0, playing: false, cc: true, voice: true };

const ui = new UI({
  parts: PARTS,
  onPlay: (i) => start(i, 0),
  onPart: (i) => start(i, 0),
  onPause: () => { if (!state.playing) return; runner.pause(!runner.paused); ui.setPlaying(!runner.paused); },
  onSkip: () => runner.skip(),
  onScene: (d) => start(state.part, state.scene + d),
  onToggle: (k) => {
    state[k] = !state[k];
    if (k === 'cc') $('cap').style.visibility = state.cc ? '' : 'hidden';
    ui.setToggle(k, state[k]);
  },
});
ui.names = true;
const voicePanel = new VoicePanel({ voices, cast: CAST, button: [$('voice'), $('voicePick')] });

// Free camera: orbit, pan and zoom around the scene with mouse or touch while the film plays on.
const orbit = new OrbitControls(camera, $('view'));
orbit.enabled = false;
orbit.enableDamping = true;
orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
orbit.maxDistance = 30;
function setFreeCam(on) {
  state.free = on;
  runner.freeCam = on;
  orbit.enabled = on;
  if (on) orbit.target.copy(director.lookAt);
  runner.set?.showCeiling(!on);   // fly over the rooms without a roof in the way
  $('freecam').classList.toggle('on', on);
  $('freecam').textContent = on ? 'Director cam' : 'Free cam';
}
$('freecam').onclick = () => setFreeCam(!state.free);
addEventListener('keydown', (e) => { if (e.key === 'f' && !/^(INPUT|SELECT)$/.test(e.target.tagName)) setFreeCam(!state.free); });
// On touch screens a tap on the picture (not a drag) shows or hides the controls.
let tapAt = null;
$('view').addEventListener('pointerdown', (e) => { tapAt = [e.clientX, e.clientY, performance.now()]; });
$('view').addEventListener('pointerup', (e) => {
  if (!tapAt || e.pointerType !== 'touch') return;
  const moved = Math.hypot(e.clientX - tapAt[0], e.clientY - tapAt[1]) > 12 || performance.now() - tapAt[2] > 350;
  if (!moved) document.body.classList.toggle('hidebar');
});

const gallery = new Gallery({ scene, camera, orbit, load: loadFile, onClose: () => { ui.showPicker(true); if (runner.set) scene.add(runner.set.group); } });
$('galleryBtn').onclick = () => { runner.stop(); if (runner.set) scene.remove(runner.set.group); for (const a of actors.values()) a.root.visible = false; ui.showPicker(false); $('bar').hidden = true; scene.background = new THREE.Color('#0d1a3a'); gallery.open(); };

const runner = new Runner({ scene, cast: actors, info, director, voices, sound, ui, lights });
// Load who the scene needs; past MAX_LOADED, free everyone else so long runs do not pile up models.
const MAX_LOADED = 16;   // main cast plus the background students a scene uses
const coldOpen = new ColdOpen({ scene, camera, lights, loadActor, sound });
const credits = new Credits({ renderer, scene, camera, loadActor, actors, lights, sound, ui, stage: () => runner.set });
runner.credits = credits;

runner.prepare = async (ids) => {
  if (actors.size + ids.filter((id) => !actors.has(id)).length > MAX_LOADED) {
    for (const [id, a] of actors) {
      if (ids.includes(id)) continue;
      scene.remove(a.root);
      VRMUtils.deepDispose(a.vrm.scene);
      actors.delete(id);
    }
  }
  for (const id of ids) await loadActor(id);
};

async function start(pi, si) {
  runner.stop();
  const part = PARTS[pi];
  if (!part) return ui.showPicker(true);
  if (si < 0) { if (pi > 0) return start(pi - 1, PARTS[pi - 1].scenes.length - 1); si = 0; }
  if (si >= part.scenes.length) return start(pi + 1, 0);
  Object.assign(state, { part: pi, scene: si, playing: true });
  sound.ensure(); sound.resume();
  if (voices.mode === 'browser' && window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(''));   // iOS: unlock in the tap
  ui.showPicker(false); ui.setPlaying(true);
  runner.pause(false);
  if (pi === 0 && si === 0 && !state.introDone) {   // the opening titles, once per visit
    state.introDone = true;
    await coldOpen.play();   // the original's moody opening, in 3D
    sound.startScore('credits', { vol: 0.75 });
    await ui.intro();
  }
  const done = await runner.playPart(part, { fromScene: si, onScene: (s) => { state.scene = s; ui.setWhere(part, s, part.scenes.length); } });
  if (done) start(pi + 1, 0);
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let frames = 0;
function loop() {
  frames++;
  const dt = Math.min(clock.getDelta(), window.__maxDt || 1 / 20);
  if (!runner.paused) {
    if (!window.__freeze && !coldOpen.active) for (const a of actors.values()) if (a.root.visible) a.update(dt);   // ?freeze: bind pose, for model checks
    runner.physics(dt, camera);
    if (coldOpen.active) coldOpen.update(dt);
    else if (gallery.active) { gallery.update(dt); orbit.update(); }
    else if (state.free) orbit.update(); else director.update(dt);
  }
  sun.target.position.copy(director.lookAt);
  sun.position.copy(director.lookAt).add(new THREE.Vector3(6, 14, 8));
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// Kenney set dressing, parsed once before the first set is built.
const kitReady = bank('kitBank').then((k) => loadKit(k, new GLTFLoader()));

// Warm up the always-present leads so the first scene does not stall, then open the picker.
(async () => {
  ui.progress(0.05, 'Loading motion and sets');
  animData = decodeAnimData(await bank('animData'));
  await kitReady;
  ui.progress(0.15, 'Loading voices and music');
  const [voiceBank, music, sfx] = await Promise.all([bank('voiceBank'), bank('musicBank'), bank('sfxBank')]);
  voices.setBank(voiceBank); sound.setTracks(music); sound.setSamples(sfx);
  const lead = ['sonic', 'amy'];
  for (let i = 0; i < lead.length; i++) { ui.progress(0.3 + 0.7 * i / lead.length, 'Loading ' + info.get(lead[i]).name); await loadActor(lead[i]); }
  ui.progress(1, 'Ready');
  ui.ready();
  const q = new URLSearchParams(location.search);
  if (q.get('test')) return diagnostics(q.get('test'));
  if (q.has('autoplay')) start(Math.max(0, PARTS.findIndex((p) => p.part === +(q.get('part') || 1))), +(q.get('scene') || 1) - 1);
  requestAnimationFrame(loop);
})();
// Diagnostics: ?test=lineup puts every model in a row facing the camera at yaw 0 (they must show their faces);
// ?test=walk sends one actor around a square so facing and stride can be checked against the travel direction.
async function diagnostics(kind) {
  ui.showPicker(false); $('bar').hidden = true;
  const { buildSet } = await import('./sets.js');
  const q = new URLSearchParams(location.search);
  const set = buildSet(kind === 'set' || kind === 'sit' ? q.get('name') || 'hallway' : 'gym', q.get('time') || 'day'); scene.add(set.group); lights.apply(set);
  if (kind === 'sit') {   // ?test=sit&name=classroom: two actors on the first seats (or Sonic in bed), seen from the side
    director.setWorld(null, null, []);
    const ids = ['sonic', 'amy'];
    for (const id of ids) await loadActor(id);
    runner.set = set; runner.bodies.use(set, []);
    if (set.name === 'bedroom') { const a = actors.get('sonic'); runner.lie(a, runner.spot('bed')); a.root.visible = true; }
    else set.seats.slice(0, 2).forEach(([x, z, yaw], i) => { const a = actors.get(ids[i]); a.place(x, z, yaw * Math.PI / 180); a.setBase('Sitting_Idle_Loop', 0); a.root.visible = true; });
    const p = set.name === 'bedroom' ? runner.spot('bed') : { x: set.seats[0][0], z: set.seats[0][1] };
    director.cut({ type: 'fixed', pos: [p.x + 2.6, 1.3, p.z + 0.4], look: [p.x, 0.6, p.z], fov: 45 });
    return requestAnimationFrame(loop);
  }
  if (kind === 'set') {   // ?test=set&name=bedroom: the empty set from a high corner, for checking the dressing
    const [w, d] = set.size, B = set.bounds;
    director.setWorld(null, null, []);
    director.cut({ type: 'fixed', pos: set.outdoor ? [w * 0.45, 6, d * 0.55] : [B.x[1] - 0.1, Math.min(set.def.h - 0.15, 2.8), B.z[1] - 0.1], look: [0, 0.6, 0], fov: set.outdoor ? 55 : 70 });
    return requestAnimationFrame(loop);
  }
  director.setWorld(null, set.bounds, set.solids);
  // one character per model file: everyone sharing a file shares its orientation
  const fileOf = (c) => (c.model && hasModel(c.model) ? c.model : c.standin);
  const who = q.get('who');
  const ids = kind === 'lineup' ? (who ? who.split(',') : [...new Map(CAST.filter(fileOf).reverse().map((c) => [fileOf(c), c.id])).values()].reverse()) : [who || 'sonic'];
  for (const id of ids) await loadActor(id);
  const list = ids.map((id) => actors.get(id));
  if (kind === 'lineup') {
    list.forEach((a, i) => { a.place((i - (list.length - 1) / 2) * 0.9, 0, 0); a.root.visible = true; });
    director.cut({ type: 'fixed', pos: [0, 1.6, list.length * 0.62 + 2], look: [0, 1.0, 0], fov: 60 });
    list.forEach((a, i) => { const el = document.createElement('div'); el.textContent = a.name; el.style.cssText = `position:fixed;bottom:4px;left:${(i + 0.5) / list.length * 100}%;transform:translateX(-50%);font:11px sans-serif;color:#fff`; document.body.append(el); });
  } else {
    const a = list[0]; a.place(-3, -2, Math.PI / 2); a.root.visible = true;
    director.actors = [a];
    director.cut({ type: 'fixed', pos: [0, 7, 7], look: [0, 0.5, 0], fov: 50 });
    const run = new URLSearchParams(location.search).has('run');
    (async () => { for (;;) for (const [x, z] of [[3, -2], [3, 2], [-3, 2], [-3, -2]]) await a.walk([new THREE.Vector3(x, 0, z)], { speed: run ? 3.6 : a.walkSpeed }); })();
  }
  requestAnimationFrame(loop);
}

window.__love = { runner, director, actors, start, loadActor, camera, voices, sound, parts: PARTS, frames: () => frames };
