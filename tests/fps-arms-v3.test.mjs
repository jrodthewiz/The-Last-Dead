import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/loaders/GLTFLoader.js';
import {Renderer} from '../renderer.js';
import {installForegroundArms,fitForegroundArms} from '../assets/survivor/foreground-arms.js';
import {installFPSArms,sampleFPSClip,fpsGripDiagnostics,updateFPSArms} from '../assets/survivor/fps-arms.js';
import {FIRST_PERSON_HOLD_POSES} from '../assets/survivor/viewmodel-hold-poses.js';
import {animateMeleeWeapon} from '../weapon-melee.js';
import {WeaponAim} from '../weapon-aim.js';
import {sampleViewmodelClip} from '../assets/survivor/viewmodel-motion.js';
const digest=b=>createHash('sha256').update(b).digest('hex');
let fps,r,hashes;
test.before(async()=>{
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 const load=async file=>{const b=readFileSync(new URL('../assets/survivor/'+file,import.meta.url));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
 const old=await load('viewmodel-arms-v2.glb');fps=await load('fps-arms-v3.glb');
 hashes=new Map();fps.scene.traverse(o=>{if(o.isMesh)hashes.set(o.geometry,digest(Buffer.from(o.geometry.attributes.position.array.buffer)));});
 r=Object.create(Renderer.prototype);r.materials={};r.camera=new T.PerspectiveCamera(75,16/10,.025,220);r.weaponRig=new T.Group();r.camera.add(r.weaponRig);
 r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
 r.weaponGroups.forEach((g,i)=>{const p=FIRST_PERSON_HOLD_POSES[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);});
 installForegroundArms(r,old.scene);assert.equal(installFPSArms(r,fps),15);
});
test('real Blender export supplies eight weighted FPS rigs and independent joint animation',()=>{
 assert.equal(fps.animations.length,32);
 const g=r.weaponGroups[1],s=g.userData.authoredFPS,bone=s.rig.getObjectByName('FPS_breach_right_Index0');
 sampleFPSClip(g,'fire',0);const rest=bone.quaternion.clone();const mesh=s.rig.getObjectByName('FPSGlove_breach_right'),points=[];
 for(let i=0;i<mesh.geometry.attributes.position.count;i+=25)points.push([i,mesh.getVertexPosition(i,new T.Vector3()).clone()]);
 sampleFPSClip(g,'fire',.06);assert(rest.angleTo(bone.quaternion)>.03,'independent finger performance must play');
 assert(points.some(([i,p])=>p.distanceTo(mesh.getVertexPosition(i,new T.Vector3()))>.0005),'bone tracks must actually deform the exported hand');
 assert.equal(g.userData.foregroundArmFits,undefined);assert(fitForegroundArms(g));
});

test('installation rejects incomplete, duplicate and invalid-duration named actions before modifying weapon groups',()=>{
 const valid=fps.animations.find(c=>c.name==='breach/fire');
 for(const [label,replacement]of [
  ['unknown phase',Object.assign(valid.clone(),{name:'breach/reload'})],
  ['duplicate phase',Object.assign(valid.clone(),{name:'breach/idle'})],
  ['zero duration',Object.assign(valid.clone(),{duration:0})],
  ['nonfinite duration',Object.assign(valid.clone(),{duration:NaN})],
 ]){
  const before=r.weaponGroups.map(g=>[g.children.length,g.userData.authoredFPS]);
  const asset={scene:fps.scene,animations:fps.animations.map(c=>c===valid?replacement:c)};
  assert.throws(()=>installFPSArms(r,asset),/Missing articulated FPS actions: breach/,label);
  r.weaponGroups.forEach((g,i)=>{assert.equal(g.children.length,before[i][0],label);assert.equal(g.userData.authoredFPS,before[i][1],label);});
 }
});

test('fore-end arms return toward the camera with a natural upper-arm approach',()=>{
 r.weaponRig.position.set(0,0,0);r.weaponRig.quaternion.identity();
 for(const weapon of [1,4]){
  const g=r.weaponGroups[weapon];sampleFPSClip(g,'idle',0);
  const arm=g.userData.authoredFPS.arms.find(a=>a.side==='left');
  const elbow=arm.lower.getWorldPosition(new T.Vector3()),wrist=arm.hand.getWorldPosition(new T.Vector3()),shoulder=arm.upper.getWorldPosition(new T.Vector3());
  assert(elbow.z>wrist.z+.03,'support elbow must return toward the player, rather than point farther down the barrel');
  assert(shoulder.z>elbow.z+.20,'upper arm must return toward the body instead of dropping vertically in the distance');
  assert(shoulder.x<elbow.x-.04,'left shoulder remains on the left side of its elbow');
 }
});

test('grip seating retains exported shoulder and elbow performance through repeat sampling',()=>{
 const g=r.weaponGroups[1],s=g.userData.authoredFPS;
 const pose=()=>s.arms.flatMap(a=>[...a.lower.getWorldPosition(new T.Vector3()).toArray(),...a.upper.getWorldPosition(new T.Vector3()).toArray()]);
 sampleFPSClip(g,'walk',.25);const first=pose();sampleFPSClip(g,'walk',.75);const opposite=pose();
 assert(Math.max(...first.map((v,i)=>Math.abs(v-opposite[i])))>.001,'Blender limb flex must survive the full grip correction');
 for(let repeat=0;repeat<3;repeat++){
  sampleFPSClip(g,'fire',.5);sampleFPSClip(g,'walk',.25);
  assert(Math.max(...first.map((v,i)=>Math.abs(v-pose()[i])))<1e-6,'absolute clip sampling cannot accumulate the solved pose');
  for(const a of fpsGripDiagnostics(g).arms)assert(a.gap<1e-5&&a.rotationGap<1e-6);
 }
});

test('authored wrist correction remains inside each anatomical cone across every action',()=>{
 for(const g of r.weaponGroups)for(const phase of ['idle','walk','draw',g.userData.authoredFPS.index<6?'fire':'strike'])for(let k=0;k<=30;k++){
  sampleFPSClip(g,phase,k/30);
  for(const arm of fpsGripDiagnostics(g).arms){assert(arm.wristDegrees<=arm.wristLimitDegrees+.001,JSON.stringify({weapon:g.userData.authoredFPS.name,phase,k,...arm}));}
  for(const a of g.userData.authoredFPS.arms){
   const m=g.userData.authoredFPS.rig.getObjectByName(`FPS_${g.userData.authoredFPS.name}_${a.side}_Middle0`);
   const wrist=a.hand.getWorldPosition(new T.Vector3()),mcp=m.getWorldPosition(new T.Vector3()),elbow=a.lower.getWorldPosition(new T.Vector3());
   assert(wrist.distanceTo(mcp)>.07&&wrist.distanceTo(mcp)<.13,'adult wrist-to-knuckle slab has actual length');
   assert(wrist.clone().sub(mcp).normalize().dot(elbow.sub(wrist).normalize())>.68,'forearm enters the back of the palm rather than the little-finger edge');
  }
 }
});

test('every wrist feeds the central palm longitudinally across its fitted knuckle fan',()=>{
 for(const g of r.weaponGroups){const s=g.userData.authoredFPS;sampleFPSClip(g,'idle',0);
  for(const arm of s.arms){
   const pos=name=>s.rig.getObjectByName(`FPS_${s.name}_${arm.side}_${name}`).getWorldPosition(new T.Vector3());
   const wrist=pos('Hand'),roots=['Index','Middle','Ring','Little'].map(d=>pos(d+'0'));
   const palm=roots[1].clone().sub(wrist).normalize(),fan=roots[0].clone().sub(roots[3]).normalize();
   assert(Math.abs(palm.dot(fan))<.43,`${s.name}/${arm.side}: palm length must not follow the finger-width axis`);
   const distances=roots.map(p=>p.distanceTo(wrist));
   assert(Math.max(...distances)/Math.min(...distances)<1.5,`${s.name}/${arm.side}: wrist must enter centrally behind the fan`);
  }
 }
});

test('loaded finger anatomy retains adult proximal and intermediate lengths across all equipment',()=>{
 const lengths=[];
 for(const g of r.weaponGroups){sampleFPSClip(g,'idle',0);const s=g.userData.authoredFPS;
  for(const a of s.arms){const prefix=`FPS_${s.name}_${a.side}_Middle`,points=[0,1,2].map(i=>s.rig.getObjectByName(prefix+i).getWorldPosition(new T.Vector3()));
   const proximal=points[0].distanceTo(points[1]),intermediate=points[1].distanceTo(points[2]);lengths.push(proximal);
   assert(Math.abs(proximal-.037632)<.001,`${s.name}/${a.side}: proximal ${proximal}`);
   assert(Math.abs(intermediate-.025088)<.002,`${s.name}/${a.side}: intermediate ${intermediate}`);
   assert(proximal>intermediate,'a different grip cannot lengthen the middle phalanx beyond the proximal');
  }
 }
 assert(Math.max(...lengths)-Math.min(...lengths)<.001,'the actor keeps the same proximal anatomy across hold families');
});

test('real exported loaded finger pads contact the actual weapon surfaces after skinning',()=>{
 const right=['wood-grip','relic-grip','wood-pistol-grip','rear-handle','wooden-handle'],left=[null,['support-wood'],['support-grip-body'],['support-grip'],['handguard-shell'],['wood-support-grip'],['wooden-handle'],['wrap-handle']];
 const point=new T.Vector3(),closest=new T.Vector3();
 for(const g of r.weaponGroups){sampleFPSClip(g,'idle',0);const s=g.userData.authoredFPS;
  for(const a of s.arms){const triangles=[],names=a.side==='right'?right:left[s.index];g.traverse(m=>{if(!m.isMesh||!names.includes(m.name))return;const p=m.geometry.attributes.position,index=m.geometry.index;for(let i=0;i<(index?.count||p.count);i+=3){const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(m.matrixWorld));triangles.push(new T.Triangle(...points));}});
   assert(triangles.length>20,'contact is measured against the actual manufactured handle');
   const mesh=s.rig.getObjectByName(`FPSGlove_${s.name}_${a.side}`),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   for(const digit of ['Middle','Ring','Little']){const selected=[];for(let i=0;i<indices.count;i++){let weight=0;for(let j=0;j<4;j++)if(mesh.skeleton.bones[indices.getComponent(i,j)].name.includes('_'+digit))weight+=weights.getComponent(i,j);if(weight>.75)selected.push(i);}assert(selected.length>30,'query an actual weighted finger surface');
    let gap=Infinity;const step=Math.max(1,Math.floor(selected.length/240));for(let j=0;j<selected.length;j+=step){mesh.getVertexPosition(selected[j],point).applyMatrix4(mesh.matrixWorld);for(const triangle of triangles){triangle.closestPointToPoint(point,closest);gap=Math.min(gap,point.distanceTo(closest));}}
    assert(gap<.0025,`${s.name}/${a.side}/${digit}: exported pad floats ${gap} metres clear of handle`);
   }
  }
 }
});

