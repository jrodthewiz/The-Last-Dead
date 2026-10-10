import * as THREE from './vendor/three.module.js';
import {COASTAL_DAYLIGHT} from './coastal-daylight-profile.js';
import {MeshToonNodeMaterial,MeshStandardNodeMaterial,MeshBasicNodeMaterial,LightingModel} from './vendor/three.webgpu.js';
import {positionLocal,normalLocal,positionWorld,positionView,normalWorld,normalView,diffuseColor,cameraPosition,cameraProjectionMatrix,screenSize,uniform,color,mix,float,vec2,vec3,texture,mx_noise_float,normalMap,attribute,Fn,If} from './vendor/three.tsl.js';
import {createBlackwaterStreetSurface} from './blackwater-street-surfaces.js';
import {capeResidentialCoastFields,capeWindwardHeathFields,capeGroveCourtFields} from './coastal-terrain-fields.js';

// Rendering study only: the original materials remain borrowed and recoverable.
// All three looks use the same geometry, seed, camera and sun direction.
export const BLACKWATER_LOOKS={
 baseline:{label:'Original',description:'Original inspection lighting and materials.',ink:0,exposure:1.25,sun:2.5,fill:1.15,sky:'#80969b',horizon:'#80969b',ground:'#4a493d',sunColor:'#ffdfa5'},
 cartoon:{label:'A · Graphic horror',description:'Weathered maritime colour, cool painted shadows and mineral coastal light.',ink:1.1,exposure:1,sun:2.05,fill:1.45,fillSky:'#a3bac9',sky:'#526d85',horizon:'#b6c6cd',ground:'#40534f',sunColor:'#f0e2cf',bands:[.075,.34,1]},
 illustrated:{label:'B · Printed nightmare',description:'Ink hatching, weathered print, parchment light and teal accents.',ink:1.3,exposure:1.2,sun:2.5,fill:1.7,fillSky:'#c8ccc4',sky:'#787f87',horizon:'#d7c7ab',ground:'#aaa390',sunColor:'#ffe3b9',bands:[.18,.43,.7,1]},
 realism:{label:'C · Rain-soaked realism',description:'Scanned PBR surfaces, contact occlusion, overcast light and wet gutters.',ink:0,exposure:1.25,sun:1.25,fill:1.1,fillSky:'#c1ccd1',sky:'#77838a',horizon:'#b7bdbd',ground:'#79807b',sunColor:'#e4e7e5'},
};
export const BLACKWATER_GRAPHIC_PALETTE={masonry:'#81939a',render:'#b4b9ad',brick:'#986e5c',pale:'#d4d0bf',wood:'#756e58',metal:'#628685',rust:'#956b51',glass:'#456e81',dark:'#263540',roof:'#424d52',roofSlate:'#465568',roofTile:'#805247',roofZinc:'#84908e',ground:'#526653',asphalt:'#465056',paving:'#99a49c',paint:'#dfddbf',foliage:'#527263',rubber:'#202d41',carPaint:'#ba925f',cloth:'#536f98',fabric:'#59a294',cardboard:'#bd8a49',paper:'#f0da9a',medicine:'#d6e7c8',medicalRed:'#c34432'};
Object.assign(BLACKWATER_GRAPHIC_PALETTE,{furnitureWood:'#a18b69',interiorWood:'#9b876d',interiorTile:'#a6b3b2',rug:'#497879'});
const PALETTE=BLACKWATER_GRAPHIC_PALETTE;

export function blackwaterMaterialRole(material){
 const name=material.name||'';
 if(name.includes('sign')||name.includes('notice'))return'sign';
 if(name.includes('house-siding'))return'house';
 if(material.userData.lookRole)return material.userData.lookRole;
 for(const [word,role]of [['concrete','masonry'],['render','render'],['brick','brick'],['limestone','pale'],['timber','wood'],['petrol','metal'],['steel','rust'],['glass','glass'],['recess','dark'],['roof','roof']])if(name.includes(word))return role;
 return material.userData.lookRole||'other';
}
const materialRole=blackwaterMaterialRole;
export function makeBlackwaterBands(values){
 const bytes=new Uint8Array(values.length*4);values.forEach((v,i)=>bytes.set([v*255,v*255,v*255,255],i*4));
 const map=new THREE.DataTexture(bytes,values.length,1,THREE.RGBAFormat);map.minFilter=map.magFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;return map;
}
const makeBands=makeBlackwaterBands;

