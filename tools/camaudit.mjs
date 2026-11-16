// Camera audit: play each part for a while and measure the director. Per part it reports
//   off  - share of spoken lines where the speaker's face is not in frame (some is fine: reactions, OTS)
//   wide - share of samples on a wide or establishing shot
//   held - most lines in a row played on one unchanged camera position (a stuck camera)
// and saves a frame for the worst moments to shots/camaudit/.
// usage: node tools/camaudit.mjs [first=1] [last=40] [seconds=45] [page=dist/love-story.html]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [first = '1', last = '40', secs = '45', file = 'dist/love-story.html'] = process.argv.slice(2);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync('shots/camaudit', { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=960,540'] });

// what the camera is doing right now, and whether the person talking can be seen
const SAMPLE = () => {
  const L = window.__love, r = L.runner, d = L.director, cam = L.camera;
  const b = r.beats?.[r.at?.beat], who = b?.say && r.actor?.(b.say);
  let seen = null;
  if (who?.eyePos && who.root.visible) {
    const p = who.eyePos(who.pos.clone()).project(cam);
    seen = p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95;
  }
  return { scene: r.at?.scene, beat: r.at?.beat, say: b?.say || null, seen, type: d.shot?.type || null,
    cam: cam.position.toArray().map((n) => Math.round(n * 5) / 5).join(','), letterbox: document.body.classList.contains('letterbox') };
};

for (let part = +first; part <= +last; part++) {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => console.log(`part ${part} pageerror`, e.message));
  await page.evaluateOnNewDocument(() => { window.__maxDt = 1 / 6; });
  await page.goto('file://' + resolve(file) + '?autoplay&part=' + part, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 180000 });
  const S = [];
  for (let t = 0; t < +secs; t += 1.5) {
    await new Promise((r) => setTimeout(r, 1500));
    try { S.push(await page.evaluate(SAMPLE)); } catch { /* page busy */ }
  }
  // longest run of distinct lines on one camera position
  let held = 0, run = new Set(), pos = null, worst = null;
  for (const s of S) {
    if (s.cam !== pos) { pos = s.cam; run = new Set(); }
    if (s.say) run.add(`${s.scene}:${s.beat}`);
    if (run.size > held) { held = run.size; worst = s; }
  }
  const lines = S.filter((s) => s.say && s.seen !== null), off = lines.filter((s) => !s.seen).length;
  const wide = S.filter((s) => ['wide', 'establish'].includes(s.type)).length;
  console.log(`part ${String(part).padStart(2)}  off ${String(Math.round((100 * off) / Math.max(1, lines.length))).padStart(3)}%  wide ${String(Math.round((100 * wide) / Math.max(1, S.length))).padStart(3)}%  held ${held} lines${held >= 4 ? `  (scene ${worst.scene} beat ${worst.beat}, ${worst.type})` : ''}`);
  if (held >= 4 || off > lines.length * 0.4) await page.screenshot({ path: `shots/camaudit/p${String(part).padStart(2, '0')}.jpg`, quality: 60 });
  await page.close();
}
await browser.close();
