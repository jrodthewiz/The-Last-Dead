import {MathUtils} from '../vendor/three.module.js';
import {createLookSway} from './look-sway.js';
// Presentation only. Never writes aim, movement, collision or damage state.
export function createFirstPersonMotion(){let sprint=0,wall=0,lastFeet=null,stepOffset=0,wasGrounded=false;const stride={phase:0,weight:0},sway=createLookSway();return {stride,
 advance({distance=0,speed=0,onGround=false,sprinting=false},dt){
  if(onGround)stride.phase=(stride.phase+distance*Math.PI*2/(sprinting?2.6:2.1))%(Math.PI*4);
  stride.weight=MathUtils.damp(stride.weight,onGround?MathUtils.clamp(speed/5.2,0,1):0,16,dt);
 },
 eyeHeight(feet,grounded,dt,ceiling=Infinity){
  const rise=lastFeet===null?0:feet-lastFeet;
  if(grounded&&wasGrounded&&Math.abs(rise)<.45)stepOffset=MathUtils.clamp(stepOffset-rise,-.28,.45);
  if(!grounded||!wasGrounded||Math.abs(rise)>.45)stepOffset=0;
  stepOffset=MathUtils.damp(stepOffset,0,stepOffset>0?12:14,dt);lastFeet=feet;wasGrounded=grounded;
  const eye=Math.min(feet+1.7+stepOffset,ceiling);stepOffset=eye-feet-1.7;return eye;
 },update(rifle,arsenal,{dt,yaw,pitch,sprinting,landing,aim,reload,wallDistance,motion}){
 const offset=sway.update(yaw,pitch,dt,motion,arsenal.visible);
 sprint=MathUtils.damp(sprint,sprinting&&aim<.1&&reload<=0?1:0,9,dt);wall=MathUtils.damp(wall,MathUtils.clamp((.9-wallDistance)/.65,0,1),14,dt);
 arsenal.position.set(0,0,0);arsenal.rotation.set(0,0,0);
 for(const root of [rifle,arsenal]){root.position.y-=wall*.13+(motion?sprint*.055+landing*.045:0);root.position.z+=wall*.13;root.rotation.x+=wall*.22+(motion?sprint*.12:0);root.rotation.z+=motion?sprint*.035:0;}
 arsenal.position.x+=offset.x*(1-aim*.9);arsenal.position.y+=offset.y*(1-aim*.9);
 },reset(){sprint=wall=stepOffset=stride.phase=stride.weight=0;lastFeet=null;wasGrounded=false;sway.reset();}};}
