import * as THREE from './vendor/three.module.js';
import {BodycamPass} from './bodycam-pass.js';

// Keep HDR, eye adaptation and the existing output-conversion owner while
// removing the recording simulation from the actual first-person image.
const CLEAN_FRAGMENT=`
uniform sampler2D tScene;
uniform sampler2D tExposure;
uniform int uDebug;
varying vec2 vUv;
void main(){
  vec3 scene=texture2D(tScene,vUv).rgb;
  float exposure=texture2D(tExposure,vec2(.5)).r;
  if(exposure<.1)exposure=1.;
  vec3 col=scene*exposure;
  float luma=dot(col,vec3(.2126,.7152,.0722));
  col=mix(vec3(luma),col,.96);
  col*=mix(vec3(.975,1.0,1.015),vec3(1.015,1.0,.985),smoothstep(.05,.8,luma));
  if(uDebug==1)col=scene;
  gl_FragColor=vec4(max(col,0.),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class FirstPersonPass extends BodycamPass {
  constructor(renderer){
    super(renderer);
    const original=this.material;
    this.material=new THREE.ShaderMaterial({name:'ImmersiveFirstPersonResolve',
      vertexShader:original.vertexShader,fragmentShader:CLEAN_FRAGMENT,
      uniforms:original.uniforms,depthTest:false,depthWrite:false});
    // uLens is retained as the native shader port's colour-conversion marker;
    // the clean shader never samples it or distorts the perspective image.
    this.quad.material=this.material;original.dispose();
  }
  _motion(){this._blur.set(0,0);this._speed=0;}
  diagnostics(){return {...super.diagnostics(),presentation:'immersive-first-person',recordingSimulation:false,projection:'unaltered perspective',blur:[0,0],grain:false,chromaticFringe:false,scanlines:false};}
}
