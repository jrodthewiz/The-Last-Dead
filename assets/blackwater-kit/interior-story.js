import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';

// Small authored evidence of interrupted evacuation. Furniture topology and
// collisions belong to architecture.js; every standing pharmacy prop remains
// inside one of its three existing authoritative furniture rectangles.
const WHITE = 'medicine', RED = 'medicalRed';

function roundedBox(size, radius = .025) {
  const [width, height, depth] = size, r = Math.min(radius, width / 5, height / 5, depth / 5);
  const shape = new THREE.Shape(), x = width / 2 - r, y = height / 2 - r, corner = r * .7;
  // The bevel grows outwards by r. Keep the authored final dimensions exact,
  // so contact heights and collision footprints describe the actual mesh.
  shape.moveTo(-x + corner, -y); shape.lineTo(x - corner, -y);
  shape.quadraticCurveTo(x, -y, x, -y + corner); shape.lineTo(x, y - corner);
  shape.quadraticCurveTo(x, y, x - corner, y); shape.lineTo(-x + corner, y);
  shape.quadraticCurveTo(-x, y, -x, y - corner); shape.lineTo(-x, -y + corner);
  shape.quadraticCurveTo(-x, -y, -x + corner, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - r * 2, steps: 1, curveSegments: 2, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 1 });
  geometry.translate(0, 0, -depth / 2 + r); return geometry;
}

// One original printed atlas serves the pharmacy and the family route. It is
// owned by this factory; district palette materials remain borrowed.
const ATLAS_SIZE = 1024;
const PRINT_REGIONS = {
  pharmacy: [0, 0, 512, 256], route: [512, 0, 512, 512], note: [0, 256, 512, 256],
  photo: [0, 512, 256, 256], tag: [256, 512, 256, 256], map: [512, 512, 512, 512],
};
function noticeMaterial() {
  let map = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = ATLAS_SIZE; canvas.height = ATLAS_SIZE;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = '#ddd7be'; c.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      c.fillStyle = '#9e4538'; c.fillRect(14, 14, 484, 70);
      c.font = 'bold 40px Arial'; c.textAlign = 'center'; c.fillStyle = '#f0ead4'; c.fillText('LAST EVACUATION', 256, 64, 455);
      c.fillStyle = '#283f40'; c.font = 'bold 32px Arial'; c.fillText('DEPARTURE 18:40', 256, 129);
      c.font = 'bold 23px Arial'; c.fillText('FIRST AID: TAKE WHAT YOU NEED', 256, 174, 466);
      c.font = '18px Arial'; c.fillText('BELL PHARMACY / DOCK ROAD TRIAGE', 256, 221);
      const line = (points, color, width) => {
        c.beginPath(); c.moveTo(...points[0]); for (const point of points.slice(1)) c.lineTo(...point);
        c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
      };
      const streetMap = (ox, oy, size) => {
        c.fillStyle = '#e6dec4'; c.fillRect(ox, oy, size, size);
        c.fillStyle = '#95aaa2'; c.fillRect(ox + size * .77, oy + size * .05, size * .18, size * .88);
        c.fillStyle = '#bac0aa';
        for (const [x, y, w, h] of [[.09,.20,.24,.22],[.42,.18,.23,.19],[.11,.60,.23,.22],[.43,.55,.20,.25]]) c.fillRect(ox + x * size, oy + y * size, w * size, h * size);
        const pts = [[.22,.72],[.38,.72],[.38,.47],[.70,.47],[.70,.25],[.84,.25]].map(([x,y]) => [ox + x * size, oy + y * size]);
        line(pts, '#aa4939', size * .038);
        line([[ox+size*.76,oy+size*.18],[ox+size*.84,oy+size*.25],[ox+size*.76,oy+size*.32]], '#aa4939', size*.032);
        c.fillStyle = '#284543'; c.fillRect(ox + size * .15, oy + size * .72, size * .15, size * .12);
        c.fillStyle = '#e6dec4'; c.fillRect(ox + size * .205, oy + size * .75, size * .035, size * .065);
        c.fillStyle = '#284543'; c.font = `bold ${size * .064}px Arial`; c.textAlign = 'center'; c.fillText('HOME', ox + size * .23, oy + size * .92);
      };
      streetMap(520, 8, 496);
      c.fillStyle = '#aa4939'; c.fillRect(529, 17, 477, 64);
      c.fillStyle = '#eee5cd'; c.font = 'bold 41px Arial'; c.fillText('DOCK  /  18:40', 768, 65, 448);
      c.fillStyle = '#263e3d'; c.font = 'bold 24px Arial'; c.fillText('MAIN ST. → LAST BOAT', 764, 492, 459);
      c.fillStyle = '#e9dfbd'; c.fillRect(8, 264, 496, 240);
      c.textAlign = 'left'; c.fillStyle = '#364947'; c.font = 'italic bold 37px Georgia';
      c.fillText('Mara —', 31, 316); c.fillText('Take the blue bag.', 31, 367, 458);
      c.fillText('Meet us at the dock.', 31, 416, 458);
      c.font = 'italic 27px Georgia'; c.fillText('18:40.  We will wait.  — Dad', 31, 468, 460);
      line([[38,484],[278,484],[295,478]], '#a6493a', 5);
      c.fillStyle = '#8ba09a'; c.fillRect(8, 520, 240, 240); c.fillStyle = '#cbbd95'; c.fillRect(8, 667, 240, 93);
      for (const [x,y,r] of [[65,612,23],[178,602,25],[122,662,16]]) {
        c.fillStyle = '#344a49'; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); c.fillRect(x-r,y+r*.6,r*2,r*2.4);
      }
      c.fillStyle = '#e9dfbd'; c.fillRect(264, 520, 240, 240); c.textAlign = 'center'; c.fillStyle = '#a6493a';
      c.font = 'bold 30px Arial'; c.fillText('MARA', 384, 572); c.font = 'bold 35px Arial'; c.fillText('DOCK', 384, 623); c.fillText('18:40', 384, 672);
      c.fillStyle = '#344a49'; c.font = '18px Arial'; c.fillText('18 MAIN STREET',384,718,220);
      streetMap(520, 520, 496);
      c.fillStyle = '#374947'; c.font = 'bold 31px Arial'; c.fillText('MEET AT THE BOAT',768,567,452);
      line([[772,596],[772,973]], '#bdb18f', 3);
      map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const material = new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : '#ddd7be', map, roughness: .90, side: THREE.DoubleSide });
  material.name = 'blackwater-sign-interrupted-evacuation'; material.userData.lookRole = 'sign'; return material;
}

