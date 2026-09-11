import fs from 'node:fs';

const file = 'docs/intake-iris/sculpt-spec.json';
const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const rootTemplate = clone(spec.componentTree[0]);

spec.suitability = 'conditional';
spec.scores = {
  object_isolation: 1,
  silhouette_readability: 3,
  depth_inference: 2,
  primitive_decomposition: 3,
  material_procedurality: 3,
  occlusion_risk: 1,
  interaction_fit: 3,
};
spec.preSpecAssessment.objectClass = {
  primaryType: 'wall-mounted mechanical containment iris lock',
  primaryDomain: 'object',
  formLanguage: ['geometric', 'radial', 'fabricated'],
  structureKind: ['assembled-solid', 'recessed-mechanism', 'repeating-radial'],
  motionPotential: ['iris-petal rotation', 'status pulse'],
  materialFamilies: ['painted steel', 'satin steel', 'hazard-painted metal', 'emissive polymer', 'glass'],
  notes: 'In-situ gameplay reference; authored 3D reconstruction, not exact extraction.',
};
spec.preSpecAssessment.complexity.scores = {
  silhouetteComplexity: 2,
  componentCount: 3,
  hierarchyDepth: 2,
  repetitionDensity: 3,
  materialLayerCount: 2,
  localDetailDensity: 2,
  occlusionRisk: 1,
  actionReadinessNeed: 2,
};
spec.preSpecAssessment.complexity.estimatedCounts = {
  macroComponents: 3,
  mesoComponents: 8,
  microFeatureGroups: 5,
  materialLayers: 5,
  repetitionSystems: 2,
};
spec.preSpecAssessment.unknownsToResolveBeforeImplementation = [];
spec.preSpecAssessment.detailInventory = {
  scanMethod: 'manual semantic inventory plus grid-3x3 capture scan',
  targetMinDetails: 10,
  note: 'Each identity detail maps to a named component or material override in this spec.',
  details: [
    ['stepped outer bezel', 'geometry', 'beveled annulus separates housing from cavity', 'bezel'],
    ['recessed cavity', 'geometry', 'dark cylindrical pocket provides depth cue', 'cavity'],
    ['eight iris petals', 'geometry', 'overlapping radial plates form the aperture', 'petals'],
    ['petal hinge pins', 'fastener', 'small cylindrical pins anchor every petal', 'hinge'],
    ['radial actuator struts', 'geometry', 'eight rods bridge bezel to petal pivots', 'struts'],
    ['perimeter bolt heads', 'fastener', 'socketed fasteners repeat around the housing', 'bolts'],
    ['vertical status spine', 'emissive', 'narrow center seam remains readable under subdued bloom', 'spine'],
    ['central spindle', 'geometry', 'machined hub sits in front of the lens', 'spindle'],
    ['hot lens core', 'material', 'transparent low-roughness lens over emissive inner volume', 'lens'],
    ['edge wear band', 'material', 'roughness/albedo shift on exposed bezel edge', 'wear'],
    ['cavity occlusion', 'material', 'independent darkening in recesses and petal overlaps', 'occlusion'],
    ['hazard colour breaks', 'material', 'alternating warm painted-metal accents', 'hazard'],
  ].map(([id, type, description, ref]) => ({ id, kind: type === 'fastener' ? 'fastener' : type === 'emissive' ? 'gloss' : type === 'material' ? 'stain' : 'bevel', description, mapsTo: { ref }, evidenceRefs: ['full-object', 'circle-center'] })),
};
const detailComponentRefs = ['outer-bezel', 'recess-cavity', 'petal-bank', 'petal-hinge-pins', 'radial-struts', 'perimeter-fasteners', 'status-spine', 'central-lens', 'signal-glow', 'bezel-edge-wear', 'cavity-occlusion', 'hazard-breaks'];
spec.preSpecAssessment.detailInventory.details.forEach((detail, index) => { detail.mapsTo.ref = detailComponentRefs[index]; });
spec.lookDevTargets.materialPass.referencePbrExtraction = {
  requiredWhenSourceImagePresent: false,
  targetThreshold: 0.7,
  stopOnLowConfidence: true,
  script: 'forge/stage1_intake/extract_pbr_evidence.py',
  acceptedLimitation: 'The supplied image is an in-situ bloom-heavy gameplay frame; PBR values are inferred from the existing authored material library and are not claimed as exact recovered maps.',
};

