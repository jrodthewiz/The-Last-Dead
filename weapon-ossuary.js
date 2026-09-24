import {buildOssuaryRedesign, animateOssuaryRedesign} from './weapon-occult-redesign.js';

// Public Ossuary contract. Geometry and animation live in the shared
// silhouette kit so the browser ships one maintained implementation.
export function createOssuary() {
  return buildOssuaryRedesign();
}

export function animateOssuary(root, shot = 0, time = 0, dt = .016, state = {}) {
  animateOssuaryRedesign(root, shot, time, dt, state);
}
