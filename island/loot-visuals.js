import * as T from '../vendor/three.module.js';
import {captureWeaponVisual} from '../chest-finisher-visuals.js';
import {WEAPONS} from './armory-state.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {batchFieldWeapon} from './field-weapon-batches.js';
import {sleepHiddenBranch} from './render-lifecycle.js';

export function createLootVisuals(scene,containers){
 const box=new T.BoxGeometry(1,1,1),mats=[0x8c7656,0x4c6251,0xc8bd91,0x446159,0x9b6250].map(color=>new T.MeshLambertMaterial({color,flatShading:true})),entries=[];
 box.userData.sharedAsset=true;
 const piece=(parent,x,y,z,w,h,d,material=0)=>{const m=new T.Mesh(box,mats[material]);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 for(const c of containers){const group=new T.Group();group.position.set(c.x,c.y,c.z);scene.add(group);group.name=c.name;const bag=c.kind==='bag',width=bag?.72:1.05,depth=bag?.44:.65,mat=bag?1:c.kind==='chest'?3:0;
  piece(group,0,.24,0,width,.42,depth,mat);piece(group,0,.45,0,width-.09,.015,depth-.08,1);
  const lid=new T.Group();lid.position.set(0,.45,-depth/2);group.add(lid);piece(lid,0,.025,depth/2,width,.05,depth,mat);
  for(const x of [-width*.32,width*.32]){piece(group,x,.23,depth/2+.006,.06,.4,.02,2);piece(lid,x,.054,depth/2,.06,.012,depth,2);}
  piece(group,0,.34,depth/2+.014,.12,.1,.025,2);if(c.name.includes('Medical')||c.name.includes('Ward')){piece(lid,0,.059,depth/2,.27,.015,.07,4);piece(lid,0,.06,depth/2,.07,.015,.27,4);}
  const contents=new T.Group();group.add(contents);for(let i=0;i<3;i++)piece(contents,(i-1)*.18,.46,.02,.14,.07,.24,i===1?4:2);
  batchStaticWeaponMeshes(group);sleepHiddenBranch(group);entries.push({c,group,lid,contents});
 }
 return {entries,colliders:containers.map(c=>({id:c.id,x:c.x,z:c.z,w:c.kind==='bag'?.72:1.05,d:c.kind==='bag'?.44:.65,y:c.y,h:.48})),update(dt,state,camera){for(const e of entries){e.group.visible=camera.distanceToSquared(e.group.position)<110**2;if(!e.group.visible)continue;const open=state.backpack.searched.includes(e.c.id);e.lid.rotation.x=T.MathUtils.damp(e.lid.rotation.x,open?-1.2:0,9,dt);e.contents.visible=open&&Object.values(state.backpack.remaining[e.c.id]||{}).some(n=>n>0);}}};
}
export function dressWeaponFinds(cacheVisuals,armory){
 for(const c of cacheVisuals){const index=WEAPONS.findIndex(w=>w.id===c.weapon)-1,model=armory.models[index];if(!model)continue;
  c.mesh.name=c.weapon+' field cache';
  const {mesh}=captureWeaponVisual(model);mesh.updateMatrixWorld(true);const box=new T.Box3().setFromObject(mesh),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());c.batch=batchFieldWeapon(mesh);const scale=1.1/Math.max(size.x,size.y,size.z);mesh.position.copy(center).multiplyScalar(-scale);mesh.scale.setScalar(scale);const stand=new T.Group();stand.add(mesh);stand.position.y=.29;stand.rotation.set(.1,Math.PI/2,.03);c.mesh.add(stand);c.display=stand;sleepHiddenBranch(c.mesh);
 }
}
