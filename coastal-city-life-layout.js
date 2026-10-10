import {capeGroundHeight} from './coastal-terrain.js';
import {createFailedClosurePlan} from './assets/blackwater-kit/architecture.js';

const hash=(a,b,s)=>{let h=Math.imul(a^s,374761393)^Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
const rectDistance=(x,z,r)=>Math.hypot(Math.max(r.minX-x,0,x-r.maxX),Math.max(r.minZ-z,0,z-r.maxZ));
const scenes=[
 ['coast-lot-0-0-0-0','abandoned-market'],['coast-lot-0-0-1-2','evacuation-sorted'],
 ['coast-lot-1-0-0-1','resident-flight'],['coast-lot-1-1-1-4','overgrown-garden'],
 ['coast-lot-2-0-0-1','repair-interrupted'],['coast-lot-2-1-0-2','refuse-firebreak'],
 ['coast-lot-3-0-1-1','clinic-queue'],['coast-lot-3-1-1-0','loading-abandoned'],
];
export function cityLifeSiteClear(course,x,z,envelope,{solid=false,extraExclusions=[]}={}){
 const coast=course.coastal;if(!coast||x<132||x>365||z<4||z>307)return false;
 // Keep the accepted grove/court, forest, work stations and terrain banks exact.
 if(z>251&&x>232)return false;
 for(const r of [...(coast.courtLane?.access||[]),...extraExclusions])if(rectDistance(x,z,r)<envelope+.8)return false;
 for(const b of coast.buildings){const r=b.collision||{minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.z-b.depth/2,maxZ:b.z+b.depth/2};if(rectDistance(x,z,r)<envelope+.25)return false;}
 for(const i of coast.blackwaterSlice.interiors)for(const p of [i.route?.frontApproach,i.route?.rearApproach])if(p&&Math.hypot(x-p.x,z-p.z)<3.05+envelope)return false;
 for(const r of coast.roads){const minX=r.x-r.width/2,maxX=r.x+r.width/2,minZ=r.z-r.depth/2,maxZ=r.z+r.depth/2;
  if(r.width>r.depth?x>minX-envelope&&x<maxX+envelope&&Math.abs(z-r.z)<3.135+envelope:z>minZ-envelope&&z<maxZ+envelope&&Math.abs(x-r.x)<3.135+envelope)return false;
 }
 for(const p of [...(coast.maritime?.cars||[])])if(rectDistance(x,z,p.bounds)<envelope+.8)return false;
 for(const p of [...(coast.townDetails?.obstacles||[]),...(course.obstacles||[])])if(rectDistance(x,z,{minX:p.minX*4,maxX:p.maxX*4,minZ:p.minY*4,maxZ:p.maxY*4})<envelope+(solid?.35:.12))return false;
 for(const station of coast.workbenches||[])if(Math.hypot(x-station.x*4,z-station.y*4)<4+envelope)return false;
 const cell=course.cells[Math.floor(z/4)*course.w+Math.floor(x/4)];return !!cell&&!cell.every(v=>v===1);
}

// Address-centred unequal scenes: belongings and maintenance are interrupted
// in specific places, rather than a city-wide uniform random litter pass.
export function makeCoastalCityLife(course,{seed=course.worldSeed??7317,extraExclusions=[],burntDrain=true}={}){
 const coast=course.coastal,parts=[],obstacles=[],communities=[];
 const add=(group,role,slot,shape,x,y,z,width,height,depth,yaw=0,solid=false)=>{
  const id=`city-life-${group}-${parts.length}`,part={id,community:group,role,slot,shape,x,y,z,width,height,depth,yaw};parts.push(part);
  if(solid)obstacles.push({id,minX:(x-width/2)/4,maxX:(x+width/2)/4,minY:(z-depth/2)/4,maxY:(z+depth/2)/4});
 };
 for(const [index,[address,story]]of scenes.entries()){
  const b=coast.blackwaterSlice.buildings.find(b=>b.id===address);if(!b)continue;
  const group=`${address}-${story}`,c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0);
  const transform=(lx,lz)=>({x:b.x+lx*c+lz*s,z:b.z-lx*s+lz*c});
  const accepted={id:group,address,story,grass:0,props:0};
  // Three uneven cracks/root pockets per address, with open gaps between them.
  const anchors=[[-b.width/2-1.15,-b.depth*.27],[b.width/2+1.20,b.depth*.31],[-b.width*.28,-b.depth/2-1.2]];
  for(let slot=0;slot<68;slot++)for(let attempt=0;attempt<12;attempt++){
   const anchor=anchors[(slot+index)%3],a=slot*2.399963+hash(slot,attempt,seed+index)*1.3,r=Math.sqrt(hash(slot,attempt,seed+991))*2.5;
   const p=transform(anchor[0]+Math.cos(a)*r,anchor[1]+Math.sin(a)*r*.42),size=.16+hash(slot,index,seed+51)*.23;
   if(!cityLifeSiteClear(course,p.x,p.z,size*.5,{extraExclusions})||parts.some(q=>q.shape==='grass'&&Math.hypot(q.x-p.x,q.z-p.z)<.22))continue;
   add(group,'crack-root-grass','foliage','grass',p.x,Math.max(.135,capeGroundHeight(p.x,p.z)),p.z,size,.11+hash(slot,index,seed+61)*.16,size,a);accepted.grass++;break;
  }
  for(let slot=0;slot<17;slot++)for(let attempt=0;attempt<16;attempt++){
   const anchor=anchors[(Math.floor(slot/5)+index)%3],a=hash(slot,attempt,seed+331)*Math.PI*2,r=.35+Math.sqrt(hash(slot,attempt,seed+551))*2.9;
   const p=transform(anchor[0]+Math.cos(a)*r,anchor[1]+Math.sin(a)*r*.55),type=(slot+index*2)%7,solid=type===0||type===3||type===5;
   const sizes=[[.64,.40,.46],[.32,.34,.30],[.43,.012,.24],[.64,.43,.56],[.58,.016,.18],[.85,.58,.16],[.38,.028,.32]][type];
   const envelope=Math.hypot(sizes[0],sizes[2])*.5;
   if(!cityLifeSiteClear(course,p.x,p.z,envelope,{solid,extraExclusions})||parts.some(q=>q.shape!=='grass'&&Math.hypot(q.x-p.x,q.z-p.z)<.75))continue;
   const base=Math.max(.135,capeGroundHeight(p.x,p.z)),roles=['evacuation-crate','knotted-refuse-bag','creased-litter','empty-planter','fallen-notice-board','broken-barrier','dropped-sheet'];
   const slots=['wood','dark','paper','rust','wood','rust','fabric'],shape=type===1?'bag':type===3?'planter':type===5?'barrier':'box',yaw=solid?0:a;
   add(group,roles[type],slots[type],shape,p.x,base+sizes[1]/2,p.z,...sizes,yaw,solid);accepted.props++;break;
  }
  communities.push(accepted);
 }
 // Reauthor just the actual receiving-hall address after historical generation.
 // Other addresses keep their original records, indices and crowding inputs.
 const service=communities.find(p=>p.address==='coast-lot-2-1-0-2');
 if(service){
  const group=service.id,oldIDs=new Set(parts.filter(p=>p.community===group).map(p=>p.id));
  for(let i=parts.length-1;i>=0;i--)if(oldIDs.has(parts[i].id))parts.splice(i,1);
  for(let i=obstacles.length-1;i>=0;i--)if(oldIDs.has(obstacles[i].id))obstacles.splice(i,1);
  service.story='interrupted-cable-service';service.grass=0;service.props=0;
  const emit=(name,role,slot,shape,x,z,width,height,depth,{base,solid=false,yaw=0}={})=>{
   const envelope=Math.hypot(width,depth)/2;
   // Preserve the entire existing4m receiving passage, not just its centre.
   if(x-envelope<292&&x+envelope>288)return false;
   if(!cityLifeSiteClear(course,x,z,envelope,{solid,extraExclusions}))return false;
   const ground=Math.max(.135,capeGroundHeight(x,z)),id=`city-life-${group}-${name}`;
   parts.push({id,community:group,role,slot,shape,x,y:(base??ground)+height/2,z,width,height,depth,yaw});
   if(solid)obstacles.push({id,minX:(x-width/2)/4,maxX:(x+width/2)/4,minY:(z-depth/2)/4,maxY:(z+depth/2)/4});
   service.props++;return true;
  };
  // Two unequal carried loads wait beside the existing reels/splice. Upper
  // crates bear on their own lower crate, never on the old cable machinery.
  for(const [i,p]of [[297.25,118.85,1.08,.68,.72],[299.15,118.90,.84,.43,.64]].entries()){
   const [x,z,w,h,d]=p,base=Math.max(.135,capeGroundHeight(x,z));
   if(emit(`load-${i}-base`,'cable-service-carried-load','wood','crate',x,z,w,h,d,{base,solid:true})){
    emit(`load-${i}-top`,'unequal-splice-parts-load','wood','crate',x+(i?.04:-.06),z+.02,w*.82,i?.28:.47,d*.82,{base:base+h});
   }
  }
  emit('maintenance-board','fallen-cable-maintenance-board','wood','box',296.5,117.2,.92,.055,.36,{yaw:-.16});
  emit('maintenance-sheet','weathered-service-notice','paper','stencil',296.5,117.2,.80,.002,.28,{base:Math.max(.135,capeGroundHeight(296.5,117.2))+.056,yaw:-.16});
  emit('spare-coil','spare-cable-service-coil','dark','coil',298.45,118.65,.58,.09,.58);
  emit('edge-barrier','interrupted-reel-work-edge','rust','barrier',293.65,116.55,.92,.62,.20,{solid:true});
  emit('folded-cloth','splice-cleaning-cloth','fabric','box',298.35,117.45,.47,.035,.29,{yaw:.24});
  // Narrow disconnected wall-root seams, with unequal authored lengths. No
  // fill across the receiving lane or broad random strip around this address.
  const seams=[{x:297.0,z:119.46,length:3.8,axis:0},{x:304.1,z:119.45,length:2.2,axis:0},{x:316.48,z:126.6,length:4.6,axis:1}];
  for(let slot=0;slot<68;slot++){
   const seam=seams[slot%3],t=hash(slot,5,seed+913),jitter=(hash(slot,5,seed+991)-.5)*.10;
   const x=seam.x+(seam.axis===0?(t-.5)*seam.length:jitter),z=seam.z+(seam.axis===1?(t-.5)*seam.length:jitter),size=.16+hash(slot,5,seed+51)*.23;
   if(x-size/2<292&&x+size/2>288||!cityLifeSiteClear(course,x,z,size/2,{extraExclusions})||parts.some(p=>p.shape==='grass'&&Math.hypot(p.x-x,p.z-z)<.22))continue;
   parts.push({id:`city-life-${group}-wall-seam-${slot}`,community:group,role:'cable-service-wall-root-seam',slot:'foliage',shape:'grass',x,y:Math.max(.135,capeGroundHeight(x,z)),z,width:size,height:.11+hash(slot,5,seed+61)*.16,depth:size,yaw:hash(slot,5,seed+313)*Math.PI});service.grass++;
  }
 }
 // The near-left workshop in the original 232/232 street view has a two
 // metre east sidewalk. Keep its outer 1.8m visually clear: only tall narrow
 // roots occupy the first .18m of its actual wall seam. No solid is added.
 const owner=coast.buildings.find(b=>b.zone==='industrial'&&Math.abs(b.collision?.maxX-224)<1e-6&&Math.abs(b.collision?.maxZ-224)<1e-6);
 if(owner){
  const wall=owner.collision,road=coast.roads.find(r=>r.width<r.depth&&Math.abs(r.x-232)<1e-6),curb=road&&road.x-road.width/2,
   grassRoom=Math.max(0,544-parts.filter(p=>p.shape==='grass').length),propRoom=Math.max(0,136-parts.filter(p=>p.shape!=='grass').length),
   group=`${owner.id}-abandoned-workshop-frontage`,accepted={id:group,address:owner.id,story:'abandoned-workshop-frontage',grass:0,props:0,
    authority:{wall:{...wall},curbX:curb,sidewalkLane:{minX:wall.maxX+.2,maxX:curb,minZ:wall.minZ+1.5,maxZ:wall.maxZ-1.5},passageLane:{minX:wall.minX-2.9,maxX:wall.minX-1.1,minZ:wall.minZ,maxZ:wall.maxZ}},catches:[]},
   seamView={...course,coastal:{...coast,buildings:coast.buildings.filter(b=>b!==owner)}};
  const seamClear=(x,z,width,depth)=>curb-wall.maxX>=2-1e-6&&x-width/2>wall.maxX&&x+width/2<=wall.maxX+.18&&
   z-depth/2>=wall.minZ+1.5&&z+depth/2<=wall.maxZ-1.5&&cityLifeSiteClear(seamView,x,z,Math.max(width,depth)/2,{extraExclusions});
  for(const [cluster,plan]of[[56,wall.maxZ-3,2.6],[28,wall.maxZ-6.2,1.7],[16,wall.maxZ-9,1]].entries()){
   const [count,centre,length]=plan,catchCount={id:cluster,centreZ:centre,length,grass:0};
   for(let slot=0;slot<count&&accepted.grass<Math.min(100,grassRoom);slot++){
    const width=.075+hash(slot,cluster,seed+6201)*.065,depth=.09+hash(slot,cluster,seed+6202)*.06,
     x=wall.maxX+.103+(hash(slot,cluster,seed+6203)-.5)*.01,z=centre+((slot+.5)/count-.5)*length+(hash(slot,cluster,seed+6204)-.5)*.045;
    if(!seamClear(x,z,width,depth))continue;
    parts.push({id:`city-life-${group}-root-${cluster}-${slot}`,community:group,role:'workshop-wall-seam-catch',slot:'foliage',shape:'grass',x,y:Math.max(.135,capeGroundHeight(x,z)),z,width,height:.32+hash(slot,cluster,seed+6205)*.34,depth,yaw:hash(slot,cluster,seed+6206)*Math.PI});accepted.grass++;catchCount.grass++;
   }accepted.catches.push(catchCount);
  }
  const stock=[['carried-stock','wood','crate',.48,.38,.38,.62,2.7],['unequal-carried-stock','wood','crate',.38,.27,.33,.62,3.45],['sheltered-refuse','dark','bag',.28,.31,.26,.59,4.2],['dropped-service-paper','paper','box',.28,.012,.19,.65,4.75],['creased-service-paper','paper','box',.34,.012,.16,.68,5.25],['abandoned-cover-cloth','fabric','box',.34,.028,.21,.64,5.8]];
  for(const [slot,p]of stock.entries()){
   if(accepted.props>=Math.min(6,propRoom))break;
   const [role,material,shape,width,height,depth,inset,along]=p,x=wall.minX-inset,z=wall.maxZ-along,radius=Math.hypot(width,depth)/2;
   if(x-radius<=accepted.authority.passageLane.maxX||!cityLifeSiteClear(course,x,z,radius,{extraExclusions})||parts.some(q=>q.shape!=='grass'&&Math.hypot(q.x-x,q.z-z)<radius+Math.hypot(q.width,q.depth)/2+.1))continue;
   parts.push({id:`city-life-${group}-stock-${slot}`,community:group,role,slot:material,shape,x,y:Math.max(.135,capeGroundHeight(x,z))+height/2,z,width,height,depth,yaw:shape==='box'?(slot-3)*.17:0});accepted.props++;
  }
  const closure=createFailedClosurePlan(owner);
  if(closure&&Math.abs(owner.yaw||0)<1e-6){
   accepted.failedClosure={...closure,worldAnchor:[owner.x+closure.anchor[0],(owner.y||0)+closure.anchor[1],owner.z+closure.anchor[2]]};
   for(const [slot,p]of[[-1.5,.22,.09],[-1.1,.15,.12]].entries()){
    if(accepted.props>=Math.min(8,propRoom))break;
    const [offset,width,depth]=p,x=owner.x+closure.anchor[0]+offset,z=wall.maxZ+.095,radius=Math.hypot(width,depth)/2;
    // Front seam lies entirely before the continuous1.8m front sidewalk.
    if(z-depth/2<=wall.maxZ||z+depth/2>wall.maxZ+.18||x+width/2>wall.maxX-1.1||!cityLifeSiteClear(seamView,x,z,radius,{extraExclusions}))continue;
    parts.push({id:`city-life-${group}-closure-paper-${slot}`,community:group,role:'fallen-failed-closure-paper',slot:'paper',shape:'box',x,y:Math.max(.135,capeGroundHeight(x,z))+.006,z,width,height:.012,depth,yaw:0});accepted.props++;
   }
  }
  if(accepted.grass||accepted.props)communities.push(accepted);
 }
 if(burntDrain){
  const owner=coast.maritime?.cars.find(p=>p.id==='street-main-16-resident');
  if(owner){
   const group='street-main-16-resident-failed-drain',accepted={id:group,address:owner.id,story:'burnt-estate-failed-drain',grass:0,props:0,catches:[],authority:{ownerBounds:{...owner.bounds},gutter:{minX:179.8,maxX:184.2,minZ:61.70,maxZ:61.95},roadEdge:62,driveStrip:[52.865,59.135]}},
    grassRoom=Math.max(0,640-parts.filter(p=>p.shape==='grass').length),propRoom=Math.max(0,152-parts.filter(p=>p.shape!=='grass').length);
   for(const [cluster,[centre,length,count]]of[[180.4,.95,52],[182.1,.85,28],[183.65,.50,16]].entries()){
    const caught={centre,length,requested:count,grass:0};accepted.catches.push(caught);
    for(let slot=0;slot<count&&accepted.grass<Math.min(96,grassRoom);slot++){
     const x=centre+(hash(slot,cluster,seed+7311)-.5)*length,z=61.825+(hash(slot,cluster,seed+7312)-.5)*.04,
      width=.09+hash(slot,cluster,seed+7313)*.05,depth=.07+hash(slot,cluster,seed+7314)*.03,yaw=hash(slot,cluster,seed+7315)*Math.PI;
     if(!burntEstateGutterSiteClear(course,owner,x,z,width,depth,yaw,{extraExclusions}))continue;
     parts.push({id:`city-life-${group}-root-${cluster}-${slot}`,community:group,role:'burnt-estate-gutter-catch',slot:'foliage',shape:'grass',x,y:Math.max(.135,capeGroundHeight(x,z)),z,width,height:.25+hash(slot,cluster,seed+7316)*.30,depth,yaw});accepted.grass++;caught.grass++;
    }
   }
   for(let slot=0;slot<16&&accepted.props<Math.min(16,propRoom);slot++){
    const cluster=slot<9?0:slot<13?1:2,[centre,length]=[[180.4,.95],[182.1,.85],[183.65,.50]][cluster],
     x=centre+(hash(slot,cluster,seed+7321)-.5)*length,z=61.825+(hash(slot,cluster,seed+7322)-.5)*.035,
     width=.08+hash(slot,cluster,seed+7323)*.11,depth=.035+hash(slot,cluster,seed+7324)*.055,height=.025+hash(slot,cluster,seed+7325)*.075,yaw=hash(slot,cluster,seed+7326)*Math.PI;
    if(!burntEstateGutterSiteClear(course,owner,x,z,width,depth,yaw,{extraExclusions}))continue;
    parts.push({id:`city-life-${group}-chip-${slot}`,community:group,role:'failed-drain-trapped-masonry',slot:slot%3?'rust':'paper',shape:'box',x,y:Math.max(.135,capeGroundHeight(x,z))+height/2,z,width,height,depth,yaw});accepted.props++;
   }
   if(accepted.grass||accepted.props)communities.push(accepted);
  }
 }
 return {seed,parts,obstacles,communities,diagnostics:{grass:parts.filter(p=>p.shape==='grass').length,props:parts.filter(p=>p.shape!=='grass').length,obstacles:obstacles.length,ceiling:{grass:burntDrain?640:544,props:burntDrain?152:136},source:'Address-bound interrupted evacuation / repair / refuse scenes',stationary:true}};
}

