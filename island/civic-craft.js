// The square is a place people used: planted beds, a ferry waiting shelter,
// and an interrupted parks shift. All substantial forms share physical bounds.
export const CIVIC_CAMP={x:758,z:38};
export function civicSurface(x,z){
 const dx=Math.abs(x-734),dz=Math.abs(z);
 if(dx<=58&&dz<=4||dx<=4&&dz<=66)return 14.56;
 if(dx>57||dz>65)return null;
 const apron=dx<=14&&dz<=14&&(dx>=9||dz>=9);
 const waitingPad=x>=754&&x<=766&&z>=-59&&z<=-51;
 const waitingPath=x>=734&&x<=766&&Math.abs(z+61)<=1.5||Math.abs(x-763.3)<=1.1&&z>=-61&&z<=-54;
 return dx<4||dz<4||apron||waitingPad||waitingPath?14.56:14.475;
}
let cached;
export function civicCraftPlan(){
 if(cached)return cached;
 const pieces=[],solids=[],wood=0x7c6b4e,metal=0x455d52,stone=0xb2ad8d,paper=0xd3c89e;
 const box=(role,x,y,z,w,h,d,color,solid=false)=>{
  pieces.push({shape:'box',role,x,y,z,w,h,d,color});
  if(solid)solids.push({id:'civic-'+role,x,z,w,d,y:y-h/2,h});
 };
 const label=(text,subline,x,y,z,w,h)=>pieces.push({shape:'label',x,y,z,w,h,text,subline,colour:metal});
 // The four approaches meet a visible bypass rather than ending at masonry.
 for(const side of [-1,1]){
  box('clock-apron',734+side*11.5,14.52,0,5,.08,28,0xc4bb93);
  box('clock-apron',734,14.52,side*11.5,18,.08,5,0xc4bb93);
 }
 const bench=(x,z)=>{
  box('bench-seat',x,15.04,z,3.3,.16,.75,wood,true);
  box('bench-back',x,15.48,z-.35,3.3,.82,.12,wood,true);
  for(const dx of [-1.2,1.2])box('bench-leg',x+dx,14.72,z,.16,.49,.65,metal,true);
 };
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const x=734+sx*25,z=sz*23;
  box('bed-earth',x,14.62,z,12,.28,5,0x686748,true);
  for(const side of [-1,1]){
   box('bed-rim',x+side*6.1,14.69,z,.2,.42,5.4,stone,true);
   box('bed-rim',x,14.69,z+side*2.6,12.4,.42,.2,stone,true);
  }
  // Broad leaves and ochre flower heads read at the console resolution.
  for(let i=0;i<8;i++){
   const xx=x-4.9+i*1.4,zz=z+(i%2?-.8:.8);
   pieces.push({shape:'rock',role:'bed-leaf',x:xx,y:14.98,z:zz,w:1.12,h:.58,d:.88,color:i%3?0x70844d:0x8c9456,rotation:i*2.4});
   if(i%2===0)pieces.push({shape:'rock',role:'bed-flower',x:xx,y:15.25,z:zz,w:.38,h:.27,d:.34,color:0xb29e67,rotation:i});
  }
  bench(x,z+sz*6);
 }
 // The shelter faces the square. Its middle and the route to the camp stay open.
 const x=760,z=-55;
 box('waiting-pad',x,14.52,z,12,.08,8,0xb5ad8a);
 // Turn north of the memorial obelisk and its urns, then into the shelter.
 box('waiting-approach',750,14.52,-61,32,.08,3,0xc4bb93);
 box('waiting-approach',763.3,14.52,-57.5,2.2,.08,7,0xc4bb93);
 for(const dx of [-5,5])for(const dz of [-2,2])box('shelter-post',x+dx,16.08,z+dz,.18,3.2,.18,metal,true);
 box('shelter-roof',x,17.76,z,10.8,.28,5.4,0x425f54,true);
 box('shelter-fascia',x,17.40,z+2.65,10.8,.56,.12,metal,true);
 label('EAST DOCKS / WAITING ROOM','FOLLOW THE WATERFRONT',x,17.40,z+2.72,9,.43);
 bench(x,z-1.35);
 box('left-luggage',x-3.6,14.88,z+.2,.85,.8,.60,0x8a7054,true);
 box('luggage-strap',x-3.6,14.88,z+.507,.10,.76,.025,paper);
 box('luggage-handle',x-3.6,15.32,z+.2,.32,.10,.10,metal);
 // One maintenance corner, away from the camp and memorial interactions.
 bench(710,45);
 box('parks-toolbox',708.8,15.31,45,.74,.36,.46,metal);
 box('toolbox-handle',708.8,15.53,45,.30,.08,.08,paper);
 box('seed-tray',711,15.17,45,.82,.10,.53,wood);
 for(let i=0;i<3;i++)pieces.push({shape:'cylinder',role:'seed-pot',x:710.75+i*.25,y:15.32,z:45,w:.19,h:.25,d:.19,color:0x9b7855});
 box('camp-marker-post',CIVIC_CAMP.x+3,15.28,CIVIC_CAMP.z,.12,1.6,.12,wood,true);
 box('camp-marker-board',CIVIC_CAMP.x+3,16.04,CIVIC_CAMP.z,2.4,.62,.10,metal,true);
 label('CIVIC REFUGE','REST / LEAVE A LIGHT',CIVIC_CAMP.x+3,16.04,CIVIC_CAMP.z+.056,2.3,.55);
 // A shallow crushed-stone pad gives the fire a maintained, readable place.
 box('refuge-gravel',CIVIC_CAMP.x,14.49,CIVIC_CAMP.z,7,.025,7,0xa09d7d);
 // The old tower was visual-only, letting players stand inside its masonry.
 solids.push({id:'civic-clock-plinth',x:734,z:0,w:18,d:18,y:14.3,h:1.5},
  {id:'civic-clock-tower',x:734,z:0,w:7,d:7,y:15,h:24});
 for(const xx of [690,778])for(let zz=-54;zz<=54;zz+=27)solids.push({id:'civic-tree',x:xx,z:zz,w:.63,d:.63,y:14.4,h:8});
 return cached={pieces,solids};
}

// Saves made before the square had physical furniture can occupy its new
// masonry. Recover only those overlapping positions, preserving all progress.
export function recoverCivicSave(state){
 const overlaps=(x,z,y,r)=>civicCraftPlan().solids.some(b=>{
  if(y+1.5<b.y||y>b.y+b.h)return false;
  const dx=Math.max(Math.abs(x-b.x)-b.w/2,0),dz=Math.max(Math.abs(z-b.z)-b.d/2,0);
  return dx*dx+dz*dz<r*r;
 });
 let occupiedRecovered=false;
 for(const [i,v]of (state.vehicles||[]).entries())if(v&&overlaps(v.x,v.z,civicSurface(v.x,v.z)??14,1.5)){
  v.x=772;v.z=90+i*8;v.angle=0;
  if(state.activeVehicle===i)occupiedRecovered=true;
 }
 if(occupiedRecovered||overlaps(state.x,state.z,state.y,.42)){
  state.x=CIVIC_CAMP.x;state.z=CIVIC_CAMP.z+4;
  state.y=civicSurface(state.x,state.z);state.vy=0;state.activeVehicle=null;
 }
 return state;
}
