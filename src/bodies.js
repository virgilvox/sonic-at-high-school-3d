// Characters as solid bodies. Each visible actor is a vertical capsule sized to their height. Every frame overlapping
// pairs are pushed apart (whoever is walking gives way more than whoever stands still), and everyone is kept inside
// the room and out of furniture. Also: finding a clear spot to stand next to someone, and a detour waypoint when a
// straight walk would pass through another person.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const radius = (a) => 0.28 * Math.min(1.25, Math.max(0.75, (a.height || 1.6) / 1.6));
// Seated, lying or hidden actors are fixed in place; contact (a hug, a kiss) lets a named pair touch.
const fixed = (a) => !a.root.visible || a.lieOn || a.baseClip?.startsWith('Sitting');
const touching = (a, b) => a.contact === b.id || b.contact === a.id;
// Furniture that blocks feet: anything between ankle and chest height (desks, beds, lockers, benches, cars).
const blocks = (box) => box.min.y < 1.0 && box.max.y > 0.35;

const CELL = 0.25, BODY = 0.36;   // walk grid resolution and the body radius furniture is inflated by

export class Bodies {
  constructor() { this.set = null; this.actors = []; this.grid = null; }
  use(set, actors) { this.set = set; this.actors = actors; this.grid = set ? buildGrid(set) : null; }