test('exported sleeve terminations stay outside the camera lower plane in the new FPS rig',()=>{
 r.weaponRig.position.set(0,0,0);r.weaponRig.rotation.set(0,0,0);
 const normal=new T.Vector3(0,1,-Math.tan(T.MathUtils.degToRad(r.camera.fov*.5))).normalize(),point=new T.Vector3();
 for(const g of r.weaponGroups)for(const time of [0,.06,.5]){
  sampleFPSClip(g,g.userData.authoredFPS.index<6?'fire':'strike',time);const s=g.userData.authoredFPS;
  for(const a of s.arms){const mesh=s.rig.getObjectByName(`FPSSleeve_${s.name}_${a.side}`),elbow=a.lower.getWorldPosition(new T.Vector3()),shoulder=a.upper.getWorldPosition(new T.Vector3()),axis=shoulder.clone().sub(elbow).normalize(),length=elbow.distanceTo(shoulder);let count=0,max=-Infinity;
   const positions=[];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.push(point.clone());max=Math.max(max,point.clone().sub(elbow).dot(axis));}
   assert(max>length*.7,`${s.name}/${a.side}: garment has a real upper termination ${max}/${length}`);
   for(const vertex of positions){if(vertex.clone().sub(elbow).dot(axis)<max-.03)continue;count++;r.camera.worldToLocal(vertex);assert(normal.dot(vertex)<-.005,`${s.name}/${a.side}/${time}: actual cap entered camera plane ${normal.dot(vertex)}; maximum cap projection ${max}; elbow ${elbow.toArray()}; shoulder ${shoulder.toArray()}`);}
   assert(count>20,'measure the exported garment termination rather than the shoulder center');
  }
 }
});

