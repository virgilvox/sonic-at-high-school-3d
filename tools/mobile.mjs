// Phone check: emulate a 390x844 touch screen, tap Play, toggle Free cam and drag to orbit. Saves shots/mobile-*.jpg.
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile' });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.evaluateOnNewDocument(() => { window.__maxDt = 1 / 4; });
await page.goto('file://' + resolve('dist/love-story.html'), { timeout: 180000 });
await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 180000 });
await page.screenshot({ path: 'shots/mobile-1-picker.jpg', quality: 60 });
await page.tap('#playBtn');
await new Promise((r) => setTimeout(r, 14000));
await page.screenshot({ path: 'shots/mobile-2-play.jpg', quality: 60 });
await page.tap('#freecam');
const before = await page.evaluate(() => __love.camera.position.toArray().map((n) => n.toFixed(2)).join(','));
await page.mouse.move(200, 400); await page.mouse.down(); await page.mouse.move(320, 380, { steps: 12 }); await page.mouse.up();
await new Promise((r) => setTimeout(r, 1500));
const after = await page.evaluate(() => __love.camera.position.toArray().map((n) => n.toFixed(2)).join(','));
await page.screenshot({ path: 'shots/mobile-3-freecam.jpg', quality: 60 });
console.log('free cam moved:', before !== after, before, '->', after, 'errors:', errors.length ? errors : 'none');
await browser.close();
