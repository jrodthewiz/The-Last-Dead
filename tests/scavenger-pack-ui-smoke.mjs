// Isolated pack UI check; does not start the game or use the user's browser tab.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startServer} from '../server.mjs';
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = 'output/playwright/scavenger-pack';
await mkdir(output, {recursive: true});
const server = await startServer({root: path.resolve('.'), port: 0, host: '127.0.0.1'});
let browser;
const report = {errors: [], sizes: [], actions: []};
try {
  browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH});
  for (const [width, height] of [[1280, 720], [390, 844], [844, 390], [320, 640]]) {
    const context = await browser.newContext({viewport: {width, height}, hasTouch: width < 600});
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/scavenger-pack.js`);
    await page.setContent('<html><head><link rel="stylesheet" href="/scavenger-pack.css"></head><body style="margin:0;background:#101512"></body></html>');
    await page.evaluate(async () => {
      const {createScavengerPackUI} = await import('/scavenger-pack-ui.js');
      const {createScavengerPack, upgradeWeapon} = await import('/scavenger-pack.js');
      const run = {mode: 'play', health: 100, weapon: 0, ownedWeapons: [0, 1, 2, 3, 4, 5, 6, 7],
        backpack: createScavengerPack({scrap: 12}), events: []};
      window.__packRun = run;
      window.__packUI = createScavengerPackUI({getRun: () => run,
        onOpen: () => {run.mode = 'pause';}, onClose: () => {run.mode = 'play';},
        onUpgrade: index => upgradeWeapon(run, index),
        onEquip: index => { if (!run.ownedWeapons.includes(index)) return false; run.weapon = index; return true; }});
      window.__packUI.update(run, {visible: true});
    });
    if (width === 1280) {
      const materials = await page.evaluate(async () => {
        const {districtPanelSkin} = await import('/district-materials.js');
        const skins = Array.from({length: 5}, (_, dungeonIndex) => districtPanelSkin({extended: true, dungeonIndex}));
        const map = skins[0].material.map;
        await new Promise((resolve, reject) => {
          const deadline = performance.now() + 10000;
          const check = () => map.image?.naturalWidth ? resolve() : performance.now() > deadline ? reject(Error('Atlas did not decode')) : setTimeout(check, 20);
          check();
        });
        const result = {width: map.image.naturalWidth, source: map.image.src,
          shared: skins.every(skin => skin.material.map === map),
          styles: skins.map(({material}) => [material.color.getHex(), material.roughness, material.metalness]),
          uvSafe: skins.every(skin => [true, false].every(horizontal => {
            const geometry = skin.geometry(horizontal), uv = geometry.attributes.uv;
            const safe = [...uv.array].every(value => value > 0 && value < 1);
            geometry.dispose(); return safe;
          }))};
        skins.forEach(skin => skin.material.dispose());
        return result;
      });
      assert.ok(materials.width > 0 && materials.shared && materials.uvSafe);
      assert.match(materials.source, /service-district-atlas-v1.webp$/);
      assert.equal(new Set(materials.styles.map(style => JSON.stringify(style))).size, 5);
      report.materials = materials;
    }
    await page.getByRole('button', {name: /Open backpack/}).click();
    assert.equal(await page.getByRole('dialog').isVisible(), true);
    assert.equal(await page.evaluate(() => window.__packRun.mode), 'pause');
    const fit = await page.evaluate(() => {
      const panel = document.querySelector('.pack-panel'), rect = panel.getBoundingClientRect();
      return {width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
        panelWidth: rect.width, panelLeft: rect.left, panelRight: rect.right,
        panelScrollWidth: panel.scrollWidth, panelClientWidth: panel.clientWidth,
        buttons: [...panel.querySelectorAll('button')].filter(button=>!button.closest('[hidden]')).map(button => ({height: button.getBoundingClientRect().height,
          scrollWidth: button.scrollWidth, clientWidth: button.clientWidth}))};
    });
    assert.equal(fit.overflow, false);
    assert.ok(fit.panelLeft >= 17 && fit.panelRight <= width - 17, 'panel respects horizontal safe padding');
    assert.ok(fit.panelScrollWidth <= fit.panelClientWidth + 1);
    assert.ok(fit.buttons.every(button => button.height >= 44));
    assert.ok(fit.buttons.every(button => button.scrollWidth <= button.clientWidth + 1));
    report.sizes.push(fit);
    await page.screenshot({path: `${output}/backpack-${width}x${height}.png`});
    await page.locator('[data-pack-weapon="6"]').click();
    await page.getByRole('button', {name: 'FIT WEAPON 8 SCRAP'}).click();
    assert.deepEqual(await page.evaluate(() => ({scrap: window.__packRun.backpack.scrap,
      mods: window.__packRun.backpack.weaponMods, currentWeapon: window.__packRun.weapon})),
    {scrap: 4, mods: {6: 'hardened-fitting'}, currentWeapon: 0});
    assert.equal(await page.getByRole('button', {name: 'FITTED +25% DAMAGE'}).isDisabled(), true);
    const stability = await page.evaluate(async () => {
      const root = window.__packUI.root;
      let mutations = 0;
      const observer = new MutationObserver(records => mutations += records.length);
      observer.observe(root, {subtree: true, childList: true, attributes: true, characterData: true});
      for (let frame = 0; frame < 120; frame++) window.__packUI.update(window.__packRun, {visible: true});
      await Promise.resolve(); observer.disconnect();
      return {mutations, status: root.querySelector('.pack-status').textContent};
    });
    assert.equal(stability.mutations, 0, 'unchanged frames do not rewrite the DOM');
    assert.match(stability.status, /fitted. Damage increased by 25%/);
    await page.getByRole('button', {name: 'EQUIP', exact: true}).click();
    assert.equal(await page.evaluate(() => window.__packRun.weapon), 6);
    assert.equal(await page.evaluate(() => window.__packRun.mode), 'pause', 'equipping keeps inventory open');
    assert.equal(await page.getByRole('button', {name: 'EQUIPPED', exact:true}).isDisabled(), true);
    assert.match(await page.locator('[data-pack-type]').textContent(), /MELEE/);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__packRun.mode), 'play');
    await page.getByRole('button', {name: /Open backpack/}).click();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.packWeapon), '7');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.className), 'pack-close');
    await page.keyboard.press('b');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    await page.evaluate(() => { window.__packRun.ownedWeapons = [0, 6]; window.__packUI.update(window.__packRun, {visible:true}); });
    await page.getByRole('button', {name:/Open backpack/}).click();
    assert.equal(await page.locator('.pack-empty').count(),6);
    assert.equal(await page.locator('[data-pack-weapon]').count(),2);
    assert.match(await page.locator('[data-pack-count]').textContent(),/2 \/ 8/);
    await page.screenshot({path:`${output}/backpack-scavenged-${width}x${height}.png`});
    await page.keyboard.press('Escape');
    await page.evaluate(async()=>{const {makeHarborCourse}=await import('/harbor-course.js');const r=window.__packRun;r.course=makeHarborCourse();r.vehicle={...r.course.vehicle,distance:0};Object.assign(r,{x:16,y:16,angle:0});window.__packUI.update(r,{visible:true});});
    await page.getByRole('button',{name:/Open backpack/}).click();
    await page.getByRole('button',{name:'FIELD MAP',exact:true}).click();
    assert.equal(await page.locator('.harbor-field-map').isVisible(),true);
    const mapFit=await page.evaluate(async()=>{
      const p=document.querySelector('.pack-panel');let mutations=0;
      const observer=new MutationObserver(r=>mutations+=r.length);observer.observe(p,{subtree:true,attributes:true,childList:true});
      for(let i=0;i<120;i++)window.__packUI.update(window.__packRun,{visible:true});await Promise.resolve();observer.disconnect();
      return {mutations,overflow:p.scrollWidth>p.clientWidth+1,landmarks:p.querySelectorAll('.pack-map-notes li').length};
    });assert.deepEqual(mapFit,{mutations:0,overflow:false,landmarks:6});
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[hidden]')),false);
    await page.screenshot({path:`${output}/field-map-${width}x${height}.png`});
    await page.getByRole('button',{name:'EQUIPMENT',exact:true}).click();
    assert.equal(await page.locator('.pack-gear').isVisible(),true);
    await page.getByRole('button',{name:'EQUIPMENT',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.pack-map').isVisible(),true);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.pack-gear').isVisible(),true);
    await page.evaluate(()=>{window.__packRun.ownedWeapons=[];window.__packUI.update(window.__packRun,{visible:true});});
    assert.match(await page.locator('.pack-status').innerText(),/Find a weapon/);
    assert.equal(await page.locator('.pack-upgrade').isDisabled(),true);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.pack-panel').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.keyboard.press('Escape');
    report.actions.push({width, height, opened: true, upgrade: true, keyboardClose: true, focusTrap: true, fieldMap:true, unchangedFrameMutations: stability.mutations});
    await page.evaluate(async()=>{
      window.__packUI.destroy();
      const {createScavengerPackUI}=await import('/scavenger-pack-ui.js');
      const r=window.__packRun;r.ownedWeapons=[0,1];r.weapon=0;r.backpack.scrap=12;r.backpack.weaponMods={};
      window.__packUI=createScavengerPackUI({getRun:()=>r,onEquip:()=>false,onUpgrade:()=>({ok:false})});
      window.__packUI.update(r,{visible:true});window.__packUI.open();
    });
    await page.locator('[data-pack-weapon="1"]').click();
    await page.locator('.pack-equip').click();
    assert.match(await page.locator('.pack-status').innerText(),/Cannot equip/);
    await page.locator('.pack-upgrade').click();
    assert.match(await page.locator('.pack-status').innerText(),/Fitting unavailable/);
    assert.equal(await page.locator('.pack-status').getAttribute('data-state'),'error');
    assert.equal(await page.evaluate(()=>window.__packRun.backpack.scrap),12);
    await page.screenshot({path:`${output}/equipment-error-${width}x${height}.png`});
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser?.close();
  server.server.closeAllConnections();
  await new Promise(resolve => server.server.close(resolve));
}
