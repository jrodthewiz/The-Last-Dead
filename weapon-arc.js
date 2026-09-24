import {buildArcRedesign, animateArcRedesign} from './weapon-occult-redesign.js';

// Public Arc Lance contract. The shared factory owns the open pronged frame
// and ceramic capacitor while this module keeps the renderer's call shape.
export function createArc(options = {}) {
  return buildArcRedesign(options);
}

export function animateArc(root, time = 0, shot = 0, dt = .016, state = {}) {
  animateArcRedesign(root, time, shot, dt, state);
}
