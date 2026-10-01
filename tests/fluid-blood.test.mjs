import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {bloodFlight,createBloodDropletPool,stampBloodDroplet,finishBloodDropletPool} from '../fluid-blood.js';
import {ImpactVFX} from '../impact-vfx.js';
import {PlayerInjuryVisuals} from '../player-injury-visuals.js';
import {disposeObject} from '../renderer.js';

test('fluid travels in metres with gravity, dissipates speed and samples independently of render rate',()=>{
  const start=new THREE.Vector3(2,1.6,-3),initial=new THREE.Vector3(2,1,1),p=new THREE.Vector3(),v=new THREE.Vector3();
  bloodFlight(start,initial,0,p,v);assert.deepEqual(p.toArray(),start.toArray());assert.deepEqual(v.toArray(),initial.toArray());
  const snapshots=[];
  for(const fps of [30,60,120]){for(let i=1;i<=fps*.5;i++)bloodFlight(start,initial,i/fps,p,v);snapshots.push(p.toArray());}
  for(const sample of snapshots)assert.deepEqual(sample,snapshots[0]);
  assert(p.y<start.y);assert(p.x>start.x&&p.x<start.x+1);assert(v.x>0&&v.x<initial.x);assert(v.y<0);
  assert.deepEqual(start.toArray(),[2,1.6,-3]);assert.deepEqual(initial.toArray(),[2,1,1]);
});

test('fixed droplet instances conserve stretch volume, have no emission and share material/geometry',()=>{
  const pool=createBloodDropletPool(48),marker=new THREE.Object3D(),p=new THREE.Vector3(4,2,-6),v=new THREE.Vector3(1,0,3);
  assert.equal(pool.material.emissiveIntensity,0);assert.equal(pool.material.emissive.getHex(),0);assert.equal(pool.material.metalness,0);
  const material=pool.material,geometry=pool.geometry;
  for(let i=0;i<48;i++)stampBloodDroplet(pool,i,marker,p,v,.01,i,1);
  const matrix=new THREE.Matrix4();pool.getMatrixAt(0,matrix);
  assert(Math.abs(matrix.determinant()-.000001)<1e-12,'stretch must preserve cubic radius volume');
  finishBloodDropletPool(pool,48);assert.equal(pool.count,48);assert.equal(pool.material,material);assert.equal(pool.geometry,geometry);
  const direction=new THREE.Vector3(0,1,0).applyQuaternion(marker.quaternion);assert(direction.dot(v.clone().normalize())>.9999);
  geometry.dispose();material.dispose();pool.dispose();
});

test('flesh spatter deposits once on the floor and gore disable clears its visible live pools',()=>{
  const scene=new THREE.Group(),fx=new ImpactVFX(scene);
  fx.burst({id:7,weapon:0,surface:'flesh',x:0,y:0,z:.4,tx:.2,ty:0,tz:.25},true);
  const geo=fx.bloodDrops.geometry,material=fx.bloodDrops.material;
  fx.update(.08,null,false,true);assert(fx.bloodDrops.count>0);assert(fx.detailActive.splashes>0);
  for(let i=0;i<60;i++)fx.update(1/60,null,false,true);
  assert.equal(fx.bloodDrops.count,0);assert(fx.deposits.active>0);const cursor=fx.deposits.cursor;
  for(let i=0;i<60;i++)fx.update(1/60,null,false,true);assert.equal(fx.deposits.cursor,cursor);
  assert.equal(fx.bloodDrops.geometry,geo);assert.equal(fx.bloodDrops.material,material);
  fx.update(.01,null,false,false);assert.equal(fx.deposits.active,0);assert.equal(fx.bloodDrops.count,0);assert.equal(fx.detailActive.splashes,0);
  fx.clear();assert.equal(fx.deposits.cursor,0);assert.equal(fx.bloodDrops.count,0);
  for(const mesh of [fx.marks,fx.smoke,fx.splashes,fx.wounds,fx.bloodDrops,fx.deposits.mesh]){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}
});

test('replacement co-op enemy snapshots keep contact blood attached to the current actor',()=>{
  const fx=new ImpactVFX(new THREE.Group()),oldEnemy={id:3,x:1,y:1,hp:10},next={...oldEnemy,x:1.4};
  fx.burst({id:15,weapon:0,surface:'flesh',x:0,y:0,z:.3,tx:1,ty:1,tz:.3,enemyId:3},true,[oldEnemy]);
  const wound=fx.woundPool[0],previous=wound.position.x;assert.equal(wound.target,oldEnemy);
  fx.update(.02,null,false,true,[next]);assert.equal(wound.target,next);assert(Math.abs(wound.position.x-previous-1.6)<1e-6);
  disposeObject(fx.root);
});

test('untextured droplets preserve the injury atlas and release owned instance buffers',()=>{
  const fx=new PlayerInjuryVisuals({scene:new THREE.Scene()}),disposed=[];
  assert.equal(fx.blood.material.map,null);assert(fx.atlas?.isTexture);assert.equal(fx.atlas,fx.residue.material.map);
  for(const mesh of [fx.blood,fx.residue,fx.entrails])mesh.addEventListener('dispose',()=>disposed.push(mesh.name));
  fx.dispose();assert.equal(disposed.length,3);
  const pool=createBloodDropletPool(4),root=new THREE.Group();root.add(pool);let calls=0;pool.addEventListener('dispose',()=>calls++);
  disposeObject(root);assert.equal(calls,1,'generic renderer cleanup releases instance matrices/colors');
});
