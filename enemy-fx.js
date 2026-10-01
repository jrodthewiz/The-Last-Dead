import * as THREE from './vendor/three.module.js';

// Procedural enemy layer that sits on top of the authored clips: it turns the
// body by the AI's own facing, adds head-look, spine lean, gait sway, dormant
// slump and the spawn-in (rise / drop / crawl / emerge) and hit-flinch motion.
//
// Usage per enemy per frame:
//   enemyFxBegin(root)            // undo last frame's additive offsets
//   ...animate*(root, enemy, ...) // authored clips / mixers write the pose
//   enemyFxEnd(root, enemy, run, now)

const BONES = { head: ['head'], neck: ['neck'], spine: ['spine2','spine02','spine'], spine1: ['spine1','spine01'], hips: ['hips'], leftShoulder:['leftshoulder'], rightShoulder:['rightshoulder'] };
const q1 = new THREE.Quaternion(), e1 = new THREE.Euler();
const worldQuaternion=new THREE.Quaternion(),yawAxis=new THREE.Vector3();
const ease = t => t * t * (3 - 2 * t);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

function state(root) {
  let fx = root.userData.enemyFx;
  if (fx) return fx;
  fx = { bones: {}, applied: [], baseScale: root.scale.clone(), lastPos: null, speed: 0, lean: 0, sway: 0, flinch: 0, lastHits: 0, lastT: null, look: 0, travelYaw: 0 };
  const wanted = new Map(Object.entries(BONES).flatMap(([k, values]) => values.map(v=>[v,k])));
  root.traverse(o => {
    if (!o.isBone) return;
    const key = wanted.get(o.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (key && (!fx.bones[key]||o.name.toLowerCase()==='spine2')) fx.bones[key] = o;
  });
  root.userData.enemyFx = fx;
  return fx;
}

export function enemyFxBegin(root) {
  const fx = root.userData.enemyFx;
  if (!fx) return;
  root.scale.copy(fx.baseScale);
  if (!fx.applied.length) return;
  for (let i=fx.applied.length-1;i>=0;i--){const {bone,q}=fx.applied[i];bone.quaternion.multiply(q1.copy(q).invert()).normalize();}
  fx.applied.length = 0;
}

function offset(fx, key, x = 0, y = 0, z = 0) {
  const bone = fx.bones[key];
  if (!bone || (!x && !y && !z)) return;
  const entry=fx.offsetPool?.[fx.applied.length]||{bone:null,q:new THREE.Quaternion()};
  fx.offsetPool ||= [];fx.offsetPool[fx.applied.length]=entry;entry.bone=bone;
  const q = entry.q.setFromEuler(e1.set(x, y, z, 'XYZ'));
  bone.quaternion.multiply(q);
  fx.applied.push(entry);
}

function worldYawOffset(fx,key,angle){
  const bone=fx.bones[key];if(!bone||!angle)return;
  // The imported pelvis's local Y points down; the spine's points up.
  // Convert the world's vertical into each current bone frame so pelvis and
  // chest counter-rotation agree instead of doubling an inverted-axis turn.
  bone.getWorldQuaternion(worldQuaternion).normalize();
  yawAxis.set(0,1,0).applyQuaternion(worldQuaternion.invert()).normalize();
  const entry=fx.offsetPool?.[fx.applied.length]||{bone:null,q:new THREE.Quaternion()};
  fx.offsetPool ||= [];fx.offsetPool[fx.applied.length]=entry;entry.bone=bone;
  entry.q.setFromAxisAngle(yawAxis,angle);bone.quaternion.multiply(entry.q).normalize();fx.applied.push(entry);
}

export function spawnProgress(enemy, run) {
  const total = enemy.emergeTotal || 0;
  if (!total || enemy.spawnAnim === 'none' || enemy.spawnedAt === undefined) return 1;
  return Math.min(1, Math.max(0, (run.time - enemy.spawnedAt) / total));
}

export function enemyFxEnd(root, enemy, run, now, scale = 1) {
  const fx = state(root);
  const dt = fx.lastT === null ? 0 : Math.min(.05, Math.max(0, (now - fx.lastT) / 1000));
  fx.lastT = now;
  if (enemy.dead) { fx.speed = 0; return; }
  // Measured planar speed drives lean and sway independent of the clip choice.
  if (fx.lastPos && dt > 0) {
    const dx=root.position.x-fx.lastPos.x,dz=root.position.z-fx.lastPos.z,d = Math.hypot(dx,dz);
    const v = d < .8 && !(enemy.stagger>0) ? d / dt : 0;
    fx.speed += (v - fx.speed) * (1 - Math.exp(-8 * dt));
    let yaw=d>.001&&d<.8?wrap(Math.atan2(-dx,-dz)-root.rotation.y):0;
    if(Math.abs(yaw)>Math.PI/2)yaw=wrap(yaw+Math.PI);
    fx.travelYaw+=(Math.max(-.55,Math.min(.55,yaw))-fx.travelYaw)*(1-Math.exp(-10*dt));
  }
  fx.lastPos = fx.lastPos || new THREE.Vector3();
  fx.lastPos.copy(root.position);
  const moving = Math.min(1, fx.speed / 2.2);
  const state_ = enemy.state || 'stalk';
  const seed = (enemy.id || 0) * 1.7;
  const t = now * .001;
  // Captured attack/hit clips own contact poses. Upper-body variation applies
  // only to locomotion, so reaching hands never shift on the damage frame.
  const captured=!!root.userData.afterlife?.capturedAttack;
  const actor=root.userData.afterlife;
  const shotWeight=captured?Math.max(actor?.attackAction?.getEffectiveWeight()||0,actor?.hitAction?.getEffectiveWeight()||0):0;
  const grapple=['windup','held','terminal'].includes(enemy.bitePhase);
  const acting=grapple?0:1-Math.min(1,shotWeight);
  const identity=Math.sin(seed*2.399),stiff=(enemy.id||0)%3===0;

  // Head-look: AI supplies a smoothed relative yaw. Neck takes a share.
  const look = enemy.look || 0;
  fx.look += (look - fx.look) * (1 - Math.exp(-10 * dt));
  offset(fx, 'head', 0, fx.look * .65*acting, identity*.035*acting);
  offset(fx, 'neck', 0, fx.look * .35*acting, 0);

  // Postural lean: forward with speed, back when recoiling, hunched while dormant.
  const windup = enemy.attacking ? 1 - Math.min(1, (enemy.windup || 0) / Math.max(.05, enemy.windupTime || .4)) : 0;
  let lean = moving * .16 + (state_ === 'stalk' || state_ === 'flank' ? .05 : 0) - windup * .22 + ((enemy.strike || 0) > 0 ? .3 : 0);
  if (state_ === 'dormant') lean = .32 + Math.sin(t * .8 + seed) * .02;
  if (state_ === 'investigate') lean += .08;
  fx.lean += (lean - fx.lean) * (1 - Math.exp(-7 * dt));
  offset(fx, 'spine', (fx.lean * .32+(stiff?.035:0))*acting, 0, identity*.025*acting);
  offset(fx, 'spine1', fx.lean * .18*acting, 0, 0);
  offset(fx, 'leftShoulder', 0, identity*.045*acting, (stiff?.065:-.035)*acting);
  offset(fx, 'rightShoulder', 0, -identity*.045*acting, (stiff?-.02:.05)*acting);
  if (state_ === 'dormant') offset(fx, 'head', .3*acting, 0, 0);

  // Seeded breath and short listening/tension beats keep stationary states
  // inhabited. The envelope starts/ends at zero, never resets an authored
  // clip, and yields gradually to combat rather than snapping off at its edge.
  const breath=.7*Math.sin(t*1.73+seed)+.3*Math.sin(t*.91+seed*2.399);
  const period=5.2+(identity+1)*.9,age=(t+seed*.37)%period;
  const fidget=age<1.45?Math.sin(Math.PI*age/1.45)**2:0;
  const quiet=(1-moving*.7)*acting;
  const search=state_==='investigate'?Math.sin(t*1.2+seed)*.12:0;
  offset(fx,'spine',breath*.012*quiet,identity*fidget*.035*quiet,breath*.008*quiet);
  offset(fx,'head',breath*.014*quiet+fidget*.035*quiet,(search+identity*fidget*.085)*quiet,identity*fidget*.022*quiet);
  offset(fx,'leftShoulder',fidget*.026*quiet,0,breath*.013*quiet);
  offset(fx,'rightShoulder',-fidget*.017*quiet,0,-breath*.009*quiet);

  // The forward/backward gait supplies steps; a small pelvis swivel makes
  // diagonal footwork readable while the chest keeps tracking the player.
  const travelTwist=fx.travelYaw*moving*acting;
  worldYawOffset(fx,'hips',travelTwist);
  worldYawOffset(fx,'spine',-travelTwist*.7);
  worldYawOffset(fx,'neck',-travelTwist*.3);

  // Footstep-synced sway: side-to-side weight shift at the gait rate.
  const gait = root.userData.afterlife?.gaitPhase ?? ((t * 1.6 + seed) % 1);
  const sway = Math.sin(gait * Math.PI * 4) * .035 * moving*acting;
  // Preserve the captured foot plants: variation stays above the hips.
  if(!captured)offset(fx, 'hips', 0, 0, sway * .8);
  offset(fx, 'spine', 0, sway * .7, -sway * .6);

  // Hit flinch: brief backward whip of the upper body when the hit count changes.
  const hits = enemy.hits || 0;
  if (hits > fx.lastHits) fx.flinch = 1;
  fx.lastHits = hits;
  fx.flinch = Math.max(0, fx.flinch - dt * 4.5);
  if (fx.flinch > 0 && !captured) {
    const f = fx.flinch * fx.flinch;
    offset(fx, 'spine', -.34 * f, (enemy.id % 2 ? 1 : -1) * .16 * f, 0);
    offset(fx, 'head', -.25 * f, 0, (enemy.id % 2 ? 1 : -1) * .12 * f);
  }

  // Spawn-in animations layered on the root and spine.
  const p = spawnProgress(enemy, run);
  if (p < 1) {
    const anim = enemy.spawnAnim;
    const k = ease(p);
    if (anim === 'rise') {
      // Claws up out of the floor: starts buried and folded, unfolds upright.
      root.position.y -= (1 - k) * 1.9 * scale;
      offset(fx, 'spine', (1 - k) * -.6 - Math.sin(p * 18) * .04 * (1 - p), 0, 0);
      offset(fx, 'head', (1 - k) * -.5, 0, 0);
    } else if (anim === 'drop') {
      const fall = Math.min(1, p / .55);
      root.position.y += (1 - fall * fall) * 3.4 * scale;
      if (p > .55) {
        const land = Math.sin(((p - .55) / .45) * Math.PI);   // landing squash, then recover
        root.scale.y *= 1 - land * .16; root.scale.x *= 1 + land * .07; root.scale.z *= 1 + land * .07;
        offset(fx, 'spine', land * .45, 0, 0);
      } else offset(fx, 'spine', -.25, 0, 0);
    } else if (anim === 'crawl') {
      root.position.y -= (1 - k) * .55 * scale;
      offset(fx, 'spine', (1 - k) * 1.0, 0, 0);
      offset(fx, 'spine1', (1 - k) * .5, 0, 0);
      offset(fx, 'head', (1 - k) * -.7, 0, 0);
      offset(fx, 'hips', 0, 0, Math.sin(p * 26) * .1 * (1 - k));
    } else if (anim === 'emerge') {
      // Steps out of the doorway: shoulders forward, slow recovering head.
      offset(fx, 'spine', (1 - k) * .3, 0, 0);
      offset(fx, 'head', (1 - k) * .4, Math.sin(p * 9) * .25 * (1 - p), 0);
    }
  }
}
