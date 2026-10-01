import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {HorrorEncounterVisuals,encounterRhythmPulse,encounterCallbackPulse} from '../horror-encounter-visuals.js';

function asset(){
 const template=new THREE.Group(),hips=new THREE.Bone(),spine=new THREE.Bone(),head=new THREE.Bone();
 hips.name='Hips';hips.position.y=.9;spine.name='Spine01';spine.position.y=.18;head.name='Head';head.position.y=.52;hips.add(spine);spine.add(head);template.add(hips);
 const upper=new THREE.Bone(),fore=new THREE.Bone(),hand=new THREE.Bone(),grip=new THREE.Bone();
 upper.name='RightArm';upper.position.set(.25,.35,0);fore.name='RightForeArm';fore.position.y=-.27;hand.name='RightHand';hand.position.y=-.26;grip.name='RightGrip';grip.position.z=.13;
 grip.userData.articulation={role:'grip',side:'right',axis:[1,0,0],maxAngleRadians:.35};
 spine.add(upper);upper.add(fore);fore.add(hand);hand.add(grip);
 template.updateMatrixWorld(true);
 const geometry=new THREE.BoxGeometry(.11,.075,.18,3,3,4);geometry.translate(.25,.90,.075);
 const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){indices[i*4]=0;weights[i*4]=1;}
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const material=new THREE.MeshStandardMaterial({color:0x9e8a6b});
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='scanned hand';template.add(mesh);mesh.bind(new THREE.Skeleton([hand,grip]));
 const bodyGeometry=new THREE.BoxGeometry(.45,1.86,.28);bodyGeometry.translate(0,.93,0);template.add(new THREE.Mesh(bodyGeometry,material));
 const clip=new THREE.AnimationClip('AshWitness_Idle',2,[new THREE.NumberKeyframeTrack('Head.rotation[x]',[0,1,2],[0,.025,0])]);
 return {template,clips:[clip],geometry,material};
}

function state(kind,elapsed,id=1){return {enabled:true,active:{id,kind,elapsed,duration:8,anchor:{x:3,y:4,angle:.7},rhythm:[.3,.7,.4]},memory:{rhythm:[.3,.7,.4]}};}
function fixture(){const source=asset(),world=new THREE.Group(),surface=new THREE.MeshStandardMaterial(),visuals=new HorrorEncounterVisuals(world,{dungeon:true},source,{wornSteel:surface,afterlifeWood:surface});return {visuals,source,world,surface};}

test('one actor uses authored cell anchors and keeps fixed bone lengths through contact',()=>{
 const {visuals}=fixture();
 try{
  visuals.update({x:4,y:5},1/60,state('strain',2.5));
  assert.deepEqual(visuals.root.position.toArray(),[12,0,16]);assert.equal(visuals.diagnostics.activeSpecimens,1);
  assert(Math.abs(visuals.root.rotation.y+.7+Math.PI/2)<1e-9);
  const before=visuals.actor.bones.map(({node})=>node.position.toArray());
  for(const kind of ['witness','strain','transfer','callback','table'])for(let i=0;i<50;i++)visuals.update({x:4,y:5},1/60,state(kind,i/10));
  assert.deepEqual(visuals.actor.bones.map(({node})=>node.position.toArray()),before,'joint positions never stretch');
  assert(visuals.diagnostics.geometries<70);assert.equal(visuals.root.children.length,1);
 }finally{visuals.dispose();}
});

test('identical canonical elapsed preserves the same pose and no overlays accumulate',()=>{
 const {visuals}=fixture();
 try{
  for(const kind of ['witness','strain','transfer','callback','table']){
   const frame=state(kind,2.05);visuals.update({x:4,y:5},1/60,frame);
   const pose=visuals.actor.bones.map(({node})=>node.quaternion.clone()),positions=visuals.actor.patches.map(p=>new Float32Array(p.mesh.geometry.attributes.position.array));
   for(let i=0;i<150;i++)visuals.update({x:4,y:5},0,frame);
   assert(visuals.actor.bones.every(({node},i)=>node.quaternion.angleTo(pose[i])<1e-6),`${kind} pose is stable`);
   for(let i=0;i<positions.length;i++)assert.deepEqual(visuals.actor.patches[i].mesh.geometry.attributes.position.array,positions[i]);
  }
 }finally{visuals.dispose();}
});

