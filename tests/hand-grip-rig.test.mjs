import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from '../vendor/utils/SkeletonUtils.js';
import {reachBiteArm} from '../player-injury-visuals.js';
import {chestHandPoint} from '../chest-finisher-visuals.js';
import {addCounterGripRig, setCounterGrip, counterGripDiagnostics, COUNTER_GRIP_MODES} from '../hand-grip-rig.js';

const url = new URL('../assets/survivor/tld-survivor-v02.glb', import.meta.url);
const raw = readFileSync(url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(raw);
const attributeBytes = attribute => Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength);
let gltf, source, sourceMesh, attributeHashes, indexHash, inverseSnapshot, clipsSnapshot;
test.before(async () => {
  const oldBitmap = globalThis.createImageBitmap, oldSelf = globalThis.self;
  // Decode inside a registered hook, not an awaited module initialization:
  // Node's shared --test-isolation=none runner must finish loading the test
  // module before an asynchronous GLTF dependency can enter its test scope.
  // Only bitmap decoding is stubbed; the real imported GLB and rig are parsed.
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({width: 1, height: 1, close() {}});
  try {
    gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset+raw.byteLength), '');
  } finally {
    if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap;
    if (oldSelf === undefined) delete globalThis.self; else globalThis.self = oldSelf;
  }
  source = gltf.scene; sourceMesh = source.getObjectByName('TLD_Remote_Arms');
  attributeHashes = Object.fromEntries(Object.entries(sourceMesh.geometry.attributes).map(([name, attribute]) => [name, hash(attributeBytes(attribute))]));
  indexHash = hash(attributeBytes(sourceMesh.geometry.index));
  inverseSnapshot = sourceMesh.skeleton.boneInverses.map(matrix => matrix.toArray());
  clipsSnapshot = gltf.animations.map(clip => ({name: clip.name, duration: clip.duration,
    tracks: clip.tracks.map(track => ({name: track.name, times: [...track.times], values: [...track.values]}))}));
});

function fixture(transform = false) {
  const actor = cloneSkeleton(source), wrapper = new THREE.Group();
  wrapper.add(actor);
  if (transform) {
    wrapper.position.set(12, 5, -9);
    wrapper.rotation.set(.15, 2.3, -.1);
    wrapper.scale.setScalar(.01);
  }
  wrapper.updateMatrixWorld(true);
  const mesh = actor.getObjectByName('TLD_Remote_Arms');
  mesh.skeleton.update();
  return {actor, wrapper, mesh, originalGeometry: mesh.geometry, originalSkeleton: mesh.skeleton};
}

function positions(f) {
  f.wrapper.updateMatrixWorld(true);
  f.mesh.skeleton.update();
  const point = new THREE.Vector3(), result = [];
  for (let i = 0; i < f.mesh.geometry.attributes.position.count; i++) result.push(f.mesh.getVertexPosition(i, point).clone());
  return result;
}

function near(a, b, tolerance = 1e-6) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert(Math.abs(a[i]-b[i]) <= tolerance, `component ${i}: ${a[i]} versus ${b[i]}`);
}

