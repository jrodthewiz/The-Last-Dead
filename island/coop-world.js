import * as T from '../vendor/three.module.js';
import {ExpeditionConnection} from './coop-client.js';
import {createCoopUI} from './coop-ui.js';
import {createMeshySurvivor} from '../assets/survivor/meshy-survivor.js';
import {stylizeModel} from './retro-materials.js';
import {dressSurvivor} from './character-craft.js';
import {captureWeaponVisual} from '../chest-finisher-visuals.js';
import {batchFieldWeapon} from './field-weapon-batches.js';
import {setEnemyAction} from './actors.js';
import {supportCorpse} from './corpse-support.js';
import {clearShot} from './simulation.js';
import {WEAPONS} from './armory-state.js';
import {hearNoise} from './enemy-behavior.js';
import {SHOVE,shoveTarget,interruptEnemy} from './shove.js';
import {CRIMSON,crimsonCandidate,inCrimsonReach} from './close-combat.js';
const round=n=>Math.round(n*1000)/1000;
export const validCoopPose=p=>p&&['x','y','z','yaw','health'].every(k=>Number.isFinite(p[k]))&&Math.abs(p.x)<1400&&Math.abs(p.z)<900&&p.y>-10&&p.y<500&&p.health>=0&&p.health<=100;
const union=(a,b)=>[...new Set([...a,...b])];
export function createCoopWorld({scene,gltf,actors,rifle,armory,getState,getGrid,getMode,getVehicle,enterVehicle,cancelGrab,begin,returnTitle,unlock,notify,wound,takeDamage,feedback}){
 let started=false,remotePose=null,receivedAt=0,lastShot=0,events=[],eventId=0,ack=0,damage=0,receivedDamage=0,weaponId='',weaponVisual=null,remoteMoving=0,remoteVehicle=-1,vehicleSeq=0,localShot=0;
 const avatar=createMeshySurvivor(gltf.scene,gltf.animations);stylizeModel(avatar);dressSurvivor(avatar,{operator:true});const box=new T.Box3().setFromObject(avatar),scale=1.83/(box.max.y-box.min.y),base=-box.min.y*scale;avatar.scale.setScalar(scale);avatar.visible=false;scene.add(avatar);
 const indicator=document.createElement('div');indicator.id='coop-status';indicator.hidden=true;document.body.append(indicator);
 const enemyMap=new Map(actors.enemies.map(e=>[e.id,e])),targets=new Map(),weaponCache=new Map(),p=new T.Vector3(),direction=new T.Vector3();let latest=null;
 let remoteGrab=null,grabDecision=null,grabRequest=null,lastShove=-Infinity,lastNoise=-Infinity,vehicleOwner=-1,vehicleGrant=null,vehicleRequest=null,vehicleAck=0,lastDriven=null,releaseId=0,stepNoise=0;
 const connection=new ExpeditionConnection({packet:packet,onUpdate:receive,onEnd:message=>{returnTitle();reset();notify(message,8);}});
 const ui=createCoopUI(connection,{open(){unlock();},close(){returnTitle();}});
 function pose(){const s=getState();return{x:round(s.x),y:round(s.y),z:round(s.z),yaw:round(s.yaw),pitch:round(s.pitch),health:s.health,weapon:s.weapon,shot:localShot,moving:remoteMoving,vehicle:remoteVehicle};}
 function packet(){const s=getState(),out={v:1,pose:pose()};if(!started)return out;
  if(connection.role==='host')Object.assign(out,{ack,damage,progress:{relays:s.relays,fuse:s.fuse,generatorReady:s.generatorReady,won:s.won,kills:s.kills},time:s.time,enemies:actors.enemies.map(e=>[e.id,round(e.x),round(e.root.position.y),round(e.z),round(e.root.rotation.y),e.health,e.state,round(e.crimsonWindow||0),!!e.finisherHeld]),vehicles:actors.vehicles.map(v=>[round(v.x),round(v.z),round(v.angle)]),vehicleAck,vehicleGrant,grabDecision});
  else Object.assign(out,{events,vehicle:lastDriven});
  return out;
 }
 function releaseGrab(){if(remoteGrab){const e=remoteGrab.enemy;e.finisherHeld=false;if(!e.alive)setEnemyAction(e,'dead');remoteGrab=null;}}
 function reset(){releaseGrab();started=false;remotePose=null;events=[];eventId=ack=damage=receivedDamage=lastShot=vehicleSeq=vehicleAck=releaseId=stepNoise=0;remoteVehicle=vehicleOwner=-1;vehicleGrant=vehicleRequest=lastDriven=grabDecision=grabRequest=null;targets.clear();for(const e of actors.enemies)e.remoteHeld=false;avatar.visible=false;if(weaponVisual)weaponVisual.visible=false;indicator.hidden=true;ui.hide();}
 function receive(result){ui.update(result);if(result.error)return;if(result.status==='playing'&&!started){started=true;ui.hide();begin(false);if(connection.role==='guest'){const s=getState();s.x+=2.4;}notify('Two survivors. Restore the signal together.',6);}
  if(!started)return;const net=result.packet;if(net?.v!==1)return;
  if(validCoopPose(net.pose)){remotePose=net.pose;receivedAt=performance.now();}
  if(connection.role==='host'){
   if(!result.connected){remotePose=null;avatar.visible=false;releaseGrab();vehicleOwner=-1;}
   for(const event of Array.isArray(net.events)?net.events.slice(0,64):[]){if(!Number.isSafeInteger(event.id)||event.id<=ack)continue;ack=event.id;
    if(event.kind==='wound'&&remotePose&&remotePose.health>0){const e=enemyMap.get(event.enemy),w=WEAPONS.find(w=>w.id===event.weapon);if(!e?.alive||!w||!Number.isFinite(event.amount)||event.amount<=0)continue;
     const distance=Math.hypot(remotePose.x-e.x,remotePose.z-e.z),finisher=event.amount===999&&remoteGrab?.enemy===e&&e.health<=45&&distance<3.4,range=event.punch?2.8:w.range+(w.kind==='rocket'?6:1);
     if(distance>range+2||(!finisher&&event.amount>(event.punch?35:(w.head||w.damage)*Math.max(1,w.pellets||1))*2))continue;
     const from=[remotePose.x,remotePose.y+1.5,remotePose.z],to=new T.Vector3(e.x-from[0],e.root.position.y+1.1-from[1],e.z-from[2]),length=to.length();if(!clearShot(from,to.normalize().toArray(),length,getGrid()))continue;
     wound(e,event.amount,new T.Vector3(e.x,e.root.position.y+1.2,e.z),true,event.heavy);if(event.punch||w.kind==='melee')interruptEnemy(e,remotePose,event.punch?2.2:3.4);
    }
    if(event.kind==='noise'&&remotePose&&performance.now()-lastNoise>25){lastNoise=performance.now();hearNoise(actors.enemies,remotePose.x,remotePose.z,Math.max(0,Math.min(90,Number(event.radius)||0)));}
    if(event.kind==='shove'&&remotePose&&performance.now()-lastShove>SHOVE.cooldown*1000){const e=shoveTarget(remotePose,actors.enemies,getGrid());if(e&&e.id===event.enemy){interruptEnemy(e,remotePose);lastShove=performance.now();}}
    if(event.kind==='grab'&&remotePose){const e=enemyMap.get(event.enemy),candidate=crimsonCandidate({...remotePose,stamina:100},actors.enemies,getGrid()),accepted=!!e&&candidate===e&&!e.finisherHeld;grabDecision={id:event.id,accepted};if(accepted){releaseGrab();e.finisherHeld=true;e.attackTimer=0;e.root.rotation.y=Math.atan2(remotePose.x-e.x,remotePose.z-e.z);remoteGrab={enemy:e,expires:performance.now()+2500};}}
    if(event.kind==='release'&&remoteGrab?.enemy.id===event.enemy)releaseGrab();
    if(event.kind==='vehicle-claim'&&remotePose){const index=event.index,car=actors.vehicles[index],allowed=Number.isInteger(index)&&!!car&&getVehicle()!==index&&(vehicleOwner<0||vehicleOwner===index)&&Math.hypot(remotePose.x-car.x,remotePose.z-car.z)<6;vehicleGrant={id:event.id,index,allowed,at:performance.now()};if(allowed)vehicleOwner=index;}
    if(event.kind==='vehicle-release'&&event.index===vehicleOwner){const car=actors.vehicles[vehicleOwner],v=event.pose;if(v&&[v.x,v.z,v.angle].every(Number.isFinite)&&Math.hypot(v.x-car.x,v.z-car.z)<15){Object.assign(car,v);car.root.position.set(car.x,getGrid().floorAt(car.x,car.z)+.1,car.z);car.root.rotation.y=car.angle+Math.PI;}vehicleOwner=-1;}
    if(event.kind==='progress'&&event.value&&remotePose){const v=event.value,s=getState();if(v.fuse)s.fuse=true;if(v.generatorReady)s.generatorReady=true;s.relays=union(s.relays,(v.relays||[]).filter(id=>['lighthouse','ridge','hospital'].includes(id)));if(v.won&&s.relays.length===3)s.won=true;}
   }
   const v=net.vehicle;if(v&&v.index===vehicleOwner&&Number.isInteger(v.index)&&v.index>=0&&v.index<actors.vehicles.length&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.angle)&&Math.abs(v.x)<1400&&Math.abs(v.z)<900&&v.seq>=vehicleAck){vehicleAck=v.seq;const car=actors.vehicles[v.index];Object.assign(car,{x:v.x,z:v.z,angle:v.angle});car.root.position.set(car.x,getGrid().floorAt(car.x,car.z)+.1,car.z);car.root.rotation.y=car.angle+Math.PI;}
  }else{
   if(Number.isSafeInteger(net.ack))events=events.filter(e=>e.id>net.ack);
   if(net.vehicleGrant&&vehicleRequest===net.vehicleGrant.id){const decision=net.vehicleGrant;vehicleRequest=null;if(decision.allowed)enterVehicle(decision.index);else notify('Your partner is already using that truck.');}
   if(lastDriven&&remoteVehicle<0&&releaseId&&net.ack>=releaseId){lastDriven=null;releaseId=0;}
   if(net.grabDecision&&grabRequest?.id===net.grabDecision.id){if(!net.grabDecision.accepted){cancelGrab(grabRequest.enemy);notify('That infected is already out of reach or held.');}grabRequest=null;}
   const s=getState();if(net.progress){s.relays=union(s.relays,net.progress.relays||[]);s.fuse||=!!net.progress.fuse;s.generatorReady||=!!net.progress.generatorReady;s.won||=!!net.progress.won;s.kills=union(s.kills,net.progress.kills||[]);}if(Number.isFinite(net.time))s.time=net.time;
   if(Number.isFinite(net.damage)&&net.damage>=receivedDamage){const delta=net.damage-receivedDamage;receivedDamage=net.damage;if(delta>0)takeDamage(delta);}
   for(const row of Array.isArray(net.enemies)?net.enemies:[]){const e=enemyMap.get(row[0]);if(!e||row.length<8||!row.slice(1,6).every(Number.isFinite)||Math.abs(row[1])>1400||Math.abs(row[3])>900)continue;targets.set(e.id,row);e.remoteHeld=!!row[8];if(!e.finisherHeld){e.health=row[5];e.alive=e.health>0;e.crimsonWindow=row[7];setEnemyAction(e,['idle','walk','run','attack','hit','dead'].includes(row[6])?row[6]:'idle');}}
   for(const [i,row]of(net.vehicles||[]).entries()){if(i===remoteVehicle||i===lastDriven?.index||!actors.vehicles[i]||!row.every(Number.isFinite))continue;const car=actors.vehicles[i];Object.assign(car,{x:row[0],z:row[1],angle:row[2]});car.root.position.set(car.x,getGrid().floorAt(car.x,car.z)+.1,car.z);car.root.rotation.y=car.angle+Math.PI;}
  }
 }
 function event(kind,value,urgent=false){if(!connection.playing||connection.role!=='guest')return null;if(events.length>=64){notify('Radio busy. Wait for contact before acting again.');return null;}const id=++eventId;events.push({id,kind,...value});if(urgent)connection.flush();return id;}
 function update(dt,{moving=false,shotSequence=0,vehicle=-1,distance=0,sprinting=false}={}){
  if(!connection.playing)return;remoteMoving=moving?(sprinting?2:1):0;localShot=shotSequence;remoteVehicle=vehicle;if(vehicle>=0){const car=actors.vehicles[vehicle];lastDriven={index:vehicle,seq:++vehicleSeq,x:car.x,z:car.z,angle:car.angle};}
  if(connection.role==='guest'&&vehicle<0){stepNoise+=distance;if(stepNoise>(sprinting?2.6:2.1)){stepNoise=0;event('noise',{radius:sprinting?15:5});}}
  if(remoteGrab&&(performance.now()>remoteGrab.expires||!remotePose||!inCrimsonReach(remotePose,remoteGrab.enemy,getGrid())))releaseGrab();
  if(vehicleOwner>=0&&remotePose?.vehicle!==vehicleOwner&&performance.now()-(vehicleGrant?.at||0)>3000)vehicleOwner=-1;
  indicator.hidden=false;indicator.textContent=`CO-OP · ${(connection.role==='host'?latest?.guest:latest?.host)||'Radio linked'} · ${connection.fast?'DIRECT':'RELAY'} · ${Math.round(connection.rtt)} ms`;
  let supportBudget=384;
  if(connection.role==='guest')for(const e of actors.enemies){const row=targets.get(e.id);if(!row||e.finisherHeld)continue;const blend=Math.hypot(row[1]-e.x,row[3]-e.z)>12?1:1-Math.exp(-15*dt);e.x=T.MathUtils.lerp(e.x,row[1],blend);e.z=T.MathUtils.lerp(e.z,row[3],blend);e.root.position.set(e.x,row[2],e.z);e.root.rotation.y+=Math.atan2(Math.sin(row[4]-e.root.rotation.y),Math.cos(row[4]-e.root.rotation.y))*blend;e.root.visible=Math.hypot(e.x-getState().x,e.z-getState().z)<150;e.mixer.update(dt);if(!e.alive&&!e.remoteHeld&&e.root.visible)supportBudget-=supportCorpse(e,getGrid().effectFloorAt||getGrid().floorAt,dt,supportBudget);}
  avatar.visible=!!remotePose&&performance.now()-receivedAt<6000&&remotePose.health>0&&Math.hypot(remotePose.x-getState().x,remotePose.z-getState().z)<200;if(weaponVisual)weaponVisual.visible=avatar.visible;
  if(!avatar.visible)return;const a=avatar.userData,blend=Math.hypot(avatar.position.x-remotePose.x,avatar.position.z-remotePose.z)>12?1:1-Math.exp(-15*dt);avatar.position.lerp(p.set(remotePose.x,remotePose.y+base,remotePose.z),blend);const yaw=-remotePose.yaw;avatar.rotation.y+=Math.atan2(Math.sin(yaw-avatar.rotation.y),Math.cos(yaw-avatar.rotation.y))*blend;
  for(const [name,action]of Object.entries(a.actions)){action.setEffectiveWeight(name===(remotePose.moving===2?'Run_Forward':remotePose.moving?'Walk_Forward':'Idle_Relaxed')?1:0);action.setEffectiveTimeScale(remotePose.moving?1.5:1);}a.mixer.update(dt);
  // Aim comes after the authored gait. The held rigid model follows the actual
  // survivor's right hand, while the source viewmodel keeps its own animation.
  a.bones.RightArm.rotation.z-=.8;a.bones.RightArm.rotation.x-=.65;a.bones.RightForeArm.rotation.x-=.9;a.bones.LeftArm.rotation.z+=.55;a.bones.LeftForeArm.rotation.x-=1.15;avatar.updateMatrixWorld(true);
  if(weaponId!==remotePose.weapon){weaponId=remotePose.weapon;if(weaponVisual)weaponVisual.visible=false;weaponVisual=weaponCache.get(weaponId)||null;const index=WEAPONS.findIndex(w=>w.id===weaponId),source=index===0?rifle.root:armory.models[index-1];if(!weaponVisual&&source){const {mesh}=captureWeaponVisual(source);mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.setScalar(1);mesh.visible=true;const b=new T.Box3().setFromObject(mesh),size=b.getSize(p),fit=(weaponId==='bat'?1.05:.85)/Math.max(size.x,size.y,size.z);batchFieldWeapon(mesh);mesh.scale.setScalar(fit);weaponVisual=new T.Group();weaponVisual.add(mesh);scene.add(weaponVisual);weaponCache.set(weaponId,weaponVisual);}if(weaponVisual)weaponVisual.visible=true;}
  if(weaponVisual){a.bones.RightHand.getWorldPosition(weaponVisual.position);weaponVisual.quaternion.copy(avatar.quaternion);weaponVisual.rotation.x=remotePose.pitch||0;}
  if(remotePose.shot!==lastShot){if(lastShot&&remotePose.shot>lastShot){const from=new T.Vector3(remotePose.x,remotePose.y+1.4,remotePose.z);direction.set(Math.sin(remotePose.yaw),Math.sin(remotePose.pitch||0),-Math.cos(remotePose.yaw));feedback.trail(from,from.clone().addScaledVector(direction,20),false);}lastShot=remotePose.shot;}
 }
 const receiveOriginal=connection.onUpdate;connection.onUpdate=r=>{latest=r;receiveOriginal(r);};
 return {connection,ui,avatar,update,get session(){return started;},get playing(){return connection.playing;},get guest(){return connection.playing&&connection.role==='guest';},get reservedVehicle(){return vehicleOwner;},get remote(){return remotePose&&performance.now()-receivedAt<6000&&remotePose.health>0?{...remotePose,onDamage:n=>damage+=n}:null;},action(kind,value){const id=event(kind,value,true);if(kind==='grab'&&id)grabRequest={id,enemy:value.enemy};},noise(radius){event('noise',{radius});},claimVehicle(index){if(vehicleRequest)return;vehicleRequest=event('vehicle-claim',{index},true);},releaseVehicle(index){const car=actors.vehicles[index];releaseId=event('vehicle-release',{index,pose:{x:car.x,z:car.z,angle:car.angle}},true)||0;},wound(e,amount,heavy=false){event('wound',{enemy:e.id,amount,weapon:getState().weapon,heavy,punch:amount===35});},progress(){const s=getState();event('progress',{value:{relays:s.relays,fuse:s.fuse,generatorReady:s.generatorReady,won:s.won}});},async leave(){await connection.leave();reset();},reset};
}
