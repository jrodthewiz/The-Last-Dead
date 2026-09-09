import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('http://127.0.0.1:5200/npc-review.html');
  await page.waitForFunction(() => window.__NPC__?.gltf?.scene);
  await page.waitForTimeout(250);

  const result = await page.evaluate(async () => {
    const [wardenModule, bellwraithModule, variation] = await Promise.all([
      import('./npc-warden.js'),
      import('./npc-bellwraith.js'),
      import('./enemy-variation.js'),
    ]);
    const { createWarden, resetWarden } = wardenModule;
    const { createBellwraith, resetBellwraith, getBellwraithCacheStats } = bellwraithModule;
    const { gltf, scene, camera } = window.__NPC__;
    const wardenSpecs = [
      [0, 'stalker'], [0, 'skitter'], [0, 'bloodhound'],
      [1, 'caster'], [1, 'hexer'], [1, 'mireSinger'],
      [2, 'brute'], [2, 'warden'],
    ];
    const wardens = wardenSpecs.map(([kind, key]) => createWarden(gltf.scene, gltf.animations, kind, key));
    const wardenMaterials = wardens.map(root => root.userData.warden.materials[0]);
    const wardenColors = wardenMaterials.map(material => material.color.getHex());
    const wardenKeys = wardens.map(root => root.userData.warden.variant);
    const sharedGeometry = wardens.every(root => {
      let geometry;
      root.userData.warden.model.traverse(object => { if (object.isMesh) geometry ||= object.geometry; });
      return geometry === wardens[0].userData.warden.model.getObjectByName('char1').geometry;
    });
    const bellKeys = ['bellwraith', 'bellwraithEcho', 'rustBell', 'ivoryBell'];
    const bells = bellKeys.map((key, index) => createBellwraith({ variant: key, phase: index * .4 }));
    const bellTwin = createBellwraith({ variant: 'bellwraith', phase: 2.4 });
    const bellColors = bells.map(root => root.userData.bellwraith.materials.bell.color.getHex());
    const bellSurfaceSeeds = bells.map(root => root.userData.bellwraith.appearance.surfaceSeed);
    const geometryByName = root => {
      const map = new Map();
      root.traverse(object => { if (object.isMesh) map.set(object.name, object.geometry); });
      return map;
    };
    const firstBellGeometry = geometryByName(bells[0]);
    const twinBellGeometry = geometryByName(bellTwin);
    const bellGeometryShared = [...firstBellGeometry].every(([name, geometry]) => twinBellGeometry.get(name) === geometry);
    const bellCache = { ...getBellwraithCacheStats() };
    wardens[0].userData.warden.pivot.position.y = .7;
    resetWarden(wardens[0], 'stalker', 0);
    bellTwin.userData.bellwraith.hover.rotation.y = 2.4;
    resetBellwraith(bellTwin, 'bellwraith', 0);
    const resetState = {
      wardenY: wardens[0].userData.warden.pivot.position.y,
      wardenDeadAt: wardens[0].userData.warden.deadAt,
      bellHoverY: bellTwin.userData.bellwraith.hover.rotation.y,
      bellDeadAt: bellTwin.userData.bellwraith.deathAt,
    };

    // Render three close variants as a quick visual smoke capture. The imported
    // character remains the visual base; only its cached material profile differs.
    window.__NPC__.npc.visible = false;
    wardens.slice(0, 3).forEach((root, index) => {
      root.position.x = (index - 1) * 1.5;
      root.position.z = 0;
      root.rotation.y = Math.PI;
      scene.add(root);
    });
    camera.position.set(0, 1.2, 6.2);
    camera.lookAt(0, 1.05, 0);
    window.__NPC__.variants = wardens;
    return {
      catalog: variation.getEnemyVariationCatalog(),
      profileCount: variation.variationProfileCount(),
      wardenKeys,
      wardenColors,
      sharedGeometry,
      bellKeys: bells.map(root => root.userData.bellwraith.variant),
      bellColors,
      bellSurfaceSeeds,
      bellGeometryShared,
      bellCache,
      resetState,
    };
  });
  await page.waitForTimeout(160);
  await page.screenshot({ path: new URL('../docs/enemy-variations.png', import.meta.url).pathname.slice(1) });
  await writeFile(new URL('../docs/enemy-variations.json', import.meta.url), JSON.stringify({ ...result, errors }, null, 2));

  if (errors.length) throw new Error(`Enemy variation page errors: ${errors.join('; ')}`);
  if (result.profileCount < 12) throw new Error(`Expected bounded variation registry, got ${result.profileCount}`);
  if (new Set(result.wardenKeys).size !== 8) throw new Error('Warden variant keys did not resolve uniquely');
  if (new Set(result.wardenColors).size !== 8) throw new Error('Warden palette values did not resolve uniquely');
  if (!result.sharedGeometry) throw new Error('Warden variants duplicated imported geometry');
  if (new Set(result.bellKeys).size !== 4) throw new Error('Bellwraith variant keys did not resolve uniquely');
  if (new Set(result.bellColors).size !== 4) throw new Error('Bellwraith palette values did not resolve uniquely');
  if (new Set(result.bellSurfaceSeeds).size !== 4) throw new Error('Bellwraith surface maps are not varied by profile');
  if (!result.bellGeometryShared) throw new Error('Bellwraith instances did not reuse cached profile geometry');
  if (result.bellCache.templates !== 4 || result.bellCache.geometries < 4) throw new Error('Bellwraith geometry cache is not bounded per profile');
  if (result.resetState.wardenY !== 0 || result.resetState.wardenDeadAt !== null) throw new Error('Warden reset did not clear actor state');
  if (result.resetState.bellHoverY !== 0 || result.resetState.bellDeadAt !== null) throw new Error('Bellwraith reset did not clear actor state');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
