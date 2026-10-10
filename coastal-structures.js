import {groundAt} from './coastal-terrain.js';

// Horizontal X/Y and vertical Z use the same four-metre cells as simulation.
// Local authored boxes use Three.js [x, verticalY, z] metres at serialization.
const EPS=1e-7;
export const STRUCTURE_STEP=.05,STRUCTURE_BODY_HEIGHT=.46;
const inside=(b,x,y,pad=0)=>x>=b.minX-pad-EPS&&x<=b.maxX+pad+EPS&&y>=b.minY-pad-EPS&&y<=b.maxY+pad+EPS;
const overlap=(s,x,y,r=0)=>Math.hypot(x-Math.max(s.minX,Math.min(s.maxX,x)),y-Math.max(s.minY,Math.min(s.maxY,y)))<r+EPS;

export function serializeStructure(building,plan){
 if(!plan?.structure)return null;
 const c=Math.cos(building.yaw||0),s=Math.sin(building.yaw||0),world=p=>({x:(building.x+p[0]*c+p[2]*s)/4,y:(building.z-p[0]*s+p[2]*c)/4,z:((building.y??.13)+p[1])/4});
 const solids=plan.structure.solids.map(box=>{
  const corners=[];for(const dx of [-1,1])for(const dy of [-1,1])for(const dz of [-1,1])corners.push(world(box.position.map((n,i)=>n+[dx,dy,dz][i]*box.size[i]/2)));
  return{id:box.id,kind:box.kind,support:box.support===true,...Object.fromEntries(['X','Y','Z'].flatMap(axis=>{const values=corners.map(p=>p[axis.toLowerCase()]);return[[`min${axis}`,Math.min(...values)],[`max${axis}`,Math.max(...values)]];}))};
 });
 const footprint=[[-building.width/2,0,-building.depth/2],[-building.width/2,0,building.depth/2],[building.width/2,0,-building.depth/2],[building.width/2,0,building.depth/2]].map(world);
 const bounds={minX:Math.min(...footprint.map(p=>p.x)),maxX:Math.max(...footprint.map(p=>p.x)),minY:Math.min(...footprint.map(p=>p.y)),maxY:Math.max(...footprint.map(p=>p.y)),minZ:Math.min(...solids.map(p=>p.minZ)),maxZ:Math.max(...solids.map(p=>p.maxZ))};
 return{id:building.id,bounds,solids,stairPath:(plan.structure.stairPath||[]).map(world)};
}

export function structureAt(course,x,y,pad=0){return course?.coastal?.structures?.find(s=>inside(s.bounds,x,y,pad))||null;}
export function isStructureWall(course,x,y){return !!structureAt(course,x,y,EPS);}
export function actorGroundAt(course,actor){
 if(Number.isFinite(actor?.supportZ)&&actor.structureId&&course?.coastal?.structures?.some(s=>s.id===actor.structureId))return actor.supportZ;
 return groundAt(course,actor.x,actor.y);
}

export function supportAt(course,x,y,feet,{stepHeight=STRUCTURE_STEP,radius=0,minimum=-Infinity,ceiling=Infinity,terrainFeet=false}={}){
 let result={height:groundAt(course,x,y),id:'terrain',structureId:null};
 // The engine's nullish feet fallback is this same terrain sample. Keep
 // direct callers' undefined/NaN behavior unless they explicitly opt in.
 const limit=Math.min((terrainFeet&&feet==null?result.height:feet)+stepHeight,ceiling);
 for(const structure of course?.coastal?.structures||[]){
  if(!inside(structure.bounds,x,y,radius))continue;
  for(const solid of structure.solids)if(solid.support&&solid.maxZ<=limit+EPS&&solid.maxZ>=minimum-EPS&&solid.maxZ>result.height-EPS&&overlap(solid,x,y,0))result={height:solid.maxZ,id:solid.id,structureId:structure.id};
 }
 return result;
}
export const structureSupportBelow=(course,x,y,feet)=>supportAt(course,x,y,feet,{stepHeight:0}).height;

export function canStandStructure(course,x,y,radius,feet,height=STRUCTURE_BODY_HEIGHT,stepHeight=STRUCTURE_STEP,tryStep=true){
 for(const structure of course?.coastal?.structures||[]){
  if(!inside(structure.bounds,x,y,radius))continue;
  for(const s of structure.solids){
   if(s.maxZ<=feet+EPS||s.minZ>=feet+height-EPS)continue;
   // A reachable tread is stepped over; furniture and rails never get this exemption.
   if(s.support&&s.maxZ<=feet+stepHeight+EPS)continue;
   const dx=x-Math.max(s.minX,Math.min(s.maxX,x)),dy=y-Math.max(s.minY,Math.min(s.maxY,y));
    const bottom=feet+Math.min(radius,height/2),top=feet+height-Math.min(radius,height/2);
    const dz=s.maxZ<bottom?bottom-s.maxZ:s.minZ>top?s.minZ-top:0;
    let blocked=dx*dx+dy*dy+dz*dz<(radius-EPS)**2;
    if(s.kind==='tread'){
     // A broad torso capsule is not a pair of broad feet. On stair risers,
     // retain the full torso radius above the ankles and test a 24cm foot
     // contact below it. Centre-owned tread support still limits each rise.
     const ankleHeight=Math.min(.08,height/3),footRadius=Math.min(radius,.06);
     const torsoRadius=Math.min(radius,(height-ankleHeight)/2);
     const torsoBottom=feet+ankleHeight+torsoRadius,torsoTop=feet+height-torsoRadius;
     const torsoDZ=s.maxZ<torsoBottom?torsoBottom-s.maxZ:s.minZ>torsoTop?s.minZ-torsoTop:0;
     blocked=s.minZ<feet+ankleHeight&&dx*dx+dy*dy<(footRadius-EPS)**2
      ||dx*dx+dy*dy+torsoDZ*torsoDZ<(torsoRadius-EPS)**2;
    }
    if(blocked){
    // A capsule may clear the next riser using one bounded step lift. Floor
    // ownership still comes from its centre, so standing cannot ratchet upward.
    const nearTread=tryStep&&structure.solids.some(t=>t.kind==='tread'&&t.maxZ>feet+EPS&&t.minZ<=feet+stepHeight+EPS&&overlap(t,x,y,radius));
    return nearTread?canStandStructure(course,x,y,radius,feet+stepHeight,height,0,false):false;
   }
  }
 }
 return true;
}

