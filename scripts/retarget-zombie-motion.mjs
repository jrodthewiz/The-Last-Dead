// Bake Meshy motion onto the preserved Ash Witness skeleton. Offline only.
// Bind matrices, not matching bone names alone, define the retarget correction.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three.module.js';
let require=createRequire(import.meta.url);
try{require.resolve('@gltf-transform/core');}catch{
 // Offline authoring may reuse an installed toolchain. This never enters the
 // bundled game; GLTF_TRANSFORM_PATH points at a package.json or module root.
 require=createRequire(process.env.GLTF_TRANSFORM_PATH||'C:/Users/wolfk/Desktop/Dogfight/package.json');
}
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {prune,resample}=require('@gltf-transform/functions');
const ROOT=fileURLToPath(new URL('../',import.meta.url)),TEMP=path.join(ROOT,'.codex-temp/enemy-motion');
const SOURCE_DIR=path.join(ROOT,'.art-source/enemy-motion-v04');
const targetFile=path.join(ROOT,'assets/models/afterlife-ash-witness-chase-v03.glb');
const output=path.join(ROOT,'assets/models/afterlife-ash-witness-motion-v04.glb');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const vec=a=>new THREE.Vector3().fromArray(a),quat=a=>new THREE.Quaternion().fromArray(a);
const mat=a=>new THREE.Matrix4().fromArray(a);
const worldQ=o=>o.getWorldQuaternion(new THREE.Quaternion());
const worldP=o=>o.getWorldPosition(new THREE.Vector3());
const round=v=>Math.round(v*1e6)/1e6;
function model(doc){
 const nodes=doc.getRoot().listNodes(),objects=new Map(),byName=new Map(),root=new THREE.Group();
 for(const node of nodes){const object=new THREE.Object3D();object.name=node.getName();object.position.fromArray(node.getTranslation());object.quaternion.fromArray(node.getRotation());object.scale.fromArray(node.getScale());objects.set(node,object);byName.set(node.getName(),object);}
 for(const node of nodes){const object=objects.get(node),parent=node.getParentNode();(parent?objects.get(parent):root).add(object);}
 root.updateMatrixWorld(true);
 const skin=doc.getRoot().listSkins()[0],joints=skin.listJoints(),meshNode=nodes.find(n=>n.getSkin()===skin),mesh=objects.get(meshNode),inverse=skin.getInverseBindMatrices().getArray();
 const bind=new Map();
 for(let i=0;i<joints.length;i++){const matrix=mat(inverse.subarray(i*16,i*16+16)).invert();const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);bind.set(joints[i].getName(),{matrix,p,q,s});}
 const rest=new Map();
 for(const joint of joints){const name=joint.getName(),object=objects.get(joint),parent=joint.getParentNode(),parentBind=bind.get(parent?.getName())?.matrix||object.parent.matrixWorld;const local=parentBind.clone().invert().multiply(bind.get(name).matrix),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();local.decompose(p,q,s);rest.set(name,{p,q,s});}
 const order=[...joints].sort((a,b)=>{const depth=n=>{let d=0;while(n.getParentNode()){d++;n=n.getParentNode();}return d;};return depth(a)-depth(b);});
 return{doc,nodes,objects,byName,root,joints,order,meshNode,mesh,bind,rest,inverse};
}
function poseRest(m){for(const joint of m.joints){const object=m.objects.get(joint),r=m.rest.get(joint.getName());object.position.copy(r.p);object.quaternion.copy(r.q);object.scale.copy(r.s);}m.root.updateMatrixWorld(true);}
function evaluator(m,animation){
 const channels=animation.listChannels().map(channel=>{const sampler=channel.getSampler(),times=sampler.getInput().getArray(),values=sampler.getOutput().getArray(),type=channel.getTargetPath(),width=type==='rotation'?4:3,interp=sampler.getInterpolation();if(!['LINEAR','STEP'].includes(interp))throw new Error('Unsupported source interpolation '+interp);return{object:m.objects.get(channel.getTargetNode()),times,values,type,width,interp};});
 const duration=Math.max(...channels.map(c=>c.times[c.times.length-1]));
 return{duration,sample(time){poseRest(m);for(const c of channels){let lo=0,hi=c.times.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(c.times[mid]<=time)lo=mid;else hi=mid;}if(time>=c.times[hi])lo=hi;const b=Math.min(lo+1,c.times.length-1),alpha=c.interp==='STEP'?0:THREE.MathUtils.clamp((time-c.times[lo])/Math.max(1e-9,c.times[b]-c.times[lo]),0,1);const a=Array.from(c.values.subarray(lo*c.width,(lo+1)*c.width)),v=Array.from(c.values.subarray(b*c.width,(b+1)*c.width));if(c.type==='rotation')c.object.quaternion.copy(quat(a).slerp(quat(v),alpha).normalize());else(c.type==='translation'?c.object.position:c.object.scale).copy(vec(a).lerp(vec(v),alpha));}m.root.updateMatrixWorld(true);}};
}
function meshBounds(m){
 const minimum=new THREE.Vector3(Infinity,Infinity,Infinity),maximum=new THREE.Vector3(-Infinity,-Infinity,-Infinity),boneMatrices=m.joints.map((joint,i)=>m.objects.get(joint).matrixWorld.clone().multiply(mat(m.inverse.subarray(i*16,i*16+16))));
 for(const primitive of m.meshNode.getMesh().listPrimitives()){
  const positions=primitive.getAttribute('POSITION').getArray(),weightAccessor=primitive.getAttribute('WEIGHTS_0'),weights=weightAccessor.getArray(),joints=primitive.getAttribute('JOINTS_0').getArray(),divisor=weightAccessor.getNormalized()?(weights instanceof Uint8Array?255:65535):1;
  for(let i=0;i<positions.length/3;i++){const input=vec(positions.subarray(i*3,i*3+3)),p=new THREE.Vector3();for(let k=0;k<4;k++){const w=weights[i*4+k]/divisor;if(w)p.addScaledVector(input.clone().applyMatrix4(boneMatrices[joints[i*4+k]]),w);}minimum.min(p);maximum.max(p);}
 }
 return{min:minimum.toArray().map(round),max:maximum.toArray().map(round),height:round(maximum.y-minimum.y)};
}
function appendTrack(doc,animation,buffer,node,type,times,values){const input=doc.createAccessor().setType('SCALAR').setArray(Float32Array.from(times)).setBuffer(buffer),output=doc.createAccessor().setType(type==='rotation'?'VEC4':'VEC3').setArray(Float32Array.from(values)).setBuffer(buffer),sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(type).setSampler(sampler));}
const targetDoc=await io.read(targetFile),target=model(targetDoc),sources={batch:model(await io.read(path.join(SOURCE_DIR,'zombie-six-actions.glb'))),running:model(await io.read(path.join(SOURCE_DIR,'fresh-running.glb')))};
const animations=sources.batch.doc.getRoot().listAnimations();
if(animations.length!==6)throw new Error('Expected six Meshy preset actions in request order');
const retained=targetDoc.getRoot().listAnimations().find(a=>a.getName()==='AshWitness_Idle');
for(const animation of targetDoc.getRoot().listAnimations())if(animation!==retained)animation.dispose();
const buffer=targetDoc.getRoot().listBuffers()[0];
const report={source:targetFile,output,retarget:'source world rotation * inverse source bind rotation * target bind rotation; target bone lengths and inverse bind matrices retained',clips:[],restDifferences:[],sourcePresets:animations.map(a=>a.getName())};
for(const joint of target.joints){const name=joint.getName(),source=sources.batch.bind.get(name);if(!source)throw new Error('Missing source bone '+name);report.restDifferences.push({bone:name,worldRotationDegrees:round(source.q.angleTo(target.bind.get(name).q)*180/Math.PI),worldPositionMeters:round(source.p.distanceTo(target.bind.get(name).p))});}
const specs=[
 {key:'shuffle',name:'AshWitness_Shuffle',source:'batch',index:0,loop:true,duration:1.6},
 {key:'chase',name:'AshWitness_Chase',source:'running',index:0,loop:true,duration:.8},
 {key:'attack',name:'AshWitness_AttackLunge',source:'batch',index:3,loop:false,duration:.95,contact:.375},
 {key:'hit',name:'AshWitness_HitRecoil',source:'batch',index:4,loop:false,duration:.68},
 {key:'collapse',name:'AshWitness_Collapse',source:'batch',index:5,loop:false,duration:2.1},
];
for(const spec of specs){
 const source=sources[spec.source],sourceAnimation=source.doc.getRoot().listAnimations()[spec.index],evaluate=evaluator(source,sourceAnimation),animation=targetDoc.createAnimation(spec.name);
 let sourceIn=0,sourceOut=evaluate.duration;
 if(spec.key==='shuffle'){
  const values=[];for(let i=0;i<=Math.floor(evaluate.duration*60);i++){evaluate.sample(i/60);values.push(worldP(source.byName.get('LeftFoot')).z-worldP(source.byName.get('Hips')).z);}
  const peaks=[];for(let i=2;i<values.length-2;i++)if(values[i]>values[i-1]&&values[i]>=values[i+1]&&values[i]>values[i-2]&&values[i]>=values[i+2]&&(!peaks.length||i/60-peaks.at(-1)>.6))peaks.push(i/60);
  if(peaks.length<2)throw new Error('Could not identify a full monster walk cycle');sourceIn=peaks[0];sourceOut=peaks[1];
 }
 const sourceStart=(()=>{evaluate.sample(sourceIn);return worldP(source.byName.get('Hips'));})(),sourceEnd=(()=>{evaluate.sample(sourceOut);return worldP(source.byName.get('Hips'));})();
 const sourceHeight=source.bind.get('Head').p.y-source.bind.get('LeftFoot').p.y,targetHeight=target.bind.get('Head').p.y-target.bind.get('LeftFoot').p.y,scale=targetHeight/sourceHeight;
 // Locate the two-hand reach peak and map it to the simulation contact frame.
 let contactSource=evaluate.duration*.4,reach=-Infinity;
 if(spec.key==='attack'){for(let i=0;i<=120;i++){const t=evaluate.duration*i/120;evaluate.sample(t);const hand=(worldP(source.byName.get('LeftHand')).z+worldP(source.byName.get('RightHand')).z)/2-worldP(source.byName.get('Hips')).z;if(hand>reach){reach=hand;contactSource=t;}}}
 const samples=Math.round(spec.duration*60),times=[],data=new Map(target.joints.map(j=>[j.getName(),{rotation:[],translation:[],scale:[]}])) ,evidence=[],feet={LeftFoot:[],RightFoot:[]};
 const poses=[];
 for(let i=0;i<=samples;i++){
  const time=spec.duration*i/samples,phase=i/samples;
  const sourceTime=spec.key==='attack'?(time<=spec.contact?contactSource*time/spec.contact:contactSource+(evaluate.duration-contactSource)*(time-spec.contact)/(spec.duration-spec.contact)):THREE.MathUtils.lerp(sourceIn,sourceOut,phase);
  evaluate.sample(sourceTime);poseRest(target);
  const delta=worldP(source.byName.get('Hips')).sub(source.bind.get('Hips').p).multiplyScalar(scale);
  if(spec.loop){delta.x-=THREE.MathUtils.lerp(sourceStart.x,sourceEnd.x,phase)*scale-source.bind.get('Hips').p.x*scale;delta.z-=THREE.MathUtils.lerp(sourceStart.z,sourceEnd.z,phase)*scale-source.bind.get('Hips').p.z*scale;}
  else if(spec.key!=='collapse'){delta.x=THREE.MathUtils.clamp((worldP(source.byName.get('Hips')).x-sourceStart.x)*scale,-.10,.10);delta.z=THREE.MathUtils.clamp((worldP(source.byName.get('Hips')).z-sourceStart.z)*scale,-.12,.20);}
  const desiredHip=target.bind.get('Hips').p.clone().add(delta);
  for(const joint of target.order){const name=joint.getName(),object=target.objects.get(joint),pose=worldQ(source.byName.get(name)),correction=source.bind.get(name).q.clone().invert().multiply(target.bind.get(name).q),desired=pose.multiply(correction);object.quaternion.copy(worldQ(object.parent).invert().multiply(desired).normalize());if(name==='Hips')object.position.copy(object.parent.worldToLocal(desiredHip.clone()));object.updateMatrixWorld(true);}
  // Offset only the upper body; planted source feet retain their captured gait.
  if(spec.key==='chase'){
   const head=target.byName.get('Head');head.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.07,.025,-.055)));
   const spine=target.byName.get('Spine');spine.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.06,0,.025)));
   target.root.updateMatrixWorld(true);
  }
  const pose=new Map();for(const joint of target.joints){const o=target.objects.get(joint);pose.set(joint.getName(),{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});}poses.push(pose);times.push(time);
  for(const name of Object.keys(feet))feet[name].push(worldP(target.byName.get(name)).toArray());
 }
 // Close locomotion smoothly over the final 15% without moving its root.
 if(spec.loop){const first=poses[0],start=Math.floor(samples*.85);for(let i=start;i<=samples;i++){const a=(i-start)/(samples-start),blend=a*a*(3-2*a);for(const [name,pose] of poses[i]){pose.q.slerp(first.get(name).q,blend);pose.p.lerp(first.get(name).p,blend);}}}
 // Exact vertex soles establish a constant ground offset for locomotion; this
 // preserves airborne running frames. Death is separately supported per pose.
 let ground=Infinity;
 for(let i=0;i<=samples;i+=3){for(const joint of target.joints){const o=target.objects.get(joint),p=poses[i].get(joint.getName());o.position.copy(p.p);o.quaternion.copy(p.q);o.scale.copy(p.s);}target.root.updateMatrixWorld(true);ground=Math.min(ground,meshBounds(target).min[1]);}
 const hipParentScale=target.byName.get('Hips').parent.getWorldScale(new THREE.Vector3()).y;
 for(const pose of poses)pose.get('Hips').p.y+=(.012-ground)/hipParentScale;
 if(spec.key==='collapse')for(const pose of poses){for(const joint of target.joints){const o=target.objects.get(joint),p=pose.get(joint.getName());o.position.copy(p.p);o.quaternion.copy(p.q);o.scale.copy(p.s);}target.root.updateMatrixWorld(true);pose.get('Hips').p.y+=(.012-meshBounds(target).min[1])/hipParentScale;}
 let previous=new Map();
 for(let i=0;i<=samples;i++){
  for(const joint of target.joints){const name=joint.getName(),o=target.objects.get(joint),pose=poses[i].get(name);if(previous.get(name)?.dot(pose.q)<0)pose.q.set(-pose.q.x,-pose.q.y,-pose.q.z,-pose.q.w);previous.set(name,pose.q.clone());o.position.copy(pose.p);o.quaternion.copy(pose.q);o.scale.copy(pose.s);const values=data.get(name);values.rotation.push(...pose.q.toArray());values.translation.push(...pose.p.toArray());values.scale.push(...pose.s.toArray());}
  target.root.updateMatrixWorld(true);
  if(i%Math.max(1,Math.round(samples/8))===0||i===samples||Math.abs(times[i]-.375)<.009){const bounds=meshBounds(target);if(bounds.height>2.5||bounds.height<.1||bounds.min.some(v=>!Number.isFinite(v)))throw new Error(`Invalid deformed bounds ${spec.key} ${i} ${JSON.stringify(bounds)}`);evidence.push({time:round(times[i]),bounds,hips:worldP(target.byName.get('Hips')).toArray().map(round),leftFoot:worldP(target.byName.get('LeftFoot')).toArray().map(round),rightFoot:worldP(target.byName.get('RightFoot')).toArray().map(round),leftHand:worldP(target.byName.get('LeftHand')).toArray().map(round),rightHand:worldP(target.byName.get('RightHand')).toArray().map(round)});}
 }
 for(const joint of target.joints)for(const type of ['rotation','translation','scale'])appendTrack(targetDoc,animation,buffer,joint,type,times,data.get(joint.getName())[type]);
 const footRange=Object.fromEntries(Object.entries(feet).map(([name,values])=>[name,Math.max(...values.map(p=>p[2]))-Math.min(...values.map(p=>p[2]))]));
 const stride=spec.loop?Math.max(.5,Math.hypot(sourceEnd.x-sourceStart.x,sourceEnd.z-sourceStart.z)*scale,footRange.LeftFoot+footRange.RightFoot):null;
 report.clips.push({...spec,sourceClip:sourceAnimation.getName(),sourceDuration:evaluate.duration,sourceIn,sourceOut,groundCorrectionMeters:round(.012-ground),sourceContactSeconds:spec.key==='attack'?contactSource:undefined,strideMeters:stride?round(stride):undefined,footRangeMeters:footRange,evidence});
 animation.setExtras({bodycamMotionVersion:4,contactSeconds:spec.contact,loop:spec.loop,strideMeters:stride||undefined,authoredFall:spec.key==='collapse'});
}
// Retained idle keeps the existing restrained breathing; scream/stagger stay in
// the offline source for future encounter-specific acting, not constant loops.
await targetDoc.transform(resample(),prune({keepAttributes:true,keepLeaves:true,keepSolidTextures:true}));
const bytes=await io.writeBinary(targetDoc);if(bytes.length>5*1024*1024)throw new Error('Motion asset exceeds 5MiB budget');
await writeFile(output,bytes);
const original=await readFile(targetFile),manifest={formatVersion:1,id:'afterlife-ash-witness-motion-v04',runtime:{file:path.basename(output),heightMeters:1.86,visualOnly:true},provenance:{sourceMesh:path.basename(targetFile),sourceMeshSha256:hash(original),runtimeSha256:hash(bytes),runtimeBytes:bytes.length,rigTaskId:'01a0ec1c-9581-709a-89c1-ee91a298163b',animationTaskId:'01a0ec1d-f490-7469-a54c-ff73f6434d23',credits:23,actions:[112,113,386,214,178,189],conversionScript:'scripts/retarget-zombie-motion.mjs',retarget:report.retarget},rig:{jointCount:24},clips:Object.fromEntries(report.clips.map(c=>[c.key,{name:c.name,durationSeconds:c.duration,loop:c.loop,strideMeters:c.strideMeters,contactSeconds:c.contact,sourceClip:c.sourceClip}])),idle:{name:'AshWitness_Idle',source:'preserved v03'},notes:['Exact existing mesh, material, texture and inverse-bind data retained.','No live service or authoring directory is used by the game.','Scream and stagger acquired but kept offline; they are not continuously played.']};
await writeFile(output.replace('.glb','-manifest.json'),JSON.stringify(manifest,null,2)+'\n');await mkdir(TEMP,{recursive:true});await writeFile(path.join(TEMP,'retarget-report.json'),JSON.stringify(report,null,2)+'\n');
// Blender 2.93's importer predates EXT_texture_webp. A PNG-only review copy
// keeps that limitation out of both the runtime asset and the conversion math.
const preview=await io.readBinary(bytes),sharp=require('sharp');
for(const texture of preview.getRoot().listTextures())texture.setImage(await sharp(texture.getImage()).png().toBuffer()).setMimeType('image/png');
for(const extension of preview.getRoot().listExtensionsUsed())if(extension.extensionName==='EXT_texture_webp')extension.dispose();
for(const material of preview.getRoot().listMaterials())material.setEmissiveFactor([0,0,0]);
await io.write(path.join(TEMP,'review.glb'),preview);
console.log(JSON.stringify({output,bytes:bytes.length,clips:manifest.clips,maxRestDifferenceDegrees:Math.max(...report.restDifferences.map(r=>r.worldRotationDegrees))},null,2));
