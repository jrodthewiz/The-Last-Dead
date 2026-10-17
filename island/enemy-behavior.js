import {clearShot} from './simulation.js';

export const ENEMY_ROLES={
 shambler:{name:'Shambler',speed:1.8,windup:.68,recovery:1.6,damage:15,runClip:'AshWitness_Chase'},
 runner:{name:'Runner',speed:3.3,windup:.48,recovery:1.35,damage:10,runClip:'AshWitness_Run'},
};
export function hearNoise(enemies,x,z,radius){for(const e of enemies){if(!e.alive)continue;const distance=Math.hypot(e.x-x,e.z-z);if(distance<radius){const changed=!e.lastKnown||Math.hypot(e.lastKnown.x-x,e.lastKnown.z-z)>3||e.notice<=0;e.notice=Math.max(e.notice||0,8);e.lastKnown={x,z};e.heard=true;if(changed)e.navTimer=0;}}}
export function canSeePlayer(e,player,grid){const dx=player.x-e.x,dz=player.z-e.z,dy=player.y-(e.root?.position.y??e.y??player.y),distance=Math.hypot(dx,dz,dy);if(distance>29||Math.abs(dy)>9)return false;if(distance<.01)return true;const yaw=e.root?.rotation.y??e.yaw??0;if(distance>4&&(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/distance<.18)return false;return clearShot([e.x,(e.root?.position.y??e.y??player.y)+1.3,e.z],[dx/distance,dy/distance,dz/distance],distance,grid);}
// Hash neighbours once per update. The snapshots make separation independent
// of which actor happens to update first; no full-world pairwise scan.
export function neighbourField(enemies){const cells=new Map();for(const e of enemies)if(e.alive){const key=Math.floor(e.x/3)+','+Math.floor(e.z/3);if(!cells.has(key))cells.set(key,[]);cells.get(key).push({id:e.id,x:e.x,z:e.z});}return (e)=>{let x=0,z=0;const cx=Math.floor(e.x/3),cz=Math.floor(e.z/3);for(let a=cx-1;a<=cx+1;a++)for(let b=cz-1;b<=cz+1;b++)for(const other of cells.get(a+','+b)||[]){if(other.id===e.id)continue;let dx=e.x-other.x,dz=e.z-other.z,d=Math.hypot(dx,dz);if(d>=1.05)continue;if(d<.001){const sign=e.id<other.id?-1:1;dx=sign;dz=sign*.3;d=1;}const weight=(1.05-Math.min(1,d))*2.6;x+=dx/d*weight;z+=dz/d*weight;}const magnitude=Math.hypot(x,z);if(magnitude>1.5){x*=1.5/magnitude;z*=1.5/magnitude;}return {x,z};};}
export function attackConnects(e,player,grid){const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz),yaw=e.attackYaw??e.root.rotation.y;return d<2&&Math.abs(player.y-e.root.position.y)<2.1&&(d<.01||(Math.sin(yaw)*dx+Math.cos(yaw)*dz)/d>.55)&&clearShot([e.x,e.root.position.y+1,e.z],[dx/Math.max(.001,d),0,dz/Math.max(.001,d)],d,grid);}
