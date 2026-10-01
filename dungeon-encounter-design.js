// Pure Story encounter policy. Authored rooms own population, enemy identity,
// cadence and recovery; legacy wave numbers continue to own gate compatibility.
import { ENEMY_PROFILES } from './campaign.js';

const THEMES = [
  { id: 'foundry', spacing: .56, lead: .65, rest: 1.1, arrival: 'Receiving guards', fallback: ['stalker', 'skitter', 'caster'] },
  { id: 'surgical', spacing: .62, lead: .8, rest: 1.4, arrival: 'Isolation breach', fallback: ['skitter', 'caster', 'hexer'] },
  { id: 'crypt', spacing: .7, lead: .85, rest: 1.65, arrival: 'Burial sentries', fallback: ['bloodhound', 'hexer', 'skitter'] },
  { id: 'choir', spacing: .64, lead: .9, rest: 1.45, arrival: 'Service door ambush', fallback: ['bellwraithEcho', 'mireSinger', 'skitter'] },
  { id: 'finale', spacing: .48, lead: .6, rest: .8, arrival: 'Descent guards', fallback: ['warden', 'bellwraith', 'bloodhound'] },
];
const floorIndex = course => Math.max(0, Math.min(4, Math.floor(Number(course?.dungeonIndex ?? course?.index) || 0)));
const themeFor = course => THEMES[floorIndex(course)];
const beatFor = room => room?.identity?.beat || room?.flow?.beat || (room?.kind === 'entry' ? 'arrival' : 'ambush');
const integer = value => Math.max(0, Math.floor(Number(value) || 0));

function orderedVariants(course, room, cycle, count) {
  const counts = Object.fromEntries([...new Set(cycle)].map(variant => [variant, 0]));
  for (let index = 0; index < count; index++) counts[cycle[index % cycle.length]]++;
  const keys = Object.keys(counts).filter(variant => counts[variant] > 0), reserved = {}, cursors = {};
  const role = variant => {
    const value = ENEMY_PROFILES[variant]?.role;
    return value === 'anchor' ? 'anchor' : ['ranged', 'teleport'].includes(value) ? 'ranged' : 'fast';
  };
  const reserve = (variant, amount) => {
    const held = Math.min(amount, counts[variant]);
    if (!held) return;
    counts[variant] -= held;
    reserved[variant] = (reserved[variant] || 0) + held;
  };
  const takeMixed = (amount, finish = null) => {
    if (finish) counts[finish]--;
    const result = [], groups = ['fast', 'ranged', 'anchor'];
    for (let index = 0; index < amount - Number(Boolean(finish)); index++) {
      for (let offset = 0; offset < groups.length; offset++) {
        const group = groups[(index + offset) % groups.length], choices = keys.filter(variant => role(variant) === group);
        if (!choices.length) continue;
        const cursor = cursors[group] || 0;
        let chosen = -1;
        for (let step = 0; step < choices.length; step++) {
          const at = (cursor + step) % choices.length;
          if (counts[choices[at]] > 0) { chosen = at; break; }
        }
        if (chosen < 0) continue;
        const variant = choices[chosen];
        counts[variant]--;cursors[group] = (chosen + 1) % choices.length;
        result.push(variant);break;
      }
    }
    if (finish) result.push(finish);
    return result;
  };
  const stages = encounterStages(course, room, count, Boolean(room?.flow?.optional));
  const lateGuard = ['holdout', 'finale', 'key-retrieval'].includes(beatFor(room));
  let finish = null;
  if (stages.length > 1) {
    const lastSize = stages.at(-1).count;
    if (lateGuard) {
      const strongest = keys.filter(variant => role(variant) === 'anchor')
        .sort((a, b) => ENEMY_PROFILES[b].cost - ENEMY_PROFILES[a].cost)[0]
        || (beatFor(room) === 'key-retrieval' ? [...keys].sort((a, b) => (ENEMY_PROFILES[b]?.cost || 1) - (ENEMY_PROFILES[a]?.cost || 1))[0] : null);
      if (strongest) {
        reserve(strongest, role(strongest) === 'anchor' ? Math.max(1, lastSize - 2) : 1);
        finish = strongest;
      }
    }
    // Retain a role contrast for the final approach where the exact authored
    // population supports it. A sole ranged enemy stays in the opening reveal.
    for (const group of ['fast', 'ranged']) {
      const held = Object.values(reserved).reduce((sum, value) => sum + value, 0);
      const choices = keys.filter(variant => role(variant) === group && counts[variant] > 0);
      if (held < lastSize && choices.reduce((sum, variant) => sum + counts[variant], 0) >= 2) reserve(choices[0], 1);
    }
  }
  const result = [];
  for (let stage = 0; stage < stages.length; stage++) {
    if (stage === stages.length - 1) {
      for (const [variant, amount] of Object.entries(reserved)) counts[variant] += amount;
    }
    result.push(...takeMixed(stages[stage].count, stage === stages.length - 1 ? finish : null));
  }
  return result;
}

