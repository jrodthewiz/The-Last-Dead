import * as THREE from './vendor/three.module.js';
// Chest-mounted body-camera look. The scene is rendered into a mipmapped HDR
// target; a 1x1 pass then measures average luminance and eases an exposure
// value toward it (sensor auto-gain), and the final resolve applies the lens
// and sensor model: wide barrel distortion, rolling shutter, rotation motion
// blur, mip-chain bloom on hot lights, sharpening halos, chromatic fringing,
// low-light compression blocking and fine grain. Tone mapping and sRGB output
// are applied here because three skips them while drawing into a render target.
const VERTEX = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
// Perceptual controls: lens curvature/overscan and sensor grain/fringe/bleed/edge.
export const BODYCAM_LOOK = Object.freeze({
  lens: Object.freeze({ curvature: .48, overscan: 1.032 }),
  sensor: Object.freeze({ grain: .028, fringe: .0018, bloom: .52, sharpen: .03 }),
  // Encoded-video bandwidth, chroma loss, line instability, scan modulation.
  recording: Object.freeze({ lines: 540, chromaLoss: .74, instability: .24, scan: .045 }),
});

const EXPOSURE_FRAGMENT = `
uniform sampler2D tScene;
uniform sampler2D tPrev;
uniform float uMaxLod;
uniform float uDt;
uniform bool uReset;
varying vec2 vUv;
void main(){
  // Center-weighted average: broad top mip blended with a mid-level centre tap.
  vec3 avg=textureLod(tScene,vec2(.5),uMaxLod).rgb;
  vec3 mid=textureLod(tScene,vec2(.5),max(uMaxLod-2.,0.)).rgb;
  float l=dot(mix(avg,mid,.35),vec3(.2126,.7152,.0722));
  float target=clamp(.13/max(l,.01),.8,2.1);
  float prev=texture2D(tPrev,vec2(.5)).r;
  if(uReset||prev<.1)prev=1.;
  // Bright flashes close the iris quickly; dark rooms open it slowly.
  float speed=target<prev?3.2:1.1;
  // Spare channels expose the actual meter/target to QA without a per-frame
  // GPU readback in gameplay. The resolve still consumes only red gain.
  gl_FragColor=vec4(mix(prev,target,1.-exp(-uDt*speed)),target,l,1.);
}`;

