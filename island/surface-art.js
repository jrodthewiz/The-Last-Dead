import * as T from '../vendor/three.module.js';
import {DETAIL_PARS,attachDetailUniforms,artDetailDebug,toonLambertChunk} from './detail-materials.js';

// Printed three-band Lambert key light, one-tap dominant-axis surface detail,
// semantic architectural crevice AO, wet coastal asphalt sheen and stepped specular.
// All modular surfaces stay in the existing instanced Lambert draws; no material split.
const noise=`
float artHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float artNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(artHash(i),artHash(i+vec2(1,0)),f.x),mix(artHash(i+vec2(0,1)),artHash(i+vec2(1,1)),f.x),f.y);}
float artField(vec2 p){return artNoise(p)*.62+artNoise(p*2.03+9.1)*.26+artNoise(p*4.11-5.7)*.12;}
`;
const rgb=hex=>'vec3('+new T.Color(hex).toArray().map(v=>v.toFixed(5)).join(',')+')';

export function paintTerrain(shader,segments,roadPaint,roadBounds){
 shader.vertexShader='attribute float artSlope;varying float vSlope;varying vec3 vGround;varying vec3 vGroundWorld;varying vec3 vGroundNormal;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;vSlope=artSlope;vGroundWorld=(modelMatrix*vec4(position,1.)).xyz;vGroundNormal=normalize(mat3(modelMatrix)*normal);');
 shader.uniforms.artRoadSegments={value:segments};
 shader.uniforms.artRoadPaint={value:roadPaint};
 shader.uniforms.artRoadCount={value:segments.length};
 attachDetailUniforms(shader);
 shader.fragmentShader=`varying float vSlope;varying vec3 vGround;varying vec3 vGroundWorld;varying vec3 vGroundNormal;
 uniform vec4 artRoadSegments[${segments.length}];
 uniform vec4 artRoadPaint[${segments.length}];
 uniform int artRoadCount;\n`+DETAIL_PARS+noise+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>',toonLambertChunk);
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 artWorldNormal=normalize(vGroundNormal);
 float artRoad=0.;
 vec2 land=vGround.xz;float field=artField(land*.022),tuft=artNoise(land*.37),heather=artField(land*.065+3.7);
 vec3 soil=mix(${rgb(0x4a6641)},${rgb(0x788a4e)},smoothstep(.20,.78,field));
 soil=mix(soil,${rgb(0x8e8954)},smoothstep(.60,.86,heather)*.45);
 soil*=.92+tuft*.14;
 soil*=.94+artNoise(land*.63)*.10;
 float exposed=smoothstep(.025,.11,vSlope+(field-.5)*.035);
 float strata=sin(vGround.y*.65+artNoise(land*.045)*2.8);
 vec3 rock=mix(${rgb(0x5a676a)},${rgb(0x949a90)},artField(land*.1))*(.90+strata*.14);
 soil=mix(soil,rock,exposed);
 float shore=1.-smoothstep(2.6,7.0,vGround.y+field*1.1);
 vec3 sand=mix(${rgb(0x7d846c)},${rgb(0xbcb28c)},smoothstep(.2,3.6,vGround.y))*(.93+tuft*.12);
 soil=mix(soil,sand,shore*(1.-exposed*.5));
 diffuseColor.rgb=mix(diffuseColor.rgb,soil,.86);
 if(vGround.x<110.&&${roadBounds}){float rd=9999.;float rw=0.;vec3 rc=vec3(0.);
 for(int i=0;i<artRoadCount;i++){
   vec4 segment=artRoadSegments[i];vec2 a=segment.xy,ab=segment.zw-a;
   float t=clamp(dot(land-a,ab)/dot(ab,ab),0.,1.);
   float d=length(land-a-ab*t);
   if(d<rd){rd=d;vec4 paint=artRoadPaint[i];rw=paint.w;rc=paint.rgb;}
 }
 float edge=artNoise(land*1.7)*.16;float shoulder=1.-smoothstep(rw+.55,rw+.85,rd+edge);
 float paving=1.-smoothstep(rw-.07,rw+.07,rd+edge*.35);artRoad=paving;
 diffuseColor.rgb=mix(diffuseColor.rgb,${rgb(0x555e44)},shoulder);
 float asphalt=artNoise(land*.16);
 float roadPatch=smoothstep(.70,.86,asphalt);
 float wheel=1.-smoothstep(.035,.11,abs(abs(rd/max(rw,.001))-.58));
 float useMark=rw<3.?(.89+.13*artNoise(land*.35)):(.88+.13*artNoise(land*.8)-roadPatch*.09-wheel*.065);
 diffuseColor.rgb=mix(diffuseColor.rgb,rc*useMark,paving);}
 float artDist=length(cameraPosition-vGroundWorld);
 float artFade=1.-smoothstep(28.,44.,artDist);
 float artLayer=artRoad>.5?2.:5.;
 vec4 artDetail=artDetailTap(vGroundWorld,artWorldNormal,artLayer,artFade);
 float artDetailStrength=artFade*mix(.42,.95,max(exposed,artRoad));
 artWorldNormal=artApplyDetail(artWorldNormal,artDetail,artDetailStrength);
 float artRough=clamp(.90+(artDetail.b-.5)*.16,.48,.99);
 float wet=artRoad*smoothstep(.56,.80,artField(vGroundWorld.xz*.055));
 float wetSand=(1.-smoothstep(1.1,2.9,vGround.y))*(1.-artRoad);
 float artPuddle=clamp(wet+wetSand*.75,0.,1.);
 diffuseColor.rgb*=1.-wet*.26-wetSand*.18;
 artWorldNormal=mix(artWorldNormal,normalize(vGroundNormal),wet*.82);
 artRough=mix(artRough,.18,artPuddle*.85);
 diffuseColor.rgb*=.92+artDetail.a*.12;
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  normal=normalize((viewMatrix*vec4(artWorldNormal,0.)).xyz);`);
 shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
  vec3 artV=normalize(vViewPosition);
  vec3 smoothViewN=normalize((viewMatrix*vec4(normalize(vGroundNormal),0.)).xyz);
  float artFres=pow(1.-saturate(dot(smoothViewN,artV)),4.5);
  float artFresFade=1.-smoothstep(28.,85.,artDist);
  outgoingLight+=vec3(.34,.46,.52)*artFres*artPuddle*.15*artFresFade;
  #if NUM_DIR_LIGHTS > 0
  vec3 artL=normalize(directionalLights[0].direction);
  vec3 artH=normalize(artV+artL);
  float artSpec=pow(saturate(dot(normal,artH)),mix(8.,52.,1.-artRough));
  float artBands=step(.30,artSpec)*.45+step(.66,artSpec)*.55;
  outgoingLight+=directionalLights[0].color*vec3(.22,.23,.22)*artBands*(.12*artRoad+.42*artPuddle)*(1.-artRough*.55);
  #endif
  float artHaze=smoothstep(95.,460.,artDist)*(1.-smoothstep(14.,75.,vGroundWorld.y)*.35);
  outgoingLight=mix(outgoingLight,vec3(.32,.43,.48),artHaze*.18);
  if(uArtDebug>.5&&uArtDebug<1.5)outgoingLight=artWorldNormal*.5+.5;
  else if(uArtDebug>1.5&&uArtDebug<2.5)outgoingLight=vec3(pow(clamp(artRough,0.,1.),2.2));`);
}

