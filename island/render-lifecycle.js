// Static scenery owns an immutable local transform. Materials, visibility,
// shader wind and vertex buffers may still animate normally.
export function freezeLocalTransforms(root){
 root.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;});
 // These world/scenery roots stay under the fixed scene. Bake their world
 // matrices once as well: the renderer otherwise revisits every static child
 // on each colour and shadow draw. Explicit updateWorldMatrix queries remain
 // available; visibility, vertex-buffer edits and shader wind are independent.
 root.updateWorldMatrix(true,true);
 root.updateMatrixWorld=function(){};
}

// Three normally updates invisible descendants too. These explicitly owned
// viewmodel/actor branches need automatic matrices only when displayed.
// Explicit updateWorldMatrix()/getWorldPosition() queries remain available.
export function sleepHiddenBranch(root){
 const update=root.updateMatrixWorld;
 root.updateMatrixWorld=function(force){if(this.visible||force)update.call(this,force);};
}

// Prepare all weapon/actor/material variants before Begin becomes available.
// Keep shader error checking enabled; wait on the driver's parallel compiler
// instead of discovering a program synchronously on its first gameplay draw.
export async function prepareRenderer(renderer,presentation,scene,camera,inspection){
 const start=performance.now(),textures=new Set(),roots=[scene,inspection.scene];
 for(const root of roots)root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture)textures.add(value);});
 let count=0;for(const texture of textures){renderer.initTexture(texture);if(++count%8===0)await new Promise(requestAnimationFrame);}
 const target=renderer.getRenderTarget();
 try{
  renderer.setRenderTarget(presentation.enabled?presentation.target:null);
  await renderer.compileAsync(scene,camera);
  await renderer.compileAsync(inspection.scene,inspection.camera);
  // compileAsync prepares colour materials, but Three creates shadow-depth
  // variants only during an actual shadow pass. Draw every loaded branch once
  // into the offscreen target while loading, including distant/hidden actors.
  // This also uploads their geometry; no visibility or culling change survives.
  const viewport=presentation.target.viewport.clone();
  try{
   presentation.target.viewport.set(0,0,1,1);
   for(const [root,view] of [[scene,camera],[inspection.scene,inspection.camera]]){
    await new Promise(requestAnimationFrame);
    const saved=[];
    root.traverse(o=>{saved.push([o,o.visible,o.frustumCulled]);if(!o.isLight)o.visible=true;o.frustumCulled=false;});
    try{renderer.setRenderTarget(presentation.target);renderer.render(root,view);}
    finally{for(const [o,visible,culled]of saved){o.visible=visible;o.frustumCulled=culled;}}
   }
  }finally{presentation.target.viewport.copy(viewport);}
 }finally{renderer.setRenderTarget(target);}
 return {milliseconds:performance.now()-start,textures:textures.size,programs:renderer.info.programs.length,parallelCompile:renderer.extensions.has('KHR_parallel_shader_compile')};
}
