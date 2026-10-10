import {CAPE_RESIDENTIAL_SCALAR_OPS} from './coastal-residential-fields.js';
export const CAPE_GROVE_COURT=Object.freeze({pathZ:268,roadX:368,roadWidth:12,
 anchors:Object.freeze([{x:352,z:264,rx:10,rz:5.2},{x:380,z:264,rx:6,rz:7},{x:396,z:266,rx:12,rz:10}].map(Object.freeze))});
export function capeGroveCourtFields(x,z,ops=CAPE_RESIDENTIAL_SCALAR_OPS){
 const {add:A,sub:S,mul:M,div:D,sin:N,abs:B,max:X,smooth:F}=ops;let cover=0;
 for(const p of CAPE_GROVE_COURT.anchors){
  const u=D(A(S(x,p.x),M(.65,N(M(z,.57)))),p.rx),v=D(A(S(z,p.z),M(S(x,p.x),.17)),p.rz);
  cover=X(cover,S(1,F(.24,1.1,A(M(u,u),M(v,v)))));
 }
 const route=F(1.5,2.5,B(S(z,268))),road=F(6.8,8.5,B(S(x,368)));
 return {cover:M(M(cover,route),road),shelter:S(1,F(397,408,x))};
}
const smooth=CAPE_RESIDENTIAL_SCALAR_OPS.smooth;
export const CAPE_COURT_TERRAIN=Object.freeze({mesh:Object.freeze([374,384,248,280]),support:Object.freeze([376,400,248,280]),pathZ:268});
export function capeGroveCourtRelief(x,z){
 if(x<=376||x>=400||z<=248||z>=280)return {height:0,cover:0,litter:1,moss:0,mineral:0};
 const edge=smooth(376,379,x)*(1-smooth(396,400,x))*smooth(248,252,z)*(1-smooth(276,280,z));
 const path=smooth(2.5,3.3,Math.abs(z-268));
 const u=(x-382+(z-262)*.35)/8.5,v=(z-262+.3*Math.sin((x-382)*.32))/3.5;
 const shoulder=1-smooth(.08,1,u*u+v*v);
 const a=(x-381+(z-273)*.22)/7.5,b=(z-273)/3.2,hollow=1-smooth(.1,1,a*a+b*b);
 const height=(.65*shoulder-.20*hollow)*edge*path;
 const cover=Math.max(shoulder,hollow,capeGroveCourtFields(x,z).cover)*edge;
 const moss=hollow*.78,mineral=shoulder*.20*(1-moss),litter=1-moss-mineral;
 return {height,cover,litter,moss,mineral};
}
