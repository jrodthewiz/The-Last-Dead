import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {makeHarborCourse} from '../harbor-course.js';
import {makeMaritimeKit} from '../assets/blackwater-kit/maritime-vehicles.js';
import {buildCoastalMaritime} from '../coastal-maritime-visuals.js';
import {coastalSurfaceHeightAt} from '../coastal-water.js';

test('parked vehicles retain open approaches and moorings meet real quay bollards',()=>{
 const course=makeHarborCourse({openWorld:true}),layout=course.coastal.maritime;
 assert.equal(layout.boats.length,3);assert.equal(layout.cars.length,20);
 assert.doesNotThrow(()=>JSON.stringify(layout));
 for(const p of layout.boats){assert.ok(p.bounds.minZ>120);for(const m of p.mooring){assert.equal(m.z,119.3);assert.equal((m.x-5)%8,0);}}
 for(const p of layout.cars){const b=p.bounds;assert.deepEqual(course.obstacles.find(o=>o.id===p.id),{id:p.id,minX:b.minX/4,maxX:b.maxX/4,minY:b.minZ/4,maxY:b.maxZ/4});for(const o of course.obstacles.filter(o=>o.id!==p.id))assert.ok(b.maxX<=o.minX*4||b.minX>=o.maxX*4||b.maxZ<=o.minY*4||b.minZ>=o.maxY*4);for(let z=Math.floor(b.minZ/4);z<=Math.floor(b.maxZ/4);z++)for(let x=Math.floor(b.minX/4);x<=Math.floor(b.maxX/4);x++)assert.ok(!course.cells[z*course.w+x].every(v=>v===1));assert.ok(Math.hypot(p.x-course.vehicle.x*4,p.z-course.vehicle.y*4)>8);}
});
test('hull profiles taper to their bows and face outward with closed deck',()=>{
 for(const kind of ['trawler','launch','skiff']){
  const parts=makeMaritimeKit(kind),hull=parts.get(kind==='trawler'?'red':'paint')[0];
  const p=hull.attributes.position,n=hull.attributes.normal;
  assert.ok(n.getZ(0)>0,'port hull faces the water');assert.ok(n.getY(5)<0,'keel faces down');
  assert.ok(Math.abs(p.getZ(55))<Math.abs(p.getZ(22))*.08,'fine bow compared with broad midship');
  const deck=parts.get('wood')[0];assert.ok(deck.attributes.normal.getY(0)>.7,'deck faces sky');
  for(const list of parts.values())for(const g of list){for(const value of g.attributes.position.array)assert.ok(Number.isFinite(value));g.dispose();}
 }
});
test('all twenty-three detailed static props share nine submissions and release owned resources exactly once',()=>{
 const course=makeHarborCourse({openWorld:true});assert.ok(course.coastal.maritime);
 const world={course,root:new THREE.Group(),diagnostics:{}},art=buildCoastalMaritime(world);
 assert.equal(art.diagnostics.drawCalls,9);assert.ok(art.diagnostics.triangles<85000);assert.equal(art.diagnostics.cars,20);
 let gd=0,md=0;for(const mesh of art.root.children){mesh.geometry.addEventListener('dispose',()=>gd++);mesh.material.addEventListener('dispose',()=>md++);assert.ok(mesh.geometry.boundingSphere.radius>0);}
 art.dispose();art.dispose();assert.equal(gd,9);assert.equal(md,9);assert.equal(world.root.children.length,0);
});

test('city parking preserves the original eight records and twelve addressed cars leave the central route and approaches clear',()=>{
 const course=makeHarborCourse({openWorld:true}),cars=course.coastal.maritime.cars;
 const legacy=[['estate',5,53,0],['van',122,48,Math.PI/2],['estate',6,108,0],['estate',196,107.55,0],['van',268,180.45,0],['estate',328,227.55,0],['van',328,299.55,0],['estate',4.5,12,Math.PI/2]].map(([kind,x,z,yaw],index)=>{
  const length=kind==='van'?5.4:4.65,width=kind==='van'?2.35:2.13,cos=Math.abs(Math.cos(yaw)),sin=Math.abs(Math.sin(yaw)),hx=(length*cos+width*sin)/2+.14,hz=(length*sin+width*cos)/2+.14;
  return{id:`parked-${kind}-${index}`,kind,x,z,y:.14,yaw,length,width,paint:['#668782','#647488','#a18a61','#786c67'][index%4],bounds:{minX:x-hx,maxX:x+hx,minZ:z-hz,maxZ:z+hz}};
 });
 assert.deepEqual(cars.slice(0,8),legacy);assert.equal(cars.length,20);assert.equal(new Set(cars.map(p=>p.id)).size,20);
 const approaches=course.coastal.blackwaterSlice.interiors.flatMap(i=>[i.route.frontApproach,i.route.rearApproach].filter(Boolean));
 for(const p of cars.slice(8)){
  const b=p.bounds;assert.match(p.id,/^street-/);assert.ok(p.address&&p.use);assert.ok(b.minZ>=p.roadZ+3.135-1e-8||b.maxZ<=p.roadZ-3.135+1e-8,'6.27m central route stays open');
  assert.ok(p.yaw===0||p.yaw===Math.PI,'purposeful opposing kerb directions');
  for(const r of course.coastal.roads.filter(r=>r.depth>r.width))assert.ok(Math.abs(p.x-r.x)>=10,'junction remains clear');
  for(const a of approaches)assert.ok(a.x<=b.minX-2.5||a.x>=b.maxX+2.5||a.z<=b.minZ-2.5||a.z>=b.maxZ+2.5,'door approach stays clear');
  for(const a of [...course.scavengerPickups,...course.weaponPickups])assert.ok(a.x*4<=b.minX-2.5||a.x*4>=b.maxX+2.5||a.y*4<=b.minZ-2.5||a.y*4>=b.maxZ+2.5,'pickup approach stays clear');
 }
});

