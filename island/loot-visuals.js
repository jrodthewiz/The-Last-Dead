import * as T from '../vendor/three.module.js';
import {captureWeaponVisual} from '../chest-finisher-visuals.js';
import {WEAPONS} from './armory-state.js';
import {batchStaticWeaponMeshes} from '../weapon-batching.js';
import {batchFieldWeapon} from './field-weapon-batches.js';
import {sleepHiddenBranch} from './render-lifecycle.js';
import {searchLidAngle} from './search-motion.js';

// The closed silhouette teaches the kind of find; the opened contents follow
// the same saved inventory as the pack. All pieces are built once and batched
// inside their semantic pivots, never allocated during the frame loop.
export const lootFamily=id=>id==='beer'?'beer':id==='cloth'?'linen':id==='bandage'||id==='antiseptic'?'medical':id.startsWith('ammo-')?'ammo':'tools';
export function createLootVisuals(scene,containers){
 const box=new T.BoxGeometry(1,1,1),bottle=new T.CylinderGeometry(.8,1,1,6),entries=[],unitTransform=new T.Object3D();
 const vertices=[],footprint=[[-.75,-1],[.75,-1],[1,-.7],[1,.7],[.75,1],[-.75,1],[-1,.7],[-1,-.7]],rings=[[.30,.18,.03],[.36,.22,.23],[.32,.20,.43],[.285,.165,.41],[.26,.14,.08]];
 const ringPoint=(r,i)=>[footprint[i][0]*r[0],r[2],footprint[i][1]*r[1]];
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<8;i++){const j=(i+1)%8,a=ringPoint(rings[r],i),b=ringPoint(rings[r],j),c=ringPoint(rings[r+1],i),d=ringPoint(rings[r+1],j);vertices.push(...a,...c,...b,...b,...c,...d);}
 for(let i=0;i<8;i++)vertices.push(0,.08,0,...ringPoint(rings.at(-1),(i+1)%8),...ringPoint(rings.at(-1),i));
 const clothBody=new T.BufferGeometry();clothBody.setAttribute('position',new T.Float32BufferAttribute(vertices,3));clothBody.computeVertexNormals();
 const flapVertices=[],flapRings=[[.30,.02,0],[.32,.055,.17],[.28,.02,.36],[.22,-.065,.45]],corners=[[-1,-1],[1,-1],[1,1],[-1,1]],flapPoint=(r,i)=>[corners[i][0]*flapRings[r][0],flapRings[r][1]+corners[i][1]*.014,flapRings[r][2]];
 for(let r=0;r<3;r++)for(let i=0;i<4;i++){const j=(i+1)%4,a=flapPoint(r,i),b=flapPoint(r,j),c=flapPoint(r+1,i),d=flapPoint(r+1,j);flapVertices.push(...a,...b,...c,...b,...d,...c);}
 for(const r of [0,3]){const a=flapPoint(r,0),b=flapPoint(r,1),c=flapPoint(r,2),d=flapPoint(r,3);if(r===0)flapVertices.push(...a,...c,...b,...a,...d,...c);else flapVertices.push(...a,...b,...c,...a,...c,...d);}
 const clothFlap=new T.BufferGeometry();clothFlap.setAttribute('position',new T.Float32BufferAttribute(flapVertices,3));clothFlap.computeVertexNormals();
 for(const g of [box,bottle,clothBody,clothFlap])g.userData.sharedAsset=true;
 const mats=[0x8c7656,0x5d7660,0xc8bd91,0x446159,0x9b6250,0x243e31,0x795b3d,0x91aaa0].map(color=>new T.MeshLambertMaterial({color,flatShading:true}));
 const piece=(parent,x,y,z,w,h,d,material=0,geometry=box)=>{const m=new T.Mesh(geometry,mats[material]);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 for(const c of containers){
  const group=new T.Group();group.position.set(c.x,c.y,c.z);group.rotation.y=c.yaw||0;scene.add(group);group.name=c.name;
  const bag=c.kind==='bag',crate=c.kind==='crate',trunk=c.kind==='trunk',width=bag?.72:1.05,depth=bag?.44:.65,mat=bag?1:trunk?0:crate?0:3;
  if(bag){
   piece(group,0,0,0,1,1,1,mat,clothBody);
   for(const x of [-.21,.21]){piece(group,x,.24,.225,.045,.26,.018,2);piece(group,x,.14,.239,.075,.065,.018,6);piece(group,x,.14,.25,.035,.028,.012,2);}
   // Folded side gussets, with a shoulder strap attached to the bag rather
   // than a rigid chest handle. The top flap folds around the rear seam.
   for(const x of [-.33,.33])piece(group,x,.24,0,.025,.21,.28,3);
   piece(group,0,.38,-.235,.48,.045,.035,2);
  }else{
   piece(group,0,.045,0,width,.07,depth,mat);
   for(const z of [-depth/2,depth/2])for(let j=0;j<(crate?3:1);j++)piece(group,0,crate?.13+j*.13:.25,z,width,crate?.105:.4,.055,mat);
   for(const x of [-width/2,width/2])piece(group,x,.25,0,.055,.4,depth,mat);
   for(const x of [-width*.43,width*.43])for(const z of [-depth*.43,depth*.43])piece(group,x,.24,z,.075,.43,.075,crate?6:2);
   if(crate)for(const x of [-width/2-.006,width/2+.006])piece(group,x,.34,0,.012,.065,.23,5);
  }
  const lid=new T.Group();lid.name=bag?'Folded satchel flap':crate?'Slatted crate cover':'Reinforced hinged lid';lid.position.set(0,.45,-depth/2);group.add(lid);
  if(crate){for(let j=0;j<4;j++)piece(lid,0,.025,(j+.5)*depth/4,width,.045,depth/4-.018,0);for(const x of [-width*.32,width*.32])piece(lid,x,.058,depth/2,.06,.025,depth,6);}
  else{
   if(bag){piece(lid,0,0,0,1,1,1,mat,clothFlap);for(const x of [-.21,.21])piece(lid,x,.065,.21,.04,.012,.28,2);for(const x of [-.11,.11])piece(lid,x,.10,depth/2,.035,.13,.05,2);piece(lid,0,.17,depth/2,.25,.035,.05,2);}
   else{piece(lid,0,.02,depth/2,width,.045,depth,mat);for(const x of [-width*.32,width*.32])piece(lid,x,.048,depth/2,.05,.014,depth,2);piece(group,0,.34,depth/2+.035,.13,.11,.035,2);piece(group,0,.22,depth/2+.05,.28,.045,.035,5);for(const x of [-.13,.13])piece(group,x,.26,depth/2+.05,.04,.10,.035,2);}
  }
  if(/medical|ward/i.test(c.name)){piece(lid,0,bag?.076:.05,depth/2,.25,.012,.065,4);piece(lid,0,bag?.077:.051,depth/2,.065,.012,.25,4);}
  const contents=new T.Group(),families=new Map();contents.name='Remaining supplies';group.add(contents);
  const types=['beer','linen','medical','ammo','tools'];
  for(const [i,family]of types.entries()){
   const f=new T.Group();f.name='Remaining '+family;const spacing=width/(types.length+1);f.position.x=-width/2+spacing*(i+1);contents.add(f);families.set(family,f);
   if(family==='beer'){piece(f,0,.235,0,.075,.27,.075,6,bottle);piece(f,0,.395,0,.038,.075,.038,6,bottle);piece(f,0,.435,0,.045,.025,.045,2,bottle);piece(f,0,.245,.065,.10,.105,.012,2);}
   else if(family==='medical'){piece(f,0,.22,0,.19,.23,.24,7);piece(f,0,.342,0,.14,.018,.17,2);piece(f,0,.358,0,.10,.012,.032,4);piece(f,0,.359,0,.032,.012,.10,4);}
   else if(family==='linen'){
    const folds=new T.InstancedMesh(box,mats[2],3),edges=new T.InstancedMesh(box,mats[1],3);folds.name='Remaining cloth folds';edges.name='Remaining cloth seams';f.add(folds,edges);f.userData.stack=[folds,edges];
    for(let j=0;j<3;j++){unitTransform.position.set(0,.13+j*.065,0);unitTransform.scale.set(.23-j*.012,.055,.28);unitTransform.updateMatrix();folds.setMatrixAt(j,unitTransform.matrix);unitTransform.position.set(0,.16+j*.065,.144);unitTransform.scale.set(.20,.012,.012);unitTransform.updateMatrix();edges.setMatrixAt(j,unitTransform.matrix);}
    for(const mesh of f.userData.stack){mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();}
   }
   else if(family==='ammo'){piece(f,0,.20,0,.21,.23,.25,1);piece(f,0,.32,0,.055,.02,.26,2);piece(f,0,.20,.13,.055,.23,.012,2);}
   else{piece(f,0,.17,0,.23,.17,.27,0);const bar=piece(f,0,.285,0,.26,.04,.05,7);bar.rotation.y=.4;piece(f,.075,.29,0,.06,.055,.13,3);}
  }
  batchStaticWeaponMeshes(group);sleepHiddenBranch(group);entries.push({c,group,lid,contents,families,width});
 }
 return {entries,colliders:containers.map(c=>({id:c.id,x:c.x,z:c.z,w:c.kind==='bag'?.72:1.105,d:c.kind==='bag'?.44:.705,y:c.y,h:.48})),update(dt,state,camera,search=null){
  for(const e of entries){e.group.visible=camera.distanceToSquared(e.group.position)<110**2;if(!e.group.visible)continue;
   const open=state.backpack.searched.includes(e.c.id),searching=search?.container.id===e.c.id;
   e.lid.rotation.x=searching?searchLidAngle(search.time):T.MathUtils.damp(e.lid.rotation.x,open?-1.35:0,12,dt);
   const remaining=open?(state.backpack.remaining[e.c.id]||{}):e.c.loot,signature=Object.entries(remaining).filter(([,n])=>n>0).map(([id,n])=>id+':'+n).sort().join('|');
   e.contents.visible=e.lid.rotation.x<-.70&&!!signature;
   if(signature!==e.signature){e.signature=signature;const present=new Set(Object.entries(remaining).filter(([,n])=>n>0).map(([id])=>lootFamily(id)));let slot=0;for(const [family,f]of e.families){f.visible=present.has(family);if(f.visible)f.position.set(-e.width/2+e.width/(present.size+1)*(++slot),0,0);if(family==='linen')for(const mesh of f.userData.stack)mesh.count=Math.min(3,remaining.cloth||0);}}
  }
 }};
}
export function dressWeaponFinds(cacheVisuals,armory){
 for(const c of cacheVisuals){const index=WEAPONS.findIndex(w=>w.id===c.weapon)-1,model=armory.models[index];if(!model)continue;
  c.mesh.name=c.weapon+' field cache';
  const {mesh}=captureWeaponVisual(model);mesh.updateMatrixWorld(true);const box=new T.Box3().setFromObject(mesh),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());c.batch=batchFieldWeapon(mesh);const scale=1.1/Math.max(size.x,size.y,size.z);mesh.position.copy(center).multiplyScalar(-scale);mesh.scale.setScalar(scale);const stand=new T.Group();stand.add(mesh);stand.position.y=.29;stand.rotation.set(.1,Math.PI/2,.03);c.mesh.add(stand);c.display=stand;sleepHiddenBranch(c.mesh);
 }
}