test('actual survivor receives serial finger controls and thumb opposition while the source asset stays exact', () => {
  const f = fixture(), original = f.originalGeometry, skeleton = f.originalSkeleton;
  const sourceBonePoses = sourceMesh.skeleton.bones.map(bone => ({p: bone.position.toArray(), q: bone.quaternion.toArray(), s: bone.scale.toArray(), children: bone.children.slice()}));
  const rig = addCounterGripRig(f.actor);
  assert.equal(rig.status, 'ready');
  assert.deepEqual(Object.keys(rig.controls), ['LeftHand_CounterCurl','LeftHand_CounterDistal','LeftHand_CounterThumb','RightHand_CounterCurl','RightHand_CounterDistal','RightHand_CounterThumb']);
  assert.equal(f.mesh.skeleton.bones.length, 30);
  assert.equal(skeleton.bones.length, 24);
  assert.equal(sourceMesh.skeleton.bones.length, 24);
  for (const [name, control] of Object.entries(rig.controls)) {
    assert.equal(control.parent.name,name.endsWith('_CounterDistal')?name.replace('_CounterDistal','_CounterCurl'):name.replace(/_Counter(Curl|Thumb)$/,''));
    assert.equal(source.getObjectByName(name), undefined);
    assert.deepEqual(control.userData.counterGrip.longitudinalAxisHandLocal, [0, 1, 0]);
    assert.deepEqual(control.userData.counterGrip.palmClosingDirectionHandLocal, [0, 0, 1]);
  }
  assert.equal(f.mesh.material, sourceMesh.material, 'shared material and imported textures remain original');
  assert.notEqual(f.mesh.geometry, original);
  for (const [name, attribute] of Object.entries(original.attributes)) {
    if (name === 'skinIndex' || name === 'skinWeight') assert.notEqual(f.mesh.geometry.attributes[name], attribute);
    else assert.equal(f.mesh.geometry.attributes[name], attribute, name+' is reused unchanged');
  }
  assert.equal(f.mesh.geometry.index, original.index, 'original topology/index is reused unchanged');
  for (let i = 0; i < 24; i++) {
    assert.equal(f.mesh.skeleton.bones[i], skeleton.bones[i]);
    assert.deepEqual(f.mesh.skeleton.boneInverses[i].toArray(), skeleton.boneInverses[i].toArray());
    assert.notEqual(f.mesh.skeleton.boneInverses[i], skeleton.boneInverses[i]);
    const bone = sourceMesh.skeleton.bones[i], pose = sourceBonePoses[i];
    assert.deepEqual(bone.position.toArray(), pose.p); assert.deepEqual(bone.quaternion.toArray(), pose.q);
    assert.deepEqual(bone.scale.toArray(), pose.s); assert.deepEqual(bone.children, pose.children);
  }
  assert.deepEqual(sourceMesh.skeleton.boneInverses.map(matrix => matrix.toArray()), inverseSnapshot);
  for (const [name, attribute] of Object.entries(sourceMesh.geometry.attributes)) assert.equal(hash(attributeBytes(attribute)), attributeHashes[name], name+' source bytes');
  assert.equal(hash(attributeBytes(sourceMesh.geometry.index)), indexHash);
  assert.equal(hash(readFileSync(url)), sourceHash, 'original GLB bytes remain exact');
  assert.deepEqual(gltf.animations.map(clip => ({name: clip.name, duration: clip.duration,
    tracks: clip.tracks.map(track => ({name: track.name, times: [...track.times], values: [...track.values]}))})), clipsSnapshot);
  rig.dispose();
});

test('actual two-stage hand curl wraps measured fingertips around the heart anchor with opposed thumbs and stable palms',()=>{
  const f=fixture(),before=positions(f),sourceWeights=f.originalGeometry.attributes.skinWeight,sourceIndices=f.originalGeometry.attributes.skinIndex,rig=addCounterGripRig(f.actor),neutral=positions(f);
  for(let i=0;i<before.length;i++)assert(before[i].distanceTo(neutral[i])<2e-5,'support bind leaves imported open skin unchanged');
  setCounterGrip(rig,{left:1,right:1});const closed=positions(f),outIndex=f.mesh.geometry.attributes.skinIndex,outWeight=f.mesh.geometry.attributes.skinWeight;
  for(const hand of Object.values(rig.hands)){
    const inverse=hand.wrist.matrixWorld.clone().invert(),tips=[],thumbs=[],palms=[];
    for(let vertex=0;vertex<closed.length;vertex++){
      let originalHand=0;for(let slot=0;slot<4;slot++)if(sourceIndices.getComponent(vertex,slot)===hand.wristIndex)originalHand+=sourceWeights.getComponent(vertex,slot);if(originalHand<=.5)continue;
      const p=before[vertex].clone().applyMatrix4(f.mesh.matrixWorld).applyMatrix4(inverse).multiplyScalar(hand.measurements.bindScale[1]);
      const after=closed[vertex].clone().applyMatrix4(f.mesh.matrixWorld).applyMatrix4(inverse).multiplyScalar(hand.measurements.bindScale[1]);
      if(p.y>.155)tips.push({before:p,after});
      if(p.x*hand.measurements.thumbSign>.067&&p.y<.1)thumbs.push({before:p,after});
      if(p.y<.028)palms.push(p.distanceTo(after));
    }
    assert(tips.length>150);assert(tips.every(p=>p.before.distanceTo(p.after)>.08&&p.before.distanceTo(p.after)<.15),'tip arc closes 8–15cm, rather than an open 3–6cm cluster bend');
    assert(tips.every(p=>p.after.y>.065&&p.after.y<.12&&p.after.z>.055&&p.after.z<.105),'actual fingertips curl around the .085m/.035m heart presentation anchor');
    assert(thumbs.length>8);assert(thumbs.every(p=>p.before.distanceTo(p.after)>.025),'the lateral thumb lobe opposes the curled fingers');
    assert(thumbs.reduce((sum,p)=>sum+p.after.x*hand.measurements.thumbSign,0)/thumbs.length<.06,'thumb opposition narrows the pinch without folding the palm');
    assert(palms.length>50);assert(Math.max(...palms)<2e-5,'proximal palm remains exact');
    assert(hand.measurements.affectedVertices>1200);assert(hand.measurements.distalAffectedVertices>500);assert(hand.measurements.thumbAffectedVertices>250);assert.equal(hand.measurements.skippedFullSlots,0);
  }
  for(let vertex=0;vertex<closed.length;vertex++){
    let sum=0,originalSum=0,changed=false;for(let slot=0;slot<4;slot++){const wi=outWeight.getComponent(vertex,slot),original=sourceWeights.getComponent(vertex,slot);assert(wi>=0&&wi<=1);sum+=wi;originalSum+=original;if(![15,19].includes(sourceIndices.getComponent(vertex,slot))&&original>0)assert.equal(wi,original,'forearm source weights remain exact');changed||=outIndex.getComponent(vertex,slot)>=24&&wi>0;}
    assert(Math.abs(sum-originalSum)<1e-7);if(!changed)assert(before[vertex].distanceTo(closed[vertex])<2e-5);
  }
  const d=counterGripDiagnostics(rig);assert.equal(d.controls,6);assert.equal(d.independentDigits,false);rig.dispose();
});

