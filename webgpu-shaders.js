import * as GPU from './vendor/three.webgpu.js';
import * as TSL from './vendor/three.tsl.js';
import {Transpiler,GLSLDecoder,TSLEncoder} from './vendor/glsl-to-tsl.js';

// Legacy absent UV attributes read as zero; preserve that for untextured caps.
export const geometryUv=TSL.Fn(builder=>builder.geometry.hasAttribute('uv')?TSL.uv():TSL.vec2(0))();

export function instanceMatrixNode(builder) {
  return builder.geometry.hasAttribute('coastalMatrix0')
    ?TSL.mat4(...[0,1,2,3].map(column=>TSL.attribute(`coastalMatrix${column}`,'vec4')))
    :TSL.storage(builder.object.instanceMatrix,'mat4',Math.max(builder.object.instanceMatrix.count,1)).element(TSL.instanceIndex);
}

// Port the authored GLSL arithmetic through Three's official GLSL -> TSL
// transpiler. This runs once per custom material, never in the frame loop.
// Unsupported constructs throw; a failed port must not become an invisible effect.
export function shaderCompiler(source,renderer) {
  const varyingNodes={};
  const samplerNodes={};
  const compile=(input,stage,extra={})=>{
    const output=stage==='vertex'?'gl_Position':'gl_FragColor';
    const attributes={};
    let code=input.replace(/attribute\s+(\w+)\s+([^;]+);/g,(_,type,names)=>{for(const name of names.split(',').map(s=>s.trim()))attributes[name]=TSL.attribute(name,type);return '';});
    code=code.replace(/(uniform|varying)\s+(\w+)\s+(\w+(?:\s*,\s*\w+)+)\s*;/g,(_,kind,type,names)=>names.split(',').map(n=>`${kind} ${type} ${n.trim()};`).join('\n'));
    if(source.uniforms.uLens){
      code=code.replace(/#ifdef TONE_MAPPING|#endif/g,'').replace(/\btoneMapping\(/g,'tldTone(').replace(/\blinearToOutputTexel\(/g,'tldEncode(')
        .replace('#include <tonemapping_fragment>','gl_FragColor.rgb=tldTone(gl_FragColor.rgb);').replace('#include <colorspace_fragment>','gl_FragColor=tldEncode(gl_FragColor);');
    }else code=code.replace(/#include\s*<(tonemapping_fragment|colorspace_fragment)>/g,'');
    code=code.replace(/#ifdef USE_INSTANCING\s*([\s\S]*?)#endif/g,'$1');
    if(code.includes('#'))throw new Error(`Unported shader preprocessor: ${source.name||source.uuid}`);
    code=code.replace(/void\s+main\s*\(\s*\)\s*\{/,'vec4 main(){vec4 '+output+'=vec4(0.);');
    const end=code.lastIndexOf('}');code=code.slice(0,end)+`return ${output};`+code.slice(end);
    const encoder=new TSLEncoder();encoder.iife=true;encoder.reference=true;
    let js=new Transpiler(new GLSLDecoder(),encoder).parse(code);
    // GLSL vec3 also carries THREE.Color. TSL needs the color uniform type
    // to upload r/g/b instead of reading nonexistent x/y/z components.
    js=js.replace(/reference\( 'value', 'vec3', uniforms\[ '([^']+)' \] \)/g,(match,name)=>source.uniforms[name]?.value?.isColor?match.replace("'vec3'","'color'"):match);
    // Only actor cuts opt in. Resolve their values from each draw's material,
    // so a cached builder never retains another zombie's mutable wound data.
    js=js.replace(/reference\( 'value', '(\w+)', uniforms\[ '([^']+)' \] \)/g,(match,type,name)=>source.materialUniformNodes?.[name]?`materialUniformNodes['${name}']`:match);
    js=js.replace(/reference\( 'value', 'texture', uniforms\[ '([^']+)' \] \)/g,(_,name)=>{
      samplerNodes[name] ||= TSL.texture(source.uniforms[name].value || new GPU.Texture()).onRenderUpdate(()=>source.uniforms[name].value);
      return `samplerNodes['${name}']`;
    });
    // main must inline into the stage: varyings and attributes are stage IO,
    // not globals accessible from a standalone WGSL function.
    js=js.replace(/\}, \{ [^{}]*return: '\w+' \} \)/g,"} )");
    js=js.replace(/\}, \{ [^{}]*'(?:texture|sampler2D)'[^{}]*\} \)/g,"} )");
    js=js.replace(/\buv\b/g,'authoredUv');
    js=js.replace(/varying\( (\w+)\(\), '([^']+)' \)/g,(_,type,name)=>`(varyingNodes['${name}'] ||= TSL.varying(TSL.${type}(), '${name}'))`);
    const instanceMatrix=code.includes('instanceMatrix')?TSL.Fn(instanceMatrixNode)():TSL.mat4();
    js=js.replace(/const \{([^}]+)\} = TSL;/,(_,names)=>'const {'+names.split(',').filter(n=>n.trim()!=='authoredUv').join(',')+'} = TSL;');
    js=js.replace(/= (position|authoredUv|baseColor|baseRoughness|baseNormal|baseMetalness|baseOutgoing)(\.[xyzwrgba]{1,4})?(?=[,;])/g,(_,value,swizzle='')=>`= ${value}${swizzle}.toVar()`);
    const bindings={...attributes,materialUniformNodes:source.materialUniformNodes||{},instanceMatrix,tldTone:c=>TSL.toneMapping(GPU.ACESFilmicToneMapping,TSL.reference('toneMappingExposure','float',renderer),c),tldEncode:c=>TSL.workingToColorSpace(c,GPU.SRGBColorSpace),position:TSL.positionGeometry,authoredUv:source.uniforms.tScene?geometryUv.flipY():geometryUv,normal:TSL.normalGeometry,modelMatrix:TSL.modelWorldMatrix,modelViewMatrix:TSL.modelViewMatrix,viewMatrix:TSL.cameraViewMatrix,projectionMatrix:TSL.cameraProjectionMatrix,cameraPosition:TSL.cameraPosition,...extra};
    // Input is exclusively our bundled shader source, not player/remote code.
    return new Function('TSL','uniforms','varyingNodes','samplerNodes',...Object.keys(bindings),`return (${js.trim().replace(/;$/,'')})(TSL,uniforms).main();`)(TSL,source.uniforms,varyingNodes,samplerNodes,...Object.values(bindings));
  };
  return compile;
}

export function portShaderMaterial(source,renderer) {
  const compile=shaderCompiler(source,renderer);
  const material=new GPU.MeshBasicNodeMaterial();
  for(const key of ['name','transparent','opacity','depthTest','depthWrite','side','blending','blendSrc','blendDst','blendEquation','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','toneMapped'])material[key]=source[key];
  material.vertexNode=compile(source.vertexShader,'vertex');
  material.fragmentNode=compile(source.fragmentShader,'fragment');
  if(source.uniforms.uLens){material.fragmentNode=TSL.colorSpaceToWorking(material.fragmentNode,GPU.SRGBColorSpace);material.toneMapped=false;}
  material.userData.webgpuSource=source.uuid;
  return material;
}

