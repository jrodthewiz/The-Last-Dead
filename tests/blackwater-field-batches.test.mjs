import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {batchFieldWeapon,updateWeaponFinds} from '../island/field-weapon-batches.js';
import {createLootVisuals} from '../island/loot-visuals.js';
const vertexCloud=root=>{root.updateMatrixWorld(true);const result=[],point=new T.Vector3();root.traverseVisible(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;for(let i=0;i<(m.geometry.index?.count??p.count);i++){const v=m.geometry.index?.getX(i)??i;point.fromBufferAttribute(p,v).applyMatrix4(m.matrixWorld);result.push(point.toArray().map(x=>Math.round(x*1e5)).join(','));}});return result.sort();};

test('field snapshot batching preserves posed surfaces, materials, mirrored pieces and source bytes',()=>{
 const root=new T.Group(),nested=new T.Group(),box=new T.BoxGeometry(1,1,1),bytes=box.attributes.position.array.slice(),material=new T.MeshLambertMaterial({color:0x728b6a}),glass=new T.MeshBasicMaterial({transparent:true,opacity:.4});root.position.set(3,4,5);root.rotation.set(.1,.2,.3);nested.position.set(.2,-.3,.4);nested.rotation.y=.8;root.add(nested);
 for(let i=0;i<4;i++){const m=new T.Mesh(box,material);m.position.set(i*.4,i*.1,0);m.rotation.z=i*.1;nested.add(m);}
 const mirrored=new T.Mesh(box,material),transparent=new T.Mesh(box,glass),hidden=new T.Mesh(box,material);mirrored.scale.x=-1;transparent.position.y=2;hidden.visible=false;root.add(mirrored,transparent,hidden);
 const before=vertexCloud(root),stats=batchFieldWeapon(root);assert.equal(stats.before,6);assert.equal(stats.after,3);assert.deepEqual(vertexCloud(root),before);assert.deepEqual(box.attributes.position.array,bytes);assert.equal(mirrored.parent,root);assert.equal(transparent.material,glass);assert.equal(hidden.parent,root);assert.equal(root.getObjectByName('Field weapon surfaces').material,material);
});

test('scavenging container batching retains the moving lid and contents in both poses',()=>{
 const scene=new T.Scene(),visuals=createLootVisuals(scene,[{id:'pack',name:'Medical satchel',kind:'bag',x:20,y:14,z:30}]),entry=visuals.entries[0],state={backpack:{searched:[],remaining:{pack:{bandage:1}}}};
 assert.ok(entry.group.children.includes(entry.lid)&&entry.group.children.includes(entry.contents));let meshes=0;entry.group.traverse(o=>meshes+=!!o.isMesh);assert.ok(meshes<13);
 visuals.update(.1,state,new T.Vector3(20,15,30));const closed=vertexCloud(entry.lid);assert.equal(entry.contents.visible,false);state.backpack.searched.push('pack');for(let i=0;i<30;i++)visuals.update(1/60,state,new T.Vector3(20,15,30));assert.ok(entry.lid.rotation.x<-1.1);assert.equal(entry.contents.visible,true);assert.notDeepEqual(vertexCloud(entry.lid),closed);assert.deepEqual(visuals.colliders,[{id:'pack',x:20,z:30,w:.72,d:.44,y:14,h:.48}]);
});

test('weapon finds follow camera distance while ownership survives flight and return',()=>{
 const mesh=new T.Group();mesh.position.set(20,14,30);const caches=[{weapon:'bat',mesh}],state={armory:{bat:{owned:false}}};
 updateWeaponFinds(caches,state,new T.Vector3(20,15,32));assert.equal(mesh.visible,true);
 updateWeaponFinds(caches,state,new T.Vector3(900,60,300));assert.equal(mesh.visible,false);
 updateWeaponFinds(caches,state,new T.Vector3(20,15,32));assert.equal(mesh.visible,true);
 state.armory.bat.owned=true;updateWeaponFinds(caches,state,new T.Vector3(20,15,32));assert.equal(mesh.visible,false);
});

test('non-leaf surfaces retain their transparent, mirrored and instanced descendants',()=>{
 const root=new T.Group(),geometry=new T.BoxGeometry(1,1,1),material=new T.MeshLambertMaterial(),parent=new T.Mesh(geometry,material),sibling=new T.Mesh(geometry,material),transparent=new T.Mesh(geometry,new T.MeshBasicMaterial({transparent:true,opacity:.4})),mirrored=new T.Mesh(geometry,material),instanced=new T.InstancedMesh(geometry,material,1);
 mirrored.scale.x=-1;parent.add(transparent,mirrored,instanced);root.add(parent,sibling);const before=vertexCloud(root);batchFieldWeapon(root);
 assert.equal(parent.parent,root);assert.equal(transparent.parent,parent);assert.equal(mirrored.parent,parent);assert.equal(instanced.parent,parent);assert.deepEqual(vertexCloud(root),before);
});
