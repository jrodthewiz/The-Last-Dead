import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.PLAYWRIGHT_PATH||'playwright');}
catch(error){
  if(process.env.PLAYWRIGHT_PATH)throw error;
  playwright=require('C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const output=process.env.EXTRACTION_CUTAWAY_OUTPUT||'output/playwright/extraction-cutaway';
const realism=process.env.HARVEST_REALISM_QA==='1';
await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.EXTRACTION_CUTAWAY_ROOT||process.cwd()+'/dist',port:0,spaFallback:false});
let browser,page,videoStarted=0;
const report={status:'RUNNING',errors:[],views:[],checks:[],input:'held KeyG',serverPort:server.port};
const save=()=>writeFile(`${output}/report.json`,JSON.stringify(report,null,2));

async function freezeAt(phase,stageProgress=.0){
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
  await page.waitForFunction(({phase,stageProgress})=>{
    const r=window.__DEAD_ARRIVAL__.run;
    if(r.extraction.phase!==phase||r.extraction.stageProgress<stageProgress)return false;
    r.mode='ready';return true;
  },{phase,stageProgress},{timeout:90000});
}
async function freezeAfter(seconds){
  const until=await page.evaluate(seconds=>{
    const r=window.__DEAD_ARRIVAL__.run;r.mode='play';return r.time+seconds;
  },seconds);
  await page.waitForFunction(until=>{
    const r=window.__DEAD_ARRIVAL__.run;if(r.time<until)return false;
    r.mode='ready';return true;
  },until,{timeout:30000});
}
async function fixture({gore=true,reducedMotion=false}={}){
  await page.keyboard.up('g');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  const data=await page.evaluate(async options=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,{castRay}=await import('./engine.js');
    const angles=Array.from({length:32},(_,i)=>i*Math.PI/16);
    const angle=angles.sort((a,b)=>castRay(r.course,r.x,r.y,b,3).dist-castRay(r.course,r.x,r.y,a,3).dist)[0];
    Object.assign(r,{mode:'play',z:0,vx:0,vy:0,vz:0,speed:0,angle,pitch:-.6,health:100,energy:100,weapon:4,
      waveDelay:1000,director:null,projectiles:[],gore:[],blood:[],tracers:[],pools:[],style:0,styleTotal:0,stylePending:84});
    r.brutal={phase:'idle',sequence:0};r.bite={phase:'idle',enemyId:null,sequence:0,cooldown:100};
    r.vermin.rats=[];r.vermin.roaches=[];r.vermin.swarm={phase:'idle',elapsed:0,duration:0,sequence:0,cooldown:1000,nextAmbientAt:1000};
    r.verminHand={phase:'idle',sequence:0};r.verminCrawl={phase:'idle',sequence:0};
    r.course.enemies=[{id:r.nextId++,kind:0,variant:'stalker',x:r.x+Math.cos(angle)*.48,y:r.y+Math.sin(angle)*.48,
      z:0,hp:0,maxHp:5,dead:true,meleeZ:0,flash:0,attack:100,phase:0,facing:angle+Math.PI,biteCooldown:100}];
    d.renderer.freeCamera=null;d.renderer.setSettings({...options,bodycam:true});d.renderer.render(r,performance.now());
    window.__cutawayId=r.course.enemies[0].id;
    return{id:window.__cutawayId,player:{x:r.x,y:r.y,angle:r.angle,pitch:r.pitch},clearance:castRay(r.course,r.x,r.y,angle,3).dist};
  },{gore,reducedMotion});
  await page.waitForFunction(()=>{
    const d=window.__DEAD_ARRIVAL__,root=d.renderer._enemyVisuals.get(window.__cutawayId)?.root;
    return !!root?.userData.afterlifeModel&&!!root.getObjectByName('Socket_Chest')&&d.renderer.brutalCombatVisuals.physics.has(root);
  });
  await freezeAfter(1.15);
  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.extractCandidateId===window.__cutawayId);
  report.fixtures??=[];report.fixtures.push({...data,gore,reducedMotion});
  console.log(`cutaway QA: settled corpse ${data.id}, gore=${gore}, reducedMotion=${reducedMotion}`);
}
async function shot(name){
  const data=await page.evaluate(async name=>{
    const d=window.__DEAD_ARRIVAL__,r=d.run,ren=d.renderer;
    r.mode='ready';window.__cutawayRender=ren.render;ren.render=()=>{};
    const T=await import('./vendor/three.module.js'),fx=ren.extractionVFX,cutaways=fx.cutaways;
    // Sample the drawing buffer in the same task as rendering. An awaited
    // import after render lets WebGL's default transient buffer be cleared.
    window.__cutawayRender.call(ren,r,performance.now());
    const state=cutaways.states.get(window.__cutawayId),root=ren._enemyVisuals.get(window.__cutawayId)?.root;
    const point=node=>node?.getWorldPosition(new T.Vector3());
    const effective=node=>{if(!node)return false;for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;};
    const chest=point(root?.getObjectByName('Socket_Chest')),abdomen=point(root?.getObjectByName('Socket_Abdomen'));
    const expected=chest&&abdomen?chest.clone().lerp(abdomen,.42):chest;
    const frame=point(state?.frame),anchor=point(state?.anchorFrame||state?.frame),physics=ren.brutalCombatVisuals.physics;
    let vertices=0,invalidVertices=0,anatomyMeshes=0,visibleMeshes=0;
    state?.frame.traverse(node=>{
      if(!node.isMesh)return;anatomyMeshes++;if(effective(node))visibleMeshes++;
      const p=node.geometry?.attributes.position;if(!p)return;
      vertices+=p.count;for(let i=0;i<p.count;i++)if(!Number.isFinite(p.getX(i))||!Number.isFinite(p.getY(i))||!Number.isFinite(p.getZ(i)))invalidVertices++;
    });
    const chain=state?.chain,bodies=chain?.bodies.map(b=>({position:[b.position.x,b.position.y,b.position.z],velocity:[b.velocity.x,b.velocity.y,b.velocity.z]}))||[];
    const maxSegmentStretch=chain?Math.max(0,...chain.lengths.map((length,i)=>chain.bodies[i].position.distanceTo(chain.bodies[i+1].position)/Math.max(.0001,length))):0;
    const mask=ren.brutalCombatVisuals.actors.get(root)?.uniforms.uHarvestOpen?.value??0;
    const surface=state?.surface;
    const surfaceEntries=(surface?.entries||[]).map(entry=>{
      const geometry=entry.geometry,p=geometry.attributes.position,side=geometry.attributes.harvestSide,local=geometry.attributes.harvestLocal;
      const affected=new Set(entry.affected);
      let invalid=0,negativeSide=0,positiveSide=0,seamVertices=0,maxDisplacement=0,movedVertices=0,unaffectedMoved=0;
      for(let i=0;i<p.count;i++){
        const values=[p.getX(i),p.getY(i),p.getZ(i),side?.getX(i),local?.getX(i),local?.getY(i),local?.getZ(i)];
        if(!values.every(Number.isFinite))invalid++;
        if(side?.getX(i)<-.5)negativeSide++;if(side?.getX(i)>.5)positiveSide++;
        if(Math.abs(local?.getX(i))<1e-5&&Math.abs(side?.getX(i))>.5)seamVertices++;
        const base=entry.basePositions;
        if(base){
          const displacement=Math.hypot(p.getX(i)-base[i*3],p.getY(i)-base[i*3+1],p.getZ(i)-base[i*3+2]);
          maxDisplacement=Math.max(maxDisplacement,displacement);
          if(displacement>1e-6){movedVertices++;if(!affected.has(i))unaffectedMoved++;}
        }
      }
      return{mesh:entry.mesh.name,sourceSkinned:!!entry.mesh.isSkinnedMesh,vertices:p.count,sideVertices:side?.count||0,localVertices:local?.count||0,
        sourceVertices:entry.basePositions?.length/3||0,invalid,negativeSide,positiveSide,seamVertices,maxDisplacement,movedVertices,unaffectedMoved,
        uv:geometry.attributes.uv?.count||0,skinIndex:geometry.attributes.skinIndex?.count||0,skinWeight:geometry.attributes.skinWeight?.count||0};
    });
    let registeredSurfaceGeometries=0;
    ren.scene.traverse(node=>{if(node.geometry?.attributes.harvestSide)registeredSurfaceGeometries++;});
    const gl=ren.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const colors=new Set();let samples=0,nonblack=0,min=255,max=0;
    for(let i=0;i<pixels.length;i+=4*47){const red=pixels[i],green=pixels[i+1],blue=pixels[i+2];samples++;if(red+green+blue>12)nonblack++;min=Math.min(min,red,green,blue);max=Math.max(max,red,green,blue);colors.add((red>>3)*1024+(green>>3)*32+(blue>>3));}
    const allMasks=[...ren.brutalCombatVisuals.actors.values()].map(s=>s.uniforms.uHarvestOpen?.value??0);
    const enemy=r.course.enemies.find(e=>e.id===window.__cutawayId);
    return{name,viewport:{width:innerWidth,height:innerHeight},time:r.time,extraction:{...r.extraction},enemy:{id:enemy?.id,extracted:!!enemy?.extracted},
      score:{total:r.styleTotal,pending:r.stylePending,extractions:r.extractions},fx:fx.diagnostics(),physics:physics.diagnostics(),
      anatomy:{states:cutaways.states.size,opening:state?.opening??0,rip:state?.rip??0,meshes:anatomyMeshes,visibleMeshes,vertices,invalidVertices,
        finiteChain:bodies.every(b=>[...b.position,...b.velocity].every(Number.isFinite)),chainPoints:bodies.length,chainBodies:bodies,maxSegmentStretch,
        frame:frame?.toArray(),anchor:anchor?.toArray(),expected:expected?.toArray(),frameError:anchor&&expected?anchor.distanceTo(expected):null,
        projected:frame?.clone().project(ren.camera).toArray(),frameVisible:effective(state?.frame),heartVisible:effective(state?.anatomy.heart),factory:state?.anatomy.diagnostics()},
      surface:{diagnostics:surface?.diagnostics()??null,entries:surfaceEntries,registeredGeometries:registeredSurfaceGeometries,
        maxMeasuredDisplacement:Math.max(0,...surfaceEntries.map(e=>e.maxDisplacement)),movedVertices:surfaceEntries.reduce((n,e)=>n+e.movedVertices,0)},
      masks:{current:mask,all:allMasks,registered:ren.brutalCombatVisuals.harvestRoots.size},
      tissueMaterials:state?.tissueMaterials?.diagnostics()??null,
      seamLayers:state?.surface.edgeGeometry.attributes.tissueRegion?.count??0,
      tools:{flowBeadVisible:effective(fx.flowBead),jaws:fx.forceps.children.filter(n=>n.name.endsWith('Jaw')).length},
      pixels:{width:w,height:h,samples,nonblackFraction:nonblack/Math.max(1,samples),uniqueColors:colors.size,min,max},
      render:{calls:ren.renderer.info.render.calls,triangles:ren.renderer.info.render.triangles,memory:{...ren.renderer.info.memory}},
      gunVisible:ren.weaponGroups.some(g=>g.visible),prompt:document.querySelector('[data-extraction-prompt]')?.innerText};
  },name);
  try{await page.screenshot({path:`${output}/${name}.png`});}
  finally{await page.evaluate(()=>{window.__DEAD_ARRIVAL__.renderer.render=window.__cutawayRender;});}
  report.views.push(data);await save();
  console.log(`cutaway QA: ${name}, phase=${data.extraction.phase}, opening=${data.anatomy.opening.toFixed(3)}, chains=${data.physics.tissueChains}`);
  return data;
}
function visibleAnatomy(view){
  assert(view.anatomy.states>0&&view.anatomy.frameVisible,`${view.name}: persistent anatomy is visible`);
  assert(view.anatomy.visibleMeshes>=8,`${view.name}: multiple anatomical structures are visible`);
  assert(view.anatomy.vertices>100&&view.anatomy.invalidVertices===0,`${view.name}: procedural vertices are finite`);
  assert(view.anatomy.frameError<1e-5,`${view.name}: anatomy follows the final posed torso sockets`);
  assert(view.pixels.uniqueColors>8&&view.pixels.nonblackFraction>.005,`${view.name}: canvas contains varied scene pixels`);
  const surface=view.surface,receipt=surface.diagnostics;
  assert(receipt&&receipt.sourceTriangles>0&&receipt.splitTriangles>receipt.sourceTriangles,`${view.name}: actual source triangles are procedurally split`);
  assert(receipt.seamVertices>=4&&receipt.affectedVertices>0,`${view.name}: paired source-skin seam vertices are registered`);
  assert(surface.entries.length>0&&surface.entries.every(e=>e.sourceSkinned&&e.sourceVertices===e.vertices&&e.sideVertices===e.vertices&&e.localVertices===e.vertices&&e.invalid===0),`${view.name}: deformed source mesh retains finite seam attributes and complete base vertices`);
  assert(surface.entries.every(e=>e.uv===e.vertices&&e.skinIndex===e.vertices&&e.skinWeight===e.vertices),`${view.name}: split source triangles preserve interpolated UVs and skinning`);
  assert(surface.entries.reduce((n,e)=>n+e.negativeSide,0)>0&&surface.entries.reduce((n,e)=>n+e.positiveSide,0)>0,`${view.name}: both sides of the source incision exist`);
  assert(surface.movedVertices>0&&surface.maxMeasuredDisplacement>1e-5&&receipt.maxDisplacement>1e-5,`${view.name}: actual source positions retract from their preserved base geometry`);
  assert(surface.entries.every(e=>e.unaffectedMoved===0),`${view.name}: source vertices outside the cut stay unchanged`);
  if(realism){assert.equal(view.tissueMaterials?.status,'ready',`${view.name}: native imagegen assets loaded`);assert.equal(view.tissueMaterials.textures,2);assert.equal(view.tissueMaterials.parallaxSteps,8);assert(view.seamLayers>view.surface.diagnostics.seamVertices*3,'the source edge has real layered thickness');assert.equal(view.tools.flowBeadVisible,false,'no large flow bead obscures exposed organs');assert.equal(view.tools.jaws,2);assert(view.anatomy.maxSegmentStretch<1.21,'the rendered physical intestine retains its contour length');}
}

