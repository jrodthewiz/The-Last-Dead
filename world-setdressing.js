import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { buildLifeField, wallSpots, scatterSpots, lifeRng, seedFor } from './world-polish.js';

// Hero-scale set dressing for the campaign sectors. The instanced life kit
// supplies knee-high clutter; these props are the 2-4 m silhouettes a player
// reads at sprint speed: what this place did, and to whom. Each factory is a
// staged img2threejs-style build (macro mass -> structure -> detail) with a
// named part list in SETDRESSING_SPECS so coverage can be checked, and every
// prop is grounded (base at y=0) with its back on local -z, facing +z.
// Everything is static and visual only; collision stays on the course grid.

const TAU = Math.PI * 2;

const place = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
};
const box = (w, h, d, ...t) => place(new THREE.BoxGeometry(w, h, d), ...t);
const cyl = (rt, rb, h, seg, ...t) => place(new THREE.CylinderGeometry(rt, rb, h, seg), ...t);
const sphere = (r, ws, hs, ...t) => place(new THREE.SphereGeometry(r, ws, hs), ...t);
const capsule = (r, len, ...t) => place(new THREE.CapsuleGeometry(r, len, 3, 8), ...t);
const torus = (r, tube, ...t) => place(new THREE.TorusGeometry(r, tube, 6, 16), ...t);
const cone = (r, h, seg, ...t) => place(new THREE.ConeGeometry(r, h, seg), ...t);
const ico = (r, ...t) => place(new THREE.IcosahedronGeometry(r, 1), ...t);
const lathe = (profile, seg, ...t) => place(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg), ...t);
const tube = (points, radius, seg = 12) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), seg, radius, 6, false);

