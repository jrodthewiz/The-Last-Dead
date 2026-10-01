import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {HarvestCutaways} from '../extraction-cutaway.js';
import {BrutalCombatVisuals} from '../brutal-combat-visuals.js';
import {CorpsePhysics} from '../corpse-physics.js';

function fixture(){
  const scene=new THREE.Scene(),body=new THREE.Group();body.userData.afterlifeModel=true;body.userData.afterlife={normalization:1.1};
  const bone=new THREE.Bone();bone.name='Hips';
  const geometry=new THREE.PlaneGeometry(.5,.8,4,4),count=geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material);mesh.add(bone);body.add(mesh);
  body.position.set(3,1.2,4);scene.add(body);mesh.bind(new THREE.Skeleton([bone]));
  for(const [name,y]of [['Socket_Chest',.15],['Socket_Abdomen',-.15]]){const socket=new THREE.Object3D();socket.name=name;socket.position.y=y;bone.add(socket);}
  scene.updateMatrixWorld(true);
  const physics=new CorpsePhysics(),combat=Object.create(BrutalCombatVisuals.prototype);
  Object.assign(combat,{root:new THREE.Group(),actors:new Map(),physics});scene.add(combat.root);
  const enemy={id:4,dead:true,x:.75,y:1,extractionSeed:25},run={time:1,mode:'play',course:{enemies:[enemy],w:3,h:3},extraction:{phase:'incise',seed:25}};
  physics.rebuild(run.course);physics.update(run);
  const renderer={scene,_enemyVisuals:new Map([[4,{root:body}]]),brutalCombatVisuals:combat},cutaways=new HarvestCutaways(renderer);
  const clean=()=>{cutaways.dispose();for(const root of [...combat.actors.keys()])combat.releaseActor(root);physics.dispose();geometry.dispose();material.dispose();mesh.skeleton.dispose();};
  return{body,geometry,material,mesh,physics,combat,enemy,run,cutaways,clean};
}

test('harvest aperture follows the real posed torso frame and preserves source mesh ownership',()=>{
  const f=fixture(),{cutaways,run,enemy,body,combat,mesh,material}=f;
  body.getObjectByName('Socket_Chest').rotation.set(.6,.15,.28);body.updateMatrixWorld(true);
  const state=cutaways.update(run,{phase:'incise',incise:.55,rip:0},enemy,{gore:true});
  assert(new THREE.Vector3(0,1,0).applyQuaternion(state.frame.quaternion).dot(new THREE.Vector3(0,1,0))>.99999,'anatomical headward axis ignores arbitrary exported socket roll');
  assert.equal(mesh.geometry.userData.corpseSourceGeometry,f.geometry.uuid);
  assert.equal(state.frame.scale.x,1.1);
  const expected=new THREE.Vector3(3,1.224,4);assert(state.anchorFrame.position.distanceTo(expected)<1e-6);
  assert(state.frame.position.distanceTo(expected)>.07,'organs are inset beneath the original skin');
  assert(state.surface.diagnostics().seamVertices>0);
  assert(state.surface.diagnostics().maxDisplacement>.01);
  assert.equal(state.anatomy.root.getObjectByName('LeftTornSkinFlap').visible,false);
  assert.equal(state.anatomy.root.getObjectByName('TornFleshWoundRim').visible,false);
  body.position.add(new THREE.Vector3(1,.2,-.5));body.rotation.z=.35;body.updateMatrixWorld(true);
  cutaways.update(run,null,null,{gore:true});
  const chest=body.getObjectByName('Socket_Chest').getWorldPosition(new THREE.Vector3()),abdomen=body.getObjectByName('Socket_Abdomen').getWorldPosition(new THREE.Vector3());
  assert(state.anchorFrame.position.distanceTo(chest.lerp(abdomen,.42))<1e-6);
  const shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.uHarvestOpen,combat.actors.get(body).uniforms.uHarvestOpen);
  assert(!shader.fragmentShader.includes('hp.y>1.-2.1*uHarvestOpen'),'source opening does not depend on an oval discard');
  cutaways.update(run,null,null,{gore:false});assert.equal(combat.actors.get(body).uniforms.uHarvestOpen.value,0);assert.equal(cutaways.root.visible,false);
  f.clean();assert.equal(mesh.geometry,f.geometry);
});

test('partial cuts persist, completed hearts use existing rigid physics, and restart removes tissue and apertures',()=>{
  const f=fixture(),{cutaways,run,enemy,physics,combat,body}=f;
  const state=cutaways.update(run,{phase:'incise',incise:.65,rip:0},enemy,{gore:true});
  const opening=state.opening;cutaways.update(run,null,null,{gore:true});assert.equal(state.opening,opening);assert.equal(state.frame.visible,true);
  cutaways.update(run,{phase:'rip',incise:1,rip:.8},enemy,{gore:true});assert(state.chain);assert.equal(physics.diagnostics().tissueChains,1);
  enemy.extracted=true;cutaways.update(run,{phase:'rip',incise:1,rip:1},enemy,{gore:true});assert.equal(state.released,true);assert(state.heartDrop);assert.equal(physics.drops.size,1);
  cutaways.update({...run,course:{enemies:[],w:3,h:3}},null,null,{gore:true});assert.equal(cutaways.states.size,0);assert.equal(physics.diagnostics().tissueChains,0);assert.equal(physics.drops.size,0);assert.equal(combat.actors.get(body).uniforms.uHarvestOpen.value,0);assert.equal(combat.harvestRoots.size,0);
  f.clean();
});
