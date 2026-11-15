// Play every part quickly in headless Chrome: skip each beat after a moment, save one frame per scene to
// shots/smoke/, report page errors and how far each part got. usage: node tools/smoke.mjs [firstPart] [lastPart]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [first = 1, last = 39] = process.argv.slice(2).map(Number);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync('shots/smoke', { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=640,360'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.evaluateOnNewDocument(() => { window.__maxDt = 1 / 4; });
await page.goto('file://' + resolve('dist/love-story.html'), { timeout: 120000 });
await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 120000 });
await page.evaluate(() => { __love.voices.setMode('off'); document.getElementById('picker').hidden = true; });
for (let n = first; n <= last; n++) {
  const info = await page.evaluate((n) => {
    const i = __love.parts.findIndex((p) => p.part === n);
    if (i < 0) return null;
    window.__done = false; window.__scene = -1;
    __love.runner.stop();
    __love.runner.playPart(__love.parts[i], { onScene: (s) => { window.__scene = s; } }).then(() => { window.__done = true; });
    return __love.parts[i].scenes.length;
  }, n);
  if (info == null) { console.log(`part ${n}: missing`); continue; }
  const before = errors.length;
  let lastScene = -1, steps = 0;
  const t0 = Date.now();
  while (!(await page.evaluate(() => window.__done)) && Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => window.__scene);
    if (s !== lastScene) {
      lastScene = s;
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: `shots/smoke/p${String(n).padStart(2, '0')}s${s + 1}.jpg`, quality: 60 });
    }
    await page.evaluate(() => __love.runner.skip());
    steps++;
    await new Promise((r) => setTimeout(r, 120));
  }
  const done = await page.evaluate(() => window.__done);
  if (!done) console.log('  stuck at', await page.evaluate(() => JSON.stringify(__love.runner.at)));
  console.log(`part ${n}: ${done ? 'ok' : 'TIMEOUT'} scenes ${lastScene + 1}/${info} skips ${steps} ${Math.round((Date.now() - t0) / 1000)}s` + (errors.length > before ? ' ERRORS: ' + [...new Set(errors.slice(before))].join(' | ') : ''));
}
await browser.close();
