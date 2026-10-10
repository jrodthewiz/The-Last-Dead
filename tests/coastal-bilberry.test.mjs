import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {capeGroundHeight} from '../coastal-terrain.js';
import {capeBilberryBedField,makeCapeBilberryRootPrototype,capeBilberryRootPocketField,capeTrailCentreDistance} from '../coastal-terrain-fields.js';
import {canStand} from '../engine.js';
import {understoryClear} from '../coastal-understory-layout.js';
import {createCoastalUnderstory} from '../coastal-understory.js';

test('bilberry communities retain old woodland, grow connected leaf-bearing branches and borrow the fern material safely',()=>{
 const course=makeHarborCourse({openWorld:true}),plants=course.coastal.understoryPlacements,original=plants.filter(p=>!p.habitatExpansion),shrubs=original.filter(p=>p.kind==='shrub'),art=createCoastalUnderstory({placements:plants});
 try {
  assert.equal(original.length,2433);assert.equal(shrubs.length,160);assert.equal(new Set(shrubs.map(p=>p.community)).size,10);
  assert.equal(course.coastal.forestPlacements.length,524);
  const prototype=makeCapeBilberryRootPrototype(course.coastal.forestPlacements);
  assert.ok(course.coastal.forestPlacements.some(t=>t.id===prototype.treeId),'prototype is derived from an actual mature tree');
  for(const p of shrubs){assert.equal(p.y,capeGroundHeight(p.x,p.z));assert.ok(understoryClear(course.coastal,p.x,p.z,{softShoulder:!!p.softShoulder}));assert.ok((p.community==='bilberry-bed-0'?capeBilberryRootPocketField(p.x,p.z,prototype):capeBilberryBedField(p.x,p.z))>=.18);}
  const mesh=art.root.children.find(m=>m.name.startsWith('Understory:shrub:')),fern=art.root.children.find(m=>m.name.startsWith('Understory:fern:'));
  assert.equal(mesh.material,fern.material,'cross-species material is actually shared, not cloned');
  assert.equal(art.diagnostics.materials,2);assert.equal(art.diagnostics.sharedGeometries,3);assert.ok(art.diagnostics.batches<=80);
  assert.equal(art.diagnostics.shrubTriangles,246);assert.ok(shrubs.length*art.diagnostics.shrubTriangles<=40960);
  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal,{paths,leafRoots}=geometry.userData;
  assert.equal(paths.length,6);assert.equal(leafRoots.length,42);geometry.computeBoundingBox();assert.equal(geometry.boundingBox.min.y,0);assert.ok(geometry.boundingBox.max.y<.65);
  for(let i=0;i<position.count;i++){for(const v of [position.getX(i),position.getY(i),position.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i)])assert.ok(Number.isFinite(v));assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);}
  const distanceToSegment=(point,a,b)=>{const p=new THREE.Vector3(...point),start=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(start),t=Math.max(0,Math.min(1,p.clone().sub(start).dot(delta)/delta.lengthSq()));return p.distanceTo(start.addScaledVector(delta,t));};
  for(const child of [1,2,4,5])assert.ok(distanceToSegment(paths[child][0],paths[child<3?0:3][0],paths[child<3?0:3][1])<1e-8,'retained lower shoots join the rooted main stem');
  for(let branch=0;branch<6;branch++)for(let leaf=0;leaf<7;leaf++){
    const root=leafRoots[branch*7+leaf],offset=branch*41*3+13*3+leaf*4*3;
    assert.ok(Math.min(distanceToSegment(root,paths[branch][0],paths[branch][1]),distanceToSegment(root,paths[branch][1],paths[branch][2]))<1e-8);
    assert.ok(Math.hypot(position.getX(offset)-root[0],position.getY(offset)-root[1],position.getZ(offset)-root[2])<1e-6,'leaf surface starts at its actual branch joint');
  }
  let leafArea=0,planArea=0,lowerLeafArea=0;
  for(let branch=0;branch<6;branch++)for(let triangle=13;triangle<41;triangle++){
    const offset=(branch*41+triangle)*3,a=new THREE.Vector3().fromBufferAttribute(position,offset),b=new THREE.Vector3().fromBufferAttribute(position,offset+1).sub(a),c=new THREE.Vector3().fromBufferAttribute(position,offset+2).sub(a),cross=b.cross(c);
    leafArea+=cross.length()/2;planArea+=Math.abs(cross.y)/2;
    if((position.getY(offset)+position.getY(offset+1)+position.getY(offset+2))/3<.3)lowerLeafArea+=cross.length()/2;
  }
  assert.ok(leafArea>=.06895*3,'visible leaf body exceeds three times the measured sparse v23 surface');
  assert.ok(planArea>=.05614*3,'horizontal crown coverage exceeds three times v23 before overlap');
  assert.ok(lowerLeafArea/leafArea>.65,'the majority of retained foliage fills the lower bush instead of a flat elevated head');
  const leafNormalY=[];for(let branch=0;branch<6;branch++)for(let triangle=13;triangle<41;triangle++)leafNormalY.push(normal.getY((branch*41+triangle)*3));
  assert.ok(Math.max(...leafNormalY)-Math.min(...leafNormalY)>.25,'alternating leaf inclinations produce a volumetric crown');
  let crownRadius=0;for(let i=0;i<position.count;i++)crownRadius=Math.max(crownRadius,Math.hypot(position.getX(i),position.getZ(i)));
  const shoulder=original.filter(p=>p.softShoulder),tufts=shoulder.filter(p=>p.kind==='grass');assert.equal(shoulder.length,40);assert.equal(tufts.length,24);
  for(const p of shoulder){
    const envelope=p.kind==='shrub'?crownRadius*p.scale+.02:.26*p.scale+.01;
    assert.ok(capeTrailCentreDistance(p.x,p.z)-envelope>=1.5,'full crown and wind envelope leaves three metres of clear route');
    assert.ok(understoryClear(course.coastal,p.x,p.z,{softShoulder:true}));
    assert.ok(!course.obstacles.some(obstacle=>obstacle.id===p.id),'soft plants do not introduce solid collider records');
  }
  assert.ok(shoulder.some(p=>!understoryClear(course.coastal,p.x,p.z)),'prototype actually uses previously blanket-cleared shoulder');
  for(let z=370;z<=399;z+=.5)for(const dx of [-1.5,0,1.5])assert.equal(canStand(course,(prototype.pathX+dx)/4,z/4,.16),true,'the real central route is traversable');
  const resources=new Set(),disposed=new Map();art.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});
  for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,(disposed.get(resource)||0)+1));
  const camera=new THREE.PerspectiveCamera();camera.position.set(340,1.6,376);art.update(camera,3);assert.ok(art.diagnostics.visibleBatches>0);camera.position.set(-2000,1.6,-2000);art.update(camera,4);assert.equal(art.diagnostics.visibleBatches,0);
  art.dispose();art.dispose();for(const resource of resources)assert.equal(disposed.get(resource),1,'borrowed material owner disposes each resource exactly once');
 } finally {art.dispose();}
});
