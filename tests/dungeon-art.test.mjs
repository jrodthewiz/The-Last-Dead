import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeDungeonCourse } from '../playground/map/dungeon-course.js';
import { DUNGEON_ART_DIRECTIONS } from '../dungeon-art-direction.js';
import { buildAuthoredWorld } from '../world-authored.js';
import { batchStaticWorld } from '../world-polish.js';

const MATERIAL_SLOTS = [
  'black', 'metalDark', 'weaponDark', 'steel', 'metal', 'rust', 'red', 'enemyRed',
  'orange', 'gold', 'glass', 'cyan', 'gore', 'enemyArmor', 'bone', 'flesh', 'iron',
];

function makeMaterials() {
  return Object.fromEntries(MATERIAL_SLOTS.map(name => [
    name,
    name === 'glass'
      ? new THREE.MeshPhysicalMaterial({ color: 0x0a2430, roughness: .08, transmission: .14, transparent: true, opacity: .88 })
      : new THREE.MeshStandardMaterial(),
  ]));
}

test('each Story floor builds distinct named landmark models without changing its playable layout', () => {
  const architectureIds = new Set();
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor);
    const direction = DUNGEON_ART_DIRECTIONS[course.id];
    const layoutBefore = JSON.stringify({
      blocks: course.blocks,
      rooms: course.rooms,
      openings: course.openings,
      spawn: course.playerSpawn,
      exit: course.exit,
      keys: course.keys,
      waveSpawns: course.waveSpawns,
    });
    architectureIds.add(direction.architecture);

    const world = new THREE.Group();
    const materials = makeMaterials();
    const authored = buildAuthoredWorld(world, materials, {
      ...course,
      setpieces: [],
      machinery: [],
    });
    const models = world.children.filter(child => child.name.startsWith('StoryLandmark_'));
    const fixtures = world.children.filter(child => child.userData.storyLightFixture);

    assert.equal(models.length, course.landmarks.length, `${course.id}: every landmark uses a bespoke factory`);
    assert.ok(authored.hero?.name.startsWith('StoryLandmark_'), `${course.id}: the authored hero landmark is retained`);
    // Entry lamps are mounted in the tunnel rib on these floors; adding the
    // hanging fixture would leave an unsupported bowl above the spawn view.
    const fixtureCount = course.lights.filter(item => item.role !== 'entry' || direction.lightFixture === 'buried-ember').length;
    assert.equal(fixtures.length, fixtureCount, `${course.id}: practical lights use their floor-specific fixtures where mounted`);
    if (course.id === 'f5-last-descent') {
      const laneLights = world.children.filter(child => child.isLight && child.userData.storyLightPurpose);
      assert.equal(laneLights.length, 8, 'The Last Descent adds six edge fills and two threshold practicals');
      assert.equal(laneLights.filter(light => light.userData.storyLightPurpose === 'lane-fill').length, 6, 'F5 lane fills cover both edges of all three arenas');
      assert.equal(laneLights.filter(light => light.userData.storyLightPurpose === 'threshold-guidance').length, 2, 'F5 threshold guidance marks both throat entrances');
      assert.ok(laneLights.every(light => light.intensity <= .4 && light.distance <= 14), 'F5 supplemental lights stay low-power and local');
      assert.ok(laneLights.every(light => Math.abs(light.position.x - 56) >= 3), 'F5 supplemental lights stay off the center combat lane');
      const throat = world.getObjectByName('StoryLandmark_f5-mid-throat');
      assert.ok(throat, 'F5 adds a constructed mid-route throat where the thin hoop used to be');
      assert.equal(throat.position.x, 56, 'the new landmark stays centered on the first throat lane');
      assert.equal(throat.position.z, 64, 'the new landmark sits in the front half of the first tunnel span');
      assert.equal(throat.userData.massing.visualIdentity, 'black-gullet-throat-v1', 'the route landmark shares the Black Gullet structure language');
      assert.equal(throat.userData.massing.collisionOwner, 'f5-last-descent-course', 'the visual throat does not take collision ownership');
      assert.ok(throat.userData.massing.clearApertureWidth >= 4.3, 'the new threshold clears both room center and the spawn offset');
      const namedThroatParts = prefix => {
        const matches = [];
        throat.traverse(child => { if (child.isMesh && child.name.startsWith(prefix)) matches.push(child); });
        return matches;
      };
      assert.equal(namedThroatParts('MawVoussoir_').length, 18, 'the mid-route arch uses segmented basalt courses');
      const rootedMasses = namedThroatParts('MawRootedBasaltMass_');
      assert.equal(rootedMasses.length, 2, 'the new arch lands on two authored basalt feet');
      assert.ok(rootedMasses.every(mesh => mesh.material.name === 'Dungeon_f5-last-descent_MawBasaltEdge' && mesh.position.y < .4), 'the stone-edge value keeps the floor contacts legible');
      const rubbleSkirt = namedThroatParts('MawFootRubbleCluster_');
      assert.equal(rubbleSkirt.length, 7, 'the route landmark uses a stable uneven rubble skirt with one broken shoulder');
      for (const rock of rubbleSkirt) {
        rock.updateWorldMatrix(true, false);
        const bounds = new THREE.Box3().setFromObject(rock);
        assert.ok(bounds.max.x < -throat.userData.massing.apertureWidth * .5 || bounds.min.x > throat.userData.massing.apertureWidth * .5, `${rock.name}: rubble stays outside the clear walking lane`);
        assert.ok(bounds.min.y < .05 && bounds.max.y < 1.6, `${rock.name}: rubble stays grounded and below the sightline`);
      }
      assert.equal(namedThroatParts('MawBoneLoadRib_').length, 2, 'the mid-route arch repeats the paired load-bearing bone ribs');
      assert.equal(namedThroatParts('MawOpenWebBranch_').length, 5, 'the throat keeps a sparse open vascular web');
      assert.equal(namedThroatParts('MawVanishingThroatRing_').length, 1, 'the throat uses one restrained depth halo');
      const cueLights = namedThroatParts('MawShoulderCueEmitter_');
      const throatLights = [];
      throat.traverse(child => { if (child.isLight && child.name.startsWith('MawShoulderCueLight_')) throatLights.push(child); });
      assert.equal(cueLights.length, 2, 'paired emissive fixtures identify the outer shoulders');
      assert.equal(throatLights.length, 2, 'paired shoulder lights provide a local approach cue');
      assert.ok(throatLights.every(light => light.intensity <= .24 && light.distance <= 7.5), 'the approach cue stays short-ranged and restrained');
      assert.ok(throatLights.every(light => Math.abs(light.position.x) > throat.userData.massing.apertureWidth * .5), 'the shoulder lights stay outside the center lane');
      throat.updateWorldMatrix(true, true);
      const raycaster = new THREE.Raycaster();
      for (const y of [.45, .9, 1.6, 2.1]) {
        raycaster.set(new THREE.Vector3(course.playerSpawn.x * 4, y, throat.position.z - throat.userData.massing.depth - 1), new THREE.Vector3(0, 0, 1));
        assert.equal(raycaster.intersectObject(throat, true).length, 0, `the new throat clears the actual spawn center x=${course.playerSpawn.x * 4} at standing height y=${y}`);
      }
      const routeWorld = new THREE.Group();
      const routeMaterials = makeMaterials();
      buildAuthoredWorld(routeWorld, routeMaterials, course);
      routeWorld.updateWorldMatrix(true, true);
      const firstTunnel = routeWorld.getObjectByName('AuthoredSetpiece_f5-sp-throat1-tunnel');
      assert.ok(firstTunnel, 'the first route tunnel keeps its ribbed frame');
      const firstRib = firstTunnel.getObjectByName('TunnelRib_f5-sp-throat1-tunnel_0');
      assert.ok(firstRib, 'the first F5 tunnel rib is individually named for visual review');
      assert.equal(firstRib.material.name, 'F5GulletFrameBasalt', 'the F5 tunnel cadence uses a shared, subdued basalt material instead of disappearing into black or competing in red');
      assert.equal(firstRib.material.color.getHex(), 0x443b3c, 'the tunnel frame matches the Gullet basalt edge value');
      assert.equal(firstRib.material.userData.sharedLibrary, true, 'F5 tunnel ribs reuse one material for static batching');
      assert.equal(firstTunnel.getObjectByName('TunnelOverheadConduit_f5-sp-throat1-tunnel'), undefined, 'the entry view does not get a free-ended line across the Gullet silhouette');
      assert.ok(firstTunnel.getObjectByName('TunnelLamp_f5-sp-throat1-tunnel_0'), 'the tunnel keeps its supported local practical light');
    }
    const fixtureEmitters = [];
    for (const fixture of fixtures) {
      let fixtureMeshes = 0;
      fixture.traverse(child => { if (child.isMesh) fixtureMeshes++; });
      assert.ok(fixtureMeshes >= 3, `${fixture.name}: fixture should read as authored hardware, not a bare point light`);
      assert.equal(fixture.userData.storyLightFixture, direction.lightFixture);
      let emitter = null;
      fixture.traverse(child => {
        if (child.isMesh && child.material?.userData?.storyFixtureMaterial) emitter = child;
      });
      assert.ok(emitter, `${fixture.name}: its floor-specific glow must use a dedicated material`);
      assert.notEqual(emitter.material, materials.glass, `${fixture.name}: do not recolor the shared world glass`);
      assert.equal(emitter.material.userData.storyFixtureMaterial, direction.lightFixture);
      assert.ok(emitter.material.emissive?.getHex(), `${fixture.name}: the bulb needs visible emitted color`);
      assert.equal(emitter.material.transmission || 0, 0, `${fixture.name}: practical bulbs should not trigger a refraction pass`);
      assert.equal(emitter.material.transparent, false, `${fixture.name}: glowing lenses remain solid and legible`);
      assert.equal(emitter.castShadow, false, `${fixture.name}: tiny emissive lenses do not need shadow casters`);
      assert.equal(emitter.receiveShadow, false, `${fixture.name}: tiny emissive lenses do not need shadow receivers`);
      fixtureEmitters.push(emitter);
    }
    assert.equal(new Set(fixtureEmitters.map(emitter => emitter.material)).size, 1, `${course.id}: identical practical lights share one floor glow material`);
    for (const model of models) {
      let meshCount = 0;
      model.traverse(child => { if (child.isMesh) meshCount++; });
      assert.ok(meshCount >= 3, `${model.name}: expected a readable multi-part silhouette`);
      assert.equal(model.userData.floorId, course.id);
      assert.equal(model.userData.modelFamily, direction.architecture);
      assert.ok(model.userData.modelId.includes(direction.architecture));
      assert.ok(model.userData.massing?.style);
      assert.ok(['existing-authored-cover-cell', 'clearance-preserving-visual'].includes(model.userData.collisionSource));
      const item = course.landmarks.find(landmark => landmark.id === model.userData.landmarkId);
      if (/mouth|gullet/i.test(String(item?.type || ''))) {
        const massing = model.userData.massing;
        const room = course.rooms.find(entry => entry.id === item.roomId);
        assert.equal(massing.walkThrough, true, `${model.name}: mouth architecture keeps a clear passage`);
        assert.ok(massing.clearApertureWidth >= 2.8, `${model.name}: report the real nested-mesh aperture width`);
        assert.ok(massing.clearApertureHeight >= 2.5, `${model.name}: report the real nested-mesh aperture height`);
        model.updateMatrixWorld(true);
        const center = model.getWorldPosition(new THREE.Vector3());
        const laneX = room.center.x * 4;
        assert.ok(Math.abs(center.x - laneX) < .001, `${model.name}: the throat aligns to its authored play lane`);
        const raycaster = new THREE.Raycaster();
        for (const x of [-.35, 0, .35]) {
          for (const y of [.45, .9, 1.65, 2, 2.1]) {
            raycaster.set(new THREE.Vector3(laneX + x, y, center.z - massing.depth - 1), new THREE.Vector3(0, 0, 1));
            assert.equal(raycaster.intersectObject(model, true).length, 0, `${model.name}: actual meshes must leave the room-center play lane clear at x=${laneX + x}, y=${y}`);
          }
        }
        let membrane = null;
        model.traverse(child => { if (child.isMesh && child.name === 'MawOxbloodTearMembrane') membrane = child; });
        if (massing.style === 'load-bearing-black-gullet') {
          assert.ok(membrane, `${model.name}: Black Gullet carries its torn oxblood membrane silhouette`);
          membrane.updateWorldMatrix(true, false);
          const membraneBounds = new THREE.Box3().setFromObject(membrane);
          assert.ok(membraneBounds.min.x > center.x + massing.apertureWidth * .5, `${model.name}: membrane stays outside the walk-through aperture`);
        }
        if (massing.visualIdentity === 'black-gullet-v2') {
          const named = name => {
            const matches = [];
            model.traverse(child => { if (child.isMesh && child.name.startsWith(name)) matches.push(child); });
            return matches;
          };
          assert.equal(massing.collisionOwner, 'f5-last-descent-course', `${model.name}: visual geometry must not take collision ownership`);
          assert.ok(massing.width >= 9.4 && massing.clearApertureWidth >= 4.5, `${model.name}: the hero portal keeps the reference's broad silhouette and a generous walk opening`);
          assert.ok(massing.featureComponents.includes('recessed-throat-lining') && massing.featureComponents.includes('negative-pocket-depth'), `${model.name}: the hero metadata names its recessed throat treatment`);
          assert.equal(named('MawVoussoir_').length, 18, `${model.name}: the arch uses discrete stone courses rather than a single smooth loop`);
          assert.equal(named('MawBoneLoadRib_').length, 2, `${model.name}: the two bone ribs remain separate authored masses`);
          assert.equal(named('MawOpenWebBranch_').length, 5, `${model.name}: the inner web keeps a sparse open silhouette`);
          assert.equal(named('MawBronzeTie_').filter(mesh => mesh.name.includes('_Rivet_')).length, 8, `${model.name}: all square clamps carry visible fasteners`);
          assert.equal(named('MawVanishingThroatRing_').length, 1, `${model.name}: only one restrained depth halo remains`);
          const halo = named('MawVanishingThroatRing_')[0];
          const haloBounds = new THREE.Box3().setFromObject(halo);
          assert.ok(haloBounds.max.x - haloBounds.min.x < 1.8, `${model.name}: the ember halo stays subordinate to the stone arch`);
          assert.equal(membrane.material.transparent, false, `${model.name}: the side tear uses an opaque material`);
          assert.equal(membrane.material.opacity, 1, `${model.name}: alpha blending cannot wash out the throat`);
          const web = named('MawOpenWebBranch_');
          assert.ok(web.every(branch => new THREE.Box3().setFromObject(branch).min.y >= 2.35), `${model.name}: web branches remain above the 2.1-unit standing lane`);
          assert.ok(web.every(branch => new THREE.Box3().setFromObject(branch).max.z < center.z - 1), `${model.name}: the web sits behind the front arch instead of crowding the near view`);
          const vascular = named('MawThroatVascular_');
          assert.equal(vascular.length, 3, `${model.name}: recessed throat depth keeps three sparse vascular strands`);
          assert.ok(vascular.every(strand => new THREE.Box3().setFromObject(strand).min.y >= 2.45), `${model.name}: recessed vascular strands stay above the standing lane`);
          assert.ok(vascular.every(strand => new THREE.Box3().setFromObject(strand).max.z < center.z - .45), `${model.name}: recessed vascular strands sit behind the front arch`);
          const lining = named('MawThroatLining_');
          const farFolds = named('MawThroatFarFold_');
          const pockets = named('MawThroatNegativePocket_');
          const pocketRims = named('MawThroatNegativePocketRim_');
          const liningVeins = named('MawThroatLiningVein_');
          assert.equal(lining.length, 2, `${model.name}: the recessed throat gets one irregular lining fold per side`);
          assert.equal(farFolds.length, 2, `${model.name}: a second lining layer establishes depth falloff`);
          assert.equal(pockets.length, 4, `${model.name}: the lining keeps four broad negative pockets instead of a flat sheet`);
          assert.equal(pocketRims.length, 4, `${model.name}: each negative pocket gets a restrained inner-wall rim`);
          assert.equal(liningVeins.length, 4, `${model.name}: side-lined vascular branches complete the interior web`);
          assert.ok([...lining, ...farFolds, ...pockets].every(mesh => new THREE.Box3().setFromObject(mesh).min.y >= 2.34), `${model.name}: throat lining remains above the standing lane`);
          assert.ok(liningVeins.every(vein => new THREE.Box3().setFromObject(vein).min.y >= 2.38), `${model.name}: side-lined veins remain above the standing lane`);
          assert.ok(pocketRims.every(rim => new THREE.Box3().setFromObject(rim).min.y >= 2.34), `${model.name}: pocket rims remain above the standing lane`);
          assert.ok(pockets.every(pocket => {
            const bounds = new THREE.Box3().setFromObject(pocket);
            return bounds.max.z - bounds.min.z >= .05;
          }), `${model.name}: negative pockets have a shallow beveled depth instead of floating planes`);
          assert.equal(model.userData.throatDepth?.negativePockets, 4, `${model.name}: throat depth reports its authored negative space`);
          const emberLight = model.getObjectByName('MawEmberLight_f5-last-altar');
          const throatBounce = model.getObjectByName('MawThroatBounce_f5-last-altar');
          const deepEmber = model.getObjectByName('MawDeepEmber');
          const emberCore = model.getObjectByName('MawEmberCore');
          const emberHalo = model.getObjectByName('MawEmberCoreHalo_f5-last-altar');
          assert.ok(emberLight, `${model.name}: the recessed ember keeps a hero light`);
          assert.ok(throatBounce, `${model.name}: the recessed ember gets a localized interior bounce`);
          assert.ok(deepEmber?.geometry?.parameters?.radius >= .12, `${model.name}: the deep ember keeps a readable focal core`);
          assert.ok(deepEmber.material.emissiveIntensity >= 1.7, `${model.name}: the deep ember emits enough signal to survive the black recess`);
          assert.ok(emberCore?.geometry?.parameters?.radius >= .085, `${model.name}: the altar adds a small mid-depth ember cue`);
          assert.ok(emberCore.material === deepEmber.material, `${model.name}: the mid-depth cue shares the authored ember value`);
          assert.ok(emberCore.position.y > 2.1 && emberCore.position.y < deepEmber.position.y - .6 && emberCore.position.z < 0, `${model.name}: the visible ember cue sits inside the open throat above the lane`);
          assert.ok(emberHalo?.intensity >= .16 && emberHalo.distance <= 3.2, `${model.name}: the visible ember gets only a short local halo`);
          assert.ok(emberLight.intensity >= .48 && emberLight.distance <= 5.6, `${model.name}: the hero ember reveals the altar without becoming a room sun`);
          assert.ok(throatBounce.intensity >= .22 && throatBounce.distance <= 5.2, `${model.name}: the warm throat bounce lifts the web at short range`);
          assert.ok(Math.abs(throatBounce.position.x) < .2 && throatBounce.position.z < 0, `${model.name}: the throat bounce stays recessed behind the aperture`);
          const basalt = named('MawVoussoir_').find(mesh => mesh.material.map).material;
          const bone = named('MawBoneLoadRib_')[0].material;
          const liningMaterial = model.getObjectByName('MawThroatLining_-1').material;
          assert.equal(liningMaterial.name, 'Dungeon_f5-last-descent_MawLining', `${model.name}: recessed side lining uses its own value-separated material`);
          for (const [label, material] of [['basalt', basalt], ['bone', bone], ['bronze', model.getObjectByName('MawBronzeTie_-1_0_Rail_0').material], ['oxblood', membrane.material], ['lining', liningMaterial]]) {
            for (const slot of ['map', 'normalMap', 'roughnessMap']) {
              const texture = material[slot];
              assert.ok(texture, `${model.name}: ${label} receives the authored tileable ${slot}`);
              assert.equal(texture.image.width, 128, `${model.name}: ${label} relief remains a compact procedural texture`);
              assert.equal(texture.wrapS, THREE.RepeatWrapping, `${model.name}: ${label} ${slot} wraps seamlessly`);
              assert.equal(texture.userData.authoredSurface, 'black-gullet-periodic-relief-v1');
              assert.ok(texture.repeat.x > 1, `${model.name}: ${label} uses repeated authored surface detail`);
            }
          }
          assert.equal(basalt.map.colorSpace, THREE.SRGBColorSpace, `${model.name}: albedo uses the correct color space`);
          assert.equal(basalt.normalMap.colorSpace, THREE.NoColorSpace, `${model.name}: normal data stays linear`);
          const crackedShoulder = model.getObjectByName('MawVoussoir_1_8');
          const soundShoulder = model.getObjectByName('MawVoussoir_-1_8');
          assert.ok(crackedShoulder.position.y < soundShoulder.position.y - .1, `${model.name}: one arch shoulder visibly sags instead of mirroring the other`);
          assert.ok(model.getObjectByName('MawCrownKeystone').position.x > 0, `${model.name}: the crown key is offset from the centerline`);
          const plate = model.getObjectByName('MawBronzeTie_-1_1_Rail_0');
          const cable = model.getObjectByName('MawTendonAnchor_-1');
          assert.ok(new THREE.Box3().setFromObject(plate).intersectsBox(new THREE.Box3().setFromObject(cable)), `${model.name}: the tendon starts inside its bronze clamp instead of floating nearby`);
          let triangleCount = 0;
          model.traverse(child => {
            if (!child.isMesh) return;
            triangleCount += (child.geometry.index?.count || child.geometry.attributes.position.count) / 3;
          });
          assert.ok(triangleCount < 28000, `${model.name}: the authored landmark remains inside its triangle budget`);
        }
      }
    }
    if (course.id === 'f2-graft-galleries') {
      const theatre = models.find(model => model.userData.landmarkId === 'f2-theater-table');
      assert.ok(theatre, 'Graft Galleries keeps its operating theatre as the focal landmark');
      const theatreLight = world.getObjectByName('AuthoredZoneLight_theater');
      assert.ok(theatreLight, 'the operating theatre keeps its authored key light');
      assert.ok(theatreLight.intensity >= 5.3 && theatreLight.distance >= 34, 'theatre lighting reaches the table and gantry at approach distance');
      const rigMeshes = [];
      const gantryMeshes = [];
      theatre.traverse(child => { if (child.isMesh && child.name.startsWith('GraftManipulator')) rigMeshes.push(child); });
      theatre.traverse(child => { if (child.isMesh && child.name.startsWith('GraftExtraction')) gantryMeshes.push(child); });
      assert.ok(rigMeshes.some(mesh => mesh.name.includes('UpperArm')) && rigMeshes.some(mesh => mesh.name.includes('Needle')), 'the theatre includes articulated extraction tools, not a bare table and lamp');
      assert.ok(rigMeshes.some(mesh => mesh.name.includes('Umbilical')), 'the extraction arms remain physically connected to the ceiling gantry');
      assert.ok(rigMeshes.every(mesh => !mesh.castShadow && !mesh.receiveShadow), 'small extraction hardware stays out of the shadow workload');
      assert.ok(gantryMeshes.some(mesh => mesh.name.includes('Rail')) && gantryMeshes.some(mesh => mesh.name.includes('Crossbar')), 'the articulated tools hang from a complete overhead rail frame');
      assert.ok(gantryMeshes.every(mesh => !mesh.castShadow && !mesh.receiveShadow), 'overhead gantry hardware stays out of the shadow workload');
    }
    const batch = batchStaticWorld(world, authored.moving);
    assert.ok(batch.batches > 0, `${course.id}: static landmark meshes should collapse into material batches`);
    assert.ok(batch.removed > 0, `${course.id}: static landmark source meshes should be retired after batching`);
    assert.ok(world.getObjectByName(`WorldBatch_StoryFixtureGlow_${direction.lightFixture}`), `${course.id}: fixture lenses merge into one static batch`);
    assert.equal(JSON.stringify({
      blocks: course.blocks,
      rooms: course.rooms,
      openings: course.openings,
      spawn: course.playerSpawn,
      exit: course.exit,
      keys: course.keys,
      waveSpawns: course.waveSpawns,
    }), layoutBefore, `${course.id}: art generation leaves the course topology untouched`);
  }
  assert.equal(architectureIds.size, 5, 'each floor has its own architectural identity');
});

