import {createBuildingPlan} from './assets/blackwater-kit/architecture.js';

export const MAX_COASTAL_SUPPLY_CASES = 24;
function clearApproach(course,p) {
  const radius=.16,x=Math.floor(p.x),y=Math.floor(p.y),cell=course.cells[y*course.w+x];
  if(!cell||cell.every(n=>n===1))return false;
  if(cell[0]&&p.y-y<radius||cell[1]&&x+1-p.x<radius||cell[2]&&y+1-p.y<radius||cell[3]&&p.x-x<radius)return false;
  return !course.obstacles.some(o=>Math.hypot(p.x-Math.max(o.minX,Math.min(o.maxX,p.x)),p.y-Math.max(o.minY,Math.min(o.maxY,p.y)))<radius);
}

// Furniture plans own loot support, access and the occlusion boxes. A case is
// placed at the front of a usable surface, away from its existing centre props.
export function attachCoastalScavenging(course) {
  const coast=course.coastal;
  if(!coast)return;
  const transform=(b,x,z)=>({x:(b.x+x*Math.cos(b.yaw||0)+z*Math.sin(b.yaw||0))/4,
    y:(b.z-x*Math.sin(b.yaw||0)+z*Math.cos(b.yaw||0))/4});
  coast.lootSpaces=[];
  let cases=0;const quotas=new Map();
  for(const b of coast.blackwaterSlice.buildings){
    if(!b.enterable)continue;
    const plan=createBuildingPlan(b);
    coast.lootSpaces.push({id:b.id,x:b.x,z:b.z,y:b.y||0,yaw:b.yaw||0,
      width:b.width,depth:b.depth,furniture:plan.furniture.map(f=>({id:f.id,position:f.position,size:f.collisionSize||f.size}))});
    const purpose=plan.purpose.id;
    const medical=['clinic','pharmacy'].includes(purpose);
    const cloth=['sewing-home','laundry','refuge-home'].includes(purpose);
    const tools=['hardware','workshop','warehouse','mechanic-home'].includes(purpose);
    // Named town interiors and four remote cottages form optional supply stops.
    const cottage=purpose==='cape-cottage'&&/\b(76|77|78|80)\b/.test(b.label);
    const quota=purpose==='cape-cottage'?4:['clinic','workshop','warehouse'].includes(purpose)?3:2;
    if(!(medical||cloth||tools||cottage)||cases>=MAX_COASTAL_SUPPLY_CASES||(quotas.get(purpose)||0)>=quota)continue;
    let surface,placement;
    for(const type of ['counter','sewing-table','desk','table']){
      for(const f of plan.furniture.filter(f=>f.type===type&&!f.lootSurface&&f.size[0]>=1.2&&f.size[2]>=.70)){
        const [fx,,fz]=f.position,[W,,D]=f.size;
        for(const side of [1,-1])for(const offset of [-W/2+.48,W/2-.48]){
          const approach=transform(b,fx+offset,fz+side*(D/2+.96));
          if(clearApproach(course,approach)){surface=f;placement={lx:fx+offset,lz:fz+side*(D/2-.26),approach};break;}
        }
        if(surface)break;
      }
      if(surface)break;
    }
    if(!surface)continue;
    const [fx,,fz]=surface.position,[W,H,D]=surface.size;
    const {lx,lz,approach}=placement,top=(b.y||0)+.08+H+(surface.type==='counter'?.05:0);
    const contents=medical?{cloth:1,antiseptic:2}:cloth?{cloth:3}:tools?{cloth:1,antiseptic:1}:{cloth:2,antiseptic:1};
    course.scavengerPickups.push({id:`${b.id}:supply-case`,roomId:b.id,supportId:surface.id,
      ...transform(b,lx,lz),floorZ:((b.y||0)+.08)/4,itemZ:(top+.12)/4,
      visualBaseY:top-.03,visualYaw:b.yaw||0,visualKind:'supply-case',requiresInteract:true,
      contents,label:medical?'First-aid supplies':cloth?'Clean cloth bundle':tools?'Workshop supplies':'Storm shelter supplies',
      discoveryLabel:b.label,story:medical?'The last shift left a sealed first-aid case.':cloth?'Clean cloth set aside before evacuation.':'Supplies saved for the next repair.',
      approach});
    cases++;quotas.set(purpose,(quotas.get(purpose)||0)+1);
  }
  // Keep the existing IDs/weapon count, but put both coast rifles on authored
  // interior furniture. Their map routes end at a walkable side of the table.
  for(const [id,label,types] of [
    ['coast-weapon-works','WAREHOUSE',['table','desk']],
    ['coast-weapon-lighthouse','CAPE LODGE 79',['desk','radio-desk','table']],
  ]){
    const item=course.weaponPickups.find(p=>p.id===id);
    const b=coast.blackwaterSlice.buildings.find(b=>b.enterable&&b.label.includes(label));
    if(!item||!b)continue;
    const plan=createBuildingPlan(b),f=plan.furniture.find(f=>f.lootSurface);
    if(!f)continue;
    const [lx,,fz]=f.position,[W,H,D]=f.size,lz=fz,top=(b.y||0)+.08+H;
    Object.assign(item,{...transform(b,lx,lz),roomId:b.id,supportId:f.id,
      floorZ:((b.y||0)+.08)/4,itemZ:(top+.12)/4,visualBaseY:top,
      visualYaw:b.yaw||0,displayKind:'stowed',requiresInteract:true,
      label:`${item.weaponIndex===4?'Carrion rifle':'Mourning rifle'} / ${b.label}`,
      // The cape front porch has a real window and rail outside this desk.
      // Approach from the open passage beside it, clear of the desk chair.
      approach:id==='coast-weapon-lighthouse'?transform(b,lx+W/2+.74,fz-1.28):transform(b,lx,fz+D/2+.96)});
    coast.landmarks.push({id:`find-${item.id}`,name:item.label,...item.approach});
  }
  for(const label of ['7 SALTWIND LANE','WORKSHOP']){
    const s=coast.workbenches.find(s=>s.name.includes(label));
    if(s)coast.landmarks.push({id:`bench-${s.id}`,name:`${s.name} / repair bench`,...s.approach});
  }
  const medical=course.scavengerPickups.find(p=>p.visualKind==='supply-case'&&p.contents.antiseptic===2);
  if(medical)coast.landmarks.push({id:'medical-supplies',name:'First-aid supplies',...medical.approach});
}

