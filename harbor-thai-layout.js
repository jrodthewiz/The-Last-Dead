// Authored in render metres. The engine converts these bounds to four-metre cells.
const PI=Math.PI;
export function footprintFor(p){
 const c=Math.abs(Math.cos(p.yaw||0)),s=Math.abs(Math.sin(p.yaw||0));
 const hx=(p.width*c+p.depth*s)/2,hz=(p.width*s+p.depth*c)/2;
 return {id:p.id,minX:p.x-hx,maxX:p.x+hx,minZ:p.z-hz,maxZ:p.z+hz};
}
export function makeHarborThaiLayout(course){
 const buildings=[],props=[];
 const models=['bangkok-hospital-clinic-building','concrete-walk-up-flat-block','student-dormitory-block','low-rise-condominium','concrete-walk-up-flat-block','bangkok-apartment-block'];
 for(const [i,b] of course.buildings.entries()){
  const base={id:`thai-${b.id}`,asset:models[i],x:(b.x+b.w/2)*4,z:(b.y+b.h/2)*4,y:.13,yaw:b.rotation||0,width:b.w*4-.7,depth:b.h*4-.7,height:[16,17,15,10,19,21][i],zone:i<3?'customs':'service'};
  if(b.passage){for(const side of [-1,1])buildings.push({...base,id:`${base.id}-${side<0?'west':'east'}`,x:(b.x+3+side*2)*4,width:7.5,depth:23.3,fitWidth:23.3,fitDepth:7.5,yaw:side<0?PI/2:-PI/2});}
  else buildings.push({...base,...(b.yard?{z:(b.y+1)*4,depth:7.4}: {})});
 }
 const add=(id,asset,x,z,width,height,depth,yaw=0,zone='service',solid=true)=>props.push({id,asset,x,z,y:.14,width,height,depth,yaw,zone,solid});
 // Market queues run parallel to Customs, leaving the carriageway centre open.
 add('market-noodles','noodle-soup-cart',38.4,23,2.5,2.8,1.6,PI/2,'market');
 add('market-fruit','iced-fruit-cart',38.4,29,2.5,2.8,1.6,PI/2,'market');
 // A low service stall stays below the Customs stair sign and pitched ridge.
 // Uniform fitting retains the cart's carrying frame, counter and food detail;
 // its conservative declared collision footprint remains unchanged.
 add('market-canopy','street-stall-canopy-cart',38.4,35,3,2.65,1.8,PI/2,'market');
 add('market-seating','terrazzo-pedestal-park-table',47.4,27,.9,1.05,.9,0,'market');
 add('market-bin','municipal-wheelie-bin',47.7,33,.65,1.2,.75,0,'market');
 // Transit lay-by on the outer east lane; the north-south route stays wide.
 add('transit-van','toyota-commuter-van',121,29,2.3,2.8,5.5,0,'transit');
 add('transit-tuktuk','tuk-tuk',121,40,1.6,2.2,3.2,0,'transit');
 add('transit-table','terrazzo-pedestal-park-table',120,20,.9,1.05,.9,0,'transit');
 add('transit-bin','municipal-wheelie-bin',123,20,.65,1.2,.75,0,'transit');
 // Southwest yard has playable gaps; keep both tool-cache and rifle approaches.
 add('yard-hilux','toyota-hilux',16,89,2.1,2.3,5.1,0,'netmakers');
 add('yard-drum-a','oil-drum',14,82,.7,1,.7,0,'netmakers');
 add('yard-drum-b','oil-drum',15,82,.7,1,.7,0,'netmakers');
 add('yard-drum-c','oil-drum',33,91,.7,1,.7,0,'netmakers');
 add('yard-bin','municipal-wheelie-bin',33.5,81,.65,1.2,.75,0,'netmakers');
 // Loading aprons are pockets off Dock Road, never obstacles in its centre.
 add('customs-van','toyota-commuter-van',24,43,2.3,2.8,5.5,PI/2,'customs');
 add('cold-hilux','toyota-hilux',65,43,2.1,2.3,5.1,PI/2,'cold-storage');
 add('workshop-tuktuk','tuk-tuk',107,43,1.6,2.2,3.2,PI/2,'workshop');
 for(const [x,z,zone] of [[15,43,'customs'],[34,43,'customs'],[55,43,'cold-storage'],[75,43,'cold-storage'],[95,43,'workshop'],[113,43,'workshop']]){
  add(`loading-drum-${x}`,'oil-drum',x,z,.7,1,.7,0,zone);
  add(`loading-bin-${x}`,'municipal-wheelie-bin',x+1,z,.65,1.2,.75,0,zone);
 }
 // Quayside social spaces contrast with the enclosed service passage.
 for(const [x,z] of [[15,108],[31,108],[77,108],[99,108]])add(`quay-table-${x}`,'terrazzo-pedestal-park-table',x,z,.9,1.05,.9,0,'waterfront');
 add('quay-fruit','iced-fruit-cart',16,113,2.5,2.8,1.6,0,'waterfront');
 add('quay-noodles','noodle-soup-cart',78,113,2.5,2.8,1.6,0,'waterfront');
 for(const x of [10,36,73,103])add(`quay-bin-${x}`,'municipal-wheelie-bin',x,116,.65,1.2,.75,0,'waterfront');
 // Lighting rhythm marks junctions without adding point lights or crossing rays.
 for(const [x,z] of [[10,14],[38,14],[50,14],[90,14],[117,14],[38,42],[50,42],[90,42],[117,42],[10,70],[38,70],[50,70],[90,70],[117,70],[10,103],[38,103],[50,103],[90,103],[117,103]])add(`lamp-${x}-${z}`,'steel-cobra-head-street-lamp',x,z,1.8,6,.24,0,'street');
 // Barriers articulate the dead-end perimeter rather than blocking objectives.
 for(const x of [16,28,58,70,98,110])add(`north-barrier-${x}`,'concrete-jersey-barrier',x,5,3,1, .6,0,'perimeter');
 return {version:1,buildings,props,colliders:props.filter(p=>p.solid).map(footprintFor),zones:[{id:'market',name:'Customs Market',x:42,z:29},{id:'transit',name:'East Transit',x:120,z:33},{id:'netmakers',name:'Netmakers Yard',x:24,z:87},{id:'waterfront',name:'Ferry Promenade',x:79,z:110}]};
}
