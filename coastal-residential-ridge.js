const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export const CAPE_RESIDENTIAL_RIDGE=Object.freeze({extent:Object.freeze([394,446,6,111]),shoulders:Object.freeze([Object.freeze([25,25,4.2]),Object.freeze([84,19,3.1])]),leeX:411,protectedRouteMetres:3,vertexRoutePadding:1.5});

// One coast-parallel bank with an unequal southern/northern shoulder and two
// soil-retaining lee basins. Existing dunes remain subordinate underneath.
// The authoritative mesh is still the same 1m triangulation; the conservative
// route taper keeps every triangle supporting the full 3m bent access exact.
export function capeResidentialRidgeHeight(x,z,accessDistance){
 if(x<=394||x>=446||z<=6||z>=111)return 0;
 const domain=smooth(394,399,x)*(1-smooth(441,446,x))*smooth(6,12,z)*(1-smooth(104,111,z));
 const access=smooth(4.5,12,accessDistance);
 if(!domain||!access)return 0;
 const crest=433-.04*(z-25),width=x<crest?22:14;
 const cross=1-smooth(.08,1,Math.abs(x-crest)/width);
 let ridge=0,hollow=0;
 for(const [centre,length,height]of CAPE_RESIDENTIAL_RIDGE.shoulders){
  const along=1-smooth(.1,1,Math.abs(z-centre)/length);
  ridge=Math.max(ridge,height*cross*along);
  const u=(x-411)/13,v=(z-centre)/length;
  hollow=Math.max(hollow,.45*(1-smooth(.1,1,u*u+v*v)));
 }
 return (ridge-hollow)*domain*access;
}
