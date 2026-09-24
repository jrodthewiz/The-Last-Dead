import {buildReliquaryRedesign, animateReliquaryRedesign} from './weapon-occult-redesign.js';

// Public Reliquary contract. The shared factory owns the octagonal sealed
// chamber while this module keeps the renderer's established call shape.
export function createReliquary(options = {}) {
  return buildReliquaryRedesign(options);
}

export function animateReliquary(root, shot = 0, time = 0, dt = .016, state = {}) {
  animateReliquaryRedesign(root, shot, time, dt, state);
}
