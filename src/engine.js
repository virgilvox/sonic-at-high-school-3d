// Plays a part's script: loads each scene's set, stages the cast, then runs beats in order (say, think, do,
// enter, exit, sfx, card, song, fx, wait) with automatic camera coverage. See script/README.md for the format.
import * as THREE from 'three';
import { buildSet } from './sets.js';
import { readTime, speakable } from './voice.js';
import { Bodies } from './bodies.js';
import { Dodgeball } from './dodgeball.js';
import { Extras } from './extras.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// Where each set sounds like it is, and what feet hit there.
const PLACE = {
  hallway: { amb: [{ name: 'amb-hallway', vol: 0.45 }, { name: 'amb-hallway2', vol: 0.35 }], floor: 'tile' },
  cafeteria: { amb: [{ name: 'amb-cafeteria', vol: 0.55 }, { name: 'amb-hallway2', vol: 0.3 }], floor: 'tile' },
  classroom: { amb: [{ name: 'amb-hallway', vol: 0.12 }], floor: 'tile' },
  gym: { amb: [{ name: 'amb-crowd', vol: 0.25 }], floor: 'wood' },
  field: { amb: [{ name: 'amb-crowd', vol: 0.35 }, { name: 'birds', vol: 0.3 }], floor: 'grass' },
  stage: { amb: [{ name: 'amb-cafeteria', vol: 0.18 }], floor: 'wood' },
  schoolfront: { amb: [{ name: 'amb-hallway', vol: 0.2 }, { name: 'birds', vol: 0.5 }], floor: 'grass' },
  street: { amb: [{ name: 'traffic', vol: 0.6 }, { name: 'birds', vol: 0.3 }], floor: 'tile' },
  park: { amb: [{ name: 'birds', vol: 0.7 }], floor: 'grass' },
  lockerroom: { amb: [{ name: 'amb-hallway', vol: 0.15 }], floor: 'tile' },
  diner: { amb: [{ name: 'amb-cafeteria', vol: 0.3 }], floor: 'tile' },
  infirmary: { amb: [], floor: 'tile' },
  garden: { amb: [{ name: 'birds', vol: 0.7 }], floor: 'grass' },
  balcony: { amb: [{ name: 'crickets', vol: 0.4 }], floor: 'wood' },
  prom: { amb: [{ name: 'amb-cafeteria', vol: 0.35 }], floor: 'wood' },
  office: { amb: [], floor: 'wood' }, bathroom: { amb: [], floor: 'tile' },
  bedroom: { amb: [], floor: 'wood' }, kitchen: { amb: [], floor: 'wood' }, livingroom: { amb: [], floor: 'wood' },
};
// A scene's background music, from what happens in it: its own montage mood if it has one, else the feelings
// its lines carry. Dreams get the dream bed.
const MOOD_OF = { blush: 'love', kiss: 'love', hug: 'love', sad: 'sad', crying: 'sad', worried: 'sad', angry: 'tense', shocked: 'tense',
  scared: 'tense', annoyed: 'tense', punch: 'tense', fall: 'tense', happy: 'happy', excited: 'happy', laugh: 'happy', smirk: 'happy' };
function sceneMood(sc) {
  if (sc.time === 'dream') return 'dream';
  if (sc.game || sc.set === 'gym') return 'action';            // dodgeball and sports
  if (sc.set === 'field') return 'epic';                       // the championship
  if (sc.set === 'prom') return 'love';
  const song = sc.beats.find((b) => b.song);
  if (song) return song.song;
  const n = { love: 0, sad: 0, tense: 0, happy: 0.5 };
  for (const b of sc.beats) for (const k of [b.emote, b.do]) if (MOOD_OF[k]) n[MOOD_OF[k]] += k === 'kiss' || k === 'hug' ? 3 : 1;
  const runs = sc.beats.filter((b) => b.do === 'run' || b.run).length;
  const whispers = sc.beats.filter((b) => /\*whisper/i.test(b.text || '') || b.think).length;
  if (runs >= 3) return 'chase';
  if (whispers >= 3) return 'sneaky';
  if (n.sad >= 3 && (n.tense >= 2 || n.love >= 2)) return 'drama';
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
}

const MONTAGE_MAX = 10;   // seconds; the videos' long picture montages are trimmed to a short sequence

// Tidy a scene's beats for playback: back to back song beats become one (moods differ? the first wins).
function mergeSongs(beats) {
  const out = [];
  for (const b of beats) {
    const prev = out[out.length - 1];
    if (b.song && prev?.song) prev.dur = (prev.dur || 8) + (b.dur || 8);
    else out.push(b.song ? { ...b } : b);
  }
  return out;
}

