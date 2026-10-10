// Read-only exported-skin capture. Uses a separate browser and ephemeral server.
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startServer} from '../server.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output=process.env.FP_ANGLE_OUTPUT||'output/playwright/fps-arms-v5-angle-review';await mkdir(output,{recursive:true});
const selectedWeapons=(process.env.FP_ANGLE_WEAPONS||'0,1,2,3,4,5,6,7').split(',').map(Number);
const reference=JSON.parse(await readFile('.art-source/viewmodel-arms-v3/rig-reference.json','utf8'));
const hash=createHash('sha256').update(await readFile('assets/survivor/fps-arms-v5.glb')).digest('hex');
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const page=await browser.newPage({viewport:{width:1000,height:800}});
const xrayOnly=process.argv.includes('--xray-only');
const proximalOnly=process.argv.includes('--proximal-only'),append=xrayOnly||proximalOnly;
const report=append?JSON.parse(await readFile(output+'/report.json','utf8')):{assetSha256:hash,scope:'Fresh skinned exported V5; production grip solver in neutral WebGL studio. Six anatomical directions per available hand, isolated material/clay and solid hardware contact. Action frames are sampled, not continuous motion certification.',errors:[],captures:[]};
if(report.assetSha256!==hash)throw new Error('Asset changed between captures');
if(!append){report.sourceHashes={};for(const file of ['fps-arms-review.js','assets/survivor/fps-arms.js','assets/survivor/foreground-arms.js','tests/fps-arms-angle-review.mjs','weapon-detail-pass.js','weapon-occult-redesign.js','weapon-melee.js'])report.sourceHashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');report.scope+=' Workshop uses the production hardware fitting step before installing V5. Handle-only oblique images retain actual opaque contact surfaces.';}
if(proximalOnly){report.scope+=' Supplemental proximal clay hides the sleeve to reveal the complete glove wrist termination.';report.proximalSupplementSourceSha256=createHash('sha256').update(await readFile('tests/fps-arms-angle-review.mjs')).digest('hex');}
if(xrayOnly)report.scope+=' Transparent hardware images are diagnostic only; they do not represent gameplay visibility.';
page.on('pageerror',e=>report.errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.port}/fps-arms-review.html`);
 await page.waitForFunction(()=>window.__FPS_WORKSHOP__,null,{timeout:90000});
 await page.evaluate(()=>{document.querySelector('nav').style.display='none';const label=document.createElement('div');label.id='angle-label';label.style.cssText='position:absolute;bottom:12px;left:18px;color:white;background:#162027dd;padding:10px 16px;font:18px system-ui';document.body.append(label);});
 async function capture(weapon,side,angle,mode,phase='idle',time=0){
  const armReference=reference.weapons[weapon].arms.find(a=>a.side===side);
  const diagnostics=await page.evaluate(async({weapon,side,angle,mode,phase,time,handMatrix,restDigits,restGeometry})=>{
   const T=await import('/vendor/three.module.js');const w=window.__FPS_WORKSHOP__;
   const diagnostics=w.select(weapon,phase,time),g=w.r.weaponGroups[weapon],state=g.userData.authoredFPS;
   const originalGlove=state.rig.getObjectByName(`FPSGlove_${state.name}_${side}`),prefix=`FPS_${state.name}_${side}_`;
   let glove=originalGlove;
   if(restGeometry){glove=new T.Mesh(originalGlove.geometry,originalGlove.material);glove.userData.authoredFPSMesh=true;glove.layers.mask=originalGlove.layers.mask;glove.matrixAutoUpdate=false;glove.matrix.copy(originalGlove.matrix);originalGlove.parent.add(glove);originalGlove.visible=false;glove.updateMatrixWorld(true);}
   if(restDigits){for(const entry of state.sampled)if(/(Index|Middle|Ring|Little|Thumb)\d$/.test(entry.bone.name)){entry.bone.position.copy(entry.position);entry.bone.quaternion.copy(entry.quaternion);entry.bone.scale.copy(entry.scale);}state.rig.updateMatrixWorld(true);glove.skeleton.update();}
   const pos=name=>state.rig.getObjectByName(prefix+name).getWorldPosition(new T.Vector3());
   const wrist=pos('Hand'),mcp=pos('Middle0'),long=mcp.clone().sub(wrist).normalize();
   const dorsal=new T.Vector3(side==='right'?1:-1,0,0).transformDirection(new T.Matrix4().fromArray(handMatrix)).transformDirection(g.matrixWorld);
   const fan=pos('Index0').sub(pos('Little0')).normalize();
   const directions={dorsal,palmar:dorsal.clone().negate(),radial:fan,ulnar:fan.clone().negate(),distal:long,proximal:long.clone().negate(),dorsalOblique:dorsal.clone().multiplyScalar(.65).addScaledVector(fan,.55).addScaledVector(long,.35),palmarOblique:dorsal.clone().multiplyScalar(-.65).addScaledVector(fan,.55).addScaledVector(long,.35)};
   const box=new T.Box3(),p=new T.Vector3();for(let i=0;i<glove.geometry.attributes.position.count;i++){glove.getVertexPosition(i,p).applyMatrix4(glove.matrixWorld);box.expandByPoint(p);}
   const target=box.getCenter(new T.Vector3()),radius=box.getSize(new T.Vector3()).length()*.5;
   const camera=new T.PerspectiveCamera(42,1000/800,.002,10);camera.layers.enable(1);
   const direction=directions[angle].clone().normalize();camera.position.copy(target).addScaledVector(direction,radius/Math.sin(T.MathUtils.degToRad(21))*1.12);
   camera.up.copy(Math.abs(direction.dot(long))>.90?dorsal:long);camera.lookAt(target);
   const visibility=[],materials=[],temporary=[];
   const other=state.arms.find(a=>a.side!==side);if(other){visibility.push([other.wrapper,other.wrapper.visible]);other.wrapper.visible=false;}
   const rightHandles=['wood-grip','relic-grip','wood-pistol-grip','rear-handle','wooden-handle'],leftHandles=[[],['support-wood'],['support-grip-body'],['support-grip'],['handguard-shell'],['wood-support-grip'],['wooden-handle'],['wrap-handle']],handles=side==='right'?rightHandles:leftHandles[weapon];
   g.traverse(o=>{if(!o.isMesh)return;if(!o.userData.authoredFPSMesh&&(!['contact','xray','handle'].includes(mode)||(mode==='handle'&&!handles.includes(o.name)))){visibility.push([o,o.visible]);o.visible=false;}
    if(mode==='glove-only'&&o.name.startsWith('FPSSleeve_')){visibility.push([o,o.visible]);o.visible=false;}
    if(!o.userData.authoredFPSMesh&&mode==='xray'){materials.push([o,o.material]);const mapped=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{const material=source.clone();material.transparent=true;material.opacity=.17;material.depthWrite=false;material.side=T.DoubleSide;temporary.push(material);return material;});o.material=Array.isArray(o.material)?mapped:mapped[0];}
    if(o.userData.authoredFPSMesh&&['clay','glove-only'].includes(mode)){materials.push([o,o.material]);const material=new T.MeshStandardMaterial({color:'#aaaead',roughness:.85});temporary.push(material);o.material=material;}
   });
   const scene=w.r.camera.parent;w.renderer.render(scene,camera);
   for(const [o,visible]of visibility)o.visible=visible;for(const [o,material]of materials)o.material=material;temporary.forEach(m=>m.dispose());
   if(restGeometry){glove.removeFromParent();originalGlove.visible=true;}
   document.getElementById('angle-label').textContent=`${state.name} / ${side} / ${angle} / ${mode} / ${phase} ${time.toFixed(3)}s`;
   return {diagnostics,camera:camera.position.toArray(),target:target.toArray(),direction:direction.toArray()};
  },{weapon,side,angle,mode,phase,time,handMatrix:armReference.handMatrix,restDigits:process.env.FP_ANGLE_DIGIT_REST==='1',restGeometry:process.env.FP_ANGLE_REST_GEOMETRY==='1'});
  const name=reference.weapons[weapon].name,file=`${name}-${side}-${angle}-${mode}-${phase}-${String(time).replace('.','_')}.png`;
  await page.screenshot({path:output+'/'+file});report.captures.push({weapon:name,side,angle,mode,phase,time,file,...diagnostics});
 }
 if(!append){for(const weapon of reference.weapons.filter(w=>selectedWeapons.includes(w.index))){
  for(const arm of weapon.arms)for(const mode of ['material','clay','contact'])for(const angle of ['dorsal','palmar','radial','ulnar','distal','proximal'])await capture(weapon.index,arm.side,angle,mode);
  for(const arm of weapon.arms)for(const angle of ['dorsalOblique','palmarOblique'])await capture(weapon.index,arm.side,angle,'handle');
  console.log('Six-angle coverage',weapon.name);
 }
 for(const weapon of [1,6,7].filter(w=>selectedWeapons.includes(w)&&process.env.FP_ANGLE_STATIC_ONLY!=='1'))for(const arm of reference.weapons[weapon].arms){
  for(const [phase,times]of [['draw',[0,.1,.2,.35,.5]],[weapon<6?'fire':'strike',weapon<6?[0,.03,.075,.12,.2,.35,.5]:[0,.12,.25,.46,.65,.85,1]]])for(const time of times)for(const angle of ['dorsal','palmar','radial'])await capture(weapon,arm.side,angle,'material',phase,time);
  for(const phase of ['draw',weapon<6?'fire':'strike'])for(const angle of ['dorsalOblique','palmarOblique'])await capture(weapon,arm.side,angle,'handle',phase,phase==='draw'?.2:weapon<6?.075:.46);
 }
 }else if(proximalOnly){for(const weapon of reference.weapons.filter(w=>selectedWeapons.includes(w.index)))for(const arm of weapon.arms)await capture(weapon.index,arm.side,'proximal','glove-only');}
 else{for(const weapon of reference.weapons.filter(w=>selectedWeapons.includes(w.index))){for(const arm of weapon.arms)for(const angle of ['dorsal','palmar','radial','ulnar','distal','proximal'])await capture(weapon.index,arm.side,angle,'xray');console.log('Diagnostic contact coverage',weapon.name);}}
 if(createHash('sha256').update(await readFile('assets/survivor/fps-arms-v5.glb')).digest('hex')!==hash)throw new Error('Asset changed during capture');
 report.digitRestDiagnostic=process.env.FP_ANGLE_DIGIT_REST==='1';
 report.unskinnedGeometryDiagnostic=process.env.FP_ANGLE_REST_GEOMETRY==='1';
 report.status=report.errors.length?'FAIL':'PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
console.log(JSON.stringify({status:report.status,captures:report.captures.length,errors:report.errors,failure:report.failure}));
