// Camera for box-shaped sets. Each shot type is a rule that places the camera from the subjects' positions and
// facing, re-evaluated every frame so it follows movement, eased, clamped inside the room, with a little handheld
// drift. Cuts snap; nothing recuts on its own. Shot types: establish, wide, two, mcu, cu, ots, low, track, orbit.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const UP = new THREE.Vector3(0, 1, 0);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class Director {
  constructor(camera) {
    this.cam = camera;
    this.shot = null;
    this.bounds = null;
    this.actors = [];
    this.shake = 0;
    this.lookAt = V(0, 1.2, 0);
    this.pos = V(0, 1.6, 5);
    this.cutCount = 0;
    this.t = 0;
    this.cutT = -10;
    this.lines = new Map();
  }

  setWorld(_statics, bounds, solids = []) { this.bounds = bounds; this.solids = solids; this.lines = new Map(); }

  // The 180 degree rule: each pair of actors gets one side of the line between them for the whole scene, chosen
  // where the camera already is, so every two shot, over the shoulder and reverse keeps screen direction.
  // Returns the pair in a fixed order plus a unit vector pointing to the camera's side of their line.
  lineOf(a, b) {
    const [p, q] = (a.id || '') < (b.id || '') ? [a, b] : [b, a];
    const key = p.id + '|' + q.id, line = V().subVectors(q.pos, p.pos).setY(0);
    const perp = V(-line.z, 0, line.x).normalize();
    if (!this.lines.has(key)) {
      const toCam = V().subVectors(this.pos, p.pos).setY(0);
      this.lines.set(key, toCam.dot(perp) >= 0 ? 1 : -1);
    }
    return { p, q, side: perp.multiplyScalar(this.lines.get(key)) };
  }

  cut(spec) {
    const subj = (spec.subjects || []).filter((s) => s && s.pos);
    if (!subj.length && spec.type !== 'fixed') return;
    // hold every shot long enough to read (about 1.2 s); a cut asked for sooner waits its turn instead of
    // being lost, and a newer request replaces it. Scenes and big actions cut at once.
    if (!spec.force && this.shot && this.t - this.cutT < 1.2) { this.pending = spec; return; }
    this.pending = null;
    this.cutT = this.t;
    this.shot = { ...spec, subj, t: 0, seed: Math.random() * 100, orbit0: Math.random() * Math.PI * 2 };
    let f = this.frame(this.shot);
    if (!f) return;
    // a shot that would put the camera outside the room, behind a prop, or with someone standing in front of the
    // subject's face becomes a wider one that can see them
    const FALLBACK = { ots: 'two', mcu: 'two', cu: 'two', low: 'two', two: 'wide', track: 'wide', establish: 'wide' };
    const bad = (sh, fr) => {
      const a = sh.subj[sh.type === 'ots' ? 1 : 0];
      return !this.inside(fr.pos, 0.3) || this.facesHidden(fr.pos, sh.subj) || (a?.eyePos && sh.type !== 'wide' && this.blocked(fr.pos, a.eyePos(V()), a));
    };
    for (let i = 0; i < 4 && bad(this.shot, f) && FALLBACK[this.shot.type]; i++) {
      if (FALLBACK[this.shot.type] === 'two' && this.shot.subj.length < 2 && this.shot.toward) this.shot.subj = [this.shot.subj[0], this.shot.toward];
      this.shot.type = FALLBACK[this.shot.type];
      this.shot.swing = null; this.shot.ots = null;
      f = this.frame(this.shot);
    }
    this.pos.copy(f.pos); this.lookAt.copy(f.look); this.fov = f.fov;
    this.cutCount++;
  }

  // Where the camera wants to be for this shot right now.
  frame(s) {
    const S = s.subj;
    const eye = (a) => (a.eyePos ? a.eyePos(V()) : V().copy(a.pos).setY(1.3));
    const fwd = (a) => V(Math.sin(a.yaw ?? 0), 0, Math.cos(a.yaw ?? 0));
    const center = V(); S.forEach((a) => center.add(a.pos)); if (S.length) center.divideScalar(S.length);
    const eyeH = S.length ? S.reduce((h, a) => h + eye(a).y, 0) / S.length : 1.3;
    const spread = S.reduce((m, a) => Math.max(m, a.pos.distanceTo(center)), 0);
    const toward = (from, dir, dist, h) => V().copy(from).addScaledVector(dir, dist).setY(h);
    switch (s.type) {
      case 'fixed': return { pos: V(...s.pos), look: V(...s.look), fov: s.fov || 40 };
      case 'establish': case 'wide': {
        // from the room's open side, looking at the group, wide enough to hold everyone
        const dir = this.openDir(center);
        const dist = (s.type === 'establish' ? 4.6 : 3.6) + spread * 1.6, h = eyeH + (s.type === 'establish' ? 0.9 : 0.35);
        const look = V().copy(center).setY(eyeH - 0.25);
        if (s.swing == null) {   // turn around the group until no prop is in the way
          const ok = (r) => { const p = toward(center, dir.clone().applyAxisAngle(UP, r), dist, h); return this.inside(p) && !this.propBlocked(p, look); };
          s.swing = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, Math.PI].find(ok) ?? 0;
        }
        return { pos: toward(center, dir.applyAxisAngle(UP, s.swing), dist, h), look, fov: 42 };
      }
      case 'two': {
        if (S.length < 2) return this.frame({ ...s, type: 'mcu' });
        const [a, b] = S, d = Math.max(0.6, a.pos.distanceTo(b.pos)), { side } = this.lineOf(a, b);
        const mid = V().addVectors(a.pos, b.pos).multiplyScalar(0.5);
        return { pos: toward(mid, side, 1.8 + d * 1.1, eyeH - 0.05), look: V().copy(mid).setY(eyeH - 0.15), fov: 36 };
      }
      case 'ots': {   // over S[0]'s shoulder, onto S[1]'s face
        if (S.length < 2) return this.frame({ ...s, type: 'mcu' });
        // Behind the near character on the camera's side of the line. Quills and ears reach well past a human
        // shoulder, so step wider and further back until the far face is clear of the near head; else a two shot.
        const [near, far] = S, dir = V().subVectors(near.pos, far.pos).setY(0).normalize();
        if ((near.bulk || 0.55) > 0.8) return this.frame({ ...s, type: 'two' });   // over that much hair you only see hair
        const side = this.lineOf(near, far).side, look = eye(far).add(V(0, -0.08, 0));
        const k = Math.max(1, (near.bulk || 0.55) / 0.55);   // big hair: stand further off the shoulder
        const at = ([back, wide]) => V().copy(near.pos).addScaledVector(dir, back * k).addScaledVector(side, wide * k).setY(eye(near).y + 0.15);
        if (s.ots == null) s.ots = [[1.5, 0.8], [1.7, 1.05], [1.9, 1.3], [2.1, 1.6]].find((o) => { const p = at(o); return this.inside(p) && !this.blocked(p, look, far); }) || false;
        if (!s.ots) return this.frame({ ...s, type: 'two' });
        return { pos: at(s.ots), look, fov: 34 };
      }
      case 'mcu': case 'cu': case 'low': {
        const a = S[0];
        let f = fwd(a);
        if (s.toward?.pos && s.toward !== a) {
          // a three-quarter single: from the listener's direction, turned about 43 degrees to the camera's side of the
          // line, so the speaker looks just past the lens toward the listener and eyelines match across cuts
          const tl = V().subVectors(s.toward.pos, a.pos).setY(0).normalize(), side = this.lineOf(a, s.toward).side;
          const ang = (a.bulk || 0.55) > 0.8 ? 0.3 : 0.75;   // big hair hides the face from the side: go nearly head on
          f = tl.multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang)).normalize();
        }
        const dist = s.type === 'cu' ? 1.3 : s.type === 'low' ? 2.0 : 2.1;
        const h = s.type === 'low' ? 0.75 : eye(a).y - 0.02;
        const look = eye(a).add(V(0, s.type === 'low' ? 0.05 : -0.12, 0));
        // swing around the subject until nobody stands between lens and face; keep the swing for the whole shot
        if (s.swing == null) {
          const ok = (r) => { const p = toward(a.pos, f.clone().applyAxisAngle(UP, r), dist, h); return this.inside(p) && !this.blocked(p, look, a); };
          // with a listener, only swing further to the camera's side (crossing the line would flip the eyeline)
          const sideSign = s.toward?.pos ? Math.sign(V().crossVectors(V().subVectors(s.toward.pos, a.pos), f).y) || 1 : 0;
          const tries = sideSign ? [0, 0.25, 0.5, 0.75, -0.2].map((r) => -r * sideSign) : [0, 0.6, -0.6, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2];
          s.swing = tries.find(ok) ?? 0;
        }
        return { pos: toward(a.pos, f.clone().applyAxisAngle(UP, s.swing), dist, h), look, fov: s.type === 'cu' ? 26 : s.type === 'low' ? 36 : 32 };
      }
      case 'track': {
        // alongside, slightly ahead, looking a metre in front of the subject: lead room for the move
        const a = S[0], f = fwd(a), side = V(f.z, 0, -f.x);
        if (s.trackSide == null) s.trackSide = Math.sign(V().subVectors(this.pos, a.pos).dot(side)) || 1;   // stay on the side we cut in on
        side.multiplyScalar(s.trackSide);
        const p = V().copy(a.pos).addScaledVector(side, 2.8).addScaledVector(f, 0.4).setY(eye(a).y + 0.1);
        return { pos: p, look: eye(a).addScaledVector(f, 1.0).add(V(0, -0.2, 0)), fov: 38 };
      }
      case 'orbit': {
        const ang = s.orbit0 + s.t * 0.12, r = 2.6 + spread * 1.4;
        return { pos: V(center.x + Math.sin(ang) * r, eyeH + 0.4, center.z + Math.cos(ang) * r), look: V().copy(center).setY(eyeH - 0.2), fov: 38 };
      }
      default: return this.frame({ ...s, type: 'wide' });
    }
  }

  // In the room and not inside a prop.
  inside(p, margin = 0) {
    const B = this.bounds;
    if (B && !(p.x >= B.x[0] - margin && p.x <= B.x[1] + margin && p.z >= B.z[0] - margin && p.z <= B.z[1] + margin)) return false;
    if (this.solids?.some((b) => b.clone().expandByScalar(0.25).containsPoint(p))) return false;
    // nor inside somebody (a capsule around each visible actor)
    return !this.actors.some((o) => o.root?.visible && Math.hypot(p.x - o.pos.x, p.z - o.pos.z) < (o.bulk || 0.55) + 0.2 && p.y < (o.height || 1.8) + 0.2);
  }

  // Does a tall prop (tree, lockers, car, wall unit) stand between the camera and the point?
  propBlocked(cam, at) {
    const seg = V().subVectors(at, cam), len = seg.length(), ray = new THREE.Ray(cam, seg.normalize()), hit = V();
    return !!this.solids?.some((b) => b.max.y > 1.2 && ray.intersectBox(b, hit) && hit.distanceTo(cam) < len - 0.2);
  }

  facesHidden(cam, subjects) {
    return subjects.some((a) => a.eyePos && this.propBlocked(cam, a.eyePos(V())));
  }

  // Is another actor's body (a capsule around their position) between the camera and the subject's face?
  blocked(cam, face, subject) {
    const seg = V().subVectors(face, cam), len = seg.length();
    seg.normalize();
    if (this.propBlocked(cam, face)) return true;
    return this.actors.some((o) => {
      if (o === subject || !o.root?.visible) return false;
      const c = V().copy(o.pos).setY(Math.min(face.y, 1.4)), t = clamp(V().subVectors(c, cam).dot(seg), 0, len);
      return V().copy(cam).addScaledVector(seg, t).setY(c.y).distanceTo(c) < (o.bulk || 0.6) && t < len - 0.3;
    });
  }

  // Direction from a point toward the roomiest side of the set (the "fourth wall").
  openDir(c) {
    const B = this.bounds;
    if (!B) return V(0, 0, 1);
    const room = [[V(0, 0, 1), B.z[1] - c.z], [V(0, 0, -1), c.z - B.z[0]], [V(1, 0, 0), B.x[1] - c.x], [V(-1, 0, 0), c.x - B.x[0]]];
    room.sort((p, q) => q[1] - p[1]);
    return room[0][0].add(V(room[0][0].z * 0.35, 0, -room[0][0].x * 0.35)).normalize();   // a little off axis
  }

  update(dt) {
    this.t += dt;
    if (this.pending && this.t - this.cutT >= 1.2) this.cut(this.pending);
    const s = this.shot;
    if (!s) return;
    s.t += dt;
    const f = this.frame(s);
    if (!f) return;
    // a moving shot that would drift into a prop or a person holds its last good spot and just keeps looking
    // someone walked in front of the subject mid-shot: after 0.8 s, cut wider rather than stay blocked
    const watch = s.subj[s.type === 'ots' ? 1 : 0];
    if (watch?.eyePos && !['establish', 'fixed', 'orbit'].includes(s.type) && (this.blocked(this.cam.position, watch.eyePos(V()), watch) || this.facesHidden(this.cam.position, s.subj))) {
      s.blockT = (s.blockT || 0) + dt;
      if (s.blockT > 0.8) { this.cut({ type: s.type === 'wide' ? 'establish' : s.type === 'two' ? 'wide' : 'two', subjects: s.subj.length > 1 ? s.subj : [watch, s.toward].filter(Boolean), force: true }); return; }
    } else s.blockT = 0;
    const lead = s.subj[0], face = lead?.eyePos?.(V());
    if (this.inside(f.pos) && !this.facesHidden(f.pos, s.subj) && !(face && s.type !== 'ots' && this.blocked(f.pos, face, lead))) s.good = f.pos.clone();
    else if (s.good) f.pos.copy(s.good);
    const rate = s.type === 'track' || s.type === 'orbit' ? 3 : 2;
    this.pos.set(damp(this.pos.x, f.pos.x, rate, dt), damp(this.pos.y, f.pos.y, rate, dt), damp(this.pos.z, f.pos.z, rate, dt));
    this.lookAt.set(damp(this.lookAt.x, f.look.x, rate * 1.5, dt), damp(this.lookAt.y, f.look.y, rate * 1.5, dt), damp(this.lookAt.z, f.look.z, rate * 1.5, dt));
    this.fov = damp(this.fov || f.fov, f.fov, 3, dt);
    const p = this.pos.clone();
    const n = (a, b) => Math.sin(this.t * a + s.seed) * 0.6 + Math.sin(this.t * b + s.seed * 2) * 0.4;
    p.add(V(n(0.7, 1.9), n(0.9, 2.3) * 0.6, n(0.6, 1.7)).multiplyScalar(0.012));
    if (this.shake > 0) { p.add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.shake * 0.15)); this.shake = Math.max(0, this.shake - dt * 1.6); }
    const B = this.bounds;
    if (B) { p.x = clamp(p.x, B.x[0], B.x[1]); p.z = clamp(p.z, B.z[0], B.z[1]); p.y = clamp(p.y, 0.35, B.y); }
    this.cam.position.copy(p);
    this.cam.lookAt(this.lookAt);
    // shots are composed for a 16:9 frame; on a narrower screen (a phone held upright) widen the vertical field of
    // view so the same horizontal slice of the scene stays in frame
    const ar = this.cam.aspect || 16 / 9, fov = ar >= 1.6 ? this.fov : Math.min(100, 2 * Math.atan(Math.tan((this.fov * Math.PI) / 360) * (1.6 / ar)) * 180 / Math.PI);
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
  }
}
