// The voice settings panel: choose Kyutai (baked) voices, live browser voices or no voices, and in browser mode
// swap any character's system voice, pitch and rate, with a test button. Settings persist through Voices.save().
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LABEL = { kyutai: 'Kyutai voices', browser: 'Browser voices', off: 'No voices' };
const NOTE = {
  kyutai: 'Every line was generated ahead of time with Kyutai Pocket TTS, a voice cast per character. Plays offline.',
  browser: 'Your browser speaks each line live. Pick any installed voice for anyone below.',
  off: 'Captions only. Lines stay up for a reading time.',
};
const SAMPLE = "Hey! What's going on here? Why's everyone outside?";

export class VoicePanel {
  constructor({ voices, cast, button }) {
    this.voices = voices;
    this.cast = cast.filter((c) => !c.extra && !c.costume && (c.id !== 'narrator' || c.name));
    this.el = document.createElement('div');
    this.el.id = 'voicePanel';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Voice settings');
    document.body.append(this.el);
    for (const b of [].concat(button)) b?.addEventListener('click', () => this.toggle());
    voices.onVoices = () => { if (!this.el.hidden) this.render(); };
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => this.input(e));
  }

  toggle(on = this.el.hidden) { this.el.hidden = !on; if (on) this.render(); }

  render() {
    const v = this.voices, mode = v.mode;
    const opts = v.list.map((x) => x.name);
    const rows = mode !== 'browser' ? '' : this.cast.map((c) => {
      const st = v.settings(c);
      return `<div class="vrow" data-id="${c.id}">
        <span class="vname" style="--c:${c.color}">${esc(c.name || c.id)}</span>
        <select data-k="voice" aria-label="${esc(c.name)} voice">${opts.map((n) => `<option${n === st.voice ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <label>pitch <input data-k="pitch" type="range" min="0.5" max="2" step="0.05" value="${st.pitch}"></label>
        <label>rate <input data-k="rate" type="range" min="0.6" max="1.6" step="0.05" value="${st.rate}"></label>
        <button data-act="test" title="Hear a test line">Test</button>
      </div>`;
    }).join('');
    this.el.innerHTML = `<div class="vhead"><b>Voices</b><button data-act="close" aria-label="Close">Close</button></div>
      <div class="vmodes">${v.modes.map((m) => `<button data-mode="${m}" class="${m === mode ? 'on' : ''}">${LABEL[m]}</button>`).join('')}</div>
      <p class="vnote">${NOTE[mode]}${!v.bank ? ' (This build has no Kyutai voice bank; run tools/voices/bake.py and rebuild.)' : ''}</p>
      ${rows ? `<div class="vrows">${rows}</div><button data-act="reset">Reset all to defaults</button>` : ''}`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) { this.voices.setMode(b.dataset.mode); this.render(); }
    else if (b.dataset.act === 'close') this.toggle(false);
    else if (b.dataset.act === 'reset') { this.voices.resetOverrides(); this.voices.assignAll(); this.render(); }
    else if (b.dataset.act === 'test') {
      const c = this.cast.find((x) => x.id === b.closest('.vrow').dataset.id);
      this.voices.say(SAMPLE, c, null);
    }
  }

  input(e) {
    const k = e.target.dataset.k, row = e.target.closest('.vrow');
    if (!k || !row) return;
    const val = k === 'voice' ? e.target.value : +e.target.value;
    this.voices.override(row.dataset.id, { [k]: val });
  }
}
