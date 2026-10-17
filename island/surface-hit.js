import {rayBox} from './simulation.js';
// Return an actual collider face plus the free radius before any face edge.
export function surfaceHit(point,direction,range,grid){
 const o=[point.x,point.y,point.z],d=[direction.x,direction.y,direction.z],seen=new Set();let best=null,distance=range;
 for(let t=0;t<=range;t+=8)for(const b of grid.query(o[0]+d[0]*t,o[2]+d[2]*t,9)){
  if(seen.has(b))continue;seen.add(b);const hit=rayBox(o,d,b,distance);if(hit===null||hit<.01)continue;
  const p=o.map((v,i)=>v+d[i]*hit),bounds=[[b.x-b.w/2,b.x+b.w/2],[b.y,b.y+b.h],[b.z-b.d/2,b.z+b.d/2]];let axis=0,side=0,error=Infinity;
  for(let i=0;i<3;i++)for(let j=0;j<2;j++){const gap=Math.abs(p[i]-bounds[i][j]);if(gap<error){axis=i;side=j;error=gap;}}
  const normal=[0,0,0];normal[axis]=side?1:-1;let radius=.32;for(let i=0;i<3;i++)if(i!==axis)radius=Math.min(radius,p[i]-bounds[i][0],bounds[i][1]-p[i]);
  distance=hit;best=radius<.025?null:{point:p,normal,radius:Math.max(0,radius-.012)};
 }return best;
}
