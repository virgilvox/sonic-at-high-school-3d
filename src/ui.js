// Page chrome: captions in the original videos' subtitle style, title cards, song letterbox, fades,
// the part picker and the transport bar. Pure DOM; main.js wires the callbacks.
const $ = (id) => document.getElementById(id);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class UI {
  constructor({ parts, onPlay, onPause, onSkip, onPart, onScene, onToggle }) {
    this.parts = parts;
    this.cb = { onPlay, onPause, onSkip, onPart, onScene, onToggle };
    this.cap = $('cap'); this.cardEl = $('card'); this.box = $('letterbox'); this.veil = $('veil');
    this.where = $('where');
    this.buildPicker();
    $('playBtn').onclick = () => this.cb.onPlay(0);
    $('pause').onclick = () => this.cb.onPause();
    $('skip').onclick = () => this.cb.onSkip();
    $('prevScene').onclick = () => this.cb.onScene(-1);
    $('nextScene').onclick = () => this.cb.onScene(1);
    $('menu').onclick = () => this.showPicker(true);
    $('cc').onclick = () => this.cb.onToggle('cc');
    addEventListener('keydown', (e) => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;   // typing in the voice panel
      if (e.code === 'Space') { e.preventDefault(); this.cb.onPause(); }
      else if (e.code === 'ArrowRight') this.cb.onSkip();
      else if (e.code === 'PageDown' || e.key === 'n') this.cb.onScene(1);
      else if (e.code === 'PageUp' || e.key === 'p') this.cb.onScene(-1);
      else if (e.key === 'c') this.cb.onToggle('cc');
      else if (e.code === 'Escape') this.showPicker(true);
    });
  }

  buildPicker() {
    const list = $('parts');
    list.innerHTML = this.parts.map((p, i) => `<button class="part" data-i="${i}"><b>${p.part}</b><span>${esc(p.title || 'Part ' + p.part)}</span></button>`).join('');
    list.onclick = (e) => { const b = e.target.closest('.part'); if (b) this.cb.onPart(+b.dataset.i); };
  }
  showPicker(on) { $('picker').hidden = !on; $('bar').hidden = on; }
  setPlaying(playing) { $('pause').textContent = playing ? 'Pause' : 'Play'; }
  setToggle(name, on) { $(name).classList.toggle('off', !on); }
  setWhere(part, si, n) { this.where.textContent = `Part ${part.part}  ·  scene ${si + 1} of ${n}`; }
  setScene() {}

  // Subtitles look like the source: white blocky text with a dark outline; speakers keep a colour.
  caption(text, { who, think, action, sfx, song } = {}) {
    if (!text) { this.cap.innerHTML = ''; return; }
    const html = esc(text).replace(/\*([^*]+)\*?/g, '<i>*$1*</i>');
    const cls = think ? 'think' : action ? 'action' : sfx ? 'sfx' : song ? 'song' : '';
    const col = who?.color && !sfx ? ` style="--c:${who.color}"` : '';
    const name = who?.name && !action && !sfx && !song && this.names ? `<small>${esc(who.name)}</small>` : '';
    this.cap.innerHTML = `<div class="line ${cls}"${col}>${name}${html}</div>`;
  }

  // The opening: hack.build presents, then the 16-bit title screen.
  async intro(seconds = 7.5) {
    const el = document.getElementById('intro');
    el.hidden = false;
    for (const n of el.querySelectorAll('*')) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
    await sleep(seconds);
    el.hidden = true;
  }
  // A Sonic 2 style act card for a part: bands sweep in with the part's name as a zone, hold, sweep out.
  async actCard(n, title, hold = 2.6) {
    const el = document.getElementById('act');
    el.querySelector('.aname').textContent = (title || '').toUpperCase() + (/ZONE$/i.test(title || '') ? '' : ' ZONE');
    el.querySelector('.anum b').textContent = n;
    el.className = ''; el.hidden = false; void el.offsetWidth;
    el.className = 'in';
    await sleep(hold + 0.8);
    el.className = 'out';
    await sleep(0.5);
    el.hidden = true; el.className = '';
  }

  async card(text, dur) {
    this.cardEl.textContent = text;
    this.cardEl.classList.add('on');
    await sleep(dur);
    this.cardEl.classList.remove('on');
    await sleep(0.4);
  }
  // A small clapperboard slate in the corner of the picture (used during the credits bloopers).
  slate(text) {
    const el = document.getElementById('slate');
    el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  letterbox(on, title = '') {
    this.box.classList.toggle('on', on);
    $('songTitle').textContent = on ? title : '';
  }
  async fade(kind) {
    const v = this.veil;
    if (kind === 'flash') { v.className = 'flash'; await sleep(0.35); v.className = ''; return; }
    if (kind === 'dream') { v.className = 'dream'; await sleep(1.2); v.className = 'dreamhold'; return; }
    if (kind === 'fadeout') { v.className = 'black'; await sleep(0.9); return; }
    v.className = ''; await sleep(0.6);
  }
  progress(frac, label) {
    $('loadBar').style.width = (frac * 100).toFixed(1) + '%';
    if (label) $('loadText').textContent = label;
  }
  ready() { $('loading').hidden = true; this.showPicker(true); }
}