function tarp(cx, top) {
  const columns = [-.68, -.34, 0, .34, .68];
  const rows = [[-.48, top - .02], [-.12, top + .04], [.34, top + .01], [.53, top - .16], [.62, top - .58]];
  const position = [], uv = [], index = [];
  for (let row = 0; row < rows.length; row++) for (let col = 0; col < columns.length; col++) {
    const fold = Math.sin(col * 2.7 + row * 1.9) * .035;
    position.push(cx + columns[col], rows[row][1] + fold, rows[row][0]);
    uv.push(col / (columns.length - 1), row / (rows.length - 1));
  }
  for (let row = 0; row < rows.length - 1; row++) for (let col = 0; col < columns.length - 1; col++) {
    const a = row * columns.length + col, b = a + columns.length;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

function merge(parts) {
  const flat = parts.map(part => (part.index ? part.toNonIndexed() : part));
  for (const part of flat) for (const key of Object.keys(part.attributes)) if (!['position', 'normal', 'uv'].includes(key)) part.deleteAttribute(key);
  const merged = mergeGeometries(flat, false);
  for (const part of parts) part.dispose();
  for (const part of flat) if (!parts.includes(part)) part.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// Skull: cranium, cheek block, jaw and two sockets. Sockets go to the dark
// layer so the face reads at 10 m instead of a pale ball.
function skull(layers, x, y, z, s = 1, ry = 0, tilt = 0) {
  const t = (g) => { g.scale(s, s, s); g.rotateX(tilt); g.rotateY(ry); g.translate(x, y, z); return g; };
  layers.bone.push(t(ico(.17, 0, .04, 0, 0, 0, 0, 1, .92, 1.08)), t(box(.2, .1, .15, 0, -.1, .06)), t(box(.15, .045, .1, 0, -.19, .07)));
  for (let i = 0; i < 5; i++) layers.bone.push(t(box(.022, .035, .02, -.05 + i * .025, -.155, .135)));
  layers.dark.push(t(sphere(.045, 6, 4, -.06, .02, .15)), t(sphere(.045, 6, 4, .06, .02, .15)), t(cone(.025, .05, 4, 0, -.05, .16, Math.PI)));
}

// Curled humanoid silhouette used inside vats and under sheets.
function curledBody(list, x, y, z, s = 1) {
  const t = g => { g.scale(s, s, s); g.translate(x, y, z); return g; };
  list.push(
    t(capsule(.2, .42, 0, 0, 0, .35)), // torso, pitched forward
    t(sphere(.15, 10, 8, .04, .5, .12)),
    t(capsule(.08, .36, -.2, -.1, .18, -.9, 0, .3)), t(capsule(.08, .36, .2, -.1, .18, -.9, 0, -.3)),
    t(capsule(.1, .42, -.12, -.42, .2, -1.2)), t(capsule(.1, .42, .12, -.42, .2, -1.2)),
    t(capsule(.08, .36, -.12, -.62, -.05, .5)), t(capsule(.08, .36, .12, -.62, -.05, .5)),
  );
}

const FACTORIES = {
  // Bloodworks: a pressurised specimen tube. Plinth, glass column, glowing
  // fluid and a curled occupant; feed hoses climb toward the ceiling.
  specimenVat(L, rng) {
    L.metal.push(cyl(.95, 1.05, .42, 16, 0, .21, 0), cyl(.84, .84, .12, 16, 0, .48, 0), cyl(.9, .82, .34, 16, 0, 3.12, 0), cyl(.34, .5, .3, 12, 0, 3.44, 0));
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + TAU / 8; L.metal.push(box(.1, 2.7, .1, Math.cos(a) * .86, 1.8, Math.sin(a) * .86)); }
    for (const y of [.62, 2.95]) L.metal.push(torus(.82, .05, 0, y, 0, Math.PI / 2));
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; L.dark.push(cyl(.03, .03, .05, 6, Math.cos(a) * .9, .44, Math.sin(a) * .9)); }
    L.hazard.push(cyl(1.06, 1.06, .07, 16, 0, .35, 0));
    L.glass.push(cyl(.76, .76, 2.42, 20, 0, 1.75, 0, 0, 0, 0, 1, 1, 1));
    L.fluid.push(cyl(.7, .7, 2.1 - rng() * .3, 18, 0, 1.64, 0));
    curledBody(L.flesh, 0, 1.75, 0, .95 + rng() * .15);
    L.dark.push(tube([[.3, 3.5, 0], [.45, 4.2, -.2], [.4, 5.2, -.7], [.2, 6.5, -.9]], .07), tube([[-.28, 3.5, 0], [-.6, 4.4, -.4], [-.5, 5.4, -.8], [-.3, 6.5, -.9]], .055));
    L.gore.push(sphere(.55, 10, 6, .3, .012, 1.45, 0, 0, 0, 1.3, .02, .9));
    L.metal.push(cyl(.5, .5, .06, 12, 0, 6.5, -.9), box(1.2, .08, .12, 0, 6.45, -.9));
  },
  // Bloodworks: a gurney with a sheeted body, a drip stand and a bag.
  gurney(L, rng) {
    for (const x of [-.95, .95]) for (const z of [-.32, .32]) { L.metal.push(cyl(.035, .035, .78, 6, x, .47, z)); L.dark.push(torus(.07, .03, x, .08, z)); }
    L.metal.push(box(2.1, .06, .74, 0, .88, 0), box(2.1, .04, .04, 0, .5, -.33), box(2.1, .04, .04, 0, .5, .33));
    L.cloth.push(box(1.9, .08, .7, 0, .95, 0));
    // sheet over a body: shoulders, chest, knees and feet push the cloth
    // one shroud lathe: head, neck, shoulders, chest, hips, knees, feet
    L.cloth.push(lathe([[0, -.92], [.1, -.9], [.14, -.78], [.08, -.62], [.23, -.52], [.24, -.2], [.2, .05], [.22, .18], [.14, .5], [.12, .62], [.09, .82], [.12, .9], [0, .94]], 12, 0, 1.0, 0, 0, 0, Math.PI / 2, 1, 1, .62));
    L.cloth.push(box(1.9, .5, .02, 0, .72, .37, .12), box(1.9, .5, .02, 0, .72, -.37, -.12));
    L.skin.push(capsule(.045, .38, -.3, .72, .42, .15), sphere(.055, 6, 4, -.32, .47, .45), box(.1, .03, .06, -.32, .44, .46));
    L.gore.push(sphere(.24, 10, 6, -.25, 1.2, .08, 0, 0, 0, 1.4, .05, 1.1), sphere(.42, 10, 6, -.32, .012, .62, 0, 0, 0, 1.3, .02, 1));
    L.metal.push(cyl(.025, .025, 1.9, 6, 1.15, .95, -.25), cyl(.25, .25, .03, 8, 1.15, .02, -.25), box(.4, .025, .025, 1.15, 1.88, -.25));
    L.fluid.push(capsule(.08, .16, 1.28, 1.7, -.25));
    L.dark.push(tube([[1.28, 1.58, -.25], [1.25, 1.2, -.1], [.6, 1.08, .2], [.2, 1.02, .3]], .012, 8));
  },
  // Bloodworks: crates, a tipped cabinet and a tarp - the random clutter.
  crateStack(L, rng) {
    const jitter = (rng() - .5) * .12;
    const crates = [[-.54 + jitter, .45, 0, .96, .9, .88], [.43 + jitter, .44, -.02, .86, .88, .82], [-.08 + jitter, 1.24, -.04, .82, .7, .8]];
    for (const [x, y, z, w, h, d] of crates) {
      L.wood.push(box(w, h, d, x, y, z));
      for (const edge of [-1, 1]) L.metal.push(box(w + .02, .055, d + .02, x, y + edge * h * .38, z));
      L.dark.push(box(w * .42, h * .22, .012, x, y, z + d * .5 + .009));
    }
    L.cloth.push(tarp(-.08 + jitter, 1.61));
    // A real three-drawer filing cabinet, toppled against the crate base.
    // Every drawer is transformed with the shell so the hardware stays seated.
    const cabinet = (geometry, lx = 0, ly = 0, lz = 0) => {
      geometry.translate(lx, ly, lz);
      geometry.rotateZ(1.18);
      geometry.translate(1.38, .57, .12);
      return geometry;
    };
    L.steel.push(cabinet(box(.72, 1.14, .58)));
    for (const y of [-.36, 0, .36]) {
      L.metal.push(cabinet(box(.62, .29, .028), 0, y, .303));
      L.hazard.push(cabinet(box(.26, .025, .035), 0, y, .332));
    }
    L.gore.push(sphere(.45, 10, 6, 1.76, .012, .54, 0, 0, 0, 1.4, .02, 1));
  },
  // Ossuary: a mound of skulls banked against the wall with votive candles.
  skullMound(L, rng) {
    L.stone.push(lathe([[0, 0], [1.3, 0], [1.05, .35], [.6, .8], [.15, 1.05], [0, 1.08]], 14, 0, 0, 0, 0, 0, 0, 1, 1, .8));
    // Most of the old 28-piece bead pile collapsed into pale spheres at play
    // distance. Use a few dark, irregular load fragments for the mass and keep
    // only a small number of legible remains at the exposed face.
    const fragments = [
      [-.8, .18, .1, .9, .58, .72], [-.3, .24, .18, .72, .66, .86], [.28, .16, .08, .82, .48, .72],
      [.72, .2, .2, .66, .74, .8], [-.62, .48, -.02, .62, .7, .64], [.04, .52, .12, .78, .58, .7],
      [.58, .46, .08, .56, .62, .68], [-.34, .76, .02, .48, .56, .58], [.3, .72, .06, .46, .5, .62],
    ];
    for (const [x, y, z, sx, sy, sz] of fragments) {
      const rock = ico(.3 + rng() * .08, x, y, z, rng() * .4, rng() * TAU, rng() * .3, sx, sy, sz);
      L.stone.push(rock);
    }
    const remains = [
      [-.58, .32, .66, 1.12], [-.18, .22, .93, 1.18], [.3, .3, .84, 1.08], [.68, .25, .65, 1.02],
    ];
    for (const [x, y, z, scale] of remains) {
      skull(L, x, y, z, scale + rng() * .08, (rng() - .5) * .3, (rng() - .5) * .2);
    }
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI, r = 1.45 + rng() * .3, h = .12 + rng() * .25;
      L.wax.push(cyl(.035, .045, h, 6, Math.cos(a) * r, h * .5, Math.sin(a) * r * .8));
      L.flame.push(cone(.028, .09, 5, Math.cos(a) * r, h + .05, Math.sin(a) * r * .8));
    }
  },
  // Ossuary: stacked iron-banded coffins, the top lid pried with an arm out.
  coffinStack(L, rng) {
    const shape = new THREE.Shape();
    shape.moveTo(-.24, -1); shape.lineTo(.24, -1); shape.lineTo(.62, .38); shape.lineTo(.4, 1); shape.lineTo(-.4, 1); shape.lineTo(-.62, .38); shape.closePath();
    const coffin = (lie, ry, x, y, z, lift) => {
      const shell = shape.clone();
      if (lift) {
        const opening = new THREE.Path();
        opening.moveTo(-.11, -.84); opening.lineTo(-.27, .84); opening.lineTo(.27, .84);
        opening.lineTo(.43, .3); opening.lineTo(.11, -.84); opening.closePath();
        shell.holes.push(opening);
      }
      const body = new THREE.ExtrudeGeometry(shell, { depth: .45, bevelEnabled: !lift, bevelSize: .03, bevelThickness: .03, bevelSegments: 1 });
      if (lie) body.rotateX(-Math.PI / 2); else { body.translate(0, 1, -.45); body.rotateX(-.18); }
      body.rotateY(ry); body.translate(x, y, z);
      L.wood.push(body);
      if (!lift) {
        // Inset lid and raised cross make the tapered top readable from the
        // low player camera, where the side alone resembles a crate.
        const lid = new THREE.ShapeGeometry(shape, 4);
        lid.scale(.9, .94, 1); lid.rotateX(-Math.PI / 2); lid.rotateY(ry); lid.translate(x, y + .49, z);
        L.dark.push(lid);
        const cross = (geometry, lx, lz) => {
          geometry.translate(lx, .51, lz); geometry.rotateY(ry); geometry.translate(x, y, z);
          return geometry;
        };
        L.metal.push(cross(box(.05, .018, 1.15), 0, 0), cross(box(.55, .018, .05), 0, -.2));
        for (const off of [-.55, .55]) L.metal.push(cross(box(.92, .04, .06), 0, off));
        return;
      }
      // Expose the upright coffin's silhouette against the dark cavity.
      const backing = new THREE.ShapeGeometry(shape, 4);
      backing.translate(0, 1, -.47); backing.rotateX(-.18); backing.rotateY(ry); backing.translate(x, y, z);
      L.dark.push(backing);
      for (const edge of [-1, 1]) L.metal.push(box(.065, 1.9, .08, x + edge * .52, y + 1, z + .08, -.18, ry));
      for (const height of [.3, 1.35, 1.9]) L.metal.push(box(1.05, .06, .08, x, y + height, z + .1, -.18, ry));
      // lid swung open on the left hinge, a pale arm and hand spilling out
      const lid = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false });
      lid.translate(.56, 1, 0); lid.rotateY(-1.9); lid.translate(-.56, 0, .02); lid.rotateX(-.18); lid.rotateY(ry); lid.translate(x, y, z);
      L.wood.push(lid);
      L.skin.push(capsule(.05, .42, x + .22, y + 1.02, z + .3, .5, 0, -.35), sphere(.065, 8, 6, x + .3, y + .72, z + .45), capsule(.018, .08, x + .33, y + .64, z + .47));
      L.skin.push(sphere(.18, 10, 8, x - .02, y + 1.58, z + .22), capsule(.18, .52, x, y + 1.12, z + .17, -.18));
      L.dark.push(sphere(.046, 6, 4, x - .09, y + 1.61, z + .38), sphere(.046, 6, 4, x + .05, y + 1.61, z + .38));
    };
    coffin(false, (rng() - .5) * .2, -.7, 0, -.12, true);
    coffin(true, 1.4 + (rng() - .5) * .3, .75, .03, .55, false);
    coffin(true, 1.7 + (rng() - .5) * .4, .8, .53, .45, false);
    skull(L, -.6, .22, .7, 1, .4);
  },
  // Ossuary: stone altar block lined with candles and a crowned skull.
  candleAltar(L, rng) {
    L.stone.push(box(1.8, .95, .9, 0, .475, 0), box(2, .12, 1.05, 0, 1.0, 0), box(1.6, .1, .8, 0, .05, 0));
    L.cloth.push(box(.6, .02, 1.07, 0, 1.07, 0), box(.6, .7, .02, 0, .72, .53));
    skull(L, 0, 1.33, 0, 1.4, 0);
    L.brass.push(torus(.2, .03, 0, 1.47, -.01, Math.PI / 2 - .15));
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; L.brass.push(cone(.03, .16, 4, Math.cos(a) * .2, 1.56, Math.sin(a) * .2 - .01)); }
    for (let i = 0; i < 10; i++) {
      const x = (rng() < .5 ? -1 : 1) * (.45 + rng() * .45), z = (rng() - .5) * .8, h = .15 + rng() * .45;
            L.wax.push(cyl(.04, .055, h, 6, x, 1.06 + h * .5, z), cyl(.07, .08, .03, 6, x, 1.07, z));
      L.flame.push(cone(.032, .1, 5, x, 1.06 + h + .06, z));
    }
    L.wax.push(box(.3, .5, .02, -.6, .8, .46, 0, 0, .05), box(.2, .35, .02, .55, .85, .46));
  },
  // Choir: a cracked bell brought down and tipped on its shoulder, its lip
  // ringed with teeth. Hangs nothing; it is the thing that fell.
  fallenBell(L, rng) {
    const profile = [[.12, 1.9], [.55, 1.85], [.78, 1.6], [.86, 1.1], [.95, .6], [1.22, .12], [1.3, 0], [1.2, 0], [1.1, .1], [.84, .58], [.76, 1.08], [.68, 1.55], [.45, 1.75], [.12, 1.78]];
    const bell = lathe(profile, 28);
    const tip = 1.25 + rng() * .2;
    bell.translate(0, -.95, 0); bell.rotateZ(tip); bell.translate(0, 1.18, 0);
    L.brass.push(bell);
    // A deep, dark mouth gives the fallen shell a bell silhouette in the
    // corridor rather than the flat end of a barrel.
    const mouth = cyl(1.09, 1.09, .025, 28, 0, .12, 0);
    mouth.translate(0, -.95, 0); mouth.rotateZ(tip); mouth.translate(0, 1.18, 0);
    L.dark.push(mouth);
    const lip = [];
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; lip.push(cone(.06, .22 + rng() * .1, 5, Math.cos(a) * 1.18, .12, Math.sin(a) * 1.18, Math.PI)); }
    const teeth = merge(lip); teeth.translate(0, -.95, 0); teeth.rotateZ(tip); teeth.translate(0, 1.18, 0);
    L.bone.push(teeth);
    L.metal.push(sphere(.22, 10, 8, .95, .24, .1), cyl(.04, .04, 1.1, 6, .45, .45, .05, 0, 0, 1.2));
    L.brass.push(box(.5, .3, .5, -1.9, .15, 0, 0, .3), torus(.28, .06, -1.9, .42, 0, 0, 0, Math.PI / 2));
    L.dark.push(box(.04, 1.2, .02, .2, 1.0, 1.02, 0, 0, .4));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI + .3; L.stone.push(ico(.14 + rng() * .16, Math.cos(a) * 1.35, .1, Math.sin(a) * 1.25)); }
    L.gore.push(sphere(.6, 10, 6, .9, .02, .4, 0, 0, 0, 1.5, .04, 1));
  },
  // Choir: a broken choir stall with a slumped, hooded chorister.
  choirStall(L, rng) {
    L.wood.push(box(2.6, .1, .55, 0, .48, 0), box(2.6, 1.3, .08, 0, .95, -.28), box(2.6, .1, .3, 0, 1.62, -.2));
    for (const x of [-1.3, 1.3]) L.wood.push(box(.1, 1.7, .6, x, .85, 0));
    for (let i = 0; i < 6; i++) L.wood.push(box(.08, .45, .45, -1.1 + i * .44, .23, 0));
    L.wood.push(box(1.1, .1, .5, 1.6, .15, .5, 0, .6, .3));
    const x = -.4 + rng() * .5;
    L.cloth.push(box(.72, .16, .56, x, .6, .05), lathe([[0, 0], [.4, 0], [.38, .35], [.28, .66], [0, .78]], 12, x, .58, -.1, .6));
    // hood is a sphere shell open toward +z so the drawn face shows
    const hood = new THREE.SphereGeometry(.27, 12, 8, Math.PI * .8, Math.PI * 1.4, 0, Math.PI * .8);
    hood.scale(1, 1.2, 1.08); hood.rotateX(.35); hood.translate(x, 1.22, .34);
    L.cloth.push(hood, cone(.16, .26, 8, x, 1.45, .26, -.5));
    L.skin.push(sphere(.14, 10, 8, x, 1.16, .41, .35, 0, 0, .85, 1.15, .85));
    L.dark.push(sphere(.038, 6, 4, x - .055, 1.19, .52), sphere(.038, 6, 4, x + .055, 1.19, .52), box(.09, .025, .02, x, 1.05, .53));
    for (const side of [-1, 1]) L.skin.push(capsule(.06, .45, x + side * .29, .8, .34, .15), sphere(.06, 6, 4, x + side * .29, .51, .36));
    L.stone.push(box(.6, .02, .35, x - .2, .02, .6));
    L.wax.push(cyl(.05, .06, .35, 6, 1.05, .7, .1));
    L.flame.push(cone(.035, .1, 5, 1.05, .93, .1));
  },
};