test('F5 throat tunnels align to the player lane and keep their jambs clear at standing height', () => {
  const course = makeDungeonCourse(4);
  const world = new THREE.Group();
  buildAuthoredWorld(world, makeMaterials(), course);
  world.updateMatrixWorld(true);

  const laneX = course.rooms.find(room => room.id === 'f5-hall3').center.x * 4;
  const raycaster = new THREE.Raycaster();
  const throats = [
    { id: 'f5-sp-throat1-tunnel', archZ: [72, 52] },
    { id: 'f5-sp-throat2-tunnel', archZ: [48, 28] },
    { id: 'f5-sp-throat3-tunnel', archZ: [28, 12] },
  ];
  for (const { id, archZ } of throats) {
    const tunnel = world.getObjectByName(`AuthoredSetpiece_${id}`);
    assert.ok(tunnel, `the last descent keeps authored tunnel ${id}`);
    for (const z of archZ) {
      for (const offset of [-.35, 0, .35]) {
        raycaster.set(new THREE.Vector3(laneX + offset, 1.6, z + 1), new THREE.Vector3(0, 0, -1));
        assert.equal(
          raycaster.intersectObject(tunnel, true).length,
          0,
          `the F5 player lane stays clear at eye height and lateral offset ${offset} through ${id} at z=${z}`,
        );
      }
    }
  }
});