test('grip amounts are absolute, independent per hand, clamped and return exactly to the imported open pose', () => {
  const f = fixture(), before = positions(f), rig = addCounterGripRig(f.actor);
  setCounterGrip(rig, {left: .35, right: .8});
  const expected = positions(f), q = rig.controls.RightHand_CounterCurl.quaternion.clone();
  for (let i = 0; i < 100; i++) setCounterGrip(rig, {left: .35, right: .8});
  assert.equal(rig.controls.RightHand_CounterCurl.quaternion.angleTo(q), 0, 'curl never accumulates');
  const repeated = positions(f); for (let i = 0; i < repeated.length; i++) assert(repeated[i].distanceTo(expected[i]) < 1e-10);
  setCounterGrip(rig, {right: 99}); assert.equal(rig.hands.right.grip, 1); assert.equal(rig.hands.left.grip, 0);
  setCounterGrip(rig, {left: -4, right: NaN}); assert.equal(rig.hands.left.grip, 0); assert.equal(rig.hands.right.grip, 0);
  const restored = positions(f); for (let i = 0; i < before.length; i++) assert(before[i].distanceTo(restored[i]) < 2e-5);
  near(rig.controls.LeftHand_CounterCurl.quaternion.toArray(), rig.hands.left.baseQuaternion.toArray(), 0);
  near(rig.controls.RightHand_CounterCurl.quaternion.toArray(), rig.hands.right.baseQuaternion.toArray(), 0);
  rig.dispose();
});

test('original bind fields and curl shape survive scaled, rotated and translated ancestors', () => {
  const a = fixture(), b = fixture(true), ra = addCounterGripRig(a.actor), rb = addCounterGripRig(b.actor);
  assert.deepEqual(rb.hands.left.measurements, ra.hands.left.measurements);
  assert.deepEqual(rb.hands.right.measurements, ra.hands.right.measurements);
  assert.deepEqual([...a.mesh.geometry.attributes.skinIndex.array], [...b.mesh.geometry.attributes.skinIndex.array]);
  assert.deepEqual([...a.mesh.geometry.attributes.skinWeight.array], [...b.mesh.geometry.attributes.skinWeight.array]);
  setCounterGrip(ra, {left: .9, right: .9}); setCounterGrip(rb, {left: .9, right: .9});
  const pa = positions(a), pb = positions(b), inverse = b.wrapper.matrixWorld.clone().invert();
  for (let i = 0; i < pa.length; i++) {
    const worldA = pa[i].clone().applyMatrix4(a.mesh.matrixWorld);
    const unwrappedB = pb[i].clone().applyMatrix4(b.mesh.matrixWorld).applyMatrix4(inverse);
    // Three stores skinning palettes as float32. The deliberately extreme
    // 0.01 wrapper magnifies their world-translation roundoff when unwrapped;
    // the measured upper bound is under 0.1 mm in the original actor frame.
    assert(worldA.distanceTo(unwrappedB) < .00012, 'bone deformation is invariant within float32 skinning precision');
  }
  ra.dispose(); rb.dispose();
});