test('vehicle lamps and radiator slats remain visible ahead of the bevelled body',()=>{
 for(const [kind,L,W]of [['estate',4.65,1.83],['van',5.4,2.05]]){
  const parts=makeMaritimeKit(kind),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),root=new THREE.Group();
  for(const [slot,list]of parts)for(const g of list){g.computeBoundingBox();const mesh=new THREE.Mesh(g,material);mesh.userData.slot=slot;root.add(mesh);}
  root.updateMatrixWorld(true);
  const first=(y,z)=>new THREE.Raycaster(new THREE.Vector3(L/2+2,y,z),new THREE.Vector3(-1,0,0)).intersectObjects(root.children)[0]?.object;
  for(const side of [-1,1]){const lamp=first(.99,side*W*.35);assert.equal(lamp?.userData.slot,'cream');assert.ok(lamp.geometry.boundingBox.min.x>L/2+.08,'lens must not be buried behind body bevel');}
  const grille=first(.82,0);assert.equal(grille?.userData.slot,'steel');assert.ok(grille.geometry.boundingBox.min.x>L/2+.08,'slats must project ahead of their recess and body');
  for(const list of parts.values())for(const g of list)g.dispose();material.dispose();
 }
});

test('representative body sections, separate windshield panes and wheelhouse recesses form real construction',()=>{
 for(const [kind,L]of [['estate',4.65],['van',5.4]]){
  const parts=makeMaritimeKit(kind),all=[...parts.values()].flat(),body=all.find(g=>g.userData.part==='VehicleTaperedBody'),p=body.attributes.position;
  let nose=0,mid=0;for(let i=0;i<p.count;i++){const x=p.getX(i),z=Math.abs(p.getZ(i));if(x>L/2-.06)nose=Math.max(nose,z);if(Math.abs(x)<L*.35)mid=Math.max(mid,z);}assert.ok(nose<mid*.92,'nose visibly tapers from main body');
  const windshield=all.filter(g=>g.userData.part==='VehicleWindshield');assert.equal(windshield.length,1);const n=windshield[0].attributes.normal;assert.ok(n.getX(0)>.5&&n.getX(5)>.5,'continuous pane faces forward');assert.ok(n.getZ(0)*n.getZ(5)<0,'windscreen crown changes face direction across its width');for(let i=0;i<5;i++)assert.ok(new THREE.Vector3().fromBufferAttribute(n,i).distanceTo(new THREE.Vector3().fromBufferAttribute(n,i+1))<.06,'shared normals change continuously across strips');assert.equal(all.filter(g=>g.userData.part==='VehicleBonnetCrown').length,4);
  for(const g of all)g.dispose();
 }
 for(const kind of ['trawler','launch']){
  const parts=makeMaritimeKit(kind),all=[...parts.values()].flat(),front=all.filter(g=>g.userData.part==='WheelhouseFrontPane'),roof=all.find(g=>g.userData.part==='WheelhouseRoof'),recess=all.find(g=>g.userData.part==='WheelhouseWindowRecess');assert.equal(front.length,2);assert.ok(roof&&recess);recess.computeBoundingBox();
  for(const pane of front){assert.ok(pane.attributes.normal.getX(0)>.9,'front glazing faces the bow');const p=pane.attributes.position;assert.ok(p.getX(0)>p.getX(1)+.1,'pane is raked rather than vertical');assert.ok(p.getX(0)>recess.boundingBox.max.x,'pane sits ahead of its shadow recess');}
  assert.ok(all.some(g=>g.userData.part==='BoatWindlass'),'working anchor assembly has mounted drums');for(const g of all)g.dispose();
 }
});