// Per-prop spec: the named part inventory and footprint the factories honour.
// Footprint radius feeds lane clearance; `wall` props hug room shells.
export const SETDRESSING_SPECS = Object.freeze({
  specimenVat: { sector: 'bloodworks', radius: 1.2, wall: true, parts: ['plinth', 'glass-column', 'fluid', 'occupant', 'struts', 'cap', 'feed-hoses', 'spill'] },
  gurney: { sector: 'bloodworks', radius: 1.3, wall: true, parts: ['legs', 'casters', 'tray', 'sheet', 'draped-body', 'hanging-arm', 'drip-stand', 'bag', 'blood'] },
  crateStack: { sector: 'bloodworks', radius: 1.4, wall: true, parts: ['crates', 'straps', 'tarp', 'tipped-cabinet'] },
  skullMound: { sector: 'ossuary', radius: 1.5, wall: true, parts: ['earth-mound', 'skulls', 'candles', 'flames'] },
  coffinStack: { sector: 'ossuary', radius: 1.4, wall: true, parts: ['coffins', 'iron-bands', 'pried-lid', 'arm', 'plinth', 'skull'] },
  candleAltar: { sector: 'ossuary', radius: 1.3, wall: true, parts: ['altar-block', 'mensa', 'cloth', 'crowned-skull', 'candles', 'wax-runs'] },
  fallenBell: { sector: 'choir', radius: 2.2, wall: false, parts: ['bell', 'lip-teeth', 'crown-yoke', 'crack', 'rubble', 'blood'] },
  choirStall: { sector: 'choir', radius: 1.6, wall: true, parts: ['seat', 'back', 'misericords', 'broken-kneeler', 'chorister', 'arm', 'candle'] },
});

