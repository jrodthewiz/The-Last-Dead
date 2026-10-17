import {transferStash} from './safehouse-storage.js';
import {setGodMode} from './engine.js';
import {createLowTideSave} from './low-tide-save.js';
import {lowTideObjective,lowTidePrompt} from './low-tide.js';
import {syncRoomGateCells} from './room-progression.js';
import {HorrorPresence,horrorPresentationContext} from './horror-presence.js';
import {HorrorPresenceAudio} from './horror-presence-audio.js';
import {RoomAtmosphereAudio,atmosphereOcclusion} from './room-atmosphere-audio.js';
import {FIREARM_EVENTS,listenerPose,eventAudioDetails,resolveAudioTrack,isPredictedFirearmEcho} from './spatial-audio.js';
import {canStand} from './engine.js';
import {createPacing} from './enemy-ai.js';
import {DevFlight} from './dev-flight.js';
import {DevFlightUI} from './dev-flight-ui.js';
import {GamepadInput,emptyGamepadFrame} from './gamepad-input.js';
import {makeCampaignCourse,newRun,tick,tickPlayer,shoot,shootRifle,shootMelee,fireWeaponInput,cancelMelee,parry,chestFinisher,grapple,look,switchWeapon,nextOwnedWeapon,addPeer,clamp,weapons,castRay,angleDiff,attackVermin,validateVerminSnapshot,validateVerminHand,validateVerminCrawl,VERMIN_LIMITS} from './engine.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {PeerJsSession} from './signaling.js';
import {AudioSystem} from './assets/audio.js';
import {upgradeWeapon,craftBandage,useBandage,discardSupply} from './scavenger-pack.js';
import {createScavengerPackUI} from './scavenger-pack-ui.js';
import {createSoloCampaignCourse} from './campaign-entry.js';
import {IslandBasementConnection,basementPrompt,attachBasementReturn} from './island-basement.js';
import {getActiveVehicle,recoverVehicle} from './harbor-vehicle-fleet.js';
const basementConnection=new IslandBasementConnection();
const lowTideSave=createLowTideSave({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const canvas=document.querySelector('#world');
let graphicsBackend;
try{graphicsBackend=await (await import('./webgpu-backend.js')).createWebGPUBackend(canvas);}
catch(error){
 const panel=document.createElement('div');panel.setAttribute('role','alert');
 panel.style.cssText='position:fixed;inset:20%;z-index:999;background:#141b17;color:#eee;padding:32px;font:18px/1.5 system-ui';
 const message=document.createElement('p');message.textContent='WebGPU could not start. Enable hardware acceleration in a browser that supports WebGPU, then reload.';
 panel.append(message);document.body.append(panel);throw error;
}
const renderer=new Renderer(canvas,{backend:graphicsBackend}),audio=new AudioSystem();
renderer.horrorAudio=audio;
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
renderer._systemReducedMotion=motionPreference.matches;
motionPreference.addEventListener('change',event=>{renderer._systemReducedMotion=event.matches;});
addEventListener('pointermove',event=>{if(screen==='menu'&&event.pointerType!=='touch')renderer.menuCinematic?.setPointer(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);},{passive:true});
addEventListener('blur',()=>renderer.menuCinematic?.setPointer(0,0));
document.addEventListener('pointerleave',()=>renderer.menuCinematic?.setPointer(0,0));
const routeParams=new URLSearchParams(location.search);
const devEnabled=routeParams.has('dev')||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const inspector=new DevFlight();let inspectOnStart=false,inspectorPanel=null;
const startingCourse=()=>createSoloCampaignCourse(routeParams);
let run=newRun(startingCourse(),{requireEntry:true}),screen='menu',session=null,signal=null,signalAbort=null,signalRoom='',network='SOLO',settings={sensitivity:1,volume:.5,sfxVolume:1,voiceVolume:1,musicVolume:1,ambienceVolume:1,uiVolume:1,reducedMotion:false,gore:true,bodycam:true,autoRun:false},last=0,acc=0,netClock=0,hudClock=0,frames=0,fps=60,fpsClock=0,remoteInput={},remotePress={fire:false,alt:false,attachment:false},remoteSeen=0,remoteParry=0,parrySequence=0,remoteChest=0,chestSequence=0,remoteHook=0,hookSequence=0,verminSequence=0,snapshotSeq=0,lastSnapshot=-1,netEventSeq=0,lastNetEvent=-1,netEvents=[],fatalBiteUntil=0;
const keys=new Set(),touches=new Map(),pulses=new Set();let fire=false,alt=false,attachment=false,lastStep=0,lastHeartbeat=0;
const gamepadInput=new GamepadInput();let gamepadFrame=emptyGamepadFrame(),inputDevice='keyboard',windowFocused=true;
function useInputDevice(device){if(inputDevice===device)return;inputDevice=device;ui.setInputDevice?.(device);}
let horrorRunRef=null,lastHorrorCueAt=-Infinity,nextHorrorCheck=0,horrorQuietSince=null,distantScreamPlayed=false;
const heardDungeonScares=new Set();
const horrorPresence=new HorrorPresence({canStand,castRay}),horrorPresenceAudio=new HorrorPresenceAudio(audio);
const roomAtmosphereAudio=new RoomAtmosphereAudio(audio);
let nextSpatialRefresh=0;
let horrorManual=false;
renderer.horrorScareGate=(kind,player)=>!(session?.connected&&session.role==='guest')&&horrorPresence.claimLegacy(player,kind,kind==='drop'?12:8);
function updatePresence(){
 const {authoritative,sharedPlaying,localPlaying}=horrorPresentationContext({screen,inspecting:inspector.active,connected:!!session?.connected,role:session?.role});
 const shared=horrorPresence.update(run,{playing:sharedPlaying,authoritative,manual:horrorManual});
 renderer.horrorPresence={...shared,enabled:shared.enabled&&localPlaying};
 // A personal sleeve event belongs to the host's body; shared room actors
 // keep their authoritative phase for both players.
 if(!authoritative&&renderer.horrorPresence.active?.kind==='cuff')renderer.horrorPresence={...renderer.horrorPresence,active:null};
 horrorPresenceAudio.update(renderer.horrorPresence,horrorPresence.drain(),run,{...settings,occluded:(angle,d)=>castRay(run.course,run.x,run.y,angle,d).dist<d-.12});
}

const playerFields=['x','y','z','angle','pitch','vx','vy','vz','speed','distance','time','mode','health','energy','weapon','cooldowns','fireCooldown','shot','damage','heal','aim','slide','dashTime','punch','hookTime','hookCooldown','hookTarget','parryTime','parryCooldown','slam','wallJumps','style','styleTotal','stylePending','styleLabel','rank','kills','combo','bestCombo','lastWeapon','repeat','coinCharges','coinRegen','altCooldown','respawnTime','rifleHeat','rifleBurst','rifleBurstTimer','rifleCharge','rifleCharging','shotSequence','lastShotMode','extraction','extractCandidateId','extractions','extractionPoints'];
playerFields.push('meleeActive','meleeProgress','meleeDuration','meleeHeavy','meleeResolved','meleeSequence','meleeContact','meleeHitStop','sawRev','sawActive','sawContact','sawTick');
playerFields.push('bite','playerWounds');
playerFields.push('brutal','verminHand','verminCrawl');
playerFields.push('attachmentShot','attachmentCooldown','attachmentSequence');
playerFields.push('supportZ','supportId','structureId');
const BITE_EVENTS=new Set(['bite-windup','bite-start','bite-struggle','bite-damage','bite-release','bite-terminal','player-injury']);
const VERMIN_LOCAL_EVENTS=new Set(['vermin-pickup','vermin-held','vermin-bite','vermin-drop','vermin-cancel','vermin-crawl']);
const playerData=p=>Object.fromEntries(playerFields.map(k=>[k,p[k]]));
function snapshot(){horrorPresence.bind(run);return{horror:horrorPresence.snapshot(),seq:++snapshotSeq,host:playerData(run),guest:run.peer?playerData(run.peer):null,enemyAICursor:run.enemyAICursor||0,wave:run.wave,waveDelay:run.waveDelay,enemies:run.course.enemies,projectiles:run.projectiles,coins:run.coins,gore:run.gore.slice(-110),blood:run.blood,tracers:run.tracers,campaign:run.campaign,sectorIndex:run.sectorIndex,sectorCount:run.sectorCount,sectorId:run.sectorId,sectorName:run.sectorName,waveCount:run.waveCount,director:run.director?Object.fromEntries(['state','budget','spent','remainingBudget','aliveCap','active','pending','elapsed'].map(k=>[k,run.director[k]])):null,roomProgression:run.roomProgression||null,spawnTelegraphs:run.spawnTelegraphs||[],explosions:run.explosions||[],vermin:run.vermin,audioEvents:netEvents.slice(-20)};}
function releaseFormFocus(){const active=document.activeElement;if(active&&typeof active.blur==='function')active.blur();}
function resetInput(){releaseFormFocus();keys.clear();touches.clear();pulses.clear();fire=false;alt=false;attachment=false;run.aim=0;gamepadInput.suppress();gamepadFrame=emptyGamepadFrame();cancelMelee(run);}
function pointerLock(){if(screen==='play'&&!inspector.active)audio.unlock().then(()=>{if(screen==='play'&&!inspector.active){audio.resume();audio.play('ambience');}});if(navigator.webdriver===true||inputDevice==='gamepad'||matchMedia('(pointer:coarse)').matches||document.pointerLockElement===canvas)return;try{canvas.requestPointerLock()?.catch(()=>ui.toast('Click the arena to capture your mouse. Arrow keys also aim.'));}catch{}}
function configure(value){settings={...settings,...value};document.body.dataset.bodycam=settings.bodycam===false?'off':'on';run.autoRun=!!settings.autoRun;renderer.setSettings?.(settings);audio.setVolume(settings.volume);audio.setMuted(settings.volume===0);audio.setGroupVolume('sfx',settings.sfxVolume??1);audio.setGroupVolume('voice',settings.voiceVolume??1);audio.setGroupVolume('music',settings.musicVolume??1);audio.setGroupVolume('ambience',settings.ambienceVolume??1);audio.setGroupVolume('ui',settings.uiVolume??1);}
function begin(coop=false,preparedCourse=null){
packUI.close({resume:false});
audio.resetCounterCues();
 if(renderer._beginPending||screen==='loading')return;
 // Select the destination before preparation. Recursive completion reuses that
 // exact course; retry must not compile the old world then build another one.
 let course=preparedCourse||(coop?makeCampaignCourse(0):screen==='menu'?run.course:startingCourse());
 if(run.course!==course)run=newRun(course,{requireEntry:!course.dungeon});
 // Preparation and play retain the same run-owned collision facade. Retry
 // already creates a fresh run above; rebuilding here invalidates its world.
 course=run.course;
 if(inspector.active){inspector.leave();renderer.freeCamera=null;document.body.classList.remove('inspecting');}
 if(renderer.renderer&&(!renderer._weaponsPrepared||renderer._preparedCourse!==course)){
  renderer._beginPending=true;
  ui.loading(renderer._preparationStage||'Preparing the campaign');
  // Paint the loading state before any synchronous preparation work starts.
  const preparation=(renderer._warmupCourse===run.course?renderer._warmupPromise:null)||new Promise((resolve,reject)=>requestAnimationFrame(()=>setTimeout(()=>{try{renderer.render(run,performance.now());resolve(renderer._warmupPromise);}catch(error){reject(error);}},0)));
  preparation.then(()=>{renderer._beginPending=false;begin(coop,course);},error=>{renderer._beginPending=false;ui.loading('Could not load the campaign. Reload to try again.',true);console.error(error);});
  return;
 }
basementConnection.reset();if(!coop)basementConnection.start?.(run,{restore:surface=>lowTideSave.load(surface)});if(!coop&&session?.connected){session.close();session=null;network='SOLO';}run.mode='play';if(run.lowTide)lowTideSave.load(run);run.autoRun=!!settings.autoRun;if(coop)addPeer(run);screen='play';fatalBiteUntil=0;acc=0;netEvents=[];resetInput();remoteInput={};remotePress={fire:false,alt:false,attachment:false};remoteParry=0;remoteChest=0;remoteHook=0;parrySequence=0;chestSequence=0;hookSequence=0;verminSequence=0;remoteSeen=performance.now();ui.play?.();ui.hide?.();document.body.classList.add('playing');audio.setAmbiencePreset?.(course.dungeon?course.dungeonIndex:run.sectorIndex);audio.setScene?.('play');if(!windowFocused||document.hidden)pause();else{audio.unlock().then(()=>{if(screen!=='play')return;audio.resume();audio.play('ambience');});pointerLock();}if(coop)session.send({t:'start',s:snapshot()});ui.toast(course.harbor?'BLACKWATER / OPEN WORLD':course.dungeon?`FLOOR ${String(course.dungeonIndex+1).padStart(2,'0')} // ${course.name.toUpperCase()}`:`DESCENT ${String(run.sectorIndex+1).padStart(2,'0')} // ${run.sectorName.toUpperCase()}`);if(course.dungeon&&renderer._course!==course)prepareDescentFloor();}
function pause(){if(screen!=='play')return;screen='pause';resetInput();document.exitPointerLock?.();if(!session?.connected)run.mode='pause';audio.setScene?.('pause');audio.pause();ui.pause();if(session?.connected)ui.toast('Co-op stays live while your menu is open.');}
function resume(){if(screen!=='pause')return;resetInput();screen='play';run.mode='play';ui.play?.();ui.hide?.();document.body.classList.add('playing');audio.setScene?.('play');audio.unlock().then(()=>{if(screen!=='play'||inspector.active)return;audio.resume();audio.play('ambience');});if(!inspector.active)pointerLock();}
function cancelSignal(){signalAbort?.abort();signalAbort=null;signal?.abort?.();signal=null;signalRoom='';}
function showRoomCode(code){if(ui.setRoomCode)ui.setRoomCode(code);else ui.setOffer?.(code);}
function setCoopBusy(busy,message=''){ui.setConnectionBusy?.(busy,message);if(message)ui.networkStatus(message);}
function coopError(error){return error?.code==='SIGNALING_ABORTED'?'Co-op cancelled.':error?.message||'The co-op connection failed.';}
function menu(){lowTideSave.save(basementConnection.surfaceForSave(run));basementConnection.reset();packUI.close({resume:false});resetInput();document.exitPointerLock?.();cancelSignal();audio.setScene?.('menu');screen='menu';run.mode='ready';session?.close();session=null;network='SOLO';run=newRun(startingCourse(),{requireEntry:true});ui.menu();document.body.classList.remove('playing');}
function restart(){if(session?.connected&&session.role==='guest'){session.send({t:'restart-request'});ui.toast('Restart requested from host.');return;}begin(!!session?.connected);}
function disconnected(){cancelSignal();network='DISCONNECTED';ui.networkStatus(network);setCoopBusy(false,network);resetInput();if(session?.role==='guest'){screen='pause';run.mode='pause';audio.setScene?.('pause');audio.pause();document.exitPointerLock?.();ui.pause();ui.toast('Host disconnected. Start solo to continue in a fresh arena.');}else if(run.peer){delete run.peer;ui.toast('Partner disconnected. Continuing solo.');}}
function makeSession(){cancelSignal();session?.close();let active;active=new PeerJsSession({onStatus:text=>{if(session!==active)return;network=text;ui.networkStatus(text);},onMessage:(message,transport)=>{if(session===active)receive(message,transport);},onConnect:()=>{if(session!==active)return;network='P2P CONNECTED';setCoopBusy(false,network);ui.networkStatus(network);if(active.role==='host')begin(true);else ui.toast('Connected. Waiting for host arena…');},onDisconnect:()=>{if(session===active)disconnected();}});session=active;return active;}
const ui=new UI({onSound:type=>{if(type==='hover'&&!audio.isUnlocked)return;audio.unlock().then(()=>audio.play(type));},onWeapon:index=>{if(screen==='play'){if(switchWeapon(run,index))audio.play('equip');}},onStart:()=>begin(false),onPause:pause,onResume:resume,onRestart:restart,onMenu:menu,onSettings:configure,onHost:async()=>{setCoopBusy(true,'Creating breach code…');const active=makeSession();try{const code=await active.host();if(session!==active)return;signalRoom=code;showRoomCode(code);setCoopBusy(true,`Send code ${code} to your partner.`);}catch(e){if(session!==active)return;setCoopBusy(false,coopError(e));active.close();session=null;}},onJoin:async code=>{setCoopBusy(true,'Joining breach…');const active=makeSession();try{await active.join(code);if(session!==active)return;if(!active.connected)setCoopBusy(true,'Connected. Waiting for host…');}catch(e){if(session!==active)return;setCoopBusy(false,coopError(e));active.close();session=null;}},onAccept:async()=>{ui.networkStatus('Use the six-character host code to join.');},onDisconnect:()=>{const wasGuest=session?.role==='guest';cancelSignal();session?.close();session=null;network='SOLO';if(run.peer)delete run.peer;if(wasGuest&&screen==='play'){screen='pause';run.mode='pause';audio.setScene?.('pause');ui.pause();}setCoopBusy(false,network);ui.networkStatus(network);}});
let packPausedPlay=false;
const packSupplyAction=action=>{if(session?.connected)return{ok:false,reason:'inactive'};const result=action(run);if(result.ok){audio.play('equip',0,{volume:.15});lowTideSave.save(basementConnection.surfaceForSave(run));}return result;};
const packUI=createScavengerPackUI({getRun:()=>run,onOpen:()=>{packPausedPlay=screen==='play';if(packPausedPlay)pause();},onClose:()=>{if(packPausedPlay&&screen==='pause')resume();packPausedPlay=false;},weapons,onStash:(direction,kind,id)=>packSupplyAction(r=>transferStash(r,direction,kind,id)),onCraft:()=>packSupplyAction(craftBandage),onDiscard:id=>packSupplyAction(r=>discardSupply(r,id)),onUseBandage:()=>packSupplyAction(useBandage),onEquip:index=>{if(session?.connected)return false;const changed=switchWeapon(run,index);if(changed){audio.play('equip');lowTideSave.save(basementConnection.surfaceForSave(run));}return changed;},onUpgrade:index=>{if(session?.connected)return {ok:false,reason:'inactive'};const result=upgradeWeapon(run,index);if(result.ok){audio.unlock().then(()=>audio.play('mechanism',1));ui.toast('Hardened fitting installed · +25% weapon damage');lowTideSave.save(basementConnection.surfaceForSave(run));}return result;}});
function saneSnapshot(s){return s&&Number.isInteger(s.seq)&&Number.isInteger(s.sectorIndex)&&s.sectorIndex>=0&&s.sectorIndex<3&&s.host&&s.guest&&Array.isArray(s.enemies)&&s.enemies.length<=96&&['projectiles','coins','gore','blood','tracers','spawnTelegraphs','explosions'].every(k=>Array.isArray(s[k])&&s[k].length<=250)&&[s.host,s.guest].every(p=>['x','y','z','angle','pitch','health'].every(k=>Number.isFinite(p[k]))&&p.x>=0&&p.x<=12&&p.y>=0&&p.y<=12)&&(s.vermin===undefined||(s.vermin&&Array.isArray(s.vermin.rats)&&s.vermin.rats.length<=VERMIN_LIMITS.rats&&Array.isArray(s.vermin.roaches)&&s.vermin.roaches.length<=VERMIN_LIMITS.roaches));}
function applySnapshot(s,start=false){if(!saneSnapshot(s)||s.seq<=lastSnapshot)return;lastSnapshot=s.seq;run.playerId='peer';const oldHealth=run.health,oldKills=run.kills;if(start){audio.resetCounterCues();parrySequence=0;chestSequence=0;hookSequence=0;verminSequence=0;run=newRun(makeCampaignCourse(0),{requireEntry:true});run.playerId='peer';run.mode='play';screen='play';fatalBiteUntil=0;resetInput();ui.play?.();ui.hide?.();document.body.classList.add('playing');audio.setScene?.('play');audio.unlock().then(()=>{if(screen!=='play')return;audio.resume();audio.play('ambience');});pointerLock();}const changedSector=run.course.index!==s.sectorIndex;if(changedSector)run.course=makeCampaignCourse(s.sectorIndex);for(const key of ['campaign','sectorIndex','sectorCount','sectorId','sectorName','waveCount','director','roomProgression','enemyAICursor'])run[key]=s[key];syncRoomGateCells(run.course,run.roomProgression);const previous={x:run.x,y:run.y,z:run.z,angle:run.angle,pitch:run.pitch,weapon:run.weapon};for(const k of playerFields)if(s.guest[k]!==undefined)run[k]=s.guest[k];if(!start&&!changedSector&&screen==='play'&&Math.hypot(previous.x-run.x,previous.y-run.y)<.5&&run.health>0){run.x=previous.x+(run.x-previous.x)*.25;run.y=previous.y+(run.y-previous.y)*.25;run.angle=previous.angle;run.pitch=previous.pitch;}if(!start&&!changedSector&&screen==='play')run.weapon=previous.weapon;run.mode=s.host.mode;run.peer=s.host;run.vermin=validateVerminSnapshot(s.vermin,run.course);run._verminCourse=run.course;run.verminHand=validateVerminHand(s.guest.verminHand);run.verminCrawl=validateVerminCrawl(s.guest.verminCrawl);run.peer.verminHand=validateVerminHand(s.host.verminHand);run.peer.verminCrawl=validateVerminCrawl(s.host.verminCrawl);if(s.horror)horrorPresence.receive(s.horror,run);run.course.enemies=s.enemies;run.wave=s.wave;run.waveDelay=s.waveDelay;for(const key of ['projectiles','coins','gore','blood','tracers','spawnTelegraphs','explosions'])run[key]=s[key];run.kills=s.host.kills;run.autoRun=!!settings.autoRun;const freshBiteDamage=Array.isArray(s.audioEvents)&&s.audioEvents.some(e=>(e.type==='bite-damage'||e.type==='vermin-bite')&&e.playerId==='peer'&&Number.isSafeInteger(e.seq)&&e.seq>lastNetEvent);if(oldHealth>run.health&&!freshBiteDamage&&!['held','terminal'].includes(run.bite?.phase))audio.play('damage');if(oldKills<run.kills)audio.play('kill');audio.updateListener(listenerPose(run));if(Array.isArray(s.audioEvents))for(const e of s.audioEvents.slice(-20)){if(Number.isSafeInteger(e.seq)&&e.seq>lastNetEvent){lastNetEvent=e.seq;if(!isPredictedFirearmEcho(e,run.playerId||'peer')&&(!(BITE_EVENTS.has(e.type)||VERMIN_LOCAL_EVENTS.has(e.type))||e.playerId==='peer'))audio.play(e.type,e.weapon??0,spatialEvent(e));}}if(changedSector)ui.toast('DESCENT '+(run.sectorIndex+1)+' // '+run.sectorName.toUpperCase());}
// Keep short trigger taps until a host simulation step consumes them, even if
// release arrives in the same frame. Saw primary remains strictly held input.
function receive(msg){if(!msg||typeof msg.t!=='string')return;if(session?.role==='host'){if(msg.t==='input'){const n=msg.i;if(!n||!Number.isFinite(n.angle)||!Number.isFinite(n.pitch))return;const weapon=clamp(Math.floor(Number(n.weapon)||0),0,weapons.length-1);if(weapon!==remoteInput.weapon){remotePress.fire=false;remotePress.alt=false;remotePress.attachment=false;}if(n.fire&&!remoteInput.fire)remotePress.fire=true;if(n.alt&&!remoteInput.alt)remotePress.alt=true;if(n.attachment&&!remoteInput.attachment)remotePress.attachment=true;remoteInput={forward:clamp(Number(n.forward)||0,-1,1),strafe:clamp(Number(n.strafe)||0,-1,1),jump:!!n.jump,dash:!!n.dash,slide:!!n.slide,fire:!!n.fire,alt:!!n.alt,attachment:!!n.attachment,angle:clamp(n.angle,-Math.PI,Math.PI),pitch:clamp(n.pitch,-1.35,1.35),weapon,parry:Number.isSafeInteger(n.parry)?n.parry:0,chest:Number.isSafeInteger(n.chest)?n.chest:0,hook:Number.isSafeInteger(n.hook)?n.hook:0,vermin:Number.isSafeInteger(n.vermin)&&n.vermin>=0?n.vermin:0,harvest:!!n.harvest,interact:!!n.interact};remoteSeen=performance.now();}if(msg.t==='restart-request')ui.toast('Partner requests restart. Esc → Restart arena.');}else if(msg.t==='start'){lastSnapshot=-1;lastNetEvent=-1;applySnapshot(msg.s,true);}else if(msg.t==='snapshot')applySnapshot(msg.s);}
function intent(){
 if(screen!=='play')return{};
 const held=[...touches.values()].map(v=>v.action),has=a=>held.includes(a),harvest=keys.has('KeyG')||has('harvest')||gamepadFrame.harvest,interact=keys.has('KeyQ')||has('interact')||pulses.has('interact')||gamepadFrame.interact;
 const forward=clamp(Number(keys.has('KeyW')||has('forward'))-Number(keys.has('KeyS')||has('back'))+gamepadFrame.forward,-1,1);
 return{forward:forward||(settings.autoRun&&!harvest&&!interact?1:0),strafe:clamp(Number(keys.has('KeyD')||has('right'))-Number(keys.has('KeyA')||has('left'))+gamepadFrame.strafe,-1,1),
  jump:keys.has('Space')||has('jump')||pulses.has('jump'),dash:keys.has('ShiftLeft')||keys.has('ShiftRight')||has('dash')||pulses.has('dash'),
  slide:keys.has('ControlLeft')||keys.has('ControlRight')||has('slide')||gamepadFrame.slide,
  turn:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'))+gamepadFrame.turn*(Number(settings.sensitivity)||1),lookY:Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'))+gamepadFrame.lookY*(Number(settings.sensitivity)||1),
  fire:fire||has('fire')||pulses.has('fire')||gamepadFrame.fire,alt:alt||has('alt')||pulses.has('alt')||gamepadFrame.alt,
  attachment:attachment||keys.has('KeyC')||has('attachment')||pulses.has('attachment'),
  angle:run.angle,pitch:run.pitch,weapon:run.weapon,parry:parrySequence,chest:chestSequence,hook:hookSequence,vermin:verminSequence,harvest,interact};
}
function punch(){if(screen!=='play'||run.health<=0)return;parrySequence++;if(session?.role==='guest'&&session.connected){if(!run.verminHand||run.verminHand.phase==='idle'){run.punch=.3;audio.play('parry');}}else if(!attackVermin(run))parry(run);}
function requestVermin(){if(screen==='play'&&run.health>0)verminSequence++;}
function requestChest(){if(screen!=='play'||run.health<=0)return;chestSequence++;if(session?.role!=='guest'||!session.connected)chestFinisher(run);}
function requestHook(){if(screen!=='play'||run.health<=0)return;hookSequence++;if(session?.role!=='guest'||!session.connected)grapple(run);}
function updateGamepad(){
 let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{}
 const context=!windowFocused||document.hidden||screen==='loading'||inspector.active?'inactive':screen==='play'?'play':'menu';
 gamepadFrame=gamepadInput.poll(pads,{context});
 if(gamepadFrame.changed&&inputDevice==='gamepad'){
  useInputDevice('keyboard');if(screen==='play')pause();else resetInput();return;
 }
 if(!gamepadFrame.active)return;
 useInputDevice('gamepad');
 const edges=gamepadFrame.edges;
 if(edges.pause){if(screen==='play')pause();else if(screen==='pause')resume();else if(context==='menu')ui.gamepadNavigate?.('confirm');return;}
 if(context==='menu'){
  if(gamepadFrame.menuDirection)ui.gamepadNavigate?.(gamepadFrame.menuDirection);
  if(edges.jump)ui.gamepadNavigate?.('confirm');else if(edges.slide&&!ui.gamepadNavigate?.('cancel')&&screen==='pause')resume();
  return;
 }
 for(const action of ['jump','dash','fire','alt'])if(edges[action])pulses.add(action);
 if(edges.harvest)requestVermin();if(edges.parry){if(run.weapon===1&&gamepadFrame.alt)pulses.add('attachment');else punch();}if(edges.chest)requestChest();if(edges.hook)requestHook();
 if(gamepadFrame.weaponStep&&switchWeapon(run,nextOwnedWeapon(run,gamepadFrame.weaponStep)))audio.play('equip');
}
addEventListener('keydown',event=>{if(!event.repeat)useInputDevice('keyboard');},true);
addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')useInputDevice('keyboard');},true);
addEventListener('mousemove',event=>{if(event.movementX||event.movementY)useInputDevice('keyboard');});
function requestInspector({enter=false}={}){
 if(!devEnabled||renderer._beginPending)return;
 if(session?.connected){ui.toast('Map inspection is available in solo play.');return;}
 if(packUI.isOpen)packUI.close();
 if(screen==='menu'){inspectOnStart=true;begin(false);return;}
 if(screen==='pause'){resume();if(enter&&inspector.active)return;}
 if(screen!=='play')return;
 resetInput();acc=0;
 if(inspector.active){inspector.leave();audio.resume();}
 else{inspector.enter(run);audio.pause();}
 renderer.freeCamera=inspector.active?inspector.pose:null;
 document.body.classList.toggle('inspecting',inspector.active);
 if(inspector.active)document.exitPointerLock?.();else pointerLock();
}
function updateInspector(dt){
 if(inspectOnStart&&screen==='play'){inspectOnStart=false;requestInspector();}
 if(inspector.active&&screen==='menu'){inspector.leave();renderer.freeCamera=null;document.body.classList.remove('inspecting');}
 if(inspector.active&&screen==='play'){inspector.update(dt,keys);renderer.freeCamera=inspector.pose;}
 if(!inspectorPanel&&inspector.active){
  inspectorPanel=new DevFlightUI();
  document.body.append(inspectorPanel.element);
 }
 inspectorPanel?.update({active:inspector.active&&screen==='play',pose:inspector.pose,speed:inspector.speed,pointerLocked:document.pointerLockElement===canvas,course:run.course});
}
function inspectFullMap(){
 if(inspector.active&&screen==='play'&&inspector.overview(run.course,renderer.camera.aspect)){resetInput();renderer.freeCamera=inspector.pose;}
}
function toggleGodMode(){
 if(!devEnabled||session?.connected||!['play','pause'].includes(screen))return;
 if(setGodMode(run,!run.godMode)){
  ui.toast(`GOD MODE ${run.godMode?'ON / DAMAGE & GRABS DISABLED':'OFF'}`);
  if(screen==='pause')ui.pause();
 }
}
function inspectReturnRoute(){
 const p=run.course.basementPortal;if(!p||!inspector.active)return;
 inspector.pose={x:p.x*4,y:3.2,z:p.y*4,angle:p.arrivalAngle??p.angle??0,pitch:-.35};
 renderer.freeCamera=inspector.pose;ui.toast(p.label+' / F4 TO LAND / E OR Q TO TRAVEL');
}
function landInspector(){
 if(!inspector.active||screen!=='play'||session?.connected)return;
 if(getActiveVehicle(run)?.occupied){ui.toast('Leave your vehicle before landing the camera.');return;}
 const x=inspector.pose.x/4,y=inspector.pose.z/4;
 const room=run.course.activeInterior;
 if(room&&(Math.abs(x-room.x/4)>room.width/8-.22||Math.abs(y-room.z/4)>room.depth/8-.22)){ui.toast('Land inside this room, then use its door to go outside.');return;}
 if(!canStand(run.course,x,y,.22,0)){ui.toast('Cannot land here. Move above clear walkable ground.');return;}
 if(run.bite?.phase!=='idle'||run.brutal?.phase!=='idle'||run.extraction?.phase!=='idle'){ui.toast('Finish the current interaction before landing.');return;}
 Object.assign(run,{x,y,z:0,angle:inspector.pose.angle,pitch:0,vx:0,vy:0,vz:0,supportZ:null,supportId:null,structureId:null,slide:0,dashTime:0,hookTime:0,hookTarget:-1,slam:false,rifleBurst:0,rifleBurstTimer:0,rifleCharging:false,rifleCharge:0});
 requestInspector();ui.toast('LANDED / F3 TO TOGGLE GOD MODE');
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-dev-god]'))toggleGodMode();
 if(event.target.closest('[data-dev-land]'))landInspector();
 if(event.target.closest('[data-dev-route]'))inspectReturnRoute();
});
document.addEventListener('click',event=>{if(event.target.closest('[data-dev-inspect]'))requestInspector({enter:screen==='pause'});if(event.target.closest('[data-dev-overview]'))inspectFullMap();if(inspector.active&&event.target.closest('[data-dev-capture]')){document.activeElement?.blur();if(document.pointerLockElement===canvas){resetInput();document.exitPointerLock?.();}else pointerLock();}if(inspector.active&&event.target.closest('[data-dev-reset]')){inspector.reset();renderer.freeCamera=inspector.pose;}});
// Capture developer inputs before the game's weapon/ability shortcuts.
addEventListener('keydown',event=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(event.code==='F2'&&devEnabled){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)requestInspector();return;}
 if(event.code==='F3'&&devEnabled){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)toggleGodMode();return;}
 if(!inspector.active||screen!=='play'||event.code==='Escape')return;
 if(event.code==='Tab'&&document.pointerLockElement===canvas){event.preventDefault();event.stopImmediatePropagation();resetInput();document.exitPointerLock?.();return;}
 if(event.code==='Tab'||['Enter','Space'].includes(event.code)&&document.activeElement?.tagName==='BUTTON')return;
 event.preventDefault();event.stopImmediatePropagation();keys.add(event.code);
 if(event.code==='F4'&&!event.repeat)landInspector();
 if(event.code==='KeyH'&&!event.repeat)inspectorPanel?.toggleHelp();
 if(event.code==='KeyR'&&!event.repeat)inspector.reset();
 if(event.code==='KeyM'&&!event.repeat)inspectFullMap();
},true);
addEventListener('mousemove',event=>{if(inspector.active&&screen==='play'&&document.pointerLockElement===canvas){event.stopImmediatePropagation();inspector.look(event.movementX*settings.sensitivity,event.movementY*settings.sensitivity);}},true);
canvas.addEventListener('wheel',event=>{if(inspector.active&&screen==='play'){event.preventDefault();event.stopImmediatePropagation();inspector.changeSpeed(event.deltaY<0?1:-1);}},{capture:true,passive:false});
canvas.addEventListener('pointerdown',event=>{if(inspector.active&&screen==='play'){event.preventDefault();event.stopImmediatePropagation();document.activeElement?.blur();pointerLock();}},true);
addEventListener('keydown',e=>{
 if(e.code==='Escape'){e.preventDefault();if(packUI.isOpen){packUI.close();return;}if(ui.escape?.())return;screen==='play'?pause():screen==='pause'?resume():null;return;}
 if(inspector.active&&screen==='play')return;
 const focused=document.activeElement;
 if(e.isComposing||focused?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(focused?.tagName))return;
 if(e.code==='KeyB'&&(run.course.extended||run.course.scavenging)&&['play','pause'].includes(screen)){e.preventDefault();if(!e.repeat)packUI.toggle();return;}
 // Retry belongs to the finish screen. Let focused buttons/links keep their
 // normal Enter activation, so returning to the title cannot also retry.
 if((e.code==='Enter'||e.code==='NumpadEnter')&&['dead','win'].includes(screen)){
  if(['BUTTON','A'].includes(focused?.tagName)||ui.root?.dataset.settingsOpen==='true')return;
  e.preventDefault();if(!e.repeat)restart();return;
 }
 if(screen!=='play')return;
 if(['Space','ControlLeft','ControlRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(e.code==='KeyR'&&getActiveVehicle(run)?.occupied){if(Math.abs(getActiveVehicle(run).speed)<.05)recoverVehicle(run);return;}
 if(e.code==='Space')pulses.add('jump');
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')pulses.add('dash');
 if(/^Digit[1-8]$/.test(e.code))switchWeapon(run,Number(e.code.at(-1))-1);
 if(e.code==='KeyC')pulses.add('attachment');
 if(e.code==='KeyG')requestVermin();
 if(e.code==='KeyF')punch();
 if(e.code==='KeyV')requestChest();
 if(e.code==='KeyE'&&!e.repeat){
  if(basementPrompt(run)&&!session?.connected){const next=basementConnection.transition(run);if(next)enterIslandArea(next);return;}
  hookSequence++;if(session?.role!=='guest'||!session.connected)grapple(run);
 }
 if(e.code==='KeyR')ui.toast('Weapons replenish automatically — no reload needed.');
});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('pointerdown',e=>{if(screen!=='play')return;if(e.pointerType==='touch'){touches.set(e.pointerId,{action:'look',x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);}else if(document.pointerLockElement!==canvas)pointerLock();});
// Mouse button chords emit mousedown/up for each button; pointerdown/up only
// report the first press and last release, so they cannot own aim + fire.
canvas.addEventListener('mousedown',e=>{if(screen!=='play'||inspector.active||document.pointerLockElement!==canvas)return;if(e.button===0){fire=true;pulses.add('fire');}if(e.button===2){alt=true;pulses.add('alt');}if(e.button===1){attachment=true;pulses.add('attachment');}});
addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&screen==='play')look(run,e.movementX*settings.sensitivity,e.movementY*settings.sensitivity);});
canvas.addEventListener('pointermove',e=>{const t=touches.get(e.pointerId);if(t?.action==='look'){look(run,(e.clientX-t.x)*1.8*settings.sensitivity,(e.clientY-t.y)*1.8*settings.sensitivity);t.x=e.clientX;t.y=e.clientY;}});
document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('[data-action]');if(!b||screen!=='play')return;e.preventDefault();const a=b.dataset.action;if(['fire','alt','attachment','jump','dash'].includes(a))pulses.add(a);if(a==='parry'){punch();return;}if(a==='hook'){hookSequence++;if(session?.role!=='guest'||!session.connected)grapple(run);return;}if(a==='weapon'){switchWeapon(run,nextOwnedWeapon(run,1));return;}touches.set(e.pointerId,{action:a});b.setPointerCapture(e.pointerId);});
const release=e=>{touches.delete(e.pointerId);if(e.pointerType!=='touch'){if(e.button===0)fire=false;if(e.button===2)alt=false;if(e.button===1)attachment=false;}};addEventListener('pointerup',release);addEventListener('mouseup',release);addEventListener('pointercancel',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{if(screen!=='play')return;e.preventDefault();switchWeapon(run,nextOwnedWeapon(run,e.deltaY>0?1:-1));},{passive:false});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&screen==='play'&&!inspector.active)pause();});addEventListener('blur',()=>{windowFocused=false;resetInput();if(screen==='play')pause();});addEventListener('focus',()=>{windowFocused=true;gamepadInput.suppress();});document.addEventListener('visibilitychange',()=>{resetInput();if(document.hidden&&screen==='play')pause();});addEventListener('resize',()=>renderer.resize());
const spatialEvent=e=>eventAudioDetails(e,run);
function updateWorldAudio(force=false){
 audio.updateListener(listenerPose(run));
 if(force||performance.now()>=nextSpatialRefresh){nextSpatialRefresh=performance.now()+50;
  audio.updateTrackedSources(key=>resolveAudioTrack(key,run),position=>atmosphereOcclusion(run,position));
  roomAtmosphereAudio.update(run,renderer,{playing:screen==='play'&&!inspector.active,presence:horrorPresence,force});
 }
}
function horrorSourcePoint(minDistance,maxDistance){
 const candidates=(run.course.spawnPoints||[]).map(p=>{
  const dx=p.x-run.x,dy=p.y-run.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  const occluded=castRay(run.course,run.x,run.y,angle,d).dist<d-.12;
  const offscreen=Math.abs(angleDiff(angle,run.angle))>.95;
  return{...p,d,occluded,offscreen,score:Math.abs(d-(minDistance+maxDistance)/2)+(occluded?0:1.3)+(offscreen?0:4)};
 }).filter(p=>p.d>=minDistance&&p.d<=maxDistance&&p.offscreen).sort((a,b)=>a.score-b.score);
 if(candidates.length)return candidates[0];
 return{x:run.x-Math.cos(run.angle)*minDistance,y:run.y-Math.sin(run.angle)*minDistance,d:minDistance,occluded:false,offscreen:true};
}
function updateDungeonScareAudio(){
 const course=run.course,progression=run.dungeonProgression;
 if(!course?.dungeon||!progression||!audio.assetsLoaded||!horrorPresence.allowLegacy(run))return;
 const roomId=progression.activeRoomId;
 if(!roomId||(course.enemies||[]).some(e=>!e.dead))return;
 const scare=(course.scares||[]).find(item=>item.roomId===roomId&&!heardDungeonScares.has(item.id)&&(item.kind==='scream'||item.kind==='watcher'));
 if(!scare)return;
 const [x,y]=scare.at||[],d=Math.hypot(x-run.x,y-run.y),angle=Math.atan2(y-run.y,x-run.x);
 const occluded=castRay(course,run.x,run.y,angle,d).dist<d-.12;
 const cueType=scare.id==='f3-scream-apse'?'horror-sting':scare.kind==='scream'?'distant-scream':'horror-approach';
 const cue=spatialEvent({type:cueType,x,y,z:.08,id:'dungeon-'+scare.id,enemyId:'dungeon-'+scare.id,occluded,cooldown:18,volume:cueType==='horror-sting'?.13:scare.kind==='scream'?.22:.13});
 const played=audio.play(cueType,0,cue);
 heardDungeonScares.add(scare.id);
 if(played){horrorPresence.claimLegacy(run,'dungeon-audio',5);audio.duckAtmosphere(.55,.75,1.8,1.2);}
}
function updateHorrorAudio(){
 if(run!==horrorRunRef){horrorRunRef=run;lastHorrorCueAt=-Infinity;nextHorrorCheck=0;horrorQuietSince=null;distantScreamPlayed=false;heardDungeonScares.clear();}
 if(screen!=='play'||run.mode!=='play'||run.health<=0||!horrorPresence.allowLegacy(run))return;
 const time=run.time||0;
 if(time>=nextHorrorCheck&&time-lastHorrorCueAt>=8){
  nextHorrorCheck=time+.4;
  const enemies=(run.course.enemies||[]).filter(e=>!e.dead&&!e.attacking).map(e=>({e,d:Math.hypot(e.x-run.x,e.y-run.y)})).filter(t=>t.d>=2.7&&t.d<=8.2).sort((a,b)=>a.d-b.d);
  for(const {e,d} of enemies){
   const angle=Math.atan2(e.y-run.y,e.x-run.x),ray=castRay(run.course,run.x,run.y,angle,d),occluded=ray.dist<d-.12;
   if(!occluded&&Math.abs(angleDiff(angle,run.angle))<.82)continue;
   const cue=spatialEvent({type:'horror-approach',x:e.x,y:e.y,z:.08,enemyId:e.id,occluded,cooldown:8,volume:.15});
   if(audio.play('horror-approach',0,cue)){
    horrorPresence.claimLegacy(run,'approach-audio',4);audio.duckAtmosphere(.68,.65,1.5,1.1);
    lastHorrorCueAt=time;
    break;
   }
  }
 }
 if(run.director?.state==='exit'){
  if(horrorQuietSince===null)horrorQuietSince=time;
  if(!distantScreamPlayed&&time-horrorQuietSince>=2.8){
   const source=horrorSourcePoint(5,10);
   if(audio.play('distant-scream',0,{id:'distant-scream-'+run.sectorIndex,position:{x:source.x*4,y:1.2,z:source.y*4},volume:.25})){
    horrorPresence.claimLegacy(run,'distant-audio',5);audio.duckAtmosphere(.5,.8,2,1.2);
    distantScreamPlayed=true;
   }
  }
 }else horrorQuietSince=null;
 updateDungeonScareAudio();
}
let floorPreparation = null;
function enterIslandArea(next){
 const previous=run;lowTideSave.save(basementConnection.surfaceForSave(previous));run=next;
 prepareDescentFloor(previous);
}
function prepareDescentFloor(previous=null){
 if(floorPreparation||(!run.course?.dungeon&&!previous)||session?.connected)return;
 const course=run.course;
 const token={course};floorPreparation=token;
 screen='loading';run.mode='pause';acc=0;resetInput();audio.pause();
 ui.loading(course.harbor?'Climbing to Blackwater Island':`Descending to floor ${course.dungeonIndex+1}: ${course.name}`);
 // Paint the transition before constructing the next floor or uploading it.
 requestAnimationFrame(()=>setTimeout(async()=>{
  try{
   if(floorPreparation!==token||run.course!==course)return;
   renderer.render(run,performance.now());
   await renderer._warmupPromise;
   if(floorPreparation!==token||run.course!==course)return;
   floorPreparation=null;screen='play';run.mode='play';acc=0;last=performance.now();
   ui.play();ui.hud(run,{network,fps});audio.setAmbiencePreset?.(course.dungeon?course.dungeonIndex:run.sectorIndex);audio.setScene?.('play');if(!windowFocused||document.hidden)pause();else{audio.resume();audio.play('ambience');}
   ui.toast(course.harbor?'BLACKWATER ISLAND / CUSTOMS SERVICE STAIRS':`BASEMENT ${String(course.dungeonIndex+1).padStart(2,'0')} // ${course.name.toUpperCase()} · E / Q AT ENTRY TO RETURN`);
  }catch(error){
   if(previous){run=previous;floorPreparation=null;screen='play';run.mode='play';ui.play();audio.resume();ui.toast('Stairs unavailable. Try again.');}
   else ui.loading('Could not load the next floor. Reload to try again.',true);console.error(error);
  }
 },0));
}
function processEvents(){
 if(run.distance<lastStep)lastStep=0;
 if(run.time<lastHeartbeat)lastHeartbeat=0;
 if(run.distance-lastStep>.4&&run.z<.02&&run.slide<.3){lastStep=run.distance;horrorPresence.noteStep(run);audio.play('footstep');}
 if(run.health>0&&run.health<35&&run.time-lastHeartbeat>.8){lastHeartbeat=run.time;audio.play('heartbeat');}
 audio.updateListener(listenerPose(run));
 audio.setAmbiencePreset?.(run.course?.dungeon?run.course.dungeonIndex:(run.sectorIndex??0));
 updatePresence();
 updateHorrorAudio();
 for(const e of [...run.events.map(e=>FIREARM_EVENTS.has(e.type)?{...e,playerId:e.playerId||run.playerId||'host'}:e),
  ...(run.peer?.events||[]).map(e=>FIREARM_EVENTS.has(e.type)?{...e,playerId:e.playerId||run.peer.playerId||'peer'}:e)]){
  const localBite=!(BITE_EVENTS.has(e.type)||VERMIN_LOCAL_EVENTS.has(e.type))||e.playerId===(run.playerId||'host');
  if(localBite){ui.combatEvent?.(e);audio.play(e.type,e.weapon??run.weapon,spatialEvent(e));}
  if(e.type==='sector-transition'||e.type==='dungeon-doors-open'&&e.wave%2===1||e.type==='room-transition'&&e.roomIndex%2===1){
   renderer.queueHorrorScare('drop',run);
  }
  if(e.type==='sector-transition'&&audio.play('horror-sting'))audio.duckAtmosphere(.65,.18,.7,.9);
  if(e.type==='wave'&&e.wave===1&&(run.course?.dungeon?run.course.dungeonIndex===0:run.sectorIndex===0))audio.play('horror-reveal');
  const eventRoomId=e.roomId||e.encounterRoomId||e.nextRoomId;
  const eventRoom=run.course?.rooms?.find(room=>room.id===eventRoomId);
  const eventRoomName=String(e.roomName||eventRoom?.name||'NEXT ROOM').toUpperCase();
  if(e.type==='journey-action'){
   const chime=['nave-chime','tower-chime','chancel-chime'].indexOf(e.stationId);
   audio.play(chime>=0?'wave':'mechanism',chime>=0?0:1,{...spatialEvent(e),group:'sfx',volume:chime>=0?.2:.14,rate:chime>=0?[.82,1,1.18][chime]:.8,cooldown:.1});
  }
  if(e.type==='dungeon-room-enter')ui.toast('ROOM '+String((e.roomIndex??run.dungeonProgression?.roomIndex??0)+1).padStart(2,'0')+' // '+eventRoomName);
  if(e.type==='dungeon-encounter-start')ui.toast((eventRoom?.flow?.goal||'HOLD THE ROOM').toUpperCase()+' // '+eventRoomName);
  if(e.type==='dungeon-encounter-phase'&&e.phaseIndex>0)ui.toast(String(e.phase||'REINFORCEMENTS').toUpperCase()+' // APPROACH '+(e.phaseIndex+1)+' OF '+e.phaseCount);
  if(e.type==='dungeon-ingress'){
   ui.approachCue?.(e);
   audio.play('horror-approach',0,spatialEvent({...e,type:'horror-approach',id:`ingress-${e.ingressId}-${e.phaseIndex}`,occluded:true,volume:.35,cooldown:3}));
  }
  if(e.type==='dungeon-room-clear')ui.toast('ROOM CLEAR // '+eventRoomName);
  if(e.type==='dungeon-supply'){ui.toast(`RECOVERY CACHE // +${Math.round(e.health||0)} VITALS / +${Math.round(e.energy||0)} ENERGY`);audio.play('equip');}
  if(e.type==='dungeon-doors-open')ui.toast('PATH OPEN // '+String(e.count||1)+' DOOR'+(e.count===1?'':'S'));
  if(e.type==='room-transition')ui.toast('ROOM '+String((e.roomIndex??run.roomProgression?.currentIndex??0)+1).padStart(2,'0')+' // '+eventRoomName);
  if(e.type==='room-clear')ui.toast('ROOM CLEAR // '+eventRoomName);
  if(e.type==='dungeon-weapon'){ui.lootDiscovery?.(e);audio.play('equip');}
  if(e.type==='low-tide-progress'){if(!e.record)ui.toast(e.message);audio.play('equip');lowTideSave.save(basementConnection.surfaceForSave(run));}
  if(e.type==='low-tide-bell'){audio.play('wave',0,spatialEvent(e));ui.toast('SHIFT BELL · INFECTED ARE MOVING TOWARD POWER CUT');}
  if(e.type==='scavenger-scrap'){ui.toast(`${e.discoveryLabel||'SALVAGED FITTINGS'} +${e.amount} · PACK ${e.total}/12 · B`);audio.play('equip',0,{...spatialEvent(e),volume:.12});}
  if(e.type==='scavenger-full'){ui.toast('PACK FULL · FIT A WEAPON AT A REPAIR BENCH · CACHE SAVED');}
  if(e.type==='scavenger-supplies'&&e.playerId===(run.playerId||'host')){ui.toast(`${Object.entries(e.contents).filter(([,n])=>n>0).map(([id,n])=>`+${n} ${id.toUpperCase()}`).join(' / ')} · B SUPPLY POUCH`);audio.play('equip',0,{...spatialEvent(e),volume:.12});lowTideSave.save(basementConnection.surfaceForSave(run));}
  if(e.type==='scavenger-supplies-full'&&e.playerId===(run.playerId||'host'))ui.toast('SUPPLY POUCH FULL · B TO USE, CRAFT OR DROP SPARE MATERIALS · CASE SAVED');
  if(e.type==='scavenger-route-prompt'&&e.playerId===(run.playerId||'host'))ui.toast('FOOTBRIDGE ROUTE · Q TO TAKE AND MARK ON FIELD MAP');
  if(e.type==='scavenger-search-prompt'&&e.playerId===(run.playerId||'host'))ui.toast(`Q · ${String(e.label||'SEARCH SUPPLIES').toUpperCase()}`);
  if(e.type==='scavenger-route'&&e.playerId===(run.playerId||'host')){ui.toast(`${String(e.destinationName||'FOREST FOOTBRIDGE').toUpperCase()} MARKED · B FIELD MAP`);audio.play('equip',0,{...spatialEvent(e),volume:.12});}
  if(e.type==='weapon-stashed'){ui.lootDiscovery({weaponName:weapons[e.weaponIndex].name,story:'Stored in your backpack. Press B to equip or fit.',rarity:e.weaponIndex>=6?'uncommon':'rare',kicker:'WEAPON STASHED'});audio.play('equip');}
  if(e.type==='vehicle-enter'){ui.toast(e.vehicleType==='helicopter'?'UTILITY HELICOPTER · SPACE LIFT · CTRL DESCEND · SHIFT BRAKE · W/S FLY · A/D TURN · Q EXIT WHEN LANDED':`${e.label||'DOCK TRUCK'} · W/S DRIVE · A/D STEER · SPACE BRAKE · Q EXIT`);audio.play('mechanism',1);}
  if(e.type==='vehicle-exit'){ui.toast('ON FOOT · WEAPONS RETAINED IN BACKPACK');audio.play('mechanism',0);}
  if(e.type==='vehicle-stop-first')ui.toast('BRAKE BEFORE LEAVING THE VEHICLE · SPACE');
  if(e.type==='vehicle-land-first')ui.toast('LAND AND STOP BEFORE LEAVING THE HELICOPTER');
  if(e.type==='vehicle-recovered')ui.toast('VEHICLE RECOVERED TO ITS CLEAR PARKING SPACE');
  if(e.type==='helicopter-impact')ui.toast('OBSTRUCTION · TURN OR CLIMB INTO CLEAR SPACE');
  if(e.type==='helicopter-hard-landing')ui.toast('HARD LANDING · SLOW DOWN BEFORE TOUCHDOWN');
  if(e.type==='vehicle-exit-blocked')ui.toast('DOOR BLOCKED · MOVE INTO CLEAR SPACE');
  if(e.type==='dungeon-key')ui.lootDiscovery?.({weaponName:e.keyName,story:e.story,rarity:'rare',kicker:'KEY / RECORD RECOVERED'});
  if(e.type==='dungeon-evidence'){ui.lootDiscovery?.({weaponName:e.title,story:e.story,rarity:'record',kicker:'EVIDENCE / ARCHIVED'});audio.play('equip');}
  if(e.type==='basement-cleared')ui.toast('UNDERGROUND CLEARED / RETURN VIA THE LIFTS AND CUSTOMS STAIRS');
  if(e.type==='sector-transition'){if(e.dungeon){if(basementConnection.island)attachBasementReturn(run.course);prepareDescentFloor();}else ui.toast('DESCENT '+(e.sectorIndex+1)+' // '+e.sectorName.toUpperCase());}
  if(session?.role==='host'&&(FIREARM_EVENTS.has(e.type)||BITE_EVENTS.has(e.type)||e.type.startsWith('vermin-')||['enemy-attack','explosion','spawn','wave','sector-transition','melee-hit','melee-wall','chainsaw-hit','extract-start','extract-draw','extract-incise','extract-rip','extract-complete','extract-cancel','brutal-start','brutal-contact','brutal-extract','brutal-release'].includes(e.type))){netEvents.push({...e,seq:++netEventSeq});netEvents=netEvents.slice(-20);}
 }
 lowTideSave.save(basementConnection.surfaceForSave(run));run.events.length=0;run._noiseCursor=0;if(run.peer?.events)run.peer.events.length=0;
}
function frame(t){const elapsed=last?Math.max(0,(t-last)/1000):0,dt=Math.min(.1,elapsed);last=t;frames++;fpsClock+=elapsed;if(fpsClock>.75){fps=frames/fpsClock;frames=0;fpsClock=0;}updateGamepad();updateInspector(dt);const live=!horrorManual&&!inspector.active&&(screen==='play'||(session?.connected&&screen==='pause'));if(live&&run.mode==='play'){acc=Math.min(acc+dt,.1);const i=intent();const area=basementConnection.update(run,i.interact,{connected:!!session?.connected});if(area){enterIslandArea(area);requestAnimationFrame(frame);return;}i.predictWeapons=!!(session?.connected&&session.role==='guest');let stepped=false;while(acc>=1/120){stepped=true;if(session?.connected&&session.role==='guest'){if(run.weapon>=4||(run.weapon===1&&i.attachment)){fireWeaponInput(run,i,true);tickPlayer(run,1/120,i);}else{tickPlayer(run,1/120,i);if(run.health>0&&(!run.brutal||run.brutal.phase==='idle')&&(!run.verminHand||run.verminHand.phase==='idle')&&i.fire&&run.cooldowns[run.weapon]<=0){run.shot=1;run.cooldowns[run.weapon]=weapons[run.weapon].interval;audio.play(run.weapon===3?'rocket':'shot',run.weapon);}}}else{fireWeaponInput(run,i);if(run.peer){const fresh=performance.now()-remoteSeen<350;let ri=fresh?remoteInput:{};if(fresh&&(remotePress.fire||remotePress.alt||remotePress.attachment))ri={...ri,fire:ri.fire||(remotePress.fire&&ri.weapon!==7),alt:ri.alt||remotePress.alt,attachment:ri.attachment||remotePress.attachment};remotePress.fire=false;remotePress.alt=false;remotePress.attachment=false;if(Number.isFinite(ri.angle)){run.peer.angle=ri.angle;run.peer.pitch=ri.pitch;switchWeapon(run.peer,ri.weapon);}if(ri.chest>remoteChest){remoteChest=ri.chest;chestFinisher(run.peer);}tickPlayer(run.peer,1/120,ri);fireWeaponInput(run.peer,ri);if(ri.parry>remoteParry){remoteParry=ri.parry;if(!attackVermin(run.peer))parry(run.peer);}if(ri.hook>remoteHook){remoteHook=ri.hook;grapple(run.peer);}}tick(run,1/120,i);}acc-=1/120;}if(stepped&&(!session?.connected||session.role==='host'))pulses.clear();processEvents();netClock+=dt;if(session?.connected&&(netClock>=.05||(session.role==='host'&&['dead','win'].includes(run.mode)))){netClock=0;if(session.role==='host')session.send({t:'snapshot',s:snapshot()});else{session.send({t:'input',i:{...i,angle:run.angle,pitch:run.pitch,weapon:run.weapon}});pulses.clear();}}}
 if(renderer._beginPending){requestAnimationFrame(frame);return;}
 if(screen!=='play'||inspector.active)updatePresence();
 if(screen==='loading'){requestAnimationFrame(frame);return;}
 const fatalBiteStart=run.mode==='dead'&&run.bite?.phase==='terminal'&&!fatalBiteUntil;
 if(fatalBiteStart)fatalBiteUntil=t+1600;if(['win','dead'].includes(run.mode)&&!['win','dead'].includes(screen)&&(!fatalBiteUntil||t>=fatalBiteUntil)){screen=run.mode;resetInput();document.exitPointerLock?.();audio.pause();audio.setScene?.(run.mode);ui.finish(run,run.mode==='win');if(session?.role==='host'&&session.connected)session.send({t:'snapshot',s:snapshot()});}
 audio.updateMelee?.({weapon:run.weapon,active:run.sawActive,rev:run.sawRev,contact:run.sawContact>0,playing:!inspector.active&&screen==='play'&&run.mode==='play'&&run.health>0});
 packUI.update(run,{visible:(run.course.extended||run.course.scavenging)&&['play','pause'].includes(screen),canUpgrade:!session?.connected});if(screen==='menu')renderer.renderMenu(run,t);else if(screen!=='pause')renderer.render(run,t);updateWorldAudio();hudClock+=dt;if(fatalBiteStart||hudClock>=1/30){hudClock=0;ui.hud(run,{network:session?.connected?'P2P / '+Math.round(session.rtt||0)+' MS':network,fps});}requestAnimationFrame(frame);}
