import {roadAt,TERRAIN} from './data.js';
import {reservedPlace} from './places.js';
import {accessReserved} from './access-plan.js';
import {settlementReserved} from './settlement-plan.js';
import {orchardReserved} from './land-use.js';

const WOOD=0x796849,DARK=0x4b5141,CUT=0xa79870,ROPE=0xa99b72,IRON=0x405a55;

// Include the rendered grid's triangle intersections, not just the centre of
// a foot. A horizontal support can then meet the slope without hovering.
function levels(terrain,x,z,w,d){
 const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,s=TERRAIN.step,ys=[terrain(x,z)],xs=[x0,x1],zs=[z0,z1];
 for(let xx=Math.ceil((x0-TERRAIN.minX)/s)*s+TERRAIN.minX;xx<x1;xx+=s)xs.push(xx);
 for(let zz=Math.ceil((z0-TERRAIN.minZ)/s)*s+TERRAIN.minZ;zz<z1;zz+=s)zs.push(zz);
 for(const xx of xs)for(const zz of zs)ys.push(terrain(xx,zz));
 const origin=TERRAIN.minX+TERRAIN.minZ;
 for(let diagonal=Math.ceil((x0+z0-origin)/s)*s+origin;diagonal<x1+z1;diagonal+=s){
  for(const xx of xs){const zz=diagonal-xx;if(zz>=z0&&zz<=z1)ys.push(terrain(xx,zz));}
  for(const zz of zs){const xx=diagonal-zz;if(xx>=x0&&xx<=x1)ys.push(terrain(xx,zz));}
 }
 return {low:Math.min(...ys),high:Math.max(...ys)};
}

function clear(data,terrain,p){
 const r=Math.hypot(p.w,p.d)/2,road=roadAt(p.x,p.z),ground=levels(terrain,p.x,p.z,p.w,p.d);
 return ground.low>3&&ground.high-ground.low<1.05&&road.distance>road.width/2+r+.8&&
  !reservedPlace(p.x,p.z,r)&&!settlementReserved(p.x,p.z,r)&&!orchardReserved(p.x,p.z,r)&&
  !accessReserved(data.accessPaths||[],p.x,p.z,r+.6)&&
  data.buildings.every(b=>(Math.abs(p.x-b.x)>b.w/2+p.w/2+.8||Math.abs(p.z-b.z)>b.d/2+p.d/2+.8)&&
   (!b.enterable||Math.abs(p.x-b.entry.x)>b.entry.width/2+p.w/2+.8||p.z+p.d/2<b.entry.z-.8||p.z-p.d/2>b.entry.z+b.entry.length+.8))&&
  !(data.trees||[]).some(t=>Math.hypot(p.x-t.x,p.z-t.z)<r+Math.max(.35*t.scale,.27*t.scale)+.6)&&
  !(data.rocks||[]).some(t=>Math.hypot(p.x-t.x,p.z-t.z)<r+t.s+.5);
}

