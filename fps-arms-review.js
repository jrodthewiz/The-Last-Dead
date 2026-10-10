import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {Renderer} from './renderer.js';
import {FOREGROUND_ARM_URL,installForegroundArms} from './assets/survivor/foreground-arms.js';
import {FIRST_PERSON_HOLD_POSES as holds} from './assets/survivor/viewmodel-hold-poses.js';
import {FPS_ARM_URL,installFPSArms,sampleFPSClip,fpsGripDiagnostics} from './assets/survivor/fps-arms.js';
const scene=new T.Scene();scene.background=new T.Color('#303a3e');
const camera=new T.PerspectiveCamera(75,innerWidth/innerHeight,.025,220);camera.layers.enable(1);scene.add(camera);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;document.body.append(renderer.domElement);
const hemi=new T.HemisphereLight('#d8e1e4','#434a48',2);hemi.layers.enable(1);scene.add(hemi);
for(const [color,power,position]of [['#fff4df',3,[1,2,1]],['#b2d5e4',2,[-2,1,-1]]]){const light=new T.DirectionalLight(color,power);light.position.set(...position);light.layers.enable(1);scene.add(light);}
const r=Object.create(Renderer.prototype);r.materials={};r.camera=camera;r.weaponRig=new T.Group();camera.add(r.weaponRig);
r.weaponGroups=[r._makePulseRevolver(),r._makeBreachShotgun(),r._makeArcLance(),r._makeReliquaryAsset(),r._makeRifle('carrion',4),r._makeRifle('mourning',5),r._makeMelee('bat',6),r._makeMelee('chainsaw',7)];
r.weaponGroups.forEach((g,i)=>{const p=holds[i];g.position.set(...p.position);g.rotation.set(...p.rotation);g.scale.setScalar(p.scale);r.weaponRig.add(g);});
const controls=Object.fromEntries(['weapon','phase','play','time','clay','status'].map(k=>[k,document.getElementById(k)]));
controls.weapon.innerHTML=holds.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');controls.weapon.value='1';
let playing=true,time=0,last=performance.now(),ready=false;const materials=new Map(),clay=new T.MeshStandardMaterial({color:'#a7aaa9',roughness:.85});
function draw(){if(!ready)return;const index=Number(controls.weapon.value);r.weaponGroups.forEach((g,i)=>g.visible=i===index);const g=r.weaponGroups[index];controls.time.max=String(g.userData.authoredFPS.actions.get(controls.phase.value)?.duration||1);sampleFPSClip(g,controls.phase.value,time);renderer.render(scene,camera);controls.status.textContent=`${time.toFixed(2)}s`;}
function select(index,phase,seconds){controls.weapon.value=String(index);controls.phase.value=phase;playing=false;controls.play.textContent='Play';time=seconds;controls.time.value=String(time);draw();return fpsGripDiagnostics(r.weaponGroups[index]);}
controls.play.onclick=()=>{playing=!playing;controls.play.textContent=playing?'Pause':'Play';};
controls.weapon.onchange=()=>{const melee=Number(controls.weapon.value)>=6;for(const option of controls.phase.options)option.disabled=option.value==='fire'?melee:option.value==='strike'?!melee:false;controls.phase.value='idle';time=0;draw();};
controls.phase.onchange=()=>{time=0;draw();};controls.time.oninput=()=>{playing=false;controls.play.textContent='Play';time=Number(controls.time.value);draw();};
controls.clay.onchange=()=>{for(const g of r.weaponGroups)g.userData.authoredFPS.rig.traverse(o=>{if(o.isMesh){if(!materials.has(o))materials.set(o,o.material);o.material=controls.clay.checked?clay:materials.get(o);}});draw();};
try{const loader=new GLTFLoader();installForegroundArms(r,(await loader.loadAsync(FOREGROUND_ARM_URL)).scene);const asset=await loader.loadAsync(FPS_ARM_URL);installFPSArms(r,asset);ready=true;window.__FPS_WORKSHOP__={select,renderer,r,diagnostics:()=>fpsGripDiagnostics(r.weaponGroups[Number(controls.weapon.value)]),detail(side='right'){
 const state=r.weaponGroups[Number(controls.weapon.value)].userData.authoredFPS,arm=state.arms.find(a=>a.side===side);
 const point=state.rig.getObjectByName(`FPS_${state.name}_${side}_Middle0`).getWorldPosition(new T.Vector3());
 const detailCamera=new T.PerspectiveCamera(40,camera.aspect,.005,10);detailCamera.layers.enable(1);
 detailCamera.position.copy(point).add(new T.Vector3(side==='right'?.18:-.18,.13,.22));detailCamera.lookAt(point);
 const hidden=[];r.weaponGroups[Number(controls.weapon.value)].traverse(o=>{if(o.isMesh&&!o.userData.authoredFPSMesh){hidden.push([o,o.visible]);o.visible=false;}});
 renderer.render(scene,detailCamera);for(const [o,visible]of hidden)o.visible=visible;
 return {...renderer.info.render,scope:'Isolated glove/sleeve detail; hardware hidden for anatomy inspection'};
 }};draw();}catch(e){controls.status.textContent=e.message;console.error(e);}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){time+=dt;const index=Number(controls.weapon.value),duration=r.weaponGroups[index]?.userData.authoredFPS?.actions.get(controls.phase.value)?.duration||1;time%=duration;controls.time.value=String(time);draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);draw();});
