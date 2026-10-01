import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {enemyFxBegin,enemyFxEnd} from '../enemy-fx.js';
import {DungeonSupplies} from '../dungeon-supplies.js';
import {coreCanisterGeometry,ricochetCoinGeometry,OrdnanceDetails} from '../combat-detail-v2.js';

test('crowd posture restores exactly and preserves captured contact poses',()=>{
 const root=new THREE.Group();for(const name of ['Spine','Spine1','Spine2','Hips','Head','Neck','LeftShoulder','RightShoulder']){const b=new THREE.Bone();b.name=name;root.add(b);}
 root.userData.afterlife={capturedAttack:true,gaitPhase:.3};
 const enemy={id:5,state:'stalk'},run={time:0};
 root.userData.afterlife.attackAction={getEffectiveWeight:()=>enemy.attacking?1:0};
 for(let i=1;i<1000;i++){enemyFxBegin(root);for(const b of root.children)assert(b.quaternion.angleTo(new THREE.Quaternion())<1e-6,'additive offsets cannot accumulate');root.position.z=i*.015;enemyFxEnd(root,enemy,run,i*16.667);}
 enemyFxBegin(root);enemy.attacking=true;enemy.strike=.2;enemyFxEnd(root,enemy,run,17000);
 for(const b of root.children)assert(b.quaternion.angleTo(new THREE.Quaternion())<1e-6,'captured contact remains unchanged');
});

test('recovery caches compact their shared instance pools after pickup',()=>{
 const parent=new THREE.Group(),cache=new DungeonSupplies(parent,{supplies:[{id:'a',x:2,y:3},{id:'b',x:4,y:5}]});
 assert.equal(cache.meshes.length,3);assert(cache.meshes.every(m=>m.count===2));cache.update(['a']);
 const matrix=new THREE.Matrix4();cache.meshes[0].getMatrixAt(0,matrix);assert.equal(matrix.elements[12],16);assert.equal(matrix.elements[14],20);
 cache.update(['a','b']);assert(cache.meshes.every(m=>m.count===0));
});

test('alternate fire details remain bounded and pressure seals track core instances',()=>{
 for(const g of [coreCanisterGeometry(),ricochetCoinGeometry()]){assert(g.attributes.position.count<5000);assert([...g.attributes.position.array].every(Number.isFinite));g.dispose();}
 const parent=new THREE.Group(),details=new OrdnanceDetails(parent,4),core=new THREE.InstancedMesh(coreCanisterGeometry(),new THREE.MeshBasicMaterial(),4);
 core.count=1;core.setMatrixAt(0,new THREE.Matrix4().makeTranslation(4,3,2));details.update(core);
 assert.equal(details.bands.count,1);assert.deepEqual(details.bands.instanceMatrix.array,core.instanceMatrix.array);core.count=0;details.update(core);assert.equal(details.bands.count,0);
});
