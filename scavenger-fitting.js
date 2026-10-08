import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {WEAPON_FITTING} from './scavenger-pack.js';

// One inexpensive, mechanically attached prototype; other weapons retain
// their existing appearance until their own fitting has been authored.
export function installOssuaryFitting(weapon) {
  if(weapon.userData.scavengerFitting)return weapon.userData.scavengerFitting;
  const barrel=weapon.getObjectByName('barrel');
  if(!barrel)return null;
  const pieces=[[-.142,.035,-.64,.035,.23,.26],[.142,.035,-.64,.035,.23,.26],
    [0,.16,-.64,.32,.035,.26]].map(([x,y,z,w,h,d])=>new THREE.BoxGeometry(w,h,d).translate(x,y,z));
  const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb29a65,roughness:.48,metalness:.72}));
  mesh.name='HardenedBarrelFitting';mesh.userData.weaponDynamic=true;
  mesh.visible=false;mesh.layers.set(1);barrel.add(mesh);
  weapon.userData.scavengerFitting=mesh;
  return mesh;
}

export function updateOssuaryFitting(weapon,run) {
  const mesh=weapon.userData.scavengerFitting;
  if(mesh)mesh.visible=(run.world||run).backpack?.weaponMods?.[0]===WEAPON_FITTING.id;
}
