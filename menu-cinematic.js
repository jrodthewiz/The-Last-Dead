import * as THREE from './vendor/three.module.js';
import { createAfterlifeModel, disposeAfterlifeModel } from './npc-afterlife-model.js';
import { createAfterlifeWheelchair, createAfterlifeMourningCabinet, disposeAfterlifeProp } from './afterlife-props.js';

const ZERO_POINTER = new THREE.Vector2();
const clamp = THREE.MathUtils.clamp;

/** A title-only tableau. It shares game assets, never the live simulation. */
export class MenuCinematic {
  constructor({ materials, environment }) {
    this.scene = new THREE.Scene();
    this.scene.name = 'TheWatchingWard';
    this.scene.background = new THREE.Color(0x070c0d);
    this.scene.fog = new THREE.FogExp2(0x111b1c, .055);
    this.scene.environment = environment;
    this.scene.environmentIntensity = .12;
    this.camera = new THREE.PerspectiveCamera(40, 1, .05, 55);
    this.pointer = new THREE.Vector2();
    this.smoothedPointer = new THREE.Vector2();
    this.actors = [];
    this.props = [];
    this.ownedMaterials = new Set();
    this.ownedTextures = new Set();
    this.surfaceSources = [];
    this.geometries = new Set();
    this.clock = 0;
    this.lastNow = null;
    this.needsShadow = true;
    this.active = false;
    this.headPosition = new THREE.Vector3();
    this.gazeTarget = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.worldQuaternion = new THREE.Quaternion();
    this.parentQuaternion = new THREE.Quaternion();
    this.deltaQuaternion = new THREE.Quaternion();
    this.rollQuaternion = new THREE.Quaternion();
    this.goalQuaternion = new THREE.Quaternion();
    this.box = this.ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    const material = (source, color, options = {}) => {
      const value = source ? source.clone() : new THREE.MeshStandardMaterial();
      value.color.set(color);
      Object.assign(value, options);
      this.ownedMaterials.add(value);
      if (source) this.surfaceSources.push({ source, material: value, maps: {}, repeat: source === materials.floor ? [6, 16] : [8, 1] });
      return value;
    };
    const wall = material(materials.wall, 0x89958c, { roughness: .95, metalness: .02 });
    const lowerWall = material(materials.wall, 0x273b39, { roughness: .84, metalness: .04 });
    const floor = material(materials.floor, 0x58615c, { roughness: .53, metalness: .13 });
    const iron = material(null, 0x222b2c, { roughness: .67, metalness: .7 });
    const recess = material(null, 0x040708, { roughness: 1 });
    const porcelain = material(null, 0x97a7a0, { roughness: .8, metalness: .1 });
    const lamp = material(null, 0xb7d6ce, { emissive: new THREE.Color(0xb7d6ce), emissiveIntensity: 2.2 });
    const redLamp = material(null, 0x9e2019, { emissive: new THREE.Color(0xc82919), emissiveIntensity: 1.9 });

    this.mesh(floor, 0, -.09, -4, 8, .18, 26);
    this.mesh(wall, 0, 3.85, -4, 8, .16, 26);
    for (const side of [-1, 1]) {
      this.mesh(wall, side * 3.5, 2.45, -4, .24, 2.8, 26);
      this.mesh(lowerWall, side * 3.48, .59, -4, .28, 1.18, 26);
      this.mesh(iron, side * 3.29, 1.2, -4, .1, .06, 26);
      this.mesh(iron, side * 3.3, .12, -4, .1, .18, 26);
    }
    // Repeated jambs and transoms give a long vanishing point and deep occlusion.
    for (let i = 0; i < 6; i++) {
      const z = 2.6 - i * 3.4;
      for (const side of [-1, 1]) {
        this.mesh(wall, side * 3.0, 1.87, z, .32, 3.74, .24);
        this.mesh(iron, side * 2.78, 1.7, z + .09, .075, 3.4, .065);
        this.mesh(recess, side * 3.33, 1.37, z - 1.1, .03, 2.65, 1.24);
        this.mesh(porcelain, side * 3.25, 2.87, z - .64, .03, .16, .26);
      }
      this.mesh(wall, 0, 3.59, z, 6.2, .38, .3);
      this.mesh(iron, 0, 3.34, z + .08, 5.62, .06, .06);
      this.mesh(iron, .4, 3.71, z - 1.1, 1.12, .08, .24);
      this.mesh(lamp, .4, 3.64, z - 1.1, .88, .025, .09);
    }
    this.mesh(recess, 0, 1.9, -16.1, 7, 4, .15);
    this.mesh(redLamp, 0, 2.8, -15.9, 1.15, .06, .06);
    // Broken rails and overhead services are the same industrial vocabulary as play.
    const cylinder = this.ownGeometry(new THREE.CylinderGeometry(.047, .047, 25, 8));
    for (const x of [-2.7, -2.48, 2.56]) {
      const pipe = new THREE.Mesh(cylinder, iron);
      pipe.position.set(x, 3.24, -4); pipe.rotation.x = Math.PI / 2; this.scene.add(pipe);
    }
    const chair = createAfterlifeWheelchair();
    chair.position.set(-1.9, 0, -1.15); chair.rotation.y = -.52;
    const cabinet = createAfterlifeMourningCabinet({ materials: { wood: materials.afterlifeWood } });
    cabinet.position.set(2.78, 0, -2.5); cabinet.rotation.y = -.38;
    this.props.push(chair, cabinet); this.scene.add(chair, cabinet);

    this.scene.add(new THREE.HemisphereLight(0x95b4b7, 0x11100c, .28));
    this.key = new THREE.SpotLight(0xc3dfdc, 24, 13, .68, .78, 1.7);
    this.key.position.set(-.4, 3.55, 4.3);
    this.key.target.position.set(1.45, 1.4, 1.2);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -.0005; this.key.shadow.normalBias = .02;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.PointLight(0x9e3030, 9, 10, 1.8);
    rim.position.set(2.5, 2.1, -.4); this.scene.add(rim);
    const far = new THREE.PointLight(0x7ba59f, 11, 14, 1.7);
    far.position.set(-.4, 2.95, -4.5); this.scene.add(far);
    const end = new THREE.PointLight(0xb52c20, 13, 11, 1.6);
    end.position.set(.5, 1.2, -12); this.scene.add(end);

    // Stable, sparse suspended dust; no flashing or rapidly pulsing lights.
    const positions = new Float32Array(110 * 3);
    for (let i = 0; i < 110; i++) {
      positions[i * 3] = Math.sin(i * 39.4) * 3;
      positions[i * 3 + 1] = ((i * 17.13) % 3.5) + .1;
      positions[i * 3 + 2] = 4 - (i * 7.37) % 20;
    }
    const particles = this.ownGeometry(new THREE.BufferGeometry());
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMaterial = new THREE.PointsMaterial({ color: 0x9cafad, size: .014, transparent: true, opacity: .28, depthWrite: false });
    this.ownedMaterials.add(dustMaterial);
    this.dust = new THREE.Points(particles, dustMaterial); this.scene.add(this.dust);
  }