test('actual garment ends remain concealed over the complete outer firearm recoil trajectory',()=>{
 const normal=new T.Vector3(0,1,-Math.tan(T.MathUtils.degToRad(r.camera.fov*.5))).normalize(),point=new T.Vector3(),pose=new Float64Array(6);
 for(const weapon of [0,1,2,3,4,5])for(const time of [0,.03,.06,.12,.20,.35,.50,.75,1]){
  const g=r.weaponGroups[weapon],s=g.userData.authoredFPS;sampleViewmodelClip(s.name+'/fire',time,pose);
  r.weaponRig.position.set(...pose.slice(0,3));r.weaponRig.rotation.set(...pose.slice(3));sampleFPSClip(g,'fire',time);
  for(const a of s.arms){const mesh=s.rig.getObjectByName(`FPSSleeve_${s.name}_${a.side}`),elbow=a.lower.getWorldPosition(new T.Vector3()),shoulder=a.upper.getWorldPosition(new T.Vector3()),axis=shoulder.clone().sub(elbow).normalize(),positions=[];let max=-Infinity;
   for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);positions.push(point.clone());max=Math.max(max,point.clone().sub(elbow).dot(axis));}
   for(const vertex of positions){if(vertex.clone().sub(elbow).dot(axis)<max-.03)continue;r.camera.worldToLocal(vertex);assert(normal.dot(vertex)<-.005,`${s.name}/${a.side}/${time}: real sleeve cap enters the rendered lower plane by ${normal.dot(vertex)} metres`);}
  }
 }
 r.weaponRig.position.set(0,0,0);r.weaponRig.rotation.set(0,0,0);
});
test('complete firearm clips preserve both full grip frames and adult lengths through camera reversals',()=>{
 for(let weapon=0;weapon<6;weapon++)for(const phase of ['idle','walk','draw','fire'])for(let k=0;k<=30;k++){
  const g=r.weaponGroups[weapon];r.weaponRig.rotation.set(Math.sin(k)*.12,Math.cos(k)*.3,Math.sin(k*.4)*.08);sampleFPSClip(g,phase,k/60);
  for(const a of fpsGripDiagnostics(g).arms){assert(a.gap<1e-5,`${weapon}/${phase}/${k}: ${a.gap}`);assert(a.rotationGap<1e-6,JSON.stringify({weapon,phase:typeof phase!=='undefined'?phase:'strike',...a}));assert(Math.abs(a.forearmMetres-.30464)<1e-5);assert(Math.abs(a.upperMetres-.3584)<1e-5);}
 }
});

