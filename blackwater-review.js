import * as THREE from './vendor/three.module.js';
import {createWebGPUBackend} from './webgpu-backend.js';
import {makeHarborCourse} from './harbor-course.js';
import {buildBlackwaterDistrict} from './blackwater-district-visuals.js';
import {newRun,tick,canStand} from './engine.js';
import {ScavengerCaches} from './scavenger-pack-ui.js';
import {createBlackwaterLookStudy,BLACKWATER_LOOKS} from './blackwater-render-looks.js';
import {createBlackwaterRenderPipeline} from './blackwater-render-pipeline.js';

const status=document.querySelector('#status'),canvas=document.querySelector('canvas');
try{
 const renderer=await createWebGPUBackend(canvas);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x80969b);scene.fog=new THREE.Fog(0x80969b,100,270);
 const course=makeHarborCourse({openWorld:true,lowTide:true}),slice=course.coastal.blackwaterSlice;
 const subject=buildBlackwaterDistrict(scene,slice);
 const textureReadiness=await subject.materials.ready;if(textureReadiness.failures.length)throw new Error(`Surface textures failed: ${textureReadiness.failures.join(', ')}`);
 const caches=new ScavengerCaches(scene,{...course,scavengerPickups:course.scavengerPickups.filter(p=>p.id==='coast-scrap-bell-pharmacy')});
 const fill=new THREE.HemisphereLight(0xc5dee3,0x4a493d,1.15);scene.add(fill);
 const sun=new THREE.DirectionalLight(0xffdfa5,2.5);sun.position.set(155,70,38);sun.target.position.set(185,0,56);sun.castShadow=true;
 sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:180});sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;
 sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun,sun.target);
 const floorGeo=new THREE.BoxGeometry(1,1,1),floorMaterials={ground:new THREE.MeshStandardMaterial({color:0x5d6251,roughness:1}),asphalt:subject.materials.asphalt,paving:subject.materials.paving,paint:new THREE.MeshStandardMaterial({color:0xbab291,roughness:.92})};
 for(const [role,material]of Object.entries(floorMaterials)){material.name=`study-${role}`;material.userData.lookRole=role;}
 function slab(x,z,w,d,mat,y,h=.12){let geometry=floorGeo;if(mat==='asphalt'||mat==='paving'){geometry=floorGeo.clone();const pos=geometry.attributes.position,uv=geometry.attributes.uv,metres=floorMaterials[mat].userData.textureMeters||2;for(let i=0;i<pos.count;i++)uv.setXY(i,(x+pos.getX(i)*w)/metres,-(z+pos.getZ(i)*d)/metres);}const mesh=new THREE.Mesh(geometry,floorMaterials[mat]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.receiveShadow=true;scene.add(mesh);}
 slab(190,56,108,124,'ground',-.25,.3);
 for(const z of [56,112]){slab(190,z,108,17,'paving',-.025);slab(190,z,108,12,'asphalt',.02,.055);for(let x=140;x<241;x+=9)slab(x,z,3,.13,'paint',.064,.012);}
 for(const x of [144,232]){slab(x,56,17,124,'paving',-.028);slab(x,56,12,124,'asphalt',.025,.05);}
 for(const b of slice.buildings)slab(b.x,b.z,b.width+.35,b.depth+.35,'paving',-.021);
 for(const p of course.coastal.neighborhoods.alleys.filter(p=>p.x<225))slab(p.x,p.z,p.width,p.depth,'paving',.015,.075);
 // Raised curbs define the road edge while keeping the model portal at grade.
 for(const z of [49.8,62.2])slab(190,z,80,.13,'paint',.11,.1);
 // Destination and house practicals now belong to the shared game factory.
 const camera=new THREE.PerspectiveCamera(55,1,.08,500);camera.layers.enable(1);
 const looks=createBlackwaterLookStudy({renderer,scene,subject,camera,sun,fill});
 const pipeline=createBlackwaterRenderPipeline({renderer,scene,camera,looks});
 const views={downtown:[[219,1.75,62],[196,2.7,46]],collapse:[[215,1.75,56],[200,7,48]],houses:[[204,1.75,58],[184,2.8,72]],shop:[[202,1.8,45.5],[197.7,1.3,37.1]],living:[[194,1.75,67.9],[187.6,1,69.9]],kitchen:[[194,1.75,74],[187.6,1.05,77.5]],yard:[[194,1.8,83],[194,1.6,73]],courtyard:[[214,1.9,29],[166,3.5,38]],overview:[[249,61,136],[185,3,52]],legacy:[[222,1.9,56],[177,4,43]]};
 const run=newRun(course);run.mode='play';run.harborProgress.initialized=true;course.enemies=[];let walking=false,currentView='downtown',pitch=0,last=performance.now(),acc=0;
 const keys=new Set();
 let captureMode=false;
 const render=()=>pipeline.render();
 function selectLook(id){looks.select(id);document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.look===id)));document.querySelector('#look-description').textContent=BLACKWATER_LOOKS[id].description;render();}
 document.querySelectorAll('[data-look]').forEach(b=>b.addEventListener('click',()=>selectLook(b.dataset.look)));
 function selectView(name){walking=false;document.body.classList.remove('walking');document.exitPointerLock?.();keys.clear();currentView=name;camera.position.fromArray(views[name][0]);camera.lookAt(...views[name][1]);
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));document.querySelector('#walk').setAttribute('aria-pressed','false');document.querySelector('#walk-house').setAttribute('aria-pressed','false');document.querySelector('#view-label').textContent=name==='houses'?'SALTWIND HOMES':name==='shop'?'BELL PHARMACY':name.toUpperCase();document.querySelector('#hint').innerHTML='Graphic horror · Blackwater. <span>Inspect the evacuation pharmacy or walk through the furnished family house.</span>';render();}
 function walk(destination='shop'){walking=true;document.body.classList.add('walking');const house=destination==='house';run.x=(house?194:202)/4;run.y=(house?59:55)/4;run.z=0;run.angle=house?Math.PI/2:-Math.PI/2;run.pitch=0;run.vx=run.vy=run.vz=0;pitch=0;keys.clear();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));document.querySelector('#walk').setAttribute('aria-pressed',String(!house));document.querySelector('#walk-house').setAttribute('aria-pressed',String(house));document.querySelector('#hint').innerHTML=house?'<span>WASD</span> move · <span>Mouse / arrow keys</span> look · Front door → living room → kitchen → rear yard.':'<span>WASD</span> move · <span>Mouse / arrow keys</span> look · <span>Esc</span> release mouse · Pharmacy supplies can be collected inside.';canvas.requestPointerLock?.();}
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));document.querySelector('#walk').addEventListener('click',()=>walk());document.querySelector('#walk-house').addEventListener('click',()=>walk('house'));
 canvas.addEventListener('click',()=>{if(walking)canvas.requestPointerLock?.();});
 addEventListener('keydown',e=>{if(/^(Key[WASD]|Arrow)/.test(e.code)){keys.add(e.code);e.preventDefault();}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
 document.addEventListener('pointerlockchange',()=>keys.clear());
 document.addEventListener('mousemove',e=>{if(walking&&document.pointerLockElement===canvas){run.angle+=e.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-1.2,1.2);}});
 function advance(ms){for(let i=0;i<Math.ceil(ms/1000*120);i++)tick(run,1/120,{forward:Number(keys.has('KeyW'))-Number(keys.has('KeyS')),strafe:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),turn:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'))});}
 function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(walking){acc+=dt;while(acc>=1/120){advance(1000/120);acc-=1/120;}camera.position.set(run.x*4,1.8+run.z*4,run.y*4);camera.lookAt(camera.position.x+Math.cos(run.angle)*Math.cos(pitch),camera.position.y+Math.sin(pitch),camera.position.z+Math.sin(run.angle)*Math.cos(pitch));document.querySelector('#view-label').textContent=run.backpack.collected.includes('coast-scrap-bell-pharmacy')?'SUPPLIES RECOVERED':'STREET INSPECTION';}caches.update(run.backpack.collected);if(!captureMode)render();requestAnimationFrame(frame);}
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();render();}addEventListener('resize',resize);resize();selectView('downtown');
 const lookParam=new URLSearchParams(location.search).get('look');selectLook(BLACKWATER_LOOKS[lookParam]?lookParam:'cartoon');
 await renderer.backend.device.queue.onSubmittedWorkDone();status.hidden=true;requestAnimationFrame(frame);
 window.__BLACKWATER_REVIEW__={renderer,scene,camera,subject,course,run,views,selectView,selectLook,looks,pipeline,render,walk,advance,setCaptureMode:value=>{captureMode=Boolean(value);},diagnostics:()=>({backend:renderer.migration.backend,view:currentView,look:looks.diagnostics(),pipeline:pipeline.diagnostics(),surfaces:subject.materials.diagnostics(),walking,player:{x:run.x,y:run.y},collected:run.backpack.collected,canStand:canStand(course,run.x,run.y,.1),draws:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles,subject:subject.diagnostics})};
}catch(error){status.textContent=`Blackwater could not open: ${error.message}`;console.error(error);}
