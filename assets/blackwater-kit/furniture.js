// One serializable placement record owns each furnishing's mesh and conservative
// movement/bullet footprint. Contents stay on their supporting furniture.
import {authorCottageFurnishings,compileAuthoredCottage} from './cottage-authored.js';
const COMMERCIAL = [
 ['MARKET','market','ration shelves and weighing counter'],
 ['CAFE','cafe','interrupted meals and service kitchen'],
 ['EVACUATION','evacuation-office','registration desks and waiting benches'],
 ['HARDWARE','hardware','repair benches and tool storage'],
 ['LAUNDRY','laundry','front-loading machines and folding station'],
 ['GROCER','grocer','produce bins and cold storage'],
 ['PIER','dock-office','harbor dispatch and chart desks'],
];
const HOMES = {
 '14 MAIN STREET':['fisher-home','fishing charts and an interrupted breakfast','desk'],
 '16 MAIN STREET':['radio-home','radio repair station and family living space','radio-desk'],
 '20 MAIN STREET':['refuge-home','a temporary sickroom and remaining supplies','cot'],
 '9 SALTWIND LANE':['artist-home','drawing station and unfinished canvas','easel'],
 '7 SALTWIND LANE':['mechanic-home','home repair bench and salvaged parts','workbench'],
 '5 SALTWIND LANE':['sewing-home','sewing table and abandoned household','sewing-table'],
 '3 SALTWIND LANE':['packed-home','packed wardrobe and last meal','wardrobe'],
};

export function interiorPurpose(s){
 if(s.kind==='house')return /18 MAIN STREET/.test(s.label)?{id:'family-home',story:'family evacuation interrupted'}:/CAPE LODGE/.test(s.label)?{id:'cape-cottage',story:'storm retreat abandoned during evacuation'}:{id:(HOMES[s.label]||HOMES['14 MAIN STREET'])[0],story:(HOMES[s.label]||HOMES['14 MAIN STREET'])[1]};
 if(/PHARMACY/i.test(s.label))return{id:'pharmacy',story:'emergency dispensing interrupted'};
 if(/CLINIC|MEDICAL/i.test(s.label))return{id:'clinic',story:'triage cots and a deserted intake station'};
 if(/APARTMENTS/i.test(s.label))return{id:'apartment',story:'ground-floor lobby and caretaker accommodation'};
 if(/WAREHOUSE/i.test(s.label))return{id:'warehouse',story:'unfinished loading and emergency stores'};
 if(/WORKSHOP/i.test(s.label))return{id:'workshop',story:'repair stations and interrupted fabrication'};
 const record=COMMERCIAL.find(([key])=>s.label.includes(key))||COMMERCIAL[0];
 return{id:record[1],story:record[2]};
}

