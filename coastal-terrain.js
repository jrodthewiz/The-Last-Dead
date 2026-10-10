// Metres. This seeded field is shared by geometry, feet, projectiles and tree
// roots. The town stays level; the new northern/eastern cape is walkable land.
import {capeResidentialNaturalFields} from './coastal-residential-fields.js';
import {capeRootFootingFields} from './coastal-root-footing.js';
import {capeGroveCourtRelief} from './coastal-grove-court-fields.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const CAPE_TERRAIN=Object.freeze({minX:128,maxX:448,minZ:120,maxZ:416,grid:1,bridges:[222,340]});
export const CAPE_ROADS=Object.freeze([
  {x:192,z:56,width:384,depth:12},{x:192,z:112,width:384,depth:12},
  ...[176,232,304].map(z=>({x:256,z,width:256,depth:12})),
  ...[144,232,368].map(x=>({x,z:160,width:12,depth:320})),
].map(road=>Object.freeze(road)));
export function capeStreamZ(x){return 353+8*Math.sin((x-128)*Math.PI/156)+2.4*Math.sin((x-128)*.045);}
export function capeStreamLevel(x){return -.13+clamp(x-128,0,304)*.0009;}
export function capeStreamWidth(x){return 2.7+.45*Math.sin(x*.031+1);}
export const CAPE_WOODLAND_RIDGES=Object.freeze([
  Object.freeze([410,382,16,32,22]),Object.freeze([311,396,10,37,19]),
  Object.freeze([429,231,10,18,48]),Object.freeze([173,395,7,27,18]),
]);
export const CAPE_BEDROCK=Object.freeze([
  Object.freeze([327,384,1.5,5.2,2.8]),Object.freeze([351,390,1.8,5.8,3.1]),
  Object.freeze([399,393,2.3,7.3,3.2]),Object.freeze([424,374,1.7,4.8,3.1]),
  Object.freeze([429,255,1.7,4.2,6.2]),Object.freeze([171,384,1.3,5.3,3]),
]);
export function capeBedrockField(x,z){
  let relief=0,stone=0;
  for(const [cx,cz,h,rx,rz] of CAPE_BEDROCK){
    const u=x-cx+(z-cz)*.32,v=z-cz,d=(u/rx)**2+(v/rz)**2;
    const ridge=Math.max(0,1-d);relief+=h*ridge*ridge;stone=Math.max(stone,ridge);
  }
  return {relief,stone};
}
export function capeWoodlandRelief(x,z){
  const north=z>=309&&z<407?Math.min(Math.abs(x-222),Math.abs(x-340)):100;
  const east=x>374?Math.abs(z-(322+(x-374)*.33)):100;
  const corridor=smooth(3.5,14,Math.min(north,east));
  let ridge=0;
  for(const [cx,cz,h,rx,rz] of CAPE_WOODLAND_RIDGES){
    const u=x-cx+Math.sin(z*.043)*2.4,v=z-cz;
    ridge+=h*Math.exp(-((u/rx)**2+(v/rz)**2));
  }
  return (ridge+capeBedrockField(x,z).relief)*corridor;
}
export function capeNaturalHeight(x,z,{rootFooting=true,courtRelief=true,residentialRidge=true}={}){
  if(x>=384&&x<=448&&z>=0&&z<120){
    const field=capeResidentialNaturalFields(x,z,{residentialRidge});
    // Preserve the old inland height at z120 exactly. The last seven metres
    // approach that existing boundary rather than creating a terrain seam.
    return field.height+capeNaturalHeight(x,120)*smooth(113,120,z)*smooth(389,400,x);
  }
  if(x<128||x>448||z<120||z>416)return 0;
  const forest=Math.max(smooth(314,334,z),smooth(380,402,x));
  const court=courtRelief?capeGroveCourtRelief(x,z).height:0;
  if(forest===0)return court;
  let hills=0;
  for(const [cx,cz,h,rx,rz] of [[410,386,5.7,30,25],[326,398,3.8,31,19],[177,397,2.5,23,20],[419,238,2.4,23,37]])
    hills+=h*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
  const shore=smooth(0,7,Math.min(x-128,448-x,416-z));
  let height=forest*shore*(hills+capeWoodlandRelief(x,z)+.18*Math.sin(x*.11)*Math.sin(z*.09));
  if(x<=432&&z>325){
    const d=Math.abs(z-capeStreamZ(x)),width=capeStreamWidth(x),water=capeStreamLevel(x);
    if(d<=width)height=water-.72+.74*(d/width)**4;
    else if(d<width+5)height=(water+.02)*(1-smooth(width,width+5,d))+height*smooth(width,width+5,d);
  }
  return height+(rootFooting?capeRootFootingFields(x,z).height:0)+court;
}
// Piecewise linear interpolation is the exact pair of triangles in the mesh,
// rather than evaluating an unrelated smooth field underneath rendered feet.
// Only immutable default natural corners are retained. Bridge deck overrides
// remain live below the interpolation; option variants keep the direct field.
const CAPE_CORNER_WIDTH=321,CAPE_CORNER_COUNT=CAPE_CORNER_WIDTH*417;
let capeCornerHeights=null,capeCornerValid=null;
function cachedCapeNaturalCorner(x,z){
  if(capeCornerHeights===null){capeCornerHeights=new Float64Array(CAPE_CORNER_COUNT);capeCornerValid=new Uint8Array(CAPE_CORNER_COUNT);}
  const index=z*CAPE_CORNER_WIDTH+x-128;
  if(!capeCornerValid[index]){capeCornerHeights[index]=capeNaturalHeight(x,z);capeCornerValid[index]=1;}
  return capeCornerHeights[index];
}
export function capeGroundHeight(x,z,{bridges=true,rootFooting=true,courtRelief=true,residentialRidge=true}={}){
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;
  let a,b,c,d;
  if(rootFooting===true&&courtRelief===true&&residentialRidge===true&&ix>=128&&ix<448&&iz>=0&&iz<416){
    a=cachedCapeNaturalCorner(ix,iz);b=cachedCapeNaturalCorner(ix+1,iz);c=cachedCapeNaturalCorner(ix,iz+1);d=cachedCapeNaturalCorner(ix+1,iz+1);
  }else{
    const options={rootFooting,courtRelief,residentialRidge};
    a=capeNaturalHeight(ix,iz,options);b=capeNaturalHeight(ix+1,iz,options);c=capeNaturalHeight(ix,iz+1,options);d=capeNaturalHeight(ix+1,iz+1,options);
  }
  let h=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  if(bridges&&x>=128&&z>=325)for(const bx of CAPE_TERRAIN.bridges){
    if(Math.abs(x-bx)>2.15)continue;
    const dz=Math.abs(z-capeStreamZ(bx)),deck=capeStreamLevel(bx)+.65;
    if(dz<5.3)h=Math.max(h,deck);
    else if(dz<11)h=Math.max(h,deck*(1-smooth(5.3,11,dz))+h*smooth(5.3,11,dz));
  }
  return h;
}
export function groundAt(course,x,y){return course?.coastal?.terrain?capeGroundHeight(x*4,y*4)/4:0;}
export function capePathMask(x,z){
  const north=z>=309&&z<407?Math.min(Math.abs(x-222),Math.abs(x-340)):100;
  const east=x>374?Math.abs(z-(322+(x-374)*.33)):100;
  return 1-smooth(1.3,3.4,Math.min(north,east));
}
export function capeGroveField(x,z){
  // Three authored masses: western birch hollow, northern pine ridge and the
  // long eastern woodland. Wind-scoured gaps separate their canopy silhouettes.
  const groves=[[178,385,40,25],[309,387,52,27],[416,264,23,105],[410,385,28,23]];
  let strength=0,grove=0;
  for(const [i,[cx,cz,rx,rz]] of groves.entries()){
    const d=((x-cx)/rx)**2+((z-cz)/rz)**2;
    const field=1-smooth(.40,1.65,d);
    if(field>strength){strength=field;grove=i;}
  }
  return {strength,grove};
}

