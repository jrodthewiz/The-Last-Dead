import * as T from '../vendor/three.module.js';

// One 256²×8 RGBA array serves every modular world surface: RG = normal.xy,
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
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function noise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(wrap(xi, period), wrap(yi, period), seed);
  const b = hash2(wrap(xi + 1, period), wrap(yi, period), seed);
  const c = hash2(wrap(xi, period), wrap(yi + 1, period), seed);
  const d = hash2(wrap(xi + 1, period), wrap(yi + 1, period), seed);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

function ridge(x, y, period, seed = 0) {
  return 1 - Math.abs(noise(x, y, period, seed) * 2 - 1);
}

function surfaceSample(kind, u, v) {
  if (kind === 'brick') {
    const row = Math.floor(v * 10), fy = v * 10 - row, fx = (u * 5 + (row % 2) * .5) % 1;
    const joint = fx < .075 || fy < .115;
    const face = noise(u * 23, v * 23, 23, 17);
    const fine = noise(u * 47, v * 47, 47, 19);
    const h = (joint ? .18 : .66) + (face - .5) * .10 + (fine - .5) * .05;
    return { h, roughDelta: joint ? .12 : (face - .5) * .08, wear: joint ? .32 : .84 + (face - .5) * .16 };
  }
  if (kind === 'asphalt') {
    const agg = noise(u * 29, v * 29, 29, 23) * .55 + noise(u * 59, v * 59, 59, 29) * .45;
    const warpX = (noise(u * 5, v * 5, 5, 31) - .5) * .16;
    const warpY = (noise(u * 5 + 1.7, v * 5 + 2.3, 5, 37) - .5) * .16;
    const crackA = Math.pow(ridge((u + warpX) * 4, (v + warpY) * 4, 4, 41), 11);
    const crackB = Math.pow(ridge((u + warpY) * 7, (v - warpX) * 7, 7, 43), 13) * .75;
    const seam = Math.max(crackA, crackB);
    const h = .52 + (agg - .5) * .18 - seam * .26;
    return { h, roughDelta: (agg - .5) * .12 - seam * .10, wear: clamp01(.76 + (agg - .5) * .20 - seam * .50) };
  }
  if (kind === 'concrete') {
    const pan = noise(u * 7, v * 7, 7, 47);
    const grit = noise(u * 31, v * 31, 31, 53);
    const h = .50 + (pan - .5) * .10 + (grit - .5) * .07;
    return { h, roughDelta: (pan - .5) * .14 + (grit - .5) * .06, wear: .78 + (pan - .5) * .18 };
  }
  if (kind === 'wood') {
    const warp = noise(u * 3, v * 3, 3, 31) * 5.2;
    const grain = Math.sin(u * 75 + warp) * .5 + .5;
    const plankSeam = (u * 4) % 1 < .04 ? 1 : 0;
    const fine = noise(u * 19, v * 43, 43, 43);
    const h = .50 + (grain - .5) * .16 + (fine - .5) * .06 - plankSeam * .18;
    return { h, roughDelta: (grain - .5) * .14 + plankSeam * .18, wear: .82 + (grain - .5) * .15 - plankSeam * .35 };
  }
  if (kind === 'metal') {
    const rib = Math.sin(u * Math.PI * 10);
    const brushed = noise(u * 13, v * 79, 79, 61);
    const h = .50 + rib * .06 + (brushed - .5) * .04;
    return { h, roughDelta: (brushed - .5) * .10 - Math.max(0, rib) * .04, wear: .88 + (brushed - .5) * .16 };
  }
  if (kind === 'stone') {
    const strata = noise(u * 5, v * 9, 9, 83) * .55 + noise(u * 17, v * 23, 23, 89) * .30 + noise(u * 43, v * 43, 43, 97) * .15;
    const crack = Math.pow(ridge(u * 6, v * 6, 6, 99), 10) * .16;
    const h = .50 + (strata - .5) * .34 - crack;
    return { h, roughDelta: (strata - .5) * .12, wear: .70 + (strata - .5) * .26 - crack * .8 };
  }
  if (kind === 'plaster') {
    const trowel = noise(u * 13, v * 13, 13, 101) * .50 + noise(u * 31, v * 31, 31, 103) * .35 + noise(u * 67, v * 67, 67, 107) * .15;
    const h = .50 + (trowel - .5) * .22;
    return { h, roughDelta: (trowel - .5) * .12, wear: .78 + (trowel - .5) * .22 };
  }
  const gen = noise(u * 11, v * 11, 11, 109) * .55 + noise(u * 29, v * 29, 29, 113) * .32 + noise(u * 61, v * 61, 61, 127) * .13;
  return { h: .50 + (gen - .5) * .16, roughDelta: (gen - .5) * .10, wear: .76 + (gen - .5) * .18 };
}

