import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import * as T from '../vendor/three.module.js';
import {FOREGROUND_ARM_URL,FOREGROUND_ARM_REVISION} from '../assets/survivor/foreground-arms.js';

const bytes=path=>readFileSync(new URL(path,import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const attributeBytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength);
let old,current;
test.before(async()=>{
  const bitmap=globalThis.createImageBitmap,self=globalThis.self;
  globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
  try{
    const loader=new GLTFLoader();
    for(const version of ['v1','v2']){
      const data=bytes(`../assets/survivor/viewmodel-arms-${version}.glb`);
      const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
      if(version==='v1')old=gltf.scene;else current=gltf.scene;
    }
  }finally{
    if(bitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=bitmap;
    if(self===undefined)delete globalThis.self;else globalThis.self=self;
  }
});

function meshGeometry(root){let geometry;root.traverse(o=>{if(o.isMesh)geometry=o.geometry;});return geometry;}
function glbDocument(data){return JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());}

test('runtime uses the real Blender v2 export and protected source assets retain their recorded bytes',()=>{
  assert.equal(FOREGROUND_ARM_REVISION,2);assert(FOREGROUND_ARM_URL.endsWith('/viewmodel-arms-v2.glb'));
  const manifest=JSON.parse(bytes('../assets/survivor/viewmodel-arms-v2-manifest.json'));
  assert.equal(hash(bytes('../assets/survivor/viewmodel-arms-v2.glb')),manifest.sha256);
  assert.equal(hash(bytes('../assets/survivor/viewmodel-arms-v1.glb')),'754871fa53ebddc9b9bfb5d59120b33592288895cde2f9b4f2dc752e9472708e');
  assert.equal(hash(bytes('../assets/survivor/tld-survivor-v02.glb')),'f3c9b277985435845d0848f9fc9ca32fa92da9f695c911f7ea48eacff712db03');
  assert(manifest.source_blend_inspected.endsWith('Viewmodel_Arms_v1.blend'));
  assert(manifest.source_blend_opened.endsWith('The_Last_Dead_Clean_First_Person_Arms_v2.blend'));
  assert.equal(manifest.export_mode,'saved-master-only');
  assert(manifest.authoring.endsWith('The_Last_Dead_Clean_First_Person_Arms_v2.blend'));
});

test('v2 garment has short wrist coverage, connected native metric endpoints and authored surface normals',()=>{
  current.updateWorldMatrix(true,true);
  for(const side of ['Left','Right'])for(const part of ['TLD_ViewSleeve_','TLD_UpperSleeve_']){
    const object=current.getObjectByName(part+side),geometry=meshGeometry(object);
    assert(object);assert(geometry.attributes.color,'Blender fabric zones are present');
    const positions=geometry.attributes.position,normals=geometry.attributes.normal;
    const inverse=new T.Matrix4().copy(object.matrixWorld).invert(),point=new T.Vector3(),normal=new T.Vector3();
    let minY=Infinity,maxY=-Infinity,maxRadius=0,bareEnd=0,skinVertices=0,clothVertices=0;
    object.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const transform=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i).applyMatrix4(transform);
        normal.fromBufferAttribute(normals,i);
        assert(point.toArray().every(Number.isFinite));assert(Math.abs(normal.length()-1)<1e-4);
        minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);maxRadius=Math.max(maxRadius,Math.hypot(point.x,point.z));
        const color=geometry.attributes.color;
        if(color.getX(i)>color.getZ(i)*1.25){skinVertices++;bareEnd=Math.max(bareEnd,-point.y);}else clothVertices++;
      }
    });
    const length=part==='TLD_ViewSleeve_'?.34:.40;
    assert(Math.abs(minY+length)<1e-6&&Math.abs(maxY)<1e-6,'native endpoints retain exact arm contract');
    assert(maxRadius<.081,'garment stays inside adult radial envelope');
    if(part==='TLD_ViewSleeve_'){
      assert(skinVertices>20&&clothVertices>100);assert(bareEnd<=.036+1e-6,'bare wrist is a short transition');
      assert.notEqual(hash(attributeBytes(geometry.attributes.position)),hash(attributeBytes(meshGeometry(old.getObjectByName(part+side)).attributes.position)),'Blender changed actual geometry');
    }
  }
});