export function encounterRoster(course, room, markers = []) {
  const count = integer(room?.encounter?.budget);
  if (!count || !markers.length) return [];
  const composition = Object.entries(room.encounter?.composition || {})
    .flatMap(([variant, weight]) => Array.from({ length: integer(weight) }, () => variant));
  const variants = orderedVariants(course, room, composition.length ? composition : themeFor(course).fallback, count);
  return Array.from({ length: count }, (_, index) => ({
    ...markers[index % markers.length],
    variant: variants[index],
    seeded: false,
  }));
}

export function encounterAliveCap(course, room) {
  // The engine still applies its global 12-enemy safety bound. A floor index
  // must never turn a small authored fight into a crowded room.
  return Math.min(10, Math.max(1, integer(room?.encounter?.maxAlive) || 4));
}

function stageRecipe(course, room, optional) {
  const theme = themeFor(course), beat = beatFor(room);
  if (room?.kind === 'entry' || beat === 'arrival') return { labels: [theme.arrival], shares: [1] };
  if (beat === 'holdout') return { labels: ['Establish cover', 'Flank pressure', 'Break the holdout'], shares: [.25, .35, .4] };
  if (beat === 'finale') return { labels: ['Last chamber guards', 'Choir surge', 'The last stand'], shares: [.25, .35, .4] };
  if (beat === 'crossfire') return { labels: ['Read the crossing', 'Counter approach'], shares: [.45, .55] };
  if (beat === 'pressure-lane') return { labels: ['Lane contact', 'Pressure surge'], shares: [.4, .6] };
  if (beat === 'key-retrieval') return { labels: ['Vault sentries', 'Key guard'], shares: [.6, .4] };
  if (optional && integer(room?.encounter?.budget) >= 9) return { labels: ['Cache defenders', 'Secure the cache'], shares: [.6, .4] };
  const label = {
    'close-quarters': 'Close contact', pursuit: 'Pursuit line', flank: 'Flank pressure',
    'last-push': 'Chancel guards', resupply: 'Equipment defenders', 'defended-supply': 'Equipment defenders',
  }[beat] || 'Room sentries';
  return { labels: [label], shares: [1] };
}

export function encounterStages(course, room, queueLength, optional = false) {
  const total = integer(queueLength);
  if (!total) return [];
  const theme = themeFor(course), beat = beatFor(room), recipe = stageRecipe(course, room, optional);
  const labels = recipe.labels.slice(0, total), shares = recipe.shares.slice(0, labels.length);
  const weight = shares.reduce((sum, value) => sum + value, 0);
  // Each live stage receives at least one enemy; the last receives rounding
  // remainder so even very small custom rooms conserve their exact population.
  let remaining = total;
  return labels.map((label, index) => {
    const slotsLeft = labels.length - index - 1;
    const count = slotsLeft ? Math.max(1, Math.min(remaining - slotsLeft, Math.floor(total * shares[index] / weight))) : remaining;
    remaining -= count;
    const surge = index > 0 && ['pressure-lane', 'finale'].includes(beat);
    return {
      label, count,
      // Rest follows this stage, before the next stage's warning/commitment.
      rest: slotsLeft ? theme.rest * (beat === 'finale' ? .5 : beat === 'key-retrieval' ? 1.25 : 1) : 0,
      spacing: theme.spacing * (surge ? .88 : 1),
      lead: theme.lead,
      minAge: beat === 'finale' ? 2.8 : beat === 'crossfire' ? 3.2 : 3.6,
    };
  });
}

export function encounterRelief(course, room, health = 100) {
  const beat = beatFor(room);
  const seconds = {
    arrival: 4, 'close-quarters': 2.2, pursuit: 1.8, flank: 2,
    crossfire: 3, 'pressure-lane': 2.5, 'key-retrieval': 4.5,
    holdout: 6, 'last-push': 2.5, finale: 7, resupply: 5, 'defended-supply': 5,
  }[beat] ?? 3;
  return seconds + (health < 35 ? 3 : 0);
}

export function roomRecoveryPolicy(course, room) {
  const hasCombat = integer(room?.encounter?.budget) > 0;
  const hasEquipment = (course?.loot || []).some(item => item.roomId === room?.id);
  const hasSupply = ['recovery', 'supply'].includes(room?.flow?.role)
    || (room?.flow?.optional && room?.kind !== 'exit' && room?.kind !== 'entry') || hasEquipment;
  const secrets = {
    'f1-nook': { health: 40, energy: 35, label: 'medical cache' },
    'f2-drawer': { health: 20, energy: 65, label: 'energy reserve' },
    'f3-tomb': { health: 50, energy: 25, label: 'medical reserve' },
    'f4-niche': { health: 40, energy: 50, label: 'medical and energy cache' },
    'f5-cache': { health: 40, energy: 100, label: 'full energy reserve' },
  };
  const reward = secrets[room?.id] || { health: room?.kind === 'secret' ? 40 : 25, energy: 35, label: 'recovery cache' };
  return { hasSupply: Boolean(hasSupply), isSafeRoom: Boolean(hasSupply && !hasCombat),
    safeAfterClear: Boolean(hasSupply && hasCombat), ...reward };
}
