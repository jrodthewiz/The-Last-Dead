import * as THREE from './vendor/three.module.js';
import {createProjectionTextureMaterial} from './projection-texture-material.js';

const host=document.querySelector('#viewport'),renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#141b1b');
const camera=new THREE.PerspectiveCamera(43,1,.05,100),target=new THREE.Vector3();
const hemi=new THREE.HemisphereLight(0xdfe9eb,0x625d4b,2),key=new THREE.DirectionalLight(0xfff2df,3.5),rim=new THREE.DirectionalLight(0xb4d2db,1.8);
key.position.set(-3,5,-4);rim.position.set(3,2,3);scene.add(hemi,key,rim);
const stage=new THREE.Group(),floor=new THREE.Mesh(new THREE.BoxGeometry(14,.12,14),new THREE.MeshStandardMaterial({color:0x343d39,roughness:.93}));floor.position.y=-.08;stage.add(floor);
const wall=new THREE.Mesh(new THREE.BoxGeometry(14,6,.1),new THREE.MeshStandardMaterial({color:0x283430,roughness:.95}));wall.position.set(0,2.9,3.5);stage.add(wall);scene.add(stage);
const objects=new THREE.Group();scene.add(objects);
const cache=new Map();let active,kind='cabinet',mode='painted',view='corner',radius=4,theta=-.55,phi=1.26,continuous=true,benchmarking=false,disposed=false;
const textureLoader=new THREE.TextureLoader();
async function json(url){const response=await fetch(url);if(!response.ok)throw Error(`${response.status} ${url}`);return response.json();}
function geometry(data){const g=new THREE.BufferGeometry();for(const [name,values,size] of [['position',data.positions,3],['normal',data.normals,3],['uv',data.uvs,2],['surfaceParams',data.surfaceParams,2]])if(values)g.setAttribute(name,new THREE.Float32BufferAttribute(values,size));g.setIndex(data.indices);g.computeBoundingSphere();return g;}
function nativeGeometry(source){
  const positions=[],normals=[],groups=new Map();
  for(const part of source.parts){const key=JSON.stringify([part.color,part.roughness,part.metalness]);if(!groups.has(key))groups.set(key,{part,indices:[]});const offset=positions.length/3;positions.push(...part.positions);normals.push(...part.normals);groups.get(key).indices.push(...part.indices.map(i=>i+offset));}
  const indices=[],materials=[],g=geometry({positions,normals,indices:[]});
  for(const {part,indices:partIndices} of groups.values()){g.addGroup(indices.length,partIndices.length,materials.length);indices.push(...partIndices);materials.push(new THREE.MeshStandardMaterial({color:new THREE.Color(...part.color),roughness:part.roughness,metalness:part.metalness}));}
  g.setIndex(indices);return {g,materials};
}
async function asset(subject){
  if(cache.has(subject))return cache.get(subject);
  const root=`./assets/projection-texture/${subject}/`;
  const [mesh,source,manifest,albedo,baseline]=await Promise.all([json(root+'mesh.json'),json(root+'native.json'),json(root+'manifest.json'),textureLoader.loadAsync(root+'albedo.webp'),textureLoader.loadAsync(root+'baseline.webp')]);
  albedo.colorSpace=baseline.colorSpace=THREE.SRGBColorSpace;
  const baked=geometry(mesh),native=nativeGeometry(source),materials={painted:createProjectionTextureMaterial(albedo),baseline:createProjectionTextureMaterial(baseline),clay:new THREE.MeshStandardMaterial({color:0x8b9290,roughness:.85})};
  const value={baked,native,materials,manifest,source,mesh,textures:[albedo,baseline]};cache.set(subject,value);return value;
}
function setCamera(){const h=active.manifest.kind==='cabinet'?2.05:3.86;target.set(0,h*.5,0);radius=h*2.2;theta=-.6;phi=1.26;
  if(view==='front'){theta=0;phi=Math.PI/2;}if(view==='back'){theta=Math.PI;phi=1.32;}if(view==='far'){radius=h*4;theta=-.4;phi=1.4;}updateCamera();}
