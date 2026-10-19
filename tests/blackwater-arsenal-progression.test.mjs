import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid} from '../island/data.js';
import {freshState,writeSave,readSave,supportHeight} from '../island/simulation.js';
import {WEAPONS,weaponCaches,recoverWeapon,equip,repeatsWhileHeld} from '../island/armory-state.js';
import {interiorPlan} from '../island/interior-plan.js';
import {domesticProfile} from '../island/domestic-profile.js';
import {canReachPickup} from '../island/interaction-target.js';
import * as T from '../vendor/three.module.js';
import {AIM_LINES,applySightPose} from '../island/weapon-aim-pose.js';

test('three new tools are distinct discoveries with committed contact before recovery',()=>{
 const s=freshState(),profiles=['sword','hammer','pipe'].map(id=>WEAPONS.find(w=>w.id===id));
 assert.equal(WEAPONS.length,12);assert.equal(new Set(profiles.map(w=>w.interval)).size,3);assert.equal(new Set(profiles.map(w=>w.damage)).size,3);
 for(const w of profiles){assert.equal(s.armory[w.id].owned,false);assert.ok(w.contact>0&&w.contact<w.interval);assert.equal(repeatsWhileHeld(w),false);assert.equal(w.capacity,0);assert.equal(w.kind,'melee');assert.ok(w.range>=2.5);}
});
test('discovered tools equip, survive save/load, and cannot be farmed as zero ammunition',()=>{
 for(const id of ['sword','hammer','pipe']){const s=freshState(),c={id:'weapon-'+id,weapon:id};assert.deepEqual(recoverWeapon(s,c),{id:'weapon-'+id,count:1});assert.equal(equip(s,id),true);const storage={setItem(k,v){this.value=v;},getItem(){return this.value;}};writeSave(storage,s);const restored=readSave(storage);assert.equal(restored.weapon,id);assert.equal(restored.armory[id].owned,true);assert.equal(restored.ammo,0);assert.equal(recoverWeapon(restored,c),null);}
});
test('every authored weapon find has a supported, uncovered usable approach',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),caches=weaponCaches(data);assert.equal(caches.length,10);assert.equal(new Set(caches.map(c=>c.id)).size,10);
 for(const c of caches){const y=supportHeight(data,c.x,c.z),target={...c,y:y+.2};assert.equal(grid.blocked(c.x,c.z,y,.42),false,c.id+' buried in furniture');let approaches=0;
  for(const [dx,dz]of [[0,1.5],[0,-1.5],[1.5,0],[-1.5,0]]){const x=c.x+dx,z=c.z+dz,yy=supportHeight(data,x,z);if(!grid.blocked(x,z,yy,.42)&&canReachPickup({x,y:yy,z,yaw:Math.atan2(-dx,dz)},target,grid,2.4))approaches++;}assert.ok(approaches>0,c.id+' has no visible approach');
 }
});
test('ordinary homes show different inhabited activities on their dining/work surfaces',()=>{
 const data=createWorldData(),seen=new Set();for(const b of data.buildings){const p=domesticProfile(b);if(!p||['building-7','building-8'].includes(b.id))continue;const plan=interiorPlan(b),roles=new Set(plan.pieces.map(p=>p.role));if(p.kind==='linen')assert.ok(roles.has('sewing-workcloth'));if(p.kind==='remedies')assert.ok(roles.has('care-ledger-page'));if(p.kind==='pantry')assert.ok(roles.has('household-loaf'));seen.add(p.kind);}
 assert.ok(seen.has('linen')&&seen.has('pantry')&&seen.has('remedies'));
});

test('every aimed legacy firearm places both physical sight points on the camera aiming line',()=>{
 for(const [id,line]of Object.entries(AIM_LINES))for(const aspect of [1.6,.487]){const camera=new T.PerspectiveCamera(id==='mourning'?28:48,aspect,.02,100),group=new T.Group();camera.add(group);group.position.set(.32,-.4,-1.1);group.rotation.set(.025,.3,-.035);group.scale.setScalar(.56);applySightPose(group,id,.56,1);camera.updateWorldMatrix(true,true);for(const point of [line.rear,line.front]){const p=group.localToWorld(new T.Vector3(...point)).project(camera);assert.ok(Math.hypot(p.x,p.y)<.00001,id+' physical sights off ray');}}
});
