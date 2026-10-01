import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';

// Dedicated arm inspection runs in a separate headless browser. ARMS_URL can
// target the existing source server without touching any of its browser tabs.
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.ARMS_OUTPUT||'output/playwright/arms-v1/final-v2';
const baseline=process.env.ARMS_BASELINE==='1';
const preview=process.env.ARMS_PREVIEW==='1';
const startupProbe=process.env.ARMS_STARTUP_PROBE==='1';
await mkdir(output,{recursive:true});
// A frozen runtime overrides ARMS_URL, so the served bytes and evidence hashes
// always come from the same snapshot even while another task rebuilds dist.
const frozenRuntime=process.env.DEAD_ARRIVAL_RUNTIME?resolve(process.env.DEAD_ARRIVAL_RUNTIME):null;
const runtimeRoot=frozenRuntime||resolve(process.cwd(),process.env.ARMS_URL?'.':'dist');
const server=!frozenRuntime&&process.env.ARMS_URL?null:await startServer({root:runtimeRoot,port:0,spaFallback:false});
const url=server?`http://127.0.0.1:${server.port}/`:process.env.ARMS_URL;
const report={status:'RUNNING',baseline,preview,startupProbe,verificationScope:startupProbe?'bounded menu-to-play startup diagnostics only':preview?'prototype ordinary arm fitting; not final quality verification':'full 36-pose ordinary arm and interaction-source verification',url,runtimeRoot,frozenRuntime:!!frozenRuntime,viewport:{width:1280,height:720},errors:[],views:[],checks:[],limitations:['Geometry and socket metrics complement visual inspection; they cannot establish AAA quality.','Pose fields are staged deterministically under the actual renderer; broader host input and interaction regressions are owned by the root QA run.','No mobile support or physical controller certification is in scope.'],sourceHashes:{}};
for(const file of ['assets/survivor/tld-survivor-v02.glb','assets/survivor/player-survivor.js','assets/survivor/meshy-survivor.js','renderer.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(join(runtimeRoot,file))).digest('hex');
if(!baseline)for(const file of ['assets/load-glb.js','assets/survivor/viewmodel-arms-v1.glb','assets/survivor/viewmodel-arms-v1-manifest.json','assets/survivor/foreground-arms.js','weapon-ossuary.js','weapon-breach.js','weapon-arc.js','weapon-reliquary.js','weapon-rifles.js','weapon-melee.js','brutal-combat-visuals.js','chest-finisher-visuals.js','vermin-visuals.js','hand-grip-rig.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(join(runtimeRoot,file))).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>report.errors.push(`${r.failure()?.errorText} ${r.url()}`));
await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));

async function startupSnapshot(stage){
 const snapshot=await page.evaluate(stage=>{
  const d=window.__DEAD_ARRIVAL__,r=d?.renderer;if(!r)return{stage,appPresent:!!d,title:document.title,readyState:document.readyState};
  const tracker=window.__armReadiness??={promises:{},seen:new WeakMap()};
  for(const [name,promise] of Object.entries({materials:r._materialsReady,wardens:r._wardenReady,survivor:r._survivorReady,ashWitness:r._ashWitnessReady,brutal:r.brutalCombatVisuals?.ready,chest:r.brutalCombatVisuals?.chest?.ready,vermin:r.verminVisuals?.ready,warmup:r._warmupPromise})){
   if(!promise?.then||tracker.seen.get(promise)===name)continue;tracker.seen.set(promise,name);tracker.promises[name]={state:'pending',seenAt:performance.now()};promise.then(()=>{tracker.promises[name]={state:'resolved',settledAt:performance.now()};},error=>{tracker.promises[name]={state:'rejected',error:String(error?.message||error),settledAt:performance.now()};});
  }
  const s=r._survivors,c=r.brutalCombatVisuals,v=r.verminVisuals;
  return{stage,atMs:performance.now(),screen:d.screen,runMode:d.run?.mode,prepared:r._weaponsPrepared,warmStage:r._preparationStage||null,warmupPromise:!!r._warmupPromise,warmupMatchesCourse:r._warmupCourse===d.run?.course,preparedMatchesCourse:r._preparedCourse===d.run?.course,course:r._course?.id||null,promises:structuredClone(tracker.promises),
   survivor:{status:s?.status,armStatus:s?.armStatus,error:s?.error||null,armError:s?.armError||null,bodyTemplate:!!s?.template,armTemplate:!!s?.armTemplate,viewSleeves:s?.viewSleeves},wardens:{status:r._wardenStatus,legacyTemplate:!!r.wardenTemplate,bloodworksTemplate:!!r.bloodworksWardenTemplate},ashWitness:{loaded:!!r._ashWitnessAsset,error:r._ashWitnessError||null},brutal:{status:c?.status,armStatus:c?.armStatus,error:c?.error||null,asset:!!c?.asset,arms:!!c?.arms,chest:{status:c?.chest?.status,error:c?.chest?.error||null,asset:!!c?.chest?.asset}},vermin:{status:v?.status,armStatus:v?.armStatus,error:v?.error||null,asset:!!v?.asset,arms:!!v?.arms},gpu:{programs:r.renderer?.info?.programs?.length,memory:r.renderer?.info?.memory,contextLost:r.renderer?.getContext().isContextLost()},startButton:{disabled:document.querySelector('[data-action="start"]')?.disabled,text:document.querySelector('[data-action="start"]')?.innerText}};
 },stage);
 (report.startupSnapshots??=[]).push(snapshot);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));return snapshot;
}

