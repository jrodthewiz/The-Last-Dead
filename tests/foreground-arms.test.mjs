import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {BrutalCombatVisuals} from '../brutal-combat-visuals.js';
import {VerminVisuals} from '../vermin-visuals.js';
import {animateMeleeWeapon} from '../weapon-melee.js';
import {installForegroundArms,fitForegroundArms,FOREGROUND_WRIST_LIMIT} from '../assets/survivor/foreground-arms.js';

let asset,source;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=attribute=>Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
test.before(async()=>{
  const bitmap=globalThis.createImageBitmap,self=globalThis.self;
  globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try{
    for(const name of ['viewmodel-arms-v1','tld-survivor-v02']){
      const raw=readFileSync(new URL(`../assets/survivor/${name}.glb`,import.meta.url));
      const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
      if(name==='viewmodel-arms-v1')asset=gltf.scene;else source=gltf.scene;
    }
  }finally{
    if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
    if(self===undefined)delete globalThis.self;else globalThis.self=self;
  }
});

function fixture(){
  const r=Object.create(Renderer.prototype);r.materials={};r.weaponRig=new T.Group();
  r.camera=new T.PerspectiveCamera(118,16/9,.025,220);r.camera.position.set(12,1.6,-4);r.camera.rotation.set(.1,1.7,-.05);
  r.camera.add(r.weaponRig);r.weaponRig.position.set(.03,-.02,.01);r.weaponRig.rotation.set(.1,.04,-.05);
  r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
  for(const group of r.weaponGroups){group.scale.setScalar(.64);r.weaponRig.add(group);}
  return r;
}

function assertFit(group){
  group.updateWorldMatrix(true,true);
  const camera=group.userData.foregroundCamera,inverseCamera=camera.matrixWorld.clone().invert();
  const bottomNormal=new T.Vector3(0,1,-Math.tan(T.MathUtils.degToRad(camera.fov*.5))).normalize();
  for(const f of group.userData.foregroundArmFits){
    const socket=f.arm.userData.gripSocket.getWorldPosition(new T.Vector3());
    assert(socket.distanceTo(f.grip.getWorldPosition(new T.Vector3()))<1e-6,'hand stays on actual moving grip');
    const wrist=f.wrist.getWorldPosition(new T.Vector3()),start=f.forearm.getWorldPosition(new T.Vector3());
    assert(wrist.distanceTo(start)<1e-6,'authored sleeve starts at explicit anatomical wrist');
    const elbow=f.forearm.localToWorld(new T.Vector3(0,-.34,0));
    assert(Math.abs(wrist.distanceTo(elbow)-.30464)<1e-6,'forearm keeps its metric rest length');
    assert(elbow.distanceTo(f.upper.getWorldPosition(new T.Vector3()))<1e-6,'upper sleeve connects at elbow');
    assert(Math.abs(f.upper.getWorldPosition(new T.Vector3()).distanceTo(f.upper.localToWorld(new T.Vector3(0,-.40,0)))-.3584)<1e-6,'upper sleeve retains its authored adult length');
    assert(f.shoulderPlaneDistance<1e-6,'entire capped sleeve end stays below the camera frustum');
    const inverseUpper=f.upper.matrixWorld.clone().invert(),native=new T.Vector3(),world=new T.Vector3();let capVertices=0;
    f.upper.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const p=mesh.geometry.attributes.position,toUpper=inverseUpper.clone().multiply(mesh.matrixWorld);
      for(let i=0;i<p.count;i++){
        native.fromBufferAttribute(p,i).applyMatrix4(toUpper);
        if(native.y>-.375)continue;
        capVertices++;world.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseCamera);
        assert(bottomNormal.dot(world)<-.005,'actual exported cap vertices remain below the visible frame');
      }
    });
    assert(capVertices>20,'the cap check measures exported geometry rather than a joint centre');
    assert(f.wristAngle<=FOREGROUND_WRIST_LIMIT+1e-6,'wrist never bends backward beyond anatomical cone');
    for(const pivot of [f.hand,f.forearm,f.upper]){
      const scale=pivot.getWorldScale(new T.Vector3());
      assert(Math.max(scale.x,scale.y,scale.z)-Math.min(scale.x,scale.y,scale.z)<1e-6,'no anisotropic distortion');
    }
  }
}