function compiler(materials) {
  const batches = new Map(), placements = [], counts = {};
  const localMatrix = new THREE.Matrix4(), frame = new THREE.Matrix4();
  let building = null;
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  function begin(definition) {
    building = definition;
    frame.compose(new THREE.Vector3(definition.x, definition.y ?? .13, definition.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), definition.yaw || 0), new THREE.Vector3(1, 1, 1));
  }
  function append(slot, geometry, position, rotation = [0, 0, 0], role = 'story-prop', footprint = null) {
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    const material = materials[slot] || materials.paper || materials.pale;
    if (slot !== 'notice' && geometry.attributes.uv && material.map) {
      const p = geometry.attributes.position, n = geometry.attributes.normal, metres = material.userData.textureMeters || 1;
      for (let i = 0; i < p.count; i++) {
        const ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        geometry.attributes.uv.setXY(i, p.getX(i) / metres, (ny > nz ? p.getZ(i) : p.getY(i)) / metres);
      }
    }
    e.set(...rotation); q.setFromEuler(e); localMatrix.compose(new THREE.Vector3(...position), q, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(localMatrix); geometry.computeBoundingBox();
    const bounds = { min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() };
    geometry.applyMatrix4(frame);
    if (!batches.has(slot)) batches.set(slot, { material, pieces: [] }); batches.get(slot).pieces.push(geometry);
    placements.push({ building: building.id, role, slot, position: [...position], footprint, bounds }); counts[role] = (counts[role] || 0) + 1;
  }
  const box = (slot, p, s, rot = [0, 0, 0], role = 'story-prop', footprint = null) => append(slot, new THREE.BoxGeometry(...s), p, rot, role, footprint);
  const softBox = (slot, p, s, rot = [0, 0, 0], role = 'story-prop', footprint = null) => append(slot, roundedBox(s), p, rot, role, footprint);
  function rod(slot, a, b, radius = .015, role = 'story-frame', footprint = null) {
    const p = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(p), g = new THREE.CylinderGeometry(radius, radius, delta.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    append(slot, g, p.add(end).multiplyScalar(.5).toArray(), [0, 0, 0], role, footprint);
  }
  function surface(slot, points, indices, role, footprint = null) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(p => [p[0], p[2]]), 2)); g.setIndex(indices); g.computeVertexNormals(); append(slot, g, [0, 0, 0], [0, 0, 0], role, footprint);
  }
  function print(region, position, size, rotation, role, footprint = null) {
    const g = new THREE.PlaneGeometry(...size), [x, y, width, height] = PRINT_REGIONS[region], uv = g.attributes.uv;
    // Two texels of inset keep mip filtering inside its authored region.
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + 2 + uv.getX(i) * (width - 4)) / ATLAS_SIZE, 1 - (y + height - 2 - uv.getY(i) * (height - 4)) / ATLAS_SIZE);
    append('notice', g, position, rotation, role, footprint);
  }
  function finish(parent, ownedMaterials = []) {
    const root = new THREE.Group(); root.name = 'Blackwater-interrupted-evacuation-story'; parent.add(root);
    const meshes = [], geometries = []; let triangles = 0;
    for (const [slot, batch] of batches) {
      const g = mergeGeometries(batch.pieces, false); batch.pieces.forEach(p => p.dispose());
      if (!g) throw new Error(`Could not compile interior story material ${slot}`);
      g.computeBoundingSphere(); g.computeBoundingBox(); const mesh = new THREE.Mesh(g, batch.material);
      mesh.name = `Blackwater-interior-story-${slot}`; mesh.userData.blackwaterStory = true; mesh.receiveShadow = true; mesh.castShadow = slot !== 'paper';
      root.add(mesh); meshes.push(mesh); geometries.push(g); triangles += g.index.count / 3;
    }
    root.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root);
    let disposed = false;
    return { root, diagnostics: { triangles, drawCalls: meshes.length, moduleCounts: counts, placements, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, colliderCount: 0, collisionOwnership: 'existing architecture furniture/portal; only static decorative evidence' }, dispose() {
      if (disposed) return; disposed = true; root.removeFromParent(); geometries.forEach(g => g.dispose());
      for (const material of ownedMaterials) { material.map?.dispose(); material.dispose(); }
    } };
  }
  return { begin, append, box, softBox, rod, surface, print, finish };
}