async function fixture(weapon,{bodycam=true,aim=0,shot=0,progress=null,heavy=false,contact=0}={}){
 return page.evaluate(async options=>{
  const d=window.__DEAD_ARRIVAL__,r=d.run,E=await import('./engine.js');
  if(!window.__armAnchor){const angle=Array.from({length:24},(_,i)=>i*Math.PI/12).sort((a,b)=>E.castRay(r.course,r.x,r.y,b,8).dist-E.castRay(r.course,r.x,r.y,a,8).dist)[0];window.__armAnchor={x:r.x,y:r.y,angle};}
  Object.assign(r,window.__armAnchor,{mode:'ready',z:0,vx:0,vy:0,vz:0,speed:0,pitch:0,health:100,energy:100,weapon:options.weapon,aim:options.aim,shot:0,damage:0,punch:0,slide:0,dashTime:0,rifleKick:0,rifleKickYaw:0,rifleHeat:0,rifleCharge:0,meleeActive:false,meleeProgress:0,meleeContact:0,sawRev:0,sawActive:false,extraction:{phase:'idle'}});
  r.ownedWeapons=Array.from({length:8},(_,i)=>i);r.course.enemies=[];r.brutal={phase:'idle',sequence:r.brutal?.sequence||0};r.bite={phase:'idle',enemyId:null,cooldown:100};r.playerWounds={leftArm:'intact',rightArm:'intact',leftLeg:'intact',rightLeg:'intact',neck:0,torso:0,eviscerated:false};r.verminHand={phase:'idle',sequence:0};r.verminCrawl={phase:'idle',elapsed:0};
  d.renderer.freeCamera=null;d.renderer.setSettings({bodycam:true,reducedMotion:false,gore:true});
  // Debug resolve mode 1 removes the sensor/lens effects while retaining the
  // same bodycam camera and FOV, so the underlying silhouette remains comparable.
  if(d.renderer.bodycam){d.renderer.bodycam.debugMode=options.bodycam?0:1;d.renderer.bodycam.fixedTime=12;}
  d.renderer.weaponPresentation?.reset(r,options.weapon,false);d.renderer.bodycamMotion?.reset();
  for(let i=0;i<45;i++){window.__armNow+=1000/60;window.__armRender.call(d.renderer,r,window.__armNow);}
  Object.assign(r,{shot:options.shot,rifleKick:options.weapon===4||options.weapon===5?options.shot*.9:0,meleeActive:options.progress!==null,meleeProgress:options.progress||0,meleeHeavy:options.heavy,meleeContact:options.contact,sawRev:options.weapon===7&&options.progress!==null?1:0,sawActive:options.weapon===7&&options.progress!==null});
  if(options.shot>0)r.shotSequence=(r.shotSequence||0)+1;
  for(let i=0;i<(options.shot>0?4:2);i++){window.__armNow+=1000/60;window.__armRender.call(d.renderer,r,window.__armNow);}
  d.ui.hud(r,{fps:d.fps});
 },{weapon,bodycam,aim,shot,progress,heavy,contact});
}