test('upper and lower windshield interiors are exposed glass rather than intersecting opaque cabin backing',()=>{
 for(const kind of ['estate','van']){
  const parts=makeMaritimeKit(kind),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),van=kind==='van',W=van?2.05:1.83,roofY=van?2.27:2.02,roofFront=van?.58:.62,windBottom=van?1.29:1.36;
  for(const [slot,gs]of parts)for(const g of gs){const mesh=new THREE.Mesh(g,material);mesh.userData={slot,part:g.userData.part};root.add(mesh);}root.updateMatrixWorld(true);
  for(const u of [-.7,0,.7])for(const v of [.2,.5,.8]){
   const point=new THREE.Vector3(windBottom+(roofFront-windBottom)*v+.045*(1-u*u),1.34+(roofY-.07-1.34)*v,u*W*(.475-.07*v));
   const du=new THREE.Vector3(-.09*u,0,W*(.475-.07*v)),dv=new THREE.Vector3(roofFront-windBottom,roofY-.07-1.34,-.07*W*u),normal=dv.cross(du).normalize();
   const hit=new THREE.Raycaster(point.clone().addScaledVector(normal,2),normal.clone().negate()).intersectObjects(root.children)[0];
   assert.equal(hit?.object.userData.part,'VehicleWindshield',`${kind} exposed glass at u=${u},v=${v}`);
  }
  for(const gs of parts.values())for(const g of gs)g.dispose();material.dispose();
 }
});

test('merged boat geometry follows shared water phases while cars and quay anchors remain fixed',()=>{
 const course=makeHarborCourse({openWorld:true}),art=buildCoastalMaritime({course,root:new THREE.Group(),diagnostics:{}}),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),moved=new THREE.Vector3(),normal=new THREE.Vector3();
 const versions=art.root.children.map(m=>Object.values(m.geometry.attributes).map(a=>a.version));let fixedAnchors=0;
 for(const time of [0,.75,2.5,5.25,9]){
  art.update(time);art.getPose(0,matrix);assert.deepEqual(matrix.elements,new THREE.Matrix4().elements,'cars share exact identity');
  for(const [i,p]of course.coastal.maritime.boats.entries()){
   art.getPose(i+1,matrix);point.set(p.x,p.y,p.z);moved.copy(point).applyMatrix4(matrix);
   assert.ok(Math.abs(moved.y-p.y-coastalSurfaceHeightAt(p.x,p.z,time))<1e-10,'rigid centre follows actual water height');assert.ok(Math.abs(matrix.determinant()-1)<1e-10,'boat pose remains rigid');
   const rotation=new THREE.Matrix3().setFromMatrix4(matrix),x=new THREE.Vector3(1,0,0).applyMatrix3(rotation),y=new THREE.Vector3(0,1,0).applyMatrix3(rotation);assert.ok(Math.abs(x.dot(y))<1e-10,'transformed normal remains perpendicular to rigid tangent');
  }
  for(const mesh of art.root.children){const g=mesh.geometry,pos=g.attributes.position,body=g.attributes.maritimeBody,weight=g.attributes.maritimeWeight;
   for(let i=0;i<pos.count;i++){
    point.fromBufferAttribute(pos,i);art.getPose(body.getX(i),matrix);moved.copy(point).applyMatrix4(matrix).lerp(point,1-weight.getX(i));
    if(time===0&&mesh.material.name!=='Maritime:rope'){
     const id=body.getX(i),envelopes=id>=4?[course.coastal.maritime.cars[id-4].bounds]:id>0?[course.coastal.maritime.boats[id-1].bounds]:course.coastal.maritime.cars.map(p=>p.bounds);
     assert.ok(envelopes.some(b=>point.x>=b.minX-1e-5&&point.x<=b.maxX+1e-5&&point.z>=b.minZ-1e-5&&point.z<=b.maxZ+1e-5),'rebuilt real forms retain canonical rest placement envelopes');
    }
    assert.ok(g.boundingBox.containsPoint(moved),'expanded bound contains moving real geometry');assert.ok(g.boundingSphere.containsPoint(moved));
    if(body.getX(i)>=4)assert.deepEqual(moved.toArray(),point.toArray(),'actual car vertices fixed');
    if(mesh.material.name==='Maritime:rope'&&body.getX(i)>0&&weight.getX(i)<1e-6){assert.ok(Math.abs(point.z-119.3)<.04);assert.ok(Math.abs(point.y-1)<.04);assert.ok(moved.distanceTo(point)<1e-9);fixedAnchors++;}
   }
  }
 }
 assert.ok(fixedAnchors>20,'all actual mooring quay cap vertices retain zero motion');assert.deepEqual(art.root.children.map(m=>Object.values(m.geometry.attributes).map(a=>a.version)),versions,'no vertex-buffer updates');assert.equal(art.diagnostics.poseUniformBytes,1536);assert.equal(art.diagnostics.staticFinishUniformBytes,1920);assert.equal(art.diagnostics.geometryUploadsPerUpdate,0);assert.ok(art.diagnostics.triangles<85000);assert.equal(art.diagnostics.drawCalls,9);
 for(const mesh of art.root.children)assert.match(mesh.material.userData.finishCoordinates,/rest geometry/);
 const count=art.diagnostics.updateCount;art.update(9);assert.equal(art.diagnostics.updateCount,count,'unchanged time reuses poses');art.dispose();art.update(12);assert.equal(art.diagnostics.updateCount,count,'disposed controller stops updates');
});




