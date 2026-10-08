// Three.js clones userData through JSON. Runtime metadata can hold live scene
// nodes and textures; JSON invokes their exporters, even encoding canvas PNGs.
// Copy records without serialization, sharing GPU resources and remapping
// references to nodes owned by the cloned hierarchy.
function copyData(value, objects, seen) {
  if(value===null||typeof value!=='object')return value;
  if(objects.has(value))return objects.get(value);
  if(value.isObject3D||value.isTexture||value.isMaterial||value.isBufferGeometry)return value;
  if(seen.has(value))return seen.get(value);
  if(value.isVector2||value.isVector3||value.isVector4||value.isQuaternion||value.isEuler||value.isMatrix3||value.isMatrix4||value.isColor||value.isBox3||value.isSphere)return value.clone();
  if(ArrayBuffer.isView(value))return value.slice();
  if(value instanceof Map){const result=new Map();seen.set(value,result);for(const [key,item]of value)result.set(copyData(key,objects,seen),copyData(item,objects,seen));return result;}
  if(value instanceof Set){const result=new Set();seen.set(value,result);for(const item of value)result.add(copyData(item,objects,seen));return result;}
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)return value;
  const result=Array.isArray(value)?[]:{};seen.set(value,result);
  for(const [key,item]of Object.entries(value))result[key]=copyData(item,objects,seen);
  return result;
}

export function cloneRuntimeObject(source) {
  const metadata=[];source.traverse(object=>metadata.push([object,object.userData]));
  let clone;
  try{for(const [object]of metadata)object.userData={};clone=source.clone(true);}
  finally{for(const [object,data]of metadata)object.userData=data;}
  const objects=new Map();
  const pair=(a,b)=>{objects.set(a,b);for(let i=0;i<a.children.length;i++)pair(a.children[i],b.children[i]);};pair(source,clone);
  const seen=new Map();for(const [object,data]of metadata)objects.get(object).userData=copyData(data,objects,seen);
  return clone;
}

export function cloneRuntimeMaterial(source) {
  const data=source.userData;let clone;
  try{source.userData={};clone=source.clone();}finally{source.userData=data;}
  clone.userData=copyData(data,new Map(),new Map());return clone;
}