async function shot(name){
 const data=await page.evaluate(async name=>{
  const T=await import('./vendor/three.module.js'),d=window.__DEAD_ARRIVAL__,ren=d.renderer,run=d.run,group=ren.weaponGroups[run.weapon],arms=group.userData.viewArms||{};
  const info=ren.renderer.info,resetMode=info.autoReset;info.autoReset=false;info.reset();window.__armNow+=1000/60;window.__armRender.call(ren,run,window.__armNow);
  const rendering={calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures};info.autoReset=resetMode;
  ren.scene.updateMatrixWorld(true);
  function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
  function points(root,limit=180){const out=[];root?.traverse(m=>{if(!m.isMesh||!visible(m))return;const p=m.geometry.attributes.position,step=Math.max(1,Math.floor(p.count/limit)),v=new T.Vector3();for(let i=0;i<p.count;i+=step){m.getVertexPosition(i,v);out.push(v.clone().applyMatrix4(m.matrixWorld));}});return out;}
  const metrics=[];
  for(const [side,arm] of Object.entries(arms)){
   if(!arm)continue;const meshes=[];let invalid=0;arm.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid++;
    const b=new T.Box3().setFromObject(m,true),s=b.getSize(new T.Vector3());const values=m.scale.toArray().map(Math.abs),min=Math.min(...values),anisotropy=min?Math.max(...values)/min:Infinity;
    meshes.push({name:m.name,vertices:p.count,visible:visible(m),dimensions:s.toArray(),localScale:m.scale.toArray(),anisotropy,skinned:!!m.isSkinnedMesh});
   });
   const hand=arm.userData.hand,socket=arm.userData.gripSocket,fit=arm.userData.foregroundArmFit;const wrist=fit?.forearm||arm.getObjectByName('BareFPSWrist')||arm.getObjectByName('WristWrap')||arm.getObjectByName(`MeshySleeve_${arm.userData.side<0?'Left':'Right'}`)||arm.children.find(n=>n!==hand&&n.isMesh);
   const hp=points(hand),wp=points(wrist);let wristGap=null;if(hp.length&&wp.length){wristGap=Infinity;for(const h of hp)for(const w of wp)wristGap=Math.min(wristGap,h.distanceTo(w));}
   const armBox=new T.Box3().setFromObject(arm,true),handBox=hand?new T.Box3().setFromObject(hand,true):null;
   const nativeHandBox=new T.Box3();for(const p of hp)nativeHandBox.expandByPoint(hand.worldToLocal(p.clone()));
   const handScale=hand?.getWorldScale(new T.Vector3()),canonicalHandDimensions=hp.length?nativeHandBox.getSize(new T.Vector3()).multiply(handScale).toArray():null;
   let fitting=null;if(fit){
    const wristWorld=fit.wrist.getWorldPosition(new T.Vector3()),forearmStart=fit.forearm.getWorldPosition(new T.Vector3()),forearmEnd=new T.Vector3(0,-fit.forearmLength,0).applyMatrix4(fit.forearm.matrixWorld),upperStart=fit.upper.getWorldPosition(new T.Vector3()),shoulderEnd=new T.Vector3(0,-fit.upperLength,0).applyMatrix4(fit.upper.matrixWorld),shoulderCamera=ren.camera.worldToLocal(shoulderEnd.clone()),shoulderNdc=shoulderEnd.clone().project(ren.camera);
    const scale=fit.forearm.getWorldScale(new T.Vector3());
    const bottomPlane=new T.Vector3(0,1,-Math.tan(T.MathUtils.degToRad(ren.camera.fov*.5))).normalize();let capSamples=0,capMaxPlaneDistance=-Infinity;const capPoint=new T.Vector3();
    fit.upper.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){m.getVertexPosition(i,capPoint);capPoint.applyMatrix4(m.matrixWorld);const local=fit.upper.worldToLocal(capPoint.clone());if(local.y<=-fit.upperLength+.025){capSamples++;capMaxPlaneDistance=Math.max(capMaxPlaneDistance,bottomPlane.dot(ren.camera.worldToLocal(capPoint.clone())));}}});
    fitting={wristAngle:fit.wristAngle,wristOriginGapMeters:forearmStart.distanceTo(wristWorld),elbowOriginGapMeters:forearmEnd.distanceTo(upperStart),gripSocketDistanceMeters:socket.getWorldPosition(new T.Vector3()).distanceTo(fit.grip.getWorldPosition(new T.Vector3())),forearmLengthMeters:forearmStart.distanceTo(forearmEnd),expectedForearmLengthMeters:fit.forearmLength*scale.x,upperLengthMeters:upperStart.distanceTo(shoulderEnd),nativeUpperLengthMeters:fit.upperLength,shoulderPlaneDistance:fit.shoulderPlaneDistance,conservativeCapMarginMeters:fit.capMargin,measuredCapMarginMeters:capSamples?-capMaxPlaneDistance:null,capVertexSamples:capSamples,shoulderEndCamera:shoulderCamera.toArray(),shoulderEndScreen:[(shoulderNdc.x+1)*640,(1-shoulderNdc.y)*360],shoulderEndInsideViewport:shoulderCamera.z < -ren.camera.near&&Math.abs(shoulderNdc.x)<1&&Math.abs(shoulderNdc.y)<1&&shoulderNdc.z>=-1&&shoulderNdc.z<=1,
     structuralScales:Object.fromEntries([['hand',fit.hand],['forearm',fit.forearm],['upper',fit.upper]].map(([n,o])=>[n,{local:o.scale.toArray(),world:o.getWorldScale(new T.Vector3()).toArray()}]))};
   }
   const socketWorld=socket?.getWorldPosition(new T.Vector3()),cameraSocket=socketWorld?ren.camera.worldToLocal(socketWorld.clone()).toArray():null;
   const projected=hp.map(p=>p.clone().project(ren.camera));const pixels=projected.filter(p=>p.z>=-1&&p.z<=1).map(p=>[(p.x+1)*640,(1-p.y)*360]);
   const screenBox=pixels.length?{minX:Math.min(...pixels.map(p=>p[0])),maxX:Math.max(...pixels.map(p=>p[0])),minY:Math.min(...pixels.map(p=>p[1])),maxY:Math.max(...pixels.map(p=>p[1]))}:null;
   metrics.push({side,name:arm.name,source:arm.userData.viewmodelSource||null,armVisible:visible(arm),gripTarget:arm.userData.gripTarget||null,invalidPositions:invalid,worldDimensions:armBox.getSize(new T.Vector3()).toArray(),handDimensions:handBox?.getSize(new T.Vector3()).toArray(),canonicalHandDimensions,wristSampleGapMeters:wristGap,cameraSocket,handScreenBox:screenBox,fitting,meshes});
  }
  const gl=ren.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let sum=0,sum2=0,lit=0,n=0;for(let i=0;i<pixels.length;i+=64){const l=(pixels[i]+pixels[i+1]+pixels[i+2])/765;sum+=l;sum2+=l*l;n++;if(l>.015)lit++;}
  return{name,weapon:run.weapon,weaponName:group.name,bodycam:ren.settings.bodycam,postMode:ren.bodycam?.debugMode||0,cameraFov:ren.camera.fov,heldAssembly:{depthMeters:group.userData.foregroundFitRig?.userData.depth,position:group.userData.foregroundFitRig?.position.toArray()},aim:run.aim,shot:run.shot,melee:{active:run.meleeActive,progress:run.meleeProgress,heavy:run.meleeHeavy},rendering,arms:metrics,canvas:{width,height,litFraction:lit/n,mean:sum/n,variance:sum2/n-(sum/n)**2},handling:ren.weaponPresentation?.pose};
 },name);
 assert(data.canvas.litFraction>.08&&data.canvas.variance>.0001,`${name}: visible varied pixels`);
 assert(data.arms.length>=1,`${name}: fitted arm roots present`);
 for(const a of data.arms){assert.equal(a.invalidPositions,0,`${name}: finite ${a.side} geometry`);assert(a.worldDimensions.every(v=>Number.isFinite(v)&&v<20),`${name}: bounded ${a.side} geometry`);assert(a.cameraSocket?.every(Number.isFinite),`${name}: finite grip socket`);
  if(!baseline)try{
   assert.equal(a.source,'blender-native-metric-arms-v1',`${name}: authored ${a.side} replaces stretched fallback`);assert(a.fitting,`${name}: articulated fit metadata`);
   const f=a.fitting;assert(Math.abs(f.forearmLengthMeters-f.expectedForearmLengthMeters)<.0001,`${name}: rest forearm length preserved`);assert(Math.abs(f.forearmLengthMeters-.30464)<.002,`${name}: forearm keeps native metric length`);
   assert(f.wristOriginGapMeters<.0001&&f.elbowOriginGapMeters<.0001,`${name}: wrist/elbow origins remain continuous`);
   assert(f.gripSocketDistanceMeters<.0001,`${name}: hand remains fitted to actual weapon grip`);
   assert(f.shoulderPlaneDistance<=1e-5,`${name}: conservative capped shoulder envelope stays below frustum`);
   assert(f.capVertexSamples>0&&f.measuredCapMarginMeters>0,`${name}: actual upper-sleeve cap vertices remain outside viewport`);
   assert(f.wristAngle<1.45,`${name}: wrist flex ${f.wristAngle.toFixed(3)} exceeds anatomical envelope`);
   for(const [part,s] of Object.entries(f.structuralScales))for(const values of [s.local,s.world])assert(Math.max(...values)-Math.min(...values)<.0001,`${name}: ${part} uses uniform scale`);
   assert(typeof a.wristSampleGapMeters==='number'&&a.wristSampleGapMeters<.055,`${name}: sleeve/hand surfaces stay near each other`);
   const dims=a.canonicalHandDimensions.toSorted((x,y)=>x-y);assert(dims[2]>.10&&dims[2]<.26&&dims[1]<.16&&dims[0]<.105,`${name}: adult hand envelope ${dims.join(',')}`);
  }catch(error){(report.gateFailures??=[]).push({name,side:a.side,message:error.message});}
 }
 await page.screenshot({path:`${output}/${name}.png`});report.views.push(data);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 return data;
}