const SECTOR_RECIPES = {
  bloodworks: [['specimenVat', 5], ['gurney', 5], ['crateStack', 6]],
  ossuary: [['skullMound', 5], ['coffinStack', 4], ['candleAltar', 3]],
  choir: [['fallenBell', 3], ['choirStall', 7]],
};

// Story floors use smaller, purpose-led prop counts. The architectural kit
// carries the room identity; these silhouettes make the former use legible.
const STORY_RECIPES = {
  'f1-intake-foundry': [['specimenVat', 3], ['gurney', 2], ['crateStack', 3]],
  'f2-graft-galleries': [['gurney', 6], ['specimenVat', 2]],
  'f3-catacombs': [['coffinStack', 4], ['skullMound', 3], ['candleAltar', 2]],
  'f4-resonance': [['choirStall', 6], ['fallenBell', 1]],
  'f5-last-descent': [['choirStall', 2], ['fallenBell', 1]],
};

export function setDressingMaterials(materials, sector) {
  const accent = sector === 'ossuary' ? 0x9b7bff : sector === 'choir' ? 0xffa24a : 0xff3b2e;
  const std = (name, color, roughness, metalness, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    m.name = 'SetDressing_' + name;
    return m;
  };
  return {
    metal: materials.metalDark || std('metal', 0x3a3f44, .6, .7),
    dark: materials.black || std('dark', 0x0b0b0c, .9, .1),
    hazard: materials.hazard || std('hazard', 0xc99a2e, .7, .2),
    wood: std('wood', sector === 'choir' ? 0x6a4630 : 0x75603f, .86, 0),
    steel: materials.steel || std('steel', 0x6d757c, .55, .6),
    stone: std('stone', sector === 'ossuary' ? 0x3b3842 : 0x3a3431, .95, 0),
    bone: std('bone', sector === 'ossuary' ? 0x998d78 : 0xb7a98c, .88, 0),
    cloth: std('cloth', sector === 'choir' ? 0x5a2a24 : 0x9a9180, .92, 0, { side: THREE.DoubleSide }),
    flesh: std('flesh', 0x6a2a26, .5, 0, { emissive: 0x1a0404 }),
    skin: std('skin', 0x8d8378, .66, 0),
    gore: std('gore', 0x3d0608, .28, .1),
    brass: std('brass', 0x9c7644, .45, .55),
    wax: std('wax', 0xd8cdb0, .7, 0, { emissive: 0x2a1a08 }),
    flame: std('flame', 0xffc070, .5, 0, { emissive: 0xff9a3a, emissiveIntensity: 2.4 }),
    fluid: std('fluid', accent, .2, 0, { emissive: accent, emissiveIntensity: .9, transparent: true, opacity: .55, depthWrite: false }),
    glass: std('glass', 0x9fb8b4, .08, .1, { transparent: true, opacity: .16, depthWrite: false }),
  };
}

