import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeCourse,newRun,shoot,eye,addPeer} from '../engine.js';
import {CombatVFX} from '../combat-vfx.js';
const fresh=()=>{const r=newRun(makeCourse());Object.assign(r,{mode:'play',x:6,y:6,angle:0,waveDelay:999});r.course.enemies=[];return r;};
test('pitched hitscan endpoints remain on the camera ray, including floor intersection',()=>{
 for(const pitch of [-1.1,-.3,0,.3,1.1])for(const weapon of [0,2]){
  const r=fresh();r.pitch=pitch;r.weapon=weapon;shoot(r);const t=r.tracers[0];
  assert.ok(t);assert.ok(Math.abs(t.tz-(eye(r)+Math.hypot(t.tx-r.x,t.ty-r.y)*Math.tan(pitch)))<1e-8);assert.ok(t.tz>=.01-1e-8);
  if(pitch>0)assert.ok(t.tz>1.45,'upward shots must not clamp to an unrelated height');
 }
});
test('rocket launch is on the full pitch ray and cannot skip nearby cover',()=>{
 for(const pitch of [-1,0,1]){const r=fresh();r.weapon=3;r.pitch=pitch;shoot(r);const p=r.projectiles[0];assert.deepEqual([p.x,p.y,p.z],[r.x,r.y,eye(r)]);assert.ok(Math.abs(p.vz/p.vx-Math.tan(pitch))<1e-8);}
});
test('host and guest tracer ownership is explicit even at the same location',()=>{
 const r=fresh(),p=addPeer(r);p.x=r.x;p.y=r.y;p.angle=0;shoot(r);shoot(p);assert.deepEqual(r.tracers.map(t=>t.ownerId),['host','peer']);
});
test('tracer muzzle origin freezes after firing, excludes peers, and expires',()=>{
 const r=fresh();shoot(r);const fx=new CombatVFX(new THREE.Group()),muzzle=new THREE.Vector3(24.2,1.3,23.7);
 fx.update(r,.016,false,muzzle);const origin=fx.origins.get(r.tracers[0].id).clone();muzzle.set(30,5,20);r.x+=1;fx.update(r,.016,false,muzzle);assert.ok(fx.origins.get(r.tracers[0].id).equals(origin));
 r.tracers.push({...r.tracers[0],id:999,ownerId:'peer'});fx.update(r,.016,false,muzzle);assert.equal(fx.origins.has(999),false);
 r.tracers=[];fx.update(r,.016,false,muzzle);assert.equal(fx.origins.size,0);
});
