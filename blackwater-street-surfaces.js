import {positionWorld,normalWorld,cameraPosition,float,color,mix,uniform,vec2,vec3,mx_noise_float,Fn,If} from './vendor/three.tsl.js';
import {CAPE_ROADS} from './coastal-terrain.js';
import {PORT_HANDLING_GROUND,PORT_HANDLING_DRAINS} from './coastal-port-frontage.js';
import {TOWN_HANDLING_GROUND} from './coastal-town-details.js';
import {TIMBER_WORKSPACE_CONTACTS,TIMBER_BOARD_DRAG,TIMBER_WORKSPACE_BOUNDS} from './coastal-timber-workspace.js';

// Original road maintenance and evacuation traces, in stable world metres.
// These are shallow painted/stained asphalt, never displaced collision holes.
export const BLACKWATER_STREET_FIELDS=Object.freeze({
 bounds:{minX:152,maxX:226,minZ:50,maxZ:62},
 repairs:[
  {id:'pharmacy-utility-repair',center:[199.8,57.7],half:[5.3,1.22],yaw:.07},
  {id:'checkpoint-road-repair',center:[214,58.3],half:[3.8,1.18],yaw:-.10},
  {id:'west-layby-repair',center:[174.8,53.4],half:[3.6,.80],yaw:.04},
 ],
 braking:[
  {id:'evacuation-van-braking',points:[[218.6,57.8],[214.3,58.6],[210.2,60.0],[206.4,61.1]],halfWidth:.095,axleHalfWidth:.62},
  {id:'abandoned-car-braking',points:[[183.5,55.0],[179.8,53.5],[175,50.9]],halfWidth:.080,axleHalfWidth:.56},
 ],
 cracks:[
  {id:'utility-repair-edge',points:[[195.0,56.0],[196.6,55.8],[198.0,56.25],[200.2,55.9],[202.1,56.35]],halfWidth:.018},
 ],
 gutters:[50.35,61.65],
});
// A material graph and its diagnostic must keep the same immutable authoring.
const freezeField=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeField(child);Object.freeze(value);}return value;};
freezeField(BLACKWATER_STREET_FIELDS);

const scalar={add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,div:(a,b)=>a/b,abs:Math.abs,min:Math.min,max:Math.max,sin:Math.sin,clamp:(a,l,h)=>Math.max(l,Math.min(h,a)),
 smooth:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}};
const nodes={add:(a,b)=>float(a).add(b),sub:(a,b)=>float(a).sub(b),mul:(a,b)=>float(a).mul(b),div:(a,b)=>float(a).div(b),abs:a=>float(a).abs(),min:(a,b)=>float(a).min(b),max:(a,b)=>float(a).max(b),sin:a=>float(a).sin(),clamp:(a,l,h)=>float(a).clamp(l,h),smooth:(a,b,x)=>float(x).smoothstep(a,b)};

function timberWearAt(x,z,pixel,o){
 const a=o.add,s=o.sub,m=o.mul,aa=o.max(pixel,.005);
 let pressure=0,drag=0;
 for(const [cx,cz] of TIMBER_WORKSPACE_CONTACTS){
  // Square bearing edges, with a bounded exterior seating skirt. Filtering
  // fades inward at its outer boundary; it cannot stain beyond the .06m cap.
  const dx=s(x,cx),dz=s(z,cz),distance=o.max(s(o.max(o.abs(dx),o.abs(dz)),.125),0);
  const inner=o.max(s(.06,aa),0);
  pressure=o.max(pressure,m(s(1,o.smooth(inner,.06,distance)),s(1,o.smooth(.12,.48,pixel))));
 }
 for(let i=1;i<TIMBER_BOARD_DRAG.length;i++){
  const p=TIMBER_BOARD_DRAG[i-1],q=TIMBER_BOARD_DRAG[i],dx=q[0]-p[0],dz=q[1]-p[1],px=s(x,p[0]),pz=s(z,p[1]);
  const t=o.clamp(o.div(a(m(px,dx),m(pz,dz)),dx*dx+dz*dz),0,1),ex=s(px,m(t,dx)),ez=s(pz,m(t,dz));
  const inner=o.max(s(.10,aa),0),outer=.10,distance=a(m(ex,ex),m(ez,ez));
  const interrupted=o.smooth(.2,.75,a(.5,m(.5,o.sin(a(m(t,23),i*2)))));
  drag=o.max(drag,m(m(s(1,o.smooth(m(inner,inner),m(outer,outer),distance)),interrupted),s(1,o.smooth(.09,.315,pixel))));
 }
 return{pressure,drag};
}
export function evaluateTimberWorkspaceWear(x,z,pixelMetres=.02){
 if(![x,z,pixelMetres].every(Number.isFinite)||pixelMetres<0)throw new TypeError('Finite world metres and nonnegative pixel footprint required');
 return timberWearAt(x,z,pixelMetres,scalar);
}

