// Development-only visual bench. Uses the actual game renderer, hands,
// mechanisms and shooting state, with repeatable visual motion inputs.
import { Renderer } from './renderer.js';
import { makeCampaignCourse, newRun, tickPlayer, shoot, switchWeapon, weapons } from './engine.js';
const canvas=document.querySelector('#world');
const backend=await (await import('./webgpu-backend.js')).createWebGPUBackend(canvas);
const renderer = new Renderer(canvas,{backend});
const course = makeCampaignCourse(0);
course.enemies = [];
let run, anchor, elapsed = 0, last = 0, paused = false, ready = false;
const controls = Object.fromEntries(['weapon','motion','speed','bodycam','reduced','stats','pause'].map(id => [id, document.getElementById(id)]));
weapons.forEach((weapon, index) => controls.weapon.add(new Option(weapon.name, index)));
function reset() {
  const weapon = Number(controls.weapon.value) || 0;
  run = newRun(course, { requireEntry: false });
  Object.assign(run, { mode: 'play', health: 1000, ownedWeapons: weapons.map((_, i) => i), weapon });
  run.angle += Math.PI;
  anchor = { x: run.x, y: run.y, angle: run.angle };
  elapsed = 0;
  renderer._firstCameraFrame = true;
  renderer.bodycam?.reset();
  renderer.weaponPresentation?.reset(run, weapon, true);
}
function select(index) {
  controls.weapon.value = String(index);
  switchWeapon(run, index);
}
function settings() {
  renderer.setSettings({ bodycam: controls.bodycam.checked, reducedMotion: controls.reduced.checked });
}
function step(dt) {
  elapsed += dt;
  tickPlayer(run, dt, {});
  run.x = anchor.x; run.y = anchor.y;
  run.angle = anchor.angle; run.pitch = 0; run.vx = 0; run.vy = 0; run.speed = 0; run.aim = 0;
  const mode = controls.motion.value;
  if (mode === 'look') {
    run.angle += Math.sin(elapsed * 1.4) * .6;
    run.pitch = Math.sin(elapsed * .7) * .08;
  }
  if (mode === 'walk') {
    const moving = elapsed % 4 < 2.7;
    run.speed = moving ? 1.7 : 0;
    run.vx = Math.cos(run.angle) * run.speed;
    run.vy = Math.sin(run.angle) * run.speed;
    run.distance += run.speed * dt;
  }
  if (mode === 'land') {
    const phase = elapsed % 2.5;
    run.z = phase < .8 ? Math.sin(phase / .8 * Math.PI) * .28 : 0;
    run.vz = phase < .8 ? Math.cos(phase / .8 * Math.PI) * .28 * Math.PI / .8 : 0;
  } else { run.z = 0; run.vz = 0; }
  if (mode === 'aim') run.aim = 1;
  if (mode === 'fire') shoot(run, false);
  // This is a pose bench, not an active encounter; clear transient world hits.
  run.events.length = 0; run.projectiles.length = 0; run.tracers.length = 0;
  renderer.render(run, 1000 + elapsed * 1000);
}
controls.weapon.onchange = () => select(Number(controls.weapon.value));
controls.bodycam.onchange = controls.reduced.onchange = settings;
document.querySelector('#fire').onclick = () => { if (ready) { shoot(run, false); step(1 / 120); } };
document.querySelector('#equip').onclick = reset;
document.querySelector('#reset').onclick = reset;
controls.pause.onclick = () => { paused = !paused; controls.pause.textContent = paused ? 'Resume' : 'Pause'; };
addEventListener('resize', () => renderer.resize());
reset(); settings();
window.__COMBAT_REVIEW__ = {
  renderer, get run() { return run; }, get ready() { return ready; },
  reset, select, step,
  setMode(mode) { controls.motion.value = mode; },
  pause(value = true) { paused = value; controls.pause.textContent = paused ? 'Resume' : 'Pause'; },
};
function frame(now) {
  const dt = Math.min(.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  ready = !!renderer._weaponsPrepared;
  if (!ready || !paused) step(dt * Number(controls.speed.value));
  const info = renderer.renderer?.info;
  controls.stats.textContent = ready
    ? `${weapons[run.weapon].name} · ${controls.motion.options[controls.motion.selectedIndex].text} · ${elapsed.toFixed(2)}s\n${info?.render.calls ?? 0} draws · ${(info?.render.triangles ?? 0).toLocaleString()} triangles · shot ${run.shot.toFixed(2)} · visual preview, no enemy simulation`
    : renderer._preparationStage || 'Preparing game assets…';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('pagehide', () => renderer.dispose(), { once: true });
