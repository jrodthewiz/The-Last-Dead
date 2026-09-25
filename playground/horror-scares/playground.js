import * as THREE from '../../vendor/three.module.js';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {clone} from '../../vendor/utils/SkeletonUtils.js';

const canvas=document.querySelector('#world');
const sceneSelect=document.querySelector('#scene');
const causeSelect=document.querySelector('#cause');
const distanceInput=document.querySelector('#distance');
const status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.55;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x07090b);scene.fog=new THREE.FogExp2(0x07090b,.043);
const camera=new THREE.PerspectiveCamera(64,1,.08,50);
const mat=(color,roughness=1,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const textureLoader=new THREE.TextureLoader();
const wallMap=textureLoader.load('./assets/textures/crypt-wall-albedo.webp');wallMap.colorSpace=THREE.SRGBColorSpace;wallMap.wrapS=wallMap.wrapT=THREE.RepeatWrapping;wallMap.repeat.set(2,1);
const floorMap=textureLoader.load('./assets/textures/afterlife-institutional-floor-v1.webp');floorMap.colorSpace=THREE.SRGBColorSpace;floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(3,3);
const plaster=new THREE.MeshStandardMaterial({map:wallMap,color:0x858f92,roughness:.94}),floorMat=new THREE.MeshStandardMaterial({map:floorMap,color:0x999d9f,roughness:.93}),stone=mat(0x333737,.96),metal=mat(0x2c2929,.55,.72),rust=mat(0x533028,.8,.42),wood=mat(0x2c1a16,.6,.12),ivory=mat(0xafa697,.68),blood=mat(0x390d12,.38);
function box(parent,name,w,h,d,x,y,z,material,cast=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cyl(parent,name,r1,r2,h,x,y,z,material,segments=10){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function beamBetween(parent,name,a,b,r,material){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);const mesh=cyl(parent,name,r,r,av.distanceTo(bv),0,0,0,material,8);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return mesh;}
const ambient=new THREE.HemisphereLight(0x81919e,0x160a0b,.64);scene.add(ambient);
const key=new THREE.SpotLight(0xb8c3c8,105,15,Math.PI/4,.8,1.5);key.position.set(-1.2,4.4,2.8);key.target.position.set(0,1.4,-2);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0004;scene.add(key,key.target);
const fill=new THREE.PointLight(0xa4b7c6,14,9,2);fill.position.set(0,2.1,.7);scene.add(fill);
const red=new THREE.PointLight(0xa42525,10,6,2);red.position.set(2.8,2,-4);scene.add(red);
const groups={drop:new THREE.Group(),piano:new THREE.Group(),window:new THREE.Group()};Object.entries(groups).forEach(([name,g])=>{g.name=name;scene.add(g);});
function shell(group,variant){
 box(group,'floor',10,.22,11,0,-.11,-1.7,floorMat,false);
 box(group,'back wall',10,4.7,.35,0,2.35,-6.15,plaster,false);
 box(group,'left wall',.35,4.7,11,-5,2.35,-1.7,plaster,false);
 box(group,'right wall',.35,4.7,11,5,2.35,-1.7,plaster,false);
 box(group,'ceiling',10,.22,11,0,4.75,-1.7,stone,false);
 for(const x of [-3.8,3.8]){
  box(group,'wall pier',.38,4.6,.55,x,2.3,-5.75,stone);
  for(const y of [1.1,2.7,4.15])box(group,'iron wall strap',.5,.05,.59,x,y,-5.42,metal);
 }
 for(const x of [-4.1,4.1]){cyl(group,'conduit',.06,.06,4.5,x,2.25,-5.74,metal);box(group,'conduit clamp',.38,.1,.28,x,3.8,-5.68,rust);}
 if(variant==='drop'){
  box(group,'door lintel',3.1,.38,.65,0,3.42,-5.48,stone);
  box(group,'door left jamb',.4,3.25,.65,-1.5,1.62,-5.48,stone);
  box(group,'door right jamb',.4,3.25,.65,1.5,1.62,-5.48,stone);
  const door=box(group,'opening door',2.7,3.1,.15,0,1.55,-5.27,wood);door.userData.door=true;
  for(let x=-1.2;x<1.3;x+=.32)box(door,'door rib',.05,2.9,.06,x,0,.09,metal);
  box(group,'ceiling trap seam',2.4,.014,1.55,0,4.63,-2.3,metal,false);
  box(group,'ceiling trap seam',.018,.014,1.55,-1.2,4.63,-2.3,metal,false);
  box(group,'ceiling trap seam',.018,.014,1.55,1.2,4.63,-2.3,metal,false);
  beamBetween(group,'suspended chain',[0,4.57,-2.35],[0,2.76,-2.35],.018,metal);
 }
 if(variant==='piano'){
  for(const x of [-2.5,2.5]){box(group,'side altar plinth',1.0,1.2,1.1,x,.6,-4.65,stone);cyl(group,'votive bowl',.32,.22,.12,x,1.25,-4.65,rust,14);}
  box(group,'apse crown',7.2,.44,.65,0,3.58,-5.6,stone);
  for(let i=0;i<9;i++){const x=(i-4)*.62;box(group,'prayer scratch',.015,.4+(i%3)*.16,.01,x,2.8,-5.92,rust,false);}
  for(let i=-5;i<=5;i++){const height=1.3+(5-Math.abs(i))*.24;const x=i*.36;cyl(group,'organ pipe',.073,.073,height,x,4.44-height/2,-5.71,i%3===0?rust:metal,10);}
  for(const x of [-3.25,3.25]){box(group,'chapel bench',1.1,.16,1.65,x,.48,-1.25,wood);box(group,'bench back',1.1,.8,.12,x,.94,-1.96,wood);for(const z of [-1.84,-.72])box(group,'bench leg',.12,.5,.15,x,.25,z,wood);}
 }
 if(variant==='window'){
  box(group,'window frame left',.4,3.7,.75,-1.65,2.6,-5.48,stone);
  box(group,'window frame right',.4,3.7,.75,1.65,2.6,-5.48,stone);
  box(group,'window frame top',3.7,.45,.75,0,4.24,-5.48,stone);
  box(group,'window sill',3.7,.35,.8,0,.85,-5.42,stone);
  box(group,'window recess black',2.9,2.9,.02,0,2.55,-5.82,mat(0x080a0b));
  for(const x of [-1.05,-.52,.52,1.05])cyl(group,'window bar',.035,.035,2.9,x,2.5,-5.11,metal,8);
 }
}
Object.entries(groups).forEach(([name,group])=>shell(group,name));

// The same game zombie asset is reused in all three sketches. No new mesh download.
const asset=await new GLTFLoader().loadAsync('../../assets/models/afterlife-ash-witness-chase-v03.glb');
const sourceBounds=new THREE.Box3().setFromObject(asset.scene,true),sourceSize=sourceBounds.getSize(new THREE.Vector3()),sourceCenter=sourceBounds.getCenter(new THREE.Vector3());
function witness(parent,name){
 const root=new THREE.Group();root.name=name;parent.add(root);
 const pivot=new THREE.Group();root.add(pivot);pivot.rotation.y=Math.PI;
 const model=clone(asset.scene);pivot.add(model);
 const scale=1.86/Math.max(.01,sourceSize.y);model.scale.setScalar(scale);model.position.set(-sourceCenter.x*scale,-sourceBounds.min.y*scale,-sourceCenter.z*scale);
 model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;}});
 const mixer=new THREE.AnimationMixer(model),clip=asset.animations.find(a=>a.name==='AshWitness_Idle');
 if(clip)mixer.clipAction(clip).play();
 const bones=Object.fromEntries(['Head','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftUpLeg','RightUpLeg','Spine01'].map(n=>[n,model.getObjectByName(n)]));
 return {root,model,mixer,bones};
}
const hang=witness(groups.drop,'hanging Ash Witness');hang.root.position.set(0,4.7,-2.35);hang.root.rotation.y=Math.PI;hang.root.visible=false;
const noose=new THREE.Mesh(new THREE.TorusGeometry(.074,.012,6,20),rust);noose.position.set(0,1.58,-.115);hang.root.add(noose);
const vigil=witness(groups.piano,'piano body');vigil.root.position.set(.92,2.72,-4.05);vigil.root.rotation.set(0,0,1.47);
const screamer=witness(groups.window,'window Ash Witness');screamer.root.position.set(0,-1.6,-5.18);screamer.root.rotation.y=Math.PI;
// A small cavity insert tests scream-driven aperture on the current static face.
// Promotion needs an authored jaw joint or facial morph on this asset.
const mouth=new THREE.Group();mouth.name='audio reactive mouth';screamer.root.add(mouth);
const cavity=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),mat(0x090304,.92));cavity.scale.set(.037,.009,.008);mouth.add(cavity);
const lip=new THREE.Mesh(new THREE.TorusGeometry(.035,.003,6,22),blood);lip.scale.y=.32;mouth.add(lip);

