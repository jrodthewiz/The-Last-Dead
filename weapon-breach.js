import {applyWeaponDetailPass} from './weapon-detail-pass.js';
import {buildBreachRedesign, animateBreachRedesign} from './weapon-occult-redesign.js';

// Public Breach contract. The shared factory owns the authored twin-barrel
// silhouette while this module keeps the renderer's established call shape.
export function createBreach(options = {}) {
  return applyWeaponDetailPass(buildBreachRedesign(options), 'breach');
}

export function animateBreach(root, time = 0, shot = 0, dt = .016, state = {}) {
  animateBreachRedesign(root, time, shot, dt, state);
}
