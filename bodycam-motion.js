// Visual chest mount, in metres/radians. Gameplay aim stays authoritative.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = v => Number.isFinite(v) ? v : 0;
const follow = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class BodycamMotion {
  constructor() {
    this.pose = { x: 0, y: 0, pitch: 0, roll: 0 };
    this.reset();
  }

  reset() {
    this.run = null;
    this.move = this.turn = this.side = this.drag = this.elapsed = 0;
    this.landAge = 2;
    this.landStrength = 0;
    this.fallSpeed = 0;
    Object.assign(this.pose, { x: 0, y: 0, pitch: 0, roll: 0 });
  }

  update(run, delta, { enabled = true, reducedMotion = false, now = 0 } = {}) {
    if (!enabled || reducedMotion) { this.reset(); return this.pose; }
    if (!(delta > 0) || !Number.isFinite(delta)) return this.pose;
    const yaw = finite(run.angle), x = finite(run.x), y = finite(run.y);
    const cut = this.run !== run || this.course !== run.course || delta > .25 ||
      (this.lastNow != null && now - this.lastNow > 250) ||
      Math.hypot(x - this.x, y - this.y) > 3 || Math.abs(angleDelta(yaw, this.yaw)) > 1.2;
    if (cut) {
      this.reset(); this.run = run; this.course = run.course;
      this.airborne = finite(run.z) > .015;
      this.forward = finite(run.vx) * Math.cos(yaw) + finite(run.vy) * Math.sin(yaw);
    }
    const dt = Math.min(delta, .05);
    this.elapsed += dt;
    const steady = 1 - clamp(finite(run.aim), 0, 1) * .8;
    const speed = Math.hypot(finite(run.vx), finite(run.vy));
    this.move = follow(this.move, clamp(speed / 1.6, 0, 1), 10, dt);
    this.turn = follow(this.turn, cut ? 0 : clamp(angleDelta(yaw, this.yaw) / dt, -4, 4), 12, dt);
    this.side = follow(this.side, clamp(-finite(run.vx) * Math.sin(yaw) + finite(run.vy) * Math.cos(yaw), -3, 3), 9, dt);
    const forward = finite(run.vx) * Math.cos(yaw) + finite(run.vy) * Math.sin(yaw);
    this.forward = follow(this.forward, forward, 7, dt);
    this.drag = follow(this.drag, cut ? 0 : clamp(forward - this.forward, -2, 2), 14, dt);
    if (finite(run.z) > .015) this.airborne = true;
    if (this.airborne) this.fallSpeed = Math.min(this.fallSpeed, finite(run.vz));
    if (!cut && this.airborne && finite(run.z) <= .001) {
      this.landAge = 0; this.landStrength = clamp(-this.fallSpeed / 2, .25, 1);
      this.airborne = false; this.fallSpeed = 0;
    } else this.landAge += dt;
    const land = Math.sin(this.landAge * 20) * Math.exp(-this.landAge * 13) * (this.landStrength || 0);
    // Distance locks the mount to footsteps, rather than shaking while blocked.
    const phase = finite(run.distance) * 7;
    const walk = this.airborne ? 0 : this.move * steady;
    const breath = Math.sin(this.elapsed * 1.6) * .0012 * steady;
    this.pose.x = Math.sin(phase) * .012 * walk;
    this.pose.y = -.14 + Math.cos(phase * 2) * .022 * walk - land * .055;
    this.pose.pitch = clamp(Math.sin(phase * 2 + .4) * .005 * walk + breath + this.drag * .009 * steady - land * .018, -.035, .035);
    this.pose.roll = clamp(Math.sin(phase) * .012 * walk - this.turn * .009 * steady - this.side * .009 * steady, -.04, .04);
    this.yaw = yaw; this.x = x; this.y = y; this.lastNow = now;
    return this.pose;
  }
}
