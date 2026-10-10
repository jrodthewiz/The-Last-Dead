import {capeResidentialCoastFields,capeWindwardHeathFields,CAPE_RESIDENTIAL_TRANSITION} from './coastal-residential-fields.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// A wind-exposed slate/heath edge grades into two unequal lee canopy bodies.
// The worn cross-shore accesses interrupt their crowns, not just their stems.
export const SALTWOOD_COHORTS=Object.freeze([
 Object.freeze({id:'south-lee',x:411,z:25,rx:18,rz:20,trees:18}),
 Object.freeze({id:'north-lee',x:410,z:84,rx:18,rz:17,trees:12}),
]);
export function saltwoodTransectFields(x,z){
 const coast=capeResidentialCoastFields(x,z),heath=capeWindwardHeathFields(x,z);
 let accessDistance=Infinity,canopy=0,cohort=-1;
 for(const p of CAPE_RESIDENTIAL_TRANSITION.traces){
  const dx=x-384,centre=p.z+dx*p.slope+p.bend*Math.sin(dx*p.frequency);
  accessDistance=Math.min(accessDistance,Math.abs(z-centre)/Math.sqrt(1+p.slope*p.slope));
 }
 for(const [i,p]of SALTWOOD_COHORTS.entries()){
  const u=(x-p.x+(z-p.z)*.18)/p.rx,v=(z-p.z)/p.rz;
  const lobe=1-smooth(.18,1.03,u*u+v*v);
  if(lobe>canopy){canopy=lobe;cohort=i;}
 }
 const lee=(1-smooth(419,431,x))*smooth(394,399,x),clearAccess=smooth(5.8,8.2,accessDistance);
 const treeCover=canopy*lee*clearAccess*(.55+.45*clamp(coast.scrub*2));
 const lowCover=Math.max(treeCover,heath.cover*.85)*smooth(3,7,accessDistance)*(1-coast.bedrock);
 return {cohort,canopy:treeCover,lowCover,exposure:coast.exposure,bedrock:coast.bedrock,trace:coast.trace,accessDistance,
  role:treeCover>.2?'saltwood-lee':heath.cover>.2?'windward-heath':'exposed-gap'};
}
