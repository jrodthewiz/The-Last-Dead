import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Landmark architecture.  Non-colliding architecture stays on the perimeter or
// above the movement volume.
// ---------------------------------------------------------------------------
export function buildCathedralKit(root, m, course) {
 const kit=new THREE.Group();kit.name='CathedralArchitecture';root.add(kit);
 if (course?.dungeon) {
  const life=buildWorldLifeKit(root,m,course);
  if(life)kit.add(life);
  return kit;
 }
 const add=(g,material,x,y,z)=>{const mesh=new THREE.Mesh(g,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;kit.add(mesh);return mesh;};
 const stone=new THREE.MeshStandardMaterial({color:0x242b2b,roughness:.91,metalness:.12});
 const brass=new THREE.MeshStandardMaterial({color:0x76604a,roughness:.63,metalness:.72});
 const width=course.w*4,depth=course.h*4;
 // Curved roof bays create a real enclosed volume, broken by narrow rib seams.
 const cross=[];for(let i=0;i<=20;i++){const x=i/20*width;cross.push([x,6.65+5.5*Math.sin(Math.PI*i/20)]);}
 for(let bay=0,z0=.35;z0<depth-.35;bay++,z0+=12){
  const z1=Math.min(depth-.35,z0+11.3),positions=[],uv=[];
  for(let i=0;i<20;i++){const a=cross[i],b=cross[i+1];for(const p of [[...a,z0],[...b,z0],[...b,z1],[...a,z0],[...b,z1],[...a,z1]]){positions.push(...p);uv.push(p[0]/4,p[2]/4);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();add(geo,stone,0,0,0).name='VaultBay';
 }
 const glass=new THREE.MeshBasicMaterial({color:course.sectorId==='ossuary'?0x68648b:0x765449});
 // Tapered buttresses and recessed clerestory apertures, repeated as a kit.
 for(const side of [-1,1])for(let z=6;z<depth;z+=12){
  const x=side<0?.42:width-.42;
  const shaft=add(new THREE.CylinderGeometry(.22,.48,8.2,6),m.metalDark,x,4.1,z);shaft.castShadow=true;
  for(const y of [.4,5.4,7.8]){const collar=add(new THREE.CylinderGeometry(.52,.52,.18,6),brass,x,y,z);collar.rotation.y=Math.PI/6;}
  const backing=add(new THREE.BoxGeometry(.12,2.3,3.4),m.black,x-side*.2,7.3,z);
  for(const dz of [-1.2,-.4,.4,1.2])add(new THREE.BoxGeometry(.14,2.05,.06),brass,x-side*.28,7.3,z+dz);
  add(new THREE.BoxGeometry(.08,1.9,3.1),glass,x-side*.24,7.3,z);
 }
 // Drain rails and bolted maintenance strips run outside the central fire lane.
 const railDepth=Math.max(4,depth-6),railCenter=depth*.5;
 for(const x of [4,width-4]){
  add(new THREE.BoxGeometry(.62,.025,railDepth),m.black,x,.015,railCenter);
  for(let z=3;z<depth-3;z+=.6)add(new THREE.BoxGeometry(.56,.03,.07),m.metalDark,x,.035,z);
  for(const dx of [-.36,.36])add(new THREE.BoxGeometry(.035,.025,railDepth),brass,x+dx,.038,railCenter);
 }
 // Cover fittings follow the actual sector layout, never hard-coded old anchors.
 for(const [cx,cz] of course.blocks||[]){const x=cx*4+2,z=cz*4+2;
  for(const side of [-1,1]){
   for(let row=0;row<7;row++)add(new THREE.BoxGeometry(2.55,.06,.045),m.metalDark,x,.85+row*.18,z+side*1.735);
   for(const dx of [-1.45,1.45])for(const y of [.5,2.8]){const bolt=add(new THREE.CylinderGeometry(.075,.075,.065,6),brass,x+dx,y,z+side*1.755);bolt.rotation.x=Math.PI/2;}
  }
 }
  // Authored routes are visual spines only. They never alter collision cells,
 // keeping the fast movement proxy deterministic while giving each arena a
 // readable route hierarchy from spawn to focal court to exit.
 const layout=course?.layout||course?.world||{};
 const cueColor=course?.sectorId==='ossuary'?0x8f70ff:course?.sectorId==='choir'?0xff9a4a:0xff384f;
 const routeMaterial=new THREE.MeshStandardMaterial({color:cueColor,emissive:cueColor,emissiveIntensity:.38,roughness:.7,metalness:.28,transparent:true,opacity:.46,depthWrite:false});
 for(const route of layout.routes||[]){
  const pts=route.points||[];
  for(let i=0;i<pts.length-1;i++){
   const a=pts[i],b=pts[i+1],ax=a[0]*4+2,az=a[1]*4+2,bx=b[0]*4+2,bz=b[1]*4+2;
   const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
   const strip=add(new THREE.BoxGeometry(len,.035,Math.min(.24,Math.max(.12,(route.width||2)*.08))),routeMaterial,(ax+bx)/2,.035,(az+bz)/2);
   strip.rotation.y=-Math.atan2(dz,dx);strip.name='RouteSpine_'+route.id;
  }
 }
 // Large court frames and objective portals make the zones legible as authored
 // rooms instead of a grid of interchangeable cover blocks.
 const frameMaterial=new THREE.MeshStandardMaterial({color:0x303b44,roughness:.74,metalness:.62});
 for(const zone of layout.zones||[]){
  if(zone.role!=='focal-encounter'&&zone.role!=='objective')continue;
  const [cx,cz,cw,ch]=zone.rect||[];if(!Number.isFinite(cx)||!Number.isFinite(cz))continue;
  const x0=cx*4+1.1,z0=cz*4+1.1,x1=(cx+cw)*4-1.1,z1=(cz+ch)*4-1.1,h=zone.role==='objective'?7.2:5.3;
  for(const [x,z] of [[x0,z0],[x1,z0],[x0,z1],[x1,z1]]){const post=add(new THREE.BoxGeometry(.42,h,.42),frameMaterial,x,h/2,z);post.name='ZonePost_'+zone.id;}
  const topA=add(new THREE.BoxGeometry(x1-x0+.42,.3,.42),frameMaterial,(x0+x1)/2,h,z0);topA.name='ZoneLintel_'+zone.id;
  const topB=add(new THREE.BoxGeometry(x1-x0+.42,.3,.42),frameMaterial,(x0+x1)/2,h,z1);topB.name='ZoneLintel_'+zone.id;
 }
 // Packing and gore dressing rides the same static pass as the architecture but
 // arrives as a handful of InstancedMesh draws instead of loose meshes.
 const life=buildWorldLifeKit(root,m,course);
 if(life)kit.add(life);
 return kit;
}

// ===========================================================================
// World life kit: sector-specific props, gore and dressings as instanced draws.
// Every placement is derived from the course's own room/zone rectangles, cover
// blocks and collision wall flags, so props cannot sit inside a wall or block a
// gameplay lane.
// ===========================================================================

const CELL = 4;
const LIFE_VERSION = 2;

const place = (geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  if (sx !== 1 || sy !== 1 || sz !== 1) geometry.scale(sx, sy, sz);
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
};
const cyl = (rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz);
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const sphere = (r, ws, hs, x = 0, y = 0, z = 0) => place(new THREE.SphereGeometry(r, ws, hs), x, y, z);
const capsule = (r, len, cap, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.CapsuleGeometry(r, len, cap, seg), x, y, z, rx, ry, rz);
const torus = (r, tube, rad, tub, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => place(new THREE.TorusGeometry(r, tube, rad, tub, arc), x, y, z, rx, ry, rz);
const ico = (r, detail, x = 0, y = 0, z = 0) => place(new THREE.IcosahedronGeometry(r, detail), x, y, z);
const cone = (r, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => place(new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz);

function mergeParts(parts) {
  const normalized = parts.map(part => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(normalized, false);
  for (const part of parts) part.dispose?.();
  for (const part of normalized) if (!parts.includes(part)) part.dispose?.();
  if (merged) {
    merged.userData.sharedAsset = true;
    merged.computeBoundingSphere();
    return merged;
  }
  return new THREE.BoxGeometry(.4, .4, .4);
}

// Irregular rim plus congealed lumps, so a pool reads as matter on the floor
// instead of a flat decal.
function splatGeometry(lumps = 3) {
  const circle = new THREE.CircleGeometry(1, 18);
  const position = circle.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const radius = Math.hypot(x, y);
    if (radius > .01 && radius < .99) {
      const factor = .72 + ((i * 37) % 23) / 23 * .55;
      position.setXY(i, x * factor, y * factor);
    }
  }
  circle.rotateX(-Math.PI / 2);
  circle.translate(0, .014, 0);
  const parts = [circle];
  for (let i = 0; i < lumps; i++) {
    const angle = i / lumps * Math.PI * 2 + .6;
    const radius = .16 + (i % 3) * .09;
    parts.push(ico(radius, 0, Math.cos(angle) * .42, .04 + radius * .3, Math.sin(angle) * .42));
  }
  return mergeParts(parts);
}

function skullParts(x = 0, y = 0, z = 0, scale = 1) {
  return [
    ico(.19 * scale, 1, x, y, z),
    box(.2 * scale, .09 * scale, .16 * scale, x, y - .15 * scale, z + .03 * scale),
    box(.1 * scale, .07 * scale, .08 * scale, x, y - .05 * scale, z + .17 * scale),
  ];
}

let LIFE_GEOMETRY = null;
function lifeGeometry() {
  if (LIFE_GEOMETRY) return LIFE_GEOMETRY;
  const G = {};
  const barrelParts = [
    cyl(.33, .35, .9, 10, 0, .45, 0),
    torus(.35, .028, 5, 12, 0, .26, 0, Math.PI / 2),
    torus(.35, .028, 5, 12, 0, .66, 0, Math.PI / 2),
    cyl(.29, .29, .05, 10, 0, .92, 0),
    cyl(.045, .045, .12, 6, .31, .58, 0, 0, 0, Math.PI / 2),
  ];
  G.barrel = mergeParts(barrelParts);
  G.splat = splatGeometry(3);
  G.bodyPile = mergeParts([
    box(.72, .3, 1.15, 0, .17, 0),
    capsule(.11, .46, 4, 7, -.4, .16, .28, 0, 0, 1.35),
    capsule(.11, .5, 4, 7, .42, .14, -.22, 0, 0, -1.15),
    capsule(.09, .38, 3, 6, .1, .12, .58, Math.PI / 2.2, 0, 0),
    ...skullParts(.06, .3, -.72, 1.05),
  ]);
  G.bonePile = mergeParts([
    capsule(.07, .62, 3, 6, 0, .12, 0, 0, .5, Math.PI / 2),
    capsule(.06, .58, 3, 6, .1, .22, .12, 0, 1.1, Math.PI / 2),
    capsule(.065, .66, 3, 6, -.12, .34, -.1, 0, 2.1, Math.PI / 2),
    capsule(.055, .5, 3, 6, .24, .44, .05, 0, .2, Math.PI / 2),
    ...skullParts(-.22, .52, -.3, 1),
    ...skullParts(.4, .3, .42, .92),
  ]);
  G.boneStack = mergeParts([
    box(2.3, .16, .38, 0, .08, 0),
    capsule(.075, .95, 3, 6, -.55, .22, 0, 0, 0, Math.PI / 2),
    capsule(.07, 1.0, 3, 6, .1, .2, .1, 0, 0, Math.PI / 2),
    capsule(.065, .86, 3, 6, .6, .24, -.06, 0, 0, Math.PI / 2),
    capsule(.07, .92, 3, 6, -.3, .4, -.04, 0, 0, Math.PI / 2),
    capsule(.06, .8, 3, 6, .42, .42, .04, 0, 0, Math.PI / 2),
    ...skullParts(-.8, .5, .06, 1.1),
  ]);
  G.ribArc = mergeParts([
    torus(1.0, .085, 6, 18, 0, 1.1, 0, 0, 0, 0, Math.PI),
    cyl(.09, .11, 2.2, 7, -1.0, 1.1, 0),
    cyl(.09, .11, 2.2, 7, 1.0, 1.1, 0),
    box(.46, .14, .46, -1.0, .07, 0),
    box(.46, .14, .46, 1.0, .07, 0),
    cyl(.035, .035, 1.95, 5, 0, 1.05, 0),
  ]);
  G.skullCluster = mergeParts([
    ...skullParts(0, .22, 0, 1),
    ...skullParts(-.26, .18, .18, .9),
    ...skullParts(.25, .17, -.14, .88),
  ]);
  G.skullShelf = mergeParts([
    box(1.5, .09, .42, 0, 0, 0),
    box(1.5, .48, .06, 0, -.26, -.2),
    ...skullParts(-.45, .22, .02, 1),
    ...skullParts(.05, .2, .05, .92),
    ...skullParts(.5, .2, 0, .95),
  ]);
  G.skullEyes = mergeParts([
    sphere(.045, 6, 5, -.075, .02, .19),
    sphere(.045, 6, 5, .075, .02, .19),
  ]);
  G.limbs = mergeParts([
    capsule(.085, .46, 4, 7, 0, .1, 0, 0, .4, Math.PI / 2),
    capsule(.075, .34, 3, 6, .3, .12, .26, 0, 1.2, Math.PI / 2),
    capsule(.1, .52, 4, 7, -.35, .1, -.2, 0, .9, Math.PI / 2),
    sphere(.1, 6, 5, .6, .1, .1),
  ]);
  G.hook = mergeParts([
    cyl(.028, .028, 1.3, 6, 0, 2.35, 0),
    torus(.17, .028, 5, 10, 0, 1.62, 0, 0, 0, 0, Math.PI * 1.55),
    cone(.05, .16, 6, 0, 1.5, 0, Math.PI),
  ]);
  const cageParts = () => {
    const parts = [
      torus(.52, .03, 5, 14, 0, 3.1, 0, Math.PI / 2),
      torus(.52, .03, 5, 14, 0, 2.0, 0, Math.PI / 2),
      torus(.52, .03, 5, 14, 0, 2.55, 0, Math.PI / 2),
      torus(.14, .025, 5, 10, 0, 3.62, 0, Math.PI / 2),
      cyl(.02, .02, 1.7, 5, 0, 4.5, 0),
    ];
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      parts.push(cyl(.019, .019, 1.72, 5, Math.cos(angle) * .52, 2.55, Math.sin(angle) * .52));
    }
    return parts;
  };
  G.cage = mergeParts(cageParts());
  G.cageBody = mergeParts([
    ...cageParts(),
    box(.52, .3, .74, 0, 2.0, 0),
    capsule(.09, .34, 3, 6, -.24, 1.92, .1, 0, 0, .5),
    capsule(.09, .34, 3, 6, .24, 1.92, -.1, 0, 0, -.5),
    ...skullParts(0, 2.32, 0, 1),
  ]);
  G.hangingCorpse = mergeParts([
    cyl(.03, .03, 2.9, 6, 0, 4.2, 0),
    torus(.18, .03, 5, 10, 0, 2.68, 0, 0, 0, 0, Math.PI * 1.5),
    box(.6, .34, .5, 0, 2.2, 0),
    capsule(.1, .5, 3, 6, -.16, 1.86, .02, 0, 0, .12),
    capsule(.1, .5, 3, 6, .16, 1.86, -.02, 0, 0, -.12),
    ...skullParts(0, 2.52, .04, 1.05),
  ]);
  G.boneChime = mergeParts([
    cyl(.02, .02, 1.5, 5, 0, 4.3, 0),
    capsule(.06, .5, 3, 6, 0, 3.3, 0, 0, 0, 0),
    capsule(.055, .42, 3, 6, .16, 3.02, .08, .2, 0, .12),
    capsule(.055, .44, 3, 6, -.15, 3.06, -.08, -.2, 0, -.1),
    capsule(.05, .36, 3, 6, .08, 2.72, -.12, .1, 0, .18),
    ...skullParts(-.06, 2.46, .04, .95),
  ]);
  const pipeHeights = [1.5, 2.3, 3.1, 2.6, 1.8];
  const pipeParts = [box(1.5, .3, .58, 0, .15, 0)];
  pipeHeights.forEach((height, index) => {
    pipeParts.push(cyl(.11, .14, height, 8, -.56 + index * .28, .3 + height * .5, 0));
    pipeParts.push(torus(.13, .022, 5, 10, -.56 + index * .28, .3 + height * .78, 0, Math.PI / 2));
  });
  G.pipes = mergeParts(pipeParts);
  G.pipeFallen = mergeParts([
    cyl(.12, .15, 2.5, 8, 0, .16, 0, 0, 0, Math.PI / 2),
    cyl(.1, .12, 1.9, 8, .55, .3, .3, 0, .4, Math.PI / 2),
    torus(.14, .025, 5, 10, -1.2, .16, 0, 0, Math.PI / 2),
  ]);
  G.censer = mergeParts([
    cyl(.018, .018, 2.1, 5, 0, 4.2, 0),
    sphere(.2, 10, 7, 0, 3.05, 0),
    cone(.24, .34, 10, 0, 2.72, 0, Math.PI),
    torus(.2, .022, 5, 12, 0, 2.86, 0, Math.PI / 2),
    sphere(.09, 8, 6, 0, 2.44, 0),
  ]);
  G.pew = mergeParts([
    box(2.7, .12, .52, 0, .52, 0),
    box(2.7, .7, .1, 0, .88, -.24, -.18),
    box(.12, .5, .46, -1.2, .26, 0),
    box(.12, .5, .46, 1.2, .26, 0),
  ]);
  G.teeth = mergeParts([
    box(.9, .12, .42, 0, .06, 0),
    cone(.1, .38, 6, -.32, .24, 0),
    cone(.09, .32, 6, -.08, .22, .06),
    cone(.1, .4, 6, .18, .26, 0),
    cone(.085, .3, 6, .42, .2, -.06),
    cone(.08, .34, 6, .05, .2, -.12, 0, 0, .2),
  ]);
  G.wax = mergeParts([
    splatGeometry(4),
    cyl(.075, .09, .5, 7, -.24, .27, .18),
    cyl(.07, .085, .36, 7, .22, .2, -.16),
    cyl(.065, .08, .62, 7, .02, .33, .3),
  ]);
  G.flame = mergeParts([
    cone(.075, .26, 7, 0, .14, 0),
    cone(.045, .17, 6, .05, .24, .03, 0, 0, -.18),
    sphere(.055, 6, 5, -.03, .18, -.02),
  ]);
  G.brazier = mergeParts([
    cyl(.06, .06, .5, 6, 0, 2.15, 0, 0, 0, Math.PI / 2),
    torus(.26, .035, 5, 14, 0, 2.0, 0, Math.PI / 2),
    cyl(.24, .18, .3, 10, 0, 1.85, 0),
    cyl(.2, .2, .06, 10, 0, 1.7, 0),
    ico(.07, 0, -.08, 1.98, .05),
    ico(.06, 0, .09, 1.99, -.06),
    ico(.05, 0, 0, 2.0, .09),
  ]);
  G.bellCluster = mergeParts([
    torus(.4, .1, 8, 18, 0, .22, 0, Math.PI / 2),
    cyl(.42, .48, .16, 14, 0, .05, 0),
    sphere(.1, 8, 6, 0, -.08, 0),
    cyl(.03, .03, .55, 6, 0, .55, 0),
  ]);
  LIFE_GEOMETRY = G;
  return G;
}

// --- sector material sets ----------------------------------------------------

const LIFE_PALETTE = Object.freeze({
  bloodworks: Object.freeze({
    metal: 0x4b3a35, metalDeep: 0x241d1d, rust: 0x7a3b2a, bone: 0xc2ae91,
    gore: 0x5d1420, blood: 0x3a0509, oil: 0x0b0a0c, cloth: 0x2b1a1a,
    accent: 0xff3a3a, flame: 0xff9a3c, wax: 0xd9c39a, brass: 0x9a6a35,
  }),
  ossuary: Object.freeze({
    metal: 0x4c4860, metalDeep: 0x232338, rust: 0x6a5340, bone: 0xd0c4a3,
    gore: 0x4a1c2c, blood: 0x2a0716, oil: 0x0a0a12, cloth: 0x26223a,
    accent: 0xb98cff, flame: 0x9fd0ff, wax: 0xcdc6c0, brass: 0x7d6a45,
  }),
  choir: Object.freeze({
    metal: 0x6b5546, metalDeep: 0x2c211c, rust: 0x8a4a22, bone: 0xc9b08a,
    gore: 0x5d1614, blood: 0x360608, oil: 0x0d0a08, cloth: 0x3a1c16,
    accent: 0xffb15e, flame: 0xffc06a, wax: 0xe6d4a6, brass: 0xd0a05e,
  }),
});

const MATERIAL_CACHE = new WeakMap();
function lifeMaterials(materials, sector) {
  const key = LIFE_PALETTE[sector] ? sector : 'bloodworks';
  let bySector = MATERIAL_CACHE.get(materials);
  if (!bySector) { bySector = new Map(); MATERIAL_CACHE.set(materials, bySector); }
  if (bySector.has(key)) return bySector.get(key);
  const palette = LIFE_PALETTE[key];
  const make = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? .74,
      metalness: options.metalness ?? .2,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
    });
    material.name = `LifeProp_${key}_${options.role || 'prop'}`;
    material.userData.sharedLibrary = true;
    material.userData.decorFlicker = options.flicker || null;
    return material;
  };
  const set = {
    metal: make(palette.metal, { roughness: .58, metalness: .78, role: 'metal' }),
    metalDeep: make(palette.metalDeep, { roughness: .66, metalness: .62, role: 'metalDeep' }),
    rust: make(palette.rust, { roughness: .86, metalness: .34, role: 'rust' }),
    bone: make(palette.bone, { roughness: .82, metalness: .1, role: 'bone' }),
    gore: make(palette.gore, { roughness: .5, metalness: .06, role: 'gore' }),
    blood: make(palette.blood, { roughness: .28, metalness: .04, role: 'pool' }),
    oil: make(palette.oil, { roughness: .2, metalness: .42, role: 'oil' }),
    cloth: make(palette.cloth, { roughness: .93, metalness: .04, role: 'cloth' }),
    wax: make(palette.wax, { roughness: .46, metalness: .05, role: 'wax' }),
    brass: make(palette.brass, { roughness: .34, metalness: .86, role: 'brass' }),
    accent: make(palette.accent, { roughness: .34, metalness: .1, emissive: palette.accent, emissiveIntensity: 1.9, role: 'eyes', flicker: { base: 1.9, speed: 2.6, depth: .35 } }),
    flame: make(palette.flame, { roughness: .5, metalness: .02, emissive: palette.flame, emissiveIntensity: 2.2, role: 'flame', flicker: { base: 2.2, speed: 7.4, depth: .3 } }),
  };
  Object.values(set).forEach(material => { material.userData.sharedLibrary = true; });
  bySector.set(key, set);
  return set;
}

// --- placement field ---------------------------------------------------------

const ROLE_WEIGHT = Object.freeze({
  spawn: .25, entry: .25, exit: .3, hub: .7, loop: .85, arena: .85,
  ward: 1.1, side: 1.05, vault: 1.15, secret: 1.2,
  'side-flank': 1.05, flank: 1.05, crossfire: 1.15,
  'focal-encounter': .85, focal: .85, objective: 1.2,
});

function segmentDistance(px, pz, segment) {
  const dx = segment.bx - segment.ax, dz = segment.bz - segment.az;
  const length = dx * dx + dz * dz || 1;
  let t = ((px - segment.ax) * dx + (pz - segment.az) * dz) / length;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (segment.ax + dx * t), pz - (segment.az + dz * t));
}

