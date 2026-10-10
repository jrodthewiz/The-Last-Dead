// Enemy mind: perception, a readable state machine, wall-aware navigation,
// spawn placement and a tension/release pacing director.
//
// Everything here is renderer-free and deterministic (seeded from enemy ids) so
// host and guest stay bit-identical. engine.js owns the world and hands in an
// `env` of its own primitives ({castRay, canStand, angleDiff, clamp}), which
// avoids an import cycle. Enemies without `e.mind` keep the legacy chase code.
//
// States:  dormant -> wander -> notice/investigate -> stalk <-> flank -> (attack) ->
//          recover -> stalk;  stagger interrupts anything;  emerge gates spawns.

import {propSegmentClear} from './harbor-collision.js';
import {setupZombie,noteSighting,hordeFrame,hearHorde,hordeSteering,gaitSpeed,interceptGoal,motionIntent,sensedLocation} from './zombie-behavior.js';
export const TAU = Math.PI * 2;
export function advanceEnemyAICursor(run,count){
 const start=(run.enemyAICursor||0)%Math.max(1,count);
 run.enemyAICursor=count?(start+4)%count:0;
 return start;
}
export function enemyNavigationFrame(run,count){
 const limited=!!run.course.coastal&&count>=48;
 if(!limited)return{start:advanceEnemyAICursor(run,count),budget:4};
 const window=Math.floor((run.time+1e-9)*10),enemies=run.course.enemies;
 const used=enemies.reduce((n,e)=>n+(e.mind?.navBudgetWindow===window?e.mind.navBudgetSearches||0:0),0);
 return{start:(run.enemyAICursor||0)%Math.max(1,count),budget:Math.max(0,4-used),window,
  noteSearch(e){
   e.mind.navBudgetSearches=e.mind.navBudgetWindow===window?(e.mind.navBudgetSearches||0)+1:1;e.mind.navBudgetWindow=window;
   const index=enemies.indexOf(e);if(index>=0)run.enemyAICursor=(index+1)%count;
  }};
}
export const ingressMoveSpeed = speed => Math.max(Number(speed)||.3,.6)*1.1;
export const hash01 = (a, b = 0) => {
  let h = (Math.imul((a | 0) + 1, 374761393) ^ Math.imul((b | 0) + 7, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export const AI_STATES = Object.freeze(['dormant', 'wander', 'notice', 'investigate', 'stalk', 'flank', 'attack', 'recover', 'stagger', 'emerge']);
const HUNTING = new Set(['stalk', 'flank', 'attack', 'recover']);
export const isHunting = e => !!e.mind && HUNTING.has(e.mind.state);

// Loudness of player actions: radius in cells and how convincing it is (0..1).
export const NOISE = Object.freeze({
  'low-tide-bell': {radius:40,loud:1.4},
  shot: { radius: 15, loud: 1 }, explosion: { radius: 24, loud: 1 }, rocket: { radius: 18, loud: 1 },
  'rocket-detonate': { radius: 24, loud: 1 }, 'bat-swing': { radius: 7, loud: .5 }, punch: { radius: 6, loud: .45 },
  'melee-hit': { radius: 10, loud: .8 }, 'chainsaw-hit': { radius: 15, loud: 1 }, 'melee-wall': { radius: 8, loud: .55 },
  slam: { radius: 11, loud: .7 }, land: { radius: 5, loud: .35 }, dash: { radius: 7, loud: .4 }, jump: { radius: 4, loud: .2 },
  slide: { radius: 6, loud: .35 }, parry: { radius: 9, loud: .6 }, hook: { radius: 8, loud: .5 },
});

// Per-role tuning (distances in cells). Variants override below.
const ROLE = {
  rush: { sight: 9, fov: 2.3, turn: 7, recover: .75, ring: [1.1, 1.8], meleeTokens: 1, creep: 1 },
  hunter: { sight: 12, fov: 2.6, turn: 7.5, recover: .9, ring: [1.3, 2.1], meleeTokens: 1, flank: 1 },
  ranged: { sight: 13, fov: 2.2, turn: 5, recover: 1.1, band: [1.7, 3.4], rangedTokens: 1 },
  anchor: { sight: 10, fov: 2, turn: 3.6, recover: 1.4, ring: [.4, .9], meleeTokens: 1, stagger: .35 },
  teleport: { sight: 13, fov: 2.6, turn: 6, recover: 1, band: [1.8, 3.6], rangedTokens: 1 },
};
const VARIANT = {
  skitter: { turn: 10, sight: 10, erratic: 1, ring: [.9, 1.5], recover: .55 },
  stalker: { creep: 1 },
  bloodhound: { sight: 14, flank: 1, hearing: 1.35 },
};
export function tuningFor(e, profile) {
  return { ...(ROLE[profile?.role] || ROLE.rush), ...(VARIANT[e.variant] || {}) };
}

export function visionAllows(e,target,profile){
 const tune=e.aiTune||tuningFor(e,profile),state=e.mind?.state,hunting=HUNTING.has(state);
 const d=Math.hypot(target.x-e.x,target.y-e.y),angle=Math.atan2(target.y-e.y,target.x-e.x);
 const range=hunting?tune.sight*1.6:state==='dormant'?tune.sight*.4:tune.sight;
 return d<range&&(d<.9||Math.abs(wrap(angle-(e.facing??angle)-(e.look||0)*.65))<tune.fov*(hunting?.68:.5));
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------------------------------------------------------------- nav -- */

export function clearLine(env, course, x0, y0, x1, y1, radius = .17) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < .001) return true;
  const steps = Math.ceil(d / .12);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!env.canStand(course, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius)) return false;
  }
  return true;
}

