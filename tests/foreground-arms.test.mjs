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
import {animateOssuary} from '../weapon-ossuary.js';
import {animateBreach} from '../weapon-breach.js';
import {animateArc} from '../weapon-arc.js';
import {animateReliquary} from '../weapon-reliquary.js';
import {animateRifle} from '../weapon-rifles.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {installForegroundArms,fitForegroundArms,FOREGROUND_WRIST_LIMIT} from '../assets/survivor/foreground-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';

let asset,source;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=attribute=>Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
test.before(async()=>{
  const bitmap=globalThis.createImageBitmap,self=globalThis.self;
  globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try{
    for(const name of ['viewmodel-arms-v2','tld-survivor-v02']){
      const raw=readFileSync(new URL(`../assets/survivor/${name}.glb`,import.meta.url));
      const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
      if(name==='viewmodel-arms-v2')asset=gltf.scene;else source=gltf.scene;
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

test('owned glove and canvas palettes recover readable authored colors without changing the GLB master',()=>{
  const r=fixture(),sourceGlove=asset.getObjectByName('GripPalm_Right').geometry.attributes.color;
  const sourceCanvas=asset.getObjectByName('TLD_ViewSleeve_Right').geometry.attributes.color;
  const before=[hash(bytes(sourceGlove)),hash(bytes(sourceCanvas))];installForegroundArms(r,asset);
  const hand=r.weaponGroups[0].userData.viewArms.rightArm.userData.hand;
  const glove=hand.getObjectByName('GripPalm_Right').geometry.attributes.color;
  assert(glove.getY(0)>.025&&glove.getY(0)<.10,'leather reads as dark leather rather than near-zero black');
  assert.equal(glove.getW(0),sourceGlove.getW(0),'opacity remains authored');
  assert.deepEqual([hash(bytes(sourceGlove)),hash(bytes(sourceCanvas))],before);
});

test('actual garment cuff and elbow rings meet their neighbouring joint planes through recoil and melee without accumulating deformation',()=>{
  const sourcePositions=asset.getObjectByName('TLD_ViewSleeve_Right').geometry.attributes.position;
  const protectedHash=hash(bytes(sourcePositions)),r=fixture();
  r.camera.fov=75;r.camera.updateProjectionMatrix();installForegroundArms(r,asset);
  const point=new T.Vector3(),joint=new T.Vector3(),axis=new T.Vector3(),rotation=new T.Quaternion();
  for(const weapon of [0,4,6,7]){
    const group=r.weaponGroups[weapon];
    for(const phase of [0,.2,.5,.8,1,0]){
      if(weapon>=6)animateMeleeWeapon(group.userData.model,{active:true,progress:phase,heavy:true,sequence:7,reducedMotion:false,sawRev:1,sawActive:true},0,1/60);
      r.weaponRig.rotation.set(.08*phase,-.06*phase,.04*phase);fitForegroundArms(group);
      for(const f of group.userData.foregroundArmFits){
        const state=f.sleeveBend;let cuffs=0,elbows=0;
        f.forearm.traverse(mesh=>{
          if(!mesh.isMesh)return;
          const surface=state.surfaces.find(s=>s.geometry===mesh.geometry);if(!surface)return;
          const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
          for(let i=0;i<position.count;i++){
            point.fromArray(surface.positions,i*3).applyMatrix4(surface.toPivot);
            const cuff=Math.abs(point.y)<1e-6,elbow=Math.abs(point.y+.34)<1e-6;
            if(cuff||elbow){
              point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
              (cuff?f.wrist:f.upper).getWorldPosition(joint);
              (cuff?f.hand:f.upper).getWorldQuaternion(rotation);axis.set(0,-1,0).applyQuaternion(rotation);
              assert(Math.abs(point.sub(joint).dot(axis))<1e-6,'actual exported joint ring lies in the neighbouring hand/sleeve plane');
              cuff?cuffs++:elbows++;
            }
            point.fromBufferAttribute(position,i);assert(point.toArray().every(Number.isFinite));
            point.fromBufferAttribute(normal,i);assert(Math.abs(point.length()-1)<1e-5);
          }
          const stable=hash(bytes(position));fitForegroundArms(group);
          assert.equal(hash(bytes(position)),stable,'repeating the same pose does not accumulate garment deformation');
        });
        assert(cuffs>=40&&elbows>=40,'measure full exported cuff and elbow rings');
      }
    }
  }
  assert.equal(hash(bytes(sourcePositions)),protectedHash,'imported master geometry remains unchanged');
});

test('clean 75-degree desktop and portrait framing preserve adult arm lengths with smaller weapon display sizes',()=>{
  for(const aspect of [16/10,390/844])for(const displayScale of [.54,.56,.58,.64]){
    const r=fixture();r.camera.fov=75;r.camera.aspect=aspect;r.camera.updateProjectionMatrix();
    for(const group of r.weaponGroups)group.scale.setScalar(displayScale);
    installForegroundArms(r,asset);
    for(const group of r.weaponGroups)assertFit(group);
  }
});

test('actual eight Blender hold defaults retain socket contact and fixed limbs throughout draw and firearm recovery',async()=>{
  const {VIEWMODEL_CLIPS}=await import('../assets/survivor/viewmodel-motion-clips.js');
  const {sampleViewmodelClip}=await import('../assets/survivor/viewmodel-motion.js');
  assert.equal(FIRST_PERSON_HOLD_POSES.length,8);
  for(const aspect of [16/10,390/844]){
    const r=fixture();r.camera.fov=75;r.camera.aspect=aspect;r.camera.updateProjectionMatrix();
    for(const [i,g]of r.weaponGroups.entries()){
      const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.position.x*=Math.min(1,aspect/.9);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);
    }
    installForegroundArms(r,asset);
    for(const [i,g]of r.weaponGroups.entries())for(const kind of ['draw','fire','land']){
      const name=FIRST_PERSON_HOLD_POSES[i].name+'/'+kind,clip=VIEWMODEL_CLIPS[name];if(!clip)continue;
      for(let n=0;n<=12;n++){
        const pose=sampleViewmodelClip(name,clip.duration*n/12,new Float64Array(6));
        r.weaponRig.position.set(pose[0]+.02,pose[1]-.012,pose[2]);r.weaponRig.rotation.set(...pose.slice(3));
        fitForegroundArms(g);assertFit(g);
      }
    }
  }
});

test('Blender right index surface reaches the actual Ossuary and Carrion trigger blades through the trigger stroke',()=>{
  const r=fixture();r.camera.fov=75;r.camera.updateProjectionMatrix();
  for(const [i,g]of r.weaponGroups.entries()){
    const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);
  }
  installForegroundArms(r,asset);
  for(const weapon of [0,4])for(const stroke of [0,1]){
    const group=r.weaponGroups[weapon];fitForegroundArms(group);
    const finger=group.userData.viewArms.rightArm.userData.triggerFinger,blade=group.getObjectByName('trigger-blade');
    assert(finger&&blade,'measurement uses actual authored index and weapon trigger geometry');
    finger.rotation.x=-stroke*.22;finger.rotation.z=-stroke*.08;group.updateWorldMatrix(true,true);
    const index=blade.geometry.index,positions=blade.geometry.attributes.position;
    const triangle=new T.Triangle(),point=new T.Vector3(),nearest=new T.Vector3();let gap=Infinity,validSamples=0;
    finger.traverse(mesh=>{
      if(!mesh.isMesh||mesh.name.startsWith('Nail'))return;
      const p=mesh.geometry.attributes.position,step=Math.max(1,Math.floor(p.count/240));
      for(let i=0;i<p.count;i+=step){
        point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
        for(let j=0;j<index.count;j+=3){
          triangle.a.fromBufferAttribute(positions,index.getX(j)).applyMatrix4(blade.matrixWorld);
          triangle.b.fromBufferAttribute(positions,index.getX(j+1)).applyMatrix4(blade.matrixWorld);
          triangle.c.fromBufferAttribute(positions,index.getX(j+2)).applyMatrix4(blade.matrixWorld);
          if(triangle.getArea()<1e-12)continue;
          triangle.closestPointToPoint(point,nearest);const distance=point.distanceTo(nearest);
          assert(Number.isFinite(distance),'nondegenerate trigger triangle must produce a finite surface distance');
          gap=Math.min(gap,distance);validSamples++;
        }
      }
    });
    assert(validSamples>100,'contact is measured against actual nondegenerate blade surfaces');
    assert(gap<.012,`${FIRST_PERSON_HOLD_POSES[weapon].name}: sampled real index surface is ${gap}m from the trigger`);
  }
});

test('batched firearm grip stays attached during repeated yaw reversals and recoil',()=>{
 const r=fixture();for(const g of r.weaponGroups)batchStaticWeaponMeshes(g);
 installForegroundArms(r,asset);
 for(let weapon=0;weapon<6;weapon++)for(let i=0;i<48;i++){
  const g=r.weaponGroups[weapon],shot=i%12<3?1:0;
  r.camera.rotation.y=Math.sin(i*.6)*2.8;r.weaponRig.rotation.y=Math.sin(i*.6)*.09;
  r.weaponRig.position.z=i%12<3?.088:0;
  if(weapon===0)animateOssuary(g,shot,i/60,1/60);
  if(weapon===1)animateBreach(g.userData.model,i/60,shot,1/60);
  if(weapon===2)animateArc(g.userData.model,i/60,shot,1/60);
  if(weapon===3)animateReliquary(g,shot,i/60,1/60);
  if(weapon>=4)animateRifle(g,shot,i/60,1/60,{kick:shot,shotSequence:Math.floor(i/12)});
  fitForegroundArms(g);assertFit(g);
 }
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

test('desktop resize retains each authored weapon scale instead of restoring oversized prototype bodies',()=>{
  const r=fixture();r.canvas={clientWidth:1280,clientHeight:800};r._renderScale=1;
  for(let i=0;i<r.weaponGroups.length;i++)r.weaponGroups[i].scale.setScalar(FIRST_PERSON_HOLD_POSES[i].scale);
  r.resize();
  r.weaponGroups.forEach((group,i)=>assert.equal(group.scale.x,FIRST_PERSON_HOLD_POSES[i].scale));
  r.canvas.clientWidth=1920;r.canvas.clientHeight=1080;r.resize();
  r.weaponGroups.forEach((group,i)=>assert.equal(group.scale.x,FIRST_PERSON_HOLD_POSES[i].scale));
});

test('foreground anatomy reshapes cloned surfaces while preserving UVs, digit pivots and master positions',()=>{
  const protectedMeshes=[];
  asset.traverse(m=>{if(m.isMesh)protectedMeshes.push({mesh:m,position:hash(bytes(m.geometry.attributes.position))});});
  const r=fixture();installForegroundArms(r,asset);
  const hand=r.weaponGroups[6].userData.viewArms.rightArm.userData.hand;
  for(const name of ['GripPalm_Right','GripMiddle_Right','GripThumb_Right']){
    const original=asset.getObjectByName(name),owned=hand.getObjectByName(name);
    assert.notEqual(hash(bytes(owned.geometry.attributes.position)),hash(bytes(original.geometry.attributes.position)),'actual surface changes');
    assert.equal(hash(bytes(owned.geometry.attributes.uv)),hash(bytes(original.geometry.attributes.uv)),'authored texture coordinates survive');
    assert.deepEqual(owned.parent.position.toArray(),original.parent.position.toArray(),'digit animation pivot stays fixed');
  }
  protectedMeshes.forEach(({mesh,position})=>assert.equal(hash(bytes(mesh.geometry.attributes.position)),position));
  assertFit(r.weaponGroups[6]);
});

test('melee index wraps the handle while firearm index retains trigger reach and native digit pivots',()=>{
  const r=fixture();installForegroundArms(r,asset);
  const original=asset.getObjectByName('GripIndex_Right');
  for(const weapon of [0,4,6,7]){
    const hand=r.weaponGroups[weapon].userData.viewArms.rightArm.userData.hand;
    const index=hand.getObjectByName('GripIndex_Right'),points=index.geometry.attributes.position;
    hand.updateWorldMatrix(true,true);
    const matrix=hand.matrixWorld.clone().invert().multiply(index.matrixWorld),p=new T.Vector3(),box=new T.Box3();
    for(let i=0;i<points.count;i++)box.expandByPoint(p.fromBufferAttribute(points,i).applyMatrix4(matrix));
    if(weapon>=6){
      assert(box.min.x>-.045,'melee fingertip curls around the handle instead of retaining the outward trigger reach');
      assert(box.max.z>.038,'index wraps across the same handle face as the other grasping digits');
    }else assert(box.min.x<-.060,'firearm fingertip retains its reach onto the trigger');
    assert.deepEqual(index.parent.position.toArray(),original.parent.position.toArray(),'animation joint remains native');
    assert.equal(hash(bytes(index.geometry.attributes.uv)),hash(bytes(original.geometry.attributes.uv)));
    assertFit(r.weaponGroups[weapon]);
  }
});

test('glove heel covers the wrist transition without extending the palm into the grip',()=>{
  const r=fixture();installForegroundArms(r,asset);
  for(const side of ['right','left']){
    const hand=r.weaponGroups[6].userData.viewArms[side+'Arm'].userData.hand;
    const palm=hand.getObjectByName('GripPalm_'+(side==='right'?'Right':'Left'));
    hand.updateWorldMatrix(true,true);
    const matrix=hand.matrixWorld.clone().invert().multiply(palm.matrixWorld),p=new T.Vector3(),box=new T.Box3();
    const positions=palm.geometry.attributes.position,normals=palm.geometry.attributes.normal;
    for(let i=0;i<positions.count;i++){
      box.expandByPoint(p.fromBufferAttribute(positions,i).applyMatrix4(matrix));
      assert(p.toArray().every(Number.isFinite));
      assert(Math.abs(p.fromBufferAttribute(normals,i).length()-1)<1e-5);
    }
    assert(box.min.y<-.105&&box.min.y>-.113,'gauntlet heel extends across the short wrist transition');
    assert(box.max.y<.054,'distal palm remains behind its authored finger roots');
  }
});

test('both owned palm surfaces face outward and repair does not mutate the mirrored source index buffer',()=>{
  const original=asset.getObjectByName('GripPalm_Left').geometry.index,before=hash(bytes(original));
  const r=fixture();installForegroundArms(r,asset);
  for(const group of r.weaponGroups)for(const side of ['right','left']){
    const hand=group.userData.viewArms?.[side+'Arm']?.userData.hand;if(!hand)continue;
    const mesh=hand.getObjectByName('GripPalm_'+(side==='left'?'Left':'Right')),p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let volume=0;
    for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));volume+=a.dot(b.cross(c))/6;}
    assert(volume>.0003,side+' closed palm has outward triangle winding, rather than exposing the outline shell through a culled glove');
    assert.equal(mesh.material.side,T.FrontSide,'normal front-face occlusion remains enabled');
  }
  assert.equal(hash(bytes(original)),before,'protected source index buffer is not changed');
});
