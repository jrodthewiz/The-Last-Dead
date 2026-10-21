import {clearShot} from './simulation.js';

export const CRIMSON={contact:.24,extract:.68,release:1.10,duration:1.60,cost:15,range:2.05};
export function inCrimsonReach(player,e,grid){
 const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz);
 if(d>.0&&d<=CRIMSON.range&&Math.abs(e.root.position.y-player.y)<.65&&(dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/d>.82){
  const dy=e.root.position.y+1.2-(player.y+1.7),length=Math.hypot(dx,dy,dz);
  return clearShot([player.x,player.y+1.7,player.z],[dx/length,dy/length,dz/length],length,grid);
 }return false;
}
export function crimsonCandidate(player,enemies,grid){if(player.stamina<CRIMSON.cost)return null;return enemies.filter(e=>e.alive&&!e.finisherHeld&&!e.remoteHeld&&e.health<=45&&e.crimsonWindow>0&&inCrimsonReach(player,e,grid)).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0]||null;}
// Crossings, rather than sampled equality, fire each authored event once.
export function advanceCrimson(action,dt,valid=true){
 const events=[];if(!valid)return ['cancel'];const before=action.time;action.time+=dt;
 for(const [key,at]of [['contact',CRIMSON.contact],['extract',CRIMSON.extract],['release',CRIMSON.release],['finish',CRIMSON.duration]])if(before<at&&action.time>=at){events.push(key);if(key==='contact')action.contacted=true;}
 return events;
}
