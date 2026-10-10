import {registerImmutablePropObstacles} from './harbor-collision.js';
import {tickGroundVehicle} from './harbor-vehicle.js';
import {createHarborHelicopter,tickHarborHelicopter} from './harbor-helicopter.js';
import {createHelicopterWorldCollision} from './helicopter-world-collision.js';
const WRECK_IDS=new Set(['street-main-16-resident','street-works-46-delivery','street-saltwind-38-resident','street-works-69-service']);
export const isBurntVehicleId=id=>WRECK_IDS.has(id);
export function createVehicleFleet(course,truck){
 const cars=(course.coastal?.maritime?.cars||[]).filter(p=>!WRECK_IDS.has(p.id)).map(p=>({id:p.id,kind:p.kind,type:'car',x:p.x/4,y:p.z/4,angle:-p.yaw,groundM:0,visualBaseM:p.y,speed:0,occupied:false,distance:0,interactHeld:false,halfLength:p.length/8,halfWidth:p.width/8,heightM:p.kind==='van'?2.5:2.2,steering:0,wheelAngle:0,home:{x:p.x/4,y:p.z/4,angle:-p.yaw}}));
 const helicopter=course.coastal?createHarborHelicopter():null,vehicles=[...(truck?[truck]:[]),...cars,...(helicopter?[helicopter]:[])];
 if(truck){truck.type='truck';truck.heightM=2.8;truck.home={x:truck.x,y:truck.y,angle:truck.angle};}
 return {cars,helicopter,vehicles,activeId:null,interactHeld:false,revision:0,diagnostics:{cars:cars.length,wrecks:WRECK_IDS.size,helicopters:helicopter?1:0,updates:0,footQueries:0,rayQueries:0,dynamicCandidates:0,dynamicBoundsRejected:0,dynamicFootNarrow:0,dynamicRayNarrow:0,dynamicPoseRefreshes:0,dynamicTrigRefreshes:0}};
}
export function getActiveVehicle(run){return run.vehicleFleet?.vehicles.find(v=>v.id===run.vehicleFleet.activeId)||run.activeVehicle||(run.vehicle?.occupied?run.vehicle:null);}
const queryPoses=new WeakMap();
function queryPose(v,diagnostics){
 let p=queryPoses.get(v);if(!p){p={};queryPoses.set(v,p);}
 const l=v.halfLength||.65,w=v.halfWidth||.3;
 if(p.angle!==v.angle){p.angle=v.angle;p.c=Math.cos(v.angle);p.s=Math.sin(v.angle);diagnostics.dynamicTrigRefreshes++;p.dirty=true;}
 // Actual pose values, rather than revision, are authority even for direct
 // snapshot/test/recovery mutations between two queries in the same tick.
 if(p.dirty||p.x!==v.x||p.y!==v.y||p.l!==l||p.w!==w){
  p.x=v.x;p.y=v.y;p.l=l;p.w=w;p.ex=Math.abs(p.c)*l+Math.abs(p.s)*w;p.ey=Math.abs(p.s)*l+Math.abs(p.c)*w;p.padding=Math.abs(p.c)+Math.abs(p.s);p.dirty=false;diagnostics.dynamicPoseRefreshes++;
 }
 return p;
}
function footprintClear(fleet,x,y,r,ignoreId,feetM=0,heightM=1.7){
 const d=fleet.diagnostics;
 for(const v of fleet.vehicles){
  if(v.id===ignoreId)continue;const bottom=v.type==='helicopter'?v.altitudeM:(v.groundM||0),top=bottom+(v.heightM||2.8);
  if(top<=feetM+.02||bottom>=feetM+heightM)continue;
  d.dynamicCandidates++;const p=queryPose(v,d),dx=x-p.x,dy=y-p.y,pad=r*p.padding;
  if(Math.abs(dx)>p.ex+pad+1e-12||Math.abs(dy)>p.ey+pad+1e-12){d.dynamicBoundsRejected++;continue;}
  d.dynamicFootNarrow++;
  if(Math.abs(dx*p.c+dy*p.s)<p.l+r&&Math.abs(-dx*p.s+dy*p.c)<p.w+r)return false;
 }
 return true;
}
function dynamicRay(fleet,x,y,angle,max,zM,slope,ignoreId){
 if(max<0)return null;
 let hitId,hitDistance=Infinity;const dx=Math.cos(angle),dy=Math.sin(angle),endX=x+dx*max,endY=y+dy*max,
  minX=Math.min(x,endX),maxX=Math.max(x,endX),minY=Math.min(y,endY),maxY=Math.max(y,endY),d=fleet.diagnostics;
 for(const v of fleet.vehicles){
  if(v.id===ignoreId)continue;d.dynamicCandidates++;const p=queryPose(v,d);
  if(maxX<p.x-p.ex-1e-12||minX>p.x+p.ex+1e-12||maxY<p.y-p.ey-1e-12||minY>p.y+p.ey+1e-12){d.dynamicBoundsRejected++;continue;}
  d.dynamicRayNarrow++;
  const ox=(x-p.x)*p.c+(y-p.y)*p.s,oy=-(x-p.x)*p.s+(y-p.y)*p.c,vx=dx*p.c+dy*p.s,vy=-dx*p.s+dy*p.c;
  let near=0,far=max;
  if(Math.abs(vx)<1e-10){if(Math.abs(ox)>p.l)continue;}else{let a=(-p.l-ox)/vx,b=(p.l-ox)/vx;if(a>b){const t=a;a=b;b=t;}near=Math.max(near,a);far=Math.min(far,b);}
  if(Math.abs(vy)<1e-10){if(Math.abs(oy)>p.w)continue;}else{let a=(-p.w-oy)/vy,b=(p.w-oy)/vy;if(a>b){const t=a;a=b;b=t;}near=Math.max(near,a);far=Math.min(far,b);}
  if(far<near||far<0||near>max)continue;
  const dist=Math.max(.02,near),h=zM+slope*dist*4,bottom=v.type==='helicopter'?v.altitudeM:(v.groundM||0);
  if(h<bottom||h>bottom+(v.heightM||2.8))continue;
  if(dist<hitDistance){hitDistance=dist;hitId=v.id;}
 }
 return hitId===undefined?null:{dist:hitDistance,side:0,u:0,obstacleId:hitId,dynamicVehicle:true};
}
function borrowCourseView(source,obstacles){
 const view=Object.create(source),privateKeys=new Set(['obstacles','vehiclePhysics','activeInterior']);
 for(const key of Reflect.ownKeys(source))if(!privateKeys.has(key))Object.defineProperty(view,key,{enumerable:Object.getOwnPropertyDescriptor(source,key).enumerable,configurable:true,get:()=>source[key],set:value=>{source[key]=value;}});
 Object.defineProperties(view,{obstacles:{value:obstacles,enumerable:true},vehiclePhysics:{value:undefined,writable:true,enumerable:true},activeInterior:{value:source.activeInterior??null,writable:true,configurable:true,enumerable:true}});
 return view;
}
export function createVehiclePhysicsContext(course,fleet,{canStand,castRay,groundAt}){
 // An already-bound view can be cloned by deterministic QA/co-op setup. Its
 // immutable source authority remains shared, never the previous run's fleet.
 course=course.vehiclePhysics?.course||course;
 const usable=new Set(fleet.cars.map(v=>v.id)),obstacles=course.obstacles.filter(o=>!usable.has(o.id)),staticCourse=borrowCourseView(course,obstacles),facade=borrowCourseView(course,obstacles);registerImmutablePropObstacles(staticCourse);registerImmutablePropObstacles(facade);Object.defineProperty(staticCourse,'activeInterior',{enumerable:true,get:()=>facade.activeInterior});
 const staticStand=(x,y,r=.1,feet,height)=>canStand(staticCourse,x,y,r,feet,height);
 const stand=(x,y,r=.1,feet,height,ignoreId)=>{fleet.diagnostics.footQueries++;return staticStand(x,y,r,feet,height)&&footprintClear(fleet,x,y,r,ignoreId,(feet??groundAt(course,x,y))*4,(height??.43)*4);};
 const ray=(x,y,angle,max=24,z,slope=0,ignoreId)=>{fleet.diagnostics.rayQueries++;const a=course.coastal&&ignoreId&&z!==undefined&&z*4>groundAt(course,x,y)*4+3.2?aerial.ray(x*4,y*4,angle,max*4,z*4,slope,ignoreId):castRay(staticCourse,x,y,angle,max,z,slope),b=dynamicRay(fleet,x,y,angle,a.dist,(z??groundAt(course,x,y)+.4)*4,slope,ignoreId);return b&&b.dist<a.dist?b:a;};
 const aerial=course.coastal?createHelicopterWorldCollision(course,fleet):null;const context={course,staticCourse,facade,fleet,staticStand,stand,ray,groundAt:(x,y)=>groundAt(course,x,y),aerial,dispose(){aerial?.dispose();},forVehicle(v){return {canStand:(_course,x,y,r,feet,height)=>stand(x,y,r,feet,height,v.id),castRay:(_course,x,y,a,m,z,s)=>ray(x,y,a,m,z,s,v.id),groundAt:this.groundAt};}};facade.vehiclePhysics=context;return context;
}
export function vehicleWorldCanStand(run,x,y,r=.1,feet,height,baseCanStand){return run.vehiclePhysics?run.vehiclePhysics.stand(x,y,r,feet,height,getActiveVehicle(run)?.occupied?getActiveVehicle(run).id:undefined):baseCanStand(run.course,x,y,r,feet,height);}
export function vehicleWorldCastRay(run,x,y,a,max=24,z,slope=0,baseCastRay){return run.vehiclePhysics?run.vehiclePhysics.ray(x,y,a,max,z,slope,getActiveVehicle(run)?.occupied?getActiveVehicle(run).id:undefined):baseCastRay(run.course,x,y,a,max,z,slope);}
export function tickVehicleFleet(run,dt,input,context=run.vehiclePhysics){const f=run.vehicleFleet;if(!f||!context)return false;f.diagnostics.updates++;if(f.helicopter&&!f.helicopter.occupied&&f.helicopter.rotorSpeed>.0001){const h=f.helicopter;f.revision++;h.rotorSpeed*=Math.exp(-Math.min(.05,dt)*3);h.rotorAngle=(h.rotorAngle+h.rotorSpeed*38*Math.min(.05,dt))%(Math.PI*2);}const pressed=!!input.interact&&!f.interactHeld;f.interactHeld=!!input.interact;let active=getActiveVehicle(run),newlyEntered=false;
 if(!active?.occupied&&pressed&&run.health>0){let best=null,dist=Infinity;for(const v of f.vehicles){const d=Math.hypot(run.x-v.x,run.y-v.y);if(v.occupied||d>=1.5||d>=dist||run.z>.3||v.type==='helicopter'&&!v.landed)continue;if(context.ray(run.x,run.y,Math.atan2(v.y-run.y,v.x-run.x),d+.1,undefined,0,v.id).dist<d-.01)continue;best=v;dist=d;}if(best){best.occupied=true;best.speed=0;best.interactHeld=true;f.activeId=best.id;run.activeVehicle=best;run.slide=0;run.dashTime=0;run.pitch=0;run.rifleBurst=0;run.rifleCharging=false;run.events.push({type:'vehicle-enter',vehicleId:best.id,vehicleType:best.type,label:best.type==='helicopter'?'UTILITY HELICOPTER':best.type==='truck'?'DOCK TRUCK':'STREET '+best.kind.toUpperCase()});active=best;newlyEntered=true;}}
 if(!active?.occupied){run.activeVehicle=null;return false;}
 const beforeX=active.x,beforeY=active.y,beforeAngle=active.angle,beforeAltitude=active.altitudeM;if(active.type==='helicopter')tickHarborHelicopter(run,active,dt,{...input,interact:pressed&&!newlyEntered},context);else tickGroundVehicle(run,active,dt,{...input,interact:pressed&&!newlyEntered},context.forVehicle(active));
 if(beforeX!==active.x||beforeY!==active.y||beforeAngle!==active.angle||beforeAltitude!==active.altitudeM)f.revision++;if(!active.occupied){f.activeId=null;run.activeVehicle=null;}return true;
}
export function snapshotVehicleFleet(fleet){return {activeId:fleet.activeId,vehicles:fleet.vehicles.map(v=>({id:v.id,x:v.x,y:v.y,angle:v.angle,speed:v.speed,occupied:v.occupied,distance:v.distance,altitudeM:v.altitudeM,verticalSpeed:v.verticalSpeed,landed:v.landed,rotorSpeed:v.rotorSpeed,rotorAngle:v.rotorAngle,pitch:v.pitch,roll:v.roll,vxM:v.vxM,vzM:v.vzM,damage:v.damage,groundM:v.groundM,steering:v.steering,wheelAngle:v.wheelAngle}))};}
export function restoreVehicleFleet(fleet,snapshot){
 if(!snapshot||!Array.isArray(snapshot.vehicles)||snapshot.vehicles.length!==fleet.vehicles.length)return false;
 const seen=new Set(),keys=['x','y','angle','speed','distance','altitudeM','verticalSpeed','rotorSpeed','rotorAngle','pitch','roll','vxM','vzM','damage','groundM','steering','wheelAngle'];
 for(const p of snapshot.vehicles){if(seen.has(p.id)||!fleet.vehicles.some(v=>v.id===p.id)||!['x','y','angle','speed','distance'].every(k=>Number.isFinite(p[k]))||keys.some(k=>p[k]!==undefined&&!Number.isFinite(p[k])))return false;seen.add(p.id);}
 if(snapshot.activeId!==null&&!seen.has(snapshot.activeId))return false;
 for(const p of snapshot.vehicles){const v=fleet.vehicles.find(t=>t.id===p.id);for(const k of keys)if(p[k]!==undefined)v[k]=p[k];v.occupied=p.id===snapshot.activeId;v.interactHeld=false;if(v.type==='helicopter')v.landed=!!p.landed;}
 fleet.activeId=snapshot.activeId;fleet.revision++;return true;
}
export function resetVehicleFleet(run){const f=run.vehicleFleet;if(!f)return;for(const v of f.vehicles){Object.assign(v,v.home,{speed:0,occupied:false,distance:0,interactHeld:false});if(v.type==='helicopter')Object.assign(v,{altitudeM:0,verticalSpeed:0,vxM:0,vzM:0,pitch:0,roll:0,rotorSpeed:0,rotorAngle:0,landed:true,damage:0});}f.activeId=null;f.interactHeld=false;f.revision++;run.activeVehicle=null;}

