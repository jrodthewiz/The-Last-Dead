import * as THREE from './vendor/three.module.js';
import { MeshToonNodeMaterial, LightingModel } from './vendor/three.webgpu.js';
import { attribute, color, diffuseColor, float, lights, mix, normalView, positionGeometry, reference, texture, uint, vec3, vec4 } from './vendor/three.tsl.js';

// Graphic material adaptation of the existing authored rigs. The exterior Ash
// atlas is grayscale; semantic groups come from its original bone weights and
// bind-pose coordinates, never from animated world height or replacement UVs.
const PALETTES = Object.freeze([
  Object.freeze({ skin: '#c3c5aa', shirt: '#c6bd9c', jacket: '#415d5d', trousers: '#596f73', boots: '#34434a', oral: '#623333', teeth: '#cec2a0' }),
  Object.freeze({ skin: '#bdc5b8', shirt: '#babfae', jacket: '#565969', trousers: '#353b4d', boots: '#202733', oral: '#66404a', teeth: '#cec4aa' }),
  Object.freeze({ skin: '#c4b3a0', shirt: '#b5aa8c', jacket: '#68504a', trousers: '#403d3d', boots: '#242a2d', oral: '#733c37', teeth: '#cfc1a0' }),
]);
const BORROWED_MAPS = ['map', 'alphaMap', 'normalMap', 'bumpMap', 'aoMap', 'lightMap', 'displacementMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'envMap'];
const FLAGS = ['side', 'shadowSide', 'transparent', 'opacity', 'alphaTest', 'alphaHash', 'alphaToCoverage', 'depthTest', 'depthWrite', 'colorWrite', 'blending', 'blendSrc', 'blendDst', 'blendEquation', 'blendSrcAlpha', 'blendDstAlpha', 'blendEquationAlpha', 'premultipliedAlpha', 'dithering', 'fog', 'toneMapped', 'vertexColors', 'visible', 'wireframe', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'stencilWrite', 'stencilWriteMask', 'stencilFunc', 'stencilRef', 'stencilFuncMask', 'stencilFail', 'stencilZFail', 'stencilZPass', 'clippingPlanes', 'clipIntersection', 'clipShadows'];
const clamp = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;

// Three discrete light values without allocating a gradient texture. This is
// the native Toon lighting contract, with derivative filtering at the bands.
class GraphicActorLighting extends LightingModel {
  constructor(parameters) { super(); this.parameters = parameters; }
  direct({ lightDirection, lightColor, reflectedLight }) {
    // lightDirection is view-space. normalView contains the native skinned,
    // morphed, transformed (and authored normal-map) result in that same space.
    const p = this.parameters, coordinate = normalView.dot(lightDirection).mul(.5).add(.5);
    const aa = coordinate.fwidth().max(.001);
    const middle = coordinate.smoothstep(float(p.thresholds[0]).sub(aa),float(p.thresholds[0]).add(aa));
    const upper = coordinate.smoothstep(float(p.thresholds[1]).sub(aa),float(p.thresholds[1]).add(aa));
    const band = float(p.bands[0]).add(middle.mul(p.bands[1]-p.bands[0])).add(upper.mul(p.bands[2]-p.bands[1]));
    reflectedLight.directDiffuse.addAssign(diffuseColor.rgb.mul(1/Math.PI).mul(band).mul(lightColor));
  }
  indirect(builder) {
    const { ambientOcclusion, irradiance, reflectedLight } = builder.context;
    reflectedLight.indirectDiffuse.addAssign(irradiance.mul(diffuseColor.rgb).mul(.42/Math.PI));
    reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion);
  }
}

class GraphicActorMaterial extends MeshToonNodeMaterial {
  constructor(parameters) { super(); this.actorParameters = parameters; }
  copy(source) { super.copy(source); this.actorParameters = source.actorParameters; return this; }
  setupLightingModel() { return new GraphicActorLighting(this.actorParameters); }
}

function materialRole(source, mesh) {
  const role = String(source.userData?.surfaceRole || source.userData?.afterlifeRole || source.userData?.lookRole || '');
  const name = `${role} ${source.name || ''} ${mesh.name || ''}`;
  if (/oral.?tissue|gums|tongue|cavity/i.test(name)) return 'oral';
  if (/teeth|dentition|enamel/i.test(name)) return 'teeth';
  if (/face|head.?hide|remote.?arms|\barms\b|\bskin\b/i.test(name) && !/exterior.*oral/i.test(mesh.name || '')) return 'skin';
  if (/cloth|torso|legs/i.test(name)) return 'cloth';
  return 'exterior';
}