// The city/woodland verge follows the same metre-space ribbon as its plants.
// A few broad soil breaks interrupt it; neither terrain nor movement changes.
export function coastalMeadowTint({organicCover=0}={}){
 const x=positionWorld.x,z=positionWorld.z;
 const center=float(389).add(z.sub(128).mul(.025).sin().mul(4)).add(z.mul(.061).sin().mul(1.7));
 const width=float(11).add(z.mul(.047).sin().mul(2));
 const ribbon=float(1).sub(x.sub(center).abs().smoothstep(width.mul(.35),width));
 const ends=z.smoothstep(124,140).mul(float(1).sub(z.smoothstep(310,328)));
 const patches=mx_noise_float(positionWorld.mul(vec3(.085,0,.060)),.5,0).smoothstep(-.35,.3);
 const inland=ribbon.mul(ends).mul(float(.28).add(patches.mul(.72)));
 const ops={add:(a,b)=>float(a).add(b),sub:(a,b)=>float(a).sub(b),mul:(a,b)=>float(a).mul(b),div:(a,b)=>float(a).div(b),
  max:(a,b)=>float(a).max(b),sin:a=>float(a).sin(),abs:a=>float(a).abs(),smooth:(a,b,v)=>float(v).smoothstep(a,b)};
 const coast=capeResidentialCoastFields(x,z,ops);
 let tint=mix(vec3(1),vec3(1.22,1.14,.87),inland);
 // Rooted organic terrain retains its own cool duff/moss response. The warm
 // salt wash belongs to exposed mineral ground, rather than the whole coast.
 const exposureWash=coast.domain.mul(float(.35).add(coast.exposure.mul(.4))).mul(float(1).sub(float(organicCover).clamp(0,1).mul(.9)));
 tint=mix(tint,vec3(1.38,1.24,.94),exposureWash);
 tint=mix(tint,vec3(.78,.87,.70),coast.scrub.mul(.92));
 tint=mix(tint,vec3(1.83,1.60,1.17),coast.trace);
 tint=mix(tint,vec3(1.49,1.47,1.39),coast.bedrock);
 const windward=capeWindwardHeathFields(x,z,ops);
 // The same authored habitat owns rooted growth and its darker peat base.
 // Salt-exposed skirts are ochre; sheltered hearts stay cool and organic.
 const heath=mix(vec3(.65,.76,.61),vec3(.91,.83,.62),windward.exposure);
 tint=mix(tint,heath,windward.cover.mul(.78));
 const courtTint=Fn(()=>{
  const out=vec3(1).toVar();
  If(x.greaterThan(340).and(x.lessThan(410)).and(z.greaterThan(250)).and(z.lessThan(282)),()=>{
   const court=capeGroveCourtFields(x,z,ops);
   out.assign(mix(vec3(1),vec3(.77,.83,.71),court.cover.mul(float(.52).add(court.shelter.mul(.25)))));
  });
  return out;
 })();
 return tint.mul(courtTint).mul(float(1).add(patches.sub(.5).mul(coast.domain).mul(.12)));
}