function pharmacy(w, b) {
  w.begin(b); const width = b.width, depth = b.depth, leftX = -width / 2 + .72, rearZ = -depth / 2 + .65;
  const counterX = width / 2 - 2, counterZ = depth / 2 - 3.5;
  function carton(x, y, z, s, yaw, footprint, opened = false) {
    const [sx, sy, sz] = s;
    if (opened) {
      for (const direction of [-1, 1]) {
        w.box('cardboard', [x + direction * sx / 2, y, z], [.018, sy, sz], [0, yaw, 0], 'opened-triage-carton-wall', footprint);
        w.box('cardboard', [x, y, z + direction * sz / 2], [sx, sy, .018], [0, yaw, 0], 'opened-triage-carton-wall', footprint);
        w.box('cardboard', [x + direction * sx * .65, y + sy / 2, z], [sx * .30, .018, sz], [0, yaw, direction * .55], 'splayed-carton-flap', footprint);
      }
      w.box('cardboard', [x, y - sy / 2, z], [sx, .02, sz], [0, yaw, 0], 'emptied-triage-carton-base', footprint);
    } else w.softBox('cardboard', [x, y, z], s, [0, yaw, 0], 'triage-shipping-carton', footprint);
    w.box('paper', [x, y + sy / 2 + .009, z], [sx * .52, .010, sz * .66], [0, yaw, 0], 'carton-shipping-label', footprint);
  }
  // Half-empty cases and one opened packing carton establish what was removed.
  carton(leftX, .35, .4, [.55, .44, .64], 0, 'left-wall-shelving', true);
  carton(leftX, .36, -2.05, [.62, .45, .70], .02, 'left-wall-shelving');
  carton(-4.2, .38, rearZ + .05, [.73, .42, .42], .02, 'rear-stock-shelf', true);
  for (const [x, level] of [[-5.7, 2], [-4.9, 2], [-1.4, 1], [.3, 3], [3.4, 2], [5.7, 1]]) {
    const y = .17 + level * .43 + .22;
    w.softBox(WHITE, [x, y, rearZ + .18], [.31, .36, .14], [0, (x + 5) * .02, x === .3 ? .14 : 0], 'last-first-aid-carton', 'rear-stock-shelf');
    w.box(RED, [x, y + .025, rearZ + .263], [.21, .055, .014], [0, 0, 0], 'first-aid-carton-label', 'rear-stock-shelf');
  }
  // Five empty slot dividers are a larger readable absence, rather than dozens
  // of random single pills. The distribution thins towards the looted door.
  for (let i = 0; i < 5; i++) {
    const x = -3.1 + i * .48;
    w.box('paper', [x, 1.2, rearZ + .09], [.026, .34, .42], [0, 0, i === 3 ? .08 : 0], 'emptied-medical-stock-slot', 'rear-stock-shelf');
  }
  w.softBox('fabric', [counterX + .25, 1.4, counterZ + .03], [.76, .37, .55], [0, .09, -.02], 'abandoned-first-aid-satchel', 'cash-counter');
  w.rod('fabric', [counterX + .05, 1.55, counterZ], [counterX + .35, 1.65, counterZ], .027, 'first-aid-satchel-handle', 'cash-counter');
  w.box('paper', [counterX + .25, 1.41, counterZ + .314], [.36, .24, .015], [0, .09, 0], 'first-aid-satchel-patch', 'cash-counter');
  w.box(RED, [counterX + .25, 1.41, counterZ + .324], [.22, .064, .015], [0, .09, 0], 'readable-satchel-cross', 'cash-counter');
  w.box(RED, [counterX + .25, 1.41, counterZ + .334], [.064, .22, .015], [0, .09, 0], 'readable-satchel-cross', 'cash-counter');
  for (const [x, z] of [[counterX - .7, counterZ + .15], [counterX -.18, counterZ -.12]]) {
    w.softBox(WHITE, [x, 1.26, z], [.34, .15, .24], [0, .24, .03], 'opened-bandage-packet', 'cash-counter');
    w.box(RED, [x, 1.341, z], [.22, .012, .044], [0, .24, 0], 'bandage-packet-stripe', 'cash-counter');
  }
  // Knocked folding chair sits fully inside the shelf's solid footprint. The
  // path x0..4 from portal to cache remains empty of tall decorations.
  w.softBox('fabric', [leftX + .06, .64, 2.9], [.44, .43, .07], [0, .01, .24], 'knocked-triage-chair-back', 'left-wall-shelving');
  w.softBox('fabric', [leftX + .03, .39, 3.10], [.43, .06, .40], [0, .01, .24], 'knocked-triage-chair-seat', 'left-wall-shelving');
  for (const side of [-1, 1]) {
    w.rod('metal', [leftX + side * .22, .18, 3.25], [leftX + side * .22 + .10, .88, 2.84], .021, 'bent-triage-chair-frame', 'left-wall-shelving');
    w.rod('metal', [leftX + side * .21, .18, 2.80], [leftX + side * .21 + .09, .52, 3.18], .021, 'bent-triage-chair-frame', 'left-wall-shelving');
  }
  // Queue tape and the final departure poster face the entrance; no tape spans
  // the actual door. Bent strips above the side glazing cast physical shadows.
  w.print('pharmacy', [-3.4, 2.48, -depth / 2 + .285], [2.55, 1.18], [0, 0, -.03], 'last-evacuation-departure-notice');
  const cacheX = b.doorOffset ?? 2, cacheZ = -depth / 2 + 3;
  w.box(WHITE, [cacheX, .165, cacheZ], [.80, .012, .80], [0, .025, 0], 'cache-first-aid-floor-marker');
  w.box(RED, [cacheX, .175, cacheZ], [.55, .014, .14], [0, .025, 0], 'cache-first-aid-floor-cross');
  w.box(RED, [cacheX, .178, cacheZ], [.14, .014, .55], [0, .025, 0], 'cache-first-aid-floor-cross');
  for (let i = 0; i < 8; i++) w.box('metal', [-width / 2 + 1.15, 2.54 + i * .055, depth / 2 - .24], [1.5, .032, .095], [.05, 0, i % 3 === 0 ? .09 : -.02], 'bent-shutter-light-filter');
  w.surface('paper', [[-6.7, 1.04, 4.8], [-4.7, .70, 4.66], [-4.7, .79, 4.66], [-6.7, 1.13, 4.8]], [0, 1, 2, 0, 2, 3], 'torn-interior-queue-tape');
  // A causal fan of wrapper debris is beneath the emptied shelf. Everything is
  // ankle-height and kept out of the portal/cache passage.
  for (let i = 0; i < 9; i++) {
    const x = -6.4 + (i % 3) * .43, z = -1.5 + Math.floor(i / 3) * .49;
    w.surface('paper', [[x, .167, z], [x + .29, .168, z + .04], [x + .25, .206, z + .32], [x -.025, .191, z + .26]], [0, 1, 2, 0, 2, 3], 'spilled-first-aid-wrapping');
  }
}

