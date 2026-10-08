import {MeshBasicNodeMaterial} from './vendor/three.webgpu.js';
import {positionLocal,positionWorld,cameraPosition,reference,vec3} from './vendor/three.tsl.js';
import {tslExports} from './vendor/vgpu-three.js';
import {coastalWGSL} from './coastal-water.js';

const coast=tslExports(`${coastalWGSL}
fn coastalFragment(p:vec3f,t:f32,eye:vec3f)->vec3f {
 let footprint=max(length(dpdx(p.xz)),length(dpdy(p.xz)));
 return coastalColor(p,t,eye,footprint);
}`)('coastalHeight','coastalFragment');

// Same amplitudes, wave directions, reflection and haze as harbor-visuals.js.
// vgpu connects the portable WGSL functions to Three's native WebGPU material.
const waves=tslExports(`
fn sea(p:vec2f,t:f32)->f32 {
 return .18*sin(dot(p,vec2f(.23,.12))-t*1.55)+.09*sin(dot(p,vec2f(-.31,.37))-t*2.1)+.045*sin(dot(p,vec2f(.72,.51))-t*2.85);
}
fn seaColor(p:vec3f,t:f32,eye:vec3f)->vec3f {
 let g=.18*vec2f(.23,.12)*cos(dot(p.xz,vec2f(.23,.12))-t*1.55)+.09*vec2f(-.31,.37)*cos(dot(p.xz,vec2f(-.31,.37))-t*2.1)+.045*vec2f(.72,.51)*cos(dot(p.xz,vec2f(.72,.51))-t*2.85);
 let n=normalize(vec3f(-g.x,1.,-g.y));let v=normalize(eye-p);
 let f=.02+.98*pow(1.-max(dot(n,v),0.),5.);let r=reflect(-v,n);
 let sky=mix(vec3f(.025,.095,.105),vec3f(.10,.22,.24),clamp(r.y*.7+.35,0.,1.));
 let sun=pow(max(dot(r,normalize(vec3f(-.5,.4,-.6))),0.),100.);
 let color=mix(vec3f(.009,.068,.072),sky,min(f,.78))+sun*.065;
 let crest=smoothstep(.22,.31,sea(p.xz,t))*.055;
 let haze=1.-exp(-length(eye-p)*.003);
 return mix(mix(color,vec3f(.20,.32,.30),crest),vec3f(.09,.18,.19),haze*.4);
}
`)('sea','seaColor');
export function portHarborWater(source){
 const material=new MeshBasicNodeMaterial();material.name='HarborWaterWGSL';
 const t=reference('value','float',source.uniforms.time);
 if(source.userData.coastalWater){
  material.name='CoastalWaterWGSL';
  // Coastal optics owns its distance haze, matched to the graphic sky horizon.
  material.fog=false;
  material.positionNode=positionLocal.add(vec3(0,coast.coastalHeight({p:positionLocal.xz,t}),0));
  material.colorNode=coast.coastalFragment({p:positionWorld,t,eye:cameraPosition});
  return material;
 }
 material.positionNode=positionLocal.add(vec3(0,waves.sea({p:positionLocal.xz,t}),0));
 material.colorNode=waves.seaColor({p:positionWorld,t,eye:cameraPosition});
 return material;
}