export function createDistrictFurniturePlan(s,ceiling){
 if(!s.enterable)return[];
 const purpose=interiorPurpose(s),half=s.width/2,front=s.depth/2-(s.kind==='house'?2.6:2),rear=-s.depth/2+1.7;
 // 4 m door band plus .75 m approach shoulder keeps the existing player
 // capsule clear. Even the narrow 12 m lots retain usable side rooms.
 const left=[-half+.65,s.doorOffset-2-.75],right=[s.doorOffset+2+.75,half-.65];
 const zones=[left,right].map(([a,b])=>({x:(a+b)/2,width:b-a}));
 const [L,R]=zones,out=[];
 const add=(id,type,zone,z,width,depth,height=1,detail='')=>{
  const actualWidth=Math.min(width,zone.width-.16);
  out.push({id,type,purpose:purpose.id,detail,position:[zone.x,.07+height/2,z],size:[actualWidth,height,depth],collisionSize:[actualWidth+.12,height,depth+.16]});
 };
 const divide=()=>{
  for(const [i,zone]of zones.entries())out.push({id:`room-partition-${i}`,type:'partition',purpose:purpose.id,position:[zone.x,ceiling/2,0],size:[zone.width-.24,ceiling-.04,.16],collisionSize:[zone.width-.24,ceiling-.04,.16]});
 };
 if(s.kind==='house'||purpose.id==='apartment'){
  const residentVariant=(Number(s.label.match(/\d+/)?.[0])||0)%3;
  const specialty=HOMES[s.label]?.[2]||['desk','radio-desk','workbench'][residentVariant];
  divide();
  add('living-sofa','sofa',R,front-.75,2.35,1.12,.98);
  add('living-coffee-table','table',R,front-2.55,1.55,.70,.55,'family-meal');
  add('resident-work-station',specialty,L,front-.65,2.12,specialty==='cot'?1.75:1.02,specialty==='wardrobe'?1.95:specialty==='easel'?1.72:.88,'resident-story');
  if(specialty!=='cot'&&specialty!=='wardrobe'&&specialty!=='easel')add('work-station-chair','chair',L,front-2.1,.62,.62,.96);
  add('bedroom-bed','bed',L,rear+1.25,1.90,2.15,.64,'packed-bedroom');
  add('bedroom-dresser','cabinet',L,-1.25,2.0,.56,1.0,'packed-bags');
  add('kitchen-worktop','kitchen',R,rear,2.42,.82,1.05);
  add('kitchen-fridge','fridge',R,rear+1.8,.87,.86,1.84);
  add('kitchen-breakfast-table','table',R,-1.45,1.30,.82,.82,'family-meal');
  if(s.depth>=16)add('kitchen-breakfast-chair','chair',R,-2.55,.61,.61,.94);
  return reserveWeaponSurface(authorCottageFurnishings(out,s),s);
 }
 if(purpose.id==='clinic'){
  add('triage-cot-front','cot',L,front-1,1.05,2.15,.78);
  add('triage-cot-rear','cot',L,rear+1.45,1.05,2.15,.78);
  add('clinic-intake-desk','desk',R,front-1,2.55,1.05,.90,'registration');
  add('clinic-intake-chair','chair',R,front+.14,.66,.66,.97);
  add('medicine-cabinet','cabinet',R,rear+1,Math.min(R.width-.16,3.0),.65,2.08,'medical-stock');
  add('clinic-wash-station','kitchen',R,-.85,2.45,.83,1.05);
 }else if(purpose.id==='warehouse'){
  add('loading-desk','desk',R,front-1,2.60,1.05,.92,'dispatch-log');
  add('loading-pallet-front','pallet',L,front-1,Math.min(L.width-.16,4.15),1.72,1.25,'ration-stock');
  add('warehouse-left-rack','shelf',L,rear+1,Math.min(L.width-.16,5.50),1.0,2.60,'warehouse-stock');
  add('warehouse-right-rack','shelf',R,rear+1,Math.min(R.width-.16,5.50),1.0,2.60,'warehouse-stock');
  add('warehouse-packing-table','table',R,-.25,3.2,1.0,.88,'packing-stock');
  add('loading-pallet-middle','pallet',L,-.25,Math.min(L.width-.16,3.50),1.50,.95,'packing-stock');
 }else if(purpose.id==='workshop'){
  add('workshop-front-bench','workbench',L,front-1,Math.min(L.width-.16,3.3),1.20,1.03,'hand-tools');
  add('workshop-rear-bench','workbench',R,rear+1,Math.min(R.width-.16,3.3),1.20,1.03,'hand-tools');
  add('workshop-parts-rack','shelf',L,rear+1,Math.min(L.width-.16,4.2),.80,2.30,'machine-parts');
  add('workshop-dispatch-desk','desk',R,front-1,2.55,1.03,.91,'repair-log');
  add('workshop-tool-cabinet','cabinet',R,-.35,2.50,.62,1.90,'hardware-stock');
 }else if(purpose.id==='cafe'){
  for(const [i,z]of [front,rear+1.6].entries()){
   add(`cafe-table-${i}`,'table',L,z,1.35,.90,.82,'cafe-meal');
   for(const [j,dz]of [[0,-.93],[1,.93]])add(`cafe-chair-${i}-${j}`,'chair',L,z+dz,.60,.61,.94);
  }
  add('service-counter','counter',R,front-1,2.35,1.00,1.13,'coffee-service');
  add('cafe-kitchen','kitchen',R,rear,2.40,.88,1.05);
  add('cafe-fridge','fridge',R,rear+1.8,.88,.87,1.84);
 }else if(purpose.id==='laundry'){
  for(const [i,z]of [front,rear+1,rear+3.0].entries())add(`washer-${i}`,'washer',L,z,1.06,.92,1.22);
  add('folding-table','table',R,front-1,2.35,1.10,.90,'folded-laundry');
  add('laundry-storage','shelf',R,rear+1.4,2.30,.58,2.20,'detergent');
  add('waiting-bench','bench',R,-.7,2.15,.57,.90);
 }else if(purpose.id==='evacuation-office'||purpose.id==='dock-office'){
  add('registration-desk','desk',R,front-1,2.30,1.0,.88,purpose.id==='dock-office'?'harbor-chart':'registration');
  add('registration-chair','chair',R,front+.13,.63,.63,.94);
  add('rear-clerk-desk','desk',R,rear+1.2,2.25,1.0,.88,'radio-dispatch');
  add('records-cabinet','cabinet',L,rear,2.30,.60,1.92,'files');
  add('waiting-bench-front','bench',L,front,2.20,.62,.98);
  add('waiting-bench-rear','bench',L,-1.3,2.20,.62,.98);
 }else if(purpose.id==='hardware'){
  add('tool-sales-counter','counter',R,front-1,2.35,1.08,1.10,'hardware-sales');
  add('repair-bench','workbench',L,front-1,2.38,1.0,.99,'hand-tools');
  add('tool-wall-rack','shelf',L,rear+1,2.38,.70,2.18,'hardware-stock');
  add('hardware-stock-rack','shelf',R,rear+1,2.35,.70,2.18,'hardware-stock');
 }else{
  add('checkout-counter','counter',R,front-1,2.30,1.00,1.13,'checkout');
  add('front-display','display',L,front-.6,2.28,1.0,1.10,purpose.id==='grocer'?'produce':'ration-stock');
  add('rear-left-shelf','shelf',L,rear+1.3,2.35,.70,2.18,'ration-stock');
  add('rear-right-shelf','shelf',R,rear+1.3,2.35,.70,2.18,'ration-stock');
  if(purpose.id==='grocer')add('cold-storage','fridge',R,-.6,.94,.92,1.94);
  else add('packing-table','table',L,-.9,2.25,.90,.82,'ration-stock');
 }
 return reserveWeaponSurface(out,s);
}

