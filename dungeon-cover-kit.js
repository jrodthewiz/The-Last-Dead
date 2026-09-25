import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';

// The course owns collision. These are visual shells within the same 4 m cover
// cells: one authored model per floor, instanced for every matching block.
const CELL = 4;

function moved(geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
}
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
  moved(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const cylinder = (top, bottom, h, x, y, z, sides = 10, rx = 0, ry = 0, rz = 0) =>
  moved(new THREE.CylinderGeometry(top, bottom, h, sides), x, y, z, rx, ry, rz);

function prism(outline, height, x = 0, y = 0, z = 0) {
  const shape = new THREE.Shape();
  outline.forEach(([px, pz], index) => index ? shape.lineTo(px, -pz) : shape.moveTo(px, -pz));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelSegments: 1, steps: 1,
    bevelSize: .035, bevelThickness: .035,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(x, y, z);
  return geometry;
}

// Four separate sloped faces make the foundry bin a real hopper, rather than a
// scaled cube. UVs use local metres so the worn metal source keeps its grain.
function hopperWall(side, topHalf = 1.66, bottomHalf = 1.32, height = 2.2) {
  const a = [
    [[-bottomHalf, 0, -bottomHalf], [bottomHalf, 0, -bottomHalf], [topHalf, height, -topHalf], [-topHalf, height, -topHalf]],
    [[bottomHalf, 0, bottomHalf], [-bottomHalf, 0, bottomHalf], [-topHalf, height, topHalf], [topHalf, height, topHalf]],
    [[-bottomHalf, 0, bottomHalf], [-bottomHalf, 0, -bottomHalf], [-topHalf, height, -topHalf], [-topHalf, height, topHalf]],
    [[bottomHalf, 0, -bottomHalf], [bottomHalf, 0, bottomHalf], [topHalf, height, topHalf], [topHalf, height, -topHalf]],
  ][side];
  const geometry = new THREE.BufferGeometry();
  const vertices = [a[0], a[2], a[1], a[0], a[3], a[2]].flat();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2.7, 0, 2.7, 2.2, 0, 0, 2.7, 2.2, 0, 2.2], 2));
  geometry.computeVertexNormals();
  return geometry;
}

function merge(parts) {
  const flat = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(flat, false);
  for (const part of parts) part.dispose();
  for (const part of flat) if (!parts.includes(part)) part.dispose();
  geometry.computeBoundingSphere();
  geometry.userData.sharedAsset = true;
  return geometry;
}