function indexRuns(indices) {
  const runs = [];
  for (const i of indices) {
    const last = runs.at(-1);
    if (last && i === last[1]+1) last[1]=i; else runs.push([i,i]);
  }
  return runs;
}

function semanticDescriptor(source, mesh) {
  const role = materialRole(source,mesh), geometry = mesh.geometry;
  const bones = mesh.skeleton?.bones || [];
  const indices = bones.flatMap((bone,i) => /head|neck|jaw|tongue|hand|grip/i.test(bone.name || '') ? [i] : []);
  const runs = indexRuns(indices);
  const ash = role === 'exterior' && /Afterlife_Material_1/i.test(source.name || '') && bones.some(b => /^head$/i.test(b.name));
  // Measure only during construction, without setting shared geometry bounds.
  const p = geometry?.attributes.position;
  let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  if(p) for(let i=0;i<p.count;i++) { const x=p.getX(i),y=p.getY(i),z=p.getZ(i);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z); }
  const height = maxY-minY;
  const bounds = Number.isFinite(height) && height>.001 ? { minY, height, centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2 } : { minY:0,height:1.86,centerX:0,centerZ:0 };
  const weighted = role==='exterior' && runs.length>0 && !!geometry?.attributes.skinIndex && !!geometry?.attributes.skinWeight;
  return { role,ash,weighted,runs:weighted?runs:[],bounds,key:JSON.stringify([role,ash,weighted?runs:[],role==='exterior'?bounds:null]) };
}

function semanticGroups(descriptor) {
  if(descriptor.role!=='exterior') return null;
  let skin=float(0);
  if(descriptor.weighted) {
    const indices=attribute('skinIndex','uvec4'),weights=attribute('skinWeight','vec4');
    for(const component of ['x','y','z','w']) {
      let member=float(0);
      for(const [start,end] of descriptor.runs) {
        const matches=start===end?indices[component].equal(uint(start)):indices[component].greaterThanEqual(uint(start)).and(indices[component].lessThanEqual(uint(end)));
        member=member.max(matches.select(1,0));
      }
      skin=skin.add(member.mul(weights[component]));
    }
  }
  const {minY,height,centerX,centerZ}=descriptor.bounds;
  const heightUnit=positionGeometry.y.sub(minY).div(height),widthUnit=positionGeometry.x.sub(centerX).abs().div(height);
  if(!descriptor.weighted) skin=heightUnit.smoothstep(.85,.92);
  const shirt=descriptor.ash?float(1).sub(widthUnit.smoothstep(.063,.095)).mul(heightUnit.smoothstep(.46,.51)).mul(float(1).sub(heightUnit.smoothstep(.78,.83))).mul(positionGeometry.z.sub(centerZ).div(height).smoothstep(.004,.034)):float(0);
  // Pack three interpolated floats. Integer bone comparisons execute in the
  // vertex shader; fragments never interpolate or compare joint indices.
  return vec3(skin.clamp(0,1),shirt,float(1).sub(heightUnit.smoothstep(.09,.15))).toVarying('vBlackwaterActorGroups');
}

