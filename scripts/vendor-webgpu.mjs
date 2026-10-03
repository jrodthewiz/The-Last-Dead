// Run only when intentionally updating the pinned renderer tooling.
// Normal builds consume these bundled files and never require npm/network.
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
for(const name of ['three.webgpu.js','three.tsl.js']) {
  let code=await readFile(`node_modules/three/build/${name}`,'utf8');
  code=code.replaceAll("from 'three/webgpu'","from './three.webgpu.js'");
  // r184 selects the non-instanced morph path when a pool temporarily has
  // zero/one active instance. That loses its per-instance morph texture.
  if(name==='three.webgpu.js'){
    const preparationPatches=[
      ['const refreshUniforms = [',"import { createCompilationBudget } from './compilation-budget.js';\n\nconst refreshUniforms = ["],
      ['\tasync buildAsync() {\n\n\t\tthis.prebuild();','\tasync buildAsync() {\n\n\t\tthis.prebuild();\n\t\tconst yieldCompilation = createCompilationBudget( yieldToMain );'],
      ['\t\t\t\t// Yield to main thread after each shader stage to prevent blocking\n\t\t\t\tawait yieldToMain();','\t\t\t\t// Yield after a bounded slice, including expensive shader stages.\n\t\t\t\tawait yieldCompilation();'],
      ['\t\t// Process compilation work items sequentially to avoid freezing\n\t\t// Yields between objects to keep animation smooth','\t\t// Process compilation sequentially, yielding after bounded time slices.\n\t\t// Cached objects do not each need a separate scheduler round trip.\n\t\tconst yieldCompilation = createCompilationBudget( yieldToMain );'],
      ['\t\t\t// Yield between objects to allow animation frames\n\t\t\tawait yieldToMain();','\t\t\t// Keep loading UI responsive without yielding per cached object.\n\t\t\tawait yieldCompilation();'],
    ];
    for(const [from,to]of preparationPatches){if(!code.includes(from))throw new Error('Pinned compilation budget patch no longer matches; review before updating vendor.');code=code.replace(from,to);}
    const original='this.mesh.count > 1 && ( this.mesh.morphTexture';
    if(!code.includes(original))throw new Error('Pinned r184 morph patch no longer matches; review before updating vendor.');
    code=code.replace(original, 'this.mesh.isInstancedMesh && ( this.mesh.morphTexture');
    const compileMarker='\t\t// Use sceneRef for render list to ensure lightsNode matches between compileAsync and render';
    if(!code.includes(compileMarker))throw new Error('Pinned compile camera patch no longer matches; review before updating vendor.');
    code=code.replace(compileMarker,`\t\t// Refresh preparation transforms and culling after a different rendered camera.
\t\tif ( scene.matrixWorldAutoUpdate === true ) scene.updateMatrixWorld();
\t\tcamera.updateWorldMatrix( true, false );
\t\tif ( camera.coordinateSystem !== this.coordinateSystem || ( this.reversedDepthBuffer === true && camera.reversedDepth !== true ) ) {
\t\t\tcamera.coordinateSystem = this.coordinateSystem;
\t\t\tif ( this.reversedDepthBuffer === true ) camera._reversedDepth = true;
\t\t\tcamera.updateProjectionMatrix();
\t\t}
\t\tif ( ! camera.isArrayCamera ) {
\t\t\t_projScreenMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
\t\t\t_frustum.setFromProjectionMatrix( _projScreenMatrix, camera.coordinateSystem, camera.reversedDepth );
\t\t}

${compileMarker}`);

  }
  await writeFile(`vendor/${name}`,code);
}
await build({stdin:{contents:"export {tslExports} from 'vgpu/three';",resolveDir:process.cwd()},bundle:true,format:'esm',outfile:'vendor/vgpu-three.js',external:['three/tsl'],plugins:[{name:'local-three',setup(b){b.onResolve({filter:/^three\/tsl$/},()=>({path:'./three.tsl.js',external:true}));}}]});
await copyFile('node_modules/vgpu/LICENSE','vendor/VGPU-LICENSE.txt');
await build({stdin:{contents:"export {default as Transpiler} from 'three/addons/transpiler/Transpiler.js';export {default as GLSLDecoder} from 'three/addons/transpiler/GLSLDecoder.js';export {default as TSLEncoder} from 'three/addons/transpiler/TSLEncoder.js';",resolveDir:process.cwd()},bundle:true,format:'esm',outfile:'vendor/glsl-to-tsl.js',plugins:[{name:'local-three',setup(b){b.onResolve({filter:/^three\/(webgpu|tsl)$/},args=>({path:args.path==='three/tsl'?'./three.tsl.js':'./three.webgpu.js',external:true}));}}]});