// Script action -> how a character performs it. clip: one shot, base: held loop, gesture: arm overlay.
const ACTS = {
  wave: { gesture: 'wave' }, point: { gesture: 'point' }, clap: { gesture: 'clap' }, cheer: { gesture: 'cheer', hop: 0.08 },
  shrug: { gesture: 'shrug' }, think: { gesture: 'think' }, beckon: { gesture: 'beckon' }, fist: { gesture: 'fist' },
  present: { gesture: 'present' }, hands: { gesture: 'hands' },
  nod: { clip: 'Yes' }, no: { clip: 'Idle_No_Loop', loops: 1 }, punch: { clip: 'Punch_Cross', hit: 'Hit_Head' },
  jab: { clip: 'Punch_Jab', hit: 'Hit_Chest' }, slap: { clip: 'Punch_Jab', hit: 'Hit_Head' }, hit: { clip: 'Hit_Chest' },
  knockback: { clip: 'Hit_Knockback' }, fall: { clip: 'Death01', hold: true }, faint: { clip: 'Death01', hold: true },
  getup: { clip: 'LayToIdle' }, wake: { clip: 'LayToIdle' }, jump: { clip: 'NinjaJump_Start' }, throw: { clip: 'OverhandThrow' },
  pickup: { clip: 'PickUp_Table' }, grab: { clip: 'Interact' }, knock: { clip: 'Interact', sfx: 'knock' }, use: { clip: 'Interact' },
  eat: { clip: 'Consume' }, drink: { clip: 'Consume' }, brush: { clip: 'Consume', sfx: 'brush', loops: 2 },
  sit: { clip: 'Sitting_Enter', base: 'Sitting_Idle_Loop' }, stand: { clip: 'Sitting_Exit', base: 'Idle_Loop' },
  crossarms: { base: 'Idle_FoldArms_Loop' }, phone: { base: 'Idle_TalkingPhone_Loop' }, dance: { base: 'Dance_Loop' },
  kneel: { base: 'Crouch_Idle_Loop' }, struggle: { base: 'Push_Loop' }, push: { clip: 'Push_Loop', loops: 1 },
  idle: { base: 'Idle_Loop' }, relax: { base: 'Idle_Loop' }, freeze: { emote: 'surprised' },
  cry: { gesture: 'think', emote: 'sad', mood: { sad: 0.9 } }, laugh: { emote: 'happy', hop: 0.04 }, smile: { emote: 'happy' },
  blush: { emote: 'happy', amount: 0.6 }, wink: { emote: 'happy', amount: 0.7 }, smirk: { emote: 'happy', amount: 0.45 },
  glare: { emote: 'angry' }, gasp: { emote: 'surprised', sfx: 'gasp' }, sigh: { emote: 'sad', amount: 0.5 },
  hug: { close: 0.42, gesture: 'present', emote: 'happy' }, kiss: { close: 0.32, emote: 'happy', hop: 0.03, sfx: 'sparkle' },
  lie: { lie: true }, sleep: { lie: true, mood: { relaxed: 1 } },
};
// Emote names in the script -> VRM expression mixes.
const EMOTES = {
  happy: { happy: 1 }, sad: { sad: 1 }, angry: { angry: 1 }, surprised: { surprised: 1 }, relaxed: { relaxed: 1 },
  scared: { surprised: 0.8, sad: 0.5 }, worried: { sad: 0.55 }, smirk: { happy: 0.45, relaxed: 0.4 }, blush: { happy: 0.7 },
  annoyed: { angry: 0.55 }, shocked: { surprised: 1 }, crying: { sad: 1 }, excited: { happy: 1, surprised: 0.3 }, neutral: {},
};

// Everyone a scene needs loaded: its starting cast and anyone who speaks, acts or enters later.
export function sceneIds(sc) {
  const ids = new Set(sc.cast || []);
  for (const b of sc.beats) for (const k of ['say', 'think', 'who', 'enter', 'to']) if (typeof b[k] === 'string') ids.add(b[k]);
  return [...ids];
}

export class Runner {
  constructor({ scene, cast, info, director, voices, sound, ui, lights }) {
    Object.assign(this, { scene, cast, info, director, voices, sound, ui, lights });
    this.set = null;
    this.on = new Set();      // actors in the current scene
    this.paused = false;
    this.token = 0;
    this.clock = 0;
    this.shotN = 0;
    this.bodies = new Bodies();
    this.game = new Dodgeball(this.scene);
    this.extras = new Extras(this);
    this.stats = { walks: 0, timeouts: 0 };   // read by the test harness
  }