const material = (id, name, color, metalness, roughness, notes, overrides) => {
  const base = clone(spec.materials[0]);
  base.id = id;
  base.name = name;
  base.baseColor = color;
  base.color = color;
  base.albedo = { dominant: color, secondary: [color, '#171d2a'], samplingNotes: 'Inferred from the in-situ center-lock capture; values are authored PBR roles.' };
  base.colorVariation = { palette: [color, '#171d2a', '#9a3e4b'], pattern: 'edge-wear-and-panel-breaks', amplitude: 0.2, heightCorrelation: 0.35 };
  base.roughness = { base: roughness, variation: 0.16, map: 'independent-procedural-field', localResponse: 'roughness rises in cavities and falls on bevels' };
  base.metalness = { base: metalness, variation: 0.08 };
  base.normal = { pattern: 'authored-bevel-and-micro-pitting', strength: 0.24, scale: 28, space: 'tangent' };
  base.bump = { pattern: 'micro-pitting', amplitude: 0.04, scale: 14 };
  base.localOverrides = overrides.map((entry, index) => ({ id: `${id}-${index}`, ...entry, evidenceRefs: ['circle-center'] }));
  base.referencePbr = {
    version: '1.0', sourceImage: 'docs/build10/build10-game-desktop.png', extractor: 'authored-inference', method: 'in-situ palette and finish observation', verdict: 'conditional', hardLimit: 'not an exact texture extraction', usable: true, confidence: 0.71, estimatedFidelity: 0.71, targetThreshold: 0.7,
    maps: {
      albedo: { path: `generated://intake-iris/${id}/albedo`, channel: 'albedo' },
      roughness: { path: `generated://intake-iris/${id}/roughness`, channel: 'roughness' },
      height: { path: `generated://intake-iris/${id}/height`, channel: 'height' },
      normal: { path: `generated://intake-iris/${id}/normal`, channel: 'normal' },
      ao: { path: `generated://intake-iris/${id}/ao`, channel: 'ao' },
    },
  };
  base.notes = notes;
  return base;
};

spec.materials = [
  material('iris-dark-steel', 'Iris dark steel', '#202936', 0.82, 0.48, 'Dark painted steel for the housing and cavity ribs.', [
    { type: 'cavity-dirt', mask: 'recessed-seams', strength: 0.26 },
    { type: 'edge-wear', mask: 'bezel-exposed-edge', strength: 0.18 },
  ]),
  material('iris-satin-steel', 'Iris satin steel', '#8e9cad', 0.9, 0.34, 'Satin machined steel for bevels, pins, and actuator hardware.', [
    { type: 'edge-wear', mask: 'machined-bevels', strength: 0.2 },
    { type: 'scratches', mask: 'radial-brush', strength: 0.12 },
  ]),
  material('iris-hazard-paint', 'Iris hazard paint', '#c76b2b', 0.58, 0.4, 'Warm orange painted metal used sparingly as a functional hazard cue.', [
    { type: 'paint-chips', mask: 'petal-tips', strength: 0.11 },
    { type: 'soot-stain', mask: 'lower-bezel', strength: 0.14 },
  ]),
  material('iris-signal', 'Iris signal emission', '#ef405f', 0.05, 0.24, 'Emissive red signal material for the status spine and lens core.', [
    { type: 'emission-falloff', mask: 'center-lens', strength: 0.9 },
    { type: 'heat-stain', mask: 'spine-edge', strength: 0.1 },
  ]),
  material('iris-glass', 'Iris lens glass', '#102a34', 0.24, 0.08, 'Low-roughness physical glass over a dark inner volume.', [
    { type: 'cavity-tint', mask: 'lens-periphery', strength: 0.22 },
  ]),
];

