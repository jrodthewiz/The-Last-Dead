import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

// Plan 1.3 F.6 — sweep a thin 2D cross-section along a 3D spine so a curved
// form (hooked blade, handle) reads correctly from EVERY camera angle, not just
// the reference angle a flat extrude happens to match. Uses ExtrudeGeometry's
// native extrudePath; bevelEnabled: false keeps sharp tips (same rule as F.5).
function buildCurveSweepGeometry(
  sweep: { spine: [number, number, number][]; crossSection: { points: [number, number][] }; closed?: boolean },
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const cs = sweep.crossSection.points;
  if (cs.length > 0) {
    shape.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < cs.length; i += 1) shape.lineTo(cs[i][0], cs[i][1]);
    shape.closePath();
  }
  const spine = sweep.spine.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(spine, sweep.closed ?? false);
  return new THREE.ExtrudeGeometry(shape, {
    extrudePath: path,
    steps: Math.max(24, spine.length * 8),
    bevelEnabled: false,
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const [red, green, blue] = hexToRgb(source);
  return new THREE.Color(red / 255, green / 255, blue / 255);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Black Gullet Story Threshold
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createBlackGulletStoryThresholdModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Black Gullet Story Threshold";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"view": "primary frontal approach", "projection": "perspective concept render", "sourceImage": "assets/concepts/black-gullet-concept-v01.png", "confidence": 0.92}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["dark-basalt"] = createSculptMaterial(
    "dark-basalt",
    {"id": "dark-basalt", "name": "Charcoal fracture basalt", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#241E23", "color": "#241E23", "albedo": {"dominant": "#241E23", "secondary": ["#3A3333", "#524948"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#241E23", "#3A3333", "#524948"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.91, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.015, "variation": 0.015}, "normal": {"pattern": "multi-scale chipped mineral relief", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture."},
    options
  );
  materialMap["warm-bone"] = createSculptMaterial(
    "warm-bone",
    {"id": "warm-bone", "name": "Warm ivory load-bearing bone", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#B9A88A", "color": "#B9A88A", "albedo": {"dominant": "#B9A88A", "secondary": ["#D1C1A1", "#766855"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#B9A88A", "#D1C1A1", "#766855"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.86, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.01, "variation": 0.015}, "normal": {"pattern": "axial porous grooves and broad soft ridges", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture."},
    options
  );
  materialMap["aged-bronze"] = createSculptMaterial(
    "aged-bronze",
    {"id": "aged-bronze", "name": "Worn bronze clamps", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#704F34", "color": "#704F34", "albedo": {"dominant": "#704F34", "secondary": ["#96734A", "#3D2B22"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#704F34", "#96734A", "#3D2B22"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.48, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.64, "variation": 0.1}, "normal": {"pattern": "shallow tool marks and softened raised lips", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture.", "clearcoat": 0.08},
    options
  );
  materialMap["oxblood-web"] = createSculptMaterial(
    "oxblood-web",
    {"id": "oxblood-web", "name": "Opaque dark oxblood fibers", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#3D151D", "color": "#3D151D", "albedo": {"dominant": "#3D151D", "secondary": ["#641F29", "#210D12"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#3D151D", "#641F29", "#210D12"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.72, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.015, "variation": 0.015}, "normal": {"pattern": "thin strand ridges with sparse damp edges", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture.", "clearcoat": 0.06},
    options
  );
  materialMap["tendon-rubber"] = createSculptMaterial(
    "tendon-rubber",
    {"id": "tendon-rubber", "name": "Dark red-brown tendon cable", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#431820", "color": "#431820", "albedo": {"dominant": "#431820", "secondary": ["#63252B", "#241014"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#431820", "#63252B", "#241014"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.66, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.02, "variation": 0.015}, "normal": {"pattern": "longitudinal cable ribs", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture."},
    options
  );
  materialMap["ember-light"] = createSculptMaterial(
    "ember-light",
    {"id": "ember-light", "name": "Low-area amber votive", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#D99137", "color": "#D99137", "albedo": {"dominant": "#D99137", "secondary": ["#F5B64A", "#652716"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#D99137", "#F5B64A", "#652716"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.4, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.02, "variation": 0.015}, "normal": {"pattern": "small soft emissive core", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture.", "emissive": "#A74615", "emissiveIntensity": 1.35},
    options
  );
  materialMap["damp-basalt"] = createSculptMaterial(
    "damp-basalt",
    {"id": "damp-basalt", "name": "Localized damp stone response", "type": "standard", "shaderModel": "MeshStandardMaterial with authored procedural surface fields", "baseColor": "#1C1819", "color": "#1C1819", "albedo": {"dominant": "#1C1819", "secondary": ["#33292A", "#52413A"], "samplingNotes": "Palette manually checked against local concept crops; visual tuning estimate, not recovered spectral albedo."}, "colorVariation": {"palette": ["#1C1819", "#33292A", "#52413A"], "pattern": "layered-world-space-mottle", "amplitude": 0.16, "heightCorrelation": 0.38}, "textureResolution": 1024, "textureProjection": {"mode": "world-space-procedural", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Keep authored noise stable in world units; do not tile the concept view."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.28, "role": "broad value zones"}, {"id": "meso", "frequency": 9, "amplitude": 0.18, "role": "fracture, pores, or ridges"}, {"id": "micro", "frequency": 38, "amplitude": 0.065, "role": "grazing highlight breakup"}], "roughness": {"base": 0.79, "variation": 0.12, "map": "independent-procedural-field", "localResponse": "cavities stay rough; narrow damp wear may lower roughness locally"}, "metalness": {"base": 0.01, "variation": 0.015}, "normal": {"pattern": "subtle wet-edge normal variation", "strength": 0.24, "scale": 22, "space": "tangent"}, "bump": {"pattern": "independent-meso-height-field", "amplitude": 0.018, "scale": 18}, "displacement": {"pattern": "none; silhouette relief is explicit geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"cavityStrength": 0.42, "contactShadowBias": 0.24, "notes": "Darken block joints, rib sockets, clamp undercuts, and ground contacts."}, "wear": {"edgeWear": 0.24, "scratches": ["short axial bone scoring"], "chips": ["isolated exposed basalt facets"]}, "dirt": {"amount": 0.22, "cavityBias": 0.78, "color": "#1B1315"}, "localOverrides": [{"id": "narrow-damp-streaks", "name": "Narrow damp floor streaks", "roughness": 0.27, "description": "Broken low-roughness streaks at the outside feet; center route stays matte and clear.", "evidenceRefs": ["zone-r3c1"], "scale": "micro", "realization": "material-local-override"}], "shaderNotes": ["Albedo, roughness, normal, and AO stay independent.", "Review under neutral and grazing light before tuning."], "notes": "Authored values from the inspected concept; no unreviewed crop map is used as a tileable runtime texture."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Black Gullet Story Threshold__pivot";
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Black Gullet Story Threshold", "level": "macro", "role": "static-architecture-root", "importance": 1, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "An assembled arch frames a large negative opening instead of closing it with a portal panel.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": null, "attachment": null, "dimensions": {"width": 8.14, "height": 6.35, "depth": 4.86, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "warm-bone", "aged-bronze", "oxblood-web", "tendon-rubber", "ember-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "dark-clear-walk-through", "name": "dark clear walk through", "description": "Tall dark center remains physically and visually clear across the F5 standing lane.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["StoryLandmark_f5-last-altar"], "evidenceRefs": ["full-object"]}, {"id": "no-exterior-intrusions", "name": "no exterior intrusions", "description": "Keep the exterior silhouette isolated; do not add unsupported floating ornament.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawVoussoir"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_root_0.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Black Gullet Story Threshold";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Black Gullet Story Threshold", "level": "macro", "role": "static-architecture-root", "importance": 1, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "An assembled arch frames a large negative opening instead of closing it with a portal panel.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": null, "attachment": null, "dimensions": {"width": 8.14, "height": 6.35, "depth": 4.86, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "warm-bone", "aged-bronze", "oxblood-web", "tendon-rubber", "ember-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "dark-clear-walk-through", "name": "dark clear walk through", "description": "Tall dark center remains physically and visually clear across the F5 standing lane.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["StoryLandmark_f5-last-altar"], "evidenceRefs": ["full-object"]}, {"id": "no-exterior-intrusions", "name": "no exterior intrusions", "description": "Keep the exterior silhouette isolated; do not add unsupported floating ornament.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawVoussoir"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_root_0);

  const attachment_MawBasaltFrame_1 = {"parentId": "root", "parentSocket": "frame-seat", "localStart": [0, 0, 0], "localEnd": [0, 6.35, 0], "contactType": "load-bearing-contact", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawBasaltFrame_1 = makeAttachmentEndpoint(attachment_MawBasaltFrame_1);
  const node_MawBasaltFrame_1 = new THREE.Group();
  node_MawBasaltFrame_1.name = "Broken Basalt Load Frame__pivot";
  node_MawBasaltFrame_1.scale.set(1, 1, 1);
  if (endpoint_MawBasaltFrame_1) {
    node_MawBasaltFrame_1.position.copy(endpoint_MawBasaltFrame_1.start);
    node_MawBasaltFrame_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawBasaltFrame_1.position.set(0.0, 0.0, 0.0);
    node_MawBasaltFrame_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawBasaltFrame_1.userData.sculptComponent = {"id": "MawBasaltFrame", "name": "Broken Basalt Load Frame", "level": "macro", "role": "structural-frame", "importance": 1, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Broad dark stone courses make an irregular arch around the walk-through aperture.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "frame-seat", "localStart": [0, 0, 0], "localEnd": [0, 6.35, 0], "contactType": "load-bearing-contact", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.14, "height": 6.35, "depth": 4.86, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "damp-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "broken-block-silhouette", "name": "broken block silhouette", "description": "Broad charcoal stones step around the arch with a chipped outer contour.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltLoadBearingArch", "MawVoussoir"], "evidenceRefs": ["full-object"]}, {"id": "chipped-exposed-edges", "name": "chipped exposed edges", "description": "Small bevels and broken facets catch grazing light without turning stone glossy.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawVoussoir"], "evidenceRefs": ["full-object"]}, {"id": "restrained-rear-continuation", "name": "restrained rear continuation", "description": "A low-detail return provides side depth without inventing unseen ornament.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltLoadBearingArch"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBasaltFrame_1.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["root"] ?? root).add(node_MawBasaltFrame_1);
  nodes["MawBasaltFrame"] = node_MawBasaltFrame_1;
  const mesh_MawBasaltFrame_1Geometry = endpoint_MawBasaltFrame_1
    ? new THREE.CylinderGeometry(endpoint_MawBasaltFrame_1.endRadius, endpoint_MawBasaltFrame_1.baseRadius, endpoint_MawBasaltFrame_1.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_MawBasaltFrame_1) {
    mesh_MawBasaltFrame_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawBasaltFrame_1 = new THREE.Mesh(
    mesh_MawBasaltFrame_1Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawBasaltFrame_1.name = "Broken Basalt Load Frame";
  if (endpoint_MawBasaltFrame_1) {
    mesh_MawBasaltFrame_1.position.copy(endpoint_MawBasaltFrame_1.midpoint);
    mesh_MawBasaltFrame_1.quaternion.copy(endpoint_MawBasaltFrame_1.quaternion);
  }
  mesh_MawBasaltFrame_1.castShadow = options.castShadow ?? true;
  mesh_MawBasaltFrame_1.receiveShadow = options.receiveShadow ?? true;
  mesh_MawBasaltFrame_1.userData.sculptComponent = {"id": "MawBasaltFrame", "name": "Broken Basalt Load Frame", "level": "macro", "role": "structural-frame", "importance": 1, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Broad dark stone courses make an irregular arch around the walk-through aperture.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "frame-seat", "localStart": [0, 0, 0], "localEnd": [0, 6.35, 0], "contactType": "load-bearing-contact", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.14, "height": 6.35, "depth": 4.86, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "damp-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "broken-block-silhouette", "name": "broken block silhouette", "description": "Broad charcoal stones step around the arch with a chipped outer contour.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltLoadBearingArch", "MawVoussoir"], "evidenceRefs": ["full-object"]}, {"id": "chipped-exposed-edges", "name": "chipped exposed edges", "description": "Small bevels and broken facets catch grazing light without turning stone glossy.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawVoussoir"], "evidenceRefs": ["full-object"]}, {"id": "restrained-rear-continuation", "name": "restrained rear continuation", "description": "A low-detail return provides side depth without inventing unseen ornament.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltLoadBearingArch"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBasaltFrame_1.add(mesh_MawBasaltFrame_1);
  meshes["MawBasaltFrame"] = mesh_MawBasaltFrame_1;
  colliders["MawBasaltFrame"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawBasaltFrame_1);

  const attachment_MawBoneRibs_2 = {"parentId": "MawBasaltFrame", "parentSocket": "inner-arch-seat", "localStart": [0, 0.2, 0], "localEnd": [0, 5.8, 0], "contactType": "embedded-bone-seat", "overlap": 0.09, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawBoneRibs_2 = makeAttachmentEndpoint(attachment_MawBoneRibs_2);
  const node_MawBoneRibs_2 = new THREE.Group();
  node_MawBoneRibs_2.name = "Interleaved Bone Load Ribs__pivot";
  node_MawBoneRibs_2.scale.set(1, 1, 1);
  if (endpoint_MawBoneRibs_2) {
    node_MawBoneRibs_2.position.copy(endpoint_MawBoneRibs_2.start);
    node_MawBoneRibs_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawBoneRibs_2.position.set(0.0, 0.0, 0.0);
    node_MawBoneRibs_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawBoneRibs_2.userData.sculptComponent = {"id": "MawBoneRibs", "name": "Interleaved Bone Load Ribs", "level": "macro", "role": "load-bearing-rib-assembly", "importance": 1, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Warm, porous ribs trace the inner arch and visibly transfer load into the basalt feet.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "inner-arch-seat", "localStart": [0, 0.2, 0], "localEnd": [0, 5.8, 0], "contactType": "embedded-bone-seat", "overlap": 0.09, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 6.05, "height": 5.95, "depth": 1.1, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone", "dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "crown-spurs", "name": "crown spurs", "description": "Tapered pale spurs break the crown and shoulders but stay outside the standing lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawCrownTooth"], "evidenceRefs": ["full-object"]}, {"id": "porous-longitudinal-grooves", "name": "porous longitudinal grooves", "description": "Shallow pits and axial grooves follow the bone; silhouette relief remains geometric.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBoneLoadRib"], "evidenceRefs": ["full-object"]}, {"id": "rooted-contact", "name": "rooted contact", "description": "Widened rib ends embed into footing stones without visible gaps.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawLoadBearingStrut"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBoneRibs_2.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}};
  (nodes["MawBasaltFrame"] ?? root).add(node_MawBoneRibs_2);
  nodes["MawBoneRibs"] = node_MawBoneRibs_2;
  const mesh_MawBoneRibs_2Geometry = endpoint_MawBoneRibs_2
    ? new THREE.CylinderGeometry(endpoint_MawBoneRibs_2.endRadius, endpoint_MawBoneRibs_2.baseRadius, endpoint_MawBoneRibs_2.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_MawBoneRibs_2) {
    mesh_MawBoneRibs_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawBoneRibs_2 = new THREE.Mesh(
    mesh_MawBoneRibs_2Geometry,
    materialMap["warm-bone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawBoneRibs_2.name = "Interleaved Bone Load Ribs";
  if (endpoint_MawBoneRibs_2) {
    mesh_MawBoneRibs_2.position.copy(endpoint_MawBoneRibs_2.midpoint);
    mesh_MawBoneRibs_2.quaternion.copy(endpoint_MawBoneRibs_2.quaternion);
  }
  mesh_MawBoneRibs_2.castShadow = options.castShadow ?? true;
  mesh_MawBoneRibs_2.receiveShadow = options.receiveShadow ?? true;
  mesh_MawBoneRibs_2.userData.sculptComponent = {"id": "MawBoneRibs", "name": "Interleaved Bone Load Ribs", "level": "macro", "role": "load-bearing-rib-assembly", "importance": 1, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "assembled-solid", "topologyRationale": "Warm, porous ribs trace the inner arch and visibly transfer load into the basalt feet.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "inner-arch-seat", "localStart": [0, 0.2, 0], "localEnd": [0, 5.8, 0], "contactType": "embedded-bone-seat", "overlap": 0.09, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 6.05, "height": 5.95, "depth": 1.1, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone", "dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "crown-spurs", "name": "crown spurs", "description": "Tapered pale spurs break the crown and shoulders but stay outside the standing lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawCrownTooth"], "evidenceRefs": ["full-object"]}, {"id": "porous-longitudinal-grooves", "name": "porous longitudinal grooves", "description": "Shallow pits and axial grooves follow the bone; silhouette relief remains geometric.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBoneLoadRib"], "evidenceRefs": ["full-object"]}, {"id": "rooted-contact", "name": "rooted contact", "description": "Widened rib ends embed into footing stones without visible gaps.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawLoadBearingStrut"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBoneRibs_2.add(mesh_MawBoneRibs_2);
  meshes["MawBoneRibs"] = mesh_MawBoneRibs_2;
  colliders["MawBoneRibs"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawBoneRibs_2);

  const attachment_MawBasaltFooting_3 = {"parentId": "root", "parentSocket": "footing-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.55, 0], "contactType": "grounded-overlap", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawBasaltFooting_3 = makeAttachmentEndpoint(attachment_MawBasaltFooting_3);
  const node_MawBasaltFooting_3 = new THREE.Group();
  node_MawBasaltFooting_3.name = "Rooted Basalt Feet and Plinths__pivot";
  node_MawBasaltFooting_3.scale.set(1, 1, 1);
  if (endpoint_MawBasaltFooting_3) {
    node_MawBasaltFooting_3.position.copy(endpoint_MawBasaltFooting_3.start);
    node_MawBasaltFooting_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawBasaltFooting_3.position.set(0.0, 0.0, 0.0);
    node_MawBasaltFooting_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawBasaltFooting_3.userData.sculptComponent = {"id": "MawBasaltFooting", "name": "Rooted Basalt Feet and Plinths", "level": "macro", "role": "grounded-foundation", "importance": 1, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Separate low stone masses ground each leg while leaving a centered route.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "footing-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.55, 0], "contactType": "grounded-overlap", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.8, "height": 1.1, "depth": 5.3, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rooted-blocks-and-rubble", "name": "rooted blocks and rubble", "description": "Wide side plinths anchor ribs; chips gather outside the clear center approach.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltFoot"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBasaltFooting_3.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["root"] ?? root).add(node_MawBasaltFooting_3);
  nodes["MawBasaltFooting"] = node_MawBasaltFooting_3;
  const mesh_MawBasaltFooting_3Geometry = endpoint_MawBasaltFooting_3
    ? new THREE.CylinderGeometry(endpoint_MawBasaltFooting_3.endRadius, endpoint_MawBasaltFooting_3.baseRadius, endpoint_MawBasaltFooting_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_MawBasaltFooting_3) {
    mesh_MawBasaltFooting_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawBasaltFooting_3 = new THREE.Mesh(
    mesh_MawBasaltFooting_3Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawBasaltFooting_3.name = "Rooted Basalt Feet and Plinths";
  if (endpoint_MawBasaltFooting_3) {
    mesh_MawBasaltFooting_3.position.copy(endpoint_MawBasaltFooting_3.midpoint);
    mesh_MawBasaltFooting_3.quaternion.copy(endpoint_MawBasaltFooting_3.quaternion);
  }
  mesh_MawBasaltFooting_3.castShadow = options.castShadow ?? true;
  mesh_MawBasaltFooting_3.receiveShadow = options.receiveShadow ?? true;
  mesh_MawBasaltFooting_3.userData.sculptComponent = {"id": "MawBasaltFooting", "name": "Rooted Basalt Feet and Plinths", "level": "macro", "role": "grounded-foundation", "importance": 1, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Separate low stone masses ground each leg while leaving a centered route.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "footing-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.55, 0], "contactType": "grounded-overlap", "overlap": 0.08, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.8, "height": 1.1, "depth": 5.3, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt", "warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rooted-blocks-and-rubble", "name": "rooted blocks and rubble", "description": "Wide side plinths anchor ribs; chips gather outside the clear center approach.", "scale": "macro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltFoot"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawBasaltFooting_3.add(mesh_MawBasaltFooting_3);
  meshes["MawBasaltFooting"] = mesh_MawBasaltFooting_3;
  colliders["MawBasaltFooting"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawBasaltFooting_3);

  const attachment_MawCrownKeystone_4 = {"parentId": "MawBasaltFrame", "parentSocket": "crown-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlapped-masonry", "overlap": 0.07, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawCrownKeystone_4 = makeAttachmentEndpoint(attachment_MawCrownKeystone_4);
  const node_MawCrownKeystone_4 = new THREE.Group();
  node_MawCrownKeystone_4.name = "Crown Keystone__pivot";
  node_MawCrownKeystone_4.scale.set(1, 1, 1);
  if (endpoint_MawCrownKeystone_4) {
    node_MawCrownKeystone_4.position.copy(endpoint_MawCrownKeystone_4.start);
    node_MawCrownKeystone_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawCrownKeystone_4.position.set(0.0, 5.8, -0.2);
    node_MawCrownKeystone_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawCrownKeystone_4.userData.sculptComponent = {"id": "MawCrownKeystone", "name": "Crown Keystone", "level": "meso", "role": "crown-cap", "importance": 0.8, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A heavy central cap interrupts the smooth arch and gathers the converging ribs.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "crown-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlapped-masonry", "overlap": 0.07, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.45, "height": 1.1, "depth": 0.72, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 5.8, -0.2], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "crown-keystone-fracture", "name": "crown keystone fracture", "description": "The crown cap is darker and thicker than adjacent bone ends, with irregular seams.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawCrownKeystone_4.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["MawBasaltFrame"] ?? root).add(node_MawCrownKeystone_4);
  nodes["MawCrownKeystone"] = node_MawCrownKeystone_4;
  const mesh_MawCrownKeystone_4Geometry = endpoint_MawCrownKeystone_4
    ? new THREE.CylinderGeometry(endpoint_MawCrownKeystone_4.endRadius, endpoint_MawCrownKeystone_4.baseRadius, endpoint_MawCrownKeystone_4.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_MawCrownKeystone_4) {
    mesh_MawCrownKeystone_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawCrownKeystone_4 = new THREE.Mesh(
    mesh_MawCrownKeystone_4Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawCrownKeystone_4.name = "Crown Keystone";
  if (endpoint_MawCrownKeystone_4) {
    mesh_MawCrownKeystone_4.position.copy(endpoint_MawCrownKeystone_4.midpoint);
    mesh_MawCrownKeystone_4.quaternion.copy(endpoint_MawCrownKeystone_4.quaternion);
  }
  mesh_MawCrownKeystone_4.castShadow = options.castShadow ?? true;
  mesh_MawCrownKeystone_4.receiveShadow = options.receiveShadow ?? true;
  mesh_MawCrownKeystone_4.userData.sculptComponent = {"id": "MawCrownKeystone", "name": "Crown Keystone", "level": "meso", "role": "crown-cap", "importance": 0.8, "confidence": 0.88, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "A heavy central cap interrupts the smooth arch and gathers the converging ribs.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "crown-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.4, 0], "contactType": "overlapped-masonry", "overlap": 0.07, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.45, "height": 1.1, "depth": 0.72, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 5.8, -0.2], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "crown-keystone-fracture", "name": "crown keystone fracture", "description": "The crown cap is darker and thicker than adjacent bone ends, with irregular seams.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawCrownKeystone_4.add(mesh_MawCrownKeystone_4);
  meshes["MawCrownKeystone"] = mesh_MawCrownKeystone_4;
  colliders["MawCrownKeystone"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawCrownKeystone_4);

  const attachment_MawVoussoirs_5 = {"parentId": "MawBasaltFrame", "parentSocket": "outer-course", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "masonry-overlap", "overlap": 0.055, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawVoussoirs_5 = makeAttachmentEndpoint(attachment_MawVoussoirs_5);
  const node_MawVoussoirs_5 = new THREE.Group();
  node_MawVoussoirs_5.name = "Segmented Basalt Voussoir Course__pivot";
  node_MawVoussoirs_5.scale.set(1, 1, 1);
  if (endpoint_MawVoussoirs_5) {
    node_MawVoussoirs_5.position.copy(endpoint_MawVoussoirs_5.start);
    node_MawVoussoirs_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawVoussoirs_5.position.set(0.0, 0.0, 0.0);
    node_MawVoussoirs_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawVoussoirs_5.userData.sculptComponent = {"id": "MawVoussoirs", "name": "Segmented Basalt Voussoir Course", "level": "meso", "role": "repeated-masonry-course", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Separate bevelled blocks create readable arch joints instead of one flat ring.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "outer-course", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "masonry-overlap", "overlap": 0.055, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.14, "height": 6.35, "depth": 0.62, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "stepped-arch-courses", "name": "stepped arch courses", "description": "Irregular radial blocks follow the spring lines and crown with dark narrow joints.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawVoussoirs_5.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["MawBasaltFrame"] ?? root).add(node_MawVoussoirs_5);
  nodes["MawVoussoirs"] = node_MawVoussoirs_5;
  const mesh_MawVoussoirs_5Geometry = endpoint_MawVoussoirs_5
    ? new THREE.CylinderGeometry(endpoint_MawVoussoirs_5.endRadius, endpoint_MawVoussoirs_5.baseRadius, endpoint_MawVoussoirs_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_MawVoussoirs_5) {
    mesh_MawVoussoirs_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawVoussoirs_5 = new THREE.Mesh(
    mesh_MawVoussoirs_5Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawVoussoirs_5.name = "Segmented Basalt Voussoir Course";
  if (endpoint_MawVoussoirs_5) {
    mesh_MawVoussoirs_5.position.copy(endpoint_MawVoussoirs_5.midpoint);
    mesh_MawVoussoirs_5.quaternion.copy(endpoint_MawVoussoirs_5.quaternion);
  }
  mesh_MawVoussoirs_5.castShadow = options.castShadow ?? true;
  mesh_MawVoussoirs_5.receiveShadow = options.receiveShadow ?? true;
  mesh_MawVoussoirs_5.userData.sculptComponent = {"id": "MawVoussoirs", "name": "Segmented Basalt Voussoir Course", "level": "meso", "role": "repeated-masonry-course", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Separate bevelled blocks create readable arch joints instead of one flat ring.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "outer-course", "localStart": [0, 0, 0], "localEnd": [0, 2, 0], "contactType": "masonry-overlap", "overlap": 0.055, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.14, "height": 6.35, "depth": 0.62, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "stepped-arch-courses", "name": "stepped arch courses", "description": "Irregular radial blocks follow the spring lines and crown with dark narrow joints.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawVoussoirs_5.add(mesh_MawVoussoirs_5);
  meshes["MawVoussoirs"] = mesh_MawVoussoirs_5;
  colliders["MawVoussoirs"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawVoussoirs_5);

  const attachment_MawMetalClamps_6 = {"parentId": "MawBoneRibs", "parentSocket": "lateral-clamp-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.1, 0.1], "contactType": "saddled-fastener-contact", "overlap": 0.045, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawMetalClamps_6 = makeAttachmentEndpoint(attachment_MawMetalClamps_6);
  const node_MawMetalClamps_6 = new THREE.Group();
  node_MawMetalClamps_6.name = "Square Aged Bronze Rib Clamps__pivot";
  node_MawMetalClamps_6.scale.set(1, 1, 1);
  if (endpoint_MawMetalClamps_6) {
    node_MawMetalClamps_6.position.copy(endpoint_MawMetalClamps_6.start);
    node_MawMetalClamps_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawMetalClamps_6.position.set(0.0, 0.0, 0.0);
    node_MawMetalClamps_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawMetalClamps_6.userData.sculptComponent = {"id": "MawMetalClamps", "name": "Square Aged Bronze Rib Clamps", "level": "meso", "role": "rib-attachment-hardware", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Square collars overlap lateral bone and visibly fasten it to the stone frame.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "lateral-clamp-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.1, 0.1], "contactType": "saddled-fastener-contact", "overlap": 0.045, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.72, "height": 0.54, "depth": 0.3, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}}, "material": "aged-bronze", "materialLayers": ["aged-bronze"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "square-bronze-collar", "name": "square bronze collar", "description": "Four raised rails wrap a pale rib; a face rivet and undercut shadow make the clamp read as hardware.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBronzeTie"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawMetalClamps_6.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}};
  (nodes["MawBoneRibs"] ?? root).add(node_MawMetalClamps_6);
  nodes["MawMetalClamps"] = node_MawMetalClamps_6;
  const mesh_MawMetalClamps_6Geometry = endpoint_MawMetalClamps_6
    ? new THREE.CylinderGeometry(endpoint_MawMetalClamps_6.endRadius, endpoint_MawMetalClamps_6.baseRadius, endpoint_MawMetalClamps_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_MawMetalClamps_6) {
    mesh_MawMetalClamps_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawMetalClamps_6 = new THREE.Mesh(
    mesh_MawMetalClamps_6Geometry,
    materialMap["aged-bronze"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawMetalClamps_6.name = "Square Aged Bronze Rib Clamps";
  if (endpoint_MawMetalClamps_6) {
    mesh_MawMetalClamps_6.position.copy(endpoint_MawMetalClamps_6.midpoint);
    mesh_MawMetalClamps_6.quaternion.copy(endpoint_MawMetalClamps_6.quaternion);
  }
  mesh_MawMetalClamps_6.castShadow = options.castShadow ?? true;
  mesh_MawMetalClamps_6.receiveShadow = options.receiveShadow ?? true;
  mesh_MawMetalClamps_6.userData.sculptComponent = {"id": "MawMetalClamps", "name": "Square Aged Bronze Rib Clamps", "level": "meso", "role": "rib-attachment-hardware", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Square collars overlap lateral bone and visibly fasten it to the stone frame.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "lateral-clamp-seat", "localStart": [0, 0, 0], "localEnd": [0, 0.1, 0.1], "contactType": "saddled-fastener-contact", "overlap": 0.045, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.72, "height": 0.54, "depth": 0.3, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}}, "material": "aged-bronze", "materialLayers": ["aged-bronze"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "square-bronze-collar", "name": "square bronze collar", "description": "Four raised rails wrap a pale rib; a face rivet and undercut shadow make the clamp read as hardware.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBronzeTie"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawMetalClamps_6.add(mesh_MawMetalClamps_6);
  meshes["MawMetalClamps"] = mesh_MawMetalClamps_6;
  colliders["MawMetalClamps"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawMetalClamps_6);

  const attachment_MawCables_7 = {"parentId": "MawMetalClamps", "parentSocket": "cable-socket", "localStart": [0, 0, 0], "localEnd": [0, 2.4, 0], "contactType": "socketed-flexible-root", "overlap": 0.06, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawCables_7 = makeAttachmentEndpoint(attachment_MawCables_7);
  const node_MawCables_7 = new THREE.Group();
  node_MawCables_7.name = "Paired Oxblood Tendon Cables__pivot";
  node_MawCables_7.scale.set(1, 1, 1);
  if (endpoint_MawCables_7) {
    node_MawCables_7.position.copy(endpoint_MawCables_7.start);
    node_MawCables_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawCables_7.position.set(0.0, 0.0, 0.0);
    node_MawCables_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawCables_7.userData.sculptComponent = {"id": "MawCables", "name": "Paired Oxblood Tendon Cables", "level": "meso", "role": "flexible-cable-connector", "importance": 0.8, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "fiber-strand", "topologyRationale": "Two dark red-brown strands leave the clamp sockets and follow the frame.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawMetalClamps", "attachment": {"parentId": "MawMetalClamps", "parentSocket": "cable-socket", "localStart": [0, 0, 0], "localEnd": [0, 2.4, 0], "contactType": "socketed-flexible-root", "overlap": 0.06, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.6, "height": 3.3, "depth": 0.24, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "tendon-rubber"}}, "material": "tendon-rubber", "materialLayers": ["tendon-rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "twin-red-tendon-lines", "name": "twin red tendon lines", "description": "Each cable starts under a bronze collar and terminates at a stone socket.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawTendonAnchor"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawCables_7.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "tendon-rubber"}};
  (nodes["MawMetalClamps"] ?? root).add(node_MawCables_7);
  nodes["MawCables"] = node_MawCables_7;
  const mesh_MawCables_7Geometry = endpoint_MawCables_7
    ? new THREE.CylinderGeometry(endpoint_MawCables_7.endRadius, endpoint_MawCables_7.baseRadius, endpoint_MawCables_7.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_MawCables_7) {
    mesh_MawCables_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawCables_7 = new THREE.Mesh(
    mesh_MawCables_7Geometry,
    materialMap["tendon-rubber"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawCables_7.name = "Paired Oxblood Tendon Cables";
  if (endpoint_MawCables_7) {
    mesh_MawCables_7.position.copy(endpoint_MawCables_7.midpoint);
    mesh_MawCables_7.quaternion.copy(endpoint_MawCables_7.quaternion);
  }
  mesh_MawCables_7.castShadow = options.castShadow ?? true;
  mesh_MawCables_7.receiveShadow = options.receiveShadow ?? true;
  mesh_MawCables_7.userData.sculptComponent = {"id": "MawCables", "name": "Paired Oxblood Tendon Cables", "level": "meso", "role": "flexible-cable-connector", "importance": 0.8, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "fiber-strand", "topologyRationale": "Two dark red-brown strands leave the clamp sockets and follow the frame.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawMetalClamps", "attachment": {"parentId": "MawMetalClamps", "parentSocket": "cable-socket", "localStart": [0, 0, 0], "localEnd": [0, 2.4, 0], "contactType": "socketed-flexible-root", "overlap": 0.06, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.6, "height": 3.3, "depth": 0.24, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "tendon-rubber"}}, "material": "tendon-rubber", "materialLayers": ["tendon-rubber"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "twin-red-tendon-lines", "name": "twin red tendon lines", "description": "Each cable starts under a bronze collar and terminates at a stone socket.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawTendonAnchor"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawCables_7.add(mesh_MawCables_7);
  meshes["MawCables"] = mesh_MawCables_7;
  colliders["MawCables"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawCables_7);

  const attachment_MawMembrane_8 = {"parentId": "MawBasaltFrame", "parentSocket": "recessed-web-seat", "localStart": [0, 2.35, -0.25], "localEnd": [0, 4.5, -0.25], "contactType": "tensioned-branch-roots", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawMembrane_8 = makeAttachmentEndpoint(attachment_MawMembrane_8);
  const node_MawMembrane_8 = new THREE.Group();
  node_MawMembrane_8.name = "Open Vascular Web__pivot";
  node_MawMembrane_8.scale.set(1, 1, 1);
  if (endpoint_MawMembrane_8) {
    node_MawMembrane_8.position.copy(endpoint_MawMembrane_8.start);
    node_MawMembrane_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawMembrane_8.position.set(0.0, 0.0, 0.0);
    node_MawMembrane_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawMembrane_8.userData.sculptComponent = {"id": "MawMembrane", "name": "Open Vascular Web", "level": "meso", "role": "throat-web", "importance": 0.8, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "fiber-strand", "topologyRationale": "Opaque branching strands sit behind the ribs; they leave broad dark openings instead of forming a sheet.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "recessed-web-seat", "localStart": [0, 2.35, -0.25], "localEnd": [0, 4.5, -0.25], "contactType": "tensioned-branch-roots", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.6, "height": 3.7, "depth": 0.32, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "oxblood-web"}}, "material": "oxblood-web", "materialLayers": ["oxblood-web"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "open-vascular-web", "name": "open vascular web", "description": "Oxblood branches keep open negative spaces and stay above the tested head lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawMembraneVascularSeam"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawMembrane_8.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "oxblood-web"}};
  (nodes["MawBasaltFrame"] ?? root).add(node_MawMembrane_8);
  nodes["MawMembrane"] = node_MawMembrane_8;
  const mesh_MawMembrane_8Geometry = endpoint_MawMembrane_8
    ? new THREE.CylinderGeometry(endpoint_MawMembrane_8.endRadius, endpoint_MawMembrane_8.baseRadius, endpoint_MawMembrane_8.length, 32, 12)
    : buildCurveSweepGeometry({"spine": [[-0.5, -0.4, 0.0], [-0.1, 0.1, 0.0], [0.3, 0.2, 0.0], [0.6, -0.1, 0.0]], "crossSection": {"points": [[-0.04, -0.02], [0.04, -0.02], [0.04, 0.02], [-0.04, 0.02]]}, "closed": false});
  if (!endpoint_MawMembrane_8) {
    mesh_MawMembrane_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawMembrane_8 = new THREE.Mesh(
    mesh_MawMembrane_8Geometry,
    materialMap["oxblood-web"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawMembrane_8.name = "Open Vascular Web";
  if (endpoint_MawMembrane_8) {
    mesh_MawMembrane_8.position.copy(endpoint_MawMembrane_8.midpoint);
    mesh_MawMembrane_8.quaternion.copy(endpoint_MawMembrane_8.quaternion);
  }
  mesh_MawMembrane_8.castShadow = options.castShadow ?? true;
  mesh_MawMembrane_8.receiveShadow = options.receiveShadow ?? true;
  mesh_MawMembrane_8.userData.sculptComponent = {"id": "MawMembrane", "name": "Open Vascular Web", "level": "meso", "role": "throat-web", "importance": 0.8, "confidence": 0.88, "primitive": "curve-sweep", "topologyClass": "fiber-strand", "topologyRationale": "Opaque branching strands sit behind the ribs; they leave broad dark openings instead of forming a sheet.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFrame", "attachment": {"parentId": "MawBasaltFrame", "parentSocket": "recessed-web-seat", "localStart": [0, 2.35, -0.25], "localEnd": [0, 4.5, -0.25], "contactType": "tensioned-branch-roots", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.6, "height": 3.7, "depth": 0.32, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "oxblood-web"}}, "material": "oxblood-web", "materialLayers": ["oxblood-web"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "open-vascular-web", "name": "open vascular web", "description": "Oxblood branches keep open negative spaces and stay above the tested head lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawMembraneVascularSeam"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawMembrane_8.add(mesh_MawMembrane_8);
  meshes["MawMembrane"] = mesh_MawMembrane_8;
  colliders["MawMembrane"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawMembrane_8);

  const attachment_MawTeeth_9 = {"parentId": "MawBoneRibs", "parentSocket": "crown-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0, -0.7, 0], "contactType": "embedded-taper-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawTeeth_9 = makeAttachmentEndpoint(attachment_MawTeeth_9);
  const node_MawTeeth_9 = new THREE.Group();
  node_MawTeeth_9.name = "Uneven Crown Teeth__pivot";
  node_MawTeeth_9.scale.set(1, 1, 1);
  if (endpoint_MawTeeth_9) {
    node_MawTeeth_9.position.copy(endpoint_MawTeeth_9.start);
    node_MawTeeth_9.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawTeeth_9.position.set(0.0, 0.0, 0.0);
    node_MawTeeth_9.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawTeeth_9.userData.sculptComponent = {"id": "MawTeeth", "name": "Uneven Crown Teeth", "level": "meso", "role": "hanging-crown-spurs", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Offset ivory teeth vary in length and stop above the player lane.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "crown-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0, -0.7, 0], "contactType": "embedded-taper-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.2, "height": 1.25, "depth": 0.24, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "irregular-hanging-crown", "name": "irregular hanging crown", "description": "Seven uneven tapered teeth frame the upper opening without lowering into the walking lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawTeeth_9.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}};
  (nodes["MawBoneRibs"] ?? root).add(node_MawTeeth_9);
  nodes["MawTeeth"] = node_MawTeeth_9;
  const mesh_MawTeeth_9Geometry = endpoint_MawTeeth_9
    ? new THREE.CylinderGeometry(endpoint_MawTeeth_9.endRadius, endpoint_MawTeeth_9.baseRadius, endpoint_MawTeeth_9.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_MawTeeth_9) {
    mesh_MawTeeth_9Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawTeeth_9 = new THREE.Mesh(
    mesh_MawTeeth_9Geometry,
    materialMap["warm-bone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawTeeth_9.name = "Uneven Crown Teeth";
  if (endpoint_MawTeeth_9) {
    mesh_MawTeeth_9.position.copy(endpoint_MawTeeth_9.midpoint);
    mesh_MawTeeth_9.quaternion.copy(endpoint_MawTeeth_9.quaternion);
  }
  mesh_MawTeeth_9.castShadow = options.castShadow ?? true;
  mesh_MawTeeth_9.receiveShadow = options.receiveShadow ?? true;
  mesh_MawTeeth_9.userData.sculptComponent = {"id": "MawTeeth", "name": "Uneven Crown Teeth", "level": "meso", "role": "hanging-crown-spurs", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Offset ivory teeth vary in length and stop above the player lane.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "crown-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0, -0.7, 0], "contactType": "embedded-taper-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 4.2, "height": 1.25, "depth": 0.24, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "irregular-hanging-crown", "name": "irregular hanging crown", "description": "Seven uneven tapered teeth frame the upper opening without lowering into the walking lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawTeeth_9.add(mesh_MawTeeth_9);
  meshes["MawTeeth"] = mesh_MawTeeth_9;
  colliders["MawTeeth"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawTeeth_9);

  const attachment_MawDeepHalo_10 = {"parentId": "root", "parentSocket": "throat-depth", "localStart": [0, 0, -2.8], "localEnd": [0, 0, -3.2], "contactType": "recessed-anchor", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawDeepHalo_10 = makeAttachmentEndpoint(attachment_MawDeepHalo_10);
  const node_MawDeepHalo_10 = new THREE.Group();
  node_MawDeepHalo_10.name = "Small Receding Bronze Depth Halo__pivot";
  node_MawDeepHalo_10.scale.set(1, 1, 1);
  if (endpoint_MawDeepHalo_10) {
    node_MawDeepHalo_10.position.copy(endpoint_MawDeepHalo_10.start);
    node_MawDeepHalo_10.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawDeepHalo_10.position.set(0.0, 4.76, -3.15);
    node_MawDeepHalo_10.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawDeepHalo_10.userData.sculptComponent = {"id": "MawDeepHalo", "name": "Small Receding Bronze Depth Halo", "level": "meso", "role": "depth-cue", "importance": 0.8, "confidence": 0.88, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "One dim, small halo sits deep around the amber point and stays secondary to the architecture.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "throat-depth", "localStart": [0, 0, -2.8], "localEnd": [0, 0, -3.2], "contactType": "recessed-anchor", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.25, "height": 1.35, "depth": 0.1, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 4.76, -3.15], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}}, "material": "aged-bronze", "materialLayers": ["aged-bronze"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deep-halo", "name": "deep halo", "description": "A restrained ellipse frames the ember without dominating the entrance.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawDeepHalo_10.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}};
  (nodes["root"] ?? root).add(node_MawDeepHalo_10);
  nodes["MawDeepHalo"] = node_MawDeepHalo_10;
  const mesh_MawDeepHalo_10Geometry = endpoint_MawDeepHalo_10
    ? new THREE.CylinderGeometry(endpoint_MawDeepHalo_10.endRadius, endpoint_MawDeepHalo_10.baseRadius, endpoint_MawDeepHalo_10.length, 32, 12)
    : new THREE.TorusGeometry(0.45, 0.08, 24, 96);
  if (!endpoint_MawDeepHalo_10) {
    mesh_MawDeepHalo_10Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawDeepHalo_10 = new THREE.Mesh(
    mesh_MawDeepHalo_10Geometry,
    materialMap["aged-bronze"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawDeepHalo_10.name = "Small Receding Bronze Depth Halo";
  if (endpoint_MawDeepHalo_10) {
    mesh_MawDeepHalo_10.position.copy(endpoint_MawDeepHalo_10.midpoint);
    mesh_MawDeepHalo_10.quaternion.copy(endpoint_MawDeepHalo_10.quaternion);
  }
  mesh_MawDeepHalo_10.castShadow = options.castShadow ?? true;
  mesh_MawDeepHalo_10.receiveShadow = options.receiveShadow ?? true;
  mesh_MawDeepHalo_10.userData.sculptComponent = {"id": "MawDeepHalo", "name": "Small Receding Bronze Depth Halo", "level": "meso", "role": "depth-cue", "importance": 0.8, "confidence": 0.88, "primitive": "torus", "topologyClass": "assembled-solid", "topologyRationale": "One dim, small halo sits deep around the amber point and stays secondary to the architecture.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "throat-depth", "localStart": [0, 0, -2.8], "localEnd": [0, 0, -3.2], "contactType": "recessed-anchor", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.25, "height": 1.35, "depth": 0.1, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 4.76, -3.15], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "aged-bronze"}}, "material": "aged-bronze", "materialLayers": ["aged-bronze"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deep-halo", "name": "deep halo", "description": "A restrained ellipse frames the ember without dominating the entrance.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawDeepHalo_10.add(mesh_MawDeepHalo_10);
  meshes["MawDeepHalo"] = mesh_MawDeepHalo_10;
  colliders["MawDeepHalo"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawDeepHalo_10);

  const attachment_MawEmber_11 = {"parentId": "root", "parentSocket": "ember-anchor", "localStart": [0, 0, -3.6], "localEnd": [0, 0, -3.9], "contactType": "recessed-emissive-mount", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawEmber_11 = makeAttachmentEndpoint(attachment_MawEmber_11);
  const node_MawEmber_11 = new THREE.Group();
  node_MawEmber_11.name = "Deep Amber Votive__pivot";
  node_MawEmber_11.scale.set(1, 1, 1);
  if (endpoint_MawEmber_11) {
    node_MawEmber_11.position.copy(endpoint_MawEmber_11.start);
    node_MawEmber_11.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawEmber_11.position.set(-0.06, 4.76, -3.8);
    node_MawEmber_11.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawEmber_11.userData.sculptComponent = {"id": "MawEmber", "name": "Deep Amber Votive", "level": "meso", "role": "deep-emissive-beacon", "importance": 0.8, "confidence": 0.88, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "A tiny low-area amber cue glows far inside the black opening.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "ember-anchor", "localStart": [0, 0, -3.6], "localEnd": [0, 0, -3.9], "contactType": "recessed-emissive-mount", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.24, "depth": 0.16, "units": "world", "confidence": 0.84}, "transform": {"position": [-0.06, 4.76, -3.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "ember-light"}}, "material": "ember-light", "materialLayers": ["ember-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deep-amber-votive", "name": "deep amber votive", "description": "A small warm point remains visible at depth.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawEmber_11.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "ember-light"}};
  (nodes["root"] ?? root).add(node_MawEmber_11);
  nodes["MawEmber"] = node_MawEmber_11;
  const mesh_MawEmber_11Geometry = endpoint_MawEmber_11
    ? new THREE.CylinderGeometry(endpoint_MawEmber_11.endRadius, endpoint_MawEmber_11.baseRadius, endpoint_MawEmber_11.length, 32, 12)
    : new THREE.SphereGeometry(0.5, 64, 40);
  if (!endpoint_MawEmber_11) {
    mesh_MawEmber_11Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawEmber_11 = new THREE.Mesh(
    mesh_MawEmber_11Geometry,
    materialMap["ember-light"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawEmber_11.name = "Deep Amber Votive";
  if (endpoint_MawEmber_11) {
    mesh_MawEmber_11.position.copy(endpoint_MawEmber_11.midpoint);
    mesh_MawEmber_11.quaternion.copy(endpoint_MawEmber_11.quaternion);
  }
  mesh_MawEmber_11.castShadow = options.castShadow ?? true;
  mesh_MawEmber_11.receiveShadow = options.receiveShadow ?? true;
  mesh_MawEmber_11.userData.sculptComponent = {"id": "MawEmber", "name": "Deep Amber Votive", "level": "meso", "role": "deep-emissive-beacon", "importance": 0.8, "confidence": 0.88, "primitive": "sphere", "topologyClass": "assembled-solid", "topologyRationale": "A tiny low-area amber cue glows far inside the black opening.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "ember-anchor", "localStart": [0, 0, -3.6], "localEnd": [0, 0, -3.9], "contactType": "recessed-emissive-mount", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 0.18, "height": 0.24, "depth": 0.16, "units": "world", "confidence": 0.84}, "transform": {"position": [-0.06, 4.76, -3.8], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "ember-light"}}, "material": "ember-light", "materialLayers": ["ember-light"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "deep-amber-votive", "name": "deep amber votive", "description": "A small warm point remains visible at depth.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": [], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawEmber_11.add(mesh_MawEmber_11);
  meshes["MawEmber"] = mesh_MawEmber_11;
  colliders["MawEmber"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawEmber_11);

  const attachment_MawRubble_12 = {"parentId": "MawBasaltFooting", "parentSocket": "outer-foot-rubble", "localStart": [0, 0, 0], "localEnd": [0, 0.2, 0], "contactType": "settled-debris", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawRubble_12 = makeAttachmentEndpoint(attachment_MawRubble_12);
  const node_MawRubble_12 = new THREE.Group();
  node_MawRubble_12.name = "Outside Foot Rubble__pivot";
  node_MawRubble_12.scale.set(1, 1, 1);
  if (endpoint_MawRubble_12) {
    node_MawRubble_12.position.copy(endpoint_MawRubble_12.start);
    node_MawRubble_12.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawRubble_12.position.set(0.0, 0.0, 0.0);
    node_MawRubble_12.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawRubble_12.userData.sculptComponent = {"id": "MawRubble", "name": "Outside Foot Rubble", "level": "meso", "role": "loose-foundation-stones", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Sparse angular fragments collect at both feet and fade before the center route.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFooting", "attachment": {"parentId": "MawBasaltFooting", "parentSocket": "outer-foot-rubble", "localStart": [0, 0, 0], "localEnd": [0, 0.2, 0], "contactType": "settled-debris", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.4, "height": 0.44, "depth": 1.2, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "base-rubble-clusters", "name": "base rubble clusters", "description": "Small dark chips and a few pale fragments ground the outside feet only.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltFoot"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawRubble_12.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}};
  (nodes["MawBasaltFooting"] ?? root).add(node_MawRubble_12);
  nodes["MawRubble"] = node_MawRubble_12;
  const mesh_MawRubble_12Geometry = endpoint_MawRubble_12
    ? new THREE.CylinderGeometry(endpoint_MawRubble_12.endRadius, endpoint_MawRubble_12.baseRadius, endpoint_MawRubble_12.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  if (!endpoint_MawRubble_12) {
    mesh_MawRubble_12Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawRubble_12 = new THREE.Mesh(
    mesh_MawRubble_12Geometry,
    materialMap["dark-basalt"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawRubble_12.name = "Outside Foot Rubble";
  if (endpoint_MawRubble_12) {
    mesh_MawRubble_12.position.copy(endpoint_MawRubble_12.midpoint);
    mesh_MawRubble_12.quaternion.copy(endpoint_MawRubble_12.quaternion);
  }
  mesh_MawRubble_12.castShadow = options.castShadow ?? true;
  mesh_MawRubble_12.receiveShadow = options.receiveShadow ?? true;
  mesh_MawRubble_12.userData.sculptComponent = {"id": "MawRubble", "name": "Outside Foot Rubble", "level": "meso", "role": "loose-foundation-stones", "importance": 0.8, "confidence": 0.88, "primitive": "instanced-cluster", "topologyClass": "assembled-solid", "topologyRationale": "Sparse angular fragments collect at both feet and fade before the center route.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBasaltFooting", "attachment": {"parentId": "MawBasaltFooting", "parentSocket": "outer-foot-rubble", "localStart": [0, 0, 0], "localEnd": [0, 0.2, 0], "contactType": "settled-debris", "overlap": 0.025, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 8.4, "height": 0.44, "depth": 1.2, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "dark-basalt"}}, "material": "dark-basalt", "materialLayers": ["dark-basalt"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "base-rubble-clusters", "name": "base rubble clusters", "description": "Small dark chips and a few pale fragments ground the outside feet only.", "scale": "micro", "realization": "named-procedural-geometry", "meshNames": ["MawBasaltFoot"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawRubble_12.add(mesh_MawRubble_12);
  meshes["MawRubble"] = mesh_MawRubble_12;
  colliders["MawRubble"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawRubble_12);

  const attachment_MawSideSpurs_13 = {"parentId": "MawBoneRibs", "parentSocket": "side-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0.5, 0.6, 0], "contactType": "embedded-spur-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]};
  const endpoint_MawSideSpurs_13 = makeAttachmentEndpoint(attachment_MawSideSpurs_13);
  const node_MawSideSpurs_13 = new THREE.Group();
  node_MawSideSpurs_13.name = "Lateral Bone Spurs__pivot";
  node_MawSideSpurs_13.scale.set(1, 1, 1);
  if (endpoint_MawSideSpurs_13) {
    node_MawSideSpurs_13.position.copy(endpoint_MawSideSpurs_13.start);
    node_MawSideSpurs_13.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_MawSideSpurs_13.position.set(0.0, 0.0, 0.0);
    node_MawSideSpurs_13.rotation.set(0.0, 0.0, 0.0);
  }
  node_MawSideSpurs_13.userData.sculptComponent = {"id": "MawSideSpurs", "name": "Lateral Bone Spurs", "level": "meso", "role": "bone-side-threat-spurs", "importance": 0.8, "confidence": 0.88, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Broken side points sharpen the shoulder silhouette while remaining outside the center path.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "side-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0.5, 0.6, 0], "contactType": "embedded-spur-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.1, "height": 1.4, "depth": 0.42, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lateral-bone-spurs", "name": "lateral bone spurs", "description": "Uneven inward-facing points vary in length; tips stay outside the tested lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawSideTooth"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawSideSpurs_13.userData.actionProfile = {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}};
  (nodes["MawBoneRibs"] ?? root).add(node_MawSideSpurs_13);
  nodes["MawSideSpurs"] = node_MawSideSpurs_13;
  const mesh_MawSideSpurs_13Geometry = endpoint_MawSideSpurs_13
    ? new THREE.CylinderGeometry(endpoint_MawSideSpurs_13.endRadius, endpoint_MawSideSpurs_13.baseRadius, endpoint_MawSideSpurs_13.length, 32, 12)
    : new THREE.ConeGeometry(0.5, 1, 48, 1);
  if (!endpoint_MawSideSpurs_13) {
    mesh_MawSideSpurs_13Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_MawSideSpurs_13 = new THREE.Mesh(
    mesh_MawSideSpurs_13Geometry,
    materialMap["warm-bone"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_MawSideSpurs_13.name = "Lateral Bone Spurs";
  if (endpoint_MawSideSpurs_13) {
    mesh_MawSideSpurs_13.position.copy(endpoint_MawSideSpurs_13.midpoint);
    mesh_MawSideSpurs_13.quaternion.copy(endpoint_MawSideSpurs_13.quaternion);
  }
  mesh_MawSideSpurs_13.castShadow = options.castShadow ?? true;
  mesh_MawSideSpurs_13.receiveShadow = options.receiveShadow ?? true;
  mesh_MawSideSpurs_13.userData.sculptComponent = {"id": "MawSideSpurs", "name": "Lateral Bone Spurs", "level": "meso", "role": "bone-side-threat-spurs", "importance": 0.8, "confidence": 0.88, "primitive": "cone", "topologyClass": "assembled-solid", "topologyRationale": "Broken side points sharpen the shoulder silhouette while remaining outside the center path.", "geometryDescriptor": {"topologyIntent": "Bevelled procedural mass with authored profile variation and readable frontal silhouette.", "edgeTreatment": {"type": "small bevels on worn edges", "bevelRadius": 0.045, "segments": 2}, "deformationStack": [], "uvStrategy": "world-space procedural coordinates; no projection from the concept", "normalStrategy": "weighted bevel normals with hard authored seams"}, "parent": "MawBoneRibs", "attachment": {"parentId": "MawBoneRibs", "parentSocket": "side-spur-sockets", "localStart": [0, 0, 0], "localEnd": [0.5, 0.6, 0], "contactType": "embedded-spur-root", "overlap": 0.04, "gapTolerance": 0.02, "evidenceRefs": ["full-object"]}, "dimensions": {"width": 1.1, "height": 1.4, "depth": 0.42, "units": "world", "confidence": 0.84}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "named-static-part", "pivot": {"mode": "semantic-root", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "named-static-part", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "warm-bone"}}, "material": "warm-bone", "materialLayers": ["warm-bone"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "lateral-bone-spurs", "name": "lateral bone spurs", "description": "Uneven inward-facing points vary in length; tips stay outside the tested lane.", "scale": "meso", "realization": "named-procedural-geometry", "meshNames": ["MawSideTooth"], "evidenceRefs": ["full-object"]}], "surfaceDetail": {"macroRoughness": 0.24, "microRoughness": 0.1, "bumpAmplitude": 0.035, "normalPattern": "multi-scale procedural wear", "displacementPattern": "silhouette breaks remain geometry", "occlusionPattern": "darken contact seams", "edgeWearPattern": "isolated exposed chips", "notes": "High-frequency response stays subordinate to the far-view doorway."}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "procedural-production"};
  node_MawSideSpurs_13.add(mesh_MawSideSpurs_13);
  meshes["MawSideSpurs"] = mesh_MawSideSpurs_13;
  colliders["MawSideSpurs"] = {"type": "none", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": true, "notes": "Visual-only selection metadata; gameplay collision remains in the course map."};
  destructionGroups["named-static-part"] ??= [];
  destructionGroups["named-static-part"].push(node_MawSideSpurs_13);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/material_region_analysis.py", "status": "skipped", "reason": "The local analyzer generated channel maps, but crop inspection shows source shapes, scene shadows, and mixed surfaces remain in the pixels. Material assignment remains probe, so these are not used as tileable runtime textures.", "evidence": "docs/story-map-art/black-gullet-material-analysis.json", "acceptedLimitation": "The concept supports palette and finish hypotheses, not unique physical PBR recovery."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createBlackGulletStoryThresholdLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Black Gullet Story Threshold look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "warm-key", "type": "large warm key", "direction": "upper-left and slightly frontal", "color": "#E0C6A5", "intensity": "broad soft key", "notes": "Reveal basalt fracture planes and ivory rib edges."}, {"id": "cool-fill", "type": "low frontal fill", "direction": "camera axis", "color": "#62525A", "intensity": "low", "notes": "Keep the throat dark while retaining matte material separation."}, {"id": "oxblood-rim", "type": "rear rim", "direction": "behind and right", "color": "#8E3835", "intensity": "subtle", "notes": "Separate the contour from room fog; avoid broad red spill."}, {"id": "rendering-intent", "type": "display", "exposure": "neutral exposure", "toneMapping": "ACES filmic tone mapping", "background": "#100B11", "contactShadow": "tight contact shadow at rubble and bone-foot joints"}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": false, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/material_region_analysis.py", "status": "skipped", "reason": "The local analyzer generated channel maps, but crop inspection shows source shapes, scene shadows, and mixed surfaces remain in the pixels. Material assignment remains probe, so these are not used as tileable runtime textures.", "evidence": "docs/story-map-art/black-gullet-material-analysis.json", "acceptedLimitation": "The concept supports palette and finish hypotheses, not unique physical PBR recovery."}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createBlackGulletStoryThresholdEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameBlackGulletStoryThresholdCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createBlackGulletStoryThresholdPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureBlackGulletStoryThresholdRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createBlackGulletStoryThresholdInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
