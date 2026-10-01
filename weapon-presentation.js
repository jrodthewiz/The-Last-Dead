// Local, visual-only first-person handling. Gameplay owns aim, cadence and
// hit detection; this driver owns the gun/arms transform under the camera.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const follow = (value, target, response, dt) => target + (value - target) * Math.exp(-response * dt);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth = t => t * t * (3 - 2 * t);

// Travel is in the shared viewmodel frame, angles are radians, time seconds.
export const WEAPON_HANDLING = Object.freeze([
  { name: 'ossuary', kick: .088, pitch: .145, roll: -.022, recovery: 13, frequency: 13, mass: .8, equip: .36, cant: -.20 },
  { name: 'breach', kick: .145, pitch: .19, roll: .040, recovery: 9, frequency: 10, mass: 1.3, equip: .49, cant: .26 },
  { name: 'arc', kick: .070, pitch: .082, roll: -.014, recovery: 12, frequency: 11, mass: 1.15, equip: .45, cant: -.17 },
  { name: 'reliquary', kick: .125, pitch: .135, roll: .032, recovery: 8, frequency: 9, mass: 1.5, equip: .55, cant: .22 },
  { name: 'carrion', kick: .064, pitch: .070, roll: -.019, recovery: 23, frequency: 19, mass: 1, equip: .40, cant: -.24 },
  { name: 'mourning', kick: .118, pitch: .143, roll: .024, recovery: 11, frequency: 12, mass: 1.25, equip: .47, cant: -.18 },
  { name: 'bat', kick: 0, pitch: 0, roll: 0, recovery: 16, frequency: 12, mass: .9, equip: .41, cant: .27 },
  { name: 'chainsaw', kick: 0, pitch: 0, roll: 0, recovery: 16, frequency: 12, mass: 1.4, equip: .52, cant: -.24 },
].map(Object.freeze));