test('only one deliberate head/body mismatch appears while feet and source shape stay coherent',()=>{
 const {visuals}=fixture();
 try{
  const player={x:3+Math.cos(.7),y:4+Math.sin(.7)};
  visuals.update(player,.016,state('witness',1.65));
  const full={...visuals.diagnostics};assert(full.torsoYaw>full.headYaw+.02);
  visuals.update(player,.016,state('witness',4));assert(Math.abs(visuals.diagnostics.torsoYaw-visuals.diagnostics.headYaw)<1e-8);
  visuals.update(player,.016,state('witness',1.65),{reducedMotion:true});assert(Math.abs(visuals.diagnostics.torsoYaw-visuals.diagnostics.headYaw)<1e-8);
 }finally{visuals.dispose();}
});

test('pressure touches scanned skin locally while transfer leaves visible residue without gameplay mutation',()=>{
 const {visuals,source}=fixture();
 try{
  const run={x:3,y:3,health:90,ammo:24},before=JSON.stringify(run),frame=state('strain',2.5),input=JSON.stringify(frame);
  visuals.update(run,.016,frame);
  assert(visuals.diagnostics.contactError<.04,'reachable target uses rigid links');
  assert(visuals.diagnostics.deformedVertices>0,'weighted hand geometry compresses');
  assert(visuals.diagnostics.compression>0&&visuals.diagnostics.compression<=.016);
  for(const patch of visuals.actor.patches)assert(patch.mesh.geometry!==source.geometry,'shared imported geometry is preserved');
  assert.equal(JSON.stringify(run),before);assert.equal(JSON.stringify(frame),input);
  const ordinary=visuals.diagnostics.compression;
  visuals.update(run,.016,frame,{gore:false,reducedMotion:true});assert(visuals.diagnostics.compression<ordinary);
  visuals.update(run,.016,state('transfer',3));assert(visuals.diagnostics.residue>.9);assert(visuals.scene.residue.visible);assert(visuals.diagnostics.filamentLength>.02);
  visuals.update(run,.016,state('transfer',3),{gore:false});assert.equal(visuals.scene.residue.material,visuals.scene.oil);
 }finally{visuals.dispose();}
});

test('the main observer can see the real hand through the pressure pane and clean handle',()=>{
 const {visuals}=fixture();
 try{
  for(const kind of['strain','transfer']){
   visuals.update({x:4,y:5},.016,state(kind,2.5));
   const target=visuals.scene.target,ray=new THREE.Raycaster(new THREE.Vector3(target.x,target.y,target.z-3),new THREE.Vector3(0,0,1));
   visuals.root.updateMatrixWorld(true);
   // Inspect in encounter-local space so an arbitrary authored room angle
   // does not affect the contact visibility contract.
   const origin=visuals.root.localToWorld(ray.ray.origin.clone());
   const direction=new THREE.Vector3(0,0,1).transformDirection(visuals.root.matrixWorld);
   ray.set(origin,direction);
   const hits=ray.intersectObject(visuals.scene.fixture,true).filter(hit=>hit.object.visible&&hit.object.parent.visible);
   const blocking=hits.filter(hit=>!hit.object.material.transparent&&hit.distance<3-.13);
   assert.equal(blocking.length,0,`${kind}: opaque fixture geometry must not cover the hand contact line`);
   assert(visuals.scene.fixture.getObjectByName('recess toe kick'));
   assert(!visuals.scene.fixture.getObjectByName('recess backing'));
   assert(visuals.scene.glass.material.isMeshBasicMaterial,'the close lantern cannot produce a specular hotspot over contact');
   assert(visuals.scene.glass.material.opacity<=.03,'clear pane tint cannot wash out the source anatomy');
   assert.equal(visuals.scene.glass.material.depthWrite,false);
  }
 }finally{visuals.dispose();}
});

test('callback and table use the retained irregular rhythm with bounded motion',()=>{
 const {visuals}=fixture();
 try{
  const rhythm=[.3,.7,.4],time=.75+.3+.125;
  visuals.update({},.016,state('callback',time));assert(visuals.diagnostics.rhythmPulse>.99);
  assert.equal(visuals.diagnostics.rhythmPulse,encounterCallbackPulse(time,rhythm));
  assert.equal(encounterCallbackPulse(5,rhythm),0,'the audiovisual callback does not replay unissued step cues');
  for(const onset of[1.05,1.75,2.15])assert(encounterCallbackPulse(onset+.125,rhythm)>.99);
  visuals.update({},.016,state('table',1.2));
  const full=visuals.diagnostics.tableLift;
  visuals.update({},.016,state('table',1.2),{reducedMotion:true});assert(visuals.diagnostics.tableLift<=full);assert(visuals.diagnostics.tableLift<=.018);
  const geometry=visuals.scene.sheet.geometry;assert([...geometry.attributes.position.array].every(Number.isFinite));
 }finally{visuals.dispose();}
});