// Explicit recovery action, never a collision fallback. Restores the authored
// staging pose only after the same static/dynamic clearance checks.
export function recoverVehicle(run,id=getActiveVehicle(run)?.id){
 const f=run.vehicleFleet,context=run.vehiclePhysics,v=f?.vehicles.find(v=>v.id===id);if(!v||!context)return false;
 const {x,y,angle}=v.home;let ground=context.groundAt(x,y)*4;
 if(v.type==='helicopter'){ground=context.aerial.landing(x*4,y*4,angle);if(ground===null||context.aerial.blocked(x*4,y*4,ground,angle,v.id))return false;}
 else{const c=Math.cos(angle),s=Math.sin(angle),l=v.halfLength||.65,w=v.halfWidth||.3;for(let a=-l;a<=l+.001;a+=l/4)for(let b=-w;b<=w+.001;b+=w/2)if(!context.stand(x+a*c-b*s,y+a*s+b*c,.085,undefined,undefined,v.id))return false;}
 Object.assign(v,{x,y,angle,speed:0,groundM:ground,steering:0,wheelAngle:0,damage:0,interactHeld:false});if(v.type==='helicopter')Object.assign(v,{altitudeM:ground,verticalSpeed:0,vxM:0,vzM:0,pitch:0,roll:0,rotorSpeed:0,rotorAngle:0,landed:true,impactHeld:false});
 if(v.occupied)Object.assign(run,{x,y,z:0,angle,pitch:0,vx:0,vy:0,vz:0,speed:0,supportId:null,supportZ:null,structureId:null});
 f.revision++;run.events.push({type:'vehicle-recovered',vehicleId:v.id});return true;
}
