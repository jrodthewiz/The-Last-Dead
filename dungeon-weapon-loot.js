import * as THREE from './vendor/three.module.js';
import { createBreach } from './weapon-breach.js';
import { createArc } from './weapon-arc.js';
import { createReliquary } from './weapon-reliquary.js';
import { createRifle } from './weapon-rifles.js';
import { createMeleeWeapon } from './weapon-melee.js';
import { batchStaticWorld } from './world-polish.js';
import {BlackwaterPaintedMaterial} from './blackwater-render-looks.js';
import {lights} from './vendor/three.tsl.js';

// The floor pickup uses the equipped weapon's authored form, displayed on a
// salvage rack with a visible rarity marker above it and a ring at its feet.
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

const metal = () => new THREE.MeshStandardMaterial({ color: 0x444749, metalness: .66, roughness: .48 });
const recess = () => new THREE.MeshStandardMaterial({ color: 0x0d1113, metalness: .36, roughness: .82 });
const signal = color => new THREE.MeshStandardMaterial({
  color, metalness: .22, roughness: .38, emissive: color, emissiveIntensity: .8,
});

export function buildDungeonWeaponLoot(worldRoot, course, {lightSources=null}={}) {
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
    if(loot.displayKind==='stowed'){
      root.name=`StowedWeapon_${loot.id}`;
      root.position.y=loot.visualBaseY;
      root.rotation.y=loot.visualYaw||0;
      const carrier=new THREE.Group(),model=factory();
      if(lightSources){
        // World finds share the coast's light owners. Viewmodel keys must not
        // bleach an inspectable gun lying on its workshop or cottage deck.
        const materials=new Map();
        const painted=source=>{
          if(!source?.isMeshStandardMaterial)return source;
          if(!materials.has(source)){
            const material=new BlackwaterPaintedMaterial({color:source.color,map:source.map,emissive:source.emissive,emissiveIntensity:source.emissiveIntensity});
            material.lightsNode=lights(lightSources);material.name=source.name;materials.set(source,material);
          }
          return materials.get(source);
        };
        model.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(painted):painted(o.material);});
        for(const source of materials.keys())source.dispose();
      }
      model.rotation.set(0,Math.PI/2,Math.PI/2);
      batchStaticWorld(model);model.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
      const scale=1.75/Math.max(size.x,size.z,.1);
      const normalized=new THREE.Group();normalized.scale.setScalar(scale);
      const center=bounds.getCenter(new THREE.Vector3());
      normalized.position.set(-center.x*scale,-bounds.min.y*scale+.018,-center.z*scale);
      normalized.add(model);carrier.add(normalized);root.add(carrier);worldRoot.add(root);
      items.push({...loot,root,carrier,light:null});continue;
    }
    // Exterior finds stay human-sized; cathedral display racks keep their scale.
    if(course.harbor)root.scale.setScalar(.5);
    const dark = metal(), inner = recess(), bright = signal(color);
    const beaconMaterial = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.14, .055, 8, 40), beaconMaterial);
    halo.name = 'WeaponPickupHalo';
    halo.rotation.x = Math.PI / 2;
    halo.position.y = .075;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.27, 0), beaconMaterial);
    beacon.name = 'WeaponPickupBeacon';
    beacon.position.y = 3.65;
    root.add(halo, beacon);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.88, 1.02, .18, 8), dark);
    foot.name = 'SalvageRackBase';
    foot.position.y = .13;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(.76, .82, .045, 8), inner);
    bed.position.y = .245;
    root.add(foot, bed);
    // The broken perimeter reads as a manufactured base rather than a neon ring.
    const markerGeometry = new THREE.BoxGeometry(.25, .024, .035);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const marker = new THREE.Mesh(markerGeometry, bright);
        marker.position.set(side * .55, .28, end * .55);
        marker.rotation.y = side * end * Math.PI / 4;
        root.add(marker);
      }
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.13, .52, .22), dark);
      arm.position.set(side * .63, .53, 0);
      arm.rotation.z = -side * .12;
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(.23, .065, .38), inner);
      saddle.position.set(side * .67, .81, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(.2, .018, .035), bright);
      edge.position.set(side * .67, .85, .17);
      root.add(arm, saddle, edge);
    }

    const carrier = new THREE.Group();
    carrier.position.y = 1.46;
    const model = factory();
    if (loot.weaponIndex === 6) model.rotation.z = Math.PI / 2;
    // These display forms have no moving mechanisms. Bake their detailed
    // surfaces by shared material before the entire carrier animates.
    batchStaticWorld(model);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 3.5 / Math.max(size.x, size.y, size.z, .1);
    const normalized = new THREE.Group();
    normalized.scale.setScalar(scale);
    model.position.sub(center);
    normalized.add(model);
    carrier.add(normalized);
    root.add(carrier);

    const light = new THREE.PointLight(color, 2.55, 6, 2);
    light.position.copy(root.position).add(new THREE.Vector3(-.45, 2.25, .65));
    // Keep the light outside the display's visibility subtree. Removing a
    // visible light changes Three.js shader defines for every lit material;
    // collecting loot must only change its intensity, not the light count.
    worldRoot.add(root, light);
    items.push({ ...loot, root, carrier, light, halo, beacon });
  }
  return items;
}

export function updateDungeonWeaponLoot(items, collected, timeMs, reducedMotion = false, viewer = null) {
  // `collected` is the live progression array. Building a Set here used to
  // allocate on every render frame, even after all floor loot was collected.
  // The floor has only a handful of entries, so the allocation-free linear
  // membership check is cheaper and keeps pickup frames out of GC pauses.
  const found = collected || [];
  for (const item of items || []) {
    const visible = !found.includes(item.id);
    if (item.root.visible !== visible) item.root.visible = visible;
    if (!visible) {
      if (item.light&&item.light.intensity !== 0) item.light.intensity = 0;
      continue;
    }
    if(item.displayKind==='stowed')continue;
    const phase = timeMs * .001 + item.weaponIndex * .8;
    item.carrier.position.y = reducedMotion ? 1.46 : 1.46 + Math.sin(phase * 1.45) * .055;
    const dx = viewer ? viewer.x - item.root.position.x : 1;
    const dz = viewer ? viewer.z - item.root.position.z : 0;
    // Show the long side of the weapon from any approach; full spinning turns
    // rifles and launchers into an unreadable end-on silhouette.
    const facing = Math.atan2(dx, dz) + Math.PI / 2;
    item.carrier.rotation.y = facing + .24 + (reducedMotion ? 0 : Math.sin(phase * .72) * .07);
    item.carrier.rotation.z = -.08;
    item.beacon.position.y = reducedMotion ? 3.65 : 3.65 + Math.sin(phase * 1.8) * .12;
    item.beacon.rotation.y = reducedMotion ? Math.PI / 4 : phase * .8;
    item.halo.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(phase * 2) * .045);
    item.light.intensity = reducedMotion ? 2.05 : 2.05 + Math.sin(phase * 1.8) * .12;
  }
}
