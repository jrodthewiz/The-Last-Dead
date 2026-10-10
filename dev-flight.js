// Inspection uses renderer world metres: +Y up, X/Z ground plane. Player
// coordinates stay untouched (the simulation uses four-metre cells).
export class DevFlight {
  active = false;
  speed = 12;
  enter(run) {
    this.origin = { x: run.x * 4, y: (run.z + .4 - (run.slide || 0) * .18) * 4,
      z: run.y * 4, angle: run.angle, pitch: run.pitch };
    this.reset(); this.active = true;
  }
  leave() { this.active = false; }
  reset() { if (this.origin) this.pose = { ...this.origin }; }
  overview(course, aspect = 1) {
    if (!course?.coastal || !Number.isFinite(aspect) || aspect <= 0) return false;
    const width = course.w * 4, depth = course.h * 4;
    if (!(width > 0 && depth > 0)) return false;
    // Fit the 75-degree camera with room for the bodycam lens, cliff edges,
    // and inspection controls. The output lens crops more than the raw frustum.
    const height = Math.max(depth, width / aspect) / (2 * Math.tan(75 * Math.PI / 360)) * 1.7 + 24;
    this.pose = { x: width / 2, y: height, z: depth / 2, angle: Math.PI / 2, pitch: -Math.PI / 2 + .01 };
    return true;
  }
  look(dx, dy) {
    this.pose.angle += dx * .002;
    this.pose.pitch = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, this.pose.pitch - dy * .002));
  }
  changeSpeed(direction) { this.speed = Math.max(1, Math.min(96, this.speed * (direction > 0 ? 1.25 : .8))); }
  update(dt, keys) {
    if (!this.active) return;
    dt = Math.min(.1, Math.max(0, dt));
    const has = key => Number(keys.has(key));
    this.look((has('ArrowRight') - has('ArrowLeft')) * dt * 650, (has('ArrowDown') - has('ArrowUp')) * dt * 650);
    const forward = has('KeyW') - has('KeyS'), side = has('KeyD') - has('KeyA');
    const up = Math.max(has('Space'),has('KeyE')) - Math.max(has('ControlLeft'),has('ControlRight'),has('KeyQ'));
    const { angle, pitch } = this.pose;
    const dx = Math.cos(angle) * Math.cos(pitch) * forward - Math.sin(angle) * side;
    const dz = Math.sin(angle) * Math.cos(pitch) * forward + Math.cos(angle) * side;
    const dy = Math.sin(pitch) * forward + up;
    const length = Math.hypot(dx, dy, dz);
    if (!length) return;
    const distance = this.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1) * dt / Math.max(1, length);
    this.pose.x += dx * distance; this.pose.y += dy * distance; this.pose.z += dz * distance;
  }
}
