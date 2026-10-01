import * as THREE from './vendor/three.module.js';

// Additive two-stage support for the imported survivor's fused finger surface
// and its measured lateral thumb lobe. This is not an independent digit rig.
// This is deliberately applied only to the caller's cloned arm actor: the
// shared asset, original wrist bones, textures and animation clips stay intact.
const rigs = new WeakMap();
const SIDES = ['Left', 'Right'];
const smooth = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value-a)/(b-a), 0, 1);
  return t*t*(3-2*t);
};
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
export const COUNTER_GRIP_MODES=Object.freeze({
  heart:Object.freeze({proximal:.76,distal:1.18,thumbOpposition:1.02,thumbFlex:.52}),
  gun:Object.freeze({proximal:.88,distal:1.34,thumbOpposition:1.18,thumbFlex:.44}),
  brace:Object.freeze({proximal:.44,distal:.52,thumbOpposition:.55,thumbFlex:.24}),
});

function armMesh(root) {
  if (root?.isSkinnedMesh && root.name === 'TLD_Remote_Arms') return root;
  return root?.getObjectByName?.('TLD_Remote_Arms');
}

function ownSkinGeometry(source) {
  const geometry = new THREE.BufferGeometry();
  geometry.name = source.name + '_CounterGrip';
  geometry.index = source.index;
  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(name, name === 'skinIndex' || name === 'skinWeight' ? attribute.clone() : attribute);
  }
  geometry.morphAttributes = {...source.morphAttributes};
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.groups = source.groups.map(group => ({...group}));
  geometry.drawRange = {...source.drawRange};
  geometry.boundingBox = source.boundingBox?.clone() || null;
  geometry.boundingSphere = source.boundingSphere?.clone() || null;
  geometry.userData = {...source.userData, counterGripOwned: true};
  return geometry;
}

function measureHand(mesh, index) {
  const {position, skinIndex, skinWeight} = mesh.geometry.attributes;
  const inverse = mesh.skeleton.boneInverses[index];
  // Inverse binds define the original metric scale. Using current ancestor
  // scale here would change the weighting field whenever the actor is posed,
  // moved, turned, or placed under a centimetre-scale presentation wrapper.
  const bindScale = new THREE.Vector3().setFromMatrixScale(inverse.clone().invert());
  const point = new THREE.Vector3(), bounds = new THREE.Box3(), samples = [];
  for (let vertex = 0; vertex < position.count; vertex++) {
    let influence = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (skinIndex.getComponent(vertex, slot) === index) influence += skinWeight.getComponent(vertex, slot);
    }
    if (influence <= .5) continue;
    point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverse);
    const metric = point.clone().multiply(bindScale);
    bounds.expandByPoint(metric);
    samples.push({vertex, local: point.clone(), metric, influence});
  }
  if (!samples.length) return null;
  const extent = bounds.getSize(new THREE.Vector3()).toArray();
  const ordered = [0, 1, 2].sort((a, b) => extent[b]-extent[a]);
  const longIndex = ordered[0], thicknessIndex = ordered[2], widthIndex = ordered[1];
  const longSign = Math.abs(bounds.max.getComponent(longIndex)) >= Math.abs(bounds.min.getComponent(longIndex)) ? 1 : -1;
  const longAxis = AXES[longIndex].clone().multiplyScalar(longSign);
  // The actual imported hand's thin direction is +Z. Derive the rest axes
  // from its measured shape, then orient that positive thin side as the palm
  // closing direction. Both hands therefore curl +Y towards +Z in this asset.
  const palmNormal = AXES[thicknessIndex].clone();
  const curlAxis = new THREE.Vector3().crossVectors(longAxis, palmNormal).normalize();
  const baseQuaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(curlAxis, longAxis, palmNormal));
  const thumbSign = Math.abs(bounds.max.getComponent(widthIndex)) > Math.abs(bounds.min.getComponent(widthIndex)) ? 1 : -1;
  return {samples, bounds, bindScale, longIndex, longSign, widthIndex, thumbSign,
    longAxis, palmNormal, curlAxis, baseQuaternion};
}

/**
 * Add two serial finger support joints and thumb opposition to each wrist.
 * Accepts the cloned actor root or its TLD_Remote_Arms mesh. These controls
 * bend existing fused geometry; they do not create separate digits.
 */
