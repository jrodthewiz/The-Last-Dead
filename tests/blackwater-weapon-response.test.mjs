import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {WEAPONS} from '../island/armory-state.js';
import {FIRE_RESPONSE,weaponResponse,reloadWeight} from '../island/weapon-response.js';
import {SALVAGE_RESPONSE,salvageMotionAge} from '../island/salvage-response.js';
import {createFeedback} from '../island/feedback.js';

test('seven firearm envelopes settle inside their legal cadence and retain finite ADS response',()=>{
 const out={};
 for(const [id,p] of Object.entries(FIRE_RESPONSE)){
  const w=WEAPONS.find(w=>w.id===id);assert.ok(p.end<w.interval);assert.equal(weaponResponse(id,0,0,true,out),out);
  for(const aim of [0,1])for(let i=0;i<=1000;i++){const s=weaponResponse(id,i/1000*w.interval,aim,true,out);assert.ok(Object.values(s).every(Number.isFinite));assert.ok(Math.abs(s.z)<=p.travel*1.01);}
  assert.equal(weaponResponse(id,p.end).kick,0);assert.equal(weaponResponse(id,p.end).pulse,0);assert.equal(weaponResponse(id,p.rise).kick,1);
  assert.equal(weaponResponse(id,p.rise,1,false).roll,0);
 }
 assert.equal(reloadWeight(0),0);assert.ok(reloadWeight(1)<1e-20);assert.ok(Math.abs(reloadWeight(.0001)-reloadWeight(0))<1e-6);assert.equal(reloadWeight(.5),1);
});
test('bat contact resistance is repaid before the next legal swing, including walls',()=>{
 const w=WEAPONS.find(w=>w.id==='bat'),end=w.interval-.045;
 assert.equal(salvageMotionAge('bat',w.contact-.02,w.contact,end,'body',true),w.contact);
 for(const hit of ['body','wall']){let last=0;for(let i=0;i<=1000;i++){const t=i/1000*end,age=salvageMotionAge('bat',t,w.contact,end,hit);assert.ok(age>=last-1e-10);last=age;}assert.equal(last,end);}
 assert.ok(SALVAGE_RESPONSE.bat.swingLead<w.contact);
});
test('blood facets are short-lived, bounded and never allocate render objects during impacts',()=>{
 const scene=new T.Scene(),f=createFeedback(scene,()=>4),point=new T.Vector3(2,5,3),direction=new T.Vector3(1,0,0),original=direction.clone();
 const objects=scene.children.slice(),resources=objects.map(o=>[o.geometry,o.material,o.instanceColor]);
 f.impact(point,false,direction);assert.equal(f.bursts,0);f.clear();
 for(let i=0;i<160;i++)f.impact(point,true,direction,i%2===0,1.4);
 assert.equal(f.bursts,12);assert.equal(f.active.particles,96);assert.deepEqual(scene.children,objects);assert.ok(direction.equals(original));
 objects.forEach((o,i)=>assert.deepEqual([o.geometry,o.material,o.instanceColor],resources[i]));
 for(let i=0;i<60;i++)f.update(1/60);assert.equal(f.bursts,0);assert.ok(f.active.stains>0&&f.active.stains<=40);
 f.clear();assert.equal(f.bursts,0);assert.deepEqual(f.active,{particles:0,stains:0,surfaces:0,cases:0});
});
