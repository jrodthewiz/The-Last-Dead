export const ISLAND_BASEMENT_STAIR=Object.freeze({id:'customs-service-stair',x:10.5,y:7,angle:Math.PI,arrivalAngle:Math.PI/2,arrivalOffset:Object.freeze([.35,0]),radius:1.1,label:'CUSTOMS / BELOW GROUND'});
export function attachIslandBasement(course) {
  if(!course?.harbor||!course.coastal)return course;
  course.basementPortal={...ISLAND_BASEMENT_STAIR,destination:'basement'};
  // Street-side route marker avoids the narrow stair's blocked coarse cell.
  if(!course.coastal.landmarks.some(p=>p.id===ISLAND_BASEMENT_STAIR.id))course.coastal.landmarks.push({id:ISLAND_BASEMENT_STAIR.id,name:'Customs basement / service stairs',x:11.25,y:7});
  for(const p of [{id:'north',x:40,z:26.6,w:4.4,d:.25},{id:'south',x:40,z:29.4,w:4.4,d:.25},{id:'back',x:37.9,z:28,w:.25,d:3}]){
    const id=`customs-service-stair-${p.id}`;
    if(!course.obstacles.some(o=>o.id===id))course.obstacles.push({id,minX:(p.x-p.w/2)/4,maxX:(p.x+p.w/2)/4,minY:(p.z-p.d/2)/4,maxY:(p.z+p.d/2)/4});
  }
  return course;
}
export function attachBasementReturn(course) {
  if(course?.dungeon)course.basementPortal={id:'customs-return-stair',...course.playerSpawn,radius:1.1,destination:course.undergroundCampaign&&course.dungeonIndex>0?'upper-floor':'island',label:course.undergroundCampaign&&course.dungeonIndex>0?'LIFT / UPPER BASEMENT':'STAIRS / BLACKWATER ISLAND'};
  return course;
}