function updateCamera(){camera.position.set(target.x+radius*Math.sin(theta)*Math.sin(phi),target.y+radius*Math.cos(phi),target.z-radius*Math.cos(theta)*Math.sin(phi));camera.lookAt(target);wall.visible=camera.position.z<3.3;}
function populate(count=1){for(const object of objects.children)if(object.isInstancedMesh)object.dispose();objects.clear();const native=mode==='native',g=native?active.native.g:active.baked,material=native?active.native.materials:active.materials[mode];
  if(count===1)objects.add(new THREE.Mesh(g,material));else{const mesh=new THREE.InstancedMesh(g,material,count),m=new THREE.Matrix4(),width=active.source.dimensions[0];for(let i=0;i<count;i++){m.makeTranslation((i%8-3.5)*(width+.25),0,-Math.floor(i/8)*1.1);mesh.setMatrixAt(i,m);}mesh.instanceMatrix.needsUpdate=true;objects.add(mesh);}render();}
function render(){if(disposed)return;renderer.render(scene,camera);}
function stats(){const m=active.manifest,native=mode==='native',textureCount=mode==='painted'||mode==='baseline'?1:0;document.querySelector('#stats').textContent=`${m.triangles} triangles / prop\n${native?m.sourceVertices:m.bakedVertices} vertices / prop\n${native?active.native.materials.length:1} material draws / prop\n${textureCount} texture maps · ${textureCount?(m.runtimeTextureBytesWithMipmaps/1048576).toFixed(2):'0'} MiB / asset\nShared across repeated copies`;
  document.querySelector('#tag').textContent=`${kind==='cabinet'?'Mourning cabinet':'Recovery wall patch'} · ${mode==='painted'?'Imagegen bake':mode==='baseline'?'Source-color atlas':mode==='clay'?'Neutral geometry':'Untextured source'}`;
  for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));document.querySelector('#atlas').src=`./assets/projection-texture/${kind}/albedo.webp`;
}
async function select(subject=kind,nextMode=mode){if(benchmarking)throw Error('Benchmark in progress');kind=subject;mode=nextMode;active=await asset(kind);document.querySelector('#subject').value=kind;setCamera();populate();stats();return snapshot();}
function lighting(value){hemi.color.set(value==='warm'?0xded4be:value==='cool'?0xbad4e4:0xdfe9eb);key.color.set(value==='warm'?0xffbb78:value==='cool'?0xb1d4ef:0xfff2df);render();}
function snapshot(){render();return{kind,mode,view,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,vertices:mode==='native'?active.manifest.sourceVertices:active.manifest.bakedVertices,manifest:active.manifest,camera:camera.position.toArray()};}
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve)),median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
async function sample(frames){const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),cpu=[],gpu=[],pending=[];
  for(let i=0;i<25;i++){await raf();render();}
  const draws=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  for(let i=0;i<frames;i++){await raf();const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();render();cpu.push(performance.now()-start);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}}
  for(let tries=0;pending.length&&tries<180;tries++){await raf();if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of pending)gl.deleteQuery(q);pending.length=0;gpu.length=0;break;}for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}}}
  for(const q of pending)gl.deleteQuery(q);return {cpuSubmitMedianMs:median(cpu),gpuMedianMs:gpu.length?median(gpu):null,gpuSamples:gpu.length,frames,draws,triangles,timerSupported:!!ext};}