// 4-connected BFS over the wall grid, then string-pulled with clearLine so paths
// hug corners instead of zig-zagging through cell centres. Returns a list of
// waypoints ending at the goal, or null when the goal is sealed off (closed door).
export function findPath(env, course, from, to, maxNodes = 1400) {
  const w = course.w, h = course.h;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  let gx = Math.floor(to.x), gy = Math.floor(to.y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  gx = clampN(gx, 0, w - 1); gy = clampN(gy, 0, h - 1);
  const start = sy * w + sx, goal = gy * w + gx;
  if (start === goal) return [{ x: to.x, y: to.y }];
  const prev = new Map([[start, -1]]);
  const queue = [start];
  const dirs = [[1, 0, 1], [-1, 0, 3], [0, 1, 2], [0, -1, 0]];
  for (let i = 0; i < queue.length && i < maxNodes; i++) {
    const cell = queue[i];
    if (cell === goal) break;
    const x = cell % w, y = (cell - x) / w;
    for (const [dx, dy, side] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (prev.has(n) || course.cells[cell][side] || course.cells[n].every(v => v === 1)) continue;
      if(!propSegmentClear(course,cell===start?from.x:x+.5,cell===start?from.y:y+.5,nx+.5,ny+.5))continue;
      prev.set(n, cell);
      queue.push(n);
    }
  }
  if (!prev.has(goal)) return null;
  const cells = [];
  for (let c = goal; c !== -1 && c !== undefined; c = prev.get(c)) cells.push(c);
  cells.reverse();
  const pts = cells.slice(1).map(c => ({ x: c % w + .5, y: Math.floor(c / w) + .5 }));
  if (pts.length) pts[pts.length - 1] = { x: to.x, y: to.y };
  // String pulling.
  const out = [];
  let cur = { x: from.x, y: from.y }, i = 0;
  while (i < pts.length) {
    let far = i;
    for (let j = pts.length - 1; j > i; j--) {
      if (clearLine(env, course, cur.x, cur.y, pts[j].x, pts[j].y, .19)) { far = j; break; }
    }
    out.push(pts[far]);
    cur = pts[far];
    i = far + 1;
  }
  return out;
}

// Move at most speed*dt toward a point, trying small heading deflections so an
// enemy slides off corners instead of pinning; never leaves canStand space.
function moveToward(env, course, e, tx, ty, speed, dt, sepX = 0, sepY = 0) {
  const heading = Math.atan2(ty - e.y, tx - e.x);
  const step = Math.min(speed * dt, Math.hypot(tx - e.x, ty - e.y));
  if (step <= 1e-6) return 0;
  const vx0 = Math.cos(heading) + sepX, vy0 = Math.sin(heading) + sepY;
  const base = Math.atan2(vy0, vx0);
  for (const off of [0, .45, -.45, .9, -.9]) {
    const a = base + off, mx = Math.cos(a) * step, my = Math.sin(a) * step;
    if (env.canStand(course, e.x + mx, e.y + my, .16)) { e.x += mx; e.y += my; return step; }
  }
  const mx = Math.cos(base) * step, my = Math.sin(base) * step;
  let moved = 0;
  if (env.canStand(course, e.x + mx, e.y, .16)) { e.x += mx; moved += Math.abs(mx); }
  if (env.canStand(course, e.x, e.y + my, .16)) { e.y += my; moved += Math.abs(my); }
  return moved;
}

function navigate(ctx, e, goal, speed) {
  const { env, course, dt } = ctx;
  // The shared structure authority supplies the next stair tread. Perception,
  // search clocks and gait continue through the ordinary mind update.
  goal=env.routeGoal?.(course,e,goal)||goal;
  const fromX = e.x, fromY = e.y;
  const nav = e.nav;
  const dGoal = Math.hypot(goal.x - e.x, goal.y - e.y);
  let wp = goal;
  if (dGoal > .25 && !clearLine(env, course, e.x, e.y, goal.x, goal.y, .17)) {
    nav.repath -= dt;
    const goalMoved = !nav.goal || Math.hypot(nav.goal.x - goal.x, nav.goal.y - goal.y) > 1.4;
    if ((nav.path ? nav.repath <= 0 : !nav.failed || nav.repath <= 0) || goalMoved) {
      if (ctx.navBudget > 0) {
        ctx.navBudget--;
        ctx.navSearches=(ctx.navSearches||0)+1;
        ctx.noteNavSearch?.(e);
        nav.path = findPath(env, course, e, goal);
        nav.goal = { x: goal.x, y: goal.y };
        nav.repath = .55 + hash01(e.id, 31) * .45;
        nav.failed = !nav.path;
      }
    }
    if (!nav.path || !nav.path.length) return { moved: 0, blocked: !!nav.failed };
    while (nav.path.length > 1 && (Math.hypot(nav.path[0].x - e.x, nav.path[0].y - e.y) < .28 ||
      clearLine(env, course, e.x, e.y, nav.path[1].x, nav.path[1].y, .17))) nav.path.shift();
    wp = nav.path[0];
  } else nav.path = null;
  const separation = hordeSteering(ctx,e);
  const moved = moveToward(env, course, e, wp.x, wp.y, speed, dt, separation.x, separation.y);
  // Stuck watchdog: intent to move but no progress for ~.8s -> force repath and sidestep.
  nav.stuckT = (nav.stuckT || 0) + dt;
  nav.stuckD = (nav.stuckD || 0) + moved;
  if (nav.stuckT >= .8) {
    if (nav.stuckD < speed * nav.stuckT * .25 && dGoal > .4) {
      nav.repath = 0; nav.path = null; nav.sidestep = .45; nav.sideDir = hash01(e.id, Math.floor(ctx.time * 3)) < .5 ? 1 : -1;
    }
    nav.stuckT = 0; nav.stuckD = 0;
  }
  if (nav.sidestep > 0) {
    nav.sidestep -= dt;
    const a = Math.atan2(goal.y - e.y, goal.x - e.x) + nav.sideDir * 1.4;
    moveToward(env, course, e, e.x + Math.cos(a), e.y + Math.sin(a), speed * .8, dt);
  }
  const travelX = e.x - fromX, travelY = e.y - fromY;
  return { moved: Math.hypot(travelX, travelY), blocked: false, heading: Math.atan2(travelY, travelX) };
}

/* ------------------------------------------------------------- creation -- */

export function createMind(e, opts = {}) {
  const state = opts.state || 'stalk';
  Object.defineProperty(e, 'nav', { value: { path: null, goal: null, repath: 0, stuckT: 0, stuckD: 0, sidestep: 0, sideDir: 1 }, writable: true, enumerable: false, configurable: true });
  e.mind = {
    state, t: 0, aware: state === 'stalk' ? 1 : (opts.aware || 0), lostFor: 0,
    home: { x: opts.home?.x ?? e.x, y: opts.home?.y ?? e.y },
    lastKnown: null, noise: null, dest: null, pause: hash01(e.id, 1) * 2, search: 0,
    searchTempo: 1.2 + hash01(e.id, 10) * .8, searchPhase: hash01(e.id, 11) * TAU, searchFacing: 0,
    wakeAt: -1, emerge: opts.emerge || 0, token: false, engageT: 0, firstAttack: opts.firstAttack ?? .7,
    justAttacked: false, recover: 0, graceT: 0, flankT: 0, flankSide: hash01(e.id, 2) < .5 ? 1 : -1,
    orbitDir: hash01(e.id, 3) < .5 ? 1 : -1, orbitBeat: -1, wanderT: 0, startle: 0, glance: 0, relentless: opts.relentless ?? state === 'stalk',
    sighting:null, observation:null, socialPending:null, wakeKnown:null,
    notice:null, recognitionUntil:0, senses:{visible:false,heardPower:0,heardType:null,occluded:false},
  };
  e.state = e.mind.emerge > 0 ? 'emerge' : state;
  e.aware = e.mind.aware;
  e.facing = opts.facing ?? hash01(e.id, 4) * TAU;
  e.look = 0;
  e.lookPitch = 0; e.noticeStrength = 0;
  e.spawnAnim = opts.spawnAnim || 'none';
  e.emerge = e.mind.emerge;
  e.emergeTotal = e.mind.emerge;
  setupZombie(e,hash01);
  return e.mind;
}

export function wakeEnemy(e, at, delay = 0) {
  if (!e.mind || e.dead) return;
  e.mind.relentless = true;
  if (delay > 0) {e.mind.wakeAt = e.mind.t + delay;e.mind.wakeKnown=at?sensedLocation(at):null;}
  else { e.mind.aware = 1; if (at) e.mind.lastKnown = sensedLocation(at); }
}

// Called from damageEnemy: being shot alerts, and heavy hits stagger unless the
// enemy is in a post-stagger grace window (no stun-lock).
export function reactToHit(e, damage, source) {
  if (!e.mind || e.dead) return;
  const m = e.mind;
  m.aware = 1;
  if (source) m.lastKnown = sensedLocation(source);
  if (m.state === 'dormant' || m.state === 'wander' || m.state === 'notice' || m.state === 'investigate') { m.state = 'stalk'; m.notice=null; m.t = 0; m.startle = .35; }
  const tune = e.aiTune;
  const resist = tune?.stagger ?? 1;
  if (m.graceT > 0 || m.emerge > 0) return;
  const stun = clampN((.1 + damage * .05) * resist, 0, .5);
  if (stun >= .13) {
    e.stagger = Math.max(e.stagger || 0, stun);
    m.graceT = stun + .7;
    e.hitDir = source ? Math.atan2(e.y - source.y, e.x - source.x) : undefined;
  }
}

/* --------------------------------------------------------------- noise -- */

// Collect new player noises since the last call. `r.events` is appended by the
// engine and cleared by the host each frame, so keep a cursor.
export function collectNoises(r) {
  const out = [];
  for (const p of [r, r.peer]) {
    if (!p || p.health <= 0) continue;
    const ev=p.events||[];let cur=p._noiseCursor||0;
    // Clearing and refilling the same array can retain its old length, notably
    // for guest events. The last consumed object makes that reset observable.
    if(cur>ev.length||cur>0&&p._noiseLastEvent!==ev[cur-1])cur=0;
    for(let i=cur;i<ev.length;i++){
      const event=ev[i],spec=NOISE[event.type];if(!spec)continue;
      const x=Number.isFinite(event.x)?event.x:p.x,y=Number.isFinite(event.y)?event.y:p.y;
      const location=Math.hypot(x-p.x,y-p.y)<.5?sensedLocation(p):{x,y};
      out.push({...location,x,y,radius:spec.radius,loud:spec.loud,type:event.type});
    }
    p._noiseCursor=ev.length;p._noiseLastEvent=ev.at(-1)||null;
    const sp = p.speed || 0;
    const now=Number(r.time)||0;
    if(sp>.7&&(p.z||0)<.08&&now>=(p._nextHearingStep??-Infinity)){
      const running=sp>1.9;
      out.push({...sensedLocation(p),radius:running?4.2:1.8,loud:running?.3:.14,type:'steps'});
      p._nextHearingStep=now+(running?.32:.52);
    }
  }
  return out;
}

/* -------------------------------------------------------- perception -- */

export function seenByPlayers(env, course, players, x, y, { fov = 1.15, range = 30, near = 3 } = {}) {
  for (const p of players) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < near) return true;
    if (d > range) continue;
    if (Math.abs(wrap(Math.atan2(dy, dx) - p.angle)) > fov) continue;
    if (env.castRay(course, p.x, p.y, Math.atan2(dy, dx), d + .2).dist > d - .1) return true;
  }
  return false;
}

