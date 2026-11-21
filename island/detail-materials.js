import * as T from '../vendor/three.module.js';

// Shared, procedural detail surfaces for the island renderer. One normal atlas
// and one packed ARM atlas are reused by every architectural and ground draw:
// no per-asset tangents, no extra render pass, no texture downloads.
const SIZE = 512;
const NORMAL_STRENGTH = 5.2;

function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const wrap = (v, p) => ((v % p) + p) % p;
const mix = (a, b, t) => a + (b - a) * t;
function noise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(wrap(xi, period), wrap(yi, period), seed);
  const b = hash2(wrap(xi + 1, period), wrap(yi, period), seed);
  const c = hash2(wrap(xi, period), wrap(yi + 1, period), seed);
  const d = hash2(wrap(xi + 1, period), wrap(yi + 1, period), seed);
  return mix(mix(a, b, u), mix(c, d, u), v);
}
function height(u, v) {
  let h = .5;
  h += (noise(u * 7, v * 7, 7, 11) - .5) * .30;
  h += (noise(u * 17, v * 17, 17, 23) - .5) * .22;
  h += (noise(u * 37, v * 37, 37, 47) - .5) * .13;
  h += (noise(u * 79, v * 79, 79, 71) - .5) * .065;
  h += (noise(u * 151, v * 151, 151, 101) - .5) * .028;
  // Shallow mineral cracks: a narrow dark groove, not a closed contour.
  const groove = 1 - Math.min(1, Math.abs(noise(u * 7 + .13, v * 7 - .29, 7, 91) - .5) / .045);
  h -= groove * .14;
  return h;
}

function makeNormalAtlas() {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const h = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = height(x / SIZE, y / SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const l = h[y * SIZE + ((x + SIZE - 1) % SIZE)], r = h[y * SIZE + ((x + 1) % SIZE)];
    const d = h[((y + SIZE - 1) % SIZE) * SIZE + x], u = h[((y + 1) % SIZE) * SIZE + x];
    let nx = (l - r) * NORMAL_STRENGTH, ny = (d - u) * NORMAL_STRENGTH, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz);
    const i = (y * SIZE + x) * 4;
    data[i] = Math.round((nx * inv * .5 + .5) * 255);
    data[i + 1] = Math.round((ny * inv * .5 + .5) * 255);
    data[i + 2] = Math.round((nz * inv * .5 + .5) * 255);
    data[i + 3] = 255;
  }
  const map = new T.DataTexture(data, SIZE, SIZE, T.RGBAFormat);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = 4; map.colorSpace = T.NoColorSpace; map.needsUpdate = true;
  return map;
}

function makeArmAtlas() {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE, h = height(u, v);
    const broad = noise(u * 5, v * 5, 5, 131), fine = noise(u * 39, v * 39, 39, 151);
    const cavity = Math.max(0, .52 - h);
    const ao = Math.min(1, Math.max(.28, .82 + h * .22 - cavity * .7));
    const rough = Math.min(.98, Math.max(.32, .62 + (1 - h) * .22 + (fine - .5) * .16));
    // B is a metal/polish potential, not a global metalness. The shader gates
    // it by material role so plaster and brick never turn into chrome.
    const metal = Math.min(1, Math.max(.04, .12 + broad * .34 + (1 - h) * .18));
    const i = (y * SIZE + x) * 4;
    data[i] = Math.round(ao * 255); data[i + 1] = Math.round(rough * 255);
    data[i + 2] = Math.round(metal * 255); data[i + 3] = 255;
  }
  const map = new T.DataTexture(data, SIZE, SIZE, T.RGBAFormat);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = 4; map.colorSpace = T.NoColorSpace; map.needsUpdate = true;
  return map;
}

export const detailNormalTexture = makeNormalAtlas();
export const detailArmTexture = makeArmAtlas();
export const artDetailDebug = { value: 0 };

export const DETAIL_PARS = `
uniform sampler2D uDetailNormal;
uniform sampler2D uDetailARM;
uniform float uArtDebug;
vec3 artTriNormal(vec3 p,vec3 n,float scale){
 vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),.0001);
 vec3 tx=texture2D(uDetailNormal,p.zy*scale).xyz*2.-1.;
 vec3 ty=texture2D(uDetailNormal,p.xz*scale).xyz*2.-1.;
 vec3 tz=texture2D(uDetailNormal,p.xy*scale).xyz*2.-1.;
 return normalize(vec3(tx.z,tx.y,tx.x)*w.x+vec3(ty.x,ty.z,ty.y)*w.y+vec3(tz.x,tz.y,tz.z)*w.z);
}
vec3 artDetailNormal(vec3 p,vec3 n){
 vec3 base=normalize(n);
 float dist=length(cameraPosition-p);
 float aa=max(fwidth(p.x),max(fwidth(p.y),fwidth(p.z)));
 float fade=(1.-smoothstep(10.,16.,dist))*(1.-smoothstep(.025,.085,aa));
 vec3 lo=artTriNormal(p,base,.455);
 vec3 hi=artTriNormal(p,base,1.818);
 return normalize(base+(lo-base)*.18+(hi-base)*.45*fade);
}
vec3 artTriArm(vec3 p,vec3 n){
 vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),.0001);
 return texture2D(uDetailARM,p.zy*.455).rgb*w.x+texture2D(uDetailARM,p.xz*.455).rgb*w.y+texture2D(uDetailARM,p.xy*.455).rgb*w.z;
}
`;

export function attachDetailUniforms(shader) {
  shader.uniforms.uDetailNormal = { value: detailNormalTexture };
  shader.uniforms.uDetailARM = { value: detailArmTexture };
  shader.uniforms.uArtDebug = artDetailDebug;
}

// Cheap local-space occlusion baked into the shared primitive geometries.
// It darkens lower faces and undersides without another texture or draw.
export function bakeLocalAO(geometry) {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  if (!position || !normal) return geometry;
  const ao = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), ny = normal.getY(i);
    let value = .82 + .18 * Math.min(1, Math.max(0, y + .5));
    value *= 1 - .16 * Math.max(0, -ny);
    value *= 1 + .04 * Math.max(0, ny);
    ao[i] = Math.min(1, Math.max(.50, value));
  }
  geometry.setAttribute('artAO', new T.BufferAttribute(ao, 1));
  return geometry;
}
