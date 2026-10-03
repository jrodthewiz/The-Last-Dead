import * as THREE from './vendor/three.module.js';
import {loadGlb} from './assets/load-glb.js';
import {clone as cloneSkeleton} from './vendor/utils/SkeletonUtils.js';
import {installViewmodelDepthBoundary} from './assets/survivor/viewmodel-depth.js';
import {reachBiteArm} from './player-injury-visuals.js';
import {addCounterGripRig,setCounterGrip,counterGripDiagnostics} from './hand-grip-rig.js';
import {applyCharacterArticulation} from './character-articulation.js';
import {createBloodDropletPool,bloodFlight,stampBloodDroplet,finishBloodDropletPool} from './fluid-blood.js';

export const VERMIN_MODEL_URL=new URL('./assets/models/vermin-v1.glb',import.meta.url).href;
export const VERMIN_VISUAL_LIMITS=Object.freeze({rats:24,roaches:96,attachments:3,infestations:8,blood:18});
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1),clamp=THREE.MathUtils.clamp;
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const RAT_CENTER_HEIGHT_CELLS=.014;
const timeOf=run=>finite(run?.world?.time,finite(run?.hostTime,finite(run?.time)));
function seedOf(value){let seed=2166136261;for(const ch of String(value??0)){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619);}return (seed>>>0)/4294967296;}
function sourceVisible(node){if(!node)return false;for(let current=node;current;current=current.parent)if(!current.visible)return false;return true;}

// Every curve reads the simulation's semantic age. No accumulated visual
// clock can advance a paused grab, anticipate a bite, or finish a stuff early.
export function verminHandPose(hand={},reducedMotion=false,worldTime=0){
  const age=Math.max(0,finite(hand.elapsed)),phase=hand.phase||'idle';
  const pickup=phase==='pickup'?smooth(0,.36,age):phase==='idle'?0:1;
  const reach=phase==='stuff'?smooth(0,.32,age)*(1-smooth(.51,.86,age)):0;
  const release=phase==='release'?1-smooth(0,.30,age):1;
  const biteAge=finite(hand.holdAge)-(1.35+Math.max(0,finite(hand.bites)-1)*1.4),bite=phase==='held'&&hand.bites>0&&biteAge>=0?1-smooth(0,.16,biteAge):0;
  return {phase,age,pickup,reach,visible:phase!=='idle'&&release>.001,grip:pickup*release*(phase==='stuff'?1-smooth(.32,.47,age):1),
    bite:bite*(reducedMotion?.45:1),insert:phase==='stuff'?smooth(.23,.43,age):0,release};
}

export function verminMorphPose(kind,age,seed=0,{moving=true,bite=0,reducedMotion=false}={}){
  const rate=kind==='rat'?19:32,phase=finite(age)*rate+seed*Math.PI*2,amplitude=moving?(reducedMotion?.38:.86):.08;
  const gait=Math.sin(phase),secondary=Math.sin(phase*.42+seed*9)*(reducedMotion?.28:.72);
  return kind==='rat'?{ScurryA:Math.max(0,gait)*amplitude,ScurryB:Math.max(0,-gait)*amplitude,Bite:clamp(bite,0,1),TailLeft:Math.max(0,secondary),TailRight:Math.max(0,-secondary)}:
    {ScurryA:Math.max(0,gait)*amplitude,ScurryB:Math.max(0,-gait)*amplitude,AntennaLeft:Math.max(0,secondary),AntennaRight:Math.max(0,-secondary)};
}

/** Native morph texture is allocated at capacity before count falls to zero. */
export function createVerminPool(source,capacity,name='VerminPool',material=source.material){
  const mesh=new THREE.InstancedMesh(source.geometry,material,capacity);mesh.name=name;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.userData.capacity=capacity;
  const holder={morphTargetInfluences:Array.from(source.morphTargetInfluences||[],()=>0)};
  mesh.userData.morphDictionary={...(source.morphTargetDictionary||{})};mesh.userData.morphHolder=holder;
  if(holder.morphTargetInfluences.length){mesh.setMorphAt(0,holder);mesh.morphTexture.needsUpdate=true;}
  mesh.count=0;return mesh;
}

export function writeVerminMorph(pool,index,pose){
  if(index<0||index>=pool.userData.capacity)return false;
  const holder=pool.userData.morphHolder;holder.morphTargetInfluences.fill(0);
  for(const [name,value] of Object.entries(pose)){const slot=pool.userData.morphDictionary[name];if(slot!==undefined)holder.morphTargetInfluences[slot]=clamp(finite(value),0,1);}
  if(holder.morphTargetInfluences.length)pool.setMorphAt(index,holder);return true;
}
function finishPool(pool,count){if(!pool)return;pool.count=Math.min(pool.userData.capacity,count);pool.instanceMatrix.needsUpdate=true;if(pool.morphTexture)pool.morphTexture.needsUpdate=true;}

// A small path is sampled from the actual authored surface, including its
// vertex normals. It never substitutes a floating camera-space spline for a
// sleeve or receiver. Samples are cached; only rigid root transforms vary.
export function sampleVerminSurface(root,{count=24,excludeArms=false,axis=null}={}){
  if(!root?.traverse)return null;
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),samples=[],point=new THREE.Vector3(),normal=new THREE.Vector3(),matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),bounds=new THREE.Box3();
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isSkinnedMesh||!mesh.geometry?.attributes.position||mesh.isInstancedMesh)return;
    if(excludeArms&&(mesh.userData.viewmodelArm||mesh.userData.viewmodelHand))return;
    if(mesh.material?.transparent||/Muzzle|Smoke|Flash|Glint/i.test(mesh.name))return;
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);normalMatrix.getNormalMatrix(matrix);
    const position=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal;
    const stride=Math.max(1,Math.floor(position.count/2400));
    for(let i=0;i<position.count;i+=stride){point.fromBufferAttribute(position,i).applyMatrix4(matrix);normal.set(0,1,0);if(normals)normal.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);if(normal.y<.12)continue;bounds.expandByPoint(point);samples.push({point:point.clone(),normal:normal.clone()});}
  });
  if(samples.length<2)return null;
  const size=bounds.getSize(new THREE.Vector3()),component=axis||(['x','y','z'].sort((a,b)=>size[b]-size[a])[0]),length=size[component];if(length<1e-5)return null;
  const path=[];for(let i=0;i<count;i++){
    const at=bounds.min[component]+length*(.1+.8*i/(count-1));let best=null,score=Infinity;
    for(const sample of samples){const distance=Math.abs(sample.point[component]-at);const candidate=distance+Math.max(0,bounds.max.y-sample.point.y)*.025;if(candidate<score){score=candidate;best=sample;}}
    path.push({point:best.point.clone(),normal:best.normal.clone()});
  }
  return {root,path,bounds,axis:component};
}

