import * as THREE from './vendor/three.module.js';
import {clone as cloneSkeleton} from './vendor/utils/SkeletonUtils.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {loadAfterlifeModel} from './npc-afterlife-model.js';
import {reachBiteArm} from './player-injury-visuals.js';
import {createBloodDropletPool,bloodFlight,stampBloodDroplet,finishBloodDropletPool} from './fluid-blood.js';
import {CorpsePhysics} from './corpse-physics.js';
import {ChestFinisherVisuals,chestHandPoint,combatWorldTime} from './chest-finisher-visuals.js';
import {BodySpearVisuals,applyBodySpearReaction} from './body-spear-visuals.js';
import {addCounterGripRig,setCounterGrip,counterGripDiagnostics} from './hand-grip-rig.js';
import {addSoftTissueCompliance} from './soft-tissue-compliance.js';
import {EnemyAnatomyVisuals} from './enemy-anatomy-visuals.js';
import {castRay,eye} from './engine.js';
import {actorGroundAt} from './coastal-structures.js';

const clamp=THREE.MathUtils.clamp, UP=new THREE.Vector3(0,1,0), FRONT=new THREE.Vector3(0,0,1);
const smooth=(a,b,t)=>{const p=clamp((t-a)/(b-a),0,1);return p*p*(3-2*p);};
function poseFrame(root,run,stage){
  const dots={};for(const name of ['Socket_Chest','Socket_Abdomen','Jaw']){const node=root.getObjectByName(name);if(!node)continue;
    const direction=FRONT.clone().applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())),toward=new THREE.Vector3(run.x*4,0,run.y*4).sub(node.getWorldPosition(new THREE.Vector3()));direction.y=toward.y=0;dots[name]=direction.normalize().dot(toward.normalize());}
  return{stage,yaw:root.rotation.y,dots};
}

const cameraLocal=new THREE.Vector3(),cameraBack=new THREE.Vector3(),cameraHalf=new THREE.Vector3(),cameraInverse=new THREE.Quaternion(),shapeInverse=new THREE.Quaternion();
// A short retreat during crouched pickup keeps the body camera outside the
// victim's fitted cloth proxies. Translation remains cosmetic and bounded.
export function cameraRetractionDistance(eye,back,nodes,clearance=.28,limit=.42) {
  let distance=0;
  for(let pass=0;pass<2;pass++)for(const node of nodes||[]){
    const body=node.body;if(!body?.shapes)continue;
    cameraInverse.copy(body.quaternion).invert();
    for(let i=0;i<body.shapes.length;i++){
      const half=body.shapes[i].halfExtents;if(!half)continue;
      cameraLocal.copy(eye).addScaledVector(back,distance).sub(body.position).applyQuaternion(cameraInverse);
      if(body.shapeOffsets?.[i])cameraLocal.sub(body.shapeOffsets[i]);
      cameraBack.copy(back).applyQuaternion(cameraInverse);
      if(body.shapeOrientations?.[i]){shapeInverse.copy(body.shapeOrientations[i]).invert();cameraLocal.applyQuaternion(shapeInverse);cameraBack.applyQuaternion(shapeInverse);}
      cameraHalf.set(half.x+clearance,half.y+clearance,half.z+clearance);
      if(Math.abs(cameraLocal.x)>cameraHalf.x||Math.abs(cameraLocal.y)>cameraHalf.y||Math.abs(cameraLocal.z)>cameraHalf.z)continue;
      let exit=Infinity,depth=Infinity;
      for(let axis=0;axis<3;axis++){const p=cameraLocal.getComponent(axis),v=cameraBack.getComponent(axis),h=cameraHalf.getComponent(axis);depth=Math.min(depth,h-Math.abs(p));if(Math.abs(v)>1e-6)exit=Math.min(exit,((v>0?h:-h)-p)/v);}
      if(Number.isFinite(exit))distance=Math.min(limit,distance+Math.max(0,exit)*THREE.MathUtils.smoothstep(depth,0,.045)+.001);
    }
  }
  return distance;
}
export const BRUTAL_ANATOMY_URL='./assets/models/brutal-anatomy-v1.glb';
export const BRUTAL_VISUAL_LIMITS=Object.freeze({woundedActors:12,fragments:6,spray:48});

export function counterRegion(name='') {
  if(/^(neck|Head|headfront|head_end|Jaw|Tongue)$/i.test(name))return 5;
  if(/^Left(Arm|ForeArm|Hand|Grip|Finger|Thumb)/i.test(name))return 3;
  if(/^Right(Arm|ForeArm|Hand|Grip|Finger|Thumb)/i.test(name))return 4;
  return 0;
}
export function counterRegions(mesh) {
  const {skinIndex,skinWeight,position}=mesh.geometry.attributes,regions=new Float32Array(position.count);
  if(!skinIndex||!skinWeight)return regions;
  for(let i=0;i<position.count;i++) {
    const weights=[0,0,0,0,0,0];
    for(let j=0;j<4;j++)weights[counterRegion(mesh.skeleton.bones[skinIndex.getComponent(i,j)]?.name)]+=skinWeight.getComponent(i,j);
    regions[i]=weights.indexOf(Math.max(...weights));
  }
  return regions;
}

/** Length-weighted frame of the same posed .5 boundary used by the cut shader. */
export function counterCutBoundary(mesh,regions,region,origin) {
  const g=mesh.geometry,index=g.index,cache=new Map(),center=new THREE.Vector3(),points=[];let length=0;
  mesh.skeleton.update();
  const vertex=id=>{if(!cache.has(id)){const p=mesh.getVertexPosition(id,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin);cache.set(id,p);}return cache.get(id);};
  for(let i=0;i<(index?.count||g.attributes.position.count);i+=3){
    const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j),members=triangle.map(id=>regions[id]===region);
    if(members.every(Boolean)||members.every(v=>!v))continue;
    const seam=[];
    for(let j=0;j<3;j++)if(members[j]!==members[(j+1)%3])seam.push(vertex(triangle[j]).clone().lerp(vertex(triangle[(j+1)%3]),.5));
    if(seam.length===2){const weight=seam[0].distanceTo(seam[1]);center.addScaledVector(seam[0],weight*.5).addScaledVector(seam[1],weight*.5);length+=weight;points.push(...seam);}
  }
  if(length>0)center.divideScalar(length);return{center,length,points};
}

const CUT_DECL='uniform float uBrutalKind,uBrutalRegion,uHarvestOpen,uSpearOpen; uniform vec2 uHarvestExtent,uSpearExtent,uSpearExitExtent; uniform vec3 uSpearExitCenter,uSpearExitFront,uHarvestCenter,uHarvestRight,uHarvestUp,uHarvestFront,uBrutalCenter,uBrutalRight,uBrutalUp,uBrutalFront; varying vec3 vBrutalMembership; varying vec3 vBrutalWorld;';
const CUT_FRAGMENT=`
  // Harvesting opens the source topology itself; its shadow and depth passes
  // see the same retracted skinned vertices, without an oval discard mask.
  float cutMembership=uBrutalRegion<3.5?vBrutalMembership.x:(uBrutalRegion<4.5?vBrutalMembership.y:vBrutalMembership.z);
  if(uBrutalKind>.5&&uBrutalKind<2.5&&cutMembership>.5)discard;
  if(uBrutalKind>2.5){
    vec3 d=vBrutalWorld-uBrutalCenter;
    // The v2 chest rim covers a smaller inner cut. Keeping the discarded
    // source coat inside that lip prevents a floating black outer silhouette.
    vec2 extent=uSpearOpen>.5?uSpearExtent:(uBrutalKind>3.5?vec2(.059,.069):vec2(.073,.10));
    vec2 p=vec2(dot(d,uBrutalRight),dot(d,uBrutalUp))/extent;
    float edge=1.+.055*sin(atan(p.y,p.x)*9.);
    if(dot(d,uBrutalFront)>-.055&&length(p)<edge)discard;
    if(uSpearOpen>.5){
      vec3 back=vBrutalWorld-uSpearExitCenter;
      vec2 backP=vec2(dot(back,uBrutalRight),dot(back,uBrutalUp))/uSpearExitExtent;
      if(dot(back,uSpearExitFront)>-.055&&length(backP)<edge)discard;
      // Clear folded inner fabric throughout the fitted entry/exit bore.
      float boreDepth=max(.001,dot(uBrutalCenter-uSpearExitCenter,uBrutalFront));
      float inward=-dot(d,uBrutalFront);
      vec2 boreExtent=mix(uSpearExtent,uSpearExitExtent,clamp(inward/boreDepth,0.,1.));
      vec2 boreP=vec2(dot(d,uBrutalRight),dot(d,uBrutalUp))/boreExtent;
      if(inward>-.055&&inward<boreDepth+.055&&length(boreP)<edge)discard;
    }
  }
`;
function cutShader(material,uniforms) {
  const previous=material.onBeforeCompile,cache=material.customProgramCacheKey();
  material.userData.brutalCutUniforms=uniforms;
  material.onBeforeCompile=shader=>{
    previous.call(material,shader);Object.assign(shader.uniforms,uniforms);
    shader.uniforms.uBodyIncidentLimit={value:1.25};
    shader.vertexShader='attribute vec3 brutalMembership; varying vec3 vBrutalMembership; varying vec3 vBrutalWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvBrutalMembership=brutalMembership; vBrutalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=CUT_DECL+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+CUT_FRAGMENT);
  };
  // The native port reads cut uniforms from the current rendered material.
  // Identical rigs can reuse the warmed program without sharing wound state.
  material.customProgramCacheKey=()=>cache+'-brutal-source-seam-v9-material-reference';material.needsUpdate=true;
}