// Graphic construction detail, in metres. The same named field owns the
// visible mark and its diagnostic; derivative attenuation removes subpixel
// joints rather than making a distant façade shimmer. A's three light bands
// remain unchanged. These are deliberately matte printed surfaces, not PBR.
function graphicSurface(role,tint,roofPlaneEnabled=false){
 const street=createBlackwaterStreetSurface(role,tint);
 if(street)return street;
 if(role==='ground')return {color:color(tint).mul(coastalMeadowTint()),
  metadata:{coordinates:'world XZ metres',channels:'shared exposure, lee scrub, paving-connected worn traces and mineral lenses / inland meadow ribbon',extent:[384,448,0,120]}};
 const joint=(coordinate,width)=>{
  const phase=coordinate.fract(),footprint=coordinate.fwidth().max(.0005);
  const edge=phase.min(float(1).sub(phase));
  return float(1).sub(edge.smoothstep(width,float(width).add(footprint)))
   .mul(float(1).sub(footprint.smoothstep(.18,.5)));
 };
 if(role==='brick'){
  const along=mix(positionWorld.z,positionWorld.x,normalWorld.z.abs().smoothstep(.45,.55));
  // Historic common brick: 215 × 65 mm plus a 10 mm lime joint. These
  // physical courses stay small at street height; distant units filter away.
  const courses=positionWorld.y.div(.075),heads=along.div(.225).add(courses.floor().mod(2).mul(.5));
  const vertical=float(1).sub(normalWorld.y.abs().smoothstep(.6,.9));
  const structure=joint(courses,.0667).max(joint(heads,.0222)).mul(vertical);
  // Two broad gravity-aligned streak fields, confined to the lower masonry.
  const streak=along.mul(.73).sin().add(along.mul(2.11).sin().mul(.28)).smoothstep(.55,1.04);
  const wear=streak.mul(float(1).sub(positionWorld.y.smoothstep(.5,5.0))).mul(vertical);
  const brickTone=mx_noise_float(vec3(heads.floor().mul(.67),courses.floor().mul(.87),normalWorld.z.abs()),.5,.5).mul(.15);
  const salt=mx_noise_float(vec3(along.mul(.12),positionWorld.y.mul(.20),0),.5,0).smoothstep(.02,.36).mul(vertical);
  const runoff=along.mul(.43).sin().add(along.mul(1.27).sin().mul(.4)).smoothstep(.38,1.13)
   .mul(positionWorld.y.smoothstep(1.2,7)).mul(vertical);
  const fired=color(tint).mul(float(.95).add(brickTone).sub(wear.mul(.18)).sub(runoff.mul(.12)))
   .add(color('#aca68d').mul(salt.mul(.09)));
  const lime=color('#979487').mul(float(.92).sub(wear.mul(.16)).sub(runoff.mul(.10)));
  return{color:mix(fired,lime,structure.mul(.78)),structure,wear,
   metadata:{coordinates:'world metres / dominant vertical face',brick:[.225,.075],mortarMetres:[.010,.010],filter:'fwidth joints fade at 0.18..0.5 cells per pixel',channels:'fired brick and lime mortar / damp and salt; unchanged toon lighting'}};
 }
 if(role==='render'||role==='pale'||role==='masonry'){
  const along=mix(positionWorld.z,positionWorld.x,normalWorld.z.abs().smoothstep(.45,.55));
  const vertical=float(1).sub(normalWorld.y.abs().smoothstep(.6,.9));
  const broad=mx_noise_float(vec3(along.mul(.16),positionWorld.y.mul(.24),0),.5,0);
  const damp=along.mul(.71).sin().add(along.mul(2.33).sin().mul(.32)).smoothstep(.47,1.13)
   .mul(float(1).sub(positionWorld.y.smoothstep(.4,4.8))).mul(vertical);
  const wear=broad.smoothstep(.12,.42).mul(vertical);
  return{color:color(tint).mul(float(.94).add(broad.mul(.12)).sub(damp.mul(.16))).add(color('#8b917c').mul(wear.mul(.04))),wear,
   metadata:{coordinates:'world metres / vertical construction',channels:'broad plaster ageing, rising damp, mineral surface; matte graphic lighting'}};
 }
 if(role.startsWith('roof')){
  const width=role==='roofZinc'?1.25:.65;
  const structure=joint(positionWorld.x.div(width),.008)
   .mul(normalWorld.y.abs().smoothstep(.2,.75));
  const wear=mx_noise_float(positionWorld.mul(vec3(.045,.02,.045)),.5,.5).clamp(0,1);
  const legacy=color(tint).mul(float(.84).add(wear.mul(.19)).sub(structure.mul(.18)));
  if(!roofPlaneEnabled)return{color:legacy,structure,wear,
   metadata:{coordinates:'world metres',channels:'broad roof weathering / derivative-filtered standing seams',filter:'fwidth seam attenuation'}};
  const plane=attribute('roofPlane','vec4'),along=plane.x,uphill=plane.y,run=plane.z.max(.001),kind=plane.w;
  const finish=Fn(()=>{
   // Materialize derivative expressions on this stack before varying branches.
   const footprint=uphill.fwidth().max(.0005).toVar(),drain=float(1).sub(uphill.smoothstep(0,float(1.4).add(footprint)));
   const seatDistance=run.sub(uphill),seat=float(1).sub(seatDistance.smoothstep(0,float(.6).add(footprint)));
   const hasSeat=kind.sub(1).mul(4).clamp(0,1);
   const middle=uphill.smoothstep(1.4,float(2.2).add(footprint)).mul(float(1).sub(uphill.div(run).smoothstep(.72,.94)));
   const zincSeams=joint(along.div(1.25),.008).toVar(),slateCourses=joint(uphill.div(.32),.012).toVar();
   const zinc=color(tint).mul(float(.84).add(wear.mul(.19))).mul(float(1).sub(drain.mul(.15)).sub(seat.mul(hasSeat).mul(.05)).add(middle.mul(.05))).mul(float(1).sub(zincSeams.mul(.12)));
   const slate=color(tint).mul(float(.84).add(wear.mul(.19))).mul(float(1).sub(drain.mul(.08))).mul(float(1).sub(slateCourses.mul(.10)));
   const out=legacy.toVar();
   If(kind.greaterThan(.5).and(kind.lessThan(1.5)),()=>out.assign(zinc));
   If(kind.greaterThan(1.5),()=>out.assign(slate));
   return out;
  })();
  return{color:finish,structure,wear,
   metadata:{coordinates:'owned roofPlane physical metres before placement yaw',encoding:'0 legacy;1 zinc;1.25 proven monitor seat;2 residential',eaveBand:1.4,seatBand:.6,zincDrainMax:.15,zincSeatMax:.05,zincCleanMax:.05,residentialDrainMax:.08,channels:'eave-anchored drainage / zinc downhill seams / residential cross-slope slate courses',filter:'unconditional fwidth before varying type selection'}};
 }
 if(role==='interiorWood'){
  const planks=positionWorld.x.div(.36),ends=positionWorld.z.div(2.4).add(planks.floor().mod(3).div(3));
  const structure=joint(planks,.006).max(joint(ends,.001));
  const variation=planks.floor().mul(2.37).sin().mul(.045);
  const wear=float(0);
  return{color:color(tint).mul(float(1).add(variation).sub(structure.mul(.22))),structure,wear,
   metadata:{coordinates:'world XZ metres',boards:[.36,2.4],jointMetres:[.0022,.0024],filter:'fwidth joints fade at 0.18..0.5 cells per pixel',channels:'matte graphic albedo; unchanged toon lighting'}};
 }
 return null;
}
class PaintedCelLighting extends LightingModel {
 direct({lightDirection,lightColor,reflectedLight}){
  const n=normalView.dot(lightDirection).mul(.5).add(.5),aa=n.fwidth().max(.001);
  const band=float(.075).add(n.smoothstep(float(.40).sub(aa),float(.40).add(aa)).mul(.265)).add(n.smoothstep(float(.72).sub(aa),float(.72).add(aa)).mul(.66));
  reflectedLight.directDiffuse.addAssign(diffuseColor.rgb.mul(band).mul(lightColor).mul(1/Math.PI));
 }
 indirect(builder){const {irradiance,ambientOcclusion,reflectedLight}=builder.context;reflectedLight.indirectDiffuse.addAssign(irradiance.mul(diffuseColor.rgb).mul(.58/Math.PI));reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion);}
}
export class BlackwaterPaintedMaterial extends MeshToonNodeMaterial {
 setupLightingModel(){return new PaintedCelLighting();}
}
// Shared world-space mineral field: bedding continues across the headland mesh
// instead of restarting on individual rocks. Vertex colors still own turf,
// exposed mineral and tidal zones; no textures or additional draws are needed.
export function configureCoastalRockMaterial(material){
 const exposure=attribute('geologicalExposure','vec4');
 const face=exposure.x,cleavage=exposure.y,talus=exposure.z,cap=exposure.w;
 const strike=positionWorld.x.mul(.94).add(positionWorld.z.mul(.342));
 const cross=positionWorld.z.mul(.94).sub(positionWorld.x.mul(.342));
 const bed=positionWorld.y.sub(positionWorld.x.mul(.145)).add(positionWorld.z.mul(.048));
 // Long mineral fibres follow the inclined cleavage direction. Do not outline
 // a noise zero contour: its closed loops looked like worms on every face.
 const cleavageGrain=mx_noise_float(vec3(strike.mul(.045),bed.mul(5.1),cross.mul(.11)),.5,0);
 const footprint=cleavageGrain.fwidth().max(.0005);
 const lamination=cleavageGrain.mul(float(1).sub(footprint.smoothstep(.08,.32))).mul(face);
 const grain=mx_noise_float(positionWorld.mul(3.6),.5,0);
 const fine=mx_noise_float(positionWorld.mul(15),.5,0);
 const mineral=mx_noise_float(positionWorld.mul(vec3(.35,.6,.35)),.5,0);
 const wet=float(1).sub(positionWorld.y.smoothstep(-.6,1.4));
 const runoff=cleavage.mul(float(.4).add(mx_noise_float(vec3(strike.mul(.6),bed.mul(.12),cross.mul(.6)),.5,0))).max(0);
 material.colorNode=color('#ffffff').mul(float(.99).add(grain.mul(.14)).add(fine.mul(.055)).add(mineral.mul(.10))
  .add(lamination.mul(.10)).sub(runoff.mul(.18))).mul(float(1).sub(wet.mul(.25)))
  .mul(mix(vec3(1),vec3(.88,.94,.80),cap.mul(.12)));
 if(material.isMeshStandardNodeMaterial){
  material.roughnessNode=float(.88).add(grain.mul(.10)).add(talus.mul(.07)).sub(wet.mul(.24)).clamp(.6,.98);
  material.normalNode=null;
 }
 material.userData.coastalRockField={coordinates:'world metres',noisePivot:0,normalBasis:'geometry; no UV tangent map',beddingMetres:[3.8,6.1],aperiodicBedding:true,
  semanticAttribute:'geologicalExposure: actual bearing face, cleavage depth, talus, sheltered cap',
  beddingDirection:[-.145,1,.048],filter:'fwidth fine cleavage fades at .08..32 field units per pixel',
  channels:'physical slab ends, inclined mineral fibres, localized runoff, tidal wetness, talus roughness and cap soil'};
 return material;
}