function reserveWeaponSurface(furniture,s){
 const id=s.label==='EAST WORKS 46 / WAREHOUSE'?'warehouse-packing-table':s.label==='CAPE LODGE 79'?'resident-work-station':null;
 if(id){const surface=furniture.find(f=>f.id===id);if(surface)surface.lootSurface=true;}
 return furniture;
}

export function compileDistrictHouseFloors(w,plan,{bodyZ,bodyDepth}){
 const width=plan.settings.width-.5,minZ=bodyZ-(bodyDepth-.25)/2,maxZ=bodyZ+(bodyDepth-.25)/2;
 w.box('interiorWood',[0,.035,maxZ/2],[width,.07,maxZ],[0,0,0],'walkable-living-wood-floor');
 w.box('interiorTile',[0,.035,minZ/2],[width,.07,-minZ],[0,0,0],'walkable-kitchen-linoleum-floor');
 const sofa=plan.furniture.find(p=>p.type==='sofa');
 if(sofa)w.box('rug',[sofa.position[0],.072,sofa.position[2]-.55],[sofa.size[0]+.15,.004,2.2],[0,0,0],'resident-living-rug');
 compileAuthoredCottage(w,plan,{finishes:true});
}

export function compileDistrictFurniture(writer,plan){
 const floor=.08;
 // Warm furniture belongs to the interior; weathered exterior timber stays
 // in the original wood material role.
 const w={};
 for(const method of ['box','bevelBox','cylinder'])w[method]=(slot,...args)=>writer[method](slot==='wood'?'furnitureWood':slot,...args);
 for(const item of plan.furniture){
  if(item.authoredOverride)continue;
  const [x,,z]=item.position,[W,H,D]=item.size,top=floor+H;
  const box=(slot,dx,y,dz,size,role)=>w.box(slot,[x+dx,y,z+dz],size,[0,0,0],role||`${item.type}-construction`);
  const soft=(slot,dx,y,dz,size,role)=>w.bevelBox(slot,[x+dx,y,z+dz],size,.035,[0,0,0],role||`${item.type}-rounded-surface`);
  const cyl=(slot,a,b,r,role)=>w.cylinder(slot,[x+a[0],a[1],z+a[2]],[x+b[0],b[1],z+b[2]],r,role);
  const legs=(endY=top-.10)=>{for(const a of [-1,1])for(const b of [-1,1])cyl('wood',[a*(W/2-.10),floor,b*(D/2-.10)],[a*(W/2-.10),endY,b*(D/2-.10)],.032,`${item.type}-leg`);};
  const pulls=(y,dz,count=2)=>{for(let i=0;i<count;i++){const dx=-W*.25+i*W*.5;cyl('metal',[dx-.09,y,dz],[dx+.09,y,dz],.016,'furniture-metal-pull');}};
  const papers=(y)=>{for(let i=0;i<3;i++)box(i===2?'rust':'pale',W*.14+i*.12,y+i*.002,0,[.30,.009,.24],'abandoned-paperwork');};
  const stock=(y,detail=item.detail)=>{
   for(let i=0;i<4;i++){
    const dx=(i-1.5)*Math.min(.39,W/4.4),height=.16+(i%3)*.075;
    box(i%2?'pale':'rust',dx,y+height/2,0,[.23,height,.24],`${detail||'household'}-contents`);
    box('dark',dx,y+height*.55,.125,[.14,.035,.009],'stock-label');
   }
  };
  if(item.type==='partition'){
   box('pale',0,item.position[1],0,item.size,'interior-room-partition');
   for(const sign of [-1,1])box('wood',0,.19,sign*.09,[W,.19,.04],'interior-partition-skirting');
  }else if(['table','desk','radio-desk','sewing-table','workbench'].includes(item.type)){
   soft('wood',0,top-.045,0,[W,.09,D],`${item.type}-beveled-top`);legs();
   for(const side of [-1,1])box('wood',0,top-.18,side*(D/2-.1),[W-.16,.16,.05],'table-apron');
   if(item.type==='desk'||item.type==='radio-desk'){
    box('wood',-W*.32,top-.35,0,[W*.24,.49,D-.08],'desk-drawer-pedestal');
    for(let i=0;i<3;i++){box('pale',-W*.32,top-.22-i*.14,D/2-.015,[W*.22,.12,.03],'desk-drawer-front');cyl('metal',[-W*.32-.07,top-.22-i*.14,D/2+.015],[-W*.32+.07,top-.22-i*.14,D/2+.015],.011,'desk-drawer-pull');}
    if(!item.authoredRadio&&!item.lootSurface)papers(top+.005);
   }
   if(!item.authoredRadio&&!item.lootSurface&&(item.type==='radio-desk'||item.detail==='radio-dispatch')){
    soft('metal',0,top+.14,-D*.17,[.61,.26,.25],'dispatch-radio-body');
    for(let i=0;i<5;i++)box('dark',-.17+i*.045,top+.14,-D*.17+.13,[.012,.14,.012],'radio-speaker-slot');
    cyl('metal',[.24,top+.25,-D*.17],[.24,top+.66,-D*.17],.009,'radio-aerial');
   }
   if(item.type==='sewing-table'){
    soft('metal',0,top+.06,0,[.59,.12,.31],'sewing-machine-foot');
    soft('metal',-.20,top+.24,0,[.15,.36,.22],'sewing-machine-column');
    soft('metal',.01,top+.39,0,[.54,.14,.22],'sewing-machine-arm');
    cyl('metal',[.20,top+.33,0],[.20,top+.12,0],.013,'sewing-needle');
    box('fabric',W*.22,top+.01,.05,[.45,.015,.49],'unfinished-sewing');
   }
   if(item.type==='workbench'){
    // All additions stay inside the existing table footprint and material slots.
    box('wood',0,top+.30,-D/2+.06,[W-.10,.62,.055],'bench-tool-board');
    for(let row=0;row<3;row++)for(let col=0;col<8;col++)box('dark',-W*.38+col*W*.108,top+.16+row*.14,-D/2+.091,[.018,.018,.009],'pegboard-hole');
    box('metal',0,.28,0,[W-.18,.065,D-.20],'bench-lower-shelf');
    for(const side of [-1,1])box('metal',side*(W/2-.09),.55,0,[.065,.075,D-.12],'bench-frame-crossbar');
    box('wood',-W*.25,top-.20,.02,[W*.40,.25,D-.22],'bench-drawer');
    cyl('metal',[-W*.25-.10,top-.20,D/2-.10],[-W*.25+.10,top-.20,D/2-.10],.015,'bench-drawer-pull');
    const vx=W*.28;
    soft('metal',vx,top+.09,.03,[.36,.17,.29],'vise-cast-base');
    for(const sign of [-1,1]){box('metal',vx+sign*.105,top+.205,.03,[.065,.115,.26],'vise-jaw');box('dark',vx+sign*.067,top+.235,.03,[.013,.04,.23],'vise-jaw-pad');}
    cyl('metal',[vx-.25,top+.11,.04],[vx+.25,top+.11,.04],.018,'vise-threaded-screw');
    cyl('metal',[vx+.255,top-.04,.04],[vx+.255,top+.25,.04],.012,'vise-sliding-handle');
    // A hammer, a pipe wrench and an open spanner read as distinct silhouettes.
    for(let i=0;i<3;i++){
     const tx=-W*.30+i*.23,ty=top+.30,tz=-D/2+.12;
     cyl(i===0?'wood':'metal',[tx,ty-.16,tz],[tx,ty+.13,tz],i===1?.023:.018,'hanging-tool-handle');
     if(i===0)soft('metal',tx,ty+.13,tz,[.18,.07,.06],'hanging-hammer-head');
     else {box('metal',tx-.043,ty+.145,tz,[.033,.10,.046],'wrench-left-jaw');box('metal',tx+.043,ty+.145,tz,[.033,.10,.046],'wrench-right-jaw');box('metal',tx,ty+.10,tz,[.09,.04,.046],'wrench-jaw-bridge');}
     cyl('metal',[tx,ty-.03,tz-.02],[tx,ty-.03,tz-.04],.011,'tool-hook');
    }
    box('metal',-W*.29,top+.035,.09,[.36,.06,.24],'sorted-fittings-tray');
    for(let i=0;i<4;i++)cyl('metal',[-W*.39+i*.06,top+.074,.02],[-W*.39+i*.06,top+.074,.15],.015,'salvaged-fitting-bolt');
    box('pale',.02,top+.006,.12,[.22,.012,.30],'bench-repair-card');
    for(let i=0;i<3;i++)box('dark',.02,top+.013,.04+i*.055,[.16,.001,.012],'repair-card-line');
    for(const sign of [-1,1]){box('wood',sign*W*.28,.38,-.02,[W*.30,.18,D*.52],'bench-parts-box');for(let i=0;i<3;i++)box('metal',sign*W*.28-.07+i*.07,.49,0,[.045,.075,.12],'stored-metal-fittings');}
   }
   if(/meal/.test(item.detail)){
    for(const sign of [-1,1]){cyl('pale',[sign*W*.25,top+.008,0],[sign*W*.25,top+.025,0],.14,'abandoned-meal-plate');cyl('pale',[sign*W*.25,top+.025,-D*.27],[sign*W*.25,top+.16,-D*.27],.048,'meal-cup');}
    papers(top+.009);
   }else if(item.type==='table'&&!item.lootSurface)stock(top+.01);
  }else if(item.type==='chair'||item.type==='bench'){
   const seat=floor+.46;soft('wood',0,seat,0,[W,.07,D],`${item.type}-seat`);legs(seat-.045);
   for(const sign of [-1,1])cyl('wood',[sign*(W/2-.07),seat-.06,-D/2+.04],[sign*(W/2-.07),top,-D/2+.04],.027,`${item.type}-back-post`);
   soft(item.type==='bench'?'fabric':'wood',0,top-.18,-D/2+.04,[W-.08,.30,.067],`${item.type}-backrest`);
  }else if(item.type==='sofa'){
   box('wood',0,.23,0,[W-.07,.20,D-.09],'sofa-visible-frame');
   soft('fabric',0,.44,0,[W,.24,D-.08],'sofa-seat-base');
   for(const sign of [-1,1]){soft('fabric',sign*(W/2-.12),.65,0,[.23,.62,D],'sofa-arm');for(const end of [-1,1])cyl('wood',[sign*(W/2-.16),floor,end*(D/2-.12)],[sign*(W/2-.16),.28,end*(D/2-.12)],.042,'sofa-leg');}
   for(const sign of [-1,1]){soft('fabric',sign*(W-.54)/4,.59,.03,[(W-.55)/2,.16,D-.29],'sofa-seat-cushion');soft('fabric',sign*(W-.54)/4,.81,-D/2+.13,[(W-.53)/2,.37,.23],'sofa-back-cushion');}
  }else if(item.type==='bed'||item.type==='cot'){
   legs(.35);box(item.type==='cot'?'metal':'wood',0,.30,0,[W,.14,D],`${item.type}-support-frame`);
   soft('fabric',0,.44,0,[W-.09,.22,D-.08],'bed-mattress');
   soft('pale',0,.57,-D*.30,[W*.73,.15,.43],'bed-pillow');
   box('fabric',0,.565,D*.12,[W-.10,.05,D*.61],'abandoned-bed-blanket');
   if(item.type==='bed')box('wood',0,.57,-D/2+.045,[W,.61,.09],'bed-headboard');
   else for(const sign of [-1,1])cyl('metal',[sign*(W/2-.04),.36,-D/2],[sign*(W/2-.04),.85,-D/2],.025,'medical-cot-end-post');
  }else if(item.type==='easel'){
   for(const sign of [-1,1])cyl('wood',[sign*W*.32,floor,D*.27],[sign*W*.17,top,-D*.10],.035,'artist-easel-leg');
   cyl('wood',[0,floor,-D*.35],[0,top*.89,-D*.10],.035,'easel-rear-leg');
   box('wood',0,.80,-.10,[W*.76,.09,.22],'canvas-rest');
   box('wood',0,1.14,-.10,[W*.72,.73,.06],'canvas-frame');
   box('pale',0,1.14,-.06,[W*.67,.67,.022],'unfinished-canvas');
   box('fabric',-W*.13,1.16,-.045,[W*.18,.42,.012],'canvas-painted-shape');
  }else if(item.type==='washer'||item.type==='fridge'){
   soft('pale',0,floor+H/2,0,item.size,`${item.type}-enamel-shell`);
   const face=D/2+.018;
   if(item.type==='washer'){
    for(const [slot,r,dz]of [['metal',W*.33,0],['dark',W*.28,.015],['glass',W*.23,.025]])cyl(slot,[0,.68,face+dz],[0,.68,face+dz+.022],r,'washer-layered-porthole');
    box('metal',0,top-.15,face,[W-.09,.13,.032],'washer-control-panel');
    cyl('dark',[W*.25,top-.15,face+.02],[W*.25,top-.15,face+.055],.04,'washer-control-dial');
   }else{
    box('dark',0,top*.70,face,[W-.04,.022,.025],'fridge-freezer-seal');
    for(const y of [.68,top-.34])cyl('metal',[-W*.31,y,face+.03],[-W*.31,y+.24,face+.03],.019,'fridge-handle');
    for(let i=0;i<4;i++)box('dark',0,.17+i*.025,face,[W*.79,.01,.02],'fridge-base-vent');
   }
  }else if(item.type==='kitchen'){
   box('wood',0,.57,0,[W,.92,D],'kitchen-base-carcass');soft('pale',0,1.03,0,[W+.03,.09,D+.03],'kitchen-worktop');
   for(const sign of [-1,1]){box('pale',sign*W*.25,.59,D/2+.019,[W*.46,.76,.032],'kitchen-door');cyl('metal',[sign*W*.25-.09,.88,D/2+.05],[sign*W*.25+.09,.88,D/2+.05],.014,'kitchen-pull');}
   const sink=-W*.25,stove=W*.24;
   box('metal',sink,1.084,0,[W*.39,.025,D*.73],'sink-rim');box('dark',sink,1.100,0,[W*.32,.014,D*.51],'sink-depth');
   cyl('metal',[sink,1.08,-D*.24],[sink,1.35,-D*.24],.020,'kitchen-tap');cyl('metal',[sink,1.35,-D*.24],[sink,1.35,-D*.05],.020,'tap-spout');
   box('metal',stove,1.084,0,[W*.40,.025,D*.72],'stove-hob');for(const a of [-1,1])for(const b of [-1,1])cyl('dark',[stove+a*W*.09,1.10,b*D*.17],[stove+a*W*.09,1.118,b*D*.17],.081,'stove-burner');
   box('dark',stove,.62,D/2+.044,[W*.32,.39,.025],'oven-window');cyl('metal',[stove-W*.15,.86,D/2+.07],[stove+W*.15,.86,D/2+.07],.015,'oven-handle');
  }else if(item.type==='pallet'){
   for(const dx of [-W*.38,0,W*.38])box('wood',dx,.18,0,[W*.13,.19,D],'loading-pallet-bearer');
   for(let i=0;i<5;i++)box('wood',0,.30,-D*.40+i*D*.20,[W,.065,D*.16],'pallet-deck-board');
   for(let layer=0;layer<2;layer++)for(const side of [-1,1]){
    const boxH=(H-.33)/2;box(side===-1?'pale':'wood',side*W*.23,.33+boxH*(layer+.5),0,[W*.42,boxH-.018,D*.72],'stacked-loading-case');
    box('dark',side*W*.23,.33+boxH*(layer+.5),D*.37,[W*.13,.045,.016],'case-hand-hole');
   }
   for(const dx of [-W*.31,W*.31])box('metal',dx,.33+(H-.33)/2,0,[.042,H-.33,D*.73],'cargo-retention-strap');
  }else if(item.type==='shelf'){
   for(const sign of [-1,1])box('metal',sign*(W/2-.035),floor+H/2,0,[.07,H,D],'stock-shelf-upright');
   box('wood',0,floor+H/2,-D/2+.025,[W,H,.05],'shelf-back');
   for(let j=0;j<4;j++){const y=floor+.14+j*(H-.29)/3;box('wood',0,y,0,[W,.058,D],'stock-shelf-board');if(j<3)stock(y+.032);}
  }else if(['cabinet','wardrobe','counter','display'].includes(item.type)){
   box('wood',0,floor+H/2,0,item.size,`${item.type}-carcass`);
   if(item.type==='display'){
    box('dark',0,top+.015,0,[W-.09,.022,D-.10],'display-bin-recess');
    for(const sign of [-1,1])box('wood',0,top+.10,sign*(D/2-.015),[W,.19,.04],'produce-bin-edge');stock(top+.027);
   }else{
    soft('pale',0,top+.015,0,[W+.035,.067,D+.035],`${item.type}-cap`);
    for(const sign of [-1,1])box('pale',sign*W*.25,floor+H*.53,D/2+.018,[W*.46,H*.84,.03],'cabinet-paneled-door');pulls(floor+H*.68,D/2+.05);
    if(item.type==='counter'){
     soft('metal',W*.24,top+.13,0,[.39,.22,.31],'checkout-register');box('dark',W*.24,top+.20,.166,[.25,.06,.017],'register-display');papers(top+.055);
     if(item.detail==='coffee-service')cyl('metal',[-W*.24,top+.06,0],[-W*.24,top+.37,0],.11,'coffee-service-urn');
    }else if(item.detail==='medical-stock'){
     box('rust',0,.98,D/2+.04,[.33,.34,.018],'medical-cabinet-mark');
     box('pale',0,.98,D/2+.052,[.22,.065,.018],'medical-cabinet-cross');box('pale',0,.98,D/2+.065,[.065,.22,.018],'medical-cabinet-cross');
     stock(top+.055,'remaining-medical-stock');
    }else if(item.detail==='files')for(let i=0;i<4;i++)box('dark',0,.32+i*.36,D/2+.038,[W-.14,.012,.015],'filing-drawer-seam');
    else if(item.detail==='packed-bags')stock(top+.055,'packed-luggage');
   }
  }
 }
 compileAuthoredCottage(writer,plan);
}
