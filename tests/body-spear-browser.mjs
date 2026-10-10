import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {measureCounterArms} from './interaction-arm-qa.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/body-spear';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={date:new Date().toISOString(),status:'RUNNING',url:'http://127.0.0.1:5200/',scope:'focused desktop finisher',errors:[],views:[],checks:[],physicalControllerTested:false,liveP2PTested:false};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
await page.addInitScript(()=>{window.__spearPad={id:'Body spear QA',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};window.__spearPadOn=false;Object.defineProperty(navigator,'getGamepads',{value:()=>window.__spearPadOn?[window.__spearPad]:[]});});
async function fixture(appearance,gore=true){await page.evaluate(async({appearance,gore})=>{
 const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');if(d.screen==='pause')d.resume();
 window.__spearAnchor??={x:r.x,y:r.y};Object.assign(r,window.__spearAnchor);delete r.peer;r.playerId='host';
 const angle=Array.from({length:24},(_,i)=>i*Math.PI/12).sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];
 Object.assign(r,{mode:'ready',z:0,vx:0,vy:0,vz:0,angle,pitch:0,health:100,energy:100,weapon:4,cooldowns:Array(8).fill(0),fireCooldown:0,parryCooldown:0,parryTime:0,waveDelay:1000,director:null,projectiles:[],extraction:{phase:'idle'}});
 r.ownedWeapons=Array.from({length:8},(_,i)=>i);r.brutal={phase:'idle',sequence:r.brutal.sequence};r.bite={phase:'idle',enemyId:null,sequence:0,cooldown:100};
 if(r.dungeonProgression){r.dungeonProgression.currentEncounter=null;r.dungeonProgression.reliefUntil=1e6;r.dungeonProgression.pacing||=(await import('./enemy-ai.js')).createPacing();r.dungeonProgression.pacing.ambushes=999;}r.spawnTelegraphs=[];
 r.playerWounds={leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false};
 r.course.enemies=[{id:r.nextId++,kind:0,variant:appearance==='crooked-crawler'?'skitter':'stalker',locomotion:appearance==='crooked-crawler'?'crawler':appearance==='fever-runner'?'runner':'shambler',appearance,x:r.x+Math.cos(angle)*.22,y:r.y+Math.sin(angle)*.22,hp:15,maxHp:30,dead:false,flash:0,attack:100,phase:0,biteCooldown:100,stagger:1.5,facing:angle+Math.PI}];
 d.renderer.brutalCombatVisuals.run=null;d.renderer.freeCamera=null;d.renderer.setSettings({gore,reducedMotion:false,bodycam:true});
 for(let i=0;i<90;i++)d.renderer.render(r,performance.now()+i*1000/60);
 },{appearance,gore});}