/** Own only left-arm triangles while preserving all source UVs and weights. */
export function isolateVerminLeftArm(source){
  const geometry=source.geometry,indices=geometry.index,skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  if(!indices||!skin||!weights||!source.skeleton)return null;
  const left=new Set(source.skeleton.bones.map((bone,i)=>/^Left(?:Shoulder|Arm|ForeArm|Hand)/.test(bone.name)?i:-1).filter(i=>i>=0)),kept=[];
  const amount=vertex=>{let sum=0;for(let j=0;j<4;j++)if(left.has(skin.getComponent(vertex,j)))sum+=weights.getComponent(vertex,j);return sum;};
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(amount(a)>.45&&amount(b)>.45&&amount(c)>.45)kept.push(a,b,c);}
  if(!kept.length)return null;
  const owned=geometry.clone();owned.setIndex(kept);owned.clearGroups();owned.userData={...geometry.userData,verminOwned:true};delete owned.userData.sharedAsset;return owned;
}

// v05's Jaw is the hinge near the cheek, not the lip opening. This local
// offset is the exact authored mouth centre (.022,1.698,.113 metres) relative
// to its Jaw pivot (.010,1.738,.002), converted to the rig's centimetre units.
export function verminMouthFrame(root,position,quaternion){
  const socket=root?.getObjectByName('Socket_Mouth'),jaw=root?.getObjectByName('Jaw'),headSocket=root?.getObjectByName('Socket_Head'),head=root?.getObjectByName('Head'),node=socket||jaw||headSocket||head;
  if(!node)return null;node.getWorldQuaternion(quaternion);
  if(socket)node.getWorldPosition(position);
  else if(jaw)node.localToWorld(position.set(1.2,-4,11.1));
  else if(headSocket)node.localToWorld(position.set(2.2,-3.7,11.3));
  else{node.getWorldPosition(position);position.add(new THREE.Vector3(0,-.04,.09).applyQuaternion(quaternion));}
  return node;
}

function releaseAsset(asset){const geometries=new Set(),materials=new Set(),textures=new Set();asset?.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
function croppedTail(source){
  const geometry=source.geometry.clone(),position=geometry.attributes.position,indices=geometry.index,kept=[];
  for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(position.getZ(a)<-.145&&position.getZ(b)<-.145&&position.getZ(c)<-.145)kept.push(a,b,c);}
  geometry.setIndex(kept);geometry.clearGroups();return geometry;
}
function scruffVertex(source){
  const position=source.geometry.attributes.position,point=new THREE.Vector3(),target=new THREE.Vector3(-.028,.078,.032);let best=0,distance=Infinity;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);const score=point.distanceToSquared(target);if(score<distance){distance=score;best=i;}}
  return best;
}
function nearestVerminVertex(source,target){const position=source.geometry.attributes.position,point=new THREE.Vector3();let best=0,distance=Infinity;for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);const score=point.distanceToSquared(target);if(score<distance){distance=score;best=i;}}return best;}

