// Run only when intentionally updating the pinned renderer tooling.
// Normal builds consume these bundled files and never require npm/network.
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {applyStartupPipelinePatches} from './webgpu-startup-patches.mjs';
for(const name of ['three.webgpu.js','three.tsl.js']) {
  let code=await readFile(`node_modules/three/build/${name}`,'utf8');
  code=code.replaceAll("from 'three/webgpu'","from './three.webgpu.js'");
  // r184 selects the non-instanced morph path when a pool temporarily has
  // zero/one active instance. That loses its per-instance morph texture.
  if(name==='three.webgpu.js'){
    const preparationPatches=[
      ['\t\tif ( texture.isFramebufferTexture ) {\n\n\t\t\tconst renderTarget = this.renderer.getRenderTarget();','\t\tif ( texture.isFramebufferTexture ) {\n\n\t\t\t// Bind-group preparation may allocate this before the first copy.\n\t\t\t// Forward the same target used for its type so HDR copies do not\n\t\t\t// inherit the preferred canvas BGRA format from a missing option.\n\t\t\tconst renderTarget = options.renderTarget === undefined ? this.renderer.getRenderTarget() : options.renderTarget;\n\t\t\toptions.renderTarget = renderTarget;'],
      ['this.hasAnimation = builder.object.isSkinnedMesh === true;','// Shared coastal shader state still refreshes each draw\'s attributes/uniforms.\n\t\tthis.hasAnimation = builder.object.isSkinnedMesh === true || ( builder.object.userData.coastalInstanceCapacity !== undefined && builder.geometry.hasAttribute( \'coastalMatrix0\' ) );'],
      ['const refreshUniforms = [',"import { createCompilationBudget } from './compilation-budget.js';\n\nconst refreshUniforms = ["],
      ['\t_createInstanceMatrixNode( assignBuffer, builder ) {','\t_createInstanceMatrixNode( assignBuffer, builder ) {\n\t\tif ( assignBuffer && builder.object.userData.coastalInstanceCapacity !== undefined && builder.geometry.hasAttribute( \'coastalMatrix0\' ) ) {\n\t\t\treturn mat4( attribute( \'coastalMatrix0\', \'vec4\' ), attribute( \'coastalMatrix1\', \'vec4\' ), attribute( \'coastalMatrix2\', \'vec4\' ), attribute( \'coastalMatrix3\', \'vec4\' ) );\n\t\t}'],
      ['\t\t\tif ( isStorageColor ) {','\t\t\tif ( builder.object.userData.coastalInstanceCapacity !== undefined && builder.geometry.hasAttribute( \'coastalInstanceColor\' ) ) {\n\t\t\t\tinstanceColorNode = attribute( \'coastalInstanceColor\', \'vec3\' );\n\t\t\t} else if ( isStorageColor ) {'],
      ['if ( object.isInstancedMesh || object.count > 1 || Array.isArray( object.morphTargetInfluences ) ) {','const coastalAttributes = object.userData.coastalInstanceCapacity !== undefined && object.geometry.hasAttribute( \'coastalMatrix0\' );\n\t\tif ( ( ( object.isInstancedMesh || object.count > 1 ) && ! coastalAttributes ) || Array.isArray( object.morphTargetInfluences ) ) {'],
      ['async compileAsync( scene, camera, targetScene = null ) {','async compileAsync( scene, camera, targetScene = null, onProgress = null ) {'],
      ['\tasync buildAsync() {\n\n\t\tthis.prebuild();','\tasync buildAsync() {\n\n\t\tthis.prebuild();\n\t\tconst yieldCompilation = createCompilationBudget( yieldToMain, undefined, this.renderer.compilationBudgetMs || 8 );'],
      ['\t\t\t\t// Yield to main thread after each shader stage to prevent blocking\n\t\t\t\tawait yieldToMain();','\t\t\t\t// Yield after a bounded slice, including expensive shader stages.\n\t\t\t\tawait yieldCompilation();'],
      ['\t\t// Process compilation work items sequentially to avoid freezing\n\t\t// Yields between objects to keep animation smooth','\t\t// Process compilation sequentially, yielding after bounded time slices.\n\t\t// Cached objects do not each need a separate scheduler round trip.\n\t\tconst yieldCompilation = createCompilationBudget( yieldToMain, undefined, this.compilationBudgetMs || 8 );'],
      ['\t\t\t// Yield between objects to allow animation frames\n\t\t\tawait yieldToMain();','\t\t\t// Keep loading UI responsive without yielding per cached object.\n\t\t\tawait yieldCompilation();'],
    ];
    for(const [from,to]of preparationPatches){if(!code.includes(from))throw new Error('Pinned compilation budget patch no longer matches; review before updating vendor.');code=code.replace(from,to);}
    const nodeOrder='\t\t\tthis._geometries.updateForRender( renderObject );\n\n\t\t\t// Use async node building to yield to main thread\n\t\t\tawait this._nodes.getForRenderAsync( renderObject );';
    if(!code.includes(nodeOrder))throw new Error('Pinned async node ordering patch no longer matches; review before updating vendor.');
    code=code.replace(nodeOrder,'\t\t\t// Build nodes before geometry discovery can request synchronous node state.\n\t\t\tawait this._nodes.getForRenderAsync( renderObject );\n\t\t\tthis._geometries.updateForRender( renderObject );');
    const loopStart='\t\tfor ( const item of compilationPromises ) {';
    const loopEnd='\t\t\t// Keep loading UI responsive without yielding per cached object.\n\t\t\tawait yieldCompilation();';
    if(!code.includes(loopStart)||!code.includes(loopEnd))throw new Error('Pinned compile progress patch no longer matches; review before updating vendor.');
    code=code.replace(loopStart,'\t\tlet compiledCount = 0, progressAt = performance.now();\n\t\tonProgress?.( 0, compilationPromises.length );\n\n'+loopStart);
    code=code.replace(loopEnd,loopEnd+'\n\t\t\tcompiledCount ++;\n\t\t\tif ( compiledCount === compilationPromises.length || performance.now() - progressAt >= 250 ) {\n\t\t\t\tonProgress?.( compiledCount, compilationPromises.length );\n\t\t\t\tprogressAt = performance.now();\n\t\t\t}');
    code=applyStartupPipelinePatches(code);
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