function timberSurfaceGate(y,normalY,o){
 const height=o.min(o.abs(o.sub(y,.135)),o.abs(o.sub(y,.165)));
 return o.mul(o.sub(1,o.smooth(.001,.003,height)),o.smooth(.65,.92,normalY));
}
export function evaluateTimberWorkspaceSurface(x,y,z,normalY,pixelMetres=.02){
 if(![x,y,z,normalY,pixelMetres].every(Number.isFinite)||pixelMetres<0)throw new TypeError('Finite surface coordinates and nonnegative footprint required');
 const b=TIMBER_WORKSPACE_BOUNDS;
 if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return{pressure:0,drag:0};
 const gate=timberSurfaceGate(y,normalY,scalar),f=timberWearAt(x,z,pixelMetres,scalar);
 return{pressure:f.pressure*gate,drag:f.drag*gate};
}

// One expression bundle runs under scalar or TSL algebra. Tests inspect metre
// scale and filtering using the same causes as the actual material graph.
function handlingAt(x,z,pixel,o){
 const a=o.add,s=o.sub,m=o.mul,max=o.max,min=o.min,aa=max(pixel,.005);
 const stroke=(points,width)=>{
  let distance=1e8;
  for(let i=1;i<points.length;i++){
   const p=points[i-1],q=points[i],dx=q[0]-p[0],dz=q[1]-p[1],px=s(x,p[0]),pz=s(z,p[1]);
   const t=o.clamp(o.div(a(m(px,dx),m(pz,dz)),dx*dx+dz*dz),0,1);
   const ex=s(px,m(t,dx)),ez=s(pz,m(t,dz));distance=min(distance,a(m(ex,ex),m(ez,ez)));
  }
  const inner=max(s(width,aa),0),outer=a(width,aa);
  return m(s(1,o.smooth(m(inner,inner),m(outer,outer),distance)),s(1,o.smooth(width*2,width*7,pixel)));
 };
 let handling=0,handlingWheel=0,handlingDeposit=0;
 for(const route of [PORT_HANDLING_GROUND,...TOWN_HANDLING_GROUND]){
  const envelope=stroke(route.path,route.dustHalfWidth);
  handling=max(handling,envelope);
  let accumulation=0;
  for(let i=0;i<route.path.length-1;i++){
   const point=route.path[i],dx=s(x,point[0]),dz=s(z,point[1]);
   let strength=.65;
   if(i>0){
    const before=route.path[i-1],after=route.path[i+1],ax=point[0]-before[0],az=point[1]-before[1],bx=after[0]-point[0],bz=after[1]-point[1];
    strength=Math.min(1,Math.abs(ax*bz-az*bx)/(Math.hypot(ax,az)*Math.hypot(bx,bz))*2.5);
   }
   const radius=route.dustHalfWidth*1.3+1;
   accumulation=max(accumulation,m(strength,s(1,o.smooth(radius*radius*.10,radius*radius,a(m(dx,dx),m(dz,dz))))));
  }
  handlingDeposit=max(handlingDeposit,m(envelope,a(.045,m(accumulation,.955))));
  for(const side of [-1,1]){
   const points=route.path.map((p,i,list)=>{
    const before=list[Math.max(0,i-1)],after=list[Math.min(list.length-1,i+1)],dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz);
    return[p[0]-dz/length*side*route.axleHalfWidth,p[1]+dx/length*side*route.axleHalfWidth];
   });
   handlingWheel=max(handlingWheel,stroke(points,route.wheelHalfWidth));
  }
 }
 let drainWash=0;
 for(const [cx,cz,length]of PORT_HANDLING_DRAINS){
  const dx=max(s(o.abs(s(x,cx)),length/2),0),dz=s(z,cz);
  drainWash=max(drainWash,s(1,o.smooth(.16,1.44,a(m(dx,dx),m(dz,dz)))));
 }
 return{handling,handlingWheel,handlingDeposit:m(handlingDeposit,s(1,drainWash))};
}

