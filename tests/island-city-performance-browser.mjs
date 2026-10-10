import assert from 'node:assert/strict';

export async function profileCityFrame(page,result={}){
 Object.assign(result,await page.evaluate(async()=>{
  const q=window.__DEAD_ARRIVAL__,qa=window.__HORROR_QA__,g=q.renderer,r=q.run,renderer=g.renderer;
  const prior={manual:qa.manual,render:g.render,auto:renderer.info.autoReset,player:{x:r.x,y:r.y,z:r.z,angle:r.angle,pitch:r.pitch,vx:r.vx,vy:r.vy,vz:r.vz,speed:r.speed,slide:r.slide,supportZ:r.supportZ,supportId:r.supportId,structureId:r.structureId}};
  qa.setManual(true);if(q.inspector.active)q.requestInspector();
  Object.assign(r,{x:58,y:58,z:0,angle:Math.atan2(112-232,192-232),pitch:0,supportZ:null,supportId:null,structureId:null});g._firstCameraFrame=true;g.render=()=>{};renderer.info.autoReset=false;
  const submit=[],fenced=[],draws=[],triangles=[],owners=new Map(),shadowCameras=new Map(),componentRows=new Map(),componentRestores=[];
  let componentFrame={};
  for(const [owner,key,label]of [[g.scene,'updateMatrixWorld','scene matrix propagation'],[renderer,'render','native render (nested full passes)'],[g,'_renderScene','full scene and post path'],[g.harborWorld,'update','harbor world visuals'],[g,'_updateEnemies','enemy visuals']]){
   if(typeof owner?.[key]!=='function')continue;const original=owner[key];owner[key]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{componentFrame[label]=(componentFrame[label]||0)+performance.now()-t;}};componentRestores.push(()=>owner[key]=original);componentRows.set(label,[]);
  }
  g.scene.traverse(o=>{if(o.isLight&&o.castShadow)shadowCameras.set(o.shadow.camera.uuid,o.name||o.type);});
  const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{min:s[0],p50:s[Math.floor(s.length/2)],p95:s[Math.ceil(s.length*.95)-1],max:s.at(-1)};};
  try{
   for(let i=0;i<26;i++){
    await new Promise(requestAnimationFrame);await renderer.backend.device.queue.onSubmittedWorkDone();renderer.info.reset();
    componentFrame={};const t=performance.now();prior.render.call(g,r,t);const cpu=performance.now()-t;await renderer.backend.device.queue.onSubmittedWorkDone();
    if(i>=6){for(const [label,rows]of componentRows)rows.push(componentFrame[label]||0);submit.push(cpu);fenced.push(performance.now()-t);draws.push(renderer.info.render.drawCalls);triangles.push(renderer.info.render.triangles);}
   }
   const cameraProjection={near:g.camera.near,far:g.camera.far,coordinateSystem:g.camera.coordinateSystem,reversedDepth:g.camera.reversedDepth,projectionMatrix:g.camera.projectionMatrix.toArray(),matrixWorld:g.camera.matrixWorld.toArray()};
   const backend=renderer.backend,draw=backend.draw;
   backend.draw=function(ro,info){const beforeD=info.render.drawCalls,beforeT=info.render.triangles,value=draw.call(this,ro,info),o=ro.object;
    const names=[];for(let p=o;p&&names.length<6;p=p.parent)if(p.name)names.push(p.name);
    const pass=shadowCameras.has(ro.camera.uuid)?'shadow:'+shadowCameras.get(ro.camera.uuid):ro.context.color===false?'depth':'color';
    const key=pass+' / '+(o.name||o.type)+' / '+(names.at(-1)||'unnamed'),row=owners.get(key)||{key,draws:0,triangles:0};row.draws+=info.render.drawCalls-beforeD;row.triangles+=info.render.triangles-beforeT;owners.set(key,row);return value;
   };
   try{renderer.info.reset();prior.render.call(g,r,performance.now());await renderer.backend.device.queue.onSubmittedWorkDone();}finally{backend.draw=draw;}
   // Keep the render comparison camera fixed. The separate engine-only probe
   // selects a legal quiet site against the actual aged resident positions.
   const {canStand}=await import('/engine.js'),live=r.course.enemies.filter(e=>!e.dead);
   const sites=[[232,112],[232,176],[232,232],[220,112],[244,176],[240,232]].map(([x,z])=>({x:x/4,y:z/4}))
    .filter(p=>!r.course.coastal.blackwaterSlice.buildings.some(b=>Math.abs(p.x*4-b.x)<b.width/2+1&&Math.abs(p.y*4-b.z)<b.depth/2+1))
    .filter(p=>canStand(r.course,p.x,p.y,.12)&&(!r.vehiclePhysics||r.vehiclePhysics.stand(p.x,p.y,.12)))
    .map(p=>({...p,nearestResidentMetres:Math.min(...live.map(e=>Math.hypot(e.x-p.x,e.y-p.y)*4))})).sort((a,b)=>b.nearestResidentMetres-a.nearestResidentMetres);
   if(!sites.length)throw new Error('No legal engine-only profiling site');
   Object.assign(r,{x:sites[0].x,y:sites[0].y,z:0,vx:0,vy:0,vz:0,speed:0,slide:0,supportZ:null,supportId:null,structureId:null});
   const profileStart={runTime:r.time,physicsSite:sites[0],health:r.health,mindStates:r.course.enemies.reduce((counts,e)=>(counts[e.mind?.state||'legacy']=(counts[e.mind?.state||'legacy']||0)+1,counts),{}),ai:structuredClone(r.enemyAIDiagnostics||null)};
   const physics=[],physicsFrames=[];profileStart.physicsFrames=physicsFrames;const before={time:r.time,foot:r.vehicleFleet.diagnostics.footQueries,ray:r.vehicleFleet.diagnostics.rayQueries};
   for(let i=0;i<8;i++){const t=performance.now();window.advanceTime(100);physics.push(performance.now()-t);physicsFrames.push({time:r.time,player:[r.x*4,r.y*4,r.z],health:r.health,nearestResidentMetres:Math.min(...live.map(e=>Math.hypot(e.x-r.x,e.y-r.y)*4)),events:structuredClone(r.events.filter(e=>['damage','bite-damage','enemy-attack'].includes(e.type)))});}
   return{scope:'20 warm paused actual full-render submissions and queue fences at the v78 live camera, plus one instrumented draw census and eight real100ms engine advances with render held. CPU/GPU queue diagnostic, not gameplay FPS or GPU timestamps.',position:[232,232],cameraProjection,profileStart,renderCounterScope:g.harborWorld?.blackwater?.bundleDiagnostics?.enabled?'Native direct encoder draw/triangle counters exclude cached opaque bundle replay; no claim of removed geometry.':'Native direct encoder draw/triangle counters; no cached building bundle.',buildingBundleDiagnostics:structuredClone(g.harborWorld?.blackwater?.bundleDiagnostics||null),componentCPUMs:Object.fromEntries([...componentRows].map(([label,rows])=>[label,stats(rows)])),componentScope:'Nested CPU timings overlap; do not add them. Instrumented functions restored.',cpuSubmitMs:stats(submit),queueFencedMs:stats(fenced),drawCalls:stats(draws),triangles:stats(triangles),drawOwners:[...owners.values()].sort((a,b)=>b.draws-a.draws),physics100msCPU:stats(physics),physics:{simulatedSeconds:r.time-before.time,footQueries:r.vehicleFleet.diagnostics.footQueries-before.foot,rayQueries:r.vehicleFleet.diagnostics.rayQueries-before.ray,health:r.health}};
  }finally{for(const restore of componentRestores)restore();g.render=prior.render;renderer.info.autoReset=prior.auto;Object.assign(r,prior.player);qa.setManual(prior.manual);}
 }));return result;
}

