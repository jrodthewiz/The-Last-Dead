import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {WebGPURenderer as Original,Scene,PerspectiveCamera,WebGPUCoordinateSystem} from '../node_modules/three/build/three.webgpu.js';
import {WebGPURenderer as Optimized} from '../vendor/three.webgpu.js';
const count=5000,report={scenario:'5000 cached render objects through native compileAsync, GPU managers stubbed; scheduler uses real setTimeout(0). Same object list and cached node/pipeline behavior before and after.',runs:[]};
for(const [name,Renderer]of [['before',Original],['after',Optimized]]){
 let yields=0,visited=0;
 globalThis.self={scheduler:{yield:async()=>{yields++;await new Promise(resolve=>setTimeout(resolve,0));}}};
 const r=Object.create(Object.getPrototypeOf(Renderer.prototype));
 const list={opaque:[{}],transparent:[],transparentDoublePass:[],begin(){},finish(){}};
 const item={object:{geometry:{drawRange:{start:0,count:3}}}};
 Object.defineProperty(r,'needsFrameBufferTarget',{value:false});
 Object.assign(r,{backend:{coordinateSystem:WebGPUCoordinateSystem},_initialized:true,_isDeviceLost:false,_renderTarget:null,_outputRenderTarget:null,
 _nodes:{nodeFrame:{renderId:0,update(){}},getForRenderAsync:async()=>{},updateBefore(){},updateForRender(){},updateAfter(){}},
 _renderContexts:{get:()=>({clippingContext:{updateGlobal(){}}})},_renderLists:{get:()=>list},_background:{update(){}},opaque:true,transparent:false,
 _objects:{get:()=>({})},_geometries:{updateForRender(){visited++;}},_bindings:{updateForRender(){}},_pipelines:{getForRender(){}},_projectObject(){},
 _renderObjects(){for(let i=0;i<count;i++)this._compilationPromises.push(item);}});
 const started=performance.now();await r.compileAsync(new Scene(),new PerspectiveCamera());
 report.runs.push({name,objects:visited,schedulerYields:yields,elapsedMs:performance.now()-started});
 console.log(report.runs.at(-1));
}
delete globalThis.self;
await fs.writeFile('output/playwright/compilation-scheduling-benchmark.json',JSON.stringify(report,null,2));
