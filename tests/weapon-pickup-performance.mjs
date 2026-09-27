import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  // Exercise the production pickup builder without loading the whole arena.
  await page.route('**/pickup-probe.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('http://127.0.0.1:5200/pickup-probe.html');
  console.log('Pickup probe loaded');
  const result = await page.evaluate(async () => {
    const THREE = await import('./vendor/three.module.js');
    const { buildDungeonWeaponLoot, updateDungeonWeaponLoot } = await import('./dungeon-weapon-loot.js');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 800 / 600, .1, 100);
    camera.position.set(0, 4, 10); camera.lookAt(0, 1.5, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2));
    const floor = new THREE.Mesh(new THREE.BoxGeometry(12, .2, 12), new THREE.MeshStandardMaterial());
    floor.position.y = -.15; scene.add(floor);
    const renderer = new THREE.WebGLRenderer(); renderer.setSize(800, 600);
    document.body.append(renderer.domElement);
    const items = buildDungeonWeaponLoot(scene, { dungeon: true, loot: [
      { id: 'first', weaponIndex: 1, rarity: 'rare', x: 0, y: 0 },
      { id: 'second', weaponIndex: 4, rarity: 'uncommon', x: 1.2, y: 0 },
    ] });
    updateDungeonWeaponLoot(items, [], 0);
    await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
    const gl = renderer.getContext(); gl.finish();
    let programs = 0;
    const createProgram = gl.createProgram.bind(gl);
    gl.createProgram = (...args) => { programs++; return createProgram(...args); };
    const rows = [];
    const collected = [];
    for (const item of items) {
      collected.push(item.id);
      const before = programs, start = performance.now();
      updateDungeonWeaponLoot(items, collected, 1000);
      renderer.render(scene, camera); gl.finish();
      let lights = 0; scene.traverseVisible(node => { if (node.isPointLight) lights++; });
      rows.push({ id: item.id, ms: performance.now() - start, programs: programs - before, lights,
        visible: item.root.visible, intensity: item.light.intensity });
    }
    return { rows, contextLost: gl.isContextLost() };
  });
  await mkdir('.logs', { recursive: true });
  await page.screenshot({ path: '.logs/weapon-pickup-probe.png' });
  await writeFile('.logs/weapon-pickup-probe.json', JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(result.contextLost, false);
  assert.ok(result.rows.every(row => row.programs === 0), 'collecting a weapon must not rebuild scene shaders');
  assert.ok(result.rows.every(row => !row.visible && row.intensity === 0), 'collected display and illumination disappear');
} finally {
  await browser.close();
}