const LAYER_SPEC = [
  { kind: 'plaster', rough: .80, wear: .70 },
  { kind: 'brick', rough: .86, wear: .72 },
  { kind: 'asphalt', rough: .88, wear: .66 },
  { kind: 'wood', rough: .60, wear: .82 },
  { kind: 'metal', rough: .28, wear: .92 },
  { kind: 'stone', rough: .88, wear: .68 },
  { kind: 'concrete', rough: .78, wear: .78 },
  { kind: 'generic', rough: .68, wear: .76 },
];

function buildNormalArray(specs, sampler, slopeScale = 2.4) {
  const count = specs.length;
  const data = new Uint8Array(SIZE * SIZE * count * 4);
  const h = new Float32Array(SIZE * SIZE);
  const roughs = new Float32Array(SIZE * SIZE);
  const wears = new Float32Array(SIZE * SIZE);
  for (let layer = 0; layer < count; layer++) {
    const spec = specs[layer];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        const s = sampler(spec.kind, x / SIZE, y / SIZE);
        h[idx] = s.h;
        roughs[idx] = clamp01(spec.rough + s.roughDelta);
        wears[idx] = clamp01(mix(spec.wear, s.wear, .75));
      }
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const l = h[y * SIZE + ((x + SIZE - 1) % SIZE)];
        const r = h[y * SIZE + ((x + 1) % SIZE)];
        const d = h[((y + SIZE - 1) % SIZE) * SIZE + x];
        const u = h[((y + 1) % SIZE) * SIZE + x];
        let nx = (l - r) * slopeScale;
        let ny = (d - u) * slopeScale;
        const inv = 1 / Math.hypot(nx, ny, 1);
        nx *= inv;
        ny *= inv;
        const i = ((layer * SIZE * SIZE) + y * SIZE + x) * 4;
        data[i] = Math.round((nx * .5 + .5) * 255);
        data[i + 1] = Math.round((ny * .5 + .5) * 255);
        data[i + 2] = Math.round(clamp01(Math.max(.14, roughs[y * SIZE + x])) * 255);
        data[i + 3] = Math.round(clamp01(Math.max(.22, wears[y * SIZE + x])) * 255);
      }
    }
  }
  const map = new T.DataArrayTexture(data, SIZE, SIZE, count);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 2;
  map.colorSpace = T.NoColorSpace;
  map.needsUpdate = true;
  return map;
}

function weaponSample(kind, u, v) {
  if (kind === 'walnut') {
    const flow = noise(u * 4, v * 4, 4, 211) * 3.8;
    const rings = Math.sin(u * 92 + flow) * .5 + .5;
    const pore = noise(u * 61, v * 23, 61, 223);
    const h = .50 + (rings - .5) * .16 + (pore - .5) * .08;
    return { h, roughDelta: (rings - .5) * .14 - (pore - .5) * .08, wear: .78 + (rings - .5) * .20 };
  }
  if (kind === 'steel') {
    const brush = noise(u * 13, v * 89, 89, 227) * .65 + noise(u * 29, v * 127, 127, 229) * .35;
    const edge = noise(u * 9, v * 9, 9, 233);
    const h = .50 + (brush - .5) * .09 + (edge - .5) * .04;
    return { h, roughDelta: (brush - .5) * .11 + (edge - .5) * .06, wear: .82 + (edge - .5) * .24 };
  }
  // brass / leather grip micro-detail
  const weave = Math.sin(u * Math.PI * 34) * Math.sin(v * Math.PI * 34) * .5 + .5;
  const pat = noise(u * 17, v * 17, 17, 239);
  const h = .50 + (weave - .5) * .12 + (pat - .5) * .09;
  return { h, roughDelta: (pat - .5) * .16 - (weave - .5) * .06, wear: .76 + (pat - .5) * .24 };
}