// Live main-RAF measurement only. No launch, advanceTime, synthetic population,
// manual engine stepping, shadow changes or forced GPU waits in the sample.
export async function verifyCityPerformance(page,settle,result={}){
 Object.assign(result,{scope:'Eight seconds stationary exterior live main RAF after two seconds settling; existing56 residents. CPU frame intervals and submitted counters, not GPU execution timing, physical VRAM, co-op or all-scene FPS.',settleMs:2000,sampleMs:8000,passed:false});
 try{
  const measurement=await page.evaluate(async()=>{
   const q=window.__DEAD_ARRIVAL__,qa=window.__HORROR_QA__;
   if(!q||!qa||window.__CITY_PERFORMANCE_QA__)throw new Error('Missing live QA owner or overlapping performance sample');
   const r=q.run,g=q.renderer;
   if(q.screen!=='play'||r.mode!=='play'||!Number.isFinite(r.health)||r.health<=0||q.session?.connected)throw new Error('Performance start requires original living solo play');
   if(!r.course.coastal||r.course.enemies.length!==56)throw new Error('Expected unchanged existing56 resident population');
   if(r.vehicleFleet?.vehicles.some(v=>v.occupied))throw new Error('Performance sample requires original on-foot state');
   const {canStand}=await import('/engine.js'),{groundAt}=await import('/coastal-terrain.js');
   const keys=['x','y','z','angle','pitch','vx','vy','vz','supportZ','supportId','structureId','health','energy','damage','shot','speed','slide','dashTime','mode'];
   const prior={player:Object.fromEntries(keys.map(k=>[k,structuredClone(r[k])])),manual:qa.manual,inspector:q.inspector.active,pose:{...q.inspector.pose},freeCamera:g.freeCamera,firstCamera:g._firstCameraFrame,render:g.render};
   const state={q,r,g,qa,prior,keys};window.__CITY_PERFORMANCE_QA__=state;
   const candidates=[[232,112],[232,176],[232,232],[220,112],[244,176],[240,232]],live=r.course.enemies.filter(e=>!e.dead);
   const sites=candidates.map(([x,z])=>({x:x/4,y:z/4})).filter(p=>!r.course.coastal.blackwaterSlice.buildings.some(b=>Math.abs(p.x*4-b.x)<b.width/2+1&&Math.abs(p.y*4-b.z)<b.depth/2+1))
    .filter(p=>canStand(r.course,p.x,p.y,.12)&&(!r.vehiclePhysics||r.vehiclePhysics.stand(p.x,p.y,.12)))
    .map(p=>({...p,nearestResidentMetres:Math.min(...live.map(e=>Math.hypot(e.x-p.x,e.y-p.y)*4))})).sort((a,b)=>b.nearestResidentMetres-a.nearestResidentMetres);
   if(!sites.length)throw new Error('No legal bounded exterior performance start');
   const start=sites[0],support=groundAt(r.course,start.x,start.y);
   if(!Number.isFinite(support))throw new Error('Nonfinite actual ground support');
   if(q.inspector.active)q.requestInspector();
   Object.assign(r,{x:start.x,y:start.y,z:0,angle:Math.atan2(112-start.y*4,192-start.x*4),pitch:0,vx:0,vy:0,vz:0,slide:0,dashTime:0,speed:0,supportZ:null,supportId:null,structureId:null});g._firstCameraFrame=true;
   const originalEnemyArray=r.course.enemies,originalEnemyIds=originalEnemyArray.map(e=>e.id);
   const frames=[],begin=performance.now();let last=null,failure=null;
   const valid=()=>{
    if(q.screen!=='play'||r.mode!=='play'||r.health<=0)return `Live sample stopped: screen=${q.screen} mode=${r.mode} health=${r.health}`;
    if(r.health!==prior.player.health)return 'Quiet live sample changed the original health';
    if(qa.manual||q.inspector.active)return 'Live sample became manual or inspector active';
    if(q.run!==r||r.course.enemies!==originalEnemyArray)return 'Live world/population owner changed';
    if(r.course.enemies.length!==56||r.course.enemies.some((e,i)=>e.id!==originalEnemyIds[i]))return 'Existing resident population IDs changed';
    return null;
   };
   g.render=function(run,...args){
    let value;try{value=prior.render.call(this,run,...args);}catch(error){failure ||= `Native render failed: ${String(error)}`;throw error;}
    if(run===r){const now=performance.now(),age=now-begin;failure ||= valid();
     if(age>=2000&&age<=10000){
      const ai=r.enemyAIDiagnostics,crowd=g._crowdDiagnostics,counts=g.renderer.info.render;
      if(!ai||!crowd)failure ||= 'Missing actual frame AI/crowd counters';
      if(ai?.navLimit!==4||ai.navSearches>4)failure ||= 'Actual frame exceeded or changed navLimit4';
      if(frames.length>=4096)failure ||= 'Bounded performance sample exceeded4096frames';
      else frames.push({atMs:age,intervalMs:last===null?null:now-last,drawCalls:counts.drawCalls,triangles:counts.triangles,navSearches:ai?.navSearches,navLimit:ai?.navLimit,
       visible:crowd?.visible,culled:crowd?.culled,animated:crowd?.animated,staggered:crowd?.staggered,health:r.health,mode:r.mode,runTime:r.time});
      last=now;
     }
    }return value;
   };
   qa.setManual(false);
   let watchdog;
   try{
    await new Promise(resolve=>{watchdog=setTimeout(()=>{failure ||= 'Live RAF watchdog exceeded30seconds';resolve();},30000);const observe=()=>{failure ||= valid();if(failure||performance.now()-begin>=10000)resolve();else requestAnimationFrame(observe);};requestAnimationFrame(observe);});
   }finally{clearTimeout(watchdog);}
   const intervals=frames.map(f=>f.intervalMs).filter(v=>Number.isFinite(v)&&v>0),sorted=[...intervals].sort((a,b)=>a-b);
   const percentile=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]:null;
   const range=k=>{const values=frames.map(f=>f[k]).filter(Number.isFinite);return values.length?[Math.min(...values),Math.max(...values)]:null;};
   if(intervals.length<2)failure ||= 'Insufficient actual rendered live frames';
   if(frames.length&&frames.at(-1).atMs-frames[0].atMs<7500)failure ||= 'Rendered live sample did not cover the eight-second window';
   if(frames.length&&frames.at(-1).runTime<=frames[0].runTime)failure ||= 'Engine time did not advance during live sample';
   return {start:{...start,groundCells:support,health:prior.player.health},frames,renderCounterScope:g.harborWorld?.blackwater?.bundleDiagnostics?.enabled?'Native direct encoder counters exclude cached opaque building bundle replay.':'Native direct encoder counters without cached building bundle.',buildingBundleDiagnostics:structuredClone(g.harborWorld?.blackwater?.bundleDiagnostics||null),renderedFrames:frames.length,intervalSamples:intervals.length,
    measuredSpanMs:intervals.reduce((a,b)=>a+b,0),averageFps:intervals.length?1000*intervals.length/intervals.reduce((a,b)=>a+b,0):null,
    p50IntervalMs:percentile(.5),p95IntervalMs:percentile(.95),drawCallsRange:range('drawCalls'),trianglesRange:range('triangles'),navSearchesRange:range('navSearches'),navLimitRange:range('navLimit'),
    crowd:{visible:range('visible'),culled:range('culled'),animated:range('animated'),staggered:range('staggered')},healthRange:range('health'),failure,passed:!failure};
  });
  Object.assign(result,measurement);assert.equal(measurement.failure,null,measurement.failure||'Live sample failed');assert(measurement.passed);
 }catch(error){result.failure ||= String(error.stack||error);throw error;
 }finally{
  result.restoration=await page.evaluate(()=>{
   const s=window.__CITY_PERFORMANCE_QA__;if(!s)return {snapshotPresent:false};const {q,r,g,qa,prior:p,keys}=s;
   qa.setManual(true);g.render=p.render;
   for(const k of keys){if(p.player[k]===undefined)delete r[k];else r[k]=structuredClone(p.player[k]);}
   if(q.screen==='pause')q.resume();
   if(q.inspector.active!==p.inspector&&q.screen==='play')q.requestInspector();if(q.inspector.pose&&p.pose)Object.assign(q.inspector.pose,p.pose);g.freeCamera=p.freeCamera;g._firstCameraFrame=p.firstCamera;
   qa.setManual(p.manual);const proof={snapshotPresent:true,manual:qa.manual===p.manual,inspector:q.inspector.active===p.inspector,player:keys.every(k=>JSON.stringify(r[k])===JSON.stringify(p.player[k])),render:g.render===p.render,screen:q.screen};
   delete window.__CITY_PERFORMANCE_QA__;return proof;
  }).catch(error=>({failure:String(error)}));
  await settle();
 }
 assert(result.restoration.manual&&result.restoration.inspector&&result.restoration.player&&result.restoration.render,'Exact manual/inspector/player/render restoration');return result;
}
