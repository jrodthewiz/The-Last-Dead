import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {buildCoastalBasementEntrance} from '../coastal-basement-visuals.js';

test('service stair construction drains from a true ridge and preserves the island return lane',()=>{
 const material=new THREE.MeshStandardMaterial();
 const world={course:{basementPortal:{x:10.5,y:7}},root:new THREE.Group(),diagnostics:{},materials:{coastStone:material,rust:material}};
 world.box=(x,y,z,w,h,d,mat,name)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);world.root.add(mesh);return mesh;};
 world.sign=(text,x,y,z,angle,width)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/8),material);mesh.name=text;mesh.position.set(x,y,z);mesh.rotation.y=angle;world.root.add(mesh);const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,y+.22,8),material);post.name='SignMount';world.root.add(post);};
 const source=JSON.stringify(world.course);buildCoastalBasementEntrance(world);assert.equal(JSON.stringify(world.course),source);
 const roofs=world.root.children.filter(m=>m.name==='BasementStairPitchedMetalRoof');assert.equal(roofs.length,2);
 for(const roof of roofs){
  const side=Math.sign(roof.position.z-28),halfDepth=roof.geometry.parameters.depth/2;
  const ridge=new THREE.Vector3(0,0,-side*halfDepth).applyEuler(roof.rotation).add(roof.position);
  const eave=new THREE.Vector3(0,0,side*halfDepth).applyEuler(roof.rotation).add(roof.position);
  assert.ok(ridge.y>eave.y+.45,'roof falls toward its gutter');
 }
 assert.equal(world.root.children.filter(m=>m.name==='SignMount').length,0);
 for(const name of ['BasementStairMasonryGable','BasementStairRecessShadow','BasementStairSignBracket','BasementStairDrainGrille','BasementStairSignSupplyConduit'])assert.ok(world.root.children.some(m=>m.name===name),name);
 // Existing centimetre-thin safety paint remains flush with the street.
 const lane=new THREE.Box3(new THREE.Vector3(43.4-.88,.10,28-.88),new THREE.Vector3(43.4+.88,2.4,44+.88));
 world.root.updateMatrixWorld(true);
 let triangles=0;
 for(const mesh of world.root.children){assert.equal(mesh.material,material);assert.ok(!new THREE.Box3().setFromObject(mesh).intersectsBox(lane),`clear sixteen metre return lane: ${mesh.name}`);triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}
 assert.ok(triangles<1250,`bounded total triangle count ${triangles}`);
});
