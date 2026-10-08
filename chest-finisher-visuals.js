import * as THREE from './vendor/three.module.js';
import {loadGlb} from './assets/load-glb.js';
import {bodySpearState} from './body-spear-visuals.js';

const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a),0,1);return x*x*(3-2*x);};
export const CHEST_ANATOMY_URL='./assets/models/chest-anatomy-v2.glb';

export function combatWorldTime(run) {
  return Number(run.world?.time??(run.playerId==='peer'&&Number.isFinite(run.peer?.time)?run.peer.time:run.time))||0;
}

// Authored corrective shapes follow the canonical event clock. Compression
// carries through the grasp; severed vessels settle after release. This is
// bounded visual compliance, while the existing rigid body owns translation.
export function chestTissueState(elapsed,timing={},reducedMotion=false) {
  const contact=timing.contactAt??.24,extract=timing.extractionAt??.68,release=timing.releaseAt??.95;
  const age=Math.max(0,elapsed-(extract-.18)),withdraw=smooth(extract-.18,extract+.035,elapsed);
  const lag=Math.exp(-age*4.8)*withdraw*(reducedMotion?.3:1)*Math.sin(age*17);
  return {
    GripCompress:.78*smooth(extract-.18,extract-.025,elapsed)*(1-smooth(release-.025,release+.10,elapsed)),
    VesselLagLeft:Math.max(0,-lag),
    VesselLagRight:Math.max(0,lag),
    TissueTension:.85*smooth(contact-.07,contact+.04,elapsed)*(1-smooth(extract+.03,release+.18,elapsed)),
  };
}

