// A serializable work-space plan precedes box emission. These additions are
// carried by the real walls; the four-metre receiving passage stays walkable.
export function makeCoastalIndustrialFrontage(coastal){
 const workshop=coastal.buildings.find(b=>b.id==='coast-lot-2-1-0-1');
 const hall=coastal.buildings.find(b=>b.id==='coast-lot-2-1-0-2');
 if(!workshop||!hall)return{spaces:[],parts:[],diagnostics:{triangles:0,parts:0}};
 const front=workshop.z-workshop.depth/2,hallFront=hall.z-hall.depth/2;
 const left=workshop.x+workshop.width/2,right=hall.x-hall.width/2;
 if(Math.abs(front-hallFront)>1e-6||right-left<3.9)throw new Error('Industrial frontage requires the authored open receiving court');
 const spaces=[
  {id:'works-receiving-court',role:'receiving',bounds:{minX:left,maxX:right,minZ:front-1.75,maxZ:front+8},clearWidth:right-left,clearHeight:5.2},
  {id:'works-covered-repair',role:'covered-repair',bounds:{minX:workshop.x-11.5,maxX:workshop.x-1.5,minZ:front-1.75,maxZ:front+.3},clearHeight:3.9},
  {id:'works-tall-hall-threshold',role:'tall-hall',buildingId:hall.id,bounds:{minX:hall.x-10,maxX:hall.x-5,minZ:front-1.3,maxZ:front+.3},height:hall.height,clearHeight:4.9},
 ];
 const parts=[];
 const add=(spaceId,role,slot,position,size,roll=0,tilt=0)=>parts.push({communityId:spaceId,role,slot,geometry:'box',position,size,yaw:0,roll,tilt});
 // Endpoint-defined structural members keep diagonal ends at their bearing
 // anchors. All members here lie in an X/Y or Y/Z plane.
 const beam=(id,role,a,b,width=.12,slot='metal')=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
  if(Math.abs(dx)>1e-9&&Math.abs(dz)>1e-9)throw new Error('Frontage bearing must use an authored plane');
  add(id,role,slot,a.map((v,i)=>(v+b[i])/2),[width,length,width],Math.atan2(dz,dy),Math.atan2(-dx,dy));
 };
 const repair=spaces[1],rx=(repair.bounds.minX+repair.bounds.maxX)/2,rz=(repair.bounds.minZ+repair.bounds.maxZ)/2;
 // Three unequal roof sheets, carried purlins and an open soffit. The lower
 // workshop gains a deep shadow; its original central doorway is uncovered.
 for(const [offset,width]of [[-3.35,3.25],[-.25,2.85],[3.1,3.70]]){
  add(repair.id,'repair-folded-roof-sheet','metal',[rx+offset,4.16,rz],[width,.10,2.05],-.075);
  for(const edge of [-1,1])add(repair.id,'repair-sheet-standing-seam','dark',[rx+offset+edge*(width/2-.035),4.22,rz],[.035,.055,2.04],-.075);
 }
 for(const z of [front-1.55,front-.15,front+.18])add(repair.id,'repair-carried-purlin','metal',[rx,3.99,z],[10,.16,.12]);
 for(const x of [repair.bounds.minX+.25,rx-.4,repair.bounds.maxX-.25]){
  add(repair.id,'repair-wall-bearing','metal',[x,3.30,front+.18],[.20,1.40,.22]);
  beam(repair.id,'repair-triangular-cantilever',[x,2.65,front+.18],[x,3.94,front-1.63],.13);
  beam(repair.id,'repair-outrigger',[x,3.94,front+.18],[x,3.94,front-1.63],.14);
 }
 add(repair.id,'repair-front-fascia','dark',[rx,4.03,front-1.73],[10,.24,.08]);
 // An open transfer truss, not a solid skybridge. Its two bearings terminate
 // inside the opposing walls; the underside clears the entire court by 5.2m.
 const receiving=spaces[0],x0=left-1.2,x1=right+1.2,z0=front+4.5,z1=front+6.5;
 for(const z of [z0,z1]){
  add(receiving.id,'transfer-bottom-chord','metal',[(x0+x1)/2,5.30,z],[x1-x0,.20,.18]);
  add(receiving.id,'transfer-top-chord','metal',[(x0+x1)/2,6.43,z],[x1-x0,.18,.18]);
  for(let bay=0;bay<4;bay++){
   const a=x0+(x1-x0)*bay/4,b=x0+(x1-x0)*(bay+1)/4;
   beam(receiving.id,'transfer-diagonal-web',[a,bay%2?6.43:5.30,z],[b,bay%2?5.30:6.43,z],.115);
  }
  for(const x of [x0,x1]){
   add(receiving.id,'transfer-wall-bearing-plate','metal',[x,5.32,z],[.42,.44,.38]);
   beam(receiving.id,'transfer-bearing-stiffener',[x,5.32,z],[x,6.43,z],.16);
  }
 }
 for(const x of [x0,(x0+x1)/2,x1])add(receiving.id,'transfer-cross-bearing','metal',[x,5.35,(z0+z1)/2],[.18,.16,z1-z0]);
 for(let slat=0;slat<12;slat++)add(receiving.id,'transfer-open-runner','dark',[x0+.15+slat*(x1-x0-.3)/11,5.47,(z0+z1)/2],[.18,.08,z1-z0]);
 // A narrower and higher loading eyebrow belongs to the tall hall. Its
 // attached knees retain a different setback and rhythm from the repair bay.
 const tall=spaces[2],tx=(tall.bounds.minX+tall.bounds.maxX)/2,tz=(tall.bounds.minZ+tall.bounds.maxZ)/2;
 add(tall.id,'hall-loading-eyebrow','metal',[tx,5.15,tz],[5,.12,1.6],-.10);
 add(tall.id,'hall-loading-fascia','dark',[tx,5.05,front-1.27],[5,.25,.10]);
 for(const x of [tall.bounds.minX+.3,tall.bounds.maxX-.3]){
  add(tall.id,'hall-loading-wall-bearing','metal',[x,4.52,front+.18],[.24,1.16,.26]);
  beam(tall.id,'hall-loading-knee',[x,3.96,front+.18],[x,5.03,front-1.23],.16);
  beam(tall.id,'hall-loading-outrigger',[x,5.03,front+.18],[x,5.03,front-1.23],.16);
 }
 return{spaces,parts,diagnostics:{parts:parts.length,triangles:parts.length*12,groundSupports:0,newColliders:0,materialSlots:2,borrowedPrimitive:'unitBox'}};
}
