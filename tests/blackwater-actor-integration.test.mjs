import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';

const source=readFileSync(new URL('../renderer.js',import.meta.url),'utf8');
const signature='  _syncBlackwaterActorStyle(root,enemy,{prepare=false}={}) {';
const start=source.indexOf(signature)+signature.length,end=source.indexOf('  _enemySource(enemy)',start);
assert.ok(start>=signature.length&&end>start);
const factory=new Function('CELL','applyBlackwaterActorStyle',`return function(root,enemy,{prepare=false}={}){${source.slice(start,end).replace(/}\s*$/,'')}}`);

test('actual renderer style integration uses authoritative world bounds and leaves other worlds alone',()=>{
 const calls=[],worldRoot=new THREE.Group(),districtRoot=new THREE.Group(),sun=new THREE.DirectionalLight(),fill=new THREE.HemisphereLight();fill.name='HarborSkyFill';worldRoot.add(fill);
 const state={harborWorld:{blackwaterGraphic:{},blackwaterSun:sun,root:worldRoot,blackwater:{root:districtRoot}},_course:{coastal:{blackwaterSlice:{bounds:{minX:152,maxX:224,minZ:8,maxZ:104}}}}};
 const sync=factory(4,(root,options)=>{calls.push(options);return{setEnabled(value){root.userData.enabled=value;},syncState(){root.userData.syncs=(root.userData.syncs||0)+1;}};});
 const root=new THREE.Group();sync.call(state,root,{x:30,y:14,kind:0});assert.equal(calls.length,0);
 sync.call(state,root,{x:38,y:2,kind:0});assert.equal(calls.length,1);assert.equal(root.userData.enabled,true);assert.deepEqual(calls[0].lightSources,[sun,fill]);
 sync.call(state,root,{x:56,y:26,kind:0});assert.equal(root.userData.enabled,true);assert.equal(calls.length,1,'reuse at opposite boundary');
 sync.call(state,root,{x:56.001,y:26,kind:0});assert.equal(root.userData.enabled,false);
 state.harborWorld=null;sync.call(state,root,{x:50,y:14,kind:0});assert.equal(root.userData.enabled,false);assert.equal(calls.length,1);
});

test('coastal preparation creates native actor surfaces before play and debug comparison does not allocate variants',()=>{
 const root=new THREE.Group(),worldRoot=new THREE.Group(),fill=new THREE.HemisphereLight();fill.name='HarborSkyFill';worldRoot.add(fill);let allocated=0;
 const state={harborWorld:{blackwaterGraphic:{},root:worldRoot,blackwater:{root:new THREE.Group()}},_course:{coastal:{blackwaterSlice:{bounds:{minX:152,maxX:224,minZ:8,maxZ:104}}}}};
 const sync=factory(4,()=>{allocated++;return{setEnabled(value){root.userData.enabled=value;},syncState(){}};});
 sync.call(state,root,{kind:0},{prepare:true});assert.equal(allocated,1);assert.equal(root.userData.enabled,true);
 state._blackwaterActorStyleEnabled=false;sync.call(state,root,{kind:0,x:50,y:14});assert.equal(root.userData.enabled,false);
 state._blackwaterActorStyleEnabled=true;sync.call(state,root,{kind:0,x:50,y:14});assert.equal(root.userData.enabled,true);assert.equal(allocated,1);
 assert.ok(source.indexOf('this._syncBlackwaterActorStyle(entry.root,{kind},{prepare:true});')<source.indexOf('if(current())this._coastalEnemyPreparedCourse=course;'));
});

test('generated appearances opt into their colored atlas while Ash keeps its existing semantic palette',()=>{
 const calls=[],worldRoot=new THREE.Group(),state={harborWorld:{blackwaterGraphic:{},root:worldRoot,blackwater:{root:new THREE.Group()}},_course:{coastal:{blackwaterSlice:{bounds:{minX:0,maxX:10,minZ:0,maxZ:10}}}}};
 const sync=factory(4,(root,options)=>{calls.push(options);return{setEnabled(){},syncState(){}};});
 const generated=new THREE.Group();generated.userData.afterlife={appearance:'crooked-crawler',appearancePalette:{jacket:'#596653'},preserveAtlasColors:true};sync.call(state,generated,{kind:0,x:1,y:1});
 assert.equal(calls[0].preserveAtlasColors,true);assert.equal(calls[0].palette,generated.userData.afterlife.appearancePalette);
 const ash=new THREE.Group();ash.userData.afterlife={appearance:'ash-witness',appearancePalette:null,preserveAtlasColors:false};sync.call(state,ash,{kind:0,x:1,y:1});assert.equal(calls[1].preserveAtlasColors,undefined);assert.equal(calls[1].palette,undefined);
});
