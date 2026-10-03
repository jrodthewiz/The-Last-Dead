import * as THREE from './vendor/three.module.js';

// Reserve two of the existing slots for architectural light farther into the
// visible corridor. Pure nearest-six selection strands approaching actors in
// darkness while lighting side rooms behind the player.
export function selectPracticalCues(candidates, position, direction) {
  const usable = candidates.filter(cue => Number.isFinite(cue.score) && cue.distanceSquared <= 48 * 48);
  const forward = usable.filter(cue => {
    if (!cue.isZone || cue.distanceSquared < 12 * 12) return false;
    const dx = cue.position.x - position.x, dy = cue.position.y - position.y, dz = cue.position.z - position.z;
    const ahead = dx * direction.x + dy * direction.y + dz * direction.z;
    return ahead > 0 && ahead * ahead > cue.distanceSquared * .55;
  }).sort((a, b) => a.distanceSquared - b.distanceSquared).slice(0, 2);
  const near = usable.filter(cue => !forward.includes(cue)).slice(0, 6 - forward.length);
  return [...near, ...forward];
}

// One colour script across the descent, with a restrained local accent per floor.
export function afterlifeTheme(theme = {}) {
  const surgical = theme.id === 'f2-graft-galleries';
  const bone = theme.family === 'ossuary';
  const ember = theme.family === 'choir';
  const surfaces = {
    'f1-intake-foundry': { wall: 0x796c62, panel: 0x453d38, trim: 0x755247, floor: 0x4b443c, alt: 0x3e3933, fog: 0x15100d },
    'f2-graft-galleries': { wall: 0x7b8a82, panel: 0x43534d, trim: 0x6b5552, floor: 0x4b5751, alt: 0x3e4c47, fog: 0x0d1716 },
    'f3-catacombs': { wall: 0x777179, panel: 0x46414b, trim: 0x716768, floor: 0x4b4850, alt: 0x3e3b44, fog: 0x111018 },
    'f4-resonance': { wall: 0x817160, panel: 0x504039, trim: 0x80634e, floor: 0x4e4239, alt: 0x40362f, fog: 0x17100c },
    'f5-last-descent': { wall: 0x65595b, panel: 0x403338, trim: 0x6d4846, floor: 0x3e3639, alt: 0x352e32, fog: 0x130c10 },
  }[theme.id];
  return {
    ...theme,
    background: 0x030506, fog: surfaces?.fog ?? 0x0a1013, fogNear: 12, fogFar: ember ? 62 : 72,
    exposure: surfaces && theme.id !== 'f5-last-descent' ? 1.13 : 1.06,
    key: !surfaces ? 0xb0bdc4 : theme.id === 'f1-intake-foundry' ? 0xa9bcc2 : surgical ? 0xabc5bc : bone ? 0xb1b1c4 : ember ? 0xb8b5af : 0xb0bdc4,
    rim: surfaces && ember ? 0x805542 : 0x6b3d39,
    wallSurface: surfaces?.wall ?? (bone ? 0x777670 : surgical ? 0x6c7974 : 0x656560),
    panelSurface: surfaces?.panel ?? 0x343a3a,
    trimSurface: surfaces?.trim ?? (ember ? 0x65513f : 0x525450),
    floorSurface: surfaces?.floor ?? 0x494e4e,
    floorAltSurface: surfaces?.alt ?? 0x404546,
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
    this.lantern = new THREE.SpotLight(0xb7cbd1, 48, 32, Math.PI * .29, .9, 2);
    this.lantern.name = 'AfterlifeLantern';
    this.lantern.castShadow = true;
    this.lantern.shadow.mapSize.set(512, 512);
    this.lantern.shadow.camera.near = .3;
    this.lantern.shadow.camera.far = 34;
    this.lantern.shadow.bias = -.00015;
    this.lantern.shadow.normalBias = .045;
    this.root.add(this.lantern, this.lantern.target);
    this.scene.add(this.root);
    this.position = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.shadowPosition = new THREE.Vector3();
    this.shadowDirection = new THREE.Vector3();
    this.shadowInvalidated = true;
    this.shadowUpdates = 0;
    this.candidates = [];
  }

  rebuild(world, story = false) {
    this.candidates.length = 0;
    this.nextPracticalSelection = 0;
    this.shadowInvalidated = true;
    world.updateMatrixWorld(true);
    world.traverse(node => {
      if (!node.isPointLight || !Number.isFinite(node.userData.baseIntensity)) return;
      const position = node.getWorldPosition(new THREE.Vector3());
      const isZone = node.name.startsWith('AuthoredZoneLight_');
      const isEmber = /Maw|Gullet|Core|Ember/.test(node.name);
      const destination = node.userData.destinationCue === true;
      const lowMounted = position.y < 1.2;
      const index = this.candidates.length;
      this.candidates.push({
        source: node, position, score: 0, isZone,
        // A few dim red rooms interrupt an otherwise cold, desaturated crypt.
        color: destination ? node.color.clone() : isEmber || lowMounted || (!story && isZone && index % 4 === 3)
          ? new THREE.Color(0xb64132)
          : story && isZone ? node.color.clone().lerp(new THREE.Color(0x9bb9c7), .1)
            : new THREE.Color(0xe7b780),
        intensity: destination ? node.userData.practicalIntensity ?? 30 : lowMounted ? Math.min(5, Math.max(1, node.userData.baseIntensity * 3)) : isZone ? Math.min(64, Math.max(28, node.userData.baseIntensity * 18)) : Math.min(24, Math.max(8, node.userData.baseIntensity * 15)),
        distance: destination ? 13 : lowMounted ? 10 : isZone ? 28 : Math.min(15, node.distance || 12),
        destination, phase: Number(node.userData.phase) || index * 2.4,
      });
      node.visible = false;
    });
    // A daylight course has no authored practical cues. Keep its zero-output
    // pool out of the shader layout for the entire course; do not toggle lights
    // as the player moves, which would compile variants during play.
    for(const light of this.pools)light.visible=this.candidates.length>0;
  }

  update(camera, renderer, now, reducedMotion = false) {
    camera.getWorldPosition(this.position);
    camera.getWorldDirection(this.direction);
    this.lantern.position.copy(this.position);
    // Camera-adjacent body lamp: a 1.4 m forward origin entered close walls
    // and produced an inverse-square white hotspot on nearby cover.
    this.lantern.position.addScaledVector(this.direction, .25);
    this.lantern.position.y += .08;
    this.lantern.target.position.copy(this.position).addScaledVector(this.direction, 16);
    this.lantern.intensity = reducedMotion ? 48 : 48 + Math.sin(now * .0011);
    // All animated world/actor casters are disabled by the renderer. This depth
    // map changes only with the lamp pose or an explicit world invalidation.
    // Ignore tiny idle sway; intensity flicker needs no new depth map.
    const moved = this.shadowPosition.distanceToSquared(this.lantern.position) > .0004 ||
      this.shadowDirection.distanceToSquared(this.direction) > .000004;
    const invalidated = this.shadowInvalidated || renderer?.shadowMap.needsUpdate;
    if (renderer && (invalidated || (moved && now - (this.lastShadow ?? -Infinity) >= 45))) {
      this.lastShadow = now;
      this.shadowPosition.copy(this.lantern.position);
      this.shadowDirection.copy(this.direction);
      this.shadowInvalidated = false;
      this.shadowUpdates++;
      this.lantern.shadow.needsUpdate = true;
      // Native WebGPU consumes each light's flag, not the legacy global one.
      // Re-raising that global flag here would invalidate every shadow forever.
      if(!renderer.isWebGPURenderer)renderer.shadowMap.needsUpdate = true;
    }
    this.lantern.shadow.autoUpdate = false;
    // Authored practicals are stationary. Re-rank five times a second;
    // lantern aiming and the six selected light envelopes still update each frame.
    if (now >= (this.nextPracticalSelection || 0)) {
      for (const cue of this.candidates) {
        if (cue.source.userData.dynamicCue) cue.source.getWorldPosition(cue.position);
        cue.distanceSquared = cue.position.distanceToSquared(this.position);
        // A nearby destination competes for one of the same six practicals;
        // weighting never makes a distant lamp illuminate through the map.
        cue.score = cue.source.userData.guidanceGain === 0 ? Infinity : cue.distanceSquared * (cue.source.userData.guidancePriority || 1);
      }
      this.candidates.sort((a, b) => a.score - b.score);
      this.selected = selectPracticalCues(this.candidates, this.position, this.direction);
      this.nextPracticalSelection = now + 200;
    }
    this.pools.forEach((light, i) => {
      const cue = this.selected?.[i];
      if (!cue || !Number.isFinite(cue.score) || cue.distanceSquared > 48 * 48) { light.intensity = 0; return; }
      light.position.copy(cue.position);
      light.color.copy(cue.destination ? cue.source.color : cue.color);
      light.distance = cue.distance;
      const pulse = reducedMotion || cue.destination ? 1 : .97 + Math.sin(now * .0013 + cue.phase) * .03;
      light.intensity = cue.intensity * pulse * (cue.destination ? cue.source.userData.guidanceGain ?? .28 : 1);
    });
  }

  diagnostics() { return { practicalPool: this.pools.length, authoredCues: this.candidates.length, destinationCues: this.candidates.filter(cue => cue.destination).length, lanternShadow: 512, shadowUpdates: this.shadowUpdates }; }
  dispose() { this.root.removeFromParent(); this.lantern.shadow.dispose(); this.candidates.length = 0; }
}
