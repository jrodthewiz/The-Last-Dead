import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {createTownWoodMaterial,townWoodPieceParameters} from './coastal-town-wood.js';
import {makeCoastalIndustrialFrontage} from './coastal-industrial-frontage.js';
import {makeCoastalTimberWorkspace} from './coastal-timber-workspace.js';
import {makeCoastalCableRepair} from './coastal-cable-repair.js';

// Small wheeled loads move from the actual work stations to Dock Road.
// These routes describe surface wear, not additional obstacles.
export const TOWN_HANDLING_GROUND=Object.freeze([
 Object.freeze({id:'netmakers-net-cart',communityId:'town-detail-netmakers-north-work',
  path:Object.freeze([[25,68.22],[25,64.4],[32,59.4],[40,56]].map(Object.freeze)),
  axleHalfWidth:.43,wheelHalfWidth:.045,dustHalfWidth:1.15}),
 Object.freeze({id:'depot-maintenance-barrow',communityId:'town-detail-depot-west-maintenance',
  path:Object.freeze([[57.7,69.88],[57.7,64.4],[52,59],[46,56]].map(Object.freeze)),
  axleHalfWidth:.33,wheelHalfWidth:.04,dustHalfWidth:.95}),
]);

// Folded leaves grow from a common stem and curved side shoots. The shared
// mesh has gaps, visible petioles and unequal leaves rather than a filled ball.
export function townPlantGeometry(){
 const vertices=[];
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 const stem=(a,b,r)=>{const axis=new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a)).normalize(),u=new THREE.Vector3(0,0,1).cross(axis).normalize(),v=axis.clone().cross(u);
  const ring=(p,i)=>new THREE.Vector3().fromArray(p).addScaledVector(u,Math.cos(i*Math.PI/2)*r).addScaledVector(v,Math.sin(i*Math.PI/2)*r).toArray();
  for(let i=0;i<4;i++){const aa=ring(a,i),bb=ring(a,i+1),cc=ring(b,i+1),dd=ring(b,i);tri(aa,bb,cc);tri(aa,cc,dd);}
 };
 for(let shoot=0;shoot<3;shoot++){
  const angle=shoot*2.399,lean=.12+shoot*.045,h=.86-shoot*.12;
  const point=t=>[Math.cos(angle)*lean*t*t,-.5+h*t,Math.sin(angle)*lean*t*t];
  for(let segment=0;segment<4;segment++)stem(point(segment/4),point((segment+1)/4),.009-shoot*.001);
  for(let node=0;node<4;node++)for(const side of [-1,1]){
   const origin=point(.24+node*.19),a=angle+side*(1.1+node*.31),length=.23-node*.012+shoot*.016;
   const along=[Math.cos(a)*length,.11+node*.012,Math.sin(a)*length],cross=[-Math.sin(a)*.085,0,Math.cos(a)*.085];
   const tip=origin.map((x,i)=>x+along[i]),middle=origin.map((x,i)=>x+along[i]*.52),left=middle.map((x,i)=>x+cross[i]),right=middle.map((x,i)=>x-cross[i]);
   const ridge=[middle[0],middle[1]+.042,middle[2]];
   stem(origin,middle,.004);
   for(const [a,b,c] of [[origin,left,ridge],[left,tip,ridge],[tip,right,ridge],[right,origin,ridge]]){tri(a,b,c);tri(c.map((x,i)=>x-(i===1?.001:0)),b.map((x,i)=>x-(i===1?.001:0)),a.map((x,i)=>x-(i===1?.001:0)));}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// Each flange is seven separate circle-clipped boards. Actual seams expose
// its construction; the bearing and shaft are separate carried components.
export function townReelFlangeGeometry(){
 const positions=[],tri=(a,b,c)=>positions.push(...a,...b,...c);
 for(let strip=0;strip<7;strip++){
  const x0=-.5+strip/7+.007,x1=-.5+(strip+1)/7-.007,outline=[];
  for(let step=0;step<=4;step++){const x=x0+(x1-x0)*step/4;outline.push([x,Math.sqrt(Math.max(0,.25-x*x))]);}
  for(let step=4;step>=0;step--){const x=x0+(x1-x0)*step/4;outline.push([x,-Math.sqrt(Math.max(0,.25-x*x))]);}
  for(const y of [-.5,.5])for(let i=1;i<outline.length-1;i++){
   const p=outline.map(([x,z])=>[x,y,z]);if(y>0)tri(p[0],p[i],p[i+1]);else tri(p[0],p[i+1],p[i]);
  }
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],p=[a[0],-.5,a[1]],q=[b[0],-.5,b[1]],r=[b[0],.5,b[1]],s=[a[0],.5,a[1]];tri(p,q,r);tri(p,r,s);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function townCableGeometry(){
 class Cable extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const a=t*Math.PI*14;return target.set(Math.cos(a)*.44,t-.5,Math.sin(a)*.44);}}
 return new THREE.TubeGeometry(new Cable(),112,.045,4,false);
}

function addReel(add,x,y,z,diameter=.66){
 const depth=diameter*.6;
 for(const end of [0,depth]){
  add('reel-board-flange','wood',x,y,z+end,diameter,.09,diameter,'flange',Math.PI/2);
  add('reel-bearing-hub','metal',x,y,z+end,.20,.14,.20,'cylinder',Math.PI/2);
  for(let bolt=0;bolt<4;bolt++){
   const a=bolt*Math.PI/2;
   add('reel-bearing-bolt','metal',x+Math.cos(a)*.12,y+Math.sin(a)*.12,z+end+(end===0?-.056:.056),.032,.04,.032,'cylinder',Math.PI/2);
  }
 }
 add('reel-wound-cable','dark',x,y,z+depth/2,diameter*.78,depth*.91,diameter*.78,'cable',Math.PI/2);
 add('reel-bearing-shaft','metal',x,y,z+depth/2,.085,depth+.25,.085,'cylinder',Math.PI/2);
}

// Small communities belong to addresses and their actual authored facade,
// rather than an independent scatter across street and doorway clearances.
const ADDRESSES=[
 ['coast-lot-0-0-0-0','produce'],['coast-lot-0-0-0-1','cafe'],
 ['coast-lot-0-0-1-2','produce'],['coast-lot-0-0-1-0','laundry'],
 ['coast-lot-1-1-0-2','garden'],['coast-lot-1-1-0-3','garden'],
 ['coast-lot-1-1-1-4','garden'],['coast-lot-1-0-0-1','garden'],
 ['coast-lot-2-1-0-1','timber'],['coast-lot-2-1-0-2','repair'],
 ['coast-lot-2-1-1-1','timber'],['coast-lot-3-1-0-2','repair'],
];

export function makeCoastalTownDetails(coastal){
 const communities=[],parts=[],obstacles=[];
 for(const [id,kind] of ADDRESSES){
  const b=coastal.buildings.find(p=>p.id===id&&p.kit==='blackwater');if(!b)continue;
  const yaw=b.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
  const lx=(b.doorOffset>0?-1:1)*(b.width/2-1.8),lz=b.depth/2+.8;
  const x=b.x+lx*c+lz*s,z=b.z-lx*s+lz*c;
  const width=2.7,depth=1.4;
  const hx=(Math.abs(c)*width+Math.abs(s)*depth)/2,hz=(Math.abs(s)*width+Math.abs(c)*depth)/2;
  const obstacle={id:`town-detail-${id}`,minX:(x-hx)/4,maxX:(x+hx)/4,minY:(z-hz)/4,maxY:(z+hz)/4};
  const community={id:obstacle.id,buildingId:id,kind,x,z,yaw,width,depth,obstacle};
  communities.push(community);obstacles.push(obstacle);
  const add=(role,slot,px,py,pz,w,h,d,geometry='box',roll=0)=>{
   parts.push({communityId:community.id,role,slot,geometry,position:[x+px*c+pz*s,py,z-px*s+pz*c],size:[w,h,d],yaw,roll});
  };
  if(kind==='garden'){
   // Deep beds, a carried trellis, climbing leaf masses and a tool shelf.
   add('bed-soil','dark',0,.24,0,2.6,.16,1.15);
   for(const side of [-1,1])add('raised-bed-long-board','wood',0,.35,side*.56,2.7,.34,.075);
   for(const side of [-1,1])add('raised-bed-end-board','wood',side*1.30,.35,0,.075,.34,1.15);
   for(const side of [-1,1])add('trellis-bearing','wood',side*1.16,1.04,-.5,.075,1.75,.075);
   for(let row=0;row<5;row++)add('trellis-cross-rail','wood',0,.64+row*.26,-.5,2.4,.045,.045);
   for(let column=0;column<7;column++)add('trellis-upright','wood',-.96+column*.32,1.17,-.5,.032,1.20,.04);
   for(let plant=0;plant<8;plant++){
    const px=-1.02+(plant%4)*.66,pz=plant<4?-.21:.28;
    const height=.47+(plant%3)*.09;
    add('rooted-kitchen-garden','green',px,.32+height/2,pz,.90,height,.70,'leaf');
   }
   for(let vine=0;vine<3;vine++){
    const height=1.49-vine*.14;
    add('rooted-trellis-vine','green',-.86+vine*.82,.32+height/2,-.47,.94,height,.34,'leaf');
   }
  }else if(kind==='timber'||kind==='repair'){
   // Bearing runners and spaced planks expose a stack, not a solid cube.
   for(const side of [-1,1])add('pallet-bearing-runner','wood',side*.78,.26,0,.13,.25,1.14);
   for(let plank=0;plank<6;plank++)add('pallet-top-plank','wood',-1.15+plank*.46,.43,0,.36,.09,1.14);
   if(kind==='timber'){
    for(let row=0;row<5;row++)for(let beam=0;beam<3;beam++)add('stacked-timber','wood',0,.54+row*.18,-.36+beam*.34,2.45-row*.11,.13,.27);
    for(const side of [-1,1])add('timber-stack-band','metal',side*.78,.87,0,.035,.88,1.1);
   }else{
    for(const side of [-1,1])addReel(add,side*.63,.81,-.18);
    add('repair-tool-tray','metal',0,.52,-.40,.50,.11,.24);
   }
  }else{
   // A shop's working frontage: supported display, open crates, produce or
   // folded laundry. Cafe has a small table with two physically carried seats.
   add('frontage-table-top','wood',0,.96,0,2.45,.11,.86);
   for(const side of [-1,1])for(const end of [-1,1])add('frontage-table-leg','wood',side*1.0,.55,end*.32,.075,.82,.075);
   if(kind==='cafe'){
    for(const side of [-1,1]){
     add('cafe-seat','wood',side*.84,.59,.50,.53,.09,.36);
     for(const leg of [-1,1])add('cafe-seat-bearing','metal',side*.84+leg*.19,.34,.50,.045,.45,.25);
     add('cafe-seat-back','wood',side*.84,.90,.64,.53,.48,.055);
    }
    for(const px of [-.7,.7])add('abandoned-cafe-cup','metal',px,1.09,-.05,.10,.17,.10,'cylinder');
   }else{
    for(const px of [-.70,.70]){
     add('display-crate-base','wood',px,1.05,0,.94,.06,.68);
     for(const edge of [-1,1]){
      add('display-crate-side','wood',px+edge*.46,1.21,0,.04,.30,.68);
      for(let rail=0;rail<3;rail++)add('display-crate-slats','wood',px,1.1+rail*.1,edge*.33,.94,.055,.04);
     }
     for(let item=0;item<6;item++)add(kind==='laundry'?'folded-linen':'stored-produce',kind==='laundry'?'wood':'green',px-.29+(item%3)*.29,1.17+Math.floor(item/3)*.12,.02,kind==='laundry'?.27:.19,.11,.25,kind==='laundry'?'box':'produce');
    }
   }
  }
 }
 // These two work communities address the real basement-return view: the
 // north-facing Netmakers boundary and Power Depot's west bearing wing.
 // Their work frames carry themselves; no attachment to an inset model is
 // inferred from a collision rectangle. The road and depot mouth stay clear.
 for(const [id,kind,x,z,width,depth] of [
  ['netmakers-north-work','net-repair',27,69.3,6,3.2],
  ['depot-west-maintenance','depot-repair',56,69.5,4.8,2.8],
 ]){
  const obstacle={id:`town-detail-${id}`,minX:(x-width/2)/4,maxX:(x+width/2)/4,minY:(z-depth/2)/4,maxY:(z+depth/2)/4};
  const community={id:obstacle.id,buildingId:kind==='net-repair'?'harbor-block-3':'harbor-block-4',kind,x,z,yaw:0,width,depth,obstacle};
  communities.push(community);obstacles.push(obstacle);
  const add=(role,slot,px,py,pz,w,h,d,geometry='box',roll=0)=>parts.push({communityId:community.id,role,slot,geometry,position:[x+px,py,z+pz],size:[w,h,d],yaw:0,roll});
  if(kind==='net-repair'){
   // Working-height loom with an irregular hung net, its rope heading carried
   // by two braced uprights. Reels and bench form one usable repair station.
   for(const side of [-1,1]){
    add('net-frame-bearing-foot','wood',side*1.70,.21,.69,.48,.18,1.6);
    add('net-frame-upright','wood',side*1.70,1.44,1.0,.14,2.52,.14);
    add('net-frame-brace','wood',side*1.70,.82,.59,.10,1.43,.10,'box',-.54);
   }
   add('net-frame-heading','wood',0,2.66,1,3.65,.15,.15);
   for(let column=0;column<13;column++)add('net-hanging-cord','dark',-1.47+column*.245,1.57+Math.sin(column*.8)*.07,1, .026,1.67-Math.sin(column*.8)*.14,.026);
   for(let row=0;row<7;row++)add('net-weft-cord','dark',0,.84+row*.235,1,3.08,.027,.027);
   add('net-repair-worktop','wood',-.8,1.03,-.65,2.7,.11,.82);
   for(const side of [-1,1])for(const end of [-1,1])add('net-repair-worktop-bearing','wood',-.8+side*1.10,.60,-.65+end*.31,.10,.91,.10);
   add('net-repair-tool-tray','metal',-.85,1.11,-.65,.60,.07,.33);
   for(const side of [-1,1])add('net-reel-runner','wood',1.83+side*.39,.24,-.24,.13,.26,1.23);
   add('net-reel-cradle','wood',1.83,.43,-.24,1.25,.11,1.23);
   addReel(add,1.83,1.08,-.55,1.19);
   // The shallow cart faces its worn route out to the road. Its load deck is
   // carried by axles and four wheels; the handles remain inside the work bed.
   add('net-cart-deck','wood',-2,.54,-1.08,1.03,.12,.91);
   for(const side of [-1,1]){
    add('net-cart-side-rail','wood',-2+side*.50,.81,-1.08,.06,.44,.95);
    add('net-cart-handle','metal',-2+side*.43,.85,-.45,.045,.045,.63);
    for(const axle of [-1,1]){
     add('net-cart-wheel','dark',-2+side*.43,.33,-1.08+axle*.31,.36,.10,.36,'cylinder',Math.PI/2);
     parts[parts.length-1].yaw=Math.PI/2;
    }
   }
   for(const axle of [-1,1])add('net-cart-axle','metal',-2,.33,-1.08+axle*.31,.95,.065,.065);
  }else{
   for(const side of [-1,1])add('maintenance-pallet-runner','wood',side*1.10,.24,-.38,.15,.26,1.65);
   for(let plank=0;plank<8;plank++)add('maintenance-pallet-plank','wood',-1.59+plank*.455,.43,-.38,.34,.10,1.65);
   for(const side of [-1,1])addReel(add,side*.88,1.05,-.7,1.14);
   add('maintenance-hand-truck-platform','metal',1.70,.42,.43,.70,.09,.85);
   for(const side of [-1,1]){
    add('maintenance-hand-truck-bearing','metal',1.70+side*.24,.90,.78,.055,1.02,.055);
    add('maintenance-hand-truck-wheel','dark',1.70+side*.33,.315,.38,.34,.12,.34,'cylinder',Math.PI/2);
    parts[parts.length-1].yaw=Math.PI/2;
   }
   add('maintenance-hand-truck-handle','metal',1.70,1.42,.78,.58,.07,.07);
  }
 }
 const industrialFrontage=makeCoastalIndustrialFrontage(coastal);
 parts.push(...industrialFrontage.parts);
 const timberWorkspace=makeCoastalTimberWorkspace(coastal);
 communities.push(...timberWorkspace.communities);parts.push(...timberWorkspace.parts);obstacles.push(...timberWorkspace.obstacles);
 const cableRepair=makeCoastalCableRepair({communities,parts,obstacles});parts.push(...cableRepair.parts);
 return {communities,parts,obstacles,industrialFrontage,timberWorkspace,cableRepair};
}

export function buildCoastalTownDetails(world){
 const plan=world.course.coastal?.townDetails;if(!plan)return null;
 const root=new THREE.Group();root.name='TownAddressCommunities';
 const ownedMaterials=[createTownWoodMaterial(),new THREE.MeshStandardMaterial({color:0x526343,roughness:.97})];
 const materials={wood:ownedMaterials[0],green:ownedMaterials[1],metal:world.materials.rust,dark:world.materials.dark};
 const geometries={box:world.unitBox,cylinder:new THREE.CylinderGeometry(.5,.5,1,10),leaf:townPlantGeometry(),produce:new THREE.IcosahedronGeometry(.5,0),flange:townReelFlangeGeometry(),cable:townCableGeometry()};
 const bins=new Map();
 for(const p of plan.parts){const key=[p.slot,p.geometry,Math.floor(p.position[0]/96),Math.floor(p.position[2]/96)].join('/');if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);}
 const pose=new THREE.Object3D(),meshes=[];let triangles=0;
 for(const list of bins.values()){
  const p=list[0],geometry=geometries[p.geometry],mesh=createCoastalInstances(geometry,materials[p.slot],list.length);
  list.forEach((part,i)=>{pose.position.fromArray(part.position);pose.scale.fromArray(part.size);pose.rotation.set(part.roll,part.yaw,part.tilt||0);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});
  if(p.slot==='wood'){
   const data=new Float32Array(mesh.instanceMatrix.count*4);
   list.forEach((part,i)=>data.set(townWoodPieceParameters(part),i*4));
   mesh.geometry.setAttribute('townWoodPiece',new THREE.InstancedBufferAttribute(data,4));
  }
  mesh.name=`TownDetails:${p.slot}:${p.geometry}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
  triangles+=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3*list.length;
 }
 world.root.add(root);
 const diagnostics={communities:plan.communities.length,parts:plan.parts.length,draws:meshes.length,triangles,colliders:plan.obstacles.length,ownedMaterials:2,ownedPrimitives:5,woodPieceAttributeBytes:meshes.reduce((sum,mesh)=>sum+(mesh.geometry.attributes.townWoodPiece?.array.byteLength||0),0),industrialFrontage:plan.industrialFrontage?.diagnostics,timberWorkspace:plan.timberWorkspace?.diagnostics,cableRepair:plan.cableRepair?.diagnostics};
 if(world.diagnostics)world.diagnostics.townDetails=diagnostics;
 let disposed=false;
 return {root,diagnostics,dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.dispose();for(const [name,geometry] of Object.entries(geometries))if(name!=='box')geometry.dispose();for(const material of ownedMaterials)material.dispose();root.removeFromParent();}};
}
