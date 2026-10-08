import test from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from '../vendor/cannon-es.js';
import {CorpsePhysics,CorpseBroadphase} from '../corpse-physics.js';

function replay(sparse){
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0)});
 if(sparse){world.collisionMatrix=new CANNON.ObjectCollisionMatrix();world.collisionMatrixPrevious=new CANNON.ObjectCollisionMatrix();}
 world.broadphase=new CANNON.SAPBroadphase(world);
 const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.label='ground';world.addBody(ground);
 const remote=[];
 for(let i=0;i<500;i++){const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(.4,.4,.4)),position:new CANNON.Vec3(10+i,0,10)});body.label='static-'+i;world.addBody(body);remote.push(body);}
 const drop=new CANNON.Body({mass:1,shape:new CANNON.Sphere(.15),position:new CANNON.Vec3(0,1,0)});drop.label='drop';world.addBody(drop);
 const events=[],poses=[];
 for(const type of ['beginContact','endContact'])world.addEventListener(type,e=>events.push([type,[e.bodyA.label,e.bodyB.label].sort().join('/') ]));
 for(let i=0;i<240;i++){
  if(i===100){world.removeBody(remote[0]);world.addBody(remote[0]);}
  if(i===140){drop.position.y=1;drop.velocity.set(0,0,0);drop.aabbNeedsUpdate=true;}
  world.step(1/60);poses.push([...drop.position.toArray(),...drop.velocity.toArray()]);
 }
 return{events,poses,stored:sparse?Object.keys(world.collisionMatrix.matrix).length:world.collisionMatrix.matrix.length};
}

test('sparse corpse contact history preserves actual contact events and drop trajectories after body reindexing',()=>{
 const dense=replay(false),sparse=replay(true);assert.deepEqual(sparse.events,dense.events);assert.ok(sparse.events.some(e=>e[0]==='beginContact'));assert.ok(sparse.events.some(e=>e[0]==='endContact'));
 for(let i=0;i<dense.poses.length;i++)for(let j=0;j<6;j++)assert.ok(Math.abs(dense.poses[i][j]-sparse.poses[i][j])<1e-9);
 assert.ok(dense.stored>125000);assert.ok(sparse.stored<10,'contact storage scales with active pairs');
});

test('cosmetic corpse worlds use bounded contact storage before any coastal colliders are added',()=>{
 const physics=new CorpsePhysics();assert.ok(physics.world.collisionMatrix instanceof CANNON.ObjectCollisionMatrix);assert.ok(physics.world.collisionMatrixPrevious instanceof CANNON.ObjectCollisionMatrix);physics.dispose();
});

test('active corpse queries keep every native candidate pair, including sleeping, held and filtered bodies',()=>{
 const world=new CANNON.World(),bodies=[];
 for(let i=0;i<100;i++){
  const body=new CANNON.Body({mass:i%10===0?1:0,shape:new CANNON.Sphere(.75),position:new CANNON.Vec3(i%10,Math.floor(i/10)*.3,0)});
  if(i===20){body.type=CANNON.Body.KINEMATIC;body.mass=0;}
  if(i===30)body.sleep();if(i===40)body.collisionFilterMask=0;
  world.addBody(body);bodies.push(body);
 }
 for(const boundingBoxes of [false,true]){
  const pairs=broadphase=>{broadphase.useBoundingBoxes=boundingBoxes;const a=[],b=[];broadphase.collisionPairs(world,a,b);return a.map((body,i)=>[body.index,b[i].index].sort((a,b)=>a-b).join('/')).sort();};
  assert.deepEqual(pairs(new CorpseBroadphase()),pairs(new CANNON.NaiveBroadphase()));
 }
});
