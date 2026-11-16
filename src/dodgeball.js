// Dodgeball staging for scenes marked "game": "dodgeball". Teams come from the script itself: whoever throws at
// someone is on the other side (the throw graph is two-coloured), anyone left over evens the teams. Each team lines
// up on its half of the court facing the other, the coach stands on the sideline, balls wait on the centre line,
// and a throw sends a ball in an arc from the thrower's hand to the target.
import * as THREE from 'three';
import { toon } from './toon.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

export function teamsFor(sc, players) {
  const edges = sc.beats.filter((b) => b.do === 'throw' && b.to).map((b) => [b.say || b.who, b.to]).filter(([a, b]) => players.includes(a) && players.includes(b));
  const side = new Map();
  for (const [a, b] of edges) {
    if (!side.has(a) && !side.has(b)) side.set(a, 0);
    if (side.has(a) && !side.has(b)) side.set(b, 1 - side.get(a));
    else if (side.has(b) && !side.has(a)) side.set(a, 1 - side.get(b));
  }
  for (const p of players) if (!side.has(p)) {
    const n0 = [...side.values()].filter((v) => v === 0).length;
    side.set(p, n0 <= side.size - n0 ? 0 : 1);
  }
  return [players.filter((p) => side.get(p) === 0), players.filter((p) => side.get(p) === 1)];
}

export class Dodgeball {
  constructor(scene) { this.scene = scene; this.balls = []; this.group = null; }

  // Put players on the court; returns { id: [x, z, yawDeg] } for everyone placed.
  setup(sc, set, ids) {
    this.clear();
    const coach = sc.coach && ids.includes(sc.coach) ? sc.coach : null;
    const players = ids.filter((id) => id !== coach && id !== 'crowd' && id !== 'fangirls' && id !== 'narrator');
    const [a, b] = teamsFor(sc, players);
    const place = {};
    const line = (team, z, yaw) => team.forEach((id, i) => { place[id] = [(i - (team.length - 1) / 2) * 1.5, z + (i % 2 ? 0.7 : 0), yaw]; });
    line(a, -3.2, 0); line(b, 3.2, 180);
    if (coach) place[coach] = [-(set.size[0] / 2) + 1.4, 0, 90];
    this.group = new THREE.Group();
    const court = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    court.rotation.x = -Math.PI / 2; court.position.y = 0.012; this.group.add(court);
    for (let i = 0; i < 3; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), toon('#d8392b'));
      ball.castShadow = true;
      ball.position.set((i - 1) * 1.6, 0.13, 0);
      ball.userData.home = ball.position.clone();
      this.group.add(ball); this.balls.push(ball);
    }
    this.scene.add(this.group);
    this.teams = [a, b];
    return place;
  }

  // Keep the court busy under the dialogue: players who are not talking strafe around their half or throw at the
  // other side, and the target jumps it or takes the hit. Stops when the scene changes (clear()).
  ambient(r) {
    const tok = (this.tok = Symbol()), rnd = (a, b) => a + Math.random() * (b - a);
    const free = (a) => a && a.root.visible && !a.speaking && !a.path && !a.oneShot;
    (async () => {
      await new Promise((res) => setTimeout(res, 1500));
      while (tok === this.tok && this.teams) {
        await new Promise((res) => setTimeout(res, rnd(1400, 2600)));
        if (tok !== this.tok || r.paused) continue;
        const side = Math.random() < 0.5 ? 0 : 1, team = this.teams[side].map((id) => r.actor(id)).filter(free);
        const foes = this.teams[1 - side].map((id) => r.actor(id)).filter((a) => a && a.root.visible);
        const a = team[Math.floor(Math.random() * team.length)];
        if (!a) continue;
        if (Math.random() < 0.55 || !foes.length) {   // strafe
          const z = (side ? 1 : -1) * rnd(2.2, 4.4), p = r.bodies.walkable(new THREE.Vector3(rnd(-5, 5), 0, z));
          a.walk([p], { speed: rnd(1.6, 2.6) }).then(() => a.faceYaw(side ? Math.PI : 0, 6));
        } else {   // throw
          const t = foes[Math.floor(Math.random() * foes.length)];
          a.faceTo(t); a.play('OverhandThrow');
          this.throw(a, t).then(() => { if (Math.random() < 0.5) t.play('NinjaJump_Start'); else { t.play('Hit_Chest'); r.sound.sfx('thud'); } });
        }
      }
    })();
  }

  clear() { this.tok = null; if (this.group) this.scene.remove(this.group); this.group = null; this.balls = []; this.teams = null; }

  // Fly a ball from the thrower's hand to the target's chest. Resolves on impact.
  async throw(thrower, target) {
    if (!this.balls.length) return;
    const ball = this.balls.reduce((best, b) => (b.position.distanceTo(thrower.pos) < best.position.distanceTo(thrower.pos) ? b : best));
    const hand = (thrower.bone('rightHand') || thrower.bone('head')).getWorldPosition(V());
    ball.position.copy(hand);
    await sleep(0.25);   // wind up
    const from = (thrower.bone('rightHand') || thrower.bone('head')).getWorldPosition(V());
    const to = target ? target.chestPos(V()) : from.clone().add(V(0, 0, 5));
    const dur = Math.max(0.35, from.distanceTo(to) / 12), t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / 1000 / dur);
        ball.position.lerpVectors(from, to, t);
        ball.position.y += Math.sin(t * Math.PI) * 0.6;
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    // bounce away and roll back to the centre line
    const home = ball.userData.home, drop = ball.position.clone();
    const t1 = performance.now();
    const roll = () => {
      const t = Math.min(1, (performance.now() - t1) / 1400);
      ball.position.lerpVectors(drop, home, t);
      ball.position.y = Math.max(0.13, home.y + Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 0.8 + (1 - t) * (drop.y - 0.13) * (t < 0.15 ? 1 : 0));
      if (t < 1) requestAnimationFrame(roll);
    };
    roll();
  }
}
