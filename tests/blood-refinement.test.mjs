import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {ImpactVFX} from '../impact-vfx.js';
import {newRun,makeCourse,tick} from '../engine.js';

const flesh={id:7,x:0,y:0,z:0,tx:1,ty:1,tz:1,weapon:0,surface:'flesh',normal:{x:0,y:0,z:1}};

test('small drops stay small while residue ages and finishes spreading',()=>{
 const run=newRun(makeCourse());run.mode='play';run.health=10000;
 run.blood=[{id:991,x:run.x,y:run.y,size:.07,angle:0}];
 for(let i=0;i<180;i++)tick(run,1/60,{});
 const mark=run.blood.find(b=>b.id===991);
 assert.ok(mark.age>2.9);assert.equal(mark.baseSize,.07);
 assert.ok(mark.size>.07&&mark.size<.082,'a drip retains its original scale');
});

test('gore toggle suppresses new and existing flesh effects without hiding wall impacts',()=>{
 const fx=new ImpactVFX(new THREE.Group());
 fx.burst(flesh,false);fx.update(.01,null,false,false);
 assert.equal(fx.detailActive.splashes,0);assert.equal(fx.detailActive.drops,0);
 fx.burst(flesh);fx.update(.015,null);
 assert.ok(fx.detailActive.splashes>0);assert.ok(fx.detailActive.drops>0);
 fx.burst({...flesh,surface:'wall'});fx.update(.015,null,false,false);
 assert.equal(fx.detailActive.splashes,0);assert.equal(fx.bloodDrops.count,0);assert.equal(fx.active.marks,1);
});

test('droplet pool packs live entries after expired holes and stops sheets quickly',()=>{
 const fx=new ImpactVFX(new THREE.Group());fx.burst(flesh);fx.burst({...flesh,id:8});
 for(let i=0;i<9;i++)fx.dropPool[i].age=99;
 fx.update(.01,null);
 assert.equal(fx.bloodDrops.count,9);
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3();fx.bloodDrops.getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);
 assert.ok(position.distanceTo(fx.dropPool[9].position)<1e-5,'first active drop occupies first GPU slot');
 fx.update(.3,null);assert.equal(fx.detailActive.splashes,0);
 assert.equal(fx.splashPool.length,32);assert.equal(fx.dropPool.length,160);
});

test('flesh impact feedback layers a readable wound, seeded atlas variant and directional droplets',()=>{
 const fx=new ImpactVFX(new THREE.Group());
 fx.burst({id:41,x:0,y:0,z:.35,tx:1.4,ty:.2,tz:.42,weapon:4,surface:'flesh',normal:{x:-1,y:0,z:0}});
 fx.update(.035,null);
 assert.equal(fx.detailActive.splashes,1);
 assert.equal(fx.detailActive.wounds,1);
 assert.equal(fx.detailActive.drops,9);
 assert.ok([1,3].includes(fx.splashPool[0].variant),'rifle spray uses a directional atlas tile');
 assert.ok(fx.woundPool[0].size>.19,'wound layer has readable contact scale');
 assert.ok(fx.dropPool[0].size>=.014,'droplets retain visible close range scale');
 const matrix=new THREE.Matrix4();fx.bloodDrops.getMatrixAt(0,matrix);
 assert.ok([...matrix.elements].every(Number.isFinite),'droplet matrices stay finite');
 fx.clear();
 assert.deepEqual(fx.detailActive,{splashes:0,wounds:0,drops:0,deposits:0});
 assert.equal(fx.woundPool[0].age,99);
 assert.equal(fx.bloodDrops.count,0);
});
