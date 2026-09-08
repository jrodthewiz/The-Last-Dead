import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5200/?debug=1', { waitUntil: 'networkidle' });
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => !!window.__DEAD_ARRIVAL__?.renderer?.wardenTemplate);
  const results = [];
  for (let weapon = 0; weapon < 4; weapon++) {
    await page.evaluate(index => {
      const d = window.__DEAD_ARRIVAL__;
      d.run.weapon = index;
      d.run.health = 100;
      d.run.angle = 0;
      d.run.pitch = 0;
    }, weapon);
    await page.waitForTimeout(260);
    await page.screenshot({ path: path.join(root, 'docs', 'build08-art', `weapon-game-${weapon}.png`) });
    results.push(await page.evaluate(index => {
      const d = window.__DEAD_ARRIVAL__;
      const w = d.renderer.weaponGroups[index];
      let meshes = 0, triangles = 0;
      w.traverse(node => { if (node.isMesh) { meshes++; triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; } });
      return { weapon: index, name: w.name, meshes, triangles, muzzle: !!w.userData.muzzle, errors: d.renderer.diagnostics?.()?.errors || 0 };
    }, weapon));
  }
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser.close();
}
