import {newRun,canStand} from './engine.js';
import {makeDungeonCourse} from './playground/map/dungeon-course.js';
import {attachBasementReturn} from './island-basement-layout.js';
export {ISLAND_BASEMENT_STAIR,attachIslandBasement,attachBasementReturn} from './island-basement-layout.js';

// The island and the authored descent have independent simulation state.
// Keep each live run in memory so returning never rebuilds cleared rooms.
export function basementPrompt(run,device='keyboard') {
  const p=run?.course?.basementPortal;
  if(!p||run.mode!=='play'||run.health<=0||run.vehicle?.occupied||run.course.activeInterior||run.z>.3||Math.hypot(run.x-p.x,run.y-p.y)>p.radius)return null;
  const key=device==='gamepad'?'VIEW':device==='touch'?'USE':'E / Q';
  return {text:`${key} · ${p.destination==='basement'?'DESCEND TO CUSTOMS BASEMENT':'CLIMB TO BLACKWATER ISLAND'}`,available:true,progress:0};
}
const sharedFields=['health','energy','weapon','ownedWeapons','backpack','storyRecords','playerWounds','kills','style','styleTotal','stylePending','styleLabel','rank','combo','bestCombo','cooldowns','fireCooldown','altCooldown','attachmentCooldown','hookCooldown','parryCooldown','coinCharges','coinRegen','extractions','extractionPoints','shotSequence','autoRun'];
export class IslandBasementConnection {
  constructor(){this.reset();}
  reset(){this.island=null;this.basement=null;this.lastInteract=false;}
  transition(run,{connected=false}={}) {
    if(connected||!basementPrompt(run)||run.bite?.phase!=='idle'||run.brutal?.phase!=='idle'||run.extraction?.phase!=='idle')return null;
    const descending=run.course.basementPortal.destination==='basement';
    if(descending)this.island=run;else this.basement=run;
    let target=descending?this.basement:this.island;
    if(!target&&descending)target=newRun(attachBasementReturn(makeDungeonCourse(0,{journey:true,extended:true})));
    if(!target)return null;
    attachBasementReturn(target.course.dungeon?target.course:null);
    const p=target.course.basementPortal;
    if(!p||!canStand(target.course,p.x,p.y,.22))return null;
    for(const field of sharedFields)target[field]=run[field];
    Object.assign(target,{x:p.x,y:p.y,z:0,angle:p.angle??0,pitch:0,vx:0,vy:0,vz:0,speed:0,supportZ:null,supportId:null,structureId:null,mode:'play',events:[],pressed:{},aim:0,slide:0,dashTime:0,hookTime:0,hookTarget:-1,meleeActive:false,sawActive:false});
    if(descending)this.basement=target;else this.island=target;
    this.lastInteract=true;
    return target;
  }
  update(run,interact,options) {
    // Holding an interaction across a load must not bounce between areas.
    const pressed=interact&&!this.lastInteract;this.lastInteract=!!interact;
    return pressed?this.transition(run,options):null;
  }
}