ui.devEnabled=devEnabled;configure(ui.prefs||settings);audio.setScene?.('menu');ui.menu();requestAnimationFrame(frame);
renderer.onPreparationProgress=stage=>{if(renderer._beginPending||floorPreparation)ui.loading(stage);};
if(devEnabled&&routeParams.has('inspect'))requestAnimationFrame(()=>requestInspector());
if(routeParams.has('debug')||devEnabled)window.__DEAD_ARRIVAL__={get run(){return run;},get screen(){return screen;},get session(){return session;},get fps(){return fps;},get controller(){return {inputDevice,connected:gamepadFrame.connected,armed:gamepadFrame.armed,intent:intent()};},renderer,audio,begin,pause,resume,snapshot,receive,ui,packUI,inspector,requestInspector};
if(routeParams.has('spatialqa')&&devEnabled)window.__SPATIAL_QA__={diagnostics:()=>({...roomAtmosphereAudio.diagnostics(),audio:audio.spatialDiagnostics()}),refresh:()=>updateWorldAudio(true),trigger:(family,id)=>{roomAtmosphereAudio.bind(run,renderer);return roomAtmosphereAudio.trigger(family,run,id);},reset:()=>{roomAtmosphereAudio.reset();updateWorldAudio(true);}};
if(routeParams.has('horrorqa')&&devEnabled)window.__HORROR_QA__={
 setManual(value){horrorManual=!!value;acc=0;},
 get manual(){return horrorManual;},
 configure,
 diagnostics(){return {...horrorPresence.diagnostics(),settings:{...settings},audio:horrorPresenceAudio.diagnostics(),visuals:renderer.horrorEncounters?.diagnostics||null,cuff:renderer.horrorCuff?.diagnostics()||null,screen,mode:run.mode};},
 trigger(kind,options={}){updatePresence();const ok=horrorPresence.trigger(kind,run,{...options,force:true});updatePresence();renderer.render(run,performance.now());return ok;},
 reset(){horrorPresence.reset();horrorPresenceAudio.reset();renderer.horrorEncounters?.reset();renderer.horrorCuff?.reset();updatePresence();},
 prepare({kind='witness',natural=false}={}){
  if(screen!=='play')return false;horrorManual=!natural;
  for(const e of run.course.enemies)e.dead=true;run.projectiles=[];run.health=100;run.damage=0;run.shot=0;run.speed=0;run.vx=0;run.vy=0;run.vz=0;
  renderer.bodycamMotion?.reset();
  for(const action of ['bite','brutal','extraction','verminHand','verminCrawl'])if(run[action])run[action]={...run[action],phase:'idle',elapsed:0};
  run.meleeActive=false;run.sawActive=false;run.rifleCharging=false;run.punch=0;run.parryTime=0;run.dashTime=0;run.slide=0;run.hookTime=0;run.playerWounds={...run.playerWounds,rightArm:'intact'};
  if(run.vermin?.swarm)run.vermin.swarm={...run.vermin.swarm,phase:'idle',cooldown:999,nextAmbientAt:999999};
  const room=run.course.rooms?.find(r=>r.flow?.role!=='recovery'&&r.bounds&&canStand(run.course,(r.bounds.minX+r.bounds.maxX)/2,(r.bounds.minZ+r.bounds.maxZ)/2,.22));
  if(room){run.x=(room.bounds.minX+room.bounds.maxX)/2;run.y=(room.bounds.minZ+room.bounds.maxZ)/2;run.z=0;run.angle=0;run.pitch=0;}
  if(run.dungeonProgression){run.dungeonProgression.currentEncounter=null;run.dungeonProgression.phase='clear';run.dungeonProgression.activeRoomId=room?.id;for(const node of run.dungeonProgression.encounterPlan||[])node.status='cleared';run.dungeonProgression.pacing||=createPacing();run.dungeonProgression.pacing.ambushes=999;}
  if(run.roomProgression){run.roomProgression.currentEncounter=null;run.roomProgression.phase='clear';}
  this.reset();
  const anchor=horrorPresence.anchor(run,kind);if(anchor){run.angle=Math.atan2(anchor.y-run.y,anchor.x-run.x);run.pitch=0;}
  renderer.horrorScares&&(renderer.horrorScares.window&&(renderer.horrorScares.window.triggered=true));
  renderer.render(run,performance.now());return {roomId:room?.id,anchor,x:run.x,y:run.y};
 },
 advance(seconds,input={}){
  const count=Math.ceil(clamp(Number(seconds)||0,0,20)*120);
  for(let n=0;n<count;n++){if(screen!=='play'||run.mode!=='play')break;tick(run,1/120,input);processEvents();}
  updatePresence();renderer.render(run,performance.now());return this.diagnostics();
 }
};
if(routeParams.has('debug')||devEnabled)window.advanceTime=ms=>{
 const steps=Math.ceil(Math.min(5000,Math.max(0,Number(ms)||0))/1000*120);
 for(let n=0;n<steps;n++){if(screen!=='play'||run.mode!=='play')break;const input=intent();fireWeaponInput(run,input);tick(run,1/120,input);pulses.clear();processEvents();}
 ui.hud(run,{network,fps});packUI.update(run,{visible:run.course.scavenging,canUpgrade:!session?.connected});renderer.render(run,performance.now());
};
if(routeParams.has('debug')||devEnabled)window.render_game_to_text=()=>JSON.stringify({
 coordinates:'simulation cells; x east, y south, z height; 1 cell = 4 meters',screen,mode:run.mode,
 player:{x:run.x,y:run.y,z:run.z,angle:run.angle,health:run.health,weapon:run.weapon,owned:run.ownedWeapons,bite:run.bite,wounds:run.playerWounds,brutal:run.brutal,verminHand:run.verminHand,verminCrawl:run.verminCrawl},
 lowTide:run.lowTide,missionObjective:lowTideObjective(run),missionAction:lowTidePrompt(run)?.label,saveStatus:run.lowTideSaveStatus,journey:run.journey,navigation:run.dungeonProgression?.navigation,phase:run.dungeonProgression?.phase,completed:run.dungeonProgression?.roomsCompleted,
 enemies:run.course.enemies.filter(e=>!e.dead&&Math.hypot(e.x-run.x,e.y-run.y)<10).map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,variant:e.variant,state:e.state,attacking:e.attacking,wound:e.brutalWound,infestation:e.verminInfestation})),
 vermin:{scent:run.vermin?.scent,swarm:run.vermin?.swarm,rats:run.vermin?.rats.filter(r=>Math.hypot(r.x-run.x,r.y-run.y)<2)},
 backpack:run.backpack,extension:run.course.extension,horror:horrorPresence.diagnostics(),shots:run.shotSequence,kills:run.kills,bodycam:settings.bodycam,audio:audio.debugInfo?.contextState
});

{const clock=document.querySelector('[data-bc-time]');document.body.dataset.bodycam=settings.bodycam===false?'off':'on';const updateClock=()=>{if(!clock)return;const n=new Date(),z=v=>String(v).padStart(2,'0');clock.textContent=`${n.getFullYear()}-${z(n.getMonth()+1)}-${z(n.getDate())}  ${z(n.getHours())}:${z(n.getMinutes())}:${z(n.getSeconds())}`;};updateClock();setInterval(()=>{if(screen==='play')updateClock();},1000);}
