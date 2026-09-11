import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH);
await mkdir('docs/build10',{recursive:true});
const server=await startServer({root:path.resolve('dist'),port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
try {
  const page=await browser.newPage({viewport:{width:1536,height:864}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&build10=blood-depth`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="start"]').click({noWaitAfter:true});
  await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{
    const a=window.__DEAD_ARRIVAL__,r=a.run,renderer=a.renderer,fx=renderer.weaponFX.impacts;
    r.mode='play'; a.ui.play?.(); a.ui.hide?.(); document.body.classList.add('playing'); r.course.enemies=[];
    const hud=document.getElementById('ui'); if(hud)hud.style.display='none';
    // Place a fan of seeded impacts one metre in front of the camera. The
    // normal faces the viewer, so the plane basis and wet dome are visible in
    // a deterministic close-read instead of relying on a moving enemy.
    const centerZ=r.z+.4, centerY=r.y;
    for(let i=0;i<10;i++){
      const s=i-4.5;
      fx.burst({id:9100+i,x:r.x,y:centerY,z:centerZ,tx:r.x+1.2,ty:centerY+s*.025,tz:centerZ+s*.018,weapon:i%4,surface:'flesh',normal:{x:-1,y:0,z:0}});
    }
    // Pin the diagnostic fan to the camera's forward ray so the art check is
    // independent of the current room spawn and camera yaw.
    renderer.camera.getWorldDirection(fx.shotDirection);
    for(let i=0;i<10;i++){
      const p=fx.splashPool[i],s=i-4.5;
      renderer.camera.getWorldPosition(p.position);
      p.position.addScaledVector(fx.shotDirection,3).addScaledVector(fx.tangent,s*.08);
    }
    fx.update(.035,renderer.camera,false);
    return {cameraRig:renderer.cameraRig.position.toArray(),active:fx.detailActive};
  });
  await page.waitForTimeout(42);
  const effects=await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.weaponFX.impacts.detailActive);
  await page.screenshot({path:'docs/build10/blood-depth.png'});
  assert.ok(effects.splashes>0,'seeded flesh splash fan should remain visible');
  assert.ok(effects.drops>0,'seeded flesh droplets should remain visible');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result,effects,errors,passed:true}));
} finally {
  await browser.close(); server.server.closeAllConnections(); await new Promise(resolve=>server.server.close(resolve));
}
