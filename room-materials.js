import * as THREE from './vendor/three.module.js';

// Room materials are deliberately shared by style.  A course can contain many
// rooms, but the palette only allocates a handful of textures/materials and the
// static world pass can still merge compatible meshes.
const CACHE = new WeakMap();
const BUNDLED_TEXTURES = new Map();
const BUNDLED_TEXTURE_READY = new Map();
const AFTERLIFE_MOISTURE_TILES = new Map();
// One authored tile per (sector, style, purpose).  Every room in that style
// clones the shared tile for its own repeat, so a twelve-room course still
// uploads two or three canvases instead of one per room.
const SURFACE_TILES = new Map();
const CELL = 4;
const TILE_VERSION = 3;

const PALETTES = Object.freeze({
  bloodworks: Object.freeze({
    base: 0x39262c, panel: 0x634047, trim: 0xb26d55, floor: 0x211a21,
    hazard: 0xdf8d45, signal: 0xff4d49, bone: 0xc9b69c, metal: 0x687581,
    deep: 0x120c11, soot: 0x131010, rust: 0x7a3b2a, gore: 0x6e1520, accent: 0xd9552f,
  }),
  ossuary: Object.freeze({
    base: 0x2b2b42, panel: 0x4c4868, trim: 0xb0a48e, floor: 0x161827,
    hazard: 0xb47b54, signal: 0xa476ff, bone: 0xd0c4a3, metal: 0x66728a,
    deep: 0x0e1020, soot: 0x161628, rust: 0x6a5340, gore: 0x5c2434, accent: 0x8f70ff,
  }),
  choir: Object.freeze({
    base: 0x3a2424, panel: 0x684038, trim: 0xc69357, floor: 0x241719,
    hazard: 0xe0984c, signal: 0xff9a48, bone: 0xc9b08a, metal: 0x7d6a66,
    deep: 0x150c0c, soot: 0x1b1310, rust: 0x8a4a22, gore: 0x701a18, accent: 0xff9a48,
  }),
});

// The afterlife pass is intentionally a material language layered over the
// existing sector palettes.  Keeping the roles here lets the one-time world
// pass retune a room without duplicating palette knowledge in the renderer.
// Values are deliberately neutral and low-saturation: the room construction
// still comes from the authored albedo tiles above, while the renderer can
// reserve brighter color for gates, objectives, and combat telegraphs.
const AFTERLIFE_SURFACE_PROFILE = Object.freeze({
  // Albedo values stay midtone so the afterlife lighting pass can create the
  // deep blacks in the screenshot.  Setting these uniformly near-black would
  // crush the authored texture and leave nothing for local lights to reveal.
  roomWall: Object.freeze({ color: 0x727b7b, roughness: .88, metalness: .08, moisture: 'wall' }),
  roomPanel: Object.freeze({ color: 0x586060, roughness: .74, metalness: .42, moisture: 'panel' }),
  roomTrim: Object.freeze({ color: 0x4b5354, roughness: .58, metalness: .62, moisture: 'trim' }),
  roomFloor: Object.freeze({ color: 0x777b75, roughness: .96, metalness: .045, moisture: 'floor' }),
  roomFloorInset: Object.freeze({ color: 0x666c66, roughness: .94, metalness: .06, moisture: 'floor' }),
  roomRecess: Object.freeze({ color: 0x070a0b, roughness: .97, metalness: .02, moisture: null }),
  roomHazard: Object.freeze({ color: 0x655247, roughness: .62, metalness: .46, moisture: 'metal' }),
  roomSignal: Object.freeze({ color: 0x666866, roughness: .5, metalness: .28, moisture: null, emissiveIntensity: .12 }),
  roomBone: Object.freeze({ color: 0x9a9584, roughness: .69, metalness: .1, moisture: 'bone' }),
  roomMetal: Object.freeze({ color: 0x434b4c, roughness: .67, metalness: .7, moisture: 'metal' }),
  roomRust: Object.freeze({ color: 0x49332d, roughness: .82, metalness: .3, moisture: 'metal' }),
  roomGore: Object.freeze({ color: 0x321c20, roughness: .72, metalness: .08, moisture: null }),
  roomAccent: Object.freeze({ color: 0x4a3934, roughness: .68, metalness: .28, moisture: 'metal', emissiveIntensity: .08 }),
});

const AFTERLIFE_CUE_PROFILE = Object.freeze({
  // Cues keep their hue but lose the candy-bright saturation of the old
  // sector accents.  A gate signal remains legible against the blackened room
  // while decorative relief strips can stay almost dark.
  roomSignal: Object.freeze({ saturation: .72, lightness: .62, roughness: .38, metalness: .34, emissiveIntensity: 1.35 }),
  roomHazard: Object.freeze({ saturation: .72, lightness: .58, roughness: .5, metalness: .5 }),
  roomAccent: Object.freeze({ saturation: .65, lightness: .54, roughness: .5, metalness: .36, emissiveIntensity: .22 }),
});

// Which authored PBR surface backs each slot.  The procedural tile is painted
// on top of this real texture, so the wall keeps photographic grain while the
// sector still changes its construction language (panel / catacomb / brass).
const ALBEDO_FILES = Object.freeze({
  bloodworks: Object.freeze({
    wall: 'dead-arrival-industrial-flesh-metal.png', panel: 'gunmetal_albedo.png',
    floor: 'afterlife-institutional-floor-v1.webp', bone: 'dead-arrival-industrial-flesh-metal.png',
  }),
  ossuary: Object.freeze({
    wall: 'crypt-wall-albedo.webp', panel: 'crypt-wall-albedo.webp',
    floor: 'afterlife-institutional-floor-v1.webp', bone: 'dead-arrival-industrial-flesh-metal.png',
  }),
  choir: Object.freeze({
    wall: 'worn-oxblood-leather-v1.png', panel: 'gunmetal_albedo.png',
    floor: 'afterlife-institutional-floor-v1.webp', bone: 'dead-arrival-industrial-flesh-metal.png',
  }),
});

