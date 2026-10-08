import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';
import { createBlackwaterMaterials, createBlackwaterSignMaterial } from './materials.js';
import {createHouseFurniturePlan,compileHouseInterior,compileHouseFloors} from './house-interior.js';
import {interiorPurpose,createDistrictFurniturePlan,compileDistrictFurniture,compileDistrictHouseFloors} from './furniture.js';
import {createAuthoredCottagePlan,coversAuthoredCottageCurtainWindow} from './cottage-authored.js';
import {createCape75Structure,compileCape75Structure,refreshCape75StructureDiagnostics,CAPE75_REPLACED_WALL_ROLES,CAPE75_REPLACED_FLOOR_ROLES} from './cape75-structure.js';
import {createCape75UpstairsArtPlan,compileCape75UpstairsArt} from './cape75-upstairs-art.js';
import {createEntranceDetailPlan,compileEntranceDetails} from './entrances.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function settings(options = {}) {
  const kind = ['house', 'corner', 'shop'].includes(options.kind) ? options.kind : 'shop';
  const width = Math.max(8, Number(options.width) || (kind === 'house' ? 10 : 16));
  const depth = Math.max(8, Number(options.depth) || 12);
  const height = Math.max(kind === 'house' ? 6.4 : 7, Number(options.height) || (kind === 'house' ? 8.7 : 11));
  return { kind, width, depth, height, seed: Number(options.seed) || 1042, enterable: Boolean(options.enterable), doorOffset: clamp(Number(options.doorOffset ?? 2), -width / 2 + 2.5, width / 2 - 2.5), label: options.label || (kind === 'corner' ? 'COASTAL PHARMACY' : kind === 'house' ? '26' : 'HARBOR STORES') };
}

// Planning precedes geometry: the same furniture plan drives collision and mesh.
export function createBuildingPlan(options = {}) {
  const s = settings(options);
  const floors = s.kind === 'house' ? 2 : /APARTMENTS/.test(s.label)?clamp(Math.round((s.height-3.5)/3.1),1,6)+1:clamp(Math.round((s.height - 3.5) / 3.1), 1, 3) + 1;
  const upperFloorHeight = s.kind === 'house' ? (s.height - 1.45) / 2 : (s.height - 3.5) / (floors - 1);
  const purpose=interiorPurpose(s),familyHouse=s.kind==='house'&&purpose.id==='family-home',pharmacy=purpose.id==='pharmacy';
  const furniture = familyHouse?createHouseFurniturePlan(s,upperFloorHeight):pharmacy&&s.enterable ? [
    { id: 'left-wall-shelving', position: [-s.width / 2 + .72, 1.04, 0], size: [.95, 2.08, s.depth - 2.2], slot: 'wood' },
    { id: 'rear-stock-shelf', position: [0, 1.04, -s.depth / 2 + .65], size: [s.width - 2.2, 2.08, .75], slot: 'wood' },
    { id: 'cash-counter', position: [s.width / 2 - 2, .54, s.depth / 2 - 3.5], size: [2.5, 1.08, 1.05], slot: 'wood' },
  ] : createDistrictFurniturePlan(s,s.kind==='house'?upperFloorHeight:3.34);
  const authoredCottage=createAuthoredCottagePlan(s,furniture,upperFloorHeight);
  const structure=createCape75Structure(s,furniture,upperFloorHeight);
  const upstairsArt=createCape75UpstairsArtPlan(s,structure);
  if(upstairsArt){
    const replaced=new Set(upstairsArt.replacedSolidIds);
    for(const solid of structure.solids)if(replaced.has(solid.id))solid.render=false;
    refreshCape75StructureDiagnostics(structure);
  }
  const exposedEdges = [
    { side: 'front', length: s.width, normal: [0, 0, 1] },
    { side: 'back', length: s.width, normal: [0, 0, -1] },
    { side: 'left', length: s.depth, normal: [-1, 0, 0] },
    { side: 'right', length: s.depth, normal: [1, 0, 0] },
  ];
  const frontBays=Math.max(2,Math.round(s.width/3.05)),frontBayWidth=s.width/frontBays;
  const focalCollapse=s.kind!=='house'&&/\bBELL\s+PHARMACY\b/i.test(s.label)&&s.width>=12?{
    type:'partial-upper-floor-collapse',side:'front',floor:1,firstBay:1,bayCount:2,
    x:[-s.width/2+frontBayWidth,-s.width/2+frontBayWidth*3],
    y:[3.5,s.height],depth:Math.min(3.4,s.depth*.34),
    cause:'front bearing wall and intermediate floor failed; roof joists remain anchored behind the scar',
    access:'upper floors stay separated from the playable shop by its continuous ceiling',
  }:null;
  // A single authored collapse leads the street. Missing-wall damage appears
  // only on sparse secondary buildings; broken glazing supplies smaller wear.
  const damage = s.kind === 'house' ? [] : focalCollapse?[focalCollapse]:s.seed%3===0?[
    { side: 'front', floor: 1, bay: Math.abs(s.seed + 1) % frontBays, cause: 'failed masonry lintel' },
    ...(s.kind === 'corner' ? [{ side: 'right', floor: Math.min(floors - 1, 2), bay: 0, cause: 'exposed corner after impact' }] : []),
  ]:[];
  const doorHeight=s.kind==='house'?upperFloorHeight-.17:2.8;
  return { settings: s, floors, upperFloorHeight,purpose,familyHouse,authoredCottage,structure,upstairsArt,entrances:createEntranceDetailPlan(s,doorHeight),routeFolio:upstairsArt?.routeFolio??null, residentialVariant: s.kind === 'house' ? Math.abs(s.seed) % 3 : null, damage,focalCollapse, roofVariant: Math.abs(s.seed) % 3, exposedEdges, furniture, rooms:s.enterable?(s.kind==='house'?[{id:familyHouse?'family-livingroom':`${purpose.id}-livingroom`,z:[0,s.depth/2-1.65]},{id:familyHouse?'family-kitchen':`${purpose.id}-bedroom-kitchen`,z:[-s.depth/2,0]}]:[{id:`${purpose.id}-public-room`,z:[0,s.depth/2]},{id:`${purpose.id}-service-room`,z:[-s.depth/2,0]}]):[],door: { center: [s.doorOffset, doorHeight/2, s.depth / 2], width: 4, height: doorHeight },rearDoor:s.enterable&&!pharmacy?{center:[s.doorOffset,doorHeight/2,-s.depth/2],width:4,height:doorHeight}:null,reservedZones: [{ role: 'entry-passage', x: [s.doorOffset - 2, s.doorOffset + 2], z: [-s.depth / 2+(pharmacy?1.2:0), s.depth / 2] }] };
}

export function architectureColliders(options = {}) {
  return createBuildingPlan(options).furniture.map(item => {const size=item.collisionSize||item.size;return{ id: item.id, x: item.position[0], z: item.position[2], width: size[0], depth: size[2], center: [...item.position], position: [...item.position], size: [...size], halfExtents: size.map(value => value / 2) };});
}

function compiler(materials) {
  const slots = new Map(), counts = {}, trianglesPerModule={}, structuralBounds=new Map(), placements = [];
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
  function append(slot, geometry, position, rotation = [0, 0, 0], role = 'structure') {
    if (!geometry.index) geometry.setIndex(Array.from({length: geometry.attributes.position.count}, (_, i) => i));
    const uv = geometry.getAttribute('uv');
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    if (uv && materials[slot]?.map && slot !== 'sign') {
      const metres = materials[slot].userData.textureMeters || 2.4;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        if (ny > nx && ny > nz) uv.setXY(i, p.getX(i) / metres, p.getZ(i) / metres);
        else if (nx > nz) uv.setXY(i, p.getZ(i) / metres, p.getY(i) / metres);
        else uv.setXY(i, p.getX(i) / metres, p.getY(i) / metres);
      }
    }
    euler.set(...rotation); quaternion.setFromEuler(euler);
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    if(role.startsWith('collapse-')){
      geometry.computeBoundingBox();
      if(!structuralBounds.has(role))structuralBounds.set(role,new THREE.Box3());
      structuralBounds.get(role).union(geometry.boundingBox);
    }
    if(uv&&materials[slot]?.map&&['brick','render','masonry','pale'].includes(slot)){
      const metres=materials[slot].userData.textureMeters||2.4;
      for(let i=0;i<p.count;i++){
        const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
        uv.setXY(i,(ny>nx&&ny>nz?p.getX(i):nx>nz?p.getZ(i):p.getX(i))/metres,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/metres);
      }
    }
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot).push(geometry);
    counts[role] = (counts[role] || 0) + 1;
    trianglesPerModule[role]=(trianglesPerModule[role]||0)+geometry.index.count/3;
    placements.push({ role, slot, position: [...position], rotation: [...rotation] });
  }
  function box(slot, position, size, rotation = [0, 0, 0], role = 'structure') {
    if (size.some(value => !Number.isFinite(value) || value <= .001)) return;
    append(slot, new THREE.BoxGeometry(...size), position, rotation, role);
  }
  function cylinder(slot, a, b, radius = .04, role = 'utility') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    append(slot, geometry, start.add(end).multiplyScalar(.5).toArray(), [0, 0, 0], role);
  }
  function triangle(slot, points, role = 'facade') {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2));
    geometry.setIndex([0, 1, 2]); geometry.computeVertexNormals();
    append(slot, geometry, [0, 0, 0], [0, 0, 0], role);
  }
  function finish(root) {
    const geometries = [], triangles = {}, meshes = [];
    for (const [slot, pieces] of slots) {
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (!geometry) throw new Error(`Blackwater could not compile ${slot}`);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, materials[slot]);
      mesh.name = `blackwater-${slot}-batch`; mesh.castShadow = slot !== 'glass'; mesh.receiveShadow = true;
      mesh.userData.blackwaterSlot = slot;
      root.add(mesh); geometries.push(geometry); meshes.push(mesh);
      triangles[slot] = geometry.index.count / 3;
    }
    return { geometries, triangles, meshes, moduleCounts: counts,trianglesPerModule,structuralBounds:Object.fromEntries([...structuralBounds].map(([role,bounds])=>[role,{min:bounds.min.toArray(),max:bounds.max.toArray()}])), placements };
  }
  function polygon(slot, face, points, outset, depth, role = 'broken-masonry') {
    const shape = new THREE.Shape(); shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {depth, steps:1, bevelEnabled:false});
    geometry.translate(0, 0, -depth / 2);
    const origin = face.point(0, 0, outset), axis = face.point(1, 0, outset);
    const yaw = Math.atan2(-(axis[2] - origin[2]), axis[0] - origin[0]);
    append(slot, geometry, origin, [0, yaw, 0], role);
  }
  function bevelBox(slot,p,size,r=.045,rotation=[0,0,0],role='beveled-furniture'){
    const [width,height,depth]=size;const radius=Math.min(r,width/5,height/5,depth/5),hx=width/2-radius,hy=height/2-radius;
    const shape=new THREE.Shape();shape.moveTo(-hx+radius,-hy);shape.lineTo(hx-radius,-hy);shape.quadraticCurveTo(hx,-hy,hx,-hy+radius);shape.lineTo(hx,hy-radius);shape.quadraticCurveTo(hx,hy,hx-radius,hy);shape.lineTo(-hx+radius,hy);shape.quadraticCurveTo(-hx,hy,-hx,hy-radius);shape.lineTo(-hx,-hy+radius);shape.quadraticCurveTo(-hx,-hy,-hx+radius,-hy);
    const g=new THREE.ExtrudeGeometry(shape,{depth:depth-radius*2,steps:1,bevelEnabled:true,bevelSize:radius,bevelThickness:radius,bevelSegments:2,curveSegments:4});g.translate(0,0,-(depth-radius*2)/2);append(slot,g,p,rotation,role);
  }
  return { box, cylinder, triangle, polygon, bevelBox, finish };
}

