import {capeResidentialRidgeHeight} from './coastal-residential-ridge.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};

// A shared natural landform, independent of renderer or movement modules.
// Broad wind-stretched shoulders have a longer lee slope and unequal crests;
// shallow peat basins and embedded slate interrupt them. Worn access stays flat.
export function capeResidentialNaturalFields(x,z,{residentialRidge=true}={}){
 const coast=capeResidentialCoastFields(x,z),heath=capeWindwardHeathFields(x,z);
 const domain=smooth(389,399,x)*(1-smooth(443,448,x))*smooth(0,7,z)*(1-smooth(111,120,z));
 let dune=0,hollow=0,clearance=1,accessDistance=Infinity;
 for(const [i,p]of CAPE_WINDWARD_HEATH_BEDS.entries()){
  const dx=x-p.x,dz=z-p.z,u=dx+dz*.35,v=dz;
  const rx=[12,10,14,11][i],rz=[16,14,19,13][i],height=[1.55,1.25,1.8,1.15][i];
  const cross=1-smooth(.12,1.05,Math.abs(u)/(u>0?rx*.7:rx));
  const length=1-smooth(.30,1.05,Math.abs(v)/rz);
  dune=Math.max(dune,height*cross*length*(.86+.14*Math.sin(v*.27+i)));
 }
 for(const [cx,cz,rx,rz]of [[422,30,9,8],[420,87,10,9]]){
  const u=(x-cx+(z-cz)*.25)/rx,v=(z-cz)/rz;
  hollow=Math.max(hollow,1-smooth(.10,1.1,u*u+v*v));
 }
 for(const p of CAPE_RESIDENTIAL_TRANSITION.traces){
  const dx=x-384,centre=p.z+dx*p.slope+p.bend*Math.sin(dx*p.frequency);
  const distance=Math.abs(z-centre)/Math.sqrt(1+p.slope*p.slope);
  accessDistance=Math.min(accessDistance,distance);
  clearance=Math.min(clearance,smooth(2.8,9,distance));
 }
 const height=(dune*(1-coast.bedrock*.85)+coast.bedrock*.10-hollow*.22)*domain*clearance;
 return {height:height+(residentialRidge?capeResidentialRidgeHeight(x,z,accessDistance):0),domain,wetness:hollow*domain*clearance,stone:coast.bedrock*domain,heath:heath.cover};
}

export const CAPE_RESIDENTIAL_TRANSITION=Object.freeze({
 extent:Object.freeze([384,448,0,120]),strike:Object.freeze([.94,.342]),
 slate:Object.freeze([{x:438,z:28,rx:8.5,rz:2.5},{x:441,z:94,rx:12.5,rz:2}].map(p=>Object.freeze(p))),
 traces:Object.freeze([{z:56,slope:.22,bend:2,frequency:.085},{z:112,slope:-.20,bend:-2,frequency:.065}].map(p=>Object.freeze(p))),
});
export const CAPE_RESIDENTIAL_SCALAR_OPS=Object.freeze({add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,div:(a,b)=>a/b,sin:Math.sin,abs:Math.abs,max:Math.max,smooth});
export const CAPE_WINDWARD_HEATH_BEDS=Object.freeze([
 {x:433,z:16,rx:6.5,rz:9},{x:436,z:43,rx:6,rz:7.5},
 {x:431,z:75,rx:8,rz:10},{x:436,z:103,rx:5.8,rz:6.3},
].map(p=>Object.freeze(p)));
export function capeWindwardHeathFields(x,z,ops=CAPE_RESIDENTIAL_SCALAR_OPS){
 const {add:A,sub:S,mul:M,div:D,sin:N,max:X,smooth:F}=ops;
 let cover=0;
 for(const p of CAPE_WINDWARD_HEATH_BEDS){
  const dx=S(x,p.x),dz=S(z,p.z),u=D(A(dx,M(.85,N(A(M(z,.34),M(p.z,.1))))),p.rx),v=D(A(dz,M(dx,.35)),p.rz);
  cover=X(cover,S(1,F(.25,1.12,A(M(u,u),M(v,v)))));
 }
 const coast=capeResidentialCoastFields(x,z,ops);
 const domain=M(M(F(421,425,x),S(1,F(441,445,x))),M(F(2,5,z),S(1,F(111,116,z))));
 return {cover:M(M(M(cover,domain),S(1,M(coast.bedrock,.85))),S(1,coast.trace)),exposure:coast.exposure};
}
export function capeResidentialCoastFields(x,z,ops=CAPE_RESIDENTIAL_SCALAR_OPS){
 const {add:A,sub:S,mul:M,div:D,sin:N,abs:B,max:X,smooth:F}=ops;
 const domain=M(M(F(384,395,x),S(1,F(444,448,x))),M(F(0,5,z),S(1,F(115,120,z))));
 const exposure=F(416,446,x);let bedrock=0,trace=0;
 for(const p of CAPE_RESIDENTIAL_TRANSITION.slate){
  const dx=S(x,p.x),dz=S(z,p.z),u=A(M(dx,.94),M(dz,.342)),v=A(M(dx,-.342),M(dz,.94)),nu=D(u,p.rx),nv=D(v,p.rz);
  bedrock=X(bedrock,S(1,F(.25,1.1,A(M(nu,nu),M(nv,nv)))));
 }
 for(const p of CAPE_RESIDENTIAL_TRANSITION.traces){
  const dx=S(x,384),centre=A(A(p.z,M(dx,p.slope)),M(p.bend,N(M(dx,p.frequency))));
  trace=X(trace,M(M(S(1,F(.75,2.4,B(S(z,centre)))),S(1,F(433,445,x))),F(383,385,x)));
 }
 const spine=A(A(410,M(4,N(M(z,.045)))),M(1.5,N(M(z,.11))));
 const lee=S(1,F(5,13,B(S(x,spine))));
 const shelter=A(.62,M(.38,N(A(M(z,.081),N(M(x,.047))))));
 const scrub=M(M(M(domain,lee),shelter),M(S(1,M(exposure,.8)),S(1,trace)));
 return {domain,exposure,bedrock:M(bedrock,domain),scrub,trace:M(M(trace,F(-1,2,z)),S(1,F(118,121,z)))};
}
