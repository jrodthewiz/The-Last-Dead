// Keep the checked-in renderer and intentional vendor regeneration identical.
export function applyStartupPipelinePatches(source) {
  let code=source.replaceAll('\r\n','\n');
  const patches=[
    ["import { createCompilationBudget } from './compilation-budget.js';","import { createCompilationBudget } from './compilation-budget.js';\nimport { createCompilationPipelineQueue } from './compilation-pipeline-queue.js';"],
    ['\t\tfor ( const item of compilationPromises ) {','\t\tconst pipelineQueue = createCompilationPipelineQueue( this.compilationConcurrency || 8 );\n\t\ttry {\n\t\tfor ( const item of compilationPromises ) {'],
    ['\t\t\tif ( pipelinePromises.length > 0 ) {\n\n\t\t\t\tawait Promise.all( pipelinePromises );\n\n\t\t\t}', '\t\t\tawait pipelineQueue.submit( pipelinePromises );'],
    ['if ( compiledCount === compilationPromises.length || performance.now() - progressAt >= 250 ) {','if ( compiledCount < compilationPromises.length && performance.now() - progressAt >= 250 ) {'],
    ['\t\t}\n\n\t}\n\n\t/**\n\t * Renders the scene in an async fashion.', '\t\t}\n\t\tawait pipelineQueue.finish();\n\t\t} catch ( error ) {\n\t\t\tawait pipelineQueue.finish().catch( () => {} );\n\t\t\tthrow error;\n\t\t}\n\t\tonProgress?.( compilationPromises.length, compilationPromises.length );\n\n\t}\n\n\t/**\n\t * Renders the scene in an async fashion.'],
  ];
  for(const [before,after]of patches){
    if(code.split(before).length!==2)throw Error('Pinned pipeline queue patch must match exactly once: '+before);
    code=code.replace(before,after);
  }
  const start=code.indexOf('\t\t\tconst p = new Promise( async ( resolve /*, reject*/ ) => {',code.indexOf('class WebGPUPipelineUtils'));
  if(start<0)throw Error('Missing pinned native pipeline creation');
  const end=code.indexOf('\n\n\t\t\tpromises.push( p );',start);
  if(end<0)throw Error('Missing pinned native pipeline promise');
  return code.slice(0,start)+`\t\t\t// Pop the validation scope in submission order before awaiting the GPU.
\t\t\tconst compilation = device.createRenderPipelineAsync( pipelineDescriptor );
\t\t\tconst validation = device.popErrorScope();
\t\t\tconst p = Promise.all( [ compilation, validation ] ).then( ( [ pipeline, scopeError ] ) => {
\t\t\t\tif ( scopeError !== null ) throw new Error( scopeError.message );
\t\t\t\tpipelineData.pipeline = pipeline;
\t\t\t} ).catch( ( err ) => {
\t\t\t\tpipelineData.error = true;
\t\t\t\tthrow err;
\t\t\t} );`+code.slice(end);
}
