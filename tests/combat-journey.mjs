import assert from 'node:assert/strict';
import{makeCourse,newRun,tick,shoot,switchWeapon,look,castRay,eye}from '../engine.js';
const r=newRun(makeCourse());r.mode='play';const stages=new Set();let shots=0;
for(let step=0;step<120*240&&r.mode==='play';step++){
 const live=r.course.enemies.filter(e=>!e.dead),target=live.sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y))[0]||r.course.exit;
 const dx=target.x-r.x,dy=target.y-r.y,d=Math.hypot(dx,dy),aim=Math.atan2(dy,dx),visible=castRay(r.course,r.x,r.y,aim).dist>d-.15;
 let moveAngle=aim;
 if(!visible){const start=[Math.floor(r.x),Math.floor(r.y)],goal=[Math.floor(target.x),Math.floor(target.y)],queue=[start],prev=new Map([[start.join(','),null]]);for(let j=0;j<queue.length;j++){const p=queue[j];if(p[0]===goal[0]&&p[1]===goal[1])break;for(const[qx,qy]of[[1,0],[-1,0],[0,1],[0,-1]]){const q=[p[0]+qx,p[1]+qy],key=q.join(',');if(q[0]<0||q[1]<0||q[0]>=12||q[1]>=12||r.course.cells[q[1]*12+q[0]].every(Boolean)||prev.has(key))continue;prev.set(key,p);queue.push(q);}}let p=goal;while(prev.get(p.join(','))&&prev.get(p.join(',')).join(',')!==start.join(','))p=prev.get(p.join(','));moveAngle=Math.atan2(p[1]+.5-r.y,p[0]+.5-r.x);}
 look(r,Math.atan2(Math.sin(aim-r.angle),Math.cos(aim-r.angle))/.002,(r.pitch-Math.atan2(.3-eye(r),Math.max(.1,d)))/.002);
 if(live.length&&visible){const weapon=d<1.7?1:r.cooldowns[2]===0?2:0;switchWeapon(r,weapon);if(shoot(r))shots++;}
 const velocity=live.length&&d<.65?0:1;
 tick(r,1/120,{forward:Math.cos(moveAngle-r.angle)*velocity,strafe:Math.sin(moveAngle-r.angle)*velocity});r.events.length=0;stages.add(r.wave);
}
const result={mode:r.mode,wave:r.wave,kills:r.kills,health:r.health,time:r.time,shots,waves:[...stages]};console.log(JSON.stringify(result));assert.equal(r.mode,'win','Combat bot must shoot through all waves and physically reach exit');assert.equal(r.kills,18);