function stomachCut(material,uniforms){
  const inherited=material.onBeforeCompile,cache=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{
    inherited.call(material,shader,renderer);Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vVerminWoundWorld;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvVerminWoundWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 vVerminWoundWorld;\nuniform float uVerminWoundEnabled;\nuniform vec3 uVerminWoundCenter,uVerminWoundRight,uVerminWoundUp,uVerminWoundFront;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(uVerminWoundEnabled>.5){vec3 woundDelta=vVerminWoundWorld-uVerminWoundCenter;vec2 woundPlane=vec2(dot(woundDelta,uVerminWoundRight)/.034,dot(woundDelta,uVerminWoundUp)/.043);float woundDepth=dot(woundDelta,uVerminWoundFront);if(dot(woundPlane,woundPlane)<1.&&abs(woundDepth)<.13)discard;}
    `);
  };
  material.customProgramCacheKey=()=>cache.call(material)+'-vermin-stomach-v1';material.needsUpdate=true;
}

// A small authored tissue lip and spatial cut in actor-owned material copies.
// The imported zombie geometry, texture assets and existing counter uniforms
// remain intact. The lip uses the existing anatomy asset rather than a torus.
export function createVerminStomachWound(root,source){
  if(!root||!source)return null;
  const uniforms={uVerminWoundEnabled:{value:0},uVerminWoundCenter:{value:new THREE.Vector3()},uVerminWoundRight:{value:new THREE.Vector3(1,0,0)},uVerminWoundUp:{value:UP.clone()},uVerminWoundFront:{value:FORWARD.clone()}},meshes=[],copies=new Map();
  root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const original=mesh.material,materials=Array.isArray(original)?original:[original],owned=materials.map(material=>{if(!copies.has(material)){const copy=material.clone();copy.onBeforeCompile=material.onBeforeCompile;copy.customProgramCacheKey=material.customProgramCacheKey;stomachCut(copy,uniforms);copies.set(material,copy);}return copies.get(material);});mesh.material=Array.isArray(original)?owned:owned[0];meshes.push({mesh,original,owned:mesh.material});});
  if(!meshes.length){for(const m of copies.values())m.dispose();return null;}
  const lip=source.clone(true),lipMaterials=[];lip.traverse(mesh=>{if(!mesh.isMesh)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],owned=materials.map(m=>{const copy=m.clone();copy.onBeforeCompile=m.onBeforeCompile;copy.customProgramCacheKey=m.customProgramCacheKey;lipMaterials.push(copy);return copy;});mesh.material=Array.isArray(mesh.material)?owned:owned[0];mesh.castShadow=false;mesh.frustumCulled=false;});
  lip.position.set(0,0,0);lip.quaternion.identity();lip.scale.setScalar(.5);lip.name='RatAbdominalTissueLip';lip.visible=false;
  let disposed=false;return {root,lip,uniforms,meshes,materials:[...copies.values()],dispose(){if(disposed)return;disposed=true;uniforms.uVerminWoundEnabled.value=0;for(const entry of meshes)if(entry.mesh.material===entry.owned)entry.mesh.material=entry.original;for(const m of copies.values())m.dispose();for(const m of lipMaterials)m.dispose();lip.removeFromParent();}};
}

export class VerminVisuals{
  constructor(renderer,{assetPromise=null}={}){
    this.renderer=renderer;this.root=new THREE.Group();this.root.name='VerminWorld';renderer.scene.add(this.root);
    this.viewRoot=new THREE.Group();this.viewRoot.name='VerminViewAttachments';renderer.camera.add(this.viewRoot);
    this.status='loading';this.disposed=false;this.armStatus='waiting';this.pools=[];this.ownedMaterials=[];this.poseRestore=[];this.surfacePaths=new WeakMap();this.seenBites=new Map();this.wounds=new Map();
    this.marker=new THREE.Object3D();this.point=new THREE.Vector3();this.normal=new THREE.Vector3();this.tangent=new THREE.Vector3();this.right=new THREE.Vector3();this.target=new THREE.Vector3();this.pole=new THREE.Vector3();this.heldPosition=new THREE.Vector3();this.gripPoint=new THREE.Vector3();this.socketPosition=new THREE.Vector3();this.desiredRat=new THREE.Vector3();this.xAxis=new THREE.Vector3(1,0,0);this.armShoulder=new THREE.Vector3();this.armWrist=new THREE.Vector3();
    this.rotation=new THREE.Quaternion();this.heldRotation=new THREE.Quaternion();this.parentRotation=new THREE.Quaternion();this.delta=new THREE.Quaternion();this.localMatrix=new THREE.Matrix4();this.basis=new THREE.Matrix4();this.scale=new THREE.Vector3(1,1,1);this.localNormal=new THREE.Vector3();this.forward=new THREE.Vector3();this.ratById=new Map();
    this.spray=createBloodDropletPool(VERMIN_VISUAL_LIMITS.blood);this.spray.name='VerminBiteBlood';this.root.add(this.spray);
    this.drops=Array.from({length:VERMIN_VISUAL_LIMITS.blood},()=>({at:-100,start:new THREE.Vector3(),velocity:new THREE.Vector3(),seed:0}));this.dropCursor=0;
    const promise=assetPromise||loadGlb(VERMIN_MODEL_URL).then(gltf=>gltf.scene);
    this.ready=promise.then(asset=>{if(this.disposed){releaseAsset(asset);return;}this.asset=asset;this.bindAsset();}).catch(error=>{this.status='unavailable';this.error=String(error?.message||error);});
  }
  bindAsset(){
    const rat=this.asset.getObjectByName('Rat'),roach=this.asset.getObjectByName('Cockroach');if(!rat?.isMesh||!roach?.isMesh)throw new Error('Vermin asset needs Rat and Cockroach meshes');
    this.ratSource=rat;this.roachSource=roach;this.scruffVertex=scruffVertex(rat);this.scruff=new THREE.Vector3().fromBufferAttribute(rat.geometry.attributes.position,this.scruffVertex);this.biteMouthVertex=nearestVerminVertex(rat,new THREE.Vector3(.0018,.0418,.145));this.biteMouth=new THREE.Vector3().fromBufferAttribute(rat.geometry.attributes.position,this.biteMouthVertex);this.biteDirection=new THREE.Vector3();this.biteTarget=new THREE.Vector3();this.bitePoint=new THREE.Vector3();this.biteRotation=new THREE.Quaternion();
    this.rats=this.addPool(rat,VERMIN_VISUAL_LIMITS.rats,'FloorRats',this.root);
    this.roaches=this.addPool(roach,VERMIN_VISUAL_LIMITS.roaches,'FloorCockroaches',this.root);
    const viewMaterial=rat.material.clone();viewMaterial.envMapIntensity=.35;viewMaterial.emissive?.setHex(0);viewMaterial.emissiveIntensity=0;viewMaterial.roughness=Math.max(.55,viewMaterial.roughness);this.ownedMaterials.push(viewMaterial);
    this.viewRats=this.addPool(rat,VERMIN_VISUAL_LIMITS.attachments,'HeldAndCrawlingRats',this.viewRoot,viewMaterial);
    this.viewRoaches=this.addPool(roach,VERMIN_VISUAL_LIMITS.attachments,'WeaponCockroaches',this.viewRoot,viewMaterial);
    this.tailGeometry=croppedTail(rat);const tailSource=rat.clone();tailSource.geometry=this.tailGeometry;
    this.tails=this.addPool(tailSource,VERMIN_VISUAL_LIMITS.infestations,'InfestingRatTails',this.root);
    for(const pool of [this.viewRats,this.viewRoaches]){pool.layers.set(1);pool.receiveShadow=false;pool.userData.viewmodelArm=true;}
    installViewmodelDepthBoundary(this.viewRoot);this.status='ready';
  }
  addPool(source,capacity,name,parent,material=source.material){const pool=createVerminPool(source,capacity,name,material);this.pools.push(pool);parent.add(pool);return pool;}
  prepareWarmup(){
    this.setupArm();
    // Zero-count attachments and the hidden skinned hand otherwise miss shader
    // preparation, even though their assets have finished loading. The caller
    // owns the offscreen render target and restores this before resuming play.
    const saved=[];
    for(const object of [this.root,this.viewRoot,this.arms,...this.pools,this.spray]){
      if(!object)continue;
      saved.push({object,visible:object.visible,count:object.count});
      object.visible=true;
      if(object.isInstancedMesh)object.count=Math.max(1,object.count);
    }
    let restored=false;
    return ()=>{if(restored)return;restored=true;for(const entry of saved){entry.object.visible=entry.visible;if(entry.count!==undefined)entry.object.count=entry.count;}};
  }
  setupArm(){
    const survivor=this.renderer._survivors;if(survivor?.armStatus==='loading')return;
    const template=survivor?.armTemplate||survivor?.template;if(this.arms||!template)return;
    const arms=cloneSkeleton(template),mesh=arms.getObjectByName('TLD_Remote_Arms');if(!mesh?.isSkinnedMesh){arms.traverse(node=>node.skeleton?.dispose());return;}
    const geometry=isolateVerminLeftArm(mesh);if(!geometry){arms.traverse(node=>node.skeleton?.dispose());return;}
    mesh.geometry=geometry;this.armGeometry=geometry;this.armMaterials=[];this.armBones={};this.armBase=[];
    const materials=new Map();arms.traverse(node=>{
      if(node.isBone){this.armBones[node.name]=node;this.armBase.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});}
      if(node.isMesh){node.visible=node===mesh;node.frustumCulled=false;node.castShadow=node.receiveShadow=false;node.layers.set(1);node.userData.viewmodelArm=true;const copy=m=>{if(!materials.has(m))materials.set(m,m.clone());return materials.get(m);};node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);}
    });
    this.armMaterials=[...materials.values()];for(const m of this.armMaterials){m.emissive?.setHex(0);m.emissiveIntensity=0;m.emissiveMap=null;m.envMapIntensity=.2;m.roughness=Math.max(.72,m.roughness);m.color?.multiplyScalar(.9);}
    arms.name='VerminSurvivorLeftArm';arms.visible=false;this.root.add(arms);this.arms=arms;this.armRootFrame={p:arms.position.clone(),q:arms.quaternion.clone(),s:arms.scale.clone()};this.counterGrip=addCounterGripRig(arms);this.armMesh=mesh;
    const hand=this.counterGrip.hands.left;if(hand){const position=geometry.attributes.position,skin=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,inverse=mesh.skeleton.boneInverses[hand.wristIndex],bindScale=new THREE.Vector3(...hand.measurements.bindScale),target=new THREE.Vector3(0,.10,.024);let distance=Infinity;
      for(const i of new Set(geometry.index.array)){let amount=0;for(let slot=0;slot<4;slot++)if(skin.getComponent(i,slot)===hand.wristIndex)amount+=weights.getComponent(i,slot);if(amount<.8)continue;this.point.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse).multiply(bindScale);const score=this.point.distanceToSquared(target);if(score<distance){distance=score;this.handContactVertex=i;}}
      const fingers=[],gripSkin=mesh.geometry.attributes.skinIndex,gripWeights=mesh.geometry.attributes.skinWeight;for(const i of new Set(mesh.geometry.index.array)){let amount=0;for(let slot=0;slot<4;slot++)if([hand.distalIndex,hand.thumbIndex].includes(gripSkin.getComponent(i,slot)))amount+=gripWeights.getComponent(i,slot);if(amount>.55)fingers.push(i);}const stride=Math.max(1,Math.ceil(fingers.length/48));this.biteFingerVertices=fingers.filter((_,i)=>i%stride===0);
    }
    installViewmodelDepthBoundary(arms);this.armStatus='bundled-skinned-survivor-left-arm';
  }
  beginFrame(){
    for(let i=this.poseRestore.length-1;i>=0;i--){const p=this.poseRestore[i];if(p.articulation){for(const control of p.controls){control.source.bone.quaternion.copy(control.q);control.source.base.copy(control.base);}Object.assign(p.articulation.pose,p.pose);p.articulation.applied=p.applied;continue;}p.node.visible=p.visible;if(p.p)p.node.position.copy(p.p);if(p.q)p.node.quaternion.copy(p.q);}
    this.poseRestore.length=0;setCounterGrip(this.counterGrip);if(this.arms){this.arms.visible=false;this.arms.position.copy(this.armRootFrame.p);this.arms.quaternion.copy(this.armRootFrame.q);this.arms.scale.copy(this.armRootFrame.s);for(const base of this.armBase){base.node.position.copy(base.p);base.node.quaternion.copy(base.q);base.node.scale.copy(base.s);}this.arms.updateMatrixWorld(true);this.counterGrip?.skeleton?.update();}
  }
  hideSupport(){for(const group of this.renderer.weaponGroups||[]){const arm=group.userData.viewArms?.leftArm;if(arm){this.poseRestore.push({node:arm,visible:arm.visible});arm.visible=false;}}}
  saveBone(node){if(node)this.poseRestore.push({node,visible:node.visible,p:node.position.clone(),q:node.quaternion.clone()});}
  saveArticulation(state){if(state)this.poseRestore.push({articulation:state,applied:state.applied,pose:{...state.pose},controls:state.controls.map(control=>({source:control,q:control.bone.quaternion.clone(),base:control.base.clone()}))});}
  stamp(pool,index,position,quaternion,kind,age,seed,options={}){
    if(index>=pool.userData.capacity)return index;this.marker.position.copy(position);this.marker.quaternion.copy(quaternion);this.marker.scale.setScalar(options.scale??1);this.marker.updateMatrix();pool.setMatrixAt(index,this.marker.matrix);writeVerminMorph(pool,index,verminMorphPose(kind,age,seed,options));return index+1;
  }
  worldPoint(local,out=this.point){return this.renderer.camera.localToWorld(out.copy(local));}
  socket(root,channel){return root?.getObjectByName(channel==='mouth'?'Socket_Mouth':'Socket_Abdomen')||root?.getObjectByName(channel==='mouth'?'Jaw':'Socket_Chest')||root?.getObjectByName(channel==='mouth'?'Head':'Spine02');}
  socketFrame(root,channel,out=this.socketPosition){
    const socket=channel==='mouth'?verminMouthFrame(root,out,this.rotation):this.socket(root,channel);if(!socket)return null;
    if(channel!=='mouth'){socket.getWorldPosition(out);socket.getWorldQuaternion(this.rotation);}this.normal.copy(FORWARD).applyQuaternion(this.rotation).normalize();
    return socket;
  }
  poseHand(run,hand,time,reduced){
    const pose=verminHandPose(hand,reduced,time);this.handPose=pose;this.heldVisible=false;this.gripGap=null;this.shoulderLean=0;this.victimPull=0;this.biteContactDistance=null;this.biteHandVertex=null;this.biteTwist=0;this.biteRecoil=0;
    const biteConflict=['windup','terminal'].includes(run.bite?.phase)||(run.bite?.phase==='held'&&pose.phase!=='stuff');
    if(!pose.visible||run.health<=0||run.playerWounds?.leftArm==='severed'||(run.brutal&& !['idle','cancelled'].includes(run.brutal.phase))||biteConflict)return 0;
    this.setupArm();if(!this.arms||this.counterGrip?.status!=='ready')return 0;
    const rat=this.ratById.get(hand.ratId);if(!rat)return 0;
    const r=this.renderer,camera=r.camera,bones=this.armBones;
    for(const base of this.armBase){base.node.position.copy(base.p);base.node.quaternion.copy(base.q);base.node.scale.copy(base.s);}
    this.arms.position.set(run.x*4,(run.z||0)*4,run.y*4);this.arms.rotation.set(0,-finite(run.angle)-Math.PI/2,0);this.arms.updateMatrixWorld(true);
    camera.getWorldQuaternion(this.rotation);this.normal.copy(UP).applyQuaternion(this.rotation);this.right.set(1,0,0).applyQuaternion(this.rotation);this.tangent.crossVectors(this.normal,this.right).normalize();this.basis.makeBasis(this.tangent,this.normal,this.right);this.heldRotation.setFromRotationMatrix(this.basis);
    this.worldPoint(this.target.set(-.25,-.25,-.51),this.desiredRat);
    if(pose.phase==='pickup'){
      this.point.set(finite(rat.pickupX,rat.x)*4,Math.max(0,finite(rat.pickupZ,rat.z)-RAT_CENTER_HEIGHT_CELLS)*4,finite(rat.pickupY,rat.y)*4);this.desiredRat.lerp(this.point,1-pose.pickup);
      // A physical crouch/lean places the original shoulder within its actual
      // measured arm length while the rat still starts on its floor position.
      this.arms.position.y-=.87*(1-pose.pickup);this.arms.updateMatrixWorld(true);
    }
    if(pose.phase==='stuff'){
      const root=r._enemyVisuals?.get(hand.enemyId)?.root;
      if(this.socketFrame(root,hand.channel,this.socketPosition)){
        this.point.copy(this.socketPosition).addScaledVector(this.normal,.17-.19*pose.insert);this.desiredRat.lerp(this.point,pose.reach);
        this.forward.copy(this.normal).negate();this.right.crossVectors(UP,this.forward).normalize();this.normal.crossVectors(this.forward,this.right).normalize();this.basis.makeBasis(this.right,this.normal,this.forward);this.delta.setFromRotationMatrix(this.basis);this.heldRotation.slerp(this.delta,pose.reach);
        const articulation=root.userData.afterlife?.articulation;if(articulation&&hand.channel==='mouth'){this.saveArticulation(articulation);applyCharacterArticulation(articulation,{...articulation.pose,jawOpen:Math.max(articulation.pose.jawOpen,.64*pose.reach),tongueLift:.22*pose.reach,lipCurl:.30*pose.reach});}
      }
    }
    // The target is the wrist, derived from the rat's actual scruff contact.
    // After IK, the rat follows the achieved palm so clamped arm reach cannot
    // create a visible floating gap.
    this.point.copy(this.scruff).applyQuaternion(this.heldRotation);this.target.copy(this.desiredRat).add(this.point);
    camera.getWorldQuaternion(this.parentRotation);this.right.set(1,0,0).applyQuaternion(this.parentRotation);this.normal.copy(UP).applyQuaternion(this.parentRotation);this.target.addScaledVector(this.right,-.105).addScaledVector(this.normal,-.019);
    bones.LeftArm.getWorldPosition(this.armShoulder);bones.LeftForeArm.getWorldPosition(this.armWrist);const upperLength=this.armShoulder.distanceTo(this.armWrist);bones.LeftHand.getWorldPosition(this.armWrist);bones.LeftForeArm.getWorldPosition(this.point);const maxReach=(upperLength+this.armWrist.distanceTo(this.point))*.94;
    this.point.copy(this.target).sub(this.armShoulder);const distance=this.point.length();this.shoulderLean=0;this.victimPull=0;
    if(pose.phase==='stuff'&&distance>maxReach){
      const root=r._enemyVisuals?.get(hand.enemyId)?.root,needed=distance-maxReach;
      // Contact closes by moving the victim and leaning the player together.
      // The original shoulder stays attached to the player's body instead of
      // translating an isolated sleeve across the room to satisfy IK.
      if(root){
        this.saveBone(root);this.forward.set(run.x*4-root.position.x,0,run.y*4-root.position.z);const horizontal=this.forward.length();
        this.victimPull=Math.min(.35,needed+.025,horizontal*.45)*pose.reach;if(horizontal>1e-6)root.position.addScaledVector(this.forward.normalize(),this.victimPull);root.updateMatrixWorld(true);
        this.shoulderLean=Math.min(.18,Math.max(0,needed-this.victimPull))*pose.reach;
        this.forward.set(Math.cos(finite(run.angle)),0,Math.sin(finite(run.angle))).multiplyScalar(this.shoulderLean);this.arms.position.add(this.forward);
        if(r.cameraRig){this.saveBone(r.cameraRig);r.cameraRig.position.add(this.forward);r.cameraRig.updateMatrixWorld(true);}
        this.arms.updateMatrixWorld(true);
        this.worldPoint(this.desiredRat.set(-.25,-.25,-.51),this.desiredRat);this.socketFrame(root,hand.channel,this.socketPosition);this.point.copy(this.socketPosition).addScaledVector(this.normal,.17-.19*pose.insert);this.desiredRat.lerp(this.point,pose.reach);
        this.point.copy(this.scruff).applyQuaternion(this.heldRotation);this.target.copy(this.desiredRat).add(this.point);camera.getWorldQuaternion(this.parentRotation);this.right.set(1,0,0).applyQuaternion(this.parentRotation);this.normal.copy(UP).applyQuaternion(this.parentRotation);this.target.addScaledVector(this.right,-.105).addScaledVector(this.normal,-.019);
      }
    }else if(pose.phase==='pickup'&&distance>maxReach){this.arms.position.addScaledVector(this.point.normalize(),Math.min(.45,distance-maxReach)*(1-pose.pickup));this.arms.updateMatrixWorld(true);}
    if(pose.phase==='held'&&pose.bite>0){this.point.set(-.006,-.007,.015).applyQuaternion(camera.getWorldQuaternion(this.parentRotation)).multiplyScalar(pose.bite);this.target.add(this.point);this.biteRecoil=this.point.length();}
    this.worldPoint(this.pole.set(-.70,-.53,-.19),this.pole);
    reachBiteArm(bones.LeftArm,bones.LeftForeArm,bones.LeftHand,this.target,this.pole,1);
    // Palm frame: measured finger long axis points across the rat's shoulders,
    // while its thin axis opposes the curled thumb. Wrist rotation is solved
    // independently of the original arm lengths and unchanged bind matrices.
    camera.getWorldQuaternion(this.parentRotation);this.right.set(1,0,0).applyQuaternion(this.parentRotation);this.normal.copy(UP).applyQuaternion(this.parentRotation);this.tangent.crossVectors(this.right,this.normal).normalize();
    this.basis.makeBasis(this.tangent,this.right,this.normal);this.delta.setFromRotationMatrix(this.basis);bones.LeftHand.parent.getWorldQuaternion(this.parentRotation).invert();bones.LeftHand.quaternion.copy(this.parentRotation.multiply(this.delta));
    this.arms.updateMatrixWorld(true);setCounterGrip(this.counterGrip,{left:pose.grip*(1-.20*pose.bite),leftMode:'heart'});this.arms.visible=true;this.hideSupport();
    if(this.handContactVertex!==undefined){this.armMesh.getVertexPosition(this.handContactVertex,this.gripPoint);this.armMesh.localToWorld(this.gripPoint);}else bones.LeftHand.getWorldPosition(this.gripPoint);
    if(pose.phase==='held'&&pose.bite>0&&this.biteFingerVertices?.length){
      this.biteDirection.copy(this.biteMouth).sub(this.scruff).applyQuaternion(this.heldRotation);const radius=this.biteDirection.length();this.biteDirection.normalize();let score=Infinity;
      for(const vertex of this.biteFingerVertices){this.armMesh.getVertexPosition(vertex,this.bitePoint);this.armMesh.localToWorld(this.bitePoint);this.point.copy(this.bitePoint).sub(this.gripPoint);const length=this.point.length();if(length<.015)continue;const angle=Math.acos(clamp(this.biteDirection.dot(this.point.divideScalar(length)),-1,1)),candidate=Math.abs(length-radius)+angle*.018;if(candidate<score){score=candidate;this.biteTarget.copy(this.bitePoint);this.biteHandVertex=vertex;}}
      if(this.biteHandVertex!==null){
        this.point.copy(this.biteTarget).sub(this.gripPoint).normalize();this.biteRotation.setFromUnitVectors(this.biteDirection,this.point);const angle=2*Math.acos(clamp(Math.abs(this.biteRotation.w),0,1)),amount=pose.bite*Math.min(1,1.25/Math.max(.0001,angle));this.delta.identity().slerp(this.biteRotation,amount);this.heldRotation.premultiply(this.delta);this.biteTwist=angle*amount;
        this.bitePoint.copy(this.biteMouth).sub(this.scruff).applyQuaternion(this.heldRotation).add(this.gripPoint);this.biteContactDistance=this.bitePoint.distanceTo(this.biteTarget);
      }
    }
    this.point.copy(this.scruff).applyQuaternion(this.heldRotation);this.heldPosition.copy(this.gripPoint).sub(this.point);
    this.point.copy(this.scruff).applyQuaternion(this.heldRotation).add(this.heldPosition);this.gripGap=this.point.distanceTo(this.gripPoint);
    if(rat.state!=='held'||hand.contactApplied||pose.phase==='release')return 0;
    this.point.copy(this.heldPosition);camera.worldToLocal(this.point);camera.getWorldQuaternion(this.parentRotation).invert();this.delta.copy(this.parentRotation).multiply(this.heldRotation);
    const count=this.stamp(this.viewRats,0,this.point,this.delta,'rat',time,seedOf(rat.id),{bite:pose.bite,moving:true,reducedMotion:reduced});this.heldVisible=count>0;return count;
  }
  surface(root,excludeArms=false){if(!root)return null;let path=this.surfacePaths.get(root);if(!path){path=sampleVerminSurface(root,{excludeArms});if(path)this.surfacePaths.set(root,path);}return path;}
  surfacePose(path,progress,index=0){
    const at=clamp(progress,0,1)*(path.path.length-1),i=Math.min(path.path.length-2,Math.floor(at)),weight=at-i,a=path.path[i],b=path.path[i+1];
    this.point.copy(a.point).lerp(b.point,weight);this.normal.copy(a.normal).lerp(b.normal,weight).normalize();this.tangent.copy(b.point).sub(a.point);if(this.tangent.lengthSq()<1e-8)this.tangent.set(0,0,1);
    this.tangent.addScaledVector(this.normal,-this.tangent.dot(this.normal)).normalize();this.right.crossVectors(this.normal,this.tangent).normalize();
    // Stable side staggering is only 2 mm; each creature's feet stay on the
    // sampled surface instead of forming a camera-space floating cluster.
    this.point.addScaledVector(this.right,(index-1)*.002).addScaledVector(this.normal,.0015);
    path.root.localToWorld(this.point);path.root.getWorldQuaternion(this.parentRotation);this.normal.applyQuaternion(this.parentRotation);this.tangent.applyQuaternion(this.parentRotation);this.right.crossVectors(this.normal,this.tangent).normalize();this.basis.makeBasis(this.right,this.normal,this.tangent);this.rotation.setFromRotationMatrix(this.basis);
    this.renderer.camera.worldToLocal(this.point);this.renderer.camera.getWorldQuaternion(this.parentRotation).invert();this.rotation.premultiply(this.parentRotation);
  }
  updateCrawl(run,reduced,ratCount){
    const crawl=run.verminCrawl||{},r=this.renderer;this.crawlRoute='none';this.crawlSurface=null;if(crawl.phase!=='active'||r.freeCamera||run.health<=0)return {rats:ratCount,roaches:0};
    const group=r.weaponGroups?.[clamp(run.weapon||0,0,7)],arm=group?.userData.viewArms?.rightArm;
    const isRat=crawl.kind==='rat',ratReceiver=isRat&&crawl.weapon===true&&[1,2,4,5].includes(run.weapon),onWeapon=ratReceiver||(!isRat&&crawl.weapon!==false),target=onWeapon?(group?.userData.model||group):arm;
    if(!sourceVisible(target))return {rats:ratCount,roaches:0};
    const path=this.surface(target,onWeapon);if(!path)return {rats:ratCount,roaches:0};
    this.crawlRoute=onWeapon?'weapon':'sleeve';this.crawlSurface=target.name||target.uuid;
    const count=Math.min(VERMIN_VISUAL_LIMITS.attachments-ratCount,Math.max(1,finite(crawl.count,1))),duration=Math.max(.6,finite(crawl.duration,4.2)),age=finite(crawl.elapsed);
    let roaches=0;
    for(let i=0;i<count;i++){
      const progress=clamp((age-i*.14)/(duration-.14*count),0,1);if(progress>=1)continue;this.surfacePose(path,progress,i);
      // Keep a full-size rat outside the central aiming corridor. A creature
      // reaching the eye-level portion of its real path exits presentation;
      // it is never moved away from the gun into a floating safety position.
      if(isRat&&Math.abs(this.point.x)<.16&&this.point.y>-.14&&this.point.z>-.9)continue;
      if(isRat)ratCount=this.stamp(this.viewRats,ratCount,this.point,this.rotation,'rat',age,seedOf(crawl.sequence)+i*.23,{moving:true,reducedMotion:reduced});
      else roaches=this.stamp(this.viewRoaches,roaches,this.point,this.rotation,'roach',age,seedOf(crawl.sequence)+i*.23,{moving:true,reducedMotion:reduced});
    }
    return {rats:ratCount,roaches};
  }
  emitBlood(position,time,seed){for(let i=0;i<3;i++){const drop=this.drops[this.dropCursor++%this.drops.length];drop.at=time;drop.start.copy(position);drop.seed=seed+i;drop.velocity.set(Math.sin(seed+i*2.399)*.35,.18+i*.11,Math.cos(seed+i*2.399)*.35);}}
  update(run,nowMs=0){
    if(this.disposed||this.status!=='ready')return;
    const r=this.renderer,world=run.world||run,vermin=world.vermin||run.vermin,time=timeOf(run),reduced=!!(r.settings?.reducedMotion||r._systemReducedMotion);
    if(this.run!==run||this.course!==world.course){this.run=run;this.course=world.course;this.seenBites.clear();for(const drop of this.drops)drop.at=-100;for(const wound of this.wounds.values())wound.dispose();this.wounds.clear();}
    this.ratById.clear();for(const rat of vermin?.rats||[])this.ratById.set(rat.id,rat);
    // Paused/review snapshots retain their canonical creature pose. The menu
    // can also show floor vermin in its existing world without simulating them.
    this.root.visible=true;this.viewRoot.visible=!r.freeCamera;
    let ratCount=0,roachCount=0,tailCount=0;
    for(const rat of vermin?.rats||[]){
      const seed=seedOf(rat.id),age=finite(rat.age,time),state=rat.state||'floor';
      if(['spent','infesting'].includes(state)){
        if(state==='infesting'&&tailCount<VERMIN_VISUAL_LIMITS.infestations){
          const root=r._enemyVisuals?.get(rat.enemyId)?.root,enemy=world.course?.enemies?.find(enemy=>enemy.id===rat.enemyId),infestation=enemy?.verminInfestation,channel=infestation?.channel||'mouth';
          if(root&&this.socketFrame(root,channel,this.point)){
            const infestationAge=finite(infestation?.age,age),beat=Math.floor(infestationAge/.6);
            const key=String(rat.id)+':'+(rat.sequence||0),previous=this.seenBites.get(key);
            if(previous!==beat){this.seenBites.set(key,beat);if(beat>0&&r.settings.gore!==false)this.emitBlood(this.point,time,seed*100+beat);}
            if(channel==='stomach'){
              let wound=this.wounds.get(root);const source=r.brutalCombatVisuals?.asset?.getObjectByName('AbdomenWound');
              if(!wound&&this.wounds.size<VERMIN_VISUAL_LIMITS.infestations){wound=createVerminStomachWound(root,source);if(wound){this.wounds.set(root,wound);this.root.add(wound.lip);}}
              if(wound){
                wound.lip.position.copy(this.point).addScaledVector(this.normal,.004);wound.lip.quaternion.copy(this.rotation);wound.lip.visible=r.settings.gore!==false;
                wound.uniforms.uVerminWoundCenter.value.copy(this.point);wound.uniforms.uVerminWoundRight.value.set(1,0,0).applyQuaternion(this.rotation);wound.uniforms.uVerminWoundUp.value.copy(UP).applyQuaternion(this.rotation);wound.uniforms.uVerminWoundFront.value.copy(this.normal);wound.uniforms.uVerminWoundEnabled.value=r.settings.gore!==false?1:0;
              }
            }
            if(r.settings.gore!==false){
              this.point.addScaledVector(this.normal,-.13);this.delta.setFromAxisAngle(UP,Math.PI);this.rotation.multiply(this.delta);
              const bend=reduced?.12:.6;this.delta.setFromAxisAngle(FORWARD,Math.sin(infestationAge*23+seed*8)*.12*bend);this.rotation.multiply(this.delta);
              tailCount=this.stamp(this.tails,tailCount,this.point,this.rotation,'rat',age,seed,{moving:true,reducedMotion:reduced});
            }
            const articulation=root.userData.afterlife?.articulation;if(articulation&&channel==='mouth'){this.saveArticulation(articulation);applyCharacterArticulation(articulation,{...articulation.pose,jawOpen:.28+(reduced?.06:.16)*(.5+.5*Math.sin(infestationAge*21)),tongueLift:.2,lipCurl:.24});}
          }
        }continue;
      }
      if(state==='held'){
        if(rat.ownerId===(run.playerId||'host'))continue;
        const owner=run.peer,hand=owner?.verminHand,wrist=r._survivors?.peer?.userData?.bones?.LeftHand;if(!wrist||hand?.ratId!==rat.id)continue;
        wrist.getWorldPosition(this.point);wrist.getWorldQuaternion(this.rotation);this.point.addScaledVector(this.normal.copy(UP).applyQuaternion(this.rotation),.025);
        ratCount=this.stamp(this.rats,ratCount,this.point,this.rotation,'rat',age,seed,{moving:true,bite:verminHandPose(hand,reduced,time).bite,reducedMotion:reduced});continue;
      }
      this.point.set(finite(rat.x)*4,Math.max(0,finite(rat.z)-RAT_CENTER_HEIGHT_CELLS)*4,finite(rat.y)*4);this.rotation.setFromAxisAngle(UP,Math.PI/2-finite(rat.angle));
      if(state==='thrown'){const flightAge=finite(rat.flightAge,age);this.delta.setFromAxisAngle(FORWARD,flightAge*7+seed*6);this.rotation.multiply(this.delta);this.delta.setFromAxisAngle(this.xAxis,flightAge*4);this.rotation.multiply(this.delta);}
      const moving=state==='thrown'||Math.hypot(finite(rat.vx),finite(rat.vy))>.005||rat.moving!==false;
      ratCount=this.stamp(this.rats,ratCount,this.point,this.rotation,'rat',age,seed,{moving,reducedMotion:reduced});
    }
    for(const roach of vermin?.roaches||[]){this.point.set(finite(roach.x)*4,.0015,finite(roach.y)*4);this.rotation.setFromAxisAngle(UP,Math.PI/2-finite(roach.angle));roachCount=this.stamp(this.roaches,roachCount,this.point,this.rotation,'roach',finite(roach.age,time),seedOf(roach.id),{moving:roach.moving!==false,reducedMotion:reduced});}
    const heldCount=this.viewRoot.visible?this.poseHand(run,run.verminHand||{},time,reduced):0,crawl=this.updateCrawl(run,reduced,heldCount);
    finishPool(this.rats,ratCount);finishPool(this.roaches,roachCount);finishPool(this.tails,tailCount);finishPool(this.viewRats,crawl.rats);finishPool(this.viewRoaches,crawl.roaches);
    let bloodCount=0;if(r.settings.gore!==false)for(const drop of this.drops){const age=time-drop.at;if(age<0||age>.48)continue;bloodFlight(drop.start,drop.velocity,age,this.point,this.normal);if(this.point.y<.015)continue;stampBloodDroplet(this.spray,bloodCount++,this.marker,this.point,this.normal,.004,drop.seed,1-age/.48);}
    finishBloodDropletPool(this.spray,bloodCount);if(this.seenBites.size>80)this.seenBites.delete(this.seenBites.keys().next().value);
    for(const [root,wound] of this.wounds){
      if(!root.parent){wound.dispose();this.wounds.delete(root);continue;}
      if(this.socketFrame(root,'stomach',this.point)){wound.lip.position.copy(this.point).addScaledVector(this.normal,.004);wound.lip.quaternion.copy(this.rotation);wound.uniforms.uVerminWoundCenter.value.copy(this.point);wound.uniforms.uVerminWoundRight.value.set(1,0,0).applyQuaternion(this.rotation);wound.uniforms.uVerminWoundUp.value.copy(UP).applyQuaternion(this.rotation);wound.uniforms.uVerminWoundFront.value.copy(this.normal);}
      wound.lip.visible=r.settings.gore!==false&&root.visible;wound.uniforms.uVerminWoundEnabled.value=wound.lip.visible?1:0;
    }
    this.swarmPhase=vermin?.swarm?.phase||'idle';
  }
  diagnostics(){return {status:this.status,error:this.error||null,asset:'vermin-v1',rats:this.rats?.count||0,roaches:this.roaches?.count||0,held:this.heldVisible||false,attachments:(this.viewRats?.count||0)+(this.viewRoaches?.count||0),infestations:this.tails?.count||0,blood:this.spray.count,armSource:this.armStatus,hand:this.handPose||null,grip:counterGripDiagnostics(this.counterGrip),gripGapMeters:this.gripGap,gripSurfaceVertices:{survivor:this.handContactVertex??null,rat:this.scruffVertex??null},handBite:{contactDistanceMeters:this.biteContactDistance,sourceHandVertex:this.biteHandVertex,ratMouthVertex:this.biteMouthVertex,twistRadians:this.biteTwist||0,recoilMeters:this.biteRecoil||0},shoulderLeanMeters:this.shoulderLean||0,victimPullMeters:this.victimPull||0,crawlRoute:this.crawlRoute||'none',crawlSurface:this.crawlSurface||null,swarm:this.swarmPhase||'idle',morphMode:'native-per-instance',limits:VERMIN_VISUAL_LIMITS};}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.beginFrame();for(const wound of this.wounds.values())wound.dispose();this.wounds.clear();this.counterGrip?.dispose();this.armGeometry?.dispose();this.armMaterials?.forEach(m=>m.dispose());this.arms?.traverse(node=>node.skeleton?.dispose());
    for(const pool of this.pools){pool.dispose();pool.removeFromParent();}this.ownedMaterials.forEach(m=>m.dispose());this.tailGeometry?.dispose();releaseAsset(this.asset);this.spray.dispose();this.spray.geometry.dispose();this.spray.material.dispose();this.root.removeFromParent();this.viewRoot.removeFromParent();this.seenBites.clear();
  }
}