function applyTissueShapes(mesh,values) {
  if(!mesh?.morphTargetDictionary||!mesh.morphTargetInfluences)return;
  for(const [name,index] of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[index]=clamp(values[name]||0,0,1);
}

export function captureWeaponVisual(source) {
  const materials=new Map();
  const materialCopy=m=>{if(!materials.has(m)){const n=m.clone();n.envMapIntensity=.15;n.emissiveIntensity=0;n.depthTest=true;n.depthWrite=true;materials.set(m,n);}return materials.get(m);};
  const visit=node=>{
    if(node.isLight||node.isSkinnedMesh||node.userData.viewmodelArm||/MuzzleFlash|ViewArm|Sleeve/i.test(node.name))return null;
    let copy;
    if(node.isMesh){
      const material=Array.isArray(node.material)?node.material.map(materialCopy):materialCopy(node.material);
      if(node.isInstancedMesh){copy=new THREE.InstancedMesh(node.geometry,material,node.count);copy.instanceMatrix.copy(node.instanceMatrix);if(node.instanceColor)copy.instanceColor=node.instanceColor.clone();}
      else copy=new THREE.Mesh(node.geometry,material);
      copy.castShadow=false;copy.receiveShadow=true;copy.frustumCulled=false;
    }else copy=new THREE.Group();
    // Runtime socket metadata contains real Object3D references and cycles.
    // Copy the visual hierarchy explicitly instead of serializing userData.
    copy.name=node.name;copy.position.copy(node.position);copy.quaternion.copy(node.quaternion);copy.scale.copy(node.scale);copy.visible=node.visible;
    for(const child of node.children){const clone=visit(child);if(clone)copy.add(clone);}
    return copy;
  };
  return{mesh:visit(source),materials:[...materials.values()]};
}

// Semantic phases keep the wrist, extracted organ and weapon handoff on one
// clock. All points are in metres, with +Z out from the victim's chest.
export function chestHandPoint(side,elapsed,timing={}) {
  const contact=timing.contactAt??.24,extract=timing.extractionAt??.68,release=timing.releaseAt??.95;
  const motion=bodySpearState(elapsed);
  if(side==='Left')return new THREE.Vector3(-.15,.20,.095);
  const drive=motion.drive,withdraw=smooth(extract-.24,extract+.05,elapsed),depth=timing.spearDepth??.12;
  // The close grapple needs a bounded withdrawal so the held hand and organ
  // stay in front of the lens rather than crossing its near plane.
  const fitted=Number.isFinite(timing.spearDepth),z=THREE.MathUtils.lerp(THREE.MathUtils.lerp(.35,-depth-.055,drive),.19,withdraw);
  return new THREE.Vector3((fitted?0:.045)+.14*motion.coil+.09*withdraw,(fitted?0:-.028)-.065*motion.coil+.045*withdraw,z);
}

export class ChestFinisherVisuals {
  constructor(combat) {
    this.combat=combat;this.renderer=combat.renderer;this.status='loading';this.heartCount=0;this.weapon=null;
    this.ready=loadGlb(CHEST_ANATOMY_URL).then(gltf=>{
      if(this.disposed){combat.releaseAsset(gltf.scene);return;}
      this.asset=gltf.scene;this.status='ready';
      this.asset.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.userData.sharedAsset=true;
        for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
          m.emissive?.setHex(0);m.emissiveIntensity=0;m.envMapIntensity=.48;
          // Calibrate the de-lit v2 atlas in the game's lower exposure while
          // retaining its red albedo and scene-owned, restrained wet reflection.
          m.color.multiplyScalar(2.25);m.roughness*=.88;
          m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
            vec3 tissueLimit=max(diffuseColor.rgb*.86,vec3(.004));reflectedLight.directDiffuse/=vec3(1.)+reflectedLight.directDiffuse/tissueLimit;reflectedLight.directSpecular/=vec3(1.)+reflectedLight.directSpecular/vec3(.025);
          `);};m.customProgramCacheKey=()=> 'chest-anatomy-light-response-v2';
        }
      });
    }).catch(error=>{this.status='unavailable';this.error=String(error.message||error);});
  }
  component(name) {
    const source=this.asset?.getObjectByName(name);if(!source)return null;
    const mesh=source.clone(true);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.setScalar(1);mesh.frustumCulled=false;return mesh;
  }
  addWound(state) {
    if(this.status!=='ready')return;
    const wound=this.combat.bodySpear?.addWound(state)||this.component('ChestWound');if(wound&&!wound.parent)state.attachments.add(wound);state.chestWound=wound;
    state.heart=this.component('Heart');state.heartReleased=false;
    if(state.heart){state.heart.visible=false;this.combat.root.add(state.heart);}
  }
  releaseWound(state) {
    if(state.heartDrop)this.combat.physics?.removeDrop(state.heartDrop);
    state.heart?.removeFromParent();state.heart=null;state.heartDrop=null;state.chestWound=null;
  }
  wrist(run,prefix='Right') {
    const bones=run===this.combat.run?this.combat.armBones:this.renderer._survivors?.peer?.userData.bones;
    return bones?.[prefix+'Hand'];
  }
  updateWound(state,run,gore) {
    const heart=state.heart;if(!heart)return;
    const {wound}=state,owner=[run,run.peer].find(p=>p?.brutal?.enemyId===state.root.userData.brutalEnemyId&&p.brutal.kind==='pierce'&&p.brutal.phase!=='idle');
    const elapsed=owner?.brutal.elapsed??Math.max(0,combatWorldTime(run)-wound.at+.24),extract=owner?.brutal.extractionAt??.68,release=owner?.brutal.releaseAt??.95;
    const tissue=chestTissueState(elapsed,owner?.brutal,this.renderer?.settings?.reducedMotion);
    applyTissueShapes(heart,tissue);applyTissueShapes(state.chestWound,tissue);
    applyTissueShapes(state.bodySpear?.exit,tissue);
    const extracted=!!wound.heartRemoved||!!owner?.brutal.extractionApplied;
    heart.visible=gore&&extracted&&(elapsed>=extract||state.heartReleased);
    if(!state.heartReleased){
      state.attachments.updateMatrixWorld(true);heart.position.set(-.02,-.025,-.055).applyMatrix4(state.attachments.matrixWorld);
      heart.quaternion.copy(state.attachments.quaternion);heart.scale.setScalar(state.root.userData.afterlife?.normalization||1);
      const hand=owner&&this.wrist(owner);
      if(hand&&extracted&&elapsed>=extract){
        hand.getWorldPosition(heart.position);hand.getWorldQuaternion(heart.quaternion);
        heart.position.add(new THREE.Vector3(.01,.085,.035).applyQuaternion(heart.quaternion));
      }
      if(extracted&&elapsed>=release){
        state.heartReleased=true;
        if(this.combat.physics)state.heartDrop=this.combat.physics.addDrop(heart,{radius:.058,mass:.32,velocity:new THREE.Vector3(owner?Math.cos(owner.angle)*.5:0,.1,owner?Math.sin(owner.angle)*.5:0),angularVelocity:new THREE.Vector3(2,-1.5,1),lifetime:16});
      }
    }
    if(state.heartReleased&&!state.heartDrop)heart.visible=false;
  }
  // Release an actual copy of the equipped firearm, excluding view arms and
  // depth-range hooks. Its source stays in the camera rig and is never mutated.
  dropWeapon(run) {
    const b=run.brutal;if(b?.kind!=='pierce'||b.phase==='idle'||run!==this.combat.run)return;
    if(this.weapon?.sequence===b.sequence)return;
    this.clearWeapon();if(run.weapon>=6)return;
    const source=this.renderer.weaponGroups[run.weapon];if(!source||!this.combat.physics)return;
    source.updateWorldMatrix(true,true);
    const sourceHand=source.userData.viewArms?.rightArm?.userData.hand;
    const wristLocal=sourceHand?source.worldToLocal(sourceHand.getWorldPosition(new THREE.Vector3())):new THREE.Vector3();
    const wristRotation=sourceHand?source.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(sourceHand.getWorldQuaternion(new THREE.Quaternion())):new THREE.Quaternion();
    const {mesh,materials}=captureWeaponVisual(source);
    mesh.name='FinisherReleasedFirearm';source.getWorldPosition(mesh.position);source.getWorldQuaternion(mesh.quaternion);source.getWorldScale(mesh.scale);mesh.visible=true;
    mesh.position.add(new THREE.Vector3(.16,0,0).applyQuaternion(this.renderer.camera.getWorldQuaternion(new THREE.Quaternion())));
    this.combat.root.add(mesh);
    const velocity=new THREE.Vector3(.55,.1,-.20).applyQuaternion(this.renderer.camera.getWorldQuaternion(new THREE.Quaternion()));
    const handle=this.combat.physics.addDrop(mesh,{radius:.13,mass:1.6,velocity,angularVelocity:new THREE.Vector3(1.4,-.8,1.2),lifetime:2});
    this.weapon={mesh,handle,materials,wristLocal,wristRotation,sequence:b.sequence,retrieved:false,gap:null};
  }
  retrievePoint(run) {
    if(!this.weapon||run.brutal?.kind!=='pierce'||run.brutal.elapsed<1.08||run.brutal.elapsed>1.40)return null;
    return this.weapon.mesh.localToWorld(this.weapon.wristLocal.clone());
  }
  updateWeapon(run) {
    const b=run.brutal;
    if(!this.weapon)return;
    if(!b||b.kind!=='pierce'||b.phase==='idle'||run.health<=0){this.clearWeapon();return;}
    if(b.elapsed>=1.30){
      const hand=this.wrist(run);if(hand){
        const wrist=hand.getWorldPosition(new THREE.Vector3()),target=this.weapon.mesh.localToWorld(this.weapon.wristLocal.clone());
        if(!this.weapon.retrieved){
          this.weapon.gap=wrist.distanceTo(target);
          if(this.weapon.gap>.02)return;
          this.combat.physics.removeDrop(this.weapon.handle);this.weapon.retrieved=true;
        }
        hand.getWorldQuaternion(this.weapon.mesh.quaternion);this.weapon.mesh.quaternion.multiply(this.weapon.wristRotation.clone().invert());
        this.weapon.mesh.position.copy(wrist).sub(this.weapon.wristLocal.clone().multiply(this.weapon.mesh.scale).applyQuaternion(this.weapon.mesh.quaternion));
      }
      this.weapon.mesh.visible=b.elapsed<1.46;
    }
  }
  clearWeapon() {if(!this.weapon)return;this.combat.physics?.removeDrop(this.weapon.handle);this.weapon.mesh.removeFromParent();this.weapon.mesh.traverse(node=>{if(node.isInstancedMesh)node.dispose();});this.weapon.materials.forEach(m=>m.dispose());this.weapon=null;}
  reset() {this.clearWeapon();}
  diagnostics(){return{status:this.status,error:this.error||null,assetVersion:'v2',deformation:'bounded-shape-keys',hearts:[...(this.combat.actors?.values()||[])].filter(s=>s.heart?.visible).length,weaponReleased:!!this.weapon,weaponRetrieved:!!this.weapon?.retrieved,weaponGripGap:this.weapon?.gap??null};}
  dispose(){this.disposed=true;this.clearWeapon();this.combat.releaseAsset(this.asset);}
}
