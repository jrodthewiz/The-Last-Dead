import * as THREE from '../../vendor/three.module.js';

// First-person arm poses are authored in the weapon's local frame.  The
// weapon groups are scaled together by renderer.js, so these anchors remain
// stable when the camera moves between desktop and narrow layouts.
export const VIEWMODEL_HOLD_POSES = Object.freeze([
  Object.freeze({
    right: Object.freeze({ wrist: [.095, -.25, .16], elbow: [.43, -.93, .89], handRotation: [-.18, .02, -.08], palm: [-.018, .018, -.012] }),
    left: null,
  }),
  Object.freeze({
    right: Object.freeze({ wrist: [.098, -.32, .16], elbow: [.43, -.99, .86], handRotation: [-.22, .02, -.08], palm: [-.021, .018, -.014] }),
    left: Object.freeze({ wrist: [-.15, -.18, -.51], elbow: [-.43, -.84, .46], handRotation: [-.11, -.02, .12], palm: [.024, .016, -.014] }),
  }),
  Object.freeze({
    right: Object.freeze({ wrist: [.098, -.38, .16], elbow: [.43, -1.04, .84], handRotation: [-.25, .02, -.08], palm: [-.022, .02, -.014] }),
    left: Object.freeze({ wrist: [-.15, -.22, -.56], elbow: [-.44, -.90, .41], handRotation: [-.12, -.02, .13], palm: [.026, .018, -.016] }),
  }),
  Object.freeze({
    right: Object.freeze({ wrist: [.098, -.25, .16], elbow: [.43, -.94, .89], handRotation: [-.19, .02, -.08], palm: [-.02, .018, -.012] }),
    left: Object.freeze({ wrist: [-.16, -.18, -.62], elbow: [-.45, -.83, .39], handRotation: [-.08, -.02, .14], palm: [.028, .016, -.014] }),
  }),
]);

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function vector(value) {
  return value instanceof THREE.Vector3 ? value.clone() : new THREE.Vector3(...value);
}

function tubeGeometry(points, radii, radialSegments = 14) {
  const positions = [];
  const indices = [];
  const count = points.length;

  for (let i = 0; i < count; i++) {
    const current = points[i];
    const tangent = vector(points[Math.min(count - 1, i + 1)])
      .sub(points[Math.max(0, i - 1)])
      .normalize();
    const reference = Math.abs(tangent.dot(Y_AXIS)) > .88 ? X_AXIS : Y_AXIS;
    const basisA = tangent.clone().cross(reference).normalize();
    const basisB = tangent.clone().cross(basisA).normalize();
    const radius = radii[i];
    for (let j = 0; j <= radialSegments; j++) {
      const angle = j / radialSegments * Math.PI * 2;
      const offset = basisA.clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(basisB, Math.sin(angle) * radius);
      positions.push(current.x + offset.x, current.y + offset.y, current.z + offset.z);
      if (i > 0 && j > 0) {
        const n = i * (radialSegments + 1) + j;
        indices.push(n, n - 1, n - radialSegments - 2, n, n - radialSegments - 2, n - radialSegments - 1);
      }
    }
  }

  const startCenter = positions.length / 3;
  const start = points[0];
  positions.push(start.x, start.y, start.z);
  const endCenter = positions.length / 3;
  const end = points[count - 1];
  positions.push(end.x, end.y, end.z);
  for (let j = 0; j < radialSegments; j++) {
    indices.push(startCenter, j + 1, j);
    const n = (count - 1) * (radialSegments + 1) + j;
    indices.push(endCenter, n, n + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addTube(parent, name, points, radii, material, radialSegments = 14) {
  const mesh = new THREE.Mesh(tubeGeometry(points, radii, radialSegments), material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addCapsule(parent, name, start, end, radius, material, segments = 12) {
  const a = vector(start);
  const b = vector(end);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.012, length - radius * 2), 4, segments), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function addRing(parent, name, position, direction, radius, tube, material) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 18), material);
  ring.name = name;
  ring.position.copy(position);
  ring.quaternion.setFromUnitVectors(UP, vector(direction).normalize());
  ring.castShadow = false;
  ring.receiveShadow = false;
  parent.add(ring);
  return ring;
}

function addFinger(hand, name, side, y, materials) {
  const inward = -side;
  const base = new THREE.Vector3(side * .006, y, -.006);
  const knuckle = base.clone().add(new THREE.Vector3(inward * .053, -.006, -.036));
  const tip = knuckle.clone().add(new THREE.Vector3(inward * .035, -.014, .027));
  addCapsule(hand, `${name}Proximal`, base, knuckle, .019, materials.viewGlove);
  addCapsule(hand, `${name}Distal`, knuckle, tip, .017, materials.viewSkin, 10);

  const nail = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6), materials.viewPlate);
  nail.name = `${name}Nail`;
  nail.scale.set(.9, .55, .55);
  nail.position.copy(tip).addScaledVector(new THREE.Vector3(inward, 0, .35).normalize(), .006);
  hand.add(nail);
}