export const detailArrayTexture = buildNormalArray(LAYER_SPEC, surfaceSample, 2.4);
export const weaponDetailArray = buildNormalArray(
  [
    { kind: 'walnut', rough: .44, wear: .80 },
    { kind: 'steel', rough: .28, wear: .86 },
    { kind: 'grip', rough: .46, wear: .78 },
  ],
  weaponSample,
  2.2
);

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
 if(strength<=.001)return n;
 vec2 s=(d.xy*2.-1.)*.33*strength;
 vec3 a=abs(n);
 vec3 t;
 if(a.y>=a.x&&a.y>=a.z)t=vec3(n.y>=0.?1.:-1.,0.,0.);
 else if(a.x>=a.z)t=vec3(0.,0.,n.x>=0.?1.:-1.);
 else t=vec3(n.z>=0.?1.:-1.,0.,0.);
 t=normalize(t-n*dot(t,n));
 vec3 b=cross(n,t);
 return normalize(n+t*s.x+b*s.y);
}
`;

export function attachDetailUniforms(shader) {
  shader.uniforms.uDetailArray = { value: detailArrayTexture };
  shader.uniforms.uArtDebug = artDetailDebug;
}

// Crisp three-band Lambert key ramp with zero backface terminator inversion and
// luminous cool coastal sky fill vs warm bounce so shadowed faces stay legible.
export const toonLambertChunk = (() => {
  const source = T.ShaderChunk.lights_lambert_pars_fragment;
  const direct = `void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float ndl = dot( geometryNormal, directLight.direction );
	float aa = max( fwidth( ndl ), .008 );
	float b1 = smoothstep( .03 - aa, .03 + aa, ndl );
	float b2 = smoothstep( .36 - aa, .36 + aa, ndl );
	float b3 = smoothstep( .70 - aa, .70 + aa, ndl );
	float ramp = b1 * .42 + b2 * .34 + b3 * .28;
	vec3 tint = mix( vec3( .90, .95, 1.00 ), vec3( .99, 1.00, 1.02 ), b2 * .65 + b3 * .35 );
	reflectedLight.directDiffuse += ramp * directLight.color * BRDF_Lambert( material.diffuseColor * tint );
}`;
  const indirect = `void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 upView = normalize( ( viewMatrix * vec4( 0., 1., 0., 0. ) ).xyz );
	float upness = clamp( dot( geometryNormal, upView ) * .5 + .5, 0., 1. );
	vec3 hemiTint = mix( vec3( .80, .86, .92 ), vec3( .92, 1.00, 1.08 ), upness );
	reflectedLight.indirectDiffuse += irradiance * 1.24 * BRDF_Lambert( material.diffuseColor * hemiTint );
}`;
  return source
    .replace(/void RE_Direct_Lambert\([^)]*\) \{[\s\S]*?\n\}/, direct)
    .replace(/void RE_IndirectDiffuse_Lambert\([^)]*\) \{[\s\S]*?\n\}/, indirect);
})();

const WEAPON_PRESETS = {
  steel: { layer: 1, metal: .80, rough: .28, norm: .28, tint: [.84, .90, .95], uv: 14.0 },
  edge:  { layer: 1, metal: .88, rough: .22, norm: .20, tint: [.95, .96, .92], uv: 16.0 },
  brass: { layer: 2, metal: .85, rough: .30, norm: .24, tint: [1.00, .85, .52], uv: 14.0 },
  wood:  { layer: 0, metal: .04, rough: .44, norm: .30, tint: [.86, .72, .54], uv: 11.0 },
  panel: { layer: 2, metal: .25, rough: .50, norm: .22, tint: [.68, .74, .72], uv: 13.0 },
  cloth: { layer: 2, metal: .00, rough: .88, norm: .06, tint: [.75, .82, .84], uv: 16.0 },
  glove: { layer: 2, metal: .00, rough: .80, norm: .12, tint: [.78, .74, .65], uv: 18.0 },
};

// First-person weapon hero finish: object-space dominant-axis walnut/steel/brass
// DataArrayTexture, stepped 3-band specular, metallic Fresnel coastal sky
// sheen and rim separation. Uniform-driven so all weapons add at most +2 programs.
export function paintWeaponHero(material, role = 'steel') {
  if (!material || material.userData.weaponHeroStyled) return material;
  if (material.transparent || material.opacity < .99 || material.emissive?.getHex?.() !== 0) return material;
  const preset = WEAPON_PRESETS[role] || WEAPON_PRESETS.steel;
  material.userData.weaponHeroStyled = role;
  material.userData.weaponHeroParams = [preset.layer, preset.metal, preset.rough, preset.norm];
  material.userData.weaponHeroTint = [...preset.tint];
  material.userData.weaponHeroUv = preset.uv;
  material.userData.artDebug = artDetailDebug;

  const isPhysical = !!(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : () => '';

  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    const p = this.userData.weaponHeroParams || [1, .8, .28, .25];
    const t = this.userData.weaponHeroTint || [.84, .90, .95];
    shader.uniforms.uWeaponDetailArray = { value: weaponDetailArray };
    shader.uniforms.uWeaponParams = { value: new T.Vector4(p[0], p[1], p[2], p[3]) };
    shader.uniforms.uWeaponSpecTint = { value: new T.Vector3(t[0], t[1], t[2]) };
    shader.uniforms.uWeaponUvScale = { value: this.userData.weaponHeroUv ?? 14.0 };
    shader.uniforms.uArtDebug = artDetailDebug;

    shader.vertexShader = 'varying vec3 vWeaponLocal;\nvarying vec3 vWeaponObjN;\nvarying vec3 vWeaponBX;\nvarying vec3 vWeaponBY;\nvarying vec3 vWeaponBZ;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vWeaponLocal = position;
vWeaponObjN = normalize(normal);
vWeaponBX = normalize((modelViewMatrix * vec4(1., 0., 0., 0.)).xyz);
vWeaponBY = normalize((modelViewMatrix * vec4(0., 1., 0., 0.)).xyz);
vWeaponBZ = normalize((modelViewMatrix * vec4(0., 0., 1., 0.)).xyz);`
    );

    shader.fragmentShader = `varying vec3 vWeaponLocal;
varying vec3 vWeaponObjN;
varying vec3 vWeaponBX;
varying vec3 vWeaponBY;
varying vec3 vWeaponBZ;
uniform sampler2DArray uWeaponDetailArray;
uniform vec4 uWeaponParams;
uniform vec3 uWeaponSpecTint;
uniform float uWeaponUvScale;
uniform float uArtDebug;
` + shader.fragmentShader;

    if (!isPhysical) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>', toonLambertChunk);
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 wRawCross = cross(dFdx(vWeaponLocal), dFdy(vWeaponLocal));
vec3 wObjN = dot(wRawCross, wRawCross) > 1e-10 ? normalize(wRawCross) : normalize(vWeaponObjN);
vec3 wAbs = abs(wObjN);
vec2 wUv = wAbs.y >= wAbs.x && wAbs.y >= wAbs.z ? vWeaponLocal.xz : (wAbs.x >= wAbs.z ? vWeaponLocal.zy : vWeaponLocal.xy);
vec4 wTap = texture(uWeaponDetailArray, vec3(wUv * uWeaponUvScale, uWeaponParams.x));
float wMetal = clamp(uWeaponParams.y * (.78 + .22 * wTap.a), 0., 1.);
float wRough = clamp(uWeaponParams.z + (wTap.b - .45) * .22, .12, .96);
diffuseColor.rgb *= mix(1., .60, wMetal) * (.90 + wTap.a * .16);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
vec2 wSlope = (wTap.xy * 2. - 1.) * .33 * uWeaponParams.w;
vec3 wTObj = wAbs.y >= wAbs.x && wAbs.y >= wAbs.z ? vec3(wObjN.y >= 0. ? 1. : -1., 0., 0.) : (wAbs.x >= wAbs.z ? vec3(0., 0., wObjN.x >= 0. ? 1. : -1.) : vec3(wObjN.z >= 0. ? 1. : -1., 0., 0.));
wTObj = normalize(wTObj - wObjN * dot(wTObj, wObjN));
vec3 wBObj = cross(wObjN, wTObj);
vec3 wTView = normalize(wTObj.x * vWeaponBX + wTObj.y * vWeaponBY + wTObj.z * vWeaponBZ);
vec3 wBView = normalize(wBObj.x * vWeaponBX + wBObj.y * vWeaponBY + wBObj.z * vWeaponBZ);
wTView = normalize(wTView - normal * dot(wTView, normal));
wBView = normalize(wBView - normal * dot(wBView, normal));
normal = normalize(normal + wTView * wSlope.x + wBView * wSlope.y);`
    );

    const outTarget = isPhysical
      ? 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;'
      : 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';

    shader.fragmentShader = shader.fragmentShader.replace(
      outTarget,
      `${outTarget}