  ownGeometry(geometry) { this.geometries.add(geometry); return geometry; }

  mesh(material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(this.box, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh);
    return mesh;
  }

  setPointer(x, y) { this.pointer.set(clamp(x, -1, 1), clamp(y, -1, 1)); }

  setAsset(asset) {
    if (!asset || this.actors.length) return;
    const placements = [[1.14, -.38, 2.65, 1.38], [.32, 0, -3.1, 1.09], [2.12, 0, -7.6, 1.15]];
    placements.forEach(([x, y, z, scale], index) => {
      const root = createAfterlifeModel(asset, 0, index);
      root.name = `MenuWitness${index + 1}`;
      root.position.set(x, y, z); root.scale.setScalar(scale);
      root.rotation.y = Math.PI + Math.atan2(-x, 5.8 - z);
      const state = root.userData.afterlife;
      state.materials.forEach(material => {
        material.color.multiplyScalar(index === 0 ? .94 : .76);
        material.emissiveIntensity = .025;
        material.roughness = .86;
        material.metalness = 0;
      });
      state.mixer?.setTime(0);
      const head = state.model.getObjectByName('Head');
      this.scene.add(root); this.scene.updateMatrixWorld(true);
      // Calibrate to the export's native facing axis, independently of bone axes.
      const worldQ = head.getWorldQuaternion(new THREE.Quaternion());
      const faceAxis = new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld).applyQuaternion(worldQ.clone().invert());
      const record = { root, head, state, faceAxis, rest: head.quaternion.clone(), gaze: head.quaternion.clone(), alignment: 1 };
      this.actors.push(record);
    });
    this.needsShadow = true;
  }

  update(now, width, height, reducedMotion = false) {
    const dt = this.lastNow === null ? 0 : clamp((now - this.lastNow) / 1000, 0, .05);
    this.lastNow = now;
    if (!reducedMotion) this.clock += dt;
    const t = reducedMotion ? 0 : this.clock;
    this.smoothedPointer.lerp(reducedMotion ? ZERO_POINTER : this.pointer, 1 - Math.exp(-dt * 2.6));
    for (const surface of this.surfaceSources) {
      for (const key of ['map', 'bumpMap']) {
        const texture = surface.source[key];
        if (!texture || surface.maps[key] === texture) continue;
        // Texture callbacks arrive after the scene exists. Copy the channel without
        // changing tiling or material settings in the playable world.
        surface.maps[key] = texture;
        const tiled = texture.clone(); tiled.needsUpdate = true;
        tiled.repeat.set(...surface.repeat);
        surface.material[key] = tiled; surface.material.bumpScale = .035;
        this.ownedTextures.add(tiled); surface.material.needsUpdate = true;
      }
    }
    const portrait = width / height < .9;
    this.camera.aspect = width / height;
    this.camera.fov = portrait ? 49 : 40;
    const px = reducedMotion ? 0 : this.smoothedPointer.x;
    const py = reducedMotion ? 0 : this.smoothedPointer.y;
    this.camera.position.set((portrait ? 1.11 : 0) + px * .065 + Math.sin(t * .13) * .04, 1.65 + py * .025 + Math.sin(t * .21) * .018, 5.8 + Math.sin(t * .11) * .08);
    this.camera.lookAt(portrait ? 1.05 : 0, portrait ? 1.38 : 1.58, -3);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.gazeTarget.copy(this.camera.position);
    this.gazeTarget.x += px * .32; this.gazeTarget.y += py * .21;
    this.actors.forEach((actor, index) => {
      const { root, head, state, faceAxis, rest, gaze } = actor;
      // Mix breathing first, then independently solve head orientation toward the viewer.
      state.mixer?.setTime(reducedMotion ? 0 : t * .57 + index * .83);
      head.quaternion.copy(rest); root.updateMatrixWorld(true);
      head.getWorldPosition(this.headPosition);
      head.getWorldQuaternion(this.worldQuaternion);
      this.forward.copy(faceAxis).applyQuaternion(this.worldQuaternion).normalize();
      this.direction.subVectors(this.gazeTarget, this.headPosition).normalize();
      this.deltaQuaternion.setFromUnitVectors(this.forward, this.direction);
      this.goalQuaternion.copy(this.deltaQuaternion).multiply(this.worldQuaternion);
      this.rollQuaternion.setFromAxisAngle(this.direction, index === 1 ? .22 : index === 2 ? -.18 : 0);
      this.goalQuaternion.premultiply(this.rollQuaternion);
      head.parent.getWorldQuaternion(this.parentQuaternion).invert();
      this.goalQuaternion.premultiply(this.parentQuaternion);
      gaze.slerp(this.goalQuaternion, reducedMotion || dt === 0 ? 1 : 1 - Math.exp(-dt * (3.4 - index * .5)));
      head.quaternion.copy(gaze); head.updateWorldMatrix(false, true);
      head.getWorldQuaternion(this.worldQuaternion);
      actor.alignment = this.forward.copy(faceAxis).applyQuaternion(this.worldQuaternion).dot(this.direction);
    });
    this.dust.position.y = Math.sin(t * .08) * .045;
  }

  render(renderer) {
    const exposure = renderer.toneMappingExposure;
    const shadowUpdate = renderer.shadowMap.needsUpdate;
    try {
      renderer.toneMappingExposure = .96;
      renderer.shadowMap.needsUpdate = this.needsShadow;
      renderer.render(this.scene, this.camera);
      this.needsShadow = false;
    } finally {
      renderer.toneMappingExposure = exposure;
      // Menu lights use their own shadow maps; preserve pending gameplay invalidation.
      renderer.shadowMap.needsUpdate = shadowUpdate;
    }
  }

  diagnostics(renderer) {
    return { active: this.active, ready: this.actors.length === 3, figures: this.actors.length,
      gazeAlignment: this.actors.map(actor => +actor.alignment.toFixed(4)),
      camera: this.camera.position.toArray(), time: this.clock,
      calls: renderer?.info.render.calls || 0, triangles: renderer?.info.render.triangles || 0 };
  }

  dispose() {
    for (const actor of this.actors) {
      disposeAfterlifeModel(actor.root);
      actor.state.materials.forEach(material => material.dispose());
      actor.state.warningRing.geometry.dispose(); actor.state.warningRing.material.dispose();
      actor.state.model.traverse(node => node.skeleton?.dispose());
    }
    this.props.forEach(disposeAfterlifeProp);
    this.geometries.forEach(geometry => geometry.dispose());
    this.ownedMaterials.forEach(material => material.dispose());
    this.ownedTextures.forEach(texture => texture.dispose());
    this.key.shadow.map?.dispose();
    this.scene.clear();
  }
}
