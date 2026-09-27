import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { errors: [] };
await mkdir('.logs/dev-flight', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => report.errors.push(error.message));
  // Keep screenshots from releasing pointer lock and implicitly pausing QA.
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve(); });
  await page.goto('http://127.0.0.1:5200/?dev=1&dungeon=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer._weaponsPrepared, null, { timeout: 180000 });
  await page.locator('[data-dev-inspect]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.inspector.active);
  const initial = await page.evaluate(() => {
    const { run, inspector } = window.__DEAD_ARRIVAL__;
    return { pose: { ...inspector.pose }, player: { x: run.x, y: run.y, z: run.z, angle: run.angle, pitch: run.pitch, time: run.time, health: run.health }, records: run.storyRecords.length };
  });
  await page.keyboard.down('Space'); await page.keyboard.down('Shift');
  await page.waitForTimeout(700);
  await page.keyboard.up('Space'); await page.keyboard.up('Shift');
  await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w');
  const flown = await page.evaluate(() => ({ ...window.__DEAD_ARRIVAL__.inspector.pose }));
  assert.ok(flown.y > initial.pose.y + 5, 'flies above the roof');
  assert.ok(Math.hypot(flown.x - initial.pose.x, flown.z - initial.pose.z) > 1);
  await page.mouse.wheel(0, -100);
  assert.ok(await page.evaluate(() => window.__DEAD_ARRIVAL__.inspector.speed > 12));
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.up('ArrowUp');
  assert.ok(await page.evaluate(() => window.__DEAD_ARRIVAL__.inspector.pose.pitch > 0));
  await page.screenshot({ path: '.logs/dev-flight/flying.png' });
  await page.keyboard.press('r');
  assert.deepEqual(await page.evaluate(() => ({ ...window.__DEAD_ARRIVAL__.inspector.pose })), initial.pose);
  // A document underneath the inspection camera must not be collected.
  await page.evaluate(() => { const { inspector, run } = window.__DEAD_ARRIVAL__; const item = run.course.evidence[0]; inspector.pose.x = item.x * 4; inspector.pose.z = item.y * 4; });
  await page.waitForTimeout(250);
  const frozen = await page.evaluate(() => { const { run } = window.__DEAD_ARRIVAL__; return { player: { x: run.x, y: run.y, z: run.z, angle: run.angle, pitch: run.pitch, time: run.time, health: run.health }, records: run.storyRecords.length }; });
  assert.deepEqual(frozen.player, initial.player); assert.equal(frozen.records, initial.records);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.screen), 'pause');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.inspector.active), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.logs/dev-flight/narrow.png' });
  assert.ok(await page.locator('.dev-inspector').evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.keyboard.press('F2');
  await page.waitForFunction(() => !window.__DEAD_ARRIVAL__.inspector.active && window.__DEAD_ARRIVAL__.run.time > 0);
  assert.equal(await page.evaluate(() => window.__DEAD_ARRIVAL__.renderer.freeCamera), null);
  assert.equal(await page.locator('.dev-inspector').isVisible(), false);
  report.initial = initial; report.flown = flown; report.frozen = frozen;
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} finally {
  await writeFile('.logs/dev-flight/report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
