import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldData,createColliders,SpatialGrid} from '../island/data.js';
import {supportHeight,freshState,writeSave,readSave} from '../island/simulation.js';
import {createLootPlan} from '../island/loot-plan.js';
import {domesticProfile} from '../island/domestic-profile.js';
import {openStash,transferLoot} from '../island/backpack.js';
import {searchFocused,punchMotion} from '../island/search-motion.js';
import {breachGesture} from '../island/breach-presentation.js';
import * as T from '../vendor/three.module.js';
import {createMeleeWeapon,animateMeleeWeapon} from '../weapon-melee.js';
import {batContactPose} from '../island/melee-presentation.js';

test('domestic cues predict supplies and all entry containers sit on their authored benches',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),loot=createLootPlan(data,grid,(x,z)=>supportHeight(data,x,z)),types=new Set();let count=0;
 for(const b of data.buildings){const p=domesticProfile(b);if(!p)continue;count++;types.add(p.kind);const c=loot.find(c=>c.id==='stash-'+b.id);assert.equal(c.household,p.kind);assert.deepEqual(c.loot,p.loot);assert.ok(Math.abs(c.y-supportHeight(data,c.x,c.z)-.02)<1e-8);assert.equal(grid.blocked(c.x,c.z,c.y,.7),false);}
 assert.equal(count,18);assert.equal(types.size,4);
 assert.ok(loot.find(c=>c.id==='stash-building-7').loot.scrap);
 assert.ok(loot.find(c=>c.id==='stash-building-8').loot.antiseptic);
});
test('retheming an unopened home cannot regenerate a saved partly emptied container',()=>{
 const s=freshState(),old={id:'stash-building-7',loot:{cloth:3,beer:2}};openStash(s,old);transferLoot(s,old,'cloth',2);
 const storage={setItem(k,v){this.v=v;},getItem(){return this.v;}};writeSave(storage,s);const restored=readSave(storage);
 assert.deepEqual(openStash(restored,{...old,loot:{scrap:99}}),{cloth:1,beer:2});
});
test('a search follows a visible object and stops when looking away',()=>{
 const s={x:0,y:0,z:0,yaw:0,pitch:-.4},c={x:0,y:.72,z:-1.4};assert.equal(searchFocused(s,c),true);assert.equal(searchFocused({...s,yaw:Math.PI},c),false);assert.equal(searchFocused({...s,pitch:1.2},c),false);
});
test('a punch lands on its damage frame while the other fist stays in guard',()=>{
 const active=punchMotion(.19,true),guard=punchMotion(.19,false);assert.ok(guard.z-active.z>.45);assert.equal(active.drive,1);assert.equal(guard.drive,0);
 assert.equal(punchMotion(.65,true).drive,0);for(let t=0;t<.7;t+=1/120)for(const strike of [true,false])assert.ok(Object.values(punchMotion(t,strike)).every(Number.isFinite));
});
test('the representative draw settles and firing returns to the same held pose',()=>{
 assert.equal(breachGesture(9,.28).draw,0);assert.equal(breachGesture(9,0).draw,1);assert.equal(breachGesture(.5,1).kick,0);assert.ok(breachGesture(0,1).kick>.95);
 for(let t=0;t<1;t+=1/120){const v=breachGesture(t,t,.8,false);assert.ok(Object.values(v).every(Number.isFinite));assert.ok(Math.abs(v.kick)<1.1);}
});

test('the actual bat cap meets the aiming line on wide and narrow views with secondary motion disabled too',()=>{
 for(const aspect of [1.6,.487,.9])for(const reducedMotion of [false,true]){
  const camera=new T.PerspectiveCamera(74,aspect,.02,100),group=new T.Group(),bat=createMeleeWeapon({variant:'bat'});camera.add(group);group.add(bat);group.scale.setScalar(.58);group.position.set(.32*Math.min(1,aspect/.9),-.34,-.85);bat.rotation.set(.92,-.32,-.22);
  animateMeleeWeapon(bat,{active:false},0,.016);
  animateMeleeWeapon(bat,{active:true,progress:.4,reducedMotion,...batContactPose(group.position.x,group.position.y,.58)},.25,.016);camera.updateWorldMatrix(true,true);
  const tip=bat.userData.impactTip.getWorldPosition(new T.Vector3()).project(camera);assert.ok(Math.hypot(tip.x,tip.y)<.01,JSON.stringify({aspect,reducedMotion,tip:tip.toArray()}));
 }
});
