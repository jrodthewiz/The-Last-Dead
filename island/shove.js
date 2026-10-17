import {clearShot} from './simulation.js';
export const SHOVE=Object.freeze({cost:24,range:1.75,contact:.17,duration:.60,cooldown:1.05,stagger:.72});
export function shoveTarget(s,enemies,grid){
 const candidates=enemies.filter(e=>{const dx=e.x-s.x,dz=e.z-s.z,d=Math.hypot(dx,dz),y=e.root?.position.y??e.y??s.y;return e.alive&&!e.finisherHeld&&d<SHOVE.range&&Math.abs(y-s.y)<.6&&(Math.sin(s.yaw)*dx-Math.cos(s.yaw)*dz)/Math.max(.001,d)>.72&&clearShot([s.x,s.y+1.2,s.z],[dx/Math.max(.001,d),0,dz/Math.max(.001,d)],d,grid);});
 return candidates.sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z))[0]||null;
}
export function interruptEnemy(e,s,power=4.2){const d=Math.max(.001,Math.hypot(e.x-s.x,e.z-s.z));e.pushX=(e.x-s.x)/d*power;e.pushZ=(e.z-s.z)/d*power;e.hit=Math.max(e.hit||0,SHOVE.stagger);e.attackTimer=0;e.cooldown=Math.max(e.cooldown||0,SHOVE.cooldown);e.notice=8;e.lastKnown={x:s.x,z:s.z};e.navTimer=0;}
export function stepEnemyImpulse(e,grid,dt){
 const floor=grid.floorAt;if(!floor)return;const vx=e.pushX||0,vz=e.pushZ||0,steps=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.12));
 for(let i=0;i<steps;i++){const y=floor(e.x,e.z),x=e.x+vx*dt/steps,z=e.z+vz*dt/steps,yy=floor(x,z);if(Math.abs(yy-y)<.35&&yy>-.4&&!grid.blocked(x,z,y,.35)){e.x=x;e.z=z;}else{e.pushX=e.pushZ=0;return;}}
 const decay=Math.exp(-9*dt);e.pushX=vx*decay;e.pushZ=vz*decay;
}
