import {freezeLocalTransforms,sleepHiddenBranch} from './render-lifecycle.js';
import {supportCorpse,clearCorpseSupport} from './corpse-support.js';
import {stepEnemyImpulse} from './shove.js';
import {ENEMY_ROLES,hearNoise,canSeePlayer,neighbourField,attackConnects} from './enemy-behavior.js';
import * as T from '../vendor/three.module.js';
import {clone} from '../vendor/utils/SkeletonUtils.js';
import {loadGlb} from '../assets/load-glb.js';
import {terrainHeight,groundHeight,clamp} from './data.js';
import {walkableLine,createPathQueue} from './navigation.js';
import {clearShot} from './simulation.js';
import {stylizeModel} from './retro-materials.js';

export async function loadActors(scene,data,onProgress){
  const [zombie,truck,sedan,runner,dockworker]=await Promise.all([
    loadGlb(new URL('../assets/models/afterlife-ash-witness-motion-v07.glb',import.meta.url).href),
    loadGlb(new URL('../assets/harbor/truck-flat.glb',import.meta.url).href),
    loadGlb(new URL('../assets/harbor/sedan.glb',import.meta.url).href),
    loadGlb(new URL('../assets/models/zombie-variants/fever-runner.glb',import.meta.url).href),
    loadGlb(new URL('../assets/models/zombie-variants/drowned-dockworker.glb',import.meta.url).href),
  ]);
  const enemies=[];
  const templates=[zombie,dockworker,runner].map(asset=>{
    const bounds=new T.Box3().setFromObject(asset.scene);
    // The pose bounds are already needed for scale. Reuse their enclosing
    // sphere on each clone instead of skinning every vertex of every infected
    // again on the first draw. These actors use distance culling, not spheres.
    asset.scene.traverse(o=>{if(o.isSkinnedMesh&&o.boundingBox)o.boundingSphere=o.boundingBox.getBoundingSphere(new T.Sphere());});
    return {asset,bounds};
  });
  for(const [index,source] of data.enemies.entries()){
    const role=index%4===2?'runner':'shambler',variant=role==='runner'?2:index%3===1?1:0,{asset,bounds}=templates[variant],scale=(role==='runner'?1.85:1.95)/(bounds.max.y-bounds.min.y);
    const root=new T.Group(),model=clone(asset.scene);model.scale.setScalar(scale);model.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale/2);model.rotation.y=0;
    stylizeModel(model);model.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.color?.multiply(new T.Color(role==='runner'?0xbcc3b3:0xc6c7b5));});model.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
    root.add(model);sleepHiddenBranch(root);root.position.set(source.x,groundHeight(source.x,source.z),source.z);scene.add(root);
    const mixer=new T.AnimationMixer(model),actions={};for(const clip of asset.animations)actions[clip.name]=mixer.clipAction(clip);
    const enemy={...source,role,variant:['ash witness','drowned dockworker','fever runner'][variant],lastKnown:null,sightTimer:0,seesPlayer:false,attackYaw:0,root,model,mixer,actions,state:'',cooldown:0,notice:0,alive:true,home:{x:source.x,z:source.z},hit:0,path:[],navTimer:0,attackTimer:0};setEnemyAction(enemy,'idle');enemy.action.time=(source.phase%1)*enemy.action.getClip().duration;enemies.push(enemy);
  }
  function vehicle(template,x,z,angle,drive=false){
    const model=template.scene.clone(true),box=new T.Box3().setFromObject(model),s=4.8/Math.max(box.max.x-box.min.x,box.max.z-box.min.z);model.scale.setScalar(s);model.position.set(-(box.max.x+box.min.x)*s/2,-box.min.y*s,-(box.max.z+box.min.z)*s/2);
    stylizeModel(model);const root=new T.Group();root.add(model);root.position.set(x,groundHeight(x,z)+.12,z);root.rotation.y=angle+Math.PI;scene.add(root);if(!drive)freezeLocalTransforms(root);return {root,x,z,angle,speed:0,drive,home:{x,z,angle}};
  }
  const vehicles=[vehicle(truck,-690,260,1.76,true),vehicle(truck,752,76,Math.PI/2,true)];
  for(const w of data.wrecks){const v=vehicle(sedan,w.x,w.z,w.angle);v.root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.multiplyScalar(.65);}});}
  for(const v of data.parkedCars)vehicle(sedan,v.x,v.z,v.angle);
  onProgress?.();return {enemies,vehicles,animationNames:zombie.animations.map(a=>a.name)};
}
const clips={idle:'AshWitness_Idle',walk:'AshWitness_Shuffle',run:'AshWitness_Run',attack:'AshWitness_AttackLunge',hit:'AshWitness_HitRecoil',dead:'AshWitness_Collapse'};
const actorFrustum=new T.Frustum(),actorProjection=new T.Matrix4(),actorBounds=new T.Sphere(new T.Vector3(),5.5);
// These rigs deliberately disable per-mesh frustum tests to avoid expensive
// pose-bound reconstruction. Cull the whole rig against a generous world-space
// envelope instead; AI and animation still advance outside the camera view.
export function cullActorViews(enemies,camera,range=150){
 camera.updateWorldMatrix(true,false);
 actorFrustum.setFromProjectionMatrix(actorProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 for(const e of enemies){actorBounds.center.copy(e.root.position);actorBounds.center.y+=1;e.root.visible=e.root.position.distanceToSquared(camera.position)<range*range&&actorFrustum.intersectsSphere(actorBounds);}
}
export function setEnemyAction(e,state){
  if(e.state===state)return;if(state!=='dead')clearCorpseSupport(e);const wasMoving=['walk','run'].includes(e.state),phase=e.action?e.action.time/e.action.getClip().duration:0;e.state=state;
  const action=e.actions[state==='run'?ENEMY_ROLES[e.role||'shambler'].runClip:clips[state]]||e.actions[clips.idle]||Object.values(e.actions)[0];if(!action)return;
  if(e.action)e.action.fadeOut(.18);action.reset().setEffectiveWeight(1).fadeIn(.18).play();if(wasMoving&&['walk','run'].includes(state))action.time=(phase%1)*action.getClip().duration;action.clampWhenFinished=['dead','attack','hit'].includes(state);action.setLoop(['dead','attack','hit'].includes(state)?T.LoopOnce:T.LoopRepeat,Infinity);e.action=action;
}
const pathQueues=new WeakMap();
export function navigationMetrics(grid){return pathQueues.get(grid)?.stats??null;}
export function resetNavigation(grid){pathQueues.get(grid)?.clear();}
export function updateEnemies(enemies,primary,grid,dt,time,onDamage,companions=[]){
 let paths=pathQueues.get(grid);if(!paths){paths=createPathQueue(grid);pathQueues.set(grid,paths);}
 const floor=(x,z)=>grid.floorAt?.(x,z)??groundHeight(x,z),visualFloor=grid.effectFloorAt||floor,separate=neighbourField(enemies);let attackers=enemies.filter(e=>e.alive&&e.attackTimer>0).length;let supportBudget=384;
 for(const e of enemies){
  let player=primary;for(const other of companions)if(other.health>0&&(player.health<=0||Math.hypot(e.x-other.x,e.z-other.z)<Math.hypot(e.x-player.x,e.z-player.z)))player=other;
  const distance=Math.hypot(e.x-player.x,e.z-player.z);e.root.visible=Math.hypot(e.x-primary.x,e.z-primary.z)<150;if(distance>=150){e.notice=Math.max(0,e.notice-dt);continue;}
  e.crimsonWindow=Math.max(0,(e.crimsonWindow||0)-dt);if(e.finisherHeld)continue;
  e.cooldown=Math.max(0,e.cooldown-dt);e.hit=Math.max(0,e.hit-dt);if(!e.alive){e.mixer.update(dt);supportBudget-=supportCorpse(e,visualFloor,dt,supportBudget);continue;}
  if(e.hit>0&&e.attackTimer>0){e.attackTimer=0;attackers--;}
  stepEnemyImpulse(e,grid,dt);
  const role=ENEMY_ROLES[e.role||'shambler'];e.navTimer-=dt;e.sightTimer=(e.sightTimer||0)-dt;
  if(e.sightTimer<=0){e.sightTimer=.16;e.seesPlayer=canSeePlayer(e,player,grid);}
  if(e.seesPlayer){e.notice=7;e.lastKnown={x:player.x,z:player.z};e.heard=false;}else e.notice=Math.max(0,e.notice-dt);
  if(e.notice>0&&!e.lastKnown)e.lastKnown={x:player.x,z:player.z};
  let tx=e.home.x+Math.sin(time*.1+e.phase)*4,tz=e.home.z+Math.cos(time*.08+e.phase)*4,speed=.55,next='walk';
  if(e.notice>0&&e.lastKnown){tx=e.lastKnown.x;tz=e.lastKnown.z;speed=e.seesPlayer?role.speed:1.3;next=e.seesPlayer?'run':'walk';
   // Runners take a short lateral route while the slower dead hold the centre.
   if(e.role==='runner'&&e.seesPlayer&&distance>3&&distance<16){const side=e.phase>3?-1:1,dx=player.x-e.x,dz=player.z-e.z;const fx=tx+dz/distance*2.3*side,fz=tz-dx/distance*2.3*side;if(walkableLine(grid,e.x,e.z,fx,fz)){tx=fx;tz=fz;}}
   if(e.navTimer<=0){e.navTimer=.7+e.phase*.04;const ax=e.x,az=e.z,goalX=tx,goalZ=tz;
    paths.request(e,ax,az,goalX,goalZ,()=>e.alive&&!e.finisherHeld&&e.notice>0&&Math.hypot(e.x-player.x,e.z-player.z)<150&&Math.hypot(e.x-ax,e.z-az)<3&&!!e.lastKnown&&Math.hypot(e.lastKnown.x-goalX,e.lastKnown.z-goalZ)<6,path=>{if(path.length&&!walkableLine(grid,e.x,e.z,path[0].x,path[0].z)){e.navTimer=0;return;}e.path=path;});
   }
   while(e.path.length&&Math.hypot(e.x-e.path[0].x,e.z-e.path[0].z)<.7)e.path.shift();if(e.path.length){tx=e.path[0].x;tz=e.path[0].z;}
  }
  const oldX=e.x,oldZ=e.z,dx=tx-e.x,dz=tz-e.z,dist=Math.hypot(dx,dz),sameLevel=Math.abs(player.y-e.root.position.y)<2.1;
  if(e.attackTimer>0){e.attackTimer=Math.max(0,e.attackTimer-dt);next='attack';if(e.attackTimer===0){if(attackConnects(e,player,grid))(player===primary?onDamage:player.onDamage)(role.damage);e.cooldown=role.recovery;attackers--;}}
  else if(distance<1.8&&sameLevel&&e.seesPlayer){next='idle';if(e.cooldown===0&&e.hit===0&&attackers<2){e.attackTimer=role.windup;e.attackYaw=Math.atan2(player.x-e.x,player.z-e.z);e.root.rotation.y=e.attackYaw;next='attack';attackers++;}}
  else if(dist>.65&&e.hit===0){const mx=dx/dist*speed*dt,mz=dz/dist*speed*dt,y=floor(e.x,e.z);if(!grid.blocked(e.x+mx,e.z,y,.35)&&floor(e.x+mx,e.z)>1)e.x+=mx;if(!grid.blocked(e.x,e.z+mz,y,.35)&&floor(e.x,e.z+mz)>1)e.z+=mz;}
  else next='idle';
  if(e.attackTimer===0){const push=separate(e),y=floor(e.x,e.z);if(!grid.blocked(e.x+push.x*dt,e.z,y,.35)&&floor(e.x+push.x*dt,e.z)>1)e.x+=push.x*dt;if(!grid.blocked(e.x,e.z+push.z*dt,y,.35)&&floor(e.x,e.z+push.z*dt)>1)e.z+=push.z*dt;}
  if(e.hit>0){next='hit';if(e.attackTimer>0)attackers--;e.attackTimer=0;}
  const moved=Math.hypot(e.x-oldX,e.z-oldZ);if(['walk','run'].includes(next)&&moved<dt*.04)next='idle';setEnemyAction(e,next);e.root.position.set(e.x,visualFloor(e.x,e.z),e.z);
  if(e.attackTimer===0){const fx=moved>.001?e.x-oldX:dx,fz=moved>.001?e.z-oldZ:dz,targetYaw=Math.atan2(fx,fz),turn=Math.atan2(Math.sin(targetYaw-e.root.rotation.y),Math.cos(targetYaw-e.root.rotation.y));e.root.rotation.y+=turn*(1-Math.exp(-9*dt));}
  if(e.action){if(['walk','run'].includes(next))e.action.timeScale=clamp(moved/Math.max(dt,.001)/(next==='run'?2:1),.25,1.65);else e.action.timeScale=next==='attack'?.48/role.windup:1;}e.mixer.update(dt);
 }
 paths.advance();
}
export function damageEnemy(e,damage){e.health-=damage;e.hit=.28;e.crimsonWindow=1.25;e.notice=10;if(e.health<=0){e.alive=false;if(!e.finisherHeld)setEnemyAction(e,'dead');return true;}return false;}

export class Soundscape {
  constructor(){this.volume=.45;this.buffers=new Map();this.context=null;this.step=0;this.lastPlay=new Map();this.voices=new Set();}
  async start(){
    if(this.context){await this.context.resume();return;}
    this.context=new (window.AudioContext||window.webkitAudioContext)();this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.gain.connect(this.context.destination);
    const paths={cloth:'atmosphere/cloth-rustle-02.ogg',flesh:'free-gore-v1/blood-spit-02.wav',crimson:'sfx/processed/blood-burst.wav',voice:'sourced/enemies/zombie-moan-03.ogg',ossuary:'sourced/weapons/ossuary-02.ogg',breach:'sourced/weapons/breach-02.ogg',arc:'sfx/processed/arc-lance.wav',reliquary:'sourced/weapons/reliquary-02.ogg',carrion:'sourced/weapons/carrion-sks-02.ogg',mourning:'sourced/weapons/mourning-mosin-01.ogg',bat:'melee/bat-swing-01.ogg',chainsaw:'melee/chainsaw-idle.ogg',cut:'melee/chainsaw-hit.ogg',explosion:'sfx/cc0-dull-explosion.wav',step:'movement/footstep-02.ogg',shot:'sourced/weapons/carrion-sks-01.ogg',hit:'enemy/enemy-death-01.wav',reload:'afterlife/weapon-latch-metal.ogg',collect:'ui/coin-01.mp3'};
    Object.assign(paths,{'melee-flesh':'sfx/cc0-splat-hit.wav','bat-contact':'baseline/impact-impactSoft_heavy_000.ogg','blade-contact':'sfx/processed/impact-metal-flesh.wav','hammer-contact':'baseline/impact-impactPunch_heavy_000.ogg','pipe-contact':'baseline/impact-impactMetal_medium_002.ogg'});
    // Decode known local samples without turning a missing optional cue into a
    // gameplay failure. The rifle report below has a synthesized fallback.
    await Promise.all(Object.entries(paths).map(async([name,path])=>{try{const response=await fetch(new URL('../assets/audio/'+path,import.meta.url));if(response.ok)this.buffers.set(name,await this.context.decodeAudioData(await response.arrayBuffer()));}catch{}}));
    const buffer=this.context.createBuffer(1,this.context.sampleRate*3,this.context.sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=Math.random()*2-1;
    const wind=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),level=this.context.createGain();wind.buffer=buffer;wind.loop=true;filter.type='lowpass';filter.frequency.value=460;level.gain.value=.055;wind.connect(filter);filter.connect(level);level.connect(this.gain);wind.start();this.wind=wind;
  }
  engine(speed,on){if(!this.context)return;if(!this.motor){const osc=this.context.createOscillator(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();osc.type='sawtooth';filter.type='lowpass';filter.frequency.value=260;osc.connect(filter);filter.connect(gain);gain.connect(this.gain);gain.gain.value=0;osc.start();this.motor={osc,gain};}this.motor.osc.frequency.setTargetAtTime(32+speed*2.4,this.context.currentTime,.1);this.motor.gain.gain.setTargetAtTime(on?.07:0,this.context.currentTime,.12);}
  setVolume(v){this.volume=v;if(this.gain)this.gain.gain.setTargetAtTime(v,this.context.currentTime,.1);}
  pause(p){if(this.context)(p?this.context.suspend():this.context.resume()).catch(()=>{});}
  play(name,volume=.35,rate=1,pan=0){if(!this.context||this.context.state!=='running')return;const now=this.context.currentTime;if(['chainsaw','cut','flesh'].includes(name)&&now-(this.lastPlay.get(name)??-1)<(name==='chainsaw'?.24:.14))return;if(this.voices.size>=32)return;this.lastPlay.set(name,now);const buffer=this.buffers.get(name);if(buffer){const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume;const stereo=this.context.createStereoPanner();stereo.pan.value=clamp(pan,-1,1);source.connect(gain);gain.connect(stereo);stereo.connect(this.gain);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();stereo.disconnect();};source.start();return;}
    const ctx=this.context,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=name==='shot'?'sawtooth':'sine';osc.frequency.setValueAtTime(name==='shot'?150:440,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(name==='shot'?32:660,ctx.currentTime+.12);gain.gain.setValueAtTime(volume,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.16);osc.connect(gain);gain.connect(this.gain);this.voices.add(osc);osc.onended=()=>{this.voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start();osc.stop(ctx.currentTime+.18);
  }
}