function perceive(ctx, e, target, d, ang, visible) {
  const m = e.mind, tune = e.aiTune, dt = ctx.dt;
  const hunting = HUNTING.has(m.state);
  const dormant = m.state === 'dormant';
  let sensed = Number.isFinite(m.socialReceiptAt)&&ctx.time-m.socialReceiptAt<.25;
  m.senses ||= {visible:false,heardPower:0,heardType:null,occluded:false};
  Object.assign(m.senses,{visible,heardPower:0,heardType:null,occluded:false});
  if (visible) {
    const range = hunting ? tune.sight * 1.6 : dormant ? tune.sight * .4 : tune.sight;
    const noisy = clampN(.7 + Math.hypot(target.vx || 0, target.vy || 0) * .3, .6, 1.5);
    const gain = ((1 - d / range) * 2.4 + .3) * noisy * (dormant ? .5 : 1);
    m.aware = Math.min(1.2, m.aware + gain * dt);
    m.lastKnown = sensedLocation(target);
    const confirmed=hunting||ctx.time<(m.recognitionUntil||0)||d<=2.4&&m.aware>=1;
    noteSighting(ctx,e,target,confirmed);
    if(hunting)m.recognitionUntil=ctx.time+8;
    m.lostFor = 0;
    sensed = true;
  } else if (hunting||m.state==='notice') m.lostFor += dt;
  let heard=null,heardPower=.08,heardOccluded=false;
  for (const n of ctx.noises) {
    const dd = Math.hypot(n.x - e.x, n.y - e.y);
    const los = ctx.env.sensorLine?ctx.env.sensorLine(ctx.course,e,n):ctx.env.castRay(ctx.course, e.x, e.y, Math.atan2(n.y - e.y, n.x - e.x)).dist > dd - .2;
    const eff = n.radius * (los ? 1 : .55) * (dormant ? .6 : 1) * (tune.hearing || 1);
    if (dd >= eff) continue;
    const power = (1 - dd / eff) * n.loud;
    // Pick the strongest audible source, independent of event insertion order.
    if(power>heardPower || (power===heardPower&&heard&&(n.x<heard.x||n.x===heard.x&&n.y<heard.y))) {
      heard=n;heardPower=power;heardOccluded=!los;
    }
  }
  if(heard) {
    const n=heard,power=heardPower;
    Object.assign(m.senses,{heardPower:power,heardType:n.type||'noise',occluded:heardOccluded});
    // Hearing is evidence of a location, never confirmation of a visible
    // player. Strong sounds wake a purposeful search; sight keeps priority.
    if (!visible) {
      m.aware = Math.max(m.aware, .3 + Math.min(.6,power*.6));
      // A new sound elsewhere interrupts listening at the old destination.
      // Repeated sounds at the same point must not restart the search clock.
      if (m.state === 'investigate' && m.search > 0 &&
          Math.hypot(n.x - (m.noise?.x ?? e.x), n.y - (m.noise?.y ?? e.y)) > .75) {
        m.search = 0; m.t = 0; e.nav.path = null; e.nav.repath = 0;
      }
      m.noise = { ...sensedLocation(n), t: 0, power, type:n.type||'noise', occluded:heardOccluded };
    }else if(power>.55){m.aware=Math.max(m.aware,1);}
    if(!visible&&power>.55&&m.state==='notice'){
      m.notice=null;enter(e,'investigate');
    }
    sensed = true;
  }
  if (!sensed) m.aware = Math.max(0, m.aware - (hunting ? .05 : .28) * dt);
  return sensed;
}

