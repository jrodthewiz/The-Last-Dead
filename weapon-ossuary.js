import {buildOssuaryRedesign, animateOssuaryRedesign} from './weapon-occult-redesign.js';

// Public Ossuary contract. Geometry and animation live in the shared
// silhouette kit so the browser ships one maintained implementation.
export function createOssuary() {
  // The grounded factory owns its construction cues. The legacy detail kit
  // adds luminous chamber lamps and decorative conduits over the moving drum.
  return buildOssuaryRedesign();
}

export function animateOssuary(root, shot = 0, time = 0, dt = .016, state = {}) {
  animateOssuaryRedesign(root, shot, time, dt, state);
}
