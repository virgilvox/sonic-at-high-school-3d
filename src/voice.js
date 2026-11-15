// Voices. Three modes:
//   kyutai  (default when the page carries a baked bank): each line was generated ahead of time with Kyutai Pocket
//           TTS (tools/voices/bake.py) and is played through Web Audio; the mouth follows the clip's loudness.
//   browser the browser's own speech synthesis, live. Each character gets a system voice, pitch and rate, and any
//           of those can be swapped in the voice panel (src/voicepanel.js).
//   off     captions only, lines held for a reading time.
// A line missing from the bank falls back to the browser so nothing is ever silent by accident.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Name hints for picking a voice by gender across macOS, Windows, ChromeOS and Android voice lists.
const FEMALE = /samantha|victoria|karen|moira|tessa|fiona|veena|zira|susan|hazel|female|aria|jenny|libby|sonia|serena|allison|ava|nicky|kathy|princess|vicki/i;
const MALE = /alex|daniel|fred|tom|aaron|arthur|oliver|rishi|gordon|david|mark|george|male|guy|ryan|thomas|bruce|ralph|junior|albert|reed|eddy|rocko/i;
// macOS joke voices: only for characters that ask for them (voice.robot), never a fallback for a person.
const NOVELTY = /fred|albert|zarvox|bad news|good news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|junior|ralph|kathy|princess|vicki|bahh|hysterical/i;
// Natural-sounding voices first: neural and enhanced voices, then the classic macOS and Google ones.
const quality = (v) => (/natural|neural|premium|enhanced/i.test(v.name) ? 3 : /google|samantha|alex|daniel|karen|moira|serena|ava|allison/i.test(v.name) ? 2 : 1);
const STORE = 'love-story.voices';