/* -------------------------------------------------------------- states -- */

function enter(e, state) {
  const m = e.mind;
  if (m.state === state) return;
  m.state = state; m.t = 0;
  if (state !== 'investigate') m.search = 0;
  if (state !== 'notice') m.notice = null;
  e.state = state;
}

export function turnFacing(e, desired, rate, dt) {
  const diff = wrap(desired - e.facing);
  const step = rate * dt;
  e.facing = wrap(e.facing + clampN(diff, -step, step));
}

function pickWanderDest(ctx, e) {
  const m = e.mind;
  for (let i = 0; i < 6; i++) {
    const a = hash01(e.id, Math.floor(m.t * 10) + i * 17) * TAU, r = e.roamRadius ? e.roamRadius*(.35+hash01(e.id,i+50)*.65) : 1 + hash01(e.id, i + 50) * 2.2;
    const p = { x: m.home.x + Math.cos(a) * r, y: m.home.y + Math.sin(a) * r };
    if ((!e.roamBounds||p.x>=e.roamBounds.minX&&p.x<=e.roamBounds.maxX&&p.y>=e.roamBounds.minY&&p.y<=e.roamBounds.maxY) && ctx.env.canStand(ctx.course, p.x, p.y, .2) && Math.floor(p.x) >= 0 &&
      clearLine(ctx.env, ctx.course, e.x, e.y, p.x, p.y, .18)) return p;
  }
  return null;
}

