import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {HarborThaiVisuals} from '../harbor-thai-visuals.js';
import {canStand} from '../engine.js';
import {buildHarborServiceFrontages,harborServiceFrontagePlan,SERVICE_GALLERY_LEVELS,SERVICE_ACCESS} from '../harbor-service-frontages.js';

test('three recessed service bays are carried inside unchanged sealed lots and retain all player routes',()=>{
 const c=makeHarborCourse({openWorld:true}),saved=JSON.stringify(c),p=harborServiceFrontagePlan(c);assert.equal(JSON.stringify(c),saved);assert.equal(p.bays.length,3);
 for(const part of p.parts){
  const b=c.buildings.find(b=>b.id===(part.bayId.startsWith('dispatch')?'harbor-block-5':'harbor-block-4'));
  const [x,y,z]=part.position,[w,h,d]=part.size;assert.ok([...part.position,...part.size].every(Number.isFinite));
  assert.ok(x-w/2>=b.x*4-1e-6&&x+w/2<=(b.x+b.w)*4+1e-6&&z-d/2>=b.y*4-1e-6&&z+d/2<=(b.y+b.h)*4+1e-6,'inside original canonical lot');
  if(b.passage)assert.ok(x+w/2<60||x-w/2>68,'Power Cut full eight-metre axis clear');
  assert.ok(['concrete','rust','dark'].includes(part.slot));
  assert.ok(y-h/2>=.13-1e-6);
 }
 for(const i of c.coastal.blackwaterSlice.interiors)for(const [a,b]of [[i.route.frontApproach,i.door],[i.route.rearApproach,i.rearDoor]].filter(p=>p.every(Boolean)))for(let t=0;t<=1;t+=.125)assert.ok(canStand(c,(a.x+(b.x-a.x)*t)/4,(a.z+(b.z-a.z)*t)/4,.16),i.id);
 for(let z=28;z<=117;z+=.25)assert.ok(canStand(c,43.4/4,z/4,.16));
 for(let z=62;z<=108;z+=.25)for(const x of [61,64,67])assert.ok(canStand(c,x/4,z/4,.16));
 assert.equal(JSON.stringify(c),saved);assert.ok(p.parts.length*12<=8000);
});

