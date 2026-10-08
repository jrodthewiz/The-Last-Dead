import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.FP_CAPTURE_OUTPUT||'output/playwright/first-person-v2';await mkdir(output,{recursive:true});
const server=await startServer({root:resolve(process.env.FP_CAPTURE_ROOT||'.'),port:0,spaFallback:false});let browser;
const report={scope:'Actual source native game, isolated server/browser, real Start; controlled street pose while simulation is manual. Paired v1 asset/legacy hold and v2 asset/Blender hold at clean75 FOV. Not a full combat playthrough or phone hardware benchmark.',errors:[],httpErrors:[],views:[],sourceHashes:{}};
const digest=data=>createHash('sha256').update(data).digest('hex');
report.runtimeRoot=process.env.FP_CAPTURE_ROOT||'.';
for(const file of ['renderer.js','blackwater-weapon-style.js','assets/survivor/foreground-arms.js','assets/survivor/foreground-sleeves.js','assets/survivor/foreground-anatomy.js','weapon-stock-geometry.js','weapon-rifles.js','weapon-occult-redesign.js','weapon-melee.js','assets/survivor/viewmodel-arms-v1.glb','assets/survivor/viewmodel-arms-v2.glb','assets/survivor/viewmodel-hold-poses.js'])report.sourceHashes[file]=digest(await readFile(resolve(report.runtimeRoot,file)));
const legacy=[{position:[.30,-.33,-.88],rotation:[.035,.18,-.04]},{position:[.31,-.34,-.94],rotation:[.035,.21,-.04]},{position:[.29,-.33,-1],rotation:[.035,.22,-.04]},{position:[.31,-.34,-.98],rotation:[.035,.20,-.04]},{position:[.34,-.30,-.98],rotation:[.045,.20,-.08]},{position:[.34,-.30,-1.03],rotation:[.045,.20,-.08]},{position:[.32,-.34,-.85],rotation:[0,0,0]},{position:[.32,-.34,-.85],rotation:[0,0,0]}];
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
  for(const revision of process.env.FP_CAPTURE_MODE==='after-only'?['after']:['before','after']){
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    if(revision==='before'){
      const body=await readFile('assets/survivor/viewmodel-arms-v1.glb');
      await context.route('**/assets/survivor/viewmodel-arms-v2.glb',route=>route.fulfill({contentType:'model/gltf-binary',body}));
    }
    const page=await context.newPage();
    if(process.env.FP_SAFE_CURSOR==='1')await guardBackgroundInput(page);
    page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
    await page.goto(`http://127.0.0.1:${server.port}/?debug=1&horrorqa=1`);
    await page.waitForFunction(()=>!!window.__DEAD_ARRIVAL__,null,{timeout:60000});
    await page.locator('[data-action="start"]').click({timeout:60000});
    console.log('Start pressed',revision,report.runtimeRoot);
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==='play',null,{timeout:180000});
    await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.renderer._survivors?.armStatus==='ready',null,{timeout:60000});
    await page.evaluate(()=>{window.__HORROR_QA__.setManual(true);const q=window.__DEAD_ARRIVAL__;Object.assign(q.run,{x:206/4,y:56/4,z:0,angle:Math.PI,pitch:-.025,vx:0,vy:0,vz:0,speed:0,dashTime:0,slide:0,aim:0,rifleKick:0,shot:0,damage:0});});
    for(const viewport of process.env.FP_DESKTOP_ONLY==='1'?[{width:1280,height:800}]:[{width:1280,height:800},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      for(const weapon of revision==='before'?[0,4]:viewport.width===390?[0,4]:[0,1,2,3,4,5,6,7]){
        const metrics=await page.evaluate(async({weapon,revision,legacy})=>{
          const q=window.__DEAD_ARRIVAL__,r=q.renderer;
          const {fitForegroundArms}=await import('/assets/survivor/foreground-arms.js');
          const {FIRST_PERSON_HOLD_POSES}=await import('/assets/survivor/viewmodel-hold-poses.js');
          if(window.__FP_RENDER)r.render=window.__FP_RENDER;
          q.run.weapon=weapon;q.run.shot=0;q.run.aim=0;r.weaponPresentation.equipAge=100;
          for(let i=0;i<24;i++)await new Promise(requestAnimationFrame);
          const group=r.weaponGroups[weapon],pose=revision==='before'?legacy[weapon]:FIRST_PERSON_HOLD_POSES[weapon];
          group.position.set(...pose.position);group.position.x*=Math.min(1,r.camera.aspect/.9);group.rotation.set(...pose.rotation);group.scale.setScalar(revision==='before'?.64:pose.scale);
          fitForegroundArms(group);
          if(!window.__FP_RENDER)window.__FP_RENDER=r.render;
          r.render=()=>{};r.scene.updateMatrixWorld(true);
          const renderer=r.renderer,auto=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();
          r._renderScene();await renderer.backend.device.queue.onSubmittedWorkDone();
          const info={draws:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles,memoryBytes:renderer.info.memory.total};renderer.info.autoReset=auto;
          const T=await import('/vendor/three.module.js');
          const v=new T.Vector3(),w=new T.Vector3(),arms=[];
          for(const f of group.userData.foregroundArmFits){
            const gripGap=f.arm.userData.gripSocket.getWorldPosition(v).distanceTo(f.grip.getWorldPosition(w));
            const wrist=f.wrist.getWorldPosition(v).clone(),elbow=f.forearm.localToWorld(new T.Vector3(0,-.34,0));
            let capMax=-Infinity,capSamples=0;
            const normal=new T.Vector3(0,1,-Math.tan(T.MathUtils.degToRad(r.camera.fov*.5))).normalize();
            f.upper.traverse(mesh=>{if(!mesh.isMesh)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++){
              mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);f.upper.worldToLocal(v.clone()).y<=-.375&&(capMax=Math.max(capMax,normal.dot(r.camera.worldToLocal(v.clone()))),capSamples++);
            }});
            const gripScreen=f.grip.getWorldPosition(w).project(r.camera);
            arms.push({side:f.arm.userData.side,gripGap,forearmMetres:wrist.distanceTo(elbow),wristAngle:f.wristAngle,capMarginMetres:-capMax,capSamples,gripNdc:gripScreen.toArray()});
          }
          return {weapon,revision,width:innerWidth,height:innerHeight,cameraFov:r.camera.fov,screen:q.screen,armStatus:r._survivors.armStatus,group:{position:group.position.toArray(),rotation:group.rotation.toArray().slice(0,3),scale:group.scale.x},arms,...info};
        },{weapon,revision,legacy});
        report.views.push(metrics);
        assert.equal(metrics.screen,'play');assert.equal(metrics.armStatus,'ready');assert(Math.abs(metrics.cameraFov-75)<.01,`native clean camera must actually be75, observed ${metrics.cameraFov}`);
        for(const arm of metrics.arms){assert(arm.gripGap<1e-5);assert(Math.abs(arm.forearmMetres-.30464)<1e-5);assert(arm.wristAngle<=Math.PI*75/180+1e-5);assert(arm.capSamples>20&&arm.capMarginMetres>.005);}
        await page.screenshot({path:`${output}/${revision}-${weapon}-${viewport.width}x${viewport.height}.png`});console.log('Captured',revision,weapon,viewport.width,metrics.draws);
      }
    }
    if(process.env.FP_CAPTURE_ACTIONS==='1'){
      await page.setViewportSize({width:1280,height:800});
      await page.bringToFront();
      // Leaving portrait can release pointer lock and legitimately open Pause.
      if(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen==='pause'))await page.locator('[data-action="resume"]').click();
      await page.evaluate(()=>{
        const q=window.__DEAD_ARRIVAL__;q.renderer.render=window.__FP_RENDER;
        // Exercise the player pointer-lock path only in this owned QA page.
        Object.defineProperty(navigator,'webdriver',{get:()=>false});
        q.run.ownedWeapons=[0,1,2,3,4,5,6,7];q.run.health=100;q.run.energy=100;
        for(const enemy of q.run.course.enemies)enemy.dead=true;
      });
      await page.locator('#world').click({position:{x:640,y:400}});
      console.log('Input capture state',await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,locked:!!document.pointerLockElement})));
      await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#world'),null,{timeout:10000});
      const step=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
      const measure=async label=>{
        const row=await page.evaluate(async label=>{
          const q=window.__DEAD_ARRIVAL__,r=q.renderer,T=await import('/vendor/three.module.js');
          const group=r.weaponGroups[q.run.weapon],arms=group.userData.foregroundArmFits.map(f=>({
            gap:f.arm.userData.gripSocket.getWorldPosition(new T.Vector3()).distanceTo(f.grip.getWorldPosition(new T.Vector3())),
            wristAngle:f.wristAngle,capPlane:f.shoulderPlaneDistance,
            gripNdc:f.grip.getWorldPosition(new T.Vector3()).project(r.camera).toArray(),
          }));
          await r.renderer.backend.device.queue.onSubmittedWorkDone();
          return {label,weapon:q.run.weapon,screen:q.screen,shots:q.run.shotSequence,melee:q.run.meleeSequence,
            sawActive:q.run.sawActive,fov:r.camera.fov,arms};
        },label);
        for(const arm of row.arms){assert(arm.gap<1e-5);assert(arm.wristAngle<=Math.PI*75/180+1e-5);assert(arm.capPlane<1e-5);assert(arm.gripNdc.every(Number.isFinite));}
        report.actions??=[];report.actions.push(row);
        await page.screenshot({path:`${output}/${label}.png`});
        return row;
      };
      for(const weapon of [0,1,2,3,4,5,6,7]){
        await page.keyboard.press(String(weapon+1));await step(600);
        assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.weapon),weapon,'real number key selects held weapon');
        const before=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.shotSequence);
        await page.mouse.down();
        // advanceTime intentionally advances tick() without the main-loop
        // shoot() call. Let real mouse input run through the actual loop.
        await page.evaluate(()=>window.__HORROR_QA__.setManual(false));
        try{
          await page.waitForFunction(({weapon,before})=>{
            const r=window.__DEAD_ARRIVAL__.run;
            return weapon<6?r.shotSequence>before:weapon===6?r.meleeActive:r.sawActive;
          },{weapon,before},{timeout:5000});
        }finally{await page.evaluate(()=>window.__HORROR_QA__.setManual(true));}
        const fired=await measure(`fire-${weapon}`);
        if(weapon<6)assert(fired.shots>before,'real fire input changes authoritative shot sequence');
        if(weapon===6)assert(fired.melee>0,'real attack input starts a bat stroke');
        if(weapon===7)assert(fired.sawActive,'real fire input revs the saw');
        await page.mouse.up();await step(1000);
      }
      await page.keyboard.press('5');await step(700);
      await page.mouse.down({button:'right'});await step(400);const aim=await measure('aim-rifle');assert(aim.fov<70);
      await page.mouse.up({button:'right'});await step(500);
      const start=await page.evaluate(()=>[window.__DEAD_ARRIVAL__.run.x,window.__DEAD_ARRIVAL__.run.y]);
      await page.keyboard.down('w');await step(400);await measure('walk-rifle');await page.keyboard.up('w');
      const end=await page.evaluate(()=>[window.__DEAD_ARRIVAL__.run.x,window.__DEAD_ARRIVAL__.run.y]);assert(Math.hypot(end[0]-start[0],end[1]-start[1])>.01);
      await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'pause');
      await page.locator('[data-action="resume"]').click();assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.screen),'play');
      await step(300);await measure('resumed-rifle');
      report.input={weaponKeys:8,firearms:6,bat:true,saw:true,aim:true,movement:true,pauseResume:true};
      report.scope+=' Includes real keyboard/mouse weapon switching, firearm/melee attack, aim, movement and pause/resume with manual simulation stepping.';
    }
    if(process.env.FP_SAFE_CURSOR==='1'){
      report.backgroundInput=await backgroundInputState(page);
      assert.deepEqual(report.backgroundInput.attempts,{pointerLock:0,fullscreen:0,keyboardLock:0});
      assert.equal(report.backgroundInput.pointerLocked,false);assert.equal(report.backgroundInput.fullscreen,false);
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack||error);throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
