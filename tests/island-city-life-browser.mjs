import assert from 'node:assert/strict';

// Supplemental real-input gameplay after governing views. Starts reposition
// only the player on actual safe approaches; vehicles and residents move
// exclusively through the live controller/engine. No browser is launched here.
export async function verifyCityLifeGameplay(page,settle,capture,result={}){
 Object.assign(result,{scope:'Native WebGPU supplemental real Q/W/Space/Ctrl input, controlled player starts, ordinary 100 health, existing live residents and imported animation rigs. Not continuous traversal, FPS or co-op acceptance.',captures:[],controlledStarts:[]});
 const advance=async(ms,chunk=100)=>{for(let left=ms;left>0;left-=Math.min(left,chunk))await page.evaluate(t=>window.advanceTime(t),Math.min(left,chunk));};
 const hold=async(key,ms,chunk=100)=>{await page.keyboard.down(key);try{await advance(ms,chunk);}finally{await page.keyboard.up(key);}};
 const press=async(key)=>{await page.keyboard.down(key);try{await advance(17);}finally{await page.keyboard.up(key);}await advance(17);};
 const shot=async(name)=>{await settle();await capture(name);result.captures.push(name);};
 const start=async(p)=>{
  result.controlledStarts.push(p);
  await page.evaluate(p=>{const q=window.__DEAD_ARRIVAL__;if(q.inspector.active)q.requestInspector();
   Object.assign(q.run,{x:p.x,y:p.y,z:0,supportZ:null,supportId:null,structureId:null,angle:p.angle||0,pitch:p.pitch||0,vx:0,vy:0,vz:0,slide:0,dashTime:0});q.renderer._firstCameraFrame=true;window.advanceTime(0);
  },p);
 };
 await page.waitForFunction(()=>{const g=window.__DEAD_ARRIVAL__?.renderer;return g?._ashWitnessAsset&&[...g._zombieAppearanceLibrary.entries.values()].every(e=>e.status==='ready');},null,{timeout:180000});
 await page.evaluate(async()=>{
  const q=window.__DEAD_ARRIVAL__,r=q.run;
  if(window.__CITY_LIFE_QA__)throw new Error('City supplement already active');
  const fleet=await import('/harbor-vehicle-fleet.js'),engine=await import('/engine.js'),pack=await import('/scavenger-pack.js'),structures=await import('/coastal-structures.js'),ai=await import('/enemy-ai.js');
  const keys=['x','y','z','angle','pitch','vx','vy','vz','supportZ','supportId','structureId','health','energy','damage','shot','speed','slide','dashTime','time','mode','events','blood','gore','limbs','pools','projectiles','tracers','enemyAICursor','enemyAIDiagnostics','scavengerInteractHeld','scavengerRoutePromptId','weaponPromptId','roomInteractHeld','coastalDestination'];
  keys.push('bite','brutal','extraction','playerWounds','verminCrawl','_biteInput','_verminInput','extractCandidateId','style','combo','bestCombo','hookTime','parryTime','groundZ','_supportX','_supportY');
  const snapshot={keys,player:Object.fromEntries(keys.map(k=>[k,structuredClone(r[k])])),
   enemies:r.course.enemies,enemiesState:r.course.enemies.map(e=>({e,data:structuredClone(e),nav:structuredClone(e.nav)})),
   backpack:r.backpack,backpackData:structuredClone(r.backpack),vehicles:r.vehicleFleet.vehicles.map(v=>({v,data:structuredClone(v)})),
   fleetState:{activeId:r.vehicleFleet.activeId,interactHeld:r.vehicleFleet.interactHeld,revision:r.vehicleFleet.revision},activeVehicle:r.activeVehicle,
   interior:r.course.activeInterior,inspectorActive:q.inspector.active,inspectorPose:{...q.inspector.pose}};
  window.__CITY_LIFE_QA__={q,r,engine,pack,fleet,structures,ai,snapshot};
  if(q.inspector.active)q.requestInspector();r.health=100;r.course.activeInterior=null;
 });
 try{
  result.census=await page.evaluate(()=>{const {r,q}=window.__CITY_LIFE_QA__;return{residents:r.course.enemies.length,alive:r.course.enemies.filter(e=>!e.dead).length,newResidents:r.course.coastal.zombiePopulation.spawned,
   cars:r.vehicleFleet.cars.length,helicopters:+!!r.vehicleFleet.helicopter,loot:r.course.coastal.cityLoot,
   importedClips:q.renderer._ashWitnessAsset.clips.map(c=>c.name),appearances:q.renderer._zombieAppearanceLibrary.diagnostics()};});
  assert.equal(result.census.residents,56);assert.equal(result.census.newResidents,48);assert.equal(result.census.cars,16);assert.equal(result.census.helicopters,1);
  assert.equal(result.census.importedClips.length,10);assert(result.census.appearances.every(a=>a.loaded&&a.clips.length===10&&!a.error));

  const carStart=await page.evaluate(()=>{
   const {r,engine}=window.__CITY_LIFE_QA__,v=r.vehicleFleet.cars.find(v=>v.id==='street-works-65-staff')||r.vehicleFleet.cars.find(v=>v.id==='parked-estate-3');
   if(!v)throw new Error('Missing real mainland car');const d=v.halfWidth+.35;
   const p=[1,-1].map(side=>({x:v.x-Math.sin(v.angle)*d*side,y:v.y+Math.cos(v.angle)*d*side})).find(p=>engine.canStand(r.course,p.x,p.y,.12));
   if(!p)throw new Error('Car has no actual safe side approach');window.__CITY_LIFE_QA__.carId=v.id;return{...p,angle:Math.atan2(v.y-p.y,v.x-p.x),id:v.id,home:{x:v.x,y:v.y}};
  });
  await start(carStart);await page.keyboard.down('q');
  // Hold the original entry edge through driving, rather than pressing Q a
  // second time while stopped (which would correctly dismount).
  try{await advance(17);
   assert.equal(await page.evaluate(()=>window.__CITY_LIFE_QA__.fleet.getActiveVehicle(window.__CITY_LIFE_QA__.r)?.id),carStart.id,'Actual Q enters the selected car');
   await hold('w',1200);
  }finally{await page.keyboard.up('q');}await advance(17);
  result.car=await page.evaluate(()=>{
   const s=window.__CITY_LIFE_QA__,{r,q,fleet,engine}=s,v=fleet.getActiveVehicle(r),layout=r.course.coastal.maritime,p=layout.cars.find(p=>p.id===v.id),index=layout.boats.length+1+layout.cars.indexOf(p);
   const matrix=q.renderer.harborWorld.maritime.getPose(index,q.renderer.harborWorld.maritime.root.matrix.clone());
   const actual=[matrix.elements[0]*p.x+matrix.elements[4]*p.y+matrix.elements[8]*p.z+matrix.elements[12],matrix.elements[1]*p.x+matrix.elements[5]*p.y+matrix.elements[9]*p.z+matrix.elements[13],matrix.elements[2]*p.x+matrix.elements[6]*p.y+matrix.elements[10]*p.z+matrix.elements[14]];
   return{id:v.id,occupied:v.occupied,x:v.x,y:v.y,distance:v.distance,speed:v.speed,renderedCentre:actual,expectedCentre:[v.x*4,(v.groundM||0)+p.y,v.y*4],
    movedFootprintBlocks:!engine.canStand(r.course,v.x,v.y,.12),camera:q.renderer.camera.getWorldPosition(q.renderer.camera.position.clone()).toArray(),fov:q.renderer.camera.fov,
    hud:document.querySelector('[data-hud="journey-action"]')?.textContent||'',maritime:q.renderer.harborWorld.maritime.diagnostics};
  });
  assert(result.car.occupied);assert(result.car.distance>.4);assert(Math.hypot(result.car.x-carStart.home.x,result.car.y-carStart.home.y)>.4);
  for(let i=0;i<3;i++)assert(Math.abs(result.car.renderedCentre[i]-result.car.expectedCentre[i])<1e-6,'Original maritime GPU body follows committed real car position');
  assert(result.car.movedFootprintBlocks);assert.equal(result.car.fov,78);assert(/BRAKE|KM\/H/.test(result.car.hud),'Car driving controls visible');
  await shot('city-street-car-driving');await press('q');
  assert(await page.evaluate(()=>window.__CITY_LIFE_QA__.fleet.getActiveVehicle(window.__CITY_LIFE_QA__.r)?.occupied),'Moving Q exit is denied');
  await hold('Space',1500);await press('q');
  result.carExit=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__;return{active:s.fleet.getActiveVehicle(s.r)?.id||null,health:s.r.health,safe:s.engine.canStand(s.r.course,s.r.x,s.r.y,.12)};});
  assert.equal(result.carExit.active,null);assert(result.carExit.health>0);assert(result.carExit.safe);

  const heliStart=await page.evaluate(()=>{const {r,engine}=window.__CITY_LIFE_QA__,v=r.vehicleFleet.helicopter,d=v.halfWidth+.42;
   const p=[1,-1].map(side=>({x:v.x-Math.sin(v.angle)*d*side,y:v.y+Math.cos(v.angle)*d*side})).find(p=>engine.canStand(r.course,p.x,p.y,.12));
   if(!p)throw new Error('Helicopter has no actual safe side approach');return{...p,angle:Math.atan2(v.y-p.y,v.x-p.x),home:{x:v.x,y:v.y}};
  });
  await start(heliStart);await press('q');
  assert.equal(await page.evaluate(()=>window.__CITY_LIFE_QA__.fleet.getActiveVehicle(window.__CITY_LIFE_QA__.r)?.type),'helicopter');
  await hold('Space',3000);
  const helicopterSample=()=>page.evaluate(()=>{const {r,q}=window.__CITY_LIFE_QA__,v=r.vehicleFleet.helicopter,h=q.renderer.harborWorld.helicopter;return{x:v.x,y:v.y,altitudeM:v.altitudeM,landed:v.landed,occupied:v.occupied,speed:v.speed,distance:v.distance,rotorSpeed:v.rotorSpeed,rotorAngle:v.rotorAngle,
   renderedRoot:h.root.position.toArray(),renderedRotor:h.rotor.rotation.y,camera:q.renderer.camera.getWorldPosition(q.renderer.camera.position.clone()).toArray(),hud:document.querySelector('[data-hud="journey-action"]')?.textContent||'',health:r.health};});
  result.helicopterTakeoff=await helicopterSample();assert(result.helicopterTakeoff.altitudeM>2&&!result.helicopterTakeoff.landed);assert(result.helicopterTakeoff.rotorSpeed>.9);
  assert(/LIFT|DESCEND/.test(result.helicopterTakeoff.hud));await shot('city-helicopter-takeoff');
  await hold('w',800);result.helicopterFlight=await helicopterSample();assert(Math.hypot(result.helicopterFlight.x-heliStart.home.x,result.helicopterFlight.y-heliStart.home.y)>.2,'Real W moves airborne helicopter');
  for(const [actual,wanted] of result.helicopterFlight.renderedRoot.map((n,i)=>[n,[result.helicopterFlight.x*4,result.helicopterFlight.altitudeM,result.helicopterFlight.y*4][i]]))assert(Math.abs(actual-wanted)<1e-6);
  assert(Math.abs(result.helicopterFlight.renderedRotor-result.helicopterFlight.rotorAngle)<1e-6);await shot('city-helicopter-flight');
  await press('q');assert(await page.evaluate(()=>window.__CITY_LIFE_QA__.r.vehicleFleet.helicopter.occupied),'Airborne exit rejected');
  // Remove horizontal inertia with the real airbrake before collective
  // descent. This preserves the flown position and tests a clear landing,
  // rather than drifting across the promenade into an authored prop.
  await page.keyboard.down('Shift');
  try{
   await advance(2000);result.helicopterAirbrake=await helicopterSample();
   assert(result.helicopterAirbrake.speed<.05,'Real Shift arrests horizontal flight');
   await hold('Control',5000);result.helicopterLanding=await helicopterSample();
  }finally{await page.keyboard.up('Shift');}
  assert(result.helicopterLanding.landed,'Real Ctrl with held Shift lands helicopter after flight');assert(result.helicopterLanding.health>0);
  await press('q');assert.equal(await page.evaluate(()=>window.__CITY_LIFE_QA__.fleet.getActiveVehicle(window.__CITY_LIFE_QA__.r)),null);

  const itemStart=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__,{r,engine,pack}=s;
   const item=r.course.scavengerPickups.find(p=>p.cityLoot&&p.visualKind==='supply-case'&&!r.backpack.collected.includes(p.id)&&engine.canStand(r.course,p.approach.x,p.approach.y,.12)&&pack.pickupReachable({...r,...p.approach,z:0,supportZ:null,structureId:null},r.course,p));
   if(!item)throw new Error('No real reachable uncollected city case');s.itemId=item.id;return{...item.approach,id:item.id,angle:Math.atan2(item.y-item.approach.y,item.x-item.approach.x),pitch:-.18};
  });
  await start(itemStart);await advance(17);
  result.lootBefore=await page.evaluate(()=>{const {r,q,itemId}=window.__CITY_LIFE_QA__,item=r.course.scavengerPickups.find(p=>p.id===itemId);return{id:itemId,contents:item.contents,supplies:{...r.backpack.supplies},collected:r.backpack.collected.includes(itemId),prompt:r.scavengerRoutePromptId,
   caseInstances:q.renderer._scavengerCaches.meshes[0].count,hint:document.querySelector('.pack-world-hint')?.textContent||'',hintVisible:!document.querySelector('.pack-world-hint')?.hidden};});
  assert.equal(result.lootBefore.prompt,itemStart.id);assert.equal(result.lootBefore.collected,false);assert(result.lootBefore.hintVisible&&/Q/.test(result.lootBefore.hint));await shot('city-interior-loot-ready');
  await press('q');
  result.lootAfter=await page.evaluate(()=>{const {r,q,itemId}=window.__CITY_LIFE_QA__;return{collected:r.backpack.collected.includes(itemId),supplies:{...r.backpack.supplies},caseInstances:q.renderer._scavengerCaches.meshes[0].count,collectedIds:[...r.backpack.collected]};});
  assert(result.lootAfter.collected);assert.equal(result.lootAfter.caseInstances,result.lootBefore.caseInstances-1,'Actual rendered case instance disappears after Q');
  for(const [kind,count]of Object.entries(result.lootBefore.contents))assert.equal(result.lootAfter.supplies[kind],result.lootBefore.supplies[kind]+count);await shot('city-interior-loot-collected');
  await press('q');assert.deepEqual(await page.evaluate(()=>({supplies:window.__CITY_LIFE_QA__.r.backpack.supplies,collectedIds:window.__CITY_LIFE_QA__.r.backpack.collected})),{supplies:result.lootAfter.supplies,collectedIds:result.lootAfter.collectedIds});

  const residentStart=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__,{r,engine}=s;
   for(const e of r.course.enemies.filter(e=>e.populationId&&e.locomotion==='shambler'&&!e.dead&&!e.roomId&&e.state==='wander'&&e.mind.aware<.2&&!e.mind.socialPending)){
    for(const delta of [.55,-.55,.35,-.35]){const a=e.facing+delta,d=3.5,p={x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d};
     if(engine.canStand(r.course,p.x,p.y,.12)&&engine.castRay(r.course,e.x,e.y,a,d+.1,e.groundZ+.32).dist>=d-.01){s.residentId=e.id;return{...p,id:e.id,populationId:e.populationId,angle:a+Math.PI,pitch:0,before:{x:e.x,y:e.y,facing:e.facing,state:e.state}};}
    }
   }throw new Error('No original quiet resident with actual unobstructed frontal lane; do not synthesize a substitute');
  });
  const residentSample=()=>page.evaluate(()=>{const s=window.__CITY_LIFE_QA__,e=s.r.course.enemies.find(e=>e.id===s.residentId),entry=s.q.renderer._enemyVisuals.get(e.id),a=entry?.root.userData.afterlife;
   return{id:e.id,populationId:e.populationId,state:e.state,x:e.x,y:e.y,facing:e.facing,look:e.look,moving:e.moving,distanceMetres:Math.hypot(e.x-s.r.x,e.y-s.r.y)*4,confirmed:e.mind.sighting?.confirmed,health:s.r.health,visible:!!entry?.root.visible,
    shuffleClip:a?.shuffleAction?.getClip().name,chaseClip:a?.chaseAction?.getClip().name,
    appearance:a?.appearance,motionClass:a?.motionClass,attention:a?{applied:a.attention.applied,yaw:a.attention.yaw,pitch:a.attention.pitch}:null,
    headQuaternion:entry?.root.getObjectByName('Head')?.getWorldQuaternion(entry.root.quaternion.clone()).toArray(),weights:a?Object.fromEntries(Object.entries(a.actions).map(([k,v])=>[k,v.getEffectiveWeight()])):null};});
  await start(residentStart);await advance(180,17);result.residentNotice=await residentSample();
  assert.equal(result.residentNotice.state,'notice');assert(result.residentNotice.look>.1||result.residentNotice.look<-.1);assert(result.residentNotice.visible&&result.residentNotice.attention.applied);assert(Math.abs(result.residentNotice.attention.yaw)>.02);
  assert.equal(result.residentNotice.moving,0);assert(Math.abs(result.residentNotice.facing-residentStart.before.facing)<1e-8,'Head recognition precedes body turn');await shot('city-resident-recognition');
  result.residentSequence=[result.residentNotice];
  const residentDistance0=Math.hypot(residentStart.before.x-residentStart.x,residentStart.before.y-residentStart.y)*4;
  for(let i=0;i<40;i++){
   await advance(100);const sample=await residentSample();
   sample.displacementMetres=Math.hypot(sample.x-residentStart.before.x,sample.y-residentStart.before.y)*4;
   sample.closingMetres=residentDistance0-sample.distanceMetres;result.residentSequence.push(sample);
   if(['stalk','flank','attack'].includes(sample.state)&&sample.moving>.01&&sample.displacementMetres>1&&sample.closingMetres>1&&(sample.weights?.shuffle||0)+(sample.weights?.chase||0)>.5)break;
  }
  result.residentPursuit=result.residentSequence.at(-1);assert(['stalk','flank','attack'].includes(result.residentPursuit.state));assert(result.residentPursuit.confirmed&&result.residentPursuit.moving>0);assert(result.residentPursuit.health>0);
  assert(result.residentPursuit.displacementMetres>1&&result.residentPursuit.closingMetres>1,'Real resident moves over one metre toward the seen player');
  assert.equal(result.residentPursuit.shuffleClip,'AshWitness_Shuffle');assert.equal(result.residentPursuit.chaseClip,'AshWitness_Chase');
  assert((result.residentPursuit.weights.shuffle||0)+(result.residentPursuit.weights.chase||0)>.5,'Actual imported gait carries committed pursuit');
  assert(result.residentSequence.some(p=>Math.abs(p.facing-residentStart.before.facing)>.04),'Real body turns toward seen player');await shot('city-resident-pursuit');

  const runnerStart=await page.evaluate(()=>{
   const s=window.__CITY_LIFE_QA__,{r,engine,structures,ai}=s;
   for(const e of r.course.enemies.filter(e=>e.populationId&&e.locomotion==='runner'&&!e.dead&&!e.roomId)){
    for(const a of [e.facing,e.facing+.35,e.facing-.35,0,Math.PI/2,Math.PI,-Math.PI/2]){
     if(Math.abs(Math.atan2(Math.sin(a-e.facing),Math.cos(a-e.facing)))>1)continue;
     // Outside the authored distant-notice threshold, the original resident
     // pauses to recognize us before committing its body to pursuit.
     const d=3,p={x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d};
     const from={x:e.x,y:e.y,z:structures.actorGroundAt(r.course,e)+.32},to={...p,z:structures.actorGroundAt(r.course,p)+.32};
     if(ai.visionAllows(e,p)&&engine.canStand(r.course,p.x,p.y,.12)&&!structures.traceStructureSegment(r.course,from,to)&&engine.castRay(r.course,e.x,e.y,a,d+.1,from.z,(to.z-from.z)/d).dist>=d-.01){
      s.runnerId=e.id;return{...p,id:e.id,populationId:e.populationId,angle:a+Math.PI,pitch:0,before:{x:e.x,y:e.y,state:e.state,facing:e.facing},initialDistanceMetres:d*4};
     }
    }
   }throw new Error('No original live runner with actual clear frontal lane; do not spawn or rewrite a substitute');
  });
  await start(runnerStart);result.runnerSequence=[];
  for(let i=0;i<80;i++){
   await advance(100);
   const sample=await page.evaluate(()=>{
    const s=window.__CITY_LIFE_QA__,e=s.r.course.enemies.find(e=>e.id===s.runnerId),entry=s.q.renderer._enemyVisuals.get(e.id),a=entry?.root.userData.afterlife;
    return{id:e.id,populationId:e.populationId,locomotion:e.locomotion,state:e.state,x:e.x,y:e.y,moving:e.moving,burst:e.burst,
     distanceMetres:Math.hypot(e.x-s.r.x,e.y-s.r.y)*4,confirmed:e.mind.sighting?.confirmed,visible:!!entry?.root.visible,health:s.r.health,
     appearance:a?.appearance,motionClass:a?.motionClass,runClip:a?.runAction?.getClip().name,runWeight:a?.runAction?.getEffectiveWeight(),gaitPhase:a?.gaitPhase,clips:a?.clips.map(c=>c.name),
     weights:a?Object.fromEntries(Object.entries(a.actions).map(([k,v])=>[k,v.getEffectiveWeight()])):null};
   });
   sample.displacementMetres=Math.hypot(sample.x-runnerStart.before.x,sample.y-runnerStart.before.y)*4;
   sample.closingMetres=runnerStart.initialDistanceMetres-sample.distanceMetres;result.runnerSequence.push(sample);
   if(['stalk','flank','attack'].includes(sample.state)&&sample.confirmed&&sample.visible&&sample.moving>.01&&sample.displacementMetres>2&&sample.closingMetres>2&&sample.distanceMetres<8&&sample.runWeight>.25)break;
  }
  result.runner=result.runnerSequence.at(-1);assert.equal(result.runner.locomotion,'runner');assert.equal(result.runner.motionClass,'runner');
  assert(['stalk','flank','attack'].includes(result.runner.state));assert(result.runner.confirmed&&result.runner.visible&&result.runner.health>0);
  assert(result.runner.displacementMetres>2&&result.runner.closingMetres>2&&result.runner.distanceMetres<8,'Original runner closes more than two metres and remains clearly framed by actual player camera');
  assert.equal(result.runner.runClip,'AshWitness_Run');assert.equal(result.runner.clips.length,10);assert(result.runner.runWeight>.25,'Actual imported Run clip visibly contributes to pursuit');await shot('city-runner-pursuit');

  // Supplement the unchanged governing pursuit view with both nearby real
  // sidewalk positions that previously exposed the coplanar corner artifact.
  // These are stability diagnostics, never replacements for the primary view.
  const cornerPrior=await page.evaluate(()=>{const r=window.__CITY_LIFE_QA__.r;return{x:r.x,y:r.y,z:r.z,angle:r.angle,pitch:r.pitch};});
  try{
   result.groundCornerDiagnostics=[];
   for(const [name,x,z]of [['city-groundcorner-diagnostic-v85',314.048571,6.078569],['city-groundcorner-diagnostic-v87',314.039573,6.049297]]){
    const proof=await page.evaluate(({x,z})=>{const s=window.__CITY_LIFE_QA__;if(!s.engine.canStand(s.r.course,x/4,z/4,.12)||!s.r.vehiclePhysics.stand(x/4,z/4,.12))throw new Error('Corner diagnostic requires actual legal sidewalk');Object.assign(s.r,{x:x/4,y:z/4,z:0});s.q.renderer._firstCameraFrame=true;return{position:[x,z],legal:true,health:s.r.health};},{x,z});
    await shot(name);result.groundCornerDiagnostics.push({name,...proof});
   }
  }finally{await page.evaluate(prior=>{const s=window.__CITY_LIFE_QA__;Object.assign(s.r,prior);s.q.renderer._firstCameraFrame=true;},cornerPrior);}

  const injuredStart=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__,{r,engine}=s;
   for(const e of r.course.enemies.filter(e=>e.populationId&&e.locomotion==='injured'&&!e.dead&&!e.roomId)){
    for(const a of [e.facing+Math.PI,e.facing+Math.PI+.3,e.facing+Math.PI-.3]){const d=2.5,p={x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d};
     if(engine.canStand(r.course,p.x,p.y,.12)&&engine.castRay(r.course,e.x,e.y,a,d+.1,e.groundZ+.32).dist>=d-.01){s.injuredId=e.id;return{...p,id:e.id,angle:a+Math.PI,pitch:0,before:{x:e.x,y:e.y,state:e.state}};}
    }
   }throw new Error('No original injured resident with actual safe observation lane');
  });
  await start(injuredStart);
  result.injuredSamples=[];
  for(let i=0;i<40;i++){
   await advance(100);
   const sample=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__,e=s.r.course.enemies.find(e=>e.id===s.injuredId),entry=s.q.renderer._enemyVisuals.get(e.id),a=entry?.root.userData.afterlife;return{id:e.id,state:e.state,x:e.x,y:e.y,moving:e.moving,locomotion:e.locomotion,visible:!!entry?.root.visible,
    appearance:a?.appearance,motionClass:a?.motionClass,shuffleClip:a?.shuffleAction?.getClip().name,shuffleWeight:a?.shuffleAction?.getEffectiveWeight(),gaitPhase:a?.gaitPhase,injuredApplied:a?.injuredGait.applied,injuredAmount:a?.injuredGait.amount,
    clips:a?.clips.map(c=>c.name),weights:a?Object.fromEntries(Object.entries(a.actions).map(([k,v])=>[k,v.getEffectiveWeight()])):null,health:s.r.health};});
   result.injuredSamples.push(sample);if(sample.moving>.01&&sample.injuredApplied&&sample.shuffleWeight>.01)break;
  }
  result.injured=result.injuredSamples.at(-1);assert.equal(result.injured.locomotion,'injured');assert.equal(result.injured.motionClass,'shambler');assert(result.injured.visible&&result.injured.injuredApplied);
  assert.equal(result.injured.shuffleClip,'AshWitness_Shuffle');assert(result.injured.shuffleWeight>.01);assert.equal(result.injured.clips.length,10);assert(result.injured.health>0);await shot('city-injured-shuffle');
  result.operations=await page.evaluate(()=>{const {r,q}=window.__CITY_LIFE_QA__;return{ai:r.enemyAIDiagnostics,crowd:q.renderer._crowdDiagnostics,fleet:r.vehicleFleet.diagnostics,health:r.health,shots:r.shotSequence,renderer:q.renderer.renderer.backend.isWebGPUBackend};});
  assert(result.operations.renderer);assert(result.operations.ai.navSearches<=4);
  const detailViews=await page.evaluate(()=>{
   const {r,engine,structures}=window.__CITY_LIFE_QA__,wreck=r.course.coastal.maritime.cars.find(p=>p.id==='street-main-16-resident');
   if(!wreck)throw new Error('Missing actual abandoned main-street wreck');
   const scene=r.course.coastal.cityLife,community=scene.communities.find(p=>p.story==='abandoned-market');
   const parts=scene.parts.filter(p=>p.community===community?.id),anchors=parts.filter(p=>p.shape!=='grass')
    .sort((a,b)=>Number(b.role==='evacuation-crate')-Number(a.role==='evacuation-crate')).slice(0,17);
   if(!anchors.length)throw new Error('Missing actual address-bound city detail pocket');
   const exterior=(x,z)=>r.course.coastal.buildings.every(b=>{
    const q=b.collision||{minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.z-b.depth/2,maxZ:b.z+b.depth/2};
    return x<q.minX-.35||x>q.maxX+.35||z<q.minZ-.35||z>q.maxZ+.35;
   });
   let camera,anchor,attempts=0;
   // A bounded collision/line-of-sight check selects an actual open exterior
   // camera, not an unchecked offset that can land inside the next building.
   search:for(const candidate of anchors)for(const radius of [4.5,3.5])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,Math.PI/4,Math.PI*3/4,-Math.PI/4,-Math.PI*3/4]){
    attempts++;const x=candidate.x+Math.cos(angle)*radius,z=candidate.z+Math.sin(angle)*radius;
    if(!exterior(x,z)||!engine.canStand(r.course,x/4,z/4,.22))continue;
    const y=r.vehiclePhysics.groundAt(x/4,z/4)*4+2,targetY=candidate.y+.12;
    if(structures.traceStructureSegment(r.course,{x:x/4,y:z/4,z:y/4},{x:candidate.x/4,y:candidate.z/4,z:targetY/4}))continue;
    const ray=engine.castRay(r.course,x/4,z/4,Math.atan2(candidate.z-z,candidate.x-x),radius/4+.025,y/4,(targetY-y)/radius);
    if(ray.dist*4<radius-.55)continue;
    anchor=candidate;camera={position:[x,y,z],target:[anchor.x,targetY,anchor.z],radius,exterior:true,canStand:true,structureSegmentClear:true,attempts,anchorCandidates:anchors.length,ray:{distanceMetres:ray.dist*4,obstacleId:ray.obstacleId||null},eyeAboveGround:2};break search;
   }
   if(!camera)throw new Error('Address-bound detail anchor has no safe unoccluded exterior camera in bounded fixture');
   return{wreck:{id:wreck.id,position:[wreck.x-4.7,1.55,wreck.z+3.8],target:[wreck.x,wreck.y+.85,wreck.z]},
    pocket:{id:community.id,story:community.story,parts:parts.length,grass:community.grass,props:community.props,
     anchor:{id:anchor.id,x:anchor.x,y:anchor.y,z:anchor.z,role:anchor.role},...camera}};
  });
  result.detailViews=detailViews;
  for(const [name,view]of [['city-burnt-car-close',detailViews.wreck],['city-sidewalk-detail-pocket',detailViews.pocket]]){
   await page.evaluate(view=>{const q=window.__DEAD_ARRIVAL__;if(!q.inspector.active)q.requestInspector();
    const [x,y,z]=view.position,[tx,ty,tz]=view.target;Object.assign(q.inspector.pose,{x,y,z,angle:Math.atan2(tz-z,tx-x),pitch:Math.atan2(ty-y,Math.hypot(tx-x,tz-z))});q.renderer.freeCamera=q.inspector.pose;
   },view);await shot(name);
  }
  assert.equal(result.captures.length,11);result.passed=true;
 }catch(error){
  result.failure=String(error.stack||error);
  result.failureAerial=await page.evaluate(()=>{const s=window.__CITY_LIFE_QA__;return s?{helicopter:structuredClone(s.r.vehicleFleet.helicopter),aerial:structuredClone(s.r.vehiclePhysics.aerial?.diagnostics),health:s.r.health,mode:s.r.mode,recentEvents:s.r.events.slice(-16)}:null;}).catch(()=>null);
  throw error;
 }finally{
  for(const key of ['q','w','s','a','d','Space','Control','Shift','r'])await page.keyboard.up(key).catch(()=>{});
  result.restoration=await page.evaluate(()=>{
   const s=window.__CITY_LIFE_QA__;if(!s)return;const {r,q,snapshot:p}=s;
   for(const {e,data,nav} of p.enemiesState){for(const key of Object.keys(e))if(!Object.hasOwn(data,key))delete e[key];Object.assign(e,structuredClone(data));if(nav)e.nav=structuredClone(nav);}
   r.course.enemies=p.enemies;
   for(const {v,data}of p.vehicles){for(const key of Object.keys(v))if(!Object.hasOwn(data,key))delete v[key];Object.assign(v,structuredClone(data));}
   Object.assign(r.vehicleFleet,p.fleetState);r.vehicleFleet.revision++;
   for(const key of Object.keys(p.backpack))if(!Object.hasOwn(p.backpackData,key))delete p.backpack[key];Object.assign(p.backpack,structuredClone(p.backpackData));r.backpack=p.backpack;
   for(const key of p.keys){if(p.player[key]===undefined)delete r[key];else r[key]=structuredClone(p.player[key]);}
   r.activeVehicle=p.activeVehicle;r.course.activeInterior=p.interior;
   if(q.inspector.active!==p.inspectorActive)q.requestInspector();Object.assign(q.inspector.pose,p.inspectorPose);q.renderer.freeCamera=q.inspector.active?q.inspector.pose:null;q.renderer._firstCameraFrame=true;
   const proof={player:p.keys.every(k=>JSON.stringify(r[k])===JSON.stringify(p.player[k])),playerFields:p.keys.length,enemies:r.course.enemies===p.enemies&&p.enemiesState.every(({e,data,nav})=>JSON.stringify(structuredClone(e))===JSON.stringify(data)&&JSON.stringify(e.nav)===JSON.stringify(nav)),interior:r.course.activeInterior===p.interior,activeVehicle:r.activeVehicle===p.activeVehicle};
   q.ui.hud(r,{network:null,fps:q.fps});q.packUI.update(r,{visible:r.course.scavenging,canUpgrade:true});q.renderer.render(r,performance.now());delete window.__CITY_LIFE_QA__;return proof;
  });
  await settle();assert(result.restoration.player&&result.restoration.enemies&&result.restoration.interior&&result.restoration.activeVehicle,'Exact supplemented player/coroutine/enemy/interior restoration');result.restored=true;
 }
 return result;
}