export function paintArchitecture(material){
 const wind={value:0};material.userData.wind=wind;material.userData.artDebug=artDetailDebug;
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey?material.customProgramCacheKey.bind(material):()=>'';
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  attachDetailUniforms(shader);
  shader.uniforms.uArtWind=wind;
  shader.vertexShader='uniform float uArtWind;\nattribute float artRole;\nattribute float artAO;\nattribute vec4 artMeta;\nvarying float vArtRole;\nvarying float vArtAO;\nvarying vec4 vArtMeta;\nvarying float vArtInstHash;\nvarying vec3 vArtWorld;\nvarying vec3 vArtNormal;\nvarying vec2 vArtUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vArtRole=artRole;vArtAO=artAO;vArtMeta=artMeta;vArtUv=uv;
   vec4 artPoint=vec4(position,1.);
   vec3 artNorm=normal;
   float artHashSeed=0.;
   #ifdef USE_INSTANCING
   artPoint=instanceMatrix*artPoint;
   artNorm=mat3(instanceMatrix)*artNorm;
   artHashSeed=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453);
   #endif
   vArtInstHash=artHashSeed;
   vArtWorld=(modelMatrix*artPoint).xyz;
   vArtNormal=normalize(mat3(modelMatrix)*artNorm);
   if(artRole>3.5&&artRole<4.5){float wind=sin(uArtWind*1.25+vArtWorld.x*.08+vArtWorld.z*.06);transformed.x+=wind*.028*max(0.,position.y+.6);transformed.z+=sin(uArtWind*.9+vArtWorld.x*.09)*.016*max(0.,position.y+.6);}`);
  shader.fragmentShader='varying float vArtRole;\nvarying float vArtAO;\nvarying vec4 vArtMeta;\nvarying float vArtInstHash;\nvarying vec3 vArtWorld;\nvarying vec3 vArtNormal;\nvarying vec2 vArtUv;\n'+DETAIL_PARS+noise+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>',toonLambertChunk);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 artWorldNormal=vec3(0.,1.,0.);float artRough=.80,artMetal=.02,artSemAO=1.,artCityWet=0.,artDist=0.;
  if(vArtRole>-.5){
   vec3 rawCross=cross(dFdx(vArtWorld),dFdy(vArtWorld));
   vec3 nWorld=dot(rawCross,rawCross)>1e-10?normalize(rawCross):normalize(vArtNormal);
   if(dot(nWorld,cameraPosition-vArtWorld)<0.)nWorld=-nWorld;
   artWorldNormal=nWorld;
   vec3 n=abs(nWorld);
   vec2 uv=n.y>.7?vArtWorld.xz:(n.x>n.z?vArtWorld.zy:vArtWorld.xy);
   float yMeters=vArtUv.y*max(vArtMeta.w,.25);
   float fromTop=max(0.,vArtMeta.w-yMeters);
   float topCrevice=n.y<.65?mix(vArtMeta.x,1.,smoothstep(0.,.95,fromTop)):1.;
   float botCrevice=n.y<.65?mix(vArtMeta.y,1.,smoothstep(0.,1.05,yMeters)):1.;
   artSemAO=topCrevice*botCrevice;
   float baseGrime=1.-smoothstep(.04,.26,vArtUv.y);
   float patina=artField(uv*.22);
   if(vArtRole<.5){
    diffuseColor.rgb*=.92+artNoise(vArtWorld.xz*1.1)*.13;
    artRough=.60;artMetal=.35;
   }else if(vArtRole<1.5){
    float runoff=artNoise(vec2(uv.x*.65,uv.y*.085));
    float floorBand=vArtMeta.w>3.2&&n.y<.65?(1.-.14*(1.-smoothstep(0.,.26,fract(yMeters/3.4)))):1.;
    float cornerAO=n.y<.65?mix(.84,1.,smoothstep(0.,.045,min(vArtUv.x,1.-vArtUv.x))):1.;
    diffuseColor.rgb*=.88+patina*.16;
    diffuseColor.rgb*=1.-baseGrime*.10;
    diffuseColor.rgb*=floorBand*cornerAO;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.66,.74,.68),smoothstep(.68,.86,runoff)*.28);
    artRough=.80;artMetal=.02;
   }else if(vArtRole<2.5){
    vec2 tile=vArtWorld.xz*vec2(1.8,2.5);tile.x+=mod(floor(tile.y),2.)*.5;
    vec2 cell=fract(tile),aa=max(fwidth(tile),vec2(.02));
    float seam=(1.-smoothstep(.025,.025+aa.x,cell.x))+(1.-smoothstep(.06,.06+aa.y,cell.y));
    diffuseColor.rgb*=.92+.14*artHash(floor(tile))-.12*min(1.,seam);
    artRough=.48;artMetal=.48;
   }else if(vArtRole<3.5){
    diffuseColor.rgb*=.84+.24*artNoise(uv*vec2(3.,.18));
    artRough=.88;artMetal=0.;
   }else if(vArtRole<4.5){
    vec3 hueShift=mix(vec3(.91,.97,.88),vec3(1.09,1.03,.89),vArtInstHash);
    diffuseColor.rgb*=hueShift*(.92+.16*artNoise(vArtWorld.xz*.55));
    artRough=.78;artMetal=0.;
   }else if(vArtRole<5.5){
    vec2 wBez=min(vArtUv,1.-vArtUv);
    float jamb=smoothstep(0.,.065,wBez.x)*smoothstep(0.,.055,wBez.y);
    float lintel=mix(.46,1.,smoothstep(0.,.24,1.-vArtUv.y));
    float skyGlint=smoothstep(.35,.86,vArtUv.y+(vArtUv.x-.5)*.35);
    diffuseColor.rgb*=mix(.42,1.,jamb)*lintel*(.88+skyGlint*.20);
    diffuseColor.rgb+=vec3(.026,.046,.056)*skyGlint*jamb;
    artRough=mix(.58,.14,jamb);artMetal=.08;
   }else if(vArtRole<6.5){
    vec2 wBez=min(vArtUv,1.-vArtUv);
    float jamb=smoothstep(0.,.065,wBez.x)*smoothstep(0.,.055,wBez.y);
    float lintel=mix(.52,1.,smoothstep(0.,.22,1.-vArtUv.y));
    diffuseColor.rgb*=mix(.50,1.04,jamb)*lintel;
    diffuseColor.rgb+=vec3(.024,.016,.006)*jamb;
    artRough=mix(.56,.14,jamb);artMetal=.06;
   }else if(vArtRole<7.5){
    vec2 brick=uv*vec2(.8,2.);brick.x+=mod(floor(brick.y),2.)*.5;
    vec2 f=fract(brick),aa=max(fwidth(brick),vec2(.015));
    float joint=max(1.-smoothstep(.025,.025+aa.x,f.x),1.-smoothstep(.05,.05+aa.y,f.y));
    diffuseColor.rgb*=.86+artHash(floor(brick))*.2-joint*.18;
    artRough=.86;artMetal=0.;
   }else if(vArtRole<8.5){
    vec2 slab=vArtWorld.xz*.6;slab.x+=mod(floor(slab.y),2.)*.5;
    vec2 f=fract(slab),aa=max(fwidth(slab),vec2(.012));
    float joint=max(1.-smoothstep(.016,.016+aa.x,f.x),1.-smoothstep(.02,.02+aa.y,f.y));
    diffuseColor.rgb*=.92+.1*artHash(floor(slab))-.14*joint;
    artRough=.78;artMetal=0.;
   }else if(vArtRole>10.5){
    if(n.y>.7){
     vec2 plank=vArtRole<11.5?vArtWorld.xz:vArtWorld.zx;
     plank*=vec2(2.15,.25);
     plank.y+=mod(floor(plank.x),3.)*.33;
     vec2 cell=fract(plank),aa=max(fwidth(plank),vec2(.014));
     vec2 edge=min(cell,1.-cell);
     float joint=max(1.-smoothstep(.021,.021+aa.x,edge.x),1.-smoothstep(.016,.016+aa.y,edge.y));
     float boards=artHash(floor(plank));
     float wear=artNoise(uv*vec2(1.1,.33));
     diffuseColor.rgb*=.92+boards*.22+wear*.10-joint*.32;
    }
    artRough=.60;artMetal=.04;
   }else if(vArtRole>9.5){
    vec3 treadWear=vec3(1.22,1.16,1.06)*(.94+patina*.11);
    diffuseColor.rgb*=n.y>.7?treadWear:vec3(.80,.83,.84);
    artRough=.74;artMetal=.02;
   }else{
    float aggregate=artNoise(vArtWorld.xz*2.7),repair=artNoise(vArtWorld.xz*.09);
    float lotWear=artNoise(vArtWorld.xz*.06);
    artCityWet=smoothstep(.56,.80,artField(vArtWorld.xz*.055));
    diffuseColor.rgb*=.85+lotWear*.18;
    diffuseColor.rgb*=.93+aggregate*.09-smoothstep(.68,.82,repair)*.09;
    diffuseColor.rgb*=1.-artCityWet*.26;
    artRough=mix(.88,.16,artCityWet*.88);artMetal=0.;
   }
   float artLayer=vArtRole<.5?7.:vArtRole<1.5?0.:vArtRole<2.5?4.:vArtRole<3.5?3.:vArtRole<4.5?7.:vArtRole<5.5?6.:vArtRole<6.5?6.:vArtRole<7.5?1.:vArtRole<8.5?6.:vArtRole<9.5?2.:vArtRole<10.5?5.:3.;
   artDist=length(cameraPosition-vArtWorld);
   float artFade=1.-smoothstep(28.,44.,artDist);
   bool hasNormalDetail=vArtRole<3.5||(vArtRole>6.5);
   vec4 artDetail=hasNormalDetail?artDetailTap(vArtWorld,nWorld,artLayer,artFade):vec4(.5,.5,artRough,.85);
   if(hasNormalDetail)artWorldNormal=artApplyDetail(nWorld,artDetail,artFade*.90*(1.-artCityWet*.78));
   artRough=clamp(artRough+(artDetail.b-.5)*.16,.08,.99);
   artMetal=clamp(artMetal*(.42+.58*artDetail.a),0.,1.);
   if(hasNormalDetail)diffuseColor.rgb*=.91+artDetail.a*.12;
   if(vArtRole<3.5||vArtRole>6.5){
    diffuseColor.rgb*=mix(1.,artSemAO,.38);
    float grime=artNoise(vArtWorld.xz*.55+vArtWorld.y*.18);
    float rain=baseGrime*artNoise(vec2(vArtWorld.x*.9,vArtWorld.y*.085));
    diffuseColor.rgb*=.91+grime*.12-rain*.07;
    artRough=clamp(artRough+(grime-.5)*.10+baseGrime*.08,.08,.99);
    vec3 viewDir=normalize(cameraPosition-vArtWorld);
    float facing=abs(dot(nWorld,viewDir));
    diffuseColor.rgb*=1.-pow(1.-facing,3.)*.03;
    diffuseColor.rgb+=vec3(.012,.011,.008)*pow(1.-facing,4.);
   }
  }`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize((viewMatrix*vec4(artWorldNormal,0.)).xyz);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   float artCombineAO=vArtAO*mix(1.,artSemAO,.68);
   float artRoomLift=vArtMeta.z>.5?1.42:1.;
   reflectedLight.indirectDiffuse*=artRoomLift*mix(1.,artCombineAO,.52);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   if(vArtRole>5.5&&vArtRole<6.5){
    vec2 wGlowBez=min(vArtUv,1.-vArtUv);
    float wPane=smoothstep(0.,.07,wGlowBez.x)*smoothstep(0.,.06,wGlowBez.y);
    float wCore=smoothstep(.15,.72,wPane*(1.-abs(vArtUv.y-.46)*.9));
    totalEmissiveRadiance+=${rgb(0xc89a56)}*(.18+.22*wCore)*wPane;
   }`);
  shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
   vec3 artV=normalize(vViewPosition);
   float artFres=pow(1.-saturate(dot(normal,artV)),3.4);
   if(vArtRole>8.5&&vArtRole<9.5){
    float roadFres=pow(1.-saturate(dot(normal,artV)),4.5);
    float roadFade=1.-smoothstep(28.,85.,artDist);
    outgoingLight+=vec3(.34,.46,.52)*roadFres*artCityWet*.15*roadFade;
   }
   #if NUM_DIR_LIGHTS > 0
   vec3 artL=normalize(directionalLights[0].direction);
   vec3 artH=normalize(artV+artL);
   if(vArtRole<3.5||vArtRole>4.5){
    float spec=pow(saturate(dot(normal,artH)),mix(8.,52.,1.-artRough));
    float bands=step(.32,spec)*.45+step(.68,spec)*.55;
    vec3 tint=mix(vec3(.18,.20,.21),vec3(.78,.65,.42),artMetal);
    outgoingLight+=directionalLights[0].color*tint*bands*(.08+.18*artFres+artCityWet*.32)*(1.-artRough*.52);
   }
   if(vArtRole<2.5||(vArtRole>6.5&&vArtRole<9.5)){
    outgoingLight+=mix(vec3(.036,.048,.055),vec3(.090,.068,.044),artMetal)*artFres*.75;
   }
   if(vArtRole>3.5&&vArtRole<4.5){
    float wrap=saturate(dot(normal,artL)*.5+.5);
    float back=pow(saturate(dot(-normal,artL)),2.);
    outgoingLight+=directionalLights[0].color*diffuseColor.rgb*(wrap*.16+back*.20);
    outgoingLight+=diffuseColor.rgb*(vec3(.032,.042,.024)+artFres*.24);
   }
   #endif
   if(uArtDebug>.5&&uArtDebug<1.5)outgoingLight=artWorldNormal*.5+.5;
   else if(uArtDebug>1.5&&uArtDebug<2.5)outgoingLight=vec3(pow(clamp(artRough,0.,1.),2.2));`);
 };
 material.customProgramCacheKey=()=>previousKey()+'-toon-surface-v6';
 return material;
}

