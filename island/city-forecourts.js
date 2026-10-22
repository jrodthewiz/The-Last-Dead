import {cityIdentity} from './city-identity.js';
const cache=new WeakMap();
// Two small, usable frontage pockets; the central six metres stay open.
export function cityForecourtPlan(b,ground){
 if(!b.cityInterior)return {pieces:[],solids:[]};
 if(cache.has(b))return cache.get(b);
 const pieces=[],solids=[],identity=cityIdentity(b),front=b.entry.z,wood=0x827052,metal=0x4c6458,cream=0xc3bb96;
 const box=(role,x,y,z,w,h,d,color,solid=false)=>{const floor=ground(x,z);pieces.push({shape:'box',role,x,y:floor+y,z,w,h,d,color});if(solid)solids.push({id:b.id+'-forecourt-'+role,x,z,w,d,y:floor+y-h/2,h});};
 for(const side of [-1,1]){
  const x=b.x+side*(b.w/2-3.3),z=front+2.7;
  box('forecourt-paving',x,.015,z,4.2,.025,2.5,0xa3ac92);
  if(side===-1&&b.district!=='industrial'){
   box('bench-seat',x,.52,z,2.55,.14,.64,wood,true);
   box('bench-back',x,.94,z-.29,2.55,.77,.12,wood,true);
   for(const dx of [-.94,.94])box('bench-leg',x+dx,.23,z,.15,.46,.55,metal,true);
   for(const dx of [-1.17,1.17])box('bench-arm',x+dx,.76,z,.09,.34,.64,metal);
   // A folded newspaper or a forgotten parcel belongs to the bench.
   box('bench-left-behind',x+.76,.625,z,.50,.07,.42,identity.id==='press'?cream:identity.colour);
  }else{
   box('raised-planter',x,.31,z,1.35,.62,1.15,wood,true);
   box('planter-earth',x,.64,z,1.18,.045,.98,0x666449);
   for(let i=0;i<3;i++)pieces.push({shape:'sphere',role:'forecourt-leaves',x:x+(i-1)*.35,y:ground(x,z)+.98+(i%2)*.20,z,w:.56,h:.54,d:.49,color:[0x627d4e,0x839152,0x74854e][i],rotation:i*2.4});
  }
  if(side===1){
   const xx=x+1.40;
   box('refuse-bin',xx,.46,z,.67,.92,.67,metal,true);box('bin-lid',xx,.96,z,.75,.08,.75,cream);
   box('bin-slot',xx,.78,z+.345,.40,.14,.025,0x263e32);
  }
 }
 // The timetable has its own frame behind the bench, clear of real windows.
 const nx=b.x-b.w/2+3.3,nz=front+1.9;
 for(const dx of [-.98,.98])box('noticecase-post',nx+dx,.91,nz,.08,1.82,.08,metal,true);
 box('noticecase-frame',nx,1.65,nz,2.4,.56,.10,metal,true);
 pieces.push({shape:'label',x:nx,y:ground(nx,nz)+1.65,z:nz+.056,w:2.3,h:.44,text:identity.notice,subline:identity.detail,colour:identity.colour});
 const plan={pieces,solids};cache.set(b,plan);return plan;
}

// Street trees belong to the same world description as island trees. Reserve
// the full crown against buildings; the old corner grid clipped new lobbies.
export function cityStreetTreePlan(buildings,ground){
 const trees=[],radius=3.5;
 for(let col=0;col<10;col++)for(let row=0;row<12;row++){
  if((col+row)%2!==0)continue;
  const x=392+col*76,z=-456+row*76;
  if(Math.abs(x-734)<72&&Math.abs(z)<90)continue;
  const candidates=[[x+9.2,z+9.2],[x+9.2,z-9.2],[x-9.2,z+9.2],[x-9.2,z-9.2]];
  const p=candidates.find(([xx,zz])=>buildings.every(b=>Math.abs(xx-b.x)>=b.w/2+radius||Math.abs(zz-b.z)>=b.d/2+radius)&&buildings.every(b=>!b.enterable||Math.abs(xx-b.entry.x)>b.entry.width/2+1||zz<b.entry.z-1||zz>b.entry.z+b.entry.length+2));
  if(p)trees.push({x:p[0],z:p[1],y:ground(...p),scale:.62,kind:'broad',rotation:0,urban:true});
 }
 return trees;
}