// Four construction states per sector.  Roomy courses rotate styles 0..3, so a
// sector reads as four different rooms instead of one recoloured room.
const STYLE_TRAITS = Object.freeze({
  bloodworks: Object.freeze([
    Object.freeze({ motif: 'plate', grime: 1.35, blood: 1.5, rust: 1.0, stripe: false, glow: 1.0 }),
    Object.freeze({ motif: 'cage', grime: .95, blood: .75, rust: 1.35, stripe: false, glow: 1.05 }),
    Object.freeze({ motif: 'valve', grime: 1.1, blood: 1.0, rust: .85, stripe: true, glow: 1.35 }),
    Object.freeze({ motif: 'furnace', grime: 1.6, blood: .55, rust: .95, stripe: true, glow: 1.6 }),
  ]),
  ossuary: Object.freeze([
    Object.freeze({ motif: 'brick', bone: 1.15, soot: .6, niche: .55 }),
    Object.freeze({ motif: 'stack', bone: 1.6, soot: .7, niche: .3 }),
    Object.freeze({ motif: 'niche', bone: 1.0, soot: .85, niche: 1.2 }),
    Object.freeze({ motif: 'rib', bone: 1.35, soot: 1.1, niche: .5 }),
  ]),
  choir: Object.freeze([
    Object.freeze({ motif: 'plate', brass: 1.15, soot: .7, mouths: .35, pipes: .25, glow: 1.0 }),
    Object.freeze({ motif: 'arch', brass: 1.0, soot: .55, mouths: .7, pipes: .2, glow: 1.2 }),
    Object.freeze({ motif: 'mouth', brass: .95, soot: .85, mouths: 1.3, pipes: .3, glow: 1.5 }),
    Object.freeze({ motif: 'pipe', brass: 1.25, soot: 1.3, mouths: .55, pipes: 1.15, glow: 1.7 }),
  ]),
});

const hex = value => `#${value.toString(16).padStart(6, '0')}`;
const brighten = (value, factor = 1) => {
  const color = new THREE.Color(value);
  color.r = Math.min(1, color.r * factor);
  color.g = Math.min(1, color.g * factor);
  color.b = Math.min(1, color.b * factor);
  return color.getHex();
};
const sectorKey = course => String(course.sectorId || course.id || 'bloodworks').toLowerCase();