function addThumb(hand, side, materials) {
  const inward = -side;
  const base = new THREE.Vector3(side * .046, -.005, .035);
  const knuckle = base.clone().add(new THREE.Vector3(inward * .022, -.006, -.037));
  const tip = knuckle.clone().add(new THREE.Vector3(inward * .044, -.004, -.019));
  addCapsule(hand, 'ThumbProximal', base, knuckle, .021, materials.viewGlove);
  addCapsule(hand, 'ThumbDistal', knuckle, tip, .017, materials.viewSkin, 10);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6), materials.viewPlate);
  nail.name = 'ThumbNail';
  nail.scale.set(.9, .55, .55);
  nail.position.copy(tip).addScaledVector(new THREE.Vector3(inward, 0, -.25).normalize(), .006);
  hand.add(nail);
}

function poseFor(side, weapon) {
  const pose = VIEWMODEL_HOLD_POSES[Math.max(0, Math.min(VIEWMODEL_HOLD_POSES.length - 1, weapon))]?.[side < 0 ? 'left' : 'right'];
  return pose || VIEWMODEL_HOLD_POSES[0].right;
}

/**
 * Move an authored arm so its palm/grip socket meets a weapon socket in the
 * same viewmodel frame.  The old arm poses were tuned by eye against one
 * weapon, which made the hand drift visibly away from the grip on the other
 * three weapons.  Fitting in the shared parent's local space keeps the
 * correction stable through rig scale, sway, and recoil.
 */
export function alignViewmodelArmToGrip(arm, target, { offset = [0, 0, 0] } = {}) {
  const socket = arm?.userData?.gripSocket;
  const parent = arm?.parent;
  if (!socket || !parent || !target) return arm;

  parent.updateWorldMatrix(true, true);
  arm.updateWorldMatrix(true, true);

  const targetLocal = target.isObject3D
    ? parent.worldToLocal(target.getWorldPosition(new THREE.Vector3()))
    : vector(target);

  // The survivor reference arm is authored around a downward-facing hand
  // axis. Match that axis to the weapon's grip socket before translating so
  // the fingers wrap the grip instead of floating beside it. Procedural arms
  // opt in with `alignGripOrientation`; their authored pose remains intact.
  if (target.isObject3D && arm.userData?.alignGripOrientation) {
    const parentWorldQ = parent.getWorldQuaternion(new THREE.Quaternion());
    const targetWorldQ = target.getWorldQuaternion(new THREE.Quaternion());
    const targetLocalQ = parentWorldQ.invert().multiply(targetWorldQ);
    arm.quaternion.slerp(targetLocalQ, .86);
  }

  // Orientation changes the socket's world position, so sample it again
  // before applying the translation correction. Sampling before the slerp
  // leaves the hand visibly offset from the grip on angled weapons.
  arm.updateWorldMatrix(true, true);
  const currentWorld = socket.getWorldPosition(new THREE.Vector3());
  const currentLocal = parent.worldToLocal(currentWorld);

  arm.position.add(targetLocal.sub(currentLocal)).add(vector(offset));
  arm.updateWorldMatrix(true, true);
  arm.userData.gripTarget = target.isObject3D ? target.name || 'weapon-grip' : 'weapon-grip';
  return arm;
}