const FRAGMENT = `
uniform sampler2D tScene;
uniform sampler2D tExposure;
uniform vec2 uRes;
uniform float uTime;
uniform float uStrength;
uniform float uGlitch;
uniform float uSpeed;
uniform float uMotion;
uniform int uDebug;
uniform vec2 uBlur;
uniform vec2 uLens;
uniform vec4 uSensor;
uniform vec4 uRecording;
varying vec2 vUv;
float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
vec3 sceneAt(vec2 uv){return texture2D(tScene,uv).rgb;}
float sensorLuma(vec3 col){return dot(col,vec3(.2126,.7152,.0722));}
vec3 cameraGrade(vec3 col){
  float l=sensorLuma(col);
  col=mix(vec3(l),col,.76);
  col*=mix(vec3(.91,1.015,1.035),vec3(1.025,1.,.96),smoothstep(.03,.65,l));
  return max((col-.035)*1.1+.035,0.);
}
vec3 encodeSignal(vec3 col){
  #ifdef TONE_MAPPING
    col=toneMapping(col);
  #endif
  return linearToOutputTexel(vec4(col,1.)).rgb;
}
void main(){
  vec2 c=vUv-.5;
  float aspect=uRes.x/uRes.y;
  // The physical mount owns sway. Row readout bends a fast turn slightly;
  // the centre stays anchored and a stationary camera has no image drift.
  c+=uBlur*(vUv.y-.5)*.24*uMotion;
  float edge=(aspect*aspect+1.)*.25;
  vec2 p=vec2(c.x*aspect,c.y)/sqrt(edge);
  float r2=dot(p,p);
  // Normalise the corner radius: portrait and ultrawide keep the same lens.
  // Overscan covers shutter shear without clamping visible frame borders.
  float k=uLens.x*uStrength;
  vec2 d=c*(1.+k*r2)/(1.+k)/mix(1.,uLens.y,uStrength);
  d.x+=uGlitch*(hash(vec2(floor(vUv.y*38.),floor(uTime*24.)))-.5)*.05*step(.55,hash(vec2(floor(vUv.y*9.),floor(uTime*12.))));
  vec2 uv=d+.5;
  vec2 texel=1./uRes;
  float recordingTime=floor(uTime*30.);
  vec2 signalSize=vec2(uRecording.x*aspect,uRecording.x);
  // Low-amplitude, correlated row timing errors, rather than whole-screen shake.
  float line=floor(vUv.y*signalSize.y/3.);
  float lineError=hash(vec2(line,recordingTime))-.5;
  uv.x+=lineError/signalSize.x*uRecording.z*uMotion*uStrength;
  vec2 dir=c*uSensor.y*r2*uStrength*(1.+uGlitch*3.);
  // Rotation motion blur, sampled along the camera's screen-space velocity.
  vec3 col=vec3(0.);
  if(dot(uBlur,uBlur)>1e-8){
    for(int i=0;i<5;i++){
      float f=float(i)/4.-.5;
      vec2 o=uBlur*f;
      col+=vec3(sceneAt(uv+o+dir).r,sceneAt(uv+o).g,sceneAt(uv+o-dir).b);
    }
    col/=5.;
  }else col=vec3(sceneAt(uv+dir).r,sceneAt(uv).g,sceneAt(uv-dir).b);
  // Preserve the luma silhouette but lose the pristine subpixel renderer edges.
  float rimSoftness=smoothstep(.12,.9,r2);
  vec2 bandwidth=vec2((1.+rimSoftness*1.8)/signalSize.x,0.);
  vec3 lumaSoft=(sceneAt(uv-bandwidth)+sceneAt(uv+bandwidth))*.5;
  col=mix(col,lumaSoft,(.28+rimSoftness*.16)*uStrength);
  // Sharpening halos: the hard digital edge enhancement of small body cams.
  vec3 soft=(sceneAt(uv+texel*vec2(1.5,0.))+sceneAt(uv-texel*vec2(1.5,0.))+sceneAt(uv+texel*vec2(0.,1.5))+sceneAt(uv-texel*vec2(0.,1.5)))*.25;
  col+=clamp(col-soft,-.12,.12)*uSensor.w*uStrength;
  // Bloom from the mip chain: only pixels well above the exposure knee bleed.
  vec3 bloom=textureLod(tScene,uv,3.).rgb*.35+textureLod(tScene,uv,4.).rgb*.3+textureLod(tScene,uv,5.).rgb*.22+textureLod(tScene,uv,6.).rgb*.13;
  col+=max(bloom-.65,0.)*uSensor.z*uStrength;
  // Auto-gain.
  float exposure=texture2D(tExposure,vec2(.5)).r;
  if(exposure<.1)exposure=1.;
  col*=exposure;
  // Grade: contrast, colder shadows, mild desaturation.
  float luma=dot(col,vec3(.2126,.7152,.0722));
  col=cameraGrade(col);
  // Low-light compression: dark, flat regions collapse into 8px blocks.
  float dark=1.-smoothstep(.02,.4,luma);
  vec3 block=textureLod(tScene,uv,3.).rgb*exposure;
  vec2 cell=floor(vUv*uRes/8.);
  float flick=hash(cell+floor(uTime*10.));
  col=mix(col,block,dark*.09*uStrength*(.4+flick*.6));
  // Freeze the sensor cadence for reproducible captures.
  float t=uMotion>0.?recordingTime:0.;
  float n=hash(floor(vUv*signalSize)+t)-.5;
  float chroma=hash(floor(vUv*vec2(160.,90.))+t*1.7)-.5;
  // Lens vignette.
  float vignette=1.-smoothstep(.16,1.05,r2)*.48*uStrength;
  col*=vignette;
  col*=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  gl_FragColor=vec4(max(col,0.),1.);
  // Inspect the HDR input, lens displacement, or effect contribution without
  // changing the world's materials or the single output-conversion owner.
  if(uDebug==1)gl_FragColor.rgb=sceneAt(vUv);
  if(uDebug==2)gl_FragColor.rgb=vec3(abs(uv-vUv)*4.,0.);
  if(uDebug==3)gl_FragColor.rgb=abs(max(col,0.)-sceneAt(vUv));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Chroma has lower bandwidth than luma: horizontal bleeding is a property
  // of the recording, not extra RGB fringes on every object in the scene.
  if(uDebug==0||uDebug==4){
    vec2 chromaUv=(floor(uv*signalSize/vec2(4.,2.))+.5)*vec2(4.,2.)/signalSize;
    vec3 chromaColor=(encodeSignal(cameraGrade(sceneAt(chromaUv-bandwidth*2.5)*exposure)*vignette)+
      encodeSignal(cameraGrade(sceneAt(chromaUv+bandwidth*2.5)*exposure)*vignette))*.5;
    vec3 signal=gl_FragColor.rgb;
    float y=sensorLuma(signal);
    vec3 chromaOnly=chromaColor-sensorLuma(chromaColor);
    signal=mix(signal,vec3(y)+chromaOnly,uRecording.y*(.35+.65*smoothstep(.35,.75,y))*uStrength);
    // Small sensors clip bright cores, while the halo remains in the HDR pass.
    signal=clamp((signal-.008)*1.08,0.,1.);
    float clippedCore=smoothstep(.85,1.65,luma);
    signal=mix(signal,vec3(1.),clippedCore*.52*uStrength);
    // Local horizontal overexposure smear, with a threshold that excludes
    // ordinary walls and skin. Wide mip glow remains the separate HDR halo.
    vec3 hotLeft=encodeSignal(max(sceneAt(uv-bandwidth*3.5)*exposure-.8,0.));
    vec3 hotRight=encodeSignal(max(sceneAt(uv+bandwidth*3.5)*exposure-.8,0.));
    signal+=max((hotLeft+hotRight)*.5-.7,0.)*.18*uStrength;
    signal=mix(signal,vec3(sensorLuma(signal)),smoothstep(.82,1.,max(max(signal.r,signal.g),signal.b))*.35);
    float scan=sin(vUv.y*signalSize.y*3.14159265);
    signal*=1.-uRecording.w*(.5+.5*scan)*(.3+dark*.7)*uStrength;
    float rowNoise=hash(vec2(floor(vUv.y*signalSize.y),t))-.5;
    float signalDark=1.-smoothstep(.1,.42,y);
    float noiseGain=(.15+signalDark*.95)*clamp(exposure,.8,2.1);
    vec3 noise=(vec3(n)+chroma*vec3(.24,-.08,.22)+rowNoise*.10)*uSensor.x*noiseGain*uStrength;
    signal+=noise;
    if(uDebug==4)signal=vec3(.5)+noise*5.;
    gl_FragColor.rgb=clamp(signal,0.,1.);
  }
}`;