export function makeBlackwaterGraphicMaterial(source,bands){
 const role=materialRole(source),mat=['glass','asphalt'].includes(role)?new MeshStandardNodeMaterial({roughness:role==='glass'?.34:.87,metalness:0}):new BlackwaterPaintedMaterial({gradientMap:bands});
 mat.name=`look-cartoon-${role}`;mat.userData.lookRole=role;mat.color.copy(source.color);
 if(PALETTE[role])mat.color.set(PALETTE[role]);
 if(role==='house')mat.color.set(['#779aa7','#ab9a7c','#748f7d'][Number(source.name.slice(-1))||0]);
 mat.side=source.side;mat.transparent=source.transparent;mat.opacity=source.opacity;
 mat.map=role==='sign'?source.map:null;mat.emissive.copy(source.emissive);mat.emissiveIntensity=source.emissiveIntensity;
 if(role==='glass'){
  const view=cameraPosition.sub(positionWorld).normalize(),reflected=view.negate().reflect(normalWorld);
  const fresnel=float(1).sub(normalWorld.dot(view).abs()).pow(5);
  const sky=mix(color('#657e8b'),color('#b5c5ca'),float(1).sub(reflected.y.abs().smoothstep(.04,.75)));
  const film=mx_noise_float(positionWorld.mul(vec3(4.2,.18,4.2)),.5,0).smoothstep(.05,.32);
  mat.colorNode=color('#263d44').mul(float(1).sub(film.mul(.17)));
  mat.emissiveNode=sky.mul(float(.08).add(fresnel.mul(.32))).mul(float(1).sub(film.mul(.27)));
  mat.roughnessNode=float(.28).add(film.mul(.18));
  mat.userData.reflectionScope='analytic coastal sky Fresnel; retained matte dirt film; no scene reflection';
 }
 const surface=graphicSurface(role,mat.color,!!source.userData.blackwaterRoofPlane);
 if(surface){
  mat.colorNode=surface.color;mat.blackwaterSurfaceNodes=surface;mat.userData.graphicSurface=surface.metadata;
  if(role==='asphalt'){mat.roughnessNode=surface.roughness;mat.emissiveNode=surface.reflection;mat.userData.reflectionScope='bounded analytic coastal sky tint on actual damp road shoulders; no scene reflection';}
  if(surface.setDebug){
   const setDebug=surface.setDebug;let diagnostic=false;
   surface.setDebug=(name='final')=>{
    setDebug(name);const next=name!=='final';
    // Diagnostic selectors compile only when explicitly requested. Production
    // paving never shares a grayscale mask branch with its albedo graph.
    if(next!==diagnostic){mat.colorNode=next?surface.diagnosticColor:surface.color;mat.needsUpdate=true;diagnostic=next;}
   };
  }
 }
 return mat;
}
export function createBlackwaterGraphicSky(radius=1900){
 const material=new MeshBasicNodeMaterial({side:THREE.BackSide,depthWrite:false,fog:false});
 const direction=positionWorld.sub(cameraPosition).normalize(),altitude=direction.y.max(0).mul(2.1).clamp(0,1).pow(.65);
 const [hx,hz]=COASTAL_DAYLIGHT.horizontal;
 const aligned=vec3(direction.x.mul(-hz).add(direction.z.mul(hx)),direction.y,direction.x.mul(hx).add(direction.z.mul(hz))).toVar();
 const shear=mx_noise_float(aligned.mul(vec3(8,17,8)),.025,0);
 const edge=mx_noise_float(aligned.mul(vec3(22,38,22)),.014,0);
 const lobe=(z,y,w,h)=>float(1).sub(vec2(aligned.z.sub(z).div(w),direction.y.sub(y).add(shear).add(edge).div(h)).length().smoothstep(.67,1.15));
 const a=lobe(-.65,.26,.23,.035).max(lobe(-.73,.29,.105,.065)).max(lobe(-.54,.29,.12,.055));
 const b=lobe(-.09,.34,.27,.035).max(lobe(-.17,.365,.14,.065)).max(lobe(.02,.36,.13,.055));
 const c=lobe(.48,.19,.26,.028).max(lobe(.41,.22,.13,.055)).max(lobe(.57,.21,.10,.04));
 const banks=mx_noise_float(aligned.mul(vec3(5.2,2.7,5.2)),.55,.5)
  .add(mx_noise_float(aligned.mul(vec3(13,5,13)),.16)).smoothstep(.10,.39);
 const cloud=banks.mul(.54).max(a.max(b).max(c).mul(.68)).mul(direction.y.smoothstep(.015,.18))
  .mul(float(1).sub(direction.y.smoothstep(.5,.9))).mul(.62);
 const preset=BLACKWATER_LOOKS.cartoon;
 const cloudLight=mix(color('#7d929e'),color('#d5dde0'),direction.y.smoothstep(.10,.35));
 const opening=direction.dot(vec3(...COASTAL_DAYLIGHT.direction)).smoothstep(.60,.96).mul(COASTAL_DAYLIGHT.skyOpening);
 material.colorNode=mix(mix(mix(color(preset.horizon),color(preset.sky),altitude),cloudLight,opening),cloudLight,cloud.mul(float(1).sub(opening.mul(1.5))));
 material.userData.coastalSky={identity:'wind-sheared maritime cloud banks',extraTextures:0,extraPasses:0};
 const geometry=new THREE.SphereGeometry(radius,24,12),root=new THREE.Mesh(geometry,material);root.name='BlackwaterGraphicSky';root.frustumCulled=false;root.renderOrder=-1000;
 root.layers.set(1);root.userData.noBatch=true;let disposed=false;
 return{root,dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();material.dispose();}};
}
function reliefMap(source,role){
 if(!source.map?.image?.getContext)return null;
 const canvas=source.map.image,context=canvas.getContext('2d');
 const {width,height}=canvas,pixels=context.getImageData(0,0,width,height).data,bytes=new Uint8Array(width*height*4);
 for(let i=0;i<width*height;i++){
  const value=Math.round((pixels[i*4]+pixels[i*4+1]+pixels[i*4+2])/3);
  // The existing brick/wood courses cause both relief and roughness variation.
  let h=value;
  if(role==='brick'){
   const x=i%width,y=Math.floor(i/width),row=Math.floor(y/10.67),bx=((x-(row%2?16:0))%32+32)%32,by=y-row*10.67;
   const edge=Math.min(bx-1.1,30.9-bx,by-.8,9.77-by);
   h=25+Math.max(0,Math.min(1,edge/1.1))*180+value*.08;
  }
  bytes.set([h,Math.min(255,170+value*.28),h,255],i*4);
 }
 const map=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}
