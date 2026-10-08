// Keep first-person weapons readable against the local body while retaining
// self-occlusion within the gun. Reserve the nearest 1% of depth for viewmodels;
// never clear world depth, which transparent world effects still need afterward.
// No second world render or geometry changes are required.
import {isolateViewmodelSpotlights} from '../../bounded-lighting.js';
export function installViewmodelDepthBoundary(rig) {
  rig.traverse(object=>{
    // Draw authored hands after the weapon body so a palm sitting on the
    // grip remains legible in the close camera.  Depth testing is preserved;
    // this only resolves the equal-depth sort between sibling viewmodel
    // meshes.
    object.renderOrder=object.userData?.viewmodelArm?1010:1000;
    if(object.isMesh){
      for(const material of (Array.isArray(object.material)?object.material:[object.material])){if(!material.userData.viewmodelDepth){const key=material.customProgramCacheKey();material.userData.viewmodelDepth=true;material.customProgramCacheKey=()=>key+'|viewmodel-depth-v1';material.needsUpdate=true;}isolateViewmodelSpotlights(material);}
    }
  });
}
