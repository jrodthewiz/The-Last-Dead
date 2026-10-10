import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {capeGroundHeight} from './coastal-terrain.js';

const distanceToRect=(x,z,r)=>Math.hypot(Math.max(r.minX-x,0,x-r.maxX),Math.max(r.minZ-z,0,z-r.maxZ));

// Small service islands sit beyond the pedestrian verge. One plan owns their
// visible footprint and collision; roads and door approaches stay open.
export function makeCoastalWorldPolish(course) {
 const c=course.coastal,stations=[],drains=[],obstacles=[];
 const clear=(x,z,r)=>{
  if(x-r<1||z-r<1||x+r>c.width-1||z+r>c.depth-1||x-r<128&&z+r>120)return false;
  if(capeGroundHeight(x,z)<-.08)return false;
  if(x>85-r&&x<108+r&&z>100-r&&z<120+r)return false;
  if(Math.abs(x-43.4)<1.4+r&&z>25&&z<118)return false;
  for(const path of c.courtLane?.access||[])if(distanceToRect(x,z,path)<r+1.2)return false;
  for(const road of c.roads)if(distanceToRect(x,z,{minX:road.x-road.width/2,maxX:road.x+road.width/2,minZ:road.z-road.depth/2,maxZ:road.z+road.depth/2})<r+2.2)return false;
  for(const b of c.buildings)if(distanceToRect(x,z,{minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.z-b.depth/2,maxZ:b.z+b.depth/2})<r+.8)return false;
  for(const i of c.blackwaterSlice.interiors)for(const p of [i.route.frontApproach,i.route.rearApproach].filter(Boolean))if(Math.hypot(x-p.x,z-p.z)<r+3)return false;
  for(const p of c.landmarks)if(Math.hypot(x-p.x*4,z-p.y*4)<r+2)return false;
  for(const o of [...course.obstacles.filter(o=>!o.id?.startsWith('coast-polish-')),...obstacles])if(distanceToRect(x,z,{minX:o.minX*4,maxX:o.maxX*4,minZ:o.minY*4,maxZ:o.maxY*4})<r+.35)return false;
  for(const dx of [-r,0,r])for(const dz of [-r,0,r]){
   const cell=course.cells[Math.floor((z+dz)/4)*course.w+Math.floor((x+dx)/4)];
   if(!cell||cell.every(v=>v===1)||Math.abs(capeGroundHeight(x+dx,z+dz)-capeGroundHeight(x,z))>.13)return false;
  }
  return true;
 };
 const station=(kind,x,z,yaw=0)=>{
  const width=kind==='bench'?2.1:kind==='shore'?1.9:.85,depth=kind==='bench'?.8:kind==='shore'?1.1:.85,r=Math.hypot(width,depth)/2;
  if(!clear(x,z,r))return false;
  const id=`coast-polish-${stations.length}`,base=Math.max(.12,capeGroundHeight(x,z));
  stations.push({id,kind,x,z,yaw,base,width,depth});
  const w=Math.abs(Math.cos(yaw))*width+Math.abs(Math.sin(yaw))*depth,d=Math.abs(Math.sin(yaw))*width+Math.abs(Math.cos(yaw))*depth;
  obstacles.push({id,minX:(x-w/2)/4,maxX:(x+w/2)/4,minY:(z-d/2)/4,maxY:(z+d/2)/4});return true;
 };
 for(const [index,road]of c.roads.entries()){
  const horizontal=road.width>road.depth,length=horizontal?road.width:road.depth,half=(horizontal?road.depth:road.width)/2;
  for(let t=-length/2+14;t<length/2-10;t+=28)for(const side of [-1,1]){
   const x=road.x+(horizontal?t:side*(half+4.1)),z=road.z+(horizontal?side*(half+4.1):t);
   if(stations.length<38)station((index+Math.floor(t/28)+side)%3===0?'bench':'bin',x,z,horizontal?0:Math.PI/2);
   const gx=road.x+(horizontal?t:side*(half-.26)),gz=road.z+(horizontal?side*(half-.26):t);
   if(gx>2&&gz>2&&!c.roads.some(other=>other!==road&&distanceToRect(gx,gz,{minX:other.x-other.width/2,maxX:other.x+other.width/2,minZ:other.z-other.depth/2,maxZ:other.z+other.depth/2})<1.2))drains.push({x:gx,z:gz,yaw:horizontal?0:Math.PI/2});
  }
 }
 for(let x=14;x<440;x+=32)station('shore',x,3.3,0);
 for(let z=18;z<300;z+=32)station('shore',443,z,Math.PI/2);
 for(let x=12;x<125;x+=28)station('shore',x,116.2,Math.PI);
 return {stations,drains,obstacles};
}

