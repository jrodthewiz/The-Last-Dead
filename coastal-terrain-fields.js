import {capeGroundHeight,capePathMask,capeStreamZ,capeStreamWidth,capeStreamLevel,CAPE_TERRAIN} from './coastal-terrain.js';

const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,z)=>((Math.imul(x,374761393)^Math.imul(z,668265263)^60941)>>>0)/4294967295;
function soilPatch(x,z){
  // A single twelve-metre soil domain; no sub-grid noise in the one-metre mesh.
  const u=x/12,v=z/12,i=Math.floor(u),j=Math.floor(v),a=smooth(0,1,u-i),b=smooth(0,1,v-j);
  return (hash(i,j)*(1-a)+hash(i+1,j)*a)*(1-b)+(hash(i,j+1)*(1-a)+hash(i+1,j+1)*a)*b;
}

// World XZ metres own every channel. These fields describe the existing physical
// terrain; they never displace it or substitute a second ground authority.
export function capeSurfaceFields(x,z){
  const height=capeGroundHeight(x,z,{bridges:false}),path=capePathMask(x,z);
  const dx=(capeGroundHeight(x+.5,z,{bridges:false})-capeGroundHeight(x-.5,z,{bridges:false}));
  const dz=(capeGroundHeight(x,z+.5,{bridges:false})-capeGroundHeight(x,z-.5,{bridges:false}));
  const slope=1-1/Math.sqrt(1+dx*dx+dz*dz);
  const riverReach=x>=CAPE_TERRAIN.minX&&x<=432&&z>325;
  const bankDistance=riverReach?Math.abs(z-capeStreamZ(x))-capeStreamWidth(x):1000;
  const bank=riverReach?(1-smooth(3,8,bankDistance))*smooth(-.4,.7,bankDistance):0;
  const wetness=riverReach?(1-smooth(.08,.85,height-capeStreamLevel(x)))*(1-smooth(2,6,bankDistance)):0;
  const woodland=Math.max(smooth(314,334,z),smooth(380,402,x));
  const patch=soilPatch(x,z);
  const exposedStone=clamp(smooth(.035,.17,slope)*.85+bank*smooth(.28,.7,patch)*.62)*(1-path);
  const leafLitter=woodland*smooth(.32,.78,patch)*(1-path)*(1-wetness);
  return {height,path,slope,bankDistance,bank,wetness,woodland,patch,exposedStone,leafLitter};
}

export function capeDetailClear(x,z,radius=0){
  if(x<130+radius||x>446-radius||z<316+radius||z>414-radius)return false;
  for(const [dx,dz]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]]){
    const f=capeSurfaceFields(x+dx,z+dz);
    if(f.path>.015||f.bankDistance<.65)return false;
    for(const bx of CAPE_TERRAIN.bridges)if(Math.abs(x+dx-bx)<3.1&&Math.abs(z+dz-capeStreamZ(bx))<12)return false;
  }
  return true;
}