  // Solid bodies: run after the actors animate each frame.
  physics(dt = 1 / 60, camera = null) {
    if (!this.set) return;
    this.bodies.actors = [...this.on, ...this.extras.list];
    this.director.actors = this.bodies.actors;
    this.bodies.step();
    // with nobody talking for a couple of seconds (walks, entrances, action), the music comes up to fill the space
    this.sound.swell(!this.talking && performance.now() - (this.quietSince || 0) > 2000);
    // footsteps: a step every stride while moving, louder near the camera, panned to the side they are on
    for (const a of [...this.on, ...this.extras.list]) {
      if (!a.root.visible || a.speed < 0.35 || a.lieOn) { a.stepT = 0; continue; }
      a.stepT = (a.stepT || 0) - dt;
      if (a.stepT > 0) continue;
      a.stepT = Math.min(0.62, Math.max(0.24, 0.62 * (1.25 / a.speed)));
      let vol = 0.5, pan = 0;
      if (camera) {
        const d = camera.position.distanceTo(a.pos);
        vol = 0.6 * Math.max(0, 1 - d / 14);
        const rel = a.pos.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
        pan = Math.max(-0.8, Math.min(0.8, rel.x / 4));
      }
      if (vol > 0.03) this.sound.step(this.floor || 'tile', vol * (a.speed > 2 ? 1.2 : 1), pan);
    }
  }

  // An id in the script maps to the actor playing it in this scene: a costume when one applies (see cast.js).
  actor(id) { return this.cast.get(this.alias?.[id] || id); }
  costumes(sc) {
    const alias = {};
    for (const c of this.info.values()) if (c.costume?.sets.includes(sc.set)) alias[c.costume.of] = c.id;
    return alias;
  }

  // ------------------------------------------------------------------ flow
  async playPart(part, { fromScene = 0, onScene } = {}) {
    const tok = ++this.token;
    for (let si = fromScene; si < part.scenes.length; si++) {
      if (tok !== this.token) return false;
      onScene?.(si);
      const sc = part.scenes[si];
      this.alias = this.costumes(sc);
      await this.prepare?.([...sceneIds(sc).map((id) => this.alias[id] || id), ...this.extras.want(sc)]);
      if (tok !== this.token) return false;
      this.loadScene(sc);
      const beats = mergeSongs(sc.beats);
      // the opening picture montage of a part is its title: a card over the intro music instead
      if (si === 0 && beats[0]?.song) { beats.shift(); await this.titleCard(part); }
      else if (si === 0 && fromScene === 0) await this.titleCard(part);
      for (let bi = 0; bi < beats.length; bi++) {
        const b = beats[bi];
        const next = beats.slice(bi + 1).find((x) => x.say || x.think);   // decode the next voiced line early
        if (next) this.voices.prefetch(this.castInfo(next.say || next.think), next.text);
        await this.gate();
        if (tok !== this.token) return false;
        this.at = { scene: si, beat: bi, kind: Object.keys(b)[0] };   // where playback is (for tests and debugging)
        this.skipLine = false;
        this.skipP = new Promise((r) => { this.skipR = r; });
        await this.beat(b, tok);
      }
    }
    return tok === this.token;
  }
  stop() { this.extras.clear(); this.token++; this.skipR?.(); this.voices.stop(); this.sound.stopScore(true); this.ui.letterbox(false); }
  async gate() { while (this.paused) await sleep(0.1); }
  pause(on) { this.paused = on; on ? (this.voices.pause(), this.sound.pause()) : (this.voices.resume(), this.sound.resume()); }
  skip() { this.skipLine = true; this.skipR?.(); this.voices.stop(); }

