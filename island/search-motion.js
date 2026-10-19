export const SEARCH_DURATION=1.15;
export function searchFocused(s,c){
 const dx=c.x-s.x,dz=c.z-s.z,dy=c.y+.44-s.y-1.7,d=Math.hypot(dx,dy,dz);
 return d<.01||(dx*Math.sin(s.yaw)*Math.cos(s.pitch)+dy*Math.sin(s.pitch)-dz*Math.cos(s.yaw)*Math.cos(s.pitch))/d>.45;
}
const smooth=(t,a,b)=>{const p=Math.max(0,Math.min(1,(t-a)/(b-a)));return p*p*(3-2*p);};
export function punchMotion(time,active){
 const drive=smooth(time,.035,.19)*(1-smooth(time,.23,.49));
 return active?{x:.23-drive*.14,y:-.28+drive*.13,z:-.48-drive*.57,drive}:{x:.23,y:-.25+drive*.015,z:-.43-drive*.035,drive:0};
}