test('exact original landing/floor bearings and clone-owned rail opening preserve windows, other rails and borrowed resources',async()=>{
 const c=makeHarborCourse({openWorld:true}),root=new THREE.Group(),thai=new HarborThaiVisuals(root,c.thaiLayout);await thai.ready;assert.deepEqual(thai.diagnostics.errors,[]);root.updateMatrixWorld(true);
 const placement=thai.root.getObjectByName('Placement:thai-harbor-block-5'),template=thai.templates.get('bangkok-apartment-block');
 let rails,templateRails;placement.traverse(o=>{if(o.name==='Balcony railings')rails=o;});template.traverse(o=>{if(o.name==='Balcony railings')templateRails=o;});
 const oldMatrices=Array.from({length:rails.count},(_,i)=>{const m=new THREE.Matrix4();rails.getMatrixAt(i,m);return m.toArray();}),templateValues=Array.from(templateRails.instanceMatrix.array);
 const oldLeaves=[];placement.traverse(o=>{if(o.isMesh)oldLeaves.push({o,geometry:o.geometry,material:o.material,count:o.count,matrix:Array.from(o.matrix.elements)});});
 const materials=Object.fromEntries(['concrete','rust','dark'].map(s=>[s,new THREE.MeshStandardMaterial()])),unitBox=new THREE.BoxGeometry(),world={course:c,root,thaiWorld:thai,materials,unitBox,diagnostics:{}};
 let borrowed=0;for(const r of [unitBox,...Object.values(materials),rails.geometry,rails.material])r.addEventListener('dispose',()=>borrowed++);
 const kit=buildHarborServiceFrontages(world);root.updateMatrixWorld(true);
 assert.equal(rails.count,39);assert.equal(templateRails.count,40);assert.deepEqual(Array.from(templateRails.instanceMatrix.array),templateValues);
 assert.notEqual(rails.instanceMatrix,templateRails.instanceMatrix);assert.equal(rails.geometry,templateRails.geometry);assert.equal(rails.material,templateRails.material);
 const expected=oldMatrices.filter((_,i)=>i!==kit.diagnostics.railOpening.removedIndex);
 for(let i=0;i<rails.count;i++){const m=new THREE.Matrix4();rails.getMatrixAt(i,m);assert.deepEqual(m.toArray(),expected[i]);}
 for(const leaf of oldLeaves){assert.equal(leaf.o.geometry,leaf.geometry);assert.equal(leaf.o.material,leaf.material);assert.deepEqual(leaf.o.matrix.elements,leaf.matrix);if(leaf.o!==rails&&leaf.count!==undefined)assert.equal(leaf.o.count,leaf.count);}
 // Original factories remain byte-identical to the frozen source reviewed by
 // the critic. The selective rail opening never changes a source template.
 for(const [name,expectedHash]of [['concrete-walk-up-flat-block','ca754ebf547e0de50053482bd7767c6510b62eb062f459d6f2458a0ad56ec695'],['bangkok-apartment-block','2065403eca638234d65f922d77d39ca5438fd1c0fa4ca6fbd0976adfaac7b6b1']])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../assets/thai-kit/'+name+'.js',import.meta.url))).digest('hex'),expectedHash);
 for(const side of ['west','east']){
  const node=thai.root.getObjectByName('Placement:thai-harbor-block-4-'+side);let matchingLanding=false;
  node.traverse(o=>{if(o.name!=='Stair landings')return;for(let i=0;i<o.count;i++){const m=new THREE.Matrix4();o.getMatrixAt(i,m);const b=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld.clone().multiply(m));if(b.min.z<78&&Math.abs(b.max.y-SERVICE_GALLERY_LEVELS.power)<1e-6){const a=SERVICE_ACCESS.find(a=>a.id==='power-'+side+'-turn');assert.ok(a.minX<b.max.x&&a.maxX>b.min.x&&a.minZ<b.max.z&&a.maxZ>b.min.z);matchingLanding=true;}}});assert.ok(matchingLanding);
  const bay=kit.plan.bays.find(b=>b.id==='power-'+side),x=(bay.minX+bay.maxX)/2;
  const ray=new THREE.Raycaster(new THREE.Vector3(x,bay.level-.20,72),new THREE.Vector3(0,0,1),0,4);const hit=ray.intersectObject(node,true).find(h=>h.object.material.name==='concrete');assert.ok(hit&&hit.point.z>=bay.maxZ-.14&&hit.point.z<=bay.maxZ+.14,'back transfer beam meets opaque actual concrete');
 }
 const floorRay=new THREE.Raycaster(new THREE.Vector3(101.955,6,77.7),new THREE.Vector3(0,-1,0),0,2),floor=floorRay.intersectObject(placement,true)[0];assert.ok(floor&&Math.abs(floor.point.y-SERVICE_GALLERY_LEVELS.dispatch)<1e-6);
 for(const x of [101.5,104,106.5]){const ray=new THREE.Raycaster(new THREE.Vector3(x,SERVICE_GALLERY_LEVELS.dispatch-.25,73.2),new THREE.Vector3(0,0,1),0,5);const hit=ray.intersectObject(placement,true).find(h=>h.object.material.name==='wall');assert.ok(hit&&Math.abs(hit.point.z-77.27)<.14,'dispatch back transfer beam meets real opaque floor plinth, not glazing');}
 for(let x=101.35;x<=102.55;x+=.1){const ray=new THREE.Raycaster(new THREE.Vector3(x,SERVICE_GALLERY_LEVELS.dispatch+.55,77.1),new THREE.Vector3(0,0,1),0,.55);assert.equal(ray.intersectObject(placement,true).length,0,'real rail opening admits the gallery connection');}
 for(const a of SERVICE_ACCESS.filter(a=>a.id.startsWith('power')))for(let x=a.minX+.05;x<a.maxX;x+=.1)for(let z=a.minZ+.05;z<a.maxZ;z+=.1){const ray=new THREE.Raycaster(new THREE.Vector3(x,SERVICE_GALLERY_LEVELS.power+.9,z),new THREE.Vector3(0,-1,0),0,.85);assert.equal(ray.intersectObject(thai.root,true).length,0,'connector remains in the actual stair void with headroom');}
 assert.equal(kit.diagnostics.draws,3);assert.ok(kit.diagnostics.triangles<=8000);assert.equal(kit.diagnostics.ownedMaterials,0);assert.equal(kit.diagnostics.ownedPrimitives,0);
 assert.equal(kit.diagnostics.shadowCasters,3);assert.equal(kit.diagnostics.ownedGeometryViews,3);
 assert.ok(kit.root.matrixAutoUpdate&&root.matrixAutoUpdate,'parent transforms remain automatic');
 root.position.set(13,2,-7);root.rotation.set(.07,.31,-.03);root.scale.set(1.2,.9,1.1);kit.root.position.set(2,.4,3);kit.root.rotation.y=-.12;
 root.updateMatrixWorld(true);
 const frozen=kit.root.children.map(m=>({world:m.matrixWorld.clone(),bounds:new THREE.Box3().setFromObject(m,true)}));
 for(const mesh of kit.root.children){assert.equal(mesh.matrixAutoUpdate,false);assert.ok(mesh.castShadow);mesh.matrixAutoUpdate=true;}
 root.updateMatrixWorld(true);
 kit.root.children.forEach((m,i)=>{assert.deepEqual(m.matrixWorld.elements,frozen[i].world.elements);const box=new THREE.Box3().setFromObject(m,true);assert.ok(box.min.distanceTo(frozen[i].bounds.min)<1e-9&&box.max.distanceTo(frozen[i].bounds.max)<1e-9,'baked static leaves preserve actual transformed-parent world bounds');m.matrixAutoUpdate=false;});
 let viewsDisposed=0;for(const m of kit.root.children)m.geometry.addEventListener('dispose',()=>viewsDisposed++);
 kit.dispose();kit.dispose();assert.equal(viewsDisposed,3);assert.equal(borrowed,0);assert.equal(kit.root.parent,null);
 console.log('service frontage diagnostics',JSON.stringify(kit.diagnostics));thai.dispose();unitBox.dispose();Object.values(materials).forEach(m=>m.dispose());
});
