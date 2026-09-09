import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three.module.js';
import {createSurvivor,animateSurvivor} from '../assets/survivor/player-survivor.js';
import {updateSurvivors} from '../assets/survivor/survivor-runtime.js';

test('first-person body is connected, visible, grounded and keeps stable geometry across poses',()=>{
 const renderer={scene:new THREE.Scene()},run={x:6,y:10.5,angle:-Math.PI/2,pitch:-1.3,mode:'pause',vx:0,vy:0,distance:0,slide:0,z:0};
 updateSurvivors(renderer,run,1000);const body=renderer._survivors.local,geometries=new Set(),materials=new Set();body.traverse(m=>{if(m.isMesh){geometries.add(m.geometry);materials.add(m.material);for(const v of m.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});
 assert.equal(body.getObjectByName('Torso').visible,true);assert.equal(body.getObjectByName('OpenCanvasJacket').visible,true);assert.equal(body.userData.head.visible,false);assert.ok(body.userData.arms.every(a=>!a.shoulder.visible));assert.equal(body.userData.sculptRuntime.parts.length,5);
 const camera=new THREE.PerspectiveCamera(92,1.6,.025,220),ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
 for(const pose of ['standing','walking','slide','jump']){
  Object.assign(run,{vx:pose==='walking'?1.5:0,distance:pose==='walking'?.22:0,slide:pose==='slide'?1:0,z:pose==='jump'?.5:0});updateSurvivors(renderer,run,1000);renderer.scene.updateMatrixWorld(true);
  camera.position.set(run.x*4,1.6+run.z*4-run.slide*.72,run.y*4);camera.rotation.set(-1.3,0,0);camera.updateMatrixWorld(true);
  const visible=[];body.traverseVisible(m=>{if(m.isMesh)visible.push(m);});const boots=[0,0];let total=0;
  for(let y=0;y<40;y++)for(let x=0;x<64;x++){mouse.set((x+.5)/32-1,1-(y+.5)/20);ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(visible,false)[0];if(!hit)continue;total++;for(let i=0;i<2;i++)for(let p=hit.object;p;p=p.parent)if(p===body.userData.legs[i].knee){boots[i]++;break;}}
  assert.ok(boots.every(n=>n>=3),pose+': both lower legs and boots must have visible footprints');assert.ok(total<2560*.4,pose+': body must not fill the view');assert.deepEqual(body.scale.toArray(),[1,1,1]);
  if(!run.z){const floors=body.userData.legs.map(l=>new THREE.Box3().setFromObject(l.knee,true).min.y);assert.ok(Math.min(...floors)>-.015&&Math.min(...floors)<.015,pose+': stance boot stays at floor');}
  body.traverse(m=>{if(m.isMesh){assert.ok(geometries.has(m.geometry));assert.ok(materials.has(m.material));}});
 }
 run.angle=.9;run.pitch=.7;updateSurvivors(renderer,run,1100);assert.equal(body.rotation.x,0);assert.equal(body.rotation.y,-run.angle-Math.PI/2);
});

test('full-body peer keeps its head, arms, dimensions and existing animation',()=>{
 const body=createSurvivor();assert.equal(body.userData.head.visible,true);assert.ok(body.userData.arms.every(a=>a.shoulder.visible));animateSurvivor(body,{slide:0,z:0});const bounds=new THREE.Box3().setFromObject(body);assert.ok(bounds.max.y>1.6&&bounds.max.y<1.85);animateSurvivor(body,{slide:1,z:0});assert.equal(body.userData.pelvis.position.y,.9-.42);
});
