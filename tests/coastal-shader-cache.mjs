import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/launcher-loading/shader-cache';await mkdir(output,{recursive:true});
const server=await startServer({port:0,root:'.'}),report={errors:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage({viewport:{width:640,height:480}});
 page.on('pageerror',error=>report.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.route('**/__coastal-cache.html',route=>route.fulfill({contentType:'text/html',body:String.raw`<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0"><canvas></canvas><script type="module">
 import * as THREE from '/vendor/three.module.js';
 import {RenderTarget} from '/vendor/three.webgpu.js';
 import {createWebGPUBackend} from '/webgpu-backend.js';
import {createCoastalInstances} from '/coastal-instancing.js';
 const renderer=await createWebGPUBackend(document.querySelector('canvas'));renderer.setSize(640,480);renderer.toneMapping=THREE.NoToneMapping;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0);
 const camera=new THREE.OrthographicCamera(-5,5,3.75,-3.75,.1,100);camera.position.z=10;camera.lookAt(0,0,0);
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial({color:0xffffff});
 const a=createCoastalInstances(geometry,material,1),b=createCoastalInstances(geometry,material,3);
 a.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-2,0,0));a.setColorAt(0,new THREE.Color(1,0,0));
 for(let i=0;i<3;i++){b.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i?50+i:2,0,0));b.setColorAt(i,new THREE.Color(0,1,0));}
 a.frustumCulled=b.frustumCulled=false;scene.add(a,b);
 const states=new Map(),build=renderer._nodes.getForRenderAsync.bind(renderer._nodes);
 renderer._nodes.getForRenderAsync=async object=>{const state=await build(object);if(object.object===a||object.object===b)states.set(object.object,state);return state;};
 const target=new RenderTarget(640,480);renderer.setRenderTarget(target);await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
 const sample=async x=>Array.from(await renderer.readRenderTargetPixelsAsync(target,x,240,1,1));
 const before={red:await sample(192),green:await sample(448),empty:await sample(512)};
 b.setMatrixAt(0,new THREE.Matrix4().makeTranslation(3,0,0));b.instanceMatrix.needsUpdate=true;b.setColorAt(0,new THREE.Color(0,0,1));b.instanceColor.needsUpdate=true;
 renderer.render(scene,camera);const after={red:await sample(192),old:await sample(448),blue:await sample(512)};
 const sharedNodeState=states.get(a)===states.get(b);
 const litMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});a.material=b.material=litMaterial;
 const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(0,0,10);scene.add(sun);states.clear();
 await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
 const lit={red:await sample(192),blue:await sample(512),sharedNodeState:states.get(a)===states.get(b)};
 const hook=new THREE.MeshBasicMaterial({color:0xffffff});hook.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y*=2.0;');};hook.customProgramCacheKey=()=> 'matrix-stretch-fixture';a.material=b.material=hook;
 states.clear();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
 const stretched={red:await sample(192),blue:await sample(512),sharedNodeState:states.get(a)===states.get(b)};
 const raw=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',fragmentShader:'void main(){gl_FragColor=vec4(1.0,0.0,0.0,1.0);}'});a.material=b.material=raw;
 states.clear();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
 const custom={left:await sample(192),right:await sample(512),sharedNodeState:states.get(a)===states.get(b)};
 window.cacheReport={sharedNodeState,distinctMatrixBuffers:a.geometry.getAttribute('coastalMatrix0').data!==b.geometry.getAttribute('coastalMatrix0').data,counts:[a.count,b.count],before,after,lit,stretched,custom};
 renderer.setRenderTarget(null);renderer.render(scene,camera);window.cacheReady=true;
 </script></body></html>`}));
 await page.goto(`http://127.0.0.1:${server.port}/__coastal-cache.html`);
 await page.waitForFunction(()=>window.cacheReady,null,{timeout:60000});
 Object.assign(report,await page.evaluate(()=>window.cacheReport));
 assert.equal(report.sharedNodeState,true);assert.equal(report.distinctMatrixBuffers,true);assert.deepEqual(report.counts,[1,3]);
 const bright=(pixel,channel)=>pixel[channel]>200&&pixel.filter((_,i)=>i!==channel&&i<3).every(value=>value<10);
 assert(bright(report.before.red,0));assert(bright(report.before.green,1));assert(report.before.empty.slice(0,3).every(value=>value<10));
 assert(bright(report.after.red,0));assert(bright(report.after.blue,2));assert(report.after.old.slice(0,3).every(value=>value<10));
 assert.equal(report.lit.sharedNodeState,true);assert(report.lit.red[0]>100&&report.lit.red[1]<10);assert(report.lit.blue[2]>100&&report.lit.blue[0]<10);
 assert.equal(report.stretched.sharedNodeState,true);assert(bright(report.stretched.red,0));assert(bright(report.stretched.blue,2));
 assert.equal(report.custom.sharedNodeState,true);assert(bright(report.custom.left,0));assert(bright(report.custom.right,0));
 assert.deepEqual(report.errors,[]);report.passed=true;await page.screenshot({path:`output/playwright/launcher-loading/shader-cache/independent-buffers.png`});
 console.log(JSON.stringify(report));
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser?.close();server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}
