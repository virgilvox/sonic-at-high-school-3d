// The model browser: every model the film uses (cast, stand-in sources, background students) with who it plays and
// who made it, shown on a turntable with orbit and zoom. Opened from the title screen; Close returns there.
import * as THREE from 'three';
import CREDITS from '../assets/vrm/CREDITS.json';
import { modelNames } from './assets.js';
import { CAST } from './cast.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Gallery {
  // load(file) -> Character (from main.js), show(on) toggles the rest of the UI, orbit: OrbitControls
  constructor({ scene, camera, orbit, load, onClose }) {
    Object.assign(this, { scene, camera, orbit, load, onClose });
    this.el = document.getElementById('gallery');
    this.list = this.el.querySelector('.glist');
    this.info = this.el.querySelector('.ginfo');
    this.el.querySelector('.gclose').onclick = () => this.close();
    this.stage = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 48), new THREE.MeshToonMaterial({ color: '#2a5bd7' }));
    floor.position.y = -0.06; floor.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01;
    this.stage.add(floor, ring);
  }

  // Who plays each file: cast members whose own model it is first, then those who borrow it.
  roles(file) {
    const own = CAST.filter((c) => c.model === file).map((c) => c.name);
    const borrow = CAST.filter((c) => c.standin === file && c.model !== file).map((c) => c.name);
    return { own, borrow };
  }

  open() {
    this.el.hidden = false;
    this.scene.add(this.stage);
    const files = modelNames().sort((a, b) => (a.startsWith('x-') - b.startsWith('x-')) || a.localeCompare(b));
    this.list.innerHTML = files.map((f) => {
      const c = CREDITS[f + '.vrm'] || {}, r = this.roles(f);
      const who = r.own.length ? r.own.join(', ') : f.startsWith('x-') ? 'Background student' : 'Stand-in';
      return `<button data-f="${esc(f)}"><b>${esc(who)}</b><span>${esc(c.title || f)}</span></button>`;
    }).join('');
    this.list.onclick = (e) => { const b = e.target.closest('button'); if (b) this.pick(b.dataset.f, b); };
    this.list.querySelector('button')?.click();
    this.orbit.enabled = true;
  }

  async pick(file, btn) {
    for (const b of this.list.querySelectorAll('button')) b.classList.toggle('on', b === btn);
    const c = CREDITS[file + '.vrm'] || {}, r = this.roles(file);
    this.info.innerHTML = `<h3>${esc(c.title || file)}</h3><p>by <b>${esc(c.author || 'unknown author')}</b></p><p>${esc(c.source || '')}</p>`
      + (r.own.length ? `<p>Plays ${esc(r.own.join(', '))}.</p>` : '') + (r.borrow.length ? `<p>Stands in for ${esc(r.borrow.join(', '))}.</p>` : '')
      + '<p class="ghint">Drag to turn, scroll or pinch to zoom.</p>';
    const tok = (this.tok = Symbol());
    if (this.actor) { this.stage.remove(this.actor.root); this.actor = null; }
    const a = await this.load(file);
    if (tok !== this.tok || !a) return;
    a.place(0, 0, 0); a.root.visible = true; this.stage.add(a.root); this.actor = a;
    const h = a.height || 1.6;
    this.camera.position.set(0, h * 0.75, h * 1.9); this.orbit.target.set(0, h * 0.55, 0); this.orbit.update();
  }

  update(dt) { if (this.actor) { this.actor.update(dt); this.actor.root.rotation.y += dt * 0.25; } }

  close() {
    this.tok = null;
    if (this.actor) this.stage.remove(this.actor.root);
    this.actor = null;
    this.scene.remove(this.stage);
    this.el.hidden = true;
    this.orbit.enabled = false;
    this.onClose?.();
  }
  get active() { return !this.el.hidden; }
}
