import * as THREE from './vendor/three.module.js';

// Records are small physical artifacts, with a quieter signal than weapon
// loot. The label remains readable after the light and color treatment.
const AMBER = 0xdcb17b;
const SHAPES = Object.freeze({
  punchcard: [.78, 1.05], schematic: [1.08, .86], chart: [.92, 1.12],
  tag: [.65, .92], note: [.88, 1.04], score: [1.13, 1.18], seal: [.82, .96],
});

function labelTexture(record) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#272421';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#b88858';
  ctx.fillRect(0, 0, 512, 52);
  ctx.fillStyle = '#1b1715';
  ctx.font = 'bold 26px monospace';
  ctx.fillText('ARCHIVE  /  ' + record.kind.toUpperCase(), 24, 35);
  ctx.fillStyle = '#eee0bf';
  ctx.font = 'bold 45px sans-serif';
  const words = record.title.toUpperCase().split(' ');
  let line = '', y = 151;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 460 && line) {
      ctx.fillText(line, 25, y);
      y += 56;
      line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, 25, y);
  ctx.strokeStyle = '#977658';
  ctx.lineWidth = 3;
  for (let index = 0; index < 4; index++) {
    const row = 318 + index * 37;
    ctx.beginPath();ctx.moveTo(28, row);ctx.lineTo(420 - index * 38, row);ctx.stroke();
  }
  ctx.fillStyle = '#c5a985';
  ctx.font = '25px monospace';
  ctx.fillText(record.id.toUpperCase(), 27, 486);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function buildDungeonEvidence(worldRoot, course) {
  if (!course?.dungeon) return [];
  const items = [];
  for (const record of course.evidence || []) {
    const [width, height] = SHAPES[record.kind] || SHAPES.note;
    const root = new THREE.Group();
    root.name = `StoryEvidence_${record.id}`;
    root.userData.noBatch = true;
    root.position.set(record.x * 4, 0, record.y * 4);
    const dark = new THREE.MeshStandardMaterial({ color: 0x292923, metalness: .66, roughness: .44 });
    const bright = new THREE.MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: .52, metalness: .38, roughness: .46 });
    const label = new THREE.MeshBasicMaterial({ map: labelTexture(record), side: THREE.FrontSide });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.43, .53, .12, 10), dark);
    foot.position.y = .11;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, .55, 6), dark);
    stem.position.y = .4;
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(.48, .024, 5, 22), bright);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = .19;
    root.add(foot, stem, floorRing);
    const carrier = new THREE.Group();
    carrier.position.y = 1.25;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + .1, height + .1, .08), dark);
    const pageFront = new THREE.Mesh(new THREE.PlaneGeometry(width, height), label);
    pageFront.position.z = .045;
    const pageBack = new THREE.Mesh(new THREE.PlaneGeometry(width, height), label);
    pageBack.position.z = -.045;
    pageBack.rotation.y = Math.PI;
    carrier.add(frame, pageFront, pageBack);
    for (const x of [-1, 1]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .12), bright);
      clip.position.set(x * width * .42, height * .49, 0);
      carrier.add(clip);
    }
    const seal = new THREE.Mesh(new THREE.OctahedronGeometry(.095, 0), bright);
    seal.position.y = -height * .57;
    carrier.add(seal);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(.66, .026, 5, 24), bright);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.02;
    const light = new THREE.PointLight(AMBER, .45, 4.5, 2);
    light.position.y = 1.55;
    root.add(carrier, halo, light);
    worldRoot.add(root);
    items.push({ ...record, root, carrier, halo, light });
  }
  return items;
}

export function updateDungeonEvidence(items, collectedRecords, timeMs, reducedMotion = false, camera = null) {
  const found = new Set((collectedRecords || []).map(record => record.id));
  for (const item of items || []) {
    item.root.visible = !found.has(item.id);
    if (!item.root.visible) continue;
    const phase = timeMs * .001 + item.x;
    item.carrier.position.y = reducedMotion ? 1.25 : 1.25 + Math.sin(phase * 1.3) * .08;
    const dx=(camera?.position.x ?? item.root.position.x) - item.root.position.x;
    const dz=(camera?.position.z ?? item.root.position.z + 1) - item.root.position.z;
    const facing=Math.atan2(dx,dz);
    item.carrier.rotation.y = facing + (reducedMotion ? 0 : Math.sin(phase * .7) * .07);
    item.halo.rotation.z = reducedMotion ? 0 : phase * .2;
    item.light.intensity = reducedMotion ? .4 : .4 + Math.sin(phase * 2.1) * .08;
  }
}