// One AI step. Returns whether a combat swing/throw is currently allowed.
export function stepMind(ctx, e, target) {
  const m = e.mind, profile = ctx.profile;
  if (!e.aiTune) Object.defineProperty(e, 'aiTune', { value: tuningFor(e, profile), writable: true, enumerable: false, configurable: true });
  const tune = e.aiTune;
  const dt = ctx.dt, course = ctx.course, env = ctx.env;
  hordeFrame(ctx);
  if(!m.gait)setupZombie(e,hash01);
  const fromX = e.x, fromY = e.y;
  e.moving = 0;
  m.t += dt; m.graceT = Math.max(0, m.graceT - dt); m.startle = Math.max(0, m.startle - dt);
  const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  // Even an alerted hunter has eyes facing one direction. Its head expands
  // that cone; a point-blank encounter remains a physical proximity cue.
  const visible = e.seesTarget === true && visionAllows(e,target,profile);
  const baseSpeed = e.moveSpeed || profile.speed || .3;
  const result = { attackOK: false };

  // A reinforcement physically enters along its authored ingress lane. It
  // arrives upright and walks through the actual portal before hunting; its
  // facing follows the route tangent, never a random room-centre heading.
  if (e.ingressRoute?.length) {
    while(e.ingressRoute.length&&Math.hypot(e.ingressRoute[0].x-e.x,e.ingressRoute[0].y-e.y)<.24)e.ingressRoute.shift();
    if(e.ingressRoute.length){
      // All roles walk purposefully into the fight. A slow ranged or anchor
      // combat gait must not turn the warned doorway approach into a 20 s wait.
      const ingressSpeed=ingressMoveSpeed(baseSpeed);
      const waypoint=e.ingressRoute[0],motion=navigate(ctx,e,waypoint,ingressSpeed);
      if(motion.moved>1e-5)turnFacing(e,motion.heading,tune.turn,dt);
      e.state='stalk';e.moving=motion.moved>1e-5?clampN(motion.moved/Math.max(dt,.0001)/Math.max(baseSpeed,.2),0,2):0;
      motionIntent(e,ctx);
      e.ingressProgress=(e.ingressTotal-e.ingressRoute.length)/Math.max(1,e.ingressTotal);
      // A player pushing directly into the lane can still be fought. Do not
      // make the ingress pose an invulnerable or passive shooting gallery.
      if(d>.8||!visible)return result;
      e.ingressRoute.length=0;
    }
    e.ingressProgress=1;m.aware=1;if(visible){m.lastKnown=sensedLocation(target);noteSighting(ctx,e,target);}m.state='stalk';
  }

  // Spawn-in: fully committed, no perception; face the player as it finishes.
  if (m.emerge > 0) {
    m.emerge = Math.max(0, m.emerge - dt); e.emerge = m.emerge;
    e.state = 'emerge';
    if (m.emerge < .35 && visible) turnFacing(e, ang, tune.turn * .6, dt);
    if (m.emerge === 0) { m.state = m.aware >= 1 ? 'stalk' : m.state; m.t = 0; e.state = m.state; }
    return result;
  }

  // Delayed wake (room cascade / pack alert).
  if (m.wakeAt >= 0 && m.t >= m.wakeAt) { m.wakeAt = -1; m.aware = Math.max(m.aware, 1); m.lastKnown ||= m.wakeKnown; m.wakeKnown=null; m.startle = .4; if (!HUNTING.has(m.state)) { enter(e, 'stalk'); m.engageT = 0; } }

  const wasHunting = HUNTING.has(m.state);
  hearHorde(ctx,e,hash01);
  perceive(ctx, e, target, d, ang, visible);

  // Attack bookkeeping from the engine's windup/strike flags.
  if (m.justAttacked) {
    m.justAttacked = false;
    m.recover = tune.recover * (.85 + hash01(e.id, Math.floor(m.t)) * .35);
    enter(e, 'recover');
  }
  if (e.attacking || e.strike > 0) { e.state = 'attack'; }

  // Escalation / de-escalation.
  const recentRecognition=ctx.time<(m.recognitionUntil||0)||m.sighting?.hops>0&&ctx.time-m.sighting.time<3.5;
  const distantNotice=visible&&d>2.8&&!recentRecognition&&m.senses.heardPower<=.55;
  if(!visible&&m.senses.heardPower>.55&&HUNTING.has(m.state)&&!e.attacking&&!(e.strike>0)){
    m.token=false;enter(e,'investigate');e.nav.path=null;e.nav.repath=0;
  }
  if(!HUNTING.has(m.state)&&m.state!=='notice'&&distantNotice&&m.aware>=.14){
    enter(e,'notice');m.dest=null;m.noise=null;m.token=false;
    m.notice={duration:(e.locomotion==='runner'?.48:e.locomotion==='crawler'?1.0:1.15)+hash01(e.id,93)*.55};
  }
  const noticeReady=m.state!=='notice'||visible&&(d<=2.8||m.senses.heardPower>.55||m.t>=(m.notice?.duration??1.15));
  if (!HUNTING.has(m.state) && m.aware >= 1 && noticeReady && (visible||!m.noise||recentRecognition)) {
    enter(e, 'stalk'); m.startle = .4; m.engageT = 0;
    m.recognitionUntil=ctx.time+8;if(m.sighting)m.sighting.confirmed=true;
  } else if(m.state==='notice'&&!visible&&m.lostFor>.6){
    m.noise=m.lastKnown?{...m.lastKnown,t:0,power:.25,type:'lost-sight'}:null;
    enter(e,m.noise?'investigate':'wander');
  } else if (m.state === 'dormant' && m.aware >= .3) {
    enter(e, m.noise ? 'investigate' : 'wander'); m.startle = .4;
  } else if ((m.state === 'wander'||m.state==='notice') && !visible && m.aware >= .3 && m.noise) {
    enter(e, 'investigate');
  }
  // Even committed spawns hunt a remembered observation; losing sight never
  // refreshes it from the player's hidden current position.
  if(HUNTING.has(m.state)&&m.state!=='recover'&&!visible&&!m.lastKnown&&!e.attacking&&!(e.strike>0)){m.token=false;enter(e,'wander');}
  if (HUNTING.has(m.state) && m.lostFor > 6.5 && m.aware < 1) {
    m.lostFor = 0; m.token = false;
    m.noise = m.lastKnown ? { ...m.lastKnown, t: 0 } : null;
    enter(e, 'investigate');
  }
  const hunting = HUNTING.has(m.state);
  if (hunting && !wasHunting) m.firstAttack = Math.max(m.firstAttack, .55);
  m.firstAttack = Math.max(0, m.firstAttack - dt);

  const rememberedAngle = visible ? ang : m.lastKnown ? Math.atan2(m.lastKnown.y-e.y,m.lastKnown.x-e.x) : e.facing;
  const gait=gaitSpeed(ctx,e,visible,d,hash01);
  let moved = 0, heading = null, lookGoal = rememberedAngle;
  const fixedFace = e.attacking || e.strike > 0;

  switch (m.state) {
    case 'dormant': {
      // Slumped and still; a slow, involuntary head drift keeps it uncanny.
      lookGoal = null;
      break;
    }
    case 'wander': {
      m.pause -= dt;
      if (m.pause <= 0 && !m.dest) { m.dest = pickWanderDest(ctx, e) || null; m.wanderT = 0; }
      if (!m.dest && m.pause <= 0) m.pause = 1.5 + hash01(e.id, Math.floor(m.t)) * 2;
      if (m.dest) {
        m.wanderT = (m.wanderT || 0) + dt;
        const res = navigate(ctx, e, m.dest, baseSpeed * .34 * gait);
        moved = res.moved; heading = res.heading;
        if (Math.hypot(m.dest.x - e.x, m.dest.y - e.y) < .3 || res.blocked || m.wanderT > 30) { m.dest = null; m.pause = 1.6 + hash01(e.id, Math.floor(m.t * 3)) * 3.4; }
      }
      lookGoal = null;
      break;
    }
    case 'notice': {
      // Head recognition precedes the slow body turn. No path, burst or attack
      // token is acquired during this distant, unsettling stillness.
      lookGoal=rememberedAngle;
      if(m.t>.28)heading=rememberedAngle;
      break;
    }
    case 'investigate': {
      const goal = m.noise || m.lastKnown;
      if (!goal) { enter(e, 'wander'); break; }
      if (m.search > 0) {
        m.search -= dt;
        // Each infected stops to listen between slow body sweeps. Its head
        // checks the room faster; the cadence stays reproducible for co-op.
        const phase = m.t * m.searchTempo + m.searchPhase;
        heading = phase % 1.8 < .3 ? e.facing : m.searchFacing + Math.sin(phase) * .65;
        lookGoal = null;
        if (m.search <= 0) { m.noise = null;m.lastKnown=null;m.observation=null;m.aware=Math.min(m.aware,.25); enter(e, 'wander'); m.dest = null; m.pause = .8; }
        break;
      }
      const res = navigate(ctx, e, goal, baseSpeed * ((goal.power||0)>.55?.88:.62) * gait);
      moved = res.moved; heading = res.heading;
      if (Math.hypot(goal.x - e.x, goal.y - e.y) < .5&&!env.routeGoal?.(course,e,goal) || res.blocked || m.t > 12) { m.search = 2.2 + hash01(e.id, 9) * 1.4; m.searchFacing = e.facing; m.t = 0; }
      lookGoal = null;
      break;
    }
    case 'recover': {
      m.recover -= dt;
      // Contact still belongs to the committed swipe. Starting the retreat
      // here used to drag its planted feet and pull the damage arc backwards.
      if (e.attacking || e.strike > 0) break;
      if (m.token && !(e.strike > 0)) m.token = false;
      // Back off a touch and re-read the player; ranged types keep spacing.
      const away = rememberedAngle + Math.PI + m.orbitDir * .9;
      moved = moveToward(env, course, e, e.x + Math.cos(away), e.y + Math.sin(away), baseSpeed * (tune.band ? .5 : .38), dt);
      heading = away;
      if (m.recover <= 0) { enter(e, 'stalk'); m.engageT = 0; }
      break;
    }
    case 'stalk':
    case 'flank':
    case 'attack': {
      result.attackOK = false;
      if (e.attacking || e.strike > 0) { m.token = true; break; }
      const goalPos = visible ? interceptGoal(ctx,e,target,clearLine) : m.lastKnown;
      if(!goalPos)break;
      const melee = !tune.band;
      const seenByTarget = Math.abs(wrap(Math.atan2(e.y - target.y, e.x - target.x) - (target.angle ?? 0))) < .55;
      let speed = baseSpeed * (visible ? 1.15 : 1.0) * gait;
      if (tune.creep && visible && seenByTarget && d > 2.4) speed *= .6;   // creeps while watched
      else if (tune.creep && visible && !seenByTarget) speed *= 1.15;       // surges when unobserved
      if (m.startle > 0) speed *= .2;
      if(env.routeGoal?.(course,e,goalPos)){
        const res=navigate(ctx,e,goalPos,speed);moved=res.moved;heading=res.heading;
        if(m.token){m.token=false;if(melee)ctx.tokens.melee=Math.max(0,ctx.tokens.melee-1);else ctx.tokens.ranged=Math.max(0,ctx.tokens.ranged-1);}
        break;
      }
      // Token economy: only a couple of enemies commit to melee at once.
      const grabbedByOther=(target.bite?.phase==='held'||target.bite?.phase==='windup')&&target.bite.enemyId!==e.id;
      if(grabbedByOther&&melee&&m.token){m.token=false;ctx.tokens.melee=Math.max(0,ctx.tokens.melee-1);}
      if (!grabbedByOther && !m.token && melee && visible && ctx.tokens.melee < ctx.tokens.maxMelee && m.firstAttack <= 0 && d < 3.4 + m.engageT) {
        m.token = true; ctx.tokens.melee++;
      }
      if (!m.token && !melee && visible && ctx.tokens.ranged < ctx.tokens.maxRanged && m.firstAttack <= 0 && d < 11) {
        m.token = true; ctx.tokens.ranged++;
      }
      m.engageT += dt * .35;
      if (melee) {
        const reach = ctx.reach;
        if (m.token && visible) {
          // Close in and swing.
          const stand = profile.role === 'anchor' ? .95 : (tune.erratic ? .2 : .25);
          if (d > stand) {
            const wobble = tune.erratic ? Math.sin(m.t * 6 + e.id) * .5 : 0;
            const slotA = ang + wobble + (hash01(e.id, 8) - .5) * 1.3;
            const intercept = d>1.8 ? goalPos : target;
            const gx = intercept.x - Math.cos(slotA) * stand, gy = intercept.y - Math.sin(slotA) * stand;
            const res = navigate(ctx, e, { x: gx, y: gy }, speed);
            moved = res.moved; heading = res.heading;
          }
          result.attackOK = d < reach * .98 && m.firstAttack <= 0 && m.startle <= 0;
        } else if (visible && d > 1.2) {
          // Flank or hold a ring and circle until a token frees up.
          const flanker = tune.flank && d > 2.2 && m.token === false;
          if (flanker || m.state === 'flank') {
            if (m.state !== 'flank') { enter(e, 'flank'); m.flankT = 0; }
            m.flankT += dt;
            const back = Math.atan2(e.y - target.y, e.x - target.x) + m.flankSide * 1.25;
            const R = clampN(d, 1.6, 3.2);
            let fp = { x: target.x + Math.cos(back) * R, y: target.y + Math.sin(back) * R };
            // A flank is a local approach, not permission to pursue a point
            // inside a wall or take a long detour through another room. Try
            // the other shoulder, then keep closing through the open lane.
            if (!env.canStand(course, fp.x, fp.y, .18) || !clearLine(env, course, e.x, e.y, fp.x, fp.y, .18)) {
              const alternate = back - m.flankSide * 2.5;
              fp = { x: target.x + Math.cos(alternate) * R, y: target.y + Math.sin(alternate) * R };
              if (!env.canStand(course, fp.x, fp.y, .18) || !clearLine(env, course, e.x, e.y, fp.x, fp.y, .18)) fp = goalPos;
            }
            const res = navigate(ctx, e, fp, speed * 1.05);
            moved = res.moved; heading = res.heading;
            if (res.blocked || m.flankT > 3.8 || Math.hypot(fp.x - e.x, fp.y - e.y) < .5) { enter(e, 'stalk'); m.flankSide = -m.flankSide; }
          } else {
            const ring = tune.ring || [1.1, 1.8];
            const want = ring[0] + (ring[1] - ring[0]) * (.5 + .5 * Math.sin(m.t * .7 + e.id));
            const tang = Math.atan2(e.y - target.y, e.x - target.x) + m.orbitDir * 1.5708;
            const orbit = clampN((d - want) * 1.4, -1, 1);
            // ang points toward the player: positive radial error must close
            // distance. The old minus sign drove waiting attackers away.
            const tx = e.x + Math.cos(tang) * .5 + Math.cos(ang) * orbit * .8, ty = e.y + Math.sin(tang) * .5 + Math.sin(ang) * orbit * .8;
            moved = moveToward(env, course, e, tx, ty, speed * .7, dt);
            heading = Math.atan2(ty - e.y, tx - e.x);
          }
        } else if (!visible) {
          const res = navigate(ctx, e, goalPos, speed);
          moved = res.moved; heading = res.heading;
          if (res.blocked && m.t > 3) m.lostFor += dt * 2;
        } else { // very close but no token: hover and step aside
          const tang = ang + m.orbitDir * 1.5708;
          moved = moveToward(env, course, e, e.x + Math.cos(tang), e.y + Math.sin(tang), speed * .5, dt);
          heading = tang;
        }
      } else {
        // Ranged: hold a firing band, back off if pressed, strafe otherwise.
        const [lo, hi] = tune.band;
        if (!visible) {
          const res = navigate(ctx, e, goalPos, speed);
          moved = res.moved; heading = res.heading;
        } else if (d < lo) {
          const away = ang + Math.PI + m.orbitDir * .5;
          moved = moveToward(env, course, e, e.x + Math.cos(away), e.y + Math.sin(away), baseSpeed * 1.25, dt);
          heading = away;
        } else if (d > hi) {
          const res = navigate(ctx, e, target, speed);
          moved = res.moved; heading = res.heading;
        } else {
          const tang = ang + m.orbitDir * 1.5708;
          moved = moveToward(env, course, e, e.x + Math.cos(tang), e.y + Math.sin(tang), baseSpeed * .45, dt);
          heading = tang;
          const beat = Math.floor(m.t / 2.2);
          if (m.orbitBeat !== beat) { m.orbitBeat = beat; if (hash01(e.id, beat) < .3) m.orbitDir = -m.orbitDir; }
        }
        result.attackOK = m.token && visible && d >= lo * .6 && d < 12 && m.firstAttack <= 0 && m.startle <= 0;
      }
      break;
    }
    default: break;
  }
  if (m.token && !HUNTING.has(m.state)) m.token = false;
  // Never share a footprint: any idle or crowded enemy is nudged off neighbours.
  if (!e.attacking && !(e.strike > 0)) {
    for (const o of ctx.alive) {
      if (o === e || o.dead) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
      if (od < .3) {
        const a = od > 1e-4 ? Math.atan2(oy, ox) : e.id * 2.4;
        moveToward(env, course, e, e.x + Math.cos(a), e.y + Math.sin(a), (.3 - od) * 3 + .05, dt);
      }
    }
  }

  // Net travel includes wall slides and crowd separation; intent alone could
  // turn a blocked actor into the wall or leave a moving actor in idle.
  moved = Math.hypot(e.x - fromX, e.y - fromY);
  if (moved > 1e-5) heading = Math.atan2(e.y - fromY, e.x - fromX);
  // Ranged strafes and close melee footwork keep aim. A distant approach or
  // flank turns the body into its actual lane while the head watches the target.
  if (!fixedFace) {
    let desired = e.facing;
    const aimAtTarget = tune.band || m.state === 'recover' || d <= Math.max(1.6,ctx.reach*1.2);
    if (lookGoal !== null && hunting && visible && aimAtTarget) desired = lookGoal;
    else if (heading !== null && moved > 1e-5) desired = heading;
    else if (lookGoal !== null && hunting) desired = m.lastKnown ? Math.atan2(m.lastKnown.y - e.y, m.lastKnown.x - e.x) : lookGoal;
    else if (m.startle > 0) desired = rememberedAngle;
    else if (heading !== null && (m.state === 'investigate'||m.state==='notice')) desired = heading;
    if (!(m.state === 'dormant')) turnFacing(e, desired, m.state==='notice'?1.0:(m.startle > 0 ? tune.turn * 1.6 : tune.turn), dt);
  }
  // Head-look: relative glance toward the player when aware, idle drift otherwise.
  let lookTarget;
  if (hunting || m.state==='notice' || m.startle > 0) lookTarget = clampN(wrap(rememberedAngle - e.facing), -1.1, 1.1);
  else if (m.state === 'investigate' && m.search > 0) lookTarget = Math.sin(m.t * m.searchTempo * 2.1 + m.searchPhase) * .65;
  else if (visible && m.aware > .3 && d < tune.sight) lookTarget = clampN(wrap(ang - e.facing), -.9, .9) * m.aware;
  else lookTarget = Math.sin(ctx.time * .7 + e.id * 1.7) * .35 * (m.state === 'dormant' ? .4 : 1);
  e.look += (lookTarget - e.look) * (1 - Math.exp(-6 * dt));
  if(visible){
    const floor=actor=>env.groundHeight?.(course,actor)??(actor.supportZ||actor.groundZ||0);
    e.lookPitch=Math.atan2(floor(target)+(target.z||0)+.32-floor(e)-(e.z||0)-(e.locomotion==='crawler'?.17:.38),Math.max(.3,d));
  }
  else e.lookPitch=(e.lookPitch||0)*Math.exp(-dt*2);
  const noticeTarget=m.state==='notice'?clampN(m.t/.5,0,1):0;
  e.noticeStrength+=(noticeTarget-(e.noticeStrength||0))*(1-Math.exp(-dt*5));
  e.aware = m.aware;
  if (!(e.attacking || e.strike > 0)) e.state = m.state;
  e.moving = moved > 1e-5 ? clampN(moved / Math.max(1e-4, dt) / Math.max(.2, baseSpeed), 0, 2.2) : 0;
  motionIntent(e,ctx);
  return result;
}