test('added geometry and skeleton texture cleanup is isolated and idempotent', () => {
  const f = fixture();
  let sourceGeometryDisposals = 0, sourceTextureDisposals = 0, sourceMaterialDisposals = 0;
  f.originalGeometry.addEventListener('dispose', () => sourceGeometryDisposals++);
  sourceMesh.material.addEventListener('dispose', () => sourceMaterialDisposals++);
  f.originalSkeleton.computeBoneTexture();
  const originalTexture = f.originalSkeleton.boneTexture;
  originalTexture.addEventListener('dispose', () => sourceTextureDisposals++);
  const rig = addCounterGripRig(f.actor);
  assert.equal(addCounterGripRig(f.actor), rig, 'repeated installation reuses its existing rig');
  let geometryDisposals = 0, textureDisposals = 0;
  rig.ownedGeometry.addEventListener('dispose', () => geometryDisposals++);
  rig.skeleton.computeBoneTexture();
  const ownedTexture = rig.skeleton.boneTexture;
  ownedTexture.addEventListener('dispose', () => textureDisposals++);
  setCounterGrip(rig, {right: 1}); rig.dispose(); rig.dispose();
  assert.equal(f.mesh.geometry, f.originalGeometry); assert.equal(f.mesh.skeleton, f.originalSkeleton);
  assert.equal(f.originalSkeleton.boneTexture, originalTexture);
  assert.equal(sourceGeometryDisposals, 0); assert.equal(sourceTextureDisposals, 0); assert.equal(sourceMaterialDisposals, 0);
  assert.equal(geometryDisposals, 1); assert.equal(textureDisposals, 1); assert.equal(rig.skeleton.boneTexture, null);
  for (const control of Object.values(rig.controls)) assert.equal(control.parent, null);
  assert.equal(setCounterGrip(rig, {right: 1}), false);
  const next = addCounterGripRig(f.actor); assert.equal(next.status, 'ready'); assert.notEqual(next, rig); next.dispose();
  f.originalSkeleton.dispose();
});

test('actors without the imported arm surface retain their existing scene unchanged', () => {
  const actor = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material); actor.add(mesh);
  const rig = addCounterGripRig(actor);
  assert.equal(rig.status, 'unavailable'); assert.deepEqual(rig.controls, {}); assert.equal(rig.ownedGeometry, null);
  assert.equal(mesh.geometry, geometry); assert.equal(actor.children.length, 1);
  rig.dispose(); geometry.dispose(); material.dispose();
});


test('heart, firearm and brace modes remain bounded through imported-animation plus F/RB/V reach phases',()=>{
  const f=fixture(),rig=addCounterGripRig(f.actor),mixer=new THREE.AnimationMixer(f.actor),idle=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle_Relaxed')).play();
  const frameSamples=[];
  for(const kind of ['chop','twist','rip','pierce'])for(const elapsed of [0,.08,.24,.46,.68,.94,1.0,1.28,1.5]){
    mixer.setTime(elapsed);f.wrapper.updateMatrixWorld(true);const amount=Math.sin(Math.PI*Math.min(1,elapsed/1.5));
    for(const [prefix,sign]of [['Left',-1],['Right',1]]){
      const upper=f.actor.getObjectByName(prefix+'Arm'),lower=f.actor.getObjectByName(prefix+'ForeArm'),hand=f.actor.getObjectByName(prefix+'Hand');
      const offset=kind==='pierce'?chestHandPoint(prefix,elapsed):new THREE.Vector3(sign*(kind==='twist'?.14:.12),kind==='rip'?-.15:0,kind==='chop'?.35:.15);
      const target=offset.add(new THREE.Vector3(0,1.35,.40));assert(reachBiteArm(upper,lower,hand,target,new THREE.Vector3(sign*.72,.85,.20),amount));
    }
    const mode=kind==='pierce'?(elapsed>1.2?'gun':'heart'):'brace';setCounterGrip(rig,{left:amount,right:amount,leftMode:mode,rightMode:mode});
    const vertex=positions(f),wristPoses=['LeftHand','RightHand'].map(name=>f.actor.getObjectByName(name).quaternion.clone());
    for(const value of vertex)assert(Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z));
    const before=Object.values(rig.controls).map(b=>b.quaternion.clone());setCounterGrip(rig,{left:amount,right:amount,leftMode:mode,rightMode:mode});Object.values(rig.controls).forEach((b,i)=>assert(b.quaternion.angleTo(before[i])<1e-7));
    ['LeftHand','RightHand'].forEach((name,i)=>assert(f.actor.getObjectByName(name).quaternion.angleTo(wristPoses[i])<1e-7,'grip does not replace wrist IK authority'));
    for(const hand of Object.values(rig.hands)){assert.equal(hand.mode,mode);for(const [key,angle]of Object.entries(hand.angles))assert(angle>=0&&angle<=COUNTER_GRIP_MODES[mode][key]+1e-8);}
    frameSamples.push({kind,elapsed,mode});
  }
  assert.equal(frameSamples.length,36);assert(frameSamples.some(p=>p.mode==='gun'));mixer.stopAllAction();setCounterGrip(rig);assert(Object.values(rig.hands).every(h=>Object.values(h.angles).every(angle=>angle===0)));rig.dispose();
  // The imported clip data and original bind palette were never rewritten.
  assert.deepEqual(gltf.animations.map(clip=>({name:clip.name,duration:clip.duration,tracks:clip.tracks.map(track=>({name:track.name,times:[...track.times],values:[...track.values]}))})),clipsSnapshot);
});

