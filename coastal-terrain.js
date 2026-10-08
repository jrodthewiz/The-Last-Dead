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
export function makeCapeForestPlacements(neighborhoods,buildings,roads){
  const placements=neighborhoods.props.filter(p=>p.kind==='tree').map((p,i)=>({id:p.id,x:p.x,z:p.z,y:0,height:5.4+(i%5)*.42,yaw:i*2.399,species:i%5===0?'conifer':'deciduous',seed:17031+i,collisionRadius:.19}));
  let state=60941;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
  for(let z=128;z<410;z+=10)for(let x=134;x<442;x+=10){
    if(x<385&&z<324)continue;
    const px=x+(rand()-.5)*4,pz=z+(rand()-.5)*4;
    if(capePathMask(px,pz)>.02||Math.abs(pz-capeStreamZ(px))<capeStreamWidth(px)+5||Math.hypot(px-357,pz-292)<12)continue;
    if(roads.some(r=>Math.abs(px-r.x)<r.width/2+4&&Math.abs(pz-r.z)<r.depth/2+4)||buildings.some(b=>Math.abs(px-b.x)<b.width/2+4&&Math.abs(pz-b.z)<b.depth/2+4))continue;
    const conifer=rand()<.58,id=`cape-forest-${placements.length}`;
    placements.push({id,x:px,z:pz,y:capeGroundHeight(px,pz),height:conifer?10+rand()*6:8+rand()*5,yaw:rand()*Math.PI*2,species:conifer?'conifer':'deciduous',seed:60941+placements.length,collisionRadius:.32});
  }
  return placements;
}
