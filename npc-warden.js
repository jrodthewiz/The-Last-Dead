import * as THREE from './vendor/three.module.js';
import {clone} from './vendor/utils/SkeletonUtils.js';


// Authored regalia keeps the imported anatomy as the animated base while adding the
// silhouette and material layers that make the Warden readable in the dark. Every
// attachment lives under a named group so it remains explodable/pickable at runtime.
let sharedRegaliaMaps;
function regaliaMaps(seed = 17) {
 if (sharedRegaliaMaps) return sharedRegaliaMaps;
 const size = 64;
 const albedo = new Uint8Array(size * size * 4);
 const roughness = new Uint8Array(size * size * 4);
 const bump = new Uint8Array(size * size * 4);
 const noise = (x, y) => {
  const n = Math.sin((x + seed) * 12.9898 + (y - seed) * 78.233) * 43758.5453;
  return n - Math.floor(n);
 };
 for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const i = (y * size + x) * 4;
  const grain = noise(x, y);
  const striation = Math.sin(x * .28 + Math.sin(y * .12) * 2.7) * .5 + .5;
  const pitted = Math.max(0, grain - .76) * 3.8;
  const value = Math.max(32, Math.min(255, 96 + striation * 46 - pitted * 26));
  const r = Math.max(16, Math.min(255, 116 + striation * 56 - pitted * 72));
  const n = Math.max(0, Math.min(255, 126 + (striation - .5) * 64 + (grain - .5) * 24 - pitted * 32));
  albedo[i] = value; albedo[i + 1] = Math.max(0, value - 4); albedo[i + 2] = Math.max(0, value - 8); albedo[i + 3] = 255;
  roughness[i] = r; roughness[i + 1] = r; roughness[i + 2] = r; roughness[i + 3] = 255;
  bump[i] = n; bump[i + 1] = n; bump[i + 2] = n; bump[i + 3] = 255;
 }
 const texture = (data, colorSpace = false) => {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.userData.sharedAsset = true;
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
 };
 sharedRegaliaMaps = {albedo: texture(albedo, true), roughness: texture(roughness), bump: texture(bump)};
 return sharedRegaliaMaps;
}

function extrudedProfile(points, depth = .04, bevel = .012) {
 const shape = new THREE.Shape(points.map(point => new THREE.Vector2(point[0], point[1])));
 const geometry = new THREE.ExtrudeGeometry(shape, {
  depth,
  bevelEnabled: true,
  bevelThickness: bevel,
  bevelSize: bevel,
  bevelSegments: 2,
  curveSegments: 8,
 });
 geometry.translate(0, 0, -depth * .5);
 return geometry;
}

function addRegaliaMesh(parent, geometry, material, name, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
 const mesh = new THREE.Mesh(geometry, material);
 mesh.name = name;
 mesh.position.set(...position);
 mesh.scale.set(...scale);
 mesh.rotation.set(...rotation);
 mesh.castShadow = true;
 mesh.receiveShadow = true;
 mesh.userData.explodeWithParent = true;
 parent.add(mesh);
 return mesh;
}