export function addCounterGripRig(arms) {
  const existing = rigs.get(arms);
  if (existing && !existing.disposed) return existing;
  const controls = {}, hands = {};
  const mesh = armMesh(arms);
  const rig = {controls, hands, ownedGeometry: null, disposed: false, status: 'unavailable', dispose: () => { rig.disposed = true; }};
  if (!mesh?.isSkinnedMesh || !mesh.geometry.attributes.skinIndex || !mesh.geometry.attributes.skinWeight) return rig;
  const originalGeometry = mesh.geometry, originalSkeleton = mesh.skeleton;
  const geometry = ownSkinGeometry(originalGeometry);
  const bones = originalSkeleton.bones.slice(), inverses = originalSkeleton.boneInverses.map(inverse => inverse.clone());
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  for (const side of SIDES) {
    const wristIndex = originalSkeleton.bones.findIndex(bone => bone.name === side+'Hand');
    if (wristIndex < 0) continue;
    const measured = measureHand(mesh, wristIndex);
    if (!measured) continue;
    const wrist = originalSkeleton.bones[wristIndex];
    const proximal=new THREE.Bone(),distal=new THREE.Bone(),thumb=new THREE.Bone();
    proximal.name=side+'Hand_CounterCurl';distal.name=side+'Hand_CounterDistal';thumb.name=side+'Hand_CounterThumb';
    proximal.quaternion.copy(measured.baseQuaternion);thumb.quaternion.copy(measured.baseQuaternion);
    const pivotMeters=.064,distalPivotMeters=.125,thumbPivotMeters=[measured.thumbSign*.026,.041,.009];
    proximal.position.copy(measured.longAxis).multiplyScalar(pivotMeters/measured.bindScale.getComponent(measured.longIndex));
    distal.position.set(0,(distalPivotMeters-pivotMeters)/measured.bindScale.getComponent(measured.longIndex),0);
    thumb.position.copy(measured.curlAxis).multiplyScalar(thumbPivotMeters[0]/measured.bindScale.getComponent(measured.widthIndex)).addScaledVector(measured.longAxis,thumbPivotMeters[1]/measured.bindScale.getComponent(measured.longIndex)).addScaledVector(measured.palmNormal,thumbPivotMeters[2]/measured.bindScale.z);
    proximal.updateMatrix();distal.updateMatrix();thumb.updateMatrix();
    const newIndex=bones.length,distalIndex=newIndex+1,thumbIndex=newIndex+2,indexLimit=skinIndex.array.BYTES_PER_ELEMENT===1?255:65535;
    if(thumbIndex>indexLimit)continue;
    let affected=0,thumbAffected=0,distalAffected=0,skippedFullSlots=0,maxWeight=0;
    for(const sample of measured.samples){
      const longitudinal=sample.metric.getComponent(measured.longIndex)*measured.longSign,thumbReach=sample.metric.getComponent(measured.widthIndex)*measured.thumbSign;
      const thumbField=smooth(.027,.060,thumbReach)*(1-smooth(.105,.143,longitudinal))*smooth(.030,.060,longitudinal);
      const fingerAmount=.985*smooth(.048,.086,longitudinal)*(1-thumbField),distalAmount=smooth(.106,.154,longitudinal);
      const support=[{index:newIndex,amount:fingerAmount*(1-distalAmount)},{index:distalIndex,amount:fingerAmount*distalAmount},{index:thumbIndex,amount:.97*thumbField}].filter(p=>p.amount>1e-7);
      if(!support.length)continue;
      const free=[];for(let slot=0;slot<4;slot++)if(skinWeight.getComponent(sample.vertex,slot)<=1e-8)free.push(slot);
      // Do not discard source forearm support to force an extra influence.
      if(free.length<support.length){skippedFullSlots++;continue;}
      const total=support.reduce((sum,p)=>sum+p.amount,0);let sourceWeight=0;
      for(let slot=0;slot<4;slot++)if(skinIndex.getComponent(sample.vertex,slot)===wristIndex&&skinWeight.getComponent(sample.vertex,slot)>0){const original=skinWeight.getComponent(sample.vertex,slot);sourceWeight+=original;skinWeight.setComponent(sample.vertex,slot,original*(1-total));}
      support.forEach((p,i)=>{skinIndex.setComponent(sample.vertex,free[i],p.index);skinWeight.setComponent(sample.vertex,free[i],sourceWeight*p.amount);maxWeight=Math.max(maxWeight,sourceWeight*p.amount);});
      affected++;if(support.some(p=>p.index===thumbIndex))thumbAffected++;if(support.some(p=>p.index===distalIndex))distalAffected++;
    }
    if(!affected)continue;
    wrist.add(proximal,thumb);proximal.add(distal);
    const relativeDistal=new THREE.Matrix4().multiplyMatrices(proximal.matrix,distal.matrix);
    for(const [control,bind,role] of [[proximal,proximal.matrix,'proximal-fused-finger-cluster'],[distal,relativeDistal,'distal-fused-finger-cluster'],[thumb,thumb.matrix,'lateral-thumb-opposition']]){
      bones.push(control);inverses.push(bind.clone().invert().multiply(originalSkeleton.boneInverses[wristIndex]));controls[control.name]=control;
      control.userData.counterGrip={role,maxAngleRadians:control===proximal?.88:control===distal?1.34:1.26,axis:[1,0,0],bindFrameQuaternion:control.quaternion.toArray(),curlAxisHandLocal:measured.curlAxis.toArray(),longitudinalAxisHandLocal:measured.longAxis.toArray(),palmClosingDirectionHandLocal:measured.palmNormal.toArray()};
    }
    const frames=[proximal,distal,thumb].map(control=>({control,position:control.position.clone(),quaternion:control.quaternion.clone(),scale:control.scale.clone()}));
    hands[side.toLowerCase()]={control:proximal,proximal,distal,thumb,wrist,wristIndex,newIndex,distalIndex,thumbIndex,frames,
      basePosition:proximal.position.clone(),baseQuaternion:proximal.quaternion.clone(),baseScale:proximal.scale.clone(),delta:new THREE.Quaternion(),opposition:new THREE.Quaternion(),grip:0,mode:'heart',angles:{proximal:0,distal:0,thumbOpposition:0,thumbFlex:0},
      measurements:{handDominantVertices:measured.samples.length,affectedVertices:affected,distalAffectedVertices:distalAffected,thumbAffectedVertices:thumbAffected,skippedFullSlots,maxSupportWeight:maxWeight,bindScale:measured.bindScale.toArray(),boundsHandLocalMeters:{min:measured.bounds.min.toArray(),max:measured.bounds.max.toArray()},hingeMeters:pivotMeters,distalHingeMeters:distalPivotMeters,thumbHingeMeters:thumbPivotMeters,fieldMeters:[.048,.086,.106,.154],thumbSign:measured.thumbSign,longitudinalAxis:measured.longAxis.toArray(),palmClosingDirection:measured.palmNormal.toArray()}};
  }
  if (!Object.keys(controls).length) { geometry.dispose(); return rig; }
  const skeleton = new THREE.Skeleton(bones, inverses);
  mesh.geometry = geometry;
  mesh.skeleton = skeleton;
  skinIndex.needsUpdate = skinWeight.needsUpdate = true;
  rig.ownedGeometry = geometry;
  rig.status = 'ready';
  rig.dispose = () => {
    if (rig.disposed) return;
    setCounterGrip(rig, {left: 0, right: 0});
    mesh.geometry = originalGeometry;
    mesh.skeleton = originalSkeleton;
    for (const control of Object.values(controls)) control.removeFromParent();
    skeleton.dispose();
    geometry.dispose();
    rig.disposed = true;
    rigs.delete(arms);
  };
  rig.skeleton = skeleton;
  rigs.set(arms, rig);
  return rig;
}