// Segment against conservative furniture volumes in the owning local frame.
// Eye-height rays can pass over a table to its case; cupboards and partitions
// still block them. The existing cell/structure tests retain wall authority.
export function coastalLootBlocked(course,from,to) {
  for(const b of course.coastal?.lootSpaces||[]){
    const c=Math.cos(b.yaw),s=Math.sin(b.yaw);
    const local=p=>[(p.x*4-b.x)*c-(p.y*4-b.z)*s,p.z*4-b.y,(p.x*4-b.x)*s+(p.y*4-b.z)*c];
    const a=local(from),end=local(to);
    if(Math.min(a[0],end[0])>b.width/2||Math.max(a[0],end[0])<-b.width/2
      ||Math.min(a[2],end[2])>b.depth/2||Math.max(a[2],end[2])<-b.depth/2)continue;
    for(const f of b.furniture){
      let lo=0,hi=1;
      for(let axis=0;axis<3;axis++){
        const d=end[axis]-a[axis],min=f.position[axis]-f.size[axis]/2,max=f.position[axis]+f.size[axis]/2;
        if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max){hi=-1;break;}}
        else{const p=(min-a[axis])/d,q=(max-a[axis])/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}
      }
      if(lo<=hi&&hi>1e-5&&lo<1-1e-5)return true;
    }
  }
  return false;
}
