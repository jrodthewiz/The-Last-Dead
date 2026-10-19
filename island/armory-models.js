import {createUtilityReload} from './utility-reloads.js';
import {finishExpeditionBreach,breachGesture} from './breach-presentation.js';
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
import {batContactPose} from './melee-presentation.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {installFPSArms,advanceFPSClip} from '../assets/survivor/fps-arms.js';
import {loadGlb} from '../assets/load-glb.js';
import {consoleMaterial} from './retro-materials.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';

export async function createArmoryModels(camera,source=loadGlb(new URL('../assets/survivor/fps-arms-v5.glb',import.meta.url).href)){
 const rig=new T.Group();rig.name='Blackwater expedition armory';camera.add(rig);
 const models=[createOssuary(),createBreach(),createArc(),createReliquary(),createRifle({variant:'carrion'}),createRifle({variant:'mourning'}),createMeleeWeapon({variant:'bat'}),createMeleeWeapon({variant:'chainsaw'})];
 // Remove the inherited overlay kit: it was authored for a different barrel
 // envelope and obscured the working breech at console resolution.
 models[1].getObjectByName('Img2ThreejsMicroDetail-breach')?.removeFromParent();models[1].userData.breach.pressureValve.visible=false;models[1].userData.breach.ribcage.visible=false;models[1].userData.breach.parts['underbarrel-launcher'].visible=false;models[1].userData.breach.materials.brass.color.setHex(0x9d9877);
 finishExpeditionBreach(models[1]);
 const arcCraft=craftArc(models[2]),expeditionCraft=craftExpeditionWeapons(models);
 const groups=models.map((model,i)=>{const group=new T.Group(),hold=FIRST_PERSON_HOLD_POSES[i];group.add(model);group.userData.model=model;group.name=hold.name;group.position.fromArray(hold.position);group.rotation.fromArray(hold.rotation);group.scale.setScalar(hold.scale);if(i>=6)model.rotation.set(i===6?.92:.32,i===6?-.32:.58,i===6?-.22:-.10);
   if(i<6){const parts=model.userData.sculptRuntime?.parts||model.userData.rifle?.parts;for(const side of ['right','left']){const part=parts?.[side==='right'?'grip':'support-grip'];if(part){part.scale.set(side==='right'?.30:.46,.65,side==='right'?.30:.46);const socket=new T.Object3D();socket.position.set(0,side==='right'?(i===1?-.05:-.07):-.12,0);part.add(socket);model.userData[side==='right'?'grip':'supportGrip']=socket;}}}
   group.visible=false;rig.add(group);return group;});
 const asset=await source;
 installFPSArms({weaponGroups:groups,weaponRig:rig,camera,_findWeaponSocket(model,name){let result=model.userData[name];if(!result)model.traverse(o=>{if(!result&&o.userData[name])result=o.userData[name];});return result;}},asset);
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
 const reloads=groups.map((group,i)=>{if(i!==4&&i!==5)return null;const model=models[i],parts=model.userData.rifle.parts,magazine=parts[i===4?'curved-magazine':'box-magazine'],left=group.userData.authoredFPS.arms.find(a=>a.side==='left'),socket=new T.Object3D();model.add(socket);socket.matrixAutoUpdate=false;return {magazine,position:magazine.position.clone(),rotation:magazine.quaternion.clone(),left,home:left.grip,socket,goal:new T.Matrix4(),local:new T.Matrix4(),point:new T.Vector3(),homePosition:new T.Vector3(),handRotation:new T.Quaternion(),handScale:new T.Vector3(),inverseOffset:left.offset.clone().invert(),boltPoint:new T.Vector3()};});
 let reviewReload=null,previous='',shotAge=9,equipAge=9,lastShot=0,sawRev=0,impactHold=0,wasVisible=false;
 return {rig,groups,models,impact(){impactHold=.045;if(previous==='bat')shotAge=Math.max(.25,shotAge);},get motion(){return{shotAge,equipAge,impactHold,visible:rig.visible};},shotgunReload,expeditionCraft,utilityReloads,setReviewReload(value){reviewReload=value;},ready:Promise.all(models.map(m=>m.userData.resourcesReady).filter(Boolean)),update({id,time,dt,moving,aim,recoil,reloading,charge,heat,firing,visible,reloadCount=2,shotSequence=0,sawContact=0,motion=true,stride=null}){
   reloading=reviewReload??reloading;rig.visible=visible&&id!=='carbine';if(!rig.visible){wasVisible=false;shotAge=9;impactHold=0;sawRev=0;lastShot=shotSequence;return;}if(!wasVisible){equipAge=0;wasVisible=true;}const index=groups.findIndex(g=>g.name===id);if(index<0)return;
   if(id!==previous){previous=id;equipAge=0;shotAge=9;impactHold=0;sawRev=0;lastShot=shotSequence;}equipAge+=dt;shotAge=shotSequence!==lastShot?0:shotAge+Math.max(0,dt-impactHold);impactHold=Math.max(0,impactHold-dt);lastShot=shotSequence;sawRev=T.MathUtils.damp(sawRev,firing?1:0,9,dt);
   groups.forEach((g,i)=>g.visible=i===index);const group=groups[index],model=models[index],hold=FIRST_PERSON_HOLD_POSES[index],tilt=reloading>=0?Math.sin(reloading*Math.PI):0;
   const gesture=index===1?breachGesture(shotAge,equipAge,aim,motion):null,settle=T.MathUtils.smoothstep(equipAge,0,.28),kick=gesture?gesture.kick*.10:T.MathUtils.smoothstep(recoil,0,1)*[.05,.10,.04,.12,.045,.075,.02,.015][index];
   group.position.fromArray(hold.position);group.position.x*=Math.min(1,camera.aspect/.9);group.position.x=T.MathUtils.lerp(group.position.x,.025,aim*.92);group.position.y+=(motion?(stride?Math.sin(stride.phase)*.008*stride.weight:Math.sin(time*(moving?10:1.8))*(moving?.008:.0015)):0)+tilt*(index===6?-.16:.07)-(1-settle)*.3;group.position.z+=kick;group.position.x+=(motion?(stride?Math.sin(stride.phase*.5)*.004*stride.weight:Math.sin(time*(moving?5:1.2))*(moving?.004:.001))*(1-aim):0);
   group.rotation.fromArray(hold.rotation);group.rotation.y*=1-aim;group.rotation.x+=T.MathUtils.smoothstep(recoil,0,1)*.045-tilt*.25;group.rotation.z-=tilt*.22;if(index===1){group.rotation.y+=tilt*.48;group.rotation.z+=tilt*.28;group.position.y-=tilt*.04;}
   if(gesture){group.position.x+=gesture.draw*.055;group.position.z+=gesture.draw*.16;group.position.y+=gesture.kick*.012;group.rotation.x+=gesture.draw*.13;group.rotation.z+=gesture.roll;}
   if(index===0)animateOssuary(model,recoil,time,dt);if(index===1)animateBreach(model,time,recoil,dt);if(index===2){animateArc(model,time,recoil,dt);arcCraft.update(charge,recoil,dt);}if(index===3)animateReliquary(model,recoil,time,dt);if(index===4||index===5)animateRifle(model,recoil,time,dt,{heat,charge});
   if(index===3){group.rotation.y+=tilt*.5;group.rotation.z+=tilt*.18;expeditionCraft.update(reloading);}
   if(index===1)shotgunReload.update(reloading,reloadCount);if(index===0||index===2){group.rotation.y+=tilt*.30;group.rotation.z+=tilt*.15;}
   if(index>=6)animateMeleeWeapon(model,{active:index===6&&shotAge<.72,progress:Math.min(1,shotAge<=.25?shotAge/.25*.4:.4+(shotAge-.25)/.47*.6),...(index===6?batContactPose(group.position.x,group.position.y,hold.scale):{}),sawRev,contact:sawContact>0?.5:0,sawActive:firing,reducedMotion:!motion},time,dt);
   utilityReloads[index]?.update(reloading);
   const r=reloads[index];if(r){const p=Math.max(0,reloading),smooth=(a,b)=>T.MathUtils.smoothstep(p,a,b),drop=(smooth(.22,.4)-smooth(.48,.67))*.34;r.magazine.position.copy(r.position);r.magazine.position.y-=drop;r.magazine.quaternion.copy(r.rotation);
     if(reloading>=0){group.updateWorldMatrix(true,true);r.home.updateWorldMatrix(true,false);r.goal.multiplyMatrices(r.home.matrixWorld,r.left.offset).decompose(r.homePosition,r.handRotation,r.handScale);r.point.set(-.16,-.20-drop,r.position.z+.12);r.boltPoint.set(0,.12,.19+(smooth(.76,.82)-smooth(.84,.9))*.12);r.point.lerp(r.boltPoint,smooth(.67,.77));model.localToWorld(r.point);r.point.lerp(r.homePosition,1-smooth(.06,.2)+smooth(.9,1));r.goal.compose(r.point,r.handRotation,r.handScale);r.local.copy(model.matrixWorld).invert().multiply(r.goal).multiply(r.inverseOffset);r.socket.matrix.copy(r.local);r.left.grip=r.socket;if(p>.7)model.userData.rifle.mechanisms.boltCarrier.position.z+=(smooth(.76,.82)-smooth(.84,.9))*.12;
     }else r.left.grip=r.home;}
   const phase=equipAge<.28?'draw':index===6&&shotAge<.72||index===7&&firing?'strike':index<6&&shotAge<.4?'fire':moving?'walk':'idle';
   // One authored gait cycle per footstep pair, shared with distance-driven
   // camera bob. Stopping against a wall settles rather than marching in place.
   const gaitTime=stride?stride.phase/(Math.PI*4)*group.userData.authoredFPS.actions.get('walk').duration:time;
   // A held saw trigger maintains its authored clutch grip. Repeated fuel
   // ticks must not restart a nonexistent firearm clip on the chainsaw rig.
   advanceFPSClip(group,phase,equipAge<.28?equipAge:index===7&&firing?sawRev*.24:index===6&&shotAge<.72?shotAge:index<6&&shotAge<.4?shotAge:phase==='walk'?gaitTime:time,dt);
   if(index===2)arcCraft.poseFinger();
   if(index===3)expeditionCraft.poseFinger();
 }};
}