// Exact local counter-arm poses from the accepted PC windup/extraction capture.
const PC_COUNTER_ARM_POSES=[{"phase":"01-thrust-windup","grip":{"left":0.1789328492717978,"right":0},"pose":[{"name":"BrutalSurvivorArms","p":[25.91,0,97.8441154273188],"q":[0,0.25881904510252113,0,0.9659258262890682],"s":[1,1,1],"visible":true},{"name":"TLD_World_Root","p":[0,0,0],"q":[0,1,0,-4.371138828673793e-8],"s":[1.0639712810516357,1.0639712810516357,1.0639712810516357],"visible":true},{"name":"TLD_Meshy_Survivor","p":[0,0,0],"q":[0,0,0,1],"s":[0.009999999776482582,0.009999999776482582,0.009999999776482582],"visible":true},{"name":"TLD_Head_Hide_For_Local_Player","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_Local_Torso_Legs","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_Remote_Arms","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":true},{"name":"Hips","p":[0.46308761835098267,83.87593078613281,1.7863836288452148],"q":[-0.9981748461723328,0.013410438783466816,-0.03427489846944809,0.0478786937892437],"s":[0.9999998211860657,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"LeftUpLeg","p":[9.561832427978516,9.158835411071777,0.1574115753173828],"q":[-0.38531509041786194,-0.09069344401359558,-0.06549956649541855,0.9159786105155945],"s":[1.0000137090682983,1.0000007152557373,1.000006079673767],"visible":true},{"name":"LeftLeg","p":[0.00001194203105114866,35.522430419921875,-0.000001418191004631808],"q":[0.9017162322998047,0.025476956740021706,-0.14920441806316376,0.40496528148651123],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896],"visible":true},{"name":"LeftFoot","p":[-0.000006223892796697328,38.23489761352539,0.000004722447101812577],"q":[-0.4545043110847473,-0.055116213858127594,-0.02384059876203537,0.8887180089950562],"s":[1.0000001192092896,1.000000238418579,0.9999999403953552],"visible":true},{"name":"LeftToeBase","p":[0.000002551633542680065,12.109764099121094,0.0000031080439839570317],"q":[-0.22928071022033691,0.01322107668966055,-0.023503988981246948,0.9729866981506348],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896],"visible":true},{"name":"Spine02","p":[0.4900600016117096,-13.550336837768555,-0.9252773523330688],"q":[-0.9852604866027832,0.0075995740480721,-0.1056097000837326,0.1343526840209961],"s":[1.0000019073486328,1.0000001192092896,1.0000025033950806],"visible":true},{"name":"Spine01","p":[-3.8137648061820073e-7,13.590734481811523,-0.000003331076868562377],"q":[-0.03357452526688576,0.016236353665590286,0.011728711426258087,0.9992355108261108],"s":[0.9999998211860657,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"Spine","p":[7.81456606091524e-7,13.590738296508789,-0.0000012707932910416275],"q":[-0.1579151600599289,0.014017151668667793,0.011131824925541878,0.9872904419898987],"s":[0.9999998807907104,0.9999997615814209,0.9999998211860657],"visible":true},{"name":"neck","p":[0.0803263932466507,10.21062183380127,1.709387183189392],"q":[0.1214873418211937,-0.013346412219107151,-0.030077137053012848,0.9920474290847778],"s":[1,1,0.9999997019767761],"visible":true},{"name":"Head","p":[2.7545650027605006e-7,7.121054172515869,-0.000010849738828255795],"q":[0.11349458247423172,-0.05635771527886391,0.018730055540800095,0.991762101650238],"s":[1.0000003576278687,0.9999998211860657,1.0000001192092896],"visible":true},{"name":"head_end","p":[0.05172758176922798,15.459712028503418,-8.341450691223145],"q":[-0.24830558896064758,-0.0004889966221526265,-0.002268661977723241,0.9686790108680725],"s":[0.9999997615814209,1.000000238418579,0.9999997019767761],"visible":true},{"name":"headfront","p":[-0.05172746628522873,5.49720573425293,8.341536521911621],"q":[0.4741925597190857,-8.403063134210242e-8,0.0029405022505670786,0.8804162740707397],"s":[0.9999995231628418,1,1],"visible":true},{"name":"LeftShoulder","p":[3.5245606899261475,3.0001516342163086,-0.8254780769348145],"q":[0.6153454780578613,0.5336926579475403,-0.43947428464889526,0.3786616027355194],"s":[0.9999999403953552,1.000000238418579,0.9999996423721313],"visible":true},{"name":"LeftArm","p":[0.000002708285819608136,14.143634796142578,0.00001610673098184634],"q":[-0.46128513462301945,0.5944103390498582,0.2714104971244084,0.600190609276265],"s":[0.9999999403953552,0.9999998807907104,1.0000001192092896],"visible":true},{"name":"LeftForeArm","p":[-0.000014496688891085796,27.966310501098633,0.00014828921121079475],"q":[-0.7197848387339774,-0.5080875606865733,0.11384568483212128,0.45912537838403156],"s":[1.0000001192092896,1.000000238418579,0.9999999403953552],"visible":true},{"name":"LeftHand","p":[2.685552544789971e-7,27.14671516418457,-0.00018896897381637245],"q":[-0.290240918425631,-0.8151597194072115,0.30925652624603356,0.3945061754125607],"s":[1,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"RightShoulder","p":[-3.6048903465270996,2.79597806930542,-0.8839178085327148],"q":[0.5912587642669678,-0.5475763082504272,0.4508790373802185,0.383772611618042],"s":[0.9999996423721313,0.9999997615814209,0.9999996423721313],"visible":true},{"name":"RightArm","p":[-0.0000012403611435729545,14.487109184265137,0.000032146719604497775],"q":[-0.04643670289206192,0.13135692133112725,-0.48805656220704463,0.8616206230703696],"s":[1,0.9999998211860657,0.9999998807907104],"visible":true},{"name":"RightForeArm","p":[0.0000016816056813695468,28.289844512939453,-0.0000101239120340324],"q":[-0.06373766119460801,0.07352895027307303,-0.7410099213516891,0.6644059540019835],"s":[1.0000003576278687,1.0000001192092896,1.000000238418579],"visible":true},{"name":"RightHand","p":[-3.5001465903405915e-7,26.149551391601562,-0.000054133404773892835],"q":[-0.5237571338461244,0.7706623470578085,0.15004920019998597,0.33052032104587714],"s":[1.0000001192092896,0.9999997019767761,0.9999998211860657],"visible":true},{"name":"RightUpLeg","p":[-10.051897048950195,8.514379501342773,0.7678694725036621],"q":[0.019744882360100746,0.11657850444316864,0.0023314293939620256,0.9929824471473694],"s":[0.9999924302101135,0.9999995827674866,0.999998927116394],"visible":true},{"name":"RightLeg","p":[0.000014193258721206803,35.740665435791016,4.83184237509704e-7],"q":[0.3170996904373169,-0.10307463258504868,0.05446753650903702,0.9411996006965637],"s":[0.9999999403953552,0.9999999403953552,0.9999999403953552],"visible":true},{"name":"RightFoot","p":[0.000007953600288601592,36.6456298828125,0.000011928058484045323],"q":[-0.5154103636741638,-0.03894477337598801,0.006010232958942652,0.8560370206832886],"s":[0.9999999403953552,0.9999998807907104,0.9999999403953552],"visible":true},{"name":"RightToeBase","p":[9.59981321102532e-7,12.98293399810791,-0.0000018638149867911125],"q":[-0.5183954238891602,0.03295733779668808,0.00791078619658947,0.8544691205024719],"s":[0.9999999403953552,1.0000001192092896,1],"visible":true},{"name":"TLD_ViewSleeve_Left","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_ViewSleeve_Right","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false}]},{"phase":"03-heart-extraction","grip":{"left":0.18,"right":1},"pose":[{"name":"BrutalSurvivorArms","p":[25.91,0,97.8441154273188],"q":[0,0.25881904510252113,0,0.9659258262890682],"s":[1,1,1],"visible":true},{"name":"TLD_World_Root","p":[0,0,0],"q":[0,1,0,-4.371138828673793e-8],"s":[1.0639712810516357,1.0639712810516357,1.0639712810516357],"visible":true},{"name":"TLD_Meshy_Survivor","p":[0,0,0],"q":[0,0,0,1],"s":[0.009999999776482582,0.009999999776482582,0.009999999776482582],"visible":true},{"name":"TLD_Head_Hide_For_Local_Player","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_Local_Torso_Legs","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_Remote_Arms","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":true},{"name":"Hips","p":[0.46308761835098267,83.87593078613281,1.7863836288452148],"q":[-0.9981748461723328,0.013410438783466816,-0.03427489846944809,0.0478786937892437],"s":[0.9999998211860657,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"LeftUpLeg","p":[9.561832427978516,9.158835411071777,0.1574115753173828],"q":[-0.38531509041786194,-0.09069344401359558,-0.06549956649541855,0.9159786105155945],"s":[1.0000137090682983,1.0000007152557373,1.000006079673767],"visible":true},{"name":"LeftLeg","p":[0.00001194203105114866,35.522430419921875,-0.000001418191004631808],"q":[0.9017162322998047,0.025476956740021706,-0.14920441806316376,0.40496528148651123],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896],"visible":true},{"name":"LeftFoot","p":[-0.000006223892796697328,38.23489761352539,0.000004722447101812577],"q":[-0.4545043110847473,-0.055116213858127594,-0.02384059876203537,0.8887180089950562],"s":[1.0000001192092896,1.000000238418579,0.9999999403953552],"visible":true},{"name":"LeftToeBase","p":[0.000002551633542680065,12.109764099121094,0.0000031080439839570317],"q":[-0.22928071022033691,0.01322107668966055,-0.023503988981246948,0.9729866981506348],"s":[1.0000001192092896,1.0000001192092896,1.0000001192092896],"visible":true},{"name":"Spine02","p":[0.4900600016117096,-13.550336837768555,-0.9252773523330688],"q":[-0.9852604866027832,0.0075995740480721,-0.1056097000837326,0.1343526840209961],"s":[1.0000019073486328,1.0000001192092896,1.0000025033950806],"visible":true},{"name":"Spine01","p":[-3.8137648061820073e-7,13.590734481811523,-0.000003331076868562377],"q":[-0.03357452526688576,0.016236353665590286,0.011728711426258087,0.9992355108261108],"s":[0.9999998211860657,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"Spine","p":[7.81456606091524e-7,13.590738296508789,-0.0000012707932910416275],"q":[-0.1579151600599289,0.014017151668667793,0.011131824925541878,0.9872904419898987],"s":[0.9999998807907104,0.9999997615814209,0.9999998211860657],"visible":true},{"name":"neck","p":[0.0803263932466507,10.21062183380127,1.709387183189392],"q":[0.1214873418211937,-0.013346412219107151,-0.030077137053012848,0.9920474290847778],"s":[1,1,0.9999997019767761],"visible":true},{"name":"Head","p":[2.7545650027605006e-7,7.121054172515869,-0.000010849738828255795],"q":[0.11349458247423172,-0.05635771527886391,0.018730055540800095,0.991762101650238],"s":[1.0000003576278687,0.9999998211860657,1.0000001192092896],"visible":true},{"name":"head_end","p":[0.05172758176922798,15.459712028503418,-8.341450691223145],"q":[-0.24830558896064758,-0.0004889966221526265,-0.002268661977723241,0.9686790108680725],"s":[0.9999997615814209,1.000000238418579,0.9999997019767761],"visible":true},{"name":"headfront","p":[-0.05172746628522873,5.49720573425293,8.341536521911621],"q":[0.4741925597190857,-8.403063134210242e-8,0.0029405022505670786,0.8804162740707397],"s":[0.9999995231628418,1,1],"visible":true},{"name":"LeftShoulder","p":[3.5245606899261475,3.0001516342163086,-0.8254780769348145],"q":[0.6153454780578613,0.5336926579475403,-0.43947428464889526,0.3786616027355194],"s":[0.9999999403953552,1.000000238418579,0.9999996423721313],"visible":true},{"name":"LeftArm","p":[0.000002708285819608136,14.143634796142578,0.00001610673098184634],"q":[-0.4980933927523854,0.6051009423376389,0.24185535297138233,0.572068057395309],"s":[0.9999999403953552,0.9999998807907104,1.0000001192092896],"visible":true},{"name":"LeftForeArm","p":[-0.000014496688891085796,27.966310501098633,0.00014828921121079475],"q":[-0.6768069819009402,-0.5016307982617256,-0.03370722516065813,0.5377384753385678],"s":[1.0000001192092896,1.000000238418579,0.9999999403953552],"visible":true},{"name":"LeftHand","p":[2.685552544789971e-7,27.14671516418457,-0.00018896897381637245],"q":[-0.3131235905003354,-0.8666105771680415,0.2874158489939929,0.2614035699442644],"s":[1,0.9999999403953552,0.9999998807907104],"visible":true},{"name":"RightShoulder","p":[-3.6048903465270996,2.79597806930542,-0.8839178085327148],"q":[0.5912587642669678,-0.5475763082504272,0.4508790373802185,0.383772611618042],"s":[0.9999996423721313,0.9999997615814209,0.9999996423721313],"visible":true},{"name":"RightArm","p":[-0.0000012403611435729545,14.487109184265137,0.000032146719604497775],"q":[-0.27649215148201023,-0.2417509805091057,0.4352696268792695,0.8219788457125108],"s":[1,0.9999998211860657,0.9999998807907104],"visible":true},{"name":"RightForeArm","p":[0.0000016816056813695468,28.289844512939453,-0.0000101239120340324],"q":[-0.40472983801620954,0.291118393473505,-0.8629850446048539,-0.0818607359625505],"s":[1.0000003576278687,1.0000001192092896,1.000000238418579],"visible":true},{"name":"RightHand","p":[-3.5001465903405915e-7,26.149551391601562,-0.000054133404773892835],"q":[-0.48840258956914484,0.687817344458621,-0.382277823856655,0.37713797375321206],"s":[1.0000001192092896,0.9999997019767761,0.9999998211860657],"visible":true},{"name":"RightUpLeg","p":[-10.051897048950195,8.514379501342773,0.7678694725036621],"q":[0.019744882360100746,0.11657850444316864,0.0023314293939620256,0.9929824471473694],"s":[0.9999924302101135,0.9999995827674866,0.999998927116394],"visible":true},{"name":"RightLeg","p":[0.000014193258721206803,35.740665435791016,4.83184237509704e-7],"q":[0.3170996904373169,-0.10307463258504868,0.05446753650903702,0.9411996006965637],"s":[0.9999999403953552,0.9999999403953552,0.9999999403953552],"visible":true},{"name":"RightFoot","p":[0.000007953600288601592,36.6456298828125,0.000011928058484045323],"q":[-0.5154103636741638,-0.03894477337598801,0.006010232958942652,0.8560370206832886],"s":[0.9999999403953552,0.9999998807907104,0.9999999403953552],"visible":true},{"name":"RightToeBase","p":[9.59981321102532e-7,12.98293399810791,-0.0000018638149867911125],"q":[-0.5183954238891602,0.03295733779668808,0.00791078619658947,0.8544691205024719],"s":[0.9999999403953552,1.0000001192092896,1],"visible":true},{"name":"TLD_ViewSleeve_Left","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false},{"name":"TLD_ViewSleeve_Right","p":[0,0,0],"q":[0,0,0,1],"s":[1,1,1],"visible":false}]}];

test('accepted windup and extraction source poses support the new grasp without deforming the imported sleeve',()=>{
  for(const frame of PC_COUNTER_ARM_POSES){
    const f=fixture();f.actor.name='BrutalSurvivorArms';for(const saved of frame.pose){const node=f.actor.getObjectByName(saved.name);assert(node,saved.name+' matches actual source');node.position.fromArray(saved.p);node.quaternion.fromArray(saved.q);node.scale.fromArray(saved.s);node.visible=saved.visible;}
    const before=positions(f),originalIndices=f.originalGeometry.attributes.skinIndex,originalWeights=f.originalGeometry.attributes.skinWeight,rig=addCounterGripRig(f.actor);
    setCounterGrip(rig,{...frame.grip,leftMode:'brace',rightMode:'heart'});const after=positions(f);let sleeveVertices=0;
    for(let vertex=0;vertex<after.length;vertex++){
      assert(Number.isFinite(after[vertex].x)&&Number.isFinite(after[vertex].y)&&Number.isFinite(after[vertex].z));let handWeight=0;for(let slot=0;slot<4;slot++)if([15,19].includes(originalIndices.getComponent(vertex,slot)))handWeight+=originalWeights.getComponent(vertex,slot);
      if(handWeight<=.5){sleeveVertices++;assert(before[vertex].distanceTo(after[vertex])<2e-5,'real photographed sleeve geometry remains unchanged by stronger fingers');}
    }
    assert(sleeveVertices>9000);assert.equal(f.actor.getObjectByName('TLD_ViewSleeve_Left').visible,false);assert.equal(f.actor.getObjectByName('TLD_ViewSleeve_Right').visible,false);
    rig.dispose();
  }
});
