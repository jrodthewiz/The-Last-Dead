// Keep first-person weapons readable against the local body while retaining
// self-occlusion within the gun. Reserve the nearest 1% of depth for viewmodels;
// never clear world depth, which transparent world effects still need afterward.
// No second world render, geometry changes or shader variants are required.
export function installViewmodelDepthBoundary(rig) {
  const beforeDraw=renderer=>renderer.getContext().depthRange(0,.01);
  const afterDraw=renderer=>renderer.getContext().depthRange(0,1);
  rig.traverse(object=>{
    // Draw authored hands after the weapon body so a palm sitting on the
    // grip remains legible in the close camera.  Depth testing is preserved;
    // this only resolves the equal-depth sort between sibling viewmodel
    // meshes.
    object.renderOrder=object.userData?.viewmodelArm?1010:1000;
    if(object.isMesh){object.onBeforeRender=beforeDraw;object.onAfterRender=afterDraw;}
  });
}