test('both hand frames stay seated through complete aim transitions and attachment recoil',()=>{
 const aim=new WeaponAim();
 for(let weapon=0;weapon<6;weapon++)for(let step=0;step<=20;step++){
  const g=r.weaponGroups[weapon];r.weaponRig.position.set(.02,-.012,step===10?.065:0);r.weaponRig.quaternion.identity();
  aim.apply(r.weaponRig,g,weapon,Math.sin(Math.PI*step/20));sampleFPSClip(g,'fire',step/60);
  for(const arm of fpsGripDiagnostics(g).arms){assert(arm.gap<1e-5);assert(arm.rotationGap<1e-6);assert(Math.abs(arm.forearmMetres-.30464)<1e-5);}
 }
});

test('completed exported fire and strike actions replay their actual finger deformation without an idle phase',()=>{
 for(const [weapon,phase,time]of [[1,'fire',.06],[6,'strike',.12],[7,'strike',.12]]){
  const g=r.weaponGroups[weapon],s=g.userData.authoredFPS,bone=s.rig.getObjectByName(`FPS_${s.name}_right_Index0`),mesh=s.rig.getObjectByName(`FPSGlove_${s.name}_right`);
  sampleFPSClip(g,phase,0);const rest=bone.quaternion.clone(),points=[];
  for(let i=0;i<mesh.geometry.attributes.position.count;i+=25)points.push([i,mesh.getVertexPosition(i,new T.Vector3()).clone()]);
  let expected;
  for(let repeat=0;repeat<3;repeat++){
   sampleFPSClip(g,phase,0);sampleFPSClip(g,phase,time);assert(rest.angleTo(bone.quaternion)>.03);
   if(expected)assert(expected.angleTo(bone.quaternion)<1e-6);else expected=bone.quaternion.clone();
   assert(points.some(([i,p])=>p.distanceTo(mesh.getVertexPosition(i,new T.Vector3()))>.0005));
   sampleFPSClip(g,phase,s.actions.get(phase).duration);
  }
 }
});
test('bat and chainsaw moving grip frames stay seated over repeated complete strokes without pose accumulation',()=>{
 r.weaponRig.rotation.set(0,0,0);
 for(let repeat=0;repeat<3;repeat++)for(const weapon of [6,7])for(let k=0;k<=60;k++){
  const g=r.weaponGroups[weapon],progress=k/60;
  animateMeleeWeapon(g.userData.model,{active:true,progress,heavy:true,sequence:repeat+1,sawRev:1,sawActive:weapon===7},progress,1/60);
  sampleFPSClip(g,'strike',progress);
  for(const a of fpsGripDiagnostics(g).arms){assert(a.gap<1e-5,`${weapon}/${progress}: ${a.gap}`);assert(a.rotationGap<1e-6,JSON.stringify({weapon,phase:typeof phase!=='undefined'?phase:'strike',...a}));assert(Math.abs(a.forearmMetres-.30464)<1e-5);}
 }
});
test('tailored elbow rings retain volume and return exactly after repeated grip corrections',()=>{
 const group=r.weaponGroups[1],state=group.userData.authoredFPS;
 for(const arm of state.arms){
  assert(arm.cloth?.isBone,'tailored sleeve needs its exported elbow cloth pivot');
  const mesh=state.rig.getObjectByName(`FPSSleeve_${state.name}_${arm.side}`),index=mesh.skeleton.bones.indexOf(arm.cloth),samples=[];
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let i=0;i<indices.count;i++)for(let k=0;k<4;k++)if(indices.getComponent(i,k)===index&&weights.getComponent(i,k)>.999){samples.push(i);break;}
  assert(samples.length>48,'measure an actual full exported elbow ring');
  sampleFPSClip(group,'idle',0);const center=arm.cloth.getWorldPosition(new T.Vector3()),point=new T.Vector3();
  const radii=samples.map(i=>mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).distanceTo(center));
  assert(Math.min(...radii)>.035,'the cloth has actual radial clearance around the elbow');
  const pose=arm.cloth.quaternion.clone();
  for(let repeat=0;repeat<3;repeat++){
   for(const time of [0,.03,.06,.12,.35,.5]){
    sampleFPSClip(group,'fire',time);arm.cloth.getWorldPosition(center);
    samples.forEach((i,k)=>assert(Math.abs(mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).distanceTo(center)-radii[k])<1e-5,'elbow cloth pivot must retain ring volume'));
   }
   sampleFPSClip(group,'idle',0);assert(pose.angleTo(arm.cloth.quaternion)<1e-6,'cloth correction must not accumulate');
  }
 }
});

