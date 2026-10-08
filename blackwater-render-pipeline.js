import {RenderPipeline,MeshBasicNodeMaterial} from './vendor/three.webgpu.js';
import {Layers,Vector2} from './vendor/three.module.js';
import {pass,mrt,normalView,normalViewGeometry,screenUV,uniform,vec2,vec3,vec4,float,Fn,builtinAOContext} from './vendor/three.tsl.js';
import {fxaa} from './vendor/tsl/display/FXAANode.js';
import {ao} from './vendor/tsl/display/GTAONode.js';

// GTAO changes ambient visibility inside material lighting. Sun and emission
// retain their energy. A separate geometric normal/depth pass avoids a cycle.
export function createBlackwaterRenderPipeline({renderer,scene,camera,looks}){
 const pipeline=new RenderPipeline(renderer);
 const normalMaterial=new MeshBasicNodeMaterial();
 normalMaterial.colorNode=normalViewGeometry;
 const prePass=pass(scene,camera,{samples:1});
 prePass.name='Blackwater geometry normals and depth';
 prePass.overrideMaterial=normalMaterial;prePass.transparent=false;
 prePass.setMRT(mrt({output:normalView}));
 prePass.setLayers(new Layers());
 const depth=prePass.getTextureNode('depth'),normals=prePass.getTextureNode();
 const gather=ao(depth,normals,camera);
 gather.resolutionScale=.5;gather.samples.value=12;gather.radius.value=.55;
 gather.thickness.value=.45;gather.scale.value=1.15;gather.useTemporalFiltering=false;
 const visibility=gather.getTextureNode(),texel=uniform(new Vector2());
 const filtered=Fn(()=>{
  const centerDepth=depth.sample(screenUV).r;
  const centerNormal=normals.sample(screenUV).xyz.normalize();
  const sum=float(0).toVar(),weights=float(0).toVar();
  for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
   const uv=screenUV.add(texel.mul(vec2(x,y)));
   const neighborDepth=depth.sample(uv).r;
   const neighborNormal=normals.sample(uv).xyz.normalize();
   // Perspective-depth derivatives establish a local discontinuity limit.
   const depthScale=centerDepth.fwidth().max(.000005).mul(2.5);
   const weight=neighborDepth.sub(centerDepth).abs().div(depthScale).negate().exp()
    .mul(centerNormal.dot(neighborNormal).max(0).pow(8));
   sum.addAssign(visibility.sample(uv).r.mul(weight));weights.addAssign(weight);
  }
  return sum.div(weights.max(.0001)).clamp(.20,1);
 })();
 const scenePass=pass(scene,camera);scenePass.name='Blackwater lit scene';
 const aoEnabled=uniform(1);scenePass.contextNode=builtinAOContext(float(1).sub(aoEnabled).add(filtered.mul(aoEnabled)));
 // Explicit graph dependency: the AO pre-pass must finish before the lit
 // pass starts. The material context alone is invisible to pass scheduling.
 const dependency=vec4(vec3(visibility.r.mul(0)),0);
 const edgeStrength=uniform(0),edgeTexel=uniform(new Vector2());
 const viewDepth=d=>float(camera.near*camera.far).div(float(camera.far).sub(d.mul(camera.far-camera.near)));
 const edges=Fn(()=>{
  const centerD=viewDepth(depth.sample(screenUV).r),centerN=normals.sample(screenUV).xyz.normalize();
  const strength=float(0).toVar();
  for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const uv=screenUV.add(edgeTexel.mul(vec2(x,y)));
   const d=viewDepth(depth.sample(uv).r);
   const depthEdge=d.sub(centerD).abs().div(centerD.max(.1)).smoothstep(.01,.045);
   const n=normals.sample(uv).xyz.normalize();
   const normalEdge=float(1).sub(centerN.dot(n)).smoothstep(.25,.8).mul(float(1).sub(centerD.smoothstep(30,90)));
   strength.assign(strength.max(depthEdge.max(normalEdge)));
  }
  return strength.mul(edgeStrength).clamp(0,.83);
 })();
 const lit=dependency.add(scenePass);
 const finalOutput=vec4(lit.rgb.mul(float(1).sub(edges)).add(vec3(.012,.020,.030).mul(edges)),lit.a);
 // FXAA works on the encoded output; tone/colour conversion occurs exactly once.
 const antiAliased=fxaa(finalOutput.renderOutput());
 pipeline.outputColorTransform=false;pipeline.outputNode=antiAliased;
 let enabled=true,debug='final',disposed=false;
 const drawingSize=new Vector2();
 function render(){
  if(disposed)return renderer.render(scene,camera);
  looks.update();
  const state=looks.diagnostics();
  if(!enabled||state.look==='baseline'||state.diagnostic!=='final')return renderer.render(scene,camera);
  renderer.getDrawingBufferSize(drawingSize);texel.value.set(2/drawingSize.x,2/drawingSize.y);edgeTexel.value.set(1.3/drawingSize.x,1.3/drawingSize.y);edgeStrength.value=state.look==='cartoon'?1:0;
  pipeline.render();
 }
 return{render,setEnabled(value){enabled=Boolean(value);},setAOEnabled(value){aoEnabled.value=value?1:0;},
  debug(mode='final'){
   if(!['final','ao','depth','normals'].includes(mode))throw new Error('Unknown pipeline diagnostic');
   debug=mode;
   pipeline.outputNode=mode==='ao'?vec4(vec3(filtered),1):mode==='depth'?vec4(vec3(prePass.getLinearDepthNode().div(80)),1):mode==='normals'?vec4(normals.rgb.mul(.5).add(.5),1):antiAliased;
   if(mode!=='final')pipeline.outputNode=pipeline.outputNode.renderOutput();
   pipeline.needsUpdate=true;
  },
  diagnostics:()=>({enabled,debug,ambientOcclusion:'r184 GTAO applied to indirect material lighting',samples:12,resolutionScale:.5,radiusMetres:.55,thicknessMetres:.45,filter:'3x3 depth and geometric-normal bilateral',temporalAccumulation:false,antiAliasing:'r184 FXAA on tone mapped sRGB output',aoEnabled:aoEnabled.value===1,graphicEdges:'four directional depth/geometric-normal samples, 1.3 pixel radius, cartoon only',passes:enabled?['geometry normal/depth','half-resolution GTAO','lit scene + output']:['lit scene']}),
  dispose(){if(disposed)return;disposed=true;pipeline.dispose();antiAliased.textureNode.renderTarget.dispose();antiAliased.textureNode._quadMesh.material.dispose();prePass.dispose();scenePass.dispose();gather._noiseNode.value.dispose();gather.dispose();normalMaterial.dispose();}
 };
}