/* ------------------------------------------------------ spawn choosing -- */

// Adapter over the map data. Reads authored anchors when the map exposes them
// (room.spawnAnchors / course.spawnAnchors[roomId], each {x,y,kind?,facing?})
// and otherwise derives door anchors, authored points and floor cells.
export function getSpawnAnchors(course, roomId, progression) {
  const room = (course.rooms || []).find(r => r.id === roomId);
  const out = [];
  const add = (p, kind) => { if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push({ x: p.x, y: p.y, kind: p.kind || kind, facing: p.facing, roomId }); };
  for (const p of room?.spawnAnchors || []) add(p, 'anchor');
  for (const p of course.spawnAnchors?.[roomId] || []) add(p, 'anchor');
  for (const p of room?.spawnPoints || []) add(p, 'anchor');
  const c = room?.center;
  for (const o of course.openings || []) {
    if (o.roomId !== roomId && o.room !== roomId) continue;
    if (course.openingState && course.openingState[o.id] === false) continue;
    const a = o.anchor; if (!a) continue;
    const len = c ? Math.hypot(c.x - a.x, c.y - a.y) || 1 : 1;
    const inward = c ? { x: (c.x - a.x) / len, y: (c.y - a.y) / len } : { x: 0, y: 0 };
    add({ x: a.x + inward.x * 1.1, y: a.y + inward.y * 1.1, facing: Math.atan2(inward.y, inward.x) }, 'door');
  }
  for (const p of progression?.roomSpawnCells?.[roomId] || []) add(p, 'floor');
  return out;
}

