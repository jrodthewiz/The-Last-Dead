// Flat-road arcade vehicle. Simulation coordinates are four-metre cells.
// An oriented footprint is swept in small steps against the existing grid.
export function createHarborVehicle(course) {
  return course?.vehicle ? {...course.vehicle,speed:0,occupied:false,distance:0,interactHeld:false} : null;
}

export function vehicleContains(vehicle,x,y,padding=0) {
  if(!vehicle)return false;
  if(vehicle.collisionFrameAngle!==vehicle.angle){vehicle.collisionFrameAngle=vehicle.angle;vehicle.collisionCos=Math.cos(vehicle.angle);vehicle.collisionSin=Math.sin(vehicle.angle);}
  const dx=x-vehicle.x,dy=y-vehicle.y,c=vehicle.collisionCos,s=vehicle.collisionSin;
  return Math.abs(dx*c+dy*s)<(vehicle.halfLength||.65)+padding &&
    Math.abs(-dx*s+dy*c)<(vehicle.halfWidth||.3)+padding;
}

export function vehicleCanStand(course,v,x,y,angle,canStand) {
  const l=v.halfLength||.65,w=v.halfWidth||.3,c=Math.cos(angle),s=Math.sin(angle);
  for(let a=-l;a<l+.001;a+=l/4)for(let b=-w;b<w+.001;b+=w/2){
    if(!canStand(course,x+a*c-b*s,y+a*s+b*c,.085))return false;
  }
  return true;
}

export function tickHarborVehicle(run,dt,input,environment){return tickGroundVehicle(run,run.vehicle,dt,input,environment);}
export function tickGroundVehicle(run,v,dt,input,{canStand,castRay,groundAt}) {
  if(!v)return false;
  dt=Math.max(0,Math.min(.05,dt));
  const pressed=!!input.interact&&!v.interactHeld;v.interactHeld=!!input.interact;
  if(pressed&&run.health>0) {
    if(v.occupied) {
      if(Math.abs(v.speed)>.3){run.events.push({type:'vehicle-stop-first'});}
      else {
        let exit=null;
        for(const side of [1,-1]){
          const distance=(v.halfWidth||.3)+.35;
          const x=v.x-Math.sin(v.angle)*distance*side,y=v.y+Math.cos(v.angle)*distance*side;
          if(canStand(run.course,x,y,.12)&&castRay(run.course,v.x,v.y,Math.atan2(y-v.y,x-v.x),distance+.1).dist>=distance-.01){exit={x,y};break;}
        }
        if(exit){v.occupied=false;v.speed=0;Object.assign(run,exit,{z:0,vx:0,vy:0,vz:0,speed:0});run.events.push({type:'vehicle-exit'});}
        else run.events.push({type:'vehicle-exit-blocked'});
      }
    } else {
      const distance=Math.hypot(run.x-v.x,run.y-v.y);
      if(run.z<=.3&&distance<1.5&&castRay(run.course,run.x,run.y,Math.atan2(v.y-run.y,v.x-run.x),distance+.1).dist>=distance-.01){
        v.occupied=true;v.speed=0;run.slide=0;run.dashTime=0;run.pitch=0;
        run.rifleBurst=0;run.rifleBurstTimer=0;run.rifleCharge=0;run.rifleCharging=false;
        run.events.push({type:'vehicle-enter'});
      }
    }
  }
  if(!v.occupied)return false;
  const throttle=Math.max(-1,Math.min(1,input.forward||0));
  const braking=!!input.jump||!!input.slide;
  const target=braking?0:throttle*(throttle<0?1.25:3.2);
  v.speed+=(target-v.speed)*(1-Math.exp(-dt*(braking?10:throttle?1.7:2.8)));
  const steer=Math.max(-1,Math.min(1,(input.strafe||0)+(input.turn||0)));
  const deltaAngle=steer*Math.min(1,Math.abs(v.speed)/.65)*Math.sign(v.speed)*dt*1.25;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(v.speed*dt)/.045,Math.abs(deltaAngle)/.03)));
  let travelled=0;
  for(let i=0;i<steps;i++){
    const angle=v.angle+deltaAngle/steps,x=v.x+Math.cos(angle)*v.speed*dt/steps,y=v.y+Math.sin(angle)*v.speed*dt/steps;
    if(!vehicleCanStand(run.course,v,x,y,angle,canStand)){v.speed=0;break;}
    travelled+=Math.hypot(x-v.x,y-v.y);v.x=x;v.y=y;v.angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  }
  v.steering=steer*.48;v.wheelAngle=(v.wheelAngle||0)+travelled*4/.43;v.groundM=groundAt?groundAt(v.x,v.y)*4:0;
  v.distance+=travelled;run.distance+=travelled;
  Object.assign(run,{x:v.x,y:v.y,z:0,angle:v.angle,pitch:0,vx:0,vy:0,vz:0,speed:Math.abs(v.speed),slide:0});
  return true;
}
