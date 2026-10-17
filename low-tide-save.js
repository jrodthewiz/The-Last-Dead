import {createLowTide} from './low-tide.js';
import {validateBackpack} from './scavenger-pack.js';
export const LOW_TIDE_SAVE_KEY='thelastdead.low-tide.v1';
// Save only whitelisted progression and equipment. Transient combat, room,
// camera, input and vehicle occupancy never cross a checkpoint boundary.
export function lowTideSnapshot(run) {
  if(!run.lowTide?.shelter)return null;
  const rooms={};for(const room of run.course.harborRooms)rooms[room.id]=Math.min(2,Math.max(0,Number(run.harborRooms?.[room.id])||0));
  return {version:1,mission:createLowTide(run.lowTide),backpack:validateBackpack(run.backpack),
    owned:[...new Set(run.ownedWeapons)].filter(n=>Number.isInteger(n)&&n>=0&&n<8),weapon:run.weapon,rooms};
}
export function restoreLowTide(run,value) {
  if(!run.lowTide||value?.version!==1||!value.mission?.shelter)return false;
  const mission=createLowTide(value.mission);if(!mission.shelter)return false;
  run.lowTide=mission;run.backpack=validateBackpack(value.backpack);
  run.ownedWeapons=[...new Set([0,...(Array.isArray(value.owned)?value.owned:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<8)])];
  // Old saves have no box or equipped slot. Corrupt duplicates stay in the pack.
  mission.stash.weapons=mission.stash.weapons.filter(n=>!run.ownedWeapons.includes(n));
  for(const key of Object.keys(mission.stash.weaponMods))if(!mission.stash.weapons.includes(Number(key)))delete mission.stash.weaponMods[key];
  run.weapon=run.ownedWeapons.includes(value.weapon)?value.weapon:0;
  for(const key of Object.keys(run.backpack.weaponMods))if(!run.ownedWeapons.includes(Number(key)))delete run.backpack.weaponMods[key];
  run.harborRooms={};for(const room of run.course.harborRooms)run.harborRooms[room.id]=Math.min(2,Math.max(0,Math.floor(Number(value.rooms?.[room.id])||0)));
  const home=run.course.harborRooms[3];run.course.activeInterior=home;
  Object.assign(run,home.spawn,{z:0,angle:-Math.PI/2,pitch:0,vx:0,vy:0,vz:0});
  return true;
}
export function createLowTideSave(storage) {
  let last='',lastRun=null,memory=null,lastSaved=false;
  return {
    load(run){try{const raw=memory||storage.getItem(LOW_TIDE_SAVE_KEY);if(raw&&raw.length>64000)throw Error('Invalid checkpoint');const restored=raw?restoreLowTide(run,JSON.parse(raw)):false;run.lowTideSaveStatus=restored?'Checkpoint restored at Netmakers':'Claim Netmakers to begin saving';lastRun=run;last='';return restored;}catch{run.lowTideSaveStatus='Checkpoint unavailable · progress remains in this session';return false;}},
    save(run){if(!run.lowTide||!['play','pause'].includes(run.mode)||run.health<=0)return false;
      const value=lowTideSnapshot(run);if(!value)return false;
      // Bell phase is transient; don't write localStorage every simulation tick.
      value.mission.bellRemaining=value.mission.powered&&!value.mission.answered?24:0;
      const text=JSON.stringify(value);memory=text;if(lastRun===run&&text===last&&lastSaved)return true;
      last=text;lastRun=run;
      try{storage.setItem(LOW_TIDE_SAVE_KEY,text);lastSaved=true;run.lowTideSaveStatus='Saved · resume at Netmakers';return true;}
      catch{lastSaved=false;run.lowTideSaveStatus='Save unavailable · keep this session open';return false;}
    },
  };
}
