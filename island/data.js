import {interiorPlan} from './interior-plan.js';
import {houseShell} from './house-shell.js';
import {reservedPlace} from './places.js';
import {settlementReserved,settlementColliders,YARDS} from './settlement-plan.js';
import {createAccessPaths,accessReserved} from './access-plan.js';
import {orchardReserved,orchardTrees} from './land-use.js';
import {cityIdentity} from './city-identity.js';
import {cityForecourtPlan,cityStreetTreePlan} from './city-forecourts.js';
import {CIVIC_CAMP,civicSurface,civicCraftPlan} from './civic-craft.js';
import {routeCraftSolids} from './route-craft.js';
import {domesticExteriorPlan} from './domestic-exteriors.js';
// Blackwater: one deterministic world description shared by art, physics and map.
export const SEED = 641979;
export const SAVE_KEY = 'last-dead-blackwater-64-v1';
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function random(seed = SEED) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const ROADS = [
  {name:'Coast Road', width:9, points:[[-790,300,8],[-690,265,14],[-570,240,19],[-440,180,22],[-340,135,21],[-260,65,18],[-165,0,16],[70,0,16]]},
  {name:'Cape Road', width:6, points:[[-440,180,22],[-460,65,25],[-470,-35,31],[-570,-140,46],[-690,-210,47],[-812,-244,36]]},
  {name:'Signal Hill', width:5, points:[[-470,-35,31],[-370,-120,49],[-350,-220,65],[-420,-280,73]]},
  {name:'Western Trail', width:4, points:[[-790,300,8],[-875,190,15],[-910,40,19],[-860,-100,29],[-830,-242,36],[-812,-244,36]]},
  {name:'Orchard Lane', width:4, points:[[-570,240,19],[-630,130,22],[-710,60,25],[-790,30,24]]},
];
export function roadAt(x,z) {
  let best = {distance:1e6, y:0, width:0};
  for (const road of ROADS) for(let i=1;i<road.points.length;i++) {
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    const d=Math.hypot(x-lerp(a[0],b[0],t),z-lerp(a[1],b[1],t));
    if(d<best.distance) best={distance:d,y:lerp(a[2],b[2],t),width:road.width};
  }
  return best;
}
export function islandDistance(x,z) {
  const a=Math.atan2((z-10)/510,(x+490)/620);
  return Math.hypot((x+490)/620,(z-10)/510)+(Math.sin(a*5+.5)*.027+Math.sin(a*9)*.018);
}
export function baseHeight(x,z) {
  const d=islandDistance(x,z), island=1-smooth(.77,1.07,d);
  const hill=(cx,cz,w,h)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(w*w));
  const relief=hill(-470,-265,190,68)+hill(-755,-150,150,37)+hill(-780,60,150,22);
  const noise=(Math.sin(x*.022)*Math.cos(z*.019)*2.6+Math.sin(x*.065+z*.041)*1.1);
  let y=-7+island*(22+relief+noise);
  const city=1-smooth(0,90,Math.max(355-x,x-1210,Math.abs(z)-500));
  y=Math.max(y,lerp(-7,14,city));
  if(x<110) {const r=roadAt(x,z); y=lerp(y,r.y,1-smooth(r.width*.5,r.width*.5+17,r.distance));}
  return y;
}
export const TERRAIN = {minX:-1400,maxX:1550,minZ:-1000,maxZ:1000,step:10};
// The city deck is drawn above terrain. Contact effects share its actual
// surface heights instead of disappearing below the asphalt or pavement.
export const CITY_GROUND={x:790,z:0,w:858,d:1000,roadY:14.05,walkY:14.16,originX:392,originZ:-456,spacing:76,blocksX:10,blocksZ:12,walkWidth:61};
export function effectFloorHeight(x,z,physicalHeight){
 const c=CITY_GROUND;let y=physicalHeight;
 const civic=civicSurface(x,z);if(civic!==null)y=Math.max(y,civic);
 if(Math.abs(x-c.x)<=c.w/2&&Math.abs(z-c.z)<=c.d/2){
  y=Math.max(y,c.roadY);const col=Math.floor((x-c.originX)/c.spacing),row=Math.floor((z-c.originZ)/c.spacing);
  if(col>=0&&col<c.blocksX&&row>=0&&row<c.blocksZ&&Math.abs(x-(c.originX+(col+.5)*c.spacing))<=c.walkWidth/2&&Math.abs(z-(c.originZ+(row+.5)*c.spacing))<=c.walkWidth/2)y=Math.max(y,c.walkY);
 }
 if(x>=70&&x<=370&&Math.abs(z)<11.5)y=Math.max(y,bridgeHeight(x)+(Math.abs(z)<8?.10:.07));
 if(x>=1174&&x<=1246&&Math.abs(z-300)<12&&Math.abs(x-(1174+Math.round((x-1174)/8)*8))<.075)y=Math.max(y,14.10);
 return y;
}
// Match the rendered triangle grid exactly, including shorelines.
export function terrainHeight(x,z) {
  const s=TERRAIN.step, x0=Math.floor((x-TERRAIN.minX)/s)*s+TERRAIN.minX,z0=Math.floor((z-TERRAIN.minZ)/s)*s+TERRAIN.minZ;
  const u=(x-x0)/s,v=(z-z0)/s,a=baseHeight(x0,z0),b=baseHeight(x0+s,z0),c=baseHeight(x0,z0+s),d=baseHeight(x0+s,z0+s);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function bridgeHeight(x) {return 16+Math.sin(clamp((x-70)/300,0,1)*Math.PI)*6;}
export const SIGNAL_STAIRS={x:-432,z:-286,run:24,width:3,rise:6,base:terrainHeight(-432,-286)};
export function groundHeight(x,z) {
  const civic=civicSurface(x,z);if(civic!==null)return civic;
  if(x>=68&&x<=372&&Math.abs(z)<12)return bridgeHeight(x);
  if(x>=1176&&x<=1204&&(Math.abs(z-170)<22.5||Math.abs(z-360)<22.5))return 14.7;
  const s=SIGNAL_STAIRS;if(x>=s.x&&x<=s.x+s.run&&Math.abs(z-s.z)<=s.width/2)return s.base+Math.ceil((x-s.x)/.8)*.2;
  if(x>=-408&&x<=-400&&z>=-290&&z<=-282)return s.base+s.rise;
  return terrainHeight(x,z);
}
export const KEEPER_FUSE={id:'keeper-fuse',x:-792,z:-279};
export const HOSPITAL_GENERATOR={id:'hospital-generator',x:1000,z:-300};
export function stationPosition(p){return p.id==='ridge'?{x:-404,z:-286}:p.id==='hospital'?{x:984,z:-315}:{x:p.x+10,z:p.z+5};}
export const PARKED_CARS=Array.from({length:32},(_,i)=>({x:465+(i%8)*76,z:-350+Math.floor(i/8)*210,angle:0}));
export const BRIDGE_WRECKS=[{x:-56,z:-3.7,angle:Math.PI/2},{x:-34,z:-4,angle:1.4},{x:106,z:-4.6,angle:1.65},{x:184,z:-5,angle:1.45},{x:253,z:4.8,angle:1.9},{x:283,z:-4.5,angle:1.5}];
export const LANDMARKS = [
  {id:'arrival',name:'Mariner’s Rest',short:'THE LANDING',x:-755,z:300,type:'camp',description:'A fire, a little shelter. Somewhere to start again.'},
  {id:'village',name:'Alder Village',short:'ALDER VILLAGE',x:-420,z:160,type:'village',description:'Shuttered shops beneath the pines.'},
  {id:'lighthouse',name:'Westlight',short:'WESTLIGHT',x:-820,z:-260,type:'relay',description:'Restore the coastal beacon.'},
  {id:'ridge',name:'Signal Hill',short:'SIGNAL HILL',x:-420,z:-280,type:'relay',description:'Bring the island transmitter online.'},
  {id:'orchard',name:'The Old Orchard',short:'OLD ORCHARD',x:-740,z:65,type:'ruin',description:'The trees outlived their keepers.'},
  {id:'bridge',name:'Saint Orin Bridge',short:'SAINT ORIN BRIDGE',x:210,z:0,type:'bridge',description:'Three hundred metres above the strait.'},
  {id:'oldtown',name:'Saint Orin',short:'OLD TOWN',x:500,z:80,type:'city',description:'The mainland is quieter than it should be.'},
  {id:'civic',name:'Civic Square',short:'CIVIC SQUARE',...CIVIC_CAMP,type:'camp',description:'A shelter in the heart of the city.'},
  {id:'hospital',name:'Northpoint Hospital',short:'NORTHPOINT',x:960,z:-320,type:'relay',description:'Restore the emergency broadcast.'},
  {id:'ferry',name:'The Last Ferry',short:'EAST DOCKS',x:1180,z:300,type:'exit',description:'Transmit the all-clear. Get off the island.'},
];
export const SPAWN={x:-748,z:284,yaw:1.27};
export const PALETTES={village:[0xdacfa7,0xc5c49e,0xb3bda5,0xd1ab91],oldtown:[0xc6b99c,0xba9e88,0xa2b7ad,0xc9c3a6],civic:[0xb2b8ac,0xd2cdb6,0x9bafa9],industrial:[0xa8ab96,0x8d9991,0xb39c7b],downtown:[0x829a99,0xacae9f,0xb7b29e,0x879ca4]};
// A serializable architectural plan. Tiers own their exposed faces; upper
// tiers only step inward, so hidden/shared walls never receive window modules.
export function buildingPlan(id,x,z,w,d,floors,district,seed) {
  const rng=random(seed), cottage=district==='village';
  const height=floors*3.4,tiers=[{y:0,w,d,h:height,floors}];
  if(floors>=8) {tiers[0].h=10.2;tiers[0].floors=3;tiers.push({y:10.2,w:w-4,d:d-4,h:height-10.2,floors:floors-3});}
  const b={id,x,z,w,d,floors,height,district,tiers,roof:cottage||district==='oldtown'&&seed%3!==0?'gable':district==='industrial'?'sawtooth':floors>=8?'crown':'flat',color:PALETTES[district][Math.floor(rng()*PALETTES[district].length)],accent:rng()>.5?0x536d68:0x985c49,enterable:cottage||id==='clinic'||(district==='oldtown'&&seed%3===0),seed};
  b.cityInterior=!b.enterable;b.enterable=true;
  b.interiorHeight=b.cityInterior&&district==='downtown'?6.8:3.4;
  if(b.cityInterior)b.accent=cityIdentity(b).colour;
  // The floor clears the complete triangulated footprint, including terrain
  // grid vertices inside it. Foundations extend down to the actual slope.
  const xs=[x-w/2,x+w/2],zs=[z-d/2,z+d/2];for(let v=Math.ceil(xs[0]/10)*10;v<xs[1];v+=10)xs.push(v);for(let v=Math.ceil(zs[0]/10)*10;v<zs[1];v+=10)zs.push(v);
  const heights=xs.flatMap(xx=>zs.map(zz=>terrainHeight(xx,zz)));
  // A linear triangle reaches its extrema at the clipped polygon's vertices.
  // Include intersections of cell diagonals with all four footprint edges.
  for(const xx of xs.slice(0,2))for(const zz of zs.slice(0,2))for(let k=-8;k<=8;k++){const diagonal=(Math.floor(xx/10)+Math.floor(zz/10)+k)*10;const zEdge=diagonal-xx,xEdge=diagonal-zz;if(zEdge>=z-d/2&&zEdge<=z+d/2)heights.push(terrainHeight(xx,zEdge));if(xEdge>=x-w/2&&xEdge<=x+w/2)heights.push(terrainHeight(xEdge,zz));}
  b.baseY=Math.max(...heights)+(cottage?.08:0);b.foundationBottom=Math.min(...heights)-.25;
  b.entry={x,z:z+d/2,length:cottage?12:2,width:3,steps:cottage?30:4};return b;
}
export function entranceHeight(b,x,z){const e=b.entry;if(!b.enterable||Math.abs(x-e.x)>e.width/2||z<e.z||z>e.z+e.length)return null;const t=Math.floor(clamp((z-e.z)/e.length,0,1)*e.steps)/e.steps;return Math.max(terrainHeight(x,z),lerp(b.baseY+.2,terrainHeight(e.x,e.z+e.length),t));}
export function createWorldData(seed=SEED) {
  const rng=random(seed),buildings=[],trees=[],rocks=[],supplies=[],enemies=[];
  const add=(x,z,w,d,f,district,id)=>buildings.push(buildingPlan(id||`building-${buildings.length}`,x,z,w,d,f,district,seed+buildings.length*97));
  for(let i=0;i<24;i++) {
    const x=-590+(i%8)*37,z=115+Math.floor(i/8)*52;
    const road=roadAt(x,z);if(road.distance<road.width*.5+13)continue;
    add(x,z,13+rng()*4,12+rng()*3,1+(rng()>.65?1:0),'village');
  }
  add(-752,318,15,13,1,'village','arrival-house');
  add(-795,-280,13,12,1,'village','lightkeeper');
  add(-736,78,17,13,1,'village','orchard-house');
  for(let col=0;col<10;col++)for(let row=0;row<12;row++) {
    const x=430+col*76,z=-418+row*76;
    // Continuous boulevards, central garden, hospital grounds and ferry yard.
    if((Math.abs(x-734)<65&&Math.abs(z)<90)||(Math.abs(x-962)<48&&Math.abs(z+320)<65)||(x>1100&&z>220))continue;
    const district=col<3?'oldtown':col>6&&row>6?'industrial':row<5?'downtown':'civic';
    for(let k=0;k<2;k++) {
      const bx=x+(k?17:-17),bz=z+(rng()-.5)*(district==='oldtown'?7:4);
      const floors=district==='downtown'?5+Math.floor(rng()*13):district==='industrial'?1+Math.floor(rng()*2):2+Math.floor(rng()*4);
      const w=district==='oldtown'?18+rng()*9:district==='industrial'?27:22+rng()*5;
      add(bx,bz,w,30+rng()*16,floors,district);
    }
  }
  add(970,-340,56,34,5,'civic','hospital-main');
  add(946,-300,26,18,1,'civic','clinic');
  const accessPaths=createAccessPaths(buildings,ROADS,terrainHeight,YARDS);
  for(let i=0;i<3000;i++) {
    const x=-1090+rng()*1190,z=-500+rng()*1010,y=terrainHeight(x,z),r=roadAt(x,z);
    if(reservedPlace(x,z,2))continue;
    if(y<6||islandDistance(x,z)>.94||r.distance<r.width*.5+8||Math.hypot(x-SPAWN.x,z-SPAWN.z)<14)continue;
    if(buildings.some(b=>Math.abs(b.x-x)<b.w*.5+6&&Math.abs(b.z-z)<b.d*.5+6))continue;
    if(LANDMARKS.some(p=>Math.hypot(p.x-x,p.z-z)<20)||x>-440&&x<-394&&z>-294&&z<-278)continue;
    if(rng()<.35&&x>-600&&z>60)continue;
    trees.push({x,z,y,scale:.7+rng()*1.1,kind:rng()>.24?'pine':'broad',rotation:rng()*6.28});
  }
  for(let i=0;i<260;i++){const x=-1100+rng()*1220,z=-520+rng()*1060,y=terrainHeight(x,z);if(y>0&&!reservedPlace(x,z,3)&&roadAt(x,z).distance>12)rocks.push({x,z,y,s:1+rng()*3,r:rng()*6.28});}
  const supplyAt=(x,z,type)=>supplies.push({id:`supply-${supplies.length}`,x,z,type});
  supplyAt(-742,282,'ammo');supplyAt(-756,311,'medkit');
  for(const b of buildings.filter(b=>b.enterable&&!b.cityInterior)){supplyAt(b.x-3,b.z+1,'ammo');if(rng()>.55)supplyAt(b.x+3,b.z-2,'medkit');}
  for(const p of LANDMARKS.filter(p=>p.type==='relay')){supplyAt(p.x+7,p.z+7,'ammo');supplyAt(p.x-6,p.z+9,'medkit');}
  for(let i=0;i<30;i++){const x=410+rng()*730,z=-430+rng()*840;if(buildings.every(b=>Math.abs(b.x-x)>b.w/2+2||Math.abs(b.z-z)>b.d/2+2))supplyAt(x,z,i%3?'ammo':'medkit');}
  const encounters=[[-810,-230],[-400,-253],[-459,120],[-718,48],[410,8],[585,8],[815,-277],[942,-287],[970,-289],[1095,260]];
  for(const [x,z] of encounters)for(let i=0;i<3;i++)enemies.push({id:`dead-${enemies.length}`,x:x>=355?392+Math.round((x-392)/76)*76:x+i*5,z:z+i*6,health:70,phase:rng()*6.28});
  const planted=orchardTrees(buildings,accessPaths,terrainHeight,accessReserved),urbanTrees=cityStreetTreePlan(buildings,groundHeight);
  const entryClear=(x,z,r)=>buildings.every(b=>!b.enterable||Math.abs(x-b.entry.x)>b.entry.width/2+r||z<b.entry.z-r||z>b.entry.z+b.entry.length+r);
  return {seed,buildings,accessPaths,trees:[...trees.filter(t=>!settlementReserved(t.x,t.z,3)&&!accessReserved(accessPaths,t.x,t.z,3)&&!orchardReserved(t.x,t.z)&&entryClear(t.x,t.z,2)),...planted,...urbanTrees],rocks:rocks.filter(r=>buildings.every(b=>Math.abs(r.x-b.x)>b.w/2+r.s+.5||Math.abs(r.z-b.z)>b.d/2+r.s+.5)&&!settlementReserved(r.x,r.z,r.s)&&!accessReserved(accessPaths,r.x,r.z,r.s)&&entryClear(r.x,r.z,r.s)),supplies,enemies,landmarks:LANDMARKS,wrecks:BRIDGE_WRECKS,parkedCars:PARKED_CARS};
}
export function regionAt(x,z) {
  if(x>68&&x<372&&Math.abs(z)<25)return 'Saint Orin Bridge';
  if(x>355)return z<-240?'Northpoint':x>1080&&z>180?'East Docks':Math.abs(x-740)<95&&Math.abs(z)<100?'Civic Square':x<650?'Saint Orin · Old Town':'Saint Orin · City';
  if(z<-180)return x<-620?'Westlight Cape':'Signal Hill';
  if(x<-660&&z<170)return 'The Old Orchard';
  return x<-630?'Mariner’s Rest':x>-260?'East Headland':'Alder Village';
}
export function createColliders(data) {
  const colliders=[];const box=(x,z,w,d,y,h,id)=>colliders.push({x,z,w,d,y,h,id});
  for(const b of data.buildings){const y=b.baseY;
    if(y-b.foundationBottom>.3)box(b.x,b.z,b.w,b.d,b.foundationBottom,y-b.foundationBottom-.12,b.id+'-foundation');
    if(!b.enterable)box(b.x,b.z,b.w,b.d,y,b.height,b.id);
    else {const h=b.interiorHeight||3.4;box(b.x,b.z,b.w-.4,b.d-.4,y+h-.16,.16,b.id+'-ceiling');for(let floor=0;floor<h/3.4;floor++)for(const w of houseShell({...b,upper:floor>0}).walls)box(b.x+w.x,b.z+w.z,w.w,w.d,y+w.y+floor*3.4,w.h,b.id);if(b.height>h)box(b.x,b.z,b.w,b.d,y+h,b.height-h,b.id);colliders.push(...interiorPlan(b).solids,...cityForecourtPlan(b,groundHeight).solids);}
  }
  for(const tree of data.trees)box(tree.x,tree.z,.7*tree.scale,.7*tree.scale,tree.y,9,'tree');
  for(let i=0;i<30;i++){const x=75+i*10;for(const z of [-11.4,11.4])box(x,z,10,.45,bridgeHeight(x),2,'bridge-rail');}
  box(-820,-260,7,7,terrainHeight(-820,-260),30,'lighthouse');
  for(const v of data.parkedCars)box(v.x,v.z,2.1,4.8,groundHeight(v.x,v.z),1.5,'parked-car');
  for(const w of data.wrecks)box(w.x,w.z,4.8,2.1,groundHeight(w.x,w.z),1.5,'abandoned-car');
  box(36,16,8,10,terrainHeight(36,16),4,'tollhouse');
  for(let x=-431.6;x<-408;x+=.8)for(const z of [-287.65,-284.35])box(x,z,.8,.15,groundHeight(x,-286),1.1,'stair-rail');
  for(const z of [-290,-282])box(-404,z,8,.15,SIGNAL_STAIRS.base+6,1.1,'platform-rail');
  box(-400,-286,.15,8,SIGNAL_STAIRS.base+6,1.1,'platform-rail');
  box(1000,-300,2.6,1.5,14,1.6,'generator');
  box(620,0,1.4,9.5,14,1.15,'evacuation-barrier');
  box(608,-6,10,2.7,14,2.5,'abandoned-coach');
  for(const z of [170,360]){for(const x of [1180,1200])for(const side of [-1,1])box(x,z+side*5,1,1,14.7,18,'crane-leg');for(let j=0;j<6;j++)box(1179+(j%3)*4,z-12+Math.floor(j/3)*7,3,5,14,2.8,'cargo');}
  for(const x of [-85,-60,-35,-10,30,385])for(const z of [-8.4,8.4])box(x,z,3.8,.7,groundHeight(x,z),.8,'road-barrier');
  return [...colliders,...settlementColliders(data,terrainHeight),...civicCraftPlan().solids,...routeCraftSolids(data),...domesticExteriorPlan(data,terrainHeight).solids];
}
export class SpatialGrid {
  constructor(items,cell=32){this.cell=cell;this.cells=new Map();for(const b of items){for(let x=Math.floor((b.x-b.w/2)/cell);x<=Math.floor((b.x+b.w/2)/cell);x++)for(let z=Math.floor((b.z-b.d/2)/cell);z<=Math.floor((b.z+b.d/2)/cell);z++){const key=`${x},${z}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(b);}}}
  query(x,z,r=1){const result=new Set();for(let cx=Math.floor((x-r)/this.cell);cx<=Math.floor((x+r)/this.cell);cx++)for(let cz=Math.floor((z-r)/this.cell);cz<=Math.floor((z+r)/this.cell);cz++)for(const b of this.cells.get(`${cx},${cz}`)||[])result.add(b);return result;}
  blocked(x,z,y,r=.42){
    // A boolean query can stop at the first overlap. Iterating occupied cells
    // directly avoids allocating/deduplicating a Set for every A* edge sample.
    for(let cx=Math.floor((x-r)/this.cell);cx<=Math.floor((x+r)/this.cell);cx++)for(let cz=Math.floor((z-r)/this.cell);cz<=Math.floor((z+r)/this.cell);cz++)for(const b of this.cells.get(`${cx},${cz}`)||[]){if(y+1.5<b.y||y>b.y+b.h)continue;const dx=Math.max(Math.abs(x-b.x)-b.w/2,0),dz=Math.max(Math.abs(z-b.z)-b.d/2,0);if(dx*dx+dz*dz<r*r)return true;}return false;
  }
}