test('cancellation, invalid anchors and disposal release only owned resources',()=>{
 const {visuals,source,world,surface}=fixture();let sharedMaterialDisposals=0,sourceGeometryDisposals=0,sourceMaterialDisposals=0;
 surface.addEventListener('dispose',()=>sharedMaterialDisposals++);source.geometry.addEventListener('dispose',()=>sourceGeometryDisposals++);source.material.addEventListener('dispose',()=>sourceMaterialDisposals++);
 visuals.update({},.016,state('strain',2));
 const resources=visuals.diagnostics.ownedGeometries;
 visuals.update({},.016,{enabled:false,active:state('strain',2).active});assert.equal(visuals.root.visible,false);assert.equal(visuals.diagnostics.activeKind,null);
 visuals.update({},.016,{enabled:true,active:{kind:'strain',anchor:{x:NaN,y:1}}});assert.equal(visuals.root.visible,false);
 visuals.update({},.016,state('transfer',2));assert.equal(visuals.diagnostics.ownedGeometries,resources,'event changes reuse one scene');
 visuals.reset();assert.equal(visuals.diagnostics.activeSpecimens,0);visuals.dispose();visuals.dispose();
 assert.equal(world.children.length,0);assert.equal(visuals.diagnostics.ownedGeometries,0);assert.equal(visuals.diagnostics.ownedMaterials,0);
 assert.equal(sharedMaterialDisposals,0);assert.equal(sourceGeometryDisposals,0);assert.equal(sourceMaterialDisposals,0);
 const absent=new HorrorEncounterVisuals(world,{},null);absent.update({},.016,state('strain',2));assert.equal(absent.diagnostics.specimen,false);assert.equal(absent.diagnostics.activeSpecimens,0);absent.dispose();
});

test('the shipped Ash Witness hand reaches glass and compresses its actual weighted mesh',async(t)=>{
 // Keep the production skeleton, skin weights and clips. Strip only texture
 // decoding from this Node geometry test; browser QA owns the rendered maps.
 const raw=readFileSync(new URL('../assets/models/afterlife-ash-witness-rig-v05.glb',import.meta.url)),length=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+length));
 json.materials=(json.materials||[]).map(material=>({name:material.name,extras:material.extras,pbrMetallicRoughness:{baseColorFactor:[.4,.4,.4,1],metallicFactor:0,roughnessFactor:.8}}));
 json.textures=[];json.images=[];
 const jsonBytes=Buffer.from(JSON.stringify(json)),padded=Math.ceil(jsonBytes.length/4)*4,binary=raw.subarray(28+length),candidate=Buffer.alloc(28+padded+binary.length,32);
 candidate.writeUInt32LE(0x46546c67,0);candidate.writeUInt32LE(2,4);candidate.writeUInt32LE(candidate.length,8);candidate.writeUInt32LE(padded,12);candidate.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(candidate,20);candidate.writeUInt32LE(binary.length,20+padded);candidate.writeUInt32LE(0x004e4942,24+padded);binary.copy(candidate,28+padded);
 const gltf=await new GLTFLoader().parseAsync(candidate.buffer.slice(candidate.byteOffset,candidate.byteOffset+candidate.byteLength),'');
 const world=new THREE.Group(),visuals=new HorrorEncounterVisuals(world,{}, {template:gltf.scene,clips:gltf.animations});
 try{
  for(const time of[1.5,2.5,3.5,4.5]){
   visuals.update({x:4,y:5},.016,state('strain',time));
   assert(visuals.diagnostics.handSkinVertices>50,'the production hand has meaningful deformable skin');
   assert(visuals.diagnostics.contactError<.035,'actual source bone lengths reach the observation panel');
   assert(visuals.diagnostics.deformedVertices>0,'production knuckle skin compresses');
   assert(visuals.diagnostics.compression<=.016,'localized displacement stays bounded');
  }
  assert(visuals.diagnostics.triangles<50000,'one source actor plus restrained fixtures');
  const started=performance.now();
  for(let frame=0;frame<120;frame++)visuals.update({x:4,y:5},1/60,state('strain',1.5+frame/60));
  t.diagnostic(`Production strain update: ${((performance.now()-started)/120).toFixed(2)} ms average; ${visuals.diagnostics.handSkinVertices} weighted hand vertices; ${visuals.diagnostics.triangles} total scene triangles.`);
 }finally{visuals.dispose();}
});