async function benchmark({frames=60,count=64}={}){if(benchmarking)throw Error('Benchmark already running');benchmarking=true;continuous=false;const previous={mode,view};for(const control of document.querySelectorAll('select,button'))control.disabled=true;document.querySelector('#status').textContent='Measuring…';const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');const report={kind,count,viewport:[renderer.domElement.width,renderer.domElement.height],renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER),runs:[]};
  try{stage.visible=false;target.set(0,active.source.dimensions[1]*.5,-3);radius=active.source.dimensions[1]*7;theta=0;phi=1.45;updateCamera();
    // Counterbalanced runs compare the existing batched-material baseline,
    // textured source colors, and generated artwork. Equal triangle counts.
    for(const choice of ['native','baseline','painted','painted','baseline','native']){mode=choice;populate(count);report.runs.push({mode,...await sample(frames)});}
    report.summary=Object.fromEntries(['native','baseline','painted'].map(choice=>{const rows=report.runs.filter(r=>r.mode===choice);return [choice,{cpuSubmitMedianMs:median(rows.map(r=>r.cpuSubmitMedianMs)),gpuMedianMs:rows.every(r=>r.gpuMedianMs!==null)?median(rows.map(r=>r.gpuMedianMs)):null,draws:rows[0].draws,triangles:rows[0].triangles}];}));
    report.textureBytesPerAsset=active.manifest.runtimeTextureBytesWithMipmaps;report.rollout='preview only; source map unchanged';const n=report.summary.native,p=report.summary.painted,b=report.summary.baseline,gpu=s=>s.gpuMedianMs===null?'unavailable':s.gpuMedianMs.toFixed(3)+' ms';document.querySelector('#status').textContent=`${count} copies. GPU: source ${gpu(n)}, source atlas ${gpu(b)}, imagegen ${gpu(p)}. CPU submit: source ${n.cpuSubmitMedianMs.toFixed(2)} ms, imagegen ${p.cpuSubmitMedianMs.toFixed(2)} ms. Draws: ${n.draws} → ${p.draws}. Adding a map costs memory; this remains a separate preview.`;console.info('Projection bake benchmark',report);return report;
  }finally{mode=previous.mode;view=previous.view;stage.visible=true;setCamera();populate();stats();benchmarking=false;continuous=true;for(const control of document.querySelectorAll('select,button'))control.disabled=false;}
}
document.querySelector('#subject').addEventListener('change',e=>select(e.target.value).catch(fail));
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>select(kind,b.dataset.mode).catch(fail));
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{if(benchmarking)return;view=b.dataset.view;setCamera();render();});
document.querySelector('#light').addEventListener('change',e=>lighting(e.target.value));document.querySelector('#benchmark').addEventListener('click',()=>benchmark().catch(fail));
let pointer;host.addEventListener('pointerdown',e=>{if(benchmarking)return;pointer=[e.clientX,e.clientY];host.setPointerCapture(e.pointerId);});host.addEventListener('pointerup',()=>pointer=null);host.addEventListener('pointercancel',()=>pointer=null);host.addEventListener('pointermove',e=>{if(!pointer)return;theta-=(e.clientX-pointer[0])*.006;phi=Math.max(.08,Math.min(Math.PI-.08,phi+(e.clientY-pointer[1])*.006));pointer=[e.clientX,e.clientY];updateCamera();});host.addEventListener('wheel',e=>{e.preventDefault();if(benchmarking)return;radius=Math.max(.4,Math.min(35,radius*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false});
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();}new ResizeObserver(resize).observe(host);
function fail(error){document.querySelector('#status').textContent=error.message;console.error(error);}
renderer.setAnimationLoop(()=>{if(continuous)render();});
window.__PROJECTION_LAB__={select,snapshot,benchmark,setView(value){view=value;setCamera();render();return snapshot();},lighting};
select().then(()=>{resize();window.__PROJECTION_LAB__.ready=true;}).catch(fail);
window.addEventListener('pagehide',()=>{disposed=true;renderer.setAnimationLoop(null);for(const a of cache.values()){a.baked.dispose();a.native.g.dispose();for(const m of [...a.native.materials,...Object.values(a.materials)])m.dispose();for(const t of a.textures)t.dispose();}floor.geometry.dispose();floor.material.dispose();wall.geometry.dispose();wall.material.dispose();renderer.dispose();},{once:true});
