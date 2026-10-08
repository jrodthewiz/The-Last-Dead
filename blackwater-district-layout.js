// First authored Blackwater slice. These records describe metres; the coastal
// adapter converts solid scenery to the game's four-metre collision cells.
const DOWNTOWN = [
  ['coast-lot-0-0-0-0','BLACKWATER MARKET','corner',15],
  ['coast-lot-0-0-0-1','TERMINUS CAFE','shop',11],
  ['coast-lot-0-0-0-2','EVACUATION OFFICE','shop',18],
  ['coast-lot-0-0-0-3','HARBOR HARDWARE','corner',15],
  ['coast-lot-0-0-1-0','EAST END LAUNDRY','corner',15],
  ['coast-lot-0-0-1-1','BELL PHARMACY','shop',11],
  ['coast-lot-0-0-1-2','LAST STOP GROCER','shop',15],
  ['coast-lot-0-0-1-3','PIER & MAIN','corner',18],
];
const HOUSES = [
  ['coast-lot-1-0-0-0','14 MAIN STREET'],
  ['coast-lot-1-0-0-1','16 MAIN STREET'],
  ['coast-lot-1-0-0-2','18 MAIN STREET'],
  ['coast-lot-1-0-0-3','20 MAIN STREET'],
  ['coast-lot-1-0-1-0','9 SALTWIND LANE'],
  ['coast-lot-1-0-1-1','7 SALTWIND LANE'],
  ['coast-lot-1-0-1-2','5 SALTWIND LANE'],
  ['coast-lot-1-0-1-3','3 SALTWIND LANE'],
];
const SHOP_ID='coast-lot-0-0-1-1';
const HOUSE_ID='coast-lot-1-0-0-2';

export function makeBlackwaterDistrict(neighborhoods) {
  const definitions=new Map(DOWNTOWN.map(([id,label,kind,height])=>[id,{label,kind,height}]));
  for(const [id,label] of HOUSES)definitions.set(id,{label,kind:'house',height:6.4});
  const lots=neighborhoods.lots.map((p,index)=>{
    let spec=definitions.get(p.id);
    if(!spec){
      if(p.zone==='coastal-park')spec={label:p.name,kind:'house',height:6.4};
      else if(p.zone==='industrial')spec={label:`${p.name} / ${p.asset.includes('clinic')?'CLINIC':index%3===0?'WAREHOUSE':'WORKSHOP'}`,kind:'shop',height:p.height};
      else spec={label:`${p.name} / APARTMENTS`,kind:'corner',height:p.height};
    }
    return{...p,...spec,name:definitions.has(p.id)?spec.label:p.name,kit:'blackwater',enterable:true,doorOffset:p.id===SHOP_ID?2:p.width%8===0?-2:0};
  });
  const shop=lots.find(p=>p.id===SHOP_ID);
  const house=lots.find(p=>p.id===HOUSE_ID);
  const housePortal=(localZ)=>({x:house.x+house.doorOffset*Math.cos(house.yaw||0)+localZ*Math.sin(house.yaw||0),z:house.z-house.doorOffset*Math.sin(house.yaw||0)+localZ*Math.cos(house.yaw||0),width:4});
  const interiors=lots.filter(p=>p.kit==='blackwater').map(p=>{
    const point=(localZ)=>({x:Math.round((p.x+p.doorOffset*Math.cos(p.yaw||0)+localZ*Math.sin(p.yaw||0))*1e6)/1e6,z:Math.round((p.z-p.doorOffset*Math.sin(p.yaw||0)+localZ*Math.cos(p.yaw||0))*1e6)/1e6,width:4});
    const rearDoor=p.id===SHOP_ID?null:point(-p.depth/2);
    return{id:p.id,kind:p.kind,label:p.label,x:p.x,z:p.z,width:p.width,depth:p.depth,yaw:p.yaw||0,doorOffset:p.doorOffset,door:point(p.depth/2),rearDoor,route:{frontApproach:point(p.depth/2+2),frontRoom:point(p.depth/4),backRoom:point(-p.depth/4),rearApproach:rearDoor?point(-p.depth/2-2):null}};
  });
  const props=[];
  const prop=(id,kind,x,z,width,depth,yaw=0,solid=false)=>props.push({id:`blackwater-${id}`,kind,x,z,width,depth,yaw,solid});
  // Wrecks occupy the lay-bys, leaving the centre six metres of Main Street
  // open to the truck and preserving Bell Pharmacy's entrance at x=200..204.
  prop('abandoned-car','wreck',175,50.9,4.7,1.75,.12,true);
  prop('evacuation-van','wreck',211,61.1,5.5,1.9,-.04,true);
  prop('east-checkpoint','barricade',218,50.3,5.2,.65,-.06,true);
  prop('west-checkpoint','barricade',160,61.1,4.7,.65,.05,true);
  prop('market-broken-bricks','rubble',170,49.3,4.5,1.4,.23);
  // Falling material sits below Bell's upper failure, west of the live portal.
  prop('pharmacy-broken-glass','rubble',197.2,49,4.2,1.1,.5);
  prop('cafe-collapse','rubble',175.8,21.7,3.5,1.3,-.15);
  prop('house-shingles','rubble',193,62.6,3.2,1.3,.23);
  prop('evacuation-bags','luggage',212.2,49.8,2.2,1.1,.4);
  prop('checkpoint-bags','luggage',216,59.9,2.3,1.1,-.2);
  prop('house-abandoned-bags','luggage',179,62.8,1.6,.9,.3);
  prop('residential-fence-west','fence',155,62.9,5,.16,0,true);
  prop('residential-fence-east','fence',210,62.9,5,.16,0,true);
  prop('pharmacy-power-box','utility',207.4,49.6,.8,.65,0,true);
  prop('market-power-box','utility',171,21.2,.8,.65,Math.PI,true);
  prop('main-street-wire','utility',185,50,.45,.45);
  prop('evacuation-notice','poster',215,49.6,1.4,.12,0);
  prop('pharmacy-notice','poster',198,48.35,.85,.08,0);
  prop('missing-residents','poster',185.8,63.7,.95,.08,Math.PI);
  return {
    version:3,name:'BLACKWATER MAIN STREET',lots,downtownBuildingIds:[...definitions.keys()],
    buildings:lots.filter(p=>p.kit==='blackwater'),interiors,props,
    coastBounds:{minX:Math.min(...lots.map(p=>p.x-p.width/2)),maxX:Math.max(...lots.map(p=>p.x+p.width/2)),minZ:Math.min(...lots.map(p=>p.z-p.depth/2)),maxZ:Math.max(...lots.map(p=>p.z+p.depth/2))},
    shop:shop?{id:shop.id,x:shop.x,z:shop.z,width:shop.width,depth:shop.depth,doorOffset:shop.doorOffset,
      door:{x:shop.x+shop.doorOffset,z:shop.z+shop.depth/2,width:4}}:null,
    house:house?{id:house.id,x:house.x,z:house.z,width:house.width,depth:house.depth,yaw:house.yaw,doorOffset:house.doorOffset,door:housePortal(house.depth/2),rearDoor:housePortal(-house.depth/2),route:{frontApproach:[194,62],living:[194,69],kitchen:[194,75],rearApproach:[194,83]}}:null,
    bounds:{minX:152,maxX:224,minZ:8,maxZ:104},
    inspection:{x:202,z:55,yaw:Math.PI},
  };
}