function skyEnvironment(){
 const w=256,h=128,data=new Float32Array(w*h*4),sky=new THREE.Color('#a8b7c0'),ground=new THREE.Color('#59605b'),horizon=new THREE.Color('#c6c9c5');
 const sun=new THREE.Vector3(-35,70,-18).normalize();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const theta=(y+.5)/h*Math.PI,phi=(x+.5)/w*Math.PI*2,dir=new THREE.Vector3(-Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
  const tint=dir.y<0?ground.clone().lerp(horizon,Math.pow(1+dir.y,6)*.3):horizon.clone().lerp(sky,Math.pow(dir.y,.4));
  const lobe=Math.pow(Math.max(0,dir.dot(sun)),12)*.4;
  const i=(y*w+x)*4;data.set([tint.r*.85+lobe,tint.g*.85+lobe*.85,tint.b*.85+lobe*.62,1],i);
 }
 const map=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);map.mapping=THREE.EquirectangularReflectionMapping;map.colorSpace=THREE.LinearSRGBColorSpace;map.needsUpdate=true;return map;
}

export function createBlackwaterLookStudy({renderer,scene,subject,camera,sun,fill}){
 const records=[],materials=new Set(),generatedTextures=new Set(),variants=new Map(),outlines=[];
 const original={environment:scene.environment,environmentIntensity:scene.environmentIntensity,background:scene.background.clone(),fog:scene.fog.clone(),sunColor:sun.color.clone(),sunIntensity:sun.intensity,fillColor:fill.color.clone(),groundColor:fill.groundColor.clone(),fillIntensity:fill.intensity,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure};
 scene.traverse(object=>{if(object.isMesh){records.push({object,material:object.material});for(const m of Array.isArray(object.material)?object.material:[object.material])if(m?.isMeshStandardMaterial&&!m.userData.nativeTerrainPBR)materials.add(m);}});
 const environment=skyEnvironment();generatedTextures.add(environment);
 const top=uniform(new THREE.Color()),bottom=uniform(new THREE.Color()),inkWidth=uniform(2.2),graphicSky=uniform(0);
 const skyMaterial=new MeshBasicNodeMaterial({side:THREE.BackSide,depthWrite:false,fog:false});
 const skyDirection=positionWorld.sub(cameraPosition).normalize();
 const altitude=skyDirection.y.max(0).pow(.65);
 const cloudNoise=mx_noise_float(skyDirection.mul(vec3(6,2,6)),.6,.5).add(mx_noise_float(skyDirection.mul(17),.12));
 // Designed horizontal lobe banks rather than thresholded noise silhouettes.
 const lobe=(z,y,w,h)=>float(1).sub(vec2(skyDirection.z.sub(z).div(w),skyDirection.y.sub(y).div(h)).length().smoothstep(.88,1));
 const bank1=lobe(-.65,.26,.23,.035).max(lobe(-.73,.29,.105,.065)).max(lobe(-.54,.29,.12,.055));
 const bank2=lobe(-.09,.34,.27,.035).max(lobe(-.17,.365,.14,.065)).max(lobe(.02,.36,.13,.055));
 const bank3=lobe(.48,.19,.26,.028).max(lobe(.41,.22,.13,.055)).max(lobe(.57,.21,.10,.04));
 const authored=bank1.max(bank2).max(bank3).mul(skyDirection.x.negate().smoothstep(.15,.6));
 const photographic=cloudNoise.smoothstep(.48,.82).mul(.42);
 const cloud=mix(photographic,authored.mul(.52),graphicSky);
 skyMaterial.colorNode=mix(mix(bottom,top,altitude),color('#d7e1e3'),cloud.mul(skyDirection.y.smoothstep(0,.1)));
 const skyGeometry=new THREE.SphereGeometry(440,24,12),sky=new THREE.Mesh(skyGeometry,skyMaterial);sky.name='BlackwaterLookSky';sky.layers.set(1);sky.frustumCulled=false;sky.renderOrder=-1000;sky.visible=false;scene.add(sky);
 const ink=new MeshBasicNodeMaterial({color:'#16222c',side:THREE.BackSide,depthWrite:false});
 const worldPixel=positionView.z.abs().mul(2).div(screenSize.y).div(cameraProjectionMatrix.element(1).element(1));
 ink.positionNode=positionLocal.add(normalLocal.mul(inkWidth.mul(worldPixel)));
 const candidates=[];subject.root.traverse(object=>{if(object.isMesh&&!(Array.isArray(object.material)?object.material:[object.material]).some(m=>m?.userData.nativeTerrainPBR))candidates.push(object);});
 for(const mesh of candidates){
  const outline=mesh.clone(false);outline.material=ink;outline.name='BlackwaterLookInk';outline.castShadow=false;outline.receiveShadow=false;outline.visible=false;outline.userData.lookOutline=true;
  outline.layers.set(1);mesh.parent.add(outline);outlines.push(outline);
 }
 const bands=new Map();for(const id of ['cartoon','illustrated']){const map=makeBands(BLACKWATER_LOOKS[id].bands);bands.set(id,map);generatedTextures.add(map);}
 const relief=new Map();for(const source of materials){if(source.normalMap)continue;const map=reliefMap(source,materialRole(source));if(map){relief.set(source,map);generatedTextures.add(map);}}
 let current='baseline',diagnostic='final',disposed=false;
 function buildMaterial(source,id){
  if(id==='cartoon')return makeBlackwaterGraphicMaterial(source,bands.get(id));
  const role=materialRole(source),preset=BLACKWATER_LOOKS[id],isFlat=id==='cartoon';
  let tint=source.color.clone();
  if(isFlat&&PALETTE[role])tint.set(PALETTE[role]);
  if(isFlat&&role==='house')tint.set(['#679cad','#d7b47a','#6c9b87'][Number(source.name.slice(-1))||0]);
  const mat=id==='realism'?new MeshStandardNodeMaterial({roughness:source.roughness,metalness:source.metalness}):new MeshToonNodeMaterial({gradientMap:bands.get(id)});
  mat.name=`look-${id}-${role}`;mat.color.copy(tint);mat.side=source.side;mat.transparent=source.transparent;mat.opacity=source.opacity;
  mat.map=isFlat&&role!=='sign'?null:source.map;
  mat.emissive.copy(source.emissive);mat.emissiveIntensity=source.emissiveIntensity;
  if(!isFlat){mat.aoMap=source.aoMap;mat.aoMapIntensity=source.aoMapIntensity;}
  if(id==='illustrated'&&role!=='sign'){
   if(role==='brick')mat.color.set('#bbad99');
   if(role==='glass')mat.color.set('#4f8f92');
   const coordinate=positionWorld.x.add(positionWorld.y.mul(1.4)).add(positionWorld.z.mul(.33)).mul(19);
   const hatch=coordinate.sin().smoothstep(.2,.65).mul(float(1).div(float(1).add(coordinate.fwidth().mul(2))));
   mat.colorNode=color(mat.color).mul(source.map?texture(source.map).rgb:1).mul(float(1).sub(hatch.mul(.16)));
  }
  if(id==='realism'){
   mat.normalMap=source.normalMap;mat.normalScale.copy(source.normalScale);mat.roughnessMap=source.roughnessMap;
   if(role==='glass'){mat.roughness=.20;mat.metalness=.25;mat.envMapIntensity=.9;}
   if(role==='metal'){mat.roughness=.43;mat.metalness=.6;}
   if(role==='rust'){mat.roughness=.79;mat.metalness=.25;}
   if(relief.has(source)&&['brick','wood','masonry','render','pale','roof','house'].includes(role)){
    mat.bumpMap=relief.get(source);mat.bumpScale=role==='brick'?.075:.022;mat.roughnessMap=relief.get(source);mat.roughness=Math.min(.99,source.roughness+.08);
   }
   if(role==='asphalt'||role==='paving'){
    const p=vec2(positionWorld.x,positionWorld.z.negate()).div(source.userData.textureMeters||2);
    const edge=positionWorld.z.sub(49.8).abs().min(positionWorld.z.sub(62.2).abs());
    const gutter=float(1).sub(edge.smoothstep(.12,1.9));
    const wet=gutter.mul(mx_noise_float(positionWorld.xz.mul(.42),.7,.5).smoothstep(.3,.65));
    const albedo=source.map?texture(source.map,p).rgb:color('#484d4b');
    mat.colorNode=color(source.color).mul(albedo).mul(float(1).sub(wet.mul(.22)));
    mat.roughnessNode=mix(source.roughnessMap?texture(source.roughnessMap,p).g.mul(source.roughness):float(.94),float(.18),wet);
    if(source.normalMap)mat.normalNode=normalMap(texture(source.normalMap,p),vec2(source.normalScale.x,source.normalScale.y));
    if(source.aoMap)mat.aoNode=texture(source.aoMap,p).r;
    mat.userData.lookField='wetness clusters at Main Street gutters and drives colour/roughness; scanned aggregate uses metre-scaled world UV';
   }
  }
  return mat;
 }
 for(const id of ['cartoon','illustrated','realism'])variants.set(id,new Map([...materials].map(source=>[source,buildMaterial(source,id)])));
 const debugMaterials=new Map();
 function diagnosticMaterial(source){
  const key=`${current}/${diagnostic}/${source.uuid}`;if(debugMaterials.has(key))return debugMaterials.get(key);
  const target=variants.get(current)?.get(source)||source;
  const mat=diagnostic==='normals'?new MeshStandardNodeMaterial({color:0x000000}):new MeshBasicNodeMaterial();mat.side=source.side;mat.toneMapped=false;mat.fog=false;
  if(diagnostic==='normals'){
   mat.normalNode=target.normalNode;mat.normalMap=target.normalMap;mat.normalScale.copy(target.normalScale);mat.bumpMap=target.bumpMap;mat.bumpScale=target.bumpScale;
   mat.emissiveNode=normalWorld.mul(.5).add(.5);
  }else if(diagnostic==='roughness'){
   const rough=target.roughnessNode||float(target.roughness??1).mul(target.roughnessMap?texture(target.roughnessMap).g:1);
   mat.colorNode=vec3(rough);
  }else if(diagnostic==='structure'||diagnostic==='wear'){
   mat.colorNode=vec3(target.blackwaterSurfaceNodes?.[diagnostic]||float(0));
  }else{
   mat.colorNode=target.colorNode||color(target.color).mul(target.map?texture(target.map).rgb:1);
  }
  debugMaterials.set(key,mat);return mat;
 }
 function apply(){
  const preset=BLACKWATER_LOOKS[current];
  for(const {object,material}of records){const swap=m=>diagnostic==='final'?(variants.get(current)?.get(m)||m):diagnosticMaterial(m);object.material=Array.isArray(material)?material.map(swap):swap(material);}
  scene.background.set(preset.sky);scene.fog.color.set(preset.horizon);scene.fog.near=current==='baseline'?100:85;scene.fog.far=current==='baseline'?270:240;
  scene.environment=current==='realism'?environment:null;scene.environmentIntensity=.65;
  sun.color.set(preset.sunColor);sun.intensity=preset.sun;fill.color.set(preset.fillSky||preset.sky);fill.groundColor.set(preset.ground);fill.intensity=preset.fill;
  renderer.toneMapping=current==='cartoon'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=preset.exposure;
  top.value.set(preset.sky);bottom.value.set(preset.horizon);graphicSky.value=current==='cartoon'?1:0;sky.visible=current!=='baseline'&&diagnostic==='final';
  inkWidth.value=preset.ink;for(const outline of outlines)outline.visible=preset.ink>0&&diagnostic==='final';
  sun.shadow.needsUpdate=true;
 }
 return{
  select(id){if(!BLACKWATER_LOOKS[id])throw new Error(`Unknown rendering look: ${id}`);current=id;diagnostic='final';apply();},
  debug(mode){if(!['final','albedo','roughness','normals','structure','wear'].includes(mode))throw new Error('Unknown look diagnostic');diagnostic=mode;apply();},
  update(){sky.position.copy(camera.position);},
  diagnostics:()=>({look:current,diagnostic,preset:BLACKWATER_LOOKS[current],materialVariants:variants.get(current)?.size||0,outlineMeshes:outlines.filter(o=>o.visible).length,generatedTextures:generatedTextures.size,environment:current==='realism'?'procedural HDR sky':null,geometryUnchanged:true,postProcessing:'indirect GTAO and graphic screen edges owned by render pipeline',renderer:'native WebGPU'}),
  dispose(){
   if(disposed)return;disposed=true;
   for(const r of records)r.object.material=r.material;
   for(const o of outlines)o.removeFromParent();
   for(const map of variants.values())for(const mat of map.values())mat.dispose();
   for(const mat of debugMaterials.values())mat.dispose();
   for(const map of generatedTextures)map.dispose();
   sky.removeFromParent();skyGeometry.dispose();skyMaterial.dispose();ink.dispose();
   scene.environment=original.environment;scene.environmentIntensity=original.environmentIntensity;
   scene.background.copy(original.background);scene.fog.color.copy(original.fog.color);scene.fog.near=original.fog.near;scene.fog.far=original.fog.far;
   sun.color.copy(original.sunColor);sun.intensity=original.sunIntensity;sun.shadow.needsUpdate=true;
   fill.color.copy(original.fillColor);fill.groundColor.copy(original.groundColor);fill.intensity=original.fillIntensity;
   renderer.toneMapping=original.toneMapping;renderer.toneMappingExposure=original.exposure;
  },
 };
}