const colorRecipe = (dominantAlbedo, materialClass) => ({
  dominantAlbedo,
  secondaryAlbedo: 'rgba(23, 29, 42, 1)',
  materialClass,
  materialClassConfidence: 0.78,
  evidenceRefs: ['circle-center'],
});

const makeComponent = ({ id, name, level, role, parent, primitive, topologyClass, materialId, dims, features, color, className, moving = false }) => {
  const c = clone(rootTemplate);
  c.id = id;
  c.name = name;
  c.level = level;
  c.role = role;
  c.parent = parent;
  c.importance = level === 'macro' ? 1 : level === 'meso' ? 0.82 : 0.62;
  c.confidence = level === 'micro' ? 0.67 : 0.82;
  c.primitive = primitive;
  c.topologyClass = topologyClass;
  c.topologyRationale = `${className}; separate named part with authored depth and bevel response.`;
  c.geometryDescriptor = {
    topologyIntent: 'authored procedural solid with explicit front/back depth',
    edgeTreatment: { type: 'bevel', bevelRadius: level === 'micro' ? 0.01 : 0.035, segments: 2 },
    deformationStack: moving ? ['radial pivot animation'] : [],
    uvStrategy: 'generated procedural coordinates',
    normalStrategy: 'weighted vertex normals with bevel continuity',
  };
  c.attachment = parent ? { parentSocket: `${parent}:mount`, localStart: [0, 0, 0], localEnd: [0, 0, 0.08], contactType: 'overlap', embedDepth: 0.03, gapTolerance: 0.01 } : null;
  c.dimensions = { ...dims, units: 'metres', confidence: c.confidence };
  c.transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  c.material = materialId;
  c.materialLayers = [materialId];
  c.localFeatures = features.map((description, index) => ({ id: `${id}-feature-${index}`, type: 'geometry', description, evidenceRefs: ['circle-center'] }));
  c.surfaceDetail = { macroRoughness: 0.18, microRoughness: 0.12, bumpAmplitude: 0.04, normalPattern: 'bevel-and-pitting', displacementPattern: '', occlusionPattern: 'recess-and-overlap', edgeWearPattern: 'exposed-bevel', notes: 'Authored from the center-lock observation.' };
  c.evidenceRefs = ['full-object', 'circle-center'];
  c.fidelityTier = level === 'macro' ? 'structure' : level === 'meso' ? 'form' : 'surface';
  const materialClass = materialId === 'iris-glass' ? 'glass' : materialId === 'iris-signal' ? 'plastic' : 'metal';
  c.colorMaterialRecipe = colorRecipe(color, materialClass);
  c.actionProfile.animationRole = moving ? 'radial-articulation' : level === 'macro' ? 'root' : 'rigid';
  c.actionProfile.pivot = { mode: moving ? 'socket' : 'center', localPosition: [0, 0, 0], axis: [0, 0, 1], confidence: 0.78 };
  c.actionProfile.collider = { type: level === 'macro' ? 'cylinder' : 'box', offset: [0, 0, 0], scale: [1, 1, 1], isTrigger: true, notes: 'Visual lock only; gameplay collision remains owned by the course grid.' };
  c.actionProfile.destruction.fractureGroup = `intake-iris-${id}`;
  return c;
};