export class WeaponPresentation {
  constructor() {
    this.pose = { position: { x: .02, y: -.012, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
      trigger: 0, recoil: 0, equip: 1, landing: 0, lookLag: 0, movementLag: 0, weapon: 0, phase: 'idle' };
    this.run = null;
  }

  reset(run, weapon, draw = false) {
    this.run = run;
    this.weapon = weapon;
    this.yaw = finite(run.angle); this.pitch = finite(run.pitch);
    this.x = finite(run.x); this.y = finite(run.y);
    this.lastShot = finite(run.shot); this.sequence = finite(run.shotSequence);
    this.lookX = this.lookY = this.sideLag = this.forwardLag = this.move = 0;
    this.shotAge = this.landAge = 10; this.shotStrength = 0; this.shotSide = 1;
    this.landStrength = 0; this.airborne = finite(run.z) > .015; this.fallSpeed = 0;
    this.equipAge = draw ? 0 : WEAPON_HANDLING[weapon].equip;
    this.elapsed = 0;
  }

  update(run, deltaSeconds, reducedMotion = false, nowMs = null) {
    // Zero delta is a true no-op: paused review frames do not consume shots.
    if (!(deltaSeconds > 0) || !Number.isFinite(deltaSeconds)) return this.pose;
    const weapon = clamp(Math.floor(finite(run.weapon)), 0, 7);
    const yaw = finite(run.angle), pitch = finite(run.pitch);
    const discontinuity = deltaSeconds > .25 || (Number.isFinite(nowMs) && Number.isFinite(this.lastNow) && nowMs - this.lastNow > 250)
      || (this.run === run && (Math.abs(angleDelta(yaw, this.yaw)) > 1.2 || Math.abs(pitch - this.pitch) > .7
        || Math.hypot(finite(run.x) - this.x, finite(run.y) - this.y) > 3));
    const changed = this.run === run && this.weapon !== weapon;
    const reset = this.run !== run || changed || discontinuity;
    if (reset) this.reset(run, weapon, changed && !discontinuity);
    this.lastNow = nowMs;
    const dt = Math.min(deltaSeconds, .05), profile = WEAPON_HANDLING[weapon];
    const aim = clamp(finite(run.aim), 0, 1), motion = reducedMotion ? .16 : 1;
    const steady = 1 - aim * .78;
    this.elapsed += dt;
    const yawRate = reset ? 0 : clamp(angleDelta(yaw, this.yaw) / dt, -5, 5);
    const pitchRate = reset ? 0 : clamp((pitch - this.pitch) / dt, -4, 4);
    this.lookX = follow(this.lookX, yawRate, 13 / profile.mass, dt);
    this.lookY = follow(this.lookY, pitchRate, 13 / profile.mass, dt);
    const forward = clamp(finite(run.vx) * Math.cos(yaw) + finite(run.vy) * Math.sin(yaw), -5, 5);
    const side = clamp(-finite(run.vx) * Math.sin(yaw) + finite(run.vy) * Math.cos(yaw), -5, 5);
    // Difference between body velocity and the gun's filtered velocity gives
    // acceleration drag and a reversed settling motion when the player stops.
    this.forwardLag = follow(this.forwardLag, forward, 7 / profile.mass, dt);
    this.sideLag = follow(this.sideLag, side, 7 / profile.mass, dt);
    const dragForward = reset ? 0 : forward - this.forwardLag;
    const dragSide = reset ? 0 : side - this.sideLag;
    this.move = follow(this.move, clamp(finite(run.speed) / 1.6, 0, 1), 9, dt);

    const shot = clamp(finite(run.shot), 0, 1), sequence = finite(run.shotSequence);
    const fired = !reset && weapon < 6 && shot > .08 && (shot > this.lastShot + .14 || sequence > this.sequence);
    if (fired) {
      const remaining = Math.exp(-this.shotAge * profile.recovery) * this.shotStrength;
      this.shotStrength = Math.min(1.3, 1 + remaining * .22);
      this.shotAge = 0;
      this.shotSide = Math.sin((sequence || this.elapsed * 11) * 2.399963) * .7 + .3;
    } else this.shotAge += dt;
    this.lastShot = shot; this.sequence = sequence;
    if (finite(run.z) > .015) this.airborne = true;
    if (this.airborne) this.fallSpeed = Math.min(this.fallSpeed, finite(run.vz));
    if (!reset && this.airborne && finite(run.z) <= .001) {
      this.landStrength = clamp(Math.abs(this.fallSpeed) / 2.1, .3, 1.4);
      this.landAge = 0; this.airborne = false; this.fallSpeed = 0;
    } else this.landAge += dt;
    const land = this.landAge < 1 ? Math.sin(this.landAge * 19) * Math.exp(-this.landAge * 12) * this.landStrength : 0;
    const kick = this.shotStrength && this.shotAge < 1.5
      ? Math.exp(-this.shotAge * profile.recovery) * Math.cos(this.shotAge * profile.frequency) * this.shotStrength : 0;
    const recoilScale = (reducedMotion ? .50 : 1) * (1 - aim * .28);
    if (!changed) this.equipAge = Math.min(profile.equip, this.equipAge + dt);
    const equip = clamp(this.equipAge / profile.equip, 0, 1);
    const draw = 1 - smooth(clamp(equip / .82, 0, 1));
    const catchPose = equip > .72 && equip < 1 ? Math.sin((equip - .72) / .28 * Math.PI) : 0;
    const drawScale = reducedMotion ? .32 : 1;
    const phase = finite(run.distance) * 7;
    const bob = this.move * .012 * steady * motion;
    const breath = Math.sin(this.elapsed * 1.65) * .002 * steady * motion;
    const lower = clamp(finite(run.dashTime) / .18, 0, 1) * .055 + clamp(finite(run.slide), 0, 1) * .025;
    const punch = clamp(finite(run.punch), 0, 1);
    const p = this.pose.position, r = this.pose.rotation;
    p.x = .02 - aim * .10 + Math.sin(phase) * bob - this.lookX * .008 * steady * motion - dragSide * .007 * motion;
    p.y = -.012 + Math.cos(phase * 2) * bob * .35 + breath - land * .085 * motion - lower * motion
      + (-draw * .23 + catchPose * .009) * drawScale;
    p.z = kick * profile.kick * recoilScale + dragForward * .010 * motion - punch * .045 + draw * .06 * drawScale;
    r.x = kick * profile.pitch * recoilScale - this.lookY * .020 * steady * motion + dragForward * .014 * motion
      - land * .095 * motion + punch * .1 + (draw * .48 - catchPose * .035) * drawScale;
    r.y = -aim * .02 + this.lookX * .018 * steady * motion + kick * profile.roll * this.shotSide * recoilScale;
    r.z = Math.sin(phase) * bob * .6 - this.lookX * .011 * steady * motion - dragSide * .016 * motion
      + kick * profile.roll * recoilScale + draw * profile.cant * drawScale;
    this.pose.trigger = weapon < 6 && this.shotAge < .6 ? Math.exp(-this.shotAge * 24) : 0;
    this.pose.recoil = kick; this.pose.equip = equip; this.pose.landing = land;
    this.pose.lookLag = Math.hypot(this.lookX, this.lookY);
    this.pose.movementLag = Math.hypot(dragForward, dragSide);
    this.pose.weapon = weapon;
    this.pose.phase = equip < 1 ? 'draw' : Math.abs(kick) > .02 ? 'recovery' : this.move > .1 ? 'moving' : 'idle';
    this.yaw = yaw; this.pitch = pitch; this.x = finite(run.x); this.y = finite(run.y);
    return this.pose;
  }
}
