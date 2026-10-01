import * as THREE from './vendor/three.module.js';
import {createBloodResiduePool} from './blood-surface.js';
import {createBloodDropletPool,bloodFlight,stampBloodDroplet,finishBloodDropletPool} from './fluid-blood.js';
import {addSoftTissueCompliance} from './soft-tissue-compliance.js';
import {castRay} from './engine.js';
import {articulationDiagnostics} from './character-articulation.js';

const clamp=THREE.MathUtils.clamp;
const REGIONS=['torso','leftLeg','rightLeg','leftArm','rightArm','neck'];
const ik={s:new THREE.Vector3(),e:new THREE.Vector3(),w:new THREE.Vector3(),d:new THREE.Vector3(),pole:new THREE.Vector3(),goal:new THREE.Vector3(),old:new THREE.Vector3(),next:new THREE.Vector3(),parent:new THREE.Quaternion(),delta:new THREE.Quaternion(),local:new THREE.Quaternion()};

// Solve in world metres so imported rigs with centimetre-scale bones keep the
// same shoulder contact. Only rotations change; the simulation owns translation.
export function reachBiteArm(upper,lower,hand,target,pole,weight=1){
  if(!upper||!lower||!hand)return false;
  upper.getWorldPosition(ik.s);lower.getWorldPosition(ik.e);hand.getWorldPosition(ik.w);
  const a=ik.s.distanceTo(ik.e),b=ik.e.distanceTo(ik.w);
  if(a<1e-5||b<1e-5)return false;
  ik.d.copy(target).sub(ik.s);const length=clamp(ik.d.length(),Math.abs(a-b)+.001,(a+b)*.98);ik.d.normalize();
  ik.pole.copy(pole).sub(ik.s).addScaledVector(ik.d,-ik.pole.dot(ik.d));
  if(ik.pole.lengthSq()<1e-6)ik.pole.set(0,-1,0).addScaledVector(ik.d,ik.d.y);
  ik.pole.normalize();const axial=(a*a-b*b+length*length)/(2*length),height=Math.sqrt(Math.max(0,a*a-axial*axial));
  ik.goal.copy(ik.s).addScaledVector(ik.d,axial).addScaledVector(ik.pole,height);
  const rotate=(bone,from,to)=>{
    ik.delta.setFromUnitVectors(from.normalize(),to.normalize());bone.parent.getWorldQuaternion(ik.parent);
    ik.local.copy(ik.parent).invert().multiply(ik.delta).multiply(ik.parent).multiply(bone.quaternion);
    bone.quaternion.slerp(ik.local,weight);bone.updateMatrixWorld(true);
  };
  rotate(upper,ik.old.copy(ik.e).sub(ik.s),ik.next.copy(ik.goal).sub(ik.s));
  lower.getWorldPosition(ik.e);hand.getWorldPosition(ik.w);
  ik.goal.copy(ik.s).addScaledVector(ik.d,length);
  rotate(lower,ik.old.copy(ik.w).sub(ik.e),ik.next.copy(ik.goal).sub(ik.e));
  return true;
}
export function anatomyRegion(name='') {
  if (/Left.*(?:UpLeg|Leg|Foot|Toe)/i.test(name)) return 1;
  if (/Right.*(?:UpLeg|Leg|Foot|Toe)/i.test(name)) return 2;
  if (/Left.*(?:Shoulder|Arm|Hand|Finger|Thumb)/i.test(name)) return 3;
  if (/Right.*(?:Shoulder|Arm|Hand|Finger|Thumb)/i.test(name)) return 4;
  return /Head|Neck/i.test(name)?5:0;
}
export function woundAmount(value) { return value==='severed'?1:value==='injured'?.6:clamp(Number(value)||0,0,3)/3; }
export function biteEnvelope(bite={}) {
  if(bite.phase==='windup')return clamp((bite.elapsed||0)/.65,0,1);
  if(bite.phase==='held'||bite.phase==='terminal')return 1;
  return bite.phase==='released'?1-clamp((bite.elapsed||0)/.55,0,1):0;
}

export function meshAnatomyRegions(mesh) {
  const positions=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  const values=new Float32Array(positions.count);
  if(!indices||!weights||!mesh.skeleton)return values;
  for(let i=0;i<values.length;i++) {
    const sums=[0,0,0,0,0,0];
    for(let j=0;j<4;j++)sums[anatomyRegion(mesh.skeleton.bones[indices.getComponent(i,j)]?.name)]+=weights.getComponent(i,j);
    values[i]=sums.indexOf(Math.max(...sums));
  }
  return values;
}