// This cosmetic seam exemption belongs only to the canonical burnt car. Full
// rotated footprints stay outside its immutable solid proxy and off sidewalks.
export function burntEstateGutterSiteClear(course,owner,x,z,width,depth,yaw,{extraExclusions=[]}={}){
 if(owner?.id!=='street-main-16-resident'||Math.abs(owner.x-182)>1e-8||Math.abs(owner.z-60.45)>1e-8||Math.abs(owner.yaw||0)>1e-8)return false;
 const b=owner.bounds;if(!b||Math.abs(b.minX-179.535)>1e-8||Math.abs(b.maxX-184.465)>1e-8||Math.abs(b.minZ-59.245)>1e-8||Math.abs(b.maxZ-61.655)>1e-8)return false;
 const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),hx=(width*c+depth*s)/2,hz=(width*s+depth*c)/2;
 if(x-hx<179.8||x+hx>184.2||z-hz<61.70||z+hz>61.95||z-hz<=b.maxZ)return false;
 const sameProxy=p=>p.id===owner.id&&Math.abs(p.minX*4-b.minX)<1e-8&&Math.abs(p.maxX*4-b.maxX)<1e-8&&Math.abs(p.minY*4-b.minZ)<1e-8&&Math.abs(p.maxY*4-b.maxZ)<1e-8;
 const coast=course.coastal,view={...course,obstacles:course.obstacles.filter(p=>!sameProxy(p)),coastal:{...coast,maritime:{...coast.maritime,cars:coast.maritime.cars.filter(p=>p!==owner)}}};
 return cityLifeSiteClear(view,x,z,Math.hypot(width,depth)/2,{extraExclusions});
}