  // ------------------------------------------------------------------ scene
  loadScene(sc) {
    if (this.set) this.scene.remove(this.set.group);
    this.set = buildSet(sc.set, sc.time);
    this.scene.add(this.set.group);
    this.lights.apply(this.set);
    this.director.setWorld(this.set.statics, this.set.bounds, this.set.solids);
    this.bodies.use(this.set, []);
    for (const a of this.cast.values()) { a.root.visible = false; a.path = null; a.speaking = false; a.stopOneShot(); a.setBase('Idle_Loop', 0); a.mood = { happy: 0.15 }; a.lieOn = null; }
    this.on.clear();
    const ids = (sc.cast || []).filter((id) => this.actor(id));
    const at = sc.at || {};
    this.stageScene(sc, ids.filter((id) => !at[id]));
    for (const id of ids.filter((i) => at[i])) { this.show(this.actor(id)); this.toSpot(this.actor(id), at[id], true); }
    this.game.clear();
    if (sc.game === 'dodgeball') {   // teams on the court, coach on the sideline, balls on the centre line
      const spots = this.game.setup(sc, this.set, sceneIds(sc).filter((id) => this.actor(id)));
      for (const [id, [x, z, yaw]] of Object.entries(spots)) { const a = this.actor(id); if (a && this.on.has(a)) a.place(x, z, yaw * DEG); }
      this.gameSpots = spots;
    } else this.gameSpots = null;
    this.bodies.actors = [...this.on];
    for (let k = 0; k < 12; k++) this.bodies.step();   // settle anyone placed into furniture or each other
    const taken = [...this.on].map((a) => a.pos);
    this.extras.populate(sc, this.set, (this.set.seats || []).filter(([x, z]) => !taken.some((p) => Math.hypot(p.x - x, p.z - z) < 0.5)));
    this.ui.setScene(sc);
    // the place's sound and the scene's music bed, quiet under the dialogue
    const place = PLACE[sc.set] || { amb: [], floor: this.set.outdoor ? 'grass' : 'tile' };
    this.floor = place.floor;
    this.sound.ambience(sc.time === 'dream' ? [] : sc.time === 'night' && this.set.outdoor ? [...place.amb.filter((x) => x.name !== 'birds'), { name: 'crickets', vol: 0.5 }] : place.amb);
    this.bed = sceneMood(sc);
    this.sound.startScore(this.bed, { vol: 0.16 });
    this.shotN = 0;
    this.lastSpeaker = null;
    this.cover({ type: 'establish', force: true }, ids.map((i) => this.actor(i)));
  }
  // Opening positions that fit the place and the story: a class sits at its desks facing the teacher at the front,
  // the cafeteria sits at the tables, an audience sits facing the stage, two can take a park bench. Everyone else
  // stands in an arc (rows when it gets crowded) that keeps a conversational 1.4 m between neighbours.
  stageScene(sc, ids) {
    const set = this.set, seats = [...set.seats], placed = new Set();
    const sit = (id, [x, z, yaw]) => { const a = this.actor(id); a.place(x, z, yaw * DEG); a.setBase('Sitting_Idle_Loop', 0); this.show(a); placed.add(id); };
    const teachers = ids.filter((id) => ['teacher', 'vector', 'eggman'].includes(id));
    if (sc.set === 'classroom') {
      for (const id of teachers) { const a = this.actor(id), [x, z, yaw] = set.front; a.place(x + placed.size * 0.8, z, yaw * DEG); this.show(a); placed.add(id); }
      for (const id of ids) if (!placed.has(id) && seats.length) sit(id, seats.shift());
    } else if (sc.set === 'cafeteria' || sc.set === 'stage' || sc.set === 'diner' || sc.set === 'lockerroom' || (sc.set === 'park' && ids.length <= 2)) {
      for (const id of ids) if (seats.length && !['crowd', 'fangirls'].includes(id)) sit(id, seats.shift());
    }
    const rest = ids.filter((id) => !placed.has(id));
    if (!rest.length) return;
    const [cx, cz] = set.spots.center, open = this.director.openDir(V(cx, 0, cz));
    const across = V(open.z, 0, -open.x), gap = 1.4, perRow = Math.max(2, Math.floor((set.bounds.x[1] - set.bounds.x[0]) / gap) - 1);
    rest.forEach((id, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, rest.length - row * perRow), k = i % perRow;
      const off = (k - (inRow - 1) / 2) * gap, bow = Math.abs(off) * 0.25;   // a shallow arc that opens toward the camera side
      const p = V(cx, 0, cz).addScaledVector(across, off).addScaledVector(open, -bow - row * 1.3 + (row % 2) * 0).add(across.clone().multiplyScalar(row % 2 ? gap / 2 : 0));
      const a = this.actor(id), q = this.bodies.walkable(p);
      a.place(q.x, q.z, Math.atan2(open.x, open.z));
      this.show(a);
    });
  }

  show(a) { a.root.visible = true; this.on.add(a); if (!a.root.parent) this.scene.add(a.root); this.director.actors = [...this.on, ...this.extras.list]; }
  hide(a) { a.root.visible = false; this.on.delete(a); this.director.actors = [...this.on, ...this.extras.list]; }

  spot(name) {
    const s = this.set.spots[name];
    return s ? { x: s[0], z: s[1], yaw: (s[2] || 0) * DEG, y: s[3] } : null;
  }
  // Put an actor on a named spot; beds and couches use their own pose.
  toSpot(a, name, instant) {
    const s = this.spot(name);
    if (!s) return;
    if (instant) a.place(s.x, s.z, s.yaw);
    if (name === 'bed' || s.y > 0.55) this.lie(a, s);
    else if (s.y != null) { a.setBase('Sitting_Idle_Loop', 0); }
  }
  lie(a, s) {
    const p = s || { x: a.pos.x, z: a.pos.z, yaw: a.yaw };
    a.place(p.x, p.z, p.yaw);
    a.play('Death01', { hold: true, fade: 0.01 });
    a.lieOn = p;
    a.root.position.y = (p.y || 0) * 0.85;
  }
  // Get up; off a bed, step out to the side nearest the middle of the room.
  unlie(a) {
    const p = a.lieOn;
    if (!p) return;
    a.root.position.y = 0; a.lieOn = null;
    if (p.y) {
      const [cx] = this.set.spots.center;
      a.place(p.x + (cx >= p.x ? 0.95 : -0.95), p.z + 0.4, a.yaw);
    }
    return this.playClip(a, 'LayToIdle');
  }

  // A spot near the middle of the set that is as far as possible from everyone already on stage.
  freeSlot(a) {
    const [cx, cz] = this.set.spots.center;
    let best = V(cx, 0, cz), bestD = -1;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2, p = V(cx + Math.sin(ang) * 1.5, 0, cz + Math.cos(ang) * 1.1);
      const B = this.set.bounds;
      if (p.x < B.x[0] + 0.6 || p.x > B.x[1] - 0.6 || p.z < B.z[0] + 0.6 || p.z > B.z[1] - 0.6) continue;
      const d = Math.min(...[...this.on].filter((o) => o !== a).map((o) => o.pos.distanceTo(p)), 9);
      if (d > bestD && this.bodies.clear(p, a)) { bestD = d; best = p; }
    }
    return best;
  }

  // Where an actor should stand to be next to a target (an actor, spot or 'off').
  near(a, target, dist = 1.5) {
    if (target === 'off' || target === 'door') { const [x, z] = this.set.door; return V(x, 0, z); }
    const s = this.spot(target); if (s) return this.bodies.keepOut(V(s.x, 0, s.z), 0.3);
    const b = this.actor(target);
    if (!b) return null;
    this.bodies.actors = [...this.on];
    return this.bodies.spotNear(a, b.pos, dist);
  }

  // ------------------------------------------------------------------ beats
  async beat(b, tok) {
    if (!b.text && !b.cap && !b.card && !b.song) this.ui.caption('');   // a beat with no words clears the last line
    if (b.say || b.think) return this.line(b);
    if (b.do) return this.act(b.who, b.do, b);
    if (b.enter) return this.enter(b);
    if (b.exit) return this.exit(b);
    if (b.sfx) {
      if (b.cap) this.ui.caption(b.cap, { sfx: true });
      const d = this.sound.sfx(b.sfx);
      if (b.sfx === 'punch' || b.sfx === 'thud') this.director.shake = 0.25;
      await this.hold(Math.max(d, b.cap ? 1.4 : 0.3));
      this.ui.caption('');
      return;
    }
    if (b.card) { this.ui.caption(''); await this.ui.card(b.card, b.dur || 2.6); return; }
    if (b.song) return this.song(b, tok);
    if (b.fx) return this.fx(b.fx);
    if (b.wait) return this.hold(b.wait);
    if (b.shot) return this.cover(b.shot, (b.shot.subjects || []).map((i) => this.actor(i)).filter(Boolean));
  }

  async line(b) {
    const id = b.say || b.think;
    let a = this.actor(id);
    const member = this.castInfo(id);
    const offstage = a && !this.on.has(a);   // a voice from off screen: heard, not seen
    if (offstage) a = null;
    const listener = b.to ? this.actor(b.to) : a ? this.nearestOther(a) : null;
    if (a) {
      if (listener && !a.path && !a.lieOn) a.faceTo(listener);
      // the listener turns their body to the speaker too (slower, a reaction), not just their head
      if (listener && listener !== a && !listener.path && !listener.lieOn && !listener.oneShot) listener.faceTo(a, 3);
      for (const o of this.on) if (o !== a && !o.lieOn) o.lookAt(a);
      if (listener) a.lookAt(listener);
      if (b.emote) this.emote(a, b.emote);
    }
    const text = b.text;
    this.ui.caption(text, { who: member, think: !!b.think });
    if ((id === 'crowd' || id === 'fangirls') && this.extras.list.length) this.extras.cheer(readTime(text));
    const shout = /!/.test(text) && speakable(text) === speakable(text).toUpperCase() && /[A-Z]/.test(text);
    this.coverLine(a, listener, { shout, moving: !!b.do && /walk|run/.test(b.do) });
    const acting = b.do && a ? this.act(id, b.do, { ...b, inline: true }) : null;
    this.sound.duck(true); this.talking = true;
    await Promise.race([
      this.voices.say(text, member, b.think ? null : a, { shout, whisper: !!b.think }),
      this.waitSkip(),
    ]);
    this.sound.duck(false); this.talking = false; this.quietSince = performance.now();
    if (acting && b.wait !== false && /walk|run|enter|exit/.test(b.do)) await Promise.race([acting, this.waitSkip()]);
    await this.hold(0.22);
    this.lastSpeaker = a;
  }

  async act(id, what, b = {}) {
    const a = this.actor(id);
    if (!a) return;
    if (!this.on.has(a)) this.show(a);
    if (b.cap && !b.inline) this.ui.caption(b.cap, { who: this.castInfo(id), action: true });
    if (!b.inline && b.shot !== false) this.coverAction(a, what, b.to);
    if (a.lieOn && !/lie|sleep|wake|getup/.test(what)) await this.unlie(a);
    if (a.baseClip.startsWith('Sitting') && /walk|run|approach|hug|kiss|punch|jab|slap|push|exit/.test(what)) await this.standUp(a);
    if (what === 'walk' || what === 'run' || what === 'approach') {
      const dest = this.near(a, b.to || this.nearestOther(a)?.id, b.close || 1.5);
      if (dest) await this.go(a, dest, { speed: what === 'run' ? 3.6 * (this.castInfo(id).run || 1) : a.walkSpeed, face: b.to && this.actor(b.to) ? this.actor(b.to).pos : null });
      if (b.to === 'off') this.hide(a);
    } else if (what === 'turn' || what === 'face') {
      const t = b.to ? (this.actor(b.to)?.pos || this.near(a, b.to)) : null;
      if (t) a.faceTo(t); else a.faceYaw(a.yaw + Math.PI);
      await this.hold(0.6);
    } else if (what === 'wake' || what === 'getup') {
      if (a.lieOn) await this.unlie(a); else await this.playClip(a, 'LayToIdle');
    } else {
      const A = ACTS[what] || { emote: EMOTES[what] ? what : null };
      const tgt = b.to ? this.actor(b.to) : null;
      if (A.close && tgt) {
        a.contact = tgt.id; setTimeout(() => { if (a.contact === tgt.id) a.contact = null; }, 5000);   // bodies may touch
        const p = V().copy(tgt.pos).add(V().subVectors(a.pos, tgt.pos).setY(0).setLength(A.close));
        await this.go(a, p, { face: tgt.pos }); a.faceTo(tgt); tgt.faceTo(a);
      }
      if (A.lie) { this.lie(a, this.spot('bed') && /bed/.test(b.cap || b.to || '') ? this.spot('bed') : null); if (A.mood) a.mood = { ...A.mood }; }
      if (A.mood) a.mood = { ...a.mood, ...A.mood };
      if (A.emote) this.emote(a, A.emote, A.amount);
      if (A.hop) a.hopFor(0.8, A.hop);
      if (A.sfx) this.sound.sfx(A.sfx);
      if (A.gesture) a.gesture(A.gesture, { target: tgt ? tgt.eyePos(V()) : null, dur: 2.2 });
      if (A.base) a.setBase(A.base);
      if (what === 'throw' && this.gameSpots) {
        if (tgt) a.faceTo(tgt);
        a.play('OverhandThrow');
        await this.game.throw(a, tgt);
        if (tgt) { this.sound.sfx('thud'); tgt.play('Hit_Chest'); this.emote(tgt, 'surprised', 0.8); this.director.shake = 0.15; }
        if (b.cap && !b.inline) this.ui.caption('');
        return;
      }
      if (A.clip) {
        if (tgt) a.faceTo(tgt);
        const p = A.hold ? a.play(A.clip, { hold: true }) : this.playClip(a, A.clip, { loops: A.loops || 1 });
        if (A.hit && tgt) setTimeout(() => { this.sound.sfx('punch'); this.director.shake = 0.3; tgt.play(A.hit); this.emote(tgt, 'angry', 0.6); }, 380);
        if (!A.hold && !b.inline) await Promise.race([p, this.waitSkip()]);
        else if (A.hold && !b.inline) await this.hold(1.0);
      } else if (!b.inline) await this.hold(b.cap ? Math.max(1.2, readTime(b.cap) * 0.6) : 0.8);
    }
    if (b.cap && !b.inline) this.ui.caption('');
  }

  async enter(b) {
    const a = this.actor(b.enter);
    if (!a) return;
    const [x, z, yaw] = this.set.door;
    a.place(x, z, yaw * DEG);
    const gs = this.gameSpots?.[b.enter];
    const to = gs ? V(gs[0], 0, gs[1]) : b.to ? this.near(a, b.to, 1.3) : this.freeSlot(a);
    // come in from the door's direction, but never from further than a few steps away
    if (this.set.outdoor) { const from = V(x, 0, z).sub(to); if (from.length() > 4) { from.setLength(4); a.place(to.x + from.x, to.z + from.z, Math.atan2(-from.x, -from.z)); } }
    else this.sound.sfx('door');
    this.show(a);
    a.setBase('Idle_Loop', 0);
    if (b.cap) this.ui.caption(b.cap, { who: this.castInfo(b.enter), action: true });
    this.cover({ type: 'track', subjects: [a] }, [a]);
    await this.go(a, to, { speed: b.run ? 3.6 : a.walkSpeed });
    if (b.cap) this.ui.caption('');
  }
  async exit(b) {
    const a = this.actor(b.exit);
    if (!a || !this.on.has(a)) return;
    if (b.cap) this.ui.caption(b.cap, { who: this.castInfo(b.exit), action: true });
    if (a.lieOn) await this.unlie(a);
    await this.standUp(a);
    const [x, z] = this.set.door;
    this.go(a, V(x, 0, z), { speed: b.run ? 3.6 : a.walkSpeed }).then(() => { if (!this.set.outdoor) this.sound.sfx('door'); this.hide(a); });
    await this.hold(b.run ? 1.2 : 2.0);
    if (b.cap) this.ui.caption('');
  }

  // A song montage: letterboxed, wordless, the mood's music, and a slow shot of each person on stage in turn.
  // Nobody on stage means nothing to show, so it is skipped. Runs of song beats were merged by the scene cleanup.
  async song(b, tok) {
    const subj = [...this.on];
    if (!subj.length) return;
    this.ui.caption('');
    this.ui.letterbox(true, '');
    this.sound.startScore(b.song);
    const dur = Math.min(b.dur || 8, MONTAGE_MAX), shots = ['orbit', 'mcu', 'two', 'low', 'wide'];
    for (let t = 0, i = 0; t < dur && tok === this.token && !this.skipLine; t += 3.2, i++) {
      const a = subj[i % subj.length], other = subj[(i + 1) % subj.length];
      const type = subj.length > 1 && i % 3 === 2 ? 'two' : shots[i % shots.length];
      this.cover({ type, subjects: type === 'two' || type === 'orbit' ? [a, other].filter((x, k, l) => l.indexOf(x) === k) : [a], toward: other !== a ? other : null, force: true }, [a]);
      if (b.song === 'love' || b.song === 'happy') this.emote(a, 'happy', 0.6); else if (b.song === 'sad') this.emote(a, 'sad', 0.7);
      await this.hold(Math.min(3.2, dur - t));
    }
    this.sound.startScore(this.bed || 'happy', { vol: 0.16 });   // back to the scene's quiet bed
    this.ui.letterbox(false);
  }

  // A part's opening montage becomes a title card over the intro music.
  async titleCard(part) {
    this.sound.startScore('title', { vol: 0.7 });
    await this.ui.card(`Part ${part.part}\n${part.title || ''}`, 3.6);
    this.sound.startScore(this.bed || 'happy', { vol: 0.16 });
  }

  async fx(kind) {
    if (kind === 'shake') { this.director.shake = 0.5; return this.hold(0.5); }
    if (kind === 'flash' || kind === 'fadeout' || kind === 'fadein' || kind === 'dream') return this.ui.fade(kind);
  }

  emote(a, name, amount = 1) {
    const mix = EMOTES[name] || ACTS[name]?.emote && EMOTES[ACTS[name].emote] || {};
    for (const [k, v] of Object.entries(mix)) a.emote(k, v * amount, 3.0);
  }

  // ------------------------------------------------------------------ camera
  cover(spec, subjects) { this.director.cut({ ...spec, subjects: spec.subjects?.[0]?.pos ? spec.subjects : subjects }); this.shotN++; }
  // Coverage for a line, following standard dialogue grammar: a two shot opens an exchange between a pair,
  // over the shoulder reverses carry it, and once it runs on it pushes in to singles (internal reverses).
  // A run of lines by one speaker holds the shot; a shout punches in; walking lines track; bigger groups get a
  // wide shot now and then to re-establish who is where.
  coverLine(a, listener, { shout, moving }) {
    if (!a) return;
    const n = this.shotN, others = [...this.on].filter((o) => o !== a);
    const pair = listener ? [a.id, listener.id].sort().join('|') : a.id;
    if (pair !== this.pairKey) { this.pairKey = pair; this.pairN = 0; } else this.pairN++;
    const k = this.pairN;
    let spec;
    if (moving) spec = { type: 'track', subjects: [a] };
    else if (shout && k > 0 && n % 2 === 0) spec = { type: n % 4 === 0 ? 'cu' : 'low', subjects: [a] };
    else if (this.lastSpeaker === a && k % 3 !== 0) return;
    else if (!listener) spec = { type: 'mcu', subjects: [a] };
    else if (k === 0) spec = others.length >= 2 && n % 3 === 0 ? { type: 'wide', subjects: [...this.on] } : { type: 'two', subjects: [a, listener] };
    else if (k < 4) spec = { type: 'ots', subjects: [listener, a] };
    else if (others.length >= 2 && k % 7 === 0) spec = { type: 'wide', subjects: [...this.on] };
    else spec = k % 3 === 0 ? { type: 'ots', subjects: [listener, a] } : { type: 'mcu', subjects: [a], toward: listener };
    this.cover(spec, spec.subjects);
  }
  coverAction(a, what, to) {
    const tgt = to && this.actor(to);
    if (/walk|run|approach/.test(what)) this.cover({ type: 'track', subjects: [a], force: true }, [a]);
    else if (/punch|jab|slap|hug|kiss/.test(what) && tgt) this.cover({ type: 'two', subjects: [a, tgt], force: true }, [a, tgt]);
    else if (/fall|faint|lie|sleep|wake|getup|sit|stand/.test(what)) this.cover({ type: 'wide', subjects: [a] }, [a]);
    else this.cover({ type: 'mcu', subjects: [a] }, [a]);
  }

  // ------------------------------------------------------------------ helpers
  // Play a one-shot clip and wait for it, but never longer than the clip plus a second, and not past a skip: a hidden
  // actor does not animate, so its clip would otherwise never finish.
  playClip(a, name, opts) {
    const clip = a.clips[name], limit = (clip ? clip.duration : 1) + 1;
    return Promise.race([a.play(name, opts), this.waitSkip(), sleep(limit)]);
  }
  async standUp(a) { if (a.baseClip.startsWith('Sitting')) { a.setBase('Idle_Loop'); if (a.root.visible) await this.playClip(a, 'Sitting_Exit'); } }

  // Walk somewhere; "next line" lands the actor at the destination instead of waiting out the walk.
  // Walks route around anyone in the way and give up after a generous time (a blocked path never stalls the film).
  async go(a, dest, opts = {}) {
    this.bodies.actors = [...this.on];
    const pts = this.bodies.route(a, dest), speed = opts.speed || a.walkSpeed;
    const len = pts.reduce((n, p, i) => n + p.distanceTo(i ? pts[i - 1] : a.pos), 0);
    const limit = sleep(len / speed * 1.8 + 1.5).then(() => false);
    this.stats.walks++;
    const done = await Promise.race([a.walk(pts, opts).then(() => true), this.waitSkip().then(() => false), limit.then(() => { this.stats.timeouts++; return false; })]);
    if (!done) { a.path = null; a.place(dest.x, dest.z, opts.face ? Math.atan2(opts.face.x - dest.x, opts.face.z - dest.z) : a.yaw); }
  }

  castInfo(id) { return this.info.get(id) || { id, name: id, voice: {} }; }
  nearestOther(a) {
    let best = null, bd = 1e9;
    for (const o of this.on) { if (o === a) continue; const d = o.pos.distanceTo(a.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  async hold(s) { const end = performance.now() + s * 1000; while (performance.now() < end && !this.skipLine) { await sleep(0.05); await this.gate(); } }
  waitSkip() { return this.skipP; }
}