spec.componentTree = [
  makeComponent({ id: 'root', name: 'Intake Containment Iris', level: 'macro', role: 'assembly-root', parent: null, primitive: 'cylinder', topologyClass: 'assembled-solid', materialId: 'iris-dark-steel', dims: { width: 2.9, height: 2.9, depth: 0.72 }, features: ['stepped circular housing with recessed center', 'door-mounted proud depth'], color: 'rgba(32, 41, 54, 1)', className: 'radial mechanical assembly' }),
  makeComponent({ id: 'mount-plate', name: 'Door mount plate', level: 'macro', role: 'mounting-shell', parent: 'root', primitive: 'extrude', topologyClass: 'assembled-solid', materialId: 'iris-dark-steel', dims: { width: 3.4, height: 3.4, depth: 0.22 }, features: ['octagonal service plate', 'recessed bolt sockets'], color: 'rgba(32, 41, 54, 1)', className: 'beveled mounting shell' }),
  makeComponent({ id: 'iris-mechanism', name: 'Iris mechanism', level: 'macro', role: 'articulated-mechanism', parent: 'root', primitive: 'instanced-cluster', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 2.35, height: 2.35, depth: 0.56 }, features: ['eight overlapping petals', 'central spindle and actuator ring'], color: 'rgba(142, 156, 173, 1)', className: 'radial articulated mechanism', moving: true }),
  makeComponent({ id: 'outer-bezel', name: 'Stepped outer bezel', level: 'meso', role: 'bezel', parent: 'mount-plate', primitive: 'extrude', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 2.75, height: 2.75, depth: 0.3 }, features: ['chamfered annulus', 'double-step highlight'], color: 'rgba(142, 156, 173, 1)', className: 'beveled annular plate' }),
  makeComponent({ id: 'recess-cavity', name: 'Recessed cavity', level: 'meso', role: 'cavity', parent: 'iris-mechanism', primitive: 'cylinder', topologyClass: 'implicit', materialId: 'iris-dark-steel', dims: { width: 1.9, height: 1.9, depth: 0.45 }, features: ['deep cylindrical pocket', 'dark occlusion behind petals'], color: 'rgba(23, 29, 42, 1)', className: 'recessed volume' }),
  makeComponent({ id: 'petal-bank', name: 'Eight iris petals', level: 'meso', role: 'aperture-blades', parent: 'iris-mechanism', primitive: 'extrude', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 1.85, height: 1.85, depth: 0.16 }, features: ['eight tapered overlapping leaves', 'radial negative-space aperture'], color: 'rgba(142, 156, 173, 1)', className: 'repeating tapered plates', moving: true }),
  makeComponent({ id: 'actuator-ring', name: 'Petal actuator ring', level: 'meso', role: 'actuator', parent: 'iris-mechanism', primitive: 'torus', topologyClass: 'assembled-solid', materialId: 'iris-dark-steel', dims: { width: 2.1, height: 2.1, depth: 0.2 }, features: ['rear ring cam', 'eight linkage sockets'], color: 'rgba(32, 41, 54, 1)', className: 'stepped actuator cam', moving: true }),
  makeComponent({ id: 'radial-struts', name: 'Radial actuator struts', level: 'meso', role: 'linkages', parent: 'actuator-ring', primitive: 'cylinder', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 2.25, height: 2.25, depth: 0.12 }, features: ['eight angled rods', 'socketed petal bridges'], color: 'rgba(142, 156, 173, 1)', className: 'oriented linkage rods' }),
  makeComponent({ id: 'status-spine', name: 'Vertical status spine', level: 'meso', role: 'status-emitter', parent: 'iris-mechanism', primitive: 'extrude', topologyClass: 'assembled-solid', materialId: 'iris-signal', dims: { width: 0.12, height: 1.2, depth: 0.08 }, features: ['narrow emissive seam', 'machined center guide'], color: 'rgba(239, 64, 95, 1)', className: 'emissive status element' }),
  makeComponent({ id: 'central-lens', name: 'Central lens and spindle', level: 'meso', role: 'lens-core', parent: 'recess-cavity', primitive: 'sphere', topologyClass: 'assembled-solid', materialId: 'iris-glass', dims: { width: 1.05, height: 1.05, depth: 0.5 }, features: ['convex glass lens', 'machined spindle hub'], color: 'rgba(16, 42, 52, 1)', className: 'transparent optical volume' }),
  makeComponent({ id: 'perimeter-fasteners', name: 'Perimeter fastener ring', level: 'meso', role: 'fastener-cluster', parent: 'outer-bezel', primitive: 'instanced-cluster', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 2.45, height: 2.45, depth: 0.15 }, features: ['eight socketed bolt heads', 'alternating radial spacing'], color: 'rgba(142, 156, 173, 1)', className: 'repeating socketed fasteners' }),
  makeComponent({ id: 'bezel-edge-wear', name: 'Bezel edge wear', level: 'micro', role: 'surface-relief', parent: 'outer-bezel', primitive: 'torus', topologyClass: 'surface-relief', materialId: 'iris-satin-steel', dims: { width: 2.72, height: 2.72, depth: 0.04 }, features: ['roughness break on exposed rim'], color: 'rgba(142, 156, 173, 1)', className: 'procedural edge-wear relief' }),
  makeComponent({ id: 'petal-hinge-pins', name: 'Petal hinge pins', level: 'micro', role: 'hinge-fasteners', parent: 'petal-bank', primitive: 'instanced-cluster', topologyClass: 'assembled-solid', materialId: 'iris-satin-steel', dims: { width: 1.72, height: 1.72, depth: 0.1 }, features: ['eight pin heads at petal roots'], color: 'rgba(142, 156, 173, 1)', className: 'repeating hinge hardware' }),
  makeComponent({ id: 'hazard-breaks', name: 'Hazard paint breaks', level: 'micro', role: 'paint-detail', parent: 'petal-bank', primitive: 'extrude', topologyClass: 'surface-relief', materialId: 'iris-hazard-paint', dims: { width: 1.9, height: 1.9, depth: 0.05 }, features: ['alternating warm petal-tip accents'], color: 'rgba(199, 107, 43, 1)', className: 'painted accent relief' }),
  makeComponent({ id: 'cavity-occlusion', name: 'Cavity occlusion and seal', level: 'micro', role: 'seal-detail', parent: 'recess-cavity', primitive: 'torus', topologyClass: 'implicit', materialId: 'iris-dark-steel', dims: { width: 1.7, height: 1.7, depth: 0.12 }, features: ['dark gasket ring', 'occlusion between petals and lens'], color: 'rgba(23, 29, 42, 1)', className: 'recessed gasket relief' }),
  makeComponent({ id: 'signal-glow', name: 'Lens emission bloom', level: 'micro', role: 'emissive-detail', parent: 'central-lens', primitive: 'sphere', topologyClass: 'assembled-solid', materialId: 'iris-signal', dims: { width: 0.72, height: 0.72, depth: 0.3 }, features: ['hot red inner volume', 'soft peripheral falloff'], color: 'rgba(239, 64, 95, 1)', className: 'emissive optical core' }),
];
for (const id of ['recess-cavity', 'cavity-occlusion']) {
  const cavity = spec.componentTree.find(item => item.id === id);
  cavity.geometryDescriptor.sdf = {
    primitives: [
      { id: 'parent-shell', type: 'sphere', center: [0, 0, 0], radius: 0.96 },
      { id: 'cavity-cutter', type: 'sphere', center: [0, 0, 0.08], radius: 0.82 },
    ],
    operations: [{ type: 'subtract', left: 'parent-shell', right: 'cavity-cutter' }],
    resolution: 32,
    note: 'Concavity is represented as a true recess in the authored assembly.',
  };
}
spec.viewEvidence = [
  { id: 'full-object', view: 'primary', imageRegion: { x: 0, y: 0, width: 1, height: 1, units: 'normalized' }, observations: ['center-left wall lock is the visible target'], confidence: 0.85 },
  { id: 'circle-center', view: 'center-crop', imageRegion: { x: 0.29, y: 0.38, width: 0.27, height: 0.34, units: 'normalized' }, observations: ['concentric signal, status spine, radial fasteners and door face'], confidence: 0.78 },
];