// Salt wind opens an irregular headland glade and a sheltered sight corridor
// back toward the woodland saddle. This is a real ecological opening, not a
// camera change; crowns stay on the ridge flanks instead of filling the hollow.
export function capeCoastalGladeClear(x,z){
  const oval=((x-412)/18)**2+((z-402)/15)**2;
  if(oval<1)return true;
  const t=Math.max(0,Math.min(1,((x-381)*31+(z-384)*18)/(31*31+18*18)));
  return Math.hypot(x-(381+t*31),z-(384+t*18))<8+3*t;
}
export function capeMeadowSpine(z){return 389+4*Math.sin((z-128)*.025)+1.7*Math.sin(z*.061);}
export const CAPE_RESIDENTIAL_MEADOW=Object.freeze([
  Object.freeze({x:412,z:20,rx:15,rz:12}),Object.freeze({x:424,z:45,rx:14,rz:10}),
  Object.freeze({x:407,z:76,rx:13,rz:12}),Object.freeze({x:429,z:101,rx:14,rz:10}),
]);
export function capeMeadowField(x,z){
  if(z<124){
    let field=0;
    for(const c of CAPE_RESIDENTIAL_MEADOW)field=Math.max(field,1-smooth(.12,1.3,((x-c.x)/c.rx)**2+((z-c.z)/c.rz)**2));
    return field;
  }
  if(z>341)return 0;
  // Coastal grass communities form broken elongated islands along the inward
  // shoulder of the eastern headland; gaps preserve the open meadow character.
  let field=0;
  for(const [i,cz] of [138,165,193,221,250,279,307,332].entries()){
    const cx=capeMeadowSpine(cz)+(i%2?2.2:-1.7),rx=7+(i%3)*1.4,rz=9.5+(i%2)*2;
    field=Math.max(field,1-smooth(.15,1.25,((x-cx)/rx)**2+((z-cz)/rz)**2));
  }
  return field*(1-capePathMask(x,z));
}
export function makeCapeForestPlacements(neighborhoods,buildings,roads){
  const placements=neighborhoods.props.filter(p=>p.kind==='tree').map((p,i)=>({id:p.id,x:p.x,z:p.z,y:0,height:5.4+(i%5)*.42,yaw:i*2.399,species:i%5===0?'conifer':'deciduous',seed:17031+i,collisionRadius:.19}));
  let state=60941;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  const candidates=[];
  // Irregular grove spacing replaces the plantation grid. Keep a single shared
  // 512-tree renderer budget, including the town's borrowed street trees.
  for(let z=128;z<410;z+=5.8)for(let x=134;x<442;x+=5.8){
    if(x<385&&z<324)continue;
    const px=x+(rand()-.5)*3.8,pz=z+(rand()-.5)*3.8;
    if(capePathMask(px,pz)>.02||Math.abs(pz-capeStreamZ(px))<capeStreamWidth(px)+5||Math.hypot(px-357,pz-292)<12)continue;
    if(roads.some(r=>Math.abs(px-r.x)<r.width/2+4&&Math.abs(pz-r.z)<r.depth/2+4)||buildings.some(b=>Math.abs(px-b.x)<b.width/2+4&&Math.abs(pz-b.z)<b.depth/2+4))continue;
    // A sheltered meadow interrupts the canopy; shore edges taper down into
    // young growth instead of ending in an equally tall rectangular wall.
    if(((px-294)/13)**2+((pz-391)/9)**2<1)continue;
    if(capeCoastalGladeClear(px,pz))continue;
    const edge=Math.min(px-128,448-px,416-pz,px<385?pz-318:px-379);
    const {strength,grove}=capeGroveField(px,pz);
    const young=edge<8||strength<.45||rand()<.12,emergent=!young&&rand()<.28;
    const conifer=rand()<(grove===0?.24:grove===1?.77:grove===3?.84:.59),roll=rand();
    candidates.push({x:px,z:pz,y:capeGroundHeight(px,pz),height:young?5.5+roll*4:emergent?20+roll*4:13+roll*7,
      yaw:rand()*Math.PI*2,species:conifer?'conifer':'deciduous',collisionRadius:young?.22:emergent?.50:.42,
      habitat:young?'young-edge':emergent?'emergent-canopy':'mature-grove',grove,groveStrength:strength,priority:rand()/(.025+strength*strength)});
  }
  candidates.sort((a,b)=>a.priority-b.priority);
  for(const p of candidates){
    if(placements.length>=512)break;
    if(placements.some(other=>Math.hypot(other.x-p.x,other.z-p.z)<4.2))continue;
    const {priority,...tree}=p;
    placements.push({...tree,id:`cape-forest-${placements.length}`,seed:60941+placements.length});
  }
  // The residential expansion ends at x384 but the physical island reaches
  // x448. Reuse young edge trees to create two salt-wind woodland masses in
  // that previously empty lawn, preserving the exact pooled tree population.
  const saplings=placements.filter(p=>p.habitat==='young-edge'&&p.groveStrength<.45)
    .sort((a,b)=>(a.grove===2?0:1)-(b.grove===2?0:1)).slice(0,32);
  for(const [i,p] of saplings.entries()){
    const center=CAPE_RESIDENTIAL_MEADOW[i<16?0:2],slot=i%16;
    const angle=slot*2.399963229728653+(i<16?.73:2.11),radius=2.8*Math.sqrt(slot+.5);
    const x=center.x+Math.cos(angle)*radius,z=center.z+Math.sin(angle)*radius;
    if(roads.some(r=>Math.abs(x-r.x)<r.width/2+10&&Math.abs(z-r.z)<r.depth/2+5))continue;
    if(buildings.some(b=>Math.abs(x-b.x)<b.width/2+5&&Math.abs(z-b.z)<b.depth/2+5))continue;
    Object.assign(p,{x,z,y:capeGroundHeight(x,z),height:5.5+rand()*3.5,species:i%4===0?'conifer':'deciduous',grove:4,groveStrength:0,
      community:i<16?'residential-saltwood-south':'residential-saltwood-north'});
  }
  return placements;
}
