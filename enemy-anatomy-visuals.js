import * as THREE from './vendor/three.module.js';
import {cutSkinnedMesh,anatomyCutFrame} from './enemy-cut-geometry.js';
import {partCut,missingArm,setEnemyBodyPose} from './enemy-anatomy.js';
import {previewGeometry,cutPreviewMaterial,unpackGeometry} from './enemy-cut-preview.js';

function tissueMaterial(){
 const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.48,metalness:0,side:THREE.DoubleSide});
 material.userData.afterlifeOwned=true;
 material.userData.goreUniform={value:1};
 material.onBeforeCompile=shader=>{
  shader.uniforms.uAnatomyGore=material.userData.goreUniform;
  shader.vertexShader='varying vec2 vAnatomyUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvAnatomyUv=uv;');
  shader.fragmentShader='varying vec2 vAnatomyUv;uniform float uAnatomyGore;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float marrow=1.-smoothstep(.075,.125,length(vAnatomyUv));
   float fibre=.85+.15*sin(atan(vAnatomyUv.y,vAnatomyUv.x)*21.+length(vAnatomyUv)*28.);
   if(diffuseColor.g>.09){
    vec2 p=vAnatomyUv;float fold=sin(p.x*52.+sin(p.y*29.)*2.8)+sin(p.y*44.+sin(p.x*21.)*1.7);
    float groove=smoothstep(-.35,.20,fold);float skull=smoothstep(.50,.56,length(p))*(1.-smoothstep(.62,.68,length(p)));
    diffuseColor.rgb=mix(vec3(.14,.075,.065),vec3(.31,.19,.15),groove);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.39,.28),skull);
   }else diffuseColor.rgb=mix(diffuseColor.rgb*fibre,vec3(.43,.34,.23),marrow);
   if(uAnatomyGore<.5)diffuseColor.rgb=vec3(.025,.022,.020);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   vec3 limit=max(diffuseColor.rgb*.3,vec3(.004));reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/limit;
   reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.018);
  `);
 };
 material.customProgramCacheKey=()=> 'anatomy-cross-section-v1';return material;
}

function temporaryCapGeometry(cut){
 const radius=cut.part==='torso'?.18:cut.part==='head'?.10:.075,g=new THREE.CircleGeometry(radius,24),uv=g.attributes.uv,colors=new Float32Array(g.attributes.position.count*3),color=cut.part==='head'?[.28,.13,.115]:[.24,.014,.024];
 for(let i=0;i<uv.count;i++){uv.setXY(i,(uv.getX(i)-.5)*radius*16,(uv.getY(i)-.5)*radius*16);colors.set(color,i*3);}
 g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;
}

export class EnemyAnatomyVisuals{
 constructor(owner){
  this.owner=owner;this.actors=new Map();this.seen=new Set();this.compiled=0;this.failures=[];this.jobs=new Map();this.nextJob=1;
  if(typeof Worker!=='undefined'){this.worker=new Worker(new URL('./enemy-cut-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=e=>this.finishAsync(e.data);this.worker.onerror=e=>{this.failures.push(e.message);};}
 }
 bind(root){
  if(this.actors.has(root))return this.actors.get(root);
  const state={root,entries:[],applied:new Set(),cap:tissueMaterial()};
  root.traverse(mesh=>{if(mesh.isSkinnedMesh)state.entries.push({mesh,original:mesh.geometry,material:mesh.material,owned:null});});
  this.actors.set(root,state);return state;
 }
 warmup(root){
  if(!root||this.warmed)return null;this.warmed=true;const group=new THREE.Group(),materials=[],geometries=[];
  root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const geometry=previewGeometry(mesh.geometry,mesh),plane=new THREE.Vector4(0,1,0,-10000);geometries.push(geometry);
   for(const offcut of [false,true]){const m=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(source=>cutPreviewMaterial(source,{region:1,plane,offcut}));materials.push(...m);const preview=new THREE.SkinnedMesh(geometry,m);preview.skeleton=mesh.skeleton;preview.receiveShadow=!offcut&&mesh.receiveShadow;preview.castShadow=!offcut&&mesh.castShadow;preview.frustumCulled=false;group.add(preview);}
   // Completed offcuts use frozen, unskinned copies of the imported skin.
   const staticMaterials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(source=>{const copy=source.clone();copy.onBeforeCompile=source.onBeforeCompile;copy.customProgramCacheKey=source.customProgramCacheKey;return copy;});materials.push(...staticMaterials);group.add(new THREE.Mesh(geometry,staticMaterials));
  });
  // Keep the cross-section program resident too, sharing the same material
  // signature as a real skinned wound cap.
  const cap=tissueMaterial();materials.push(cap);const source=group.children[0];if(source)for(const size of new Set([3,source.geometry.attributes.color?.itemSize||3])){const geometry=source.geometry.clone();geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*size).fill(1),size));geometries.push(geometry);const mesh=new THREE.SkinnedMesh(geometry,cap);mesh.skeleton=source.skeleton;mesh.receiveShadow=source.receiveShadow;group.add(mesh);}
  for(const child of group.children.slice()){
   if(!child.isSkinnedMesh)continue;const source=child.material;if(Array.isArray(source)&&source.length&&source[0].customProgramCacheKey().includes('impact-preview'))continue;
   const plain=new THREE.Mesh(child.geometry,source);plain.frustumCulled=false;group.add(plain);
  }
  this.warmupMaterials ||= [];this.warmupMaterials.push(...materials);
  return{group,release:()=>{group.clear();geometries.forEach(g=>g.dispose());}};
 }
 update(run,visuals){
  const r=this.owner.renderer;
  // Shader variants depend on the active course's lights and shadow receivers.
  // Menu preparation can have a different scene, so prepare during the actual
  // play course before its opening encounter rather than consuming the latch.
  if(this.warmupCourse!==run.course&&run.mode==='play'&&r._weaponsPrepared&&r.renderer){
   this.warmed=false;
   const preparation=this.warmup(r._afterlifeWarmups?.find(root=>root.userData.afterlifeModel));
   if(preparation){
    const {group,release}=preparation;
    this.warmupCourse=run.course;
    // The bodycam path renders into a linear target. Its shader variant is
    // different from the screen variant, just as in the game's weapon warmup.
    const renderer=r.renderer,previous=renderer.getRenderTarget(),linearTarget=new THREE.WebGLRenderTarget(1,1);let screen,linear;
    try{renderer.setRenderTarget(null);screen=renderer.compileAsync(group,r.camera,r.scene);renderer.setRenderTarget(linearTarget);linear=renderer.compileAsync(group,r.camera,r.scene);}finally{renderer.setRenderTarget(previous);}
    this.warmupPromise=Promise.all([screen,linear]).then(release,error=>{this.failures.push(String(error));release();}).finally(()=>linearTarget.dispose());
   }
  }
  const roots=new Set([...visuals.values()].map(e=>e.root));
  for(const root of this.actors.keys())if(!roots.has(root))this.release(root);
  for(const enemy of run.course.enemies){
   const cuts=enemy.anatomy?.cuts;if(!cuts?.length)continue;
   const root=visuals.get(enemy.id)?.root;if(!root?.userData.afterlifeModel)continue;
   let state=this.actors.get(root);
   if(state)state.cap.userData.goreUniform.value=this.owner.renderer.settings.gore?1:0;
   if(state?.pending){
    const frame=anatomyCutFrame(root,state.pending.cut);if(frame){state.pending.cap.position.copy(frame.point);state.pending.cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),frame.normal);for(const p of state.pending.previews){const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(frame.normal,frame.point).applyMatrix4(p.entry.mesh.matrixWorld.clone().invert());p.plane.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);}}
    continue;
   }
   if(cuts.every(c=>state?.applied.has(c.id)))continue;
   // The counter/harvest shader owns a temporary clone. Restore it before
   // surgery, then let the existing counter system bind the new topology.
   this.owner.releaseActor(root);state=this.bind(root);state.cap.userData.goreUniform.value=r.settings.gore?1:0;root.updateMatrixWorld(true);
   if(state.pending)continue;
   for(const cut of cuts){
    if(state.applied.has(cut.id))continue;
    const frame=anatomyCutFrame(root,cut);if(!frame)continue;
    if(this.worker){this.startAsync(state,enemy,cut,frame,run);break;}
    const piece=new THREE.Group();piece.name='ProceduralOffcut_'+cut.part;
    let count=0,caps=0;
    for(const entry of state.entries){
     const materials=Array.isArray(entry.material)?entry.material:[entry.material],capIndex=materials.length;
     const result=cutSkinnedMesh(entry.mesh,{...frame,capMaterialIndex:capIndex});
     if(!result.detached){result.retained.dispose();continue;}
     entry.owned?.dispose();entry.owned=result.retained;entry.mesh.geometry=result.retained;
     entry.mesh.geometry.userData.corpseSourceGeometry=entry.original.uuid;
     entry.mesh.material=[...materials,state.cap];
     const copies=[...materials,state.cap].map(m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;delete c.userData.sharedAsset;delete c.userData.sharedLibrary;c.userData.afterlifeOwned=true;return c;});
     // Detached vertices are already in world metres. Centre the group so a
     // small fitted Cannon box can tumble around the actual piece centroid.
     result.detached.translate(-frame.point.x,-frame.point.y,-frame.point.z);
     const mesh=new THREE.Mesh(result.detached,copies);mesh.frustumCulled=false;piece.add(mesh);count+=result.removedTriangles;caps+=result.loops;
    }
    state.applied.add(cut.id);this.compiled++;
    root.userData.anatomy={cuts:[...state.applied],lastPart:cut.part,capLoops:caps,removedTriangles:count};
    const key=enemy.id+':'+cut.id,worldTime=run.world?.time??(run.playerId==='peer'?run.peer?.time??run.time:run.time);
    if(piece.children.length&&!this.seen.has(key)&&worldTime-cut.at<.4){
     piece.position.copy(frame.point);this.owner.root.add(piece);
     const direction=new THREE.Vector3().fromArray(cut.impulse||[Math.cos(run.angle),.32,Math.sin(run.angle)]).multiplyScalar(cut.force);
     this.owner.fragments.push({piece,origin:frame.point.clone(),center:new THREE.Vector3(),time:worldTime,delay:0,kind:cut.part,spin:cut.id%2?1:-1,velocity:direction,enemyId:enemy.id});
    }else this.owner.releaseFragment({piece});
    this.seen.add(key);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value);
   }
  }
 }
 startAsync(state,enemy,cut,frame,run){
  const began=performance.now();
  const id=this.nextJob++,piece=new THREE.Group(),inputs=[],previews=[];piece.name='ProceduralOffcut_'+cut.part;piece.position.copy(frame.point);
  const planes=[];
  for(const entry of state.entries){
   const mesh=entry.mesh,g=mesh.geometry;mesh.skeleton.update();
   inputs.push({attributes:Object.fromEntries(Object.entries(g.attributes).filter(([name])=>name!=='brutalMembership').map(([name,a])=>[name,{array:a.array.slice(),itemSize:a.itemSize}])),index:g.index.array.slice(),groups:g.groups.map(g=>({...g})),names:mesh.skeleton.bones.map(b=>b.name),boneMatrices:mesh.skeleton.boneMatrices.slice(),matrixWorld:mesh.matrixWorld.toArray(),bindMatrix:mesh.bindMatrix.toArray(),bindMatrixInverse:mesh.bindMatrixInverse.toArray()});
   const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(frame.normal,frame.point).applyMatrix4(mesh.matrixWorld.clone().invert()),value=new THREE.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),materials=Array.isArray(entry.material)?entry.material:[entry.material];planes.push(value);
   const geometry=previewGeometry(g,mesh),owned=materials.map(m=>cutPreviewMaterial(m,{region:frame.region,plane:value}));
   previews.push({entry,geometry,materials:owned,prior:g,plane:value});mesh.geometry=geometry;mesh.material=owned;
   // The two masks use identical vertex data. Their distinct skeleton buffers
   // supply live/frozen poses; uploading another full skin is unnecessary.
   const fragment=new THREE.SkinnedMesh(geometry,materials.map(m=>cutPreviewMaterial(m,{region:frame.region,plane:value.clone(),offcut:true})));
   fragment.userData.anatomySharedPreview=true;
   // Three also requests skinned bounds for opaque sorting, even when frustum
   // culling is disabled. The frozen pose already has these exact bounds.
   fragment.boundingSphere=mesh.boundingSphere?.clone()||geometry.boundingSphere?.clone()||new THREE.Sphere(new THREE.Vector3(),2.5);
   const skeleton=new THREE.Skeleton(mesh.skeleton.bones);skeleton.boneMatrices=mesh.skeleton.boneMatrices.slice();skeleton.update=()=>{};fragment.skeleton=skeleton;
   fragment.bindMatrix.copy(mesh.bindMatrix);const inverse=mesh.bindMatrixInverse.clone();fragment.bindMatrixInverse.copy(inverse);
   fragment.matrixAutoUpdate=false;fragment.matrix.copy(new THREE.Matrix4().makeTranslation(-frame.point.x,-frame.point.y,-frame.point.z).multiply(mesh.matrixWorld));
   fragment.updateMatrixWorld=function(force){THREE.Mesh.prototype.updateMatrixWorld.call(this,force);this.bindMatrixInverse.copy(inverse);};fragment.frustumCulled=false;piece.add(fragment);
  }
  const cap=new THREE.Mesh(temporaryCapGeometry(cut),state.cap);cap.position.copy(frame.point);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),frame.normal);this.owner.root.add(cap);
  const worldTime=run.world?.time??(run.playerId==='peer'?run.peer?.time??run.time:run.time),emit=!this.seen.has(enemy.id+':'+cut.id)&&worldTime-cut.at<.4;
  const f={piece,origin:frame.point.clone(),center:new THREE.Vector3(),time:worldTime,delay:0,pending:true,kind:cut.part,spin:cut.id%2?1:-1,velocity:new THREE.Vector3().fromArray(cut.impulse||[Math.cos(run.angle),.32,Math.sin(run.angle)]).multiplyScalar(cut.force),enemyId:enemy.id};
  if(emit){this.owner.root.add(piece);this.owner.fragments.push(f);}else this.owner.releaseFragment({piece});
  const job={id,state,enemy,cut,frame,previews,cap,fragment:emit?f:null};state.pending=job;this.jobs.set(id,job);
  const transfers=[];for(const input of inputs){transfers.push(input.index.buffer,input.boneMatrices.buffer);for(const a of Object.values(input.attributes))transfers.push(a.array.buffer);}
  this.worker.postMessage({id,meshes:inputs,frame:{region:frame.region,point:frame.point.toArray(),normal:frame.normal.toArray(),capMaterialIndex:(Array.isArray(state.entries[0].material)?state.entries[0].material.length:1)}},transfers);
  this.lastPreviewMs=performance.now()-began;this.maxPreviewMs=Math.max(this.maxPreviewMs||0,this.lastPreviewMs);
 }
 finishAsync(result){
  const job=this.jobs.get(result.id);if(!job)return;this.jobs.delete(result.id);
  const {state,cut,previews,frame}=job;if(!this.actors.has(state.root))return;
  this.owner.releaseActor(state.root);
  for(const p of previews){p.entry.mesh.geometry=p.prior;p.entry.mesh.material=p.entry.material;p.geometry.dispose();p.materials.forEach(m=>m.dispose());}
  job.cap.removeFromParent();job.cap.geometry.dispose();state.pending=null;
  if(result.error){this.failures.push(result.error);return;}
  const piece=new THREE.Group();piece.name='ProceduralOffcut_'+cut.part;let triangles=0,loops=0;
  for(let i=0;i<result.output.length;i++){
   const entry=state.entries[i],data=result.output[i],retained=unpackGeometry(data.retained),detached=unpackGeometry(data.detached);
   if(!detached){retained.dispose();continue;}
   entry.owned?.dispose();entry.owned=retained;entry.mesh.geometry=retained;retained.userData.corpseSourceGeometry=entry.original.uuid;
   const materials=Array.isArray(entry.material)?entry.material:[entry.material];entry.mesh.material=[...materials,state.cap];
   detached.translate(-frame.point.x,-frame.point.y,-frame.point.z);
   const copies=[...materials,state.cap].map(m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey;delete c.userData.sharedAsset;delete c.userData.sharedLibrary;c.userData.afterlifeOwned=true;return c;});piece.add(new THREE.Mesh(detached,copies));triangles+=data.removedTriangles;loops+=data.loops;
  }
  const f=job.fragment;if(f&&this.owner.fragments.includes(f)){
   piece.position.copy(f.piece.position);piece.quaternion.copy(f.piece.quaternion);this.owner.releaseFragment(f);f.piece=piece;f.pending=false;this.owner.root.add(piece);
  }else this.owner.releaseFragment({piece});
  state.applied.add(cut.id);this.seen.add(job.enemy.id+':'+cut.id);this.compiled++;
  state.root.userData.anatomy={cuts:[...state.applied],lastPart:cut.part,capLoops:loops,removedTriangles:triangles};
 }
 capturePoses(run,visuals){
  const paths={leftArm:['LeftArm','LeftForeArm','LeftHand','LeftGrip'],rightArm:['RightArm','RightForeArm','RightHand','RightGrip'],leftLeg:['LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase'],rightLeg:['RightUpLeg','RightLeg','RightFoot','RightToeBase'],head:['neck','Head','head_end'],torso:['Hips','Spine02','Spine01','neck']};
  for(const enemy of run.course.enemies){
   const root=visuals.get(enemy.id)?.root;if(!root?.userData.afterlifeModel||!root.visible)continue;
   root.updateMatrixWorld(true);root.userData.anatomyEnemyId=enemy.id;const segments=[];
   for(const [part,names]of Object.entries(paths)){
    const points=names.map(name=>root.getObjectByName(name)?.getWorldPosition(new THREE.Vector3()).multiplyScalar(.25)).filter(Boolean);if(points.length<2)continue;
    const cut=partCut(enemy,part),fraction=cut?.fraction??(part.endsWith('Arm')&&missingArm(enemy,part.startsWith('left')?'left':'right')?0:1);
    const lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),total=lengths.reduce((s,v)=>s+v,0);let distance=0;
    for(let i=0;i<points.length-1;i++){
     const allowed=total*fraction-distance;if(allowed<=.002)break;
     // The neck capsule only spans the neck. The cranium gets a wider, round
     // proxy; clothing and skin still use primitive collision shapes.
     const radius=part==='torso'?.054:part==='head'?(i===0?.024:.034):part.endsWith('Leg')?.024:.020;
     segments.push({part,a:points[i].toArray(),b:points[i].clone().lerp(points[i+1],Math.min(1,allowed/lengths[i])).toArray(),start:distance/total,end:Math.min(fraction,(distance+lengths[i])/total),radius});distance+=lengths[i];
    }
   }
   setEnemyBodyPose(enemy,segments);
  }
 }
 release(root){
  const state=this.actors.get(root);if(!state)return;
  if(state.pending){this.jobs.delete(state.pending.id);for(const p of state.pending.previews){p.geometry.dispose();p.materials.forEach(m=>m.dispose());}state.pending.cap.removeFromParent();state.pending.cap.geometry.dispose();}
  for(const e of state.entries){e.mesh.geometry=e.original;e.mesh.material=e.material;e.owned?.dispose();}
  state.cap.dispose();delete root.userData.anatomy;this.actors.delete(root);
 }
 reset(){for(const root of [...this.actors.keys()])this.release(root);this.seen.clear();this.compiled=0;}
 dispose(){this.reset();this.worker?.terminate();this.jobs.clear();this.warmupMaterials?.forEach(m=>m.dispose());}
 diagnostics(){return{actors:this.actors.size,compiledCuts:this.compiled,pending:this.jobs.size,lastPreviewMs:this.lastPreviewMs||0,maxPreviewMs:this.maxPreviewMs||0,capLoops:[...this.actors.values()].reduce((n,s)=>n+(s.root.userData.anatomy?.capLoops||0),0),failures:this.failures};}
}