function modelParts(floor) {
  const P = { shell: [], face: [], trim: [], recess: [], hardware: [] };
  if (floor === 'f1-intake-foundry') {
    // Pressure-foundry hopper: splayed sides, open mouth, corner braces and
    // bolted furnace access. It still occupies the original cover cell.
    for (let side = 0; side < 4; side++) P.shell.push(hopperWall(side));
    P.recess.push(box(3.05, .045, 3.05, 0, 2.15, 0));
    for (const z of [-1.58, 1.58]) P.trim.push(box(3.55, .12, .16, 0, 2.27, z));
    for (const x of [-1.58, 1.58]) P.trim.push(box(.16, .12, 3.28, x, 2.27, 0));
    for (const x of [-1.42, 1.42]) {
      P.trim.push(box(.09, 2.25, .1, x, 1.13, -1.43, 0, 0, x < 0 ? -.14 : .14));
      P.trim.push(box(.09, 2.25, .1, x, 1.13, 1.43, 0, 0, x < 0 ? -.14 : .14));
    }
    P.recess.push(box(1.12, .84, .055, 0, 1.18, -1.53));
    P.face.push(box(.98, .7, .07, 0, 1.18, -1.57));
    for (const z of [-1.64, 1.64]) for (const x of [-1.15, 1.15]) {
      P.hardware.push(cylinder(.055, .055, .055, x, .34, z, 8, Math.PI / 2));
      P.hardware.push(cylinder(.055, .055, .055, x, 1.88, z, 8, Math.PI / 2));
    }
    P.hardware.push(cylinder(.35, .35, .08, 0, 1.52, -1.63, 16, Math.PI / 2));
    P.recess.push(cylinder(.24, .24, .09, 0, 1.52, -1.69, 16, Math.PI / 2));
    P.trim.push(box(2.65, .085, .1, 0, .22, -1.35));
    P.trim.push(box(2.6, .075, .09, 0, .34, 1.43), box(2.95, .09, .1, 0, 1.75, 1.55));
    for (let i = 0; i < 5; i++) P.recess.push(box(1.12, .04, .065, 0, .65 + i * .15, 1.53));
    for (const x of [-1.05, 1.05]) P.hardware.push(cylinder(.055, .055, .055, x, 1.75, 1.63, 8, Math.PI / 2));
  } else if (floor === 'f2-graft-galleries') {
    // Mortuary drawer bank: sheet-metal body, inset wooden drawer faces,
    // handles, label holders, plinth and side ventilation.
    P.shell.push(box(3.33, 2.66, 3.0, 0, 1.38, 0));
    P.recess.push(box(3.12, 2.43, .08, 0, 1.43, -1.54));
    P.trim.push(box(3.49, .14, 3.17, 0, 2.78, 0), box(3.25, .17, 3.08, 0, .12, 0));
    for (const y of [.57, 1.27, 1.97]) {
      P.face.push(box(2.87, .53, .065, 0, y, -1.61));
      P.trim.push(box(2.96, .035, .08, 0, y + .3, -1.64));
      for (const x of [-.62, .62]) P.hardware.push(cylinder(.045, .045, .075, x, y, -1.68, 8, Math.PI / 2));
      P.hardware.push(box(1.32, .045, .08, 0, y, -1.72), box(.34, .13, .023, 1.07, y, -1.69));
    }
    for (const side of [-1, 1]) {
      P.trim.push(box(.07, 2.47, .08, side * 1.58, 1.4, -1.57));
      for (let i = 0; i < 5; i++) P.recess.push(box(.055, .035, .54, side * 1.685, 1.75 + i * .12, .15));
    }
    // The reverse side faces another combat lane: two service doors and a
    // vent bank prevent the cabinet from becoming a blank slab when circled.
    P.recess.push(box(3.02, 2.38, .045, 0, 1.43, 1.535));
    for (const x of [-.73, .73]) {
      P.face.push(box(1.36, 2.28, .055, x, 1.44, 1.58));
      P.trim.push(box(.045, 2.3, .075, x < 0 ? -1.41 : 1.41, 1.44, 1.63));
      P.hardware.push(cylinder(.055, .055, .08, x < 0 ? -.12 : .12, 1.42, 1.66, 8, Math.PI / 2));
    }
    for (let i = 0; i < 5; i++) P.recess.push(box(1.15, .035, .08, 0, 2.06 + i * .1, 1.65));
  } else if (floor === 'f3-catacombs') {
    // Two overlapping tapered sarcophagi, with lid courses and riveted bands.
    const coffin = [[-.9, -1.5], [.9, -1.5], [1.54, -.55], [1.38, 1.1], [.68, 1.55], [-.68, 1.55], [-1.38, 1.1], [-1.54, -.55]];
    P.shell.push(prism(coffin, 1.12, -.08, .08, .06));
    P.face.push(prism(coffin.map(([x, z]) => [x * 1.035, z * 1.025]), .18, -.08, 1.2, .06));
    const upper = coffin.map(([x, z]) => [x * .82, z * .83]);
    P.shell.push(prism(upper, .94, .26, 1.42, -.18));
    P.face.push(prism(upper.map(([x, z]) => [x * 1.06, z * 1.05]), .15, .26, 2.39, -.18));
    for (const y of [.47, 1.86]) for (const z of [-.72, .72]) {
      P.trim.push(box(2.65, .075, .105, .07, y, z));
      for (const x of [-1.05, 1.05]) P.hardware.push(cylinder(.055, .055, .06, x, y + .05, z, 7));
    }
    P.hardware.push(box(.11, .04, 1.05, .26, 2.59, -.18), box(.72, .04, .1, .26, 2.6, -.3));
  } else if (floor === 'f4-resonance') {
    // Abandoned choir stall: an actual seat and pierced high back, with a
    // fallen kneeler. Open space under the seat breaks the box silhouette.
    P.shell.push(box(3.25, .17, 1.18, 0, .97, -.43), box(3.32, .16, .19, 0, 2.77, 1.33));
    for (const x of [-1.5, 1.5]) {
      P.shell.push(box(.16, 2.73, 2.88, x, 1.39, 0));
      P.trim.push(box(.23, .16, 3.02, x, 2.69, 0));
    }
    for (let i = 0; i < 7; i++) {
      const x = -1.21 + i * .405;
      P.face.push(box(.24, 1.43, .13, x, 1.9, 1.36));
      P.hardware.push(cylinder(.12, .12, .045, x, 2.48, 1.46, 8, Math.PI / 2));
    }
    P.recess.push(box(2.9, .1, .15, 0, 1.17, 1.28));
    P.shell.push(box(2.8, .11, .55, .13, .32, -.98, 0, 0, -.08));
    for (const x of [-1.13, 1.13]) P.trim.push(box(.08, .66, .16, x, .51, -.97, 0, 0, -.1));
  } else {
    // Last Descent: uneven basalt masses and exposed bone buttresses. No
    // rectangular core is visible from the play lane.
    const rocks = [
      [-.75, .78, -.57, 1.16, .76, 1.12, .17], [.7, .9, -.64, 1.14, .89, 1.2, -.21],
      [-.72, .91, .69, 1.12, .87, 1.1, -.18], [.7, .79, .71, 1.15, .79, 1.08, .3],
      [0, 1.75, -.1, 1.32, .8, 1.38, .27],
    ];
    for (const [x, y, z, sx, sy, sz, yaw] of rocks) {
      const rock = new THREE.DodecahedronGeometry(1, 1);
      rock.scale(sx, sy, sz); rock.rotateY(yaw); rock.translate(x, y, z);
      P.shell.push(rock);
    }
    for (const side of [-1, 1]) {
      P.face.push(cylinder(.14, .27, 2.37, side * 1.15, 1.4, -1.07, 8, 0, 0, side * .28));
      P.face.push(cylinder(.04, .14, .75, side * 1.42, 2.8, -1.03, 8, 0, 0, side * .36));
      for (let i = 0; i < 3; i++) P.trim.push(cylinder(.055, .08, 1.15, side * (1.03 - i * .24), .66 + i * .28, -1.14, 7, 0, 0, side * (.73 + i * .18)));
    }
    P.recess.push(box(.62, .78, .055, 0, 1.38, -1.48));
  }
  return Object.fromEntries(Object.entries(P).filter(([, parts]) => parts.length).map(([role, parts]) => [role, merge(parts)]));
}