/** Capture the actual posed imported skin, including its original UVs. */
export function captureCounterPart(mesh,regions,region,origin) {
  const g=mesh.geometry,index=g.index,ids=[],unique=new Map(),vertices=new Map(),points=[],uv=[],normals=[],colors=[],point=new THREE.Vector3(),normal=new THREE.Vector3();
  const skin=new THREE.Matrix4(),bone=new THREE.Matrix4(),worldNormal=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  mesh.skeleton.update();
  const sourceVertex=id=>{
    if(vertices.has(id))return vertices.get(id);
    mesh.getVertexPosition(id,point);point.applyMatrix4(mesh.matrixWorld).sub(origin);
    const v={key:String(id),membership:regions[id]===region?1:0,p:point.toArray(),uv:[g.attributes.uv?.getX(id)||0,g.attributes.uv?.getY(id)||0],normal:null,color:null};
    if(g.attributes.normal){
      skin.elements.fill(0);
      for(let j=0;j<4;j++){const weight=g.attributes.skinWeight.getComponent(id,j);if(!weight)continue;bone.fromArray(mesh.skeleton.boneMatrices,g.attributes.skinIndex.getComponent(id,j)*16);for(let k=0;k<16;k++)skin.elements[k]+=bone.elements[k]*weight;}
      skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
      normal.fromBufferAttribute(g.attributes.normal,id).transformDirection(skin).applyMatrix3(worldNormal).normalize();v.normal=normal.toArray();
    }
    if(g.attributes.color)v.color=Array.from({length:g.attributes.color.itemSize},(_,k)=>g.attributes.color.getComponent(id,k));
    vertices.set(id,v);return v;
  };
  const edgeVertex=(a,b)=>{
    const t=(.5-a.membership)/(b.membership-a.membership),blend=(x,y)=>x?.map((value,k)=>value+(y[k]-value)*t)||null;
    const v={key:[a.key,b.key].sort().join(':'),membership:.5,p:blend(a.p,b.p),uv:blend(a.uv,b.uv),normal:blend(a.normal,b.normal),color:blend(a.color,b.color)};
    if(v.normal){normal.fromArray(v.normal).normalize();v.normal=normal.toArray();}return v;
  };
  const addVertex=v=>{
    if(!unique.has(v.key)){unique.set(v.key,unique.size);points.push(...v.p);uv.push(...v.uv);if(v.normal)normals.push(...v.normal);if(v.color)colors.push(...v.color);}
    return unique.get(v.key);
  };
  for(let i=0;i<(index?.count||g.attributes.position.count);i+=3) {
    const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    if(!triangle.some(id=>regions[id]===region))continue;
    // Clip the posed surface at the same interpolated .5 membership used by
    // the living-body shader. Never copy the connecting torso triangle whole.
    const polygon=[],input=triangle.map(sourceVertex);
    for(let j=0;j<3;j++){const a=input[j],b=input[(j+1)%3],inside=a.membership>=.5,nextInside=b.membership>=.5;if(inside)polygon.push(a);if(inside!==nextInside)polygon.push(edgeVertex(a,b));}
    for(let j=1;j<polygon.length-1;j++)ids.push(addVertex(polygon[0]),addVertex(polygon[j]),addVertex(polygon[j+1]));
  }
  if(!ids.length)return null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(ids);
  if(normals.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else geometry.computeVertexNormals();
  if(colors.length)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,g.attributes.color.itemSize));geometry.computeBoundingSphere();
  const material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).clone();
  delete material.userData.sharedLibrary;delete material.userData.sharedAsset;material.userData.afterlifeOwned=true;
  material.onBeforeCompile=()=>{};material.customProgramCacheKey=()=> 'brutal-detached-skin-v2';
  material.emissive?.setHex(0);material.emissiveIntensity=0;material.emissiveMap=null;material.envMapIntensity=.08;
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    vec3 detachedLimit=max(diffuseColor.rgb*.30,vec3(.004));reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/detachedLimit;reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.016);
  `);};
  const out=new THREE.Mesh(geometry,material);out.frustumCulled=false;return out;
}

export class BrutalCombatVisuals {
  constructor(renderer) {
    this.renderer=renderer;this.root=new THREE.Group();this.root.name='BrutalCombat';renderer.scene.add(this.root);
    this.actors=new Map();this.harvestRoots=new Set();this.fragments=[];this.poseRestore=[];this.seen=new Map();this.status='loading';this.armStatus='waiting';
    this.physics=new CorpsePhysics({maxRagdolls:4,maxDrops:12});this.bodySpear=new BodySpearVisuals(this);this.chest=new ChestFinisherVisuals(this);this.anatomy=new EnemyAnatomyVisuals(this);
    this.spray=createBloodDropletPool(BRUTAL_VISUAL_LIMITS.spray);this.spray.name='BrutalSpray';this.root.add(this.spray);
    this.drops=Array.from({length:BRUTAL_VISUAL_LIMITS.spray},()=>({start:new THREE.Vector3(),velocity:new THREE.Vector3(),at:-100,size:0,angle:0}));
    this.marker=new THREE.Object3D();this.point=new THREE.Vector3();this.target=new THREE.Vector3();this.pole=new THREE.Vector3();this.cameraPoint=new THREE.Vector3();this.axis=new THREE.Vector3();this.right=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.delta=new THREE.Quaternion();this.parentRotation=new THREE.Quaternion();this.scale=new THREE.Vector3();
    this.ready=loadAfterlifeModel(new GLTFLoader(),BRUTAL_ANATOMY_URL).then(asset=>{
      if(this.disposed){this.releaseAsset(asset.template);return;}
      this.asset=asset.template;this.status='ready';
      this.asset.traverse(mesh=>{if(!mesh.isMesh)return;for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        m.envMapIntensity=.12;m.emissive?.setHex(0);m.roughness=Math.max(.42,m.roughness);
        m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
          vec3 tissueLimit=max(diffuseColor.rgb*.30,vec3(.004)); reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/tissueLimit; reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.02);
        `);};m.customProgramCacheKey=()=> 'brutal-tissue-light-response-v1';
      }});
    }).catch(error=>{this.status='unavailable';this.error=String(error.message||error);});
    this.ready=Promise.all([this.ready,this.chest.ready,this.bodySpear.ready]);
  }
  component(name) {
    const source=this.asset?.getObjectByName(name);if(!source)return null;
    const part=source.clone(true);part.position.set(0,0,0);part.quaternion.identity();part.scale.setScalar(1);part.frustumCulled=false;return part;
  }
  prepareWarmup(roots=[]) {
    this.setupArms();
    const restores=[],bound=[],group=new THREE.Group();group.name='FinisherLoadingResources';this.root.add(group);
    for(const root of roots){
      if(!root.userData.afterlifeModel||this.actors.has(root))continue;
      this.bindActor(root);bound.push(root);const visible=root.visible;root.visible=true;restores.push(()=>root.visible=visible);
      root.traverse(mesh=>{if(!mesh.isMesh)return;const culled=mesh.frustumCulled;mesh.frustumCulled=false;restores.push(()=>mesh.frustumCulled=culled);});
    }
    for(const name of ['BodySpear_Entry','BodySpear_Exit','BodySpear_Tunnel']){const mesh=this.bodySpear?.component(name);if(mesh)group.add(mesh);}
    for(const name of ['ChestWound','Heart']){const mesh=this.chest?.component(name);if(mesh)group.add(mesh);}
    if(this.arms){const visible=this.arms.visible;this.arms.visible=true;restores.push(()=>this.arms.visible=visible);}
    let released=false;
    return()=>{if(released)return;released=true;group.removeFromParent();for(const root of bound)this.releaseActor(root);for(const restore of restores.reverse())restore();};
  }
  beginFrame() {
    // Capture the last solved ragdoll before the live mixer writes this frame.
    if(this.physics&&this.run)for(const [id,entry]of this.renderer._enemyVisuals){const enemy=this.run.course.enemies.find(e=>e.id===id);if(enemy&&!enemy.dead&&this.physics.has(entry.root)){this.captureRisePose(entry.root);this.physics.removeRagdoll(entry.root);}}
    setCounterGrip(this.counterGrip,{left:0,right:0});
    setCounterGrip(this.remoteGrip,{left:0,right:0});
    if(this.hiddenBody){this.hiddenBody.node.visible=this.hiddenBody.visible;this.hiddenBody=null;}
    for(let i=this.poseRestore.length-1;i>=0;i--){const p=this.poseRestore[i];p.node.position.copy(p.position);p.node.rotation.copy(p.rotation);}
    this.poseRestore.length=0;
  }
  save(node) {if(node)this.poseRestore.push({node,position:node.position.clone(),rotation:node.rotation.clone()});}
  captureRisePose(root){
    const state=root.userData.afterlife;if(!state||state.revivalPose)return;
    const bones=[];root.traverse(bone=>{if(bone.isBone)bones.push({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone()});});
    state.revivalPose={bones,pivotPosition:state.pivot.position.clone(),pivotQuaternion:state.pivot.quaternion.clone()};state.revivalStartedAt=null;
  }
  setupArms() {
    if(this.arms||!this.renderer._survivors?.template||this.renderer._survivors.armStatus==='loading')return;
    this.arms=cloneSkeleton(this.renderer._survivors.armTemplate||this.renderer._survivors.template);this.arms.name='BrutalSurvivorArms';this.arms.visible=false;this.root.add(this.arms);this.armBones={};this.armBase=[];
    const copies=new Map();
    this.arms.traverse(node=>{
      if(node.isBone){this.armBones[node.name]=node;this.armBase.push({node,p:node.position.clone(),q:node.quaternion.clone()});}
      if(node.isMesh){node.visible=node.name==='TLD_Remote_Arms';node.frustumCulled=false;node.castShadow=false;
        const copy=m=>{if(!copies.has(m))copies.set(m,m.clone());return copies.get(m);};node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
      }
    });
    this.counterGrip=addCounterGripRig(this.arms);
    this.armMaterials=[...copies.values()];this.armStatus='bundled-skinned-survivor';
    for(const material of this.armMaterials){
      material.color?.multiplyScalar(.70);material.emissive?.setHex(0);material.emissiveIntensity=0;material.emissiveMap=null;material.roughness=Math.max(.80,material.roughness);material.envMapIntensity=.08;
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
        vec3 handLimit=max(diffuseColor.rgb*.42,vec3(.004)); reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/handLimit; reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.018);
      `);};material.customProgramCacheKey=()=> 'brutal-hand-lantern-v1';
    }
  }
  bindActor(root) {
    if(this.actors.has(root))return this.actors.get(root);
    if(this.actors.size>=BRUTAL_VISUAL_LIMITS.woundedActors){const victim=[...this.actors.keys()].find(actor=>!this.harvestRoots?.has(actor))||this.actors.keys().next().value;this.releaseActor(victim);}
    const state={root,meshes:[],materials:new Map(),attachments:new THREE.Group(),wound:null,uniforms:{uBrutalKind:{value:0},uBrutalRegion:{value:0},uBrutalCenter:{value:new THREE.Vector3()},uBrutalRight:{value:new THREE.Vector3(1,0,0)},uBrutalUp:{value:UP.clone()},uBrutalFront:{value:FRONT.clone()}}};
    state.attachments.name='BrutalWoundAttachment';this.root.add(state.attachments);
    Object.assign(state.uniforms,{uHarvestOpen:{value:0},uHarvestExtent:{value:new THREE.Vector2(.18,.24)},uHarvestCenter:{value:new THREE.Vector3()},uHarvestRight:{value:new THREE.Vector3(1,0,0)},uHarvestUp:{value:UP.clone()},uHarvestFront:{value:FRONT.clone()}});
    Object.assign(state.uniforms,{uSpearOpen:{value:0},uSpearExtent:{value:new THREE.Vector2(.059,.075)},uSpearExitExtent:{value:new THREE.Vector2(.072,.087)},uSpearExitCenter:{value:new THREE.Vector3()},uSpearExitFront:{value:FRONT.clone().negate()}});
    root.traverse(mesh=>{
      if(!mesh.isSkinnedMesh)return;
      const regions=counterRegions(mesh),original=mesh.geometry,geometry=original.clone();delete geometry.userData.sharedAsset;
      geometry.userData.corpseSourceGeometry=original.uuid;
      const membership=new Float32Array(regions.length*3);
      for(let i=0;i<regions.length;i++)if(regions[i]>=3&&regions[i]<=5)membership[i*3+regions[i]-3]=1;
      geometry.setAttribute('brutalMembership',new THREE.Float32BufferAttribute(membership,3));mesh.geometry=geometry;
      // Native WebGPU caches each converted material's node graph. A cut
      // added after its first draw needs a fresh owned material, not just a
      // version bump on the already-converted uncut source.
      const sourceMaterial=mesh.material,ownedMaterials=(Array.isArray(sourceMaterial)?sourceMaterial:[sourceMaterial]).map(source=>{const m=source.clone();m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=source.customProgramCacheKey;state.materials.set(m,{compile:m.onBeforeCompile,cache:m.customProgramCacheKey});cutShader(m,state.uniforms);return m;});
      mesh.material=Array.isArray(sourceMaterial)?ownedMaterials:ownedMaterials[0];
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),distance=new THREE.MeshDistanceMaterial();cutShader(depth,state.uniforms);cutShader(distance,state.uniforms);
      state.meshes.push({mesh,regions,original,geometry,sourceMaterial,ownedMaterials,depth:mesh.customDepthMaterial,distance:mesh.customDistanceMaterial,ownedDepth:depth,ownedDistance:distance});mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
    });
    this.actors.set(root,state);return state;
  }
  setHarvestCut(root,frame,opening=0) {
    if(!root)return;
    this.harvestRoots ||= new Set();
    if(!frame){this.harvestRoots.delete(root);const state=this.actors.get(root);if(state)state.uniforms.uHarvestOpen.value=0;return;}
    this.harvestRoots.add(root);
    const state=this.bindActor(root),u=state.uniforms;
    u.uHarvestOpen.value=clamp(opening,0,1);u.uHarvestCenter.value.copy(frame.position);
    u.uHarvestRight.value.set(1,0,0).applyQuaternion(frame.quaternion);u.uHarvestUp.value.copy(UP).applyQuaternion(frame.quaternion);u.uHarvestFront.value.copy(FRONT).applyQuaternion(frame.quaternion);
    u.uHarvestExtent.value.set(.183*frame.scale.x,.245*frame.scale.y);
  }
  releaseActor(root) {
    const state=this.actors.get(root);if(!state)return;
    this.harvestRoots?.delete(root);
    this.chest?.releaseWound(state);
    state.tissueRig?.dispose();
    for(const entry of state.meshes){entry.mesh.geometry=entry.original;entry.mesh.material=entry.sourceMaterial;entry.ownedMaterials.forEach(m=>m.dispose());entry.geometry.dispose();entry.ownedDepth.dispose();entry.ownedDistance.dispose();entry.mesh.customDepthMaterial=entry.depth;entry.mesh.customDistanceMaterial=entry.distance;}
    for(const [material,hooks]of state.materials){material.onBeforeCompile=hooks.compile;material.customProgramCacheKey=hooks.cache;material.needsUpdate=true;}
    state.uniforms.uBrutalKind.value=0;state.attachments.removeFromParent();this.actors.delete(root);
  }
  anchor(root,wound) {
    return root.getObjectByName(wound.type==='pierce'?'Socket_Chest':wound.type==='twist'?'Socket_Neck':wound.type==='rip'?'Socket_Abdomen':(wound.side==='left'?'LeftArm':'RightArm'))||root;
  }
  attachWound(state,wound) {
    state.tissueRig?.dispose();state.tissueRig=null;this.chest?.releaseWound(state);
    state.wound=wound;state.cutCenterLocal=null;state.capScale=null;state.bodySpear=null;state.uniforms.uSpearOpen.value=0;state.attachments.clear();
    if(wound.type==='pierce'){this.chest?.addWound(state);return;}
    const cap=this.component(wound.type==='twist'?'NeckWound':wound.type==='rip'?'AbdomenWound':'ArmWound');if(cap)state.attachments.add(cap);
    if(wound.type==='rip'){const bundle=this.component('IntestinalBundle');if(bundle){bundle.name='AttachedIntestines';bundle.position.set(0,-.075,.07);state.tissueRig=addSoftTissueCompliance(bundle,{axis:'y',anchorEnd:'max',sag:.025,bend:.012});state.attachments.add(bundle);}}
  }
  fitCut(state) {
    const {root,wound}=state;if(wound.type==='rip'||wound.type==='pierce')return;
    const anchor=this.anchor(root,wound),origin=anchor.getWorldPosition(new THREE.Vector3()),center=new THREE.Vector3(),points=[];
    const region=wound.type==='twist'?5:wound.side==='left'?3:4;let length=0;
    for(const entry of state.meshes){const boundary=counterCutBoundary(entry.mesh,entry.regions,region,origin);center.addScaledVector(boundary.center,boundary.length);length+=boundary.length;points.push(...boundary.points);}
    if(length<=1e-7)return;center.divideScalar(length).add(origin);state.cutCenterLocal=anchor.worldToLocal(center.clone());
    const next=root.getObjectByName(wound.type==='twist'?'Head':wound.side==='left'?'LeftForeArm':'RightForeArm');if(!next)return;
    const axis=next.getWorldPosition(new THREE.Vector3()).sub(center).normalize(),frame=new THREE.Quaternion().setFromUnitVectors(FRONT,axis).invert();
    const bounds=new THREE.Box3();for(const p of points)bounds.expandByPoint(p.clone().add(origin).sub(center).applyQuaternion(frame));
    const cap=state.attachments.children[0],size=cap?new THREE.Box3().setFromObject(cap).getSize(new THREE.Vector3()):null;
    if(size&&size.x>0&&size.y>0){
      const normalization=root.userData.afterlife?.normalization||1,span=bounds.getSize(new THREE.Vector3());
      state.capScale=new THREE.Vector3(clamp(span.x/(size.x*normalization)*1.05,.6,1.35),clamp(span.y/(size.y*normalization)*1.05,.6,1.35),1);
      state.capScale.z=Math.min(state.capScale.x,state.capScale.y);cap.scale.copy(state.capScale);
    }
  }
  placeWound(state,gore) {
    const {root,wound,attachments,uniforms}=state,anchor=this.anchor(root,wound);
    if(state.cutCenterLocal)anchor.localToWorld(attachments.position.copy(state.cutCenterLocal));else anchor.getWorldPosition(attachments.position);
    root.getWorldQuaternion(this.rotation);this.axis.set(0,0,-1).applyQuaternion(this.rotation);
    if(wound.type==='twist'){
      root.getObjectByName('Head')?.getWorldPosition(this.point);this.axis.copy(this.point).sub(attachments.position).normalize();attachments.quaternion.setFromUnitVectors(FRONT,this.axis);
    }else if(wound.type==='chop'){
      root.getObjectByName(wound.side==='left'?'LeftForeArm':'RightForeArm')?.getWorldPosition(this.point);this.axis.copy(this.point).sub(attachments.position).normalize();attachments.quaternion.setFromUnitVectors(FRONT,this.axis);
    }else{
      // The socket has centimetre-scale parents; copy its world frame into a
      // metre-scale group instead of inheriting a .01 attachment scale.
      anchor.getWorldQuaternion(attachments.quaternion);
    }
    attachments.scale.setScalar(root.userData.afterlife?.normalization||1);attachments.visible=gore&&root.visible&&this.status==='ready';
    uniforms.uBrutalKind.value=gore?({chop:1,twist:2,rip:3,pierce:4}[wound.type]||0):0;
    uniforms.uBrutalRegion.value=wound.type==='twist'?5:wound.side==='left'?3:4;
    uniforms.uBrutalCenter.value.copy(attachments.position);uniforms.uBrutalRight.value.set(1,0,0).applyQuaternion(attachments.quaternion);uniforms.uBrutalUp.value.copy(UP).applyQuaternion(attachments.quaternion);uniforms.uBrutalFront.value.copy(FRONT).applyQuaternion(attachments.quaternion);
    if(wound.type==='pierce')this.bodySpear?.placeWound(state,gore);
  }
  emit(root,wound,time) {
    this.anchor(root,wound).getWorldPosition(this.point);
    if(wound.type==='pierce'){const state=this.actors.get(root),entry=state?.bodySpear&&this.bodySpear.frame(root,wound.sequence,true)?.entry;if(entry)this.point.copy(entry);}
    const origin=this.point.clone(),region=wound.type==='twist'?5:wound.side==='left'?3:4;
    if(wound.type!=='rip'&&wound.type!=='pierce'){
      const state=this.actors.get(root),piece=new THREE.Group();piece.name='Detached_'+(wound.type==='twist'?'Head':wound.side+'Arm');
      for(const entry of state.meshes){const mesh=captureCounterPart(entry.mesh,entry.regions,region,origin);if(mesh)piece.add(mesh);}
      const center=new THREE.Box3().setFromObject(piece,true).getCenter(new THREE.Vector3());
      const cap=this.component(wound.type==='twist'?'NeckWound':'ArmWound');if(cap){
        const next=root.getObjectByName(wound.type==='twist'?'Head':wound.side==='left'?'LeftForeArm':'RightForeArm');
        const cut=state.cutCenterLocal?this.anchor(root,wound).localToWorld(state.cutCenterLocal.clone()):origin.clone();cap.position.copy(cut).sub(origin);
        next?.getWorldPosition(this.point);this.axis.copy(cut).sub(this.point).normalize();
        cap.quaternion.setFromUnitVectors(FRONT,this.axis);cap.scale.copy(state.capScale||new THREE.Vector3(1,1,1)).multiplyScalar(root.userData.afterlife?.normalization||1);piece.add(cap);
      }
      let holdYaw=0;
      if(wound.type==='twist'){
        const face=root.getObjectByName('Jaw')||root.getObjectByName('Head'),owner=wound.playerId==='peer'?this.run?.peer:this.run;
        if(face&&owner){face.getWorldQuaternion(this.rotation);this.axis.copy(FRONT).applyQuaternion(this.rotation);this.point.set(owner.x*4,origin.y,owner.y*4).sub(origin);
          const angle=Math.atan2(this.point.x,this.point.z)-Math.atan2(this.axis.x,this.axis.z);holdYaw=Math.atan2(Math.sin(angle),Math.cos(angle))+.25*(wound.side==='left'?-1:1);}
      }
      if(piece.children.length){piece.position.copy(origin);this.root.add(piece);this.fragments.push({piece,center,origin,time,holdYaw,enemyId:root.userData.brutalEnemyId,kind:wound.type,delay:wound.type==='twist'?.32:0,spin:(wound.side==='left'?-1:1),velocity:new THREE.Vector3((wound.side==='left'?-1:1)*.75,1.05,.3)});}
      while(this.fragments.length>BRUTAL_VISUAL_LIMITS.fragments)this.releaseFragment(this.fragments.shift());
    }
    for(let i=0;i<20;i++){
      const d=this.drops[(this.cursor=(this.cursor||0)+1)%this.drops.length],a=i*2.399+wound.sequence;
      d.start.copy(origin);d.velocity.set(Math.cos(a)*1.05,.3+(i%4)*.24,Math.sin(a)*.9);d.at=time;d.size=.0025+(i%3)*.0015;d.angle=a;
    }
    if(this.renderer.renderer)this.renderer.renderer.shadowMap.needsUpdate=true;
  }
  playerPoint(point,run,remote) {
    if(!remote)return this.renderer.camera.localToWorld(point);
    const yaw=-run.angle-Math.PI/2,x=point.x,z=point.z;
    // Serialized host players carry support coordinates, but no course. Resolve
    // their floor in the receiving world so stair/terrain grips stay in parity.
    const pose=run.course?run:{...run,course:run.world?.course||this.run?.course};
    return point.set(run.x*4+x*Math.cos(yaw)+z*Math.sin(yaw),eye(pose)*4+point.y,run.y*4+z*Math.cos(yaw)-x*Math.sin(yaw));
  }
  playerRotation(run,remote) {
    if(remote)return this.rotation.setFromEuler(new THREE.Euler(0,-run.angle-Math.PI/2,0));
    return this.renderer.camera.getWorldQuaternion(this.rotation);
  }
  pose(run,remote=false) {
    const b=run.brutal,r=this.renderer,active=b&&b.phase!=='idle'&&b.phase!=='cancelled';
    if(!remote){this.active=!!active;this.kind=active?b.kind:'idle';this.hands=0;this.contactDistances=[];this.pickupView=false;this.recoveryRetreat=0;if(this.arms)this.arms.visible=false;}
    else this.peerContactDistances=[];
    if(!active||run.health<=0||run.playerWounds?.leftArm==='severed'||run.playerWounds?.rightArm==='severed')return;
    const root=r._enemyVisuals.get(b.enemyId)?.root;if(!root)return;
    if(this.tracePose&&!remote)this.poseStages=[poseFrame(root,run,'input')];
    const t=Number(b.elapsed)||0,contact=b.contactAt||.22,duration=b.duration||.9;
    const recoveryDip=b.kind==='pierce'?smooth(1.02,1.18,t)*(1-smooth(1.32,duration,t)):0;
    const enter=smooth(0,Math.max(.08,contact*.8),t),leave=1-smooth(duration-.22,duration,t),envelope=enter*leave;
    if(!remote){this.envelope=envelope;r.weaponGroups.forEach(g=>g.visible=false);
      const body=r._survivors?.local;if(body){this.hiddenBody={node:body,visible:body.visible};body.visible=false;}
    }
    const released=this.physics?.has(root)&&!this.physics.isHeld(root);
    if(!released){
    this.save(root);this.cameraPoint.set(0,0,0);this.playerPoint(this.cameraPoint,run,remote);this.point.copy(this.cameraPoint).sub(root.position);this.point.y=0;
    // Bring the victim into fixed arm reach while the local shoulder cuts
    // remain behind the body camera. Peer body placement keeps its own rig.
    const distance=this.point.length(),gap=b.kind==='pierce'?.44:remote?(b.kind==='rip'?.76:.66):(b.kind==='twist'?.36:.40);
    root.position.addScaledVector(this.point.normalize(),clamp(distance-gap,b.kind==='rip'?-.35:0,b.kind==='pierce'?.55:remote?.35:.55)*envelope);root.updateMatrixWorld(true);
    // A counter has an authored upper-body pose. Locomotion/recoil clips keep
    // their lower-body ownership, but cannot spin the wound away at contact.
    const template=root.userData.afterlife?.sourceTemplate||r._ashWitnessAsset?.template;
    const pivot=root.userData.afterlife?.pivot;
    if(pivot&&b.kind==='pierce'){this.save(pivot);pivot.quaternion.slerp(new THREE.Quaternion(),envelope);pivot.position.y*=1-envelope;pivot.position.z*=1-envelope;}
    const poseWeight=envelope*(b.kind==='twist'&&b.contactApplied?1-smooth(contact+.32,duration,t):1);
    for(const name of ['Hips','Spine02','Spine01','Spine','neck','Head']){
      const node=root.getObjectByName(name),base=template?.getObjectByName(name);if(!node||!base)continue;
      this.save(node);node.quaternion.slerp(base.quaternion,poseWeight);if(name==='Hips')node.position.lerp(base.position,poseWeight);
    }
    root.updateMatrixWorld(true);
    if(this.tracePose&&!remote)this.poseStages.push(poseFrame(root,run,'rest'));
    // Imported bone rest frames are not the renderer's -Z actor frame. Aim
    // the authored chest socket itself rather than assuming a root yaw alone
    // also faces a blended skeleton toward the victim.
    const chest=root.getObjectByName('Socket_Chest');
    root.rotation.set(0,-Math.atan2(run.y*4-root.position.z,run.x*4-root.position.x)-Math.PI/2,0);root.updateMatrixWorld(true);
    if(chest){
      chest.getWorldQuaternion(this.rotation);this.axis.copy(FRONT).applyQuaternion(this.rotation);this.axis.y=0;
      chest.getWorldPosition(this.point);this.cameraPoint.set(run.x*4,0,run.y*4).sub(this.point);this.cameraPoint.y=0;
      if(this.axis.lengthSq()>.001&&this.cameraPoint.lengthSq()>.001){
        const correction=Math.atan2(this.cameraPoint.x,this.cameraPoint.z)-Math.atan2(this.axis.x,this.axis.z);
        root.rotation.y+=Math.atan2(Math.sin(correction),Math.cos(correction))*envelope;root.updateMatrixWorld(true);
      }
    }
    if((b.kind==='rip'||b.kind==='pierce')&&!remote)r.camera.rotation.x-=envelope*(b.kind==='pierce'?.30:.50);
    if(!remote&&(b.kind==='twist'||b.kind==='chop'))r.camera.rotation.x+=envelope*(b.kind==='twist'?.26:.16);
    if(this.tracePose&&!remote)this.poseStages.push(poseFrame(root,run,'facing'));
    const head=root.getObjectByName('Head'),spine=root.getObjectByName('Spine02');
    if(head&&b.kind==='twist'){
      this.save(head);head.parent.getWorldQuaternion(this.parentRotation).invert();this.axis.copy(UP).applyQuaternion(this.parentRotation);
      this.delta.setFromAxisAngle(this.axis,(smooth(.07,contact+.08,t)*1.62)*leave);head.quaternion.premultiply(this.delta);
    }
    if(b.kind==='pierce')applyBodySpearReaction(root,t,poseWeight,node=>this.save(node));
    if(spine&&b.kind==='rip'){
      this.save(spine);spine.rotation.x-=.10*smooth(.08,contact+.26,t)*leave;root.updateMatrixWorld(true);
      for(const [prefix,side]of [['Left',-1],['Right',1]]){
        const upper=root.getObjectByName(prefix+'Arm'),lower=root.getObjectByName(prefix+'ForeArm'),hand=root.getObjectByName(prefix+'Hand');if(!upper||!lower||!hand)continue;
        this.save(upper);this.save(lower);this.point.set(side*.28,.95,0);root.localToWorld(this.point);this.pole.set(side*.60,1.05,.20);root.localToWorld(this.pole);reachBiteArm(upper,lower,hand,this.point,this.pole,envelope);
      }
    }
    }
    root.updateMatrixWorld(true);
    if(!remote&&recoveryDip>0){r.cameraRig.position.y-=.92*recoveryDip;r.cameraRig.position.x+=Math.cos(run.angle)*.34*recoveryDip;r.cameraRig.position.z+=Math.sin(run.angle)*.34*recoveryDip;r.camera.rotation.x-=.38*recoveryDip;r.cameraRig.updateMatrixWorld(true);}
    if(this.tracePose&&!remote)this.poseStages.push(poseFrame(root,run,'spine'));
    const target=root.getObjectByName(b.kind==='pierce'?'Socket_Chest':b.kind==='rip'?'Socket_Abdomen':b.kind==='twist'?'Head':b.side==='left'?'LeftArm':'RightArm');
    if(target)target.getWorldPosition(this.target);else this.target.copy(root.position).add(new THREE.Vector3(0,1.35,0));
    const spearFrame=b.kind==='pierce'?this.bodySpear?.frame(root,b.sequence,!!b.contactApplied):null;
    if(spearFrame)this.target.copy(spearFrame.entry);
    if(b.kind==='twist'&&b.contactApplied&&r.settings.gore){const fragment=this.fragments.find(f=>f.enemyId===b.enemyId&&f.kind==='twist');if(fragment)this.target.copy(fragment.center).applyMatrix4(fragment.piece.matrixWorld);}
    let pickupView=false;
    const arms=remote?r._survivors?.peer:this.arms,bones=remote?arms?.userData.bones:this.armBones;
    if(arms&&bones){
      if(remote&&!this.remoteGrip)this.remoteGrip=addCounterGripRig(arms);
      if(remote&&spearFrame&&t<b.releaseAt){
        // The peer's animated full-body shoulders differ from the dedicated
        // view arms. Step the presentation toward the paired contact rather
        // than stretching either imported arm segment.
        const upper=bones.RightArm,lower=bones.RightForeArm,hand=bones.RightHand;
        if(upper&&lower&&hand){
          const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=lower.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3());
          const goal=chestHandPoint('Right',t,{...b,spearDepth:spearFrame.depth}).applyQuaternion(spearFrame.rotation).add(spearFrame.entry),reach=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist);
          const excess=Math.max(0,shoulder.distanceTo(goal)-reach*.985);
          if(excess>0){this.save(arms);const forward=goal.sub(shoulder);forward.y=0;arms.position.addScaledVector(forward.normalize(),Math.min(.18,excess+.015)*envelope);arms.updateMatrixWorld(true);}
        }
      }
      if(!remote){for(const p of this.armBase){p.node.position.copy(p.p);p.node.quaternion.copy(p.q);}
        // The higher reduced-motion eye mount needs slightly closer shoulders
        // for a two-hand head grip, while the sleeve cuts remain offscreen.
        const shoulderDepth=(b.kind==='pierce'?.05:b.kind==='rip'?-.21:b.kind==='twist'?-.13:-.18)+.18*recoveryDip;
        arms.position.set(run.x*4+Math.cos(run.angle)*shoulderDepth,(actorGroundAt(run.course,run)+(run.z||0))*4-.12-.92*recoveryDip,run.y*4+Math.sin(run.angle)*shoulderDepth);arms.rotation.set(0,-run.angle-Math.PI/2,0);arms.updateMatrixWorld(true);arms.visible=envelope>.001;
        // A falling body can deflect the gun sideways. Lean toward its actual
        // grip using the imported arm lengths, rather than a fixed floor mark.
        const weapon=this.chest?.weapon;
        // The gameplay grip target ends before the presentation blend. Keep
        // its frozen floor anchor through the camera/shoulder return to idle.
        const pickup=this.chest?.retrievePoint(run)??(b.kind==='pierce'&&weapon?.retrieved?weapon.pickupAnchor:null);
        if(pickup&&weapon&&bones.RightArm&&bones.RightForeArm&&bones.RightHand){
          const shoulder=bones.RightArm.getWorldPosition(new THREE.Vector3()),elbow=bones.RightForeArm.getWorldPosition(new THREE.Vector3()),wrist=bones.RightHand.getWorldPosition(new THREE.Vector3());
          const reach=(shoulder.distanceTo(elbow)+elbow.distanceTo(wrist))*.94;
          weapon.recoveryLean??=new THREE.Vector3();
          if(!weapon.retrieved){
            const vertical=pickup.y-(shoulder.y-.92*(1-recoveryDip)),horizontal=pickup.clone().sub(shoulder);horizontal.y=0;
            const allowed=Math.sqrt(Math.max(.01,reach*reach-vertical*vertical));
            weapon.recoveryLean.copy(horizontal).normalize().multiplyScalar(clamp(horizontal.length()-allowed+.035,0,.50));
          }
          const lean=weapon.recoveryLean.clone().multiplyScalar(smooth(1.05,1.23,t)*(1-smooth(1.34,duration,t)));
          arms.position.add(lean);r.cameraRig.position.add(lean);r.cameraRig.updateMatrixWorld(true);arms.updateMatrixWorld(true);
          // Frame the physical floor pickup from beside the corpse. Resolve
          // eyes and shoulder roots together before IK; a later eye-only
          // retreat exposes the cut sleeves and breaks this shared frame.
          const weight=smooth(1.08,1.22,t)*(1-smooth(1.34,duration,t));
          weapon.pickupAnchor??=pickup.clone();
          if(!weapon.retrieved)weapon.pickupAnchor.copy(pickup);
          const forward=new THREE.Vector3(Math.cos(run.angle),0,Math.sin(run.angle));
          const right=new THREE.Vector3(-Math.sin(run.angle),0,Math.cos(run.angle));
          const lateral=weapon.pickupAnchor.clone().sub(new THREE.Vector3(run.x*4,0,run.y*4)).dot(right);
          const side=lateral>.10?1:-1;
          const eye=weapon.pickupAnchor.clone().addScaledVector(right,side>0?.23:-.40).addScaledVector(forward,-.22);eye.y+=.44;
          const horizontal=eye.clone().sub(new THREE.Vector3(run.x*4,eye.y,run.y*4)),distance=horizontal.length();
          if(distance>1e-5){const wall=castRay(run.course,run.x,run.y,Math.atan2(horizontal.z,horizontal.x),distance/4+.03);horizontal.multiplyScalar(Math.min(1,1.05/distance,Math.max(0,wall.dist*4-.09)/distance));eye.x=run.x*4+horizontal.x;eye.z=run.y*4+horizontal.z;}
          r.camera.getWorldPosition(this.cameraPoint);r.cameraRig.position.add(eye.sub(this.cameraPoint).multiplyScalar(weight));r.cameraRig.updateMatrixWorld(true);
          if(!r.settings.reducedMotion){this.cameraPoint.copy(weapon.pickupAnchor);r.camera.worldToLocal(this.cameraPoint);r.camera.rotation.y+=clamp(Math.atan2(-this.cameraPoint.x,-this.cameraPoint.z),-.45,.45)*weight;r.camera.rotation.x+=clamp(Math.atan2(this.cameraPoint.y,Math.hypot(this.cameraPoint.x,this.cameraPoint.z)),-.18,.18)*weight;r.cameraRig.updateMatrixWorld(true);}
          const middle=bones.LeftArm.getWorldPosition(new THREE.Vector3()).add(bones.RightArm.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
          const anchor=r.camera.localToWorld(new THREE.Vector3(side>0?-.15:0,side>0?-.49:-.30,side>0?-.06:.08));
          arms.position.add(anchor.sub(middle).multiplyScalar(weight));arms.updateMatrixWorld(true);pickupView=true;this.pickupView=true;
        }
      }
      for(const [prefix,side] of [['Left',-1],['Right',1]]){
        const upper=bones[prefix+'Arm'],lower=bones[prefix+'ForeArm'],hand=bones[prefix+'Hand'];if(!upper||!lower||!hand)continue;
        if(remote){this.save(upper);this.save(lower);this.save(hand);}
        this.point.copy(this.target);
        if(b.kind==='pierce'){
          if(target){if(spearFrame)this.rotation.copy(spearFrame.rotation);else target.getWorldQuaternion(this.rotation);this.point.copy(chestHandPoint(prefix,t,spearFrame?{...b,spearDepth:spearFrame.depth}:b)).applyQuaternion(this.rotation).add(this.target);}
          const home=new THREE.Vector3(side*.23,-.30,-.30);this.playerPoint(home,run,remote);
          this.point.lerp(home,1-enter);
          if(t>=b.releaseAt)this.point.lerp(home,smooth(b.releaseAt,duration-.05,t));
          if(!remote&&prefix==='Right'){
            const weapon=this.chest?.weapon;
            const retrieval=(weapon?.retrieved&&weapon.pickupAnchor)||this.chest?.retrievePoint(run);
            // Hold the real floor contact through grab, then return from its
            // frozen anchor rather than chasing the already attached gun.
            if(retrieval)this.point.lerp(retrieval,smooth(1.08,1.23,t)*(1-smooth(1.32,1.43,t)));
          }
        }else if(b.kind==='chop'){
          // Open hand sweeps down and across the shoulder contact plane.
          const cutting=prefix===(b.side==='left'?'Right':'Left');
          this.cameraPoint.set(side*.30,cutting?.19:-.43,cutting?-.43:-.38);this.playerPoint(this.cameraPoint,run,remote);
          if(!cutting)this.point.copy(this.cameraPoint);
          else if(t<contact)this.point.lerp(this.cameraPoint,1-smooth(contact*.3,contact,t));
          else{this.cameraPoint.set(side*.06,-.44,-.50);this.playerPoint(this.cameraPoint,run,remote);this.point.lerp(this.cameraPoint,smooth(contact,contact+.18,t)*.75);}
        }else{
          // Targets are wrist joints; the scanned palm/fingertips extend
          // above them. Place the wrists below the head's actual grip centre.
          this.playerRotation(run,remote);this.right.set(side*(b.kind==='twist'?.14:.085),b.kind==='twist'?-.12:-.035,0).applyQuaternion(this.rotation);this.point.add(this.right);
          if(b.kind==='rip'){this.cameraPoint.set(side*.12,-.24,-.52);this.playerPoint(this.cameraPoint,run,remote);this.point.lerp(this.cameraPoint,smooth(contact,contact+.42,t)*.88);}
        }
        this.pole.set(side*.72,-.50,-.25);
        if(b.kind==='pierce'&&prefix==='Right'){const held=smooth(b.extractionAt-.16,b.extractionAt+.04,t)*(1-smooth(b.releaseAt,1.08,t));this.pole.x+=.08*held;this.pole.y-=.055*held;}
        this.playerPoint(this.pole,run,remote);
        const reachWeight=b.kind==='pierce'&&t>1.08&&t<1.35?1:envelope;
        if(reachBiteArm(upper,lower,hand,this.point,this.pole,reachWeight)&&!remote)this.hands++;
        // Orient the actual wrist first; additive weighted support joints curl
        // the distal finger cluster after this arm/hand solve.
        this.playerRotation(run,remote);hand.parent.getWorldQuaternion(this.parentRotation).invert();
        if(b.kind==='pierce'){
          const grip=smooth(b.extractionAt-.24,b.extractionAt+.05,t);
          const held=smooth(b.extractionAt-.16,b.extractionAt+.04,t)*(1-smooth(b.releaseAt,1.08,t));
          this.delta.setFromEuler(new THREE.Euler(prefix==='Right'?THREE.MathUtils.lerp(-1.42,-.28,grip):.12,prefix==='Right'?.18*held:0,side*.10));
        }else this.delta.setFromEuler(new THREE.Euler(b.kind==='chop'?.8:.15,side*.2,b.kind==='chop'?-.65*side:.7*side));
        hand.quaternion.slerp(this.parentRotation.multiply(this.rotation).multiply(this.delta),envelope*.85);
        hand.updateMatrixWorld(true);
        if(b.kind==='pierce'&&prefix==='Right'&&spearFrame){
          const longitudinal=(remote?this.remoteGrip:this.counterGrip)?.hands.right?.measurements.longitudinalAxis||[0,1,0];
          hand.getWorldQuaternion(this.rotation);this.axis.fromArray(longitudinal).applyQuaternion(this.rotation).normalize();this.right.copy(spearFrame.front).negate();
          this.delta.setFromUnitVectors(this.axis,this.right).multiply(this.rotation);hand.parent.getWorldQuaternion(this.parentRotation).invert();
          hand.quaternion.slerp(this.parentRotation.multiply(this.delta),envelope*(1-smooth(.48,.65,t)));hand.updateMatrixWorld(true);
        }
        hand.getWorldPosition(this.cameraPoint);(remote?this.peerContactDistances:this.contactDistances).push({side:prefix,distance:this.cameraPoint.distanceTo(this.point)});
      }
      {
        const heartGrip=b.kind==='pierce'?smooth(b.extractionAt-.11,b.extractionAt+.04,t)*(1-smooth(b.releaseAt-.02,b.releaseAt+.08,t)):0;
        const gunGrip=b.kind==='pierce'?smooth(1.28,1.35,t)*(1-smooth(1.44,duration,t)):0;
        const otherGrip=b.kind==='twist'?.72*envelope:b.kind==='rip'?.55*envelope:0;
        const spearGrip=b.kind==='pierce'&&t<b.extractionAt-.11?envelope:0;
        setCounterGrip(remote?this.remoteGrip:this.counterGrip,{left:b.kind==='pierce'?.24*envelope:otherGrip,right:Math.max(spearGrip,heartGrip,gunGrip,otherGrip),leftMode:'brace',rightMode:spearGrip?'spear':gunGrip>heartGrip?'gun':b.kind==='pierce'?'heart':'brace'});
        arms.updateMatrixWorld(true);
      }
    }
    if(!remote&&!pickupView&&recoveryDip>0&&this.physics){
      r.camera.getWorldPosition(this.cameraPoint);this.right.set(-Math.cos(run.angle),0,-Math.sin(run.angle));
      const retreat=cameraRetractionDistance(this.cameraPoint,this.right,this.physics.get(root)?.nodes,.28*recoveryDip,.42*recoveryDip);
      this.recoveryRetreat=retreat;
      r.cameraRig.position.addScaledVector(this.right,retreat);r.cameraRig.updateMatrixWorld(true);
    }
    if(!remote&&!r.settings.reducedMotion){
      const pickup=this.chest?.retrievePoint(run);
      if(pickup&&!pickupView&&recoveryDip>0){r.camera.updateWorldMatrix(true,false);this.cameraPoint.copy(pickup);r.camera.worldToLocal(this.cameraPoint);r.camera.rotation.y+=clamp(Math.atan2(-this.cameraPoint.x,-this.cameraPoint.z),-.45,.45)*recoveryDip;r.camera.rotation.x+=clamp(Math.atan2(this.cameraPoint.y,Math.hypot(this.cameraPoint.x,this.cameraPoint.z)),-.18,.18)*recoveryDip;}
      r.camera.rotation.z+=(b.side==='left'?-1:1)*Math.sin(Math.PI*clamp(t/duration,0,1))*.045;r.camera.rotation.x-=Math.exp(-Math.pow((t-contact)/.055,2))*.028;
    }
    if(this.tracePose&&!remote)this.poseStages.push(poseFrame(root,run,'hands'));
  }
  update(run) {
    this.setupArms();
    if(this.run!==run||this.course!==run.course){for(const root of [...this.actors.keys()])this.releaseActor(root);for(const f of this.fragments)this.releaseFragment(f);this.fragments=[];this.seen.clear();this.anatomy?.reset();for(const d of this.drops)d.at=-100;this.chest?.reset();this.physics?.rebuild(run.course);this.run=run;this.course=run.course;}
    if(this.anatomyCourse!==run.course){this.anatomy?.reset();this.anatomyCourse=run.course;}
    const roots=new Set([...this.renderer._enemyVisuals.values()].map(entry=>entry.root));for(const root of this.actors.keys())if(!roots.has(root))this.releaseActor(root);
    if(this.physics)for(const root of [...this.physics.rigs.keys(),...this.physics.frozen.keys()])if(!roots.has(root))this.physics.removeRagdoll(root);
    this.chest?.dropWeapon(run);this.pose(run);
    if(run.peer)this.pose(run.peer,true);
    this.anatomy?.update(run,this.renderer._enemyVisuals);
    while(this.fragments.length>BRUTAL_VISUAL_LIMITS.fragments)this.releaseFragment(this.fragments.shift());
    if(this.physics){
      this.physics.syncCourseWalls(run.course);
      for(const [id,entry] of this.renderer._enemyVisuals){
        const enemy=run.course.enemies.find(e=>e.id===id);if(!enemy||!entry.root.userData.afterlifeModel)continue;
        if(!enemy.dead){if(this.physics.has(entry.root)){this.captureRisePose(entry.root);this.physics.removeRagdoll(entry.root);}continue;}
        const owner=[run,run.peer].find(p=>p?.brutal?.enemyId===id&&p.brutal.phase!=='idle');
        const release=owner?.brutal.kind==='pierce'?owner.brutal.releaseAt:owner?.brutal.kind==='twist'?owner.brutal.contactAt+.32:owner?.brutal.duration;
        const held=!!owner&&owner.brutal.elapsed<(release??0);
        this.physics.ensureRagdoll(entry.root,enemy,{held,impulse:new THREE.Vector3(Math.cos(owner?.angle??run.angle)*1.15,.16,Math.sin(owner?.angle??run.angle)*1.15)});
      }
      this.physics.update(run);this.physics.sync();
      this.anatomy?.capturePoses(run,this.renderer._enemyVisuals);
    }
    const gore=this.renderer.settings.gore,time=combatWorldTime(run);
    // Select a stable, nearby wound set before allocating. Cycling through
    // every wounded corpse would evict/rebuild the entire pool each frame.
    const candidates=(run.course?.enemies||[]).filter(enemy=>(enemy.brutalWound||this.harvestRoots?.has(this.renderer._enemyVisuals.get(enemy.id)?.root))&&this.renderer._enemyVisuals.get(enemy.id)?.root?.userData.afterlifeModel)
      .sort((a,b)=>Number(!!this.harvestRoots?.has(this.renderer._enemyVisuals.get(b.id)?.root))-Number(!!this.harvestRoots?.has(this.renderer._enemyVisuals.get(a.id)?.root))||Number(a.dead)-Number(b.dead)||Math.hypot(a.x-run.x,a.y-run.y)-Math.hypot(b.x-run.x,b.y-run.y)||a.id-b.id).slice(0,BRUTAL_VISUAL_LIMITS.woundedActors);
    const selected=new Set(candidates.map(enemy=>this.renderer._enemyVisuals.get(enemy.id).root));for(const root of this.actors.keys())if(!selected.has(root))this.releaseActor(root);
    for(const enemy of candidates){
      const wound=enemy.brutalWound,root=this.renderer._enemyVisuals.get(enemy.id)?.root;if(!wound||!root||!root.userData.afterlifeModel||this.status!=='ready')continue;
      root.userData.brutalEnemyId=enemy.id;
      const state=this.bindActor(root);
      if(state.wound?.sequence!==wound.sequence||state.wound?.playerId!==wound.playerId){this.attachWound(state,wound);this.fitCut(state);}
      state.wound=wound; // Network snapshots replace the authoritative wound object.
      this.placeWound(state,gore);
      if(wound.type==='pierce'){
        if(!state.heart&&this.chest?.status==='ready')this.chest.addWound(state);
        if(!state.bodySpear&&this.bodySpear?.status==='ready'){
          const previous=state.chestWound,entry=this.bodySpear.addWound(state);
          if(entry){previous?.removeFromParent();state.chestWound=entry;this.bodySpear.placeWound(state,gore);}
        }
        this.chest?.updateWound(state,run,gore);
      }
      const key=String(enemy.id)+':'+wound.playerId+':'+wound.sequence;
      if(!this.seen.has(key)){this.seen.set(key,true);if(time-(wound.at||0)<.35){this.emit(root,wound,time);if(wound.type==='pierce')this.bodySpear?.emitExit(state,wound,time);}}
      if(this.seen.size>256)this.seen.delete(this.seen.keys().next().value);
      const bundle=state.attachments.getObjectByName('AttachedIntestines');
      if(bundle){
        const age=Math.max(0,time-(wound.at||0)),owner=[run,run.peer].find(p=>p?.brutal?.enemyId===enemy.id&&p.brutal.kind==='rip'&&p.brutal.phase!=='idle');
        bundle.position.set(0,-.075-.16*smooth(0,.55,age),.07+.04*smooth(0,.55,age));
        if(owner){this.point.set(0,-.12,-.52);this.playerPoint(this.point,owner,owner!==run);state.attachments.updateMatrixWorld(true);state.attachments.worldToLocal(this.point);bundle.position.lerp(this.point,smooth(0,.34,age));}
        bundle.rotation.z=Math.sin(age*5+wound.sequence)*.07*Math.exp(-age*.6);
        state.tissueRig?.set({sag:smooth(0,.55,age),bend:Math.sin(age*9+wound.sequence)*Math.exp(-age*2)*(this.renderer.settings.reducedMotion?.25:1)});
      }
    }
    for(const f of this.fragments){
      if(this.physics&&!f.pending&&time>=f.time+f.delay){if(!f.physics){f.physics=this.physics.addDrop(f.piece,{velocity:f.velocity,angularVelocity:new THREE.Vector3(1.6,f.spin*1.5,.5),radius:f.kind==='twist'?.13:.09,mass:f.kind==='twist'?3.4:2.2,lifetime:16});}f.piece.visible=gore;continue;}
      const age=clamp(time-f.time-f.delay,0,8),fall=Math.min(age,1.3);f.piece.visible=gore;f.piece.position.copy(f.origin).addScaledVector(f.velocity,fall);f.piece.position.y=Math.max(.16,f.origin.y+f.velocity.y*fall-2.9*fall*fall);f.piece.rotation.set(Math.min(age,1.3)*1.6,(f.holdYaw||0)+(age<1.3?age*f.spin*1.5:f.spin*1.95),Math.min(age,1.3)*.5);
    }
    let count=0;this.renderer.camera.getWorldQuaternion(this.rotation);
    if(gore)for(const d of this.drops){const age=time-d.at;if(age<0||age>.72)continue;bloodFlight(d.start,d.velocity,age,this.point,this.axis);if(this.point.y<.025)continue;stampBloodDroplet(this.spray,count++,this.marker,this.point,this.axis,d.size,d.angle*17,1-age/.72);}
    finishBloodDropletPool(this.spray,count);
    if(this.chest){this.chest.updateWeapon(run);this.chest.heartCount=[...this.actors.values()].filter(s=>s.heart?.visible).length;}
  }
  diagnostics() {return{status:this.status,error:this.error||null,active:this.active,kind:this.kind,hands:this.hands,contactDistances:this.contactDistances||[],pickupView:!!this.pickupView,recoveryRetreat:this.recoveryRetreat||0,armSource:this.armStatus,grip:{...counterGripDiagnostics(this.counterGrip),left:this.counterGrip?.hands.left?.grip||0,right:this.counterGrip?.hands.right?.grip||0},woundedActors:this.actors.size,fragments:this.fragments.length,spray:this.spray.count,limits:BRUTAL_VISUAL_LIMITS,chest:this.chest?.diagnostics(),bodySpear:this.bodySpear?.diagnostics(),physics:this.physics?.diagnostics(),anatomy:this.anatomy?.diagnostics(),poseStages:this.tracePose?this.poseStages:undefined};}
  releaseFragment(f) {if(f.physics)this.physics?.removeDrop(f.physics);f.piece.removeFromParent();f.piece.traverse(mesh=>{if(!mesh.isMesh||mesh.geometry.userData.sharedAsset)return;if(!mesh.userData.anatomySharedPreview)mesh.geometry.dispose();mesh.skeleton?.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();});}
  releaseAsset(asset) {const geometries=new Set(),materials=new Set(),textures=new Set();asset?.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean)){materials.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  dispose() {this.disposed=true;this.beginFrame();for(const root of [...this.actors.keys()])this.releaseActor(root);for(const f of this.fragments)this.releaseFragment(f);this.anatomy?.dispose();this.chest?.dispose();this.bodySpear?.dispose();this.physics?.dispose();this.counterGrip?.dispose();this.remoteGrip?.dispose();this.armMaterials?.forEach(m=>m.dispose());this.arms?.traverse(mesh=>mesh.skeleton?.dispose());this.spray.geometry.dispose();this.spray.material.dispose();this.spray.dispose();this.releaseAsset(this.asset);this.root.removeFromParent();}
}