// Piano: a single recognizable, grounded landmark with a still body above it.
const piano=groups.piano;
box(piano,'piano case',2.7,1.05,1.16,0,.86,-4.35,wood);
box(piano,'piano fallboard',2.85,.14,.65,0,1.42,-3.84,wood);
box(piano,'piano crown',2.95,1.25,.17,0,2.16,-4.93,wood);
box(piano,'piano upper ledge',3.1,.11,.29,0,2.77,-4.85,wood);
box(piano,'keyboard white',2.44,.06,.42,0,1.35,-3.58,ivory);
for(let i=0;i<18;i++)box(piano,'keyboard division',.012,.012,.42,-1.15+i*.135,1.389,-3.58,metal,false);
for(let i=0;i<13;i++){const x=-1.08+i*.18;box(piano,'black key',.078,.06,.24,x,1.43,-3.68,metal);}
for(const x of [-1.15,1.15])box(piano,'piano foot',.18,.25,.82,x,.13,-4.31,wood);
for(let i=0;i<4;i++)beamBetween(piano,'hanging wire',[-.62+i*.37,4.57,-4.48],[-.58+i*.35,2.45,-4.45],.013,metal);
for(const x of [-.36,.42]){beamBetween(piano,'body hoist cable',[x,4.61,-3.82],[x,2.75,-3.82],.018,rust);cyl(piano,'hoist clamp',.062,.062,.09,x,2.76,-3.82,metal,8);}
for(const x of [-2.5,2.5]){
 const candle=cyl(piano,'votive candle',.045,.05,.25,x,1.42,-4.65,ivory,8);
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.045,.14,8),new THREE.MeshBasicMaterial({color:0xc1764b}));flame.position.set(x,1.63,-4.65);piano.add(flame);
}