function rectDistance(x, z, rect) {
  const dx = Math.max(rect[0] - x, 0, x - (rect[0] + rect[2]));
  const dz = Math.max(rect[1] - z, 0, z - (rect[1] + rect[3]));
  return Math.hypot(dx, dz);
}

function bandFromRect(x0, z0, x1, z1, role, index) {
  const areaCells = (x1 - x0) * (z1 - z0) / (CELL * CELL);
  return { x0, z0, x1, z1, role, index, weight: Math.sqrt(Math.max(1, areaCells)) * (ROLE_WEIGHT[role] ?? 1) };
}

function readBands(course, width, depth) {
  const bands = [];
  const rooms = course.rooms || course.roomPlan?.rooms || course.roomPlan;
  if (Array.isArray(rooms)) for (let index = 0; index < rooms.length; index++) {
    const room = rooms[index]; if (!room) continue;
    const bounds = room.bounds;
    if (bounds && Number.isFinite(bounds.minX)) { bands.push(bandFromRect(bounds.minX * CELL, bounds.minZ * CELL, bounds.maxX * CELL, bounds.maxZ * CELL, room.role || room.kind, index)); continue; }
    if (Array.isArray(room.rect)) { bands.push(bandFromRect(room.rect[0] * CELL, room.rect[1] * CELL, (room.rect[0] + room.rect[2]) * CELL, (room.rect[1] + room.rect[3]) * CELL, room.role || room.kind, index)); continue; }
    const center = room.center || room.anchor || room.position;
    if (Array.isArray(center)) {
      const size = room.size || room.dimensions || [4, 4];
      bands.push(bandFromRect((center[0] - size[0] * .5) * CELL, (center[1] - size[1] * .5) * CELL, (center[0] + size[0] * .5) * CELL, (center[1] + size[1] * .5) * CELL, room.role || room.kind, index));
    }
  }
  if (!bands.length) {
    const zones = course.layout?.zones || course.zones || [];
    for (let index = 0; index < zones.length; index++) {
      const rect = zones[index]?.rect;
      if (Array.isArray(rect) && rect.length >= 4) bands.push(bandFromRect(rect[0] * CELL, rect[1] * CELL, (rect[0] + rect[2]) * CELL, (rect[1] + rect[3]) * CELL, zones[index].role, index));
    }
  }
  if (!bands.length) bands.push(bandFromRect(0, 0, width, depth, 'entry', 0));
  return bands.filter(band => band.x1 - band.x0 > 3.2 && band.z1 - band.z0 > 3.2);
}

