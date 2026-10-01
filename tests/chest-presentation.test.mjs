import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {ChestFinisherVisuals,chestHandPoint,captureWeaponVisual} from '../chest-finisher-visuals.js';

test('chest thrust enters the cavity before extraction and withdraws on the same seconds timeline',()=>{
 const timing={contactAt:.24,extractionAt:.68,releaseAt:.95};
 assert(chestHandPoint('Right',0,timing).z>.3);
 assert(chestHandPoint('Right',.24,timing).z<-.07);
 assert(chestHandPoint('Right',.42,timing).z<-.07);
 const withdrawn=chestHandPoint('Right',.91,timing).z;
 assert(withdrawn>.12&&withdrawn<.25,'the hand clears the chest while staying in front of a close body camera');
 const brace=chestHandPoint('Left',0,timing);
 assert(brace.distanceTo(chestHandPoint('Left',.8,timing))<1e-10);assert(brace.x<0&&chestHandPoint('Right',.24,timing).x>0,'hands stay on their own side');
 for(const hz of [30,60,120])for(let i=0;i<hz*1.5;i++)assert(chestHandPoint('Right',i/hz,timing).toArray().every(Number.isFinite));
});

test('heart follows the actual world-space wrist then releases one physical body with its current transform',()=>{
 const scene=new THREE.Group(),root=new THREE.Group(),attachment=new THREE.Group(),hand=new THREE.Bone();scene.add(root,attachment,hand);
 root.userData.afterlife={normalization:1};root.userData.brutalEnemyId=42;hand.position.set(4,1.3,2);scene.updateMatrixWorld(true);
 const heart=new THREE.Group();scene.add(heart);
 const state={root,attachments:attachment,wound:{at:2,sequence:1,heartRemoved:true},heart,heartReleased:false};
 const run={time:2.5,angle:0,brutal:{kind:'pierce',phase:'extract',enemyId:42,elapsed:.72,extractionAt:.68,releaseAt:.95}};
 let bodies=0;const visual=Object.create(ChestFinisherVisuals.prototype);
 visual.combat={run,armBones:{RightHand:hand},physics:{addDrop(mesh){bodies++;assert(mesh.position.distanceTo(hand.position)<.1);return{mesh};}}};
 visual.updateWound(state,run,true);assert(heart.visible);assert.equal(bodies,0);assert(heart.position.distanceTo(hand.position)<.1);
 run.brutal.elapsed=.96;visual.updateWound(state,run,true);assert.equal(bodies,1);assert(state.heartReleased);
 visual.updateWound(state,run,true);assert.equal(bodies,1);
 visual.updateWound(state,run,false);assert.equal(heart.visible,false);assert.equal(bodies,1);
});

test('cancelled chest recovery never invents an extraction after the authoritative action ends',()=>{
 const root=new THREE.Group(),attachments=new THREE.Group(),heart=new THREE.Group();root.userData.afterlife={normalization:1};root.userData.brutalEnemyId=42;
 const state={root,attachments,wound:{at:2,sequence:1},heart,heartReleased:false},run={time:7,brutal:{phase:'idle'}};
 const visual=Object.create(ChestFinisherVisuals.prototype);visual.combat={run,physics:{addDrop(){throw new Error('cancelled extraction must not spawn an organ');}}};
 visual.updateWound(state,run,true);assert.equal(heart.visible,false);assert.equal(state.heartReleased,false);
});

test('weapon recovery releases only its owned material copies and physics handle',()=>{
 let removed=0,disposed=0;const mesh=new THREE.Group(),scene=new THREE.Group();scene.add(mesh);
 const visual=Object.create(ChestFinisherVisuals.prototype),material=new THREE.MeshStandardMaterial();material.addEventListener('dispose',()=>disposed++);
 visual.combat={physics:{removeDrop(){removed++;}}};visual.weapon={mesh,handle:{},materials:[material]};
 visual.clearWeapon();visual.clearWeapon();assert.equal(removed,1);assert.equal(disposed,1);assert.equal(mesh.parent,null);assert.equal(visual.weapon,null);
});

test('released gun captures render geometry despite cyclic socket metadata and excludes view arms/depth hooks',()=>{
 const source=new THREE.Group(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),body=new THREE.Mesh(geometry,material),arms=new THREE.Group();
 source.add(body,arms);source.userData.sockets={wrist:{object:source}};arms.userData.viewmodelArm=true;arms.add(new THREE.Mesh(geometry,material));
 body.onBeforeRender=()=>{throw new Error('viewmodel depth hook must stay in the camera rig');};body.position.x=.5;
 const {mesh,materials}=captureWeaponVisual(source);assert.equal(mesh.children.length,1);assert.equal(mesh.children[0].geometry,geometry);assert.equal(mesh.children[0].position.x,.5);
 assert.notEqual(mesh.children[0].material,material);assert.equal(materials.length,1);mesh.children[0].onBeforeRender();
 assert.equal(source.userData.sockets.wrist.object,source);assert.equal(source.children.length,2);
 materials.forEach(m=>m.dispose());geometry.dispose();material.dispose();
});