export function buildCoastalWorldPolish(world) {
 const plan=world.course.coastal?.polish;if(!plan)return;
 const m=world.materials,groups=new Map(),ring=new THREE.TorusGeometry(1,.19,5,14),pose=new THREE.Object3D();
 const add=(material,x,y,z,w,h,d,yaw=0,geometry=world.unitBox)=>{
  const key=`${material.uuid}/${geometry.uuid}/${Math.floor(x/96)}/${Math.floor(z/96)}`;
  if(!groups.has(key))groups.set(key,{geometry,material,parts:[]});
  groups.get(key).parts.push({x,y,z,w,h,d,yaw});
 };
 for(const s of plan.stations){
  const part=(material,x,y,z,w,h,d,geometry)=>{const c=Math.cos(s.yaw),v=Math.sin(s.yaw);add(material,s.x+x*c+z*v,s.base+y,s.z-x*v+z*c,w,h,d,s.yaw,geometry);};
  if(s.kind==='bench'){
   for(const side of [-1,1]){part(m.dark,side*.78,.24,0,.08,.48,.65);part(m.dark,side*.78,.74,.28,.07,.94,.07);}
   for(let i=0;i<4;i++)part(m.rust,0,.49,-.25+i*.16,2,.06,.12);
   for(let i=0;i<3;i++)part(m.rust,0,.77+i*.14,.30,2,.09,.065);
  }else if(s.kind==='bin'){
   part(m.dark,0,.48,0,.62,.94,.60);part(m.coastStone,0,.99,0,.70,.10,.68);
   for(const side of [-1,1])part(m.rust,side*.32,.53,0,.04,.74,.61);
   part(m.coastWhite,0,.73,-.31,.38,.18,.025);part(m.dark,0,.82,-.325,.28,.05,.018);
   part(m.rust,.10,1.06,.03,.18,.035,.16);
  }else{
   // Rescue ring, a carried rope locker and salt-dark mooring hardware.
   part(m.dark,-.47,.87,0,.095,1.74,.095);
   part(m.coastRed,-.47,1.35,-.035,.36,.36,.36,ring);
   part(m.coastWhite,-.47,1.35,-.05,.07,.83,.04);
   for(const y of [.15,.46,.77])part(m.rust,.32,y,.08,.70,.055,.80);
   for(const x of [-.04,.68])for(const z of [-.32,.48])part(m.dark,x,.46,z,.045,.74,.045);
   for(let i=0;i<4;i++)part(m.dark,.32,.30+i*.12,.08,.27,.045,.27,ring);
   part(m.dark,-.47,1.71,0,.25,.09,.22);
  }
  for(let i=0;i<3;i++)part(i===1?m.rust:m.coastWhite,-.22+i*.16,.012,.20-i*.11,.17+i*.035,.015,.11);
 }
 for(const p of plan.drains){
  add(m.dark,p.x,.106,p.z,.9,.012,.43,p.yaw);
  for(let rib=0;rib<7;rib++){
   const dx=-.39+rib*.13;add(m.rust,p.x+dx*Math.cos(p.yaw),.116,p.z-dx*Math.sin(p.yaw),.035,.018,.40,p.yaw);
  }
 }
 let instances=0,triangles=0;
 for(const {geometry,material,parts}of groups.values()){
  const mesh=createCoastalInstances(geometry,material,parts.length);mesh.name='CoastalWorldPolish';mesh.receiveShadow=true;
  for(const [i,p]of parts.entries()){pose.position.set(p.x,p.y,p.z);pose.rotation.set(0,p.yaw,0);pose.scale.set(p.w,p.h,p.d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);}
  mesh.computeBoundingSphere();world.root.add(mesh);instances+=parts.length;triangles+=(geometry.index?.count||geometry.attributes.position.count)/3*parts.length;
 }
 if(![...groups.values()].some(g=>g.geometry===ring))ring.dispose();
 world.diagnostics.worldPolish={stations:plan.stations.length,streetStations:plan.stations.filter(p=>p.kind!=='shore').length,shoreStations:plan.stations.filter(p=>p.kind==='shore').length,drains:plan.drains.length,drawCalls:groups.size,instances,triangles};
 return world.diagnostics.worldPolish;
}