// Front-local modules: +Z is exterior, and every trim stays inside the lot.
function facadeFrame(side, width, depth) {
  const yaw = side === 'back' ? Math.PI : side === 'right' ? Math.PI / 2 : side === 'left' ? -Math.PI / 2 : 0;
  const span = side === 'front' || side === 'back' ? width : depth;
  const face = side === 'front' || side === 'back' ? depth / 2 : width / 2;
  return { span, box(writer, slot, along, y, outset, size, role = 'facade', roll = 0) {
    const x = Math.cos(yaw) * along + Math.sin(yaw) * (face + outset);
    const z = -Math.sin(yaw) * along + Math.cos(yaw) * (face + outset);
    writer.box(slot, [x, y, z], size, [0, yaw, roll], role);
  }, point(along, y, outset) {
    return [Math.cos(yaw) * along + Math.sin(yaw) * (face + outset), y, -Math.sin(yaw) * along + Math.cos(yaw) * (face + outset)];
  } };
}

function windowModule(w, face, along, y, width, height, boarded, broken, rng, slot = 'pale', interior = false) {
  // Dark reveal is 22 cm behind the trim; panes never sit on the wall plane.
  face.box(w, 'dark', along, y, -.3, [width, height, .055], 'window-recess');
  face.box(w, slot, along - width / 2 - .065, y, -.075, [.13, height + .27, .15], 'window-jamb');
  face.box(w, slot, along + width / 2 + .065, y, -.075, [.13, height + .27, .15], 'window-jamb');
  face.box(w, slot, along, y + height / 2 + .09, -.075, [width + .3, .18, .15], 'window-lintel');
  face.box(w, 'pale', along, y - height / 2 - .1, -.10, [width + .4, .2, .20], 'window-sill');
  face.box(w, 'wood', along, y, -.19, [.07, height - .08, .07], 'window-mullion');
  face.box(w, 'wood', along, y + .14, -.19, [width - .07, .065, .07], 'window-sash');
  const paneWidth = width / 2 - .07, paneHeight = height / 2 - .06;
  for (let column = 0; column < 2; column++) for (let row = 0; row < 2; row++) {
    const paneX = along + (column ? 1 : -1) * width / 4;
    const paneY = y + (row ? 1 : -1) * height / 4;
    if (broken && (column + row + Math.floor(rng() * 2)) % 2 === 0) {
      const p1 = face.point(paneX - paneWidth / 2, paneY - paneHeight / 2, -.23);
      const p2 = face.point(paneX + paneWidth / 2, paneY - paneHeight / 2, -.23);
      const p3 = face.point(paneX - paneWidth / 2, paneY - paneHeight / 2 + paneHeight * (.18 + rng() * .24), -.23);
      w.triangle('glass', [p1, p2, p3], 'broken-pane');
    } else face.box(w, 'glass', paneX, paneY, -.23, [paneWidth, paneHeight, .035], 'window-pane');
  }
  if (boarded) {
    for (let i = 0; i < 3; i++) {
      const plankY = y - height * .30 + i * height * .3;
      face.box(w, 'wood', along + (rng() - .5) * .12, plankY, -.04, [width + .22, .21 + rng() * .07, .075], 'boarded-window', (rng() - .5) * .1);
      face.box(w, 'rust', along - width * .38, plankY, -.015, [.026, .026, .012], 'board-nail');
      face.box(w, 'rust', along + width * .38, plankY, -.015, [.026, .026, .012], 'board-nail');
    }
  }
  if(interior)interiorWindowModule(w,face,along,y,width,height,boarded);
}

// Closed secondary glazing remains behind a deep inward-facing sash. These
// windows keep their authoritative perimeter wall; neither reads as an exit.
function interiorWindowModule(w,face,along,y,width,height,boarded){
  for(const side of [-1,1]){
    face.box(w,'pale',along+side*(width/2+.035),y,-.30,[.07,height+.12,.34],'interior-window-jamb-depth');
    face.box(w,'furnitureWood',along+side*(width/2+.075),y,-.43,[.13,height+.27,.10],'interior-window-frame');
  }
  face.box(w,'pale',along,y+height/2+.035,-.30,[width+.13,.07,.34],'interior-window-head-reveal');
  face.box(w,'furnitureWood',along,y+height/2+.095,-.43,[width+.28,.13,.10],'interior-window-header');
  face.box(w,'furnitureWood',along,y-height/2-.075,-.48,[width+.36,.15,.37],'interior-window-projecting-sill');
  face.box(w,'pale',along,y-height/2-.20,-.405,[width+.18,.13,.07],'interior-window-sill-apron');
  for(const side of [-1,1])for(const row of [-1,1])face.box(w,'glass',along+side*width/4,y+row*height/4,-.362,[width/2-.055,height/2-.055,.018],'closed-interior-window-glazing');
  face.box(w,'furnitureWood',along,y,-.405,[.075,height,.07],'interior-window-mullion');
  face.box(w,'furnitureWood',along,y+.06,-.405,[width,.075,.07],'interior-window-sash');
  if(boarded){
    for(let i=0;i<3;i++){
      const plankY=y-height*.31+i*height*.30,roll=(i-1)*.045;
      face.box(w,'furnitureWood',along+(i===1?.045:0),plankY,-.50,[width+.10,.19,.055],'interior-boarded-shut-window',roll);
      for(const side of [-1,1])face.box(w,'rust',along+side*width*.39,plankY+side*width*.39*Math.sin(roll),-.537,[.023,.023,.015],'interior-board-nail');
    }
  }
  // Gathered curtains have unequal hems and folded depth instead of an opaque
  // rectangle covering the aperture. Boarded windows retain one torn panel.
  const authoredPanel=w.coversAuthoredCurtainWindow?.(face.point(along,y,0));
  for(const side of authoredPanel?[]:boarded?[1]:[-1,1]){
    const edge=along+side*(width/2-.035),top=y+height/2+.045,bottom=y-height/2-.06;
    const points=[[edge-side*.15,top],[edge+side*.11,top],[edge+side*.16,bottom+.09],[edge+side*.055,bottom],[edge-side*.12,bottom+.05]];
    w.polygon('fabric',face,side>0?points:points.reverse(),-.55,.012,'gathered-window-curtain');
    face.box(w,'fabric',edge-side*.045,(top+bottom)/2,-.573,[.028,top-bottom-.07,.025],'curtain-fold');
  }
  face.box(w,'metal',along,y+height/2+.14,-.59,[width+.52,.025,.026],'interior-curtain-rod');
}

function wallWithWindows(w, face, y0, height, count, rng, material = 'brick', house = false, damageBay = -1, interior = false,skipBays=[]) {
  const bay = face.span / count;
  const windowWidth = Math.min(house ? 1.18 : 1.30, bay - .65);
  const windowHeight = Math.min(1.72, height - .95);
  const y = y0 + height * .51;
  // Infill around apertures, rather than a box hidden behind glass.
  const low = y - windowHeight / 2, high = y + windowHeight / 2;
  for (let i = 0; i < count; i++) {
    const x = -face.span / 2 + bay * (i + .5);
    if(skipBays.includes(i))continue;
    if (i === damageBay) { damagedBay(w, face, x, y0, height, bay, rng,material); continue; }
    face.box(w, material, x, (y0 + low) / 2, -.21, [bay, low - y0, .26], 'wall-infill');
    face.box(w, material, x, (high + y0 + height) / 2, -.21, [bay, y0 + height - high, .26], 'wall-infill');
    const left = x - bay / 2, right = x + bay / 2;
    face.box(w, material, (left + x - windowWidth / 2) / 2, y, -.21, [(bay - windowWidth) / 2, windowHeight, .26], 'wall-pier');
    face.box(w, material, (right + x + windowWidth / 2) / 2, y, -.21, [(bay - windowWidth) / 2, windowHeight, .26], 'wall-pier');
    windowModule(w, face, x, y, windowWidth, windowHeight, rng() < .28, rng() < .40, rng, house ? 'wood' : 'pale',interior);
  }
}

