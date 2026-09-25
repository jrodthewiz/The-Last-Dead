import * as THREE from './vendor/three.module.js';
import { createBreach } from './weapon-breach.js';
import { createArc } from './weapon-arc.js';
import { createReliquary } from './weapon-reliquary.js';
import { createRifle } from './weapon-rifles.js';
import { createMeleeWeapon } from './weapon-melee.js';
import { batchStaticWorld } from './world-polish.js';

// The floor pickup uses the same authored form as the equipped weapon. The
// cradle and restrained beacon identify a find through a dark room without
// turning the weapon itself into an unrecognizable glowing primitive.
const COLORS = Object.freeze({ uncommon: 0x81d9ac, rare: 0x72baff, epic: 0xbd8dff, legendary: 0xffcf74 });
const FACTORIES = Object.freeze({
  1: () => createBreach(),
  2: () => createArc(),
  3: () => createReliquary({ variant: 'bone-rocket' }),
  4: () => createRifle({ variant: 'carrion' }),
  5: () => createRifle({ variant: 'mourning' }),
  6: () => createMeleeWeapon({ variant: 'bat' }),
  7: () => createMeleeWeapon({ variant: 'chainsaw' }),
});

const metal = () => new THREE.MeshStandardMaterial({ color: 0x242b30, metalness: .75, roughness: .36 });
const signal = color => new THREE.MeshStandardMaterial({
  color, metalness: .3, roughness: .28, emissive: color, emissiveIntensity: .85,
});

export function buildDungeonWeaponLoot(worldRoot, course) {
  if (!course?.dungeon) return [];
  const items = [];
  for (const loot of course.loot || []) {
    const factory = FACTORIES[loot.weaponIndex];
    if (!factory) continue;
    const color = COLORS[loot.rarity] || COLORS.rare;
    const root = new THREE.Group();
    root.name = `StoryWeaponFind_${loot.id}`;
    root.userData.noBatch = true;
    root.position.set(loot.x * 4, 0, loot.y * 4);
    const dark = metal(), bright = signal(color);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.02, .13, 12), dark);
    foot.position.y = .11;
    const inset = new THREE.Mesh(new THREE.TorusGeometry(.73, .052, 6, 24), bright);
    inset.rotation.x = Math.PI / 2;
    inset.position.y = .205;
    root.add(foot, inset);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.12, .43, .16), dark);
      arm.position.set(side * .65, .39, 0);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(.18, .055, .22), bright);
      tip.position.set(side * .65, .64, 0);
      root.add(arm, tip);
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(.42, .8, 3.6, 14, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 2.05;
    root.add(beam);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(.47, .04, 6, 24), bright);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 3.77;
    root.add(crown);

    const carrier = new THREE.Group();
    carrier.position.y = 1.57;
    const model = factory();
    if (loot.weaponIndex === 6) model.rotation.z = Math.PI / 2;
    // These display forms have no moving mechanisms. Bake their detailed
    // surfaces by shared material before the entire carrier animates.
    batchStaticWorld(model);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2.35 / Math.max(size.x, size.y, size.z, .1);
    const normalized = new THREE.Group();
    normalized.scale.setScalar(scale);
    model.position.sub(center);
    normalized.add(model);
    carrier.add(normalized);
    root.add(carrier);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, .028, 5, 32), bright);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.5;
    root.add(halo);
    const glints = new THREE.Group();
    const glintShape = new THREE.OctahedronGeometry(.075, 0);
    for (let index = 0; index < 4; index++) {
      const shard = new THREE.Mesh(glintShape, bright);
      const angle = index * Math.PI / 2;
      shard.position.set(Math.cos(angle) * 1.05, 1.45 + (index % 2) * .48, Math.sin(angle) * 1.05);
      glints.add(shard);
    }
    root.add(glints);
    const light = new THREE.PointLight(color, .95, 8, 2);
    light.position.y = 1.7;
    root.add(light);
    worldRoot.add(root);
    items.push({ ...loot, root, carrier, halo, beam, glints, light });
  }
  return items;
}

export function updateDungeonWeaponLoot(items, collected, timeMs, reducedMotion = false) {
  const found = new Set(collected || []);
  for (const item of items || []) {
    item.root.visible = !found.has(item.id);
    if (!item.root.visible) continue;
    const phase = timeMs * .001 + item.weaponIndex * .8;
    item.carrier.position.y = reducedMotion ? 1.57 : 1.57 + Math.sin(phase * 1.7) * .13;
    item.carrier.rotation.y = reducedMotion ? .42 : phase * .42;
    item.halo.rotation.z = reducedMotion ? 0 : phase * .25;
    item.glints.rotation.y = reducedMotion ? 0 : -phase * .36;
    item.light.intensity = reducedMotion ? .8 : .8 + Math.sin(phase * 2.3) * .18;
  }
}