const audio={context:null,buffers:{},active:null,analyser:null,data:null,master:null};
async function unlockAudio(){
 if(!audio.context){audio.context=new AudioContext();audio.master=audio.context.createGain();audio.master.gain.value=document.querySelector('#sound').checked?1:0;audio.master.connect(audio.context.destination);for(const [name,url] of Object.entries({drop:'../../assets/audio/playground/ceiling-human-scream.ogg',window:'../../assets/audio/playground/window-human-scream.ogg'})){
   const response=await fetch(url);if(!response.ok)throw Error(`${name} scream ${response.status}`);audio.buffers[name]=await audio.context.decodeAudioData(await response.arrayBuffer());
 }}
 await audio.context.resume();
}
function stopAudio(){try{audio.active?.source.stop();}catch{}audio.active=null;audio.analyser=null;}
function reachForBar(actor,upperName,handName,targetLocal){
 const upper=actor.model.getObjectByName(upperName),hand=actor.model.getObjectByName(handName);if(!upper||!hand)return;
 actor.root.updateMatrixWorld(true);
 const start=upper.getWorldPosition(new THREE.Vector3()),end=hand.getWorldPosition(new THREE.Vector3());
 const target=actor.root.localToWorld(new THREE.Vector3(...targetLocal));
 const from=end.sub(start).normalize(),to=target.sub(start).normalize();
 const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
 const parentWorld=upper.parent.getWorldQuaternion(new THREE.Quaternion());
 upper.quaternion.premultiply(parentWorld.clone().invert().multiply(delta).multiply(parentWorld));
 actor.root.updateMatrixWorld(true);
}
function playScream(name,position){
 if(!audio.context||!audio.buffers[name])return;
 stopAudio();const ctx=audio.context,source=ctx.createBufferSource();source.buffer=audio.buffers[name];
 const analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.62;
 const panner=ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=1.3;panner.rolloffFactor=1.65;panner.maxDistance=12;
 panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;
 const gain=ctx.createGain();gain.gain.value=.76;source.connect(analyser).connect(panner).connect(gain).connect(audio.master);
 source.start();source.onended=()=>{if(audio.active?.source===source){audio.active=null;audio.analyser=null;}};
 audio.active={source,panner};audio.analyser=analyser;audio.data=new Uint8Array(analyser.frequencyBinCount);
}
let mode='drop',dropCause='door',beatStart=-1,drag=false,lastX=0,yaw=0,lookPitch=0,frame=0;
function reset(){beatStart=-1;hang.root.visible=false;hang.root.position.y=4.7;screamer.root.visible=false;screamer.root.position.y=-1.6;mouth.scale.y=1;stopAudio();status.value=mode==='drop'?'Open the door to release the suspended body.':mode==='piano'?'Inspect the piano vigil. Trigger for a closer look.':'Approach and trigger the window figure.';}
function selectMode(name){mode=name;sceneSelect.value=name;document.querySelector('#causeGroup').hidden=name!=='drop';for(const [id,g] of Object.entries(groups))g.visible=id===name;key.target.position.set(0,1.4,name==='window'?-5:-3);red.intensity=name==='piano'?7:10;reset();}
async function trigger(){
 try{await unlockAudio();}catch(error){status.value=`Sound unavailable: ${error.message}`;}
 beatStart=performance.now()/1000;
 if(mode==='drop'){dropCause=causeSelect.value;hang.root.visible=true;hang.root.position.y=4.7;playScream('drop',new THREE.Vector3(0,2.6,-2.35));status.value=dropCause==='door'?'Door opens. Body falls into the rope and struggles.':'Level advances. The suspended body falls without a door cue.';}
 if(mode==='piano'){status.value='A body is suspended across the silent keyboard.';}
 if(mode==='window'){screamer.root.visible=true;screamer.root.position.y=-1.6;playScream('window',new THREE.Vector3(0,2.4,-5.18));status.value='A figure rises, reaches for the bars, and screams.';}
}
sceneSelect.addEventListener('change',()=>selectMode(sceneSelect.value));document.querySelector('#trigger').addEventListener('click',trigger);document.querySelector('#reset').addEventListener('click',reset);
document.querySelector('#sound').addEventListener('change',event=>{if(audio.master)audio.master.gain.value=event.target.checked?1:0;});
document.addEventListener('visibilitychange',()=>{if(!audio.context)return;if(document.hidden)audio.context.suspend();else audio.context.resume();});
canvas.addEventListener('pointerdown',event=>{drag=true;lastX=event.clientX;canvas.setPointerCapture(event.pointerId);});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw=THREE.MathUtils.clamp(yaw+(event.clientX-lastX)*.003,-.42,.42);lookPitch=THREE.MathUtils.clamp(lookPitch+event.movementY*.002,-.22,.22);lastX=event.clientX;});
canvas.addEventListener('wheel',event=>{distanceInput.value=THREE.MathUtils.clamp(Number(distanceInput.value)+Math.sign(event.deltaY)*.25,-1,4.5);event.preventDefault();},{passive:false});
window.addEventListener('keydown',event=>{if(['1','2','3'].includes(event.key))selectMode(['drop','piano','window'][Number(event.key)-1]);if(event.code==='Space'){event.preventDefault();trigger();}if(event.key.toLowerCase()==='r')reset();});
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();selectMode('drop');
let lastFrame=performance.now(),elapsed=0;
function render(){requestAnimationFrame(render);const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;elapsed+=dt;frame++;
 const distance=Number(distanceInput.value);camera.position.set(0,1.67,distance-(mode==='window'?2.2:0));camera.lookAt(Math.sin(yaw)*4,1.65-lookPitch*4,mode==='window'?-5:-2.8);
 if(audio.context){const listener=audio.context.listener;if(listener.positionX){listener.positionX.value=camera.position.x;listener.positionY.value=camera.position.y;listener.positionZ.value=camera.position.z;}else listener.setPosition(camera.position.x,camera.position.y,camera.position.z);}
 const t=beatStart<0?-1:performance.now()/1000-beatStart;
 for(const actor of [hang,vigil,screamer])actor.mixer.update(dt);
 const facePoint=screamer.model.getObjectByName('headfront')?.getWorldPosition(new THREE.Vector3());
 if(facePoint){mouth.position.copy(screamer.root.worldToLocal(facePoint));mouth.position.x-=.035;mouth.position.y-=.012;mouth.position.z-=.008;}
 if(mode==='drop'&&t>=0){
  const fall=THREE.MathUtils.clamp(t/.72,0,1),ease=1-Math.pow(1-fall,3);
  hang.root.position.y=4.7-3.55*ease+(t>.72?.075*Math.exp(-(t-.72)*1.2)*Math.sin((t-.72)*16):0);
  hang.root.rotation.z=Math.sin(t*7)*.14*Math.exp(-Math.max(0,t-.55)*.22);
  hang.root.rotation.x=Math.sin(t*4.7)*.12;
  for(const [name,sign] of [['LeftArm',1],['RightArm',-1],['LeftUpLeg',-1],['RightUpLeg',1]])if(hang.bones[name]){const panic=Math.exp(-Math.max(0,t-1)*.11);hang.bones[name].rotation.z+=sign*Math.sin(t*12+sign)*.42*panic;hang.bones[name].rotation.x+=Math.sin(t*9+sign*1.7)*.27*panic;}
  if(hang.bones.Head)hang.bones.Head.rotation.x+=Math.sin(t*10)*.14;
  if(hang.bones.Spine01)hang.bones.Spine01.rotation.y+=Math.sin(t*6.7)*.09;
  const door=groups.drop.getObjectByName('opening door');if(door)door.rotation.y=dropCause==='door'?-Math.min(1,t/.4)*.72:0;
 }else if(mode==='drop'){const door=groups.drop.getObjectByName('opening door');if(door)door.rotation.y=0;}
 if(mode==='piano'){vigil.root.rotation.z=1.47+Math.sin(elapsed*.8)*.025;}
 if(mode==='window'){
  screamer.root.position.y=t<0?-1.6:-1.6+2.45*(1-Math.pow(1-THREE.MathUtils.clamp(t/.42,0,1),3));
  if(t>=0){screamer.root.rotation.z=Math.sin(t*13)*.025;reachForBar(screamer,'LeftArm','LeftHand',[-.42,1.46,-.62]);reachForBar(screamer,'RightArm','RightHand',[.42,1.46,-.62]);}
  let energy=0;if(audio.analyser&&audio.data){audio.analyser.getByteFrequencyData(audio.data);for(let i=2;i<Math.min(65,audio.data.length);i++)energy+=audio.data[i];energy/=63*255;}
  const open=THREE.MathUtils.clamp(energy*5.5,0,1);mouth.visible=!!audio.active&&open>.06;cavity.scale.y=.009+open*.038;lip.scale.y=.32+open*.95;document.body.dataset.mouth=open.toFixed(3);
 }
 renderer.render(scene,camera);
 if(frame%60===0){document.body.dataset.calls=String(renderer.info.render.calls);document.body.dataset.triangles=String(renderer.info.render.triangles);document.body.dataset.audio=audio.active?'playing':'idle';}
}
render();window.__HORROR_SCARES_READY__=true;window.__HORROR_SCARES__={selectMode,trigger,reset,getState:()=>({mode,beatStart,frame,hangY:hang.root.position.y,screamerY:screamer.root.position.y,mouthHeight:cavity.scale.y,head:screamer.bones.Head?.getWorldPosition(new THREE.Vector3()).toArray(),headfront:screamer.model.getObjectByName('headfront')?.getWorldPosition(new THREE.Vector3()).toArray(),mouth:mouth.getWorldPosition(new THREE.Vector3()).toArray(),render:renderer.info.render})};