function damagedBay(w, face, x, y0, height, bay, rng,outer='brick') {
  const left=x-bay/2, right=x+bay/2, top=y0+height;
  // A real irregular aperture exposes separate outer brick, inner plaster,
  // floor slab and torn lintel reinforcement. No opaque wall sits behind it.
  const lo=y0+.31, hi=top-.25;
  w.polygon(outer,face,[[left,y0],[right,y0],[right,lo+.27],[x+bay*.29,lo+.13],[x+bay*.12,lo+.30],[x-bay*.08,lo+.07],[left,lo+.21]],-.21,.28,'fractured-brick-sill');
  w.polygon(outer,face,[[left,top],[left,hi-.23],[x-bay*.33,hi-.34],[x-bay*.18,hi+.08],[x+bay*.05,hi-.13],[x+bay*.22,hi+.09],[right,hi-.12],[right,top]],-.21,.28,'fractured-brick-lintel');
  face.box(w,'render',x,y0+height*.48,-.55,[bay-.50,height-.75,.045],'exposed-inner-wall');
  face.box(w,'dark',x,y0+height*.49,-.48,[bay-.83,height-.95,.035],'collapsed-room-recess');
  face.box(w,'masonry',x,y0+.055,-.67,[bay,.11,1.05],'exposed-floor-slab');
  for(const direction of [-1,1]){
    face.box(w,'masonry',x+direction*(bay/2-.11),y0+height*.51,-.28,[.22,height,.33],'exposed-structure-edge');
    for(let j=0;j<7;j++){
      const bx=x+direction*(bay/2-.21-rng()*.08), by=y0+.45+j*(height-.75)/7;
      face.box(w,outer==='render'?'wood':'brick',bx,by,-.14,[.22+rng()*.13,.14,.26],'torn-brick-edge',direction*.04);
    }
  }
  for(let j=0;j<4;j++){
    const bx=x-bay*.32+j*bay*.21;
    w.cylinder('rust',face.point(bx,top-.16,-.1),face.point(bx+.12*(j%2?1:-1),top-.53-rng()*.39,-.04),.014,'exposed-lintel-rebar');
  }
  face.box(w,'wood',x-bay*.16,y0+height*.50,-.08,[.082,height*.86,.07],'broken-window-jamb',-.13);
  face.box(w,'wood',x+bay*.10,y0+.24,-.08,[bay*.78,.075,.08],'fallen-window-sash',.12);
  for(let j=0;j<5;j++){
    const px=x+(rng()-.5)*(bay-.48), py=y0+.19+rng()*.22;
    face.box(w,j%2?outer:'pale',px,py,-.08,[.18+rng()*.17,.10+rng()*.09,.16],'broken-sill-fragment');
  }
}

function pharmacyCollapse(w,plan,rng){
  const s=plan.settings,c=plan.focalCollapse,face=facadeFrame('front',s.width,s.depth);
  const [left,right]=c.x,[floor,top]=c.y,width=right-left,center=(left+right)/2,depth=c.depth,roomHeight=top-floor;
  // Two bays share one structural failure. Jagged side piers and sill retain
  // outer brick thickness; a real room starts behind that surviving skin.
  w.polygon('brick',face,[[left,floor],[left,top],[left+.68,top],[left+.46,top-roomHeight*.16],[left+.88,top-roomHeight*.25],[left+.57,top-roomHeight*.35],[left+.74,top-roomHeight*.47],[left+.39,floor+roomHeight*.17],[left+.63,floor+roomHeight*.095]],-.20,.34,'collapse-fractured-left-pier');
  w.polygon('brick',face,[[right,floor],[right-.52,floor+roomHeight*.07],[right-.80,floor+roomHeight*.18],[right-.49,top-roomHeight*.48],[right-.70,top-roomHeight*.35],[right-.34,top-roomHeight*.22],[right-.60,top-roomHeight*.10],[right-.43,top],[right,top]],-.20,.34,'collapse-fractured-right-pier');
  w.polygon('brick',face,[[left,floor],[right,floor],[right,floor+.52],[right-.63,floor+.64],[center+.93,floor+.28],[center+.49,floor+.43],[center-.44,floor+.62],[center-1.04,floor+.49],[left+.52,floor+.80],[left,floor+.67]],-.20,.34,'collapse-fractured-sill');
  face.box(w,'masonry',center,floor+.10,-(depth+.38)/2,[width,.20,depth-.08],'collapse-exposed-floor-concrete');
  face.box(w,'wood',center,floor+.225,-(depth+.43)/2,[width-.15,.05,depth-.18],'collapse-floor-finish-layer');
  // All back and side walls are metres inward, rather than an opaque rectangle
  // just behind the opening. Existing shop ceiling still closes ground access.
  w.polygon('masonry',face,[[left-.04,floor],[right+.04,floor],[right+.04,top-.06],[right-.50,top-.18],[right-.82,top-.31],[center+1.06,top-.15],[center+.64,top-.37],[center-.16,top-.13],[center-.62,top-.28],[left+1.02,top-.11],[left+.48,top-.23],[left-.04,top-.13]],-depth,.18,'collapse-deep-room-back-wall');
  for(const side of [-1,1]){
    const x=side<0?left+.08:right-.08;
    face.box(w,'masonry',x,(floor+top)/2,-(depth+.37)/2,[.18,top-floor,depth-.19],'collapse-room-side-structure');
    const plasterX=x-side*.105;
    if(side<0){
      // The camera-facing upper cheek lost one contiguous plaster sheet.
      // Lower-room finish and a rear upper strip remain attached; the torn
      // edge exposes the existing neutral structure, with actual layer depth.
      const plasterDepth=depth-.39,bottom=floor+.145,ceiling=top-.145;
      const tearBase=Math.min(top-.8,floor+plan.upperFloorHeight-.15),tearHeight=ceiling-tearBase;
      const frontZ=s.depth/2-(depth+.50)/2+plasterDepth/2;
      const sideFace={point(along,y,outset){return[plasterX+outset,y,frontZ-along];}};
      w.polygon('render',sideFace,[[0,bottom],[plasterDepth,bottom],[plasterDepth,ceiling],[plasterDepth*.55,ceiling],[plasterDepth*.59,ceiling-tearHeight*.18],[plasterDepth*.43,ceiling-tearHeight*.34],[plasterDepth*.49,ceiling-tearHeight*.54],[plasterDepth*.28,ceiling-tearHeight*.83],[plasterDepth*.33,ceiling-tearHeight*.94],[0,tearBase]],0,.034,'collapse-torn-camera-side-plaster');
    }else face.box(w,'render',plasterX,(floor+top)/2,-(depth+.50)/2,[.034,top-floor-.29,depth-.39],'collapse-room-side-plaster');
    face.box(w,'wood',x-side*.055,floor+.40,-(depth+.5)/2,[.09,.16,depth-.43],'collapse-room-skirting');
  }
  const lowerPlasterTop=Math.min(top-1.12,floor+plan.upperFloorHeight-.32);
  w.polygon('pale',face,[[left+.58,floor+.56],[right-.72,floor+.56],[right-.70,lowerPlasterTop-.18],[center+.72,lowerPlasterTop-.34],[center+.31,lowerPlasterTop],[center-.43,lowerPlasterTop-.23],[left+.54,lowerPlasterTop-.06]],-depth+.108,.012,'collapse-peeling-inner-plaster');
  const rearCeilingOutset=-depth+.61;
  face.box(w,'masonry',center,top-.20,rearCeilingOutset,[width-.20,.17,1.22],'collapse-ceiling-concrete-layer');
  face.box(w,'pale',center,top-.32,rearCeilingOutset,[width-.26,.065,1.18],'collapse-ceiling-plaster-layer');
  const midFloor=floor+plan.upperFloorHeight;
  if(midFloor<top-.2){
    // The intermediate slab tore away in the centre. Unequal surviving ends,
    // an anchored rear lip and a rotated front beam show how the failure spread.
    for(const [start,end]of [[left,left+1.55],[right-1.04,right]]){
      const x=(start+end)/2,length=end-start;
      face.box(w,'masonry',x,midFloor-.08,-(depth+.35)/2,[length,.22,depth-.12],'collapse-surviving-intermediate-slab');
      face.box(w,'wood',x,midFloor+.055,-(depth+.37)/2,[length-.10,.045,depth-.18],'collapse-intermediate-floor-finish');
      w.polygon('pale',face,[[start,midFloor-.24],[end,midFloor-.16],[end-.13,midFloor+.11],[start+.32,midFloor+.07],[start,midFloor+.12]],-.41,.11,'collapse-torn-floor-belt');
    }
    face.box(w,'masonry',center,midFloor-.085,-depth+.38,[width-.17,.20,.73],'collapse-intermediate-rear-slab-lip');
    face.box(w,'masonry',right-1.08,midFloor-.36,-.63,[2.17,.23,.27],'collapse-crooked-slab-edge',-.18);
    for(let i=0;i<5;i++){
      const x=left+1.4+i*(width-2.4)/5;
      w.cylinder('rust',face.point(x,midFloor-.07,-depth+.64),face.point(x+.14,midFloor-.23,-depth+1.16),.022,'collapse-torn-intermediate-rebar');
    }
  }
  for(let i=0;i<5;i++){
    const x=left+.93+i*(width-1.66)/4,tipOutset=i%2?-.47:-.82,tipY=top-.18-(i%2)*.22;
    w.cylinder('wood',face.point(x,top-.16,-depth+.12),face.point(x+(i===3?.11:0),tipY,tipOutset),.075,'collapse-exposed-roof-joist');
    w.cylinder('rust',face.point(x+.06,top-.12,tipOutset-.21),face.point(x+.17,top-.70-(i%3)*.16,tipOutset+.12),.021,'collapse-hanging-roof-rebar');
  }
  w.polygon('pale',face,[[left+1.39,top-.94],[left+1.40,top-.83],[left+2.65,top-.94],[left+2.63,top-1.05],[left+2.33,top-1.06],[left+2.05,top-1.02],[left+1.79,top-1.13]],-1.73,1.17,'collapse-hanging-ceiling-fragment');
  // One surviving casement twists in the opening; no intact pane fills it.
  const frameX=left+1.20,frameY=top-2.35,roll=-.18,fw=1.25,fh=1.74;
  const member=(dx,dy,size)=>face.box(w,'wood',frameX+dx*Math.cos(roll)-dy*Math.sin(roll),frameY+dx*Math.sin(roll)+dy*Math.cos(roll),-.66,size,'collapse-crooked-surviving-casement',roll);
  for(const side of [-1,1]){member(side*fw/2,0,[.085,fh,.095]);member(0,side*fh/2,[fw,.085,.095]);}
  const strap=(a,b)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),vector=end.clone().sub(start),length=vector.length();
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize()));
    w.box('rust',start.add(end).multiplyScalar(.5).toArray(),[.065,length,.017],rotation.toArray().slice(0,3),'collapse-bent-casement-attachment');
  };
  for(const dy of [-.55,.55]){
    const dx=-fw/2,fx=frameX+dx*Math.cos(roll)-dy*Math.sin(roll),fy=frameY+dx*Math.sin(roll)+dy*Math.cos(roll);
    const anchor=face.point(left+.33,fy+.10,-.17),bend=face.point(left+.40,fy+.10,-.43),attachment=face.point(fx,fy,-.66);
    strap(anchor,bend);strap(bend,attachment);
  }
  const panePoints=[[-fw/2+.05,-fh/2+.06],[fw/2-.05,-fh/2+.06],[-fw/2+.05,-fh/2+.42]].map(([dx,dy])=>face.point(frameX+dx*Math.cos(roll)-dy*Math.sin(roll),frameY+dx*Math.sin(roll)+dy*Math.cos(roll),-.70));
  w.triangle('glass',panePoints,'collapse-casement-glass-shard');
  for(const side of [-1,1]){
    const edge=side<0?left:right;
    for(let i=0;i<10;i++){
      const y=floor+.75+i*(top-floor-1.0)/10,along=edge-side*(.13+rng()*.22);
      face.box(w,i%3?'brick':'masonry',along,y,-.13,[.19+rng()*.10,.12+rng()*.05,.19],'collapse-chipped-masonry-edge',side*.08);
    }
    // Branching cracks terminate at the broken load-bearing pier, and remain
    // on its adjacent solid strip rather than cutting randomly across panes.
    const crack=[[edge+side*.10,top-1.40],[edge+side*.26,top-2.14],[edge+side*.18,top-2.69],[edge+side*.47,top-3.31]];
    for(let j=0;j<crack.length-1;j++)w.cylinder('dark',face.point(...crack[j],-.063),face.point(...crack[j+1],-.063),.014,'collapse-branching-wall-crack');
    w.cylinder('dark',face.point(...crack[1],-.063),face.point(edge+side*.58,top-2.30,-.063),.010,'collapse-branching-wall-crack');
  }
  for(let i=0;i<12;i++){
    const x=i%2?left+.9+rng()*.6:right-.7-rng()*.6;
    face.box(w,i%3?'brick':'pale',x,floor+.30+rng()*.12,-.65-rng()*.9,[.12+rng()*.20,.11,.15+rng()*.18],'collapse-upper-floor-spall',rng()*.14);
  }
}

