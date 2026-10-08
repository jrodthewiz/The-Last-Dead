import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,switchWeapon,fireWeaponInput,fireAttachment,tick,tickPlayer,addPeer,eye} from '../engine.js';
import {createBreach} from '../weapon-breach.js';
import {animateBreachAttachment} from '../weapon-occult-redesign.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {ProjectileWakes} from '../secondary-vfx.js';
import * as T from '../vendor/three.module.js';

function player(){const r=newRun(makeCourse());Object.assign(r,{mode:'play',x:6,y:6,angle:0,pitch:0,waveDelay:999});r.course.enemies=[];switchWeapon(r,1);return r;}

test('aim, primary shot and attached launcher have distinct triggers and cadence',()=>{
 const r=player();fireWeaponInput(r,{alt:true});tickPlayer(r,1/120,{alt:true});assert.equal(r.projectiles.length,0);
 assert(fireWeaponInput(r,{alt:true,attachment:true}));assert.equal(r.projectiles.length,1);const p=r.projectiles[0];
 assert.equal(p.kind,'grenade');assert.equal(p.attachment,true);assert.equal(p.ownerId,'host');assert(p.x>r.x);assert(p.z<eye(r));
 assert.equal(r.shot,0,'launcher must not fire the shotgun barrels');assert.equal(r.attachmentSequence,1);
 assert.equal(fireAttachment(r),false,'launcher cooldown cannot be bypassed');
 assert(fireWeaponInput(r,{fire:true,alt:true}),'primary shotgun remains independently available');
 assert(r.tracers.length>0);assert.equal(r.projectiles.length,1);
 for(let i=0;i<240;i++)tickPlayer(r,1/120,{});assert(fireAttachment(r));
});

test('launcher prediction animates locally while the host creates and owns the projectile',()=>{
 const guest=player();assert(fireAttachment(guest,true));assert.equal(guest.projectiles.length,0);assert.equal(guest.attachmentShot,1);
 const host=player(),peer=addPeer(host);switchWeapon(peer,1);assert(fireWeaponInput(peer,{attachment:true}));
 assert.equal(peer.projectiles.length,0);assert.equal(host.projectiles.length,1);assert.equal(host.projectiles[0].ownerId,'peer');
});

test('unfitted guns, paused/dead players and vehicles cannot fire the attachment',()=>{
 for(const weapon of [0,2,3,4,5,6,7]){const r=player();switchWeapon(r,weapon);assert.equal(fireAttachment(r),false);assert.equal(r.projectiles.length,0);}
 for(const fields of [{mode:'pause'},{health:0},{vehicle:{occupied:true}}]){const r=player();Object.assign(r,fields);assert.equal(fireAttachment(r),false);}
});

test('launch is kept behind nearby walls and a live fuse detonates exactly once',()=>{
 const r=player();r.x=r.course.w-.04;assert(fireAttachment(r));const p=r.projectiles[0];assert(p.x<r.course.w);
 p.life=.001;tick(r,1/120,{});assert.equal(r.projectiles.length,0);assert.equal(r.events.filter(e=>e.type==='explosion').length,1);
 tick(r,1/120,{});assert.equal(r.events.filter(e=>e.type==='explosion').length,1);
});

test('fitted muzzle and independent chamber motion survive weapon batching without luminous flight effects',()=>{
 const gun=createBreach(),muzzle=gun.userData.attachmentMuzzle;assert(muzzle?.isObject3D);
 batchStaticWeaponMeshes(gun);const before=muzzle.getWorldPosition(new T.Vector3());
 animateBreachAttachment(gun,1,1.8);const kicked=muzzle.getWorldPosition(new T.Vector3());assert(kicked.z>before.z+.06);
 const main=gun.userData.breach.recoilCarriage;assert.equal(main.position.z,0);
 animateBreachAttachment(gun,0,0);assert(muzzle.getWorldPosition(new T.Vector3()).distanceTo(before)<1e-8);
 const wakes=new ProjectileWakes(new T.Group(),4);wakes.update([{attachment:true,core:true,life:2,age:.1,x:0,y:0,z:.4,vx:4,vy:0,vz:0}]);assert.equal(wakes.mesh.count,0);
});