export class BodycamPass {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.reducedMotion = false;
    this.debugMode = 0;
    this.fixedTime = null;
    this.glitch = 0;
    this.target = null;
    this.size = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.exposureTargets = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.exposureIndex = 0;
    this._lastNow = 0;
    this._prevQuat = new THREE.Quaternion();
    this._prevPos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._delta = new THREE.Quaternion();
    this._pos = new THREE.Vector3();
    this._hasPrev = false;
    this._resetExposure = true;
    this._speed = 0;
    this._blur = new THREE.Vector2();
    this.exposureMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: EXPOSURE_FRAGMENT,
      uniforms: {
        tScene: { value: null },
        tPrev: { value: null },
        uMaxLod: { value: 10 },
        uDt: { value: 0.016 },
        uReset: { value: true },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        tScene: { value: null },
        tExposure: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uStrength: { value: 1 },
        uGlitch: { value: 0 },
        uSpeed: { value: 0 },
        uMotion: { value: 1 },
        uDebug: { value: 0 },
        uBlur: { value: new THREE.Vector2() },
        uLens: { value: new THREE.Vector2(BODYCAM_LOOK.lens.curvature, BODYCAM_LOOK.lens.overscan) },
        uSensor: { value: new THREE.Vector4(BODYCAM_LOOK.sensor.grain, BODYCAM_LOOK.sensor.fringe, BODYCAM_LOOK.sensor.bloom, BODYCAM_LOOK.sensor.sharpen) },
        uRecording: { value: new THREE.Vector4(BODYCAM_LOOK.recording.lines, BODYCAM_LOOK.recording.chromaLoss, BODYCAM_LOOK.recording.instability, BODYCAM_LOOK.recording.scan) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  _ensureTarget() {
    this.renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(this.size.x)), h = Math.max(1, Math.floor(this.size.y));
    if (this.target && this.target.width === w && this.target.height === h) return;
    this.target?.dispose();
    // Multisampled to match the screen. Mipmaps feed bloom and metering; the
    // depth/stencil resolve flags stay default so TransmissionRegion, which
    // only rescopes its own targets, ignores this one.
    this.target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: Math.min(4, this.renderer.capabilities.maxSamples), depthBuffer: true,
      generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.material.uniforms.tScene.value = this.target.texture;
    this.exposureMaterial.uniforms.tScene.value = this.target.texture;
    this.exposureMaterial.uniforms.uMaxLod.value = Math.floor(Math.log2(Math.max(w, h)));
    this.material.uniforms.uRes.value.set(w, h);
  }

  _motion(camera, dt) {
    camera.updateWorldMatrix(true, false);
    camera.getWorldQuaternion(this._quat);
    camera.getWorldPosition(this._pos);
    if (this._hasPrev && dt > 0) {
      this._delta.copy(this._prevQuat).invert().multiply(this._quat);
      const s = this._delta.w < 0 ? -1 : 1;
      const yaw = 2 * s * this._delta.y, pitch = 2 * s * this._delta.x;
      const vfov = THREE.MathUtils.degToRad(camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      // Angular velocity mapped to screen fraction, scaled by an ~1/70s shutter.
      const shutter = 1 / 70 / dt;
      const limit = 0.028;
      this._blur.set(
        THREE.MathUtils.clamp(-yaw / hfov * shutter, -limit, limit),
        THREE.MathUtils.clamp(pitch / vfov * shutter, -limit, limit),
      );
      // Teleports (floor change, respawn) must not read as running speed.
      const moved = this._pos.distanceTo(this._prevPos);
      const speed = moved < 3 ? moved / dt : 0;
      this._speed += (Math.min(speed / 9, 1) - this._speed) * (1 - Math.exp(-dt * 6));
    } else this._blur.set(0, 0);
    this._prevQuat.copy(this._quat);
    this._prevPos.copy(this._pos);
    this._hasPrev = true;
  }

  render(scene, camera, nowMs = 0) {
    if (!this.enabled) { this.reset(); this.renderer.render(scene, camera); return; }
    if (this._lastNow && nowMs - this._lastNow > 250) this.reset();
    const dt = this._lastNow ? THREE.MathUtils.clamp((nowMs - this._lastNow) / 1000, 0.001, 0.1) : 0.016;
    this._lastNow = nowMs;
    this._ensureTarget();
    this._motion(camera, dt);
    const r = this.renderer;
    const previousTarget = r.getRenderTarget();
    const autoReset = r.info.autoReset;
    if (autoReset) r.info.reset();
    r.info.autoReset = false;
    try {
      r.setRenderTarget(this.target);
      r.render(scene, camera);
      // Ease exposure toward the metered luminance (ping-pong 1x1 targets).
      const prev = this.exposureTargets[this.exposureIndex];
      this.exposureIndex ^= 1;
      const next = this.exposureTargets[this.exposureIndex];
      const eu = this.exposureMaterial.uniforms;
      eu.tPrev.value = prev.texture;
      eu.uDt.value = this.fixedTime === null ? dt : 0;
      eu.uReset.value = this._resetExposure;
      this.quad.material = this.exposureMaterial;
      r.setRenderTarget(next);
      r.render(this.scene, this.camera);
      this._resetExposure = false;
      r.setRenderTarget(previousTarget);
      this.quad.material = this.material;
      const u = this.material.uniforms;
      u.tExposure.value = next.texture;
      u.uTime.value = this.fixedTime ?? nowMs / 1000;
      u.uGlitch.value = this.reducedMotion ? 0 : this.glitch;
      u.uSpeed.value = this.reducedMotion ? 0 : this._speed;
      u.uMotion.value = this.reducedMotion ? 0 : 1;
      u.uDebug.value = this.debugMode;
      if (this.reducedMotion) u.uBlur.value.set(0, 0);
      else u.uBlur.value.copy(this._blur);
      r.render(this.scene, this.camera);
    } finally {
      this.quad.material = this.material;
      r.setRenderTarget(previousTarget);
      r.info.autoReset = autoReset;
    }
  }

  reset() {
    this._hasPrev = false;
    this._resetExposure = true;
    this._lastNow = 0;
    this._speed = 0;
    this._blur.set(0, 0);
  }

  setLook({ lens = {}, sensor = {}, recording = {} } = {}) {
    const u = this.material.uniforms;
    u.uLens.value.set(lens.curvature ?? BODYCAM_LOOK.lens.curvature, lens.overscan ?? BODYCAM_LOOK.lens.overscan);
    u.uSensor.value.set(sensor.grain ?? BODYCAM_LOOK.sensor.grain, sensor.fringe ?? BODYCAM_LOOK.sensor.fringe,
      sensor.bloom ?? BODYCAM_LOOK.sensor.bloom, sensor.sharpen ?? BODYCAM_LOOK.sensor.sharpen);
    u.uRecording.value.set(recording.lines ?? BODYCAM_LOOK.recording.lines, recording.chromaLoss ?? BODYCAM_LOOK.recording.chromaLoss,
      recording.instability ?? BODYCAM_LOOK.recording.instability, recording.scan ?? BODYCAM_LOOK.recording.scan);
  }

  diagnostics() {
    return {
      enabled: this.enabled, reducedMotion: this.reducedMotion,
      debugMode: this.debugMode, blur: this.material.uniforms.uBlur.value.toArray(),
      lens: this.material.uniforms.uLens.value.toArray(), sensor: this.material.uniforms.uSensor.value.toArray(),
      recording: this.material.uniforms.uRecording.value.toArray(),
      targets: this.target ? [
        { width: this.target.width, height: this.target.height, format: 'RGBA16F', samples: this.target.samples, mipmaps: true },
        ...this.exposureTargets.map(() => ({ width: 1, height: 1, format: 'RGBA16F' })),
      ] : [],
    };
  }

  dispose() {
    this.target?.dispose();
    this.exposureTargets.forEach(t => t.dispose());
    this.material.dispose();
    this.exposureMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