test('actual eight weapon grips preserve adult forearm length and bounded wrists throughout melee strokes',()=>{
  const r=fixture();assert.equal(installForegroundArms(r,asset),15);
  for(const group of r.weaponGroups)assertFit(group);
  for(let weapon=6;weapon<8;weapon++)for(let i=0;i<=100;i++){
    const group=r.weaponGroups[weapon];
    animateMeleeWeapon(group.userData.model,{active:true,progress:i/100,heavy:true,sequence:7,reducedMotion:false,sawRev:1,sawActive:true},i/60,1/60);
    fitForegroundArms(group);assertFit(group);
  }
});

test('foreground contract validates before mutating a working weapon assembly',()=>{
  const r=fixture(),hand=r.weaponGroups[0].userData.viewArms.rightArm.userData.hand;
  const children=[...hand.children],parent=hand.parent;
  assert.throws(()=>installForegroundArms(r,new T.Group()),/Missing TLD_GripHand_Right/);
  assert.equal(hand.parent,parent);assert.deepEqual(hand.children,children);
});

test('interaction arms wait for the cleaned derivative instead of caching the first body template',()=>{
  const template={clone(){throw new Error('pending body template must not be cloned');}};
  for(const [type,method] of [[BrutalCombatVisuals,'setupArms'],[VerminVisuals,'setupArm']]){
    const visual=Object.create(type.prototype);visual.renderer={_survivors:{template,armStatus:'loading'}};
    assert.doesNotThrow(()=>visual[method]());assert.equal(visual.arms,undefined);
  }
});

test('direct Mesh hand nodes retain their geometry inside the fitted hand',()=>{
  const r=fixture(),fixtureAsset=asset.clone(true);
  const original=fixtureAsset.getObjectByName('TLD_GripHand_Right'),replacement=new T.Mesh(new T.BoxGeometry(.08,.15,.05),new T.MeshStandardMaterial());
  replacement.name=original.name;original.parent.add(replacement);original.removeFromParent();
  installForegroundArms(r,fixtureAsset);
  const hand=r.weaponGroups[0].userData.viewArms.rightArm.userData.hand;
  const imported=hand.getObjectByName('TLD_GripHand_Right');assert(imported?.isMesh);
  assert.equal(imported.geometry.attributes.position.count,replacement.geometry.attributes.position.count);
  assert.notEqual(imported.geometry,replacement.geometry,'fitted hand owns its geometry');
});

test('cleaned interaction arms keep original UVs, normalized weights, bind graph and source asset intact',()=>{
  const clean=asset.getObjectByName('TLD_Remote_Arms'),old=source.getObjectByName('TLD_Remote_Arms');
  assert(clean?.isSkinnedMesh);assert.notEqual(hash(bytes(clean.geometry.attributes.position)),hash(bytes(old.geometry.attributes.position)));
  for(const name of ['uv','skinIndex','skinWeight'])assert.equal(hash(bytes(clean.geometry.attributes[name])),hash(bytes(old.geometry.attributes[name])),name);
  assert.deepEqual(clean.skeleton.bones.map(b=>b.name),old.skeleton.bones.map(b=>b.name));
  clean.skeleton.boneInverses.forEach((inverse,i)=>inverse.elements.forEach((v,j)=>assert(Math.abs(v-old.skeleton.boneInverses[i].elements[j])<1e-6)));
  const weights=clean.geometry.attributes.skinWeight;
  for(let i=0;i<weights.count;i++){let sum=0;for(let j=0;j<4;j++)sum+=weights.getComponent(i,j);assert(Math.abs(sum-1)<1e-5);}
  assert.equal(hash(readFileSync(new URL('../assets/survivor/tld-survivor-v02.glb',import.meta.url))),'f3c9b277985435845d0848f9fc9ca32fa92da9f695c911f7ea48eacff712db03');
});

test('authored grip hands have four distinct fingers, opposed thumbs and isolated trigger articulation',()=>{
  for(const side of ['Left','Right']){
    const hand=asset.getObjectByName('TLD_GripHand_'+side);
    for(const digit of ['Index','Middle','Ring','Little','Thumb'])assert(hand.getObjectByName(side==='Right'&&digit==='Index'?'RightTriggerFinger':side+digit+'Finger'),side+digit);
    const positions=[];hand.traverse(m=>{if(m.isMesh)positions.push(hash(bytes(m.geometry.attributes.position)));});
    assert(positions.length>=6,'palm and separate anatomical digits exist');assert(new Set(positions).size>=5,'digits have authored shape variation');
  }
});