test('F5 last bulkhead frames the room-clear doorway without leaving a second closed visual panel', () => {
  const course = makeDungeonCourse(4);
  const world = new THREE.Group();
  buildAuthoredWorld(world, makeMaterials(), course);
  world.updateMatrixWorld(true);

  const bulkhead = world.getObjectByName('AuthoredSetpiece_f5-sp-last-bulkhead');
  assert.ok(bulkhead, 'the final threshold keeps its authored bulkhead surround');
  const laneX = course.rooms.find(room => room.id === 'f5-hall3').center.x * 4;
  const raycaster = new THREE.Raycaster();
  for (const y of [.9, 1.6, 2.1]) {
    for (const offset of [-.35, 0, .35]) {
      raycaster.set(new THREE.Vector3(laneX + offset, y, 30), new THREE.Vector3(0, 0, -1));
      assert.equal(
        raycaster.intersectObject(bulkhead, true).length,
        0,
        `the room-clear gate's authored surround leaves the live route open at eye height y=${y}, x offset=${offset}`,
      );
    }
  }
});

test('Story setpiece glass preserves its tint without enabling physical refraction', () => {
  for (let floor = 0; floor < 5; floor++) {
    const course = makeDungeonCourse(floor);
    const materials = makeMaterials();
    const world = new THREE.Group();
    buildAuthoredWorld(world, materials, course);
    const refractiveMeshes = [];
    world.traverse(node => {
      if (!node.isMesh) return;
      const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
      if (nodeMaterials.some(material => material?.transmission > 0)) refractiveMeshes.push(node.name || node.type);
    });
    assert.deepEqual(refractiveMeshes, [], `${course.id}: authored glass should not keep the full-scene refraction pass active`);
    assert.equal(materials.glass.transmission, .14, `${course.id}: source world glass remains unchanged`);
  }
});

