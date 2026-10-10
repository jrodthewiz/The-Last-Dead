import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';

// Canonical depot handling axis joins its bearing threshold to Dock Road.
// Geometry and pavement response consume this same authored route.
export const PORT_HANDLING_GROUND=Object.freeze({
 origin:Object.freeze([64,72]),
 path:Object.freeze([[64,72],[64,67],[65,62],[71,57],[78,56],[84,56]].map(Object.freeze)),
 axleHalfWidth:1.55,wheelHalfWidth:.31,dustHalfWidth:2.7,
});
export const PORT_HANDLING_DRAINS=Object.freeze([[28.36,62.30,2.6],[55.08,62.30,2.1]].map(Object.freeze));

// The original apartment asset is fitted uniformly, so its rendered facade
// is inset from the larger collision lot. These source extents are checked
// against the asset factory in the frontage test.
export const DISPATCH_SOURCE_SIZE=Object.freeze([14.989999771118164,19.000000834465027,12.300000190734863]);
export function dispatchFrontageFrame(course){
 const b=course.buildings.find(b=>b.name==='DOCK OFFICES');
 const p=course.thaiLayout.buildings.find(p=>p.id===`thai-${b.id}`);
 const fit=Math.min(p.width/DISPATCH_SOURCE_SIZE[0],p.height/DISPATCH_SOURCE_SIZE[1],p.depth/DISPATCH_SOURCE_SIZE[2]);
 return {x:p.x,z:p.z-DISPATCH_SOURCE_SIZE[2]*fit/2,width:DISPATCH_SOURCE_SIZE[0]*fit};
}

// Working-port additions borrow the original shared box and palette. Raised
// supports stay in the existing solid wings; the handling walk stays clear.
export function portFrontagePlan(course){
 if(!course.coastal)return[];
 const power=course.buildings.find(b=>b.passage),dispatch=course.buildings.find(b=>b.name==='DOCK OFFICES');
 if(!power||!dispatch)return[];
 const parts=[],add=(role,slot,x,y,z,w,h,d,roll=0)=>parts.push({role,slot,position:[x,y,z],size:[w,h,d],roll});
 const x=(power.passage.x+power.passage.w/2)*4,z=power.y*4,width=power.passage.w*4;
 // A finite concrete handling pad ends at the bearing threshold. Two worn
 // wheel paths make its connection through the depot to the quay legible.
 add('depot-handling-apron','concrete',x,.128,z-3.5,24,.025,7);
 add('depot-steel-threshold','dark',x,.151,z-.5,width,.023,1);
 for(const side of [-1,1]){
  add('depot-wheel-wear','asphalt',x+side*PORT_HANDLING_GROUND.axleHalfWidth,.147,z-3.5,.72,.012,6.8);
  for(const station of [z+2,z+7,z+13,z+19])add('depot-wheel-runout','asphalt',x+side*1.55,.139,station,.48,.012,3.4);
 }
 // A shallow drainage channel runs across the apron shoulder, interrupted
 // at the safe pedestrian margin. Grate slats are flush, not raised clutter.
 for(const [center,length]of [[x-7.8,7.2],[x+7.8,7.2]]){
  add('depot-drain-channel','dark',center,.147,z-6.8,length,.018,.28);
  for(let a=-length/2+.14;a<length/2;a+=.32)add('depot-drain-grate','rust',center+a,.159,z-6.8,.055,.012,.24);
 }
 // Cart approaches cross the real north curb. Recessed channel beds and
 // transverse steel bars explain where runoff collects beside these routes.
 for(const [cx,cz,length] of PORT_HANDLING_DRAINS){
  add('work-route-drain-channel','dark',cx,.143,cz,length,.012,.26);
  for(let step=-length/2+.12;step<length/2;step+=.28)
   add('work-route-drain-grate','rust',cx+step,.151,cz,.045,.012,.23);
 }
 // A short gantry rail is physically carried by the existing depot posts.
 // The trolley/sling turns a generic gate into a maintenance loading mouth.
 for(const side of [-1,1]){
  add('depot-rail-bearing','rust',x+side*(width/2),4.91,z+.45,.42,.34,1.1);
  add('depot-hoist-rail','dark',x,4.98,z+side*.18,width,.18,.12);
 }
 add('depot-hoist-trolley','rust',x-.8,4.72,z+.18,1.05,.34,.65);
 for(const side of [-1,1]){
  add('depot-sling-fall','dark',x-.8+side*.28,4.11,z+.18,.055,.97,.055);
  add('depot-sling-shackle','rust',x-.8+side*.19,3.59,z+.18,.055,.30,.055,side*.48);
 }
 add('depot-sling-bearing','dark',x-.8,3.50,z+.18,.48,.07,.10);
 // Small closed switchgear faces occupy the already solid wing end wall,
 // with cable connection into the existing post. No bulk cargo is invented.
 for(const side of [-1,1]){
  add('depot-switchgear','dark',x+side*(width/2+2.1),1.70,z-.075,1.35,1.65,.11);
  add('depot-switchgear-inset','rust',x+side*(width/2+2.1),1.70,z-.137,1.14,1.42,.015);
  add('depot-switchgear-bearing','concrete',x+side*(width/2+2.1),.84,z-.05,1.55,.16,.15);
  add('depot-cable-header','dark',x+side*(width/2+1.1),2.62,z-.07,2.3,.095,.095);
 }
 // Dispatch has a sheltered equipment-receiving edge, with the roof carried
 // by the existing solid wall, not free-standing posts in the quay lane.
 const frame=dispatchFrontageFrame(course),dx=frame.x,dz=frame.z;
 add('dispatch-threshold','concrete',dx,.135,dz-.65,16,.03,1.30);
 add('dispatch-service-awning','dark',dx,3.60,dz-.65,16,.16,1.6);
 add('dispatch-awning-bearing','rust',dx,3.43,dz-.04,16,.22,.12);
 for(const side of [-1,1])add('dispatch-awning-return','rust',dx+side*7.65,3.45,dz-.62,.12,.16,1.35);
 add('dispatch-service-header','dark',dx,2.92,dz-.065,15.4,.20,.10);
 for(const side of [-1,1]){
  add('dispatch-service-rolling-face','dark',dx+side*4.1,1.68,dz-.075,5.5,2.30,.10);
  for(let row=0;row<7;row++)add('dispatch-roller-bearing-course','rust',dx+side*4.1,.62+row*.31,dz-.131,5.5,.055,.016);
 }
 return parts;
}

export function buildCoastalPortFrontage(world){
 const records=portFrontagePlan(world.course),root=new THREE.Group();root.name='WorkingPortFrontages';
 const buckets=new Map();
 for(const p of records){const key=[p.slot,Math.floor(p.position[0]/32),Math.floor(p.position[2]/32)].join('/');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
 const transform=new THREE.Object3D(),meshes=[];
 for(const list of buckets.values()){
  const mesh=createCoastalInstances(world.unitBox,world.materials[list[0].slot],list.length);mesh.name='PortFrontage:'+list[0].slot;
  list.forEach((p,i)=>{transform.position.fromArray(p.position);transform.scale.fromArray(p.size);transform.rotation.set(0,0,p.roll);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
  mesh.receiveShadow=true;mesh.castShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
 }
 world.root.add(root);
 const diagnostics={parts:records.length,draws:meshes.length,triangles:records.length*12,resources:'borrowed original box/materials; owned instance views',physics:'original course unchanged'};
 if(world.diagnostics)world.diagnostics.portFrontage=diagnostics;
 let disposed=false;
 return{root,records,diagnostics,dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.dispose();root.removeFromParent();}};
}
