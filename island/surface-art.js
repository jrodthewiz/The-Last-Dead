import * as T from '../vendor/three.module.js';
import {DETAIL_PARS,attachDetailUniforms,artDetailDebug,toonLambertChunk} from './detail-materials.js';
import {attachPbrUniforms} from './pbr-textures.js';

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
 vec3 soil=mix(${rgb(0x385039)},${rgb(0x546848)},smoothstep(.20,.78,field));
 soil=mix(soil,${rgb(0x6b704e)},smoothstep(.60,.86,heather)*.45);
 soil*=.92+tuft*.14;
 soil*=.94+artNoise(land*.63)*.10;
 float exposed=smoothstep(.025,.11,vSlope+(field-.5)*.035);
 float strata=sin(vGround.y*.65+artNoise(land*.045)*2.8);
 vec3 rock=mix(${rgb(0x465258)},${rgb(0x7c868a)},artField(land*.1))*(.90+strata*.14);
 soil=mix(soil,rock,exposed);
 float shore=1.-smoothstep(2.6,7.0,vGround.y+field*1.1);
 vec3 sand=mix(${rgb(0x5e6864)},${rgb(0x969888)},smoothstep(.2,3.6,vGround.y))*(.93+tuft*.12);
 soil=mix(soil,sand,shore*(1.-exposed*.5));
 diffuseColor.rgb=mix(diffuseColor.rgb,soil,.86);
 float artAsphalt=0.;
 if(vGround.x<110.&&${roadBounds}){float rd=9999.;float rw=0.;vec3 rc=vec3(0.);
 for(int i=0;i<artRoadCount;i++){
   vec4 segment=artRoadSegments[i];vec2 a=segment.xy,ab=segment.zw-a;
   float t=clamp(dot(land-a,ab)/dot(ab,ab),0.,1.);
   float d=length(land-a-ab*t);
   if(d<rd){rd=d;vec4 paint=artRoadPaint[i];rw=paint.w;rc=paint.rgb;}
 }
 float edge=artNoise(land*1.7)*.16;float shoulder=1.-smoothstep(rw+.55,rw+.85,rd+edge);
 float paving=1.-smoothstep(rw-.07,rw+.07,rd+edge*.35);artRoad=paving;
 if(rw>=3.)artAsphalt=paving;
 diffuseColor.rgb=mix(diffuseColor.rgb,${rgb(0x555c4f)},shoulder);
 float asphalt=artNoise(land*.16);
 float roadPatch=smoothstep(.70,.86,asphalt);
 float wheel=1.-smoothstep(.035,.11,abs(abs(rd/max(rw,.001))-.58));
 float useMark=rw<3.?(.88+.12*artNoise(land*.35)):(.88+.12*artNoise(land*.8)-roadPatch*.08-wheel*.06);
 diffuseColor.rgb=mix(diffuseColor.rgb,rc*useMark,paving);}
 float artDist=length(cameraPosition-vGroundWorld);
 float artFade=1.-smoothstep(42.,70.,artDist);
 float artLayer=artRoad>.5?2.:(exposed>.2?5.:7.);
 vec4 artDetail=artDetailTap(vGroundWorld,artWorldNormal,artLayer,artFade);
 float artDetailStrength=artFade*mix(.42,.95,max(exposed,artRoad));
 artWorldNormal=artApplyDetail(artWorldNormal,artDetail,artDetailStrength);
 float artRough=clamp(.90+(artDetail.b-.5)*.16,.48,.99);
 float wet=artAsphalt*smoothstep(.64,.84,artField(vGroundWorld.xz*.048));
 float wetSand=(1.-smoothstep(1.1,2.9,vGround.y))*(1.-artRoad);
 float artPuddle=clamp(wet+wetSand*.46,0.,1.);
 diffuseColor.rgb*=1.-wet*.20-wetSand*.10;
 artWorldNormal=mix(artWorldNormal,normalize(vGroundNormal),wet*.86);
 artRough=mix(artRough,.30,artPuddle*.68);
 diffuseColor.rgb*=.92+artDetail.a*.12;
 `);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  normal=normalize((viewMatrix*vec4(artWorldNormal,0.)).xyz);`);
 shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
  vec3 artV=normalize(vViewPosition);
  vec3 smoothViewN=normalize((viewMatrix*vec4(normalize(vGroundNormal),0.)).xyz);
  float artFres=pow(1.-saturate(dot(smoothViewN,artV)),4.5);
  float artFresFade=1.-smoothstep(28.,85.,artDist);
  outgoingLight+=vec3(.38,.48,.54)*artFres*artPuddle*.10*artFresFade;
  #if NUM_DIR_LIGHTS > 0
  vec3 artL=normalize(directionalLights[0].direction);
  vec3 artH=normalize(artV+artL);
  float artSpec=pow(saturate(dot(normal,artH)),mix(8.,52.,1.-artRough));
  float artBands=step(.30,artSpec)*.45+step(.66,artSpec)*.55;
  outgoingLight+=directionalLights[0].color*vec3(.24,.26,.28)*artBands*(.10*artRoad+.28*artPuddle)*(1.-artRough*.55);
  #endif
  float artHaze=smoothstep(75.,420.,artDist)*(1.-smoothstep(14.,75.,vGroundWorld.y)*.35);
  outgoingLight=mix(outgoingLight,${rgb(0x9cb0b8)},artHaze*.24);
  if(uArtDebug>.5&&uArtDebug<1.5)outgoingLight=artWorldNormal*.5+.5;
  else if(uArtDebug>1.5&&uArtDebug<2.5)outgoingLight=vec3(pow(clamp(artRough,0.,1.),2.2));`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
  if(artAsphalt>.5)gl_FragColor.a=.88-clamp(wet*(1.-smoothstep(80.,200.,artDist)),0.,1.)*.32;`);
}

