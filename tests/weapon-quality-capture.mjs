import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.WEAPON_CAPTURE_OUTPUT || 'docs/weapon-quality/after-viewmodels';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto('http://127.0.0.1:5200/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__, null, { timeout: 120000 });
  await page.evaluate(() => window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.screen === 'play', null, { timeout: 120000 });
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared, null, { timeout: 120000 });
  const results = [];
  for (let index = 0; index < 8; index++) {
    const result = await page.evaluate(weapon => {
      const app = window.__DEAD_ARRIVAL__;
      const run = app.run;
      run.weapon = weapon;
      run.ownedWeapons = Array.from({ length: 8 }, (_, i) => i);
      run.health = 1000;
      run.angle = 0;
      run.pitch = 0;
      run.mode = 'play';
      app.renderer.render(run, performance.now());
      const diagnostics = app.renderer.diagnostics();
      return { index: weapon, name: app.renderer.weaponGroups[weapon].name,
        calls: diagnostics.calls, triangles: diagnostics.gpuTriangles,
        geometries: diagnostics.geometries, textures: diagnostics.textures };
    }, index);
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(output, `weapon-${index + 1}.png`) });
    results.push(result);
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ weapons: results.map(({ index, name }) => ({ index, name })), errors }));
  if (errors.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ failure: error.message, errors,
    page: await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 500),
      ready: document.readyState, app: !!window.__DEAD_ARRIVAL__ })).catch(() => null) }));
  throw error;
} finally {
  await browser.close();
}
