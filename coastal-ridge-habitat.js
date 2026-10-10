import {CAPE_RESIDENTIAL_TRANSITION,capeResidentialCoastFields} from './coastal-residential-fields.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// Two unequal exposed skirts join the existing lee root communities. Their
// worn crossings and mineral bearing interrupt the habitat, not just its tint.
export const CAPE_RIDGE_HABITAT=Object.freeze([
 Object.freeze({x:428,z:27,rx:13,rz:20}),
 Object.freeze({x:426,z:86,rx:12,rz:16}),
]);
export function capeRidgeHabitatFields(x,z){
 const coast=capeResidentialCoastFields(x,z);let body=0,group=-1,accessDistance=Infinity;
 for(const [i,p]of CAPE_RIDGE_HABITAT.entries()){
  const u=(x-p.x+(z-p.z)*.16)/p.rx,v=(z-p.z)/p.rz;
  const f=1-smooth(.35,1.08,u*u+v*v);
  if(f>body){body=f;group=i;}
 }
 for(const p of CAPE_RESIDENTIAL_TRANSITION.traces){const dx=x-384,centre=p.z+dx*p.slope+p.bend*Math.sin(dx*p.frequency);accessDistance=Math.min(accessDistance,Math.abs(z-centre)/Math.sqrt(1+p.slope*p.slope));}
 const clear=smooth(4.6,7.2,accessDistance),crest=1-smooth(435,442,x),toe=1-smooth(423,430,x);
 const cover=body*clear*(1-coast.bedrock)*smooth(414,419,x)*(1-smooth(441,444,x));
 return {group,cover,tussock:cover*(.32+.68*crest),rootToe:cover*toe,accessDistance,bedrock:coast.bedrock,exposure:coast.exposure};
}
