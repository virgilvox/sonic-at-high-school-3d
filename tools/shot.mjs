// Play a part in headless Chrome and save a frame every few seconds, plus console errors.
// usage: node tools/shot.mjs <part> [seconds=40] [every=4]
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [part = '1', secs = '40', every = '4'] = process.argv.slice(2);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = process.env.QUERY ? `shots/${process.env.QUERY.replace(/[^a-z0-9]+/gi, '_')}` : `shots/p${part.padStart(2, '0')}`;
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=960,540'] });
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/LookAtDegreeMap|GPU stall/.test(m.text())) console.log(m.type(), m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.evaluateOnNewDocument(() => { window.__maxDt = 1 / 6; });
const query = process.env.QUERY || `autoplay&part=${part}`;   // QUERY='test=lineup' for diagnostics
await page.goto('file://' + resolve('dist/love-story.html') + '?' + query, { timeout: 120000 });
await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 120000 });
for (let t = 0; t <= +secs; t += +every) {
  await new Promise((r) => setTimeout(r, +every * 1000));
  // read the caption and the probe in one go, before the (slow) screenshot, so they describe the same moment
  const [cap, probe] = await page.evaluate((p) => [document.getElementById('cap').textContent.trim(), p ? (0, eval)(p) : ''], process.env.PROBE || '');
  await page.screenshot({ path: `${out}/${String(t).padStart(3, '0')}.jpg`, quality: 70 });
  console.log(t, cap.slice(0, 90), probe);
}
await browser.close();
