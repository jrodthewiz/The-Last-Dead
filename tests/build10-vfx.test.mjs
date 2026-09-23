import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';import {ImpactVFX,RocketVFX} from '../impact-vfx.js';import {newRun,makeCourse,shoot} from '../engine.js';
test('shot metadata distinguishes solid impacts from air and flesh',()=>{for(const [pitch,expected]of [[0,'wall'],[-.7,'floor'],[.7,'air']]){const r=newRun(makeCourse());Object.assign(r,{mode:'play',x:6,y:6,angle:0,pitch});shoot(r);assert.equal(r.tracers[0].surface,expected);const n=r.tracers[0].normal;assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<1e-6);}});
test('impact pools are bounded, expire and clear across repeated combat',()=>{const fx=new ImpactVFX(new THREE.Group());for(let id=0;id<500;id++)fx.burst({id,tx:1,ty:2,tz:.4,weapon:0,surface:'wall',normal:{x:1,y:0,z:0}});fx.update(.016,new THREE.PerspectiveCamera());assert.deepEqual(fx.active,{marks:96,smoke:96});assert.equal(fx.markPool.length,96);for(const m of[fx.marks,fx.smoke])assert.ok([...m.instanceMatrix.array].every(Number.isFinite));fx.update(12,null);assert.deepEqual(fx.active,{marks:0,smoke:0});fx.clear();assert.equal(fx.markCursor,0);});
test('reduced motion suppresses dust while retaining impact evidence',()=>{const fx=new ImpactVFX(new THREE.Group());fx.burst({id:1,tx:1,ty:1,tz:.01,surface:'floor',normal:{x:0,y:0,z:1}});fx.update(.1,null,true);assert.deepEqual(fx.active,{marks:1,smoke:0});});
test('flesh splashes conform to hit normals and carry directional wet depth',()=>{const fx=new ImpactVFX(new THREE.Group());fx.burst({id:17,x:0,y:0,z:0,tx:2,ty:1,tz:.4,weapon:1,surface:'flesh',normal:{x:0,y:0,z:1}});const splash=fx.splashPool[0];const worldNormal=new THREE.Vector3(0,0,1).applyQuaternion(splash.rotation);assert.ok(worldNormal.distanceTo(new THREE.Vector3(0,1,0))<1e-5,'splash plane must follow the hit normal');const incoming=new THREE.Vector3(2,0,1).normalize();const localAxis=new THREE.Vector3(0,1,0).applyQuaternion(splash.rotation);assert.ok(localAxis.dot(incoming)>.93,'splash major axis must follow projected incoming fire');assert.ok(splash.stretch>0.6,'splash must carry non-uniform stretch');fx.update(.12,null);const wet=fx.splashes.geometry.attributes.wet.array[0];assert.ok(wet>0&&wet<1,'wetness should animate through the impact lifetime');assert.ok([...fx.splashes.geometry.attributes.position.array].every(Number.isFinite));});
test('rockets retain exact authoritative positions and align their nose to velocity',()=>{const fx=new RocketVFX(new THREE.Group());fx.update({projectiles:[{kind:'rocket',life:1,x:2,y:3,z:.4,vx:1,vy:2,vz:.5,age:.1},{kind:'enemy',life:1,x:0,y:0,z:0}]});assert.equal(fx.shell.count,1);const m=new THREE.Matrix4();fx.shell.getMatrixAt(0,m);const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();m.decompose(p,q,s);assert.ok(p.distanceTo(new THREE.Vector3(8,1.6,12))<1e-6);assert.ok(new THREE.Vector3(0,0,-1).applyQuaternion(q).distanceTo(new THREE.Vector3(1,.5,2).normalize())<1e-6);fx.update({projectiles:[]});assert.equal(fx.shell.count,0);});

test('redesigned weapons own readable structural surfaces and profiled materials',async()=>{
  const factories=[
    ['Ossuary',(await import('../weapon-ossuary.js')).createOssuary,['receiver','recoil-carriage','cylinder','jaw','spine','grip']],
    ['Breach',(await import('../weapon-breach.js')).createBreach,['receiver','recoil-carriage','twin-barrels','breech-block','pressure-valve','grip']],
    ['Arc',(await import('../weapon-arc.js')).createArc,['frame','reactor','reactor-heat-vents','charge-slider','emitter','grip']],
    ['Reliquary',(await import('../weapon-reliquary.js')).createReliquary,['receiver','recoil-carriage','barrel','core','heat-vents','muzzle-claws','grip']],
  ];
  for(const [label,create,partNames] of factories){
    const model=create();
    const runtime=model.userData.sculptRuntime;
    assert.ok(runtime,`${label} must expose sculpt runtime metadata`);
    for(const partName of partNames)assert.ok(runtime.parts[partName],`${label} must own ${partName}`);
    for(const socketName of ['muzzle','projectileOrigin','grip'])assert.ok(runtime.sockets[socketName],`${label} must retain ${socketName} socket`);
    for(const materialName of ['steel','edge','bone','wood','glow']){
      const authored=runtime.materials[materialName];
      assert.ok(authored?.userData?.weaponSurface,`${label} ${materialName} must carry its authored surface profile`);
      assert.ok(authored.color?.r>=0&&authored.color?.r<=1,`${label} ${materialName} must have a finite color`);
    }
    const allowed=new Set(Object.values(runtime.materials));
    let authoredMeshCount=0;
    model.traverse(node=>{if(node.isMesh){assert.ok(allowed.has(node.material),`${label} mesh ${node.name} must use owned materials`);authoredMeshCount++;}});
    assert.ok(authoredMeshCount>=12,`${label} should retain authored silhouette surfaces`);
  }
});
