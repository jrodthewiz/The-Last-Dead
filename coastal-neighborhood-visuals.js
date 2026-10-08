import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';

// Inspectable placements precede mesh emission. Repeated support geometry is
// instanced by material and 128m neighborhood cell, never one giant city batch.
function compiler(world){
 const box=world.unitBox,trunk=new THREE.CylinderGeometry(1,1,1,7),crown=new THREE.IcosahedronGeometry(1,1),groups=new Map();
 const emit=(geometry,material,name,x,y,z,w,h,d,yaw=0)=>{
  const key=`${geometry.uuid}/${material.uuid}/${Math.floor(x/128)}/${Math.floor(z/128)}`;
  if(!groups.has(key))groups.set(key,{geometry,material,name,placements:[]});
  groups.get(key).placements.push({x,y,z,w,h,d,yaw});
 };
 const cube=(material,name,x,y,z,w,h,d,yaw=0)=>emit(box,material,name,x,y,z,w,h,d,yaw);
 return {emit,cube,trunk,crown,finish(){
  let count=0,triangles=0;const pose=new THREE.Object3D();
  for(const item of groups.values()){
   const mesh=createCoastalInstances(item.geometry,item.material,item.placements.length);mesh.name=item.name;mesh.userData.coastal=true;mesh.receiveShadow=true;mesh.castShadow=false;
   item.placements.forEach((p,i)=>{pose.position.set(p.x,p.y,p.z);pose.rotation.set(0,p.yaw,0);pose.scale.set(p.w,p.h,p.d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
   mesh.computeBoundingSphere();world.root.add(mesh);count+=item.placements.length;triangles+=(item.geometry.index?.count||item.geometry.attributes.position.count)/3*item.placements.length;
  }
  // Empty compilers must not leak their unreferenced primitive geometry.
  if(![...groups.values()].some(g=>g.geometry===trunk))trunk.dispose();if(![...groups.values()].some(g=>g.geometry===crown))crown.dispose();
  return {instances:count,drawCalls:groups.size,triangles};
 }};
}

export function buildCoastalNeighborhood(world){
 const neighborhood=world.course.coastal?.neighborhoods;if(!neighborhood)return;
 const m=world.materials,writer=compiler(world),{cube,emit,trunk,crown}=writer;
 m.coastLeaves ||=new THREE.MeshStandardMaterial({color:0x526c43,roughness:.95});
 const alleys=neighborhood.alleys||[];
 const rectangles=[...alleys,...(neighborhood.courtyards||[]).filter(court=>!alleys.some(alley=>Math.abs(court.x-alley.x)+court.width/2<=alley.width/2&&Math.abs(court.z-alley.z)+court.depth/2<=alley.depth/2))];
 for(const area of rectangles){
  cube(m.concrete,'CoastalCourtyardPaving',area.x,.028,area.z,area.width,.08,area.depth);
  // Joints and a darker service strip give the courts a human-scale rhythm.
  for(let x=area.x-area.width/2+3;x<area.x+area.width/2;x+=3)cube(m.coastStone,'CoastalPavingJoints',x,.071,area.z,.035,.008,area.depth);
  for(let z=area.z-area.depth/2+3;z<area.z+area.depth/2;z+=3)cube(m.coastStone,'CoastalPavingJoints',area.x,.072,z,area.width,.008,.035);
 }
 const props=neighborhood.props||[];
 for(const [index,p]of props.entries()){
  const yaw=p.yaw||0,local=(x,z)=>({x:p.x+x*Math.cos(yaw)+z*Math.sin(yaw),z:p.z-x*Math.sin(yaw)+z*Math.cos(yaw)});
  const part=(material,x,y,z,w,h,d)=>{const q=local(x,z);cube(material,`CoastalStreet:${p.kind}`,q.x,y,q.z,w,h,d,yaw);};
  if(p.kind==='tree'){
   // Branches and cutout leaves belong to the shared EZ-Tree forest factory.
   for(const side of [-1,1]){part(m.coastStone,side*.6,.14,0,.12,.16,1.3);part(m.coastStone,0,.14,side*.6,1.3,.16,.12);}
  }else if(p.kind==='bench'){
   for(let slat=0;slat<4;slat++)part(m.rust,0,.52,-.24+slat*.16,1.8,.075,.12);
   for(let slat=0;slat<3;slat++)part(m.rust,0,.78+slat*.14,.32,1.8,.09,.065);
   for(const side of [-1,1]){part(m.dark,side*.67,.3,0,.09,.5,.58);part(m.dark,side*.67,.8,.29,.065,.65,.065);part(m.dark,side*.8,.76,0,.065,.06,.62);}
  }else if(p.kind==='lamp'){
   part(m.dark,0,2.9,0,.12,5.8,.12);part(m.dark,0,5.65,-.65,.12,.12,1.4);part(m.dark,0,5.54,-1.22,.52,.15,.75);part(m.coastWhite,0,5.44,-1.22,.42,.035,.61);
   part(m.coastStone,0,.25,0,.32,.5,.32);
  }else if(p.kind==='bin'){
   part(m.dark,0,.55,0,.5,1.05,.5);part(m.coastWhite,0,.8,-.255,.27,.2,.02);part(m.coastStone,0,1.09,0,.56,.12,.56);
  }else if(p.kind==='planter'){
   part(m.coastStone,0,.27,0,1.4,.5,1.4);part(m.rust,0,.54,0,1.2,.045,1.2);emit(crown,m.coastLeaves,'CoastalPlanters',p.x,.82,p.z,.65,.35,.6,index*.71);
  }
 }
 world.diagnostics.neighborhood={lots:world.course.coastal.buildings.length,pavedCourts:rectangles.length,props:props.length,...writer.finish(),collisionAuthority:'coastal.neighborhoods.props / course obstacles'};
}

// Called after Thai templates load: coastal architecture fills its authored
// per-axis dimensions; frontage anchors use that same envelope.
export function buildCoastalFrontages(world){
 if(!world.course.coastal?.neighborhoods||world._coastalFrontagesBuilt)return;
 world._coastalFrontagesBuilt=true;
 const writer=compiler(world),m=world.materials,{cube}=writer;let frontages=0;
 for(const [index,b]of world.course.coastal.buildings.entries()){
  if(b.kit==='blackwater')continue;
  const template=world.thaiWorld.templates.get(b.asset);if(!template)continue;
  const width=b.width,depth=b.depth;
  if(width<5||!Number.isFinite(width+depth))continue;
  const side=Math.cos(b.yaw||0)>0?1:-1,face=b.z+side*(depth/2+.035),bays=Math.min(4,Math.max(1,Math.floor((width-1)/3.4))),bay=Math.min(3.2,(width-1)/bays);
  const accent=index%3===0?m.coastRed:index%3===1?m.dark:m.rust;
  for(let i=0;i<bays;i++){
   const x=b.x+(i-(bays-1)/2)*(bay+.12);
   cube(m.dark,'CoastalFrontageDoors',x,1.3,face,bay-.12,2.35,.075);
   for(const edge of [-1,1])cube(m.coastWhite,'CoastalFrontageFrames',x+edge*(bay/2-.06),1.35,face+side*.07,.065,2.45,.08);
   cube(accent,'CoastalShopFascias',x,2.66,face+side*.08,bay,.38,.15);
   cube(accent,'CoastalShopAwnings',x,2.87,face+side*.67,bay,.12,1.35);
   cube(m.coastWhite,'CoastalAwningTrim',x,2.79,face+side*1.34,bay,.15,.045);
   if((index+i)%3===0)for(let rib=0;rib<7;rib++)cube(m.coastStone,'CoastalShutterRibs',x,.38+rib*.28,face+side*.05,bay-.22,.045,.035);
   else{cube(m.coastWhite,'CoastalShopDoorRails',x,1.12,face+side*.06,bay-.12,.05,.035);cube(m.coastWhite,'CoastalShopDoorRails',x,1.31,face+side*.075,.05,2.3,.035);}
  }
  frontages++;
 }
 world.diagnostics.frontages={buildings:frontages,...writer.finish(),placement:'actual Thai template bounds; overhanging awnings above 2.7m; no added lights'};
}
