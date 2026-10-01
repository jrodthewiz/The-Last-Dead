// Persistent, isolated browser review. Write {id, profile?, stop?} to request.json.
// The baseline shader is preserved before edits under the ignored output folder.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const dependencyRequire = process.env.PLAYWRIGHT_PATH ? createRequire(`${process.env.PLAYWRIGHT_PATH}/package.json`) : require;
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const sharp = dependencyRequire('sharp');
const output = 'output/playwright/bodycam-vhs';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = cb => raf(t => { if (!window.__reviewFreeze) cb(t); });
});
const bookmarks = [
  { name: 'intake', x: 20.5, y: 21.5, angle: 0, pitch: -.035 },
  { name: 'hall', room: 'f1-hall' },
  { name: 'court', room: 'f1-court' },
  { name: 'practical', practical: true },
  { name: 'dark', room: 'f1-hall', dark: true },
];
try {
  await page.goto('http://127.0.0.1:5200/?debug=1&dungeon=0', { waitUntil: 'domcontentloaded' });
  console.log('Review page loaded; preparing assets');
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__.screen === 'play');
  await page.evaluate(async () => {
    window.__reviewThree=await import('/vendor/three.module.js');
    window.__reviewFreeze = true;
    const a = window.__DEAD_ARRIVAL__;
    a.run.mode = 'ready'; a.run.weapon = 4; a.run.shot = 0;
    a.run.damage = a.run.punch = a.run.aim = a.run.speed = a.run.vx = a.run.vy = 0;
    a.renderer.settings.bodycam = true; a.renderer.settings.reducedMotion = false;
    const { BodycamPass } = await import('/output/playwright/bodycam-vhs/previous-bodycam-pass.js');
    window.__previousPass = new BodycamPass(a.renderer.renderer);
    // Freeze recording time without touching the user's page.
    document.querySelector('[data-bc-time]').textContent = '2026-09-30  23:14:08';
  });
  console.log('Review browser ready');
  let lastId = null;
  while (true) {
    let request;
    try { request = JSON.parse(await readFile(`${output}/request.json`, 'utf8')); } catch {}
    if (!request || request.id === lastId) { await new Promise(r => setTimeout(r, 500)); continue; }
    if (request.stop) break;
    lastId = request.id;
    errors.length = 0;
    const rows = [];
    const manifests = [];
    await page.evaluate(async id => {
      const { BodycamPass } = await import(`/bodycam-pass.js?review=${encodeURIComponent(id)}`);
      window.__candidatePass?.dispose();
      window.__candidatePass = new BodycamPass(window.__DEAD_ARRIVAL__.renderer.renderer);
      // Reload the actual stylesheet for overlay iterations.
      const link = [...document.querySelectorAll('link')].find(x => x.href.includes('horror-ui.css'));
      if (link) link.href = `/horror-ui.css?review=${encodeURIComponent(id)}`;
    }, request.id);
    for (const bookmark of bookmarks) {
      const manifest = await page.evaluate(bookmark => {
        const a = window.__DEAD_ARRIVAL__, r = a.renderer, run = a.run;
        let pose = bookmark;
        if (bookmark.room) {
          const room = run.course.rooms.find(x => x.id === bookmark.room);
          pose = { x: room.center.x, y: Math.min(room.bounds.maxZ - 1.5, room.center.y + 2.5), angle: -Math.PI / 2, pitch: -.035 };
        }
        if (bookmark.practical) {
          const room = run.course.rooms.find(x => x.id === 'f1-hall');
          const THREE = window.__reviewThree;
          const fixtures=[];
          r.scene.traverse(node=>{if(node.userData.storyLightFixture==='caged-amber')fixtures.push(node);});
          const fixture=fixtures.sort((a,b)=>{
            const ap=a.getWorldPosition(new THREE.Vector3()),bp=b.getWorldPosition(new THREE.Vector3());
            return Math.hypot(ap.x-room.center.x*4,ap.z-room.center.y*4)-Math.hypot(bp.x-room.center.x*4,bp.z-room.center.y*4);
          })[0];
          if (!fixture) throw Error('Missing visible amber fixture');
          const p=fixture.getWorldPosition(new THREE.Vector3());p.y+=4.06;
          const direction=new THREE.Vector3(room.center.x*4-p.x,0,room.center.y*4-p.z).normalize();
          if(direction.lengthSq()<.01)direction.set(0,0,1);
          const cam=p.clone().addScaledVector(direction,.42);
          const angle=Math.atan2(p.z-cam.z,p.x-cam.x);
          pose = { x:cam.x/4,y:cam.z/4,z:(p.y-1.46)/4,angle,pitch:0 };
          window.__fixturePose={...pose};
        }
        Object.assign(run, { z: 0 }, pose, { distance: 0 });
        r.bodycam = window.__previousPass;
        r.bodycamMotion.reset(); r.render(run, 12000);
        r.camera.fov = 110; r.camera.updateProjectionMatrix(); r.camera.updateWorldMatrix(true, false);
        if (bookmark.dark) {
          r.afterlifeLighting.lantern.intensity = 0;
          r.afterlifeLighting.pools.forEach(light => { light.intensity *= .15; });
        }
        return { name: bookmark.name, pose, camera: r.camera.matrixWorld.toArray(), projection: r.camera.projectionMatrix.toArray(), seed: r.afterlifeAtmosphere?.diagnostics().seed };
      }, bookmark);
      manifests.push(manifest);
      const buffers = [];
      for (const mode of ['previous', 'candidate']) {
        await page.evaluate(({ mode, profile }) => {
          const r = window.__DEAD_ARRIVAL__.renderer;
          const pass = mode === 'previous' ? window.__previousPass : window.__candidatePass;
          if (profile && mode === 'candidate') pass.setLook?.(profile);
          r.bodycam = pass; pass.reset(); pass.fixedTime = null;
          for (let i = 0; i < 90; i++) r._renderScene(12000 + i * 16.667);
          pass.fixedTime = 12; r._renderScene(13500);
        }, { mode, profile: request.profile });
        // Pure image treatment: HUD is rendered separately and judged separately.
        await page.addStyleTag({ content: '#ui,#bodycam-hud{visibility:hidden!important}' });
        const buffer = await page.screenshot({ path: `${output}/${request.id}-${bookmark.name}-${mode}.png` });
        buffers.push(buffer);
      }
      const title = `<svg width="2560" height="64"><rect width="2560" height="64" fill="#111315"/><g font-family="Arial" font-size="28" fill="#eee"><text x="32" y="42">PREVIOUS · ${bookmark.name}</text><text x="1312" y="42">${request.id.toUpperCase()} · ${bookmark.name}</text></g></svg>`;
      const row = await sharp({ create: { width: 2560, height: 784, channels: 3, background: '#111315' } }).composite([
        { input: Buffer.from(title), top: 0, left: 0 },
        { input: buffers[0], top: 64, left: 0 }, { input: buffers[1], top: 64, left: 1280 },
      ]).png().toBuffer();
      await writeFile(`${output}/${request.id}-${bookmark.name}-comparison.png`, row);
      rows.push(row);
    }
    await sharp({ create: { width: 2560, height: 784 * rows.length, channels: 3, background: '#111315' } }).composite(rows.map((input, i) => ({ input, top: i * 784, left: 0 }))).png().toFile(`${output}/${request.id}-comparison.png`);
    const motion = [];
    if (request.motion) {
      await mkdir(`${output}/${request.id}-motion`, { recursive: true });
      for (let frame = -120; frame < 240; frame++) {
        const state = await page.evaluate(async frame => {
          const a = window.__DEAD_ARRIVAL__, r = a.renderer, run = a.run;
          const t = frame / 30;
          const pose=window.__fixturePose;
          const ease=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
          const facingLamp=t<1?0:t<1.6?ease((t-1)/.6):t<4?1:t<4.6?1-ease((t-4)/.6):0;
          Object.assign(run, pose, { angle:pose.angle+Math.PI*.9*(1-facingLamp),pitch:-.45*(1-facingLamp),vx:0,vy:0,speed:0,distance:0 });
          r.bodycam = window.__candidatePass; r.bodycam.fixedTime = null;
          r._frameDt = 1/30;
          if (frame===-120) {
            r.bodycam.reset(); r.bodycamMotion.reset();
            // Suppress the body lamp before the actual draw: one render per
            // frame, so angular blur and gain share the same time sample.
            r.__reviewOriginalSceneRender=r._renderScene;
            r._renderScene=function(now){this.afterlifeLighting.lantern.intensity=0;return this.__reviewOriginalSceneRender(now);};
          }
          r.render(run, 24000+frame*1000/30);
          const THREE = await import('/vendor/three.module.js');
          const gain = new Uint16Array(4);
          r.renderer.readRenderTargetPixels(r.bodycam.exposureTargets[r.bodycam.exposureIndex],0,0,1,1,gain);
          return { frame, seconds:t,facingLamp,gain:THREE.DataUtils.fromHalfFloat(gain[0]),target:THREE.DataUtils.fromHalfFloat(gain[1]),meter:THREE.DataUtils.fromHalfFloat(gain[2]), blur:r.bodycam.material.uniforms.uBlur.value.toArray(), mount:{...r.bodycamMotion.pose} };
        }, frame);
        if(frame<0)continue;
        motion.push(state);
        await page.screenshot({ path: `${output}/${request.id}-motion/frame-${String(frame).padStart(3,'0')}.png` });
      }
      const tiles = [];
      await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.renderer;r._renderScene=r.__reviewOriginalSceneRender;delete r.__reviewOriginalSceneRender;});
      for (const frame of [0,39,60,110,135,239]) {
        const image = await sharp(`${output}/${request.id}-motion/frame-${String(frame).padStart(3,'0')}.png`).resize(640,360).toBuffer();
        const label=Buffer.from(`<svg width="640" height="40"><rect width="640" height="40" fill="#111315"/><text x="16" y="27" fill="#eee" font-family="Arial" font-size="18">${motion[frame].seconds.toFixed(2)}s · gain ${motion[frame].gain.toFixed(2)} / target ${motion[frame].target.toFixed(2)}</text></svg>`);
        tiles.push(await sharp({create:{width:640,height:400,channels:3,background:'#111315'}}).composite([{input:label,left:0,top:0},{input:image,left:0,top:40}]).png().toBuffer());
      }
      await sharp({create:{width:1920,height:800,channels:3,background:'#111315'}}).composite(tiles.map((input,i)=>({input,left:(i%3)*640,top:Math.floor(i/3)*400}))).png().toFile(`${output}/${request.id}-motion-checkpoints.png`);
    }
    await writeFile(`${output}/${request.id}-report.json`, JSON.stringify({ id: request.id, profile: request.profile, manifests, motion, errors }, null, 2));
    console.log(`Captured ${request.id}: ${output}/${request.id}-comparison.png; errors=${errors.length}`);
    await writeFile(`${output}/complete.json`, JSON.stringify({ id: request.id, errors }));
  }
} catch(error) {
  await writeFile(`${output}/startup-error.json`, JSON.stringify({message:error.message,errors,diagnostics:await page.evaluate(()=>window.__DEAD_ARRIVAL__?.renderer?._collectDiagnostics(window.__DEAD_ARRIVAL__.run)).catch(()=>null)},null,2));
  console.error(JSON.stringify({message:error.message,errors}));
  throw error;
} finally { await browser.close(); }