try{
 await page.goto(`${url}${url.includes('?')?'&':'?'}debug=1&dungeon=0`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer);
 await startupSnapshot('menu-before-start');
 // Start is the real trigger for world/weapon warmup. Waiting for prepared
 // while still in the menu depends on incidental title-asset timing.
 await page.locator('[data-action="start"]').click();await startupSnapshot('after-start-input');
 if(startupProbe){
  for(let i=0;i<9;i++){await page.waitForTimeout(10000);const s=await startupSnapshot(`after-start-${(i+1)*10}s`);console.log(JSON.stringify({stage:s.stage,screen:s.screen,prepared:s.prepared,warmStage:s.warmStage,promises:s.promises}));if(s.prepared&&s.screen==='play')break;}
  await page.screenshot({path:`${output}/startup.png`});const last=report.startupSnapshots.at(-1);assert(last.prepared&&last.screen==='play','bounded actual Start reaches prepared play');assert.deepEqual(report.errors,[]);report.status='PASS';report.checks.push('actual Start input triggers world preparation and reaches play within bounded 90-second probe');await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,startupProbe:true,output,errors:report.errors}));
 }else{
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared);
 await page.evaluate(async()=>{const r=window.__DEAD_ARRIVAL__.renderer;await Promise.all([r._wardenReady,r._ashWitnessReady]);});
 await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');await startupSnapshot('prepared-play');
 await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__;d.run.mode='ready';window.__armRender=d.renderer.render;window.__armNow=performance.now();d.renderer.render=()=>{};});
 report.survivor=await page.evaluate(()=>{
  const ren=window.__DEAD_ARRIVAL__.renderer,s=ren._survivors,remote=s.armTemplate?.getObjectByName('TLD_Remote_Arms'),original=s.template?.getObjectByName('TLD_Remote_Arms');
  const positions=remote?.geometry?.attributes.position.array,sourcePositions=original?.geometry?.attributes.position.array;
  let changed=!!positions&&!!sourcePositions&&positions.length!==sourcePositions.length;if(positions&&sourcePositions&&!changed)for(let i=0;i<positions.length;i++)if(Math.abs(positions[i]-sourcePositions[i])>1e-6){changed=true;break;}
  const cloneSources={};for(const [name,visual] of [['brutal',ren.brutalCombatVisuals],['vermin',ren.verminVisuals]]){const m=visual.arms?.getObjectByName('TLD_Remote_Arms'),p=m?.geometry?.attributes.position.array;let match=!!p&&!!positions&&p.length===positions.length;if(match)for(let i=0;i<p.length;i++)if(Math.abs(p[i]-positions[i])>1e-6){match=false;break;}cloneSources[name]={skinned:!!m?.isSkinnedMesh,positionMatchesCleanedTemplate:match};}
  return{status:s.status,armStatus:s.armStatus,viewSleeves:s.viewSleeves,error:s.error||null,authoredFits:ren.weaponGroups.reduce((n,g)=>n+(g.userData.foregroundArmFits?.length||0),0),separateInteractionTemplate:!!s.armTemplate&&s.armTemplate!==s.template,interactionRemoteSkinned:!!remote?.isSkinnedMesh,interactionRemoteVertices:remote?.geometry?.attributes.position.count,originalRemoteVertices:original?.geometry?.attributes.position.count,interactionGeometrySeparate:!!remote&&remote.geometry!==original?.geometry,interactionGeometryChanged:changed,cloneSources};
 });assert.equal(report.survivor.status,'ready');
 if(!baseline){assert.equal(report.survivor.armStatus,'ready');assert.equal(report.survivor.viewSleeves,15);assert.equal(report.survivor.authoredFits,15);if(!preview){assert(report.survivor.separateInteractionTemplate&&report.survivor.interactionRemoteSkinned&&report.survivor.interactionGeometrySeparate&&report.survivor.interactionGeometryChanged,'separate cleaned skinned interaction geometry is loaded');for(const [name,source] of Object.entries(report.survivor.cloneSources))assert(source.skinned&&source.positionMatchesCleanedTemplate,`${name} actually clones the cleaned skinned arm source`);}}
 console.log(JSON.stringify({stage:'prepared',baseline,preview,authoredFits:report.survivor.authoredFits,errors:report.errors.length}));
 for(const weapon of preview?[0,1,4,6,7]:[0,1,2,3,4,5,6,7]){
  await fixture(weapon);await shot(`weapon-${weapon}-hip-bodycam`);
  if(preview){if(weapon>=6){await fixture(weapon,{progress:.42,heavy:true,contact:.18});await shot(`weapon-${weapon}-swing-0.42-bodycam`);}continue;}
  await fixture(weapon,{bodycam:false});await shot(`weapon-${weapon}-hip-no-post`);
  await fixture(weapon,{aim:1});await shot(`weapon-${weapon}-aim-bodycam`);
  if(weapon<6){await fixture(weapon,{shot:1});await shot(`weapon-${weapon}-recoil-bodycam`);}
  else for(const progress of [.12,.42,.75]){await fixture(weapon,{progress,heavy:true,contact:progress===.42?.18:0});await shot(`weapon-${weapon}-swing-${progress}-bodycam`);}
 }
 console.log(JSON.stringify({stage:'captured',views:report.views.length,poseGateFailures:report.gateFailures?.length||0,errors:report.errors.length}));
 if(preview)report.checks.push('prototype fitting preview: five representative hip poses and bat/chainsaw impact frames only; interaction-source gate intentionally deferred');
 else report.checks.push('all eight prepared viewmodels render hip and aim poses at 1280x720','all eight hip poses also render with bodycam post-processing disabled','six firearm recoil poses and bat/chainsaw windup, impact and recovery render');
 report.checks.push('every sampled arm mesh has finite positions, bounded world extent and a finite grip socket','render calls and triangles include every pass, rather than only the final screen pass','wrist-to-hand sample gaps, scale anisotropy and visible hand screen bounds recorded for art review');
 report.sourceEndHashes={};for(const file of Object.keys(report.sourceHashes))report.sourceEndHashes[file]=createHash('sha256').update(await readFile(join(runtimeRoot,file))).digest('hex');
 if(!baseline&&!preview)assert.deepEqual(report.sourceEndHashes,report.sourceHashes,'arm sources remain frozen through the verification run');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.gateFailures||[],[],'all authored pose/scale/contact gates pass');report.status='PASS';await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,baseline,preview,views:report.views.length,errors:report.errors,output,survivor:report.survivor}));
 }
}catch(error){report.status='FAIL';report.failure=error.stack;report.startupFailure=await startupSnapshot('failure').catch(e=>({diagnosticError:e.message}));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));throw error;}
finally{await browser.close();if(server){server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}}