vec3 wV = normalize(vViewPosition);
float wFres = pow(1. - saturate(dot(normal, wV)), 3.2);
vec3 wUpView = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);
vec3 wRefl = reflect(-wV, normal);
float wSkyMix = clamp(dot(wRefl, wUpView) * .5 + .5, 0., 1.);
vec3 wEnvColor = mix(vec3(.14, .18, .21), vec3(.74, .84, .90), wSkyMix);
outgoingLight += wEnvColor * mix(diffuseColor.rgb, uWeaponSpecTint, .55) * wMetal * (1. - wRough * .72) * (.22 + .78 * wFres) * .56;
outgoingLight += mix(vec3(.04, .055, .065), uWeaponSpecTint * .18, wMetal) * wFres;
#if NUM_DIR_LIGHTS > 0
vec3 wL = normalize(directionalLights[0].direction);
vec3 wH = normalize(wV + wL);
float wNdl = saturate(dot(normal, wL));
float wSpec = pow(saturate(dot(normal, wH)), mix(10., 68., 1. - wRough));
float wBand = step(.22, wSpec) * .35 + step(.52, wSpec) * .40 + step(.80, wSpec) * .45;
vec3 wSpecCol = mix(vec3(.32, .36, .38), uWeaponSpecTint * .98, wMetal);
outgoingLight += directionalLights[0].color * wSpecCol * wBand * (.20 + .80 * wNdl) * (1. - wRough * .55) * mix(.45, 1.15, wMetal);
#endif
vec3 wNormalWorld = normalize((vec4(normal, 0.) * viewMatrix).xyz);
if (uArtDebug > .5 && uArtDebug < 1.5) outgoingLight = wNormalWorld * .5 + .5;
else if (uArtDebug > 1.5 && uArtDebug < 2.5) outgoingLight = vec3(pow(clamp(wRough, 0., 1.), 2.2));`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
gl_FragColor.a = .90;`
    );
  };

  const suffix = isPhysical ? '-weapon-hero-std-v2' : '-weapon-hero-lambert-v2';
  material.customProgramCacheKey = () => previousKey() + suffix;
  material.needsUpdate = true;
  return material;
}

