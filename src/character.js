// One VRM actor: baked mocap layers (idle, walk, talk, one shots) blended by weight, then procedural overlays for
// head look, arm IK gestures (point, wave, clap, cheer, present, shrug, think), hop, expressions, blink and lip sync.
import * as THREE from 'three';
import { buildClips } from './anims.js';

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const _q1 = Q(), _q2 = Q(), _q3 = Q(), _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V();

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const SEG = ['Proximal', 'Intermediate', 'Distal'];

export class Character {
  constructor(vrm, animData, opts = {}) {
    this.vrm = vrm;
    this.id = opts.id;
    this.name = opts.name || opts.id;
    this.voice = opts.voice;
    this.color = opts.color || '#f2ab1e';
    this.root = new THREE.Group();
    this.root.name = 'actor-' + this.id;
    const s = opts.scale || 1;
    vrm.scene.scale.setScalar(s);
    this.root.add(vrm.scene);
    vrm.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
    const h = vrm.humanoid;
    this.bone = (n) => h.getNormalizedBoneNode(n);
    vrm.scene.updateMatrixWorld(true);
    const hipsY = this.bone('hips').getWorldPosition(V()).y;
    const footY = this.bone('leftFoot').getWorldPosition(V()).y;
    this.hipsH = (hipsY - footY) / s;
    this.height = this.bone('head').getWorldPosition(V()).y + 0.12 * s;
    this.scale = s;
    // rest directions (scene local == normalized bone local at rest)
    this.rest = {};
    const sceneQi = vrm.scene.getWorldQuaternion(Q()).invert();
    const dirOf = (a, b) => this.bone(b).getWorldPosition(V()).sub(this.bone(a).getWorldPosition(V())).applyQuaternion(sceneQi).normalize();
    for (const S of ['left', 'right']) {
      for (const F of FINGERS) {
        // models differ in how many finger bones they rig; skip a finger with no tip to aim from
        const tip = ['Distal', 'Intermediate'].find((sg) => this.bone(S + F + sg));
        if (!this.bone(S + F + 'Proximal') || !tip) continue;
        const d = dirOf(S + F + 'Proximal', S + F + tip);
        this.rest[S + F] = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, -1, 0)).normalize();
      }
    }
    this.clips = buildClips(vrm, animData, this.hipsH);
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.actions = {};
    this.w = {};   // current weights
    this.tw = {};  // target weights for loops
    this.baseClip = 'Idle_Loop';
    this.oneShot = null;
    // locomotion
    this.pos = this.root.position;
    this.yaw = 0;
    this.speed = 0;
    this.path = null;
    this.walkSpeed = opts.walkSpeed || 1.32;
    this.turnTarget = null;
    // overlays
    this.look = { target: null, yaw: 0, pitch: 0, w: 0 };
    this.lookObj = new THREE.Object3D();
    vrm.lookAt && (vrm.lookAt.target = this.lookObj);
    this.gest = null;      // {kind, target, t, dur, w, side}
    this.gestW = 0;
    this.hop = { amp: 0, target: 0, t: 0 };
    this.expr = { happy: 0, surprised: 0, sad: 0, angry: 0, relaxed: 0 };
    this.exprT = { happy: 0, surprised: 0, sad: 0, angry: 0, relaxed: 0 };
    this.mood = { happy: 0.15 };
    this.exprTimers = [];
    this.blinkT = 2 + Math.random() * 3; this.blinkV = 0;
    this.mouth = { level: 0, shape: 0 };
    this.mouthV = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    this.speaking = false;
    this.talkW = 0;
    this.t = Math.random() * 10;
    this.phase = Math.random() * 6;
    this.setBase('Idle_Loop', 0);
  }

  action(name) {
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) { console.warn('no clip', name); return null; }
      const a = this.mixer.clipAction(clip);
      a.play(); a.setEffectiveWeight(0);
      a.time = Math.random() * clip.duration;
      this.actions[name] = a; this.w[name] = 0;
    }
    return this.actions[name];
  }

  setBase(name, fade = 0.4) {
    this.baseClip = name;
    this.action(name);
    if (!fade) for (const k of Object.keys(this.w)) this.w[k] = k === name ? 1 : 0;
  }

  // full body one shot over the base layer; resolves when done
  play(name, { fade = 0.25, speed = 1, hold = false, loops = 1 } = {}) {
    const a = this.action(name);
    if (!a) return Promise.resolve();
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.timeScale = speed; a.play();
    const dur = (a.getClip().duration * loops) / speed;
    if (this.oneShot && this.oneShot.resolve) this.oneShot.resolve();
    return new Promise((resolve) => { this.oneShot = { name, t: 0, dur, fade, hold, resolve }; });
  }
  stopOneShot() { if (this.oneShot) { this.oneShot.hold = false; this.oneShot.t = Math.max(this.oneShot.t, this.oneShot.dur - this.oneShot.fade); } }

  place(x, z, yaw = 0) { this.pos.set(x, 0, z); this.yaw = yaw; this.speed = 0; this.path = null; this.root.rotation.y = yaw; }

  walk(points, { speed, face } = {}) {
    if (this.path && this.path.resolve) this.path.resolve();
    return new Promise((resolve) => {
      this.path = { pts: points.map((p) => new THREE.Vector3(p.x, 0, p.z)), i: 0, speed: speed || this.walkSpeed, face, resolve };
    });
  }

  faceTo(target, rate = 5) {
    const p = target.isVector3 ? target : target.pos || target;
    this.turnTarget = { yaw: Math.atan2(p.x - this.pos.x, p.z - this.pos.z), rate };
  }
  faceYaw(yaw, rate = 5) { this.turnTarget = { yaw, rate }; }

  lookAt(target) { this.look.target = target; }

  headPos(out = V()) { return this.bone('head').getWorldPosition(out); }
  chestPos(out = V()) { return (this.bone('upperChest') || this.bone('chest') || this.bone('spine')).getWorldPosition(out); }
  eyePos(out = V()) { this.headPos(out); out.y += 0.06 * this.scale; return out; }

  gesture(kind, { target = null, dur = 2.2, side = null } = {}) {
    let sd = side;
    if (!sd && target) {
      const p = target.isVector3 ? target : target.pos;
      const lx = Math.cos(this.yaw) * (p.x - this.pos.x) - Math.sin(this.yaw) * (p.z - this.pos.z);
      sd = lx > 0 ? 'left' : 'right';
    }
    this.gestCarry = this.gestW;
    this.gest = { kind, target, t: 0, dur, side: sd || 'right', seed: Math.random() * 10 };
  }

  emote(name, amount = 1, dur = 2.5) {
    this.exprTimers.push({ name, amount, t: 0, dur });
  }
  setMood(m) { this.mood = m; }

  hopFor(sec, amp = 0.05) { this.hop.until = this.t + sec; this.hop.target = amp; }

  // ----------------------------------------------------------------- per frame
  update(dt) {
    this.t += dt;
    if (this.tpose) { this.vrm.humanoid.resetNormalizedPose(); this.updateFace(dt); this.vrm.update(dt); return; }   // blooper: animation "breaks"
    this.updateLoco(dt);
    this.updateWeights(dt);
    this.mixer.update(dt);
    this.vrm.scene.updateMatrixWorld(true);
    this.updateHop(dt);
    this.updateLook(dt);
    this.updateGesture(dt);
    this.updateFace(dt);
    this.vrm.update(dt);
  }

  updateLoco(dt) {
    let want = 0;
    const p = this.path;
    if (p) {
      const tgt = p.pts[p.i];
      const d = _v1.subVectors(tgt, this.pos); d.y = 0;
      const dist = d.length();
      const last = p.i === p.pts.length - 1;
      if (dist < (last ? 0.06 : 0.35)) {
        if (last) {
          this.path = null;
          if (p.face) this.faceTo(p.face);
          p.resolve();
        } else p.i++;
      } else {
        // remaining distance for arrival slowdown
        let rem = dist; for (let k = p.i; k < p.pts.length - 1; k++) rem += p.pts[k].distanceTo(p.pts[k + 1]);
        want = Math.min(p.speed, Math.max(0.25, rem * 1.6));
        const yawT = Math.atan2(d.x, d.z);
        let dy = ((yawT - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.yaw += dy * (1 - Math.exp(-7 * dt));
        if (Math.abs(dy) > 1.6) want *= 0.25;
        this.turnTarget = null;
      }
    }
    if (!this.path && this.turnTarget) {
      let dy = ((this.turnTarget.yaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += dy * (1 - Math.exp(-this.turnTarget.rate * dt));
      this.turning = Math.abs(dy) > 0.15;
      if (Math.abs(dy) < 0.01) this.turnTarget = null;
    } else this.turning = false;
    this.speed = damp(this.speed, want, want > this.speed ? 4 : 6, dt);
    if (this.speed > 0.005) {
      this.pos.x += Math.sin(this.yaw) * this.speed * dt;
      this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    }
    this.root.rotation.y = this.yaw;
  }

  updateWeights(dt) {
    const loco = this.speed > 1.9 && this.clips.Sprint_Loop ? 'Sprint_Loop' : 'Walk_Loop';   // running reads as a sprint
    const walkA = this.action(loco);
    const cs = this.clips[loco].userData.speed * this.scale || (loco === 'Walk_Loop' ? 0.9 : 3.5);
    walkA.timeScale = clamp(this.speed / cs, 0.6, 1.6);
    const walkW = clamp(this.speed / 0.35, 0, 1);
    const turnStep = this.turning && !this.path ? 0.35 : 0;
    this.talkW = damp(this.talkW, this.speaking ? 1 : 0, 3, dt);
    const base = this.baseClip;
    const talkClip = base.startsWith('Sitting') ? 'Sitting_Talking_Loop' : 'Idle_Talking_Loop';
    const tw = {};
    const standW = 1 - Math.max(walkW, turnStep);
    const talkFrac = (base === 'Idle_Loop' || base.startsWith('Sitting')) ? this.talkW * 0.85 : this.talkW * 0.35;
    tw[base] = standW * (1 - talkFrac);
    tw[talkClip] = (tw[talkClip] || 0) + standW * talkFrac;
    tw[loco] = (tw[loco] || 0) + Math.max(walkW, turnStep);
    if (turnStep && !walkW) walkA.timeScale = 0.7;
    this.action(talkClip);
    // one shot on top
    let osW = 0;
    const os = this.oneShot;
    if (os) {
      os.t += dt;
      const fin = os.hold ? 1 : clamp((os.dur - os.t) / os.fade, 0, 1);
      osW = Math.min(clamp(os.t / os.fade, 0, 1), fin);
      if (!os.hold && os.t >= os.dur) { this.oneShot = null; os.resolve(); osW = 0; }
    }
    for (const k of Object.keys(this.actions)) {
      const target = (tw[k] || 0) * (1 - osW) + (os && os.name === k ? osW : 0);
      const rate = 6;
      this.w[k] = damp(this.w[k] || 0, target, rate, dt);
    }
    // normalise so the rig never blends toward the bind pose
    let sum = 0; for (const k in this.w) sum += this.w[k];
    for (const k in this.actions) this.actions[k].setEffectiveWeight(sum > 1e-4 ? this.w[k] / sum : (k === base ? 1 : 0));
  }

  updateHop(dt) {
    const on = this.hop.until && this.t < this.hop.until;
    this.hop.amp = damp(this.hop.amp, on ? this.hop.target : 0, 6, dt);
    if (this.hop.amp > 0.002) {
      const y = this.hop.amp * Math.abs(Math.sin(this.t * Math.PI * 2.3));
      this.root.position.y = y;
    } else this.root.position.y = 0;
  }

  // rotate a normalized bone by a world-space delta, keeping parents
  rotWorld(node, deltaWorld) {
    const P = node.parent.getWorldQuaternion(_q1);
    const Pi = _q2.copy(P).invert();
    node.quaternion.premultiply(_q3.copy(Pi).multiply(deltaWorld).multiply(P));
    node.updateMatrixWorld(true);
  }

  updateLook(dt) {
    const L = this.look;
    let tYaw = 0, tPitch = 0, active = 0;
    const tp = L.target ? (L.target.isVector3 ? L.target : (L.target.eyePos ? L.target.eyePos(_v4) : L.target)) : null;
    if (tp) {
      const head = this.headPos(_v1);
      const d = _v2.subVectors(tp, head);
      const ly = Math.atan2(d.x, d.z) - this.yaw;
      tYaw = ((ly + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      tPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      active = Math.abs(tYaw) < 2.4 ? 1 : 0;
      tYaw = clamp(tYaw, -1.25, 1.25); tPitch = clamp(tPitch, -0.6, 0.5);
      this.lookObj.position.copy(tp);
    } else {
      // idle glance: gentle wander
      tYaw = Math.sin(this.t * 0.31 + this.phase) * 0.18; tPitch = Math.sin(this.t * 0.23 + this.phase) * 0.05;
      this.lookObj.position.copy(this.headPos(_v1)).add(_v2.set(Math.sin(this.yaw + tYaw), tPitch, Math.cos(this.yaw + tYaw)).multiplyScalar(3));
      active = 1;
    }
    if (this.path) { tYaw *= 0.5; tPitch *= 0.5; }
    L.w = damp(L.w, active, 4, dt);
    L.yaw = damp(L.yaw, tYaw * L.w, 5, dt);
    L.pitch = damp(L.pitch, tPitch * L.w, 5, dt);
    const charYawQ = _q1.setFromAxisAngle(UP, this.yaw);
    const right = _v3.set(-1, 0, 0).applyQuaternion(charYawQ); // character right side axis for pitch (pitch up is negative about right)
    const parts = [['upperChest', 0.2], ['neck', 0.35], ['head', 0.45]];
    for (const [b, f] of parts) {
      const n = this.bone(b); if (!n) continue;
      const dq = new THREE.Quaternion().setFromAxisAngle(UP, L.yaw * f);
      const pq = new THREE.Quaternion().setFromAxisAngle(right, L.pitch * f * (b === 'upperChest' ? 0.3 : 1));
      this.rotWorld(n, dq.multiply(pq));
    }
  }

  // two bone IK on normalized arm chain, blended with weight; pole is a world direction for the elbow
  armIK(side, target, pole, w) {
    const U = this.bone(side + 'UpperArm'), Lw = this.bone(side + 'LowerArm'), H = this.bone(side + 'Hand');
    const pU = U.getWorldPosition(V()), pL = Lw.getWorldPosition(V()), pH = H.getWorldPosition(V());
    const a = pU.distanceTo(pL), b = pL.distanceTo(pH);
    const toT = V().subVectors(target, pU);
    let d = clamp(toT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    toT.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const ang = Math.acos(cosA);
    const pl = V().copy(pole).addScaledVector(toT, -pole.dot(toT)).normalize();
    const elbowDir = V().copy(toT).multiplyScalar(Math.cos(ang)).addScaledVector(pl, Math.sin(ang)).normalize();
    const qU0 = U.quaternion.clone(), qL0 = Lw.quaternion.clone();
    // upper arm: rotate current dir to elbow dir
    const cur = V().subVectors(pL, pU).normalize();
    this.rotWorld(U, Q().setFromUnitVectors(cur, elbowDir));
    const pL2 = Lw.getWorldPosition(V()), pH2 = H.getWorldPosition(V());
    const endP = V().copy(pU).addScaledVector(toT, d);
    const cur2 = V().subVectors(pH2, pL2).normalize();
    const want2 = V().subVectors(endP, pL2).normalize();
    this.rotWorld(Lw, Q().setFromUnitVectors(cur2, want2));
    if (w < 1) {
      U.quaternion.copy(qU0.slerp(U.quaternion, w)); U.updateMatrixWorld(true);
      Lw.quaternion.copy(qL0.slerp(Lw.quaternion, w)); Lw.updateMatrixWorld(true);
    }
  }

  fingers(side, curl, indexCurl, w) {
    for (const F of FINGERS) {
      const c = F === 'Index' ? indexCurl : curl;
      const axis = this.rest[side + F];
      if (!axis) continue;
      for (const s of SEG) {
        const n = this.bone(side + F + s); if (!n) continue;
        const target = _q1.setFromAxisAngle(axis, c * (s === 'Proximal' ? 1.2 : 1.0));
        n.quaternion.slerp(target, w);
      }
    }
  }

  updateGesture(dt) {
    let g = this.gest;
    if (g) { g.t += dt; if (g.t > g.dur || g.kind === 'none') { this.gest = null; g = null; } }
    if (g) {
      this.activeG = g;
      const want = clamp(Math.min(g.t / 0.35, (g.dur - g.t) / 0.4), 0, 1);
      this.gestW = g.t < 0.35 && this.gestCarry ? Math.max(want, this.gestCarry * (1 - g.t / 0.35)) : want;
    } else {
      this.gestW = damp(this.gestW, 0, 5, dt);
      g = this.activeG;
    }
    if (!g || this.gestW < 0.01) { this.activeG = null; return; }
    const w = this.gestW * this.gestW * (3 - 2 * this.gestW);
    const yq = _q1.setFromAxisAngle(UP, this.yaw).clone();
    const fwd = V().set(0, 0, 1).applyQuaternion(yq), left = V().set(1, 0, 0).applyQuaternion(yq), up = UP;
    const chest = this.chestPos(V());
    const s = this.scale;
    const arm = 0.5 * s;
    const t = g.t;
    const sh = (side) => this.bone(side + 'UpperArm').getWorldPosition(V());
    const sideV = (side) => (side === 'left' ? left.clone() : left.clone().negate());
    const tgtP = g.target ? (g.target.isVector3 ? g.target : (g.target.chestPos ? g.target.chestPos(V()) : g.target.pos)) : null;
    switch (g.kind) {
      case 'point': {
        const sd = g.side; const p0 = sh(sd);
        const dir = tgtP ? V().subVectors(tgtP, p0).normalize() : fwd.clone();
        const T = p0.clone().addScaledVector(dir, arm * 1.05);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.4), w);
        this.fingers(sd, 1.35, 0.05, w);
        break;
      }
      case 'present': {
        const sd = g.side; const p0 = sh(sd);
        const dir = tgtP ? V().subVectors(tgtP, p0).setY(0).normalize() : fwd.clone();
        const T = p0.clone().addScaledVector(dir, arm * 0.85).addScaledVector(up, -0.22 * s);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.6), w);
        this.fingers(sd, 0.12, 0.08, w);
        break;
      }
      case 'wave': {
        const sd = g.side; const p0 = sh(sd);
        const T = p0.clone().addScaledVector(up, 0.42 * s).addScaledVector(sideV(sd), 0.22 * s + Math.sin(t * 9) * 0.09 * s).addScaledVector(fwd, 0.12 * s);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.8), w);
        this.fingers(sd, 0.05, 0.05, w);
        break;
      }
      case 'clap': {
        const sep = 0.035 * s + (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.4)) * 0.14 * s;
        const c = chest.clone().addScaledVector(fwd, 0.3 * s).addScaledVector(up, -0.06 * s);
        for (const sd of ['left', 'right']) {
          const T = c.clone().addScaledVector(sideV(sd), sep * 0.5);
          this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 1.2), w);
          this.fingers(sd, 0.1, 0.1, w);
        }
        break;
      }
      case 'cheer': {
        for (const sd of ['left', 'right']) {
          const p0 = sh(sd);
          const bob = Math.sin(t * Math.PI * 2 * 2.2 + (sd === 'left' ? 0 : 1.2)) * 0.06 * s;
          const T = p0.clone().addScaledVector(up, 0.45 * s + bob).addScaledVector(sideV(sd), 0.16 * s).addScaledVector(fwd, 0.06 * s);
          this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 1), w);
          this.fingers(sd, 1.4, 1.4, w);
        }
        break;
      }
      case 'fist': {
        const sd = g.side; const p0 = sh(sd);
        const pump = Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)) * 0.12 * s;
        const T = p0.clone().addScaledVector(up, 0.05 * s + pump).addScaledVector(fwd, 0.22 * s).addScaledVector(sideV(sd), 0.05 * s);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.5), w);
        this.fingers(sd, 1.45, 1.45, w);
        break;
      }
      case 'shrug': {
        for (const sd of ['left', 'right']) {
          const p0 = sh(sd);
          const T = p0.clone().addScaledVector(up, -0.33 * s).addScaledVector(sideV(sd), 0.2 * s).addScaledVector(fwd, 0.2 * s);
          this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.5).addScaledVector(fwd, -0.5), w);
          this.fingers(sd, 0.1, 0.1, w);
          const shn = this.bone(sd + 'Shoulder');
          if (shn) this.rotWorld(shn, Q().setFromAxisAngle(fwd, (sd === 'left' ? -1 : 1) * 0.18 * w * Math.min(1, t * 3)));
        }
        break;
      }
      case 'think': {
        const sd = g.side;
        const head = this.headPos(V());
        const T = head.clone().addScaledVector(fwd, 0.1 * s).addScaledVector(up, -0.1 * s).addScaledVector(sideV(sd), 0.02 * s);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.3).addScaledVector(fwd, -0.2), w);
        this.fingers(sd, 1.1, 0.7, w);
        break;
      }
      case 'beckon': {
        const sd = g.side; const p0 = sh(sd);
        const T = p0.clone().addScaledVector(fwd, 0.32 * s).addScaledVector(up, -0.08 * s).addScaledVector(sideV(sd), 0.08 * s);
        this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.6), w);
        this.fingers(sd, 0.6 + Math.sin(t * 10) * 0.5, 0.6 + Math.sin(t * 10) * 0.5, w);
        break;
      }
      case 'tinker': { // both hands busy on a bench in front
        for (const sd of ['left', 'right']) {
          const ph = sd === 'left' ? 0 : 1.7;
          const T = V().copy(this.pos).addScaledVector(fwd, 0.4 * s).addScaledVector(sideV(sd), 0.12 * s);
          T.y = 0.98 + Math.sin(t * 2.1 + ph) * 0.025 + Math.max(0, Math.sin(t * 0.9 + ph)) * 0.04;
          T.addScaledVector(sideV(sd), Math.sin(t * 1.3 + ph * 2) * 0.03);
          this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.9).addScaledVector(fwd, -0.3), w);
          this.fingers(sd, 0.7, 0.4, w);
        }
        break;
      }
      case 'hands': { // both hands open, talking big
        for (const sd of ['left', 'right']) {
          const p0 = sh(sd);
          const sw = Math.sin(t * 3 + (sd === 'left' ? 0 : 2)) * 0.05 * s;
          const T = p0.clone().addScaledVector(up, -0.22 * s + sw).addScaledVector(sideV(sd), 0.12 * s).addScaledVector(fwd, 0.3 * s);
          this.armIK(sd, T, V().copy(up).negate().addScaledVector(sideV(sd), 0.7), w);
          this.fingers(sd, 0.15, 0.1, w);
        }
        break;
      }
    }
  }

  updateFace(dt) {
    const em = this.vrm.expressionManager;
    if (!em) return;
    // targets: mood plus timed emotes
    for (const k of Object.keys(this.exprT)) this.exprT[k] = this.mood[k] || 0;
    this.exprTimers = this.exprTimers.filter((e) => {
      e.t += dt;
      const env = clamp(Math.min(e.t / 0.25, (e.dur - e.t) / 0.5), 0, 1);
      this.exprT[e.name] = Math.max(this.exprT[e.name] || 0, e.amount * env);
      return e.t < e.dur;
    });
    for (const k of Object.keys(this.expr)) this.expr[k] = damp(this.expr[k], this.exprT[k], 8, dt);
    // lip sync
    const lvl = this.mouth.level;
    const shape = this.mouth.shape; // 0 dark (ou/oh) .. 1 bright (ee/ih)
    const open = clamp(lvl * 1.6, 0, 1);
    const tgt = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    if (open > 0.02) {
      if (shape < 0.33) { tgt.oh = open * (1 - shape * 2); tgt.ou = open * 0.4; tgt.aa = open * shape * 1.5; }
      else if (shape < 0.66) { tgt.aa = open; tgt.oh = open * 0.2; }
      else { tgt.ee = open * 0.6; tgt.ih = open * 0.5; tgt.aa = open * 0.3; }
    }
    for (const k of Object.keys(tgt)) this.mouthV[k] = damp(this.mouthV[k], tgt[k], 22, dt);
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkV = 1; this.blinkT = 1.8 + Math.random() * 3.8; if (Math.random() < 0.15) this.blinkT = 0.25; }
    this.blinkV = Math.max(0, this.blinkV - dt * 7);
    const blink = Math.sin(this.blinkV * Math.PI);
    const happy = this.expr.happy;
    const mouthScale = 1 - happy * 0.45 - this.expr.surprised * 0.3;
    em.setValue('happy', happy * 0.85);
    em.setValue('surprised', this.expr.surprised);
    em.setValue('sad', this.expr.sad);
    em.setValue('angry', this.expr.angry);
    em.setValue('relaxed', this.expr.relaxed);
    em.setValue('blink', happy > 0.6 ? 0 : blink * (1 - happy));
    for (const k of Object.keys(tgt)) em.setValue(k, this.mouthV[k] * mouthScale);
  }
}