function cloneMaterial(source, name, color, roughness, metalness) {
  const material = source?.clone?.() || new THREE.MeshStandardMaterial();
  material.name = `StoryCover_${name}`;
  material.color.setHex(color);
  material.roughness = roughness;
  material.metalness = metalness;
  material.emissive?.setHex(0x000000);
  material.userData = { ...material.userData, storyCoverOwned: true };
  material.needsUpdate = true;
  return material;
}

function palette(floor, m) {
  const steel = m.wornSteel || m.steel || m.metalDark;
  const stone = m.wall || m.floor || m.bone;
  const wood = m.afterlifeWood || m.wall || m.steel;
  const dark = m.black || m.metalDark;
  if (floor === 'f1-intake-foundry') return {
    shell: cloneMaterial(steel, 'foundry-oxidized-hopper', 0x807670, .83, .45),
    face: cloneMaterial(steel, 'foundry-service-hatch', 0xa39a8b, .68, .5),
    trim: cloneMaterial(steel, 'foundry-rim', 0x50433e, .7, .56),
    recess: cloneMaterial(dark, 'foundry-recess', 0x100e0e, .96, .08),
    hardware: cloneMaterial(steel, 'foundry-rivets', 0xaaa698, .55, .72),
  };
  if (floor === 'f2-graft-galleries') return {
    shell: cloneMaterial(steel, 'ward-enamel', 0xb7bdb1, .67, .27),
    face: cloneMaterial(wood, 'ward-drawer-wood', 0xc8c1af, .88, .02),
    trim: cloneMaterial(steel, 'ward-seams', 0x596e69, .62, .42),
    recess: cloneMaterial(dark, 'ward-openings', 0x14221f, .93, .05),
    hardware: cloneMaterial(steel, 'ward-handles', 0xd1d0c1, .41, .66),
  };
  if (floor === 'f3-catacombs') return {
    shell: cloneMaterial(stone, 'crypt-stone', 0x88817a, .96, .02),
    face: cloneMaterial(stone, 'crypt-lids', 0xb3a99a, .94, .02),
    trim: cloneMaterial(steel, 'crypt-iron-bands', 0x554c48, .84, .36),
    hardware: cloneMaterial(steel, 'crypt-fasteners', 0x9f8c72, .68, .52),
  };
  if (floor === 'f4-resonance') return {
    shell: cloneMaterial(wood, 'choir-timber', 0x86705b, .89, .01),
    face: cloneMaterial(wood, 'choir-back-slats', 0xb39a77, .85, .01),
    trim: cloneMaterial(steel, 'choir-worn-braces', 0x73645a, .78, .23),
    recess: cloneMaterial(dark, 'choir-dark-gap', 0x15100e, .96, 0),
    hardware: cloneMaterial(steel, 'choir-pegs', 0xa58655, .58, .43),
  };
  return {
    shell: cloneMaterial(stone, 'gullet-basalt', 0x585050, .98, .01),
    face: cloneMaterial(m.bone || stone, 'gullet-bone', 0xa29581, .88, .02),
    trim: cloneMaterial(m.flesh || steel, 'gullet-tendons', 0x572e2d, .81, .06),
    recess: cloneMaterial(dark, 'gullet-crevice', 0x0b0809, 1, 0),
  };
}