function paletteAlbedo(source, descriptor, palette, parameters) {
  const sample=source.map?texture(source.map):null,lum=sample?sample.rgb.dot(vec3(.2126,.7152,.0722)).clamp(0,1):float(.24);
  // Broad scan values retain seams, eyes, mouth and fabric folds without the
  // desaturated photographic microcontrast of the original single atlas.
  const broad=float(.16).add(lum.smoothstep(.010,.075).mul(.43)).add(lum.smoothstep(.075,.23).mul(.27)).add(lum.smoothstep(.23,.43).mul(.14));
  const detail=mix(broad,lum.mul(1.7).clamp(.12,1),parameters.textureDetail);
  let albedo;
  if(descriptor.role==='skin') albedo=color(palette.skin).mul(detail);
  else if(descriptor.role==='oral') albedo=color(palette.oral).mul(.8).mul(detail.add(.2).min(1));
  else if(descriptor.role==='teeth') albedo=color(palette.teeth).mul(detail.add(.30).min(1));
  else if(descriptor.role==='cloth') albedo=color(palette.jacket).mul(detail.mul(.52).add(.48));
  else {
    const groups=semanticGroups(descriptor),unitY=positionGeometry.y.sub(descriptor.bounds.minY).div(descriptor.bounds.height).toVarying('vBlackwaterActorHeight');
    const trouser=float(1).sub(unitY.smoothstep(.46,.54));
    const cloth=mix(color(palette.jacket),color(palette.trousers),trouser).mul(detail.mul(.52).add(.48));
    const shirt=mix(cloth,color(palette.shirt).mul(detail.mul(.70).add(.30)),groups.y);
    const skin=mix(shirt,color(palette.skin).mul(detail),groups.x.smoothstep(.18,.72));
    albedo=mix(skin,color(palette.boots).mul(detail.mul(.32).add(.68)),groups.z);
  }
  // Meshy's colored atlases already distinguish bare skin, fabric panels,
  // trousers, boots and wounds. Ash's grayscale palette remap discards that
  // authored separation. Keep the RGB atlas for generated bodies, while the
  // same toon lighting and live combat cues still own their game rendering.
  if(parameters.preserveAtlasColors&&sample)albedo=sample.rgb;
  // Runtime appearance and hit-color writes still target the borrowed source.
  // Normalize against its construction value: Ash's .55 authoring darkening
  // must not become an unintended extra multiplication of the new palette.
  const initial=source.color?.clone() || new THREE.Color(1,1,1);
  const cue=source.color?reference('color','color',source).div(color(initial).max(.015)).clamp(.55,1.6):vec3(1);
  return vec4(albedo.mul(cue),sample?sample.a:float(1));
}

/**
 * Apply native graphic materials to an existing actor, without changing its
 * topology, rig, animation state, texture objects or gameplay material owner.
 * Call syncState() after source scalar/alpha flag updates. Emissive and color
 * cues use live TSL source references. Warm up the result before combat.
 */
