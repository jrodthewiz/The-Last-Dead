// Static source direction. Separate existing light/map owners stay intact.
const source=Object.freeze([45,88,-45]),length=Math.hypot(...source);
const direction=Object.freeze(source.map(v=>v/length));
const horizontalLength=Math.hypot(direction[0],direction[2]);
export const COASTAL_DAYLIGHT=Object.freeze({source,direction,
 horizontal:Object.freeze([direction[0]/horizontalLength,direction[2]/horizontalLength]),skyOpening:.10});
export const COASTAL_DAYLIGHT_GLSL=direction.map(v=>v.toFixed(12)).join(',');

// Call after the authored target/position and before shadow coverage captures
// its basis. No resources/vectors are allocated; preserve the owner's length.
export function alignCoastalDaylight(light){
 const p=light.position,t=light.target.position,d=COASTAL_DAYLIGHT.direction;
 const distance=Math.hypot(p.x-t.x,p.y-t.y,p.z-t.z);
 p.set(t.x+d[0]*distance,t.y+d[1]*distance,t.z+d[2]*distance);
 return distance;
}
