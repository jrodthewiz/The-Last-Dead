import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {JourneyVisuals} from '../journey-visuals.js';
import {makeDungeonCourse} from '../playground/map/dungeon-course.js';
import {createJourney} from '../campaign-journey.js';
import {finalizeStaticWorld} from '../world-static.js';

test('five chapter mechanisms have finite authored geometry and leave their operating point clear',()=>{
 for(let i=0;i<5;i++){
  const course=makeDungeonCourse(i,{journey:true}),world=new THREE.Group(),visuals=new JourneyVisuals(world,course);
  assert.equal(visuals.entries.length,course.journeyStations.length);
  assert.ok(visuals.diagnostics().meshes<=40,'chapter assemblies keep their material draws bounded');
  const attachedGeometries=new Set(),attachedMaterials=new Set();visuals.root.traverse(node=>{if(node.geometry)attachedGeometries.add(node.geometry);if(node.material)attachedMaterials.add(node.material);});
  assert.deepEqual(visuals.geometries,attachedGeometries,'world disposal reaches every owned geometry');
  assert.deepEqual(visuals.materials,attachedMaterials,'world disposal reaches every owned material');
  for(const material of visuals.materials)if(material.isMeshStandardMaterial){
   assert.ok(material.roughness>=.82,'close station surfaces remain matte');
   assert.ok(material.metalness<=.62,'station hardware avoids clipped specular faces');
   assert.ok(Math.max(material.color.r,material.color.g,material.color.b)<=.3,'station palettes are calibrated in linear space');
  }
  for(const entry of visuals.entries){
   const position=entry.root.position,point=entry.root.userData.operatingPoint;
   assert.ok(Math.abs(Math.hypot(position.x-point.x,position.z-point.z)-1.4)<1e-8);
   entry.root.traverse(node=>{if(node.geometry){
    node.geometry.computeBoundingBox();const box=node.geometry.boundingBox;
    for(const number of [...box.min.toArray(),...box.max.toArray()])assert.ok(Number.isFinite(number));
   }});
  }
  visuals.dispose();assert.equal(world.children.length,0);
 }
});

test('ward isolation motion survives static-world compilation and respects completion',()=>{
 const course=makeDungeonCourse(1,{journey:true}),world=new THREE.Group(),visuals=new JourneyVisuals(world,course),journey=createJourney(course);
 finalizeStaticWorld(world,[visuals.root]);
 assert.equal(visuals.entries[0].shutter.matrixAutoUpdate,true);
 visuals.update({journey,time:1},1000);
 const original=visuals.entries[0].shutter.position.y;
 journey.stations[0].status='complete';visuals.update({journey,time:3},3000,true);
 assert.ok(visuals.entries[0].shutter.position.y<original,'isolation closes the ward circuit shutter');
 assert.equal(visuals.entries[0].status,'complete');
 visuals.dispose();
});

test('cargo handwheel keeps its committed angle when pressure cycling begins',()=>{
 const course=makeDungeonCourse(0,{journey:true}),world=new THREE.Group(),visuals=new JourneyVisuals(world,course),journey=createJourney(course);
 journey.progress=1;visuals.update({journey,time:1});const committed=visuals.entries[0].wheel.rotation.z;
 journey.stations[0].status='complete';journey.phase='cycling';journey.elapsed=0;
 visuals.update({journey,time:1});assert.equal(visuals.entries[0].wheel.rotation.z,committed);
 assert.ok(visuals.entries[0].needle.children[0].material.isMeshBasicMaterial,'dial stays readable under a close flashlight');
 visuals.dispose();
});

test('reliquary transfers visually to the return socket without hiding combat effects',()=>{
 const course=makeDungeonCourse(2,{journey:true}),world=new THREE.Group(),visuals=new JourneyVisuals(world,course),journey=createJourney(course);
 const run={journey,time:1};visuals.update(run);
 assert.equal(visuals.entries[0].casket.visible,true);assert.equal(visuals.entries[1].casket.visible,false);
 journey.stations[0].status='complete';journey.stations[1].status='active';journey.phase='carrying';visuals.update(run);
 assert.equal(visuals.entries[0].casket.visible,false);assert.equal(visuals.entries[1].casket.visible,false);
 journey.stations[1].status='complete';journey.phase='complete';visuals.update(run);
 assert.equal(visuals.entries[1].casket.visible,true);visuals.dispose();
});

test('chimes disable swing under reduced motion and final transfer drum settles exactly',()=>{
 const course=makeDungeonCourse(3,{journey:true}),world=new THREE.Group(),visuals=new JourneyVisuals(world,course),journey=createJourney(course);
 journey.stations[0].status='complete';journey.phase='chord';visuals.update({journey,time:.17},170);
 assert.notEqual(visuals.entries[0].bell.rotation.z,0);
 visuals.update({journey,time:.17},170,true);assert.equal(visuals.entries[0].bell.rotation.z,0);visuals.dispose();
 const finalCourse=makeDungeonCourse(4,{journey:true}),last=new JourneyVisuals(world,finalCourse),shutdown=createJourney(finalCourse);
 shutdown.stations[0].status='complete';shutdown.phase='shutdown';shutdown.elapsed=4;
 last.update({journey:shutdown,time:10});shutdown.phase='complete';shutdown.elapsed=5;last.update({journey:shutdown,time:11});
 const stopped=last.entries[0].drum.rotation.x;last.update({journey:shutdown,time:20});
 assert.equal(last.entries[0].drum.rotation.x,stopped);last.dispose();
});

test('owned resources are disposed once and regular arena courses add nothing',()=>{
 const world=new THREE.Group(),course=makeDungeonCourse(0,{journey:true}),visuals=new JourneyVisuals(world,course);
 let geometryDisposals=0,materialDisposals=0;
 for(const geometry of visuals.geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);
 for(const material of visuals.materials)material.addEventListener('dispose',()=>materialDisposals++);
 const counts=visuals.diagnostics();visuals.dispose();visuals.dispose();
 assert.equal(geometryDisposals,counts.geometries);assert.equal(materialDisposals,counts.materials);
 const legacy=new JourneyVisuals(world,makeDungeonCourse(0));assert.equal(legacy.entries.length,0);assert.equal(world.children.length,0);legacy.dispose();
});
