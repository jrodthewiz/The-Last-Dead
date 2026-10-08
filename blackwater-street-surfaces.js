import {positionWorld,normalWorld,float,color,mix,uniform,vec3} from './vendor/three.tsl.js';

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

// One expression bundle runs under scalar or TSL algebra. Tests inspect metre
// scale and filtering using the same causes as the actual material graph.
function fieldsAt(x,z,pixel,o){
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
 // Broad value structure is deliberately low contrast, subordinate to actors.
 const wash=a(.985,a(m(o.sin(a(m(x,.17),m(z,.11))),.030),m(o.sin(s(m(x,.43),m(z,.27))),.015)));
 return{repair:m(repair,main),repairSeam:m(repairSeam,main),braking:m(braking,main),cracks:m(cracks,main),gutter:m(gutter,main),wash:a(1,m(s(wash,1),main)),main};
}

export function evaluateBlackwaterStreetFields(x,z,pixelMetres=.02){
 if(![x,z,pixelMetres].every(Number.isFinite)||pixelMetres<0)throw new TypeError('Finite world metres and nonnegative pixel footprint required');
 return fieldsAt(x,z,pixelMetres,scalar);
}

export function createBlackwaterStreetSurface(role,tint){
 if(role!=='asphalt'&&role!=='paving')return null;
 const p=positionWorld.xz,pixel=p.fwidth().length(),fields=fieldsAt(p.x,p.y,pixel,nodes);
 const horizontal=normalWorld.y.abs().smoothstep(.65,.92);
 const channels={repair:fields.repair,repairSeam:fields.repairSeam,braking:fields.braking,cracks:fields.cracks,gutter:fields.gutter};
 const debug=uniform(0),base=color(tint);let final;
 if(role==='asphalt'){
  final=mix(base.mul(float(1).add(fields.wash.sub(1).mul(horizontal))),base.mul(.76),fields.repair.mul(horizontal));
  final=final.mul(float(1).sub(fields.repairSeam.mul(horizontal).mul(.16)).sub(fields.braking.mul(horizontal).mul(.22)).sub(fields.cracks.mul(horizontal).mul(.23)));
  final=mix(final,base.mul(.73),fields.gutter.mul(horizontal).mul(.48));
 }else{
  // Square concrete slabs retain a real 1.5m rhythm and fade below a pixel.
  const joint=axis=>{const slab=axis.div(1.5),footprint=slab.fwidth(),edge=slab.fract().min(float(1).sub(slab.fract()));return float(1).sub(edge.smoothstep(.004,footprint.max(.004).add(.004))).mul(float(1).sub(footprint.smoothstep(.18,.5)));};
  const joints=joint(positionWorld.x).max(joint(positionWorld.z)).mul(horizontal);
  channels.joints=joints;
  final=base.mul(float(1).sub(joints.mul(.16)).sub(fields.gutter.mul(horizontal).mul(.05)));
 }
 const names=Object.keys(channels);let out=final;
 for(let i=0;i<names.length;i++)out=debug.equal(i+1).select(vec3(channels[names[i]]),out);
 return{color:final,diagnosticColor:out,structure:fields.repairSeam,wear:fields.braking,fields:channels,debug,
  setDebug(name='final'){if(name!=='final'&&!names.includes(name))throw new RangeError('Unknown street field '+name);debug.value=name==='final'?0:names.indexOf(name)+1;},
  metadata:{coordinates:'stable world XZ metres',surface:role,causes:'authored road repairs, paired braking traces terminating at existing wrecks, repair-edge cracks and curb drainage',patches:BLACKWATER_STREET_FIELDS.repairs.length,brakingPaths:BLACKWATER_STREET_FIELDS.braking.length,crackPaths:BLACKWATER_STREET_FIELDS.cracks.length,filter:'world pixel footprint; subpixel cracks and seams fade',debugChannels:names,channels:'matte graphic albedo; existing cel lighting and collision unchanged',extraDraws:0,textures:0}};
}
