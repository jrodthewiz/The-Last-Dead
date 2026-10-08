import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Renderer} from '../renderer.js';
import {HarborInteriorVisuals} from '../harbor-interior-visuals.js';
import {makeHarborCourse} from '../harbor-course.js';

function fixture({fail=false,cancel=false}={}){
 const previousDocument=globalThis.document;
 const ctx=new Proxy({measureText:()=>({width:20}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(object,key)=>object[key]||(()=>{})});
 globalThis.document={createElement:()=>({width:1,height:1,data:new Uint8Array(4),getContext:()=>ctx}),createElementNS:()=>({width:1,height:1,data:new Uint8Array(4),addEventListener(){},removeEventListener(){}})};
 const scene=new THREE.Scene(),course=makeHarborCourse({}),root=new THREE.Group();scene.add(root);const sky=new THREE.HemisphereLight(0xffffff,0x444444,2.1);sky.name='HarborSkyFill';root.add(sky);
 const template=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 const world={root,course,diagnostics:{},fit(){},materials:{concrete:new THREE.MeshStandardMaterial(),rust:new THREE.MeshStandardMaterial(),signal:new THREE.MeshStandardMaterial()},thaiWorld:{templates:new Map([['oil-drum',template],['municipal-wheelie-bin',template]])},sign(){const sign=new THREE.Group();root.add(sign);return sign;}};
 try{world.interiors=new HarborInteriorVisuals(world);}finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
 const hidden=new THREE.Group();hidden.visible=false;root.add(hidden);
 const cameraRig=new THREE.Group(),camera=new THREE.PerspectiveCamera();cameraRig.add(camera);scene.add(cameraRig);
 cameraRig.position.set(2,3,4);cameraRig.rotation.set(.1,.2,.3);camera.position.set(.4,.7,.8);camera.rotation.set(.2,.3,.1);camera.scale.set(.9,1.1,1.2);
 const previous={name:'original-target'},bodyTarget={name:'bodycam-target'};let target=previous;
 const snapshots=[];root.traverse(object=>snapshots.push({object,visible:object.visible,culled:object.frustumCulled}));
 const poses=[cameraRig,camera].map(object=>({object,p:object.position.clone(),q:object.quaternion.clone(),s:object.scale.clone(),mask:object.layers.mask}));
 const seen=[],draws=[],lightIds=[];let waits=0;const lightPosition=world.interiors.practicalLight.position.clone();
 const owner={scene,cameraRig,camera,harborWorld:world,_course:course,bodycam:{target:bodyTarget,_ensureTarget(){}},_reportPreparation(){},_renderScene(){draws.push([...world.interiors.rooms.values()].filter(room=>room.visible).length);}};
 owner.renderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},async compileAsync(){assert.equal(target,bodyTarget);const active=[...world.interiors.rooms.entries()].filter(([,room])=>room.visible);assert.equal(active.length,1);seen.push(active[0][0]);const lights=[];root.traverseVisible(object=>{if(object.isLight)lights.push(object.id);});assert.equal(lights.length,3);assert.equal(sky.visible,true);assert.equal(sky.intensity,0);if(lightIds.length)assert.deepEqual(lights,lightIds);else lightIds.push(...lights);const definition=course.harborRooms.find(room=>room.id===active[0][0]);assert.deepEqual(world.interiors.practicalLight.position.toArray(),[definition.x,3.2,definition.z]);for(const child of root.children)if(child!==world.interiors.root&&!child.isLight)assert.equal(child.visible,false);active[0][1].traverse(object=>{if(object.isMesh)assert.equal(object.frustumCulled,false);});if(fail)throw Error('compile failed');if(cancel)owner._course={};},backend:{device:{queue:{async onSubmittedWorkDone(){waits++;}}}}};
 Object.setPrototypeOf(owner,Renderer.prototype);
 const active=world.interiors.active,outside=world.interiors.outside;
 const verify=()=>{assert.equal(sky.intensity,2.1);assert.equal(sky.visible,true);assert.equal(world.interiors.areaLight.intensity,0);assert.equal(world.interiors.practicalLight.intensity,0);assert.equal(world.interiors.lightingRoot.visible,true);assert(world.interiors.practicalLight.position.equals(lightPosition));assert.equal(target,previous);for(const entry of snapshots){assert.equal(entry.object.visible,entry.visible);assert.equal(entry.object.frustumCulled,entry.culled);}for(const entry of poses){assert(entry.object.position.equals(entry.p));assert(entry.object.quaternion.equals(entry.q));assert(entry.object.scale.equals(entry.s));assert.equal(entry.object.layers.mask,entry.mask);}assert.equal(world.interiors.active,active);assert.equal(world.interiors.outside,outside);assert.equal(outside.size,0);assert.equal(course.activeInterior,undefined);};
 return {owner,course,seen,draws,verify,get waits(){return waits;}};
}

async function prepare(f){const raf=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=callback=>setTimeout(callback,0);try{return await Renderer.prototype._prepareHarborInteriors.call(f.owner,f.course);}finally{if(raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=raf;}}

test('six real harbor rooms prepare separately and restore camera and world state',async()=>{const f=fixture();await prepare(f);assert.deepEqual(f.seen,f.course.harborRooms.map(room=>room.id));assert.deepEqual(f.draws,[1,1,1,1,1,1]);assert.equal(f.waits,6);f.verify();});
test('interior compilation failure restores original scene and target',async()=>{const f=fixture({fail:true});await assert.rejects(prepare(f),/compile failed/);assert.equal(f.seen.length,1);assert.equal(f.draws.length,0);f.verify();});
test('course cancellation restores original scene without drawing a stale room',async()=>{const f=fixture({cancel:true});await prepare(f);assert.equal(f.seen.length,1);assert.equal(f.draws.length,0);f.verify();});
test('room entry and exit preserve light identities while varying only intensity',()=>{
 const f=fixture(),interiors=f.owner.harborWorld.interiors,sky=f.owner.harborWorld.root.getObjectByName('HarborSkyFill'),ids=interiors.lightingRoot.children.map(light=>light.id),run={course:f.course};
 assert.equal(interiors.lightingRoot.visible,true);assert.equal(interiors.areaLight.intensity,0);assert.equal(interiors.practicalLight.intensity,0);
 const visibleIds=()=>{const result=[];f.owner.harborWorld.root.traverseVisible(object=>{if(object.isLight)result.push(object.id);});return result;};const originalIds=visibleIds();assert.equal(originalIds.length,3);for(const room of f.course.harborRooms){f.course.activeInterior=room;interiors.update(run);assert.equal(interiors.lightingRoot.visible,true);assert.deepEqual(visibleIds(),originalIds);assert.equal(sky.intensity,0);assert.equal(interiors.areaLight.intensity,1.7);assert.equal(interiors.practicalLight.intensity,9);assert.deepEqual(interiors.lightingRoot.children.map(light=>light.id),ids);assert.deepEqual(interiors.practicalLight.position.toArray(),[room.x,3.2,room.z]);}
 f.course.activeInterior=null;interiors.update(run);assert.equal(interiors.lightingRoot.visible,true);assert.equal(interiors.areaLight.intensity,0);assert.equal(interiors.practicalLight.intensity,0);assert.equal(interiors.outside.size,0);assert.equal(sky.intensity,2.1);assert.deepEqual(visibleIds(),originalIds);
});
