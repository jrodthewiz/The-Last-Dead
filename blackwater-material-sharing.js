// Only the architecture factory's known equivalent owner-clones are shared.
// Models retain ownership; original references are restored before disposal.
const ROLE=/^blackwater-(?:commercial-furnitureWood|house-(?:siding-\d+|furnitureWood|interiorWood|interiorTile|rug))$/;
export function shareBlackwaterOwnedMaterials(models){
 const objects=[],cache=new Map(),references=new WeakMap();let next=0,aliases=0;
 const identity=v=>{if(!references.has(v))references.set(v,++next);return references.get(v);};
 function value(v,plain=false){
  if(v==null||typeof v!=='object'&&typeof v!=='function')return v;
  if(typeof v==='function')return['function',identity(v)];
  if(v.isTexture)return['texture',v.uuid];
  if(v.isColor||v.isVector2||v.isVector3||v.isVector4||v.isEuler)return[v.constructor.name,...v.toArray()];
  if(Array.isArray(v))return v.map(p=>value(p,plain));
  if(plain)return Object.fromEntries(Object.keys(v).sort().map(k=>[k,value(v[k],true)]));
  return['object',identity(v)];
 }
 const key=m=>JSON.stringify(Object.keys(m).filter(k=>!['id','uuid','version'].includes(k)).sort().map(k=>[k,value(m[k],k==='userData'||k==='defines')]));
 function shared(material){
  if(!material?.isMeshStandardMaterial||!ROLE.test(material.name))return material;
  const signature=key(material);if(!cache.has(signature))cache.set(signature,material);
  const canonical=cache.get(signature);if(canonical!==material)aliases++;return canonical;
 }
 for(const model of models)model.root.traverse(o=>{if(!o.isMesh)return;const original=o.material,next=Array.isArray(original)?original.map(shared):shared(original);if(next!==original){objects.push({object:o,material:original});o.material=next;}});
 let restored=false;
 return{diagnostics:{aliasedMeshes:objects.length,aliasedSlots:aliases,sharedOwnedVariants:cache.size,scope:'known owner-clones; full property/function/texture identity signature; signs excluded'},restore(){if(restored)return;restored=true;for(const {object,material} of objects)object.material=material;}};
}
