// Deterministic, bounded enemy appearance families.
//
// The visual meshes stay shared with the imported/procedural enemy assets. A
// profile only changes material uniforms and the already-existing surface map;
// no textures or shader materials are cloned in the frame loop. Keeping these
// profiles in one registry also gives campaign designers a stable visual
// vocabulary when they add rooms or waves.

const freeze = value => Object.freeze(value);

const WARDEN_PROFILES = freeze({
  stalker: freeze({
    key: 'stalker', label: 'Ash Wound', kind: 0,
    tint: 0x8b8178, roughness: .88, metalness: .04,
    emissive: 0x170806, emissiveIntensity: .08, signal: 0xff4936,
  }),
  skitter: freeze({
    key: 'skitter', label: 'Cinder Veins', kind: 0,
    tint: 0x745f61, roughness: .76, metalness: .07,
    emissive: 0x271014, emissiveIntensity: .13, signal: 0xff6a3d,
  }),
  bloodhound: freeze({
    key: 'bloodhound', label: 'Sanguine Hunt', kind: 0,
    tint: 0x9a655d, roughness: .68, metalness: .1,
    emissive: 0x3a0e0a, emissiveIntensity: .16, signal: 0xd62b32,
  }),
  caster: freeze({
    key: 'caster', label: 'Pallid Choir', kind: 1,
    tint: 0xa8a7a1, roughness: .78, metalness: .1,
    emissive: 0x171326, emissiveIntensity: .12, signal: 0xb983ff,
  }),
  hexer: freeze({
    key: 'hexer', label: 'Violet Seal', kind: 1,
    tint: 0x74647f, roughness: .63, metalness: .2,
    emissive: 0x38145c, emissiveIntensity: .2, signal: 0xd38cff,
  }),
  mireSinger: freeze({
    key: 'mireSinger', label: 'Mire Oxide', kind: 1,
    tint: 0x66776a, roughness: .91, metalness: .03,
    emissive: 0x10271a, emissiveIntensity: .1, signal: 0x8acb71,
  }),
  brute: freeze({
    key: 'brute', label: 'Iron Hide', kind: 2,
    tint: 0x76766e, roughness: .59, metalness: .42,
    emissive: 0x2d160f, emissiveIntensity: .14, signal: 0xff8b3f,
  }),
  warden: freeze({
    key: 'warden', label: 'Marrow Brass', kind: 2,
    tint: 0x9b886b, roughness: .47, metalness: .55,
    emissive: 0x3b2414, emissiveIntensity: .18, signal: 0xffc06a,
  }),
});

const BELLWRAITH_PROFILES = freeze({
  bellwraith: freeze({
    key: 'bellwraith', label: 'Mourning Bell', surfaceSeed: 41,
    bell: 0x5a4032, bellEdge: 0xa36d3f, bone: 0xd4c8a8, boneDark: 0x5e4a3b,
    membrane: 0x34131d, chain: 0x84756f, ember: 0xff244d, acid: 0x8fdb58,
  }),
  bellwraithEcho: freeze({
    key: 'bellwraithEcho', label: 'Echo Bell', surfaceSeed: 73,
    bell: 0x3f5261, bellEdge: 0x7696ad, bone: 0xb7c7c7, boneDark: 0x3f5260,
    membrane: 0x152838, chain: 0x668291, ember: 0x6dd7ff, acid: 0x7ce8c0,
  }),
  rustBell: freeze({
    key: 'rustBell', label: 'Rust Bell', surfaceSeed: 107,
    bell: 0x683b2f, bellEdge: 0xc1784b, bone: 0xc8b08b, boneDark: 0x563729,
    membrane: 0x3a1717, chain: 0x9b6344, ember: 0xff6c38, acid: 0xd4b84e,
  }),
  ivoryBell: freeze({
    key: 'ivoryBell', label: 'Ivory Bell', surfaceSeed: 139,
    bell: 0x5d5960, bellEdge: 0xb6b0a8, bone: 0xf0e1bd, boneDark: 0x766b62,
    membrane: 0x271a29, chain: 0xb2a59a, ember: 0xff9c54, acid: 0xc2ef8c,
  }),
});

const profilesByKey = new Map([
  ...Object.entries(WARDEN_PROFILES),
  ...Object.entries(BELLWRAITH_PROFILES),
]);
const fallbackWarden = Object.freeze({ 0: 'stalker', 1: 'caster', 2: 'brute' });
const fallbackBell = ['bellwraith', 'bellwraithEcho', 'rustBell', 'ivoryBell'];

function numericSeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.floor(number * 9973)) : 0;
}

export function resolveWardenVariant(kind = 0, requested = '', seed = 0) {
  const candidate = WARDEN_PROFILES[requested];
  if (candidate && candidate.kind === kind) return candidate;
  const choices = Object.values(WARDEN_PROFILES).filter(profile => profile.kind === kind);
  return choices[numericSeed(seed) % choices.length] || WARDEN_PROFILES[fallbackWarden[kind] || 'stalker'];
}

export function resolveBellwraithVariant(requested = '', seed = 0) {
  if (BELLWRAITH_PROFILES[requested]) return BELLWRAITH_PROFILES[requested];
  return BELLWRAITH_PROFILES[fallbackBell[numericSeed(seed) % fallbackBell.length]];
}

export function getEnemyVariationCatalog() {
  return freeze({
    wardens: Object.values(WARDEN_PROFILES).map(profile => ({ ...profile })),
    bellwraiths: Object.values(BELLWRAITH_PROFILES).map(profile => ({ ...profile })),
  });
}

export function applyWardenVariant(materials, profile) {
  if (!profile) return;
  for (const material of materials || []) {
    if (!material?.color) continue;
    material.color.setHex(profile.tint);
    material.roughness = profile.roughness;
    material.metalness = profile.metalness;
    if (material.emissive) material.emissive.setHex(profile.emissive);
    material.emissiveIntensity = profile.emissiveIntensity;
    material.userData.enemyVariant = profile.key;
    material.userData.baseEmissive = material.emissive?.clone?.() || null;
    material.userData.baseEmissiveIntensity = profile.emissiveIntensity;
  }
}

export function applyBellwraithVariant(materials, profile) {
  if (!profile) return;
  for (const key of ['bell', 'bellEdge', 'bone', 'boneDark', 'membrane', 'chain', 'ember', 'acid']) {
    const material = materials?.[key];
    if (!material?.color || profile[key] == null) continue;
    material.color.setHex(profile[key]);
    material.userData.enemyVariant = profile.key;
  }
}

export function variationProfileCount() {
  return profilesByKey.size;
}