function utilityModules(w, s) {
  const face = facadeFrame('right', s.width, s.depth);
  const drain = face.point(-s.depth / 2 + .35, .3, -.06);
  const top = face.point(-s.depth / 2 + .35, s.height - .3, -.06);
  w.cylinder('rust', drain, top, .045, 'drainpipe');
  w.cylinder('rust', top, face.point(-s.depth / 2 + .6, s.height - .08, -.08), .045, 'drain-elbow');
  for (let y = 1; y < s.height - .4; y += 2.6) face.box(w, 'metal', -s.depth / 2 + .35, y, -.04, [.18, .065, .055], 'pipe-clip');
  face.box(w, 'metal', .7, 1.65, -.12, [.65, .8, .22], 'meter-box');
  face.box(w, 'dark', .7, 1.8, -.015, [.4, .18, .018], 'meter-window');
  face.box(w, 'rust', .7, 1.15, -.10, [.76, .085, .19], 'meter-flange');
  const points = [face.point(.7, 2.1, -.06), face.point(.7, 2.65, -.06), face.point(2.2, 2.72, -.06), face.point(s.depth / 2 - .35, 2.65, -.06)];
  for (let i = 0; i < points.length - 1; i++) w.cylinder('dark', points[i], points[i + 1], .021, 'utility-conduit');
  const front = facadeFrame('front', s.width, s.depth);
  for (const x of [-s.width / 2 + .6, s.width / 2 - .6]) {
    front.box(w, 'metal', x, 2.95, -.04, [.25, .3, .08], 'lamp-backplate');
    front.box(w, 'rust', x, 2.93, .10, [.06, .05, .28], 'lamp-arm');
    front.box(w, 'metal', x, 2.95, .21, [.3, .15, .12], 'lamp-housing');
  }
}