test('grip/wrist and four supporting digit pivots survive while the authored trigger MCP seats in the glove',()=>{
  for(const side of ['Left','Right']){
    const hand=current.getObjectByName('TLD_GripHand_'+side),before=old.getObjectByName('TLD_GripHand_'+side);
    assert.deepEqual(hand.position.toArray(),before.position.toArray());
    assert.deepEqual(hand.userData.wrist_position,[0,-.075,.015]);assert.deepEqual(hand.userData.grip_position,[0,0,0]);
    for(const digit of ['Index','Middle','Ring','Little','Thumb']){
      const name=side==='Right'&&digit==='Index'?'RightTriggerFinger':side+digit+'Finger';
      const pivot=hand.getObjectByName(name),reference=before.getObjectByName(name);
      assert(pivot);
      if(name==='RightTriggerFinger'){
        assert(Math.abs(pivot.position.x-.032)<1e-6&&Math.abs(pivot.position.y-.043)<1e-6&&Math.abs(pivot.position.z+.016)<1e-6);
      }else assert.deepEqual(pivot.position.toArray(),reference.position.toArray());
      assert.deepEqual(pivot.quaternion.toArray(),reference.quaternion.toArray());
    }
  }
});

test('accepted interaction skin and complete bind graph survive byte-for-byte without Blender re-export',()=>{
  const next=current.getObjectByName('TLD_Remote_Arms'),previous=old.getObjectByName('TLD_Remote_Arms');
  assert(next.isSkinnedMesh&&previous.isSkinnedMesh);
  for(const name of ['position','normal','uv','skinIndex','skinWeight'])assert.equal(hash(attributeBytes(next.geometry.attributes[name])),hash(attributeBytes(previous.geometry.attributes[name])),name);
  assert.equal(hash(attributeBytes(next.geometry.index)),hash(attributeBytes(previous.geometry.index)));
  assert.deepEqual(next.skeleton.bones.map(b=>b.name),previous.skeleton.bones.map(b=>b.name));
  assert.deepEqual(next.bindMatrix.elements,previous.bindMatrix.elements);
  for(const [i,bone] of next.skeleton.bones.entries()){
    const reference=previous.skeleton.bones[i];
    assert.deepEqual(bone.position.toArray(),reference.position.toArray());assert.deepEqual(bone.quaternion.toArray(),reference.quaternion.toArray());assert.deepEqual(bone.scale.toArray(),reference.scale.toArray());
    assert.deepEqual(next.skeleton.boneInverses[i].elements,previous.skeleton.boneInverses[i].elements);
  }
});

test('export reduces arm topology and download bytes while retaining native PBR/vertex color contracts',()=>{
  const a=bytes('../assets/survivor/viewmodel-arms-v1.glb'),b=bytes('../assets/survivor/viewmodel-arms-v2.glb');
  const oldDoc=glbDocument(a),doc=glbDocument(b);
  const triangles=d=>d.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+d.accessors[p.indices].count/3,0),0);
  assert(b.length<a.length*.55);assert(triangles(doc)<triangles(oldDoc)*.75);assert(triangles(doc)>40000);
  assert.equal(doc.textures.length,3,'two shared glove maps and preserved interaction atlas; no ordinary skin albedo');
  const canvas=doc.materials.find(m=>m.name==='TLD_Graphic_Canvas_v2');
  assert.deepEqual(canvas.pbrMetallicRoughness.baseColorFactor,[1,1,1,1]);assert(canvas.pbrMetallicRoughness.roughnessFactor>.8);
  for(const name of ['TLD_ViewSleeve_Left','TLD_ViewSleeve_Right','TLD_UpperSleeve_Left','TLD_UpperSleeve_Right']){
    const node=doc.nodes.find(n=>n.name===name);assert(doc.meshes[node.mesh].primitives[0].attributes.COLOR_0!==undefined);
  }
  const gloveIndex=doc.materials.findIndex(m=>m.name==='TLD_Full_Worn_Leather_Gloves_v2'),glove=doc.materials[gloveIndex];
  assert(gloveIndex>=0);assert(glove.normalTexture);assert(glove.pbrMetallicRoughness.metallicRoughnessTexture);
  assert(glove.normalTexture.scale<.4,'micro crease detail remains restrained');
  assert(glove.pbrMetallicRoughness.baseColorTexture===undefined,'old skin atlas and bake colors cannot multiply together');
  assert.deepEqual(glove.pbrMetallicRoughness.baseColorFactor||[1,1,1,1],[1,1,1,1]);
  const gloves=doc.meshes.filter(mesh=>mesh.name.startsWith('Grip')||mesh.name.startsWith('Nail'));
  assert.equal(gloves.length,22,'palms, five digits and five reinforcement plates per hand');
  for(const mesh of gloves)for(const primitive of mesh.primitives){
    assert.equal(primitive.material,gloveIndex,'one shared authored leather material covers every finger and thumb');
    assert(primitive.attributes.COLOR_0!==undefined,'leather owns deliberate dark wear and seam zones');
    const object=current.getObjectByName(mesh.name),colors=object.geometry.attributes.color;
    for(let i=0;i<colors.count;i++)for(const component of [colors.getX(i),colors.getY(i),colors.getZ(i)])assert(component>0&&component<.15,'no pale skin or orange projection colors on glove surfaces');
  }
});