// Conservative world AABB of a yawed local rectangle. Scenery and furnishings
// consume the same authoritative rectangle as their visual model.
export function blackwaterObstacle(p,id=p.id) {
  const halfX=(Math.abs(Math.cos(p.yaw||0))*p.width+Math.abs(Math.sin(p.yaw||0))*p.depth)/2;
  const halfZ=(Math.abs(Math.sin(p.yaw||0))*p.width+Math.abs(Math.cos(p.yaw||0))*p.depth)/2;
  return {id,minX:(p.x-halfX)/4,maxX:(p.x+halfX)/4,minY:(p.z-halfZ)/4,maxY:(p.z+halfZ)/4};
}

export function openBlackwaterShop(course,shop) {
  if(!shop)return;
  const {w,h,cells}=course;
  const minX=(shop.x-shop.width/2)/4,maxX=(shop.x+shop.width/2)/4;
  const minY=(shop.z-shop.depth/2)/4,maxY=(shop.z+shop.depth/2)/4;
  // Clear the blocked cells first, then reconstruct all reciprocal edges.
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++)cells[y*w+x]=[0,0,0,0];
  const wall=(x,y,d,value)=>{
    cells[y*w+x][d]=value;
    const nx=x+[0,1,0,-1][d],ny=y+[-1,0,1,0][d];
    if(nx>=0&&ny>=0&&nx<w&&ny<h)cells[ny*w+nx][(d+2)%4]=value;
  };
  const doors=[shop.door,shop.rearDoor].filter(Boolean);
  const isDoor=(x,z)=>doors.some(door=>Math.abs(door.z-z)<.01&&x===Math.floor((door.x-door.width/2)/4));
  for(let y=minY;y<maxY;y++){wall(minX,y,3,1);wall(maxX-1,y,1,1);}
  for(let x=minX;x<maxX;x++){wall(x,minY,0,isDoor(x,minY*4)?0:1);wall(x,maxY-1,2,isDoor(x,maxY*4)?0:1);}
  course.blocks=course.blocks.filter(([x,y])=>x<minX||x>=maxX||y<minY||y>=maxY);
}

export function openBlackwaterHouse(course,house){openBlackwaterShop(course,house);}