export function resolveActorSupport(course,actor,{radius=.1,stepHeight=STRUCTURE_STEP,airborne=(actor.z||0)>.001||actor.vz>0}={}){
 const previous=actorGroundAt(course,actor),feet=previous+(actor.z||0);
 const support=supportAt(course,actor.x,actor.y,feet,{stepHeight:airborne?0:stepHeight,radius});
 const snap=!airborne&&Math.abs(support.height-feet)<=stepHeight+EPS;
 actor.supportZ=support.height;actor.supportId=support.id;actor.structureId=support.structureId;
 actor.z=snap?0:Math.max(0,feet-support.height);
 actor._supportX=actor.x;actor._supportY=actor.y;
 return support;
}

export function clipStructureRise(course,x,y,from,to,height=STRUCTURE_BODY_HEIGHT,radius=.1){
 if(to<=from)return to;
 let result=to;
 for(const structure of course?.coastal?.structures||[]){
  if(!inside(structure.bounds,x,y,radius))continue;
  for(const solid of structure.solids)if(overlap(solid,x,y,radius)&&from+height<=solid.minZ+EPS&&result+height>solid.minZ)result=Math.min(result,solid.minZ-height);
 }
 return result;
}

function boxRay(s,origin,direction,max){
 let enter=0,leave=max,axis=-1,sign=0;
 for(const [i,key]of ['X','Y','Z'].entries()){
  const d=direction[i],o=origin[i],lo=s[`min${key}`]??-Infinity,hi=s[`max${key}`]??Infinity;
  if(Math.abs(d)<1e-12){if(o<lo-EPS||o>hi+EPS)return null;continue;}
  const a=(lo-o)/d,b=(hi-o)/d,near=Math.min(a,b),far=Math.max(a,b);
  if(near>enter){enter=near;axis=i;sign=d>0?-1:1;}
  leave=Math.min(leave,far);if(enter>leave+EPS)return null;
 }
 if(leave<0||enter>max+EPS||leave<=EPS&&enter<=EPS)return null;
 const normal={x:0,y:0,z:0};if(axis>=0)normal[['x','y','z'][axis]]=sign;
 return{dist:Math.max(0,enter),side:axis===1?1:0,normal,kind:s.kind,solidId:s.id,surface:axis===2?'floor':'wall'};
}
export function traceStructureRay(course,x,y,z,angle,slope,max=24){
 let hit=null;const direction=[Math.cos(angle),Math.sin(angle),slope];
 for(const structure of course?.coastal?.structures||[]){
  if(!boxRay(structure.bounds,[x,y,z],direction,hit?.dist??max))continue;
  for(const solid of structure.solids){const found=boxRay(solid,[x,y,z],direction,hit?.dist??max);if(found&&(!hit||found.dist<hit.dist))hit={...found,structureId:structure.id,u:0};}
 }
 return hit;
}
export function traceStructureSegment(course,from,to){
 let hit=null;const direction=[to.x-from.x,to.y-from.y,to.z-from.z];
 for(const structure of course?.coastal?.structures||[]){
  if(!boxRay(structure.bounds,[from.x,from.y,from.z],direction,hit?.dist??1))continue;
  for(const solid of structure.solids){const found=boxRay(solid,[from.x,from.y,from.z],direction,hit?.dist??1);if(found&&(!hit||found.dist<hit.dist))hit={...found,structureId:structure.id};}
 }
 return hit&&{...hit,t:hit.dist,x:from.x+direction[0]*hit.dist,y:from.y+direction[1]*hit.dist,z:from.z+direction[2]*hit.dist};
}

export function stairWaypoint(course,actor,target){
 // Keep the existing world navigation until the actor actually reaches the
 // house; a distant upstairs target must not pull it straight through town walls.
 const structure=course?.coastal?.structures?.find(s=>s.id===actor.structureId)||structureAt(course,actor.x,actor.y);
 const path=structure?.stairPath;if(!path?.length)return null;
 const from=actorGroundAt(course,actor),to=actorGroundAt(course,target),direction=Math.sign(to-from);
 if(Math.abs(to-from)<.03){actor.stairIndex=null;return null;}
 if(direction!==actor.stairDirection||!Number.isInteger(actor.stairIndex)){
  actor.stairDirection=direction;
  const ordered=path.map((p,i)=>({p,i})).filter(({p})=>Math.abs(p.z-from)<.07);
  actor.stairIndex=ordered.length?ordered.sort((a,b)=>Math.hypot(a.p.x-actor.x,a.p.y-actor.y)-Math.hypot(b.p.x-actor.x,b.p.y-actor.y))[0].i:direction>0?0:path.length-1;
 }
 let point=path[actor.stairIndex];
 if(Math.hypot(point.x-actor.x,point.y-actor.y)<.075&&Math.abs(point.z-from)<.07){actor.stairIndex=Math.max(0,Math.min(path.length-1,actor.stairIndex+direction));point=path[actor.stairIndex];}
 return point;
}