test('left/right injury roots own separate surfaces, FPS skeletons are isolated and master/body bytes are preserved',()=>{
 for(const g of r.weaponGroups){const arms=g.userData.viewArms;assert(arms.rightArm);if(arms.leftArm){const right=new Set();arms.rightArm.traverse(o=>{if(o.isMesh)right.add(o);});arms.leftArm.traverse(o=>{if(o.isMesh)assert(!right.has(o));});arms.leftArm.visible=false;assert(arms.rightArm.visible);arms.leftArm.visible=true;}
  g.userData.authoredFPS.rig.traverse(o=>{if(o.isSkinnedMesh){assert(o.skeleton.bones.every(b=>b&&b.name.startsWith('FPS_')));assert(o.geometry.attributes.skinWeight);assert(o.geometry.attributes.uv);}});
 }
 for(const [g,h]of hashes)assert.equal(digest(Buffer.from(g.attributes.position.array.buffer)),h);
 const manifest=JSON.parse(readFileSync(new URL('../assets/survivor/fps-arms-v3-manifest.json',import.meta.url)));
 for(const [path,h]of Object.entries(manifest.protected_source_hashes))assert.equal(digest(readFileSync(new URL('../'+path.replaceAll('\\','/'),import.meta.url))),h);
 const body=readFileSync(new URL('../assets/survivor/meshy-survivor.js',import.meta.url),'utf8');assert(body.includes('head.visible=arms.visible=!firstPerson'));assert(body.includes('TLD_Local_Torso_Legs'));
});
