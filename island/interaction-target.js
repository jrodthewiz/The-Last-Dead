import {clearShot} from './simulation.js';
export function canReachPickup(player,target,grid,radius=2.6){
 const dx=target.x-player.x,dz=target.z-player.z,d=Math.hypot(dx,dz);if(d>=radius||Math.abs(player.y-target.y)>3)return false;
 if(d>.65&&(dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/d<.25)return false;
 const origin=[player.x,player.y+1.7,player.z],dy=target.y+.5-origin[1],length=Math.hypot(dx,dy,dz);if(length<.01)return true;
 return clearShot(origin,[dx/length,dy/length,dz/length],Math.max(0,length-.05),grid);
}
