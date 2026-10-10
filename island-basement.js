import {newRun,canStand} from './engine.js';
import {makeDungeonCourse} from './playground/map/dungeon-course.js';
import {attachBasementReturn} from './island-basement-layout.js';
import {makeHarborCourse} from './harbor-course.js';
import {createJourney} from './campaign-journey.js';
export {ISLAND_BASEMENT_STAIR,attachIslandBasement,attachBasementReturn} from './island-basement-layout.js';

// The island and the authored descent have independent simulation state.
// Keep each live run in memory so returning never rebuilds cleared rooms.
export function basementPrompt(run,device='keyboard') {
  const p=basementPortalAt(run);
  if(!p||run.mode!=='play'||run.health<=0||(run.activeVehicle?.occupied||run.vehicle?.occupied)||run.course.activeInterior||run.z>.3||Math.hypot(run.x-p.x,run.y-p.y)>p.radius)return null;
  const key=device==='gamepad'?'VIEW':device==='touch'?'USE':'E / Q';
  const label=p.destination==='basement'?'DESCEND TO CUSTOMS BASEMENT':p.destination==='lower-floor'?`DESCEND TO BASEMENT ${run.course.dungeonIndex+2}`:p.destination==='upper-floor'?`RETURN TO BASEMENT ${run.course.dungeonIndex}`:'CLIMB TO BLACKWATER ISLAND';
  return {text:`${key} · ${label}`,available:true,progress:0};
}
function basementPortalAt(run) {
  const c=run?.course;
  if(c?.undergroundCampaign&&run.dungeonProgression?.exitReady&&c.dungeonIndex+1<c.dungeonCount&&Math.hypot(run.x-c.exit.x,run.y-c.exit.y)<.9)return {...c.exit,radius:.9,destination:'lower-floor'};
  return c?.basementPortal;
}
const sharedFields=['health','energy','weapon','ownedWeapons','backpack','storyRecords','playerWounds','kills','style','styleTotal','stylePending','styleLabel','rank','combo','bestCombo','cooldowns','fireCooldown','altCooldown','attachmentCooldown','hookCooldown','parryCooldown','coinCharges','coinRegen','extractions','extractionPoints','shotSequence','autoRun'];
export class IslandBasementConnection {
  constructor(){this.reset();}
  reset(){this.island=null;this.basement=null;this.floors=new Map();this.lastInteract=false;}
  start(run,{restore}={}) {
    if(!run.course.undergroundCampaign)return;
    this.basement=run;this.floors.set(run.course.dungeonIndex,run);
    this.island=newRun(makeHarborCourse(run.course.surfaceOptions));
    this.island.mode='play';
    if(restore?.(this.island))for(const field of ['backpack','ownedWeapons'])run[field]=this.island[field];
    // A restored surface save belongs to Netmakers, but this arrival uses the
    // customs stairs. Keep its mission/equipment while leaving that room scope.
    this.island.course.activeInterior=null;
  }
  surfaceForSave(run) {
    if(!this.island)return run;
    if(run!==this.island)for(const field of sharedFields)this.island[field]=run[field];
    return this.island;
  }
  transition(run,{connected=false}={}) {
    if(connected||!basementPrompt(run)||run.bite?.phase!=='idle'||run.brutal?.phase!=='idle'||run.extraction?.phase!=='idle')return null;
    const portal=basementPortalAt(run),destination=portal.destination;
    if(run.course.dungeon){this.basement=run;this.floors.set(run.course.dungeonIndex,run);}else this.island=run;
    const index=destination==='basement'?0:destination==='lower-floor'?run.course.dungeonIndex+1:run.course.dungeonIndex-1;
    let target=destination==='island'?this.island:this.floors.get(index);
    if(!target&&destination==='island')target=newRun(makeHarborCourse(run.course.surfaceOptions||{openWorld:true,lowTide:true}));
    if(!target&&destination!=='island'){
      const course=makeDungeonCourse(index,{journey:true,extended:true});
      course.undergroundCampaign=true;course.surfaceOptions=run.course.surfaceOptions||{openWorld:true,lowTide:!!this.island?.lowTide};
      target=newRun(attachBasementReturn(course));
      if(destination==='lower-floor'){
        target.journey=createJourney(course,run.journey);
        target.dungeonProgression.startIndex=run.dungeonProgression.startIndex;
        target.dungeonProgression.floorsCleared=(run.dungeonProgression.floorsCleared||0)+1;
      }
    }
    if(!target)return null;
    attachBasementReturn(target.course.dungeon?target.course:null);
    const p=destination==='upper-floor'?{...target.course.exit,arrivalAngle:Math.atan2(target.course.playerSpawn.y-target.course.exit.y,target.course.playerSpawn.x-target.course.exit.x)}:target.course.basementPortal;
    const arrivalX=p?.x+(p?.arrivalOffset?.[0]??0),arrivalY=p?.y+(p?.arrivalOffset?.[1]??0);
    if(!p||!canStand(target.course,arrivalX,arrivalY,.22))return null;
    for(const field of sharedFields)target[field]=run[field];
    Object.assign(target,{x:arrivalX,y:arrivalY,z:0,angle:p.arrivalAngle??p.angle??0,pitch:0,vx:0,vy:0,vz:0,speed:0,supportZ:null,supportId:null,structureId:null,mode:'play',events:[],pressed:{},aim:0,slide:0,dashTime:0,hookTime:0,hookTarget:-1,meleeActive:false,sawActive:false});
    if(target.course.dungeon){this.basement=target;this.floors.set(target.course.dungeonIndex,target);}else this.island=target;
    this.lastInteract=true;
    return target;
  }
  update(run,interact,options) {
    // Holding an interaction across a load must not bounce between areas.
    const pressed=interact&&!this.lastInteract;this.lastInteract=!!interact;
    return pressed?this.transition(run,options):null;
  }
}
