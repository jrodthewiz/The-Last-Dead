// Shared authored wave field for the WebGL and native WebGPU paths.
// Body absorption estimates depth; reflection is analytic sky, not scene capture.
export const coastalWaves=[
  [0.94,0.32,0.32,34],[-0.42,0.91,0.19,21],[0.78,-0.52,0.11,13],
];
const number=n=>Number(n).toFixed(8);
const terms=coastalWaves.map(([x,z,a,l])=>{const k=2*Math.PI/l,d=Math.hypot(x,z);return {x:x/d*k,z:z/d*k,a,w:Math.sqrt(9.81*k)};});
const phase=q=>`dot(p,vec2(${number(q.x)},${number(q.z)}))-t*${number(q.w)}`;
const height=terms.map(q=>`${number(q.a)}*sin(${phase(q)})`).join('+');
const slope=terms.map(q=>`vec2(${number(q.x*q.a)},${number(q.z*q.a)})*cos(${phase(q)})`).join('+');
export const coastalGLSL=`
float coastalHeight(vec2 p,float t){return ${height};}
vec2 coastalSlope(vec2 p,float t){return ${slope};}
float coastalHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float coastalNoise(vec2 p){
 vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(vec2(3.)-2.*f);
 return mix(mix(coastalHash(i),coastalHash(i+vec2(1.,0.)),u.x),mix(coastalHash(i+vec2(0.,1.)),coastalHash(i+vec2(1.,1.)),u.x),u.y);
}
vec3 coastalColor(vec3 p,float t,vec3 eye,float footprint){
 float aa=1.-smoothstep(.12,1.5,footprint);
 float aaFine=1.-smoothstep(.035,.42,footprint);
 float warp=coastalNoise(p.xz*.085+vec2(t*.015,-t*.009))*6.;
 float rippleWeight=.35+.65*coastalNoise(p.xz*.13+vec2(-t*.025,t*.008));
 vec2 ripple=(vec2(.8,.6)*.029*cos(dot(p.xz,vec2(1.12,.84))-t*3.6+warp)+vec2(-.92,.39)*.023*cos(dot(p.xz,vec2(-1.81,.77))-t*4.2-warp*.8)+vec2(.24,-.97)*.018*cos(dot(p.xz,vec2(.65,-2.62))-t*4.7+warp*1.3))*aa*rippleWeight+(vec2(-.6,.8)*.012*cos(dot(p.xz,vec2(-2.52,3.36))-t*5.8+warp)+vec2(.98,-.2)*.008*cos(dot(p.xz,vec2(5.1,-1.04))-t*6.3-warp))*aaFine*rippleWeight;
 vec2 gradient=coastalSlope(p.xz,t)+ripple;
 vec3 n=normalize(vec3(-gradient.x,1.,-gradient.y));
 vec3 v=normalize(eye-p);
 float fresnel=.0204+.9796*pow(1.-abs(dot(n,v)),5.);
 vec3 r=reflect(-v,n);
 float skyY=clamp(r.y,0.,1.);
 vec3 sky=mix(vec3(.23,.32,.34),vec3(.045,.12,.16),sqrt(skyY));
 float cloud=.5+.5*sin(r.x*13.+r.z*9.+sin(r.z*19.)*1.7);
 vec3 reflection=mix(sky,vec3(.26,.32,.32),smoothstep(.5,.88,cloud)*.3);
 float path=5./max(.25,abs(v.y));
 vec3 transmission=exp(-vec3(.22,.065,.045)*path);
 vec3 body=vec3(.006,.036,.039)+vec3(.035,.09,.08)*transmission;
 vec3 sunDirection=normalize(vec3(-.5,.4,-.6));
 float sunDot=max(dot(r,sunDirection),0.);
 float sun=pow(sunDot,150.)*.23+pow(sunDot,22.)*.022;
 float crest=smoothstep(.37,.55,coastalHeight(p.xz,t));
 float foamPatch=coastalNoise(p.xz*.31+vec2(t*.04,-t*.023));
 float foam=crest*smoothstep(.68,.93,foamPatch)*.09*aa;
 vec3 lit=mix(body,reflection,fresnel)+vec3(.72,.77,.69)*sun;
 vec3 foamed=mix(lit,vec3(.4,.47,.44),foam);
 float haze=1.-exp(-length(eye-p)*.00085);
 return mix(foamed,vec3(.13,.21,.22),haze*.65);
}`;

// The restricted source deliberately uses immutable locals so both backends
// receive identical wave constants and optical math.
export const coastalWGSL=coastalGLSL
 .replace(/float coastalHeight\(vec2 p,float t\)/,'fn coastalHeight(p:vec2f,t:f32)->f32')
 .replace(/vec2 coastalSlope\(vec2 p,float t\)/,'fn coastalSlope(p:vec2f,t:f32)->vec2f')
 .replace(/float coastalHash\(vec2 p\)/,'fn coastalHash(p:vec2f)->f32')
 .replace(/float coastalNoise\(vec2 p\)/,'fn coastalNoise(p:vec2f)->f32')
 .replace(/vec3 coastalColor\(vec3 p,float t,vec3 eye,float footprint\)/,'fn coastalColor(p:vec3f,t:f32,eye:vec3f,footprint:f32)->vec3f')
 .replace(/\b(?:float|vec2|vec3) (\w+)=/g,'let $1=')
 .replace(/\bvec2\(/g,'vec2f(').replace(/\bvec3\(/g,'vec3f(');

export function coastalSurfaceHeightAt(x,z,time){return terms.reduce((sum,q)=>sum+q.a*Math.sin(x*q.x+z*q.z-time*q.w),0);}

export function makeCoastalWater(THREE,bounds={}){
 const segments=320,extent=4000;
 const geometry=new THREE.PlaneGeometry(1,1,segments,segments);
 const position=geometry.attributes.position;
 // Dense 3.5m cells cover the inhabited coast; outer cells expand to horizon.
 const axis=v=>{const t=Math.abs(v)*2;return Math.sign(v)*(t<.8?t/.8*450:450+Math.pow((t-.8)/.2,1.6)*(extent/2-450));};
 const centerX=bounds.centerX??0,centerZ=bounds.centerZ??0;
 for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i);position.setXYZ(i,axis(x)+centerX,bounds.level??-.65,-axis(y)+centerZ);}
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new THREE.ShaderMaterial({name:'CoastalAnalyticWater',uniforms:{time:{value:0}},
  vertexShader:`uniform float time;varying vec3 vWorld;${coastalGLSL}void main(){vec3 p=position;p.y+=coastalHeight(p.xz,time);vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
  fragmentShader:`uniform float time;varying vec3 vWorld;${coastalGLSL}void main(){float footprint=max(length(dFdx(vWorld.xz)),length(dFdy(vWorld.xz)));gl_FragColor=vec4(coastalColor(vWorld,time,cameraPosition,footprint),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
 material.userData.coastalWater=true;
 const mesh=new THREE.Mesh(geometry,material);mesh.name='CoastalDisplacedWater';mesh.frustumCulled=false;mesh.userData.noBatch=true;
 mesh.userData.waterDiagnostics={extent,segments,waves:coastalWaves,normal:'shared analytic gradient + derivative-filtered normal-only ripples',reflection:'analytic sky/cloud approximation',absorption:'estimated optical path; no scene refraction',foam:'instantaneous crest-linked',heightAt:coastalSurfaceHeightAt};
 return mesh;
}
