import {METERS,eye,castRay} from './engine.js';

export const FIREARM_EVENTS=new Set(['shot','rocket','rifle-charge']);
const ENEMY_SOUNDS=new Set(['moan','enemy-attack','enemyattack','enemyjump','enemyland','horror-approach']);
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const localId=run=>run?.playerId||'host';
const courseOf=run=>run?.course||run?.world?.course;
const enemyById=(id,run)=>id==null?null:(courseOf(run)?.enemies||[]).find(enemy=>String(enemy.id)===String(id))||null;
const alive=entity=>!!entity&&!entity.dead&&!entity.extracted&&entity.mode!=='dead'&&!(Number.isFinite(entity.health)&&entity.health<=0)&&!(Number.isFinite(entity.hp)&&entity.hp<=0);
const positioned=entity=>Number.isFinite(entity?.x)&&Number.isFinite(entity?.y);
const worldPosition=entity=>({x:entity.x*METERS,y:finite(entity.z)*METERS,z:entity.y*METERS});

// Map rays stay in simulation cells. Panners and distance profiles use metres.
function occluded(run,x,y){
  if(!Number.isFinite(run?.x)||!Number.isFinite(run?.y))return false;
  const distance=Math.hypot(x-run.x,y-run.y),course=courseOf(run);
  if(distance<=.12||!course?.cells||!Number.isFinite(course.w)||!Number.isFinite(course.h))return false;
  try{return castRay(course,run.x,run.y,Math.atan2(y-run.y,x-run.x),distance).dist<distance-.12;}
  catch{return true;}
}

/** Player ears: +pitch looks up; angle zero faces +X, with right toward +Z. */
export function listenerPose(run={}){
  const angle=finite(run.angle),pitch=finite(run.pitch),ca=Math.cos(angle),sa=Math.sin(angle),cp=Math.cos(pitch),sp=Math.sin(pitch);
  return {x:finite(run.x)*METERS,y:eye({z:finite(run.z),slide:finite(run.slide)})*METERS,z:finite(run.y)*METERS,
    forwardX:ca*cp,forwardY:sp,forwardZ:sa*cp,upX:-ca*sp,upY:cp,upZ:-sa*sp};
}

function peerById(id,run){
  const peer=run?.peer;if(!peer)return null;
  const peerId=peer.playerId||(localId(run)==='host'?'peer':'host');
  return String(peerId)===String(id)?peer:null;
}

/** Create listener-relative playback details without writing the event. */
export function eventAudioDetails(event={},run={},ownerId=localId(run)){
  const details={...event},type=event.type;
  details.id=event.id??event.enemyId??event.projectileId;
  // A caller cannot accidentally make an impact or a finished shot follow an
  // actor by carrying a track key from another event.
  delete details.trackKey;
  if(FIREARM_EVENTS.has(type)){
    details.playerId=event.playerId||ownerId;
    if(details.playerId===localId(run)){
      details.position=null;details.occluded=false;return details;
    }
  }
  const enemy=ENEMY_SOUNDS.has(type)?enemyById(event.enemyId,run):null;
  const source=positioned(event)?event:positioned(enemy)?enemy:null;
  if(source){
    // Retain a cue's authored vertical anchor when its missing ground
    // coordinates are recovered from the current enemy record.
    const z=Number.isFinite(event.z)?event.z:finite(source.z);
    details.position={x:source.x*METERS,y:z*METERS,z:source.y*METERS};
    details.occluded=occluded(run,source.x,source.y);
  }else if(event.position&&Number.isFinite(event.position.x)&&Number.isFinite(event.position.y)&&Number.isFinite(event.position.z)){
    details.position={...event.position};
    details.occluded=occluded(run,event.position.x/METERS,event.position.z/METERS);
  }
  if(enemy&&alive(enemy)&&positioned(enemy)){
    details.trackKey=`enemy:${enemy.id}`;
    details.trackOffsetY=(details.position?.y??0)-finite(enemy.z)*METERS;
  }
  else if(type==='rifle-charge'){
    const peer=peerById(details.playerId,run);
    if(alive(peer)&&positioned(peer)){
      details.trackKey=`peer:${details.playerId}`;
      if(!source){details.position=worldPosition(peer);details.occluded=occluded(run,peer.x,peer.y);}
      details.trackOffsetY=(details.position?.y??0)-finite(peer.z)*METERS;
    }
  }
  return details;
}

/** Current actor body position; callers may retain their cue's height offset. */
export function resolveAudioTrack(key,run={}){
  if(typeof key!=='string')return null;
  const separator=key.indexOf(':');if(separator<0||separator===key.length-1)return null;
  const kind=key.slice(0,separator),id=key.slice(separator+1);
  const entity=kind==='enemy'?enemyById(id,run):kind==='peer'?peerById(id,run):null;
  if(!alive(entity)||!positioned(entity))return null;
  return {position:worldPosition(entity),occluded:occluded(run,entity.x,entity.y)};
}

/** Authoritative echoes must not replay the local shooter's predicted sound. */
export function isPredictedFirearmEcho(event,localPlayerId){
  return !!localPlayerId&&FIREARM_EVENTS.has(event?.type)&&event.playerId===localPlayerId;
}