// Staging points belong to a specific authored ingress. No arbitrary room
// floor fallback: every returned point carries the same actual door crossing.
export function getIngressCandidates(env, course, roomId) {
  const groups=course.ingressGroups?.[roomId]||[],out=[];
  const room=(course.rooms||[]).find(room=>room.id===roomId);
  const inRoom=p=>!!room&&p.x>=room.bounds.minX&&p.x<room.bounds.maxX&&p.y>=room.bounds.minZ&&p.y<room.bounds.maxZ
    &&(!room.footprint||String(room.footprint[Math.floor(p.y)-room.bounds.minZ]?.[Math.floor(p.x)-room.bounds.minX])==='1');
  for(const group of groups){
    if(course.openingState?.[group.openingId]===false)continue;
    if(!group.origin||!group.arrival||!group.route?.length)continue;
    const path=[group.origin,...group.route].filter((p,i,a)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)
      &&(!i||Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>.01));
    if(path.length<2||!path.every(p=>env.canStand(course,p.x,p.y,.16)))continue;
    if(path.some((p,i)=>i&&!clearLine(env,course,path[i-1].x,path[i-1].y,p.x,p.y,.16)))continue;
    for(let i=0;i<Math.min(3,path.length-1);i++){
      const origin=path[i];if(inRoom(origin)||Math.hypot(origin.x-group.portal.x,origin.y-group.portal.y)<.01)break;
      const route=path.slice(i+1).map(p=>({x:p.x,y:p.y}));
      const first=route[0];
      out.push({x:origin.x,y:origin.y,kind:'ingress',facing:Math.atan2(first.y-origin.y,first.x-origin.x),
        roomId,ingressId:group.id,openingId:group.openingId,ingressLabel:group.label||'Service entrance',
        portal:group.portal,arrival:group.arrival,ingressSide:group.side||null,route});
    }
    // A watched straight corridor must not force pop-in. Nearby side staging
    // can feed the same lane: a bounded, outside-room BFS joins the authored
    // origin before following its exact doorway crossing. These are branches
    // of one entrance, never unrelated room-wide respawn cells.
    const origin=path[0],nodes=[{x:origin.x,y:origin.y,parent:-1,depth:0}],visited=new Set([`${origin.x},${origin.y}`]);
    for(let index=0;index<nodes.length;index++){
      const node=nodes[index];if(node.depth>=3)continue;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const point={x:node.x+dx,y:node.y+dy},key=`${point.x},${point.y}`;
        if(visited.has(key)||inRoom(point)||!env.canStand(course,point.x,point.y,.16)
          ||!clearLine(env,course,node.x,node.y,point.x,point.y,.16))continue;
        visited.add(key);const next={...point,parent:index,depth:node.depth+1};nodes.push(next);
        if(path.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<.01))continue;
        const branch=[];for(let cursor=index;cursor>=0;cursor=nodes[cursor].parent)branch.push({x:nodes[cursor].x,y:nodes[cursor].y});
        const route=[...branch,...path.slice(1).map(p=>({x:p.x,y:p.y}))],first=route[0];
        out.push({...point,kind:'ingress',facing:Math.atan2(first.y-point.y,first.x-point.x),roomId,
          ingressId:group.id,openingId:group.openingId,ingressLabel:group.label||'Service entrance',
          portal:group.portal,arrival:group.arrival,ingressSide:group.side||null,route});
      }
    }
  }
  return out;
}

