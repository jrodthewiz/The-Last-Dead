import * as THREE from './vendor/three.module.js';

// Torso socket coordinates, in metres: +X right, +Y head, +Z chest exterior.
// Every part is authored from a surface or centreline; no runtime art assets.
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = value => value * value * (3 - 2 * value);
const linearPigment = value => value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);

function randomFor(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state += 0x6d2b79f5;
    let n = state;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function finishGeometry(position, uv, color, index, linearColors=false) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // The authored pigment triples are sRGB. Three.js vertex colors must be
  // linear, otherwise dark wet red tissue becomes pastel under the lantern.
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(linearColors?color:color.map(linearPigment), 3));
  geometry.setAttribute('tissueRegion', new THREE.Float32BufferAttribute(new Float32Array(position.length / 3), 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Muted capillaries follow the anatomical surface parameterization. They are
// pigment variation, so wet highlights remain governed by the physical lights.
function surfaceColor(base, u, v, phase, vein = .12) {
  const capillary = Math.pow(Math.max(0, Math.cos(u * 11 + 2.8 * Math.sin(v * 7 + phase))), 24);
  const tissue = 1 + .065 * Math.sin(u * 9 + phase) * Math.sin(v * 15 - phase);
  return [base[0] * (tissue - vein * capillary), base[1] * (tissue - vein * 1.9 * capillary), base[2] * (tissue - vein * .65 * capillary)];
}

// The poles are real triangle fans, not collapsed latitude quads. Each seam
// owns a UV copy and then receives the same averaged normal on both sides.
function organSurface(shape, base, phase, around = 24, latitude = 14) {
  const position = [], uv = [], color = [], index = [];
  const add = (u, v) => {
    const p = shape(u, v);
    position.push(p.x, p.y, p.z);
    uv.push(u / TAU, (v + 1) * .5);
    color.push(...surfaceColor(base, u, v, phase));
  };
  add(0, -1);
  for (let row = 1; row < latitude; row++) {
    const v = -Math.cos(row * Math.PI / latitude);
    for (let column = 0; column <= around; column++) add(column * TAU / around, v);
  }
  const top = position.length / 3;
  add(0, 1);
  for (let column = 0; column < around; column++) index.push(0, 1 + column, 2 + column);
  for (let row = 0; row < latitude - 2; row++) {
    for (let column = 0; column < around; column++) {
      const a = 1 + row * (around + 1) + column, b = a + around + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const last = 1 + (latitude - 2) * (around + 1);
  for (let column = 0; column < around; column++) index.push(top, last + column + 1, last + column);
  const geometry = finishGeometry(position, uv, color, index);
  const normal = geometry.attributes.normal;
  for (let row = 0; row < latitude - 1; row++) {
    const a = 1 + row * (around + 1), b = a + around;
    const n = vec(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
    normal.setXYZ(a, n.x, n.y, n.z); normal.setXYZ(b, n.x, n.y, n.z);
  }
  return geometry;
}

function mergeGeometry(parts) {
  const position = [], normal = [], uv = [], color = [], tissueRegion = [], index = [];
  for (const geometry of parts) {
    const offset = position.length / 3;
    position.push(...geometry.attributes.position.array);
    normal.push(...geometry.attributes.normal.array);
    uv.push(...geometry.attributes.uv.array);
    color.push(...geometry.attributes.color.array);
    tissueRegion.push(...geometry.attributes.tissueRegion.array);
    for (const i of geometry.index.array) index.push(offset + i);
    geometry.dispose();
  }
  const geometry = finishGeometry(position, uv, color, index, true);
  geometry.attributes.normal.array.set(normal);
  geometry.attributes.tissueRegion.array.set(tissueRegion);
  return geometry;
}

function sampleCurve(points, t, out) {
  const last = points.length - 1, segment = Math.min(last - 1, Math.floor(t * last));
  const f = t === 1 ? 1 : t * last - segment;
  const p0 = points[Math.max(0, segment - 1)], p1 = points[segment], p2 = points[segment + 1], p3 = points[Math.min(last, segment + 2)];
  const f2 = f * f, f3 = f2 * f;
  for (let axis = 0; axis < 3; axis++) {
    const a = p0.getComponent(axis), b = p1.getComponent(axis), c = p2.getComponent(axis), d = p3.getComponent(axis);
    out.setComponent(axis, .5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3));
  }
  return out;
}

// A fixed tube allocation supports arbitrary root-local chain positions.
// Parallel transport prevents the frame flips that Frenet frames introduce at
// the flat bends in a hanging intestine. Both caps own their shading vertices.
function sweptTube(points, radius, base, phase, sections = 36, radial = 8, dynamic = false, corrugation = .045) {
  const ringStride = radial + 1, sideCount = (sections + 1) * ringStride;
  const vertexCount = sideCount + 2 * (radial + 1);
  const position = new Float32Array(vertexCount * 3), normal = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2), color = new Float32Array(vertexCount * 3), index = [];
  for (let row = 0; row < sections; row++) for (let column = 0; column < radial; column++) {
    const a = row * ringStride + column, b = a + ringStride;
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  for (let end = 0; end < 2; end++) for (let column = 0; column < radial; column++) {
    const center = sideCount + end * (radial + 1), ring = center + 1;
    if (end === 0) index.push(center, ring + (column + 1) % radial, ring + column);
    else index.push(center, ring + column, ring + (column + 1) % radial);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('tissueRegion', new THREE.Float32BufferAttribute(new Float32Array(vertexCount), 1));
  geometry.setIndex(index);
  if (dynamic) for (const name of ['position', 'normal', 'uv']) geometry.attributes[name].setUsage(THREE.DynamicDrawUsage);
  const centers = Array.from({ length: sections + 1 }, () => new THREE.Vector3());
  const tangent = new THREE.Vector3(), frame = new THREE.Vector3(), binormal = new THREE.Vector3(), radialNormal = new THREE.Vector3();
  const lastTangent = new THREE.Vector3(0, 1, 0), capTangent = [new THREE.Vector3(), new THREE.Vector3()];
  function write(chain) {
    if (!Array.isArray(chain) || chain.length < 2 || chain.some(p => !p?.isVector3 || !Number.isFinite(p.x + p.y + p.z))) throw new TypeError('Intestine points must contain at least two finite THREE.Vector3 positions.');
    for (let row = 0; row <= sections; row++) sampleCurve(chain, row / sections, centers[row]);
    let distance = 0;
    for (let row = 0; row <= sections; row++) {
      tangent.copy(centers[Math.min(sections, row + 1)]).sub(centers[Math.max(0, row - 1)]);
      if (tangent.lengthSq() < 1e-16) tangent.copy(lastTangent);
      else tangent.normalize();
      if (row === 0) {
        frame.set(Math.abs(tangent.x) < .8 ? 1 : 0, Math.abs(tangent.x) < .8 ? 0 : 1, 0);
        frame.addScaledVector(tangent, -frame.dot(tangent)).normalize();
      } else {
        frame.addScaledVector(tangent, -frame.dot(tangent));
        if (frame.lengthSq() < 1e-10) {
          frame.set(Math.abs(tangent.x) < .8 ? 1 : 0, Math.abs(tangent.x) < .8 ? 0 : 1, 0);
          frame.addScaledVector(tangent, -frame.dot(tangent));
        }
        frame.normalize();
      }
      binormal.crossVectors(tangent, frame).normalize();
      if (row > 0) distance += centers[row].distanceTo(centers[row - 1]);
      lastTangent.copy(tangent);
      if (row === 0) capTangent[0].copy(tangent).negate();
      if (row === sections) capTangent[1].copy(tangent);
      const localRadius = typeof radius === 'function' ? radius(row / sections) : radius;
      const r = localRadius * (1 + corrugation * Math.cos(row / sections * TAU * 18 + phase));
      for (let column = 0; column <= radial; column++) {
        const angle = (column % radial) * TAU / radial, id = row * ringStride + column;
        radialNormal.copy(frame).multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
        position[id * 3] = centers[row].x + radialNormal.x * r;
        position[id * 3 + 1] = centers[row].y + radialNormal.y * r;
        position[id * 3 + 2] = centers[row].z + radialNormal.z * r;
        normal.set(radialNormal.toArray(), id * 3);
        uv[id * 2] = column / radial; uv[id * 2 + 1] = distance / .05;
        color.set(surfaceColor(base, angle, row / sections, phase, .07), id * 3);
      }
    }
    for (let end = 0; end < 2; end++) {
      const centerId = sideCount + end * (radial + 1), row = end ? sections : 0;
      position.set(centers[row].toArray(), centerId * 3); normal.set(capTangent[end].toArray(), centerId * 3);
      uv.set([.5, .5], centerId * 2); color.set(base, centerId * 3);
      for (let column = 0; column < radial; column++) {
        const source = (row * ringStride + column) * 3, target = (centerId + 1 + column) * 3;
        position.set(position.subarray(source, source + 3), target); normal.set(capTangent[end].toArray(), target); color.set(base, target);
        uv.set([.5 + Math.cos(column * TAU / radial) * .5, .5 + Math.sin(column * TAU / radial) * .5], (centerId + 1 + column) * 2);
      }
    }
    for (const name of ['position', 'normal', 'uv']) geometry.attributes[name].needsUpdate = true;
    for(let i=0;i<color.length;i++)color[i]=linearPigment(color[i]);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  }
  write(points);
  return { geometry, write };
}

function cavityGeometry(phase) {
  const position = [-.005, -.018, -.089], uv = [.5, .5], color = [.105, .018, .027], index = [];
  const around = 48, rings = 5;
  for (let row = 1; row <= rings; row++) for (let column = 0; column <= around; column++) {
    const r = row / rings, angle = column * TAU / around;
    const boundary = 1 + .018 * Math.sin(angle * 7 + phase) + .009 * Math.cos(angle * 13 - phase);
    // Deep posterior wall rises into an uneven muscular rim. The asymmetric
    // relief belongs to the cavity bowl rather than a flat dark decal.
    const folds = .003 * Math.sin(angle * 6 + r * 11 + phase) * r * (1 - r);
    position.push(-.005 * (1 - r) + Math.cos(angle) * .148 * r * boundary, -.018 + Math.sin(angle) * .208 * r * boundary, -.089 + (.061 + .007 * Math.sin(angle * 3 + phase)) * r * r + folds);
    uv.push(.5 + Math.cos(angle) * r * .5, .5 + Math.sin(angle) * r * .5);
    color.push(.14 + .065 * r, .025 + .02 * r, .038 + .018 * r);
  }
  for (let column = 0; column < around; column++) index.push(0, 1 + column, 2 + column);
  for (let row = 0; row < rings - 1; row++) for (let column = 0; column < around; column++) {
    const a = 1 + row * (around + 1) + column, b = a + around + 1;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return finishGeometry(position, uv, color, index);
}

function skinFlap(side, phase) {
  const position = [], color = [], uv = [], index = [], across = 5, length = 24;
  for (let row = 0; row <= length; row++) {
    const t = row / length, y = -.219 + .425 * t, edge = Math.pow(Math.sin(Math.PI * t), .45);
    for (let column = 0; column <= across; column++) {
      const u = column / across;
      position.push(side * (.006 + .144 * u) * edge, y, .018 + .007 * Math.sin(Math.PI * t) - .01 * u);
      uv.push(u, t);
      color.push(...surfaceColor(u < .22 ? [.44, .095, .12] : [.35, .24, .22], t * TAU, u, phase, .08));
    }
  }
  // Deliberate tiny terminal width avoids collapsed skin-tip quads.
  for (let end of [0, length]) for (let column = 0; column <= across; column++) position[(end * (across + 1) + column) * 3] = side * (.001 + column * .0012);
  for (let row = 0; row < length; row++) for (let column = 0; column < across; column++) {
    const a = row * (across + 1) + column, b = a + across + 1;
    if (side > 0) index.push(a, a + 1, b, b, a + 1, b + 1);
    else index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = finishGeometry(position, uv, color, index), original = geometry.attributes.position.array.slice();
  return { geometry, original, across, length };
}

/** Procedural, socket-local anatomy for the G corpse harvest. */
export function createExtractionAnatomy(seed = 1) {
  const random = randomFor(seed), phase = random() * TAU, variation = .965 + random() * .07;
  const root = new THREE.Group(); root.name = 'ExtractionAnatomy';
  const tissueMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .4, metalness: 0 });
  const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .47, metalness: 0 });
  const cavityMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .55, metalness: 0, side: THREE.DoubleSide });
  const fleshMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .34, metalness: 0 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .51, metalness: 0, side: THREE.DoubleSide });
  const materials = [tissueMaterial, boneMaterial, cavityMaterial, fleshMaterial, skinMaterial], allocated = new Set();
  const interior = new THREE.Group(); interior.name = 'ExposedViscera'; root.add(interior);
  const regionFor = name => /Colon|Intestine|Stomach|Kidneys|Spleen/.test(name) ? 1 : /Liver|Lungs/.test(name) ? 2 : /Sternum|Rib/.test(name) ? 3 : 0;
  const mesh = (name, geometry, material, parent = interior) => {
    const region = regionFor(name);
    geometry.attributes.tissueRegion.array.fill(region);
    const node = new THREE.Mesh(geometry, material); node.name = name; node.castShadow = false; node.receiveShadow = true;
    node.userData.tissueRegion = region;
    allocated.add(geometry); parent.add(node); return node;
  };
  const opening = { width: 0, height: 0, progress: 0 };
  const cavity = mesh('DeepThoracicCavity', cavityGeometry(phase), cavityMaterial);
  cavity.renderOrder = -1;

  const heart = new THREE.Group(); heart.name = 'HarvestHeart'; heart.position.set(-.04, .095, .025); interior.add(heart);
  const heartGeometry = organSurface((u, v) => {
    const ring = Math.sqrt(Math.max(0, 1 - v * v)), top = Math.max(0, v), bottom = Math.max(0, -v);
    const ventricularMass = .075 * Math.exp(-(((v + .32) / .42) ** 2)) * Math.cos(u - .25);
    const lobes = 1 + .14 * Math.cos(2 * u + .35) * top + ventricularMass + .025 * Math.sin(5 * u + phase) * ring;
    const taper = 1 - .32 * bottom;
    return vec(.034 * ring * lobes * taper * Math.cos(u) + .009 * v, .047 * v - .005 * Math.cos(u) * ring, .025 * ring * lobes * taper * Math.sin(u) + .004 * Math.sin(3 * u) * ring * top);
  }, [.44, .055, .08], phase, 28, 16);
  const arteries = [sweptTube([vec(-.007, .031, -.003), vec(-.01, .049, -.006), vec(.002, .058, -.009)], .007, [.42, .065, .09], phase, 8, 6).geometry,
    sweptTube([vec(.016, .025, -.004), vec(.022, .045, -.006), vec(.033, .052, -.006)], .0048, [.42, .065, .09], phase, 7, 6).geometry];
  mesh('LobedHeartAndGreatVessels', mergeGeometry([heartGeometry, ...arteries]), tissueMaterial, heart);

  const lungParts = [-1, 1].map(side => organSurface((u, v) => {
    const r = Math.sqrt(Math.max(0, 1 - v * v));
    const lowerLobe = .09 * Math.exp(-(((v + .49) / .3) ** 2));
    const upperLobe = .045 * Math.exp(-(((v - .37) / .36) ** 2));
    const obliqueFissure = .036 * Math.exp(-(((v + .13 + .1 * Math.cos(u)) / .09) ** 2));
    const lobulation = 1 + lowerLobe + upperLobe - obliqueFissure + .018 * Math.cos(u * 5 + phase) * r;
    // The medial cardiac notch and tapered apex distinguish lungs from ovals.
    const notch = 1 - .26 * Math.max(0, -side * Math.cos(u)) * Math.exp(-(((v + .15) / .38) ** 2));
    return vec(side * .09 + .05 * r * lobulation * notch * Math.cos(u) * variation, .108 + .089 * v + side * .0015 * r, -.021 + .032 * r * Math.sin(u) + .006 * v);
  }, side > 0 ? [.45, .25, .27] : [.41, .21, .25], phase + side, 22, 13));
  mesh('PairedLobulatedLungs', mergeGeometry(lungParts), tissueMaterial);
  mesh('RightUpperLiver', organSurface((u, v) => {
    const r = Math.sqrt(Math.max(0, 1 - v * v));
    const lobe = 1 + .19 * Math.cos(u + .3) * r + .035 * Math.sin(u * 5 + phase) * Math.sin(v * 4);
    return vec(.047 + .075 * r * Math.cos(u) * lobe, -.035 + .034 * v + .012 * Math.cos(u) * r, -.021 + .031 * r * Math.sin(u) - .007 * Math.cos(u));
  }, [.28, .055, .065], phase, 26, 13), tissueMaterial);
  mesh('LeftUpperStomach', organSurface((u, v) => {
    const r = Math.sqrt(Math.max(0, 1 - v * v)), pouch = 1 - .27 * v + .035 * Math.cos(v * 12 + phase);
    return vec(-.059 + .034 * r * Math.cos(u) * pouch + .019 * v * v, -.042 + .055 * v, .003 + .026 * r * Math.sin(u) + .006 * v);
  }, [.54, .27, .27], phase, 24, 13), tissueMaterial);
  mesh('PosteriorKidneys', mergeGeometry([-1, 1].map(side => organSurface((u, v) => {
    const r = Math.sqrt(Math.max(0, 1 - v * v)), hilum = 1 - .38 * Math.max(0, -side * Math.cos(u)) * Math.exp(-((v / .42) ** 2));
    return vec(side * .108 + .025 * r * Math.cos(u) * hilum, -.073 + .043 * v, -.062 + .019 * r * Math.sin(u));
  }, [.33, .11, .16], phase + side, 20, 12))), tissueMaterial);
  mesh('Spleen', organSurface((u, v) => {
    const r = Math.sqrt(Math.max(0, 1 - v * v));
    return vec(-.121 + .017 * r * Math.cos(u) * (1 + .09 * Math.sin(v * 9)), -.023 + .04 * v, -.032 + .019 * r * Math.sin(u));
  }, [.29, .075, .14], phase, 18, 11), tissueMaterial);

  const colonPoints = [vec(.09, -.184, -.012), vec(.123, -.15, -.008), vec(.12, -.082, -.013), vec(.089, -.06, -.009), vec(.038, -.071, .004), vec(-.027, -.065, .01), vec(-.097, -.075, -.004), vec(-.122, -.111, -.005), vec(-.12, -.174, -.009), vec(-.086, -.201, -.004), vec(-.025, -.21, -.016)];
  mesh('HaustratedColon', sweptTube(colonPoints, .014, [.47, .23, .24], phase, 50, 8, false, .095).geometry, tissueMaterial);
  const coilPoints = [];
  // Six broad passes, joined into one continuous gut and staggered in depth.
  // It remains a single physics chain rather than disconnected torus loops.
  for (let row = 0; row < 6; row++) for (let column = 0; column < 5; column++) {
    const fraction = column / 4, direction = row % 2 ? 1 - fraction : fraction;
    const sweep = -.082 + .164 * direction;
    const tilt = .07 * Math.sin(row * 1.9 + phase);
    coilPoints.push(vec(sweep + .006 * Math.sin(phase + row * 1.6), -.076 - row * .022 - .01 * Math.sin(Math.PI * fraction) + tilt * sweep + .007 * Math.sin(row * 1.4 + direction * 2.2 + phase), .023 + .011 * Math.sin(row * 1.8 + fraction * 2 + phase)));
  }
  const intestineTube = sweptTube(coilPoints, .0096, [.57, .28, .27], phase, 87, 8, true, .035);
  const intestines = mesh('ContinuousSmallIntestine', intestineTube.geometry, tissueMaterial);
  intestines.frustumCulled = false;

  const ribParts = [];
  for (const side of [-1, 1]) for (let rib = 0; rib < 6; rib++) {
    const y = .176 - rib * .027, breadth = .129 + .0038 * rib;
    const frontEnd = 2.5 - rib * .027 + .035 * Math.sin(rib * 1.7 + phase + side);
    const arc = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8, theta = .31 + (frontEnd - .31) * t;
      // Each bone wraps from the posterior attachment around a deep thorax
      // ellipse. Broken anterior ends leave an organic open midline.
      return vec(side * breadth * Math.sin(theta), y - (.015 + rib * .0012) * Math.sin(t * Math.PI) - .007 * t + side * .002 * Math.sin(rib + phase), -.028 - .056 * Math.cos(theta) + .0025 * Math.sin(rib * 1.3 + phase) * t);
    });
    const taper = t => (.0039 - rib * .0001) * (1 - .28 * t + .08 * Math.sin(Math.PI * t));
    ribParts.push(sweptTube(arc, taper, [.61, .53, .4], phase + rib, 8, 6, false, .025).geometry);
  }
  // Only short fractured manubrium wings remain, rather than straight
  // ladder-like uprights beside the heart.
  for (const side of [-1, 1]) ribParts.push(sweptTube([vec(side * .024, .186, .011), vec(side * .035, .178, .018), vec(side * .056, .173, .021)], t => .0045 * (1 - .28 * t), [.62, .54, .42], phase, 7, 6, false, .035).geometry);
  mesh('SplitSternumAndRibArcs', mergeGeometry(ribParts), boneMaterial);
  const rimPoints = Array.from({ length: 33 }, (_, i) => {
    const angle = i * TAU / 32, tear = 1 + .045 * Math.sin(angle * 11 + phase) + .025 * Math.sin(angle * 17);
    return vec(.146 * Math.cos(angle) * tear, -.016 + .2 * Math.sin(angle) * tear, .021 + .007 * Math.sin(angle * 9 + phase));
  });
  const rim = mesh('TornFleshWoundRim', sweptTube(rimPoints, .0105, [.39, .075, .1], phase, 60, 6, false, .16).geometry, fleshMaterial, root);
  const flaps = [-1, 1].map(side => {
    const data = skinFlap(side, phase);
    return { ...data, side, node: mesh(side < 0 ? 'LeftTornSkinFlap' : 'RightTornSkinFlap', data.geometry, skinMaterial, root) };
  });

  let lastOpening = NaN, sourceSkin = false;
  function setOpening(amount) {
    const progress = clamp(Number.isFinite(amount) ? amount : 0, 0, 1), eased = smooth(progress);
    if (progress === lastOpening) return opening;
    lastOpening = progress;
    opening.progress = progress; opening.width = .282 * eased; opening.height = .407 * Math.sqrt(eased);
    interior.visible = progress > .015; rim.visible = !sourceSkin && progress > .01;
    for (const flap of flaps) {
      flap.node.visible = !sourceSkin;
      if(sourceSkin)continue;
      const position = flap.geometry.attributes.position;
      for (let row = 0; row <= flap.length; row++) for (let column = 0; column <= flap.across; column++) {
        const id = row * (flap.across + 1) + column, u = column / flap.across;
        const x = flap.original[id * 3], y = flap.original[id * 3 + 1], z = flap.original[id * 3 + 2];
        // Retract the torn inner edge toward its attached outer edge. The full
        // anatomy retains its authored dimensions throughout the reveal.
        const boundary = .145 * Math.pow(Math.sin(Math.PI * row / flap.length), .45);
        const retract = eased * (1 - u) * Math.max(0, boundary - Math.abs(x));
        position.setXYZ(id, x + flap.side * retract, y, z + eased * .026 * (1 - u));
      }
      position.needsUpdate = true; flap.geometry.computeVertexNormals(); flap.geometry.computeBoundingBox(); flap.geometry.computeBoundingSphere();
    }
    root.userData.opening = opening;
    return opening;
  }
  setOpening(0);

  function diagnostics() {
    let triangles = 0, vertices = 0, meshes = 0;
    root.traverse(node => { if (node.isMesh) { meshes++; vertices += node.geometry.attributes.position.count; triangles += node.geometry.index.count / 3; } });
    let coilLength = 0; for (let i = 1; i < coilPoints.length; i++) coilLength += coilPoints[i].distanceTo(coilPoints[i - 1]);
    return { seed, triangles, vertices, meshes, draws: meshes, materials: materials.length, coilPoints: coilPoints.length, coilLength, opening: { ...opening }, procedural: true, dynamicIntestineTopology: true };
  }
  function dispose() {
    for (const geometry of allocated) geometry.dispose();
    for (const material of materials) material.dispose();
    allocated.clear(); root.removeFromParent();
  }
  function useSourceSkin(){sourceSkin=true;rim.visible=false;for(const flap of flaps)flap.node.visible=false;}
  return { root, heart, intestines, coilPoints, opening, setOpening, useSourceSkin, updateIntestines: intestineTube.write, diagnostics, dispose };
}
