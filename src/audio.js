// Synthesized sound: effects for the story's onomatopoeia and a mood score for the song montages.
// Everything is generated with Web Audio, so the page carries no audio files.

const NOTE = (m) => 440 * 2 ** ((m - 69) / 12);

// Chord progressions per mood (MIDI roots with minor/major triads), tempo in beats per minute.
const MOODS = {
  sad: { bpm: 72, prog: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], lead: true },
  love: { bpm: 80, prog: [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], lead: true },
  happy: { bpm: 118, prog: [[48, 'M'], [53, 'M'], [55, 'M'], [48, 'M']], drums: true },
  tense: { bpm: 96, prog: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M']], drums: true },
  dream: { bpm: 64, prog: [[53, 'M'], [52, 'm'], [50, 'm'], [48, 'M']] },
};
const TRIAD = { M: [0, 4, 7], m: [0, 3, 7] };

export class Sound {
  constructor() { this.ctx = null; this.timer = null; this.volume = 0.8; }

  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    this.ctx = new C();
    this.out = this.ctx.createGain(); this.out.gain.value = this.volume; this.out.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.out);
    const len = this.ctx.sampleRate * 2.2, ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    this.verb = this.ctx.createConvolver(); this.verb.buffer = ir;
    const vg = this.ctx.createGain(); vg.gain.value = 0.35; this.verb.connect(vg); vg.connect(this.out);
    return this.ctx;
  }
  // Where baked voice lines play: its own gain into the master, with a light room reverb send.
  voiceBus() {
    this.ensure();
    if (!this.voice) {
      this.voice = this.ctx.createGain(); this.voice.gain.value = 1; this.voice.connect(this.out);
      const send = this.ctx.createGain(); send.gain.value = 0.08; this.voice.connect(send); send.connect(this.verb);
    }
    return this.voice;
  }
  pause() { this.ctx?.state === 'running' && this.ctx.suspend(); }
  resume() { this.ctx?.state === 'suspended' && this.ctx.resume(); }

  tone(f, t, dur, { type = 'sine', vol = 0.1, to = this.out, attack = 0.01, verb = 0.3, bend = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * bend), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(to);
    if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, { vol = 0.2, freq = 1200, type = 'bandpass', to = this.out, q = 1 } = {}) {
    const c = this.ctx, n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(to); s.start(t);
  }

  // One-shot effects named in the script.
  sfx(name) {
    if (!this.ensure()) return 0;
    const t = this.ctx.currentTime + 0.02;
    const fx = {
      bell: () => { for (let i = 0; i < 18; i++) this.tone(i % 2 ? 1320 : 1180, t + i * 0.09, 0.14, { type: 'square', vol: 0.05, verb: 0.2 }); return 1.8; },
      alarm: () => { for (let i = 0; i < 8; i++) this.tone(980, t + i * 0.22, 0.12, { type: 'square', vol: 0.06 }); return 1.9; },
      punch: () => { this.noise(t, 0.16, { vol: 0.6, freq: 260, type: 'lowpass' }); this.tone(110, t, 0.18, { vol: 0.35, bend: 0.4, verb: 0 }); return 0.4; },
      thud: () => { this.tone(70, t, 0.35, { vol: 0.5, bend: 0.5, verb: 0.1 }); this.noise(t, 0.12, { vol: 0.25, freq: 180, type: 'lowpass' }); return 0.5; },
      door: () => { this.noise(t, 0.08, { vol: 0.3, freq: 900 }); this.tone(160, t + 0.05, 0.2, { vol: 0.2, bend: 0.7 }); return 0.5; },
      knock: () => { for (let i = 0; i < 3; i++) this.tone(180, t + i * 0.18, 0.08, { vol: 0.4, verb: 0.05 }); return 0.7; },
      phone: () => { for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) this.tone(i % 2 ? 1400 : 1700, t + r * 1.1 + i * 0.05, 0.05, { type: 'triangle', vol: 0.06 }); return 2.2; },
      crowd: () => { for (let i = 0; i < 6; i++) this.noise(t + i * 0.12, 1.4, { vol: 0.12, freq: 900 + Math.random() * 700, q: 0.6 }); return 1.8; },
      whoosh: () => { this.noise(t, 0.5, { vol: 0.3, freq: 1600, q: 0.8 }); return 0.5; },
      sparkle: () => { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(NOTE(84 + s), t + i * 0.06, 0.5, { type: 'triangle', vol: 0.05, verb: 0.6 })); return 0.8; },
      gasp: () => { this.noise(t, 0.35, { vol: 0.15, freq: 2500, q: 0.7 }); return 0.4; },
      brush: () => { for (let i = 0; i < 6; i++) this.noise(t + i * 0.14, 0.1, { vol: 0.12, freq: 4200, q: 1.5 }); return 0.9; },
      spit: () => { this.noise(t, 0.12, { vol: 0.2, freq: 3000 }); return 0.3; },
      zap: () => { this.tone(1800, t, 0.4, { type: 'sawtooth', vol: 0.06, bend: 0.1 }); return 0.4; },
    }[name];
    return fx ? fx() : 0;
  }

  // ---- recorded samples: footsteps and ambience loops (assets/sfx, embedded by the build as base64 mp3)
  setSamples(bank) { this.sampleData = bank || {}; this.samples = new Map(); }
  sample(name) {
    if (!this.sampleData?.[name] || !this.ensure()) return Promise.resolve(null);
    if (!this.samples.has(name)) {
      const raw = atob(this.sampleData[name]), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      this.samples.set(name, this.ctx.decodeAudioData(bytes.buffer).catch(() => null));
    }
    return this.samples.get(name);
  }
  bus(name, level) {
    this.ensure();
    this[name] ??= (() => { const g = this.ctx.createGain(); g.gain.value = level; g.connect(this.out); return g; })();
    return this[name];
  }
  // One footstep on a surface (tile, wood, grass); vol 0..1, pan -1..1.
  step(surface, vol = 0.5, pan = 0) {
    const names = Object.keys(this.sampleData || {}).filter((n) => n.startsWith('step-' + surface + '-'));
    if (!names.length) return;
    this.sample(names[(Math.random() * names.length) | 0]).then((buf) => {
      if (!buf) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain(), p = this.ctx.createStereoPanner();
      src.buffer = buf; src.playbackRate.value = 0.92 + Math.random() * 0.16;
      g.gain.value = vol; p.pan.value = pan;
      src.connect(g); g.connect(p); p.connect(this.bus('stepBus', 0.55)); src.start();
      this.steps = (this.steps || 0) + 1;
    });
  }

  // Ambience for a place: recorded loops by name plus synthesized birds, crickets or traffic. Fades between sets.
  ambience(list = []) {
    if (!this.ensure()) return;
    const bus = this.bus('ambBus', 0.5), t = this.ctx.currentTime;
    for (const old of this.amb || []) { try { old.gain.gain.setTargetAtTime(0, t, 0.4); old.stop?.(t + 2); } catch { /* gone */ } }
    for (const id of this.ambTimers || []) clearInterval(id);
    this.ambTimers = [];
    this.amb = [];
    for (const { name, vol = 0.5 } of list) {
      const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, t, 0.6); g.connect(bus);
      if (['birds', 'crickets', 'traffic', 'dancebeat', 'squeak', 'rainfall'].includes(name)) { this.amb.push({ gain: g }); this.synthAmb(name, g); continue; }
      this.sample(name).then((buf) => {
        if (!buf || !this.amb.some((x) => x.gain === g)) return;
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(g);
        src.start(this.ctx.currentTime, Math.random() * buf.duration);
        const slot = this.amb.find((x) => x.gain === g); slot.stop = (when) => src.stop(when);
      });
      this.amb.push({ gain: g });
    }
  }
  synthAmb(kind, to) {
    const tick = () => {
      const t = this.ctx.currentTime + Math.random() * 0.5;
      if (kind === 'birds' && Math.random() < 0.5) { const f = 2400 + Math.random() * 1800; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) this.tone(f * (1 + i * 0.04), t + i * 0.09, 0.07, { type: 'sine', vol: 0.05, to, bend: 1.25, verb: 0.3 }); }
      if (kind === 'crickets') for (let i = 0; i < 6; i++) this.tone(4300, t + i * 0.045, 0.025, { type: 'square', vol: 0.012, to, verb: 0.2 });
      if (kind === 'dancebeat') {   // the dance next door: a muffled four on the floor with a bass line
        const beat = 60 / 124;
        for (let i = 0; i < 4; i++) { this.tone(55, t + i * beat, 0.22, { vol: 0.32, bend: 0.5, to, verb: 0.1 }); this.tone([82, 82, 98, 73][i], t + i * beat + beat / 2, 0.18, { type: 'triangle', vol: 0.1, to, verb: 0.1 }); }
        if (Math.random() < 0.6) this.noise(t + beat, 0.04, { vol: 0.05, freq: 1500, to });
      }
      if (kind === 'rainfall') { this.noise(t, 1.2, { vol: 0.16, freq: 5200, type: 'highpass', to }); this.noise(t + 0.3, 1.2, { vol: 0.1, freq: 900, to, q: 0.4 }); }
      if (kind === 'squeak' && Math.random() < 0.35) this.tone(1900 + Math.random() * 900, t, 0.09, { type: 'sawtooth', vol: 0.025, to, bend: 1.3, verb: 0.3 });
      if (kind === 'traffic' && Math.random() < 0.3) this.noise(t, 2.5, { vol: 0.05, freq: 300 + Math.random() * 200, type: 'lowpass', to });
    };
    this.ambTimers.push(setInterval(tick, kind === 'crickets' ? 700 : kind === 'dancebeat' ? (60 / 124) * 4000 : kind === 'rainfall' ? 600 : 900));
  }
  // Raise a quiet bed when the scene has no dialogue for a while; back down when someone talks.
  swell(on) {
    if (!this.ctx || !this.bedLevel || this.swelling === on) return;
    this.swelling = on;
    this.music.gain.setTargetAtTime(on ? Math.min(0.55, this.bedLevel * 2.6) : this.bedLevel, this.ctx.currentTime, on ? 0.8 : 0.25);
  }
  // Lower music and ambience while someone talks.
  duck(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bus('ambBus', 0.5).gain.setTargetAtTime(on ? 0.28 : 0.5, t, 0.15);
    if (this.bedLevel) this.music.gain.setTargetAtTime(on ? this.bedLevel * 0.6 : this.bedLevel, t, 0.2);
  }

  // Music beds (Kevin MacLeod, CC BY 4.0) embedded by the build as base64 mp3 by mood; decoded on first use.
  setTracks(bank) { this.trackData = bank || {}; this.tracks = new Map(); }
  async track(mood) {
    if (!this.trackData?.[mood]) return null;
    if (!this.tracks.has(mood)) {
      const raw = atob(this.trackData[mood]), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      this.tracks.set(mood, this.ctx.decodeAudioData(bytes.buffer));
    }
    return this.tracks.get(mood);
  }

  // Start the music for a mood, fading in: the real track when the page has one, else the synthesized score.
  async startScore(mood = 'sad', { from = 0, vol = 0.85 } = {}) {
    this.bedLevel = vol < 0.5 ? vol : 0;   // quiet beds duck under voices; montages do not
    this.swelling = false;
    if (!this.ensure()) return;
    this.stopScore(true);
    const want = (this.scoreWant = Symbol());
    const buf = await this.track(mood).catch(() => null);
    if (want !== this.scoreWant) return;   // stopped or replaced while decoding
    if (buf) {
      const t = this.ctx.currentTime, src = this.ctx.createBufferSource(), g = this.music.gain;
      src.buffer = buf; src.loop = true; src.connect(this.music);
      g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(vol, t + 1.2);
      src.start(t, from % buf.duration);
      this.playing = src;
      return;
    }
    this.synthScore(mood);
  }

  synthScore(mood) {
    this.stopScore(true);
    const M = MOODS[mood] || MOODS.sad, beat = 60 / M.bpm;
    let bar = 0, next = this.ctx.currentTime + 0.1;
    const g = this.music.gain; g.cancelScheduledValues(next); g.setValueAtTime(g.value, next); g.linearRampToValueAtTime(0.9, next + 2);
    const schedule = () => {
      while (next < this.ctx.currentTime + 1.5) {
        const [root, q] = M.prog[bar % M.prog.length];
        TRIAD[q].forEach((s) => this.tone(NOTE(root + s + 12), next, beat * 4.2, { type: 'triangle', vol: 0.035, to: this.music, attack: 0.4, verb: 0.6 }));
        this.tone(NOTE(root - 12), next, beat * 3.8, { type: 'sine', vol: 0.09, to: this.music, attack: 0.05, verb: 0.2 });
        for (let i = 0; i < 8; i++) {   // broken chord, the "emo piano" bit
          const s = TRIAD[q][[0, 1, 2, 1, 0, 2, 1, 2][i]] + (i > 3 ? 12 : 0);
          this.tone(NOTE(root + 24 + s), next + i * beat / 2, beat * 1.4, { type: 'sine', vol: 0.03, to: this.music, verb: 0.7 });
        }
        if (M.lead && bar % 2 === 1) this.tone(NOTE(root + 36 + TRIAD[q][2]), next + beat, beat * 2.5, { type: 'triangle', vol: 0.025, to: this.music, attack: 0.2, verb: 0.8 });
        if (M.drums) for (let i = 0; i < 4; i++) {
          this.tone(60, next + i * beat, 0.2, { vol: i % 2 ? 0 : 0.18, bend: 0.5, to: this.music, verb: 0 });
          if (i % 2) this.noise(next + i * beat, 0.15, { vol: 0.08, freq: 1800, to: this.music });
          this.noise(next + i * beat + beat / 2, 0.04, { vol: 0.03, freq: 7000, type: 'highpass', to: this.music });
        }
        next += beat * 4; bar++;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 400);
  }
  stopScore(now = false) {
    if (!this.ctx) return;
    this.scoreWant = null;
    clearInterval(this.timer); this.timer = null;
    const g = this.music.gain, t = this.ctx.currentTime, fade = now ? 0.05 : 1.5;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + fade);
    if (this.playing) { const p = this.playing; this.playing = null; try { p.stop(t + fade + 0.05); } catch { /* already stopped */ } }
  }
}