export function isIngressRouteOpen(env,course,point){
  if(!point?.ingressId||course.openingState?.[point.openingId]===false||!point.route?.length)return false;
  let previous=point;
  for(const next of point.route){
    if(!env.canStand(course,next.x,next.y,.16)||!clearLine(env,course,previous.x,previous.y,next.x,next.y,.16))return false;
    previous=next;
  }
  return true;
}

const spawnReachCache = new WeakMap();
function spawnReach(course, players) {
  const key = players.map(p => `${Math.floor(p.x)},${Math.floor(p.y)}`).join('|');
  const cached = spawnReachCache.get(course);
  if (cached?.cells === course.cells && cached.key === key) return cached.reach;
  const reach = new Set(), queue = [];
  for (const p of players) {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= course.w || y >= course.h) continue;
    const id = y * course.w + x;
    if (!reach.has(id)) { reach.add(id); queue.push(id); }
  }
  const directions = [[0,-1,0],[1,0,1],[0,1,2],[-1,0,3]];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i], x = id % course.w, y = Math.floor(id / course.w);
    for (const [dx,dy,side] of directions) {
      const nx = x + dx, ny = y + dy, next = ny * course.w + nx;
      if (nx < 0 || ny < 0 || nx >= course.w || ny >= course.h || reach.has(next)
        || course.cells[id][side] || course.cells[next].every(v => v === 1)) continue;
      reach.add(next); queue.push(next);
    }
  }
  spawnReachCache.set(course, { cells: course.cells, key, reach });
  return reach;
}

// Waiting may bring an offscreen entrance closer, never waive visibility or
// connectivity. Rechecked when committing, including the co-op partner's view.
export function pickSpawnPoint(env, course, players, enemies, candidates, opts = {}) {
  const { minDist = 5, relax = 0, behind = true, seed = 0, reservations = null, ignoreReservation = null,
    ingressSpeed = 0, arrivalTarget = 6 } = opts;
  if (!players.length) return null;
  const reach = spawnReach(course, players);
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!env.canStand(course, c.x, c.y, .16)) continue;
    if (!reach.has(Math.floor(c.y) * course.w + Math.floor(c.x))) continue;
    if (enemies.some(o => !o.dead && Math.hypot(o.x - c.x, o.y - c.y) < .7)) continue;
    // A warned reinforcement owns its staging pad until commitment or
    // cancellation. Do not promise two arrivals on the same occupied pad.
    if (reservations?.some(o => o !== ignoreReservation && Math.hypot(o.x - c.x, o.y - c.y) < .7)) continue;
    let pd = Infinity, behindness = 0;
    for (const p of players) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      pd = Math.min(pd, d);
      behindness = Math.max(behindness, Math.abs(wrap(Math.atan2(c.y - p.y, c.x - p.x) - p.angle)) / Math.PI);
    }
    const need = relax >= 4 ? Math.min(minDist, 3.5) : minDist;
    if (pd < need) continue;
    const seen = seenByPlayers(env, course, players, c.x, c.y, { fov: 1.4, range: 45, near: 2.65 });
    if (seen) continue;
    let score = -Math.abs(pd - 7) * .25 + (behind ? behindness * 2 : 0) + hash01(seed, i) * .6;
    if(ingressSpeed>0&&c.route?.length){
      let length=0,previous=c;
      for(const point of c.route){length+=Math.hypot(point.x-previous.x,point.y-previous.y);previous=point;}
      // Rank only candidates that already passed every live safety check.
      // Walking ETA matters more than arbitrary distance from the player.
      score=-Math.abs(length/ingressSpeed-arrivalTarget)*.5-Math.abs(pd-7)*.05+hash01(seed,i)*.2;
    }
    if (c.kind === 'door') score += 3;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/* -------------------------------------------------------------- pacing -- */

// Tension/release director. Pure: feed it observations each tick, get back
// whether an ambush is allowed right now.
export function createPacing() {
  return { tension: 0, phase: 'calm', phaseTime: 0, calm: 0, cooldown: 12, ambushes: 0, peaked: false, lastHealth: null, hurt: 0 };
}

export function updatePacing(p, obs, dt) {
  // obs: {hunting, near, health, encounterActive, cleared, maxAmbushes, hostile}
  if (p.lastHealth !== null && obs.health < p.lastHealth) p.hurt = Math.min(1, p.hurt + (p.lastHealth - obs.health) / 40);
  p.lastHealth = obs.health;
  p.hurt = Math.max(0, p.hurt - dt * .12);
  const target = clampN(obs.hunting * .18 + obs.near * .22 + p.hurt * .6 + (obs.encounterActive ? .25 : 0), 0, 1);
  p.tension += (target - p.tension) * (1 - Math.exp(-(target > p.tension ? 1.2 : .35) * dt));
  p.phaseTime += dt;
  const prev = p.phase;
  if (p.tension > .62) p.phase = 'peak';
  else if (p.phase === 'peak' && p.tension < .3) { p.phase = 'release'; }
  else if (p.phase === 'release' && p.phaseTime > 5 && p.tension < .2) p.phase = 'calm';
  else if (p.phase === 'calm' && p.tension > .2) p.phase = 'build';
  else if (p.phase === 'build' && p.tension < .1 && p.phaseTime > 6) p.phase = 'calm';
  if (p.phase !== prev) p.phaseTime = 0;
  p.calm = p.tension < .12 && !obs.encounterActive ? p.calm + dt : 0;
  p.cooldown = Math.max(0, p.cooldown - dt);
  const relief = obs.health < 35 ? 9 : 4.5;
  const ok = obs.cleared >= 1 && p.phase === 'calm' && p.calm >= relief && p.cooldown <= 0 &&
    p.ambushes < obs.maxAmbushes && obs.hostile < 3 && !obs.encounterActive && !obs.recoveryRoom;
  return { ambush: ok };
}

export function noteAmbush(p, cooldown = 15) {
  p.ambushes++; p.cooldown = cooldown; p.calm = 0; p.phase = 'build'; p.phaseTime = 0; p.tension = Math.max(p.tension, .3);
}

// Ambient wanderers per room kind; encounter rooms get residents from their nodes.
export function residentIndexes(count, roomOrder) {
  if (count < 1 || roomOrder === 0) return [];
  if (count === 1) return [0];
  const out = [];
  for (let i = 1; i < count; i += 2) out.push(i);
  return out;
}

// Which spawn animation to use for a point kind / variant.
export function spawnAnimFor(variant, kind, seen) {
  if (kind === 'resident') return 'none';
  if (kind === 'door') return 'emerge';
  if (variant === 'skitter') return seen ? 'rise' : 'crawl';
  if (variant === 'bloodhound') return 'drop';
  if (variant === 'brute' || variant === 'warden') return 'emerge';
  return 'rise';
}
export const EMERGE_TIME = Object.freeze({ none: 0, emerge: 1.1, rise: 1.5, crawl: 1.0, drop: .9 });