function hash(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function seedFor(sector, style, purpose) {
  let seed = 0x9e3779b9 ^ TILE_VERSION;
  for (const tag of `${sector}:${style}:${purpose}`) seed = (Math.imul(seed ^ tag.charCodeAt(0), 2654435761)) >>> 0;
  return seed || 7;
}

function traitsFor(sector, style) {
  const table = STYLE_TRAITS[sector] || STYLE_TRAITS.bloodworks;
  const index = Math.abs(Math.floor(style || 0)) % table.length;
  return table[index];
}

function rgba(value, alpha) {
  const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function imageReady(image) {
  if (!image) return null;
  const width = image.naturalWidth ?? image.width ?? 0;
  const height = image.naturalHeight ?? image.height ?? 0;
  return width > 0 && height > 0 ? image : null;
}

function tileImage(g, image, size, tiles) {
  if (!imageReady(image)) return false;
  const step = size / tiles;
  try {
    for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) g.drawImage(image, x, y, step, step);
    return true;
  } catch {
    return false;
  }
}

// --- shared paint passes -----------------------------------------------------

function speckle(g, random, size, count, dark = '#05070d', light = '#ffffff') {
  g.globalAlpha = .26;
  for (let i = 0; i < count; i++) {
    const x = random() * size, y = random() * size;
    const w = 1 + random() * size * .18, h = 1 + random() * size * .035;
    g.fillStyle = i % 3 ? dark : light;
    g.fillRect(x, y, w, h);
  }
  g.globalAlpha = 1;
}

function soot(g, random, size, count, color, strength = .5) {
  for (let i = 0; i < count; i++) {
    const x = random() * size, y = random() * size;
    const r = size * (.08 + random() * .22);
    const gradient = g.createRadialGradient(x, y, r * .1, x, y, r);
    gradient.addColorStop(0, rgba(color, strength * (.5 + random() * .5)));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function scratches(g, random, size, count, color) {
  g.strokeStyle = color; g.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const x = random() * size, y = random() * size, a = random() * Math.PI * 2, len = size * (.05 + random() * .22);
    g.globalAlpha = .12 + random() * .3;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * .35);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function stain(g, random, size, count, color, scale = 1) {
  for (let i = 0; i < count; i++) {
    const x = random() * size, y = random() * size;
    const rx = size * (.03 + random() * .09) * scale, ry = rx * (.5 + random() * .8), a = random() * Math.PI;
    g.globalAlpha = .16 + random() * .3;
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

function streaks(g, random, size, count, color, alpha = .5, stretch = 1) {
  for (let i = 0; i < count; i++) {
    const x = random() * size, top = random() * size * .35, len = size * (.18 + random() * .5) * stretch, w = 1.5 + random() * size * .022;
    const gradient = g.createLinearGradient(0, top, 0, top + len);
    gradient.addColorStop(0, rgba(color, alpha));
    gradient.addColorStop(.75, rgba(color, alpha * .55));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient;
    g.beginPath();
    g.moveTo(x - w, top);
    g.lineTo(x + w, top);
    g.lineTo(x + w * (.4 + random() * .8), top + len);
    g.lineTo(x - w * (.4 + random() * .8), top + len);
    g.closePath(); g.fill();
  }
}

function cracks(g, random, size, count, color) {
  g.strokeStyle = color; g.lineWidth = 1.4;
  for (let i = 0; i < count; i++) {
    let x = random() * size, y = random() * size;
    g.globalAlpha = .3 + random() * .4;
    g.beginPath(); g.moveTo(x, y);
    let a = random() * Math.PI * 2;
    for (let step = 0; step < 5; step++) {
      a += (random() - .5) * 1.1;
      const len = size * (.02 + random() * .06);
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

function rivets(g, positions, radius, color, highlight = '#d8c9a8') {
  for (const [x, y] of positions) {
    g.fillStyle = rgba(color, .85); g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fill();
    g.fillStyle = highlight; g.globalAlpha = .35;
    g.beginPath(); g.arc(x - radius * .28, y - radius * .3, radius * .42, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}

function hazardStrip(g, x, y, w, h, palette) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = rgba(palette.deep, .92); g.fillRect(x, y, w, h);
  g.fillStyle = rgba(palette.hazard, .72);
  const step = h * 2.1;
  for (let i = -h; i < w + h; i += step) {
    g.beginPath();
    g.moveTo(x + i, y + h); g.lineTo(x + i + h, y);
    g.lineTo(x + i + h + h, y); g.lineTo(x + i + h, y + h);
    g.closePath(); g.fill();
  }
  g.restore();
}

function slabGrid(g, random, size, palette, options = {}) {
  const cols = options.cols || 2, toneRange = options.toneRange ?? .16, gap = options.gap ?? size * .012;
  const step = size / cols;
  for (let row = 0; row < cols; row++) for (let col = 0; col < cols; col++) {
    const shade = new THREE.Color(options.color ?? palette.base);
    shade.offsetHSL(0, 0, (random() - .5) * toneRange);
    g.fillStyle = `#${shade.getHexString()}`;
    g.fillRect(col * step + gap, row * step + gap, step - gap * 2, step - gap * 2);
  }
  g.strokeStyle = rgba(palette.deep, .8); g.lineWidth = Math.max(1, size * .008);
  for (let i = 0; i <= cols; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
  }
}

function masonry(g, random, size, palette, rows = 7) {
  const rowHeight = size / rows;
  g.fillStyle = rgba(palette.deep, .55); g.fillRect(0, 0, size, size);
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * rowHeight * .55;
    const blockHeight = rowHeight * (.88 + random() * .06);
    for (let x = -rowHeight; x < size; x += rowHeight * 1.5) {
      const shade = new THREE.Color(palette.base);
      shade.offsetHSL((random() - .5) * .02, (random() - .5) * .06, (random() - .5) * .16);
      g.fillStyle = `#${shade.getHexString()}`;
      g.fillRect(x + offset + 2, row * rowHeight + 2, rowHeight * 1.5 - 3, blockHeight);
    }
  }
}

// --- sector painters ---------------------------------------------------------

function paintBloodworks(g, size, palette, trait, purpose, random) {
  if (purpose === 'floor') {
    slabGrid(g, random, size, palette, { color: palette.floor, cols: 2, toneRange: .1 });
    g.fillStyle = rgba(palette.rust, .12);
    for (let i = 0; i < 5; i++) g.fillRect(random() * size, random() * size, size * (.2 + random() * .5), size * .05);
    g.strokeStyle = rgba(palette.hazard, .5); g.lineWidth = size * .022;
    g.strokeRect(size * .06, size * .06, size * .88, size * .88);
    const drain = size * .5;
    g.fillStyle = rgba(palette.deep, .9); g.fillRect(drain - size * .09, 0, size * .18, size);
    g.fillStyle = rgba(palette.metal, .5);
    for (let y = 0; y < size; y += size * .07) g.fillRect(drain - size * .085, y, size * .17, size * .02);
    stain(g, random, size, 5, rgba(palette.gore, .5), trait.blood * .9);
    stain(g, random, size, 4, rgba(palette.deep, .8), .7);
    cracks(g, random, size, 3, rgba(palette.deep, .7));
    return;
  }
  if (purpose === 'panel') {
    g.fillStyle = rgba(palette.panel, 1); g.fillRect(0, 0, size, size);
    const cols = 3, step = size / cols;
    for (let i = 0; i <= cols; i++) {
      g.fillStyle = rgba(palette.deep, .55); g.fillRect(i * step - size * .012, 0, size * .024, size);
    }
    g.fillStyle = rgba(palette.rust, .16 * trait.rust);
    for (let i = 0; i < 7; i++) g.fillRect(random() * size, random() * size, size * (.06 + random() * .2), size * (.01 + random() * .05));
    rivets(g, Array.from({ length: 12 }, (_, i) => [size * .09 + (i % 3) * step, size * .12 + Math.floor(i / 3) * size * .28]), size * .012, palette.deep);
    if (trait.stripe) hazardStrip(g, 0, size * .78, size, size * .14, palette);
    scratches(g, random, size, 10, rgba(palette.trim, .5));
    soot(g, random, size, 3, palette.soot, .45 * trait.grime);
    return;
  }
  // Wall: painted steel plate rows, rivet courses, rust bleed and dried
  // streaks running out of the seams.
  const rows = 3, rowHeight = size / rows;
  for (let row = 0; row < rows; row++) {
    const shade = new THREE.Color(palette.base);
    shade.offsetHSL((random() - .5) * .01, (random() - .5) * .04, (random() - .5) * .05);
    g.fillStyle = `#${shade.getHexString()}`;
    g.fillRect(0, row * rowHeight, size, rowHeight);
    g.fillStyle = rgba(palette.deep, .65);
    g.fillRect(0, row * rowHeight, size, size * .012);
    g.fillStyle = rgba(palette.trim, .22);
    g.fillRect(0, row * rowHeight + size * .014, size, size * .006);
    rivets(g, Array.from({ length: 8 }, (_, i) => [size * .05 + i * size * .128, row * rowHeight + rowHeight * .5]), size * .009, palette.deep);
  }
  if (trait.stripe) hazardStrip(g, 0, size * .62, size, size * .1, palette);
  g.globalAlpha = .5 * trait.rust;
  for (let i = 0; i < 6; i++) {
    const x = random() * size, y = random() * size * .8, w = size * (.03 + random() * .09), h = size * (.05 + random() * .2);
    const gradient = g.createLinearGradient(0, y, 0, y + h);
    gradient.addColorStop(0, rgba(palette.rust, .55)); gradient.addColorStop(1, rgba(palette.rust, 0));
    g.fillStyle = gradient; g.fillRect(x, y, w, h);
  }
  g.globalAlpha = 1;
  streaks(g, random, size, Math.round(4 * trait.blood), rgba(palette.gore, .8), .5 * trait.blood, 1.1);
  streaks(g, random, size, 3, rgba(palette.deep, .55), .4, .8);
  scratches(g, random, size, 14, rgba(palette.trim, .45));
  soot(g, random, size, Math.round(4 * trait.grime), palette.soot, .5);
  stain(g, random, size, 3, rgba(palette.rust, .5), 1.1);
}

function paintOssuary(g, size, palette, trait, purpose, random) {
  if (purpose === 'floor') {
    slabGrid(g, random, size, palette, { color: palette.floor, cols: 2, toneRange: .14 });
    g.globalAlpha = .3;
    for (let i = 0; i < 6; i++) {
      const x = random() * size, y = random() * size;
      g.fillStyle = rgba(palette.bone, .5);
      g.beginPath(); g.ellipse(x, y, size * (.06 + random() * .14), size * (.03 + random() * .07), random() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    cracks(g, random, size, 5, rgba(palette.deep, .8));
    stain(g, random, size, 3, rgba(palette.gore, .35), .9);
    soot(g, random, size, 3, palette.soot, .35);
    return;
  }
  if (purpose === 'panel') {
    masonry(g, random, size, palette, 6);
    g.globalAlpha = .5;
    for (let i = 0; i < 6; i++) {
      const x = random() * size, y = random() * size;
      g.fillStyle = rgba(palette.bone, .35 * trait.bone);
      g.fillRect(x, y, size * (.06 + random() * .2), size * .022);
    }
    g.globalAlpha = 1;
    soot(g, random, size, 3, palette.soot, .4 * trait.soot);
    return;
  }
  // Wall: catacomb courses with bone inlay.  Styles swap between stacked
  // femurs, plain brick and skull niches.
  masonry(g, random, size, palette, 7);
  if (trait.motif === 'brick') {
    g.globalAlpha = .35;
    for (let i = 0; i < 4; i++) {
      const x = random() * size, y = size * (.15 + random() * .7);
      g.strokeStyle = rgba(palette.bone, .55); g.lineWidth = size * .012;
      g.beginPath(); g.arc(x, y, size * (.06 + random() * .05), Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    }
    g.globalAlpha = 1;
  } else if (trait.motif === 'stack') {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 9; i++) {
        const x = size * .06 + i * size * .105 + (row % 2) * size * .03;
        const y = size * (.22 + row * .26) + (random() - .5) * size * .02;
        g.strokeStyle = rgba(palette.bone, .5); g.lineWidth = size * .014;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + size * .085, y); g.stroke();
        g.fillStyle = rgba(palette.bone, .35);
        g.beginPath(); g.arc(x, y, size * .009, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + size * .085, y, size * .009, 0, Math.PI * 2); g.fill();
      }
    }
  } else if (trait.motif === 'niche') {
    for (let i = 0; i < 4; i++) {
      const x = size * .16 + (i % 2) * size * .5, y = size * (.22 + Math.floor(i / 2) * .42);
      g.fillStyle = rgba(palette.deep, .92);
      g.beginPath(); g.arc(x, y, size * .12, Math.PI, 0); g.rect(x - size * .12, y, size * .24, size * .16); g.fill();
      g.fillStyle = rgba(palette.bone, .62); g.beginPath(); g.arc(x, y - size * .015, size * .05, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba(palette.deep, .95);
      g.beginPath(); g.arc(x - size * .018, y - size * .02, size * .014, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + size * .018, y - size * .02, size * .014, 0, Math.PI * 2); g.fill();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const x = size * .08 + i * size * .2;
      g.strokeStyle = rgba(palette.bone, .45); g.lineWidth = size * .03;
      g.beginPath(); g.arc(x, size * .8, size * .17, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.lineWidth = size * .018;
      g.beginPath(); g.moveTo(x, size * .06); g.lineTo(x, size * .78); g.stroke();
    }
  }
  g.globalAlpha = .35;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = rgba(palette.bone, .4 * trait.bone);
    g.fillRect(random() * size, random() * size, size * (.03 + random() * .16), size * (.012 + random() * .03));
  }
  g.globalAlpha = 1;
  cracks(g, random, size, 6, rgba(palette.deep, .75));
  soot(g, random, size, Math.round(4 * trait.soot), palette.soot, .5);
  stain(g, random, size, 3, rgba(palette.gore, .3), 1.2);
}

function paintChoir(g, size, palette, trait, purpose, random) {
  if (purpose === 'floor') {
    slabGrid(g, random, size, palette, { color: palette.floor, cols: 2, toneRange: .12 });
    g.globalAlpha = .5;
    for (let i = 0; i < 5; i++) {
      const x = random() * size, y = random() * size, r = size * (.05 + random() * .13);
      const gradient = g.createRadialGradient(x, y, r * .2, x, y, r);
      gradient.addColorStop(0, rgba(palette.hazard, .5)); gradient.addColorStop(1, rgba(palette.hazard, 0));
      g.fillStyle = gradient; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    soot(g, random, size, 3, palette.soot, .45);
    scratches(g, random, size, 8, rgba(palette.trim, .35));
    return;
  }
  if (purpose === 'panel') {
    g.fillStyle = rgba(palette.panel, 1); g.fillRect(0, 0, size, size);
    for (let i = 1; i < 3; i++) {
      g.fillStyle = rgba(palette.deep, .5);
      g.fillRect(i * size / 3 - size * .008, 0, size * .016, size);
    }
    rivets(g, Array.from({ length: 9 }, (_, i) => [size * .1 + (i % 3) * size * .31, size * .14 + Math.floor(i / 3) * size * .3]), size * .011, palette.deep);
    g.globalAlpha = .3 * trait.brass;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rgba(palette.trim, .5);
      g.fillRect(random() * size, random() * size, size * (.04 + random() * .2), size * .014);
    }
    g.globalAlpha = 1;
    soot(g, random, size, 4, palette.soot, .5 * trait.soot);
    stain(g, random, size, 3, rgba(palette.rust, .4), 1.1);
    return;
  }
  // Wall: soot-blackened brass plates, engraved arches and mouth reliefs.
  g.fillStyle = rgba(palette.base, 1); g.fillRect(0, 0, size, size);
  for (let row = 0; row < 2; row++) {
    const y = row * size * .5;
    const gradient = g.createLinearGradient(0, y, 0, y + size * .5);
    gradient.addColorStop(0, rgba(palette.trim, .22 * trait.brass));
    gradient.addColorStop(.5, rgba(palette.base, .1));
    gradient.addColorStop(1, rgba(palette.deep, .5));
    g.fillStyle = gradient; g.fillRect(0, y, size, size * .5);
    g.fillStyle = rgba(palette.deep, .6); g.fillRect(0, y + size * .5 - size * .01, size, size * .01);
  }
  if (trait.motif === 'plate') {
    rivets(g, Array.from({ length: 10 }, (_, i) => [size * .08 + (i % 5) * size * .21, size * .16 + Math.floor(i / 5) * size * .62]), size * .012, palette.deep);
  } else if (trait.motif === 'arch') {
    g.strokeStyle = rgba(palette.trim, .5); g.lineWidth = size * .016;
    for (let i = 0; i < 3; i++) {
      const x = size * .2 + i * size * .3;
      g.beginPath(); g.arc(x, size * .55, size * .11, Math.PI, 0); g.stroke();
      g.beginPath(); g.moveTo(x - size * .11, size * .55); g.lineTo(x - size * .11, size * .86); g.stroke();
      g.beginPath(); g.moveTo(x + size * .11, size * .55); g.lineTo(x + size * .11, size * .86); g.stroke();
    }
  } else if (trait.motif === 'pipe') {
    for (let i = 0; i < 5; i++) {
      const x = size * .12 + i * size * .19, h = size * (.4 + random() * .38);
      const gradient = g.createLinearGradient(x, 0, x + size * .1, 0);
      gradient.addColorStop(0, rgba(palette.deep, .9));
      gradient.addColorStop(.45, rgba(palette.trim, .55 * trait.brass));
      gradient.addColorStop(1, rgba(palette.base, .9));
      g.fillStyle = gradient; g.fillRect(x, size - h, size * .1, h);
    }
  }
  for (let i = 0; i < Math.max(1, Math.round(2 * trait.mouths)); i++) {
    const x = size * (.2 + random() * .6), y = size * (.2 + random() * .55), r = size * (.06 + random() * .05);
    g.fillStyle = rgba(palette.deep, .95); g.beginPath(); g.ellipse(x, y, r, r * .75, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(palette.gore, .8); g.beginPath(); g.ellipse(x, y + r * .12, r * .62, r * .4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba(palette.bone, .75);
    for (let t = 0; t < 6; t++) {
      const a = t / 6 * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r * .95, y + Math.sin(a) * r * .6);
      g.lineTo(x + Math.cos(a + .22) * r * .95, y + Math.sin(a + .22) * r * .6);
      g.lineTo(x + Math.cos(a + .11) * r * .55, y + Math.sin(a + .11) * r * .42);
      g.closePath(); g.fill();
    }
  }
  streaks(g, random, size, Math.round(4 * trait.soot), rgba(palette.soot, .8), .45, 1.2);
  streaks(g, random, size, 3, rgba(palette.gore, .6), .35, .9);
  g.globalAlpha = .35;
  for (let i = 0; i < 7; i++) {
    g.fillStyle = i % 2 ? rgba(0x3f7d6a, .5) : rgba(palette.trim, .5);
    g.fillRect(random() * size, random() * size, size * (.02 + random() * .16), size * (.008 + random() * .04));
  }
  g.globalAlpha = 1;
  soot(g, random, size, Math.round(4 * trait.soot), palette.soot, .55);
  scratches(g, random, size, 12, rgba(palette.trim, .45));
}

function paintSurface(g, size, palette, sector, style, purpose, random, base) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const trait = traitsFor(sector, style);
  const baseColour = purpose === 'floor' ? palette.floor : purpose === 'panel' ? palette.panel : palette.base;
  g.fillStyle = hex(baseColour);
  g.fillRect(0, 0, size, size);
  if (base) {
    g.globalAlpha = purpose === 'floor' ? .44 : purpose === 'panel' ? .3 : .38;
    tileImage(g, base, size, purpose === 'floor' ? 2 : 3);
    g.globalAlpha = 1;
  }
  if (sector === 'ossuary') paintOssuary(g, size, palette, trait, purpose, random);
  else if (sector === 'choir') paintChoir(g, size, palette, trait, purpose, random);
  else paintBloodworks(g, size, palette, trait, purpose, random);
  speckle(g, random, size, purpose === 'floor' ? 240 : 320);
  // A soft vertical grime gradient keeps every wall heavier at the floor line.
  const grime = g.createLinearGradient(0, 0, 0, size);
  grime.addColorStop(0, rgba(palette.deep, 0));
  grime.addColorStop(1, rgba(palette.deep, purpose === 'floor' ? .3 : .42));
  g.fillStyle = grime; g.fillRect(0, 0, size, size);
}

function surfaceTexture(sector, style, purpose) {
  if (typeof document === 'undefined') return null;
  const key = `${sector}:${style}:${purpose}:${TILE_VERSION}`;
  const cached = SURFACE_TILES.get(key);
  if (cached) return cached;
  const size = purpose === 'wall' ? 512 : 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const palette = PALETTES[sector] || PALETTES.bloodworks;
  const file = (ALBEDO_FILES[sector] || ALBEDO_FILES.bloodworks)[purpose === 'wall' ? 'wall' : purpose === 'panel' ? 'panel' : 'floor'];
  const bundled = file ? bundledTexture(file) : null;
  const paint = base => paintSurface(g, size, palette, sector, style, purpose, hash(seedFor(sector, style, purpose)), base);
  paint(imageReady(bundled?.image));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  texture.userData.roomSurface = { sector, style, purpose, version: TILE_VERSION };
  SURFACE_TILES.set(key, texture);
  if (bundled && !imageReady(bundled.image)) {
    // The authored PBR source arrives after the first paint on slower loads.
    // Repainting the same canvas keeps one texture object per style, so no
    // material or mesh churn happens when the image lands.
    BUNDLED_TEXTURE_READY.get(file)?.then(() => {
      if (!imageReady(bundled.image)) return;
      paint(bundled.image);
      texture.needsUpdate = true;
    }).catch(() => {});
  }
  return texture;
}

// A compact grayscale roughness tile for the afterlife pass.  The broad dark
// patches act as damp, smoother plaster/metal while the warm-gray grain keeps
// the surface from turning into a uniform mirror.  It is shared by role and
// generated only in a browser; headless material tests simply retain the
// authored roughness maps already present on the room materials.
function moistureTexture(purpose = 'wall') {
  if (typeof document === 'undefined') return null;
  const key = `afterlife:${purpose}:2`;
  const cached = AFTERLIFE_MOISTURE_TILES.get(key);
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const random = hash(seedFor('afterlife', 1, purpose));
  // Most of the floor stays dry. Sparse smoother islands catch the lantern
  // without making every tile look like polished sheet metal.
  g.fillStyle = purpose === 'floor' ? '#f2f2f2' : '#c4c4bd';
  g.fillRect(0, 0, size, size);
  const patches = purpose === 'floor' ? 3 : purpose === 'metal' ? 16 : 14;
  for (let i = 0; i < patches; i++) {
    const x = random() * size, y = random() * size;
    const rx = size * (.045 + random() * .15), ry = rx * (.3 + random() * .85);
    const gradient = g.createRadialGradient(x, y, Math.min(rx, ry) * .12, x, y, Math.max(rx, ry));
    const damp = (purpose === 'floor' ? 128 : 72) + Math.floor(random() * 40);
    gradient.addColorStop(0, `rgb(${damp},${damp + 2},${damp + 1})`);
    gradient.addColorStop(.58, `rgb(${damp + 34},${damp + 34},${damp + 30})`);
    gradient.addColorStop(1, 'rgba(190,191,184,0)');
    g.save();
    g.translate(x, y); g.rotate((random() - .5) * Math.PI); g.translate(-x, -y);
    g.fillStyle = gradient;
    g.fillRect(x - rx * 1.25, y - ry * 1.25, rx * 2.5, ry * 2.5);
    g.restore();
  }
  const streakCount = purpose === 'floor' ? 0 : 14;
  for (let i = 0; i < streakCount; i++) {
    const x = random() * size, y = random() * size * .58, length = size * (.12 + random() * .44);
    const gradient = g.createLinearGradient(x, y, x, y + length);
    gradient.addColorStop(0, 'rgba(92,95,91,.62)');
    gradient.addColorStop(.72, 'rgba(142,144,137,.36)');
    gradient.addColorStop(1, 'rgba(196,196,188,0)');
    g.fillStyle = gradient;
    g.fillRect(x - size * (.004 + random() * .008), y, size * (.008 + random() * .018), length);
  }
  g.globalAlpha = .2;
  for (let i = 0; i < 180; i++) {
    const tone = 120 + Math.floor(random() * 90);
    g.fillStyle = `rgb(${tone},${tone},${Math.max(0, tone - 3)})`;
    const w = .6 + random() * 3.2;
    g.fillRect(random() * size, random() * size, w, .6 + random() * 1.8);
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  texture.userData.afterlifeMoisture = { purpose, version: 2 };
  AFTERLIFE_MOISTURE_TILES.set(key, texture);
  return texture;
}

export function getAfterlifeMoistureTexture(purpose = 'wall') {
  return moistureTexture(purpose);
}

function bundledTexture(file, colorSpace = THREE.SRGBColorSpace) {
  if (typeof document === 'undefined') return null;
  if (BUNDLED_TEXTURES.has(file)) return BUNDLED_TEXTURES.get(file);
  const url = `./assets/textures/${file}`;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Keep the rejection observable to roomMaterialsReady() while marking it
  // handled here so an optional prewarm does not create an unhandled event.
  ready.catch(() => {});
  let texture;
  try {
    texture = new THREE.TextureLoader().load(url, loaded => resolveReady(loaded), undefined, error => {
      const detail = error?.message || error?.type || String(error || 'unknown loader error');
      rejectReady(new Error(`Room texture failed to load: ${url} (${detail})`));
    });
  } catch (error) {
    rejectReady(new Error(`Room texture failed to start: ${url} (${error?.message || String(error)})`));
    texture = new THREE.Texture();
  }
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  BUNDLED_TEXTURES.set(file, texture);
  BUNDLED_TEXTURE_READY.set(file, ready);
  return texture;
}

// The renderer can await this after room construction and before its first
// gameplay frame. A rejected result contains the exact relative asset URL.
export function roomMaterialsReady() {
  return Promise.all([...BUNDLED_TEXTURE_READY.values()]);
}

function linearDetail(texture) {
  if (!texture) return null;
  const detail = texture.clone();
  detail.colorSpace = THREE.NoColorSpace;
  detail.needsUpdate = true;
  detail.userData.sharedAsset = true;
  return detail;
}

function roomTexture(texture, repeat = [1, 1]) {
  if (!texture) return null;
  const roomMap = texture.clone();
  roomMap.colorSpace = texture.colorSpace;
  roomMap.wrapS = roomMap.wrapT = THREE.RepeatWrapping;
  roomMap.repeat.set(repeat[0], repeat[1]);
  roomMap.anisotropy = texture.anisotropy || 4;
  roomMap.needsUpdate = true;
  roomMap.userData.sharedAsset = true;
  return roomMap;
}

function makeMaterial(base, color, options = {}) {
  const material = base?.clone?.() || new THREE.MeshStandardMaterial();
  material.color.set(color);
  if (options.roughness !== undefined) material.roughness = options.roughness;
  if (options.metalness !== undefined) material.metalness = options.metalness;
  if (options.emissive) {
    material.emissive.set(options.emissive);
    material.emissiveIntensity = options.emissiveIntensity ?? 1.2;
  }
  material.name = options.name || `RoomMaterial_${color.toString(16)}`;
  material.userData.sharedLibrary = true;
  material.userData.roomRole = options.role || 'support';
  return material;
}

function createPalette(materials, sector, styleIndex) {
  const base = PALETTES[sector] || PALETTES.bloodworks;
  const styleNumber = Math.abs(Math.floor(styleIndex || 0)) % 4;
  const style = `${sector}-${styleNumber}`;
  const trait = traitsFor(sector, styleNumber);
  const wallMap = surfaceTexture(sector, styleNumber, 'wall');
  const panelMap = surfaceTexture(sector, styleNumber, 'panel');
  const floorMap = surfaceTexture(sector, styleNumber, 'floor');
  const wallDetail = linearDetail(wallMap);
  const panelDetail = linearDetail(panelMap);
  const floorDetail = linearDetail(floorMap);
  // The authored PBR surfaces stay the photographic layer; the sector tile
  // above them carries the construction language.  Both are cached per style.
  const cryptAlbedo = materials.wall?.map || bundledTexture('crypt-wall-albedo.webp');
  const gunmetalAlbedo = materials.metal?.map || bundledTexture('gunmetal_albedo.png');
  const gunmetalNormal = bundledTexture('gunmetal_normal.png', THREE.NoColorSpace);
  const gunmetalRoughness = bundledTexture('gunmetal_roughness.png', THREE.NoColorSpace);
  const organicAlbedo = bundledTexture('dead-arrival-industrial-flesh-metal.png');
  const wall = makeMaterial(materials.wall, brighten(base.base, 2.05), { roughness: .86, metalness: .26, role: 'roomWall', name: `RoomWall_${style}` });
  const panel = makeMaterial(materials.wallPanel, brighten(base.panel, 1.8), { roughness: .69, metalness: .42, role: 'roomPanel', name: `RoomPanel_${style}` });
  const trim = makeMaterial(materials.metal, brighten(base.trim, 1.25), { roughness: .38, metalness: .78, role: 'roomTrim', name: `RoomTrim_${style}` });
  const floor = makeMaterial(materials.floor, brighten(base.floor, 1.85), { roughness: .9, metalness: .23, role: 'roomFloor', name: `RoomFloor_${style}` });
  const floorInset = makeMaterial(materials.floor, brighten(base.floor, 2.35), { roughness: .84, metalness: .2, role: 'roomFloorInset', name: `RoomFloorInset_${style}` });
  const shadow = makeMaterial(materials.black, 0x0b0b12, { roughness: .97, metalness: .04, role: 'roomRecess', name: `RoomRecess_${style}` });
  const hazard = makeMaterial(materials.hazard, base.hazard, { roughness: .45, metalness: .62, role: 'roomHazard', name: `RoomHazard_${style}` });
  const signal = makeMaterial(sector === 'ossuary' ? materials.violet : sector === 'choir' ? materials.orange : materials.red, base.signal, { emissive: base.signal, emissiveIntensity: 2.1 * (trait.glow || 1), roughness: .32, metalness: .38, role: 'roomSignal', name: `RoomSignal_${style}` });
  const bone = makeMaterial(materials.steel, base.bone, { roughness: .78, metalness: .18, role: 'roomBone', name: `RoomBone_${style}` });
  const metal = makeMaterial(materials.metalDark, base.metal, { roughness: .57, metalness: .76, role: 'roomMetal', name: `RoomMetal_${style}` });
  const rust = makeMaterial(materials.rust, base.rust, { roughness: .84, metalness: .34, role: 'roomRust', name: `RoomRust_${style}` });
  const gore = makeMaterial(materials.gore, base.gore, { roughness: .66, metalness: .12, role: 'roomGore', name: `RoomGore_${style}` });
  const accent = makeMaterial(materials.rust, base.accent, { roughness: .52, metalness: .4, emissive: base.accent, emissiveIntensity: .6 * (trait.glow || 1), role: 'roomAccent', name: `RoomAccent_${style}` });
  wall.emissive.set(base.panel); wall.emissiveIntensity = .13;
  panel.emissive.set(base.trim); panel.emissiveIntensity = .11;
  floor.emissive.set(base.base); floor.emissiveIntensity = .035;
  floorInset.emissive.set(base.base); floorInset.emissiveIntensity = .045;
  // Sector construction identity: steel plate, catacomb bone or oxblood
  // brass.  Falls back to the crypt sheet when a tile could not be painted.
  const wallAlbedo = wallMap || cryptAlbedo;
  const panelAlbedo = panelMap || (sector === 'bloodworks' ? gunmetalAlbedo || cryptAlbedo : cryptAlbedo || gunmetalAlbedo);
  if (wallAlbedo) { wall.map = roomTexture(wallAlbedo, [1.5, 1.15]); wall.bumpMap = wallDetail || linearDetail(cryptAlbedo); wall.roughnessMap = wall.bumpMap; wall.bumpScale = .05; wall.needsUpdate = true; }
  if (panelAlbedo) { panel.map = roomTexture(panelAlbedo, [1.15, 1.15]); panel.bumpMap = panelDetail || linearDetail(cryptAlbedo); panel.roughnessMap = panel.bumpMap; panel.bumpScale = .04; panel.needsUpdate = true; }
  if (floorMap || cryptAlbedo) { floor.map = roomTexture(floorMap || cryptAlbedo, [1.7, 1.7]); floor.bumpMap = floorDetail || linearDetail(cryptAlbedo); floor.roughnessMap = floor.bumpMap; floor.bumpScale = .025; floor.needsUpdate = true; }
  if (floorMap || cryptAlbedo) { floorInset.map = floor.map; floorInset.bumpMap = floor.bumpMap; floorInset.roughnessMap = floor.roughnessMap; floorInset.needsUpdate = true; }
  if (gunmetalAlbedo) { trim.map = roomTexture(gunmetalAlbedo, [2.2, 2.2]); trim.normalMap = roomTexture(gunmetalNormal); trim.roughnessMap = roomTexture(gunmetalRoughness); trim.normalScale.set(.5, .5); trim.needsUpdate = true; }
  if (organicAlbedo) { bone.map = roomTexture(organicAlbedo, [1.2, 1.2]); bone.needsUpdate = true; }
  return {
    sector, style, wall, panel, trim, floor, floorInset, shadow, hazard, signal, bone, metal, rust, gore, accent,
    maps: [cryptAlbedo, gunmetalAlbedo, gunmetalNormal, gunmetalRoughness, organicAlbedo, wallMap, panelMap, floorMap].filter(Boolean),
  };
}

export function getRoomPalette(materials, course = {}, styleIndex = 0) {
  if (!materials || typeof materials !== 'object') return createPalette({}, sectorKey(course), styleIndex);
  let byStyle = CACHE.get(materials);
  if (!byStyle) { byStyle = new Map(); CACHE.set(materials, byStyle); }
  const sector = sectorKey(course);
  const key = `${sector}:${styleIndex}`;
  if (!byStyle.has(key)) byStyle.set(key, createPalette(materials, sector, styleIndex));
  return byStyle.get(key);
}

export function roomPaletteNames(course = {}) {
  const sector = sectorKey(course);
  return Object.keys(PALETTES).includes(sector) ? [`${sector}-0`, `${sector}-1`, `${sector}-2`, `${sector}-3`] : ['bloodworks-0'];
}

export { CELL, PALETTES, AFTERLIFE_SURFACE_PROFILE, AFTERLIFE_CUE_PROFILE };
