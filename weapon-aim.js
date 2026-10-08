import * as THREE from './vendor/three.module.js';

// Coordinates are in the authored gun frame. Unsighted weapons brace below
// the crosshair; a sighted weapon seats its actual sight line on the view axis.
export const WEAPON_AIM = Object.freeze([
  {mode:'sights', rear:[0,.224,.213], front:[0,.2185,-1.015], target:[0,0], zoom:12},
  {mode:'brace', rear:[0,.2,.2], front:[0,.2,-1], target:[.10,-.16], zoom:6},
  {mode:'brace', rear:[0,.2,.2], front:[0,.2,-1], target:[.10,-.16], zoom:8},
  {mode:'brace', rear:[0,.2,.2], front:[0,.2,-1], target:[.14,-.20], zoom:5},
  {mode:'sights', rear:[0,.286,.259], front:[0,.262,-.802], target:[0,0], zoom:12},
  {mode:'sights', rear:[0,.39,.16], front:[0,.39,-.46], target:[0,0], zoom:14},
].map(profile=>Object.freeze({...profile,rear:Object.freeze(profile.rear),front:Object.freeze(profile.front),target:Object.freeze(profile.target)})));

export class WeaponAim {
  constructor() {
    this.matrix = new THREE.Matrix4();
    this.rear = new THREE.Vector3(); this.front = new THREE.Vector3();
    this.forward = new THREE.Vector3(0,0,-1);
    this.rotation = new THREE.Quaternion(); this.blend = new THREE.Quaternion();
    this.offset = new THREE.Vector3();
  }

  apply(rig, group, weapon, amount) {
    const profile = WEAPON_AIM[weapon];
    const aim = Number.isFinite(amount) ? Math.max(0,Math.min(1,amount)) : 0;
    if (!profile || !aim) return;
    // Include wrapper/reach transforms and responsive viewmodel scaling.
    // Walking local matrices avoids dependence on a stale camera world matrix.
    this.matrix.identity();
    for (let node=group.userData.model||group; node!==rig; node=node.parent) {
      if (!node) return;
      node.updateMatrix(); this.matrix.premultiply(node.matrix);
    }
    this.rear.fromArray(profile.rear).applyMatrix4(this.matrix);
    this.front.fromArray(profile.front).applyMatrix4(this.matrix).sub(this.rear).normalize();
    this.rotation.setFromUnitVectors(this.front,this.forward);
    const depth = this.rear.z;
    this.rear.applyQuaternion(this.rotation);
    // WeaponPresentation's idle base remains additive to firing/draw motion.
    this.offset.set(profile.target[0]-.02,profile.target[1]+.012,depth).sub(this.rear);
    this.blend.identity().slerp(this.rotation,aim);
    rig.quaternion.premultiply(this.blend);
    rig.position.addScaledVector(this.offset,aim);
  }
}
