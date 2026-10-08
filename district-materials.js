import * as THREE from './vendor/three.module.js';

// One generated atlas, shared across floors. Existing panels are replaced,
// rather than covered with a second surface at the same depth.
let atlas;
// Stable restrained wear variation, with no extra textures or draw calls.
export function districtPanelTint(x,z) {
 const seed = Math.abs(Math.imul(Math.round(x*2),73856093) ^ Math.imul(Math.round(z*2),19349663));
 const value = .78 + (seed % 23) / 100;
 return new THREE.Color().setRGB(value,value*.98,value*.94);
}
export function districtPanelSkin(course) {
 if (!course?.extended) return null;
 atlas ||= new THREE.TextureLoader().load('./assets/textures/service-district-atlas-v1.webp');
 atlas.colorSpace = THREE.SRGBColorSpace;
 atlas.userData.sharedAsset = true;
 atlas.anisotropy = 4;
 const styles = [
  [0,0xc8c9bc,.89,.28], [1,0xb9cfca,.92,.03], [2,0xc2b8aa,.96,.03],
  [3,0xa9c3ca,.76,.35], [3,0x829b85,.94,.18],
 ];
 const [quadrant,color,roughness,metalness] = styles[course.dungeonIndex] || styles[0];
 const material = new THREE.MeshStandardMaterial({map:atlas,color,roughness,metalness});
 material.userData.afterlifeSkip = true;
 const geometry = (horizontal) => {
  const g = new THREE.BoxGeometry(horizontal?3.3:.36,4.75,horizontal?.07:3.3);
  const uv = g.attributes.uv, x = quadrant%2*.5, y = quadrant<2?.5:0;
  for(let i=0;i<uv.count;i++)uv.setXY(i,x+.004+uv.getX(i)*.492,y+.004+uv.getY(i)*.492);
  return g;
 };
 return {material,geometry};
}

export function isAnnexWall(course,x,z) {
 const b=course?.extension?.annexBounds;
 return !!b&&x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
}
