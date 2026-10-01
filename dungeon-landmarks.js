import * as THREE from './vendor/three.module.js';

// Direct the existing authored machinery instead of putting another obstacle
// in its room. Only an already-moving face gets a state material; all structural
// parts remain eligible for the existing static world batches.
export function directDungeonLandmarks(world, course) {
  const records = [], owned = [];
  if (!course?.dungeon) return { update() {}, dispose() {}, diagnostics: { landmarks: 0, addedDraws: 0 } };
  for (const item of course.landmarks || []) {
    const rig = world.getObjectByName(`StoryLandmark_${item.id}`);
    if (!rig) continue;
    const surfaces = [];
    rig.traverse(node => {
      if (!node.isMesh || Array.isArray(node.material)) return;
      const name = `${node.name} ${node.material.name}`;
      // A ceramic fitting and a steel frame should not share wall-grey albedo.
      if (/Bone|Porcelain|Enamel/i.test(name)) node.userData.afterlifeSurfaceRole = 'roomBone';
      else if (/Rail|Frame|Upright|Piston|Ram|Collar|Band|Cage|Gantry|Foot/i.test(name)) node.userData.afterlifeSurfaceRole = 'roomMetal';
      else if (/Bronze|Copper|Ratchet|Valve/i.test(name)) node.userData.afterlifeSurfaceRole = 'roomRust';
      if (surfaces.length < 2 && node.userData.noBatch && /Core|Membrane|Pilot|Furnace|Gauge|Bell|Iris/i.test(node.name)) {
        const material = node.material.clone();
        material.userData = { ...material.userData, afterlifeLandmarkState: true };
        material.userData.landmarkLargeFace = /Membrane|Iris/i.test(node.name);
        delete material.userData.sharedLibrary;
        node.material = material; node.userData.afterlifeSkip = true;
        for (const key of ['map', 'normalMap', 'roughnessMap']) if (material[key]) material[key].userData.sharedAsset = true;
        owned.push(material); surfaces.push(material);
      }
    });
    const light = new THREE.PointLight(0x77a9b6, 2, 15, 2);
    light.name = `LandmarkPractical_${item.id}`;
    light.position.set(2.4, 4.8, 4.5);
    light.userData = { baseIntensity: 2, practicalIntensity: 12, destinationCue: true, guidanceGain: .6, roomId: item.roomId };
    rig.add(light);
    records.push({ id: item.id, roomId: item.roomId, surfaces, light });
  }
  let last = '';
  const update = (run = {}) => {
    const p = run.dungeonProgression || {}, cleared = p.roomsCompleted || [];
    const state = `${p.currentEncounterRoomId}|${cleared.join(',')}`;
    if (state === last) return;
    last = state;
    for (const r of records) {
      const done = cleared.includes(r.roomId), active = p.currentEncounterRoomId === r.roomId;
      const color = done ? 0xf2b367 : active ? 0xd35b32 : 0x557d89;
      for (const m of r.surfaces) {
        m.color.setHex(done ? 0x87755a : active ? 0x754332 : 0x344d52);
        m.emissive?.setHex(color);
        m.emissiveIntensity = (done ? .35 : active ? .22 : .035) * (m.userData.landmarkLargeFace ? .16 : 1);
        m.roughness = .68;
      }
      r.light.color.setHex(color); r.light.userData.guidanceGain = done ? 1.05 : active ? .85 : .45;
      r.light.userData.landmarkState = done ? 'restored' : active ? 'pressure' : 'dormant';
    }
  };
  update();
  return { update, diagnostics: { landmarks: records.length, stateSurfaces: owned.length, addedDraws: 0, addedActiveLights: 0 }, dispose() {
    for (const r of records) r.light.removeFromParent();
    // Material clones now belong to the world and its normal disposal walk.
  } };
}
