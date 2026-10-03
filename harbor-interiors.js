import {vehicleContains} from './harbor-vehicle.js';
// Door-linked interiors preserve the exterior simulation and inventory in place.
export function makeHarborRooms(course){
 return course.buildings.map((b,i)=>{
  const x=(b.x+3)*4,z=(b.y+3)*4;
  const room={id:b.id,name:['CUSTOMS RECORDS','COLD STORE BREAK ROOM','FERRY REPAIR OFFICE','NETMAKERS STORE','POWER CONTROL ROOM','DOCK DISPATCH'][i],x:i===4?x-8:x,z:i===3?b.y*4+4:z,width:i===4?6:i===3?12:10,depth:i===3?6:12};
  room.door=i===3?{x:x/4,y:(b.y*4+9.1)/4}:i===4?{x:(b.x*4-1.2)/4,y:z/4}:{x:b.x+1.5,y:b.y+b.h+.3};
  room.spawn={x:room.x/4,y:(room.z+room.depth/2-1.4)/4};
  room.exit={...room.spawn};room.cache={x:(room.x+room.width/2-2)/4,y:(room.z-room.depth/2+2)/4};
  room.obstacles=[{id:`${room.id}-desk`,minX:(room.x-room.width/2+.6)/4,maxX:(room.x-room.width/2+2.8)/4,minY:(room.z-.7)/4,maxY:(room.z+.7)/4}];
  const solid=(x,z,w,d)=>room.obstacles.push({minX:(x-w/2)/4,maxX:(x+w/2)/4,minY:(z-d/2)/4,maxY:(z+d/2)/4});
  solid(room.x-room.width/2+1.7,room.z+(room.depth<8?1.25:-1.45),.65,.65);
  for(let j=0;j<2+i%2;j++)solid(room.x-room.width/2+1+j*.85,room.z-room.depth/2+1,.65,.65);
  solid(room.cache.x*4,room.cache.y*4,.75,.8);
  if(room.width>=10&&room.depth>=8){solid(room.x+room.width/2-1.7,room.z+1.5,2.2,1.4);solid(room.x+room.width/2-1.7,room.z+2.7,.65,.65);}
  return room;
 });
}
export function harborRoomSupplies(run,id){const collected=run.harborRooms?.[id];return Math.max(0,2-(collected===true?2:Number(collected)||0));}
export function harborRoomAt(course,x,y){const r=course.activeInterior;return r&&x>=(r.x-r.width/2)/4&&x<=(r.x+r.width/2)/4&&y>=(r.z-r.depth/2)/4&&y<=(r.z+r.depth/2)/4?r:null;}
export function harborRoomPrompt(run){
 if(!run.course?.harbor||run.vehicle?.occupied)return null;
 const r=run.course.activeInterior;
 if(r){
  if(Math.hypot(run.x-r.exit.x,run.y-r.exit.y)<.65)return {kind:'exit',room:r,label:'Q · RETURN TO HARBOR'};
  if(Math.hypot(run.x-r.cache.x,run.y-r.cache.y)<.7)return {kind:'search',room:r,label:!harborRoomSupplies(run,r.id)?'SUPPLIES SEARCHED':run.backpack.scrap>=run.backpack.capacity?'BACKPACK FULL':'Q · SEARCH TOOL SUPPLIES'};
  return null;
 }
 const room=run.course.harborRooms?.find(r=>Math.hypot(run.x-r.door.x,run.y-r.door.y)<.65);
 return room?{kind:'enter',room,label:`Q · ENTER ${room.name}`}:null;
}
export function roomCollision(room){
 const x=(room.x-room.width/2)/4,y=(room.z-room.depth/2)/4,xx=(room.x+room.width/2)/4,yy=(room.z+room.depth/2)/4;
 return {obstacles:[...room.obstacles,{minX:x-.1,maxX:x,minY:y-.1,maxY:yy+.1},{minX:xx,maxX:xx+.1,minY:y-.1,maxY:yy+.1},{minX:x,maxX:xx,minY:y-.1,maxY:y},{minX:x,maxX:xx,minY:yy,maxY:yy+.1}]};
}
export function tickHarborRoom(run,input,env={}){
 const pressed=!!input.interact&&!run.roomInteractHeld;run.roomInteractHeld=!!input.interact;
 if(!pressed||run.vehicle?.occupied||run.z>.3)return false;
 const action=harborRoomPrompt(run);if(!action)return false;
 const room=action.room;
 if(action.kind==='search'){
  const remaining=harborRoomSupplies(run,room.id);if(!remaining)return true;
  const amount=Math.min(remaining,Math.max(0,run.backpack.capacity-run.backpack.scrap));
  if(amount){run.backpack.scrap+=amount;(run.harborRooms??={})[room.id]=2-remaining+amount;run.events.push({type:'harbor-room-salvage',amount});}
 }else{
  let point=room.spawn;
  if(action.kind==='exit'){
   point=[[0,0],[.5,0],[-.5,0],[0,.5],[0,-.5]].map(([dx,dy])=>({x:room.door.x+dx,y:room.door.y+dy})).find(p=>(!env.canStand||env.canStand(run.course,p.x,p.y,.12))&&!vehicleContains(run.vehicle,p.x,p.y,.15));
   if(!point)return true;
  }
  run.course.activeInterior=action.kind==='enter'?room:null;
  Object.assign(run,point,{z:0,vx:0,vy:0,vz:0,speed:0,slide:0,dashTime:0,angle:action.kind==='enter'?-Math.PI/2:Math.PI/2,pitch:0});
  run.events.push({type:action.kind==='enter'?'harbor-room-enter':'harbor-room-exit',room:room.id});
 }
 if(run.vehicle)run.vehicle.interactHeld=true;
 return true;
}
