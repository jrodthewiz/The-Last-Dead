import {makeCourse,makeCampaignCourse,clamp} from './engine.js';
import {makeDungeonCourse,DUNGEON_LAYERS} from './playground/map/dungeon-course.js';
import {makeHarborCourse} from './harbor-course.js';

// One public campaign. Explicit legacy routes remain available to development
// fixtures; ?debug by itself must still exercise the real player entry point.
export function createSoloCampaignCourse(params=new URLSearchParams()) {
  if(params.has('dungeon')) {
    const floor=clamp(Math.floor(Number(params.get('dungeon'))||0),0,DUNGEON_LAYERS.length-1);
    return makeDungeonCourse(floor,{journey:true,extended:params.get('extended')!=='0'});
  }
  if(params.has('campaign')||params.has('sector')) {
    return makeCampaignCourse(clamp(Math.floor(Number(params.get('sector'))||0),0,2));
  }
  return makeHarborCourse({...makeCourse(),openWorld:params.get('world')!=='harbor',lowTide:params.get('harborMode')!=='salvage'});
}