export const skyNoise=noise;

export function paintBridge(material,finish){
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey?material.customProgramCacheKey.bind(material):()=>'';
 material.customProgramCacheKey=()=>previousKey()+`-blackwater-bridge-${finish}-v2`;
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying vec3 vBridge;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBridge=position;');
  shader.fragmentShader='varying vec3 vBridge;\n'+noise+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>',toonLambertChunk);
  const detail=finish==='asphalt'?`
   vec2 p=vBridge.xz;
   float wear=artField(p*vec2(.2,.68));
   float grain=artNoise(p*3.7)*(1.-smoothstep(.16,.48,length(fwidth(p))));
   float tracked=1.-smoothstep(.35,1.5,abs(abs(p.y)-3.8));
   float repair=smoothstep(.71,.79,artField(p*vec2(.14,.38)));
   float bridgeWet=smoothstep(.56,.80,artField(p*.055));
   diffuseColor.rgb*=(.79+wear*.23+grain*.11+tracked*.17-repair*.18)*(1.-bridgeWet*.24);
  `:`
   vec2 p=vec2(vBridge.x,vBridge.z+vBridge.y*2.);
   float stain=artField(p*vec2(.25,.39));
   float runoff=artNoise(vec2(p.x*.93,p.y*.12));
   float joint=1.-smoothstep(.012,.012+max(.006,fwidth(p.x)*.1),abs(fract(p.x*.1)-.5));
   diffuseColor.rgb*=.78+stain*.26-smoothstep(.59,.82,runoff)*.18-joint*.13;
  `;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
  if(finish==='asphalt'){
   shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
    vec3 bV=normalize(vViewPosition);
    float bFres=pow(1.-saturate(dot(normal,bV)),4.5);
    float bWet=smoothstep(.56,.80,artField(vBridge.xz*.055));
    outgoingLight+=vec3(.34,.46,.52)*bFres*bWet*.14;`);
  }
 };
 material.needsUpdate=true;
}
