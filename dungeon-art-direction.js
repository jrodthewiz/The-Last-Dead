// Five authored visual identities for the playable Story descent. Geometry,
// surfaces and practical light cues all read this same inspectable contract.
export const DUNGEON_ART_DIRECTIONS = Object.freeze({
  'f1-intake-foundry': Object.freeze({
    id: 'f1-intake-foundry', family: 'bloodworks', architecture: 'pressure-foundry',
    landmark: 'pulse-crucible', wallRelief: 'pressure-gauges', lightFixture: 'caged-amber',
    phrase: 'A reclamation press still cycling after the crew is gone.',
    background: 0x111411, fog: 0x1c1c17, fogNear: 38, fogFar: 120,
    key: 0xffd5b1, rim: 0xe76b42, accent: 0xc94b3c, accent2: 0xe2a35e,
    wallSurface: 0x9c8377, panelSurface: 0x4f4445, trimSurface: 0x825148,
    floorSurface: 0x423b35, floorAltSurface: 0x35302d,
    stain: 0x48121a, lightRange: 22, authoredLightMultiplier: 1.14,
    dread: 'THE FLOOR IS WARM', relic: 'eye', furniture: 'rack',
  }),
  'f2-graft-galleries': Object.freeze({
    id: 'f2-graft-galleries', family: 'bloodworks', architecture: 'surgical-gallery',
    landmark: 'suspended-theatre', wallRelief: 'observation-slits', lightFixture: 'surgical-bowl',
    phrase: 'A recovery ward converted into a theatre for things that are still moving.',
    background: 0x0d1718, fog: 0x142021, fogNear: 34, fogFar: 112, exposure: 1.32,
    key: 0xc4d8c9, rim: 0x789d91, accent: 0x8db2a4, accent2: 0xb65a55,
    wallSurface: 0xadb9ad, panelSurface: 0x556563, trimSurface: 0x795052,
    floorSurface: 0x394944, floorAltSurface: 0x303d3a,
    stain: 0x3b171a, lightRange: 34, authoredLightMultiplier: 1.4,
    dread: 'THE WARD IS STILL OPEN', relic: 'skull-niche', furniture: 'rack',
  }),
  'f3-catacombs': Object.freeze({
    id: 'f3-catacombs', family: 'ossuary', architecture: 'bone-vault',
    landmark: 'load-bearing-reliquary', wallRelief: 'skull-ossuaries', lightFixture: 'bone-censer',
    phrase: 'Human remains carry the weight of the crypt roof.',
    background: 0x10111c, fog: 0x1b1a28, fogNear: 30, fogFar: 108,
    key: 0xd7cdb4, rim: 0x8f8eb4, accent: 0xa99bc8, accent2: 0xd4b678,
    wallSurface: 0xb8ae99, panelSurface: 0x565667, trimSurface: 0x95836b,
    floorSurface: 0x413e44, floorAltSurface: 0x34333a,
    stain: 0x321b2a, lightRange: 22, authoredLightMultiplier: 1.16,
    dread: 'THE DEAD ARE LOAD-BEARING', relic: 'skull-niche', furniture: 'colonnade',
  }),
  'f4-resonance': Object.freeze({
    id: 'f4-resonance', family: 'choir', architecture: 'resonance-nave',
    landmark: 'mouth-and-bell-organ', wallRelief: 'choir-resonators', lightFixture: 'bell-censer',
    phrase: 'The nave turns every sound into a warning.',
    background: 0x17120f, fog: 0x261b17, fogNear: 28, fogFar: 104,
    key: 0xe4c38d, rim: 0xd37d49, accent: 0xb18b57, accent2: 0xf1c981,
    wallSurface: 0xa4917e, panelSurface: 0x5a423d, trimSurface: 0xad8752,
    floorSurface: 0x423931, floorAltSurface: 0x352e2a,
    stain: 0x48240e, lightRange: 22, authoredLightMultiplier: 1.15,
    dread: 'EVERY BELL IS A MOUTH', relic: 'mouth', furniture: 'bell-frame',
  }),
  'f5-last-descent': Object.freeze({
    id: 'f5-last-descent', family: 'choir', architecture: 'throat-descent',
    landmark: 'black-gullet-altar', wallRelief: 'throat-ribs', lightFixture: 'buried-ember',
    phrase: 'The building has narrowed into one long, hungry chamber.',
    background: 0x100b11, fog: 0x21171b, fogNear: 26, fogFar: 94,
    key: 0xe0c6a5, rim: 0xb9473d, accent: 0x9f4038, accent2: 0xd3bc97,
    wallSurface: 0x897671, panelSurface: 0x3d3035, trimSurface: 0x8b4541,
    floorSurface: 0x342d30, floorAltSurface: 0x292429,
    stain: 0x38141a, lightRange: 19, authoredLightMultiplier: 1.12,
    // The hero cue lights carry the silhouette, while these lower-frequency
    // values keep the playable lane readable without washing out the gullet.
    laneFillColor: 0x5d2b3d, laneFillIntensity: 0.34, laneFillRange: 14,
    guidanceColor: 0xb4513f, guidanceIntensity: 0.38, guidanceRange: 9,
    dread: 'THERE IS NO FLOOR BELOW THIS ONE', relic: 'mouth', furniture: 'bell-frame',
  }),
});

export function dungeonArtDirection(course = {}) {
  if (!course?.dungeon) return null;
  return DUNGEON_ART_DIRECTIONS[String(course.id || '').toLowerCase()] || null;
}
