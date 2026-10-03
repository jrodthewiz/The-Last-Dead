import * as THREE from './vendor/three.module.js';
import * as TSL from './vendor/three.tsl.js';
import {shaderCompiler,geometryUv} from './webgpu-shaders.js';

const vertexSections=['uv_vertex','begin_vertex','skinning_vertex','project_vertex'];
const fragmentSections=['clipping_planes_fragment','map_fragment','color_fragment','alphatest_fragment','roughnessmap_fragment','metalnessmap_fragment','normal_fragment_maps','lights_fragment_begin','lights_fragment_end','aomap_fragment','opaque_fragment'];
const section=name=>`\n//tld:${name}:start\n#include <${name}>\n//tld:${name}:end\n`;
const content=(code,name)=>code.split(`//tld:${name}:start`)[1]?.split(`//tld:${name}:end`)[0]||'';
const strip=code=>code.replace(/#include\s*<[^>]+>/g,'');
function preprocess(code,defines){
 const stack=[true];let result='';
 for(const line of code.replace(/(#(?:ifdef|ifndef|else|endif))/g,'\n$1').split('\n')){
  const match=line.match(/^\s*#(ifdef|ifndef)\s+(\w+)/);
  if(match){if(!(match[2] in defines))throw new Error(`Unsupported material define ${match[2]}`);stack.push(stack.at(-1)&&(match[1]==='ifdef'?defines[match[2]]:!defines[match[2]]));continue;}
  if(/^\s*#else/.test(line)){const old=stack.pop();stack.push(stack.at(-1)&&!old);continue;}
  if(/^\s*#endif/.test(line)){stack.pop();continue;}
  if(stack.at(-1))result+=line+'\n';
 }
 if(stack.length!==1)throw new Error('Unbalanced material preprocessor');return result;
}

// Replay only this game's authored hook edits onto explicit TSL material stages.
// Three continues to own skinning, PBR, shadows and environment lighting.
export function portMaterialHooks(source,material,renderer){
 if(source.onBeforeCompile===THREE.Material.prototype.onBeforeCompile)return;
 const shader={uniforms:{},vertexShader:`#include <common>\nvoid main(){${vertexSections.map(section).join('')}}`,fragmentShader:`#include <common>\n${section("lights_physical_pars_fragment")}\nvoid main(){${fragmentSections.map(section).join('')}}`};
 source.onBeforeCompile.call(source,shader,renderer);
 const definitions={USE_MAP:!!source.map,USE_COLOR:!!source.vertexColors,FLAT_SHADED:!!source.flatShading,DOUBLE_SIDED:source.side===THREE.DoubleSide,USE_INSTANCING:false};
 const clean=code=>preprocess(strip(code),definitions);
 const prefix=clean(shader.fragmentShader.split('void main')[0].replace(/\/\/tld:lights_physical_pars_fragment:start[\s\S]*?\/\/tld:lights_physical_pars_fragment:end/g,''));
 const vertexPrefix=clean(shader.vertexShader.split('void main')[0]);
 const bodies=Object.fromEntries(fragmentSections.map(name=>[name,name==='lights_fragment_begin'?'':clean(content(shader.fragmentShader,name))]));
 const safePrefix=prefix;
 const adapter={uniforms:shader.uniforms,name:source.name||source.customProgramCacheKey()};
 const compile=shaderCompiler(adapter,renderer);
 const bindings={baseColor:content(shader.fragmentShader,'map_fragment').includes('#include <map_fragment>')?TSL.materialColor:TSL.vec4(TSL.reference('color','color',source),1),vMapUv:geometryUv,vColor:TSL.attribute('color','vec3'),vNormal:TSL.normalView,vViewPosition:TSL.positionView.negate(),gl_FrontFacing:TSL.frontFacing,geometryNormal:TSL.normalView,baseMetalness:TSL.materialMetalness,baseRoughness:TSL.materialRoughness,baseNormal:TSL.normalView,transformed:TSL.positionLocal,map:source.map?TSL.texture(source.map):null,texture2DGradEXT:(image,uv,dx,dy)=>image.sample(uv).grad(dx,dy)};
 const vertexCode=vertexSections.map(name=>clean(content(shader.vertexShader,name))).join('\n');
 if(vertexCode.trim()){
  const code=`${vertexPrefix}\nvoid main(){${vertexCode}\ngl_Position=vec4(transformed,1.);}`;
  if(vertexCode.includes('transformed.y*=')){
   // Impact stretch belongs to the billboard before its instance transform.
   const local=compile(code,'vertex',{...bindings,transformed:TSL.positionGeometry.toVar()}).xyz;
   material.positionNode=TSL.Fn(builder=>{
    const delta=local.sub(TSL.positionGeometry);
    if(!builder.object.isInstancedMesh)return TSL.positionLocal.add(delta);
    const matrix=TSL.storage(builder.object.instanceMatrix,'mat4',Math.max(builder.object.instanceMatrix.count,1)).element(TSL.instanceIndex);
    return TSL.positionLocal.add(matrix.mul(TSL.vec4(delta,0)).xyz);
   })();
  }else material.positionNode=compile(code,'vertex',bindings).xyz;
 }
 const colorCode=['clipping_planes_fragment','map_fragment','color_fragment','alphatest_fragment'].map(n=>bodies[n]).join('\n');
 const common=`${safePrefix}\nvoid main(){vec4 diffuseColor=baseColor;float roughnessFactor=baseRoughness;float metalnessFactor=baseMetalness;vec3 normal=baseNormal;\n${colorCode}\n`;
 const make=(body,value,extra={})=>compile(`${common}${body}\ngl_FragColor=${value};}`,'fragment',{...bindings,...extra});
 if(colorCode.trim())material.colorNode=make('', 'diffuseColor');
 if(bodies.roughnessmap_fragment.trim()){
  const rough=bodies.roughnessmap_fragment.replace(/float roughnessFactor\s*=/g,'roughnessFactor=');
  material.roughnessNode=make(rough,'vec4(roughnessFactor)');material.roughnessNode=material.roughnessNode.x;
 }
 if(bodies.metalnessmap_fragment.trim())material.metalnessNode=make(bodies.metalnessmap_fragment,'vec4(metalnessFactor)').x;
 if(bodies.normal_fragment_maps.trim())material.normalNode=make(bodies.normal_fragment_maps,'vec4(normal,1.)').xyz;
 if(bodies.opaque_fragment.trim())material.outputNode=make(bodies.roughnessmap_fragment.replace(/float roughnessFactor\s*=/g,'roughnessFactor=')+'\n'+bodies.normal_fragment_maps+'\nvec3 outgoingLight=baseOutgoing;\n'+bodies.opaque_fragment,'vec4(outgoingLight,1.)',{baseOutgoing:TSL.output.rgb});
 if(source.userData.harvestTissueAtlas)material.vertexColors=false;
 const lightCode=bodies.lights_fragment_end+'\n'+bodies.aomap_fragment;
 const incident=shader.uniforms.uHarvestIncidentLimit;
 if(lightCode.trim()||incident){
  const original=material.setupLightingModel;
  material.setupLightingModel=function(builder){
   const model=original.call(this,builder),indirect=model.indirect.bind(model),direct=model.direct.bind(model);
   if(incident)model.direct=(input,b)=>{const energy=TSL.max(input.lightColor.r,TSL.max(input.lightColor.g,input.lightColor.b));direct({...input,lightColor:input.lightColor.div(energy.div(TSL.reference('value','float',incident).max(.01)).add(1))},b);};
   if(lightCode.trim())model.indirect=b=>{indirect(b);make(lightCode,'vec4(0.)',{reflectedLight:b.context.reflectedLight}).toStack();};
   return model;
  };
 }
 if(source.customProgramCacheKey().includes('viewmodel-spots')){
  const original=material.setupLights;
  material.setupLights=function(builder){const node=original.call(this,builder);return node?builder.renderer.lighting.createNode(node.getLights().filter(light=>!light.isSpotLight)):node;};
 }
 renderer.migration.hooks.push(source.name||source.customProgramCacheKey());
}
