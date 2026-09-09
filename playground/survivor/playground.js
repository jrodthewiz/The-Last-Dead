import * as THREE from '../../vendor/three.module.js';
import {Renderer} from '../../renderer.js';
import {newRun,makeCampaignCourse} from '../../engine.js';
import {updateSurvivors as candidate} from './survivor-runtime.js';
import {updateSurvivors as baseline} from './baseline-survivor-runtime.js';
import {installViewmodelDepthBoundary} from './viewmodel-depth.js';
const query=new URLSearchParams(location.search),version=query.get('version')||'candidate';
const renderer=new Renderer(document.querySelector('canvas')),run=newRun(makeCampaignCourse(0));
if(version!=='baseline')installViewmodelDepthBoundary(renderer.weaponRig);
else renderer.weaponRig.traverse(o=>{o.renderOrder=0;if(o.isMesh){o.onBeforeRender=()=>{};o.onAfterRender=()=>{};}});
run.mode='pause';run.pitch=-1.3;
renderer._buildWorld(run.course);
let view='first',pose='standing',studio=true,animate=false,time=1000,exploded=false;
const update=version==='baseline'?baseline:candidate;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0x34392f,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(run.x*4,-.015,run.y*4);renderer.scene.add(ground);
const fill=new THREE.HemisphereLight(0xdedac7,0x2b3026,1.6);renderer.scene.add(fill);
const fog=renderer.scene.fog,background=renderer.scene.background.clone();
const initialPositions=new Map();
function draw(){
 renderer._frameDt=1/60;renderer._updateCamera(run,time);renderer._updateCombat(run,time);update(renderer,run,time);
 const body=renderer._survivors.local;body.visible=true;
 renderer.worldRoot.visible=!studio;ground.visible=studio;fill.visible=studio;renderer.scene.fog=studio?null:fog;renderer.scene.background.copy(studio?new THREE.Color(0x171d19):background);
 renderer.weaponRig.visible=view==='first';
 if(view!=='first'){
  const angle=({front:0,left35:.61,right35:-.61,rear:Math.PI})[view],radius=3.4;
  renderer.cameraRig.position.set(run.x*4+Math.sin(angle)*radius,1.5,run.y*4-Math.cos(angle)*radius);renderer.cameraRig.rotation.set(0,0,0);
  renderer.camera.position.set(0,0,0);renderer.camera.lookAt(run.x*4,.85,run.y*4);renderer.camera.fov=40;renderer.camera.updateProjectionMatrix();
 }
 if(body.userData.sculptRuntime?.parts){for(const part of body.userData.sculptRuntime.parts){if(!initialPositions.has(part))initialPositions.set(part,new THREE.Vector3());initialPositions.get(part).copy(part.position);if(exploded)part.position.multiplyScalar(1.3);}}
 renderer.renderer.render(renderer.scene,renderer.camera);
 if(exploded)for(const [part,position]of initialPositions)part.position.copy(position);
}
function setPose(name){pose=name;Object.assign(run,{slide:0,z:0,vx:0,vy:0,distance:0,speed:0});if(name==='walking')Object.assign(run,{vx:1.5,distance:.22,speed:1.5});if(name==='slide')run.slide=1;if(name==='jump')run.z=.5;draw();}
function captureState(options={}){if(options.pose)setPose(options.pose);if(options.view)view=options.view;if(options.pitch!==undefined)run.pitch=options.pitch;if(options.weapon!==undefined)run.weapon=options.weapon;if(options.studio!==undefined)studio=options.studio;if(options.yaw!==undefined)run.angle=options.yaw;if(options.distance!==undefined)run.distance=options.distance;for(let i=0;i<20;i++)draw();return metrics();}
function metrics(){const b=renderer._survivors.local;renderer.scene.updateMatrixWorld(true);const boots=b.userData.legs.map(l=>new THREE.Box3().setFromObject(l.knee,true).min.y);let meshes=0,triangles=0;b.traverseVisible(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return{pose,view,headHidden:!b.userData.head.visible,armsHidden:b.userData.arms.every(a=>!a.shoulder.visible),boots,meshes,triangles,scale:b.scale.toArray(),eye:renderer.camera.getWorldPosition(new THREE.Vector3()).toArray(),parts:b.userData.sculptRuntime?.parts.map(p=>p.name)||[]};}
document.querySelector('#version').value=version;document.querySelector('#version').onchange=e=>location.search='?version='+e.target.value;
document.querySelector('#pose').onchange=e=>setPose(e.target.value);document.querySelector('#view').onchange=e=>{view=e.target.value;draw();};document.querySelector('#pitch').oninput=e=>{run.pitch=Number(e.target.value);draw();};document.querySelector('#weapon').onchange=e=>{run.weapon=Number(e.target.value);draw();};document.querySelector('#animate').onchange=e=>animate=e.target.checked;document.querySelector('#explode').onchange=e=>exploded=e.target.checked;document.querySelector('#worldToggle').onclick=()=>{studio=!studio;draw();};
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();renderer.canvas.addEventListener('pointerdown',e=>{pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(pointer,renderer.camera);const visible=[];renderer._survivors.local.traverseVisible(o=>{if(o.isMesh)visible.push(o);});const hit=ray.intersectObjects(visible,false)[0];if(hit)document.querySelector('#status').textContent=hit.object.userData.parts?.join(', ')||hit.object.name;});
addEventListener('resize',()=>{renderer.resize();draw();});
draw();await renderer._prepareWeaponResources(run.course);draw();document.querySelector('#status').textContent='Ready - '+version;
window.__BODY_PLAYGROUND__={renderer,run,captureState,metrics};window.__IMG2THREEJS_READY__=true;window.__IMG2THREEJS_CAPTURE__={setCamera:captureState,capturePass(){draw();return{ok:true,selector:'canvas'};}};
function frame(){if(animate){time+=16.667;run.distance+=.003;}draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