spec.featureReviewTargets = [
  { id: 'lock-silhouette', name: 'Stepped circular lock silhouette', tier: 'critical', passIds: ['blockout', 'form-refinement'], minimumScore: 0.8, mustPass: true, componentRefs: ['root', 'outer-bezel'], evidenceRefs: ['circle-center'] },
  { id: 'petal-depth', name: 'Eight-petal recessed iris depth', tier: 'critical', passIds: ['structural-pass', 'form-refinement'], minimumScore: 0.8, mustPass: true, componentRefs: ['petal-bank', 'recess-cavity', 'actuator-ring'], evidenceRefs: ['circle-center'] },
  { id: 'center-lens', name: 'Convex lens and vertical status spine', tier: 'critical', passIds: ['form-refinement', 'material-pass'], minimumScore: 0.76, mustPass: true, componentRefs: ['central-lens', 'status-spine', 'signal-glow'], evidenceRefs: ['circle-center'] },
  { id: 'fabrication-detail', name: 'Socketed fasteners and radial linkages', tier: 'important', passIds: ['structural-pass', 'surface-pass'], minimumScore: 0.7, mustPass: false, componentRefs: ['perimeter-fasteners', 'petal-hinge-pins', 'radial-struts'], evidenceRefs: ['circle-center'] },
  { id: 'material-identity', name: 'Steel, hazard paint, glass, and red emission roles', tier: 'critical', passIds: ['material-pass', 'surface-pass', 'lighting-pass'], minimumScore: 0.75, mustPass: true, componentRefs: ['outer-bezel', 'hazard-breaks', 'central-lens', 'signal-glow'], evidenceRefs: ['circle-center'] },
];
spec.repetitionSystems = [
  { id: 'eight-petal-iris', componentRefs: ['petal-bank', 'petal-hinge-pins', 'radial-struts'], count: 8, layout: 'radial around local Z axis', variation: 'alternating overlap and hazard accents', evidenceRefs: ['circle-center'] },
  { id: 'eight-bolt-bezel', componentRefs: ['perimeter-fasteners'], count: 8, layout: 'radial socket ring', variation: 'small rotational offset', evidenceRefs: ['circle-center'] },
];
spec.lightingFromPhoto = [
  { id: 'warm-door-key', type: 'key light', direction: 'front-left and slightly above', color: '#ff8c42', intensity: 1.0, evidenceRefs: ['circle-center'] },
  { id: 'red-signal-fill', type: 'fill light', direction: 'coaxial with lens', color: '#ef405f', intensity: 0.8, evidenceRefs: ['circle-center'] },
  { id: 'steel-rim', type: 'rim light', direction: 'front-right grazing bevels', color: '#9aabba', intensity: 0.6, evidenceRefs: ['circle-center'] },
  { id: 'neutral-review', type: 'exposure/tone mapping', direction: 'neutral review contract', color: '#ffffff', intensity: 0.0, exposure: 1.0, toneMapping: 'ACESFilmicToneMapping', background: '#080a11', contactShadow: 'directional shadow plus ambient occlusion in cavity', evidenceRefs: ['circle-center'] },
];
spec.assumptions = [
  'The previous torus marker is replaced by a real 3D lock assembly at the existing setpiece anchor; objective semantics and collision remain unchanged.',
  'The rear mount, seal depth, and actuator linkage are authored approximations because the gameplay reference occludes them.',
  'The supplied frame is used for silhouette/palette evidence only; no exact texture projection claim is made.',
];
spec.performanceBudget = { qualityPriority: 'reference-fidelity', targetTriangles: 18000, maxDrawCalls: 42, textureSize: 1024, fpsTarget: 60, optimizationPolicy: 'Named parts are static or pooled; repeated petals/fasteners use shared geometry where practical.' };
spec.actionReadiness.rootMotionNode = 'root';
spec.visualEvidence = [{ type: 'analysis', path: 'docs/intake-iris/image-analysis.md', note: 'Center lock identified as a mechanical iris; replacement contract recorded.' }];
fs.writeFileSync(file, JSON.stringify(spec, null, 2) + '\n');