export function applyBlackwaterActorStyle(root,{kind=0,lightSources=null,enabled=true,textureDetail=.18,palette=null,preserveAtlasColors=false,bands=null,thresholds=null,filter=null}={}) {
  if(!root?.traverse) throw new TypeError('Actor style requires a Three.js root');
  const direction=PALETTES[Math.max(0,Math.min(2,Math.trunc(Number(kind)||0)))];
  const selectedPalette={...direction};
  if(palette) for(const name of Object.keys(selectedPalette)) if(typeof palette[name]==='string' && /^#[0-9a-f]{6}$/i.test(palette[name]))selectedPalette[name]=palette[name];
  const parameters={textureDetail:clamp(textureDetail,.18,0,.65),preserveAtlasColors:!!preserveAtlasColors,bands:[clamp(bands?.[0],.12,.05,.50),clamp(bands?.[1],.51,.51,.84),clamp(bands?.[2],1,.85,1.1)],thresholds:[clamp(thresholds?.[0],.39,.10,.55),clamp(thresholds?.[1],.73,.56,.95)]};
  const lighting=Array.isArray(lightSources)?lights(lightSources.filter(light=>light?.isLight)):null;
  const sourceVariants=new Map(),entries=[],variants=[],descriptors=[];
  let skipped=0,skinned=0,morphMeshes=0,triangles=0,draws=0;
  function variant(source,mesh) {
    if(!source?.isMeshStandardMaterial || source.userData?.blackwaterActorStyle) return source;
    const descriptor=semanticDescriptor(source,mesh);
    if(!sourceVariants.has(source))sourceVariants.set(source,new Map());
    const group=sourceVariants.get(source);
    if(group.has(descriptor.key))return group.get(descriptor.key);
    const material=new GraphicActorMaterial(parameters);
    material.name=`BlackwaterActor:${descriptor.role}:${source.name||'unnamed'}`;
    for(const flag of FLAGS) if(flag in source)material[flag]=source[flag];
    for(const key of BORROWED_MAPS) if(key in source)material[key]=source[key];
    for(const key of ['normalScale','emissive']) if(source[key]?.isVector2||source[key]?.isColor)material[key].copy(source[key]);
    for(const key of ['aoMapIntensity','lightMapIntensity','bumpScale','displacementScale','displacementBias','emissiveIntensity']) if(Number.isFinite(source[key]))material[key]=source[key];
    material.color.copy(source.color); material.colorNode=paletteAlbedo(source,descriptor,selectedPalette,parameters);
    material.opacityNode=reference('opacity','float',source).mul(source.alphaMap?texture(source.alphaMap).g:1);
    material.alphaTestNode=reference('alphaTest','float',source);
    if(source.emissive)material.emissiveNode=reference('emissive','color',source).mul(reference('emissiveIntensity','float',source)).mul(source.emissiveMap?texture(source.emissiveMap).rgb:1);
    if(lighting)material.lightsNode=lighting;
    material.userData={...source.userData,blackwaterActorStyle:true,lookRole:`actor-${descriptor.role}`,borrowedTextures:true};
    // Existing generic cleanup must not release these borrowed atlas objects.
    delete material.userData.afterlifeOwned; material.userData.sharedLibrary=true;
    group.set(descriptor.key,material);variants.push({source,material});descriptors.push({source:source.name||'',role:descriptor.role,ash:descriptor.ash,weighted:descriptor.weighted,runs:descriptor.runs,bounds:descriptor.bounds,albedoSource:parameters.preserveAtlasColors&&source.map?'authored-color-atlas':'semantic-palette'});
    return material;
  }
  root.traverse(mesh=>{
    if(!mesh.isMesh || mesh.userData?.graphicInk || mesh.userData?.lookOutline)return;
    const original=mesh.material,all=Array.isArray(original)?original:[original];
    const hasSemanticRole=all.some(m=>m?.userData?.afterlifeRole || m?.userData?.oralSurface);
    if(filter?!filter(mesh):(!mesh.isSkinnedMesh&&!hasSemanticRole)) { skipped++;return; }
    const adapted=Array.isArray(original)?original.map(source=>variant(source,mesh)):variant(original,mesh);
    if(Array.isArray(original)?adapted.every((m,i)=>m===original[i]):adapted===original){skipped++;return;}
    entries.push({mesh,original,adapted});if(mesh.isSkinnedMesh)skinned++;if(mesh.morphTargetInfluences?.length)morphMeshes++;
    triangles+=(mesh.geometry?.index?.count||mesh.geometry?.attributes.position?.count||0)/3;
    draws+=Array.isArray(original)?Math.max(1,mesh.geometry.groups?.length||original.length):1;
  });
  let disposed=false,isEnabled=false;
  const albedoMode=parameters.preserveAtlasColors?'authored-color-atlas':'semantic-palette';
  const diagnostics={direction:'graphic-horror',kind:Number.isFinite(Number(kind))?Number(kind):0,materialVariants:variants.length,sourceMaterials:sourceVariants.size,meshes:entries.length,skinnedMeshes:skinned,morphMeshes,skippedMeshes:skipped,sourceTriangles:triangles,sourceDrawCalls:draws,addedDrawCalls:0,addedTriangles:0,generatedTextures:0,generatedGeometries:0,borrowedTextures:new Set(variants.flatMap(({source})=>BORROWED_MAPS.map(key=>source[key]).filter(t=>t?.isTexture))).size,ink:'none',parameters,palette:selectedPalette,semantics:descriptors,authoredLights:lighting?.getLights().map(light=>light.name||light.type)||null,shaderStrategy:'native skinning/morphs and deformed view normal; existing bind-pose attributes produce vertex semantic masks, one vec3 and one float varying for exterior; one borrowed albedo sample; three derivative-filtered light bands',enabled:false,disposed:false};
  const api={diagnostics,setEnabled(value){
    if(disposed)return false;const next=!!value;if(next===isEnabled)return isEnabled;
    for(const entry of entries)entry.mesh.material=next?entry.adapted:entry.original;
    isEnabled=next;diagnostics.enabled=next;return next;
  },syncState(){
    if(disposed)return;
    for(const {source,material}of variants) {
      const oldTransparent=material.transparent,oldSide=material.side,oldAlphaHash=material.alphaHash;
      for(const key of FLAGS)if(key in source)material[key]=source[key];
      material.emissive.copy(source.emissive);material.emissiveIntensity=source.emissiveIntensity;
      if(oldTransparent!==material.transparent||oldSide!==material.side||oldAlphaHash!==material.alphaHash)material.needsUpdate=true;
    }
  },dispose(){
    if(disposed)return;api.setEnabled(false);disposed=true;diagnostics.disposed=true;
    for(const {material}of variants)material.dispose();
  }};
  diagnostics.albedoMode=albedoMode;
  if(parameters.preserveAtlasColors)diagnostics.shaderStrategy='native skinning/morphs and deformed view normal; authored RGB atlas and original normal/alpha maps; live combat color/emissive cues; three derivative-filtered light bands';
  api.setEnabled(enabled);return api;
}