test('static Story setpieces batch by material while the pressure iris stays one live assembly', () => {
  const course = makeDungeonCourse(0);
  const world = new THREE.Group();
  const authored = buildAuthoredWorld(world, makeMaterials(), {
    ...course,
    landmarks: [],
    machinery: [],
    lights: [],
  });
  const pressureDoor = world.getObjectByName('AuthoredSetpiece_f1-sp-vault-pressure');
  const irisPivot = pressureDoor?.getObjectByName('IrisPetalPivot');
  assert.ok(pressureDoor, 'the first floor includes the authored containment iris');
  assert.ok(irisPivot, 'the petal linkage remains a dedicated moving node');
  const refractiveMeshes = [];
  world.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some(material => material?.transmission > 0)) refractiveMeshes.push(node.name || node.type);
  });
  assert.deepEqual(refractiveMeshes, [], 'Story glass keeps its authored tint and sheen without activating a full-scene transmission pass');
  assert.deepEqual(
    authored.moving.filter(node => node === irisPivot || irisPivot.children.includes(node)).map(node => node.name),
    ['IrisPetalPivot'],
    'the iris moves as one assembly instead of scaling every plate and hinge separately',
  );

  let meshCountBefore = 0;
  world.traverse(node => { if (node.isMesh) meshCountBefore += 1; });
  const batch = batchStaticWorld(world, authored.moving);
  assert.ok(batch.removed > meshCountBefore / 2, 'most setpiece hardware should merge into static material batches');
  assert.ok(batch.batches >= 5, 'distinct industrial materials retain separate batches');
  assert.equal(irisPivot.parent, pressureDoor, 'the live iris remains attached to its authored doorway');
  assert.equal(irisPivot.children.filter(node => node.isMesh).length, 24, 'all eight petals keep their hinge and socket detail');
});