function shop(w, plan, rng) {
  const s = plan.settings;
  const collapse=plan.focalCollapse;
  const front = facadeFrame('front', s.width, s.depth);
  // The lower floor is genuinely hollow, including the shop window apertures.
  w.box('masonry', [0, .065, 0], [s.width - .02, .13, s.depth - .02], [0, 0, 0], 'interior-floor');
  w.box('render', [0, 3.42, 0], [s.width - .02, .16, s.depth - .02], [0, 0, 0], 'interior-ceiling');
  for (const side of ['left', 'right', 'back']) {
    const face = facadeFrame(side, s.width, s.depth);
    if(side==='back'&&plan.rearDoor)shopRearDoorWall(w,face,s);
    else face.box(w, 'masonry', 0, 1.75, -.18, [face.span, 3.5, .36], 'ground-floor-wall');
    // Service entrances and vents sit on the exterior, away from the front portal.
    if (side === 'back'&&!plan.rearDoor) {
      face.box(w, 'metal', -s.width / 2 + 1.8, 1.1, -.03, [1.2, 2.18, .06], 'service-door');
      for (let i = 0; i < 7; i++) face.box(w, 'rust', s.width / 2 - 2, 2.1 + i * .07, -.025, [1.2, .035, .035], 'rear-vent');
    }
  }
  const doorLeft = s.doorOffset - 2, doorRight = s.doorOffset + 2;
  const leftWidth = doorLeft + s.width / 2, rightWidth = s.width / 2 - doorRight;
  front.box(w, 'brick', 0, 3.15, -.18, [s.width, .70, .36], 'shop-lintel');
  for (const [start, width] of [[-s.width / 2, leftWidth], [doorRight, rightWidth]]) {
    const x = start + width / 2;
    const openingWidth = Math.max(.1, width - .75);
    front.box(w, 'brick', x, .40, -.18, [width, .8, .36], 'shop-plinth');
    front.box(w, 'brick', start + .19, 1.75, -.18, [.38, 3.5, .36], 'shop-pier');
    front.box(w, 'brick', start + width - .19, 1.75, -.18, [.38, 3.5, .36], 'shop-pier');
    if (width > 1.1) windowModule(w, front, x, 1.69, openingWidth, 1.78, rng()<.55, true, rng, 'metal');
    else front.box(w, 'brick', x, 1.75, -.18, [width, 3.5, .36], 'narrow-shop-pier');
  }
  front.box(w, 'metal', doorLeft - .07, 1.4, -.07, [.14, 2.8, .14], 'door-frame');
  front.box(w, 'metal', doorRight + .07, 1.4, -.07, [.14, 2.8, .14], 'door-frame');
  front.box(w, 'metal', s.doorOffset, 2.87, -.07, [4.28, .14, .14], 'door-frame');
  if (!s.enterable) front.box(w, 'dark', s.doorOffset, 1.37, -.24, [3.75, 2.68, .05], 'closed-door');
  else {
    // Displaced sliding door is parked beside the opening, not across it.
    front.box(w, 'metal', doorLeft - .21, 1.4, -.2, [.18, 2.7, .18], 'parked-door-edge');
    front.box(w, 'masonry', s.doorOffset, .10, -.14, [3.95, .06, .34], 'entry-threshold');
  }
  for (let floor = 1; floor < plan.floors; floor++) {
    const y0 = 3.5 + (floor - 1) * plan.upperFloorHeight;
    for (const side of ['front', 'left', 'right', 'back']) {
      const face = facadeFrame(side, s.width, s.depth);
      const bays = Math.max(2, Math.round(face.span / 3.05));
      const failed = plan.damage.find(d=>d.side===side&&d.floor===floor);
      const skipBays=side==='front'&&collapse?Array.from({length:collapse.bayCount},(_,i)=>collapse.firstBay+i):[];
      wallWithWindows(w, face, y0, plan.upperFloorHeight, bays, rng, s.kind === 'corner' && side === 'right' ? 'render' : 'brick',false,failed?.bay??-1,false,skipBays);
      if(side==='front'&&collapse){
        for(const [start,end]of [[-face.span/2,collapse.x[0]],[collapse.x[1],face.span/2]])face.box(w,'pale',(start+end)/2,y0+.08,-.06,[end-start,.16,.12],'floor-belt');
      }else face.box(w, 'pale', 0, y0 + .08, -.06, [face.span, .16, .12], 'floor-belt');
    }
  }
  if(collapse)pharmacyCollapse(w,plan,rng);
  // Cornice has a real stepped profile and closed corners inside the footprint.
  for (const side of ['front', 'left', 'right', 'back']) {
    const face = facadeFrame(side, s.width, s.depth);
    if(collapse&&side==='front'){
      for(const [start,end]of [[-face.span/2,collapse.x[0]],[collapse.x[1],face.span/2]]){
        const center=(start+end)/2,length=end-start;
        face.box(w,'pale',center,s.height-.34,-.11,[length,.16,.22],'cornice-base');
        face.box(w,'pale',center,s.height-.16,-.065,[length,.2,.13],'cornice-cap');
        face.box(w,'brick',center,s.height+.18,-.17,[length,.42,.34],'roof-parapet');
        face.box(w,'masonry',center,s.height+.43,-.18,[length,.10,.36],'parapet-coping');
      }
      const [left,right]=collapse.x;
      w.polygon('brick',face,[[left,s.height],[left,s.height+.40],[left+.19,s.height+.33],[left+.33,s.height+.37],[left+.66,s.height+.10],[left+.91,s.height+.055],[left+.91,s.height]],-.17,.34,'collapse-broken-parapet');
      w.polygon('brick',face,[[right-.71,s.height],[right-.71,s.height+.045],[right-.45,s.height+.20],[right-.35,s.height+.14],[right-.16,s.height+.36],[right,s.height+.40],[right,s.height]],-.17,.34,'collapse-broken-parapet');
      for(const side of [-1,1])face.box(w,'pale',side<0?left+.10:right-.06,s.height-.29,-.13,[.35,.15,.20],'collapse-chipped-cornice',side*.17);
    }else{
    face.box(w, 'pale', 0, s.height - .34, -.11, [face.span, .16, .22], 'cornice-base');
    face.box(w, 'pale', 0, s.height - .16, -.065, [face.span, .2, .13], 'cornice-cap');
    if(s.enterable&&side==='front'){
      const gapStart=s.width/2-3.2;
      face.box(w,'brick',(-s.width/2+gapStart)/2,s.height+.18,-.17,[s.width-3.2,.42,.34],'roof-parapet');
      face.box(w,'masonry',(-s.width/2+gapStart)/2,s.height+.43,-.18,[s.width-3.2,.10,.36],'parapet-coping');
      w.polygon('brick',face,[[gapStart,s.height],[gapStart,s.height+.39],[gapStart+.25,s.height+.22],[gapStart+.41,s.height+.31],[gapStart+.58,s.height+.09],[s.width/2,s.height+.07],[s.width/2,s.height]],-.17,.34,'broken-parapet-silhouette');
      for(let j=0;j<3;j++)w.cylinder('rust',face.point(gapStart+.6+j*.45,s.height+.06,-.14),face.point(gapStart+.76+j*.45,s.height+.38+j*.04,-.10),.014,'roof-edge-exposed-rebar');
    }else{
      face.box(w, 'brick', 0, s.height + .18, -.17, [face.span, .42, .34], 'roof-parapet');
      face.box(w, 'masonry', 0, s.height + .43, -.18, [face.span, .10, .36], 'parapet-coping');
    }
    }
  }
  if(collapse){
    const [left,right]=collapse.x,minZ=-s.depth/2+.2,maxZ=s.depth/2-.2,backEdge=s.depth/2-collapse.depth;
    for(const [start,end]of [[-s.width/2+.2,left],[right,s.width/2-.2]])w.box('roof',[(start+end)/2,s.height-.1,(minZ+maxZ)/2],[end-start,.18,maxZ-minZ],[0,0,0],'roof-deck');
    w.box('roof',[(left+right)/2,s.height-.1,(minZ+backEdge)/2],[right-left,.18,backEdge-minZ],[0,0,0],'collapse-surviving-rear-roof');
  }else w.box('roof', [0, s.height -.1, 0], [s.width - .4, .18, s.depth - .4], [0, 0, 0], 'roof-deck');
  if(plan.roofVariant===0&&!collapse){
    // A shallow stepped parapet changes the silhouette without raising the
    // authoritative building height or adding a blocking ground mass.
    for(const direction of [-1,1])front.box(w,'brick',direction*s.width*.18,s.height+.55,-.17,[s.width*.20,.24,.34],'stepped-parapet');
    front.box(w,'pale',0,s.height+.65,-.17,[s.width*.16,.13,.34],'parapet-keystone');
  }else if(plan.roofVariant===1){
    for(const x of [-s.width*.32,s.width*.29]){
      w.cylinder('rust',[x,s.height+.02,-s.depth*.31],[x,s.height+.71,-s.depth*.31],.10,'roof-flue');
      w.box('metal',[x,s.height+.73,-s.depth*.31],[.30,.075,.30],[0,0,0],'flue-rain-cap');
    }
  }
  w.box('metal', [-s.width * .27, s.height + .24, -s.depth * .16], [1.8, .52, 1.2], [0, 0, 0], 'roof-vent');
  for (let i = 0; i < 7; i++) w.box('dark', [-s.width * .27, s.height + .508, -s.depth * .16 - .47 + i * .15], [1.5, .016, .035], [0, 0, 0], 'roof-vent-grille');
  // Faded canopy projects 90 cm. Steel braces visibly carry its weight.
  const canopyWidth=s.width-.38;
  if(s.enterable&&plan.purpose.id==='pharmacy'){
    const intactWidth=s.width-3.7;
    w.box('metal',[-1.66,3.02,s.depth/2+.38],[intactWidth,.10,.94],[-.1,0,0],'pharmacy-surviving-canopy');
    w.box('metal',[s.width/2-1.78,.34,s.depth/2+.36],[3.08,.075,.79],[-.14,.08,.11],'fallen-pharmacy-canopy-sheet');
    w.box('rust',[s.width/2-2.84,2.52,s.depth/2+.40],[.055,.055,.92],[.53,0,0],'failed-canopy-brace');
    w.box('rust',[s.width/2-1.05,2.72,s.depth/2+.17],[1.19,.10,.09],[0,0,-.37],'torn-canopy-fascia');
  }else if(plan.roofVariant===2){
    const panels=Math.ceil(canopyWidth/.62),panelWidth=canopyWidth/panels;
    for(let i=0;i<panels;i++){
      if(i===1||i===panels-3)continue;
      w.box(i%3?'metal':'pale',[-canopyWidth/2+panelWidth*(i+.5),3.02-(i===4?.13:0),s.depth/2+.38],[panelWidth-.015,.085,.94],[-.10,0,i===4?-.13:0],'damaged-striped-awning');
    }
  }else w.box('metal', [0, 3.02, s.depth / 2 + .38], [canopyWidth, .10, .94], [-.10, 0, 0], 'shop-canopy');
  if(plan.purpose.id!=='pharmacy'||!s.enterable)front.box(w, 'rust', 0, 2.92, .82, [s.width - .38, .2, .08], 'canopy-fascia');
  else front.box(w,'rust',-1.66,2.92,.82,[s.width-3.7,.20,.08],'surviving-canopy-fascia');
  for (const x of [-s.width / 2 + .9, s.width / 2 - .9, s.doorOffset]) w.cylinder('rust', [x, 2.84, s.depth / 2 -.1], [x, 2.91, s.depth / 2 + .77], .035, 'canopy-brace');
  const signWidth = Math.min(s.width - 2, 9);
  front.box(w, 'rust', 0, 3.68, -.025, [signWidth + .18, .94, .055], 'sign-mount');
  front.box(w, 'sign', 0, 3.68, .015, [signWidth, .76, .018], 'shop-sign');
  for (const x of [-signWidth / 2 + .08, signWidth / 2 - .08]) front.box(w, 'rust', x, 3.68, .04, [.025, .64, .02], 'sign-fastener');
  // Lintel corbels, blind rollers and vent plates are actual construction
  // layers that read under grazing light at a street-height camera.
  for(let x=-s.width/2+.6;x<s.width/2-.4;x+=.52){
    if(collapse&&x>collapse.x[0]-.15&&x<collapse.x[1]+.15)continue;
    front.box(w,'pale',x,s.height-.50,-.08,[.18,.13,.15],'cornice-dentil');
  }
  for(const x of [-s.width/2+.31,s.width/2-.31]){
    front.box(w,'pale',x,1.74,-.025,[.19,3.4,.12],'shopfront-pilaster');
    front.box(w,'pale',x,3.36,-.005,[.29,.16,.17],'shopfront-pilaster-cap');
  }
  const fittingX=-s.width/2+.83;
  front.box(w,'metal',fittingX,2.48,.015,[.68,.52,.18],'shop-vent-cage');
  for(let i=0;i<5;i++)front.box(w,'dark',fittingX,2.31+i*.077,.12,[.58,.029,.015],'shop-vent-slats');
  for(const x of [fittingX-.26,fittingX+.26])front.box(w,'rust',x,2.48,.13,[.018,.51,.019],'vent-grille-bars');
  if(s.enterable&&plan.purpose.id==='pharmacy'){
    const sx=s.width/2-.8;
    front.box(w,'metal',sx,4.63,.09,[.82,.12,.36],'pharmacy-cross-bracket');
    front.box(w,'pale',sx,4.51,.23,[.48,.88,.075],'pharmacy-cross-enamel');
    front.box(w,'pale',sx,4.51,.23,[.88,.48,.075],'pharmacy-cross-enamel');
    front.box(w,'rust',sx,4.51,.275,[.18,.58,.02],'pharmacy-cross-centre');
    front.box(w,'rust',sx,4.51,.275,[.58,.18,.02],'pharmacy-cross-centre');
  }
  if(plan.purpose.id==='pharmacy')for (const item of plan.furniture) shelf(w, item);
  else compileDistrictFurniture(w,plan);
  if (s.enterable&&plan.purpose.id==='pharmacy') {
    w.box('pale', [s.width / 2 - 2, 1.12, s.depth / 2 - 3.5], [2.6, .12, 1.13], [0, 0, 0], 'counter-top');
    w.box('metal', [s.width / 2 - 1.8, 1.29, s.depth / 2 - 3.5], [.4, .23, .4], [0, -.16, 0], 'cash-register');
    const posterX = -s.width / 2 + .39;
    w.box('pale', [posterX, 1.9, s.depth / 2 - 1.5], [.03, .9, .64], [0, 0, 0], 'evacuation-notice');
    for (let i = 0; i < 5; i++) w.box('metal', [posterX + .023, 2.19 - i * .13, s.depth / 2 - 1.5], [.013, .025, .5], [0, 0, 0], 'notice-lines');
    // Broken ceiling diffuser and a fallen ceiling strip offer authored wear.
    w.box('metal', [s.doorOffset, 3.30, 0], [1.6, .08, .24], [0, 0, .04], 'ceiling-fixture');
    w.box('pale', [-s.width / 2 + 1.7, .24, 1.5], [1.1, .07, .15], [0, .44, -.18], 'fallen-trim');
    pharmacyInterior(w, plan, rng);
  }
  utilityModules(w, s);
}

function shopRearDoorWall(w,face,s){
 const offset=-s.doorOffset,left=offset-2,right=offset+2;
 for(const [a,b]of [[-face.span/2,left],[right,face.span/2]])if(b-a>.001)face.box(w,'masonry',(a+b)/2,1.75,-.18,[b-a,3.5,.36],'service-door-side-wall');
 face.box(w,'masonry',offset,3.15,-.18,[4,.70,.36],'service-door-lintel-wall');
 for(const x of [left-.055,right+.055])face.box(w,'metal',x,1.40,-.09,[.11,2.8,.14],'rear-door-jamb');
 face.box(w,'metal',offset,2.855,-.09,[4.22,.11,.14],'rear-door-header');
 face.box(w,'metal',offset,.105,-.14,[3.98,.045,.25],'rear-door-threshold');
 face.box(w,'metal',right+.85,1.13,-.055,[1.43,2.18,.065],'secured-open-service-door');
 face.box(w,'rust',right+.36,1.13,-.04,[.038,.15,.035],'service-door-pull');
}