function anchorCircles(course) {
  const circles = [];
  const push = (x, z, r) => { if (Number.isFinite(x) && Number.isFinite(z)) circles.push({ x, z, r }); };
  for (const point of course.spawnPoints || []) push((point.x ?? point[0]) * CELL, (point.y ?? point[1]) * CELL, 1.5);
  const spawn = course.playerSpawn;
  if (spawn) push((spawn.x ?? spawn[0]) * CELL, (spawn.y ?? spawn[1]) * CELL, 2.8);
  const exit = course.exit;
  if (exit) push((exit.x ?? exit[0]) * CELL, (exit.y ?? exit[1]) * CELL, 3.0);
  for (const item of course.landmarks || course.layout?.landmarks || []) {
    if (!item?.anchor) continue;
    const size = item.size || [3, 3, 3];
    push(item.anchor[0] * CELL, item.anchor[1] * CELL, Math.max(size[0], size[2]) * .5 + 1.1);
  }
  for (const item of course.machinery || course.layout?.machinery || []) {
    if (!item?.anchor) continue;
    const span = item.span || [2, 2];
    push(item.anchor[0] * CELL, item.anchor[1] * CELL, Math.max(span[0], span[1]) * .5 + 1.2);
  }
  for (const item of course.setpieces || course.layout?.setpieces || []) {
    if (!item) continue;
    if (item.anchor) {
      const size = item.size || [item.width || 2, 2, item.width || 2];
      push(item.anchor[0] * CELL, item.anchor[1] * CELL, Math.max(size[0], size[2]) * .5 + 1.1);
    }
    if (Array.isArray(item.points)) for (const point of item.points) push(point[0] * CELL, point[1] * CELL, 2.5);
  }
  return circles;
}

