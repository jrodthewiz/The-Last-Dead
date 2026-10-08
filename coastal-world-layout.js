// Authored coastal expansion. Metres describe visuals; four-metre cells remain
// the sole building/shore collision authority. Legacy harbor rooms stay intact.
import {makeCoastalNeighborhoods} from './coastal-neighborhood-layout.js';
import {makeBlackwaterDistrict,blackwaterObstacle,openBlackwaterShop} from './blackwater-district-layout.js';
import {architectureColliders,createBuildingPlan} from './assets/blackwater-kit/architecture.js';
import {getCottageDiscovery,isAuthoredCottage} from './assets/blackwater-kit/cottage-authored.js';
import {CAPE_TERRAIN,capeStreamZ,makeCapeForestPlacements} from './coastal-terrain.js';
import {serializeStructure} from './coastal-structures.js';
import {makeCoastalWorkbenches} from './coastal-workbenches.js';
import {makeCoastalUnderstory} from './coastal-understory-layout.js';
import {attachCoastalScavenging} from './coastal-scavenging.js';
export function attachCoastalWorld(course) {
  const oldW=course.w,oldH=course.h,oldCells=course.cells,w=112,h=104;
  const cells=Array.from({length:w*h},()=>[0,0,0,0]);
  for(let y=0;y<oldH;y++)for(let x=0;x<oldW;x++){
    cells[y*w+x]=oldCells[y*oldW+x].slice();
    if(x===oldW-1)cells[y*w+x][1]=0;
  }
  const block=(x,y)=>{
    cells[y*w+x]=[1,1,1,1];
    if(y>0)cells[(y-1)*w+x][2]=1;
    if(x<w-1)cells[y*w+x+1][3]=1;
    if(y<h-1)cells[(y+1)*w+x][0]=1;
    if(x>0)cells[y*w+x-1][1]=1;
  };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(y>=30&&x<32)block(x,y);
    if(y===0)cells[y*w+x][0]=1;
    if(x===w-1)cells[y*w+x][1]=1;
    if(y===h-1)cells[y*w+x][2]=1;
    if(x===0)cells[y*w+x][3]=1;
  }
  const buildings=[];
  const add=(id,name,asset,x,z,width,depth,height,zone,yaw=0,custom={})=>{
    const collision={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
    const p={id,name,asset,x,z,y:.13,width:custom.kit?width:width-.7,depth:custom.kit?depth:depth-.7,height,yaw,zone,collision,coastal:true,...custom};
    buildings.push(p);course.thaiLayout.buildings.push(p);
    const b={id,name,model:'building-a',x:collision.minX/4,y:collision.minZ/4,w:width/4,h:depth/4,height,rotation:0,coastal:true};
    for(let cy=b.y;cy<b.y+b.h;cy++)for(let cx=b.x;cx<b.x+b.w;cx++){
      block(cx,cy);course.blocks.push([cx,cy]);
    }
  };
  const neighborhoods=makeCoastalNeighborhoods();
  const blackwaterSlice=makeBlackwaterDistrict(neighborhoods);
  neighborhoods.lots=blackwaterSlice.lots;
  // The new rear exit uses an existing yard path. Move its one small tree into
  // the adjoining bed before either its visual placement or collider is built.
  if(blackwaterSlice.house){
    const exit=blackwaterSlice.house.rearDoor,tree=neighborhoods.props.find(p=>p.kind==='tree'&&Math.abs(p.x-exit.x)<1&&Math.abs(p.z-exit.z-1)<.05);
    if(tree){blackwaterSlice.house.relocatedProps=[{id:tree.id,from:[tree.x,tree.z],to:[exit.x+4.4,tree.z],reason:'clear furnished-house rear doorway'}];tree.x=exit.x+4.4;}
  }
  // The checkpoint is abandoned, but the entrances are usable. Relocate the
  // actual prop records so rendered wrecks/fences and collision stay together.
  for(const [id,x] of [['blackwater-east-checkpoint',222],['blackwater-west-checkpoint',164.4],['blackwater-evacuation-van',206.4],['blackwater-residential-fence-west',153.3],['blackwater-residential-fence-east',214.5]]){
    const p=blackwaterSlice.props.find(p=>p.id===id);if(p)p.x=x;
  }
  const portals=blackwaterSlice.interiors.flatMap(i=>[i.route.frontApproach,i.route.rearApproach].filter(Boolean));
  for(const p of neighborhoods.props){
    const blocksPortal=()=>portals.some(q=>Math.abs(p.x-q.x)<p.width/2+.85&&Math.abs(p.z-q.z)<p.depth/2+.85);
    if(!blocksPortal())continue;
    const original=p.x;
    for(const offset of [4.4,-4.4,8.8,-8.8]){p.x=original+offset;if(!blocksPortal())break;}
  }
  for(const p of neighborhoods.lots)add(p.id,p.name,p.asset,p.x,p.z,p.width,p.depth,p.height,p.zone,p.yaw,
    p.kit?{kit:p.kit,kind:p.kind,label:p.label,enterable:p.enterable,doorOffset:p.doorOffset}:{});
  blackwaterSlice.buildings=buildings.filter(p=>p.kit==='blackwater');
  delete blackwaterSlice.lots;
  const authoredPlans=new Map();
  for(const p of blackwaterSlice.buildings){
    const discovery=getCottageDiscovery(p);if(!discovery)continue;
    const plan=createBuildingPlan(p);authoredPlans.set(p.id,plan);
    const [lx,top,lz]=discovery.position,cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);
    const [ax,az]=discovery.approach;
    course.scavengerPickups.push({id:discovery.id,roomId:p.id,
      x:(p.x+lx*cos+lz*sin)/4,y:(p.z-lx*sin+lz*cos)/4,amount:4,
      label:discovery.label,discoveryLabel:discovery.label,story:discovery.story,
      // The pooled case's mesh bottom is .03 m above its instance origin.
      visualBaseY:p.y+top-.03,visualYaw:p.yaw,supportId:discovery.supportId,
      floorZ:(p.y+plan.structure.floors.find(f=>f.id==='lower').top)/4,itemZ:(p.y+top+.10)/4,reachFloorTolerance:.075,
      approach:{x:(p.x+ax*cos+az*sin)/4,y:(p.z-ax*sin+az*cos)/4}});
    const folio=plan.routeFolio;
    if(folio){
      const [fx,fy,fz]=folio.position,[qx,qz]=folio.approach;
      course.scavengerPickups.push({id:folio.id,roomId:p.id,
        x:(p.x+fx*cos+fz*sin)/4,y:(p.z-fx*sin+fz*cos)/4,amount:0,
        label:folio.label,discoveryLabel:folio.label,story:folio.story,
        visualKind:folio.visualKind,requiresInteract:folio.requiresInteract,destinationId:folio.destinationId,
        visualBaseY:p.y+fy,visualYaw:p.yaw+(folio.yaw||0),folioSize:[...folio.size],supportId:folio.supportId,
        floorZ:(p.y+folio.floorHeight)/4,itemZ:(p.y+folio.interactionPoint[1])/4,reachFloorTolerance:.075,
        approach:{x:(p.x+qx*cos+qz*sin)/4,y:(p.z-qx*sin+qz*cos)/4}});
    }
  }
  const collisionWorld={w,h,cells,blocks:course.blocks};
  for(const interior of blackwaterSlice.interiors)openBlackwaterShop(collisionWorld,interior);
  course.blocks=collisionWorld.blocks;
  if(blackwaterSlice.shop){
    const s=blackwaterSlice.shop;
    course.scavengerPickups.push({id:'coast-scrap-bell-pharmacy',roomId:'coast-bell-pharmacy',x:(s.x+s.doorOffset)/4,y:(s.z-2)/4,amount:4,label:'Bell Pharmacy emergency supplies',color:0xd59a56});
  }
  const structures=[];
  for(const p of blackwaterSlice.buildings){
   const structure=isAuthoredCottage(p)?serializeStructure(p,authoredPlans.get(p.id)||createBuildingPlan(p)):null;
   if(structure){structures.push(structure);continue;}
   for(const local of architectureColliders(p)){
    const cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);
    course.obstacles.push(blackwaterObstacle({x:p.x+local.x*cos+local.z*sin,z:p.z-local.x*sin+local.z*cos,
      width:local.width,depth:local.depth,yaw:p.yaw},`${p.id}-${local.id}`));
   }
  }
  for(const p of blackwaterSlice.props)if(p.solid)course.obstacles.push(blackwaterObstacle(p));
  for(const p of neighborhoods.props)course.obstacles.push({id:p.id,minX:(p.x-p.width/2)/4,maxX:(p.x+p.width/2)/4,minY:(p.z-p.depth/2)/4,maxY:(p.z+p.depth/2)/4});
  const roads=[
    {x:192,z:56,width:384,depth:12},{x:192,z:112,width:384,depth:12},
    ...[176,232,304].map(z=>({x:256,z,width:256,depth:12})),
    ...[144,232,368].map(x=>({x,z:160,width:12,depth:320})),
  ];
  const districts=[
    {id:'harbor',name:'QUARANTINE HARBOR',minX:0,maxX:128,minZ:0,maxZ:120,x:64,z:56},
    {id:'residential',name:'SALTWIND RESIDENTIAL',minX:128,maxX:384,minZ:0,maxZ:120,x:232,z:56},
    {id:'industrial',name:'EAST WORKS',minX:128,maxX:384,minZ:120,maxZ:232,x:232,z:176},
    {id:'coastal-park',name:'LIGHTHOUSE CAPE',minX:128,maxX:384,minZ:232,maxZ:320,x:232,z:304},
  ];
  const landmarks=[
    {id:'saltwind',name:'Saltwind Square',x:58,y:14},
    {id:'works',name:'East Works',x:58,y:44},
    {id:'inlet',name:'Inlet Overlook',x:36,y:66},
    {id:'lighthouse',name:'Lighthouse Cape',x:88,y:76},
    {id:'forest',name:'Cape Forest Footbridge',x:55.5,y:85},
  ];
  for(const [i,p]of landmarks.entries()){
    course.scavengerPickups.push({id:`coast-scrap-${p.id}`,roomId:`coast-${p.id}`,x:p.x,y:p.y,amount:4,label:`${p.name} supply cache`,color:0xd59a56});
    if(i%2===1)course.weaponPickups.push({id:`coast-weapon-${p.id}`,x:p.x+1,y:p.y,weapon:i===1?4:5,weaponIndex:i===1?4:5,label:i===1?'Works rifle':'Cape marksman rifle'});
  }
  // Redistribute the same four coastal residents to specific places. No extra
  // enemies are added to the initial eight-resident population.
  const residentAt=(building,localZ,role)=>{
    const c=Math.cos(building.yaw||0),s=Math.sin(building.yaw||0),lx=building.doorOffset||0;
    return{x:(building.x+lx*c+localZ*s)/4,y:(building.z-lx*s+localZ*c)/4,buildingId:building.id,location:role};
  };
  const office=blackwaterSlice.buildings.find(b=>b.label==='EVACUATION OFFICE');
  const warehouse=blackwaterSlice.buildings.find(b=>/WAREHOUSE/.test(b.label));
  const cottage=blackwaterSlice.buildings.filter(b=>/CAPE LODGE/.test(b.label)&&!isAuthoredCottage(b)).sort((a,b)=>b.z-a.z)[0];
  course.harborSpawns.push(residentAt(office,-1.2,'registration corridor'),residentAt(warehouse,.4,'loading aisle'),residentAt(cottage,-1.2,'abandoned cottage'),{x:347/4,y:339/4,location:'forest verge'});
  // The round lighthouse base has a conservative rectangular collision proxy.
  const lighthouse={x:357,z:292,radius:4.1};
  course.obstacles.push({id:'coast-lighthouse',minX:(lighthouse.x-lighthouse.radius)/4,maxX:(lighthouse.x+lighthouse.radius)/4,minY:(lighthouse.z-lighthouse.radius)/4,maxY:(lighthouse.z+lighthouse.radius)/4});
  Object.assign(course,{w,h,cells,openWorld:true,name:'LOW TIDE COAST',tag:'OPEN COAST',
    water:{minX:-1800,maxX:2200,minZ:-1800,maxZ:2200,level:-1.15},
    coastal:{width:w*4,depth:h*4,terrain:{...CAPE_TERRAIN},structures,land:[{x:224,z:60,width:448,depth:120},{x:288,z:268,width:320,depth:296}],buildings,districts,landmarks,roads,lighthouse,neighborhoods,blackwaterSlice,
      shore:[{x:64,z:120,width:128,depth:1},{x:128,z:268,width:1,depth:296},{x:288,z:416,width:320,depth:1},{x:448,z:208,width:1,depth:416},{x:224,z:0,width:448,depth:1},{x:0,z:60,width:1,depth:120}]}});
  course.coastal.forestPlacements=makeCapeForestPlacements(neighborhoods,buildings,roads);
  course.coastal.workbenches=makeCoastalWorkbenches(blackwaterSlice.buildings);
  course.coastal.understoryPlacements=makeCoastalUnderstory(course.coastal);
  // A visible shop destination gives fittings a home without moving any table.
  const hardware=course.coastal.workbenches.find(s=>s.name==='HARBOR HARDWARE');
  if(hardware)landmarks.push({id:'hardware-bench',name:'Harbor Hardware / repair bench',...hardware.approach});
  const hardwareCache=course.scavengerPickups.find(p=>p.id==='coast-scrap-saltwind');
  if(hardware&&hardwareCache)Object.assign(hardwareCache,{roomId:hardware.buildingId,x:hardware.x,y:hardware.y,
    approach:{...hardware.approach},
    floorZ:hardware.floorZ,itemZ:hardware.itemZ,visualBaseY:hardware.itemZ*4-.03,amount:4,label:'Harbor Hardware repair fittings',discoveryLabel:'REPAIR BENCH FITTINGS',color:0xd59a56});
  blackwaterSlice.coastBounds={minX:0,maxX:w*4,minZ:0,maxZ:h*4};
  for(const x of CAPE_TERRAIN.bridges)for(const side of [-1,1])course.obstacles.push({id:`cape-bridge-${x}-rail-${side}`,minX:(x+side*2.05-.08)/4,maxX:(x+side*2.05+.08)/4,minY:(capeStreamZ(x)-5.3)/4,maxY:(capeStreamZ(x)+5.3)/4});
  for(const p of course.coastal.forestPlacements)if(p.id.startsWith('cape-forest-'))course.obstacles.push({id:p.id,minX:(p.x-p.collisionRadius)/4,maxX:(p.x+p.collisionRadius)/4,minY:(p.z-p.collisionRadius)/4,maxY:(p.z+p.collisionRadius)/4});
  attachCoastalScavenging(course);
  return course;
}
