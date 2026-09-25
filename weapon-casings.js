import * as THREE from './vendor/three.module.js';

const CAPACITY = 24;

// A single instanced viewmodel pool handles both rifles. Nothing is created
// during a shot, and old brass expires before it can cover the aim point.
export class RifleCasings {
  constructor(parent) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.012, .012, .052, 8),
      new THREE.MeshStandardMaterial({ color: 0xc59c55, metalness: .72, roughness: .4 }),
      CAPACITY,
    );
    this.mesh.name = 'RifleEjectedCasings';
    this.mesh.layers.set(1);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
    this.slots = Array.from({ length: CAPACITY }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(), life: 0,
    }));
    this.cursor = 0;
    this.emitted = 0;
    this.object = new THREE.Object3D();
  }

  reset() {
    for (const slot of this.slots) slot.life = 0;
    this.mesh.count = 0;
    this.cursor = 0;
  }

  spawn(position, sequence, weapon = 4) {
    const slot = this.slots[this.cursor++ % CAPACITY];
    const seed = Number(sequence) || 0;
    slot.position.copy(position);
    slot.velocity.set(.68 + (seed % 3) * .09, .55 + ((seed * 7) % 4) * .07, .12 + (seed % 2) * .08);
    slot.rotation.set(seed * .35, seed * .7, weapon === 5 ? .9 : .45);
    slot.life = 1.05;
    this.emitted++;
  }

  update(dt) {
    const delta = Math.max(0, Math.min(.05, Number(dt) || 0));
    let count = 0;
    for (const slot of this.slots) {
      if (slot.life <= 0) continue;
      slot.life = Math.max(0, slot.life - delta);
      if (!slot.life) continue;
      slot.position.addScaledVector(slot.velocity, delta);
      slot.velocity.y -= 3.5 * delta;
      slot.rotation.x += delta * 11;
      slot.rotation.z += delta * 16;
      this.object.position.copy(slot.position);
      this.object.rotation.copy(slot.rotation);
      this.object.updateMatrix();
      this.mesh.setMatrixAt(count++, this.object.matrix);
    }
    this.mesh.count = count;
    if (count) this.mesh.instanceMatrix.needsUpdate = true;
    return count;
  }
}
