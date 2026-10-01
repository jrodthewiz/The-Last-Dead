import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {measureCounterArms,assertCounterSleeves} from './interaction-arm-qa.mjs';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.CHEST_OUTPUT||'output/playwright/chest-finisher/pc';await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
const report={runtimeRoot:process.env.DEAD_ARRIVAL_RUNTIME||process.cwd()+'/dist',errors:[],views:[],checks:[],physicalControllerTested:false};
for(const type of ['pageerror'])page.on(type,e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
await page.addInitScript(()=>{window.__chestPad={id:'Chest integration controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};window.__chestPadOn=false;Object.defineProperty(navigator,'getGamepads',{value:()=>window.__chestPadOn?[window.__chestPad]:[]});});
async function fixture({gore=true,reducedMotion=false,hp=15,maxHp=30,stagger=1.5}={}){
 await page.evaluate(async options=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');
  window.__chestAnchor??={x:r.x,y:r.y};Object.assign(r,window.__chestAnchor);
  const angle=Array.from({length:24},(_,i)=>i*Math.PI/12).sort((a,b)=>castRay(r.course,r.x,r.y,b,8).dist-castRay(r.course,r.x,r.y,a,8).dist)[0];
  Object.assign(r,{mode:'play',z:0,vx:0,vy:0,vz:0,angle,pitch:0,health:100,energy:100,weapon:4,cooldowns:Array(8).fill(0),fireCooldown:0,parryCooldown:0,parryTime:0,waveDelay:1000,director:null,projectiles:[],extraction:{phase:'idle'}});
  r.ownedWeapons=Array.from({length:8},(_,i)=>i);r.brutal={phase:'idle',sequence:r.brutal.sequence};r.bite={phase:'idle',enemyId:null,sequence:0,cooldown:100};
  if(r.dungeonProgression){r.dungeonProgression.currentEncounter=null;r.dungeonProgression.reliefUntil=1e6;r.dungeonProgression.pacing||=(await import('./enemy-ai.js')).createPacing();r.dungeonProgression.pacing.ambushes=999;}r.spawnTelegraphs=[];
  r.playerWounds={leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false};
  r.course.enemies=[{id:r.nextId++,kind:0,variant:'stalker',x:r.x+Math.cos(angle)*.22,y:r.y+Math.sin(angle)*.22,hp:options.hp,maxHp:options.maxHp,dead:false,flash:0,attack:100,phase:0,biteCooldown:100,stagger:options.stagger,facing:angle+Math.PI}];
  d.renderer.freeCamera=null;d.renderer.setSettings({gore:options.gore,reducedMotion:options.reducedMotion,bodycam:true});d.renderer.render(r,performance.now());
  window.__chestEvents=[];const play=d.audio.play.bind(d.audio);if(!window.__chestAudioWrapped){d.audio.play=(type,...args)=>{if(type.startsWith('brutal-'))window.__chestEvents.push(type);return play(type,...args);};window.__chestAudioWrapped=true;}
 },{gore,reducedMotion,hp,maxHp,stagger});
}
async function keyStart(){await page.keyboard.press('v');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.kind),'pierce');}
async function advance(seconds){
 await page.evaluate(async seconds=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{tick}=await import('./engine.js');r.mode='play';for(let i=0;i<Math.round(seconds*120);i++){tick(r,1/120,{});if(i%2===0)d.renderer.render(r,performance.now());}r.mode='ready';d.renderer.render(r,performance.now());},seconds);
}
async function shot(name){
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;window.__chestRender=d.renderer.render;d.renderer.render=()=>{};window.__chestRender.call(d.renderer,d.run,performance.now());});
 await page.waitForTimeout(70);await page.screenshot({path:`${output}/${name}.png`});
 const data=await page.evaluate(async name=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run,v=d.renderer.brutalCombatVisuals,T=await import('./vendor/three.module.js'),e=r.course.enemies[0],root=d.renderer._enemyVisuals.get(e?.id)?.root;
  const bone=name=>root?.getObjectByName(name)?.getWorldPosition(new T.Vector3()).toArray();
  const state=v.actors.get(root),heart=state?.heart;
  const info=d.renderer.renderer.info;
  const bounds=root?new T.Box3().setFromObject(root,true):null;
  const heartNdc=heart?.position.clone().project(d.renderer.camera).toArray();
  const hand=v.armBones?.RightHand,weapon=v.chest.weapon;
  const skinFloor=[],actorPose=[],armPose=[];
  v.arms?.traverse(node=>armPose.push({name:node.name,type:node.type,p:node.position.toArray(),q:node.quaternion.toArray(),s:node.scale.toArray(),visible:node.visible}));
  if(root&&['02-chest-contact','03b-last-held-pose','04-heart-body-release','08b-ragdoll-side'].includes(name))root.traverse(node=>{
   actorPose.push({name:node.name,type:node.type,p:node.position.toArray(),q:node.quaternion.toArray(),s:node.scale.toArray(),visible:node.visible});
   if(!node.isSkinnedMesh)return;let visible=true;for(let p=node;p;p=p.parent)visible&&=p.visible;
   node.skeleton.update();let lowest=Infinity,vertex=-1;const point=new T.Vector3();
   for(let i=0;i<node.geometry.attributes.position.count;i++){node.getVertexPosition(i,point).applyMatrix4(node.matrixWorld);if(point.y<lowest){lowest=point.y;vertex=i;}}
   const indices=node.geometry.attributes.skinIndex,weights=node.geometry.attributes.skinWeight;
   skinFloor.push({mesh:node.name,visible,minY:lowest,vertex,influences:[0,1,2,3].map(j=>({bone:node.skeleton.bones[indices.getComponent(vertex,j)]?.name,weight:weights.getComponent(vertex,j)}))});
  });
  const proxies=actorPose.length?v.physics.get(root)?.nodes.map(n=>({key:n.key,p:n.body.position.toArray(),q:n.body.quaternion.toArray(),skinBounds:n.skinBounds?{center:n.skinBounds.center.toArray(),half:n.skinBounds.half.toArray()}:null})):undefined;
  const ray=new T.Raycaster(),needleHits=[[470,395],[835,480]].map(([x,y])=>{ray.setFromCamera(new T.Vector2(x/1280*2-1,1-y/720*2),d.renderer.camera);return{x,y,hits:ray.intersectObjects([root,v.root].filter(Boolean),true).filter(h=>{for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true;}).slice(0,5).map(h=>({mesh:h.object.name,type:h.object.type,material:h.object.material?.name,distance:h.distance,point:h.point.toArray(),face:h.faceIndex,path:(()=>{const p=[];for(let n=h.object;n;n=n.parent)p.push(n.name||n.type);return p;})()}))};});
  const contactDistances=v.diagnostics().contactDistances||[];
  if(['02-chest-contact','03-heart-extraction','10-reduced-motion-heart'].includes(name)){
    for(const contact of contactDistances)if(contact.distance>.02)throw new Error(`${name}: ${contact.side} hand misses its actual target by ${contact.distance}m`);
    if(contactDistances.length!==2)throw new Error(`${name}: both actual hand targets must be measured`);
  }
  return{name,brutal:{...r.brutal},enemy:e?{hp:e.hp,dead:e.dead,wound:e.brutalWound,heartRemoved:e.heartRemoved}:null,visuals:v.diagnostics(),heart:{visible:!!heart?.visible,world:heart?.position.toArray(),ndc:heartNdc,shapes:heart?.morphTargetDictionary,influences:heart?.morphTargetInfluences},chestShapes:state?.chestWound?.morphTargetInfluences,needleHits,camera:{world:d.renderer.camera.matrixWorld.toArray(),projection:d.renderer.camera.projectionMatrix.toArray()},pickup:{wrist:hand?.getWorldPosition(new T.Vector3()).toArray(),shoulder:v.armBones?.RightArm?.getWorldPosition(new T.Vector3()).toArray(),gunWrist:weapon?.mesh.localToWorld(weapon.wristLocal.clone()).toArray()},skinFloor,actorPose,armPose,proxies,bone:{hips:bone('Hips'),head:bone('Head'),leftFoot:bone('LeftFoot'),rightFoot:bone('RightFoot')},bounds:bounds?{min:bounds.min.toArray(),max:bounds.max.toArray()}:null,render:{calls:info.render.calls,triangles:info.render.triangles,memory:{...info.memory}},audio:[...window.__chestEvents],prompt:document.querySelector('[data-bite-prompt]')?.innerText};
 },name);data.sleeves=await page.evaluate(measureCounterArms);report.views.push(data);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 assertCounterSleeves(data.sleeves,assert,name);
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.render=window.__chestRender;});return data;
}
try{
 await page.goto(`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer._ashWitnessAsset&&window.__DEAD_ARRIVAL__?.renderer._survivors?.status==='ready');
 assert.deepEqual(report.errors,[],'runtime boot must load its styles and assets without browser resource errors');
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'&&window.__DEAD_ARRIVAL__.renderer._weaponsPrepared&&window.__DEAD_ARRIVAL__.renderer.brutalCombatVisuals.chest.status==='ready');
 await page.locator('canvas').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('canvas'),null,{timeout:10000});
 await fixture({hp:5,maxHp:5,stagger:0});await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{createMind}=await import('./enemy-ai.js'),e=r.course.enemies[0];r.weapon=0;r.pitch=-.25;e.moveSpeed=0;createMind(e,{state:'stalk',firstAttack:100});e.mind.emerge=0;});
 await page.mouse.click(640,360);await page.waitForFunction(()=>{const e=window.__DEAD_ARRIVAL__.run.course.enemies[0];return e.hp>0&&e.hp<5;},null,{timeout:10000});await page.waitForTimeout(120);await keyStart();await shot('00-natural-bodyshot-to-pierce');report.checks.push('real mouse bodyshot opens V after a normal reaction delay');
 await fixture({hp:30,stagger:0});await page.keyboard.press('v');assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.phase),'idle');report.checks.push('healthy targets reject chest execution');
 await fixture();await keyStart();await shot('01-thrust-windup');
 await advance(.25);let image=await shot('02-chest-contact');assert(image.enemy.dead&&image.enemy.wound.type==='pierce');assert.equal(image.visuals.hands,2);assert.equal(image.visuals.physics.ragdolls,1);report.checks.push('V commits one lethal contact with imported arm IK');
 await advance(.45);image=await shot('03-heart-extraction');assert(image.enemy.heartRemoved);assert(image.heart.visible);assert(image.heart.ndc.slice(0,2).every(x=>Math.abs(x)<1),'extracted heart is in frame');assert.equal(image.visuals.grip.controls,6);assert(image.visuals.grip.right>.9,'weighted distal finger cluster curls around extraction');assert(image.heart.influences[image.heart.shapes.GripCompress]>.6,'authored heart yields in the grasp');report.checks.push('heart appears at authoritative extraction boundary with weighted hand curl and tissue compression');
 const extractionClock=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.elapsed);await advance(.9416666667-extractionClock);image=await shot('03b-last-held-pose');assert(image.visuals.physics.held===1);await advance(.0583333333);image=await shot('04-heart-body-release');assert(image.visuals.physics.drops>=1);report.checks.push('heart and firearm use local rigid bodies');
 await advance(.32);image=await shot('05-weapon-recovery');assert(image.visuals.pickupView,'pickup uses its shared eye/shoulder frame');assert.equal(image.visuals.recoveryRetreat,0,'no eye-only retreat runs after the hand solve');assert(image.visuals.chest.weaponRetrieved,'recovery reaches the actual fallen firearm');assert(image.visuals.chest.weaponGripGap<.02,'weapon recovery stays within 20mm of the actual fallen grip');
 await advance(.10);image=await shot('05b-recovery-return');assert(image.visuals.pickupView,'frozen floor anchor survives the gameplay grip-target cutoff');assert.equal(image.visuals.recoveryRetreat,0,'return to idle keeps eyes and shoulders in the same frame');
 await advance(.13);image=await shot('06-finisher-complete');assert.equal(image.brutal.phase,'idle');assert.equal(image.visuals.chest.weaponReleased,false);report.checks.push('weapon recovery reaches the fallen grip and restores ordinary shooting state without an eye-only return step');
 await advance(3);image=await shot('07-ragdoll-settled-first-person');assert(image.bone.hips[1]<.9,'released pelvis falls toward floor');assert(image.bone.hips.every(Number.isFinite));
 await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__,T=await import('./vendor/three.module.js'),root=d.renderer._enemyVisuals.get(d.run.course.enemies[0].id).root,p=root.getObjectByName('Hips').getWorldPosition(new T.Vector3());d.renderer.freeCamera={x:p.x+1.8,y:1.8,z:p.z+2.2,angle:Math.atan2(-2.2,-1.8),pitch:-.42};});
 await shot('08-ragdoll-full-body');report.checks.push('full imported skeleton falls and stays finite');
 await page.evaluate(async()=>{const d=window.__DEAD_ARRIVAL__,T=await import('./vendor/three.module.js'),root=d.renderer._enemyVisuals.get(d.run.course.enemies[0].id).root,p=root.getObjectByName('Hips').getWorldPosition(new T.Vector3());d.renderer.freeCamera={x:p.x-2.1,y:1.4,z:p.z+.5,angle:Math.atan2(-.5,2.1),pitch:-.38};});
 image=await shot('08b-ragdoll-side');assert(image.skinFloor.filter(s=>s.visible).every(s=>s.minY>=-.015),'visible fitted source skin remains within floor contact tolerance');report.checks.push('freshly normalized source skin fits physical floor contact');
 await fixture({gore:false,reducedMotion:true});await keyStart();await advance(.75);image=await shot('09-gore-off-execution');assert(image.enemy.dead);assert.equal(image.heart.visible,false);assert.equal(image.visuals.spray,0);report.checks.push('gore setting changes presentation without removing execution');
 await fixture({reducedMotion:true});await keyStart();await advance(.71);await shot('10-reduced-motion-heart');
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.begin();});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');image=await shot('11-restart-clean');assert.equal(image.visuals.physics.ragdolls,0);assert.equal(image.visuals.physics.drops,0);report.checks.push('restart removes every local physics body');
 await fixture();await page.evaluate(()=>{window.__chestPadOn=true;});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.controller.armed);
 await page.evaluate(()=>{window.__chestPad.buttons[11]={pressed:true,value:1};});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.brutal.kind==='pierce'&&window.__DEAD_ARRIVAL__.run.brutal.phase!=='idle');
 await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='ready';});const sequence=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.brutal.sequence);await advance(.71);image=await shot('12-controller-R3-extraction');assert(image.heart.visible);assert.equal(image.brutal.sequence,sequence);report.checks.push('standard R3 routes through real controller and authoritative finisher');
 await page.evaluate(()=>{window.__chestPad.buttons[11]={pressed:false,value:0};});
 await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.time),frozen);await page.locator('[data-action="resume"]').click();await shot('13-pause-resume');report.checks.push('pause preserves the action and stops the physics clock');
 if(process.env.CHEST_TEMPORAL==='1'){
  await mkdir(`${output}/motion`,{recursive:true});await fixture();await keyStart();report.motion=[];
  for(let frame=0;frame<90;frame++){
   await advance(1/60);await page.screenshot({path:`${output}/motion/${String(frame).padStart(4,'0')}.png`});
   report.motion.push(await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,v=d.renderer.brutalCombatVisuals,s=[...v.actors.values()].find(s=>s.heart);return{time:d.run.brutal.elapsed,phase:d.run.brutal.phase,shapes:s?.heart?.morphTargetInfluences?.slice(),grip:v.diagnostics().grip,weapon:v.chest.diagnostics(),cameraYaw:d.renderer.camera.rotation.y};}));
  }
  assert(report.motion.every(s=>Math.abs(s.cameraYaw)<=.46),'recovery yaw must stay bounded across repeated renders');
  await advance(.1);assert.equal(await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.camera.rotation.y),0,'ordinary view resumes with no accumulated recovery yaw');
  report.checks.push('90 temporal frames preserve bounded recovery view and continuous shape/grip phases');
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks,views:report.views.length,motionFrames:report.motion?.length||0,errors:report.errors}));
}catch(error){report.status='FAIL';report.failure=error.stack;report.inputState=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__?.screen,mode:window.__DEAD_ARRIVAL__?.run?.mode,prepared:window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,locked:!!document.pointerLockElement,center:document.elementsFromPoint(640,360).slice(0,4).map(e=>({tag:e.tagName,class:e.className,text:e.innerText?.slice(0,140)}))})).catch(()=>null);await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));throw error;}
finally{await browser.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
