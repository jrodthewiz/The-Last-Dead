import {createRifleReload} from './rifle-reload.js';
import {createUtilityReload} from './utility-reloads.js';
import {finishExpeditionBreach,breachGesture,finishExpeditionSteel} from './breach-presentation.js';
import {craftExpeditionWeapons} from './expedition-weapons.js';
import {createShotgunReload} from './weapon-reload.js';
import {craftArc} from './arc-craft.js';
import * as T from '../vendor/three.module.js';
import {createOssuary,animateOssuary} from '../weapon-ossuary.js';
import {createBreach,animateBreach} from '../weapon-breach.js';
import {createArc,animateArc} from '../weapon-arc.js';
import {createReliquary,animateReliquary} from '../weapon-reliquary.js';
import {createRifle,animateRifle} from '../weapon-rifles.js';
import {createMeleeWeapon,animateMeleeWeapon} from '../weapon-melee.js';
import {createSalvageMelee} from './salvage-melee.js';
import {animateSalvageMelee,salvageFraming,fitSalvageHands} from './salvage-motion.js';
import {FIRE_RESPONSE,weaponResponse,weaponDraw,reloadWeight} from './weapon-response.js';
import {salvageMotionAge} from './salvage-response.js';
import {SALVAGE_RESPONSE} from './salvage-response.js';
import {fitRipperControl} from './ripper-presentation.js';
import {applySightPose,installAimingReferences} from './weapon-aim-pose.js';
import {WEAPONS} from './armory-state.js';
import {batContactPose} from './melee-presentation.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {installFPSArms,advanceFPSClip,seatFPSArms} from '../assets/survivor/fps-arms.js';
import {loadGlb} from '../assets/load-glb.js';
import {consoleMaterial} from './retro-materials.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';