function pharmacyInterior(w, plan, rng) {
  const s = plan.settings;
  // Physical ceramic tile seams and fractured pieces, with all debris off the
  // authoritative 4 m portal/cache passage. These are small visual remnants.
  for (let x = -s.width / 2 + .6; x < s.width / 2 -.5; x += .6) w.box('dark', [x, .142, 0], [.014, .014, s.depth -.8], [0, 0, 0], 'dusty-tile-grout');
  for (let z = -s.depth / 2 + .6; z < s.depth / 2 -.5; z += .6) w.box('dark', [0, .142, z], [s.width -.8, .014, .014], [0, 0, 0], 'dusty-tile-grout');
  const counterX = s.width / 2 - 2, counterZ = s.depth / 2 - 3.5;
  // Low glass dispensing screen, a checkout tray and a recognisable first-aid
  // cross distinguish this counter from the generic abandoned shop shell.
  w.box('metal', [counterX, 1.44, counterZ -.43], [2.23, .055, .055], [0, 0, 0], 'dispensing-screen-rail');
  w.box('glass', [counterX, 1.36, counterZ -.43], [2.08, .32, .036], [0, 0, 0], 'dispensing-screen');
  for (const x of [counterX - 1.08, counterX + 1.08]) w.box('metal', [x, 1.34, counterZ -.43], [.035, .42, .055], [0, 0, 0], 'dispensing-screen-post');
  w.box('pale', [counterX -.67, .74, counterZ + .544], [.6, .58, .025], [0, 0, 0], 'first-aid-counter-mark');
  w.box('rust', [counterX -.67, .74, counterZ + .564], [.33, .095, .025], [0, 0, 0], 'first-aid-cross');
  w.box('rust', [counterX -.67, .74, counterZ + .584], [.095, .33, .025], [0, 0, 0], 'first-aid-cross');
  w.box('metal', [counterX -.67, 1.23, counterZ], [.58, .07, .4], [0, .04, 0], 'dispensing-tray');
  function medicine(x, y, z, index) {
    const height = .12 + (index % 3) * .035;
    w.box('pale', [x, y + height / 2, z], [.19, height, .11], [0, .04 * index, 0], 'medicine-carton');
    w.box(index % 2 ? 'metal' : 'rust', [x, y + height *.6, z + .062], [.12, .03, .015], [0, .04 * index, 0], 'medicine-label');
    for (let line = 0; line < 3; line++) w.box('dark', [x -.045 + line * .025, y + .035, z + .064], [.009, .022, .016], [0, 0, 0], 'medicine-label-type');
  }
  for (let i = 0; i < 8; i++) medicine(-s.width / 2 + 1.7 + i * (s.width - 3.6) / 8, .17 + (i % 4) * .43 + .037, -s.depth / 2 + .9, i);
  for (let i = 0; i < 3; i++) {
    const x = counterX -.85 + i * .31, z = counterZ + .13;
    w.cylinder('pale', [x, 1.21, z], [x, 1.4 + .04 * (i % 2), z], .055, 'prescription-bottle');
    w.cylinder('metal', [x, 1.4 + .04 * (i % 2), z], [x, 1.43 + .04 * (i % 2), z], .06, 'prescription-bottle-cap');
    w.box('dark', [x, 1.3, z + .055], [.08, .025, .017], [0, 0, 0], 'bottle-label');
  }
  medicine(counterX + .68, 1.19, counterZ + .12, 3);
  for (let i = 0; i < 12; i++) {
    const x = -s.width / 2 + 1.25 + rng() * 2.5, z = -1.6 + rng() * 4;
    w.box(i % 3 ? 'pale' : 'wood', [x, .165, z], [.1 + rng() * .2, .024, .13 + rng() * .2], [0, rng() * 6, 0], 'looted-packaging');
  }
  const chairX = -s.width / 2 + 2.8, chairZ = 2.15;
  w.box('wood', [chairX, .35, chairZ], [.48, .07, .46], [0, .12, .78], 'displaced-chair-seat');
  w.box('wood', [chairX -.29, .57, chairZ], [.08, .51, .45], [0, .12, .78], 'displaced-chair-back');
  for (const side of [-1, 1]) for (const front of [-1, 1]) w.cylinder('metal', [chairX + .14, .16, chairZ + front * .18], [chairX + side * .15, .34, chairZ + front * .18], .022, 'displaced-chair-leg');
}

function shelf(w, item) {
  const [x, y, z] = item.position, [width, height, depth] = item.size;
  if (item.id === 'cash-counter') {
    w.box('wood', [x, y, z], item.size, [0, 0, 0], item.id);
    w.box('metal', [x, .13, z + depth / 2 + .012], [width -.12, .06, .026], [0, 0, 0], 'counter-kickplate');
    return;
  }
  const longZ = depth > width;
  w.box('wood', [x, y, z], longZ ? [.07, height, depth] : [width, height, .07], [0, 0, 0], 'shelf-back');
  for (let level = 0; level < 5; level++) {
    const damaged=item.id==='rear-stock-shelf'&&level===3||item.id==='left-wall-shelving'&&level===2;
    w.box('wood', [x, .17 + level * .43, z], [width*(damaged&&!longZ?.92:1), .065, depth*(damaged&&longZ?.92:1)], damaged?(longZ?[.035,0,0]:[0,0,.025]):[0,0,0], 'shelf-board');
    if (level > 0 && level < 4) {
      for (let j = 0; j < 3; j++) {
        const bx = longZ ? x + .18 : x - width * .27 + j * width * .27;
        const bz = longZ ? z - depth * .29 + j * depth * .29 : z + .18;
        w.box(j === 1 ? 'pale' : 'metal', [bx, .32 + level * .43, bz], [.25 + j * .035, .25, .28], [0, .04 * j, 0], 'abandoned-stock');
      }
    }
  }
  for (const sign of [-1, 1]) w.box('metal', [longZ ? x : x + sign * (width / 2 - .04), y, longZ ? z + sign * (depth / 2 - .04) : z], longZ ? [width, height, .05] : [.05, height, depth], [0, 0, 0], 'shelf-upright');
}