// These are three household uses, not a scatter pass. Each complete corner is
// reserved before drawing; a future route or tree can reject an unsafe pocket.
export function domesticExteriorPlan(data,terrain){
 const pieces=[],solids=[];
 const households=[
  {id:'arrival-house',kind:'drywood',w:2.6,d:1.3,offsets:b=>[[b.w/2+5.2,-2],[b.w/2+6.7,-3.5],[b.w/2+5.2,1]]},
  {id:'lightkeeper',kind:'rope-bench',w:1.4,d:1.95,offsets:b=>[[-b.w/2-5.2,-2],[-b.w/2-6.7,-2],[-b.w/2-5.2,-4]]},
  {id:'orchard-house',kind:'harvest',w:2.45,d:1.4,offsets:b=>[[-b.w/2-7.5,5],[-b.w/2-7.5,3.5],[b.w/2+5.5,6.5]]},
 ];
 for(const household of households){
  const b=data.buildings.find(b=>b.id===household.id);if(!b)continue;
  const p=household.offsets(b).map(([dx,dz])=>({...household,x:b.x+dx,z:b.z+dz})).find(p=>clear(data,terrain,p));if(!p)continue;
  const box=(role,x,y,z,w,h,d,color,solid=false)=>{
   pieces.push({shape:'box',role,x,y,z,w,h,d,color});
   if(solid)solids.push({id:b.id+'-exterior-'+role+'-'+solids.length,x,z,w,d,y:y-h/2,h});
  };
  const cylinder=(role,x,y,z,r,h,color,solid=false)=>{
   pieces.push({shape:'cylinder',role,x,y,z,w:r,h,d:r,color});
   if(solid)solids.push({id:b.id+'-exterior-'+role+'-'+solids.length,x,z,w:r*2,d:r*2,y:y-h/2,h});
  };
  const foot=(role,x,z,w,d,top,color)=>{const bottom=levels(terrain,x,z,w,d).low-.035;box(role,x,(bottom+top)/2,z,w,top-bottom,d,color,true);};
  const rod=(role,a,c,r,color)=>pieces.push({shape:'rod',role,a,c,r,color});
  if(p.kind==='drywood'){
   const deck=levels(terrain,p.x,p.z,2.3,1.05).high+.15;
   for(const dx of [-.76,.76]){
    for(const dz of [-.40,.40])foot('wood-rack-foot',p.x+dx,p.z+dz,.15,.15,deck-.08,DARK);
    box('wood-rack-runner',p.x+dx,deck-.04,p.z,.16,.08,1.04,DARK,true);
   }
   for(let row=0;row<3;row++)for(let col=0;col<4-row;col++){
    const z=p.z+(col-(3-row)/2)*.26,y=deck+.105+row*.21,w=2.18-(col%2)*.12-row*.04;
    box('split-drywood',p.x,y,z,w,.21,.23,col%2?WOOD:0x6e6148,true);
    for(const side of [-1,1])box('drywood-cut-end',p.x+side*(w/2+.006),y,z,.012,.17,.19,CUT);
    if(row===2)box('drywood-split-grain',p.x+.13,y+.108,z,w*.72,.006,.014,DARK);
   }
  }else if(p.kind==='rope-bench'){
   // The long axis follows the cape's contour. Four individual legs reach the
   // ground; rope, a repair cloth and a marlinespike rest on the actual top.
   const top=levels(terrain,p.x,p.z,.84,1.82).high+.77;
   box('keeper-worktop',p.x,top-.06,p.z,.84,.12,1.82,WOOD,true);
   for(const dx of [-.29,.29])for(const dz of [-.72,.72])foot('keeper-bench-leg',p.x+dx,p.z+dz,.13,.13,top-.12,DARK);
   for(const dx of [-.29,.29])box('keeper-bench-stretcher',p.x+dx,top-.40,p.z,.08,.10,1.54,DARK,true);
   for(const dz of [-.72,.72])box('keeper-bench-crossbrace',p.x,top-.40,p.z+dz,.67,.10,.08,DARK,true);
   box('worktop-worn-edge',p.x+.425,top-.045,p.z,.018,.065,1.75,CUT);
   for(const scale of [1,.65])for(let i=0;i<12;i++){
    const point=a=>[p.x+Math.cos(a)*.27*scale,top+.027,p.z-.31+Math.sin(a)*.35*scale];
    rod('keeper-coiled-rope',point(i*Math.PI/6),point((i+1)*Math.PI/6),.027,ROPE);
   }
   rod('keeper-rope-tail',[p.x+.27,top+.027,p.z-.31],[p.x+.29,top+.027,p.z+.28],.027,ROPE);
   box('keeper-repair-cloth',p.x,top+.015,p.z+.57,.34,.03,.34,0x7c8c76);
   rod('keeper-marlinespike',[p.x-.28,top+.023,p.z+.24],[p.x-.28,top+.023,p.z+.77],.023,IRON);
   rod('keeper-spike-grip',[p.x-.28,top+.028,p.z+.59],[p.x-.28,top+.028,p.z+.77],.028,WOOD);
  }else{
   const x=p.x-.53,z=p.z,base=levels(terrain,x,z,1.04,.78).high+.13;
   for(const dx of [-.43,.43])for(const dz of [-.30,.30])foot('harvest-crate-foot',x+dx,z+dz,.10,.10,base-.04,DARK);
   box('harvest-crate-floor',x,base,z,1.04,.08,.78,WOOD,true);
   for(const dx of [-.48,.48])for(const dz of [-.35,.35])box('harvest-crate-upright',x+dx,base+.27,z+dz,.075,.62,.075,DARK,true);
   for(let row=0;row<3;row++)for(const side of [-1,1]){
    box('open-harvest-crate-slat',x,base+.17+row*.17,z+side*.36,1.04,.095,.06,WOOD,true);
    box('open-harvest-crate-end',x+side*.49,base+.17+row*.17,z,.06,.095,.72,WOOD,true);
   }
   // The open top and exposed fruit distinguish this from searchable chests.
   for(const dx of [-.30,0,.30])for(const dz of [-.18,.18])pieces.push({shape:'rock',role:'harvest-fruit',x:x+dx,y:base+.16,z:z+dz,w:.13,h:.12,d:.13,color:dx===0?0x9d995a:0x81904f});
   for(const dx of [-.15,.15])pieces.push({shape:'rock',role:'harvest-fruit',x:x+dx,y:base+.34,z:z+(dx<0?-.18:.18),w:.13,h:.12,d:.13,color:0xad9a5b});
   const px=p.x+.73,pz=p.z+.12,stone=levels(terrain,px,pz,.66,.66),potBase=stone.high+.045;
   box('pot-standing-stone',px,(stone.low-.035+potBase)/2,pz,.66,potBase-stone.low+.035,.66,0x93957a,true);
   cylinder('orchard-clay-pot',px,potBase+.20,pz,.25,.40,0xa5805f,true);
   cylinder('orchard-pot-rim',px,potBase+.39,pz,.28,.06,0xb08d67,true);
   cylinder('orchard-pot-earth',px,potBase+.381,pz,.225,.025,0x5c6044);
   for(const dx of [-.10,.10])pieces.push({shape:'rock',role:'orchard-pot-herb',x:px+dx,y:potBase+.527,z:pz+(dx<0?-.03:.03),w:.19,h:.14,d:.11,color:dx<0?0x71864d:0x8b9755});
  }
 }
 return {pieces,solids};
}