export function buildDungeonCover(root, materials, course) {
  const group = new THREE.Group();
  group.name = course?.dungeon ? 'DungeonCoverKit' : 'CampaignCoverKit';
  if (!course) return group;
  const blocks = course.blocks || [];
  const family = course.dungeon ? course.id : ({
    bloodworks: 'f1-intake-foundry', ossuary: 'f3-catacombs', choir: 'f4-resonance',
  })[course.sectorId || course.id] || 'f1-intake-foundry';
  group.userData.blocks = blocks.length;
  group.userData.floorId = course.id;
  group.userData.modelFamily = family;
  group.userData.visualModel = 'authored-cover-v2';
  if (!blocks.length) { root.add(group); return group; }
  const geometry = modelParts(family);
  const mats = palette(family, materials);
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  const campaignHeight = family === 'f1-intake-foundry' ? 1.28 : family === 'f3-catacombs' ? 1.15 : 1.05;
  const s = new THREE.Vector3(1, course.dungeon ? 1 : campaignHeight, 1);
  const matrix = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  for (const [role, shape] of Object.entries(geometry)) {
    const mesh = new THREE.InstancedMesh(shape, mats[role], blocks.length);
    mesh.name = `StoryCover_${role}`;
    mesh.userData.noBatch = true;
    mesh.userData.modelFamily = family;
    mesh.castShadow = role === 'shell' || role === 'face';
    mesh.receiveShadow = true;
    blocks.forEach(([cx, cz], index) => {
      p.set((cx + .5) * CELL, 0, (cz + .5) * CELL);
      q.setFromAxisAngle(up, ((cx * 13 + cz * 7) & 1) ? Math.PI / 2 : 0);
      matrix.compose(p, q, s);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere?.();
    group.add(mesh);
  }
  group.userData.materialRoles = Object.keys(geometry);
  root.add(group);
  return group;
}
