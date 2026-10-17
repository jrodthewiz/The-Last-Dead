import {MathUtils} from '../vendor/three.module.js';

// Angular velocity in radians/second, with the original 60 Hz amplitude.
// Hidden rigs discard history so returning after a turn cannot kick the gun.
export function createLookSway({response=12,xGain=.23/60,yGain=.18/60,maxRate=3}={}){
 let yaw=null,pitch=0;const offset={x:0,y:0};
 return {update(nextYaw,nextPitch,dt,enabled=true,visible=true){
   if(!visible){this.reset();return offset;}
   const valid=yaw!==null&&dt>0&&dt<=.1;
   const dx=valid?Math.atan2(Math.sin(nextYaw-yaw),Math.cos(nextYaw-yaw))/dt:0,dy=valid?(nextPitch-pitch)/dt:0;
   yaw=nextYaw;pitch=nextPitch;
   if(!enabled){offset.x=offset.y=0;return offset;}
   offset.x=MathUtils.damp(offset.x,MathUtils.clamp(dx,-maxRate,maxRate)*xGain,response,dt);
   offset.y=MathUtils.damp(offset.y,MathUtils.clamp(dy,-maxRate,maxRate)*yGain,response,dt);
   return offset;
 },reset(){yaw=null;pitch=offset.x=offset.y=0;}};
}