export async function createArmoryModels(camera,source=loadGlb(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url).href)){
 const rig=new T.Group();rig.name='Blackwater expedition armory';camera.add(rig);
 const salvageIds=['sword','hammer','pipe'],holds=[...FIRST_PERSON_HOLD_POSES,...salvageIds.map(name=>({...FIRST_PERSON_HOLD_POSES[6],name}))],sourceIndices=holds.map((_,i)=>i<8?i:6);
 const models=[createOssuary(),createBreach(),createArc(),createReliquary(),createRifle({variant:'carrion'}),createRifle({variant:'mourning'}),createMeleeWeapon({variant:'bat'}),createMeleeWeapon({variant:'chainsaw'}),...salvageIds.map(createSalvageMelee)];
 // Remove the inherited overlay kit: it was authored for a different barrel
 // envelope and obscured the working breech at console resolution.
 models[1].getObjectByName('Img2ThreejsMicroDetail-breach')?.removeFromParent();models[1].userData.breach.pressureValve.visible=false;models[1].userData.breach.ribcage.visible=false;models[1].userData.breach.parts['underbarrel-launcher'].visible=false;models[1].userData.breach.materials.brass.color.setHex(0x9d9877);
 finishExpeditionBreach(models[1]);
 finishExpeditionSteel(models);
 const arcCraft=craftArc(models[2]),expeditionCraft=craftExpeditionWeapons(models);
 installAimingReferences(models);
 const groups=models.map((model,i)=>{const group=new T.Group(),hold=holds[i];group.add(model);group.userData.model=model;group.name=hold.name;group.position.fromArray(hold.position);group.rotation.fromArray(hold.rotation);group.scale.setScalar(hold.scale);if(i>=6)model.rotation.set(i===7?.32:.92,i===7?.58:-.32,i===7?-.10:-.22);
   if(i<6){const parts=model.userData.sculptRuntime?.parts||model.userData.rifle?.parts;for(const side of ['right','left']){const part=parts?.[side==='right'?'grip':'support-grip'];if(part){part.scale.set(side==='right'?.30:.46,.65,side==='right'?.30:.46);const socket=new T.Object3D();socket.position.set(0,side==='right'?(i===1?-.05:-.07):-.12,0);part.add(socket);model.userData[side==='right'?'grip':'supportGrip']=socket;}}}
   group.visible=false;rig.add(group);return group;});
 const asset=await source;
 installFPSArms({weaponGroups:groups,fpsSourceIndices:sourceIndices,weaponRig:rig,camera,_findWeaponSocket(model,name){let result=model.userData[name];if(!result)model.traverse(o=>{if(!result&&o.userData[name])result=o.userData[name];});return result;}},asset);
 // These tools supply complete grip trajectories. Inheriting the bat's elbow
 // swing a second time folds sleeves over the weapon during overhead cuts.
 for(const group of groups.slice(8)){group.userData.authoredFPS.gripDriven=true;fitSalvageHands(group,group.name);}
 // Expose the rear throttle beneath the casing instead of looking squarely
 // into the motor. Sockets stay calibrated to the original authored grip.
 fitRipperControl(models[7]);models[7].rotation.set(.43,.80,-.08);
 // Ossuary keeps its authored firing hand. A separate support chain appears
 // only for loading, so its one-handed firing silhouette remains intact.
 const reloadArm=new T.Group(),reloadGrip=new T.Object3D();reloadArm.userData.model=models[0];groups[0].add(reloadArm);reloadGrip.position.set(-.25,-.12,.1);models[0].add(reloadGrip);
 installFPSArms({weaponGroups:[reloadArm],fpsSourceIndices:[1],weaponRig:reloadArm,camera,_findWeaponSocket:(m,name)=>name==='supportGrip'?reloadGrip:m.userData.grip},asset);
 reloadArm.userData.authoredFPS.arms.find(a=>a.side==='right').wrapper.visible=false;reloadArm.visible=false;groups[0].userData.reloadArm=reloadArm;
 arcCraft.fitHands(groups[2]);expeditionCraft.bind(groups[3]);
 const shotgunReload=createShotgunReload(groups[1],models[1]);
 const utilityReloads=groups.map((g,i)=>[0,2,7].includes(i)?createUtilityReload(g,models[i],i):null);
 const materials=new Set();rig.traverse(o=>{o.layers.set(0);if(o.isMesh){o.castShadow=o.receiveShadow=false;for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);}});for(const m of materials){if(m.userData.surfaceRole==='authored-canvas')m.color.setHex(0x91aeb4);if(m.userData.surfaceRole==='authored-glove')m.color.setHex(0xa29674);consoleMaterial(m);}for(const group of groups)batchStaticWeaponMeshes(group);
 // Preserve the original skinned hands while giving the two magazine-fed
 // rifles a physical withdraw/insert/charge action in this runtime.
 const reloads=groups.map((group,i)=>i===4||i===5?createRifleReload(group,models[i],i):null);
 const framePose={x:0,y:0,z:0,scale:1},firePose={},drawPose={};
 let reviewReload=null,previous='',shotAge=9,equipAge=9,lastShot=0,sawRev=0,sawLoad=0,impactHold=0,wasVisible=false,salvageHit='',salvageImpactFrame=false;
 return {rig,groups,models,impact(kind='body'){const w=WEAPONS.find(w=>w.id===previous);if(SALVAGE_RESPONSE[previous]){salvageHit=kind;salvageImpactFrame=true;}else{impactHold=.045;if(w?.kind==='melee')shotAge=Math.max(w.contact,shotAge);}},get motion(){return{shotAge,equipAge,impactHold,impactKind:salvageHit,visible:rig.visible};},seatHands(){if(!rig.visible)return;const group=groups.find(g=>g.visible);if(!group)return;seatFPSArms(group);const reloadArm=group.userData.reloadArm;if(reloadArm?.visible)seatFPSArms(reloadArm);if(group.name==='arc')arcCraft.poseFinger();if(group.name==='reliquary')expeditionCraft.poseFinger();},shotgunReload,expeditionCraft,utilityReloads,reloads,setReviewReload(value){reviewReload=value;},ready:Promise.all(models.map(m=>m.userData.resourcesReady).filter(Boolean)),update({id,time,dt,moving,aim,recoil,reloading,charge,heat,firing,visible,reloadCount=2,shotSequence=0,sawContact=0,motion=true,stride=null,deferHands=false}){
   reloading=reviewReload??reloading;rig.visible=visible&&id!=='carbine';if(!rig.visible){wasVisible=false;shotAge=9;impactHold=0;salvageHit='';salvageImpactFrame=false;sawRev=sawLoad=0;lastShot=shotSequence;return;}if(!wasVisible){equipAge=0;wasVisible=true;}const index=groups.findIndex(g=>g.name===id);if(index<0)return;
   if(id!==previous){previous=id;equipAge=0;shotAge=9;impactHold=0;salvageHit='';salvageImpactFrame=false;sawRev=sawLoad=0;lastShot=shotSequence;}equipAge+=dt;if(shotSequence!==lastShot){shotAge=0;salvageHit='';salvageImpactFrame=false;}else shotAge+=Math.max(0,dt-impactHold);impactHold=Math.max(0,impactHold-dt);lastShot=shotSequence;sawRev=T.MathUtils.damp(sawRev,firing?1:0,9,dt);
   groups.forEach((g,i)=>g.visible=i===index);const group=groups[index],model=models[index],hold=holds[index],profile=WEAPONS.find(w=>w.id===id),melee=profile.kind==='melee',salvage=index>=8,framed=salvage||index===7,tilt=reloading>=0?reloadWeight(reloading):0;const response=FIRE_RESPONSE[id];weaponResponse(id,shotAge,aim,motion,firePose);const visualShot=response?firePose.pulse:recoil,batEnd=profile.interval-.045,batAge=id==='bat'?salvageMotionAge(id,shotAge,profile.contact,batEnd,salvageHit,salvageImpactFrame):shotAge;sawLoad=T.MathUtils.damp(sawLoad,index===7&&firing&&sawContact>0?1:0,18,dt);
   if(framed)salvageFraming(id,camera.aspect,framePose);group.scale.setScalar(framed?framePose.scale:hold.scale);
   weaponDraw(id,equipAge,motion,drawPose);
   const gesture=index===1?breachGesture(9,1,aim,motion):null,kick=response?firePose.z:gesture?gesture.kick*.10:(salvage||id==='bat'||index===7)?0:T.MathUtils.smoothstep(recoil,0,1)*([.05,.10,.04,.12,.045,.075,.02,.015][index]??.02);
   if(framed)group.position.set(framePose.x,framePose.y,framePose.z);else{group.position.fromArray(hold.position);group.position.x*=Math.min(1,camera.aspect/.9);}group.position.x=T.MathUtils.lerp(group.position.x,.025,aim*.92);group.position.y+=(motion?(stride?Math.sin(stride.phase)*.008*stride.weight:Math.sin(time*(moving?10:1.8))*(moving?.008:.0015)):0)+tilt*(index===6?-.16:.07)+drawPose.y;group.position.z+=kick+drawPose.z;group.position.x+=drawPose.x+(motion?(stride?Math.sin(stride.phase*.5)*.004*stride.weight:Math.sin(time*(moving?5:1.2))*(moving?.004:.001))*(1-aim):0);
   group.rotation.fromArray(hold.rotation);group.rotation.y*=1-aim;group.rotation.x+=(response?firePose.pitch:(id==='bat'||index===7)?0:T.MathUtils.smoothstep(recoil,0,1)*.045)-tilt*.25;group.rotation.z+=firePose.roll;group.rotation.z-=tilt*.22;if(index===1){group.rotation.y+=tilt*.48;group.rotation.z+=tilt*.28;group.position.y-=tilt*.04;}
   if(gesture){group.position.x+=gesture.draw*.055;group.position.z+=gesture.draw*.16;group.position.y+=gesture.kick*.012;group.rotation.x+=gesture.draw*.13;group.rotation.z+=gesture.roll;}
   group.rotation.x+=drawPose.pitch;group.rotation.z+=drawPose.roll;
   if(index===7){group.position.z-=sawLoad*.024;group.rotation.x-=sawLoad*.025;}applySightPose(group,id,group.scale.x,aim,response?firePose.sight:recoil);
   if(index===0)animateOssuary(model,visualShot,time,dt);if(index===1)animateBreach(model,time,visualShot,dt);if(index===2){animateArc(model,time,visualShot,dt);arcCraft.update(charge,visualShot,dt);}if(index===3)animateReliquary(model,visualShot,time,dt);if(index===4||index===5)animateRifle(model,visualShot,time,dt,{heat,charge,shotSequence});
   if(index===3){group.rotation.y+=tilt*.5;group.rotation.z+=tilt*.18;expeditionCraft.update(reloading);}
   if(index===1)shotgunReload.update(reloading,reloadCount);if(index===0||index===2){group.rotation.y+=tilt*.30;group.rotation.z+=tilt*.15;}
   if(salvage){animateSalvageMelee(model,{id,age:shotAge,contact:profile.contact,duration:profile.interval,active:shotAge<profile.interval,group,aspect:camera.aspect,hit:salvageHit,impactFrame:salvageImpactFrame});salvageImpactFrame=false;}
   else if(index>=6)animateMeleeWeapon(model,{active:melee&&shotAge<profile.interval,progress:melee?Math.min(1,batAge<=profile.contact?batAge/profile.contact*.4:.4+(batAge-profile.contact)/(batEnd-profile.contact)*.6):0,...(melee?batContactPose(group.position.x,group.position.y,group.scale.x):{}),flowingReturn:index===6,sawRev,contact:sawContact>0?.5:0,sawActive:firing,reducedMotion:!motion},time,dt);
   if(index===6)salvageImpactFrame=false;
   utilityReloads[index]?.update(reloading);
   reloads[index]?.update(reloading);
   const phase=equipAge<.28?'draw':salvage&&shotAge<profile.interval?'idle':melee&&shotAge<profile.interval||index===7&&firing?'strike':index<6&&shotAge<.4?'fire':moving?'walk':'idle';
   // One authored gait cycle per footstep pair, shared with distance-driven
   // camera bob. Stopping against a wall settles rather than marching in place.
   const gaitTime=stride?stride.phase/(Math.PI*4)*group.userData.authoredFPS.actions.get('walk').duration:time;
   // A held saw trigger maintains its authored clutch grip. Repeated fuel
   // ticks must not restart a nonexistent firearm clip on the chainsaw rig.
   advanceFPSClip(group,phase,equipAge<.28?equipAge:salvage&&shotAge<profile.interval?0:index===7&&firing?sawRev*.24:melee&&shotAge<profile.interval?(batAge<=profile.contact?batAge/profile.contact*.25:.25+(batAge-profile.contact)/(batEnd-profile.contact)*.47):index<6&&shotAge<.4?shotAge:phase==='walk'?gaitTime:time,dt,deferHands);
   if(index===2&&!deferHands)arcCraft.poseFinger();
   if(index===3&&!deferHands)expeditionCraft.poseFinger();
 }};
}
