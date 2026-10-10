import {MeshStandardNodeMaterial} from './vendor/three.webgpu.js';
import {attribute,positionGeometry,normalGeometry,float,vec3,mix,uniform} from './vendor/three.tsl.js';

export function townWoodPieceParameters(part){
 if(!part.size?.every(v=>Number.isFinite(v)&&v>0))throw new TypeError('Positive finite wood dimensions required');
 let hash=2166136261;for(const c of `${part.communityId}/${part.role}/${part.position}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return [...part.size,(hash>>>0)/4294967296];
}
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// Cycle average of smoothstep(.25,.82,sin(phase)), not an arbitrary .5.
export const TOWN_WOOD_LATEWOOD_MEAN=.3178592045500431;
const scalar={add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,sqrt:Math.sqrt,sin:Math.sin,abs:Math.abs,smooth,clamp,store:v=>v};
const native={add:(a,b)=>float(a).add(b),sub:(a,b)=>float(a).sub(b),mul:(a,b)=>float(a).mul(b),sqrt:a=>float(a).sqrt(),sin:a=>float(a).sin(),abs:a=>float(a).abs(),smooth:(a,b,v)=>float(v).smoothstep(a,b),clamp:a=>float(a).clamp(0,1),store:v=>float(v).toVar()};
function latewoodAt(sine,footprint,o){
 const fade=o.sub(1,o.smooth(.45,1.8,footprint));
 return o.store(o.add(TOWN_WOOD_LATEWOOD_MEAN,o.mul(o.sub(o.smooth(.25,.82,sine),TOWN_WOOD_LATEWOOD_MEAN),fade)));
}
export function evaluateTownWoodLatewood(phase,phaseFootprint=0){
 if(!Number.isFinite(phase)||!Number.isFinite(phaseFootprint)||phaseFootprint<0)throw new TypeError('Finite phase and nonnegative footprint required');
 return latewoodAt(Math.sin(phase),phaseFootprint,scalar);
}
function causes(along,u,v,end,seed,coarseFootprint,fineFootprint,o,phaseOverride){
 const {add:a,sub:s,mul:m}=o;
 // One offset growth cylinder: longitudinal faces expose fibres; cut ends
 // expose its rings. The same radial cause owns both PBR channels.
 const cu=a(u,a(.12,m(seed,.11))),cv=a(v,a(.10,m(seed,.07)));
 const radius=o.sqrt(a(m(cu,cu),m(cv,cv)));
 const phase=phaseOverride===undefined?a(m(radius,155),m(o.sin(a(m(along,.8),m(seed,6.28))),.35)):phaseOverride;
 const coarseFade=s(1,o.smooth(.7,2.6,coarseFootprint)),fineFade=s(1,o.smooth(.5,2.0,fineFootprint));
 const sine=o.store(o.sin(phase)),ring=o.store(m(sine,coarseFade)),fibre=o.store(m(o.sin(a(m(phase,9),m(seed,17))),fineFade));
 const latewood=latewoodAt(sine,coarseFootprint,o),dense=s(latewood,TOWN_WOOD_LATEWOOD_MEAN);
 // Cut-end drying owns finish variation; seed locates growth, not random dye.
 const dry=o.store(a(.32,m(end,.26)));
 const shade=a(s(1,m(dense,a(.21,m(end,.03)))),a(m(fibre,-.005),m(end,-.055)));
 const roughness=a(a(.84,m(dry,.09)),a(m(dense,.035),m(fibre,.006)));
 return{radius,phase,ring,fibre,latewood,dry,shade,roughness,coarseFade,fineFade};
}
export function evaluateTownWood({localPosition,localNormal,dimensions,seed=0,pixelMetres=0}){
 if(![...localPosition,...localNormal,...dimensions,seed,pixelMetres].every(Number.isFinite)||dimensions.some(v=>v<=0)||pixelMetres<0)throw new TypeError('Finite wood coordinates and positive dimensions required');
 const axis=dimensions[0]>dimensions[1]&&dimensions[0]>dimensions[2]?0:dimensions[1]>dimensions[2]?1:2;
 const transverse=axis===0?[1,2]:axis===1?[0,2]:[0,1],p=localPosition.map((v,i)=>v*dimensions[i]);
 const end=smooth(.7,.95,Math.abs(localNormal[axis]));
 return{axis,end,...causes(p[axis],p[transverse[0]],p[transverse[1]],end,seed,pixelMetres*155,pixelMetres*1395,scalar)};
}
export function createTownWoodMaterial(){
 const material=new MeshStandardNodeMaterial({color:0xffffff,roughness:.91,metalness:0});material.name='TownPieceFollowingDryWood';
 const piece=attribute('townWoodPiece','vec4'),p=positionGeometry.mul(piece.xyz);
 const x=piece.x.greaterThan(piece.y).and(piece.x.greaterThan(piece.z)),y=piece.y.greaterThan(piece.z);
 const along=x.select(p.x,y.select(p.y,p.z)),u=x.select(p.y,p.x),v=x.select(p.z,y.select(p.z,p.y));
 const n=x.select(normalGeometry.x,y.select(normalGeometry.y,normalGeometry.z)).abs();
 const end=n.smoothstep(.7,.95),seed=piece.w;
 const cu=u.add(float(.12).add(seed.mul(.11))),cv=v.add(float(.10).add(seed.mul(.07)));
 const phase=cu.mul(cu).add(cv.mul(cv)).sqrt().mul(155).add(along.mul(.8).add(seed.mul(6.28)).sin().mul(.35)).toVar();
 // Derivatives are unconditional, with no varying branches. Fine fibres fade
 // first and growth rings fade later; no unresolved bump survives minification.
 const f=causes(along,u,v,end,seed,phase.fwidth(),phase.mul(9).fwidth(),native,phase);
 material.colorNode=mix(vec3(.15,.083,.040),vec3(.25,.185,.112),f.dry).mul(f.shade);
 material.roughnessNode=float(f.roughness).clamp(.82,.98);
 const debug=uniform(0);material.colorNode=debug.equal(1).select(vec3(f.ring.mul(.5).add(.5)),debug.equal(2).select(vec3(end),debug.equal(3).select(vec3(f.dry),material.colorNode)));
 material.userData={lookRole:'town-wood',nativeTownWood:true,pieceMetres:true,grainSpacingMetres:6.283185307179586/155,microSpacingMetres:6.283185307179586/1395,latewoodMean:TOWN_WOOD_LATEWOOD_MEAN,roughnessRange:[.82,.98],microNormalStrength:0,derivativeFiltered:true,debug};
 return material;
}
