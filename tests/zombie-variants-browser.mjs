import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.ZOMBIE_VARIANT_OUTPUT||'output/playwright/zombie-variants';
await mkdir(output,{recursive:true});
const server=await startServer({root:process.env.ZOMBIE_QA_ROOT||process.cwd(),port:0,spaFallback:false});
const baseUrl=`http://127.0.0.1:${server.port}`;
// Reuse the established studio's lighting, real simulation, and measured pose
// pass. Extract only its HTML; do not execute its browser/server orchestration.
// Fail explicitly if that fixture's contract changes.
const source=await readFile(new URL('./zombie-horde-browser.mjs',import.meta.url),'utf8');
const studio=source.match(/const fixture=String\.raw`([\s\S]*?)`;/)?.[1];
assert(studio,'existing zombie studio HTML remains available');
const marker='window.__ZOMBIE_HORDE_QA__=q;';
assert(studio.includes(marker)&&studio.includes('model.createAfterlifeModel(asset,e.kind,e.id)'), 'studio template-selection contract');
const extension=String.raw`
const {GENERATED_ZOMBIE_APPEARANCES,ZOMBIE_APPEARANCES}=await import('/zombie-appearances.js');
const articulation=await import('/character-articulation.js');
const counters=await import('/brutal-combat-visuals.js');
const {disposeObject}=await import('/renderer.js');
// Dispose each studio clone fully, while the real source geometry/atlases
// remain shared. Otherwise discarded close-pose bone textures inflate the
// final crowd memory snapshot.
q.clear=()=>{for(const root of q.roots){scene.remove(root);model.disposeAfterlifeModel(root);disposeObject(root);}q.roots=[];q.enemies=[];};
q.assets=new Map([['ash-witness',asset]]);q.intake=[];
q.sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
q.moduleHashes={};for(const path of ['renderer.js','blackwater-actor-style.js','zombie-appearances.js','npc-afterlife-model.js','engine.js','zombie-behavior.js']){const response=await fetch('/'+path);if(!response.ok)throw Error('Module hash request failed '+path);q.moduleHashes[path]=await q.sha(await response.arrayBuffer());}
for(const descriptor of GENERATED_ZOMBIE_APPEARANCES){
 const loader=new GLTFLoader(),parse=loader.parseAsync.bind(loader);let sha256,bytes;
 loader.parseAsync=async(data,path)=>{sha256=await q.sha(data);bytes=data.byteLength;return parse(data,path);};
 const loaded=await model.loadAfterlifeModel(loader,descriptor.url);loaded.appearance=descriptor.id;loaded.appearancePalette=descriptor.palette;q.assets.set(descriptor.id,loaded);
 const meshes=[],materials=[],textures=new Set();
 loaded.template.traverse(object=>{if(!object.isMesh)return;meshes.push(object);for(const material of Array.isArray(object.material)?object.material:[object.material])if(material&&!materials.includes(material))materials.push(material);});
 const geometryHashes=[];for(const mesh of meshes)geometryHashes.push(await q.sha(mesh.geometry.attributes.position.array));
 const textureHashes=[];
 for(const material of materials)for(const slot of ['map','normalMap','roughnessMap','metalnessMap']){
  const texture=material[slot];if(!texture||textures.has(texture))continue;textures.add(texture);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.drawImage(texture.image,0,0,64,64);const pixels=ctx.getImageData(0,0,64,64).data;
  textureHashes.push({slot,width:texture.image.width,height:texture.image.height,sha256:await q.sha(pixels),colors:new Set(Array.from({length:4096},(_,i)=>(pixels[i*4]>>4)+','+(pixels[i*4+1]>>4)+','+(pixels[i*4+2]>>4))).size});
 }
 const chains=[];for(const side of ['Left','Right'])for(const names of [[side+'Arm',side+'ForeArm',side+'Hand'],[side+'UpLeg',side+'Leg',side+'Foot']]){const bones=names.map(name=>loaded.template.getObjectByName(name));chains.push({names,present:bones.every(Boolean),connected:bones.every((bone,i)=>i===0||bone?.parent===bones[i-1])});}
 q.intake.push({id:descriptor.id,url:descriptor.url,sha256,bytes,clips:loaded.clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),meshes:meshes.map(m=>({name:m.name,skinned:m.isSkinnedMesh,vertices:m.geometry.attributes.position.count,triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3,bones:m.skeleton?.bones.length||0})),geometryHashes,textures:textureHashes,materials:materials.map(m=>({name:m.name,roughness:m.roughness,metalness:m.metalness,hasAlbedo:!!m.map,hasNormal:!!m.normalMap})),chains});
}
q.selectedId=GENERATED_ZOMBIE_APPEARANCES[0].id;
const makeEnemy=q.enemy;q.enemy=(...args)=>{const e=makeEnemy(...args);e.appearance=args[1]>=54000?GENERATED_ZOMBIE_APPEARANCES[(args[1]-54000)%3].id:q.selectedId;return e;};
q.select=id=>{if(!q.assets.has(id))throw Error('Unknown fixture identity '+id);q.selectedId=id;};
const showMotion=q.show;q.show=(motion,contortion=0)=>{const result=showMotion(motion,contortion);document.getElementById('caption').innerHTML=q.selectedId.toUpperCase()+' / '+motion.toUpperCase()+(contortion?' / CONTORT':'')+'<small>Actual generated skin · production distance-driven animation</small>';return result;};
q.bodyBounds=root=>{
 root.updateMatrixWorld(true);const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity),point=new THREE.Vector3();let vertices=0,invalid=0;
 root.userData.afterlife.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).sub(root.position);if(!point.toArray().every(Number.isFinite)){invalid++;continue;}min.min(point);max.max(point);vertices++;}});
 return {min:min.toArray(),max:max.toArray(),size:max.clone().sub(min).toArray(),vertices,invalid};
};
q.weightedPoints=(root,boneName)=>{
 root.updateMatrixWorld(true);const points=[];root.userData.afterlife.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const bone=mesh.skeleton.bones.findIndex(b=>b.name===boneName);if(bone<0)return;mesh.skeleton.update();const p=mesh.geometry.attributes.position,j=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;let sampled=0;for(let i=0;i<p.count&&sampled<128;i++){let sum=0;for(let k=0;k<4;k++)if(j.getComponent(i,k)===bone)sum+=w.getComponent(i,k);if(sum<.20)continue;const point=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(root.position);points.push({mesh:mesh.name,index:i,point:point.toArray()});sampled++;}});return points;
};
q.rigProof=()=>{
 const root=q.root,state=root.userData.afterlife,source=q.assets.get(q.selectedId).template;
 const original=source.getObjectByName('Hips').quaternion.toArray();
 articulation.restoreCharacterArticulation(state.articulation);articulation.applyCharacterArticulation(state.articulation,{jawOpen:0,leftGrip:0,rightGrip:0});
 const neutralJaw=q.weightedPoints(root,'Jaw'),neutralGrip=q.weightedPoints(root,'LeftGrip');
 articulation.restoreCharacterArticulation(state.articulation);articulation.applyCharacterArticulation(state.articulation,{jawOpen:1,leftGrip:1,rightGrip:1});
 const openedJaw=q.weightedPoints(root,'Jaw'),closedGrip=q.weightedPoints(root,'LeftGrip');
 const movement=(a,b)=>a.length===b.length&&a.length?Math.max(...a.map((v,i)=>Math.hypot(...v.point.map((n,k)=>n-b[i].point[k])))):0;
 const result={appearance:state.appearance,sourceTemplateMatches:state.sourceTemplate===source,jawVertices:neutralJaw.length,gripVertices:neutralGrip.length,jawDisplacement:movement(neutralJaw,openedJaw),gripDisplacement:movement(neutralGrip,closedGrip),sourceRestUnchanged:source.getObjectByName('Hips').quaternion.toArray().every((v,i)=>Math.abs(v-original[i])<1e-9),restBones:[],counterRegions:[]};
 // Exercise the actual counter pose method against the appearance's source,
 // including the deliberate different Ash fallback in the renderer stub.
 const visual=Object.create(counters.BrutalCombatVisuals.prototype);visual.renderer={_enemyVisuals:new Map([[53001,{root}]]),_ashWitnessAsset:q.assets.get('ash-witness'),camera,weaponGroups:[]};visual.poseRestore=[];
 for(const name of ['point','target','pole','cameraPoint','axis','right','scale'])visual[name]=new THREE.Vector3();for(const name of ['rotation','delta','parentRotation'])visual[name]=new THREE.Quaternion();
 visual.pose({health:100,x:root.position.x/4,y:(root.position.z+1)/4,z:0,angle:-Math.PI/2,brutal:{enemyId:53001,phase:'active',kind:'chop',elapsed:.3,contactAt:.22,duration:.9,side:'left'}},true);
 for(const name of ['Hips','Spine02','Spine01','Spine','neck','Head']){const bone=root.getObjectByName(name),base=source.getObjectByName(name);if(!bone||!base)throw Error('Counter rest bone missing '+name);result.restBones.push({name,angle:bone.quaternion.clone().normalize().angleTo(base.quaternion.clone().normalize()),rawAngle:bone.quaternion.angleTo(base.quaternion),sourceQuaternionLength:base.quaternion.length(),positionError:name==='Hips'?bone.position.distanceTo(base.position):0});}
 result.counterBounds=q.bodyBounds(root);
 for(let i=visual.poseRestore.length-1;i>=0;i--){const p=visual.poseRestore[i];p.node.position.copy(p.position);p.node.rotation.copy(p.rotation);}
 root.updateMatrixWorld(true);
 root.userData.afterlife.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const regions=counters.counterRegions(mesh);result.counterRegions.push({mesh:mesh.name,head:regions.filter(v=>v===5).length,leftArm:regions.filter(v=>v===3).length,rightArm:regions.filter(v=>v===4).length});});
 for(const name of ['Socket_Chest','Socket_Head','Socket_Neck','Socket_Abdomen','Socket_LeftWrist','Socket_RightWrist']){const socket=root.getObjectByName(name);result[name]=socket?socket.getWorldPosition(new THREE.Vector3()).sub(root.position).toArray():null;}
 return result;
};
q.captureArticulation=(pose,view='head')=>{
 const s=q.root.userData.afterlife;articulation.restoreCharacterArticulation(s.articulation);articulation.applyCharacterArticulation(s.articulation,pose);q.root.updateMatrixWorld(true);
 const bone=q.root.getObjectByName(view==='head'?'Head':'LeftHand'),target=bone.getWorldPosition(new THREE.Vector3());camera.position.copy(target).add(new THREE.Vector3(view==='head'?.20:.15,.045,view==='head'?.66:.43));camera.lookAt(target);renderer.render(scene,camera);
};
q.floorProof=motion=>{
 q.reset(motion,.28);const samples=[];for(let i=0;i<210;i++){q.step();if(i%15===0||q.e.strike===.24){const s=q.sample();s.bounds=q.bodyBounds(q.root);s.floorLift=q.root.userData.afterlife.floorLift;s.frame=i;samples.push(s);}}
 return samples;
};
q.clipSweep=()=>{
 const asset=q.assets.get(q.selectedId),out=[];
 for(const clip of asset.clips){const root=model.createAfterlifeModel(asset,0,53011),state=root.userData.afterlife;scene.add(root);
  for(const action of Object.values(state.actions))action.stop().setEffectiveWeight(0);
  const action=state.mixer.clipAction(clip);action.reset().setEffectiveWeight(1).play();action.paused=true;
  for(const phase of [0,.25,.5,.75,.999]){action.time=clip.duration*phase;state.mixer.update(0);out.push({name:clip.name,phase,bounds:q.bodyBounds(root)});}
  scene.remove(root);model.disposeAfterlifeModel(root);disposeObject(root);
 }return out;
};
q.captureClipPose=(name,phase)=>{
 q.clear();const root=model.createAfterlifeModel(q.assets.get(q.selectedId),0,53011);scene.add(root);q.roots.push(root);q.root=root;
 const state=root.userData.afterlife,clip=q.assets.get(q.selectedId).clips.find(c=>c.name===name);if(!clip)throw Error('Missing capture clip '+name);
 for(const action of Object.values(state.actions))action.stop().setEffectiveWeight(0);
 const action=state.mixer.clipAction(clip);action.reset().setEffectiveWeight(1).play();action.paused=true;action.time=phase*clip.duration;state.mixer.update(0);state.motionClass='runner';root.rotation.y=-Math.PI;q.draw(root);
 document.getElementById('caption').innerHTML=q.selectedId.toUpperCase()+' / RUN '+(phase===.46?'FLIGHT':'SUPPORT')+'<small>Actual imported clip phase '+phase+' · fitted skin</small>';
 return {clip:name,phase,bounds:q.bodyBounds(root),renderer:q.pixels()};
};
q.memoryMetrics=()=>{
 const textures=new Set(),buffers=new Set();for(const asset of q.assets.values())asset.template.traverse(mesh=>{if(!mesh.isMesh)return;for(const attribute of Object.values(mesh.geometry.attributes))buffers.add(attribute.array);if(mesh.geometry.index)buffers.add(mesh.geometry.index.array);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material||{}))if(value?.isTexture)textures.add(value);});
 return {sharedAssetGeometryBufferBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),sharedTextureCount:textures.size,estimatedDecodedRgbaMipBytes:[...textures].reduce((n,t)=>n+(t.image?.width||0)*(t.image?.height||0)*4*4/3,0),usedJsHeapBytes:performance.memory?.usedJSHeapSize||null,qualifier:'Texture estimate assumes decoded RGBA with full mip chains; excludes render targets, bone textures, drivers and compressed GPU formats. Heap is one snapshot without forced GC.'};
};
q.lineup=()=>{
 q.clear();const ids=['drowned-dockworker','fever-runner','ash-witness','crooked-crawler'];
 for(let i=0;i<ids.length;i++){const motion=i===1?'runner':i===3?'crawler':'shambler',e=q.enemy(motion,53030+i);e.appearance=ids[i];e.state='wander';e.mind.state='wander';e.attacking=false;e.strike=0;e.facing=Math.PI/2;const root=q.add(e);root.position.x=(i-1.5)*2.1;
  for(let frame=0;frame<180;frame++){q.now+=1000/60;root.position.z+=(motion==='runner'?3.4:motion==='crawler'?.9:.65)/60;model.animateAfterlifeModel(root,e,q.now,e.id);}root.position.z=0;
 }
 camera.position.set(0,2.1,9.2);camera.lookAt(0,.85,0);renderer.render(scene,camera);document.getElementById('caption').innerHTML='DROWNED / FEVER / ASH / CROOKED<small>Three Meshy characters with Ash Witness · shared game animations</small>';return {ids,renderer:q.pixels()};
};
window.__ZOMBIE_VARIANT_QA__=q;
`;
const fixture=studio.replace('model.createAfterlifeModel(asset,e.kind,e.id)','model.createAfterlifeModel(q.assets?.get(e.appearance)||asset,e.kind,e.id)').replace(marker,extension+marker);
const motionFor=id=>id==='fever-runner'?'runner':id==='crooked-crawler'?'crawler':'shambler';
const report={baseUrl,root:server.root,result:'IN_PROGRESS',errors:[],requestFailures:[],assets:[],variants:[],captures:[],references:[
 'C:/Users/wolfk/.codex/skills/threejs-3d-generator/references/threejs-integration.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/qa-release-checklists.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/visual-verification.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/playtest-qa.md',
 'C:/Users/wolfk/.codex/skills/threejs-qa-release/references/checklists/release.md',
].map(path=>({path,read:true,failureReason:null})),scope:'Generated character appearances, rig/animation/contact and native coastal integration; no whole-game AAA certification.'};
let browser,page;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});
 page=await browser.newPage({viewport:{width:1280,height:800}});
 const flag=message=>page.evaluate(message=>{window.__ZOMBIE_VARIANT_ERROR__=message;},message).catch(()=>{});
 const observePage=()=>{
 page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);flag(e.message);});
 page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());console.error(m.text());flag(m.text());}});
 page.on('response',r=>{if(r.status()>=400){const message=`${r.status()} ${r.url()}`;report.errors.push(message);console.error(message);flag(message);}});
 page.on('requestfailed',r=>{const message=`${r.failure()?.errorText} ${r.url()}`;report.requestFailures.push(message);flag(message);});
 };observePage();
 await page.route('**/zombie-variants-fixture.html',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(baseUrl+'/zombie-variants-fixture.html',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__ZOMBIE_VARIANT_QA__||window.__ZOMBIE_VARIANT_ERROR__,null,{timeout:180000});
 assert(await page.evaluate(()=>!!window.__ZOMBIE_VARIANT_QA__),'all three real variant assets loaded');
 report.assets=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.intake);
 report.moduleHashes=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.moduleHashes);
 assert.equal(report.assets.length,3);assert.equal(new Set(report.assets.map(a=>a.geometryHashes.join(','))).size,3,'three distinct imported meshes');
 assert.equal(new Set(report.assets.map(a=>a.textures.filter(t=>t.slot==='map').map(t=>t.sha256).join(','))).size,3,'three distinct decoded PBR albedo atlases');
 const expected=process.env.ZOMBIE_VARIANT_SHA256?JSON.parse(process.env.ZOMBIE_VARIANT_SHA256):null;
 for(const asset of report.assets){
  if(expected)assert.equal(asset.sha256,expected[asset.id].toLowerCase(),`exact packaged ${asset.id} bytes`);
  assert.equal(asset.clips.length,10);assert(asset.clips.every(c=>c.tracks>=60&&c.duration>0),`${asset.id} complete rig motion`);
  assert(asset.meshes.some(m=>m.skinned&&m.bones>=24));assert(asset.chains.every(c=>c.present&&c.connected),`${asset.id} complete limb chains`);
  assert(asset.textures.some(t=>t.slot==='map'&&t.colors>15&&t.width>=512),`${asset.id} decoded varied detailed albedo`);
  const motion=motionFor(asset.id);await page.evaluate(id=>window.__ZOMBIE_VARIANT_QA__.select(id),asset.id);
  await page.evaluate(m=>window.__ZOMBIE_VARIANT_QA__.reset(m),motion);
  const samples=await page.evaluate(()=>{const q=window.__ZOMBIE_VARIANT_QA__,out=[];for(let i=0;i<720;i++){q.step();out.push(q.sample());}return out;});
  const contacts=samples.filter((s,i)=>i>0&&s.health<samples[i-1].health),sliding=samples.filter(s=>s.strike>0&&s.moving>.05);
  assert(contacts.length>=3,`${asset.id} repeated live attacks`);assert.equal(sliding.length,0,`${asset.id} planted strike`);assert(contacts.every(s=>Math.abs(s.attackTime-.375)<.002),`${asset.id} exact .375 authored contact`);assert(samples.every(s=>Number.isFinite(s.gait)&&Math.abs(s.weight-1)<1e-5),`${asset.id} normalized finite distance phase`);
  const variant={id:asset.id,motion,attacks:contacts.length,slidingContactFrames:sliding.length,contacts};report.variants.push(variant);await writeFile(`${output}/${asset.id}-samples.json`,JSON.stringify(samples));
  const shown=await page.evaluate(m=>window.__ZOMBIE_VARIANT_QA__.show(m),motion);shown.id=asset.id;shown.renderer=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.pixels());assert(shown.renderer.colorBuckets>20&&shown.renderer.changedSamples>200,'actual textured model canvas is nonblank');report.captures.push(shown);await page.screenshot({path:`${output}/${asset.id}-motion.png`});
  variant.rig=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.rigProof());
  assert(variant.rig.sourceTemplateMatches&&variant.rig.sourceRestUnchanged,'own appearance source/rest remains immutable');assert(variant.rig.restBones.every(b=>b.angle<1e-6&&b.positionError<1e-6));assert.equal(variant.rig.counterBounds.invalid,0);assert(Math.max(...variant.rig.counterBounds.size)<3.7,'real counter pose keeps fitted skin bounded');
  assert(variant.rig.jawVertices>=8&&variant.rig.jawDisplacement>.003,`${asset.id} weighted actual jaw visibly deforms`);assert(variant.rig.gripVertices>=8&&variant.rig.gripDisplacement>.003,`${asset.id} weighted fused fingers visibly curl`);
  assert(variant.rig.counterRegions.some(r=>r.head>10&&r.leftArm>10&&r.rightArm>10),`${asset.id} real imported counter regions`);assert(['Socket_Chest','Socket_Head','Socket_Neck','Socket_Abdomen','Socket_LeftWrist','Socket_RightWrist'].every(name=>variant.rig[name]),`${asset.id} six counter sockets`);
  variant.clipSweep=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.clipSweep());assert(variant.clipSweep.every(s=>s.bounds.invalid===0&&Math.max(...s.bounds.size)<3.7),`${asset.id} all ten actual clips keep finite bounded skin`);
  for(const [name,pose,view]of [['jaw-neutral',{jawOpen:0,leftGrip:0,rightGrip:0},'head'],['jaw-open',{jawOpen:1,leftGrip:0,rightGrip:0},'head'],['hand-relaxed',{jawOpen:0,leftGrip:0,rightGrip:0},'hand'],['hand-grip',{jawOpen:0,leftGrip:1,rightGrip:1},'hand']]){await page.evaluate(([pose,view])=>window.__ZOMBIE_VARIANT_QA__.captureArticulation(pose,view),[pose,view]);await page.screenshot({path:`${output}/${asset.id}-${name}.png`});}
  if(motion==='crawler'){variant.floor=await page.evaluate(m=>window.__ZOMBIE_VARIANT_QA__.floorProof(m),motion);assert(variant.floor.every(s=>s.bounds.invalid===0&&s.bounds.min[1]>=-.035),`${asset.id} skin stays above floor through crawl/swipe blends`);assert(variant.floor.every(s=>Math.max(...s.bounds.size)<3.7),`${asset.id} bounded posed skin without exploded limbs`);}
  await page.setViewportSize({width:390,height:844});await page.evaluate(m=>window.__ZOMBIE_VARIANT_QA__.show(m),motion);await page.screenshot({path:`${output}/${asset.id}-portrait.png`});await page.setViewportSize({width:1280,height:800});
  if(motion==='runner')for(const [name,phase]of [['support',.24],['flight',.46]]){const pose=await page.evaluate(phase=>window.__ZOMBIE_VARIANT_QA__.captureClipPose('AshWitness_Run',phase),phase);variant[name]=pose;await page.screenshot({path:`${output}/${asset.id}-${name}.png`});}
  if(motion==='crawler'){variant.contort=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.show('crawler',1));await page.screenshot({path:`${output}/${asset.id}-contort.png`});}
  console.log(JSON.stringify({id:asset.id,attacks:contacts.length,jaw:variant.rig.jawDisplacement,grip:variant.rig.gripDisplacement}));
 }
 report.lineup=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.lineup());await page.screenshot({path:`${output}/lineup.png`});report.crowd=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.crowd());report.crowd.memory=await page.evaluate(()=>window.__ZOMBIE_VARIANT_QA__.memoryMetrics());report.crowd.qualifier='240 synchronous animation update batches in the isolated WebGL studio; excludes rendering time and is not game FPS. Includes 24 skins and authored transition cases.';await page.screenshot({path:`${output}/crowd-24.png`});report.fixtureResult='PASS';await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 if(process.env.ZOMBIE_VARIANT_GAME_SMOKE==='1'){
  // Keep WebGL studio teardown separate from the native WebGPU adapter/device
  // lifetime. These are our own browsers, never the user's existing game tab.
  await browser.close();browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu','--use-angle=d3d11']});page=await browser.newPage({viewport:{width:1280,height:800}});observePage();report.nativeBrowserIsolation=true;
  await page.goto(baseUrl+'/?debug=1',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__DEAD_ARRIVAL__||window.__ZOMBIE_VARIANT_ERROR__||document.querySelector('[role="alert"]'),null,{timeout:90000});assert(await page.evaluate(()=>!!window.__DEAD_ARRIVAL__),'native game initialized');
  console.log('Native coastal variant warmup starting');await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.screen==='play'||window.__ZOMBIE_VARIANT_ERROR__||document.querySelector('[data-action="reload"]:not([hidden])'),null,{timeout:240000});
  report.gameStartup=await page.evaluate(()=>({screen:window.__DEAD_ARRIVAL__.screen,stage:window.__DEAD_ARRIVAL__.renderer._preparationStage,error:window.__ZOMBIE_VARIANT_ERROR__||null,nativeWebGPU:!!window.__DEAD_ARRIVAL__.renderer.renderer.backend?.isWebGPUBackend}));assert.equal(report.gameStartup.screen,'play');assert(report.gameStartup.nativeWebGPU);
  await page.evaluate(()=>window.__DEAD_ARRIVAL__.renderer._warmupPromise);await page.waitForFunction(()=>window.__DEAD_ARRIVAL__.run.harborProgress?.initialized,null,{timeout:90000});
  report.game=await page.evaluate(()=>{const d=window.__DEAD_ARRIVAL__,diagnostics=d.renderer.diagnostics();return{diagnostics,enemies:d.run.course.enemies.map(e=>({id:e.id,appearance:e.appearance,locomotion:e.locomotion,state:e.state})),actors:[...d.renderer._enemyVisuals.values()].map(entry=>({appearance:entry.root.userData.afterlife?.appearance,sourceTemplate:entry.root.userData.afterlife?.sourceTemplate?.name}))};});
  assert(report.game.diagnostics.zombieAppearances.every(a=>a.status==='ready'&&a.error===null&&a.clips.length===10));assert.deepEqual(report.game.diagnostics.zombieAppearanceFallbacks,[]);
  assert(report.game.enemies.some(e=>e.appearance==='ash-witness'),'original Ash remains in the natural coastal population');
  report.game.fallback=await page.evaluate(async()=>{const r=window.__DEAD_ARRIVAL__.renderer,{disposeObject}=await import('/renderer.js'),source=r._enemySource({id:99171,kind:0,variant:'stalker',appearance:'qa-unavailable-appearance'}),root=source.makeActor(),result={requested:source.requestedAppearance,actual:root.userData.afterlife.appearance,ashTemplate:root.userData.afterlife.sourceTemplate===r._ashWitnessAsset.template};disposeObject(root);return result;});
  assert.equal(report.game.fallback.actual,'ash-witness');assert(report.game.fallback.ashTemplate,'unknown appearance falls back to the original valid skinned Ash source');
  for(const asset of report.assets)assert(report.game.enemies.some(e=>e.appearance===asset.id),`${asset.id} naturally spawns in coastal game`);
  await page.screenshot({path:`${output}/game-coastal-spawn.png`});
  report.game.closeActors=[];
  for(const asset of report.assets){await page.evaluate(async id=>{const d=window.__DEAD_ARRIVAL__,r=d.run,{canStand,castRay}=await import('/engine.js'),e=r.course.enemies.find(e=>!e.dead&&e.appearance===id);for(const[dx,dy]of[[Math.cos(e.facing)*.85,Math.sin(e.facing)*.85],[0,.85],[.85,0],[0,-.85],[-.85,0]]){const x=e.x+dx,y=e.y+dy,angle=Math.atan2(e.y-y,e.x-x);if(canStand(r.course,x,y,.12)&&castRay(r.course,x,y,angle,1).dist>.8){Object.assign(r,{x,y,angle,pitch:e.locomotion==='crawler'?-.12:-.05,z:0,vx:0,vy:0,vz:0,health:1000});d.renderer._firstCameraFrame=true;d.renderer.render(r,performance.now());return;}}throw Error('No clear native appearance approach '+id);},asset.id);
   await page.waitForFunction(id=>{const d=window.__DEAD_ARRIVAL__,e=d.run.course.enemies.find(e=>!e.dead&&e.appearance===id);return !!d.renderer._enemyVisuals.get(e?.id)?.root.visible;},asset.id,{timeout:15000});
   const actor=await page.evaluate(id=>{const d=window.__DEAD_ARRIVAL__,e=d.run.course.enemies.find(e=>!e.dead&&e.appearance===id),root=d.renderer._enemyVisuals.get(e.id).root,s=root.userData.afterlife,materials=[];s.model.traverse(mesh=>{if(mesh.isSkinnedMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.push({name:m.name,type:m.type,albedoSize:m.map?[m.map.image.width,m.map.image.height]:null,normal:!!m.normalMap});});return {enemyId:e.id,appearance:s.appearance,sourceTemplate:s.sourceTemplate.name,motionClass:s.motionClass,preserveAtlasColors:s.preserveAtlasColors,materials,graphicStyle:root.userData.blackwaterActorStyle?.diagnostics||null};},asset.id);
   assert.equal(actor.appearance,asset.id);assert(actor.materials.some(m=>m.albedoSize?.[0]>=512),'real native actor retains its actual imported albedo');assert(actor.preserveAtlasColors&&actor.graphicStyle?.parameters.preserveAtlasColors&&actor.graphicStyle.albedoMode==='authored-color-atlas'&&actor.graphicStyle.semantics.every(s=>s.albedoSource==='authored-color-atlas'),'generated coastal actors preserve the authored colored atlas');report.game.closeActors.push(actor);await page.screenshot({path:`${output}/game-${asset.id}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/game-crawler-portrait.png`});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requestFailures,[]);report.result='PASS';console.log(JSON.stringify({result:report.result,assets:report.assets.map(a=>({id:a.id,sha256:a.sha256,bytes:a.bytes})),crowd:report.crowd,output}));
}catch(error){report.result='FAIL';report.failure=error.stack;await page?.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