function buildLifeField(course) {
  const w = Math.max(1, Math.floor(course.w || 12)), h = Math.max(1, Math.floor(course.h || 12));
  const width = w * CELL, depth = h * CELL;
  const cells = course.renderCells || course.cells || null;
  const wallSegments = [];
  const seen = new Set();
  const addSegment = (ax, az, bx, bz) => {
    const key = `${ax.toFixed(2)},${az.toFixed(2)},${bx.toFixed(2)},${bz.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    wallSegments.push({ ax, az, bx, bz });
  };
  if (Array.isArray(cells) && cells.length >= w * h) {
    for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
      const flags = cells[cy * w + cx];
      if (!flags) continue;
      const x0 = cx * CELL, z0 = cy * CELL;
      if (flags[0]) addSegment(x0, z0, x0 + CELL, z0);
      if (flags[1]) addSegment(x0 + CELL, z0, x0 + CELL, z0 + CELL);
      if (flags[2]) addSegment(x0, z0 + CELL, x0 + CELL, z0 + CELL);
      if (flags[3]) addSegment(x0, z0, x0, z0 + CELL);
    }
  }
  const bands = readBands(course, width, depth);
  // Room shells are real geometry even where the collision grid leaves a door
  // gap, so they register as hard walls for prop placement.  Door spans stay
  // clear as a side effect, which is exactly what a movement lane needs.
  for (const band of bands) {
    addSegment(band.x0, band.z0, band.x1, band.z0);
    addSegment(band.x0, band.z1, band.x1, band.z1);
    addSegment(band.x0, band.z0, band.x0, band.z1);
    addSegment(band.x1, band.z0, band.x1, band.z1);
  }
  const bucket = 8;
  const wallBuckets = new Map();
  for (const segment of wallSegments) {
    const key = `${Math.floor((segment.ax + segment.bx) * .5 / bucket)},${Math.floor((segment.az + segment.bz) * .5 / bucket)}`;
    const list = wallBuckets.get(key);
    if (list) list.push(segment); else wallBuckets.set(key, [segment]);
  }
  const lanes = [];
  for (const route of course.layout?.routes || course.routes || []) {
    const points = route.points || [];
    const clearance = Math.max(1.3, (route.width || 2) * .42);
    for (let i = 0; i < points.length - 1; i++) {
      lanes.push({ ax: points[i][0] * CELL, az: points[i][1] * CELL, bx: points[i + 1][0] * CELL, bz: points[i + 1][1] * CELL, clearance });
    }
  }
  const blocks = (course.blocks || []).map(([x, y]) => [x * CELL, y * CELL, CELL, CELL]);
  const avoid = anchorCircles(course);
  const field = {
    version: LIFE_VERSION, w, h, width, depth, bands, blocks, lanes, avoid, wallSegments,
    nearWalls(x, z, reach) {
      const reach2 = reach + bucket;
      const results = [];
      const cx = Math.floor(x / bucket), cz = Math.floor(z / bucket);
      for (let bz = cz - 1; bz <= cz + 1; bz++) for (let bx = cx - 1; bx <= cx + 1; bx++) {
        const list = wallBuckets.get(`${bx},${bz}`);
        if (!list) continue;
        for (const segment of list) {
          if (Math.max(segment.ax, segment.bx) < x - reach2 || Math.min(segment.ax, segment.bx) > x + reach2) continue;
          if (Math.max(segment.az, segment.bz) < z - reach2 || Math.min(segment.az, segment.bz) > z + reach2) continue;
          results.push(segment);
        }
      }
      return results;
    },
    accepts(x, z, radius, mode = 'ground') {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
      const margin = radius + .9;
      if (x < margin || z < margin || x > width - margin || z > depth - margin) return false;
      const wallGap = mode === 'flat' ? radius + .42 : radius + .6;
      for (const segment of this.nearWalls(x, z, wallGap + 1)) {
        if (segmentDistance(x, z, segment) < wallGap) return false;
      }
      const blockGap = mode === 'hanging' ? radius + 2.6 : mode === 'flat' ? radius + .9 : radius + 1.3;
      for (const rect of blocks) if (rectDistance(x, z, rect) < blockGap) return false;
      const laneScale = mode === 'flat' ? .5 : mode === 'hanging' ? .6 : 1;
      for (const lane of lanes) {
        const clearance = lane.clearance * laneScale;
        if (x < Math.min(lane.ax, lane.bx) - clearance - radius - 6 || x > Math.max(lane.ax, lane.bx) + clearance + radius + 6) continue;
        if (z < Math.min(lane.az, lane.bz) - clearance - radius - 6 || z > Math.max(lane.az, lane.bz) + clearance + radius + 6) continue;
        if (segmentDistance(x, z, lane) < radius + clearance) return false;
      }
      const avoidScale = mode === 'flat' ? .45 : 1;
      for (const circle of avoid) {
        if (Math.hypot(circle.x - x, circle.z - z) < radius + circle.r * avoidScale) return false;
      }
      return true;
    },
  };
  return field;
}

// --- layout sampling ---------------------------------------------------------

function lifeRng(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function seedFor(key) {
  let seed = (0x517cc1b7 ^ LIFE_VERSION) >>> 0;
  for (const tag of String(key)) seed = (Math.imul(seed ^ tag.charCodeAt(0), 2654435761)) >>> 0;
  return seed || 11;
}

function pickBand(field, rng, roles = null) {
  const bands = roles?.length ? field.bands.filter(band => roles.includes(band.role)) : field.bands;
  const pool = bands.length ? bands : field.bands;
  let total = 0;
  for (const band of pool) total += band.weight;
  let roll = rng() * total;
  for (const band of pool) { roll -= band.weight; if (roll <= 0) return band; }
  return pool[pool.length - 1];
}

function wallSpots(field, rng, options = {}) {
  const inset = options.inset ?? 1.35;
  const spacing = options.spacing ?? 3.2;
  const spots = [];
  for (const band of field.bands) {
    for (const side of [-1, 1]) {
      const x = side < 0 ? band.x0 + inset : band.x1 - inset;
      for (let z = band.z0 + inset; z <= band.z1 - inset; z += spacing * (.72 + rng() * .6)) {
        spots.push({ x: x + (rng() - .5) * .5, z: z + (rng() - .5) * .7, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2, along: 'z', band });
      }
    }
    for (const side of [-1, 1]) {
      const z = side < 0 ? band.z0 + inset : band.z1 - inset;
      for (let x = band.x0 + inset * 1.5; x <= band.x1 - inset * 1.5; x += spacing * (.78 + rng() * .6)) {
        spots.push({ x: x + (rng() - .5) * .7, z: z + (rng() - .5) * .5, yaw: side < 0 ? 0 : Math.PI, along: 'x', band });
      }
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = spots[i]; spots[i] = spots[j]; spots[j] = swap;
  }
  return spots;
}

function scatterSpots(field, rng, count, radius, mode, options = {}) {
  const spots = [];
  const jitter = options.jitter ?? .8;
  let attempts = 0;
  const limit = Math.max(24, count * 26);
  while (spots.length < count && attempts < limit) {
    attempts += 1;
    const band = pickBand(field, rng, options.roles);
    const x = band.x0 + 1.4 + rng() * Math.max(.2, band.x1 - band.x0 - 2.8);
    const z = band.z0 + 1.4 + rng() * Math.max(.2, band.z1 - band.z0 - 2.8);
    if (!field.accepts(x, z, radius, mode)) continue;
    let tooClose = false;
    for (const spot of spots) if (Math.hypot(spot.x - x, spot.z - z) < jitter) { tooClose = true; break; }
    if (tooClose) continue;
    spots.push({ x, z, band });
  }
  return spots;
}

const PROP_CLEARANCE = Object.freeze({
  barrel: .62, barrelTipped: 1.05, oil: .95, blood: 1.05, congealed: .95,
  bodyPile: .95, bonePile: .95, boneStack: 1.35, ribArc: 1.2, skull: .4,
  skullCluster: .75, skullShelf: .85, skullEyes: .4, limbs: .6, hook: .6,
  cage: 1.0, cageBody: 1.0, hangingCorpse: .9, boneChime: .9, pipes: 1.0,
  pipeFallen: 1.3, censer: .8, pew: 1.5, teeth: .8, wax: .85, flame: .2,
  brazier: .8, bellCluster: .7,
});
const PROP_MODE = Object.freeze({
  oil: 'flat', blood: 'flat', congealed: 'flat', wax: 'flat', flame: 'flat',
  hook: 'hanging', cage: 'hanging', cageBody: 'hanging', hangingCorpse: 'hanging',
  boneChime: 'hanging', censer: 'hanging', bellCluster: 'hanging', skullShelf: 'hanging',
  brazier: 'hanging',
});

function createPlacer(field, rng, spawn = null) {
  const items = new Map();
  const tallEntryProps = new Set(['ribArc', 'hook', 'cage', 'cageBody', 'hangingCorpse', 'boneChime', 'censer', 'bellCluster', 'skullShelf', 'brazier']);
  const place = (kind, x, z, options = {}) => {
    const entry = { x, z, y: options.y ?? 0, rx: options.rx ?? 0, ry: options.ry ?? 0, rz: options.rz ?? 0, s: options.s ?? 1 };
    const list = items.get(kind);
    if (list) list.push(entry); else items.set(kind, [entry]);
    return entry;
  };
  const tryPlace = (kind, x, z, options = {}, clearance = null) => {
    const radius = (clearance ?? PROP_CLEARANCE[kind] ?? .55) * (options.s ?? 1);
    if (spawn && tallEntryProps.has(kind) && Math.hypot(x - spawn.x, z - spawn.z) < 9) return false;
    if (!field.accepts(x, z, radius, PROP_MODE[kind] || 'ground')) return false;
    place(kind, x, z, options);
    return true;
  };
  return { items, place, tryPlace, rng };
}

// Shared with the sector detail kit in world-horror so wall furniture obeys the
// exact same wall/block/lane clearance rules as the instanced props.
export { buildLifeField, wallSpots, scatterSpots, createPlacer, lifeRng, seedFor, PROP_CLEARANCE, PROP_MODE };

// --- per-sector dressing recipes --------------------------------------------

function dressSkulls(placer, spots, eyeChance) {
  const rng = placer.rng;
  for (const spot of spots) {
    const base = { ry: rng() * Math.PI * 2, s: .85 + rng() * .35 };
    if (!placer.tryPlace('skull', spot.x, spot.z, base)) continue;
    if (rng() < eyeChance) placer.place('skullEyes', spot.x, spot.z, { y: .05, ry: base.ry, s: base.s });
  }
}

function dressBloodworks(placer, field, course) {
  const rng = placer.rng;
  const graftGallery = course.id === 'f2-graft-galleries';
  const walls = wallSpots(field, rng, { inset: 1.3, spacing: 3.0 });
  let barrels = 0;
  for (const spot of walls) {
    if (barrels >= (graftGallery ? 8 : 42)) break;
    if (graftGallery && !['vault', 'side'].includes(spot.band.role)) continue;
    if (rng() > .66) continue;
    const run = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < run; i++) {
      const along = (i - (run - 1) * .5) * .95;
      const x = spot.along === 'z' ? spot.x + (rng() - .5) * .35 : spot.x + along;
      const z = spot.along === 'z' ? spot.z + along : spot.z + (rng() - .5) * .35;
      const scale = .88 + rng() * .3;
      if (rng() < .3) {
        const yaw = spot.yaw + (rng() - .5) * .8;
        if (placer.tryPlace('barrelTipped', x, z, { y: .35 * scale, rz: Math.PI / 2, ry: yaw, s: scale })) {
          barrels += 1;
          placer.tryPlace('oil', x - Math.sin(yaw) * .55, z - Math.cos(yaw) * .55, { ry: rng() * Math.PI * 2, s: .8 + rng() * .7 }, .8);
        }
      } else if (placer.tryPlace('barrel', x, z, { ry: rng() * Math.PI * 2, s: scale })) {
        barrels += 1;
      }
    }
  }
  for (const spot of scatterSpots(field, rng, 20, 1.05, 'flat', graftGallery ? { roles: ['ward', 'hub', 'arena', 'vault'] } : {})) placer.tryPlace('blood', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * 1.5 }, 1.05);
  for (const spot of scatterSpots(field, rng, 13, .95, 'ground', graftGallery ? { roles: ['ward', 'hub', 'arena'] } : {})) placer.tryPlace('bodyPile', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .4 });
  for (const spot of scatterSpots(field, rng, 16, .6, 'ground', { jitter: .5 })) placer.tryPlace('limbs', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .5 });
  dressSkulls(placer, scatterSpots(field, rng, 12, .4, 'ground', { jitter: .45 }), .55);
  if (!graftGallery) {
    for (const spot of wallSpots(field, rng, { inset: 1.55, spacing: 6.4 })) {
      if (rng() < .45) placer.tryPlace('brazier', spot.x, spot.z, { y: 2.0, ry: spot.yaw, s: .9 + rng() * .3 });
    }
    for (const spot of scatterSpots(field, rng, 12, .85, 'ground', { jitter: .7 })) {
      if (!placer.tryPlace('wax', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .8 + rng() * .5 })) continue;
      for (let i = 0; i < 3; i++) placer.place('flame', spot.x + (rng() - .5) * .5, spot.z + (rng() - .5) * .5, { y: .38 + rng() * .28, s: .8 + rng() * .5 });
    }
  }
  for (const spot of scatterSpots(field, rng, graftGallery ? 5 : 10, .9, 'hanging', graftGallery ? { roles: ['ward', 'arena', 'vault'] } : {})) placer.tryPlace('hangingCorpse', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .25 });
  for (const spot of scatterSpots(field, rng, 7, .6, 'hanging')) placer.tryPlace('hook', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .3 });
  if (!graftGallery) for (const spot of scatterSpots(field, rng, 6, 1, 'hanging')) placer.tryPlace(rng() < .5 ? 'cageBody' : 'cage', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .2 });
}

function dressOssuary(placer, field) {
  const rng = placer.rng;
  const walls = wallSpots(field, rng, { inset: 1.35, spacing: 3.4 });
  for (const spot of walls) {
    if (rng() < .68) placer.tryPlace('boneStack', spot.x, spot.z, { ry: spot.yaw + Math.PI / 2, s: .9 + rng() * .3 });
    else if (rng() < .5) placer.tryPlace('ribArc', spot.x, spot.z, { ry: spot.yaw, s: .85 + rng() * .4 });
  }
  // Gate state changes the live collision grid, so a wall anchor can be closed
  // on a given run.  Fallback rows keep the stacked-bone silhouette present.
  for (const spot of scatterSpots(field, rng, 10, 1.35, 'ground', { jitter: 1.3 })) placer.tryPlace('boneStack', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .3 });
  for (const spot of scatterSpots(field, rng, 8, 1.2, 'ground', { jitter: 1.5 })) placer.tryPlace('ribArc', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .85 + rng() * .4 });
  for (const spot of scatterSpots(field, rng, 20, .95, 'ground')) placer.tryPlace('bonePile', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .85 + rng() * .5 });
  dressSkulls(placer, scatterSpots(field, rng, 16, .75, 'ground', { jitter: .8 }), .7);
  for (const spot of wallSpots(field, rng, { inset: 1.2, spacing: 7.2 })) placer.tryPlace('skullShelf', spot.x, spot.z, { y: 2.9, ry: spot.yaw, s: .9 + rng() * .3 });
  for (const spot of scatterSpots(field, rng, 12, .6, 'ground', { jitter: .5 })) placer.tryPlace('limbs', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .5 });
  for (const spot of scatterSpots(field, rng, 10, .95, 'flat')) placer.tryPlace('congealed', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .8 + rng() * 1.1 }, .95);
  for (const spot of scatterSpots(field, rng, 9, .9, 'hanging')) placer.tryPlace('boneChime', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .25 });
  for (const spot of scatterSpots(field, rng, 5, 1, 'hanging')) placer.tryPlace('cageBody', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .2 });
  for (const spot of scatterSpots(field, rng, 8, .62, 'ground')) {
    if (rng() < .5) placer.tryPlace('barrelTipped', spot.x, spot.z, { y: .35, rz: Math.PI / 2, ry: rng() * Math.PI * 2, s: .9 + rng() * .2 });
    else placer.tryPlace('barrel', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .2 });
  }
  for (const spot of scatterSpots(field, rng, 9, .85, 'ground', { jitter: .7 })) {
    if (!placer.tryPlace('wax', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .8 + rng() * .4 })) continue;
    for (let i = 0; i < 2; i++) placer.place('flame', spot.x + (rng() - .5) * .45, spot.z + (rng() - .5) * .45, { y: .34 + rng() * .26, s: .75 + rng() * .4 });
  }
}

function dressChoir(placer, field) {
  const rng = placer.rng;
  const walls = wallSpots(field, rng, { inset: 1.4, spacing: 3.2 });
  for (const spot of walls) {
    const roll = rng();
    if (roll < .5) placer.tryPlace('pipes', spot.x, spot.z, { ry: spot.yaw + (rng() < .5 ? Math.PI / 2 : -Math.PI / 2), s: .85 + rng() * .45 });
    else if (roll < .72) placer.tryPlace('pew', spot.x, spot.z, { ry: spot.yaw + Math.PI / 2, s: .95 + rng() * .2 });
    else if (roll < .86) placer.tryPlace('barrel', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .25 });
    else placer.tryPlace('teeth', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .3 });
  }
  for (const spot of scatterSpots(field, rng, 12, 1.4, 'ground')) placer.tryPlace('pew', spot.x, spot.z, { ry: rng() < .5 ? 0 : Math.PI / 2, s: .95 + rng() * .25 });
  for (const spot of scatterSpots(field, rng, 10, 1.25, 'ground')) placer.tryPlace('pipeFallen', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .3 });
  for (const spot of scatterSpots(field, rng, 14, .85, 'flat')) placer.tryPlace('wax', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: 1 + rng() * .7 }, .95);
  for (const spot of scatterSpots(field, rng, 10, .8, 'ground', { jitter: .6 })) {
    if (!placer.tryPlace('wax', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .8 + rng() * .4 })) continue;
    for (let i = 0; i < 3; i++) placer.place('flame', spot.x + (rng() - .5) * .5, spot.z + (rng() - .5) * .5, { y: .36 + rng() * .3, s: .8 + rng() * .5 });
  }
  for (const spot of scatterSpots(field, rng, 10, .8, 'hanging')) placer.tryPlace('censer', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .25 });
  for (const spot of scatterSpots(field, rng, 7, .9, 'hanging')) placer.tryPlace('hangingCorpse', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .2 });
  for (const spot of scatterSpots(field, rng, 5, .7, 'hanging')) placer.tryPlace('bellCluster', spot.x, spot.z, { y: 3.1, ry: rng() * Math.PI * 2, s: .9 + rng() * .3 });
  for (const spot of scatterSpots(field, rng, 10, .95, 'ground')) placer.tryPlace('bodyPile', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .4 });
  for (const spot of scatterSpots(field, rng, 10, .6, 'ground', { jitter: .5 })) placer.tryPlace('limbs', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .5 });
  dressSkulls(placer, scatterSpots(field, rng, 10, .4, 'ground', { jitter: .5 }), .6);
  for (const spot of scatterSpots(field, rng, 8, .8, 'ground')) placer.tryPlace('teeth', spot.x, spot.z, { ry: rng() * Math.PI * 2, s: .9 + rng() * .4 });
}

// --- instancing --------------------------------------------------------------

const KIND_GEOMETRY = Object.freeze({
  barrel: 'barrel', barrelTipped: 'barrel', oil: 'splat', blood: 'splat', congealed: 'splat',
  bodyPile: 'bodyPile', bonePile: 'bonePile', boneStack: 'boneStack', ribArc: 'ribArc',
  skull: 'skullCluster', skullCluster: 'skullCluster', skullShelf: 'skullShelf', skullEyes: 'skullEyes',
  limbs: 'limbs', hook: 'hook', cage: 'cage', cageBody: 'cageBody', hangingCorpse: 'hangingCorpse',
  boneChime: 'boneChime', pipes: 'pipes', pipeFallen: 'pipeFallen', censer: 'censer', pew: 'pew',
  teeth: 'teeth', wax: 'wax', flame: 'flame', brazier: 'brazier', bellCluster: 'bellCluster',
});

const KIND_MATERIAL = Object.freeze({
  barrel: 'metal', barrelTipped: 'metal', oil: 'oil', blood: 'blood', congealed: 'blood',
  bodyPile: 'gore', bonePile: 'bone', boneStack: 'bone', ribArc: 'bone', skull: 'bone',
  skullCluster: 'bone', skullShelf: 'bone', skullEyes: 'accent', limbs: 'gore', hook: 'metalDeep',
  cage: 'metalDeep', cageBody: 'metalDeep', hangingCorpse: 'cloth', boneChime: 'bone',
  pipes: 'brass', pipeFallen: 'brass', censer: 'brass', pew: 'cloth', teeth: 'bone',
  wax: 'wax', flame: 'flame', brazier: 'rust', bellCluster: 'brass',
});

const KIND_OPTIONS = Object.freeze({
  oil: { castShadow: false, receiveShadow: false },
  blood: { castShadow: false, receiveShadow: false },
  congealed: { castShadow: false, receiveShadow: false },
  skullEyes: { castShadow: false, receiveShadow: false },
  flame: { castShadow: false, receiveShadow: false },
  boneChime: { castShadow: false, receiveShadow: false },
  censer: { castShadow: false, receiveShadow: false },
  hook: { castShadow: false, receiveShadow: false },
});

function instancedProps(kind, entries, geometry, material) {
  const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), scale = new THREE.Vector3();
  entries.forEach((entry, index) => {
    euler.set(entry.rx, entry.ry, entry.rz);
    quaternion.setFromEuler(euler);
    position.set(entry.x, entry.y, entry.z);
    scale.setScalar(entry.s);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  const options = KIND_OPTIONS[kind] || {};
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  mesh.name = `WorldLife_${kind}`;
  mesh.userData.propKind = kind;
  mesh.userData.noBatch = true;
  mesh.computeBoundingSphere?.();
  return mesh;
}

export function buildWorldLifeKit(root, materials, course = {}) {
  if (!root || !materials || !course) return null;
  const sector = String(course.sectorId || course.id || 'bloodworks').toLowerCase();
  const geometry = lifeGeometry();
  const materialSet = lifeMaterials(materials, sector);
  const field = buildLifeField(course);
  const rng = lifeRng(seedFor(`${sector}:${field.w}x${field.h}:${course.index ?? 0}:${LIFE_VERSION}`));
  const spawn = Number.isFinite(course.playerSpawn?.x) && Number.isFinite(course.playerSpawn?.y)
    ? { x: course.playerSpawn.x * CELL, z: course.playerSpawn.y * CELL }
    : null;
  const placer = createPlacer(field, rng, spawn);
  if (sector === 'ossuary') dressOssuary(placer, field);
  else if (sector === 'choir') dressChoir(placer, field);
  else dressBloodworks(placer, field, course);
  const group = new THREE.Group();
  group.name = `WorldLife_${sector}`;
  group.userData.sectorId = sector;
  group.userData.lifeVersion = LIFE_VERSION;
  let total = 0;
  for (const [kind, entries] of placer.items) {
    if (!entries.length) continue;
    const geo = geometry[KIND_GEOMETRY[kind]];
    const mat = materialSet[KIND_MATERIAL[kind]];
    if (!geo || !mat) continue;
    group.add(instancedProps(kind, entries, geo, mat));
    total += entries.length;
  }
  group.userData.propCount = total;
  group.userData.instancedDraws = group.children.length;
  root.userData.worldLife = {
    sector, propCount: total, instancedDraws: group.children.length, version: LIFE_VERSION,
    field: { bands: field.bands.length, walls: field.wallSegments.length, lanes: field.lanes.length },
    counts: Object.fromEntries([...placer.items].map(([kind, list]) => [kind, list.length])),
  };
  return group;
}

// Bake static world transforms by material; keep all animated groups independent.
export function batchStaticWorld(root, protectedRoots=[]) {
 const protectedSet=new Set(protectedRoots.filter(Boolean)),groups=new Map();root.updateWorldMatrix(true,true);
 const inverseRoot=root.matrixWorld.clone().invert(),localMatrix=new THREE.Matrix4();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.userData?.noBatch||Array.isArray(mesh.material)||mesh.material.transparent)return;
  for(let p=mesh;p&&p!==root;p=p.parent)if(protectedSet.has(p)||p.userData?.noBatch)return;
  if(!mesh.geometry?.attributes.position||!mesh.geometry.attributes.normal||!mesh.geometry.attributes.uv)return;
  const key=`${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 });
 let removed=0,batches=0;const oldGeometries=new Set();
 for(const meshes of groups.values()){
  if(meshes.length<3)continue;const geos=meshes.map(mesh=>{let g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();localMatrix.multiplyMatrices(inverseRoot,mesh.matrixWorld);g.applyMatrix4(localMatrix);return g;});
  const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!merged)continue;
  const first=meshes[0],batch=new THREE.Mesh(merged,first.material);batch.name='WorldBatch_'+(first.material.name||first.material.id);batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;root.add(batch);batches++;
  for(const mesh of meshes){oldGeometries.add(mesh.geometry);mesh.removeFromParent();removed++;}
 }
 const retained=new Set();root.traverse(o=>{if(o.geometry)retained.add(o.geometry)});for(const g of oldGeometries)if(!retained.has(g))g.dispose();
 return {removed,batches};
}
