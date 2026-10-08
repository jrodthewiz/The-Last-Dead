import * as THREE from './vendor/three.module.js';
const sharedMatrixViews=new WeakMap();

// The native backend recognizes this tag and uses matrix attributes for the
// world's batches and non-morphing effects (including animated matrix pools),
// keeping shader code independent of bin capacity. Padded allocation remains
// compatible with the existing batches; count and bounds use active instances.
export function createCoastalInstances(geometry,material,count){
 if(!Number.isSafeInteger(count)||count<=0)throw new RangeError('Coastal instance count must be a positive safe integer');
 const capacity=2**Math.ceil(Math.log2(count));
 const mesh=new THREE.InstancedMesh(geometry,material,capacity);
 mesh.count=count;
 return prepareCoastalInstances(mesh);
}

export function prepareCoastalInstances(mesh){
 if(!mesh.isInstancedMesh||(mesh.userData.coastalInstanceCapacity!==undefined&&mesh.geometry.hasAttribute('coastalMatrix0'))||mesh.morphTexture||Object.keys(mesh.geometry.morphAttributes).length)return mesh;
 const geometry=mesh.geometry;
 // A lightweight geometry view borrows the primitive buffers, while each bin
 // owns named matrix/color attributes. Cached shaders resolve those names on
 // the current draw instead of retaining another bin's instance buffer.
 const view=new THREE.BufferGeometry();
 view.index=geometry.index;view.attributes={...geometry.attributes};
 view.morphAttributes={...geometry.morphAttributes};view.morphTargetsRelative=geometry.morphTargetsRelative;
 view.groups=geometry.groups.map(group=>({...group}));view.drawRange={...geometry.drawRange};
 view.boundingBox=geometry.boundingBox?.clone()||null;view.boundingSphere=geometry.boundingSphere?.clone()||null;
 mesh.geometry=view;
 mesh.userData.coastalInstanceCapacity=mesh.instanceMatrix.count;
 let matrices=sharedMatrixViews.get(mesh.instanceMatrix);
 if(!matrices){
  matrices=new THREE.InstancedInterleavedBuffer(mesh.instanceMatrix.array,16,1);
  const markUpdated=Object.getOwnPropertyDescriptor(THREE.BufferAttribute.prototype,'needsUpdate').set;
  Object.defineProperty(mesh.instanceMatrix,'needsUpdate',{set(value){markUpdated.call(this,value);if(value)matrices.needsUpdate=true;}});
  sharedMatrixViews.set(mesh.instanceMatrix,matrices);
 }
 for(let column=0;column<4;column++)view.setAttribute(`coastalMatrix${column}`,new THREE.InterleavedBufferAttribute(matrices,4,column*4));
 const setColorAt=mesh.setColorAt;
 mesh.setColorAt=function(index,color){setColorAt.call(this,index,color);view.setAttribute('coastalInstanceColor',this.instanceColor);};
 if(mesh.instanceColor)view.setAttribute('coastalInstanceColor',mesh.instanceColor);
 mesh.addEventListener('dispose',()=>view.dispose());
 return mesh;
}
