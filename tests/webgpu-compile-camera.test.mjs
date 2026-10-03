import test from 'node:test';
import assert from 'node:assert/strict';
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
