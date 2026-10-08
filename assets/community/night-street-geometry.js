// Adapted from StarKnightt/night-street. MIT; see NIGHT-STREET-LICENSE.txt.
// Source: .art-source/night-street/333f064778105640588a95d2c2d150780044e7bf

// <stdin>
import * as THREE2 from "../../vendor/three.module.js";

// .art-source/night-street/333f064778105640588a95d2c2d150780044e7bf/emit.ts
import * as THREE from "../../vendor/three.module.js";
function frame(ox, oz, ux, uz) {
  const l = Math.hypot(ux, uz) || 1;
  const x = ux / l, z = uz / l;
  return { ox, oz, ux: x, uz: z, nx: z, nz: -x };
}
var Emit = class {
  pos = [];
  nor = [];
  uv = [];
  idx = [];
  spec = [];
  data = {};
  cur = {};
  constructor(spec = {}) {
    for (const [k, size] of Object.entries(spec)) {
      this.spec.push([k, size]);
      this.data[k] = [];
      this.cur[k] = new Array(size).fill(0);
    }
  }
  /** Set the value every subsequent vertex carries for one attribute. */
  attr(name, ...v) {
    this.cur[name] = v;
    return this;
  }
  get vertexCount() {
    return this.pos.length / 3;
  }
  get triangleCount() {
    return this.idx.length / 3;
  }
  /** One quad, corners counter-clockwise seen from the front. */
  quad(a, b, c, d, uvs) {
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const base = this.vertexCount;
    const corners = [a, b, c, d];
    for (let i = 0; i < 4; i++) {
      const p = corners[i];
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(uvs[i][0], uvs[i][1]);
      for (const [k] of this.spec) this.data[k].push(...this.cur[k]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    for (const [k, size] of this.spec) {
      g.setAttribute(k, new THREE.Float32BufferAttribute(this.data[k], size));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
};
var Face = class {
  e;
  f;
  /* Written out rather than as constructor parameter properties, which is the
   * same two fields and one line longer. The reason is tooling: Node runs the
   * TypeScript in this tree directly, in strip-only mode, and a parameter
   * property is the one piece of TypeScript syntax that has a runtime effect
   * and so cannot be stripped. With it here, *any* tool that reaches this file
   * through an import chain dies at load — which as of the prop pass includes
   * `tools/route.mjs` and `tools/collide.mjs`, because the collider now reads
   * the shared placement table and that reaches the facade layout. Being
   * loadable outside a bundler is worth a line. */
  constructor(e, f) {
    this.e = e;
    this.f = f;
  }
  /** Local (u, y, d) to world. */
  p(u, y, d) {
    const { ox, oz, ux, uz, nx, nz } = this.f;
    return [ox + ux * u + nx * d, y, oz + uz * u + nz * d];
  }
  /** A vertical panel in the facade plane, facing out. */
  panel(u0, u1, y0, y1, d) {
    this.e.quad(
      this.p(u0, y0, d),
      this.p(u0, y1, d),
      this.p(u1, y1, d),
      this.p(u1, y0, d),
      [[u0, y0], [u0, y1], [u1, y1], [u1, y0]]
    );
  }
  /** The same panel facing the other way — a back wall, or the inside of a parapet. */
  panelIn(u0, u1, y0, y1, d) {
    this.e.quad(
      this.p(u0, y0, d),
      this.p(u1, y0, d),
      this.p(u1, y1, d),
      this.p(u0, y1, d),
      [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]
    );
  }
  /**
   * A vertical plane at constant u — a window reveal, a party-wall flank.
   * `sign` is +1 for a face whose normal points along +u.
   */
  jamb(u, d0, d1, y0, y1, sign) {
    const [a, b] = sign > 0 ? [d0, d1] : [d1, d0];
    this.e.quad(
      this.p(u, y0, a),
      this.p(u, y0, b),
      this.p(u, y1, b),
      this.p(u, y1, a),
      [[u + a, y0], [u + b, y0], [u + b, y1], [u + a, y1]]
    );
  }
  /** A horizontal plane — a sill top, a coping, a soffit. `up` false faces down. */
  deck(u0, u1, d0, d1, y, up = true) {
    const [a, b] = up ? [d0, d1] : [d1, d0];
    this.e.quad(
      this.p(u0, y, a),
      this.p(u1, y, a),
      this.p(u1, y, b),
      this.p(u0, y, b),
      [[u0, y + a], [u1, y + a], [u1, y + b], [u0, y + b]]
    );
  }
  /** A closed box in local coordinates. Extents are sorted: a box handed its
   *  corners the wrong way round would be wound inside out, and there are
   *  several hundred of them placed from hashed positions. */
  box(u0, u1, y0, y1, d0, d1) {
    if (u1 < u0) [u0, u1] = [u1, u0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (d1 < d0) [d0, d1] = [d1, d0];
    this.panel(u0, u1, y0, y1, d1);
    this.panelIn(u0, u1, y0, y1, d0);
    this.jamb(u1, d0, d1, y0, y1, 1);
    this.jamb(u0, d0, d1, y0, y1, -1);
    this.deck(u0, u1, d0, d1, y1, true);
    this.deck(u0, u1, d0, d1, y0, false);
  }
  /**
   * A box with one axis free to tilt: the four "vertical" edges stay vertical
   * but the front face is pushed out by `lean` at the top. Used for open
   * sashes and for railings that are not quite plumb.
   */
  quadFree(a, b, c, d, uvs) {
    this.e.quad(
      this.p(a[0], a[1], a[2]),
      this.p(b[0], b[1], b[2]),
      this.p(c[0], c[1], c[2]),
      this.p(d[0], d[1], d[2]),
      uvs
    );
  }
  /**
   * A prism swept along u with an arbitrary cross-section in (y, d).
   *
   * Cheaper than a box per segment for things like a zigzag stair stringer,
   * and it keeps the ends closed so the shadow pass has front faces wherever
   * the sun happens to be.
   */
  bar(u0, u1, section) {
    const n = section.length;
    for (let i = 0; i < n; i++) {
      const [y0, d0] = section[i];
      const [y1, d1] = section[(i + 1) % n];
      this.e.quad(
        this.p(u0, y0, d0),
        this.p(u1, y0, d0),
        this.p(u1, y1, d1),
        this.p(u0, y1, d1),
        [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]
      );
    }
    for (let i = 1; i < n - 1; i++) {
      const a = section[0], b = section[i], c = section[i + 1];
      this.e.quad(
        this.p(u0, a[0], a[1]),
        this.p(u0, b[0], b[1]),
        this.p(u0, c[0], c[1]),
        this.p(u0, c[0], c[1]),
        [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]], [c[0], c[1]]]
      );
      this.e.quad(
        this.p(u1, a[0], a[1]),
        this.p(u1, c[0], c[1]),
        this.p(u1, b[0], b[1]),
        this.p(u1, b[0], b[1]),
        [[a[0], a[1]], [c[0], c[1]], [b[0], b[1]], [b[0], b[1]]]
      );
    }
  }
  /** An n-sided upright cylinder — vent stacks, chimney pots, downpipe shoes. */
  tube(uc, dc, r, y0, y1, sides = 8, cap = true) {
    const pt = (i, y) => {
      const a = i / sides * Math.PI * 2;
      return this.p(uc + Math.cos(a) * r, y, dc + Math.sin(a) * r);
    };
    for (let i = 0; i < sides; i++) {
      this.e.quad(
        pt(i, y0),
        pt(i + 1, y0),
        pt(i + 1, y1),
        pt(i, y1),
        [[i, y0], [i + 1, y0], [i + 1, y1], [i, y1]]
      );
    }
    if (!cap) return;
    for (let i = 1; i < sides - 1; i++) {
      this.e.quad(
        pt(0, y1),
        pt(i, y1),
        pt(i + 1, y1),
        pt(i + 1, y1),
        [[0, 0], [i, 0], [i + 1, 0], [i + 1, 0]]
      );
    }
  }
};

// .art-source/night-street/333f064778105640588a95d2c2d150780044e7bf/facade-adapted.ts
var BLOCK_DEPTH = 12;
var ROLE = {
  WALL: 0,
  // brick / render / stone, per the building's palette
  REVEAL: 1,
  // the inside of a window or door opening — sheltered, dirty
  STONE: 2,
  // cast stone: sills, lintels, copings, cornices, string courses
  PLINTH: 3,
  // the dark base course every street building has
  SHUTTER: 4,
  // ground floor infill, awaiting System 3
  BOARD: 5,
  // plywood over a dead window
  ROOF: 6,
  // felt and chippings, seen only from above
  PLAIN: 7,
  // backs, which nothing ever sees
  FLANK: 8,
  // party walls and exposed flanks
  BACKDROP: 9
  // the town behind the block, seen only through 60 m of haze
};
var h2 = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function prism(f, u0, y0, u1, y1, t, dA, dB) {
  if (u1 < u0) {
    [u0, u1] = [u1, u0];
    [y0, y1] = [y1, y0];
  }
  const q = (a, b, c, d) => f.quadFree(a, b, c, d, [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]], [d[0], d[1]]]);
  q([u0, y0 - t, dB], [u0, y0, dB], [u1, y1, dB], [u1, y1 - t, dB]);
  q([u0, y0 - t, dA], [u1, y1 - t, dA], [u1, y1, dA], [u0, y0, dA]);
  q([u0, y0, dA], [u1, y1, dA], [u1, y1, dB], [u0, y0, dB]);
  q([u0, y0 - t, dA], [u0, y0 - t, dB], [u1, y1 - t, dB], [u1, y1 - t, dA]);
  q([u1, y1 - t, dA], [u1, y1 - t, dB], [u1, y1, dB], [u1, y1, dA]);
  q([u0, y0 - t, dA], [u0, y0, dA], [u0, y0, dB], [u0, y0 - t, dB]);
}
function stay(f, u0, u1, yA, dA, yB, dB, t) {
  if (u1 < u0) [u0, u1] = [u1, u0];
  const ly = yB - yA, ld = dB - dA;
  const l = Math.hypot(ly, ld) || 1;
  const py = -ld / l * t * 0.5, pd = ly / l * t * 0.5;
  f.bar(u0, u1, [
    [yA - py, dA - pd],
    [yB - py, dB - pd],
    [yB + py, dB + pd],
    [yA + py, dA + pd]
  ]);
}
function groundLevels(b) {
  return { plinthTop: b.base + b.plinth, openTop: b.base + b.gh - b.fascia };
}
function groundOpenings(b) {
  const out = [];
  for (let i = 0; i < b.bays; i++) {
    const a = 0.25 + i * b.bayW + b.pier * 0.5;
    const z = 0.25 + (i + 1) * b.bayW - b.pier * 0.5;
    if (z - a > 1.15) out.push({ u0: a, u1: z, rec: 0.15 + h2(b.seed * 100, a) * 0.1 });
  }
  return out;
}
function pierCentres(b) {
  const holes = groundOpenings(b);
  if (holes.length === 0) return [b.L * 0.5];
  const out = [holes[0].u0 * 0.5];
  for (let i = 1; i < holes.length; i++) out.push((holes[i - 1].u1 + holes[i].u0) * 0.5);
  out.push((holes[holes.length - 1].u1 + b.L) * 0.5);
  return out;
}
function onPier(b, u) {
  const piers = pierCentres(b);
  let best = piers[0];
  for (const p of piers) if (Math.abs(p - u) < Math.abs(best - u)) best = p;
  return best;
}
function band(f, y0, y1, d, u0, u1, holes) {
  if (y1 - y0 < 1e-4) return;
  let u = u0;
  for (const [a, b] of holes) {
    if (a > u + 1e-4) f.panel(u, a, y0, y1, d);
    u = Math.max(u, b);
  }
  if (u1 > u + 1e-4) f.panel(u, u1, y0, y1, d);
}
function emitWindow(c, u0, u1, y0, y1, key) {
  const { wf, gf, tf, mf, W, G, T, M, b, d } = c;
  const rev = b.reveal;
  const r1 = h2(key, 1.7), r2 = h2(key, 5.3), r3 = h2(key, 9.1), r4 = h2(key, 13.9);
  W.attr("aRole", ROLE.REVEAL);
  wf.jamb(u0, d - rev, d, y0, y1, 1);
  wf.jamb(u1, d - rev, d, y0, y1, -1);
  wf.deck(u0, u1, d - rev, d, y1, false);
  wf.deck(u0, u1, d - rev, d, y0, true);
  W.attr("aRole", ROLE.STONE);
  wf.box(u0 - 0.095, u1 + 0.095, y0 - 0.15, y0, d - rev, d + 0.105 + r1 * 0.03);
  wf.box(u0 - 0.075, u1 + 0.075, y0 - 0.185, y0 - 0.15, d + 0.035, d + 0.085);
  wf.box(u0 - 0.115, u1 + 0.115, y1, y1 + 0.165 + r2 * 0.07, d - 0.02, d + 0.048);
  const boarded = r3 > 0.955;
  if (boarded) {
    W.attr("aRole", ROLE.BOARD);
    wf.panel(u0, u1, y0, y1, d - rev + 0.05);
    return;
  }
  const dg = d - rev + 0.055;
  const dl = dg - 0.045;
  const fw = 0.052;
  T.attr("aTrim", b.seed, 0);
  tf.box(u0, u1, y0, y0 + fw, dl, dg);
  tf.box(u0, u1, y1 - fw, y1, dl, dg);
  tf.box(u0, u0 + fw, y0, y1, dl, dg);
  tf.box(u1 - fw, u1, y0, y1, dl, dg);
  const trans = y0 + (y1 - y0) * (0.52 + r1 * 0.08);
  tf.box(u0, u1, trans - 0.028, trans + 0.028, dl, dg);
  const panes = r2 < 0.42 ? 2 : 1;
  if (panes === 2) {
    const uc = (u0 + u1) * 0.5;
    tf.box(uc - 0.024, uc + 0.024, y0, y1, dl, dg);
  }
  G.attr("aPane", b.seed * 977 + key, panes, r4, r3);
  gf.panel(u0, u1, y0, y1, dl);
  if (r4 > 0.86) {
    M.attr("aMetal", b.seed * 31 + key, 1);
    const uc = (u0 + u1) * 0.5, hw = Math.min(0.36, (u1 - u0) * 0.46);
    mf.box(uc - hw, uc + hw, y0 + 0.02, y0 + 0.44, d - rev - 0.02, d + 0.16);
    mf.box(uc - hw + 0.06, uc - hw + 0.11, y0 - 0.16, y0 + 0.03, d + 0.02, d + 0.07);
    mf.box(uc + hw - 0.11, uc + hw - 0.06, y0 - 0.16, y0 + 0.03, d + 0.02, d + 0.07);
    return;
  }
  if (r1 > 0.89) {
    const swing = 0.3 + r2 * 0.34;
    const wsp = Math.min(0.9, u1 - u0 - 0.1);
    const hinge = r3 < 0.5 ? u0 + fw : u1 - fw;
    const dir = r3 < 0.5 ? 1 : -1;
    const ue = hinge + dir * wsp * Math.cos(swing);
    const de = dg + wsp * Math.sin(swing);
    const yA = y0 + fw, yB = trans - 0.03;
    G.attr("aPane", b.seed * 977 + key + 7, 1, 0.2, 0.1);
    gf.quadFree(
      [hinge, yA, dg],
      [hinge, yB, dg],
      [ue, yB, de],
      [ue, yA, de],
      [[0, 0], [0, 1], [1, 1], [1, 0]]
    );
    gf.quadFree(
      [hinge, yA, dg],
      [ue, yA, de],
      [ue, yB, de],
      [hinge, yB, dg],
      [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
  }
}
function emitEscape(c, bay) {
  const { mf, M, b, d } = c;
  const uc = 0.25 + (bay + 0.5) * b.bayW;
  const half = Math.min(2.35, b.bayW * 0.95);
  const uA = Math.max(0.35, uc - half), uB = Math.min(b.L - 0.35, uc + half);
  const dOut = d + 1.4;
  const originY = b.base + b.gh;
  M.attr("aMetal", b.seed * 17 + bay, 2);
  const railU = (u0, u1, y, dd) => {
    mf.box(u0, u1, y + 1, y + 1.06, dd - 0.028, dd + 0.028);
    mf.box(u0, u1, y + 0.5, y + 0.545, dd - 0.022, dd + 0.022);
    for (let u = u0 + 0.15; u < u1 - 0.06; u += 0.285) {
      mf.box(u, u + 0.026, y + 0.02, y + 1.02, dd - 0.016, dd + 0.016);
    }
    mf.box(u0, u0 + 0.042, y, y + 1.06, dd - 0.026, dd + 0.026);
    mf.box(u1 - 0.042, u1, y, y + 1.06, dd - 0.026, dd + 0.026);
  };
  const railD = (u, dA, dB, y) => {
    mf.box(u - 0.028, u + 0.028, y + 1, y + 1.06, dA, dB);
    mf.box(u - 0.022, u + 0.022, y + 0.5, y + 0.545, dA, dB);
    for (let t = dA + 0.14; t < dB - 0.06; t += 0.285) {
      mf.box(u - 0.016, u + 0.016, y + 0.02, y + 1.02, t, t + 0.026);
    }
  };
  const brace = (u0, u1, yA, dA, yB, dB, t) => {
    const ly = yB - yA, ld = dB - dA;
    const l = Math.hypot(ly, ld) || 1;
    const py = -ld / l * t * 0.5, pd = ly / l * t * 0.5;
    mf.bar(u0, u1, [
      [yA - py, dA - pd],
      [yB - py, dB - pd],
      [yB + py, dB + pd],
      [yA + py, dA + pd]
    ]);
  };
  for (let f = 0; f < b.nUp; f++) {
    const y = originY + f * b.fh + 0.1;
    mf.box(uA, uB, y - 0.09, y - 0.02, d + 0.02, d + 0.08);
    mf.box(uA, uB, y - 0.09, y - 0.02, dOut - 0.07, dOut - 0.01);
    for (let t = d + 0.09; t < dOut - 0.07; t += 0.108) {
      mf.box(uA, uB, y - 0.022, y + 6e-3, t, t + 0.055);
    }
    for (const u of [uA + 0.35, uB - 0.35]) {
      mf.box(u - 0.028, u + 0.028, y - 0.95, y - 0.06, d + 5e-3, d + 0.06);
      mf.box(u - 0.026, u + 0.026, y - 0.1, y - 0.03, d + 0.02, dOut - 0.05);
      brace(u - 0.024, u + 0.024, y - 0.88, d + 0.05, y - 0.11, dOut - 0.14, 0.05);
    }
    railU(uA, uB, y, dOut - 0.03);
    railD(uA, d + 0.08, dOut - 0.03, y);
    railD(uB, d + 0.08, dOut - 0.03, y);
    if (f === 0) continue;
    const down = f % 2 === 1;
    const rise = 0.235, going = 0.255;
    const n = Math.max(6, Math.round(b.fh / rise));
    const yTopF = y, yBot = y - b.fh;
    const uStart = down ? uA + 0.3 : uB - 0.3;
    const dir = down ? 1 : -1;
    const dS = d + 0.3, dE = d + 1;
    for (let i = 0; i < n; i++) {
      const uu = uStart + dir * (i + 0.5) * going;
      const yy = yTopF - (i + 1) * (b.fh / n);
      mf.box(
        Math.min(uu, uu + dir * going * 0.86),
        Math.max(uu, uu + dir * going * 0.86),
        yy,
        yy + 0.032,
        dS,
        dE
      );
    }
    const uEnd = uStart + dir * n * going;
    for (const dd of [dS - 0.05, dE + 0.02]) {
      prism(mf, uStart, yTopF + 0.02, uEnd, yBot + 0.02, 0.2, dd, dd + 0.035);
      prism(mf, uStart, yTopF + 1.02, uEnd, yBot + 1.02, 0.05, dd - 0.01, dd + 0.045);
      for (let i = 1; i < n; i += 3) {
        const uu = uStart + dir * i * going;
        const yy = yTopF - i * (b.fh / n);
        mf.box(
          Math.min(uu, uu + 0.026),
          Math.max(uu, uu + 0.026),
          yy,
          yy + 1.02,
          dd,
          dd + 0.03
        );
      }
    }
  }
  const yL = originY + 0.1;
  const uL = uA + 0.55;
  for (const uu of [uL, uL + 0.44]) {
    mf.box(uu, uu + 0.038, b.base + 2.55, yL, d + 0.66, d + 0.7);
  }
  for (let y = b.base + 2.75; y < yL - 0.2; y += 0.31) {
    mf.box(uL, uL + 0.48, y, y + 0.024, d + 0.655, d + 0.71);
  }
}
function emitFurniture(c) {
  const { wf, mf, W, M, b, d } = c;
  const originY = b.base + b.gh;
  const yTop = b.base + b.H;
  const roofY = yTop - 0.42;
  const s = b.seed;
  M.attr("aMetal", s * 7, 3);
  const runs = [];
  if (b.pipes === 1 || b.pipes === 3) runs.push(0.24);
  if (b.pipes === 2 || b.pipes === 3) runs.push(b.L - 0.24);
  const off = 0.038;
  for (const u of runs) {
    mf.box(u - 0.048, u + 0.048, b.base + 0.3, yTop + b.par - 0.3, d + off, d + off + 0.096);
    mf.box(u - 0.062, u + 0.062, b.base + 0.06, b.base + 0.34, d + off, d + off + 0.115);
    mf.box(u - 0.105, u + 0.105, yTop - 0.42, yTop - 0.06, d + off, d + off + 0.145);
    for (let y = b.base + 1.1; y < yTop - 0.5; y += 1.55) {
      mf.box(u - 0.026, u + 0.026, y + 0.01, y + 0.055, d, d + off);
      mf.box(u - 0.086, u + 0.086, y, y + 0.062, d + off - 4e-3, d + off + 0.112);
    }
    mf.box(u - 0.05, u + 0.05, yTop + b.par - 0.34, yTop + b.par - 0.26, d, d + 0.2);
  }
  if (b.pal === 0) {
    M.attr("aMetal", s * 3, 4);
    for (let f = 0; f <= b.nUp; f++) {
      const y = b.base + b.gh + f * b.fh - 0.3;
      if (y > yTop - 0.2) break;
      for (let i = 0; i < b.bays; i++) {
        if (h2(s * 100 + f, i) < 0.45) continue;
        const u = 0.25 + (i + 0.5) * b.bayW;
        mf.box(u - 0.075, u + 0.075, y - 0.075, y + 0.075, d, d + 0.032);
      }
    }
  }
  for (let f = 0; f < b.nUp; f++) {
    for (let i = 0; i < b.bays - 1; i++) {
      if (h2(s * 40 + f * 3.1, i * 7.7) < 0.83) continue;
      const u = 0.25 + (i + 1) * b.bayW;
      const y = originY + f * b.fh + 1.15;
      M.attr("aMetal", h2(i, f) * 100, 1);
      mf.box(u - 0.34, u + 0.34, y, y + 0.52, d + 0.03, d + 0.36);
      for (const s2 of [-1, 1]) {
        const uu = u + s2 * 0.29;
        mf.box(uu - 0.028, uu + 0.028, y - 0.26, y + 0.02, d, d + 0.055);
        mf.box(uu - 0.026, uu + 0.026, y - 0.05, y + 0.01, d, d + 0.34);
        mf.box(uu - 0.022, uu + 0.022, y - 0.24, y - 0.16, d + 0.02, d + 0.2);
      }
      for (let k = 0; k < 5; k++) {
        const yy = y + 0.09 + k * 0.075;
        mf.box(u - 0.3, u + 0.3, yy, yy + 0.028, d + 0.36, d + 0.385);
      }
    }
  }
  if (h2(s, 3.3) > 0.45) {
    M.attr("aMetal", s * 13, 5);
    const u = onPier(b, 0.6 + h2(s, 8.1) * Math.max(0.5, b.L - 1.6)) - 0.21;
    mf.box(u, u + 0.42, b.base + 0.85, b.base + 1.42, d, d + 0.17);
    mf.box(u + 0.03, u + 0.39, b.base + 0.88, b.base + 1.39, d + 0.17, d + 0.195);
    mf.box(u + 0.3, u + 0.345, b.base + 1.08, b.base + 1.16, d + 0.195, d + 0.225);
  }
  if (h2(s, 4.9) > 0.62) {
    M.attr("aMetal", s * 19, 3);
    const u = onPier(b, 0.6 + h2(s, 2.2) * Math.max(0.5, b.L - 1.6));
    mf.box(u - 0.055, u + 0.055, b.base + 0.1, b.base + 1.05, d, d + 0.11);
    mf.box(u - 0.09, u + 0.09, b.base + 1.05, b.base + 1.18, d, d + 0.14);
  }
  if (h2(s, 6.6) > 0.5) {
    M.attr("aMetal", s * 23, 3);
    const y = originY + 0.3 + h2(s, 1.1) * 0.85;
    const cOff = 0.045;
    const uA = 0.45 + h2(s, 4.4) * 0.8;
    const uB = b.L - 0.45 - h2(s, 8.8) * 1.4;
    mf.box(uA, uB, y, y + 0.052, d + cOff, d + cOff + 0.052);
    for (let u2 = uA + 0.2; u2 < uB - 0.1; u2 += 1.4) {
      mf.box(u2, u2 + 0.05, y - 0.012, y + 0.064, d, d + cOff + 8e-3);
    }
    mf.box(uA - 0.1, uA + 0.02, y - 0.075, y + 0.13, d, d + 0.1);
    const u = onPier(b, uA + 0.35 + h2(s, 5.5) * Math.max(0.4, uB - uA - 0.9)) - 0.025;
    mf.box(u, u + 0.05, b.base + 0.4, y, d + cOff, d + cOff + 0.052);
    for (let yy = b.base + 0.7; yy < y - 0.2; yy += 1.4) {
      mf.box(u - 0.024, u + 0.074, yy, yy + 0.05, d, d + cOff + 8e-3);
    }
  }
  const kit = h2(s, 21.7);
  const dBack = d - BLOCK_DEPTH;
  if (kit > 0.3) {
    const u = 0.8 + h2(s, 31.1) * Math.max(0.6, b.L - 2.2);
    const w = 0.62 + h2(s, 12.3) * 0.55;
    const hgt = b.par + 1.95 + h2(s, 44.4) * 2.3;
    const dd = d - 0.35 - h2(s, 3.7) * 0.9;
    W.attr("aRole", ROLE.WALL);
    wf.box(u, u + w, roofY, roofY + hgt, dd - 0.62, dd);
    W.attr("aRole", ROLE.STONE);
    wf.box(u - 0.05, u + w + 0.05, roofY + hgt, roofY + hgt + 0.11, dd - 0.67, dd + 0.05);
    M.attr("aMetal", s * 29, 6);
    const pots = 1 + Math.floor(h2(s, 9.9) * 3);
    for (let i = 0; i < pots; i++) {
      mf.tube(
        u + w * ((i + 0.5) / pots),
        dd - 0.31,
        0.105,
        roofY + hgt + 0.11,
        roofY + hgt + 0.44 + h2(s, i) * 0.2,
        8
      );
    }
  }
  if (kit > 0.55 || h2(s, 77.1) > 0.45) {
    M.attr("aMetal", s * 37, 7);
    const u = 0.7 + h2(s, 51.3) * Math.max(0.5, b.L - 2.4);
    const dd = d - 0.45 - h2(s, 61.9) * 0.8;
    mf.box(u, u + 1.35, roofY + b.par + 0.2, roofY + b.par + 1.1, dd - 1, dd);
    for (const uu of [u + 0.08, u + 1.19]) {
      mf.box(uu, uu + 0.08, roofY, roofY + b.par + 0.24, dd - 0.14, dd - 0.06);
      mf.box(uu, uu + 0.08, roofY, roofY + b.par + 0.24, dd - 0.94, dd - 0.86);
    }
  }
  if (h2(s, 88.3) > 0.62) {
    M.attr("aMetal", s * 41, 8);
    const u = 1.4 + h2(s, 5.2) * Math.max(0.4, b.L - 3.2);
    const dd = d - 1.15 - h2(s, 7.4) * 0.7;
    const r = 0.86, legs = b.par + 1.5;
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.78;
      mf.box(
        u + Math.cos(a) * r * 0.72 - 0.05,
        u + Math.cos(a) * r * 0.72 + 0.05,
        roofY,
        roofY + legs,
        dd + Math.sin(a) * r * 0.72 - 0.05,
        dd + Math.sin(a) * r * 0.72 + 0.05
      );
    }
    mf.tube(u, dd, r, roofY + legs, roofY + legs + 2, 12);
  }
  if (h2(s, 93.7) > 0.55) {
    W.attr("aRole", ROLE.PLAIN);
    const u = 0.9 + h2(s, 15.5) * Math.max(0.5, b.L - 3);
    const dd = d - 0.9 - h2(s, 17.5) * 1.1;
    wf.box(u, u + 1.9, roofY, roofY + b.par + 1.95, dd - 1.7, dd);
    W.attr("aRole", ROLE.STONE);
    wf.deck(u - 0.06, u + 1.96, dd - 1.76, dd + 0.06, roofY + b.par + 1.95, true);
  }
  M.attr("aMetal", s * 53, 6);
  const stacks = 1 + Math.floor(h2(s, 2.9) * 3);
  for (let i = 0; i < stacks; i++) {
    const u = 0.5 + h2(s * 3, i * 4.1) * Math.max(0.4, b.L - 1.2);
    const dd = d - 0.3 - h2(s * 5, i * 2.3) * 1.1;
    mf.tube(
      u,
      dd,
      0.055 + h2(s, i) * 0.05,
      roofY,
      roofY + b.par + 0.45 + h2(s, i * 9) * 1,
      6
    );
  }
  if (h2(s, 66.6) > 0.45) {
    M.attr("aMetal", s * 59, 4);
    const u = 0.6 + h2(s, 71.1) * Math.max(0.4, b.L - 1.4);
    const dd = d - 0.32 - h2(s, 73.3) * 0.7;
    const top = roofY + b.par + 1.5 + h2(s, 79.9) * 1.6;
    mf.box(u - 0.018, u + 0.018, roofY, top, dd - 0.018, dd + 0.018);
    for (let i = 0; i < 4; i++) {
      const y = top - 0.22 - i * 0.24;
      const w = 0.28 + i * 0.09;
      mf.box(u - w, u + w, y, y + 0.016, dd - 8e-3, dd + 8e-3);
    }
  }
  if (h2(s, 45.1) > 0.74) {
    M.attr("aMetal", s * 61, 9);
    const u = 0.5 + h2(s, 47.3) * Math.max(0.4, b.L - 1.2);
    const y = yTop + b.par * 0.55;
    mf.box(u - 0.03, u + 0.03, y, y + 0.34, d + 0.02, d + 0.3);
    const r = 0.27, cy = y + 0.34, cd = d + 0.3;
    const rim = (a, k) => [u + Math.cos(a) * r * k, cy + Math.sin(a) * r * 0.82 * k, cd + Math.sin(a) * r * 0.42 * k];
    const cn = [u, cy, cd - 0.05];
    for (let i = 0; i < 10; i++) {
      const a0 = i / 10 * Math.PI * 2, a1 = (i + 1) / 10 * Math.PI * 2;
      mf.quadFree(cn, rim(a1, 1), rim(a0, 1), rim(a0, 1), [[0, 0], [1, 0], [1, 1], [1, 1]]);
      mf.quadFree(
        rim(a0, 1),
        rim(a0, 0.9),
        rim(a1, 0.9),
        rim(a1, 1),
        [[i, 0], [i, 1], [i + 1, 1], [i + 1, 0]]
      );
      mf.quadFree(
        rim(a1, 1),
        rim(a1, 0.9),
        rim(a0, 0.9),
        rim(a0, 1),
        [[i, 0], [i, 1], [i + 1, 1], [i + 1, 0]]
      );
    }
    mf.box(u - 0.018, u + 0.018, cy - 0.2, cy - 0.02, cd + 0.02, cd + 0.3);
    mf.box(u - 0.042, u + 0.042, cy - 0.24, cy - 0.14, cd + 0.24, cd + 0.34);
  }
  void dBack;
}
function emitStreetFixtures(c) {
  const { wf, mf, W, M, b, d } = c;
  const s = b.seed;
  const originY = b.base + b.gh;
  const yTop = b.base + b.H;
  const { plinthTop, openTop } = groundLevels(b);
  const holes = groundOpenings(b);
  const piers = [];
  if (holes.length === 0) {
    piers.push({ u: b.L * 0.5, half: Math.min(0.5, b.L * 0.45) });
  } else {
    piers.push({ u: holes[0].u0 * 0.5, half: holes[0].u0 * 0.5 });
    for (let i = 1; i < holes.length; i++) {
      piers.push({
        u: (holes[i - 1].u1 + holes[i].u0) * 0.5,
        half: (holes[i].u0 - holes[i - 1].u1) * 0.5
      });
    }
    const e = holes[holes.length - 1];
    piers.push({ u: (e.u1 + b.L) * 0.5, half: (b.L - e.u1) * 0.5 });
  }
  const pierFor = (w, k) => {
    const fit = piers.filter((p) => p.half >= w * 0.5 + 0.04);
    if (fit.length === 0) return -1;
    return fit[Math.floor(h2(s * 83 + k * 3.7, 11.9) * fit.length) % fit.length].u;
  };
  const service = [];
  for (let i = 1; i < b.bays; i++) service.push(0.25 + i * b.bayW);
  const svc = (k) => service[Math.floor(h2(s * 29 + k * 5.1, 2.7) * service.length) % service.length];
  const LANE = { elec: -0.115, cond: 0.105, cable: 0.165 };
  const escU = b.escape >= 0 ? 0.25 + (b.escape + 0.5) * b.bayW : -99;
  const escHalf = Math.min(2.35, b.bayW * 0.95) + 0.35;
  const clearOfEscape = (u) => Math.abs(u - escU) > escHalf;
  const fasciaY0 = openTop + 0.01;
  const fasciaY1 = Math.min(originY - 0.14, openTop + 0.62);
  const lift = b.nUp === 0 ? 0.22 : 0;
  const riser = (u, hw, thk, yA, yB, off) => {
    const oF = 0.135;
    mf.box(u - hw, u + hw, fasciaY1 + 0.06, yA, d + off, d + off + thk);
    mf.box(u - hw, u + hw, fasciaY1 + 0.02, fasciaY1 + 0.08, d + off, d + oF + thk);
    mf.box(u - hw, u + hw, fasciaY0 - 0.08, fasciaY1 + 0.04, d + oF, d + oF + thk);
    mf.box(u - hw, u + hw, fasciaY0 - 0.08, fasciaY0 - 0.02, d + off, d + oF + thk);
    mf.box(u - hw, u + hw, yB, fasciaY0 - 0.04, d + off, d + off + thk);
  };
  const acAt = [];
  for (let i = 1; i < b.bays; i++) {
    const u = 0.25 + i * b.bayW;
    if (!clearOfEscape(u)) continue;
    for (let f = 0; f < Math.min(2, b.nUp); f++) {
      if (h2(s * 40 + f * 3.1, (i - 1) * 7.7) >= 0.83) continue;
      acAt.push({ u, f, r: h2(s * 71 + i * 2.3, f * 5.9) });
    }
  }
  acAt.sort((a, z) => a.r - z.r);
  for (const sp of acAt.slice(0, 2 + (h2(s, 26.5) > 0.45 ? 1 : 0))) {
    const r1 = h2(sp.u * 13.7, sp.f * 5.1 + 1.3);
    const r2 = h2(sp.u * 7.9, sp.f * 11.3 + 2.9);
    const r3 = h2(sp.u * 3.1, sp.f * 17.7 + 4.7);
    const hw = Math.min(0.35 + r1 * 0.125, (b.bayW - b.winW) * 0.5 - 0.15);
    const hgt = 0.5 + r2 * 0.15;
    const dep = 0.25 + r3 * 0.08;
    const fb = originY + sp.f * b.fh;
    const y = fb + 0.58 + r1 * 0.62;
    const off = 0.052 + r2 * 0.014;
    M.attr("aMetal", s * 67 + sp.u, 1);
    mf.box(sp.u - hw, sp.u + hw, y, y + hgt, d + off, d + off + dep);
    for (let k = 0; k < 3; k++) {
      const yy = y + hgt * (0.24 + k * 0.22);
      mf.box(
        sp.u - hw + 0.055,
        sp.u + hw - 0.055,
        yy,
        yy + 0.028,
        d + off + dep,
        d + off + dep + 0.02
      );
    }
    M.attr("aMetal", s * 67 + sp.u, 5);
    for (const sg of [-1, 1]) {
      const uu = sp.u + sg * (hw - 0.08);
      mf.box(uu - 0.024, uu + 0.024, y - 0.055, y + hgt * 0.4, d, d + off);
      mf.box(uu - 0.022, uu + 0.022, y - 0.035, y + 0.012, d, d + off + dep * 0.8);
      stay(mf, uu - 0.019, uu + 0.019, y - 0.3, d + 0.012, y - 0.02, d + off + dep * 0.66, 0.042);
    }
    const up = sp.u + (r3 < 0.5 ? -1 : 1) * (hw - 0.16);
    const yIn = y - 0.42 - r2 * 0.27;
    M.attr("aMetal", s * 67 + sp.u, 3);
    for (const k of [-1, 1]) {
      const uu = up + k * 0.043;
      stay(
        mf,
        uu - 0.031,
        uu + 0.031,
        yIn + 0.02,
        d + 0.059 + r1 * 4e-3,
        y + 0.05,
        d + 0.07 + r2 * 6e-3,
        0.062
      );
    }
    M.attr("aMetal", s * 67 + sp.u, 4);
    mf.box(up - 0.088, up + 0.088, (yIn + y) * 0.5, (yIn + y) * 0.5 + 0.035, d, d + 0.1);
    mf.box(up - 0.1, up + 0.1, yIn - 0.06, yIn + 0.03, d, d + 0.034);
    W.attr("aRole", ROLE.STONE);
    wf.box(up - 0.13, up + 0.13, yIn - 0.1, yIn + 0.07, d, d + 0.012);
    if (r2 > 0.4) {
      M.attr("aMetal", s * 67 + sp.u, 1);
      mf.box(
        sp.u - hw - 0.022,
        sp.u + hw + 0.022,
        y - 0.06,
        y - 0.018,
        d + off,
        d + off + dep + 0.035
      );
      M.attr("aMetal", s * 67 + sp.u, 6);
      const uc = sp.u + LANE.cond;
      mf.box(uc - 0.014, sp.u + hw, y - 0.048, y - 0.02, d + off, d + off + 0.03);
      if (r3 > 0.5) {
        riser(uc, 0.014, 0.028, y - 0.05, b.base + 0.42 + r1 * 0.5, 0.03);
      } else {
        mf.box(uc - 0.014, uc + 0.014, fasciaY1 + 0.09, y - 0.05, d + 0.03, d + 0.058);
      }
      for (let yy = fasciaY1 + 0.35; yy < y - 0.25; yy += 1.15) {
        mf.box(uc - 0.026, uc + 0.026, yy, yy + 0.034, d, d + 0.036);
      }
    }
  }
  if (b.nUp >= 1) {
    const cOff = 0.042;
    const uA = service[0];
    const uB = service.length > 1 ? service[service.length - 1] : Math.min(b.L - 0.5, uA + 1.8 + h2(s, 41.9) * 1.4);
    const runY = originY + 0.16 + h2(s, 33.1) * 0.26;
    M.attr("aMetal", s * 87, 3);
    mf.box(uA, uB, runY, runY + 0.048, d + cOff, d + cOff + 0.048);
    for (let u = uA + 0.35; u < uB - 0.15; u += 1.4) {
      mf.box(u, u + 0.046, runY - 0.012, runY + 0.06, d, d + cOff + 8e-3);
    }
    M.attr("aMetal", s * 87, 5);
    mf.box(uA - 0.15, uA + 0.06, runY - 0.075, runY + 0.135, d, d + 0.088);
    mf.box(uB - 0.055, uB + 0.085, runY - 0.075, runY + 0.135, d, d + 0.088);
    M.attr("aMetal", s * 87, 3);
    const uD = uA + LANE.elec;
    riser(uD, 0.024, 0.048, runY - 0.06, b.base + 1.52, cOff);
    for (let yy = b.base + 0.45; yy < fasciaY0 - 0.3; yy += 1.25) {
      mf.box(uD - 0.045, uD + 0.045, yy, yy + 0.046, d, d + cOff + 8e-3);
    }
    M.attr("aMetal", s * 87, 5);
    mf.box(uA - 0.13, uA + 0.13, b.base + 1.1, b.base + 1.52, d, d + 0.135);
    mf.box(uA - 0.1, uA + 0.1, b.base + 1.14, b.base + 1.48, d + 0.135, d + 0.158);
    if (b.nUp >= 2) {
      const y3 = originY + b.fh + 0.15 + h2(s, 37.3) * 0.28;
      const u3 = service.length > 1 ? service[1 % service.length] : uA;
      const uE = Math.max(uA + 0.9, Math.min(b.L - 0.55, u3 + 1.6 + h2(s, 43.7) * 1.9));
      M.attr("aMetal", s * 87, 3);
      mf.box(uD - 0.024, uD + 0.024, runY + 0.1, y3, d + cOff, d + cOff + 0.048);
      for (let yy = runY + 0.55; yy < y3 - 0.3; yy += 1.4) {
        mf.box(uD - 0.045, uD + 0.045, yy, yy + 0.046, d, d + cOff + 8e-3);
      }
      mf.box(Math.min(uD, uE), Math.max(uD, uE), y3, y3 + 0.048, d + cOff, d + cOff + 0.048);
      for (let u = Math.min(uD, uE) + 0.5; u < Math.max(uD, uE) - 0.15; u += 1.4) {
        mf.box(u, u + 0.046, y3 - 0.012, y3 + 0.06, d, d + cOff + 8e-3);
      }
      M.attr("aMetal", s * 87, 5);
      mf.box(uD - 0.075, uD + 0.075, y3 - 0.055, y3 + 0.135, d, d + 0.082);
      mf.box(uE - 0.075, uE + 0.075, y3 + 0.048, y3 + 0.235, d, d + 0.098);
      mf.box(uE - 0.055, uE + 0.02, y3 + 0.09, y3 + 0.13, d + 0.098, d + 0.125);
    }
    if (uB - uA > 1.6) {
      M.attr("aMetal", s * 87, 3);
      const sag = 0.11 + h2(s, 47.1) * 0.13;
      const yc = runY - 0.06;
      const seg = [
        [uA, yc],
        [uA + (uB - uA) * 0.34, yc - sag * 0.86],
        [uA + (uB - uA) * 0.66, yc - sag],
        [uB, yc - sag * 0.28]
      ];
      for (let i = 0; i < 3; i++) {
        prism(
          mf,
          seg[i][0],
          seg[i][1],
          seg[i + 1][0],
          seg[i + 1][1],
          0.017,
          d + 0.052,
          d + 0.069
        );
      }
    }
  }
  if (h2(s, 12.7) > 0.4 - lift) {
    const u = svc(3);
    const full = b.nUp >= 1;
    const top = full ? yTop - 0.55 - h2(s, 14.1) * 0.6 : fasciaY0 - 0.38;
    M.attr("aMetal", s * 97, 3);
    if (full) riser(u, 0.058, 0.112, top, b.base + 0.2, 0.032);
    else mf.box(u - 0.058, u + 0.058, b.base + 0.2, top, d + 0.032, d + 0.144);
    let k = 0;
    for (let yy = b.base + 0.62; yy < top - 0.4; yy += 1.83, k++) {
      if (yy > fasciaY0 - 0.2 && yy < fasciaY1 + 0.2) continue;
      mf.box(u - 0.078, u + 0.078, yy, yy + 0.072, d + 0.024, d + 0.152);
      if (k % 2 === 0) mf.box(u - 0.034, u + 0.034, yy + 0.018, yy + 0.054, d, d + 0.03);
    }
    const yBoss = full ? originY + 0.55 + h2(s, 16.5) * 0.5 : top - 0.85;
    mf.box(u - 0.062, u + 0.16, yBoss, yBoss + 0.09, d + 0.03, d + 0.128);
    mf.box(u + 0.13, u + 0.19, yBoss - 0.02, yBoss + 0.11, d + 0.024, d + 0.134);
  }
  if (h2(s, 15.3) > 0.46 - lift) {
    const u = pierFor(0.28, 5);
    if (u > 0) {
      M.attr("aMetal", s * 101, 6);
      mf.box(u - 0.13, u + 0.13, b.base + 0.52, b.base + 1.14, d + 0.025, d + 0.16);
      mf.box(u - 0.105, u + 0.105, b.base + 0.56, b.base + 1.1, d + 0.16, d + 0.182);
      M.attr("aMetal", s * 101, 3);
      mf.box(u - 0.032, u + 0.032, plinthTop - 0.05, b.base + 0.55, d + 0.05, d + 0.114);
      mf.box(u + 0.02, u + 0.084, b.base + 1.12, b.base + 1.46, d + 0.05, d + 0.114);
      mf.box(u + 8e-3, u + 0.096, b.base + 1.4, b.base + 1.48, d, d + 0.1);
    }
  }
  if (h2(s, 18.9) > 0.52 - lift) {
    const u = pierFor(0.36, 9);
    if (u > 0) {
      const y = plinthTop + 0.24;
      M.attr("aMetal", s * 103, 6);
      mf.box(u - 0.155, u + 0.155, y, y + 0.3, d + 0.022, d + 0.135);
      M.attr("aMetal", s * 103, 4);
      for (const sg of [-1, 1]) {
        const uu = u + sg * 0.072;
        stay(mf, uu - 0.036, uu + 0.036, y + 0.2, d + 0.135, y + 0.1, d + 0.245, 0.072);
      }
      mf.box(u - 0.175, u + 0.175, y + 0.3, y + 0.335, d + 0.022, d + 0.155);
    }
  }
  const kitchen = h2(s, 22.3);
  if (kitchen > 0.38 - lift) {
    const u = svc(7) - 0.14;
    M.attr("aMetal", s * 107, 6);
    if (b.nUp >= 1) {
      const yC = Math.min(originY + b.sill + b.winH + 0.35, yTop - 0.75);
      mf.box(u - 0.16, u + 0.16, fasciaY1 + 0.08, yC, d + 0.035, d + 0.29);
      for (let yy = fasciaY1 + 0.7; yy < yC - 0.3; yy += 1.25) {
        mf.box(u - 0.185, u + 0.185, yy, yy + 0.05, d + 0.02, d + 0.31);
        mf.box(u - 0.03, u + 0.03, yy + 0.012, yy + 0.04, d, d + 0.04);
      }
      mf.box(u - 0.2, u + 0.2, yC, yC + 0.2, d + 0.03, d + 0.34);
      mf.box(u - 0.23, u + 0.23, yC + 0.18, yC + 0.245, d + 0.02, d + 0.4);
      mf.box(u - 0.17, u + 0.17, yC - 0.06, yC + 0.02, d + 0.29, d + 0.38);
    }
    const ug = pierFor(0.3, 11);
    if (ug > 0) {
      const yg = openTop - 0.62 - h2(s, 24.7) * 0.5;
      mf.box(ug - 0.145, ug + 0.145, yg, yg + 0.34, d + 0.018, d + 0.048);
      for (let k = 0; k < 4; k++) {
        const yy = yg + 0.045 + k * 0.072;
        mf.box(ug - 0.135, ug + 0.135, yy, yy + 0.026, d + 0.048, d + 0.082);
      }
    }
    const caps = [
      [u + 0.39, originY + 0.3 + h2(s, 26.9) * 0.28],
      [pierFor(0.2, 27), b.base + 2.05 + h2(s, 28.1) * 0.45]
    ];
    for (const [uu, yy] of caps) {
      if (uu < 0 || yy > yTop - 0.5) continue;
      mf.box(uu - 0.075, uu + 0.075, yy, yy + 0.15, d + 0.012, d + 0.042);
      mf.box(uu - 0.058, uu + 0.058, yy + 0.02, yy + 0.13, d + 0.042, d + 0.105);
    }
  }
  {
    const ul = pierFor(0.26, 13);
    if (ul > 0) {
      const y = openTop - 0.35 - h2(s, 31.7) * 0.45;
      M.attr("aMetal", s * 109, 5);
      mf.box(ul - 0.06, ul + 0.06, y, y + 0.13, d, d + 0.028);
      mf.box(ul - 0.028, ul + 0.028, y + 0.035, y + 0.095, d + 0.028, d + 0.095);
      M.attr("aMetal", s * 109, 6);
      mf.box(ul - 0.115, ul + 0.115, y - 0.02, y + 0.145, d + 0.095, d + 0.235);
      mf.box(ul - 0.135, ul + 0.135, y + 0.13, y + 0.175, d + 0.075, d + 0.26);
    }
    if (b.nUp >= 1) {
      const uu = Math.min(b.L - 0.4, service[service.length - 1] + 0.25);
      const y = originY + 0.95 + h2(s, 34.9) * 0.5;
      M.attr("aMetal", s * 109, 3);
      mf.box(uu - 0.022, uu + 0.022, originY + 0.42, y, d + 0.042, d + 0.086);
      M.attr("aMetal", s * 109, 6);
      mf.box(uu - 0.1, uu + 0.1, y, y + 0.15, d + 0.03, d + 0.175);
      mf.box(uu - 0.12, uu + 0.12, y + 0.135, y + 0.175, d + 0.02, d + 0.2);
    }
  }
  if (b.nUp >= 1) {
    const u = svc(17) + LANE.cable;
    const yEnd = originY + 0.62 + h2(s, 39.5) * 0.55;
    M.attr("aMetal", s * 113, 5);
    mf.box(u - 0.045, u + 0.045, b.base + 1.18, b.base + 1.54, d, d + 0.075);
    mf.box(u - 0.06, u + 0.06, yEnd, yEnd + 0.13, d, d + 0.062);
    M.attr("aMetal", s * 113, 3);
    riser(u, 0.017, 0.032, yEnd + 0.02, b.base + 1.5, 0.026);
    for (let yy = b.base + 1.9; yy < yEnd - 0.3; yy += 0.95 + h2(s, yy) * 0.35) {
      if (yy > fasciaY0 - 0.15 && yy < fasciaY1 + 0.15) continue;
      mf.box(u - 0.03, u + 0.03, yy, yy + 0.03, d, d + 0.03);
    }
  }
  const dishes = h2(s, 57.7) > 0.4 ? h2(s, 58.7) > 0.58 ? 2 : 1 : 0;
  for (let k = 0; k < (b.nUp >= 1 ? dishes : 0); k++) {
    const u = svc(19 + k * 8) + (h2(s, 58.1 + k) - 0.5) * 0.12;
    if (k === 1 && Math.abs(u - svc(19)) < 0.5) continue;
    if (clearOfEscape(u)) {
      const y = originY + 1.35 + h2(s, 59.3 + k * 3.1) * 0.9 + k * 0.42;
      M.attr("aMetal", s * 127, 2);
      mf.box(u - 0.05, u + 0.05, y - 0.16, y + 0.16, d, d + 0.035);
      mf.box(u - 0.026, u + 0.026, y - 0.02, y + 0.02, d + 0.035, d + 0.3);
      stay(mf, u - 0.02, u + 0.02, y - 0.14, d + 0.03, y - 0.01, d + 0.24, 0.036);
      M.attr("aMetal", s * 127, 9);
      const r = 0.27;
      const cy = y + 0.06, cd = d + 0.3;
      const rim = (a, k2) => [
        u + Math.cos(a) * r * k2 * 0.92 + Math.sin(a) * r * k2 * 0.16,
        cy + Math.sin(a) * r * 0.86 * k2,
        cd + Math.cos(a) * r * 0.22 * k2
      ];
      const cn = [u + 0.03, cy, cd - 0.075];
      const lip = (a) => {
        const p = rim(a, 1);
        return [p[0] + 0.018, p[1], p[2] + 0.05];
      };
      for (let i = 0; i < 8; i++) {
        const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2;
        mf.quadFree(
          cn,
          rim(a1, 1),
          rim(a0, 1),
          rim(a0, 1),
          [[0, 0], [1, 0], [1, 1], [1, 1]]
        );
        mf.quadFree(
          rim(a0, 1),
          lip(a0),
          lip(a1),
          rim(a1, 1),
          [[i, 0], [i, 1], [i + 1, 1], [i + 1, 0]]
        );
      }
      mf.box(u - 0.016, u + 0.016, cy - 0.19, cy - 0.02, cd + 0.03, cd + 0.26);
      mf.box(u - 0.036, u + 0.036, cy - 0.225, cy - 0.135, cd + 0.21, cd + 0.3);
      M.attr("aMetal", s * 127, 3);
      mf.box(u + 0.02, u + 0.044, y - 0.35, cy - 0.16, d + 0.05, d + 0.074);
      mf.box(u + 0.02, u + 0.16, y - 0.38, y - 0.35, d + 0.05, d + 0.074);
    }
  }
  {
    const uh = pierFor(0.34, 23);
    if (uh > 0 && h2(s, 61.1) > 0.35 - lift) {
      M.attr("aMetal", s * 131, 0);
      const y = plinthTop + 0.18;
      for (const sg of [-1, 1]) {
        mf.box(uh + sg * 0.14 - 0.018, uh + sg * 0.14 + 0.018, y, y + 0.36, d + 0.02, d + 0.056);
      }
      mf.box(uh - 0.158, uh + 0.158, y + 0.34, y + 0.376, d + 0.02, d + 0.056);
      mf.box(uh - 0.055, uh + 0.055, y - 0.03, y + 0.05, d, d + 0.03);
    }
    const ub = pierFor(0.22, 29);
    if (ub > 0 && h2(s, 63.3) > 0.42 - lift) {
      M.attr("aMetal", s * 131, 2);
      const y = openTop - 0.9 - h2(s, 65.5) * 0.6;
      mf.box(ub - 0.05, ub + 0.05, y, y + 0.2, d, d + 0.03);
      mf.box(ub - 0.022, ub + 0.022, y + 0.14, y + 0.18, d + 0.03, d + 0.3);
      stay(mf, ub - 0.018, ub + 0.018, y + 0.02, d + 0.025, y + 0.145, d + 0.255, 0.032);
    }
    if (b.nUp >= 1 && h2(s, 67.7) > 0.4) {
      M.attr("aMetal", s * 131, 3);
      const u = svc(31) + 0.19;
      const y = originY + 0.5 + h2(s, 69.9) * 1.3;
      mf.box(u - 0.028, u + 0.028, y, y + 0.22, d + 0.03, d + 0.086);
      mf.box(u - 0.038, u + 0.038, y + 0.2, y + 0.245, d + 0.024, d + 0.094);
    }
    const uc2 = pierFor(0.2, 37);
    if (uc2 > 0 && h2(s, 71.3) > 0.5 - lift) {
      M.attr("aMetal", s * 131, 3);
      const y = plinthTop + 0.06;
      stay(mf, uc2 - 0.034, uc2 + 0.034, y, d + 0.062, y + 0.42, d + 0.071, 0.068);
      M.attr("aMetal", s * 131, 4);
      mf.box(uc2 - 0.046, uc2 + 0.046, y + 0.4, y + 0.455, d + 0.02, d + 0.104);
      W.attr("aRole", ROLE.STONE);
      wf.box(uc2 - 0.115, uc2 + 0.115, y - 0.04, y + 0.16, d, d + 0.014);
    }
  }
}
function emitBuilding(b, W, G, T, M) {
  const c = {
    wf: new Face(W, b.frame),
    gf: new Face(G, b.frame),
    tf: new Face(T, b.frame),
    mf: new Face(M, b.frame),
    W,
    G,
    T,
    M,
    b,
    d: b.d0
  };
  const { wf } = c;
  const d = b.d0;
  const back = d - BLOCK_DEPTH;
  const yb = b.base - 0.55;
  const originY = b.base + b.gh;
  const yTop = b.base + b.H;
  const yPar = yTop + b.par;
  const roofY = yTop - 0.42;
  W.attr("aGrid", b.bayW, b.fh, 0.25, originY);
  W.attr("aWin", b.winW, b.sill, 0, b.L);
  W.attr("aBldg", b.seed, b.pal, b.base, yTop);
  const { plinthTop, openTop } = groundLevels(b);
  const pOut = 0.09;
  W.attr("aRole", ROLE.PLINTH);
  wf.panel(0, b.L, yb, plinthTop, d + pOut);
  W.attr("aRole", ROLE.STONE);
  wf.quadFree(
    [0, plinthTop, d + pOut],
    [0, plinthTop + 0.075, d],
    [b.L, plinthTop + 0.075, d],
    [b.L, plinthTop, d + pOut],
    [[0, plinthTop], [0, plinthTop + 0.08], [b.L, plinthTop + 0.08], [b.L, plinthTop]]
  );
  const openings = groundOpenings(b);
  const groundHoles = openings.map((o) => [o.u0, o.u1]);
  W.attr("aRole", ROLE.WALL);
  band(wf, plinthTop, openTop, d, 0, b.L, groundHoles);
  for (const { u0: a, u1: z, rec } of openings) {
    W.attr("aRole", ROLE.REVEAL);
    wf.jamb(a, d - rec, d, plinthTop, openTop, 1);
    wf.jamb(z, d - rec, d, plinthTop, openTop, -1);
    wf.deck(a, z, d - rec, d, openTop, false);
    wf.deck(a, z, d - rec, d, plinthTop, true);
    if (b.street) continue;
    W.attr("aRole", ROLE.SHUTTER);
    wf.panel(a, z, plinthTop, openTop, d - rec);
  }
  W.attr("aRole", ROLE.STONE);
  wf.box(0, b.L, openTop, openTop + 0.24, d - 0.02, d + 0.045);
  W.attr("aRole", ROLE.WALL);
  wf.panel(0, b.L, openTop + 0.24, originY, d);
  if (b.band) {
    W.attr("aRole", ROLE.STONE);
    wf.box(0, b.L, originY - 0.16, originY - 0.02, d - 0.02, d + 0.055);
  }
  for (let f = 0; f < b.nUp; f++) {
    const fb = originY + f * b.fh;
    const y0 = fb + b.sill;
    const y1 = Math.min(y0 + b.winH, fb + b.fh - 0.42);
    const holes = [];
    const keys = [];
    for (let i = 0; i < b.bays; i++) {
      if (h2(b.seed * 61 + f * 5.7, i * 3.3) < 0.055) continue;
      const uc = 0.25 + (i + 0.5) * b.bayW;
      holes.push([uc - b.winW * 0.5, uc + b.winW * 0.5]);
      keys.push(f * 37 + i * 5 + 1);
    }
    W.attr("aRole", ROLE.WALL);
    band(wf, fb, y0, d, 0, b.L, []);
    band(wf, y0, y1, d, 0, b.L, holes);
    band(wf, y1, fb + b.fh, d, 0, b.L, []);
    for (let k = 0; k < holes.length; k++) {
      emitWindow(c, holes[k][0], holes[k][1], y0, y1, keys[k]);
      W.attr("aRole", ROLE.WALL);
    }
  }
  if (b.cornice > 0) {
    W.attr("aRole", ROLE.STONE);
    wf.box(-0.04, b.L + 0.04, yTop - 0.3, yTop, d - 0.02, d + b.cornice);
  }
  W.attr("aRole", ROLE.WALL);
  wf.panel(0, b.L, yTop, yPar, d);
  W.attr("aRole", ROLE.STONE);
  wf.deck(-0.03, b.L + 0.03, d - 0.36, d + 0.05, yPar, true);
  wf.jamb(-0.03, d - 0.36, d + 0.05, yPar - 0.07, yPar, -1);
  wf.jamb(b.L + 0.03, d - 0.36, d + 0.05, yPar - 0.07, yPar, 1);
  wf.panel(-0.03, b.L + 0.03, yPar - 0.07, yPar, d + 0.05);
  W.attr("aRole", ROLE.PLAIN);
  wf.panelIn(0, b.L, roofY, yPar, d - 0.36);
  W.attr("aRole", ROLE.ROOF);
  wf.deck(0, b.L, back, d - 0.36, roofY, true);
  if (h2(b.seed, 3.7) > 0.66) {
    const cu = 0.25 + b.bayW * Math.max(0, Math.floor((b.bays - 2) * h2(b.seed, 8.2)));
    const cw = b.bayW * (b.bays > 3 ? 2 : 1);
    const rise = 0.45 + h2(b.seed, 12.9) * 0.8;
    W.attr("aRole", ROLE.WALL);
    wf.panel(cu, cu + cw, yPar, yPar + rise, d);
    wf.jamb(cu, d - 0.36, d, yPar, yPar + rise, -1);
    wf.jamb(cu + cw, d - 0.36, d, yPar, yPar + rise, 1);
    wf.panelIn(cu, cu + cw, yPar, yPar + rise, d - 0.36);
    W.attr("aRole", ROLE.STONE);
    wf.deck(cu - 0.08, cu + cw + 0.08, d - 0.42, d + 0.07, yPar + rise, true);
    wf.panel(cu - 0.08, cu + cw + 0.08, yPar + rise - 0.09, yPar + rise, d + 0.07);
    wf.jamb(cu - 0.08, d - 0.42, d + 0.07, yPar + rise - 0.09, yPar + rise, -1);
    wf.jamb(cu + cw + 0.08, d - 0.42, d + 0.07, yPar + rise - 0.09, yPar + rise, 1);
  }
  W.attr("aRole", ROLE.FLANK);
  wf.jamb(0, back, d, yb, yPar, -1);
  wf.jamb(b.L, back, d, yb, yPar, 1);
  W.attr("aRole", ROLE.PLAIN);
  wf.panelIn(0, b.L, yb, yPar, back);
  if (b.escape >= 0) emitEscape(c, b.escape);
  emitFurniture(c);
  if (b.street) emitStreetFixtures(c);
}

// <stdin>
function createGeometry({ seed = 0.43, width = 12, floors = 2 } = {}) {
  const W = new Emit({ aGrid: 4, aWin: 4, aBldg: 4, aRole: 1 }), G = new Emit({ aPane: 4 }), T = new Emit({ aTrim: 2 }), M = new Emit({ aMetal: 2 });
  const bays = Math.max(2, Math.round(width / 3)), gh = 3.6, fh = 3.1;
  const b = { frame: frame(-width / 2, -6, 1, 0), L: width, base: 0, gh, fh, nUp: floors, H: gh + fh * floors, par: 0.6, cornice: 0.23, band: true, d0: 0, bays, bayW: (width - 0.5) / bays, winW: 1.35, winH: 1.65, sill: 0.65, reveal: 0.23, pier: 0.65, fascia: 0.55, plinth: 0.3, street: false, pal: 0, seed, escape: 1, pipes: 3 };
  emitBuilding(b, W, G, T, M);
  return { wall: W.geometry(), glass: G.geometry(), trim: T.geometry(), metal: M.geometry(), triangles: W.triangleCount + G.triangleCount + T.triangleCount + M.triangleCount };
}
export {
  createGeometry
};