export function buildSetDressingProp(kind, mats, seed = 1) {
  const factory = FACTORIES[kind];
  if (!factory) return null;
  const rng = lifeRng(seed);
  const layers = Object.fromEntries(Object.keys(mats).map(key => [key, []]));
  factory(layers, rng);
  const group = new THREE.Group();
  group.name = 'SetDressing_' + kind;
  group.userData.setDressing = kind;
  if (kind === 'skullMound') group.userData.decorRevision = 'ossuary-rubble-remains-v2';
  group.userData.parts = SETDRESSING_SPECS[kind]?.parts || [];
  for (const [key, parts] of Object.entries(layers)) {
    if (!parts.length) continue;
    const mesh = new THREE.Mesh(merge(parts), mats[key]);
    mesh.name = `SetDressing_${kind}_${key}`;
    const light = key === 'flame' || key === 'fluid' || key === 'glass';
    mesh.castShadow = !light && key !== 'gore';
    mesh.receiveShadow = !light;
    group.add(mesh);
  }
  return group;
}

export function buildSetDressing(root, materials, course = {}) {
  const group = new THREE.Group();
  group.name = 'SetDressing';
  const sector = String(course.sectorId || course.id || 'bloodworks').toLowerCase();
  const recipe = course.dungeon
    ? STORY_RECIPES[course.id] || []
    : SECTOR_RECIPES[sector] || SECTOR_RECIPES.bloodworks;
  const mats = setDressingMaterials(materials, sector);
  const field = buildLifeField(course);
  const rng = lifeRng(seedFor('setdressing:' + sector));
  const placed = [];
  const spawn = course.playerSpawn ? { x: course.playerSpawn.x * 4, z: course.playerSpawn.y * 4 } : null;
  const free = (x, z, r) => placed.every(p => Math.hypot(p.x - x, p.z - z) > p.r + r + .6) && (!spawn || Math.hypot(spawn.x - x, spawn.z - z) > r + 3.5);
  // The live room gates add wall segments after newRun(). At 1.25 m the wall
  // clearance test rejects most candidates and leaves prop families absent.
  // A 1.75 m inset admits the full recipe without relaxing lane clearance.
  const walls = wallSpots(field, rng, { inset: 1.75, spacing: 3.6 });
  for (const [kind, target] of recipe) {
    const spec = SETDRESSING_SPECS[kind];
    let count = 0;
    const candidates = spec.wall ? walls : scatterSpots(field, rng, target * 3, spec.radius, 'ground', { jitter: spec.radius * 2 });
    for (const spot of candidates) {
      if (count >= target) break;
      // Wall props sit slightly closer to the shell than the clearance check
      // so their backs meet the wall instead of floating in the room.
      if (!field.accepts(spot.x, spot.z, spec.radius * .8, 'ground') || !free(spot.x, spot.z, spec.radius)) continue;
      const prop = buildSetDressingProp(kind, mats, seedFor(`${sector}:${kind}:${count}`));
      prop.position.set(spot.x, 0, spot.z);
      prop.rotation.y = spec.wall ? spot.yaw + (rng() - .5) * .25 : rng() * TAU;
      prop.userData.band = spot.band?.role || '';
      group.add(prop);
      placed.push({ x: spot.x, z: spot.z, r: spec.radius });
      count++;
    }
  }
  group.userData.placed = placed.length;
  root.add(group);
  return group;
}
