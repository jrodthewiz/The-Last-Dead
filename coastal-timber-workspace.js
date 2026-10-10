// Pure metre authoring shared by work-space geometry and paving contact wear.
// A cutting station belongs to the existing timber stack at East Works 56.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const TIMBER_WORKSPACE_BOUNDS=freeze({minX:325.9,maxX:331.55,minZ:168.05,maxZ:169.65});
export const TIMBER_WORKSPACE_CONTACTS=freeze([[326.53,168.3],[326.53,169.15],[327.77,168.3],[327.77,169.15]]);
export const TIMBER_BOARD_DRAG=freeze([[330.2,169.48],[328.5,169.48],[327.2,169.44]]);

export function makeCoastalTimberWorkspace(coastal){
 const building=coastal.buildings.find(b=>b.id==='coast-lot-2-1-1-1');
 if(!building)return{communities:[],parts:[],obstacles:[],diagnostics:{parts:0,triangles:0}};
 if(building.x!==320||building.z+building.depth/2!==168)throw new Error('Timber workspace requires its original authored wall and stack');
 const bounds={minX:326.15,maxX:328.15,minZ:168.1,maxZ:169.35};
 const id='town-detail-works-56-cutting-bench';
 const obstacle={id,minX:bounds.minX/4,maxX:bounds.maxX/4,minY:bounds.minZ/4,maxY:bounds.maxZ/4};
 const community={id,buildingId:building.id,kind:'timber-cutting',x:327.15,z:168.725,yaw:0,width:2,depth:1.25,obstacle};
 const parts=[];
 const add=(role,slot,position,size,roll=0,tilt=0)=>parts.push({communityId:id,role,slot,geometry:'box',position,size,yaw:0,roll,tilt});
 const beam=(role,a,b,width=.065)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
  add(role,'metal',a.map((v,i)=>(v+b[i])/2),[width,Math.hypot(dx,dy,dz),width],Math.atan2(dz,dy),Math.atan2(-dx,dy));
 };
 for(const [x,z]of TIMBER_WORKSPACE_CONTACTS){
  add('cutting-bench-ground-foot','wood',[x,.215,z],[.25,.16,.25]);
  add('cutting-bench-carried-leg','wood',[x,.600,z],[.085,.61,.085]);
 }
 for(const x of [326.53,327.77]){
  add('cutting-bench-trestle-bearing','wood',[x,.865,168.725],[.14,.08,1.18]);
  beam('cutting-bench-trestle-brace',[x,.34,168.3],[x,.84,169.15]);
 }
 add('cutting-bench-long-bearing','wood',[327.15,.865,168.725],[1.86,.08,.12]);
 for(let board=0;board<5;board++)add('cutting-bench-spaced-top-board','wood',[327.15,.960,168.275+board*.225],[1.96,.11,.21]);
 add('cutting-bench-working-stock','wood',[327.15,1.060,168.7],[1.87,.09,.18]);
 add('cutting-bench-crosscut-stop','metal',[327.92,1.145,168.70],[.055,.08,.30]);
 // Three wall-bearing knees carry both the bench and stored-stock threshold.
 // The tall front face stays open; the existing stack's boards are untouched.
 const x0=TIMBER_WORKSPACE_BOUNDS.minX,x1=TIMBER_WORKSPACE_BOUNDS.maxX;
 for(const [x,w]of [[326.83,1.82],[328.68,1.79],[330.61,1.84]]){
  add('timber-threshold-roof-sheet','metal',[x,2.65,168.85],[w,.085,1.60],.07);
  for(const side of [-1,1])add('timber-threshold-standing-seam','dark',[x+side*(w/2-.035),2.70,168.85],[.032,.045,1.59],.07);
 }
 for(const z of [168.10,169.55])add('timber-threshold-purlin','metal',[(x0+x1)/2,2.525,z],[x1-x0,.12,.10]);
 for(const x of [326.1,328.65,331.3]){
  add('timber-threshold-wall-bearing','metal',[x,2.11,167.9],[.16,1.05,.18]);
  beam('timber-threshold-braced-knee',[x,1.65,167.92],[x,2.525,169.55],.105);
  beam('timber-threshold-carried-outrigger',[x,2.525,167.92],[x,2.525,169.55],.11);
 }
 add('timber-threshold-front-fascia','dark',[(x0+x1)/2,2.55,169.61],[x1-x0,.18,.08]);
 return{communities:[community],parts,obstacles:[obstacle],bounds,contacts:TIMBER_WORKSPACE_CONTACTS,drag:TIMBER_BOARD_DRAG,
  diagnostics:{parts:parts.length,triangles:parts.length*12,newColliders:1,borrowedPrimitive:'unitBox',materialSlots:3,benchTop:.96,groundFootBottom:.135,thresholdClearance:2.4}};
}
