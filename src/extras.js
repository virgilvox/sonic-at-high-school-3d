// Background students: the CC0 VRoid samples (from KEYHOLDER) filling the school around the cast. Each place gets
// a few: walkers patrolling the back of a hallway or the school front, people chatting by the lockers, students in
// the seats nobody in the scene uses, onlookers at sports, dancers at prom. They never speak or become camera
// subjects, but they are solid bodies, and they cheer along when the script gives "crowd" or "fangirls" a line.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
export const EXTRA_IDS = Array.from({ length: 8 }, (_, i) => 'extra' + (i + 1));

// how many and what they do, per set: walk (patrol), chat (stand in pairs), sit (take free seats), watch, dance
const PLAN = {   // only where a school crowd belongs; never the ball games, sports or quiet places
  hallway: { walk: 2, chat: 2 }, schoolfront: { walk: 2, chat: 2 }, classroom: { sit: 3 }, cafeteria: { sit: 5 },
  stage: { sit: 6 }, prom: { dance: 6 },
};

export class Extras {
  constructor(runner) { this.r = runner; this.list = []; this.token = 0; }

  // Which extras a scene wants (so the runner can load them first).
  want(sc) {
    const p = PLAN[sc.set];
    if (!p || sc.time === 'dream' || sc.game) return [];
    const n = Math.min(EXTRA_IDS.length, Object.values(p).reduce((a, b) => a + b, 0));
    const off = (sc.set.length * 3 + (sc.beats?.length || 0)) % EXTRA_IDS.length;   // vary who appears per scene
    return Array.from({ length: n }, (_, i) => EXTRA_IDS[(off + i) % EXTRA_IDS.length]);
  }

  populate(sc, set, freeSeats) {
    this.clear();
    const p = PLAN[sc.set], ids = this.want(sc);
    if (!p || !ids.length) return;
    const tok = ++this.token, pool = ids.map((id) => this.r.cast.get(id)).filter(Boolean);
    const take = () => pool.shift();
    const B = set.bounds, open = this.r.director.openDir(V(set.spots.center[0], 0, set.spots.center[1]));
    const back = (t) => this.r.bodies.walkable(V(set.spots.center[0], 0, set.spots.center[1]).addScaledVector(open, -t));
    const show = (a, x, z, yaw) => { a.place(x, z, yaw); a.root.visible = true; a.stopOneShot(); a.setBase('Idle_Loop', 0); a.mood = { happy: 0.2 }; this.list.push(a); };
    for (let i = 0; i < (p.sit || 0) && freeSeats.length; i++) {
      const a = take(); if (!a) break;
      const [x, z, yaw] = freeSeats.splice((i * 3) % freeSeats.length, 1)[0];
      show(a, x, z, yaw * DEG); a.setBase('Sitting_Idle_Loop', 0);
    }
    for (let i = 0; i < (p.chat || 0); i += 2) {   // a pair facing each other near the back wall
      const c = back(1.6).add(V((i - 1) * 2.2, 0, 0));
      for (const s of [-1, 1]) { const a = take(); if (!a) break; const q = this.r.bodies.walkable(c.clone().add(V(s * 0.55, 0, 0))); show(a, q.x, q.z, s < 0 ? 90 * DEG : -90 * DEG); }
    }
    for (let i = 0; i < (p.watch || 0); i++) {   // a loose line along the far side, facing the action
      const a = take(); if (!a) break;
      const q = this.r.bodies.walkable(back(B.z[1] - B.z[0] > 12 ? 5 : 3).add(V((i - (p.watch - 1) / 2) * 1.6, 0, 0)));
      show(a, q.x, q.z, Math.atan2(open.x, open.z));
    }
    for (let i = 0; i < (p.dance || 0); i++) {
      const a = take(); if (!a) break;
      const ang = (i / p.dance) * Math.PI * 2, q = this.r.bodies.walkable(V(Math.sin(ang) * 3.2, 0, -1.5 + Math.cos(ang) * 2));
      show(a, q.x, q.z, ang + Math.PI); a.setBase('Dance_Loop', 0);
    }
    for (let i = 0; i < (p.walk || 0); i++) {   // patrol a line across the back, pausing at each end
      const a = take(); if (!a) break;
      const w = Math.min(B.x[1] - B.x[0], B.z[1] - B.z[0] > 10 ? 14 : 10) / 2 - 0.8, lane = back(0.9 + i * 0.9);
      const ends = [this.r.bodies.walkable(lane.clone().add(V(-w, 0, 0))), this.r.bodies.walkable(lane.clone().add(V(w, 0, 0)))];
      let k = i % 2;
      show(a, ends[k].x, ends[k].z, 0);
      (async () => {
        await new Promise((res) => setTimeout(res, 400 + i * 1500));
        while (tok === this.token) {
          k = 1 - k;
          await Promise.race([a.walk([ends[k]], { speed: 1.0 + i * 0.15 }), new Promise((res) => setTimeout(res, 15000))]);
          await new Promise((res) => setTimeout(res, 1200 + Math.random() * 2500));
        }
      })();
    }
  }

  // The script gave a crowd line: everyone around reacts.
  cheer(dur = 2) {
    for (const a of this.list) { if (!a.baseClip.startsWith('Sitting')) a.gesture('cheer', { dur }); a.emote('happy', 0.8, dur + 0.5); a.speaking = true; }
    setTimeout(() => { for (const a of this.list) a.speaking = false; }, dur * 1000);
  }

  clear() { this.token++; for (const a of this.list) { a.root.visible = false; a.path = null; a.speaking = false; } this.list = []; }
}
