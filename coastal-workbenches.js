import {createBuildingPlan} from './assets/blackwater-kit/architecture.js';

// Read the very same furniture records that create the meshes and colliders.
// No second table placement, footprint or crafting inventory is maintained.
export function makeCoastalWorkbenches(buildings) {
  const stations = [];
  for (const building of buildings) {
    if (!building.enterable) continue;
    const plan = createBuildingPlan(building), cos = Math.cos(building.yaw || 0), sin = Math.sin(building.yaw || 0);
    for (const item of plan.furniture || []) {
      if (item.type !== 'workbench') continue;
      const [lx, , lz] = item.position;
      const approachZ = lz + item.size[2] / 2 + .95;
      const transform = (x, z) => ({x: (building.x + x*cos + z*sin)/4, y: (building.z - x*sin + z*cos)/4});
      stations.push({id: `${building.id}:${item.id}`, buildingId: building.id,
        name: building.name || building.label || 'Repair workshop', ...transform(lx, lz),
        floorZ: ((building.y || 0) + .08)/4,
        itemZ: ((building.y || 0) + .08 + item.size[1])/4,
        approach: transform(lx, approachZ), reach: .70});
    }
  }
  return stations;
}
