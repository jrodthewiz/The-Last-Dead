import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WebGPURenderer,Scene,PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial,Group,WebGPUCoordinateSystem} from '../vendor/three.webgpu.js';

// Exercise the vendored compile traversal and real Three.js frustum/matrices.
// Only GPU managers are replaced; pipeline submission records selected meshes.
function compilationHarness(){
  const renderer=Object.create(Object.getPrototypeOf(WebGPURenderer.prototype)),submitted=[];
  const list={opaque:[],transparent:[],transparentDoublePass:[],begin(){this.opaque=[];},finish(){},push(object){this.opaque.push({object});},pushLight(){}};
  Object.defineProperty(renderer,'needsFrameBufferTarget',{value:false});
  Object.assign(renderer,{backend:{coordinateSystem:WebGPUCoordinateSystem},_initialized:true,_isDeviceLost:false,_renderTarget:null,_outputRenderTarget:null,
    _nodes:{nodeFrame:{renderId:0,update(){}}},_renderContexts:{get:()=>({clippingContext:{updateGlobal(){}}})},
    _renderLists:{get:()=>list},_background:{update(){}},opaque:true,transparent:false,sortObjects:true,
    _renderObjects(objects){submitted.push(...objects.map(p=>p.object.name));}});
  return {renderer,submitted};
}
function box(name,x,z){const mesh=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial());mesh.name=name;mesh.position.set(x,0,z);return mesh;}
test('compileAsync culls with its requested camera after another camera and refreshes moved scene objects',async()=>{
  const {renderer,submitted}=compilationHarness(),scene=new Scene();
  const title=box('title',0,-8),coast=box('coast',100,-8),moved=box('moved',-100,-8);
  scene.add(title,coast,moved);
  const menuCamera=new PerspectiveCamera(55,1,.1,50);
  await renderer.compileAsync(scene,menuCamera);
  assert.deepEqual(submitted,['title'],'menu camera seeds a different culling view');
  submitted.length=0;
  // Both camera and mesh transforms change without manually updating matrices.
  const rig=new Group(),coastCamera=new PerspectiveCamera(55,1,.1,50);rig.add(coastCamera);rig.position.x=100;
  moved.position.x=101;
  const newlyLoaded=box('newly-loaded',99,-8);scene.add(newlyLoaded);
  await renderer.compileAsync(scene,coastCamera);
  assert.deepEqual(submitted.sort(),['coast','moved','newly-loaded'],'new camera compiles coastal objects and excludes the old title view');
  assert.equal(coastCamera.coordinateSystem,WebGPUCoordinateSystem,'compile prepares backend projection without an initial render');
  assert.equal(moved.matrixWorld.elements[12],101);
  assert.equal(coastCamera.matrixWorld.elements[12],100,'parented camera transform refreshed');
  submitted.length=0;
  await renderer.compileAsync(scene,menuCamera);
  assert.deepEqual(submitted,['title'],'camera switches work in both directions');
  for(const mesh of [title,coast,moved,newlyLoaded]){mesh.geometry.dispose();mesh.material.dispose();}
});

test('native preparation builds nodes asynchronously before attribute discovery and reports completion',async()=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=cb=>setImmediate(cb);
 try{
 const {renderer}=compilationHarness(),scene=new Scene(),mesh=box('fixture',0,-8),order=[],progress=[];
 scene.add(mesh);let ready=false;
 renderer._renderObjects=function(objects){for(const {object}of objects)this._compilationPromises.push({object});};
 renderer._objects={get:()=>({})};
 renderer._nodes.getForRenderAsync=async()=>{order.push('nodes');await new Promise(setImmediate);ready=true;};
 renderer._geometries={updateForRender(){assert.equal(ready,true,'geometry discovery must find finished node state');order.push('geometry');}};
 Object.assign(renderer._nodes,{updateBefore(){},updateForRender(){},updateAfter(){}});
 renderer._bindings={updateForRender(){}};renderer._pipelines={getForRender(){order.push('pipeline');}};
 await renderer.compileAsync(scene,new PerspectiveCamera(55,1,.1,50),null,(done,total)=>progress.push([done,total]));
 assert.deepEqual(order,['nodes','geometry','pipeline']);assert.deepEqual(progress,[[0,1],[1,1]]);
 mesh.geometry.dispose();mesh.material.dispose();
 }finally{globalThis.requestAnimationFrame=previous;}
});

