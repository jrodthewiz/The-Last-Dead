import * as T from '../vendor/three.module.js';

// Shared planar reflection uniforms bound to wet Saint Orin streets, sidewalks
// and the coastal water material (Vesper Street / Mothlight architecture).
const fallbackTex = new T.DataTexture(new Uint8Array([24, 30, 34, 255]), 1, 1);
fallbackTex.needsUpdate = true;

export const planarReflUniforms = {
  tRefl: { value: fallbackTex },
  tReflBlur: { value: fallbackTex },
  uReflMatrix: { value: new T.Matrix4() },
  uReflTime: { value: 0 },
  uReflEnabled: { value: 1 },
};

const blurVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const blurFrag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  float ws = 0.0;
  for (int i = -4; i <= 4; i++) {
    float w = exp(-float(i * i) / 8.0);
    vec3 s = texture2D(tDiffuse, vUv + uDir * float(i)).rgb;
    if (any(isnan(s)) || any(isinf(s))) s = vec3(0.0);
    c += clamp(s, 0.0, 32.0) * w;
    ws += w;
  }
  gl_FragColor = vec4(c / max(ws, 0.001), 1.0);
}
`;

const BIAS = new T.Matrix4().set(
  0.5, 0.0, 0.0, 0.5,
  0.0, 0.5, 0.0, 0.5,
  0.0, 0.0, 0.5, 0.5,
  0.0, 0.0, 0.0, 1.0
);

export function createPlanarReflection(renderer, scene) {
  const mirrorCam = new T.PerspectiveCamera(74, 16 / 9, 0.1, 4800);
  const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsQuad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
  const fsScene = new T.Scene();
  fsScene.add(fsQuad);

  const blurMat = new T.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uDir: { value: new T.Vector2() },
    },
    vertexShader: blurVert,
    fragmentShader: blurFrag,
    depthTest: false,
    depthWrite: false,
  });

  let rt = null;
  let blurA = null;
  let blurB = null;
  let bw = 8;
  let bh = 8;
  let scale = 0.30;

  const setSize = (width, height, nextScale = scale) => {
    scale = nextScale;
    const w = Math.max(8, Math.floor(width * scale));
    const h = Math.max(8, Math.floor(height * scale));
    bw = Math.max(4, Math.floor(w * 0.5));
    bh = Math.max(4, Math.floor(h * 0.5));
    if (rt && rt.width === w && rt.height === h) return;
    rt?.dispose();
    blurA?.dispose();
    blurB?.dispose();
    const opts = {
      type: T.HalfFloatType,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      stencilBuffer: false,
    };
    rt = new T.WebGLRenderTarget(w, h, { ...opts, depthBuffer: true });
    blurA = new T.WebGLRenderTarget(bw, bh, { ...opts, depthBuffer: false });
    blurB = new T.WebGLRenderTarget(bw, bh, { ...opts, depthBuffer: false });
    planarReflUniforms.tRefl.value = rt.texture;
    planarReflUniforms.tReflBlur.value = blurB.texture;
  };

  const initialSize = renderer.getDrawingBufferSize(new T.Vector2());
  setSize(Math.max(64, initialSize.x || 1280), Math.max(64, initialSize.y || 720));

  const forward = new T.Vector3();
  const right = new T.Vector3();
  const mForward = new T.Vector3();
  const mRight = new T.Vector3();
  const mUp = new T.Vector3();
  const lookTarget = new T.Vector3();
  const lastCamPos = new T.Vector3(1e9, 1e9, 1e9);
  const lastCamQuat = new T.Quaternion();
  let lastPlaneY = NaN;
  let lastRenderAt = -Infinity;

  return {
    uniforms: planarReflUniforms,
    resize(quality = 'balanced') {
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      const s = quality === 'retro' ? 0.25 : 0.30;
      setSize(Math.max(64, size.x), Math.max(64, size.y), s);
    },
    update(camera, time, hide = [], force = false, allowAuto = true) {
      planarReflUniforms.uReflTime.value = time;
      if (!rt || !camera || !camera.isPerspectiveCamera) return;
      const planeY = camera.position.x > 340 ? 14.05 : 0.2;
      if (camera.position.y < planeY + 0.05) {
        planarReflUniforms.uReflEnabled.value = 0;
        return;
      }
      planarReflUniforms.uReflEnabled.value = 1;

      const now = performance.now();
      const moved = camera.position.distanceToSquared(lastCamPos) > 0.36;
      const turned = 2 * Math.acos(Math.min(1, Math.abs(camera.quaternion.dot(lastCamQuat)))) > 0.05;
      const planeChanged = planeY !== lastPlaneY;
      const movingDue = (moved || turned) && (now - lastRenderAt >= 65);
      const idleDue = now - lastRenderAt >= 450;
      const shouldRender = force || planeChanged || (allowAuto && (movingDue || idleDue));

      // Update projection matrix every call from current camera pose so parallax
      // stays locked even on skipped refresh frames.
      camera.updateMatrixWorld(true);
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

      mirrorCam.position.set(camera.position.x, 2 * planeY - camera.position.y, camera.position.z);
      mForward.set(forward.x, -forward.y, forward.z).normalize();
      mRight.set(right.x, -right.y, right.z).normalize();
      mUp.crossVectors(mRight, mForward).normalize();
      mirrorCam.up.copy(mUp);
      lookTarget.copy(mirrorCam.position).add(mForward);
      mirrorCam.lookAt(lookTarget);

      mirrorCam.fov = camera.fov;
      mirrorCam.aspect = camera.aspect;
      mirrorCam.near = Math.max(0.25, camera.near);
      mirrorCam.far = planeY > 10 ? 195 : 360;
      mirrorCam.updateProjectionMatrix();
      mirrorCam.updateMatrixWorld(true);

      planarReflUniforms.uReflMatrix.value
        .copy(BIAS)
        .multiply(mirrorCam.projectionMatrix)
        .multiply(mirrorCam.matrixWorldInverse);

      if (!shouldRender) return;
      lastRenderAt = now;
      lastCamPos.copy(camera.position);
      lastCamQuat.copy(camera.quaternion);
      lastPlaneY = planeY;

      const prevTarget = renderer.getRenderTarget();
      const prevAutoReset = renderer.info.autoReset;
      const savedVis = [];
      for (const item of hide) {
        if (!item) continue;
        if (item.cityOnly && planeY < 10) continue;
        const obj = item.obj || item;
        if (obj && obj.visible !== undefined) {
          savedVis.push([obj, obj.visible]);
          obj.visible = false;
        }
      }

      try {
        renderer.info.autoReset = false;
        renderer.setRenderTarget(rt);
        renderer.clear();
        renderer.render(scene, mirrorCam);

        fsQuad.material = blurMat;
        blurMat.uniforms.tDiffuse.value = rt.texture;
        blurMat.uniforms.uDir.value.set(1.0 / bw, 0);
        renderer.setRenderTarget(blurA);
        renderer.render(fsScene, fsCam);

        blurMat.uniforms.tDiffuse.value = blurA.texture;
        blurMat.uniforms.uDir.value.set(0, 2.2 / bh);
        renderer.setRenderTarget(blurB);
        renderer.render(fsScene, fsCam);
      } finally {
        for (const [obj, vis] of savedVis) obj.visible = vis;
        renderer.info.autoReset = prevAutoReset;
        renderer.setRenderTarget(prevTarget);
      }
    },
    dispose() {
      rt?.dispose();
      blurA?.dispose();
      blurB?.dispose();
      blurMat.dispose();
      fsQuad.geometry.dispose();
    },
  };
}