function buildRegalia(pivot, kind, accent) {
 const root = new THREE.Group();
 root.name = 'WardenRegalia';
 root.userData.explodeWithParent = true;
 const maps = regaliaMaps();
 const armor = new THREE.MeshPhysicalMaterial({
  color: 0x403438,
  roughness: .72,
  metalness: .62,
  clearcoat: .08,
  clearcoatRoughness: .62,
  map: maps.albedo,
  roughnessMap: maps.roughness,
  bumpMap: maps.bump,
  bumpScale: .028,
 });
 const leather = new THREE.MeshStandardMaterial({
  color: 0x39242a,
  roughness: .88,
  metalness: .08,
  map: maps.albedo,
  roughnessMap: maps.roughness,
  bumpMap: maps.bump,
  bumpScale: .018,
 });
 const bone = new THREE.MeshStandardMaterial({color: 0x7b6257, roughness: .8, metalness: .06, bumpMap: maps.bump, bumpScale: .012});
 const signalMaterial = new THREE.MeshPhysicalMaterial({
  color: accent,
  emissive: accent,
  emissiveIntensity: 1.6,
  roughness: .28,
  metalness: .18,
  clearcoat: .55,
  clearcoatRoughness: .15,
 });
 const edgeMaterial = new THREE.MeshStandardMaterial({color: accent, emissive: accent, emissiveIntensity: .55, roughness: .36, metalness: .65});
 const voidMaterial = new THREE.MeshStandardMaterial({color: 0x020205, roughness: 1, metalness: 0, side: THREE.DoubleSide});
 const parts = {};
 const part = name => {
  const group = new THREE.Group();
  group.name = name;
  group.userData.explodeWithParent = true;
  root.add(group);
  parts[name] = group;
  return group;
 };

 const chest = part('chest-plate');
 const silhouette = kind === 2 ? 1.12 : kind === 1 ? 1.03 : .94;
 const plate = addRegaliaMesh(chest, extrudedProfile([
  [-.31, .16], [-.27, .31], [-.18, .42], [0, .46], [.18, .42], [.27, .31], [.31, .16], [.21, -.2], [0, -.28], [-.21, -.2]
 ], .065, .022), armor, 'chest-plate-shell', [0, 1.12, .18], [.62 * silhouette, .42, 1], [0, 0, 0]);
 plate.userData.attachment = {parentSocket: 'chest', localStart: [0, .84, .19], localEnd: [0, 1.43, .23], contactType: 'overlap', embedDepth: .03, gapTolerance: .015};
 addRegaliaMesh(chest, new THREE.TorusGeometry(.165 * silhouette, .018, 8, 24), edgeMaterial, 'chest-sigil-outer', [0, 1.16, .274], [1, 1, 1], [Math.PI / 2, 0, 0]);
 addRegaliaMesh(chest, new THREE.TorusGeometry(.085 * silhouette, .011, 7, 18), edgeMaterial, 'chest-sigil-inner', [0, 1.16, .289], [1, 1, 1], [Math.PI / 2, 0, 0]);
 addRegaliaMesh(chest, new THREE.ConeGeometry(.026, .14, 6), edgeMaterial, 'chest-sigil-spine', [0, 1.16, .292]);
 const signal = addRegaliaMesh(chest, new THREE.SphereGeometry(kind === 2 ? .062 : .052, 16, 12), signalMaterial, 'chest-signal', [0, 1.16, .31]);

 const shoulders = part('shoulder-plates');
 for (const side of [-1, 1]) {
  const y = 1.37 + (kind === 2 ? .03 : 0);
  const shoulder = addRegaliaMesh(shoulders, new THREE.SphereGeometry(1, 18, 10), armor, `shoulder-${side}`, [side * .37, y - .04, .02], [.17 * silhouette, .085 * silhouette, .125]);
  shoulder.userData.attachment = {parentSocket: side < 0 ? 'leftShoulder' : 'rightShoulder', localStart: [side * .28, 1.39, 0], localEnd: [side * .54, 1.46, .02], contactType: 'overlap', embedDepth: .04, gapTolerance: .018};
  const spike = addRegaliaMesh(shoulders, new THREE.ConeGeometry(.045 * silhouette, .2 * silhouette, 7), bone, `shoulder-spike-${side}`, [side * .42, y + .065, .01], [1, 1, 1], [0, 0, side * -.42]);
  spike.rotation.z = side * -.42;
  addRegaliaMesh(shoulders, new THREE.TorusGeometry(.085 * silhouette, .01, 6, 18), edgeMaterial, `shoulder-rune-${side}`, [side * .37, y - .03, .15], [1, 1, 1], [Math.PI / 2, 0, 0]);
 }

 const collar = part('collar');
 addRegaliaMesh(collar, new THREE.TorusGeometry(.16 * silhouette, .03, 8, 24), armor, 'collar-ring', [0, 1.48, -.14], [1, 1, .74], [Math.PI / 2, 0, 0]);
 for (const side of [-1, 1]) addRegaliaMesh(collar, new THREE.ConeGeometry(.036, .17, 6), bone, `collar-fang-${side}`, [side * .12, 1.51, .05], [1, 1, 1], [side * .56, 0, 0]);

 const belt = part('waist-harness');
 addRegaliaMesh(belt, new THREE.CylinderGeometry(.36 * silhouette, .39 * silhouette, .09, 16), leather, 'waist-harness-band', [0, .79, 0], [1, 1, .62]);
 addRegaliaMesh(belt, new THREE.BoxGeometry(.12, .14, .055), edgeMaterial, 'waist-harness-clasp', [0, .8, .255]);
 for (const side of [-1, 1]) {
  const strap = addRegaliaMesh(belt, new THREE.BoxGeometry(.045, .46, .032), leather, `waist-strap-${side}`, [side * .24, .61, .2], [1, 1, 1], [0, side * .08, side * .08]);
  strap.userData.attachment = {parentSocket: 'pelvis', localStart: [side * .2, .82, .18], localEnd: [side * .25, .4, .2], contactType: 'overlap', embedDepth: .02, gapTolerance: .015};
 }

 const mantle = part('torn-mantle');
 const mantleMat = new THREE.MeshStandardMaterial({color: 0x110f15, roughness: .96, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: .9, map: maps.albedo, roughnessMap: maps.roughness, bumpMap: maps.bump, bumpScale: .012});
 for (const side of [-1, 1]) {
  const shape = new THREE.Shape();
  shape.moveTo(0, .32); shape.lineTo(side * .34, .2); shape.lineTo(side * .55, -.14); shape.lineTo(side * .44, -.32); shape.lineTo(side * .6, -.58); shape.lineTo(side * .2, -.43); shape.lineTo(0, -.12); shape.closePath();
  const cloth = addRegaliaMesh(mantle, new THREE.ShapeGeometry(shape), mantleMat, `mantle-${side}`, [0, 1.1, -.11], [kind === 2 ? .86 : .72, kind === 2 ? .86 : .72, 1]);
  cloth.userData.baseY = cloth.position.y;
  cloth.userData.attachment = {parentSocket: side < 0 ? 'leftShoulder' : 'rightShoulder', localStart: [0, 1.42, -.08], localEnd: [side * .55, .56, -.12], contactType: 'overlap', embedDepth: .02, gapTolerance: .02};
 }

 const chain = part('ritual-chain');
 for (const side of [-1, 1]) {
  for (let i = 0; i < 4; i++) {
   const link = addRegaliaMesh(chain, new THREE.TorusGeometry(.028, .008, 5, 12), edgeMaterial, `chain-${side}-${i}`, [side * (.2 + i * .045), 1.47 - i * .17, -.02], [1, 1, 1], [Math.PI / 2, i % 2 ? .5 : -.5, side * .3]);
   link.userData.attachment = {parentSocket: side < 0 ? 'leftShoulder' : 'rightShoulder', localStart: [side * .2, 1.46, -.02], localEnd: [side * (.2 + i * .045), 1.47 - i * .17, -.02], contactType: 'overlap', embedDepth: .01, gapTolerance: .02};
  }
  addRegaliaMesh(chain, new THREE.ConeGeometry(.034, .14, 6), bone, `chain-pendant-${side}`, [side * .38, .68, -.02], [1, 1, 1], [Math.PI, 0, 0]);
 }

 const spine = part('back-spine');
 for (let i = 0; i < 4; i++) addRegaliaMesh(spine, new THREE.ConeGeometry(.04 + i * .008, .18, 6), bone, `spine-rib-${i}`, [0, 1.38 - i * .16, -.17], [1, 1, 1], [Math.PI, 0, 0]);
 if (kind === 1) addRegaliaMesh(root, new THREE.TorusGeometry(.35, .018, 7, 32), edgeMaterial, 'caster-halo', [0, 1.69, -.18], [1, 1, 1], [Math.PI / 2, 0, 0]);
 if (kind === 2) {
  addRegaliaMesh(root, new THREE.BoxGeometry(.64, .055, .12), armor, 'heavy-back-plate', [0, 1.08, -.22]);
  addRegaliaMesh(root, new THREE.TorusGeometry(.24, .018, 7, 24), edgeMaterial, 'heavy-back-sigil', [0, 1.12, -.29], [1, 1, 1], [Math.PI / 2, 0, 0]);
 }
 const regalia = {parts, signal, signalMaterial, armor, leather, bone, mantleMat, edgeMaterial, voidMaterial, baseY: 0, maps};
 root.userData.regalia = regalia;
 pivot.add(root);
 return root;
}
export function createWarden(template,clips=[],kind=0){
 const root=new THREE.Group(),pivot=new THREE.Group(),normalizer=new THREE.Group(),model=clone(template);root.name='EvilWarden';root.add(pivot);pivot.add(normalizer);normalizer.add(model);
 const mixer=clips.length?new THREE.AnimationMixer(model):null;if(mixer){mixer.clipAction(clips[0]).play();mixer.update(0);}
 model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=[1.95,2.05,2.2][kind]/size.y;
 normalizer.scale.setScalar(scale);normalizer.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);pivot.rotation.y=Math.PI;
 const accent=[0xff4936,0xad7cf5,0xffb152][kind],signalMaterial=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.7,roughness:.3});
 const signal=new THREE.Mesh(new THREE.SphereGeometry(kind===2?.072:.05,12,8),signalMaterial);signal.position.set(0,kind===2?1.34:1.15,.19);signal.visible=false;pivot.add(signal);
 const regalia=buildRegalia(pivot,kind,accent);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(kind===2?.57:.44,.018,5,28),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.y=.028;root.add(ring);ring.visible=false;
 if(kind===1){const halo=new THREE.Mesh(new THREE.TorusGeometry(.43,.025,6,28),signalMaterial);halo.position.set(0,1.55,-.17);pivot.add(halo);for(const side of[-1,1]){const thorn=new THREE.Mesh(new THREE.ConeGeometry(.065,.38,6),signalMaterial);thorn.position.set(side*.4,1.68,-.17);thorn.rotation.z=-side*.4;pivot.add(thorn);}}
 if(kind===2){const armor=new THREE.MeshStandardMaterial({color:0xaaa08a,roughness:.65,metalness:.3});for(const side of[-1,1]){const plate=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,0),armor);plate.scale.set(1.15,.65,.8);plate.position.set(side*.34,1.44,.02);pivot.add(plate);}}
 const bones=new Map(),materials=[];model.traverse(o=>{if(o.isBone)bones.set(o.name.toLowerCase().replace(/[^a-z]/g,''),{bone:o,base:o.quaternion.clone(),position:o.position.clone()});if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.envMapIntensity=.9;o.material.metalness=.06;o.material.roughness=.76;materials.push(o.material);}});
 root.userData.warden={pivot,normalizer,model,bones,materials,deadAt:null,mixer,last:0,sourceHeight:size.y,normalization:scale,kind,ring,lastPosition:null,motion:0,regalia,signal:regalia.userData.regalia.signal,regaliaParts:regalia.userData.regalia.parts};return root;
}

