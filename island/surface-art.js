import * as T from '../vendor/three.module.js';

// Low-frequency painted colour and small material-specific marks. These run in
// the existing Lambert draw, before lighting, fog and the single output pass.
const noise=`
float artHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float artNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(artHash(i),artHash(i+vec2(1,0)),f.x),mix(artHash(i+vec2(0,1)),artHash(i+vec2(1,1)),f.x),f.y);}
float artField(vec2 p){return artNoise(p)*.62+artNoise(p*2.03+9.1)*.26+artNoise(p*4.11-5.7)*.12;}
`;
const rgb=hex=>'vec3('+new T.Color(hex).toArray().map(v=>v.toFixed(5)).join(',')+')';

export function paintTerrain(shader,segments,roadPaint,roadBounds){
 shader.vertexShader='attribute float artSlope;varying float vSlope;varying vec3 vGround;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;vSlope=artSlope;');
 // Keep a single loop in the driver instead of generating a large shader
 // with a separate copy of the distance calculation for each road segment.
 shader.uniforms.artRoadSegments={value:segments};
 shader.uniforms.artRoadPaint={value:roadPaint};
 shader.uniforms.artRoadCount={value:segments.length};
 shader.fragmentShader=`varying float vSlope;varying vec3 vGround;
 uniform vec4 artRoadSegments[${segments.length}];
 uniform vec4 artRoadPaint[${segments.length}];
 uniform int artRoadCount;\n`+noise+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 land=vGround.xz;float field=artField(land*.022),tuft=artNoise(land*.37);
 vec3 soil=mix(${rgb(0x607c4b)},${rgb(0x9b9e61)},smoothstep(.22,.8,field));
 soil*=.93+tuft*.12;
 float exposed=smoothstep(.025,.11,vSlope+(field-.5)*.035);
 float strata=sin(vGround.y*.65+artNoise(land*.045)*2.8);
 vec3 rock=mix(${rgb(0x69736f)},${rgb(0xa8ab9c)},artField(land*.1))*(.92+strata*.13);
 soil=mix(soil,rock,exposed);
 float shore=1.-smoothstep(3.0,7.5,vGround.y+field*1.1);
 vec3 sand=mix(${rgb(0x93997c)},${rgb(0xc3b992)},smoothstep(.2,3.8,vGround.y))*(.94+tuft*.1);
 soil=mix(soil,sand,shore*(1.-exposed*.5));
 diffuseColor.rgb=mix(diffuseColor.rgb,soil,.84);
 if(vGround.x<110.&&${roadBounds}){float rd=9999.;float rw=0.;vec3 rc=vec3(0.);
 for(int i=0;i<artRoadCount;i++){
   vec4 segment=artRoadSegments[i];vec2 a=segment.xy,ab=segment.zw-a;
   float t=clamp(dot(land-a,ab)/dot(ab,ab),0.,1.);
   float d=length(land-a-ab*t);
   if(d<rd){rd=d;vec4 paint=artRoadPaint[i];rw=paint.w;rc=paint.rgb;}
 }
 float edge=artNoise(land*1.7)*.16;float shoulder=1.-smoothstep(rw+.55,rw+.85,rd+edge);
 float paving=1.-smoothstep(rw-.07,rw+.07,rd+edge*.35);
 diffuseColor.rgb=mix(diffuseColor.rgb,${rgb(0x666e4e)},shoulder);
 float useMark=rw<3.?(.89+.13*artNoise(land*.35)):(.94+.08*artNoise(land*.8));
 diffuseColor.rgb=mix(diffuseColor.rgb,rc*useMark,paving);}
 `);
}

export function paintArchitecture(material){
 const wind={value:0};material.userData.wind=wind;
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.uArtWind=wind;shader.vertexShader='uniform float uArtWind;attribute float artRole;varying float vArtRole;varying vec3 vArtWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vArtRole=artRole;vec4 artPoint=vec4(position,1.);
   #ifdef USE_INSTANCING
   artPoint=instanceMatrix*artPoint;
   #endif
   vArtWorld=(modelMatrix*artPoint).xyz;
   if(artRole>3.5&&artRole<4.5){float wind=sin(uArtWind*1.25+vArtWorld.x*.08+vArtWorld.z*.06);transformed.x+=wind*.028*max(0.,position.y+.6);transformed.z+=sin(uArtWind*.9+vArtWorld.x*.09)*.016*max(0.,position.y+.6);}`);
  shader.fragmentShader='varying float vArtRole;varying vec3 vArtWorld;\n'+noise+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  if(vArtRole>.5){
   vec3 n=abs(normalize(cross(dFdx(vArtWorld),dFdy(vArtWorld))));
   vec2 uv=n.y>.7?vArtWorld.xz:(n.x>n.z?vArtWorld.zy:vArtWorld.xy);
   float patina=artField(uv*.22);
   if(vArtRole<1.5){
    float runoff=artNoise(vec2(uv.x*.65,uv.y*.085));
    diffuseColor.rgb*=.85+patina*.19;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.64,.72,.65),smoothstep(.68,.86,runoff)*.32);
   }else if(vArtRole<2.5){
    vec2 tile=vArtWorld.xz*vec2(1.8,2.5);tile.x+=mod(floor(tile.y),2.)*.5;
    vec2 cell=fract(tile),aa=max(fwidth(tile),vec2(.02));
    float seam=(1.-smoothstep(.025,.025+aa.x,cell.x))+(1.-smoothstep(.06,.06+aa.y,cell.y));
    diffuseColor.rgb*=.92+.14*artHash(floor(tile))-.12*min(1.,seam);
   }else if(vArtRole<3.5){
    diffuseColor.rgb*=.82+.25*artNoise(uv*vec2(3.,.18));
   }else if(vArtRole<4.5){
    diffuseColor.rgb*=.92+.16*artNoise(vArtWorld.xz*.55);
   }else if(vArtRole<6.5){
    float sheen=pow(1.-abs(fract((uv.x+uv.y*.32)*.3)-.5)*2.,5.);
    diffuseColor.rgb*=.83+sheen*.18;
   }else if(vArtRole<7.5){
    vec2 brick=uv*vec2(.8,2.);brick.x+=mod(floor(brick.y),2.)*.5;
    vec2 f=fract(brick),aa=max(fwidth(brick),vec2(.015));
    float joint=max(1.-smoothstep(.025,.025+aa.x,f.x),1.-smoothstep(.05,.05+aa.y,f.y));
    diffuseColor.rgb*=.86+artHash(floor(brick))*.2-joint*.18;
   }else if(vArtRole<8.5){
    vec2 slab=vArtWorld.xz*.6;slab.x+=mod(floor(slab.y),2.)*.5;
    vec2 f=fract(slab),aa=max(fwidth(slab),vec2(.012));
    float joint=max(1.-smoothstep(.016,.016+aa.x,f.x),1.-smoothstep(.02,.02+aa.y,f.y));
    diffuseColor.rgb*=.92+.1*artHash(floor(slab))-.13*joint;
   }else{
    float aggregate=artNoise(vArtWorld.xz*2.7),repair=artNoise(vArtWorld.xz*.09);
    diffuseColor.rgb*=.94+aggregate*.085-smoothstep(.7,.82,repair)*.055;
   }
  }`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   if(vArtRole>5.5&&vArtRole<6.5)totalEmissiveRadiance+=${rgb(0xb7965c)}*.22;`);
 };
 const key=material.customProgramCacheKey.bind(material);material.customProgramCacheKey=()=>key()+'-authored-surfaces-v1';
 return material;
}

