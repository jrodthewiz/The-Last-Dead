import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import {createBuildingPlan} from './architecture.js';
import {isAuthoredCottage} from './cottage-authored.js';

// Shared runtime/inspection practicals. These are local surviving lamps, with
// no shadow maps; the existing directional sun remains the shadow owner.
export function buildBlackwaterPracticals(parent, slice, materials) {
  const root = new THREE.Group(); root.name = 'Blackwater-surviving-practical-lamps'; parent.add(root);
  const housing = materials?.metal?.clone() ?? new THREE.MeshStandardMaterial();
  housing.name = 'blackwater-practical-lamp-housing'; housing.map = null; housing.normalMap = null; housing.roughnessMap = null; housing.aoMap = null;
  housing.color.set('#465553'); housing.roughness = .68; housing.metalness = .36; housing.userData.lookRole = 'practicalHousing';
  const diffuser = new THREE.MeshStandardMaterial({ color: '#e6c796', roughness: .63, metalness: 0, emissive: '#ffb66c', emissiveIntensity: .36 });
  diffuser.name = 'blackwater-practical-amber-diffuser'; diffuser.userData.lookRole = 'practicalLight';
  const pieces = [[], []], geometries = [], lights = [], records = [];
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  function append(slot, geometry, p, rotation = [0, 0, 0]) {
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    e.set(...rotation); q.setFromEuler(e); matrix.compose(new THREE.Vector3(...p), q, new THREE.Vector3(1, 1, 1)); geometry.applyMatrix4(matrix); pieces[slot].push(geometry);
  }
  const box = (slot, p, s, rotation = [0, 0, 0]) => append(slot, new THREE.BoxGeometry(...s), p, rotation);
  function rod(a, b, radius = .013) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(radius, radius, delta.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())); append(0, g, start.add(end).multiplyScalar(.5).toArray());
  }
  function point(name, p, intensity, distance, colour, options={}) {
    // The enamel shade blocks upward light. A soft downward cone models that
    // shielding without adding shadow maps or clipping a white disc overhead.
    const target=options.target??[p[0],.20,p[2]],angle=options.angle??Math.PI/3,penumbra=options.penumbra??.95;
    const light = new THREE.SpotLight(colour, intensity, distance, angle, penumbra, 2); light.name = name; light.position.fromArray(p); light.target.position.fromArray(target); light.castShadow = false; root.add(light,light.target); lights.push(light);
    records.push({ name, type:options.target?'directed task spot':'downward spot', position: p, target, intensity, distance, angle,penumbra, decay: 2, castShadow: false });
  }
  const shop = slice.buildings?.find(b => b.enterable && /pharmacy/i.test(b.label)) ?? slice.shop;
  if (shop) {
    const x = shop.x + (shop.doorOffset ?? 2), rearZ = shop.z - 2.4, frontZ = shop.z + shop.depth / 2 - .2;
    const rearY = (shop.y ?? .13) + 2.52, frontY = (shop.y ?? .13) + 2.37;
    point('Bell Pharmacy surviving fluorescent', [x, rearY, rearZ], 38, 13, 0xffbd77);
    point('Bell Pharmacy entrance spill', [x, frontY, frontZ], 24, 10, 0xffb879);
    // Recessed diffuser, surrounding tray, protective crossbars and short
    // suspension rods make the warm sources credible fixtures at head height.
    for (const [y, z, width] of [[rearY + .044, rearZ, 1.45], [frontY + .04, frontZ, .66]]) {
      box(0, [x, y + .045, z], [width + .10, .055, .28]);
      box(1, [x, y, z], [width, .033, .19]);
      for (const direction of [-1, 1]) {
        box(0, [x, y + .005, z + direction * .115], [width + .08, .055, .025]);
        rod([x + direction * width * .30, y + .075, z], [x + direction * width * .30, Math.min(3.37, y + .43), z]);
      }
      for (const offset of [-.3, 0, .3]) box(0, [x + offset * width, y -.018, z], [.018, .015, .20]);
    }
  }
  for (const house of (slice.buildings ?? []).filter(b => b.id==='coast-lot-1-0-0-2' && b.enterable)) {
    const floorHeight = ((Number(house.height) || 6.4) - 1.45) / 2, ceiling = (house.y ?? .13) + floorHeight;
    const frame = new THREE.Matrix4().makeRotationY(house.yaw || 0); frame.setPosition(house.x, house.y ?? .13, house.z);
    const world = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame).toArray();
    for (const [room, x, z, intensity] of [['living', 4.25, 3.0, 9], ['kitchen', 4.70, -5.6, 11]]) {
      const p = world(x, floorHeight -.31, z), mount = world(x, floorHeight -.016, z);
      point(`${house.label || house.id} ${room} surviving amber pendant`, p, intensity, 7, 0xffbe78);
      rod(mount, [p[0], p[1] + .11, p[2]], .012);
      append(0, new THREE.CylinderGeometry(.087, .087, .040, 12), mount);
      // A shallow tapered enamel shade sits beneath the low 2.605m ceiling.
      append(0, new THREE.CylinderGeometry(.068, .22, .16, 16, 1, true), [p[0], p[1] + .042, p[2]]);
      append(1, new THREE.CylinderGeometry(.173, .173, .018, 16), [p[0], p[1] -.043, p[2]]);
      records.at(-1).ceilingWorldY = ceiling; records.at(-1).fixtureLowestY = p[1] -.052;
    }
  }
  const hardware=(slice.buildings??[]).find(b=>b.enterable&&/hardware/i.test(b.label));
  if(hardware){
    const bench=createBuildingPlan(hardware).furniture.find(p=>p.id==='repair-bench');
    if(bench){
      const top=.08+bench.size[1],frame=new THREE.Matrix4().makeRotationY(hardware.yaw||0);frame.setPosition(hardware.x,hardware.y??.13,hardware.z);
      const world=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(frame).toArray();
      const [bx,,bz]=bench.position,w=bench.size[0],d=bench.size[2];
      const base=world(bx+w*.07,top+.022,bz-d*.28),elbow=world(bx+w*.07,top+.48,bz-d*.28);
      const head=world(bx+.03,top+1.12,bz),target=world(bx,top+.23,bz-.15);
      point('HARBOR HARDWARE repair task lamp',head,22,3,0xffcc8d,{target,angle:.92,penumbra:.55});
      append(0,new THREE.CylinderGeometry(.10,.10,.044,12),base);
      rod([base[0],base[1]+.022,base[2]],elbow,.016);rod(elbow,head,.016);
      append(0,new THREE.SphereGeometry(.030,8,6),elbow);
      const axis=new THREE.Vector3(...head).sub(new THREE.Vector3(...target)).normalize();
      const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
      const shade=new THREE.CylinderGeometry(.055,.15,.12,12,1,true);shade.applyQuaternion(orientation);append(0,shade,head);
      const mouth=new THREE.Vector3(...head).addScaledVector(axis,-.060);
      const disc=new THREE.CylinderGeometry(.125,.125,.012,12);disc.applyQuaternion(orientation);append(1,disc,mouth.toArray());
      Object.assign(records.at(-1),{buildingId:hardware.id,supportId:bench.id,supportTopWorld:(hardware.y??.13)+top,basePosition:base,baseRadius:.10});
    }
  }
  for(const house of (slice.buildings??[]).filter(isAuthoredCottage)){
    const plan=createBuildingPlan(house),desk=plan.furniture.find(p=>p.id==='resident-work-station');
    const top=.08+desk.size[1],frame=new THREE.Matrix4().makeRotationY(house.yaw||0);frame.setPosition(house.x,house.y??.13,house.z);
    const world=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(frame).toArray();
    const base=world(-4.85,top+.022,4.55),joint=world(-4.85,1.36,4.55),head=world(-4.50,1.70,4.30),target=world(-3.93,top+.18,4.50);
    point('CAPE LODGE 75 radio repair task lamp',head,12,4.5,0xffc48a,{target,angle:.62,penumbra:.55});
    append(0,new THREE.CylinderGeometry(.12,.12,.044,12),base);
    rod([base[0],base[1]+.02,base[2]],joint,.017);rod(joint,head,.017);
    const axis=new THREE.Vector3(...head).sub(new THREE.Vector3(...target)).normalize();
    const orientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    const shade=new THREE.CylinderGeometry(.065,.16,.13,12,1,true);shade.applyQuaternion(orientation);append(0,shade,head);
    const mouth=new THREE.Vector3(...head).addScaledVector(axis,-.065);
    const disc=new THREE.CylinderGeometry(.133,.133,.015,12);disc.applyQuaternion(orientation);append(1,disc,mouth.toArray());
    Object.assign(records.at(-1),{buildingId:house.id,supportId:desk.id,supportTopWorld:(house.y??.13)+top,basePosition:base,baseRadius:.12});
    const listening=plan.upstairsArt?.workstation;
    if(listening){
      const mount=listening.taskLightBase,deskTop=mount.center[1],lampBase=world(mount.center[0],deskTop+.018,mount.center[2]);
      const elbow=world(mount.center[0],deskTop+.30,mount.center[2]),lampHead=world(mount.center[0]+.30,deskTop+.62,mount.center[2]+.20);
      const beamTarget=world(...(listening.lightingTarget??listening.listeningSurfaceCenter));
      point('CAPE LODGE 75 upstairs listening task lamp',lampHead,6,2.7,0xffc28a,{target:beamTarget,angle:.72,penumbra:.45});
      append(0,new THREE.CylinderGeometry(mount.radius,mount.radius,.036,12),lampBase);
      rod([lampBase[0],lampBase[1]+.018,lampBase[2]],elbow,.014);rod(elbow,lampHead,.014);
      append(0,new THREE.SphereGeometry(.032,8,6),elbow);
      const lampAxis=new THREE.Vector3(...lampHead).sub(new THREE.Vector3(...beamTarget)).normalize();
      const lampOrientation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),lampAxis);
      const lampShade=new THREE.CylinderGeometry(.050,.14,.12,12,1,true);lampShade.applyQuaternion(lampOrientation);append(0,lampShade,lampHead);
      const lampMouth=new THREE.Vector3(...lampHead).addScaledVector(lampAxis,-.060);
      const lampDisc=new THREE.CylinderGeometry(.115,.115,.012,12);lampDisc.applyQuaternion(lampOrientation);append(1,lampDisc,lampMouth.toArray());
      Object.assign(records.at(-1),{buildingId:house.id,supportId:'cape75-upper-writing-desk-top',supportTopWorld:(house.y??.13)+deskTop,
        basePosition:lampBase,baseRadius:mount.radius,floorTopWorld:(house.y??.13)+plan.structure.floors[1].top});
    }
  }
  // A handful of surviving task fixtures gives the scavenging route readable
  // destinations. These finite downward cones share the two fixture batches;
  // they do not add shadow maps or illuminate every abandoned room.
  const scavengingStops=[
    ['EAST WORKS 44 / CLINIC','clinic-intake-desk'],
    ['EAST WORKS 45 / WORKSHOP','workshop-dispatch-desk'],
    ['EAST WORKS 45 / WORKSHOP','workshop-rear-bench'],
    ['EAST WORKS 46 / WAREHOUSE','warehouse-packing-table'],
    ['CAPE LODGE 79','resident-work-station'],
  ];
  for(const [label,supportId] of scavengingStops){
    const building=slice.buildings?.find(b=>b.enterable&&b.label===label);if(!building)continue;
    const plan=createBuildingPlan(building),support=plan.furniture.find(f=>f.id===supportId);if(!support)continue;
    const [x,,z]=support.position,top=.08+support.size[1],ceiling=building.kind==='house'?plan.upperFloorHeight:3.34;
    const frame=new THREE.Matrix4().makeRotationY(building.yaw||0);frame.setPosition(building.x,building.y??.13,building.z);
    const world=(x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(frame).toArray();
    const mount=world(x,ceiling-.025,z),head=world(x,ceiling-.44,z),target=world(x,top+.18,z);
    point(`${label} / ${supportId} scavenging task fixture`,head,18,3.2,0xffcf96,{target,angle:.88,penumbra:.65});
    box(0,mount,[.32,.05,.22]);rod([mount[0],mount[1]-.025,mount[2]],[head[0],head[1]+.075,head[2]],.012);
    box(0,[head[0],head[1]+.047,head[2]],[.60,.11,.25]);
    box(1,[head[0],head[1]-.012,head[2]],[.53,.02,.19]);
    for(const side of [-1,1])box(0,[head[0]+side*.22,head[1]-.027,head[2]],[.018,.018,.21]);
    Object.assign(records.at(-1),{buildingId:building.id,supportId,supportTopWorld:(building.y??.13)+top,
      ceilingWorldY:(building.y??.13)+ceiling,mountPosition:mount,fixtureLowestY:head[1]-.036,scavengingTask:true});
  }
  let triangles = 0, drawCalls = 0;
  for (const [slot, material] of [housing, diffuser].entries()) {
    if (!pieces[slot].length) continue;
    const g = mergeGeometries(pieces[slot], false); pieces[slot].forEach(p => p.dispose());
    if (!g) throw new Error('Could not compile Blackwater lamp fixtures');
    g.computeBoundingBox(); g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, material);
    mesh.name = slot === 0 ? 'Blackwater-practical-lamp-housings' : 'Blackwater-practical-amber-diffusers'; mesh.receiveShadow = true; mesh.castShadow = false;
    root.add(mesh); geometries.push(g); triangles += g.index.count / 3; drawCalls++;
  }
  let disposed = false;
  return { root, lights, diagnostics: { lights: records, lightCount: lights.length, drawCalls, triangles, additionalShadowMaps: 0, ownership: 'owns lamps, two fixture materials and compiled geometry; borrows district references' }, dispose() {
    if (disposed) return; disposed = true; root.removeFromParent(); for (const light of lights) { light.target.removeFromParent();light.removeFromParent(); light.dispose(); }
    geometries.forEach(g => g.dispose()); housing.dispose(); diffuser.dispose();
  } };
}