export function paintArchitecture(material){
 const physical=!!material.isMeshStandardMaterial;
 const wind={value:0};material.userData.wind=wind;material.userData.artDebug=artDetailDebug;
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey?material.customProgramCacheKey.bind(material):()=>'';
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  attachDetailUniforms(shader);
  attachPbrUniforms(shader);
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
  shader.fragmentShader='uniform sampler2D uPlasterD,uPlasterN,uPlasterA,uBrickD,uBrickN,uBrickA,uAsphaltD,uAsphaltN,uAsphaltA;\nvarying float vArtRole;\nvarying float vArtAO;\nvarying vec4 vArtMeta;\nvarying float vArtInstHash;\nvarying vec3 vArtWorld;\nvarying vec3 vArtNormal;\nvarying vec2 vArtUv;\n'+DETAIL_PARS+noise+shader.fragmentShader;
  if(!physical)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>',toonLambertChunk);
  if(physical){
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(artRough,.04,1.);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
   metalnessFactor=clamp(artMetal,0.,1.);
   `);
  }
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 artWorldNormal=vec3(0.,1.,0.);float artRough=.80,artMetal=.02,artSemAO=1.,artCityWet=0.,artWetRefl=0.,artDist=0.,artInRoom=0.;
  float artTag=vArtMeta.z;
  if(artTag>1.3&&artTag<1.8)artInRoom=1.;
  else if(artTag>1.8){
   vec3 gn=normalize(vArtNormal);
   if(artTag<2.5)artInRoom=gn.z<-.5?1.:0.;
   else if(artTag<3.5)artInRoom=gn.z>.5?1.:0.;
   else if(artTag<4.5)artInRoom=gn.x<-.5?1.:0.;
   else artInRoom=gn.x>.5?1.:0.;
  }
  vec3 nWorld=vec3(0.,1.,0.);
  if(vArtRole>-.5){
   vec3 rawCross=cross(dFdx(vArtWorld),dFdy(vArtWorld));
   nWorld=dot(rawCross,rawCross)>1e-10?normalize(rawCross):normalize(vArtNormal);
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
    diffuseColor.rgb*=.86+artNoise(vArtWorld.xz*1.1)*.13;
    artRough=.58;artMetal=.35;
   }else if(vArtRole<1.5){
    float runoff=artNoise(vec2(uv.x*.65,uv.y*.085));
    float floorBand=vArtMeta.w>3.2&&n.y<.65?(1.-.18*(1.-smoothstep(0.,.28,fract(yMeters/3.4)))):1.;
    float cornerAO=n.y<.65?mix(.80,1.,smoothstep(0.,.045,min(vArtUv.x,1.-vArtUv.x))):1.;
    diffuseColor.rgb*=.80+patina*.16;
    diffuseColor.rgb*=1.-baseGrime*.12;
    diffuseColor.rgb*=floorBand*cornerAO;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.68,.66),smoothstep(.60,.84,runoff)*.32);
    artRough=.78;artMetal=.02;
   }else if(vArtRole<2.5){
    vec2 tile=vArtWorld.xz*vec2(1.8,2.5);tile.x+=mod(floor(tile.y),2.)*.5;
    vec2 cell=fract(tile),aa=max(fwidth(tile),vec2(.02));
    float seam=(1.-smoothstep(.025,.025+aa.x,cell.x))+(1.-smoothstep(.06,.06+aa.y,cell.y));
    diffuseColor.rgb*=.82+.14*artHash(floor(tile))-.14*min(1.,seam);
    artRough=.40;artMetal=.52;
   }else if(vArtRole<3.5){
    diffuseColor.rgb*=.82+.22*artNoise(uv*vec2(3.,.18));
    artRough=.88;artMetal=0.;
   }else if(vArtRole<4.5){
    vec3 hueShift=mix(vec3(.80,.88,.84),vec3(.96,.98,.90),vArtInstHash);
    diffuseColor.rgb*=hueShift*(.90+.16*artNoise(vArtWorld.xz*.55));
    artRough=.78;artMetal=0.;
   }else if(vArtRole<5.5){
    vec2 wBez=min(vArtUv,1.-vArtUv);
    float jamb=smoothstep(0.,.065,wBez.x)*smoothstep(0.,.055,wBez.y);
    float lintel=mix(.42,1.,smoothstep(0.,.24,1.-vArtUv.y));
    float skyGlint=smoothstep(.35,.86,vArtUv.y+(vArtUv.x-.5)*.35);
    diffuseColor.rgb*=mix(.38,1.,jamb)*lintel*(.88+skyGlint*.22);
    diffuseColor.rgb+=vec3(.028,.044,.054)*skyGlint*jamb;
    diffuseColor.rgb=mix(vec3(.055,.080,.095),diffuseColor.rgb,jamb);
    artRough=mix(.58,.07,jamb);artMetal=mix(.04,.86,jamb);
   }else if(vArtRole<6.5){
    vec2 wBez=min(vArtUv,1.-vArtUv);
    float jamb=smoothstep(0.,.065,wBez.x)*smoothstep(0.,.055,wBez.y);
    vec2 wPaneGrid=abs(vArtUv-.5);
    float wMullion=smoothstep(.016,.038,wPaneGrid.x)*smoothstep(.016,.038,wPaneGrid.y);
    float lintel=mix(.46,1.,smoothstep(0.,.22,1.-vArtUv.y));
    diffuseColor.rgb*=mix(.18,1.04,jamb*wMullion)*lintel;
    diffuseColor.rgb+=vec3(.028,.018,.006)*jamb*wMullion;
    diffuseColor.rgb=mix(vec3(.060,.085,.100),diffuseColor.rgb,jamb*wMullion);
    artRough=mix(.56,.065,jamb*wMullion);artMetal=mix(.04,.88,jamb*wMullion);
   }else if(vArtRole<7.5){
    vec2 brick=uv*vec2(.8,2.);brick.x+=mod(floor(brick.y),2.)*.5;
    vec2 f=fract(brick),aa=max(fwidth(brick),vec2(.015));
    float joint=max(1.-smoothstep(.025,.025+aa.x,f.x),1.-smoothstep(.05,.05+aa.y,f.y));
    diffuseColor.rgb*=.80+artHash(floor(brick))*.18-joint*.20;
    artRough=.84;artMetal=0.;
   }else if(vArtRole<8.5){
    vec2 slab=vArtWorld.xz*.6;slab.x+=mod(floor(slab.y),2.)*.5;
    vec2 f=fract(slab),aa=max(fwidth(slab),vec2(.012));
    float joint=max(1.-smoothstep(.016,.016+aa.x,f.x),1.-smoothstep(.02,.02+aa.y,f.y));
    float walkPuddle=(n.y>.7?1.:0.)*smoothstep(.20,.58,artField(vArtWorld.xz*.055+4.1));
    diffuseColor.rgb*=.68+.10*artHash(floor(slab))-.20*joint;
    diffuseColor.rgb*=mix(1.,.70,walkPuddle);
    artWetRefl=n.y>.7?walkPuddle*.55:0.;
    artCityWet=n.y>.7?walkPuddle*.65:0.;
    artRough=mix(.86,.42,walkPuddle);artMetal=0.;
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
    vec3 treadWear=vec3(1.18,1.12,1.04)*(.92+patina*.11);
    diffuseColor.rgb*=n.y>.7?treadWear:vec3(.74,.78,.80);
    artRough=.74;artMetal=.02;
   }else{
    float aggregate=artNoise(vArtWorld.xz*2.7),repair=artNoise(vArtWorld.xz*.09);
    float lotWear=artNoise(vArtWorld.xz*.06);
    float rx=mod(vArtWorld.x-392.+38.,76.)-38.;
    float rz=mod(vArtWorld.z+456.+38.,76.)-38.;
    float onNS=1.-smoothstep(6.2,7.6,abs(rx));
    float onEW=1.-smoothstep(6.2,7.6,abs(rz));
    float laneNS=max(1.-smoothstep(.18,.48,abs(abs(rx)-2.15)),1.-smoothstep(.18,.48,abs(abs(rx)-3.65)))*onNS;
    float laneEW=max(1.-smoothstep(.18,.48,abs(abs(rz)-2.15)),1.-smoothstep(.18,.48,abs(abs(rz)-3.65)))*onEW;
    float tread=mix(sin(vArtWorld.z*16.),sin(vArtWorld.x*16.),step(onEW,onNS))*.5;
    float tracks=clamp(max(laneNS,laneEW)*(.65+.35*artNoise(vArtWorld.xz*.18)),0.,1.);
    float roadPuddle=smoothstep(.26,.66,artField(vArtWorld.xz*.048)+tracks*.20);
    artWetRefl=n.y>.7?clamp(roadPuddle*.42+tracks*.16,0.,.56):0.;
    artCityWet=n.y>.7?clamp(roadPuddle*.58+tracks*.12,0.,.72):0.;
    diffuseColor.rgb*=.44+lotWear*.12;
    diffuseColor.rgb*=.92+aggregate*.09-smoothstep(.68,.82,repair)*.10;
    diffuseColor.rgb*=1.-tracks*(.28+.05*tread);
    diffuseColor.rgb*=1.-artCityWet*.14;
    artRough=mix(.80,.22,artCityWet);artMetal=0.;
   }
   float pbrOn=0.;
   vec2 pbrUv=artDetailUv(vArtWorld,nWorld);
   vec4 pbrD=vec4(1.),pbrN=vec4(.5,.5,1.,1.),pbrA=vec4(1.,.8,0.,1.);
   if(vArtRole>6.5&&vArtRole<7.5){
    pbrOn=1.;pbrUv*=.42;pbrD=texture2D(uBrickD,pbrUv);pbrN=texture2D(uBrickN,pbrUv);pbrA=texture2D(uBrickA,pbrUv);
   }else if(vArtRole<9.5&&vArtRole>7.5){
    pbrOn=1.;pbrUv*=.14;pbrD=texture2D(uAsphaltD,pbrUv);pbrN=texture2D(uAsphaltN,pbrUv);pbrA=texture2D(uAsphaltA,pbrUv);
   }else if(vArtRole<1.5||(vArtRole>2.5&&vArtRole<4.5)||(vArtRole>7.5&&vArtRole<8.5)){
    pbrOn=1.;pbrUv*=.24;pbrD=texture2D(uPlasterD,pbrUv);pbrN=texture2D(uPlasterN,pbrUv);pbrA=texture2D(uPlasterA,pbrUv);
   }
   if(pbrOn>.5){
    float pbrLum=dot(pbrD.rgb,vec3(.333));
    diffuseColor.rgb*=mix(1.,pbrLum*1.55,.42);
    artRough=clamp(mix(artRough,pbrA.g,.40),.06,1.);
    artMetal=clamp(mix(artMetal,pbrA.b,.30),0.,1.);
    artSemAO*=mix(1.,pbrA.r,.50);
    vec2 pbrSlope=(pbrN.xy*2.-1.)*.60;
    artWorldNormal=artApplyDetail(artWorldNormal,vec4(pbrSlope*.5+.5,0.,0.),1.);
   }
   float artLayer=vArtRole<.5?7.:vArtRole<1.5?0.:vArtRole<2.5?4.:vArtRole<3.5?3.:vArtRole<4.5?7.:vArtRole<5.5?6.:vArtRole<6.5?6.:vArtRole<7.5?1.:vArtRole<8.5?6.:vArtRole<9.5?2.:vArtRole<10.5?5.:3.;
   artDist=length(cameraPosition-vArtWorld);
   float artFade=1.-smoothstep(42.,70.,artDist);
   bool hasNormalDetail=vArtRole<3.5||(vArtRole>6.5);
   vec4 artDetail=hasNormalDetail?artDetailTap(vArtWorld,nWorld,artLayer,artFade):vec4(.5,.5,artRough,.85);
   if(hasNormalDetail)artWorldNormal=artApplyDetail(nWorld,artDetail,artFade*1.15*(1.-artCityWet*.84));
   artRough=clamp(artRough+(artDetail.b-.5)*.16,.08,.99);
   artMetal=clamp(artMetal*(.42+.58*artDetail.a),0.,1.);
   if(hasNormalDetail)diffuseColor.rgb*=.91+artDetail.a*.12;
   if(vArtRole<3.5||vArtRole>6.5){
    diffuseColor.rgb*=mix(1.,artSemAO,.42);
    float grime=artNoise(vArtWorld.xz*.55+vArtWorld.y*.18);
    float rain=baseGrime*artNoise(vec2(vArtWorld.x*.9,vArtWorld.y*.085));
    diffuseColor.rgb*=.91+grime*.12-rain*.08;
    artRough=clamp(artRough+(grime-.5)*.10+baseGrime*.08,.08,.99);
    vec3 viewDir=normalize(cameraPosition-vArtWorld);
    float facing=abs(dot(nWorld,viewDir));
    diffuseColor.rgb*=1.-pow(1.-facing,3.)*.03;
    diffuseColor.rgb+=vec3(.012,.012,.010)*pow(1.-facing,4.);
   }
  }`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize((viewMatrix*vec4(artWorldNormal,0.)).xyz);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   float artCombineAO=vArtAO*mix(1.,artSemAO,.68);
   vec3 artCosyLift=(vArtMeta.z>.35&&vArtMeta.z<1.2)?vec3(2.20,2.02,1.82):vec3(1.);
   vec3 artOldLift=artInRoom>.5?vec3(2.35,1.80,1.22):artCosyLift;
   reflectedLight.indirectDiffuse*=artOldLift*mix(1.,artCombineAO,.48);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   if(vArtRole>5.5&&vArtRole<6.5){
    vec2 wGlowBez=min(vArtUv,1.-vArtUv);
    vec2 wGlowGrid=abs(vArtUv-.5);
    float wPane=smoothstep(0.,.07,wGlowBez.x)*smoothstep(0.,.06,wGlowBez.y)*smoothstep(.016,.038,wGlowGrid.x)*smoothstep(.016,.038,wGlowGrid.y);
    float wCore=smoothstep(.10,.68,wPane*(1.-abs(vArtUv.y-.46)*.85));
    totalEmissiveRadiance+=vec3(2.05,1.15,.40)*(.52+.75*wCore)*wPane;
   }
   if(artInRoom>.5){
    totalEmissiveRadiance+=vec3(.24,.13,.040)*mix(.45,1.,artSemAO);
   }`);
  shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
   vec3 artV=normalize(vViewPosition);
   float artFres=pow(1.-saturate(dot(normal,artV)),3.4);
   // Cheap sky/IBL term: the metal and glass now reflect the same overcast
   // palette as the sky instead of reading as flat painted boxes.
   vec3 artWorldV=normalize(cameraPosition-vArtWorld);
   vec3 artRefl=reflect(-artWorldV,artWorldNormal);
   vec3 artSunWorld=normalize((vec4(directionalLights[0].direction,0.)*viewMatrix).xyz);
   float artSky=clamp(artRefl.y*.5+.5,0.,1.);
   vec3 artEnvCol=mix(vec3(.10,.14,.17),vec3(.56,.65,.70),artSky);
   artEnvCol+=directionalLights[0].color*pow(max(dot(artRefl,artSunWorld),0.),18.)*.30;
   float artEnvSpec=pow(1.-clamp(artRough,0.,1.),2.2)*(.12+.88*artFres)*(.18+artMetal*1.7);
   if(vArtRole>4.5&&vArtRole<6.5)artEnvSpec+=.10*(.30+.70*artFres);
   outgoingLight+=artEnvCol*clamp(artEnvSpec,0.,.42);
   if(vArtRole>7.5&&vArtRole<9.5){
    float roadFres=pow(1.-saturate(dot(normal,artV)),4.2);
    float roadFade=1.-smoothstep(35.,110.,artDist);
    outgoingLight+=vec3(.38,.48,.54)*roadFres*artCityWet*.22*roadFade;
   }
   #if NUM_DIR_LIGHTS > 0
   vec3 artL=normalize(directionalLights[0].direction);
   vec3 artH=normalize(artV+artL);
   if(vArtRole<3.5||vArtRole>4.5){
    float spec=pow(saturate(dot(normal,artH)),mix(8.,52.,1.-artRough));
    float bands=step(.32,spec)*.45+step(.68,spec)*.55;
    vec3 tint=mix(vec3(.20,.23,.25),vec3(.82,.84,.86),artMetal);
    outgoingLight+=directionalLights[0].color*tint*bands*(.08+.20*artFres+artCityWet*.22)*(1.-artRough*.52);
   }
   if(vArtRole<2.5||(vArtRole>6.5&&vArtRole<9.5)){
    outgoingLight+=mix(vec3(.040,.052,.060),vec3(.090,.095,.098),artMetal)*artFres*.80;
   }
   if(vArtRole>3.5&&vArtRole<4.5){
    float wrap=saturate(dot(normal,artL)*.5+.5);
    float back=pow(saturate(dot(-normal,artL)),2.);
    outgoingLight+=directionalLights[0].color*diffuseColor.rgb*(wrap*.18+back*.24);
    outgoingLight+=diffuseColor.rgb*(vec3(.048,.058,.048)+artFres*.24);
   }
   #endif
   float artMist=smoothstep(55.,340.,artDist)*(1.-smoothstep(14.,46.,vArtWorld.y)*.72);
   outgoingLight=mix(outgoingLight,${rgb(0x9eb0b8)},artMist*.26);
   if(uArtDebug>.5&&uArtDebug<1.5)outgoingLight=artWorldNormal*.5+.5;
   else if(uArtDebug>1.5&&uArtDebug<2.5)outgoingLight=vec3(pow(clamp(artRough,0.,1.),2.2));`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   if(uArtDebug>.5&&uArtDebug<1.5)gl_FragColor=vec4(artWorldNormal*.5+.5,1.);
   else if(uArtDebug>1.5&&uArtDebug<2.5)gl_FragColor=vec4(vec3(clamp(artRough,0.,1.)),1.);
   if(vArtMeta.z<.3&&vArtRole>7.5&&vArtRole<9.5&&nWorld.y>.7){
    float artWetDist=clamp(artWetRefl*(1.-smoothstep(90.,220.,artDist)),0.,1.);
    gl_FragColor.a=.84-artWetDist*.30;
   }`);
 };
 material.customProgramCacheKey=()=>previousKey()+'-toon-surface-v9';
 return material;
}

export const skyNoise=noise;

export function paintBridge(material,finish){
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey?material.customProgramCacheKey.bind(material):()=>'';
 material.customProgramCacheKey=()=>previousKey()+`-blackwater-bridge-${finish}-v3`;
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
   float bridgeTracks=1.-smoothstep(.18,.52,abs(abs(p.y)-2.4));
   float repair=smoothstep(.71,.79,artField(p*vec2(.14,.38)));
   float bridgeWet=clamp(smoothstep(.34,.68,artField(p*.048))+bridgeTracks*.22,0.,1.);
   diffuseColor.rgb*=(.66+wear*.20+grain*.10+tracked*.12-repair*.18-bridgeTracks*.16)*(1.-bridgeWet*.28);
  `:`
   vec2 p=vec2(vBridge.x,vBridge.z+vBridge.y*2.);
   float stain=artField(p*vec2(.25,.39));
   float runoff=artNoise(vec2(p.x*.93,p.y*.12));
   float joint=1.-smoothstep(.012,.012+max(.006,fwidth(p.x)*.1),abs(fract(p.x*.1)-.5));
   diffuseColor.rgb*=.72+stain*.24-smoothstep(.56,.80,runoff)*.20-joint*.14;
  `;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
  if(finish==='asphalt'){
   shader.fragmentShader=shader.fragmentShader.replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
    vec3 bV=normalize(vViewPosition);
    float bFres=pow(1.-saturate(dot(normal,bV)),4.2);
    float bWet=smoothstep(.34,.68,artField(vBridge.xz*.048));
    outgoingLight+=vec3(.38,.48,.54)*bFres*bWet*.18;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
    float bDist=length(cameraPosition-vBridge);
    gl_FragColor.a=.82-clamp(bWet*(1.-smoothstep(90.,220.,bDist)),0.,1.)*.42;`);
  }
 };
 material.needsUpdate=true;
}