function fieldsAt(x,z,pixel,o,includeHandling=true){
 const a=o.add,s=o.sub,m=o.mul,abs=o.abs,max=o.max,min=o.min;
 const aa=max(pixel,.005);
 const inside=(d)=>s(1,o.smooth(m(aa,-1),aa,d));
 const rectangle=(cx,cz,hx,hz,yaw=0)=>{
  const dx=s(x,cx),dz=s(z,cz),c=Math.cos(yaw),n=Math.sin(yaw);
  return max(s(abs(a(m(dx,c),m(dz,n))),hx),s(abs(s(m(dz,c),m(dx,n))),hz));
 };
 const segment=(p,q)=>{
  const dx=q[0]-p[0],dz=q[1]-p[1],px=s(x,p[0]),pz=s(z,p[1]);
  const t=o.clamp(o.div(a(m(px,dx),m(pz,dz)),dx*dx+dz*dz),0,1);
  // Squared distance avoids a costly square root for every trace.
  const ex=s(px,m(t,dx)),ez=s(pz,m(t,dz));return a(m(ex,ex),m(ez,ez));
 };
 const stroke=(points,width)=>{
  let distance=1e8;for(let i=1;i<points.length;i++)distance=min(distance,segment(points[i-1],points[i]));
  const outer=a(width,aa),inner=max(s(width,aa),0);
  const filter=s(1,o.smooth(width*2,width*7,pixel));
  return m(s(1,o.smooth(m(inner,inner),m(outer,outer),distance)),filter);
 };
 const bounds=BLACKWATER_STREET_FIELDS.bounds;
 const main=inside(rectangle((bounds.minX+bounds.maxX)/2,(bounds.minZ+bounds.maxZ)/2,(bounds.maxX-bounds.minX)/2,(bounds.maxZ-bounds.minZ)/2));
 let repair=0,repairSeam=0;
 for(const p of BLACKWATER_STREET_FIELDS.repairs){
  const d=rectangle(...p.center,...p.half,p.yaw),mask=inside(d);
  repair=max(repair,mask);repairSeam=max(repairSeam,m(inside(s(abs(d),.032)),s(1,o.smooth(.064,.22,pixel))));
 }
 let braking=0;for(const path of BLACKWATER_STREET_FIELDS.braking)for(const side of [-1,1]){
  const points=path.points.map(p=>[p[0],p[1]+side*path.axleHalfWidth]);braking=max(braking,stroke(points,path.halfWidth));
 }
 let cracks=0;for(const path of BLACKWATER_STREET_FIELDS.cracks)cracks=max(cracks,stroke(path.points,path.halfWidth));
 let gutter=0;for(const edge of BLACKWATER_STREET_FIELDS.gutters)gutter=max(gutter,s(1,o.smooth(.10,.55,abs(s(z,edge)))));
 const {handling,handlingWheel,handlingDeposit}=includeHandling?handlingAt(x,z,pixel,o):{handling:0,handlingWheel:0,handlingDeposit:0};
 // Broad value structure is deliberately low contrast, subordinate to actors.
 const wash=a(.985,a(m(o.sin(a(m(x,.17),m(z,.11))),.030),m(o.sin(s(m(x,.43),m(z,.27))),.015)));
 return{repair:m(repair,main),repairSeam:m(repairSeam,main),braking:m(braking,main),cracks:m(cracks,main),gutter:m(gutter,main),wash:a(1,m(s(wash,1),main)),main,handling,handlingWheel,handlingDeposit};
}