/** Absolute source-bind deformation; no accumulated Euler or vertex edits. */
export function setCounterGrip(rig,{left=0,right=0,leftMode='heart',rightMode='heart'}={}){
  if(!rig||rig.disposed)return false;
  for(const [name,hand] of Object.entries(rig.hands)){
    const requested=name==='left'?left:right,mode=name==='left'?leftMode:rightMode;
    hand.grip=THREE.MathUtils.clamp(Number.isFinite(requested)?requested:0,0,1);hand.mode=COUNTER_GRIP_MODES[mode]?mode:'heart';const tuning=COUNTER_GRIP_MODES[hand.mode];
    for(const frame of hand.frames){frame.control.position.copy(frame.position);frame.control.quaternion.copy(frame.quaternion);frame.control.scale.copy(frame.scale);}
    for(const key of Object.keys(hand.angles))hand.angles[key]=tuning[key]*hand.grip;
    hand.delta.setFromAxisAngle(AXES[0],hand.angles.proximal);hand.proximal.quaternion.multiply(hand.delta);
    hand.delta.setFromAxisAngle(AXES[0],hand.angles.distal);hand.distal.quaternion.multiply(hand.delta);
    hand.delta.setFromAxisAngle(AXES[1],-hand.measurements.thumbSign*hand.angles.thumbOpposition);
    hand.opposition.setFromAxisAngle(AXES[0],hand.angles.thumbFlex);hand.thumb.quaternion.multiply(hand.delta).multiply(hand.opposition);
    hand.wrist.updateWorldMatrix(true,true);
  }
  rig.skeleton?.update();return Object.keys(rig.hands).length>0;
}

export function counterGripDiagnostics(rig){return{status:rig?.status||'unavailable',controls:Object.keys(rig?.controls||{}).length,independentDigits:false,hands:Object.fromEntries(Object.entries(rig?.hands||{}).map(([name,hand])=>[name,{grip:hand.grip,mode:hand.mode,angles:{...hand.angles},affectedVertices:hand.measurements.affectedVertices,distalAffectedVertices:hand.measurements.distalAffectedVertices,thumbAffectedVertices:hand.measurements.thumbAffectedVertices,skippedFullSlots:hand.measurements.skippedFullSlots}]))};}
