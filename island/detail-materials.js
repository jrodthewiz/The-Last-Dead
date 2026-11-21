import * as T from '../vendor/three.module.js';

// One 256² RGBA array serves every modular surface: RG = normal.xy,
// B = roughness, A = wear/micro-AO. Dominant-axis projection means one tap,
// no per-asset tangents and no material splitting.
const SIZE = 256;
const LAYERS = 8;
const TILE_METRES = 2.2;

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
function surfaceHeight(kind, u, v) {
  if (kind === 'brick') {
    const row = Math.floor(v * 12), fy = v * 12 - row, fx = (u * 6 + (row % 2) * .5) % 1;
    const joint = fx < .055 || fy < .09;
    return (joint ? .34 : .61) + (noise(u * 31, v * 31, 31, 17) - .5) * .07;
  }
  if (kind === 'wood') {
    return .50 + Math.sin(u * 78 + noise(u * 3, v * 3, 3, 31) * 5.5) * .095 + (noise(u * 17, v * 41, 41, 43) - .5) * .06;
  }
  if (kind === 'metal') {
    return .50 + Math.sin(v * 150) * .028 + (noise(u * 53, v * 19, 53, 61) - .5) * .035;
  }
  if (kind === 'wet') {
    return .50 + (noise(u * 7, v * 7, 7, 73) - .5) * .12 + (noise(u * 29, v * 29, 29, 79) - .5) * .035;
  }
  if (kind === 'stone') {
    return .50 + (noise(u * 5, v * 5, 5, 83) - .5) * .30 + (noise(u * 17, v * 17, 17, 89) - .5) * .17 + (noise(u * 47, v * 47, 47, 97) - .5) * .08;
  }
  if (kind === 'plaster') {
    return .50 + (noise(u * 9, v * 9, 9, 101) - .5) * .16 + (noise(u * 23, v * 23, 23, 103) - .5) * .09 + (noise(u * 61, v * 61, 61, 107) - .5) * .04;
  }
  return .50 + (noise(u * 13, v * 13, 13, 109) - .5) * .18 + (noise(u * 37, v * 37, 37, 113) - .5) * .10 + (noise(u * 79, v * 79, 79, 127) - .5) * .04;
}

const LAYER_SPEC = [
  { kind: 'plaster', rough: .82, wear: .64 },
  { kind: 'brick', rough: .86, wear: .70 },
  { kind: 'asphalt', rough: .92, wear: .56 },
  { kind: 'wood', rough: .68, wear: .80 },
  { kind: 'metal', rough: .32, wear: .92 },
  { kind: 'stone', rough: .93, wear: .62 },
  { kind: 'wet', rough: .42, wear: .95 },
  { kind: 'generic', rough: .78, wear: .74 },
];

function makeDetailArray() {
  const data = new Uint8Array(SIZE * SIZE * LAYERS * 4);
  for (let layer = 0; layer < LAYERS; layer++) {
    const spec = LAYER_SPEC[layer], h = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = surfaceHeight(spec.kind, x / SIZE, y / SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const l = h[y * SIZE + ((x + SIZE - 1) % SIZE)], r = h[y * SIZE + ((x + 1) % SIZE)];
      const d = h[((y + SIZE - 1) % SIZE) * SIZE + x], u = h[((y + 1) % SIZE) * SIZE + x];
      let nx = (l - r) * 2.6, ny = (d - u) * 2.6, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv;
      const fine = noise(x / SIZE * 43, y / SIZE * 43, 43, 137);
      const rough = Math.min(.99, Math.max(.18, spec.rough + (fine - .5) * .08));
      const wear = Math.min(1, Math.max(.25, spec.wear + (noise(x / SIZE * 11, y / SIZE * 11, 11, 139) - .5) * .22));
      const i = ((layer * SIZE * SIZE) + y * SIZE + x) * 4;
      data[i] = Math.round((nx * .5 + .5) * 255);
      data[i + 1] = Math.round((ny * .5 + .5) * 255);
      data[i + 2] = Math.round(rough * 255);
      data[i + 3] = Math.round(wear * 255);
    }
  }
  const map = new T.DataArrayTexture(data, SIZE, SIZE, LAYERS);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.anisotropy = 2; map.colorSpace = T.NoColorSpace; map.needsUpdate = true;
  return map;
}

export const detailArrayTexture = makeDetailArray();
export const artDetailDebug = { value: 0 };
export const ART_DETAIL_TILE = TILE_METRES;

export const DETAIL_PARS = `
uniform sampler2DArray uDetailArray;
uniform float uArtDebug;
vec2 artDetailUv(vec3 p,vec3 n){
 vec3 a=abs(n);
 if(a.y>=a.x&&a.y>=a.z)return p.xz;
 if(a.x>=a.z)return p.zy;
 return p.xy;
}
vec4 artDetailTap(vec3 p,vec3 n,float layer,float fade){
 if(fade<=.001)return vec4(.5,.5,.75,.8);
 return texture(uDetailArray,vec3(artDetailUv(p,n)*.455,layer));
}
vec3 artApplyDetail(vec3 n,vec4 d,float strength){
 vec2 s=(d.xy*2.-1.)*.35*strength;
 vec3 a=abs(n);
 if(a.y>=a.x&&a.y>=a.z)return normalize(vec3(s.x*sign(n.y),n.y,s.y*sign(n.y)));
 if(a.x>=a.z)return normalize(vec3(n.x,s.y*sign(n.x),s.x*sign(n.x)));
 return normalize(vec3(s.x*sign(n.z),s.y*sign(n.z),n.z));
}
`;

export function attachDetailUniforms(shader) {
  shader.uniforms.uDetailArray = { value: detailArrayTexture };
  shader.uniforms.uArtDebug = artDetailDebug;
}

// Keep the existing Lambert diffuse but replace its smooth N.L with a printed
// three-band ramp. Warm band on the lit side, cool tint through the indirect
// term; no material subclass, no extra draw.
export const toonLambertChunk = (() => {
  const source = T.ShaderChunk.lights_lambert_pars_fragment;
  const direct = `void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float ndl = dot( geometryNormal, directLight.direction );
	float aa = max( fwidth( ndl ), .002 );
	float ramp = .30;
	ramp += smoothstep( .05 - aa, .05 + aa, ndl ) * .25;
	ramp += smoothstep( .45 - aa, .45 + aa, ndl ) * .45;
	vec3 tint = mix( vec3( .74, .85, 1.0 ), vec3( 1.06, 1.0, .86 ), ramp );
	reflectedLight.directDiffuse += ramp * directLight.color * BRDF_Lambert( material.diffuseColor * tint );
}`;
  const indirect = `void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor * vec3( .84, .92, 1.0 ) );
}`;
  return source
    .replace(/void RE_Direct_Lambert\([^)]*\) \{[\s\S]*?\n\}/, direct)
    .replace(/void RE_IndirectDiffuse_Lambert\([^)]*\) \{[\s\S]*?\n\}/, indirect);
})();

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