/**
 * Build one close-camera arm with an explicit wrist and grip socket.  The arm
 * is intentionally stylized, but the bent forearm, cuff break, finger curl,
 * and thumb opposition provide the silhouette and contact cues of a real hold.
 */
export function createViewmodelArm(side = 1, weapon = 0, materials) {
  const pose = poseFor(side, weapon);
  const wrist = vector(pose.wrist);
  // Keep the elbow arc in the same shallow depth band as the weapon.  The
  // former z=.7-.9 control points sat almost on the camera and magnified the
  // sleeves into disconnected cylinders.
  const elbow = new THREE.Vector3(side * .22, -.32, .11);
  const upper = new THREE.Vector3(side * .29, -.49, .035);
  const cuff = elbow.clone().multiplyScalar(.18);
  const cuffBack = elbow.clone().multiplyScalar(.36);
  const arm = new THREE.Group();
  arm.name = `${side < 0 ? 'Left' : 'Right'}Arm`;
  arm.position.copy(wrist);
  arm.rotation.set(0, 0, side * -.025);
  // Keep the articulated arm/hand hierarchy intact for the viewmodel batcher:
  // named palms, fingers, cuffs, and grip sockets are intentional close-camera
  // detail and must not collapse into a single static surface.
  arm.userData.weaponBatchIgnore = true;
  arm.userData.holdPose = pose;
  arm.userData.side = side;
  arm.userData.weapon = weapon;

  // A two-stage sleeve keeps the elbow from reading as a single straight
  // primitive and gives the cuff a believable taper into the wrist.
  const elbowMid = upper.clone().lerp(elbow, .46);
  addTube(arm, 'UpperSleeve', [upper, elbowMid, elbow, cuffBack], [.13, .135, .12, .094], materials.viewSleeve, 18);
  addTube(arm, 'ForearmSleeve', [cuffBack, cuff, new THREE.Vector3()], [.094, .081, .066], materials.viewSleeve, 18);
  addTube(arm, 'WristWrap', [cuff, new THREE.Vector3(0, .005, -.006)], [.068, .059, .052], materials.viewGlove, 16);

  const elbowPad = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), materials.viewGlove);
  elbowPad.name = 'ElbowPad';
  elbowPad.scale.set(.13, .095, .12);
  elbowPad.position.copy(elbow);
  arm.add(elbowPad);

  const hand = new THREE.Group();
  hand.name = 'HandPose';
  hand.position.copy(vector(pose.palm));
  hand.rotation.set(...pose.handRotation);
  arm.add(hand);
  arm.userData.hand = hand;

  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), materials.viewGlove);
  palm.name = 'GripPalm';
  palm.scale.set(.082, .112, .061);
  hand.add(palm);
  const back = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), materials.viewGlove);
  back.name = 'HandBack';
  back.scale.set(.076, .086, .049);
  back.position.set(0, .022, .035);
  hand.add(back);

  const yLevels = [.078, .026, -.026, -.078];
  yLevels.forEach((y, index) => addFinger(hand, `Finger${index}`, side, y, materials));
  addThumb(hand, side, materials);

  const knuckleGuard = new THREE.Mesh(new THREE.BoxGeometry(.094, .017, .038), materials.viewPlate);
  knuckleGuard.name = 'KnuckleGuard';
  knuckleGuard.position.set(0, .076, .045);
  knuckleGuard.rotation.z = side * -.08;
  hand.add(knuckleGuard);

  const gripSocket = new THREE.Object3D();
  gripSocket.name = 'GripSocket';
  gripSocket.position.set(0, -.015, -.01);
  hand.add(gripSocket);
  arm.userData.gripSocket = gripSocket;
  hand.userData.viewmodelHand = true;
  hand.traverse(node => { node.userData.viewmodelHand = true; });
  arm.userData.sockets = { wrist: arm, elbow: elbowPad, hand: gripSocket };

  arm.traverse(node => {
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
      node.userData.viewmodelArm = true;
    }
  });
  return arm;
}

export const viewmodelArmsContract = Object.freeze({
  poseCount: VIEWMODEL_HOLD_POSES.length,
  hasExplicitWristSockets: true,
  hasArticulatedHands: true,
  hasGripFitting: true,
  usesSharedMaterials: true,
});