export function speakable(text) {
  return text
    .replace(/\*[^*]*\*?/g, ' ')                 // stage directions are acted, not read
    .replace(/\(([^)]*)\)/g, ' ')                // asides in brackets too
    .replace(/([a-z])\1{2,}/gi, (m, c) => (/[aeiou]/i.test(c) ? c + c : c))   // SOOONNIIICCC -> SOONIC
    .replace(/\b[A-Z][A-Z'!?.,]{3,}\b/g, (w) => w.toLowerCase())               // shouting is not an acronym
    .replace(/\s+/g, ' ')
    .trim();
}

// The key a baked line is stored under: speaker id plus the exact spoken text (FNV-1a, hex). tools/voices/jobs.mjs
// uses this same function, so the bake and the player always agree.
export function keyOf(speaker, text) {
  let h = 0x811c9dc5;
  for (const c of speaker + '|' + text) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Roughly how long a line takes to read, used when speech is off and as a watchdog when it is on.
export function readTime(text, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.1, (words / 2.7) / rate + 0.35);
}

export class Voices {
  // sound: the Sound instance (its AudioContext plays baked lines). bank: { key: base64 mp3 } or null.
  constructor({ sound, bank = null, cast = [] } = {}) {
    this.sound = sound;
    this.bank = bank && Object.keys(bank).length ? bank : null;
    this.buffers = new Map();       // decoded clips, a small cache
    this.list = [];                 // system voices (English)
    this.assigned = new Map();      // character id -> system voice
    this.current = null;
    this.cast = cast;
    const saved = load();
    this.mode = saved.mode && (saved.mode !== 'kyutai' || this.bank) ? saved.mode : this.bank ? 'kyutai' : synth ? 'browser' : 'off';
    this.overrides = saved.overrides || {};   // id -> { voice: name, pitch, rate }
    if (synth) {
      const refresh = () => { this.list = synth.getVoices().filter((v) => /^en/i.test(v.lang)); this.assignAll(); this.onVoices?.(); };
      refresh();
      synth.addEventListener?.('voiceschanged', refresh);
    }
  }

  // The baked Kyutai bank arrives after construction (it may be fetched); Kyutai becomes the default unless the
  // viewer picked another mode before.
  setBank(bank) {
    this.bank = bank && Object.keys(bank).length ? bank : null;
    if (this.bank && !load().mode) this.mode = 'kyutai';
    if (!this.bank && this.mode === 'kyutai') this.mode = synth ? 'browser' : 'off';
  }

  get modes() { return [...(this.bank ? ['kyutai'] : []), ...(synth ? ['browser'] : []), 'off']; }
  setMode(m) { if (this.modes.includes(m)) { this.stop(); this.mode = m; this.save(); } }
  // Browser-mode settings for one character: the override if set, otherwise the cast defaults.
  settings(member) {
    const o = this.overrides[member.id] || {}, d = member.voice || {};
    return { voice: o.voice || this.voiceFor(member)?.name || '', pitch: o.pitch ?? d.pitch ?? 1, rate: o.rate ?? d.rate ?? 1 };
  }
  override(id, patch) { this.overrides[id] = { ...this.overrides[id], ...patch }; this.save(); }
  resetOverrides() { this.overrides = {}; this.save(); }
  save() { try { localStorage.setItem(STORE, JSON.stringify({ mode: this.mode, overrides: this.overrides })); } catch { /* private window */ } }

  // Give the whole cast voices in cast order, so the leads get the best ones. Same machine, same voices.
  assignAll() { this.assigned.clear(); for (const m of this.cast) if (!m.extra && !m.costume) this.voiceFor(m); }

  voiceFor(member) {
    const forced = this.overrides[member.id]?.voice && this.list.find((v) => v.name === this.overrides[member.id].voice);
    if (forced) return forced;
    if (this.assigned.has(member.id)) return this.assigned.get(member.id);
    if (!this.list.length) return null;
    const V = member.voice || {};
    let v = (V.prefer || []).map((n) => this.list.find((x) => x.name.toLowerCase().startsWith(n.toLowerCase()))).find(Boolean);
    if (!v && V.robot) v = this.list.find((x) => /zarvox|trinoids|fred/i.test(x.name));
    if (!v) {
      const want = V.gender === 'f' ? FEMALE : MALE;
      const people = this.list.filter((x) => !NOVELTY.test(x.name));
      const pool = people.filter((x) => want.test(x.name));
      const any = (pool.length ? pool : people.length ? people : this.list).slice().sort((a, b) => quality(b) - quality(a));
      // least used voice first, best quality among those; pitch and rate keep sharers apart
      const uses = (x) => [...this.assigned.values()].filter((y) => y === x).length;
      v = any.reduce((best, x) => (uses(x) < uses(best) ? x : best), any[0]);
    }
    this.assigned.set(member.id, v);
    return v;
  }

  // Speak one line. Resolves when it finishes or is skipped. actor (optional) gets its mouth driven.
  say(text, member, actor, { shout = false, whisper = false } = {}) {
    this.stop();
    const clean = speakable(text);
    const job = { actor, resolve: null, cancelled: false };
    this.current = job;
    if (!clean || this.mode === 'off') return this.timed(job, clean || text, member);
    const key = keyOf(member.id, clean);
    if (this.mode === 'kyutai' && this.bank?.[key]) return this.baked(job, key);
    if (synth && this.list.length) return this.live(job, clean, member, { shout, whisper });
    return this.timed(job, clean, member);
  }

  // ---- baked Pocket TTS clip
  async clip(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const ctx = this.sound.ensure();
    const raw = atob(this.bank[key]), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const buf = await ctx.decodeAudioData(bytes.buffer);
    this.buffers.set(key, buf);
    if (this.buffers.size > 24) this.buffers.delete(this.buffers.keys().next().value);
    return buf;
  }
  // Decode an upcoming line ahead of time so it starts without a gap.
  prefetch(member, text) {
    const clean = speakable(text);
    const key = clean && keyOf(member.id, clean);
    if (this.mode === 'kyutai' && key && this.bank?.[key]) this.clip(key).catch(() => {});
  }
  baked(job, key) {
    return new Promise((resolve) => {
      const a = job.actor;
      let tick = null, src = null;
      const end = () => { clearInterval(tick); if (a) { a.speaking = false; a.mouth.level = 0; } if (this.current === job) this.current = null; resolve(); };
      job.resolve = () => { job.cancelled = true; try { src?.stop(); } catch { /* not started */ } end(); };
      this.clip(key).then((buf) => {
        if (job.cancelled) return;
        const ctx = this.sound.ensure(), an = ctx.createAnalyser();
        src = ctx.createBufferSource();
        src.buffer = buf; an.fftSize = 512;
        src.connect(an); an.connect(this.sound.voiceBus());
        const data = new Float32Array(an.fftSize);
        if (a) a.speaking = true;
        // the mouth follows the clip: loudness opens it, zero-crossing rate picks a brighter or darker vowel shape
        tick = setInterval(() => {
          if (!a) return;
          an.getFloatTimeDomainData(data);
          let e = 0, zc = 0;
          for (let i = 0; i < data.length; i++) { e += data[i] * data[i]; if (i && (data[i] > 0) !== (data[i - 1] > 0)) zc++; }
          a.mouth.level = Math.min(1, Math.sqrt(e / data.length) * 7);
          a.mouth.shape = Math.min(1, zc / 60);
        }, 33);
        src.onended = end;
        src.start();
      }).catch(end);
    });
  }

  // ---- live browser speech
  live(job, clean, member, { shout, whisper }) {
    const st = this.settings(member), voice = this.voiceFor(member), a = job.actor;
    const rate = st.rate * (shout ? 1.08 : 1);
    let syll = 0;
    const tick = setInterval(() => {   // syllable envelope; word boundary events re-sync it
      if (!a?.speaking) return;
      syll += 0.42 + Math.random() * 0.25;
      a.mouth.level = Math.max(0, Math.sin(syll * Math.PI)) * (shout ? 0.95 : whisper ? 0.35 : 0.7);
      a.mouth.shape = (Math.sin(syll * 1.7) + 1) / 2;
    }, 55);
    return new Promise((resolve) => {
      const finish = () => { job.cancelled = true; clearInterval(tick); if (a) { a.speaking = false; a.mouth.level = 0; } if (this.current === job) this.current = null; resolve(); };
      const chunks = clean.match(/[^.!?]+[.!?]*|[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];
      let i = 0;
      const next = () => {
        if (job.cancelled) return;
        if (i >= chunks.length) return finish();
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (voice) u.voice = voice;
        u.lang = voice?.lang || 'en-US';
        u.rate = rate;
        u.pitch = Math.min(2, st.pitch * (shout ? 1.1 : 1));
        u.volume = whisper ? 0.6 : 1;
        u.onstart = () => { if (a && !job.cancelled) a.speaking = true; };   // a cancelled utterance can still report a late start
        u.onboundary = () => { syll = 0; };
        u.onend = u.onerror = () => { clearTimeout(job.watch); next(); };
        // Chrome sometimes never fires onend; never let the film stall on it
        job.watch = setTimeout(() => { synth.cancel(); next(); }, (readTime(u.text, rate) * 2 + 3) * 1000);
        synth.speak(u);
      };
      job.resolve = () => { job.cancelled = true; clearTimeout(job.watch); synth.cancel(); finish(); };
      next();
    });
  }

  // ---- no voice: hold for a reading time, mouth moving
  timed(job, text, member) {
    const a = job.actor;
    return new Promise((resolve) => {
      if (a) a.speaking = true;
      const t = setTimeout(() => job.resolve(), readTime(text, member.voice?.rate || 1) * 1000);
      job.resolve = () => { clearTimeout(t); if (a) { a.speaking = false; a.mouth.level = 0; } if (this.current === job) this.current = null; resolve(); };
    });
  }

  stop() { const j = this.current; this.current = null; j?.resolve?.(); }
  pause() { synth?.pause(); }
  resume() { synth?.resume(); }
}

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
