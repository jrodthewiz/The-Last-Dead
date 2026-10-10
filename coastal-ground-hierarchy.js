import {capeRidgeHabitatFields} from './coastal-ridge-habitat.js';
// Pure surface construction. Inputs are sampled from the existing ground and
// actual planted trees; this module never adds relief or a placement authority.
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const partition=(duff,moss,heath,mineral)=>{
 const weights=[duff,moss,heath,mineral].map(clamp),sum=weights.reduce((a,b)=>a+b,0);
 return sum?weights.map(v=>v/sum):[1,0,0,0];
};

export function residentialGroundHierarchy({x,z,coast,natural,saltwood,canopy,slope,curvature}){
 const roots=clamp(Math.max(canopy.pine||0,canopy.birch||0,canopy.cover||0)*1.35);
 const shelter=clamp(Math.max(saltwood.canopy*.85,roots));
 const toe=clamp(natural.wetness*.90+smooth(.015,.13,curvature)*shelter*.36);
 const mineral=clamp(coast.bedrock*.90+coast.trace*.68+(1-shelter)*coast.exposure*.14);
 const moss=clamp(toe*.82+shelter*.23*(1-smooth(.08,.28,slope)));
 const heath=natural.heath*(1-shelter)*(1-toe)*(.38+coast.exposure*.32);
 const duff=.20+shelter*1.12;
 const habitat=Number.isFinite(x)&&Number.isFinite(z)?capeRidgeHabitatFields(x,z):{cover:0,rootToe:0};
 const retained=habitat.cover*.78,rootRetention=habitat.rootToe*(.25+shelter*.65+toe*.10);
 return {weights:partition(duff*(1-mineral)*(1-retained)+rootRetention*.45,moss*(1-mineral)+rootRetention*.42,heath*(1-mineral)+retained*(1-rootRetention),mineral*(1-retained*.65)),
  shelter,roots,toe,mineral,organic:clamp(shelter+toe*.7)};
}

export const CAPE_OUTER_WASH=Object.freeze({source:Object.freeze([399,393]),outlet:Object.freeze([382,413]),extent:Object.freeze([374,407,391,416])});
export function outerBankGroundHierarchy(x,z,{canopy,slope,curvature,gx,gz}){
 const dx=x-399,dz=z-393,length=Math.hypot(17,20),ux=-17/length,uz=20/length;
 const along=dx*ux+dz*uz,cross=-dx*uz+dz*ux;
 const edge=smooth(374,379,x)*(1-smooth(403,407,x))*smooth(391,395,z)*(1-smooth(414,416,z));
 const run=smooth(-2,1,along)*(1-smooth(24,29,along));
 const width=2.0+clamp(along/length)*4.7;
 const fan=(1-smooth(width*.60,width+1.8,Math.abs(cross)))*run*edge;
 const gradient=Math.hypot(gx,gz),downhill=gradient>.001?clamp(-(gx*ux+gz*uz)/gradient):0;
 const roots=clamp(Math.max(canopy.pine||0,canopy.birch||0,canopy.cover||0)*1.35);
 // Unequal continuous ribs emerge from the same source and fan downslope.
 // Root catchments interrupt their bare mineral, rather than stamping dots.
 const rib=Math.max(1-smooth(.35,1.35,Math.abs(cross)),
  (1-smooth(.20,1.0,Math.abs(cross-width*.48)))*.72,
  (1-smooth(.20,1.2,Math.abs(cross+width*.34)))*.50);
 const convex=1-smooth(-.05,.05,curvature),toe=smooth(13,24,along);
 const mineral=clamp(rib*(.25+.48*downhill)*(.5+.5*convex)*(1-roots*.80)*(1-toe*.58));
 const moss=clamp(.16+toe*.56+smooth(.005,.12,curvature)*.22+roots*.12);
 return {cover:fan,weights:partition((.42+roots*.88)*(1-mineral),moss*(1-mineral),0,mineral),
  sourceDistance:along,crossDistance:cross,downhill,roots,mineral,moss,toe};
}
