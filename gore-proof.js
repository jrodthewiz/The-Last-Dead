import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';

const canvas=document.querySelector('canvas'),status=document.querySelector('[data-status]'),metrics=document.querySelector('[data-metrics]');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x151916);
const camera=new THREE.PerspectiveCamera(36,1,.01,20),target=new THREE.Vector3();
const hemi=new THREE.HemisphereLight(0xdfded1,0x343735,1.2),key=new THREE.DirectionalLight(0xffebd4,3),fill=new THREE.DirectionalLight(0xa9bdce,1.2);
key.position.set(-1.2,1.4,1.6);fill.position.set(1.5,.5,-1);scene.add(hemi,key,fill);
const clay=new THREE.MeshStandardMaterial({color:0xb4b0a6,roughness:.76,metalness:0});
let root=null,manifest=null,pose='packed',light='neutral',surface='pbr',focus='full',yaw=.18,pitch=.10,radius=1,fitRadius=1,morph=0,goal=0;
const parts=[],morphParts=[],sourceMaterials=new Map(),bounds=new THREE.Box3(),size=new THREE.Vector3(),clock=new THREE.Clock();

function select(attribute,value){for(const button of document.querySelectorAll(`[${attribute}]`))button.setAttribute('aria-pressed',String(button.getAttribute(attribute)===value));}
function fitPose(value){if(!root)return;const old=morphParts.map(mesh=>mesh.morphTargetInfluences[0]);morphParts.forEach(mesh=>mesh.morphTargetInfluences[0]=value);root.updateMatrixWorld(true);bounds.setFromObject(root,true);bounds.getCenter(target);bounds.getSize(size);morphParts.forEach((mesh,i)=>mesh.morphTargetInfluences[0]=old[i]);fitRadius=Math.max(size.x/camera.aspect,size.y,size.z)*1.75+.08;radius=fitRadius;}
function frame(){fitPose(focus==='detail'?0:goal);if(focus==='detail'){target.y+=.06;radius*=.82;}}
function setPose(value){pose=value;goal=value==='spill'?1:0;focus='full';select('data-pose',value);select('data-view','');frame();}
function setLight(value){
  light=value;select('data-light',value);
  const colors={neutral:[0xffebd4,0xa9bdce,0xdfded1],warm:[0xffae73,0xa6b4c4,0xd3bda5],cold:[0xaac8e4,0xd4b69a,0xbcc8d3]}[value];
  key.color.setHex(colors[0]);fill.color.setHex(colors[1]);hemi.color.setHex(colors[2]);
}
function setSurface(value){surface=value;select('data-surface',value);for(const mesh of parts)mesh.material=value==='clay'?clay:sourceMaterials.get(mesh);}
function setView(value){focus=value==='detail'?'detail':'full';select('data-view',value);yaw={front:0,side:Math.PI/2,back:Math.PI}[value]??0;pitch=.10;frame();}
function resize(){const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(root)frame();}

let drag=null;
canvas.addEventListener('pointerdown',event=>{drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;yaw-=(event.clientX-drag.x)*.008;pitch=THREE.MathUtils.clamp(pitch+(event.clientY-drag.y)*.006,-.7,.7);drag.x=event.clientX;drag.y=event.clientY;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
addEventListener('blur',()=>{drag=null;});canvas.addEventListener('wheel',event=>{event.preventDefault();radius=THREE.MathUtils.clamp(radius*Math.exp(event.deltaY*.001),fitRadius*.55,fitRadius*2.3);},{passive:false});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.pose)setPose(button.dataset.pose);if(button.dataset.light)setLight(button.dataset.light);if(button.dataset.surface)setSurface(button.dataset.surface);if(button.dataset.view)setView(button.dataset.view);});
addEventListener('resize',resize);const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

function diagnostics(){
  const materials=new Set(),textures=new Set();let triangles=0;
  for(const mesh of parts){triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;for(const material of [].concat(sourceMaterials.get(mesh))){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}}
  return{ready:!!root,error:window.__goreProofError||null,pose,light,surface,focus,morph,parts:parts.length,morphParts:morphParts.length,triangles,materials:materials.size,textures:textures.size,calls:renderer.info.render.calls,bounds:size.toArray(),manifest};
}
window.__GORE_PROOF__={diagnostics,setPose,setLight,setSurface,setView,renderer,scene,camera,get model(){return root;}};

try{
  const [gltf,response]=await Promise.all([new GLTFLoader().loadAsync('./art/gore-proof/ash-witness-abdominal-proof-v1.glb'),fetch('./art/gore-proof/ash-witness-abdominal-proof-v1-manifest.json')]);
  if(!response.ok)throw new Error(`Manifest returned ${response.status}`);manifest=await response.json();root=gltf.scene;scene.add(root);
  root.traverse(mesh=>{if(!mesh.isMesh)return;parts.push(mesh);sourceMaterials.set(mesh,mesh.material);mesh.frustumCulled=false;if(mesh.morphTargetInfluences?.length){morphParts.push(mesh);mesh.morphTargetInfluences[0]=1;}});
  root.updateMatrixWorld(true);bounds.setFromObject(root,true);bounds.getCenter(target);bounds.getSize(size);
  for(const mesh of morphParts)mesh.morphTargetInfluences[0]=0;
  fitRadius=Math.max(size.x,size.y,size.z)*1.65+.08;radius=fitRadius*(camera.aspect<1?1/camera.aspect:1);fitPose(0);
  status.textContent='Candidate study · inspect the cavity, tissue layers and attachment from every side.';
  metrics.textContent=`${Math.round(diagnostics().triangles).toLocaleString()} triangles\n${diagnostics().materials} shared materials · ${diagnostics().textures} textures\nSource-only candidate`;
  for(const button of document.querySelectorAll('[data-pose]'))button.disabled=false;
}catch(error){window.__goreProofError=error.message;status.textContent=`Study could not load: ${error.message}`;console.error(error);}

renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);morph=THREE.MathUtils.damp(morph,goal,9,dt);
  for(const mesh of morphParts)mesh.morphTargetInfluences[0]=morph;
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(radius));
  camera.lookAt(target);renderer.render(scene,camera);
});
addEventListener('pagehide',()=>{observer.disconnect();renderer.setAnimationLoop(null);for(const mesh of parts)mesh.geometry.dispose();const materials=new Set([clay,...sourceMaterials.values()].flat()),textures=new Set();for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}for(const texture of textures)texture.dispose();renderer.dispose();});