export const skyNoise=noise;

export function paintBridge(material,finish){
 material.customProgramCacheKey=()=>`blackwater-bridge-${finish}`;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vBridge;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBridge=position;');
  shader.fragmentShader='varying vec3 vBridge;\n'+noise+shader.fragmentShader;
  const detail=finish==='asphalt'?`
   vec2 p=vBridge.xz;
   float wear=artField(p*vec2(.2,.68));
   float grain=artNoise(p*3.7)* (1.-smoothstep(.16,.48,length(fwidth(p))));
   float tracked=1.-smoothstep(.35,1.5,abs(abs(p.y)-3.8));
   float repair=smoothstep(.71,.79,artField(p*vec2(.14,.38)));
   diffuseColor.rgb*=.79+wear*.23+grain*.11+tracked*.17-repair*.18;
  `:`
   vec2 p=vec2(vBridge.x,vBridge.z+vBridge.y*2.);
   float stain=artField(p*vec2(.25,.39));
   float runoff=artNoise(vec2(p.x*.93,p.y*.12));
   float joint=1.-smoothstep(.012,.012+max(.006,fwidth(p.x)*.1),abs(fract(p.x*.1)-.5));
   diffuseColor.rgb*=.76+stain*.27-smoothstep(.59,.82,runoff)*.2-joint*.13;
  `;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
 };
}