  // ---- walk grid: which floor cells a body can stand on
  cellOf(p) { const G = this.grid; return [Math.floor((p.x - G.x0) / CELL), Math.floor((p.z - G.z0) / CELL)]; }
  free(i, k) { const G = this.grid; return i >= 0 && k >= 0 && i < G.nx && k < G.nz && !G.blocked[k * G.nx + i]; }
  center(i, k) { const G = this.grid; return V(G.x0 + (i + 0.5) * CELL, 0, G.z0 + (k + 0.5) * CELL); }
  // the nearest standable point to p (p itself when it is fine)
  walkable(p) {
    if (!this.grid) return p;
    const [ci, ck] = this.cellOf(p);
    if (this.free(ci, ck)) return p;
    for (let r = 1; r < 40; r++) {
      let best = null, bd = Infinity;
      for (let i = ci - r; i <= ci + r; i++) for (let k = ck - r; k <= ck + r; k++) {
        if (Math.max(Math.abs(i - ci), Math.abs(k - ck)) !== r || !this.free(i, k)) continue;
        const c = this.center(i, k), d = c.distanceTo(p);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return best;
    }
    return p;
  }
  // straight walk from a to b stays on free cells
  lineFree(a, b) {
    const n = Math.ceil(a.distanceTo(b) / (CELL * 0.5));
    for (let t = 1; t < n; t++) { const p = V().lerpVectors(a, b, t / n), [i, k] = this.cellOf(p); if (!this.free(i, k)) return false; }
    return true;
  }
  // A* over the grid (8 neighbours), then string pulling so the path only turns where furniture makes it
  path(from, to) {
    if (!this.grid || this.lineFree(from, to)) return [to];
    const G = this.grid, [si, sk] = this.cellOf(this.walkable(from)), [ti, tk] = this.cellOf(to);
    const key = (i, k) => k * G.nx + i, h = (i, k) => Math.hypot(i - ti, k - tk);
    const g = new Map([[key(si, sk), 0]]), came = new Map(), open = [[h(si, sk), si, sk]], done = new Set();
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [, i, k] = open.shift(), kk = key(i, k);
      if (done.has(kk)) continue;
      done.add(kk);
      if (i === ti && k === tk) break;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = i + di, nk = k + dk;
        if (!this.free(ni, nk) || (di && dk && (!this.free(i + di, k) || !this.free(i, k + dk)))) continue;
        const ng = g.get(kk) + Math.hypot(di, dk), nkey = key(ni, nk);
        if (ng < (g.get(nkey) ?? Infinity)) { g.set(nkey, ng); came.set(nkey, kk); open.push([ng + h(ni, nk), ni, nk]); }
      }
    }
    if (!came.has(key(ti, tk))) return [to];   // unreachable: walk straight, the bodies keep feet out of furniture
    const cells = [];
    for (let c = key(ti, tk); c !== undefined && c !== key(si, sk); c = came.get(c)) cells.unshift(this.center(c % G.nx, Math.floor(c / G.nx)));
    const pts = [];
    let at = from;
    for (let j = 0; j < cells.length; j++) {
      const next = j + 1 < cells.length ? cells[j + 1] : to;
      if (!this.lineFree(at, next)) { pts.push(cells[j]); at = cells[j]; }
    }
    pts.push(to);
    return pts;
  }

  step() {
    const L = this.actors.filter((a) => a.root.visible);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (touching(a, b)) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = radius(a) + radius(b);
      if (d >= min) continue;
      const wa = fixed(a) ? 0 : a.path ? 0.8 : 0.3, wb = fixed(b) ? 0 : b.path ? 0.8 : 0.3, sum = wa + wb;
      if (!sum) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, push = min - d;
      a.pos.x -= nx * push * (wa / sum); a.pos.z -= nz * push * (wa / sum);
      b.pos.x += nx * push * (wb / sum); b.pos.z += nz * push * (wb / sum);
    }
    for (const a of L) if (!fixed(a)) this.keepOut(a.pos, radius(a));
  }

  // Inside the room, outside furniture (pushed to the nearest free edge).
  keepOut(p, r) {
    const B = this.set?.bounds;
    if (!B) return p;
    const m = this.set.outdoor ? 0 : 0.05;
    p.x = Math.min(B.x[1] + 0.25 - r - m, Math.max(B.x[0] - 0.25 + r + m, p.x));
    p.z = Math.min(B.z[1] + 0.25 - r - m, Math.max(B.z[0] - 0.25 + r + m, p.z));
    for (const box of this.set.solids || []) {
      if (!blocks(box)) continue;
      const x0 = box.min.x - r, x1 = box.max.x + r, z0 = box.min.z - r, z1 = box.max.z + r;
      if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) continue;
      const out = [[p.x - x0, -1, 0], [x1 - p.x, 1, 0], [p.z - z0, 0, -1], [z1 - p.z, 0, 1]].sort((u, v) => u[0] - v[0])[0];
      if (out[1]) p.x = out[1] < 0 ? x0 : x1; else p.z = out[2] < 0 ? z0 : z1;
    }
    return p;
  }

  // Is p free for actor a: inside the room, out of furniture, clear of everyone else?
  clear(p, a) {
    const r = radius(a), q = this.keepOut(p.clone(), r);
    if (q.distanceTo(p) > 0.02) return false;
    return !this.actors.some((o) => o !== a && o.root.visible && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < r + radius(o) + 0.1);
  }

  // A clear spot about dist from target, as close as possible to where a is now (or to prefer).
  spotNear(a, target, dist, prefer = a.pos) {
    const base = Math.atan2(prefer.x - target.x, prefer.z - target.z);
    for (const extra of [0, 0.35, 0.8]) for (let k = 0; k < 12; k++) {
      const ang = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45;
      const p = V(target.x + Math.sin(ang) * (dist + extra), 0, target.z + Math.cos(ang) * (dist + extra));
      if (this.clear(p, a)) return p;
    }
    return this.keepOut(V(target.x + Math.sin(base) * dist, 0, target.z + Math.cos(base) * dist), radius(a));
  }

  // Waypoints for a walk from a to dest: around furniture on the walk grid, then a sidestep around the first person
  // standing in the way of the first leg.
  route(a, dest) {
    dest = this.walkable(dest);
    const from = V(a.pos.x, 0, a.pos.z), legs = this.path(from, dest), first = legs[0];
    return [...this.sidestep(a, from, first), ...legs];
  }
  sidestep(a, from, dest) {
    const seg = V().subVectors(dest, from), len = seg.length();
    if (len < 0.3) return [];
    seg.divideScalar(len);
    let hit = null, hitT = Infinity;
    for (const o of this.actors) {
      if (o === a || !o.root.visible) continue;
      const rel = V(o.pos.x - from.x, 0, o.pos.z - from.z), t = rel.dot(seg);
      if (t < 0.2 || t > len - 0.2) continue;
      const off = rel.clone().addScaledVector(seg, -t).length();
      if (off < radius(a) + radius(o) + 0.15 && t < hitT) { hit = o; hitT = t; }
    }
    if (!hit) return [];
    const side = V(-seg.z, 0, seg.x), gap = radius(a) + radius(hit) + 0.35;
    const opts = [1, -1].map((s) => this.walkable(V(hit.pos.x, 0, hit.pos.z).addScaledVector(side, s * gap)));
    const way = opts.find((p) => this.clear(p, a) && this.lineFree(from, p)) || opts.find((p) => this.clear(p, a));
    return way ? [way] : [];
  }
}

// Floor grid for a set: cells inside the room (or lot) that no furniture footprint, grown by a body radius, covers.
function buildGrid(set) {
  const B = set.bounds, pad = set.outdoor ? 0 : 0.25 - BODY;
  const x0 = B.x[0] - pad, x1 = B.x[1] + pad, z0 = B.z[0] - pad, z1 = B.z[1] + pad;
  const nx = Math.max(1, Math.ceil((x1 - x0) / CELL)), nz = Math.max(1, Math.ceil((z1 - z0) / CELL));
  const blocked = new Uint8Array(nx * nz);
  for (const box of set.solids || []) {
    if (!blocks(box)) continue;
    const i0 = Math.floor((box.min.x - BODY - x0) / CELL), i1 = Math.floor((box.max.x + BODY - x0) / CELL);
    const k0 = Math.floor((box.min.z - BODY - z0) / CELL), k1 = Math.floor((box.max.z + BODY - z0) / CELL);
    for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) blocked[k * nx + i] = 1;
  }
  return { x0, z0, nx, nz, blocked };
}