function openTravelBag(w) {
  const origin = [3.52, .64, 3.15], footprint = 'living-sofa';
  const heightScale = 1.7, lift = y => origin[1] + (y - origin[1]) * heightScale;
  const shell = new THREE.BufferGeometry(), points = [], indices = [];
  // A closed bottom, tapered outer shell, rolled opening and inner cavity.
  // The ring skin is authored explicitly so this reads as open luggage rather
  // than a sphere with bars. Its complete silhouette fits the sofa footprint.
  const rings = [[1.04,.53,0],[1.14,.61,.08],[1.04,.57,.34],[.94,.47,.34],[.91,.43,.08]];
  for (const [width, depth, y] of rings) {
    const hx = width / 2, hz = depth / 2, r = .095;
    for (const [x,z] of [[-hx+r,-hz],[hx-r,-hz],[hx,-hz+r],[hx,hz-r],[hx-r,hz],[-hx+r,hz],[-hx,hz-r],[-hx,-hz+r]]) points.push([x,y,z]);
  }
  for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < 8; i++) {
    const a = ring * 8 + i, b = ring * 8 + (i + 1) % 8, c = b + 8, d = a + 8;
    indices.push(a,c,b,a,d,c);
  }
  points.push([0,0,0],[0,.08,0]);
  for (let i=0;i<8;i++) { indices.push(40,i,(i+1)%8); indices.push(41,32+(i+1)%8,32+i); }
  shell.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(),3)); shell.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(p=>[p[0],p[1]+p[2]]),2)); shell.setIndex(indices); shell.computeVertexNormals();
  shell.scale(1,heightScale,1);
  w.append('fabric',shell,origin,[0,0,0],'opened-evacuation-duffel-shell',footprint);
  const add = (slot,p,size,role) => w.softBox(slot,p.map((v,i)=>v*(i===1?heightScale:1)+origin[i]),size.map((v,i)=>v*(i===1?heightScale:1)),[0,0,0],role,footprint);
  add('dark',[0,.225,.303],[.76,.185,.065],'duffel-raised-front-pocket');
  // Deliberately broad edge piping and a broken-open silver zipper remain
  // visible at 390px; tiny stitches would disappear under bodycam filtering.
  for (const side of [-1,1]) {
    w.rod('paper',[origin[0]+side*.385,lift(.76),3.489],[origin[0]+side*.385,lift(.94),3.489],.008,'duffel-pocket-piping',footprint);
    w.rod('metal',[origin[0]+side*.46,lift(.987),2.895],[origin[0]+side*.19,lift(.990),2.915],.012,'opened-duffel-zipper',footprint);
    add('dark',[side*.568,.23,.01],[.018,.36,.058],'duffel-reinforced-end-webbing');
  }
  w.rod('paper',[3.135,lift(.943),3.489],[3.905,lift(.943),3.489],.008,'duffel-pocket-piping',footprint);
  add('metal',[-.19,.351,-.224],[.057,.022,.043],'duffel-zip-pull');
  for (const x of [-.36,.36]) {
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(x,.23,.20),new THREE.Vector3(x,.52,.10),new THREE.Vector3(x,.54,-.09),new THREE.Vector3(x,.23,-.21)]);
    const handle = new THREE.TubeGeometry(path,8,.025,6,false); handle.scale(1,heightScale,1);
    w.append('dark',handle,origin,[0,0,0],'duffel-arched-webbing-handles',footprint);
    add('dark',[x,.11,.312],[.048,.21,.019],'duffel-load-bearing-webbing');
  }
  // Two rolled/folded textiles break the dark bag's value mass. The red shirt
  // folds are tied to the child's red route markings and the luggage tag.
  add(WHITE,[-.12,.235,-.02],[.53,.18,.35],'packed-folded-cream-clothing');
  add(RED,[.17,.30,.015],[.38,.13,.29],'packed-folded-red-child-shirt');
  add('paper',[-.12,.286,.16],[.48,.016,.025],'folded-clothing-edge');
  w.print('tag',[3.98,lift(.93),3.452],[.16,.22],[0,0,-.15],'duffel-handwritten-destination-tag',footprint);
}

