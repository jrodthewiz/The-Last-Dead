import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createAfterlifeEnemy, animateAfterlifeEnemy} from '../npc-afterlife.js';

function skinnedSurvivorTemplate() {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.y = .93;
  root.add(hips);

  const geometry = new THREE.BoxGeometry(.46, 1.86, .34);
  const vertexCount = geometry.attributes.position.count;
  const indices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    indices[index * 4] = 0;
    weights[index * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const body = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({color: 0x666666}));
  body.name = 'TLD_Local_Torso_Legs';
  body.bind(new THREE.Skeleton([hips]));
  root.add(body);

  const head = new THREE.Group();
  head.name = 'TLD_Head_Hide_For_Local_Player';
  root.add(head);
  const arms = new THREE.Group();
  arms.name = 'TLD_Remote_Arms';
  root.add(arms);
  return root;
}

function clips() {
  const staticHips = () => new THREE.NumberKeyframeTrack('Hips.rotation[y]', [0, 1], [.52, .52]);
  return ['Idle_Relaxed', 'Walk_Forward', 'Run_Forward'].map(name =>
    new THREE.AnimationClip(name, 1, [staticHips()]),
  );
}

function enemy() {
  return {
    id: 901,
    kind: 0,
    variant: 'stalker',
    attack: 20,
    attacking: false,
    windup: 0,
    strike: 0,
    flash: 0,
    dead: false,
  };
}

test('survivor enemy animation keeps the last mixer pose when a clip is unchanged', () => {
  const root = createAfterlifeEnemy(skinnedSurvivorTemplate(), clips(), 0, 'stalker', 3);
  const state = root.userData.afterlife;
  const frame = enemy();
  try {
    animateAfterlifeEnemy(root, frame, 0, 3);
    const hips = state.bones.hips;
    const firstY = hips.quaternion.y;
    assert.ok(Math.abs(firstY) > .1, 'the keyed idle pose reaches the cloned rig');

    // A zero delta leaves the action at the same keyframe. Three.js may skip
    // the property write, so the renderer must restore the cached animation
    // pose before layering its procedural posture.
    animateAfterlifeEnemy(root, frame, 0, 3);
    assert.ok(Math.abs(hips.quaternion.y - firstY) < 1e-6, 'unchanged clip does not snap a bone to bind pose');
  } finally {
    state.actorState.mixer?.stopAllAction();
  }
});
