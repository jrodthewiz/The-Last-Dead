import * as THREE from './vendor/three.module.js';

// One colour script across the descent, with a restrained local accent per floor.
export function afterlifeTheme(theme = {}) {
  const surgical = theme.id === 'f2-graft-galleries';
  const bone = theme.family === 'ossuary';
  const ember = theme.family === 'choir';
  return {
    ...theme,
    background: 0x030506, fog: 0x0a1013, fogNear: 12, fogFar: ember ? 62 : 72,
    exposure: 1.06, key: surgical ? 0xabc5bc : 0xb0bdc4, rim: 0x6b3d39,
    wallSurface: bone ? 0x777670 : surgical ? 0x6c7974 : 0x656560,
    panelSurface: 0x343a3a, trimSurface: ember ? 0x65513f : 0x525450,
    floorSurface: 0x494e4e, floorAltSurface: 0x404546,
  };
}

/** Six recycled practicals and one lantern keep local light cost independent of map size. */
export class AfterlifeLighting {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'AfterlifeLocalLighting';
    this.pools = Array.from({ length: 6 }, (_, i) => {
      const light = new THREE.PointLight(0xa9bfc5, 0, 19, 2);
      light.name = `AfterlifePractical_${i}`;
      this.root.add(light);
      return light;
    });
    this.lantern = new THREE.SpotLight(0xc2cbd0, 105, 30, Math.PI * .27, .78, 2);
    this.lantern.name = 'AfterlifeLantern';
    this.lantern.castShadow = true;
    this.lantern.shadow.mapSize.set(512, 512);
    this.lantern.shadow.camera.near = .3;
    this.lantern.shadow.camera.far = 30;
    this.lantern.shadow.bias = -.00015;
    this.lantern.shadow.normalBias = .045;
    this.root.add(this.lantern, this.lantern.target);
    this.scene.add(this.root);
    this.position = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.candidates = [];
  }

  rebuild(world) {
    this.candidates.length = 0;
    this.nextPracticalSelection = 0;
    world.updateMatrixWorld(true);
    world.traverse(node => {
      if (!node.isPointLight || !Number.isFinite(node.userData.baseIntensity)) return;
      const position = node.getWorldPosition(new THREE.Vector3());
      const isZone = node.name.startsWith('AuthoredZoneLight_');
      const isEmber = /Maw|Gullet|Core|Ember/.test(node.name);
      const lowMounted = position.y < 1.2;
      const index = this.candidates.length;
      this.candidates.push({
        source: node, position, score: 0,
        // A few dim red rooms interrupt an otherwise cold, desaturated crypt.
        color: new THREE.Color(isEmber || lowMounted || (isZone && index % 4 === 3) ? 0xb64132 : 0xa4b8bf),
        intensity: lowMounted ? Math.min(5, Math.max(1, node.userData.baseIntensity * 3)) : isZone ? Math.min(46, Math.max(18, node.userData.baseIntensity * 12)) : Math.min(16, Math.max(3, node.userData.baseIntensity * 9)),
        distance: lowMounted ? 10 : isZone ? 21 : Math.min(15, node.distance || 12),
      });
      node.visible = false;
    });
  }

  update(camera, renderer, now, reducedMotion = false) {
    camera.getWorldPosition(this.position);
    camera.getWorldDirection(this.direction);
    this.lantern.position.copy(this.position);
    // Keep the cone's origin beyond the first-person mesh. Three.js light
    // layers filter by camera, so a layer alone cannot isolate the viewmodel.
    this.lantern.position.addScaledVector(this.direction, 1.4);
    this.lantern.position.y -= .12;
    this.lantern.target.position.copy(this.position).addScaledVector(this.direction, 16);
    this.lantern.intensity = reducedMotion ? 105 : 105 + Math.sin(now * .0011) * 2;
    // Only this shadow updates during play; the directional architecture map remains cached.
    if (renderer && (!this.lastShadow || now - this.lastShadow >= 45)) {
      this.lastShadow = now;
      this.lantern.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
    }
    this.lantern.shadow.autoUpdate = false;
    // Authored practicals are stationary. Re-rank five times a second;
    // lantern aiming and the six selected light envelopes still update each frame.
    if (now >= (this.nextPracticalSelection || 0)) {
      for (const cue of this.candidates) cue.score = cue.position.distanceToSquared(this.position);
      this.candidates.sort((a, b) => a.score - b.score);
      this.nextPracticalSelection = now + 200;
    }
    this.pools.forEach((light, i) => {
      const cue = this.candidates[i];
      if (!cue || cue.score > 48 * 48) { light.intensity = 0; return; }
      light.position.copy(cue.position);
      light.color.copy(cue.color);
      light.distance = cue.distance;
      const pulse = reducedMotion ? .94 : .94 + Math.sin(now * .0013 + i * 2.4) * .06;
      light.intensity = cue.intensity * pulse;
    });
  }

  diagnostics() { return { practicalPool: this.pools.length, authoredCues: this.candidates.length, lanternShadow: 512 }; }
  dispose() { this.root.removeFromParent(); this.lantern.shadow.dispose(); this.candidates.length = 0; }
}