test('vendored compilation overlaps only native pipeline jobs, drains failures, and reports 100% after completion',async()=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=cb=>setImmediate(cb);
 try{
 for(const fail of [false,true]){
  const {renderer}=compilationHarness(),scene=new Scene(),progress=[];let active=0,peak=0,serial=false,created=0;
  for(let i=0;i<6;i++)scene.add(box(`fixture-${i}`,0,-8));
  renderer.compilationConcurrency=3;
  renderer._renderObjects=function(objects){for(const {object}of objects)this._compilationPromises.push({object});};
  renderer._objects={get:object=>({object})};
  Object.assign(renderer._nodes,{async getForRenderAsync(){assert.equal(serial,false);serial=true;await new Promise(setImmediate);serial=false;},updateBefore(){},updateForRender(){},updateAfter(){}});
  renderer._geometries={updateForRender(){assert.equal(serial,false);}};renderer._bindings={updateForRender(){}};
  renderer._pipelines={getForRender(object,promises){const index=created++;active++;peak=Math.max(peak,active);promises.push(new Promise((resolve,reject)=>setTimeout(()=>{active--;if(fail&&index===1)reject(Error('invalid pipeline'));else resolve();},20)));}};
  const work=renderer.compileAsync(scene,new PerspectiveCamera(55,1,.1,50),null,(done,total)=>{if(done===total)assert.equal(active,0);progress.push([done,total]);});
  if(fail){await assert.rejects(work,/invalid pipeline/);assert.notDeepEqual(progress.at(-1),[6,6]);}else{await work;assert.deepEqual(progress.at(-1),[6,6]);}
  assert(peak>1&&peak<=3);assert.equal(active,0);
  for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}
 }
 }finally{globalThis.requestAnimationFrame=previous;}
});

test('native validation scopes pop in submission order and pipeline errors reject preparation',async()=>{
 const source=readFileSync(new URL('../vendor/three.webgpu.js',import.meta.url),'utf8');
 const start=source.indexOf('const compilation = device.createRenderPipelineAsync( pipelineDescriptor );',source.indexOf('class WebGPUPipelineUtils'));
 const end=source.indexOf('promises.push( p );',start)+'promises.push( p );'.length;
 assert(start>=0&&end>start);
 const submit=new Function('device','pipelineDescriptor','pipelineData','promises',source.slice(start,end));
 for(const fail of [false,true]){
  const events=[],releases=[],promises=[],states=[{},{}];
  const device={createRenderPipelineAsync({id}){events.push(`submit-${id}`);return new Promise((resolve,reject)=>releases[id]=()=>fail&&id===0?reject(Error('driver compile rejected')):resolve(id));},popErrorScope(){events.push('pop');return Promise.resolve(null);}};
  submit(device,{id:0},states[0],promises);submit(device,{id:1},states[1],promises);
  assert.deepEqual(events,['submit-0','pop','submit-1','pop']);
  releases[1]();releases[0]();
  if(fail){await assert.rejects(Promise.all(promises),/driver compile rejected/);assert.equal(states[0].error,true);}else{await Promise.all(promises);assert.deepEqual(states.map(s=>s.pipeline),[0,1]);}
 }
 const promises=[],state={};submit({createRenderPipelineAsync:()=>Promise.resolve({}),popErrorScope:()=>Promise.resolve({message:'validation rejected'})},{},state,promises);
 await assert.rejects(Promise.all(promises),/validation rejected/);assert.equal(state.error,true);
});