function house(w, plan, rng) {
  const s = plan.settings;
  const variant = plan.residentialVariant;
  const porchDepth = 1.65, bodyDepth = s.depth - porchDepth, bodyZ = -porchDepth / 2;
  const eave = s.height - 1.45, floorHeight = eave / 2;
  // Recess the main front so the porch and eaves remain in the lot boundary.
  const dimensions = { width: s.width - .4, depth: bodyDepth - .2 };
  const localWriter = { ...w, box(slot, position, size, rotation, role) { if(plan.structure&&CAPE75_REPLACED_WALL_ROLES.has(role))return; w.box(slot, [position[0], position[1], position[2] + bodyZ], size, rotation, role); }, triangle(slot, points, role) { w.triangle(slot, points.map(point => [point[0], point[1], point[2] + bodyZ]), role); }, cylinder(slot,a,b,r,role){w.cylinder(slot,[a[0],a[1],a[2]+bodyZ],[b[0],b[1],b[2]+bodyZ],r,role);},polygon(slot,face,points,outset,depth,role){w.polygon(slot,{...face,point(...args){const p=face.point(...args);return[p[0],p[1],p[2]+bodyZ];}},points,outset,depth,role);} };
  localWriter.coversAuthoredCurtainWindow=center=>coversAuthoredCottageCurtainWindow(plan,center);
  for (const side of ['front', 'left', 'right', 'back']) {
    const face = facadeFrame(side, dimensions.width, dimensions.depth);
    const count = Math.max(2, Math.round(face.span / 3));
    if (side === 'front') {
      if(s.enterable)houseDoorWall(localWriter,face,s,floorHeight,rng,'front');
      else{
       face.box(localWriter, 'render', 0, floorHeight / 2, -.2, [face.span, floorHeight, .3], 'house-front-wall');
      // A painted closed door and deep boarded window establish inhabited scale.
      face.box(localWriter, 'metal', 0, 1.13, -.03, [1.12, 2.18, .065], 'house-door');
      face.box(localWriter, 'pale', -.63, 1.20, -.08, [.13, 2.37, .16], 'door-jamb');
      face.box(localWriter, 'pale', .63, 1.20, -.08, [.13, 2.37, .16], 'door-jamb');
      face.box(localWriter, 'pale', 0, 2.34, -.08, [1.39, .15, .16], 'door-lintel');
      face.box(localWriter, 'rust', .38, 1.03, .018, [.055, .15, .035], 'door-handle');
      for (const x of [-dimensions.width *.3, dimensions.width *.3]) windowModule(localWriter, face, x, 1.55, 1.27, 1.53, true, false, rng, 'wood');
      }
    }else if(side==='back'&&s.enterable)houseDoorWall(localWriter,face,s,floorHeight,rng,'back');
    else wallWithWindows(localWriter, face, 0, floorHeight, count, rng, 'render', true,-1,s.enterable);
    wallWithWindows(localWriter, face, floorHeight, floorHeight, count, rng, 'render', true,side==='front'&&variant===0&&!plan.structure?0:-1);
    if(s.enterable&&(side==='front'||side==='back')){
      const offset=side==='back'?-s.doorOffset:s.doorOffset;
      for(const [start,end]of [[-face.span/2,offset-2],[offset+2,face.span/2]])if(end-start>.001)face.box(localWriter,'masonry',(start+end)/2,.19,-.09,[end-start,.38,.18],'house-foundation');
    }else face.box(localWriter, 'masonry', 0, .19, -.09, [face.span, .38, .18], 'house-foundation');
    face.box(localWriter, 'wood', 0, floorHeight, -.065, [face.span, .17, .13], 'house-floor-band');
    // Cladding courses, insets rather than coplanar overlays.
    for (let y = .7; y < eave; y += .43) {
      const floor = y < floorHeight ? 0 : 1;
      const windowY = floor * floorHeight + floorHeight * .51;
      const windowH = Math.min(1.72, floorHeight -.95);
      const bay = face.span / count, windowW = Math.min(1.18, bay -.65);
      const enterableDoor=(side==='front'||side==='back')&&floor===0&&s.enterable&&y<plan.door.height;
      const doorCenter=side==='back'?-s.doorOffset:s.doorOffset;
      const holes = enterableDoor?[[doorCenter-2,doorCenter+2]]:side === 'front' && floor === 1 && variant===0 && !plan.structure && y>floorHeight+.3
        ? [[-face.span/2,-face.span/2+bay],...(Math.abs(y-windowY)<windowH/2?Array.from({length:count-1},(_,i)=>{const x=-face.span/2+bay*(i+1.5);return[x-windowW/2,x+windowW/2];}):[])]
        : side === 'front' && floor === 0
        ? Math.abs(y -1.55) < .765 ? [-dimensions.width *.3, dimensions.width *.3].map(x => [x -.635, x +.635]) : []
        : Math.abs(y -windowY) < windowH / 2 ? Array.from({length: count}, (_, i) => { const x = -face.span / 2 + bay * (i +.5); return [x -windowW / 2, x +windowW / 2]; }) : [];
      let intervals = [[-face.span / 2, face.span / 2]];
      for (const [low, high] of holes) intervals = intervals.flatMap(([start, end]) => high <= start || low >= end ? [[start, end]] : [[start, Math.max(start, low)], [Math.min(end, high), end]].filter(([a, b]) => b - a > .01));
      for (const [start, end] of intervals) face.box(localWriter, 'pale', (start +end) / 2, y, -.06, [end -start, .018, .028], 'cladding-course');
    }
  }
  const roofHalfWidth = s.width / 2 - .05, roofRise = 1.88, roofY = eave + .08;
  const slope = Math.atan2(roofRise, roofHalfWidth), slopeLength = Math.hypot(roofHalfWidth, roofRise);
  const gableFront = bodyZ + (bodyDepth -.2) / 2;
  const gableBack = bodyZ - (bodyDepth -.2) / 2;
  if (variant === 1) {
    // Side-facing ridge changes the entire street silhouette, not just trim.
    const roofHalfDepth = bodyDepth / 2 -.06, crossSlope = Math.atan2(roofRise, roofHalfDepth);
    const crossLength = Math.hypot(roofHalfDepth, roofRise);
    for (const direction of [-1, 1]) w.box('roof', [0, roofY + roofRise / 2, bodyZ + direction * roofHalfDepth / 2], [s.width -.12, .12, crossLength], [direction * crossSlope, 0, 0], 'side-ridge-roof');
    w.box('metal', [0, roofY + roofRise + .065, bodyZ], [s.width -.12, .12, .18], [0, 0, 0], 'side-ridge-cap');
    for (const direction of [-1, 1]) {
      const x = direction * (s.width / 2 -.21);
      const points = [[x, roofY, bodyZ - roofHalfDepth], [x, roofY, bodyZ + roofHalfDepth], [x, roofY + roofRise -.10, bodyZ]];
      w.triangle('wood', direction > 0 ? [...points].reverse() : points, 'side-gable');
      w.box('pale', [x, eave + .05, bodyZ], [.11, .12, bodyDepth -.12], [0, 0, 0], 'side-gable-seal');
    }
    // Front-facing dormer is seated into the sloping roof with a small cap.
    const dormerZ = gableFront -.7, dormerY = roofY + .85;
    w.box('wood', [-.88, dormerY, dormerZ -.62], [.10, 1.3, 1.25], [0, 0, 0], 'dormer-cheek');
    w.box('wood', [.88, dormerY, dormerZ -.62], [.10, 1.3, 1.25], [0, 0, 0], 'dormer-cheek');
    w.box('dark', [0, dormerY + .03, dormerZ], [1.67, .93, .045], [0, 0, 0], 'dormer-window');
    for (const x of [-.84, .84, 0]) w.box('pale', [x, dormerY + .03, dormerZ + .05], [.075, 1.05, .07], [0, 0, 0], 'dormer-frame');
    for (const y of [dormerY -.47, dormerY + .53]) w.box('pale', [0, y, dormerZ + .05], [1.76, .08, .07], [0, 0, 0], 'dormer-frame');
    w.triangle('wood', [[-.93, roofY + 1.48, dormerZ], [.93, roofY + 1.48, dormerZ], [0, roofY + 1.91, dormerZ]], 'dormer-gable');
    const angle = Math.atan2(.43, .93);
    for (const direction of [-1, 1]) w.box('roof', [direction *.465, roofY + 1.70, dormerZ -.60], [1.03, .09, 1.34], [0, 0, -direction * angle], 'dormer-cap');
    w.box('metal', [0, roofY + 1.93, dormerZ -.60], [.11, .085, 1.34], [0, 0, 0], 'dormer-ridge');
  } else {
    for (const direction of [-1, 1]) {
      if(variant!==2)w.box('roof', [direction * roofHalfWidth / 2, roofY + roofRise / 2, bodyZ], [slopeLength, .12, bodyDepth -.02], [0, 0, -direction * slope], 'pitched-roof');
      else{
        const columns=Math.ceil(bodyDepth/1.45),rows=4,tileLength=slopeLength/rows,tileDepth=(bodyDepth-.02)/columns;
        for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
          if(direction<0&&row===2&&column>=columns-3&&column<columns-1)continue;
          const u=(row+.5)/rows,z=bodyZ-bodyDepth/2+(column+.5)*tileDepth;
          w.box('roof',[direction*roofHalfWidth*u,roofY+roofRise*(1-u),z],[tileLength-.012,.09,tileDepth-.015],[0,0,-direction*slope],'individual-roof-sheet');
        }
        // A storm-torn patch exposes rafters underneath a genuine roof gap.
        if(direction<0)for(let j=0;j<4;j++){
          const z=bodyZ+bodyDepth/2-tileDepth*(1.1+j*.5);
          w.box('wood',[-roofHalfWidth*.625,roofY+roofRise*.375-.07,z],[tileLength+.17,.085,.055],[0,0,slope],'exposed-roof-rafter');
        }
      }
    }
    w.box('metal', [0, roofY + roofRise + .065, bodyZ], [.18, .12, bodyDepth -.02], [0, 0, 0], 'ridge-cap');
    for (const z of [gableFront, gableBack]) {
      w.box('wood', [0, eave + .05, z], [s.width -.4, .12, .11], [0, 0, 0], 'gable-base-seal');
      for (const direction of [-1, 1]) w.box('pale', [direction * roofHalfWidth / 2, roofY + roofRise / 2, z + (z > bodyZ ? .055 : -.055)], [slopeLength, .13, .09], [0, 0, -direction * slope], 'gable-bargeboard');
    }
    w.triangle('wood', [[-roofHalfWidth + .2, roofY, gableFront], [roofHalfWidth -.2, roofY, gableFront], [0, roofY + roofRise -.1, gableFront]], 'front-gable');
    w.triangle('wood', [[roofHalfWidth -.2, roofY, gableBack], [-roofHalfWidth + .2, roofY, gableBack], [0, roofY + roofRise -.1, gableBack]], 'rear-gable');
    w.box('dark', [0, eave + 1.1, gableFront + .018], [.7, .45, .025], [0, 0, 0], 'attic-vent');
    for (let i = 0; i < 5; i++) w.box('pale', [0, eave + .94 + i *.08, gableFront + .04], [.65, .025, .024], [0, 0, 0], 'attic-louvre');
  }
  // A long porch is a second architectural mass with posts, fascia and real rails.
  const porchZ = s.depth / 2 - .84;
  w.box('masonry', [0, s.enterable?.04:.16, porchZ], [s.width -.25, s.enterable?.08:.32, 1.65], [0, 0, 0], 'porch-slab');
  if(variant!==0){
    w.box('wood', [0, 2.74, porchZ -.02], [s.width -.15, .12, 1.66], [.06, 0, 0], 'porch-roof');
    w.box('pale', [0, 2.69, s.depth / 2 -.03], [s.width -.15, .22, .06], [0, 0, 0], 'porch-fascia');
  }else{
    w.box('wood',[1.5,2.74,porchZ-.02],[s.width-3.15,.12,1.66],[.06,0,0],'storm-broken-porch-roof');
    w.box('pale',[1.5,2.69,s.depth/2-.03],[s.width-3.15,.22,.06],[0,0,0],'partial-porch-fascia');
    for(let j=0;j<4;j++)w.box('wood',[-s.width/2+.5+j*.54,2.57,porchZ-.06],[.055,.08,1.44],[.19,0,0],'exposed-porch-roof-rafter');
    w.box('wood',[-s.width/2+1.6,.39,porchZ],[2.53,.08,1.26],[.13,.07,.09],'fallen-porch-roof-panel');
    w.box('pale',[-s.width/2+1.6,.51,s.depth/2-.25],[2.53,.12,.07],[0,0,.14],'fallen-porch-fascia');
  }
  const postOffset = variant === 0 ? 1.45 : variant === 1 ? 2.15 : 1.8;
  const porchPosts=s.enterable?[-s.width/2+.45,s.width/2-.45,s.doorOffset-2.23,s.doorOffset+2.23]:[-s.width/2+.45,s.width/2-.45,-postOffset,postOffset];
  for (const x of porchPosts) {
    if(variant===0&&x< -s.width/2+.5){w.box('wood',[x+.15,.78,s.depth/2-.24],[.15,.9,.15],[0,0,-.28],'broken-porch-post');continue;}
    w.box('wood', [x, 1.49, s.depth / 2 -.20], [.15, 2.4, .15], [0, 0, 0], 'porch-post');
    w.box('pale', [x, .44, s.depth / 2 -.20], [.24, .26, .24], [0, 0, 0], 'post-foot');
    w.box('pale', [x, 2.59, s.depth / 2 -.20], [.25, .18, .25], [0, 0, 0], 'post-cap');
  }
  const railSegments=s.enterable?[[-s.width/2+.20,s.doorOffset-2.16],[s.doorOffset+2.16,s.width/2-.20]]:[[-s.width/2+.23,-1.55],[1.55,s.width/2-.23]];
  for (const [index,[start,end]] of railSegments.entries()) {
    const direction=index===0?-1:1,length=end-start,center=(start+end)/2;
    w.box('wood', [center, 1.08, s.depth / 2 -.22], [length, .08, .08], [0, 0, 0], 'porch-rail');
    w.box('wood', [center, .48, s.depth / 2 -.22], [length, .07, .08], [0, 0, 0], 'porch-rail');
    for (let i = 0; i < Math.floor(length / .30); i++) {
      if ((direction === -1 && i === 2) || (variant === 2 && direction === 1 && i > 2 && i < 6)) continue;
      w.box('wood', [start+.10+i*.3, .77, s.depth / 2 -.22], [.045, .57, .045], [0, 0, 0], 'porch-baluster');
    }
  }
  if (variant === 2) {
    // A projecting upstairs bay and a second porch gable give the third home
    // distinct massing. It stays inside the reserved 1.65 m porch footprint.
    const bayX = -s.width *.21, bayZ = s.depth / 2 -.54, bayY = floorHeight + 1.10;
    for (const side of [-1, 1]) w.box('render', [bayX + side * 1.05, bayY, bayZ -.48], [.12, 1.55, 1.05], [0, 0, 0], 'upper-bay-cheek');
    w.box('dark', [bayX, bayY, bayZ], [1.98, 1.25, .05], [0, 0, 0], 'upper-bay-window');
    for (const x of [bayX -1.03, bayX, bayX +1.03]) w.box('pale', [x, bayY, bayZ + .055], [.085, 1.43, .09], [0, 0, 0], 'upper-bay-frame');
    for (const y of [bayY -.69, bayY + .69]) w.box('pale', [bayX, y, bayZ + .055], [2.19, .10, .09], [0, 0, 0], 'upper-bay-frame');
    w.box('wood', [bayX, bayY -.76, bayZ -.43], [2.22, .14, 1.0], [0, 0, 0], 'upper-bay-base');
    w.triangle('wood', [[bayX -1.13, bayY +.77, bayZ], [bayX +1.13, bayY +.77, bayZ], [bayX, bayY +1.15, bayZ]], 'upper-bay-gable');
    for (const direction of [-1, 1]) w.box('roof', [bayX + direction *.565, bayY +.96, bayZ -.46], [1.20, .1, 1.10], [0, 0, -direction * .325], 'upper-bay-roof');
    w.box('wood', [s.width *.24, .39, s.depth / 2 -.62], [.07, .07, 1.1], [0, .47, .1], 'fallen-porch-baluster');
  }
  for (const direction of [-1, 1]) w.box('pale', [direction * (s.width / 2 -.13), eave -.03, bodyZ], [.16, .22, bodyDepth -.04], [0, 0, 0], 'eave-fascia');
  for(const direction of [-1,1]){
    w.cylinder('metal',[direction*(s.width/2-.14),eave+.095,gableBack+.10],[direction*(s.width/2-.14),eave+.095,gableFront-.07],.055,'house-rain-gutter');
    for(let z=gableBack+.3;z<gableFront-.1;z+=1.65)w.box('rust',[direction*(s.width/2-.12),eave+.045,z],[.11,.06,.08],[0,0,0],'gutter-bracket');
  }
  // Distinct small porch fittings communicate occupation and abandonment.
  const fittingX=s.width/2-.95,wallFront=bodyZ+bodyDepth/2-.18;
  w.box('wood',[fittingX,1.40,wallFront+.11],[.44,.38,.12],[0,0,0],'house-letter-box');
  w.box('metal',[fittingX,1.59,wallFront+.13],[.49,.045,.16],[0,0,.03],'mailbox-lid');
  w.box('dark',[fittingX,1.48,wallFront+.18],[.31,.025,.018],[0,0,0],'mail-slot');
  w.box('metal',[-s.width/2+1.05,2.1,wallFront+.04],[.20,.25,.07],[0,0,0],'porch-lamp-backplate');
  w.cylinder('rust',[-s.width/2+1.05,2.13,wallFront+.06],[-s.width/2+1.05,2.13,wallFront+.28],.026,'porch-lamp-arm');
  w.box('metal',[-s.width/2+1.05,2.08,wallFront+.28],[.22,.27,.19],[0,0,.08],'broken-porch-lamp');
  w.box('glass',[-s.width/2+1.05,2.08,wallFront+.382],[.15,.18,.02],[0,0,.08],'porch-lamp-pane');
  const chimneyX = variant === 1 ? s.width *.28 : -s.width *.25;
  const chimneyZ = variant === 2 ? -s.depth *.39 : -s.depth *.25;
  w.box('brick', [chimneyX, roofY + 1.10, chimneyZ], [.66, 1.42, .76], [0, 0, 0], 'chimney');
  w.box('masonry', [chimneyX, roofY + 1.87, chimneyZ], [.79, .16, .88], [0, 0, 0], 'chimney-cap');
  w.box('dark', [chimneyX, roofY + 1.959, chimneyZ], [.45, .012, .53], [0, 0, 0], 'chimney-flue');
  w.box('metal', [s.width / 2 -.11, 1.5, -s.depth * .25], [.12, .58, .45], [0, 0, 0], 'house-meter');
  w.cylinder('rust', [s.width / 2 -.07, .25, -s.depth * .4], [s.width / 2 -.07, eave -.12, -s.depth * .4], .04, 'house-downpipe');
  if(s.enterable){
    if(plan.familyHouse)compileHouseFloors(w,plan,{bodyZ,bodyDepth});
    else compileDistrictHouseFloors(plan.structure?{...w,box(slot,position,size,rotation,role){if(!CAPE75_REPLACED_FLOOR_ROLES.has(role))w.box(slot,position,size,rotation,role);}}:w,plan,{bodyZ,bodyDepth});
    if(plan.structure){compileCape75Structure(w,plan.structure);compileCape75UpstairsArt(w,plan.upstairsArt);}
    else w.box('pale',[0,floorHeight+.005,bodyZ],[s.width-.50,.075,bodyDepth-.25],[0,0,0],'sealed-house-ground-floor-ceiling');
    if(plan.familyHouse)compileHouseInterior(w,plan);
    else compileDistrictFurniture(w,plan);
  }
}