try{
  browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
  videoStarted=Date.now();page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,...(realism?{recordVideo:{dir:`${output}/video`,size:{width:1280,height:720}}}:{})});page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{const error=r.failure()?.errorText;if(error!=='net::ERR_ABORTED')report.errors.push(`${error} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${server.port}/?debug=1&sector=0`,{waitUntil:'networkidle'});
  console.log('cutaway QA: local page loaded; waiting for imported actor and arm assets');
  await page.waitForFunction(()=>{
    const r=window.__DEAD_ARRIVAL__?.renderer;
    return !!r?._ashWitnessAsset&&r._survivors?.status==='ready'&&r.brutalCombatVisuals?.status==='ready';
  });
  // Headless Chrome can leave the optional compileAsync warmup unresolved.
  // Match the established extraction harness after actual GLTF/arm readiness;
  // every geometry, shader, physics and real-input check still runs normally.
  await page.evaluate(()=>{
    const renderer=window.__DEAD_ARRIVAL__.renderer;
    // Headless warmup polling can race fixture disposal while looking up a
    // pending WebGLProgram.isReady. Actual renders still compile every shader.
    renderer.renderer.compileAsync=async()=>{};
    renderer._weaponsPrepared=true;
  });
  console.log('cutaway QA: actual imported assets ready; optional shader warmup gate released');
  if(realism)await page.evaluate(async()=>{const {harvestTissueTexturesReady}=await import('./extraction-tissue-materials.js');const assets=await harvestTissueTexturesReady();if(assets.status!=='ready')throw new Error('Imagegen tissue atlas/height failed to load');});
  await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  await page.locator('#world').click();await page.waitForFunction(()=>document.pointerLockElement===document.querySelector('#world'));
  console.log('cutaway QA: play screen and real pointer lock ready');
  await fixture();await shot('01-ready-corpse');
  await page.keyboard.down('g');await freezeAt('draw',.22);let view=await shot('02-blood-draw');
  assert.equal(view.score.total,0);assert.equal(view.gunVisible,false);
  await freezeAt('incise',.5);view=await shot('03-progressive-incision');visibleAnatomy(view);
  const partial=view.anatomy.opening,partialDisplacement=view.surface.maxMeasuredDisplacement;assert(partial>.3&&partial<.9);assert.equal(view.score.total,0);
  await freezeAt('rip',.55);view=await shot('04-organs-and-physical-intestines');visibleAnatomy(view);
  assert(view.anatomy.opening>partial);assert(view.physics.tissueChains>=1);assert(view.anatomy.chainPoints>=2&&view.anatomy.finiteChain);
  assert(view.surface.maxMeasuredDisplacement>partialDisplacement, 'the actual source seam retracts farther as G advances from incision to rip');
  assert.equal(view.score.total,0);report.checks.push('held KeyG advances draw, procedurally splits and retracts the actual weighted source mesh, and exposes organs with a constrained intestine chain');
  await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
  await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__.run;if(!r.course.enemies.find(e=>e.id===window.__cutawayId)?.extracted)return false;r.mode='ready';return true;});
  await page.keyboard.up('g');view=await shot('05-extraction-complete');visibleAnatomy(view);
  assert(view.enemy.extracted&&view.score.total>0);assert.equal(view.score.pending,0);assert.equal(view.score.extractions,1);
  assert(view.physics.drops>=1&&view.fx.anatomy.heartsDropped>=1);report.checks.push('completion banks the reward once and releases the procedural heart into existing corpse physics');
  await freezeAfter(1.2);view=await shot('06-persistent-aftermath');visibleAnatomy(view);assert.equal(view.fx.active,false);
  assert(view.anatomy.opening>.9&&view.anatomy.finiteChain);report.checks.push('the cut and exposed anatomy remain after the foreground extraction effect expires');

  report.tracking=await page.evaluate(async()=>{
    const d=window.__DEAD_ARRIVAL__,ren=d.renderer,T=await import('./vendor/three.module.js'),state=ren.extractionVFX.cutaways.states.get(window.__cutawayId);
    const anchor=state.anchorFrame||state.frame,before=anchor.getWorldPosition(new T.Vector3()),rootBefore=state.body.position.clone();
    const rig=ren.brutalCombatVisuals.physics.get(state.body);for(const node of rig.nodes){node.body.position.x+=.17;node.body.aabbNeedsUpdate=true;}
    ren.brutalCombatVisuals.physics.sync();ren.render(d.run,performance.now());
    const after=anchor.getWorldPosition(new T.Vector3()),chest=state.body.getObjectByName('Socket_Chest').getWorldPosition(new T.Vector3()),abdomen=state.body.getObjectByName('Socket_Abdomen').getWorldPosition(new T.Vector3());
    return{before:before.toArray(),after:after.toArray(),moved:after.distanceTo(before),expectedError:after.distanceTo(chest.lerp(abdomen,.42)),rootMovement:state.body.position.distanceTo(rootBefore)};
  });
  assert(report.tracking.moved>.1&&report.tracking.expectedError<1e-5);assert.equal(report.tracking.rootMovement,0);
  // The tracking probe deliberately teleports the complete ragdoll 17 cm.
  // Resume fixed ticks before asserting chain lengths: the dynamic bowel
  // needs normal solver time to follow its suddenly displaced torso anchor.
  await freezeAfter(.45);
  await shot('07-physical-torso-tracking');report.checks.push('moving the ragdoll pelvis and torso moves the anatomical attachment while the gameplay root stays fixed');

  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.setSettings({gore:false}));view=await shot('08-gore-off');
  assert.equal(view.fx.anatomy.visible,0);assert.equal(view.anatomy.visibleMeshes,0);assert.equal(view.anatomy.heartVisible,false);assert.equal(view.masks.current,0);
  assert.equal(view.surface.diagnostics?.maxDisplacement,0);assert(view.surface.maxMeasuredDisplacement<1e-7,'gore-off restores every source position to its preserved base');
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer.setSettings({gore:true}));view=await shot('09-gore-restored');visibleAnatomy(view);
  report.checks.push('gore-off hides the exposed anatomy and restores intact source skin; switching gore back restores the stored cut');
  await page.setViewportSize({width:390,height:844});view=await shot('10-mobile-aftermath');visibleAnatomy(view);
  report.checks.push('portrait 390 × 844 viewport renders the persistent cutaway and varied canvas pixels');
  await page.setViewportSize({width:1280,height:720});

  await fixture({reducedMotion:true});await page.keyboard.down('g');await freezeAt('incise',.5);await shot('11-reduced-motion-incision');
  await freezeAt('rip',.55);view=await shot('12-reduced-motion-physical-intestines');visibleAnatomy(view);assert(view.physics.tissueChains>=1);
  report.checks.push('reduced motion preserves the deterministic cut and local tissue physics');
  await page.keyboard.up('g');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
  await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__.run;if(r.extraction.phase!=='idle')return false;r.mode='ready';return true;});

  await fixture();await page.keyboard.down('g');await freezeAt('incise',.5);view=await shot('13-cancel-before-release');const cancelOpening=view.anatomy.opening,cancelDisplacement=view.surface.maxMeasuredDisplacement,cancelWorldDisplacement=view.surface.diagnostics.maxDisplacement;
  await page.keyboard.up('g');await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
  await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__.run;if(r.extraction.phase!=='idle'||r.extraction.cancelReason!=='released')return false;r.mode='ready';return true;});
  view=await shot('14-cancelled-partial-cut');visibleAnatomy(view);assert.equal(view.score.total,0);assert.equal(view.score.extractions,0);assert.equal(view.enemy.extracted,false);
  assert(Math.abs(view.anatomy.opening-cancelOpening)<1e-6);
  // Inverse weighted skinning can change bind-space displacement as bones
  // settle. The retained incision is defined by its posed world-space gap.
  assert(Math.abs(view.surface.diagnostics.maxDisplacement-cancelWorldDisplacement)<1e-6);
  assert(view.surface.maxMeasuredDisplacement>cancelDisplacement*.99,'the source skin stays retracted after cancellation');
  report.checks.push('releasing G retains the actual partially retracted source geometry and awards no extraction points');

  await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
  view=await shot('15-restart-clean');assert.equal(view.anatomy.states,0);assert.equal(view.physics.tissueChains,0);assert.equal(view.physics.drops,0);
  assert.equal(view.masks.registered,0);assert(view.masks.all.every(value=>value===0));
  assert.equal(view.surface.diagnostics,null);assert.equal(view.surface.entries.length,0);assert.equal(view.surface.registeredGeometries,0);
  report.checks.push('restart removes anatomy, tissue particles, organ bodies, and harvest masks');
  if(realism){
    await fixture();report.motion={videoApproximateStartSeconds:(Date.now()-videoStarted)/1000,continuousHeldG:true};await page.keyboard.down('g');
    await page.evaluate(()=>{window.__DEAD_ARRIVAL__.run.mode='play';});
    await page.waitForFunction(()=>{const r=window.__DEAD_ARRIVAL__.run;if(!r.course.enemies.find(e=>e.id===window.__cutawayId)?.extracted)return false;r.mode='ready';return true;},{},{timeout:60000});
    await page.keyboard.up('g');view=await shot('16-continuous-harvest-complete');visibleAnatomy(view);
    await freezeAfter(.9);view=await shot('17-continuous-harvest-aftermath');visibleAnatomy(view);
    report.motion.videoApproximateEndSeconds=(Date.now()-videoStarted)/1000;
    await page.evaluate(()=>window.__DEAD_ARRIVAL__.begin(false));await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play');
    view=await shot('18-motion-restart-clean');assert.equal(view.anatomy.states,0);assert.equal(view.physics.tissueChains,0);assert.equal(view.physics.drops,0);
    report.checks.push('a separate uninterrupted held-G journey records natural incision, gut spill and heart release for visual motion review');
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';await save();
  console.log(JSON.stringify({status:report.status,views:report.views.length,checks:report.checks,tracking:report.tracking,errors:report.errors},null,2));
}catch(error){
  report.status='FAIL';report.failure=error.stack||String(error);
  if(page){report.current=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__?.screen,mode:window.__DEAD_ARRIVAL__?.run?.mode,extraction:window.__DEAD_ARRIVAL__?.run?.extraction})).catch(()=>null);await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});}
  await save();throw error;
}finally{
  await browser?.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));
}