export function evaluateBlackwaterStreetFields(x,z,pixelMetres=.02){
 if(![x,z,pixelMetres].every(Number.isFinite)||pixelMetres<0)throw new TypeError('Finite world metres and nonnegative pixel footprint required');
 return fieldsAt(x,z,pixelMetres,scalar);
}

export function createBlackwaterStreetSurface(role,tint){
 if(role!=='asphalt'&&role!=='paving')return null;
 const p=positionWorld.xz,pixel=p.fwidth().length(),fields=fieldsAt(p.x,p.y,pixel,nodes,false);
 // Derivatives are evaluated before this varying branch. The compact port
 // work routes add no projection work to streets elsewhere on the island.
 const handling=Fn(()=>{
  const out=vec3(0).toVar(),pad=pixel.max(.005);
  const inside=p.x.greaterThan(float(20).sub(pad)).and(p.x.lessThan(float(90).add(pad)))
   .and(p.y.greaterThan(float(50).sub(pad))).and(p.y.lessThan(float(78).add(pad)));
  If(inside,()=>{const f=handlingAt(p.x,p.y,pixel,nodes);out.assign(vec3(f.handling,f.handlingWheel,f.handlingDeposit));});
  return out;
 })();
 fields.handling=handling.x;fields.handlingWheel=handling.y;fields.handlingDeposit=handling.z;
 const horizontal=normalWorld.y.abs().smoothstep(.65,.92);
 const channels={repair:fields.repair,repairSeam:fields.repairSeam,braking:fields.braking,cracks:fields.cracks,gutter:fields.gutter,handling:fields.handling,handlingWheel:fields.handlingWheel,handlingDeposit:fields.handlingDeposit};
 const debug=uniform(0),base=color(tint);let final;
 if(role==='asphalt'){
  final=mix(base.mul(float(1).add(fields.wash.sub(1).mul(horizontal))),base.mul(.76),fields.repair.mul(horizontal));
  final=final.mul(float(1).sub(fields.repairSeam.mul(horizontal).mul(.16)).sub(fields.braking.mul(horizontal).mul(.22)).sub(fields.cracks.mul(horizontal).mul(.23)));
  final=mix(final,base.mul(.73),fields.gutter.mul(horizontal).mul(.48));
  // Cargo traffic polishes two coherent wheel paths through the depot apron;
  // displaced mineral dust occupies their broader turning envelope.
  // Rain drains toward the actual road shoulders. Low patches interrupt the
  // damp band; the lane centre keeps a rough, readable surface.
  let shoulder=float(0);
  for(const road of CAPE_ROADS){
   const wide=road.width>road.depth,cross=wide?positionWorld.z:positionWorld.x,along=wide?positionWorld.x:positionWorld.z;
   const edge=float((wide?road.depth:road.width)/2).sub(cross.sub(wide?road.z:road.x).abs());
   const end=float(1).sub(along.sub(wide?road.x:road.z).abs().smoothstep((wide?road.width:road.depth)/2-1,(wide?road.width:road.depth)/2));
   shoulder=shoulder.max(float(1).sub(edge.smoothstep(.18,1.8)).mul(edge.smoothstep(-.06,.12)).mul(end));
  }
  const wetPatch=mx_noise_float(positionWorld.mul(vec3(.21,0,.13)),.5,0).smoothstep(-.10,.22);
  const wet=shoulder.mul(wetPatch).mul(horizontal);
  // Rain removes loose cargo grit unevenly; contact stays clearer in washed
  // pockets. The route envelope is retained without drawing uniform bands.
  const dust=fields.handlingDeposit.mul(horizontal).mul(float(1).sub(wetPatch.mul(.72)));
  final=mix(final,color('#827565'),dust.mul(.32));
  const contact=fields.handlingWheel.mul(horizontal).mul(float(.28).add(wetPatch.mul(.72)));
  final=final.mul(float(1).sub(contact.mul(.22)));
  const aggregate=mx_noise_float(positionWorld.mul(vec3(13,0,13)),.5,0)
   .mul(float(1).sub(pixel.smoothstep(.025,.09)));
  final=final.mul(float(1).add(aggregate.mul(.13)).sub(wet.mul(.12)));
  channels.wet=wet;
  channels.roughness=float(.87).sub(wet.mul(.54)).sub(fields.handlingWheel.mul(horizontal).mul(.08)).max(.28);
  const view=cameraPosition.sub(positionWorld).normalize(),fresnel=float(1).sub(normalWorld.dot(view).abs()).pow(5);
  channels.reflection=color('#8ba5ae').mul(wet).mul(float(.025).add(fresnel.mul(.16)));
 }else{
  // Square concrete slabs retain a real 1.5m rhythm and fade below a pixel.
  const joint=axis=>{const slab=axis.div(1.5),footprint=slab.fwidth(),edge=slab.fract().min(float(1).sub(slab.fract()));return float(1).sub(edge.smoothstep(.004,footprint.max(.004).add(.004))).mul(float(1).sub(footprint.smoothstep(.18,.5)));};
  const joints=joint(positionWorld.x).max(joint(positionWorld.z)).mul(horizontal);
  channels.joints=joints;
  final=base.mul(float(1).sub(joints.mul(.16)).sub(fields.gutter.mul(horizontal).mul(.05)));
  const workspace=Fn(()=>{
   const out=vec2(0).toVar(),footprint=pixel.toVar(),b=TIMBER_WORKSPACE_BOUNDS;
   const inside=p.x.greaterThan(float(b.minX)).and(p.x.lessThan(float(b.maxX)))
    .and(p.y.greaterThan(float(b.minZ))).and(p.y.lessThan(float(b.maxZ)));
   If(inside,()=>{const gate=timberSurfaceGate(positionWorld.y,normalWorld.y,nodes);
    If(gate.greaterThan(0),()=>{const f=timberWearAt(p.x,p.y,footprint,nodes);out.assign(vec2(f.pressure,f.drag).mul(gate));});
   });
   return out;
  })();
  channels.timberPressure=workspace.x;channels.timberDrag=workspace.y;
  final=final.mul(float(1).sub(channels.timberPressure.mul(.24)).sub(channels.timberDrag.mul(.13)));
 }
 const names=Object.keys(channels);let out=final;
 for(let i=0;i<names.length;i++)out=debug.equal(i+1).select(vec3(channels[names[i]]),out);
 return{color:final,roughness:channels.roughness,reflection:channels.reflection,diagnosticColor:out,structure:fields.repairSeam,wear:fields.braking,fields:channels,debug,
  setDebug(name='final'){if(name!=='final'&&!names.includes(name))throw new RangeError('Unknown street field '+name);debug.value=name==='final'?0:names.indexOf(name)+1;},
  metadata:{coordinates:'stable world XZ metres',surface:role,causes:'authored road repairs, paired braking traces terminating at existing wrecks, repair-edge cracks, actual shoulder drainage and connected depot handling axis',patches:BLACKWATER_STREET_FIELDS.repairs.length,brakingPaths:BLACKWATER_STREET_FIELDS.braking.length,crackPaths:BLACKWATER_STREET_FIELDS.cracks.length,filter:'world pixel footprint; subpixel cracks, aggregate and seams fade',debugChannels:names,channels:role==='asphalt'?'native rough asphalt, damp-shoulder roughness and bounded analytic sky tint; geometry/collision unchanged':'matte graphic paving; existing cel lighting and collision unchanged',extraDraws:0,textures:0}};
}
