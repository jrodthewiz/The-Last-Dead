import {buildBreachRedesign, animateBreachRedesign} from './weapon-occult-redesign.js';

// Public Breach contract. The shared factory owns the authored twin-barrel
// silhouette while this module keeps the renderer's established call shape.
export function createBreach(options = {}) {
  return buildBreachRedesign(options);
}

export function animateBreach(root, time = 0, shot = 0, dt = .016, state = {}) {
  animateBreachRedesign(root, time, shot, dt, state);
}