const q=new THREE.Quaternion(),axis=new THREE.Vector3();
function pose(bones,names,x=0,y=0,z=0){const item=names.map(n=>bones.get(n)).find(Boolean);if(!item)return;item.bone.quaternion.copy(item.base);for(const[a,v]of[[[1,0,0],x],[[0,1,0],y],[[0,0,1],z]]){axis.set(...a);q.setFromAxisAngle(axis,v);item.bone.quaternion.multiply(q);}}
export function animateWarden(root,enemy,now,seed){
 const w=root.userData.warden,t=now*.001,walk=Math.sin(t*7+seed),warning=!!enemy.attacking,attack=warning?1-Math.min(1,(enemy.windup||0)/[.28,.48,.65][w.kind]):Math.min(1,(enemy.strike||0)/.22),hit=Math.min(1,(enemy.flash||0)/.16);
 w.ring.visible=warning&&!enemy.dead;w.ring.scale.setScalar(1+attack*.35);w.signal.material.emissiveIntensity=.7+attack*3;
 if(enemy.dead){w.deadAt??=t;const fall=Math.min(1,(t-w.deadAt)*2.8);w.pivot.rotation.x=fall*1.45;w.pivot.position.y=-fall*.35;root.visible=fall<1;return;}
 w.deadAt=null;root.visible=true;w.pivot.rotation.x=.06+hit*.2;w.pivot.position.y=w.kind===1?.08+Math.sin(t*2+seed)*.035:Math.abs(walk)*.015;
 if(w.regalia){
  const regalia=w.regalia.userData.regalia;
  regalia.baseY=w.pivot.position.y;
  w.regalia.rotation.y=THREE.MathUtils.damp(w.regalia.rotation.y,Math.sin(t*1.25+seed)*.028,8,.016);
  w.regalia.position.y=Math.sin(t*2.15+seed)*.012;
  regalia.signal.scale.setScalar(1+attack*.32+hit*.2+Math.sin(t*7.6+seed)*.04);
  regalia.signalMaterial.emissiveIntensity=1.2+attack*4.5+hit*2.8;
  regalia.edgeMaterial.emissiveIntensity=.35+attack*1.8+hit*1.1;
  const mantle=w.regalia.getObjectByName('torn-mantle');
  if(mantle) mantle.children.forEach((cloth,index)=>{cloth.rotation.z=Math.sin(t*1.8+seed+index)*.035;cloth.position.y=(cloth.userData.baseY ?? 1.14)+Math.sin(t*2.4+seed+index)*.018;});
 }
 if(w.mixer){const dt=w.last?Math.min(.05,(now-w.last)/1000):.016;w.last=now;const moved=w.lastPosition?Math.hypot(root.position.x-w.lastPosition.x,root.position.z-w.lastPosition.z)/Math.max(.001,dt):0;w.lastPosition??=new THREE.Vector3();w.lastPosition.copy(root.position);w.motion+=(Math.min(3,moved)-w.motion)*Math.min(1,dt*12);w.mixer.update(dt*(warning?.08:Math.max(.06,Math.min(2.4,w.motion*.75))));const hip=w.bones.get('hips');if(hip){hip.bone.position.x=hip.position.x;hip.bone.position.z=hip.position.z;}for(const n of['leftarm','rightarm']){const b=w.bones.get(n);if(b)b.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-attack*.8));}}else{
 pose(w.bones,['hips'],0,Math.sin(t*3.5+seed)*.06,0);
 pose(w.bones,['spine','spine01'],.08+Math.sin(t*1.9)*.025,0,0);
 pose(w.bones,['head'],Math.sin(t*1.7)*.07,-Math.sin(t*1.2+seed)*.08,.05);
 pose(w.bones,['leftarm','leftupperarm'],walk*.22-attack*.75,0,-1.25+attack*.8);
 pose(w.bones,['rightarm','rightupperarm'],-walk*.22-attack*.75,0,1.25-attack*.8);
 pose(w.bones,['leftforearm','leftlowerarm'],-.2-attack*.7,0,0);pose(w.bones,['rightforearm','rightlowerarm'],-.2-attack*.7,0,0);
 pose(w.bones,['leftupleg','leftupperleg'],walk*.34,0,0);pose(w.bones,['rightupleg','rightupperleg'],-walk*.34,0,0);
 pose(w.bones,['leftleg','leftlowerleg'],Math.max(0,-walk)*.4,0,0);pose(w.bones,['rightleg','rightlowerleg'],Math.max(0,walk)*.4,0,0);
 }
 for(const m of w.materials){if(!m.emissive)continue;m.emissive.setRGB(.2+hit*.65,.2+hit*.14,.2+hit*.1);m.emissiveIntensity=1;}
}