function family(w, b) {
  w.begin(b);
  // Dinner halted midway through packing. Two plates and an overturned mug read
  // at street/phone scale without filling the table with tiny decorative noise.
  for (const [x, z] of [[3.12, -1.43], [4.41, -1.16]]) {
    const plate = new THREE.CylinderGeometry(.23, .21, .035, 18); w.append(WHITE, plate, [x, .831, z], [0, 0, 0], 'interrupted-family-dinner-plate','kitchen-dining-table');
    w.append('cardboard', new THREE.SphereGeometry(.095, 10, 6), [x + .02, .942, z], [0, .3, 0], 'unfinished-family-meal','kitchen-dining-table');
    w.rod('metal', [x + .28, .823, z -.12], [x + .28, .823, z + .13], .010, 'left-behind-cutlery','kitchen-dining-table');
  }
  const mug = new THREE.CylinderGeometry(.080, .069, .17, 14); w.append(WHITE, mug, [3.86, .907, -1.29], [0, 0, 1.10], 'overturned-dinner-mug','kitchen-dining-table');
  w.append('metal', new THREE.TorusGeometry(.047, .012, 6, 12), [3.90, .900, -1.18], [.3, 0, 1.1], 'mug-handle','kitchen-dining-table');
  openTravelBag(w);
  w.softBox('cardboard', [4.46, .829, 3.1], [.63, .35, .48], [0, -.15, .06], 'packed-family-photo-carton','living-sofa');
  w.print('tag', [4.46, 1.025, 3.1], [.38, .18], [-Math.PI/2,0,-.15], 'family-carton-address-label','living-sofa');
  // House keys and folded evacuation instructions lie beside the cold stove.
  w.print('map',[2.87,1.073,-5.51],[.46,.33],[-Math.PI/2,0,.12],'folded-home-evacuation-map','kitchen-worktop');
  w.append('metal', new THREE.TorusGeometry(.045, .012, 6, 12), [4.31, 1.073, -5.50], [Math.PI / 2, 0, 0], 'left-behind-house-key-ring','kitchen-worktop');
  for (const x of [4.29, 4.37]) { w.box('metal', [x, 1.070, -5.38], [.027, .014, .14], [0, .18, 0], 'left-behind-house-key','kitchen-worktop'); w.box('metal', [x + .017, 1.070, -5.32], [.054, .014, .030], [0, .18, 0], 'house-key-teeth','kitchen-worktop'); }
  w.softBox('wood', [5.00, 1.347, -5.55], [.49, .55, .055], [0, -.08, -.045], 'packed-family-photo-frame','kitchen-worktop');
  w.print('photo',[5.00,1.347,-5.509],[.38,.44],[0,-.08,-.045],'family-photo-mount','kitchen-worktop');
  // A displaced family frame exposes a pale paint ghost. The bent lower rail,
  // isolated nail, paper tears and taped route form one medium-scale cluster.
  w.box('pale',[2.56,1.71,.097],[1.13,.90,.012],[0,0,0],'torn-away-family-frame-paint-ghost');
  w.surface('paper',[[2.02,1.16,.108],[2.92,1.16,.108],[3.02,1.39,.108],[2.76,1.48,.108],[2.31,1.34,.108],[2.17,1.45,.108]],[0,1,2,0,2,3,0,3,4,0,4,5],'torn-frame-backing-remnant');
  w.rod('metal',[2.55,2.15,.105],[2.55,2.15,.14],.018,'former-family-frame-hanging-nail');
  w.rod('wood',[2.05,1.18,.15],[2.97,1.07,.15],.025,'displaced-family-frame-rail');
  w.print('photo',[2.55,1.72,.114],[.77,.64],[0,0,-.12],'displaced-family-photo-on-partition');
  w.print('route',[4.24,1.66,.113],[1.47,1.40],[0,0,.025],'family-evacuation-wall-route');
  w.print('note',[5.94,1.70,.115],[1.45,.74],[0,0,-.055],'handwritten-family-departure-note');
  for(const [x,y,z,angle] of [[3.56,2.35,.12,-.10],[4.9,2.33,.12,.12],[5.37,2.08,.123,-.20],[6.51,2.04,.123,.17]]) w.box('cardboard',[x,y,z],[.20,.072,.012],[0,0,angle],'family-map-fixing-tape');
  // Localized torn wall finish below the missing frame, not repeated grime.
  w.surface('cardboard',[[1.50,.45,.107],[1.91,.48,.107],[2.00,.68,.107],[1.80,.91,.107],[1.60,.80,.107]],[0,1,2,0,2,3,0,3,4],'localized-torn-partition-paper');
  w.surface('paper',[[1.57,.51,.12],[1.72,.76,.16],[1.82,.85,.12],[1.74,.72,.118]],[0,1,2,0,2,3],'curled-partition-paper-edge');
  // The table map and fridge reminder share the same red route/boat motif.
  w.print('map',[3.92,.607,1.27],[1.12,.66],[-Math.PI/2,0,-.11],'open-coffee-table-evacuation-map','living-coffee-table');
  w.rod('paper',[3.92,.611,.945],[3.92,.619,1.595],.006,'creased-open-route-map','living-coffee-table');
  // The entry camera sees the fridge's left enamel flank. Tape the family
  // reminders there, rather than hiding them on its edge-on front doors.
  w.print('route',[6.216,1.45,-3.80],[.58,.64],[0,-Math.PI/2,-.045],'fridge-pinned-evacuation-route','kitchen-fridge');
  w.print('note',[6.216,.92,-3.80],[.64,.32],[0,-Math.PI/2,.06],'fridge-family-meeting-reminder','kitchen-fridge');
  for(const [z,y] of [[-4.04,1.735],[-3.57,1.715]]) w.softBox(RED,[6.204,y,z],[.016,.07,.09],[0,0,0],'fridge-red-paper-magnets','kitchen-fridge');
  // Flat dragging traces and two dropped sheets connect the packing sofa to
  // the front departure. Nothing standing is added to the four-metre route.
  for(const [x,z] of [[2.47,4.04],[1.57,4.64],[.67,5.24]]) {
    // Unequal tapered scratches follow the departure vector. Low-contrast
    // exposed timber reads as a scuff, rather than loose opaque black bars.
    for(const [offset,length,width]of [[0,.76,.032],[.15,.49,.017]]){
      const cx=x+offset*.55,cz=z+offset*.83,dx=-.83*length/2,dz=.55*length/2;
      const a=[cx-dx,.080,cz-dz],b=[cx+dx,.080,cz+dz],nx=.55*width,nz=.83*width;
      w.surface('cardboard',[[a[0]-nx*.65,.080,a[2]-nz*.65],[a[0]+nx,.080,a[2]+nz],[cx+nx*.44,.080,cz+nz*.44],b,[cx-nx*.40,.080,cz-nz*.40]],
       [0,2,1,0,3,2,0,4,3],'evacuation-bag-drag-floor-trace');
    }
  }
  w.print('note',[1.20,.080,4.21],[.38,.20],[-Math.PI/2,0,.31],'dropped-family-packing-note');
  w.print('tag',[-.02,.079,5.21],[.26,.25],[-Math.PI/2,0,-.29],'dropped-departure-luggage-label');
}

export function buildBlackwaterInteriorStory(parent, slice, materials) {
  const notice = noticeMaterial(), w = compiler({ ...materials, notice });
  const shop = slice.buildings.find(b => /pharmacy/i.test(b.label) && b.enterable) || (slice.shop ? { ...slice.shop, y: .13 } : null);
  if (shop) pharmacy(w, shop);
  for (const house of slice.buildings.filter(b => b.id==='coast-lot-1-0-0-2' && b.enterable)) family(w, house);
  const result = w.finish(parent, [notice]);
  result.diagnostics.pharmacyId = shop?.id || null;
  result.diagnostics.houseIds = slice.buildings.filter(b => b.kind === 'house' && b.enterable).map(b => b.id);
  result.diagnostics.inspectionCamera = { pharmacy: { position: [202, 1.8, 45.5], target: [197.7, 1.3, 37.1] }, house: { position: [194, 1.8, 68], target: [188.2, 1.1, 75.2] } };
  return result;
}

export function buildBlackwaterHouseStory(parent, building, materials) {
  const notice = noticeMaterial(), w = compiler({ ...materials, notice }); family(w, building); return w.finish(parent,[notice]);
}