const ENTITY_PRESETS = {
  zombie:   { params: [.24, .56, .00, .88], rim: [.68, .80, .86] },
  survivor: { params: [.24, .42, .00, .86], rim: [.76, .84, .88] },
  vehicle:  { params: [.08, .28, .44, .22], rim: [.72, .80, .86] },
  wreck:    { params: [.10, .18, .18, .60], rim: [.52, .60, .64] },
};

// Lightweight wrap/rim/clearcoat pass for characters and vehicles: no normal
// maps (~8 ALU), uniform-driven so all variants share two cache keys max.
export function paintStylizedEntity(material, mode = 'zombie') {
  if (!material || material.transparent || material.opacity < .99) return material;
  const preset = ENTITY_PRESETS[mode] || ENTITY_PRESETS.zombie;
  material.userData.entityParams = [...preset.params];
  material.userData.entityRimColor = [...preset.rim];
  if (material.userData.entityStyled) return material;
  material.userData.entityStyled = mode;

  const isPhysical = !!(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial);
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey ? material.customProgramCacheKey.bind(material) : () => '';

  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    const ep = this.userData.entityParams || preset.params;
    const er = this.userData.entityRimColor || preset.rim;
    shader.uniforms.uEntityParams = { value: new T.Vector4(ep[0], ep[1], ep[2], ep[3]) };
    shader.uniforms.uEntityRimColor = { value: new T.Vector3(er[0], er[1], er[2]) };

    shader.fragmentShader = 'uniform vec4 uEntityParams;\nuniform vec3 uEntityRimColor;\n' + shader.fragmentShader;
    const outTarget = isPhysical
      ? 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;'
      : 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';

    shader.fragmentShader = shader.fragmentShader.replace(
      outTarget,
      `${outTarget}
vec3 eV = normalize(vViewPosition);
float eFres = pow(1. - saturate(dot(normal, eV)), 2.8);
#if NUM_DIR_LIGHTS > 0
vec3 eL = normalize(directionalLights[0].direction);
float eWrap = saturate(dot(normal, eL) * .5 + .5);
float eRimMask = mix(.45, 1., saturate(dot(normal, eL) * .5 + .5));
outgoingLight += directionalLights[0].color * diffuseColor.rgb * eWrap * uEntityParams.x * .34;
outgoingLight += uEntityRimColor * eFres * eRimMask * uEntityParams.y * .42;
if (uEntityParams.z > .01) {
 vec3 eH = normalize(eV + eL);
 float eSpec = pow(saturate(dot(normal, eH)), mix(12., 56., 1. - uEntityParams.w));
 float eBand = step(.28, eSpec) * .45 + step(.64, eSpec) * .55;
 outgoingLight += directionalLights[0].color * vec3(.84, .90, .92) * eBand * uEntityParams.z * (.25 + .75 * saturate(dot(normal, eL)));
}
#endif`
    );
  };

  const suffix = isPhysical ? '-stylized-entity-std-v1' : '-stylized-entity-lambert-v1';
  material.customProgramCacheKey = () => previousKey() + suffix;
  material.needsUpdate = true;
  return material;
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
    value *= 1 - .14 * Math.max(0, -ny);
    value *= 1 + .05 * Math.max(0, ny);
    ao[i] = Math.min(1, Math.max(.58, value));
  }
  geometry.setAttribute('artAO', new T.BufferAttribute(ao, 1));
  return geometry;
}

// Provide valid AO and UV attributes on custom foliage shapes so fronds/tufts
// darken near the root crown and highlight smoothly toward outer tips.
export function bakeFoliageAO(geometry) {
  const position = geometry.attributes.position;
  if (!position) return geometry;
  const count = position.count;
  const ao = new Float32Array(count);
  let maxY = .5, maxR = .5;
  for (let i = 0; i < count; i++) {
    maxY = Math.max(maxY, position.getY(i));
    maxR = Math.max(maxR, Math.hypot(position.getX(i), position.getZ(i)));
  }
  for (let i = 0; i < count; i++) {
    const h = Math.min(1, Math.max(0, position.getY(i) / maxY));
    const r = Math.min(1, Math.hypot(position.getX(i), position.getZ(i)) / maxR);
    ao[i] = Math.min(1, .68 + .20 * h + .14 * r);
  }
  geometry.setAttribute('artAO', new T.BufferAttribute(ao, 1));
  if (!geometry.attributes.uv) {
    const uv = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      uv[i * 2] = position.getX(i) * .5 + .5;
      uv[i * 2 + 1] = Math.min(1, Math.max(0, position.getY(i) / maxY));
    }
    geometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  }
  return geometry;
}