function installWoundSurface(mesh,region,uniforms,atlas,owned) {
  const geometry=mesh.geometry;
  if(!geometry.attributes.playerRegion)geometry.setAttribute('playerRegion',new THREE.Float32BufferAttribute(
    region==null?meshAnatomyRegions(mesh):new Float32Array(geometry.attributes.position.count).fill(region),1));
  const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const next=source.map(material=>{
    const m=material.clone(),previous=material.onBeforeCompile,cache=material.customProgramCacheKey?.()||'';
    delete m.userData.sharedLibrary;
    m.onBeforeCompile=shader=>{
      previous?.call(m,shader);
      shader.uniforms.uPlayerWoundA=uniforms.a; shader.uniforms.uPlayerWoundB=uniforms.b; shader.uniforms.uPlayerBlood={value:atlas};
      shader.vertexShader='attribute float playerRegion; varying float vPlayerRegion; varying vec2 vPlayerWoundUv;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPlayerRegion=playerRegion;vPlayerWoundUv=uv;');
      shader.fragmentShader='uniform vec4 uPlayerWoundA; uniform vec2 uPlayerWoundB; uniform sampler2D uPlayerBlood; varying float vPlayerRegion; varying vec2 vPlayerWoundUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float wr=floor(vPlayerRegion+.5);
        float injury=wr<.5?uPlayerWoundA.x:wr<1.5?uPlayerWoundA.y:wr<2.5?uPlayerWoundA.z:wr<3.5?uPlayerWoundA.w:wr<4.5?uPlayerWoundB.x:uPlayerWoundB.y;
        if(injury>.99&&wr>.5&&wr<4.5)discard;
        vec2 wu=fract(vPlayerWoundUv*vec2(2.15,1.7)+vec2(wr*.173,.19));
        vec4 blood=texture2D(uPlayerBlood,vec2(.003,.503)+wu*.494);
        float stain=blood.a*smoothstep(.14,.6,injury)*.9;
        diffuseColor.rgb=mix(diffuseColor.rgb,min(blood.rgb,vec3(.17,.028,.021)),stain);
      `);
    };
    m.customProgramCacheKey=()=>cache+'-player-organic-wounds-v1';m.needsUpdate=true;owned.push(m);return m;
  });
  mesh.material=Array.isArray(mesh.material)?next:next[0];
}

// Partition the existing skinned surface by anatomy. Fatal fragments preserve
// the survivor's actual coat, boots, hands and UVs rather than replacing them
// with capsule proxies. No geometry is created during a blood burst.
function mutedTissueLighting(material,limit) {
  const previous=material.onBeforeCompile,cache=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    previous?.call(material,shader);
    // A near body lamp must not bleach the scanned coat/skin into white.
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec3 injuryLightLimit=max(diffuseColor.rgb*${limit.toFixed(3)},vec3(.003));
      reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/injuryLightLimit;
      reflectedLight.directSpecular*=.12;
    `);
  };
  material.customProgramCacheKey=()=>cache+'-player-fatal-muted-v3-'+limit;
}
function installTorsoTear(material){
  const cut={enabled:{value:0},center:{value:new THREE.Vector3()},normal:{value:new THREE.Vector3(0,0,1)},right:{value:new THREE.Vector3(1,0,0)}};
  const previous=material.onBeforeCompile,cache=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
    previous.call(material,shader);
    Object.assign(shader.uniforms,{uTorsoTear:cut.enabled,uTearCenter:cut.center,uTearNormal:cut.normal,uTearRight:cut.right});
    shader.vertexShader='varying vec3 vTearPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTearPosition=position;');
    shader.fragmentShader='varying vec3 vTearPosition; uniform float uTorsoTear; uniform vec3 uTearCenter,uTearNormal,uTearRight;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 tearDelta=vTearPosition-uTearCenter;
      vec2 tearUv=vec2(dot(tearDelta,uTearRight)/.145,tearDelta.y/.105);
      float tearEdge=1.+.06*sin(atan(tearUv.y,tearUv.x)*7.);
      if(uTorsoTear>.5&&dot(tearDelta,uTearNormal)>-.055&&length(tearUv)<tearEdge)discard;
    `);
  };
  material.customProgramCacheKey=()=>cache+'-torso-tear-v1';return cut;
}
export function createAnatomyFragments(actor) {
  const fragments=[];
  actor.traverse(source=>{
    if(!source.isSkinnedMesh||!/^TLD_(Local_Torso_Legs|Remote_Arms|Head_Hide_For_Local_Player)$/.test(source.name))return;
    const regions=meshAnatomyRegions(source),g=source.geometry,index=g.index;
    const groups=Array.from({length:6},()=>[]);
    for(let i=0;i<(index?index.count:g.attributes.position.count);i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),r=ids.map(id=>regions[id]);
      const region=r[0]===r[1]||r[0]===r[2]?r[0]:r[1]===r[2]?r[1]:r[0];groups[region].push(...ids);
    }
    groups.forEach((ids,region)=>{
      if(!ids.length)return;
      const unique=[...new Set(ids)],map=new Map(unique.map((id,i)=>[id,i]));
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(unique.length*3),3));
      if(g.attributes.uv){const uv=[];for(const id of unique)uv.push(g.attributes.uv.getX(id),g.attributes.uv.getY(id));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
      geometry.setIndex(ids.map(id=>map.get(id)));
      const material=(Array.isArray(source.material)?source.material[0]:source.material).clone();
      mutedTissueLighting(material,.6);
      material.color?.multiplyScalar(.58);material.roughness=Math.max(.88,material.roughness||0);material.envMapIntensity=.08;
      material.side=THREE.DoubleSide;delete material.userData.sharedLibrary;
      const mesh=new THREE.Mesh(geometry,material);mesh.name='PlayerFragment_'+REGIONS[region];mesh.visible=false;mesh.frustumCulled=false;
      fragments.push({mesh,source,ids:unique,region,cut:region===0?installTorsoTear(material):null,velocity:new THREE.Vector3(),spin:new THREE.Vector3(),collapseAxis:new THREE.Vector3(),boundsCenter:new THREE.Vector3(),floor:.08});
    });
  });
  return fragments;
}

export class PlayerInjuryVisuals {
  constructor(renderer) {
    this.renderer=renderer;this.root=new THREE.Group();this.root.name='PlayerInjuryVisuals';renderer.scene.add(this.root);
    this.blood=createBloodDropletPool(36);this.blood.name='PlayerWoundSpray';this.root.add(this.blood);
    this.residue=createBloodResiduePool(6);this.residue.name='PlayerFatalResidue';this.root.add(this.residue);
    this.uniforms={a:{value:new THREE.Vector4()},b:{value:new THREE.Vector2()}};
    this.peerUniforms={a:{value:new THREE.Vector4()},b:{value:new THREE.Vector2()}};
    this.atlas=this.residue.material.map;this.owned=[];this.bound=new WeakSet();this.fragments=[];
    const tissuePath=Array.from({length:17},(_,i)=>{
      const t=i/16,a=t*Math.PI*4.8,radius=(.10+t*.07)*(1+.15*Math.sin(a*1.3));
      return new THREE.Vector3(Math.sin(a)*radius,Math.sin(a*1.7)*.025,Math.cos(a)*radius+t*.43);
    });
    const tissueGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tissuePath),48,.034,7,false);
    const tissueMaterial=new THREE.MeshStandardMaterial({color:0x461a18,roughness:.70,metalness:0,bumpMap:this.atlas,bumpScale:.009,envMapIntensity:.025});
    mutedTissueLighting(tissueMaterial,.45);
    this.entrails=new THREE.InstancedMesh(tissueGeometry,tissueMaterial,3);this.entrails.name='PlayerIntestinalStrands';this.entrails.count=0;this.entrails.frustumCulled=false;this.root.add(this.entrails);
    this.entrailRig=addSoftTissueCompliance(this.entrails,{axis:'z',anchorEnd:'min',sag:.025,bend:.012});
    this.entrailStates=Array.from({length:3},()=>({position:new THREE.Vector3(),offset:new THREE.Vector3(),velocity:new THREE.Vector3(),tilt:1,angle:0,delay:0}));
    this.torsoOpening=new THREE.Group();this.torsoOpening.name='PlayerTorsoTear';this.torsoOpening.visible=false;this.root.add(this.torsoOpening);
    const rimPath=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2,r=1+.06*Math.sin(a*7);return new THREE.Vector3(Math.cos(a)*.145*r,Math.sin(a)*.105*r,0);});
    const rimMaterial=new THREE.MeshStandardMaterial({color:0x632125,roughness:.72,envMapIntensity:.04});mutedTissueLighting(rimMaterial,.55);
    const rim=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPath,true),48,.009,5,true),rimMaterial);
    const cavityMaterial=new THREE.MeshStandardMaterial({color:0x17090c,roughness:.93,envMapIntensity:0});mutedTissueLighting(cavityMaterial,.4);
    const cavity=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),cavityMaterial);cavity.scale.set(.145,.105,.038);cavity.position.z=-.024;this.torsoOpening.add(rim,cavity);
    this.drops=Array.from({length:36},()=>({position:new THREE.Vector3(),start:new THREE.Vector3(),initialVelocity:new THREE.Vector3(),velocity:new THREE.Vector3(),age:10,life:1,size:.1,angle:0}));
    this.marker=new THREE.Object3D();this.point=new THREE.Vector3();this.head=new THREE.Vector3();this.center=new THREE.Vector3();
    this.rotation=new THREE.Quaternion();this.halfTurn=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
    this.poseRestore=[];this.elapsed=0;this.lastStage=0;this.lastSequence=-1;this.fatal=false;this.envelope=0;
    this.pole=new THREE.Vector3();this.parentRotation=new THREE.Quaternion();this.headAxis=new THREE.Vector3();this.headDelta=new THREE.Quaternion();
    this.gripHands=0;this.contactDistance=0;
    this.intactCorpse=new THREE.Group();this.intactCorpse.name='PlayerIntactCorpse';this.intactCorpse.visible=false;this.root.add(this.intactCorpse);
    this.intactParts=[];this.corpseBounds=new THREE.Box3();this.corpseHalf=new THREE.Vector3();this.corpseCenter=new THREE.Vector3();this.corpseAxis=new THREE.Vector3();
  }
  beginFrame() {
    for(const saved of this.poseRestore){saved.node.position.copy(saved.position);saved.node.quaternion.copy(saved.quaternion);}
    this.poseRestore.length=0;
  }
  bindEntrailsAsset() {
    if(this.importedEntrails)return;
    const source=this.renderer.brutalCombatVisuals?.asset?.getObjectByName('IntestinalBundle');
    if(!source?.isMesh)return;
    // Reuse the already loaded authored UV/PBR surface; the visible pool owns
    // its geometry/material and native morph texture, never the shared maps.
    this.entrailRig.dispose();this.entrails.geometry.dispose();this.entrails.material.dispose();
    this.entrails.geometry=source.geometry.clone();this.entrails.material=source.material.clone();
    this.entrails.material.onBeforeCompile=source.material.onBeforeCompile;
    this.entrails.material.customProgramCacheKey=()=> 'player-imported-intestines-v1';
    this.entrails.material.envMapIntensity=.22;this.entrails.material.color.multiplyScalar(1.2);
    this.entrailRig=addSoftTissueCompliance(this.entrails,{axis:'y',anchorEnd:'max',sag:.025,bend:.012});
    this.importedEntrails=true;
  }
  bind() {
    const r=this.renderer,body=r._survivors?.local;
    const key=(body?.uuid||'fallback')+':'+(r._survivors?.viewSleeves||0);
    if(this.bindingKey===key)return;this.bindingKey=key;
    if(body&&body!==this.body&&body.userData.source==='meshy-v02') {
      this.fragments.forEach(f=>{f.mesh.removeFromParent();f.mesh.geometry.dispose();f.mesh.material.dispose();});
      this.body=body;this.fragments=createAnatomyFragments(body);this.fragments.forEach(f=>this.root.add(f.mesh));
      for(const part of this.intactParts){part.mesh.geometry.dispose();part.mesh.material.dispose();}this.intactCorpse.clear();this.intactParts=[];
      for(const source of new Set(this.fragments.map(f=>f.source))){
        const geometry=source.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.deleteAttribute('playerRegion');
        const material=(Array.isArray(source.material)?source.material[0]:source.material).clone();
        mutedTissueLighting(material,.6);material.color?.multiplyScalar(.58);material.roughness=.9;material.envMapIntensity=.08;delete material.userData.sharedLibrary;
        const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;this.intactCorpse.add(mesh);this.intactParts.push({source,mesh});
      }
      const torso=body.userData.body;
      if(torso&&!this.bound.has(torso)){installWoundSurface(torso,null,this.uniforms,this.atlas,this.owned);this.bound.add(torso);}
    }
    for(const group of r.weaponGroups||[])for(const [side,region] of [['left',3],['right',4]]) {
      const arm=group.userData.viewArms?.[side+'Arm'];if(!arm)continue;
      arm.traverse(mesh=>{if(mesh.isMesh&&!this.bound.has(mesh)){installWoundSurface(mesh,region,this.uniforms,this.atlas,this.owned);this.bound.add(mesh);}});
    }
    r._survivors?.peer?.traverse(mesh=>{if(mesh.isSkinnedMesh&&!this.bound.has(mesh)){installWoundSurface(mesh,null,this.peerUniforms,this.atlas,this.owned);this.bound.add(mesh);}});
  }
  applyCamera(run,now) {
    const bite=run.bite||{},r=this.renderer,reduced=r.settings.reducedMotion;
    if(bite.phase==='released'&&this.cameraPhase!=='released')this.releaseFrom=this.envelope;
    if(bite.phase==='terminal'&&(this.cameraPhase!=='terminal'||this.cameraSequence!==bite.sequence||this.cameraRun!==run)){
      this.terminalStarted=now;this.deathAngle=run.angle||0;
      this.deathBack=run.course?.cells?clamp(castRay(run.course,run.x,run.y,this.deathAngle+Math.PI,.42).dist*4-.2,0,1.35):1.35;
    }
    this.cameraPhase=bite.phase;this.cameraSequence=bite.sequence;this.cameraRun=run;
    this.envelope=biteEnvelope(bite);
    if(bite.phase==='released')this.envelope*=this.releaseFrom??0;
    const side=bite.side==='left'?-1:1,held=bite.phase==='held';
    const motion=reduced?.18:1;
    if(this.envelope>0&&bite.phase!=='terminal') {
      r.camera.rotation.z+=side*this.envelope*(.075+Math.sin(now*.011)*.022)*motion;
      r.camera.rotation.x-=this.envelope*.045*motion;
      // Keep the assembled weapon and hands together at the hip during a
      // grapple. The old small drop left the foreground gun across the face.
      // This is presentation only: aim, firing and parry stay available.
      const weapon=Number(run.weapon)||0,longWeapon=weapon>=1&&weapon<=5||weapon===7,compactGun=weapon===0,chainBar=weapon===7;
      const width=Math.min(1,r.camera.aspect/.9);
      r.weaponRig.position.x+=this.envelope*(chainBar?.78:longWeapon?.50:compactGun?.30:.16)*width;
      r.weaponRig.position.y-=this.envelope*(chainBar?.56:longWeapon?.34:compactGun?.27:.20);
      r.weaponRig.rotation.x-=this.envelope*(chainBar?.58:longWeapon?.40:compactGun?.30:.18);
      r.weaponRig.rotation.z-=side*this.envelope*.12;
      if(held)r.weaponRig.position.x+=Math.sin(now*.016)*.015*motion;
    }
    if(bite.phase==='terminal') {
      const deathTime=Math.max(bite.elapsed||0,(now-(this.terminalStarted??now))/1000);
      this.deathTime=deathTime;
      const fall=clamp((deathTime-.16)/.95,0,1),smooth=fall*fall*(3-2*fall);
      r.cameraRig.position.y-=smooth*.85;
      // Fall clear of the first-person coat, stopping before the real wall.
      // Preserve a room horizon and the bloody floor instead of looking into
      // the inside of a jacket at near-plane distance.
      r.cameraRig.position.x-=Math.cos(this.deathAngle)*smooth*this.deathBack;
      r.cameraRig.position.z-=Math.sin(this.deathAngle)*smooth*this.deathBack;
      r.camera.rotation.x-=smooth*.42;
      r.camera.rotation.z+=side*smooth*(reduced?.06:.18);
      r.weaponGroups.forEach(group=>group.visible=false);
    }
  }
  spray(run,count,terminal=false) {
    const r=this.renderer,side=run.bite?.side==='left'?-1:1;
    this.point.set(side*.16,-.22,-.45);r.camera.localToWorld(this.point);
    for(let i=0;i<count;i++) {
      const drop=this.drops[(this.cursor=(this.cursor||0)+1)%this.drops.length],a=i*2.399+(run.bite?.sequence||0);
      drop.position.copy(this.point);drop.velocity.set(Math.cos(a)*(terminal?1.7:.6),.4+Math.sin(i*1.3)*.5,Math.sin(a)*(terminal?1.4:.5));
      drop.age=0;drop.life=terminal?1.3:.65;drop.size=(terminal?.005:.003)*(1+(i%3)*.2);drop.angle=a;drop.start.copy(drop.position);drop.initialVelocity.copy(drop.velocity);
    }
  }
  detach(f) {
    f.source.skeleton.update();const p=f.mesh.geometry.attributes.position;this.center.set(0,0,0);
    f.ids.forEach((id,i)=>{f.source.getVertexPosition(id,this.point).applyMatrix4(f.source.matrixWorld);p.setXYZ(i,this.point.x,this.point.y,this.point.z);this.center.add(this.point);});
    this.center.multiplyScalar(1/f.ids.length);
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)-this.center.x,p.getY(i)-this.center.y,p.getZ(i)-this.center.z);
    p.needsUpdate=true;f.mesh.geometry.computeVertexNormals();f.mesh.geometry.computeBoundingSphere();
    f.mesh.position.copy(this.center);f.mesh.rotation.set(0,0,0);f.mesh.visible=true;f.active=true;f.age=0;f.settled=false;
    const a=this.run?.angle||0,side=f.region%2?-1:1;
    f.delay=0;f.collapseTarget=0;
    f.velocity.set(Math.cos(a)*.12-Math.sin(a)*side*.1,-.18,Math.sin(a)*.12+Math.cos(a)*side*.1);
    f.spin.set(.16,.05,side*.12);
    f.mesh.geometry.computeBoundingBox();f.half=f.mesh.geometry.boundingBox.getSize(f.half||new THREE.Vector3()).multiplyScalar(.5);f.mesh.geometry.boundingBox.getCenter(f.boundsCenter);f.floor=.05-f.mesh.geometry.boundingBox.min.y;
  }
  captureIntactCorpse(run){
    this.body?.updateMatrixWorld(true);this.corpseBounds.makeEmpty();
    this.intactCorpse.position.set(0,0,0);this.intactCorpse.quaternion.identity();
    // Bake a relaxed pose rather than turning a frozen, weight-bearing idle
    // stance sideways. The upper limbs drop toward the lower shoulder/hip.
    const relaxed=[],forward=new THREE.Vector3(Math.cos(run.angle||0),0,Math.sin(run.angle||0));
    const right=new THREE.Vector3(-forward.z,0,forward.x),center=this.body?.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
    for(const prefix of ['Left','Right'])for(const [upperName,lowerName,endName,drop] of [['Arm','ForeArm','Hand',.53],['UpLeg','Leg','Foot',.73]]){
      const upper=this.body?.getObjectByName(prefix+upperName),lower=this.body?.getObjectByName(prefix+lowerName),end=this.body?.getObjectByName(prefix+endName);
      if(!upper||!lower||!end)continue;
      for(const bone of [upper,lower])relaxed.push({bone,quaternion:bone.quaternion.clone()});
      const start=upper.getWorldPosition(new THREE.Vector3()),upperSide=start.clone().sub(center).dot(right)<0;
      const target=start.clone().add(new THREE.Vector3(0,-drop,0)).addScaledVector(right,upperSide?.23:0).addScaledVector(forward,.06);
      const pole=start.clone().add(new THREE.Vector3(0,-drop*.5,0)).addScaledVector(forward,.25);
      reachBiteArm(upper,lower,end,target,pole);this.body.updateMatrixWorld(true);
    }
    for(const {source,mesh} of this.intactParts){
      source.skeleton.update();const positions=mesh.geometry.attributes.position;
      // Undo the first-person jacket bend for the external corpse only. The
      // original bundled surface keeps the back resting with the other limbs.
      const liveGeometry=source.geometry;
      if(source===this.body?.userData.body&&this.body.userData.intactBodyGeometry)source.geometry=this.body.userData.intactBodyGeometry;
      try{for(let i=0;i<positions.count;i++){
          source.getVertexPosition(i,this.point).applyMatrix4(source.matrixWorld);this.point.x-=run.x*4;this.point.z-=run.y*4;
          positions.setXYZ(i,this.point.x,this.point.y,this.point.z);this.corpseBounds.expandByPoint(this.point);
      }}finally{source.geometry=liveGeometry;}
      positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    for(const saved of relaxed)saved.bone.quaternion.copy(saved.quaternion);
    this.body?.updateMatrixWorld(true);for(const {source} of this.intactParts)source.skeleton.update();
    if(this.corpseBounds.isEmpty()){this.corpseHalf.set(0,0,0);this.corpseCenter.set(0,0,0);}
    else{this.corpseBounds.getSize(this.corpseHalf).multiplyScalar(.5);this.corpseBounds.getCenter(this.corpseCenter);}
    // An intact side fall lets the shoulder and hip carry the body's weight;
    // the standing idle hands must not read as propping up a crawling pose.
    this.corpseAxis.set(Math.cos(run.angle||0),0,Math.sin(run.angle||0));
  }
  fracture(run) {
    this.fatal=true;this.fractured=true;
    this.body?.updateMatrixWorld(true);
    const forward=new THREE.Vector3(Math.cos(run.angle||0),0,Math.sin(run.angle||0));
    const fatalRegion=run.bite?.reason==='limb'?REGIONS.indexOf(run.bite.limb):run.bite?.reason==='torso'||run.playerWounds?.eviscerated?0:5;
    for(const f of this.fragments){
      if(f.active){
        // A limb lost earlier in this struggle settles with the aftermath,
        // instead of remaining propped vertically beside the fallen torso.
        f.collapseAxis.set(forward.z,0,-forward.x);f.collapseTarget=1.2;f.delay=0;f.age=0;f.settled=false;
        continue;
      }
      this.detach(f);
      // Preserve the assembled anatomy through the first impact. Only the
      // bitten region gives way immediately; the rest drops under its weight.
      f.mesh.position.addScaledVector(forward,1.25);
      f.delay=f.region===fatalRegion?0:.3+(f.region===0?0:.04);
      f.velocity.set(forward.x*.12,-.18,forward.z*.12);
      f.spin.set(f.region===0?.5:.12,0,(f.region%2?-1:1)*.06);
      f.collapseAxis.set(forward.z,0,-forward.x);
      f.collapseTarget=f.region===0?1.48:f.region===5?1.25:1.2;
    }
    this.residue.count=3;
    for(let i=0;i<3;i++) {
      this.marker.position.set(run.x*4+(i-1)*.42,.025+i*.002,run.y*4+.25);this.marker.rotation.set(-Math.PI/2,0,i*2.1);this.marker.scale.set(1.6-i*.25,1.2+i*.16,1);this.marker.updateMatrix();this.residue.setMatrixAt(i,this.marker.matrix);this.residue.geometry.attributes.bloodState.setXY(i,i,0);
    }
    this.residue.instanceMatrix.needsUpdate=true;this.residue.geometry.attributes.bloodState.needsUpdate=true;
    if(run.playerWounds?.eviscerated||run.bite?.reason==='torso'){
      this.entrails.count=3;
      this.entrailAnchor=this.fragments.find(f=>f.region===0);
      if(this.entrailAnchor){
        const f=this.entrailAnchor,normal=forward.clone().negate(),right=new THREE.Vector3(-normal.z,0,normal.x);
        const depth=Math.abs(normal.x)*f.half.x+Math.abs(normal.z)*f.half.z;
        this.torsoOpening.position.copy(f.boundsCenter).addScaledVector(normal,depth*.72);this.torsoOpening.position.y-=f.half.y*.32;
        this.torsoOpening.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);f.mesh.add(this.torsoOpening);
        f.cut.enabled.value=1;f.cut.center.value.copy(this.torsoOpening.position);f.cut.normal.value.copy(normal);f.cut.right.value.copy(right);f.mesh.material.needsUpdate=true;
      }
      this.entrailStates.forEach((s,i)=>{
        s.offset.copy(this.torsoOpening.position);s.offset.y-=(i-1)*.035;
        s.offset.addScaledVector(forward,-.04-i*.02);
        s.position.copy(s.offset).add(this.entrailAnchor?.mesh.position||new THREE.Vector3(run.x*4,0,run.y*4));
        s.velocity.set(-forward.x*.05,-.08,-forward.z*.05);s.delay=.62+i*.08;s.tilt=1.15+i*.1;s.angle=i*2.1;
      });
    }
    this.spray(run,30,true);
  }
  update(run,now,dt) {
    this.bind();this.bindEntrailsAsset();const r=this.renderer,bite=run.bite||{},w=run.playerWounds||{},gore=r.settings.gore!==false;
    if(this.run!==run||this.course!==run.course||((run.health||0)>0&&this.fatal&&bite.phase!=='terminal')) {
      this.run=run;this.course=run.course;this.fatal=false;this.fractured=false;this.corpseCaptured=false;this.intactCorpse.visible=false;this.torsoOpening.visible=false;this.fragments.forEach(f=>{f.mesh.visible=false;f.active=false;if(f.cut)f.cut.enabled.value=0;});this.residue.count=0;this.entrails.count=0;this.drops.forEach(d=>d.age=10);this.lastSequence=-1;this.lastStage=0;
      this.entrailRig.set({sag:0,bend:0});
      if(this.body)this.body.visible=true;
    }
    this.uniforms.a.value.set(...['torso','leftLeg','rightLeg','leftArm'].map(key=>gore?woundAmount(w[key]):0));
    this.uniforms.b.value.set(gore?woundAmount(w.rightArm):0,gore?woundAmount(w.neck):0);
    const peerWounds=run.peer?.playerWounds||{};
    this.peerUniforms.a.value.set(...['torso','leftLeg','rightLeg','leftArm'].map(key=>gore?woundAmount(peerWounds[key]):0));
    this.peerUniforms.b.value.set(gore?woundAmount(peerWounds.rightArm):0,gore?woundAmount(peerWounds.neck):0);
    for(const group of r.weaponGroups||[])for(const side of ['left','right']) {
      const arm=group.userData.viewArms?.[side+'Arm'];if(arm)arm.visible=!(gore&&w[side+'Arm']==='severed');
    }
    if(this.lastSequence!==bite.sequence){this.lastSequence=bite.sequence;this.lastStage=0;}
    if((bite.damageStage||0)>this.lastStage){if(gore)this.spray(run,10);this.lastStage=bite.damageStage;}
    if(gore&&!this.fatal&&bite.phase!=='terminal')for(const f of this.fragments)if(f.region>0&&f.region<5&&w[REGIONS[f.region]]==='severed'&&!f.active){this.detach(f);this.spray(run,8);}
    if(bite.phase==='terminal'&&!this.fatal){this.fatal=true;this.elapsed=0;this.fatalStarted=now;}
    if(bite.phase==='terminal'&&!this.fractured&&gore)this.fracture(run);
    if(this.fatal) {
      if(!gore&&!this.corpseCaptured){this.captureIntactCorpse(run);this.corpseCaptured=true;}
      this.elapsed=Math.max(this.elapsed+dt,Math.max(0,now-this.fatalStarted)/1000);if(this.body)this.body.visible=false;
      this.intactCorpse.visible=!gore&&this.intactParts.length>0;
      const fall=clamp((this.elapsed-.16)/.95,0,1),smooth=fall*fall*(3-2*fall);
      this.intactCorpse.quaternion.setFromAxisAngle(this.corpseAxis,smooth*1.48);
      this.intactCorpse.position.set(run.x*4+Math.cos(run.angle||0)*smooth*.9,.05,run.y*4+Math.sin(run.angle||0)*smooth*.9);
      this.intactCorpse.updateMatrix();const e=this.intactCorpse.matrix.elements,c=this.corpseCenter,h=this.corpseHalf;
      const floor=.045+Math.abs(e[1])*h.x+Math.abs(e[5])*h.y+Math.abs(e[9])*h.z-(e[1]*c.x+e[5]*c.y+e[9]*c.z);
      this.intactCorpse.position.y=Math.max(.05,floor);
    }
    for(const f of this.fragments){f.mesh.visible=!!f.active&&gore;if(f.active&&!f.settled){
      f.age=this.fatal?Math.max(f.age+dt,this.elapsed):f.age+dt;
      if(f.age<f.delay)continue;
      f.velocity.y-=dt*4.8;f.mesh.position.addScaledVector(f.velocity,dt);
      if(f.collapseTarget){
        // A floor collision damps velocity, but must not freeze a standing
        // jacket. Finish the fall within the fatal camera beat.
        const fall=clamp((f.age-f.delay)/.65,0,1);
        f.mesh.quaternion.setFromAxisAngle(f.collapseAxis,f.collapseTarget*fall*fall*(3-2*fall));
      }else{f.mesh.rotation.x+=f.spin.x*dt;f.mesh.rotation.z+=f.spin.z*dt;}
      f.mesh.updateMatrix();const e=f.mesh.matrix.elements;
      f.floor=.045+Math.abs(e[1])*f.half.x+Math.abs(e[5])*f.half.y+Math.abs(e[9])*f.half.z-(e[1]*f.boundsCenter.x+e[5]*f.boundsCenter.y+e[9]*f.boundsCenter.z);
      if(f.collapseTarget)f.mesh.position.y=THREE.MathUtils.lerp(f.mesh.position.y,f.floor,clamp((f.age-f.delay)/.65,0,1));
      if(f.mesh.position.y<f.floor){f.mesh.position.y=f.floor;f.velocity.multiplyScalar(.3);f.spin.multiplyScalar(.5);}
      if(f.age>=3)f.settled=true;
    }}
    this.entrails.visible=gore&&this.entrails.count>0;
    this.torsoOpening.visible=this.entrails.visible&&!!this.entrailAnchor;
    for(let i=0;i<this.entrails.count;i++){
      const s=this.entrailStates[i];
      const age=Math.max(0,this.elapsed-s.delay);
      this.entrailRig.set({sag:THREE.MathUtils.smoothstep(age,0,.55),bend:Math.sin(age*9+i*1.4)*Math.exp(-age*2.4)*(r.settings.reducedMotion?.25:1)},i);
      if(this.elapsed<s.delay&&this.entrailAnchor){
        s.position.copy(s.offset).applyQuaternion(this.entrailAnchor.mesh.quaternion).add(this.entrailAnchor.mesh.position);
        s.position.y-=Math.min(.12,this.elapsed*.35);
      }else{s.velocity.y-=dt*3.6;s.position.addScaledVector(s.velocity,dt);}
      this.marker.position.copy(s.position);this.marker.rotation.set(s.tilt,s.angle,0);this.marker.scale.setScalar(.85+i*.14);this.marker.updateMatrix();this.entrails.setMatrixAt(i,this.marker.matrix);
      const b=this.entrails.geometry.boundingBox,m=this.marker.matrix.elements;
      const floor=.012-Math.min(m[1]*b.min.x,m[1]*b.max.x)-Math.min(m[5]*b.min.y,m[5]*b.max.y)-Math.min(m[9]*b.min.z,m[9]*b.max.z);
      if(s.position.y<floor){s.position.y=floor;s.velocity.set(0,0,0);s.tilt*=Math.exp(-dt*8);this.marker.position.copy(s.position);this.marker.updateMatrix();this.entrails.setMatrixAt(i,this.marker.matrix);}
    }
    if(this.entrails.count)this.entrails.instanceMatrix.needsUpdate=true;
    if(this.fatal){
      r.camera.getWorldPosition(this.point);
      for(const f of this.fragments)if(f.region===0||f.region===5){
        const exclusion=(f.mesh.geometry.boundingSphere?.radius||.4)+.35;
        if(f.mesh.position.distanceToSquared(this.point)<exclusion*exclusion)f.mesh.visible=false;
      }
    }
    this.gripHands=0;this.contactDistance=0;
    const enemy=r._enemyVisuals?.get(bite.enemyId)?.root;
    if(enemy&&this.envelope>0&&(bite.phase!=='terminal'||(this.deathTime||0)<.18)) {
      this.poseRestore.push({node:enemy,position:enemy.position.clone(),quaternion:enemy.quaternion.clone()});
      const side=bite.side==='left'?-1:1,head=enemy.getObjectByName('Head')||enemy.getObjectByName('mixamorigHead');
      enemy.updateMatrixWorld(true);
      if(head)head.getWorldPosition(this.head);else this.head.copy(enemy.position).add(new THREE.Vector3(0,1.65,0));
      // Preserve the real attacker's bearing. A bounded reach closes to the
      // shoulder instead of leaving the held zombie standing at arm's length.
      this.point.copy(this.head);r.camera.worldToLocal(this.point);
      const radius=Math.hypot(this.point.x,this.point.z),pull=Math.min(.70,Math.max(0,radius-.40));
      const depthScale=radius>1e-5?(radius-pull)/radius:1;
      this.point.x*=depthScale;this.point.z*=depthScale;this.point.y=THREE.MathUtils.lerp(this.point.y,-.18,.8);
      r.camera.localToWorld(this.point);
      enemy.position.addScaledVector(this.point.sub(this.head).clampLength(0,.75),this.envelope);enemy.updateMatrixWorld(true);
      const motion=r.settings.reducedMotion?.18:1,chomp=Math.sin((bite.elapsed||0)*8)*motion;
      const spine=enemy.getObjectByName('Spine02');
      if(spine){this.poseRestore.push({node:spine,position:spine.position.clone(),quaternion:spine.quaternion.clone()});spine.rotation.x+=(.14+chomp*.035)*this.envelope;}
      if(head){
        this.poseRestore.push({node:head,position:head.position.clone(),quaternion:head.quaternion.clone()});
        // The old positive pitch showed the crown of the head. Lift the jaw
        // toward the lens/neck and pull rhythmically against the shoulders.
        r.camera.getWorldQuaternion(this.rotation);head.parent.getWorldQuaternion(this.parentRotation).invert();
        this.headAxis.set(1,0,0).applyQuaternion(this.rotation).applyQuaternion(this.parentRotation);
        this.headDelta.setFromAxisAngle(this.headAxis,(-.52+chomp*.055)*this.envelope);head.quaternion.premultiply(this.headDelta);
      }
      enemy.updateMatrixWorld(true);
      for(const [prefix,handSide] of [['Left',-1],['Right',1]]){
        const upper=enemy.getObjectByName(prefix+'Arm'),lower=enemy.getObjectByName(prefix+'ForeArm'),hand=enemy.getObjectByName(prefix+'Hand');
        if(!upper||!lower||!hand)continue;
        for(const node of [upper,lower])this.poseRestore.push({node,position:node.position.clone(),quaternion:node.quaternion.clone()});
        this.point.set(handSide*.24,-.24,-.27);r.camera.localToWorld(this.point);
        this.pole.set(handSide*.72,-.58,-.50);r.camera.localToWorld(this.pole);
        if(reachBiteArm(upper,lower,hand,this.point,this.pole,this.envelope))this.gripHands++;
      }
      if(head){
        head.getWorldPosition(this.head);r.camera.getWorldPosition(this.point);this.contactDistance=this.point.distanceTo(this.head);
      }
    }
    let count=0;this.blood.visible=gore;this.residue.visible=gore;r.camera.getWorldQuaternion(this.rotation);
    for(const drop of this.drops) {
      drop.age+=dt;if(drop.age>=drop.life||!gore)continue;
      bloodFlight(drop.start,drop.initialVelocity,drop.age,drop.position,drop.velocity);
      if(drop.position.y<.025)continue;
      stampBloodDroplet(this.blood,count++,this.marker,drop.position,drop.velocity,drop.size,drop.angle*17,1-drop.age/drop.life);
    }
    finishBloodDropletPool(this.blood,count);
  }
  diagnostics(){const actor=this.renderer._enemyVisuals?.get(this.run?.bite?.enemyId)?.root?.userData.afterlife;return {phase:this.run?.bite?.phase||'idle',envelope:this.envelope,fatal:this.fatal,intactCorpse:this.intactCorpse.visible,fragments:this.fragments.length,visibleFragments:this.fragments.filter(f=>f.mesh.visible).length,entrails:this.entrails.visible?this.entrails.count:0,entrailSource:this.importedEntrails?'bundled-authored-UV-PBR':'loading-fallback',entrailDeformation:this.entrailRig.diagnostics.instanceMode,gripHands:this.gripHands,contactDistance:this.contactDistance,articulation:articulationDiagnostics(actor?.articulation),deathBack:this.deathBack||0,spray:this.blood.count,pooledSpray:36,source:'bundled-survivor-skin-partition',ownedWoundMaterials:this.owned.length};}
  dispose(){this.beginFrame();this.entrailRig?.dispose();this.root.removeFromParent();this.torsoOpening.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});for(const {mesh} of this.intactParts){mesh.geometry.dispose();mesh.material.dispose();}for(const f of this.fragments){f.mesh.geometry.dispose();f.mesh.material.dispose();}for(const m of [this.blood,this.residue,this.entrails]){m.geometry.dispose();m.material.dispose();m.dispose();}this.owned.forEach(m=>m.dispose());}
}