function houseDoorWall(w,face,s,height,rng,side){
 const offset=side==='back'?-s.doorOffset:s.doorOffset,doorHeight=height-.17;
 const left=offset-2,right=offset+2;
 for(const [start,end]of [[-face.span/2,left],[right,face.span/2]]){
  const width=end-start,cx=(start+end)/2;
  if(width>2){
   const windowWidth=Math.min(1.65,width-.65),windowHeight=1.35,windowY=1.36,low=windowY-windowHeight/2,high=windowY+windowHeight/2;
   face.box(w,'render',cx,low/2,-.20,[width,low,.3],'house-window-lower-infill');
   face.box(w,'render',cx,(high+height)/2,-.20,[width,height-high,.3],'house-window-upper-infill');
   for(const direction of [-1,1])face.box(w,'render',cx+direction*(windowWidth/2+(width-windowWidth)/4),windowY,-.20,[(width-windowWidth)/2,windowHeight,.3],'house-window-side-infill');
   windowModule(w,face,cx,windowY,windowWidth,windowHeight,side==='front',true,rng,'wood',true);
  }else if(width>.005)face.box(w,'render',cx,height/2,-.20,[width,height,.3],'house-ground-floor-door-wall');
 }
 face.box(w,'render',offset,(height+doorHeight)/2,-.20,[4,height-doorHeight,.30],'house-door-lintel-infill');
 for(const x of [left-.065,right+.065])face.box(w,'pale',x,(doorHeight+.07)/2,-.035,[.13,doorHeight+.07,.16],'open-house-door-jamb');
 face.box(w,'wood',offset,doorHeight+.025,-.04,[4.24,.075,.17],'open-house-door-header');
 face.box(w,'metal',offset,.04,-.07,[3.98,.05,.28],'open-house-threshold');
 // The opened panel is secured against the adjacent wall, outside the portal.
 const panelX=right+1.12;
 face.box(w,'wood',panelX,1.12,-.07,[1.73,2.15,.07],'house-open-door-panel');
 for(const y of [.59,1.63])face.box(w,'pale',panelX,y,-.023,[1.36,.68,.019],'house-door-inset-panel');
 face.box(w,'rust',panelX-.62,1.04,.008,[.05,.13,.04],'house-open-door-handle');
}

export function createModel(options = {}) {
  const plan = createBuildingPlan(options), s = plan.settings;
  const shared = options.materials || createBlackwaterMaterials();
  const materials = { ...shared };
  materials.fabric ||= shared.wood;
  const ownedMaterials = [];
  if(s.enterable&&s.kind!=='house'){
    const warm=shared.wood.clone();warm.color.set(0x9b7754);warm.name='blackwater-commercial-furnitureWood';warm.userData.lookRole='furnitureWood';materials.furnitureWood=warm;ownedMaterials.push(warm);
  }
  if (s.kind === 'house') {
    const siding = (shared.siding||shared.render).clone();
    siding.name = `blackwater-house-siding-${plan.residentialVariant}`;
    siding.color.set([0x9cbfcf, 0xe1d5b1, 0x96bab1][plan.residentialVariant]);
    materials.render = siding; ownedMaterials.push(siding);
    if(s.enterable){
      for(const [role,source,color,metres]of [
        ['furnitureWood',shared.wood,0x9b7754,2],
        ['interiorWood',shared.wood,0xc6a077,2],
        ['interiorTile',shared.paving||shared.pale,0xa5aaa0,1.8],
        ['rug',shared.fabric||shared.wood,0x886255,1.4],
      ]){
        const material=source.clone();material.name=`blackwater-house-${role}`;
        material.color.set(color);material.userData.lookRole=role;material.userData.textureMeters=metres;
        material.roughness=role==='interiorTile'?.76:.94;
        materials[role]=material;ownedMaterials.push(material);
      }
    }
  }
  const pharmacy = /pharmacy|medical|clinic/i.test(s.label);
  const subtitle=pharmacy?'PRESCRIPTIONS  /  FIRST AID':plan.purpose.id==='apartment'?'RESIDENT LOBBY  /  GROUND FLOOR':plan.purpose.id==='clinic'?'TRIAGE  /  MEDICAL SUPPLIES':plan.purpose.id==='warehouse'?'LOADING  /  EMERGENCY STORES':plan.purpose.id==='workshop'?'REPAIRS  /  MACHINE SHOP':'GENERAL GOODS  /  COASTAL SUPPLIES';
  const sign = s.kind === 'house' ? null : createBlackwaterSignMaterial(s.label, subtitle);
  if (sign) materials.sign = sign;
  const root = new THREE.Group(); root.name = `blackwater-${s.kind}`;
  const parts = {};
  for (const name of ['structure', 'facade', 'roof', 'interior', 'utilities', 'entrance']) {
    const group = new THREE.Group(); group.name = `blackwater-${name}-anchor`;
    parts[name] = group; root.add(group);
  }
  parts.entrance.position.set(s.doorOffset, 0, s.depth / 2);
  parts.roof.position.y = s.height;
  const w = compiler(materials), rng = random(s.seed);
  if (s.kind === 'house') house(w, plan, rng); else shop(w, plan, rng);
  compileEntranceDetails(w,plan.entrances);
  const result = w.finish(root);
  const bounds = new THREE.Box3().setFromObject(root);
  const diagnostics = {
    authoring: 'Original Blackwater direct Three.js source; no external kit dependency',
    plan, triangleCount: Object.values(result.triangles).reduce((sum, count) => sum + count, 0),
    trianglesPerMaterial: result.triangles, drawCalls: result.meshes.length, materialSlots: Object.keys(result.triangles),
    moduleCounts: result.moduleCounts,trianglesPerModule:result.trianglesPerModule,structuralDamageBounds:result.structuralBounds, placementCount: result.placements.length,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },textureMetresByMaterial:Object.fromEntries(Object.entries(materials).map(([role,mat])=>[role,mat.userData.textureMeters||2.4])),
  };
  root.userData.blackwater = diagnostics;
  let disposed = false;
  return {
    root, parts, materials, colliders: architectureColliders(options), diagnostics,
    sockets: { entrance: parts.entrance, roof: parts.roof, interior: parts.interior },
    dispose() {
      if (disposed) return;
      disposed = true;
      result.geometries.forEach(geometry => geometry.dispose());
      ownedMaterials.forEach(material => material.dispose());
      sign?.map?.dispose(); sign?.dispose();
      if (!options.materials) shared.dispose();
    },
  };
}