async function start(){await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});await page.keyboard.press('v');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.kind),'pierce');}
async function advanceTo(time){await page.evaluate(async time=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{tick}=await import('./engine.js');r.mode='play';const n=Math.max(0,Math.round((time-r.brutal.elapsed)*120));for(let i=0;i<n;i++){tick(r,1/120,{});if(i%2===0)d.renderer.render(r,performance.now());}r.mode='ready';d.renderer.render(r,performance.now());},time);}
async function shot(name){
 await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__;window.__spearRender=d.renderer.render;d.renderer.render=()=>{};window.__spearRender.call(d.renderer,d.run,performance.now());await d.renderer._warmupPromise;await d.renderer.renderer.compileAsync(d.renderer.scene,d.renderer.camera);window.__spearRender.call(d.renderer,d.run,performance.now());});
 try{for(let i=0;i<2;i++){await page.waitForTimeout(100);await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;window.__spearRender.call(d.renderer,d.run,performance.now());});}try{await page.screenshot({path:`${output}/${name}.png`});}catch(e){if(!e.message.includes('Unable to capture screenshot'))throw e;await page.waitForTimeout(250);await page.screenshot({path:`${output}/${name}.png`});}
 const data=await page.evaluate(async name=>{const d=window.__DEAD_ARRIVAL__,r=d.run,v=d.renderer.brutalCombatVisuals,e=r.course.enemies[0],root=d.renderer._enemyVisuals.get(e.id)?.root,s=v.actors.get(root);return{name,brutal:{...r.brutal},enemy:{appearance:e.appearance,hp:e.hp,dead:e.dead,wound:e.brutalWound,heartRemoved:e.heartRemoved},visuals:v.diagnostics(),peerContactDistances:v.peerContactDistances,heartVisible:!!s?.heart?.visible,anatomyVisible:!!s?.attachments?.visible,spearOpen:s?.uniforms.uSpearOpen.value,backend:d.renderer.renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL',source:root?.userData?.afterlife?.appearance};},name);
 data.sleeves=await page.evaluate(measureCounterArms);report.views.push(data);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));return data;
 }finally{await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.render=window.__spearRender;});}
}
async function verifySourceOpening(id){
 const result=await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,v=d.renderer.brutalCombatVisuals,s=[...v.actors.values()][0],gpu=d.renderer.renderer,G=await import('./vendor/three.webgpu.js'),T=await import('./vendor/three.module.js');
  // 128 RGBA pixels give an aligned 512-byte WebGPU readback row.
  const root=s.root,parent=root.parent,frame=s.bodySpear.frame,scene=new G.Scene(),camera=new G.OrthographicCamera(-.11,.11,.11,-.11,.01,2),target=new G.RenderTarget(128,128,{type:G.UnsignedByteType});
  camera.position.copy(frame.entry).addScaledVector(frame.front,.7);camera.up.set(0,1,0).applyQuaternion(frame.rotation);camera.lookAt(frame.entry);scene.attach(root);root.updateMatrixWorld(true);
  const savedRender=d.renderer.render,savedTarget=gpu.getRenderTarget(),savedColor=gpu.getClearColor(new T.Color()),savedAlpha=gpu.getClearAlpha(),kind=s.uniforms.uBrutalKind.value;
  d.renderer.render=()=>{};
  const occupancy=async value=>{s.uniforms.uBrutalKind.value=value;gpu.setRenderTarget(target);gpu.setClearColor(0,0);await gpu.compileAsync(scene,camera);await gpu.renderAsync(scene,camera);const pixels=await gpu.readRenderTargetPixelsAsync(target,0,0,128,128);let count=0,covered=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){if(Math.hypot((x-63.5)*.22/128/frame.halfExtent.x,(y-63.5)*.22/128/frame.halfExtent.y)>.7)continue;count++;if(pixels[(y*128+x)*4+3]>127)covered++;}return covered/count;};
  const attachmentParent=s.attachments.parent;
  try{
   const closed=await occupancy(0),open=await occupancy(kind),view=new G.PerspectiveCamera(35,1,.01,4);
   view.position.copy(d.renderer.camera.getWorldPosition(new T.Vector3()));view.up.set(0,1,0).applyQuaternion(frame.rotation);view.lookAt(frame.entry);scene.attach(s.attachments);scene.add(new G.AmbientLight(0xffffff,2));
   await gpu.compileAsync(scene,view);await gpu.renderAsync(scene,view);const pixels=await gpu.readRenderTargetPixelsAsync(target,0,0,128,128),offset=(64*128+64)*4;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),128,128),0,0);
   return{closed,open,obliquePixel:Array.from(pixels.slice(offset,offset+4)),image:canvas.toDataURL('image/png'),backend:gpu.backend.isWebGPUBackend?'WebGPU':'WebGL'};
  }
  finally{s.uniforms.uBrutalKind.value=kind;gpu.setRenderTarget(savedTarget);gpu.setClearColor(savedColor,savedAlpha);parent.attach(root);attachmentParent.attach(s.attachments);root.updateMatrixWorld(true);target.dispose();d.renderer.render=savedRender;savedRender.call(d.renderer,d.run,performance.now());}
 });
 await writeFile(`${output}/${id}-oblique-cavity.png`,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;report.views.find(x=>x.name===id+'-withdrawal').sourceOpening=result;console.log(id+' opening',result);
 await writeFile(`${output}/native-cut-shaders.json`,JSON.stringify(await page.evaluate(()=>[...window.__DEAD_ARRIVAL__.renderer.renderer._nodes.nodeBuilderCache.values()].filter(s=>s.fragmentShader?.includes('discard')&&s.vertexShader?.includes('skinWeight')).map(s=>({vertex:s.vertexShader,fragment:s.fragmentShader})))));
 assert(result.closed>.9,id+' actual source covers the unopened chest');assert(result.open<.1,id+' GPU opening clears actual posed clothing and body');assert(result.obliquePixel[0]>=2&&result.obliquePixel[0]>result.obliquePixel[1]*1.8,id+' actual oblique view hits inner tissue');report.checks.push(id+': GPU source opening and oblique inner-wall readback');
}
try{
 await page.goto(report.url+'?debug=1&dungeon=0',{waitUntil:'networkidle'});console.log('Game page loaded');
 console.log('Boot',await page.evaluate(()=>({debug:!!window.__DEAD_ARRIVAL__,alert:document.querySelector('[role="alert"]')?.textContent})));
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._ashWitnessAsset&&window.__DEAD_ARRIVAL__.renderer._survivors?.status==='ready');
 await page.locator('[data-action="start"]').click();
 await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__?.renderer;return window.__DEAD_ARRIVAL__?.screen==='play'&&r._weaponsPrepared&&r.brutalCombatVisuals.bodySpear.status==='ready'&&r.brutalCombatVisuals.chest.status==='ready'&&r.diagnostics().zombieAppearances.filter(x=>x.status==='ready').length===3;});console.log('Four source bodies and anatomy ready');
 for(const id of ['ash-witness','drowned-dockworker','fever-runner','crooked-crawler']){
  await fixture(id);await start();await advanceTo(.14);await shot(id+'-windup');await advanceTo(.25);let s=await shot(id+'-contact');
  assert(s.enemy.dead&&s.enemy.wound.type==='pierce',id+' authoritative impact');assert.equal(s.source,id);assert.equal(s.visuals.contactDistances.length,2);assert(s.visuals.contactDistances.every(c=>c.distance<.05),id+' hand contact');
  for(const b of s.sleeves.bands)assert.equal(b.visible,0,id+' sleeve cut outside frame');
  await advanceTo(.71);s=await shot(id+'-withdrawal');assert(s.enemy.heartRemoved&&s.heartVisible,id+' withdrawal');report.checks.push(id+': real V, impact, withdrawal, hand contact');console.log(id+' PASS');
  await verifySourceOpening(id);
 }
 await advanceTo(1.55);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.phase),'idle');report.checks.push('completion restores idle');
 await fixture('ash-witness',false);await start();await advanceTo(.71);let s=await shot('gore-off');assert(s.enemy.dead&&!s.heartVisible&&!s.anatomyVisible);assert.equal(s.spearOpen,0);assert.equal(s.visuals.spray,0);report.checks.push('gore off preserves damage and hides both wounds, organ and spray');
 await fixture('ash-witness');await page.evaluate(()=>{window.__spearPadOn=true;window.__DEAD_ARRIVAL__.run.mode='play';});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.controller.armed);
 await page.evaluate(()=>{window.__spearPad.buttons[11]={pressed:true,value:1};});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.brutal.kind==='pierce'&&window.__DEAD_ARRIVAL__.run.brutal.phase!=='idle');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';window.__spearPad.buttons[11]={pressed:false,value:0};window.__spearPadOn=false;});await advanceTo(.25);await shot('R3-contact');report.checks.push('standard controller R3 input route (synthetic device)');
 const snapshot=await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{addPeer,newRun,makeCampaignCourse,chestFinisher,tick,castRay}=await import('./engine.js');Object.assign(r,newRun(makeCampaignCourse(0)));r.mode='play';r.weapon=4;r.waveDelay=1000;r.director=null;
 const angle=Array.from({length:24},(_,i)=>i*Math.PI/12).sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];r.angle=angle;
 const e={id:r.nextId++,kind:0,variant:'stalker',locomotion:'shambler',appearance:'drowned-dockworker',x:r.x+Math.cos(angle)*.22,y:r.y+Math.sin(angle)*.22,hp:15,maxHp:30,dead:false,flash:0,attack:100,biteCooldown:100,stagger:1.5,facing:angle+Math.PI};r.course.enemies=[e];const p=addPeer(r);p.x=r.x+.6;p.y=r.y;p.angle=Math.atan2(e.y-p.y,e.x-p.x);p.pitch=-.10;p.mode='ready';if(!chestFinisher(r))throw Error('campaign host finisher rejected');for(let i=0;i<30;i++)tick(r,1/120,{});r.mode='ready';return JSON.parse(JSON.stringify(d.snapshot()));});
 await page.evaluate(s=>{const d=window.__DEAD_ARRIVAL__;d.receive({t:'start',s});d.run.mode='ready';d.renderer.render(d.run,performance.now());},snapshot);
 await page.waitForFunction(()=>{const d=window.__DEAD_ARRIVAL__;return d.run.playerId==='peer'&&d.renderer.brutalCombatVisuals.peerContactDistances?.length===2;},null,{timeout:180000});
 await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);
 s=await shot('guest-snapshot-contact');assert.equal(s.peerContactDistances?.length,2);assert(s.peerContactDistances.every(c=>Number.isFinite(c.distance)&&c.distance<.05),'guest actual hand targets');report.checks.push('host serialization → guest receive/render with active remote finisher');
 assert.deepEqual(report.errors,[],'console/network errors');report.status='PASS';console.log(JSON.stringify({status:report.status,checks:report.checks,views:report.views.length}));
}catch(e){report.status='FAIL';report.failure=e.stack;await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw e;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
