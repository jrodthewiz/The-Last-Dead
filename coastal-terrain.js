// Metres. This seeded field is shared by geometry, feet, projectiles and tree
// roots. The town stays level; the new northern/eastern cape is walkable land.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const CAPE_TERRAIN=Object.freeze({minX:128,maxX:448,minZ:120,maxZ:416,grid:1,bridges:[222,340]});
export function capeStreamZ(x){return 353+8*Math.sin((x-128)*Math.PI/156)+2.4*Math.sin((x-128)*.045);}
export function capeStreamLevel(x){return -.13+clamp(x-128,0,304)*.0009;}
export function capeStreamWidth(x){return 2.7+.45*Math.sin(x*.031+1);}
export function capeNaturalHeight(x,z){
  if(x<128||x>448||z<120||z>416)return 0;
  const forest=Math.max(smooth(314,334,z),smooth(380,402,x));
  if(forest===0)return 0;
  let hills=0;
  for(const [cx,cz,h,rx,rz] of [[410,386,5.7,30,25],[326,398,3.8,31,19],[177,397,2.5,23,20],[419,238,2.4,23,37]])
    hills+=h*Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
  const shore=smooth(0,7,Math.min(x-128,448-x,416-z));
  let height=forest*shore*(hills+.18*Math.sin(x*.11)*Math.sin(z*.09));
  if(x<=432&&z>325){
    const d=Math.abs(z-capeStreamZ(x)),width=capeStreamWidth(x),water=capeStreamLevel(x);
    if(d<=width)height=water-.72+.74*(d/width)**4;
    else if(d<width+5)height=(water+.02)*(1-smooth(width,width+5,d))+height*smooth(width,width+5,d);
  }
  return height;
}
// Piecewise linear interpolation is the exact pair of triangles in the mesh,
// rather than evaluating an unrelated smooth field underneath rendered feet.
export function capeGroundHeight(x,z,{bridges=true}={}){
  const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz;
  const a=capeNaturalHeight(ix,iz),b=capeNaturalHeight(ix+1,iz),c=capeNaturalHeight(ix,iz+1),d=capeNaturalHeight(ix+1,iz+1);
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
  const groves=[[178,385,40,25],[309,387,52,27],[416,264,23,105]];
  let strength=0,grove=0;
  for(const [i,[cx,cz,rx,rz]] of groves.entries()){
    const d=((x-cx)/rx)**2+((z-cz)/rz)**2;
    const field=1-smooth(.40,1.65,d);
    if(field>strength){strength=field;grove=i;}
  }
  return {strength,grove};
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
    const edge=Math.min(px-128,448-px,416-pz,px<385?pz-318:px-379);
    const {strength,grove}=capeGroveField(px,pz);
    const young=edge<8||strength<.45||rand()<.12,emergent=!young&&rand()<.28;
    const conifer=rand()<(grove===0?.24:grove===1?.77:.59),roll=rand();
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
  const saplings=placements.filter(p=>p.habitat==='young-edge'&&p.grove===2&&p.groveStrength<.45).slice(0,32);
  for(const [i,p] of saplings.entries()){
    const center=CAPE_RESIDENTIAL_MEADOW[i<16?0:2],slot=i%16;
    const angle=slot*2.399963229728653+(i<16?.73:2.11),radius=2.8*Math.sqrt(slot+.5);
    const x=center.x+Math.cos(angle)*radius,z=center.z+Math.sin(angle)*radius;
    if(roads.some(r=>Math.abs(x-r.x)<r.width/2+10&&Math.abs(z-r.z)<r.depth/2+5))continue;
    if(buildings.some(b=>Math.abs(x-b.x)<b.width/2+5&&Math.abs(z-b.z)<b.depth/2+5))continue;
    Object.assign(p,{x,z,y:capeGroundHeight(x,z),height:5.5+rand()*3.5,species:i%4===0?'conifer':'deciduous',grove:3,groveStrength:0,
      community:i<16?'residential-saltwood-south':'residential-saltwood-north'});
  }
  return placements;
}
