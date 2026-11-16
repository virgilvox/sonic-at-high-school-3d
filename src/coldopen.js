// The cold open, after the original series' intro: three slow, moody, blue-graded shots over the opening clip
// (Sonic alone on a rooftop at dusk, Amy in close-up as rain starts, Sonic walking up to Amy in the rain at night),
// with cursive titles. Plays once before the 16-bit title sequence.
import * as THREE from 'three';
import { buildSet, makeProp } from './sets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const ease = (t) => t * t * (3 - 2 * t);

// Rain: streaks falling around the camera, recycled; add() to a scene, update(dt, camera) each frame.
export class Rain {
  constructor(n = 2500) {
    const pos = new Float32Array(n * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: '#b8c8ff', transparent: true, opacity: 0.45 }));
    this.mesh.frustumCulled = false;
    this.n = n;
    this.seed(V());
  }
  seed(c) {
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.n; i++) { const x = c.x + (Math.random() - 0.5) * 24, y = Math.random() * 12, z = c.z + (Math.random() - 0.5) * 24; p.set([x, y, z, x - 0.02, y - 0.35, z], i * 6); }
    this.geo.attributes.position.needsUpdate = true;
  }
  update(dt, cam) {
    const p = this.geo.attributes.position.array, fall = 14 * dt;
    for (let i = 0; i < this.n; i++) {
      const k = i * 6;
      p[k + 1] -= fall; p[k + 4] -= fall;
      if (p[k + 4] < 0) { const x = cam.position.x + (Math.random() - 0.5) * 24, z = cam.position.z + (Math.random() - 0.5) * 24, y = 10 + Math.random() * 2; p.set([x, y, z, x - 0.02, y - 0.35, z], k); }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class ColdOpen {
  constructor({ scene, camera, lights, loadActor, sound }) {
    Object.assign(this, { scene, camera, lights, loadActor, sound });
    this.el = document.getElementById('coldopen');
    this.active = false;
    this.rain = new Rain();
  }

  // Each shot: build the place, pose the actors, then move the camera from a to b over its duration.
  async shot({ set, time, setup, from, to, dur, rain, title }) {   // from/to: [[camera], [look]] or (eye) => that
    const s = buildSet(set, time);
    if (set === 'street') { const lamp = makeProp('streetlamp'); lamp.position.set(1.6, 0, 0.6); s.group.add(lamp); }
    this.scene.add(s.group); this.lights.apply(s);
    const actors = await setup(s);
    if (typeof from === 'function') { const e = actors[0].eyePos(V()); from = from(e); to = to(e); }   // framed on the real eye line
    if (rain) { this.rain.seed(V(...from[0])); this.scene.add(this.rain.mesh); this.sound.ambience([{ name: 'rainfall', vol: rain }]); }
    this.titleEl.textContent = title || ''; this.titleEl.classList.toggle('on', !!title);
    const t0 = performance.now();
    this.step = (dt) => {
      const t = Math.min(1, (performance.now() - t0) / 1000 / dur), e = ease(t);
      this.camera.position.lerpVectors(V(...from[0]), V(...to[0]), e);
      this.camera.lookAt(V().lerpVectors(V(...from[1]), V(...to[1]), e));
      this.camera.fov = 34; this.camera.updateProjectionMatrix();
      for (const a of actors) a.update(dt);
      if (rain) this.rain.update(dt, this.camera);
    };
    await sleep(dur);
    this.titleEl.classList.remove('on');
    this.scene.remove(s.group); this.scene.remove(this.rain.mesh);
    for (const a of actors) { a.root.visible = false; a.floorY = 0; a.setBase('Idle_Loop', 0); a.path = null; }
  }

  async play() {
    this.active = true;
    this.el.hidden = false;
    this.titleEl = this.el.querySelector('.cotitle');
    this.sound.ambience([]);
    const sonic = await this.loadActor('sonic'), amy = await this.loadActor('amy');
    this.sound.startScore('coldopen', { vol: 1, loop: false, fade: 0 });   // the clip as given: from its first note, once
    const show = (a, x, z, yaw) => { a.place(x, z, yaw); a.root.visible = true; a.stopOneShot(); return a; };
    // 1. Sonic alone on a rooftop ledge at dusk, the city behind him; the camera drifts toward him
    await this.shot({ set: 'rooftop', time: 'sunset', dur: 3.5, title: 'an adaptation of tarasdiary\'s story',
      setup: async () => { const a = show(sonic, 0.4, -0.2, -1.2); a.floorY = 0.5; a.setBase('Sitting_Idle_Loop', 0); a.mood = { sad: 0.6 }; a.lookAt(V(-6, 2, -8)); return [a]; },
      from: [[-3.6, 2.0, 2.8], [-1, 1.4, -3]], to: [[-1.2, 1.7, 2.0], [0.4, 1.3, -0.4]] });
    // 2. Amy, close and sad, as the rain starts
    await this.shot({ set: 'street', time: 'night', dur: 3.0, rain: 0.35, title: 'an adaptation of tarasdiary\'s story',
      setup: async () => { const a = show(amy, 0, 0, 0); a.mood = { sad: 0.8 }; return [a]; },
      from: (e) => [[e.x + 0.9, e.y + 0.2, e.z + 2.0], [e.x, e.y - 0.05, e.z]], to: (e) => [[e.x + 0.3, e.y + 0.05, e.z + 1.0], [e.x, e.y - 0.03, e.z]] });
    // 3. Sonic walks up to Amy in the rain
    await this.shot({ set: 'street', time: 'night', dur: 2.6, rain: 0.6,
      setup: async () => {
        const b = show(amy, 1.2, 0.4, -Math.PI / 2); b.mood = { sad: 0.6 };
        const a = show(sonic, -4.2, 0.4, Math.PI / 2); a.mood = { sad: 0.4 }; a.walk([V(0.1, 0, 0.4)], { speed: 1.05 }).then(() => { a.faceTo(b); b.faceTo(a); });
        return [a, b];
      },
      from: [[-1.4, 0.6, 4.4], [-1, 1.0, 0.4]], to: [[-0.2, 0.8, 3.4], [0.6, 1.1, 0.4]] });
    // 4. Amy, very close, turns from the rain to look straight into the lens as the title comes up
    await this.shot({ set: 'street', time: 'night', dur: 2.6, rain: 0.5, title: 'Sonic at High School 3',
      setup: async () => {
        const a = show(amy, 0, 0, -Math.PI / 2); a.mood = { sad: 0.5 };
        a.update(0); const lens = a.eyePos(V()).add(V(0.18, 0.04, 0.9)); a.lookAt(V(-3, lens.y, 0));
        setTimeout(() => { a.lookAt(lens); a.faceYaw(0.15, 1.6); a.mood = { sad: 0.3, happy: 0.2 }; }, 700);   // she turns to us
        return [a];
      },
      from: (e) => [[e.x + 0.25, e.y + 0.05, e.z + 1.15], [e.x, e.y + 0.03, e.z]], to: (e) => [[e.x + 0.18, e.y + 0.04, e.z + 0.9], [e.x, e.y + 0.03, e.z]] });
    this.step = null;
    this.sound.ambience([]);
    this.el.hidden = true;
    this.active = false;
  }
  update(dt) { this.step?.(dt); }
}
