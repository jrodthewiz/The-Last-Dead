import {applyWeaponGrime} from './weapon-grime.js';
import {updateSurvivors,prepareSurvivors,disposeSurvivors} from './assets/survivor/survivor-runtime.js';
import {installViewmodelDepthBoundary} from './assets/survivor/viewmodel-depth.js';
import * as THREE from './vendor/three.module.js';
import {buildHorrorDetails} from './world-horror.js';
import {buildDungeonCover} from './dungeon-cover-kit.js';
import {buildDungeonWeaponLoot,updateDungeonWeaponLoot} from './dungeon-weapon-loot.js';
import {buildDungeonEvidence,updateDungeonEvidence} from './dungeon-evidence.js';
import {DungeonSupplies} from './dungeon-supplies.js';
import {ScavengerCaches} from './scavenger-pack-ui.js';
import {districtPanelSkin,districtPanelTint,isAnnexWall} from './district-materials.js';
import {installOssuaryFitting,updateOssuaryFitting} from './scavenger-fitting.js';
import {HarborWorld,HARBOR_PALETTE} from './harbor-visuals.js';
import {castRay} from './engine.js';
import {JourneyVisuals} from './journey-visuals.js';
import {buildCathedralKit,batchStaticWorld} from './world-polish.js';
import {finalizeStaticWorld} from './world-static.js';
import {roomMaterialsReady} from './room-materials.js';
import {TransmissionRegion} from './transmission-region.js';
import {BodycamPass} from './bodycam-pass.js';
import {BodycamMotion} from './bodycam-motion.js';
import {batchStaticWeaponMeshes} from './weapon-batching.js';
import {installBoundedLightEvaluation} from './bounded-lighting.js';
import {AfterlifeLighting,afterlifeTheme} from './afterlife-lighting.js';
import {AfterlifeAtmosphere} from './afterlife-atmosphere.js';
import {applyAfterlifeSurfaces} from './afterlife-surfaces.js';
import {buildAfterlifeMapDesign} from './world-afterlife-design.js';
import {createAfterlifeWheelchair, createAfterlifeMourningCabinet} from './afterlife-props.js';
import {createAfterlifeEnemy,animateAfterlifeEnemy} from './npc-afterlife.js';
import {loadAfterlifeModel,createAfterlifeModel,animateAfterlifeModel} from './npc-afterlife-model.js';
import {HorrorScares} from './horror-scares-game.js';
import {HorrorEncounterVisuals} from './horror-encounter-visuals.js';
import {HorrorCuffVisuals} from './horror-cuff-visuals.js';
import {ENEMY_PROFILES} from './campaign.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {loadGlb} from './assets/load-glb.js';
import {createReliquary,animateReliquary} from './weapon-reliquary.js';
import {createBellwraith,animateBellwraith,warmBellwraithVariants} from './npc-bellwraith.js';
import {createWarden,animateWarden} from './npc-warden.js';
import {enemyFxBegin,enemyFxEnd} from './enemy-fx.js';
import {createOssuary,animateOssuary} from './weapon-ossuary.js';
import {createBreach,animateBreach} from './weapon-breach.js';
import {createArc,animateArc} from './weapon-arc.js';
import {createRifle,animateRifle} from './weapon-rifles.js';
import {RifleCasings} from './weapon-casings.js';
import {WeaponPresentation} from './weapon-presentation.js';
import {createMeleeWeapon,animateMeleeWeapon} from './weapon-melee.js';
import {alignViewmodelArmToGrip} from './assets/survivor/viewmodel-arms.js';
import {fitForegroundArms} from './assets/survivor/foreground-arms.js';
import {createSurvivorViewArm} from './assets/survivor/player-survivor.js';
import {CombatVFX} from './combat-vfx.js';
import {ExtractionVFX} from './extraction-vfx.js';
import {PlayerInjuryVisuals} from './player-injury-visuals.js';
import {BrutalCombatVisuals} from './brutal-combat-visuals.js';
import {VerminVisuals} from './vermin-visuals.js';
import {applyBiteArticulation,articulationDiagnostics} from './character-articulation.js';
import {MenuCinematic} from './menu-cinematic.js';
import {ProjectileWakes} from './secondary-vfx.js';
import {fluidDropGeometry,coreCanisterGeometry,ricochetCoinGeometry,OrdnanceDetails} from './combat-detail-v2.js';
import {createBloodResiduePool,bloodAtlasReady,disposeBloodAtlas} from './blood-surface.js';

// Dead Arrival's simulation is authored in 4 metre cells. The renderer keeps
// that scale explicit so camera motion, weapon framing, and enemy proportions
// stay consistent as the arena grows.
const CELL = 4;
const MAX_GORE = 260;
const MAX_BLOOD = 128;

const MAX_ENEMY_SHADOWS = 96;
const MAX_PROJECTILES = 96;
const MAX_TRACERS = 128;
const MAX_COINS = 64;
const MAX_SPAWN_TELEGRAPHS = 64;
const TAU = Math.PI * 2;
// These menu-derived variants share one rig and locomotion set; scale changes stay in the enemy profile.
const BLOODWORKS_WARDEN_VARIANTS = new Set(['warden', 'wardenBulwark', 'wardenColossus']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WHITE_HOT = new THREE.Color(0xfff3dc);
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * Math.max(0, dt)));
const dampAngle = (a, b, lambda, dt) => {
  let d = Math.atan2(Math.sin(b-a),Math.cos(b-a));
  return a + d * (1 - Math.exp(-lambda * Math.max(0, dt)));
};
const worldX = x => x * CELL;
const worldZ = y => y * CELL;
const enemyColor = kind => [0xef405f, 0x9d67f5, 0xff8c42][kind % 3];
const markSharedGltf = scene => scene?.traverse(o=>{if(o.geometry)o.geometry.userData.sharedAsset=true;for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){for(const value of Object.values(m))if(value?.isTexture)value.userData.sharedAsset=true;}});
const loadGltf = url => loadGlb(url).catch(()=>null);

function mat(color, roughness = 0.58, metalness = 0.25, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...options,
  });
}

function emissive(color, intensity = 1.4, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.32,
    metalness: 0.22,
    ...options,
  });
}

function box(geo, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function shadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function disableShadowCasting(root) {
  root?.traverse?.(node => {
    if (node.isMesh) node.castShadow = false;
  });
}

function contactShadowTexture() {
  const size = 48;
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) * .5;
  const radius = center - 1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center) / radius;
      const t = Math.max(0, Math.min(1, (1 - distance) / .72));
      const alpha = Math.round(255 * .34 * t * t * (3 - 2 * t));
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function disposeObject(root, forceShared = false) {
  const geometries = new Set();
  const materials = new Set();
  const skeletons = new Set();
  root?.traverse?.(obj => {
    if(obj.isInstancedMesh)obj.dispose();
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.skeleton) skeletons.add(obj.skeleton);
    if (obj.userData.afterlife?.actorState?.mixer) obj.userData.afterlife.actorState.mixer.stopAllAction();
    if (obj.userData.afterlife?.mixer) {
      obj.userData.afterlife.mixer.stopAllAction();
      obj.userData.afterlife.mixer.uncacheRoot(obj.userData.afterlife.model);
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => materials.add(m));
      else materials.add(obj.material);
    }
  });
  skeletons.forEach(skeleton => skeleton.dispose?.());
  geometries.forEach(g => {if(forceShared||!g.userData?.sharedAsset)g.dispose?.();});
  materials.forEach(m => {
    if (!forceShared && m.userData?.sharedLibrary) return;
    for(const key of ['map','normalMap','roughnessMap','bumpMap','emissiveMap']){const texture=m[key];if(texture&&(forceShared||!texture.userData?.sharedAsset))texture.dispose?.();}
    m.dispose?.();
  });
}

function lineGeometry(maxLines) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
  geometry.setDrawRange(0, 0);
  return geometry;
}

function setLine(geometry, index, a, b) {
  const p = geometry.attributes.position.array;
  const o = index * 6;
  p[o] = a.x; p[o + 1] = a.y; p[o + 2] = a.z;
  p[o + 3] = b.x; p[o + 4] = b.y; p[o + 5] = b.z;
}

export class Renderer {
  constructor(canvas, {backend = null} = {}) {
    this.canvas = canvas;
    this._boundedLighting=typeof location==='undefined'||new URLSearchParams(location.search).get('lightBranch')!=='0' ? installBoundedLightEvaluation() : false;
    this.settings = { reducedMotion: false, gore: true, bodycam: true };
    this.scene = new THREE.Scene();
    this.scene.updateMatrix();
    this.scene.matrixAutoUpdate = false;
    this.scene.background = new THREE.Color(0x0b0e18);
    this.scene.fog = new THREE.Fog(0x101817, 32, 100);
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'FPSCameraRig';
    this.camera = new THREE.PerspectiveCamera(92, 1, 0.025, 220);
    this.camera.name = 'DeadArrivalCamera';
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);
    this._firstCameraFrame = true;
    this._lastNow = 0;
    this._lastRunTime = 0;
    this._renderScale=1;
    this._worldKey = null;
    this._course = null;
    // Resource readiness is tracked per course. The weapon meshes are shared,
    // but floor-local actors, scares, and world buffers still need preparation
    // after a dungeon transition.
    this._warmupCourse = null;
    this._preparedCourse = null;
    this._weaponsPrepared = false;
    this._warmupPromise = null;
    this._enemyVisuals = new Map();
    this._peer = null;
    this._exit = null;
    this._dungeonPickups = [];
    this._dungeonRevision = 0;
    this._horrorScareQueue = [];
    this._diag = {};

    this._materialManager = new THREE.LoadingManager();
    this._materialsReady = new Promise(resolve => { this._materialManager.onLoad = resolve; });
    this.materials = this._createMaterials();
    this._activeWorldPalette = { wall: 0xd9dce0, panel: 0xd9dce0 };
    Object.values(this.materials).forEach(m=>{m.userData.sharedLibrary=true;});
    this._loadMaterialReference();
    this._loadWeaponMaterials();
    if(!backend?.backend?.isWebGPUBackend)throw new Error('The Last Dead requires an initialized native WebGPU renderer.');
    try {
      this.renderer = backend;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      // The arena's architecture is static. Refresh its directional depth map
      // only after a world build; animated actors use inexpensive contact
      // shadows instead of forcing the whole level through the shadow pass.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.setPixelRatio(1);
      this.bodycam = new BodycamPass(this.renderer);
    } catch (error) {
      // Keep the renderer object inspectable in headless smoke tests. A
      // native renderer initialization failures are reported by the entrypoint.
      this.renderer = null;
      this.rendererError = error;
    }

    this._setupEnvironment();
    this._setupLighting();
    this.afterlifeLighting = new AfterlifeLighting(this.scene);
    this._buildCombatPools();
    this.extractionVFX = new ExtractionVFX({
      renderer: this,
      scene: this.scene,
      camera: this.camera,
      combatRoot: this.combatRoot,
      materials: this.materials,
      cell: CELL,
    });
    this._buildWeaponRig();
    this.playerInjuryVisuals = new PlayerInjuryVisuals(this);
    this.brutalCombatVisuals = new BrutalCombatVisuals(this);
    this.verminVisuals = new VerminVisuals(this);
    this.horrorCuff = new HorrorCuffVisuals(this);
    this._survivorReady=prepareSurvivors(this).then(()=>{
      this._afterlifeClips = Object.values(this._survivors?.peer?.userData.actions || {}).map(action=>action.getClip());
      this.playerInjuryVisuals.bind();
    });
    this._wardenStatus='loading';
    this.wardenTemplate=null;
    this.bloodworksWardenTemplate=null;
    this.wardenClips=[];
    this.bloodworksWardenClips=[];
    const legacyWardenLoaded=loadGltf('./assets/models/evil-warden.glb').then(warden=>{
      if(warden){markSharedGltf(warden.scene);this.wardenTemplate=warden.scene;this.wardenClips=warden.animations||[];}
    });
    const bloodworksWardenLoaded=loadGltf('./assets/models/bloodworks-warden.glb').then(warden=>{
      if(warden){markSharedGltf(warden.scene);this.bloodworksWardenTemplate=warden.scene;this.bloodworksWardenClips=warden.animations||[];}
    });
    this._wardenReady=Promise.all([legacyWardenLoaded,bloodworksWardenLoaded]).then(()=>{
      this._wardenStatus=this.wardenTemplate||this.bloodworksWardenTemplate?'ready':'fallback';
    });
    this._ashWitnessAsset = null;
    this._ashWitnessError = null;
    this._ashWitnessReady = loadAfterlifeModel(new GLTFLoader()).then(asset => {
      markSharedGltf(asset.template);
      if (this._isDisposed) { disposeObject(asset.template, true); return; }
      this._ashWitnessAsset = asset;
    }).catch(error => { this._ashWitnessError = String(error?.message || error); });
    this.resize();
  }

  _setupEnvironment() {
    if (!this.renderer) return;
    // Narrow, cold reflections preserve wet material detail without filling every recess.
    const c=document.createElement('canvas');c.width=1024;c.height=512;
    const g=c.getContext('2d'),gradient=g.createLinearGradient(0,0,0,512);
    gradient.addColorStop(0,'#404c54');gradient.addColorStop(.46,'#242e34');gradient.addColorStop(.65,'#111719');gradient.addColorStop(1,'#07090b');g.fillStyle=gradient;g.fillRect(0,0,1024,512);
    for(let i=0;i<3;i++){g.fillStyle='#a7bdc8';g.fillRect(100+i*330,110,34,110);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=this.renderer.createPMREM();this._envTarget=pmrem.fromEquirectangular(texture);this.scene.environment=this._envTarget.texture;this.scene.environmentIntensity=.4;texture.dispose();pmrem.dispose();
    if (!this.materials.floor.map) {
    const tile=document.createElement('canvas');tile.width=tile.height=256;const t=tile.getContext('2d');t.fillStyle='#747b80';t.fillRect(0,0,256,256);t.strokeStyle='#333b40';t.lineWidth=5;t.strokeRect(4,4,248,248);t.strokeStyle='#9da4a7';t.lineWidth=1;t.strokeRect(9,9,238,238);
    let seed=9182;for(let i=0;i<650;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;t.strokeStyle=i%2?'#eef8ff10':'#11182016';t.beginPath();t.moveTo(x,y);t.lineTo(x+4+i%19,y+1);t.stroke();}
    for(const x of[17,239])for(const y of[17,239]){t.fillStyle='#202a30';t.beginPath();t.arc(x,y,3,0,Math.PI*2);t.fill();t.fillStyle='#b9c0c2';t.fillRect(x-1,y-2,2,2);}
    // Recessed maintenance hatch, chamfered corners and stamped tread establish floor scale.
    t.fillStyle='#343d40';t.beginPath();t.moveTo(43,33);t.lineTo(213,33);t.lineTo(225,45);t.lineTo(225,211);t.lineTo(213,223);t.lineTo(43,223);t.lineTo(31,211);t.lineTo(31,45);t.closePath();t.fill();
    t.strokeStyle='#92938a';t.lineWidth=1.5;t.stroke();t.fillStyle='#545b5b';t.fillRect(37,39,182,177);
    for(let row=0;row<14;row++)for(let col=0;col<9;col++){const x=43+col*20+(row%2)*7,y=48+row*11;t.fillStyle='#303a3e';t.fillRect(x,y,9,2);t.fillStyle='#828884';t.fillRect(x,y+2,9,1);}
    t.fillStyle='#1d292c';t.fillRect(105,225,46,9);t.fillStyle='#9b9275';t.fillRect(111,228,34,2);
    for(let i=0;i<5000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;t.fillStyle=i%3?'#131c2214':'#b6a68a15';t.fillRect(x,y,1+i%3,1);}
    const floorTexture=new THREE.CanvasTexture(tile);floorTexture.colorSpace=THREE.SRGBColorSpace;floorTexture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());for(const m of[this.materials.floor,this.materials.floorAlt]){m.map=floorTexture;m.color.set(0x414644);m.metalness=.32;m.roughness=.67;m.bumpMap=floorTexture;m.bumpScale=.025;}
    }
    this.materials.floorAlt.color.set(0x343a37);
    for(const m of[this.materials.weapon,this.materials.weaponDark,this.materials.weaponTrim,this.materials.metal,this.materials.steel,this.materials.enemyArmor])m.envMapIntensity=1.7;
  }

  _createMaterials() {
    return {
      floor: mat(0x303542, 0.84, 0.28),
      afterlifeWood: mat(0xc2b6a5, .93, 0),
      floorAlt: mat(0x444252, 0.78, 0.34),
      floorTrim: mat(0x774655, 0.5, 0.5),
      wall: mat(0x455061, 0.78, 0.46),
      wallPanel: mat(0x667184, 0.67, 0.48),
      wallDeep: mat(0x171d2a, 0.9, 0.22),
      metal: mat(0x8794a5, 0.54, 0.72),
      metalDark: mat(0x303b4d, 0.65, 0.58),
      steel: mat(0x9ba7b4, 0.42, 0.82),
      wornSteel: mat(0xa5aaa5, .72, .48),
      rust: mat(0x87404a, 0.8, 0.3),
      hazard: mat(0xe37d31, 0.38, 0.72),
      black: mat(0x060a11, 0.82, 0.22),
      red: emissive(0xef405f, 1.85),
      violet: emissive(0x9d67f5, 1.8),
      orange: emissive(0xff8c42, 1.9),
      cyan: emissive(0x57e9ff, 1.7),
      gold: emissive(0xffc24e, 1.35, { roughness: 0.25, metalness: 0.86 }),
      blood: mat(0x641721, 0.86, 0.12, { transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide }),
      gore: mat(0x210407, 0.78, 0),
      enemyArmor: mat(0x4a5567, 0.56, 0.58),
      enemyTrim: mat(0x242d3c, 0.68, 0.46),
      weapon: mat(0x4d6071, 0.52, 0.76),
      weaponDark: mat(0x263443, 0.64, 0.56),
      weaponTrim: mat(0x9aabba, 0.42, 0.8),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x0a2430, roughness: 0.08, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.14, transmission: 0.14, transparent: true, opacity: 0.88 }),
      enemyRed: mat(0x962f49, 0.58, 0.48),
      enemyViolet: mat(0x5d3c96, 0.58, 0.5),
      enemyOrange: mat(0xb45b2d, 0.6, 0.5),
      telegraph: emissive(0xfff0c0, 2.35, { transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
      viewSleeve: mat(0x302324, .9, .03),
      viewGlove: mat(0x45392f, .88, .04),
      viewSkin: mat(0x9a6557, .76, .02),
      viewPlate: mat(0x8d7c5c, .73, .18),
      playerSuit: mat(0x0f1b28, 0.38, 0.78),
      playerTrim: emissive(0x62d6e9, 1.45),
    };
  }

  _loadMaterialReference() {
    if (typeof document === 'undefined') return;
    try {
      const texture = new THREE.TextureLoader(this._materialManager).load('./assets/textures/afterlife-plaster-v1.png', loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.RepeatWrapping;
        loaded.wrapT = THREE.RepeatWrapping;
        loaded.repeat.set(1, 1);
        const bump=loaded.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
        loaded.anisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
        for (const material of [this.materials.wall, this.materials.wallPanel]) {
          material.map = loaded;
          material.bumpMap=bump;material.bumpScale=.065;material.roughness=.79;
          material.color.set(material === this.materials.wall ? this._activeWorldPalette.wall : this._activeWorldPalette.panel);
          material.metalness=.28;
          material.envMapIntensity=1.25;
          material.needsUpdate = true;
        }
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.userData.sharedAsset = true;
      // Cover and set-dressing materials clone these surfaces during world
      // construction, before the image callback has necessarily fired.
      this.materials.wall.map = texture;
      this.materials.wallPanel.map = texture;
      const floorMap = new THREE.TextureLoader(this._materialManager).load('./assets/textures/afterlife-institutional-floor-v1.webp');
      floorMap.colorSpace = THREE.SRGBColorSpace;
      floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
      floorMap.anisotropy = Math.min(4, this.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
      floorMap.userData.sharedAsset = true;
      // Offline projection-derived surface field replaces the existing 512px
      // wood slot. Shared props retain their UVs, geometry and shader budget.
      const woodMap = new THREE.TextureLoader(this._materialManager).load('./assets/textures/afterlife-cabinet-wood-projected-v3.webp');
      woodMap.colorSpace = THREE.SRGBColorSpace;
      woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
      woodMap.anisotropy = 4;
      woodMap.userData.sharedAsset = true;
      this.materials.afterlifeWood.map = woodMap;
      const wornSteelMap = new THREE.TextureLoader(this._materialManager).load('./assets/textures/dread-worn-steel-v1.webp');
      wornSteelMap.colorSpace = THREE.SRGBColorSpace;
      wornSteelMap.wrapS = wornSteelMap.wrapT = THREE.RepeatWrapping;
      wornSteelMap.anisotropy = 4;
      wornSteelMap.userData.sharedAsset = true;
      this.materials.wornSteel.map = wornSteelMap;
      this.materials.wornSteel.needsUpdate = true;
      // Assign the loader's texture immediately so world material clones see
      // the same asynchronously populated source from their first build.
      for (const material of [this.materials.floor, this.materials.floorAlt]) {
        material.map = floorMap;
        material.bumpMap = null;
        material.metalness = .045;
        material.roughness = .96;
        material.needsUpdate = true;
      }
    } catch {
      // The procedural material library remains the offline fallback.
    }
  }

  _loadWeaponMaterials(){
    const loader=new THREE.TextureLoader(this._materialManager);
    loader.load('./assets/textures/worn-oxblood-leather-v1.png',t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,3);t.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||4);for(const m of[this.materials.viewGlove,this.materials.viewSleeve]){m.map=t;m.color.set(0xd4c5b9);m.roughness=.85;m.needsUpdate=true;}});
    for(const [file,slot,color]of [['gunmetal_albedo.png','map',true],['gunmetal_normal.png','normalMap',false],['gunmetal_roughness.png','roughnessMap',false]]){
      loader.load('./assets/textures/'+file,t=>{if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer?.capabilities.getMaxAnisotropy()||4);for(const m of[this.materials.weapon,this.materials.weaponDark,this.materials.weaponTrim]){m[slot]=t;if(slot==='normalMap')m.normalScale.set(.45,.45);m.needsUpdate=true;}});
    }
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight(0x8cabb6, 0x171313, .34);
    hemi.name = 'CathedralFill';
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xb0bdc4, .48);
    key.name = 'ForgeKey';
    key.position.set(24, 32, -20);
    key.target.position.set(24, 0, 24);
    key.castShadow = true;
    key.shadow.autoUpdate = false;
    key.shadow.needsUpdate = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -56;
    key.shadow.camera.right = 56;
    key.shadow.camera.top = 56;
    key.shadow.camera.bottom = -56;
    key.shadow.bias = -0.0006;
    this.scene.add(key, key.target);
    const coolFill = new THREE.DirectionalLight(0x83989e, .2);
    coolFill.name = 'CoolArenaFill';
    coolFill.position.set(-34, 12, 14);
    coolFill.target.position.set(24, 1.5, 24);
    this.scene.add(coolFill, coolFill.target);
    const rim = new THREE.DirectionalLight(0x6b3d39, .16);
    rim.name = 'AbyssRim';
    rim.position.set(-28, 14, 42);
    rim.target.position.set(24, 0, 24);
    this.scene.add(rim, rim.target);
    this._worldKeyLight = key;
    this._worldRimLight = rim;
  }

  _buildCombatPools() {
    this.combatRoot = new THREE.Group();
    this.combatRoot.name = 'CombatVfxPools';
    this.scene.add(this.combatRoot);

    this.goreChunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.45, 1), this.materials.gore, MAX_GORE);
    this.goreChunks.name = 'GoreChunks';
    this.goreChunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.goreChunks);
    this.goreDroplets = new THREE.InstancedMesh(fluidDropGeometry(.28), new THREE.MeshStandardMaterial({color:0x43090c,roughness:.28,metalness:0}), MAX_GORE);
    this.goreDroplets.name = 'GoreDroplets';
    this.goreDroplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.goreDroplets);
    const enemyShadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x160b0e,
      map: contactShadowTexture(),
      transparent: true,
      opacity: .72,
      depthWrite: false,
      toneMapped: false,
    });
    this.enemyContactShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), enemyShadowMaterial, MAX_ENEMY_SHADOWS);
    this.enemyContactShadows.name = 'EnemyContactShadows';
    this.enemyContactShadows.count = 0;
    this.enemyContactShadows.castShadow = false;
    this.enemyContactShadows.receiveShadow = false;
    this.enemyContactShadows.frustumCulled = false;
    this.enemyContactShadows.renderOrder = 1;
    this.enemyContactShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.enemyContactShadows);

    // Dungeon encounters stagger spawns with short-lived floor warnings. Keep
    // the warning rings in one bounded instanced pool so each telegraph only
    // updates a matrix; creating a mesh/material on the first warning would
    // otherwise stall the same frame that announces a new enemy.
    this.spawnTelegraphRings = new THREE.InstancedMesh(
      new THREE.RingGeometry(.42, .62, 28), this.materials.telegraph, MAX_SPAWN_TELEGRAPHS,
    );
    this.spawnTelegraphRings.name = 'SpawnTelegraphRings';
    this.spawnTelegraphRings.count = 0;
    this.spawnTelegraphRings.frustumCulled = false;
    this.spawnTelegraphRings.renderOrder = 2;
    this.spawnTelegraphRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.spawnTelegraphRings);
    this._spawnTelegraphMatrix = new THREE.Matrix4();
    this._spawnTelegraphPosition = new THREE.Vector3();
    this._spawnTelegraphScale = new THREE.Vector3();
    this._spawnTelegraphQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

    this.bloodPools = createBloodResiduePool(MAX_BLOOD);
    this.combatRoot.add(this.bloodPools);
    // Death reads through the authored corpse clip and fluid residue; the old capsule limb proxies are retired.
    const projectileGeo = new THREE.SphereGeometry(.105,16,12);
    const projectileCoreGeo = coreCanisterGeometry();
    this.projectileHostile = new THREE.InstancedMesh(projectileGeo, this.materials.red, MAX_PROJECTILES);
    this.projectileReflected = new THREE.InstancedMesh(projectileGeo, this.materials.cyan, MAX_PROJECTILES);
    this.projectileCore = new THREE.InstancedMesh(projectileCoreGeo, new THREE.MeshStandardMaterial({color:0x6c655a,roughness:.4,metalness:.72}), MAX_PROJECTILES);
    this.projectileHostile.name = 'HostileProjectiles';
    this.projectileReflected.name = 'ReflectedProjectiles';
    this.projectileCore.name = 'CoreProjectiles';
    this.projectileHostile.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileReflected.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileCore.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.projectileHostile, this.projectileReflected, this.projectileCore);
    this.projectileWakes=new ProjectileWakes(this.combatRoot,MAX_PROJECTILES);
    this.ordnanceDetails=new OrdnanceDetails(this.combatRoot,MAX_PROJECTILES);

    this.projectileTrails = new THREE.LineSegments(lineGeometry(MAX_PROJECTILES), new THREE.LineBasicMaterial({ color: 0xff668c, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.projectileTrails.name = 'ProjectileTrails';
    this.projectileTrails.frustumCulled = false;
    this.combatRoot.add(this.projectileTrails);
    this.reflectedTrails = new THREE.LineSegments(lineGeometry(MAX_PROJECTILES), new THREE.LineBasicMaterial({ color: 0x6ff8ff, transparent: true, opacity: 0.84, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.reflectedTrails.name = 'ReflectedTrails';
    this.reflectedTrails.frustumCulled = false;
    this.combatRoot.add(this.reflectedTrails);

    this.hookLine = new THREE.LineSegments(lineGeometry(1), new THREE.LineBasicMaterial({ color: 0x77f2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.hookLine.name = 'GrappleTether';
    this.hookLine.frustumCulled = false;
    this.combatRoot.add(this.hookLine);

    this.tracerLines = new THREE.LineSegments(lineGeometry(MAX_TRACERS), new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracerLines.name = 'WeaponTracers';
    this.tracerLines.frustumCulled = false;
    this.combatRoot.add(this.tracerLines);
    this.weaponFX=new CombatVFX(this.combatRoot);
    this.tracerLines.visible=false;
    this.railLines = new THREE.LineSegments(lineGeometry(MAX_TRACERS), new THREE.LineBasicMaterial({ color: 0x97f6ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.railLines.name = 'ArcRailTracers';
    this.railLines.frustumCulled = false;
    this.combatRoot.add(this.railLines);
    this.railLines.visible=false;

    this.coins = new THREE.InstancedMesh(ricochetCoinGeometry(), new THREE.MeshStandardMaterial({color:0xb89858,roughness:.37,metalness:.82}), MAX_COINS);
    this.coins.name = 'RicochetCoins';
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.coins);
    this.coinGlints = new THREE.LineSegments(lineGeometry(MAX_COINS*2), new THREE.LineBasicMaterial({ color: 0xfff2a7, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.coinGlints.name = 'CoinGlints';
    this.coinGlints.frustumCulled = false;
    this.combatRoot.add(this.coinGlints);
    this._combatMatrix = new THREE.Matrix4();
    this._combatQuat = new THREE.Quaternion();
    this._combatScale = new THREE.Vector3();
  }

  _buildWeaponRig() {
    this.weaponRig = new THREE.Group();
    this.weaponRig.name = 'WeaponRig';
    // Viewmodels render on a dedicated layer so a tiny rig-local fill can
    // preserve black-metal/bone/brass separation without brightening the
    // horror arena or changing enemy/world exposure.
    this.weaponRig.layers.set(1);
    this.camera.layers.enable(1);
    this.camera.add(this.weaponRig);
    this.weaponGroups = [this._makePulseRevolver(), this._makeBreachShotgun(), this._makeArcLance(), this._makeReliquaryAsset(), this._makeRifle('carrion',4), this._makeRifle('mourning',5), this._makeMelee('bat',6), this._makeMelee('chainsaw',7)];
    installOssuaryFitting(this.weaponGroups[0]);
    this.weaponGroups.forEach((group, index) => {
      // Slightly larger hero framing lets the authored micro-detail read in
      // the FPS view without occluding the reticle or target corridor.
      group.scale.setScalar(0.64);
      group.visible = index === 0;
      // Viewmodels use the room's reflected light without world-shadow occlusion.
      // Their close camera placement should not cast oversized shadows into the arena.
      group.traverse(node=>{node.layers.set(1);if(node.isMesh){node.castShadow=false;node.receiveShadow=false;for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material?.isMeshStandardMaterial)material.envMapIntensity=material.userData.weaponSurface?.envMapIntensity??1.45;}});
      this.weaponRig.add(group);
    });
    const viewFill = new THREE.HemisphereLight(0xc9e9ff, 0x2c1820, .42);
    viewFill.name = 'ViewmodelReadabilityFill';
    viewFill.layers.set(1);
    this.viewmodelFill = viewFill;
    this.weaponRig.add(viewFill);
    // A local key catches machined edges. Materials exclude the body lantern;
    // camera layers alone do not isolate lights per receiving mesh.
    const viewKey = new THREE.DirectionalLight(0xffdfb9, 1.15);
    viewKey.name = 'ViewmodelWarmKey';
    viewKey.position.set(-1.4, 2.1, 1.8);
    viewKey.layers.set(1);
    this.weaponRig.add(viewKey);
    const viewRim = new THREE.DirectionalLight(0x8fbccc, .5);
    viewRim.name = 'ViewmodelCoolRim';
    viewRim.position.set(1.3, .9, -.8);
    viewRim.layers.set(1);
    this.weaponRig.add(viewRim);
    this.muzzleFlash = new THREE.Group();
    this.muzzleFlash.name = 'MuzzleFlash';
    this.muzzleFlash.layers.set(1);
    const flashSize=96,flashPixels=new Uint8Array(flashSize*flashSize*4);
    for(let y=0;y<flashSize;y++)for(let x=0;x<flashSize;x++){
      const px=(x+.5)/flashSize*2-1,py=(y+.5)/flashSize*2-1,r=Math.hypot(px,py),a=Math.atan2(py,px);
      const turbulence=Math.sin(px*17+py*11)*Math.sin(py*23-px*7);
      const edge=.46+.12*Math.sin(a*3+.8)+.09*Math.sin(a*7+1.3)+.045*turbulence;
      const alpha=clamp((edge-r)*4,0,1)*Math.max(0,1-r*.65)*(.8+.2*turbulence),i=(y*flashSize+x)*4;
      flashPixels[i]=255;flashPixels[i+1]=245;flashPixels[i+2]=225;flashPixels[i+3]=Math.round(alpha*255);
    }
    const flashTexture=new THREE.DataTexture(flashPixels,flashSize,flashSize);flashTexture.colorSpace=THREE.SRGBColorSpace;flashTexture.needsUpdate=true;
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(.30,.30),new THREE.MeshBasicMaterial({map:flashTexture,color:0xffba78,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    flash.name='MuzzlePressureFlare';
    flash.layers.set(1);
    this.muzzleFlash.add(flash);
    const pressure = new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),new THREE.MeshBasicMaterial({map:flashTexture,color:0xffd9a5,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    pressure.name='MuzzlePressureHaze';
    pressure.layers.set(1);
    pressure.position.z=.004;
    pressure.visible=false;
    this.muzzleFlash.add(pressure);
    const flashLight = new THREE.PointLight(0xffb85c, 0, 3, 2);
    flashLight.name = 'MuzzleLight';
    flashLight.layers.set(1);
    this.muzzleFlash.add(flashLight);
    // Short asymmetric gas lobes and drifting smoke avoid a geometric cross
    // at the bore. All flares reuse the feathered, turbulent pressure texture.
    const softSize=48,softPixels=new Uint8Array(softSize*softSize*4);
    for(let y=0;y<softSize;y++)for(let x=0;x<softSize;x++){const px=(x+.5)/softSize*2-1,py=(y+.5)/softSize*2-1,a=Math.pow(clamp(1-Math.hypot(px,py),0,1),1.7),i=(y*softSize+x)*4;softPixels[i]=softPixels[i+1]=softPixels[i+2]=255;softPixels[i+3]=Math.round(a*255);}
    const softTexture=new THREE.DataTexture(softPixels,softSize,softSize);softTexture.needsUpdate=true;
    this.muzzleSpikes=[.35,1.54].map(rot=>{const spike=new THREE.Mesh(new THREE.PlaneGeometry(.32,.16),new THREE.MeshBasicMaterial({map:flashTexture,color:0xffd7a0,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));spike.name='MuzzleGasLobe';spike.layers.set(1);spike.rotation.z=rot;spike.visible=false;spike.position.z=.006;this.muzzleFlash.add(spike);return spike;});
    this.muzzleSmoke=[0,1,2].map(i=>{const puff=new THREE.Mesh(new THREE.PlaneGeometry(.3,.3),new THREE.MeshBasicMaterial({map:softTexture,color:0x8a8580,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));puff.name='MuzzleSmoke';puff.layers.set(1);puff.visible=false;puff.renderOrder=3;this.muzzleFlash.add(puff);return puff;});
    this._muzzleSmokeT=0;this._muzzleShotPrev=0;
    // Keep the light in the scene's light list even while its intensity is zero.
    // Hiding its parent changes shader defines for every lit material on firing.
    flash.visible = false;
    this.weaponRig.add(this.muzzleFlash);
    this.weaponGroups.forEach(group=>applyWeaponGrime(group));
    this.rifleCasings=new RifleCasings(this.weaponRig);
    this._weaponBatch=this.weaponGroups.map(group=>{const {root,...stats}=batchStaticWeaponMeshes(group,{preserve:['WeaponRig','MuzzleFlash']});return stats;});
    installViewmodelDepthBoundary(this.weaponRig);
  }

  _makeArm(side, color = this.materials.viewSleeve, weapon = 0) {
    // Reference-driven survivor arm: one continuous sleeve/forearm/palm mesh
    // with an explicit grip socket that is fitted per weapon below.
    const arm = createSurvivorViewArm(side);
    arm.userData.alignGripOrientation = true;
    // Hands and sleeves are the foreground character layer. Do not let the
    // weapon's receiver depth-hide the forearm-to-wrist connection.
    arm.traverse(node => {
      if (!node.isMesh) return;
      node.userData.viewmodelArm = true;
      node.userData.weaponBatchIgnore = true;
      node.castShadow = false;
      node.receiveShadow = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      node.material = materials.map(material => {
        if (!material) return material;
        const foreground = material.clone();
        // The viewmodel is a deliberate foreground pass; all authored arm
        // surfaces remain visible while the weapon still self-occludes inside
        // its own group. This avoids the sleeve disappearing behind the
        // receiver at common FOVs.
        foreground.depthTest = !!node.userData.gripFarSide;
        foreground.depthWrite = false;
        if (node.name === 'UpperSleeve' || node.name === 'ForearmSleeve' || node.name === 'WristWrap') {
          foreground.color.set(0x74453d);
          foreground.roughness = .82;
        }
        return foreground;
      });
      if (node.material.length === 1) node.material = node.material[0];
    });
    arm.userData.weapon = weapon;
    arm.userData.viewmodelSource = 'survivor-reference-arm';
    return arm;
  }

  _findWeaponSocket(model, name = 'grip') {
    return model?.userData?.[name]
      || model?.userData?.sculptRuntime?.sockets?.[name]
      || model?.userData?.ossuary?.sockets?.[name]
      || model?.userData?.breach?.sockets?.[name]
      || model?.userData?.arc?.sockets?.[name]
      || model?.userData?.reliquary?.sockets?.[name]
      || model?.getObjectByName?.(name)
      || null;
  }

  _addViewmodelArms(group, model, weapon, supportPosition = null) {
    const rightArm = this._makeArm(1, this.materials.viewSleeve, weapon);
    const leftArm = weapon === 0 ? null : this._makeArm(-1, this.materials.viewSleeve, weapon);
    group.add(rightArm);
    if (leftArm) group.add(leftArm);

    const grip = this._findWeaponSocket(model, 'grip');
    // Keep the palm just in front of the weapon surface so the contact reads
    // in the FPS view instead of being buried inside the authored grip mesh.
    const rightGripOffset = weapon === 0 ? [.030, -.035, .120]
      : weapon === 1 ? [.030, -.055, .130]
      : weapon === 2 ? [.030, -.050, .220]
      : weapon >= 4 ? [.030, -.040, .120]
      : [.040, -.040, .240];
    if (grip) alignViewmodelArmToGrip(rightArm, grip, { offset: rightGripOffset });
    if (weapon === 0) rightArm.userData.hand.rotation.y = .70;
    if (weapon === 1) rightArm.userData.hand.rotation.y = .45;
    if (weapon === 2) rightArm.userData.hand.rotation.y = .48;
    if (weapon === 3) rightArm.userData.hand.rotation.y = .55;
    if (weapon >= 4) rightArm.userData.hand.rotation.y = .45;

    const authoredSupport = leftArm && this._findWeaponSocket(model, 'supportGrip');
    if (leftArm && (authoredSupport || supportPosition)) {
      const support = authoredSupport || new THREE.Object3D();
      if (!authoredSupport) {
        support.name = 'SupportGripSocket';
        support.position.set(...supportPosition);
        support.userData.viewmodelAnchor = true;
        group.add(support);
      }
      // A sideways fore-end should turn the hand, not swing the whole sleeve
      // across the screen. Keep the shotgun forearm's authored entry angle.
      if (weapon === 1 && authoredSupport) leftArm.userData.alignGripOrientation = false;
      alignViewmodelArmToGrip(leftArm, support, { offset: [-.018, .008, .032] });
      if (weapon === 1 && authoredSupport) leftArm.userData.hand.rotation.x = -.8;
      if (weapon === 2 && !authoredSupport) leftArm.userData.hand.rotation.x = -.42;
      if (weapon === 3) leftArm.userData.hand.rotation.x = -.50;
    }
    group.userData.viewArms = { rightArm, leftArm };
    return group.userData.viewArms;
  }

  _makePulseRevolver() {
    const group=createOssuary();group.position.set(.35,-.33,-.88);group.rotation.set(.035,.18,-.04);this._addViewmodelArms(group,group,0);return group;
  }

  _makeBreachShotgun() {
    const group=new THREE.Group(),model=createBreach();group.name='BreachShotgun';
    group.position.set(.34,-.34,-.94);group.rotation.set(.035,.21,-.04);
    group.add(model);this._addViewmodelArms(group,model,1,[-.035,-.26,-.43]);group.userData.model=model;group.userData.muzzle=model.userData.muzzle;return group;
  }

  _makeArcLance() {
    const group=new THREE.Group(),model=createArc();group.name='ArcLance';
    group.position.set(.33,-.33,-1.0);group.rotation.set(.035,.22,-.04);
    group.add(model);this._addViewmodelArms(group,model,2,[-.035,-.34,-.54]);group.userData.model=model;group.userData.muzzle=model.userData.muzzle;return group;
  }
  _makeReliquaryAsset() {
    const group = createReliquary({ variant: 'bone-rocket' });
    group.position.set(0.35, -0.34, -0.98);
    group.rotation.set(.035,.2,-.04);
    group.name = 'ReliquaryBazooka';
    this._addViewmodelArms(group,group,3,[-.095,-.33,-.56]);
    return group;
  }

  _makeRifle(variant,index) {
    const group=createRifle({variant});
    group.position.set(.34,-.30,variant==='mourning'?-1.03:-.98);
    group.rotation.set(.045,.20,-.08);
    this._addViewmodelArms(group,group,index);
    return group;
  }

  _makeMelee(variant,index) {
    const group=new THREE.Group(),model=createMeleeWeapon({variant});
    group.name=variant==='bat'?'WakeBatViewmodel':'RipperChainsawViewmodel';
    group.position.set(.32,-.34,-.85);
    model.rotation.set(variant==='bat'?.92:.32,variant==='bat'?-.32:.58,variant==='bat'?-.22:-.10);
    group.add(model);group.userData.model=model;
    const arms=this._addViewmodelArms(model,model,index);
    group.userData.viewArms=arms;
    model.updateWorldMatrix(true,true);
    const modelRotation=model.getWorldQuaternion(new THREE.Quaternion()).invert();
    group.userData.meleeArms=Object.values(arms).filter(Boolean).map(arm=>{
      const hand=arm.userData.hand,limb=arm.children[0];
      arm.userData.dynamicMeleeArm=true;
      const handPosition=model.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
      const handRotation=modelRotation.clone().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
      const state={arm,hand,limb,handPosition,handRotation,handScale:hand.scale.clone(),length:hand.position.y,
        shoulder:new THREE.Vector3(arm.userData.side<0?-.50:.45,-.95,.10),
        sleeve:limb.getObjectByName('RuggedJacketSleeve'),wrist:limb.getObjectByName('BareFPSWrist'),
        wraps:limb.children.filter(node=>node.name==='BloodyWrap').map(node=>({node,y:node.position.y})),
        target:new THREE.Vector3(),direction:new THREE.Vector3(),rotation:new THREE.Quaternion(),up:new THREE.Vector3(0,1,0)};
      group.add(arm);arm.add(hand);arm.position.set(0,0,0);arm.quaternion.identity();
      return state;
    });
    this._fitMeleeArms(group);
    return group;
  }

  _fitMeleeArms(group) {
    if (fitForegroundArms(group)) return;
    // Hands stay on the moving grip; sleeves stretch from shoulders below the
    // camera instead of rotating their open ends into view on a backswing.
    const model=group.userData.model;model.updateMatrix();
    for(const s of group.userData.meleeArms){
      s.target.copy(s.handPosition).applyMatrix4(model.matrix);
      s.direction.subVectors(s.target,s.shoulder);
      const length=s.direction.length(),extension=length-s.length;
      s.limb.position.copy(s.shoulder);
      s.limb.quaternion.setFromUnitVectors(s.up,s.direction.normalize());
      // Extend only cloth. Stretching the entire limb would also elongate the
      // exposed wrist and bandages into a flat strip beside the glove.
      s.sleeve.scale.y=Math.max(.1,(length-s.length*.34)/(s.length*.66));
      s.wrist.position.y=extension;
      for(const wrap of s.wraps)wrap.node.position.y=wrap.y+extension;
      s.hand.position.copy(s.target);s.hand.scale.copy(s.handScale);
      s.rotation.copy(model.quaternion).multiply(s.handRotation);
      s.hand.quaternion.copy(s.rotation);
    }
  }

  _makeReliquaryFallback() {
    const group = new THREE.Group();
    group.name = 'ReliquaryBazooka';
    group.position.set(0.31, -0.32, -0.9);
    group.rotation.set(.035,.045,-.025);
    const body = shadow(box(new THREE.BoxGeometry(0.48, 0.38, 0.92), this.materials.weaponDark, 0, 0, 0.06));
    const shoulder = shadow(box(new THREE.BoxGeometry(0.58, 0.18, 0.46), this.materials.weapon, 0, 0.19, -0.08));
    const spine = shadow(box(new THREE.BoxGeometry(0.16, 0.16, 1.26), this.materials.weaponTrim, 0, 0.12, -0.38));
    const barrel = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.9, 12), this.materials.black));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.77);
    const socket = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 24), this.materials.floorTrim);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(0, 0.02, -1.18);
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), this.materials.red);
    heart.name = 'ReliquaryHeart';
    heart.position.set(0, 0.04, -0.98);
    const boneCage = new THREE.Group();
    boneCage.name = 'BoneCage';
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.026, 6, 18, Math.PI * 1.25), this.materials.weaponTrim);
      rib.rotation.set(0, side * 0.16, side * 0.12);
      rib.position.set(side * 0.07, 0.04, -0.83);
      boneCage.add(rib);
    }
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), this.materials.gore);
    skull.name = 'ReliquarySkull';
    skull.position.set(0, 0.24, -0.56);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.027, 7, 5), this.materials.orange);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.065, 0.26, -0.695);
    eyeR.position.set(0.065, 0.26, -0.695);
    const grip = shadow(box(new THREE.BoxGeometry(0.28, 0.43, 0.32), this.materials.weaponDark, 0, -0.25, 0.2));
    grip.rotation.x = -0.2;
    const rearCoil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.032, 7, 18), this.materials.violet);
    rearCoil.rotation.x = Math.PI / 2;
    rearCoil.position.set(0, 0.02, 0.37);
    const muzzle = new THREE.Group();
    muzzle.name = 'ReliquaryMuzzle';
    muzzle.position.set(0, 0.02, -1.2);
    const muzzleCore = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.materials.orange);
    muzzle.add(muzzleCore);
    group.add(body, shoulder, spine, barrel, socket, heart, boneCage, skull, eyeL, eyeR, grip, rearCoil, muzzle, this._makeArm(-1), this._makeArm(1));
    group.userData.muzzle = muzzle;
    group.userData.reliquary = true;
    group.userData.animate = (time, shot = 0) => {
      heart.rotation.y = time * 2.8;
      heart.scale.setScalar(1 + Math.sin(time * 8.0) * 0.08 + shot * 0.12);
      skull.rotation.z = Math.sin(time * 2.2) * 0.08 - shot * 0.14;
      rearCoil.rotation.z = time * 4.4;
      muzzleCore.scale.setScalar(1 + shot * 0.3);
    };
    return group;
  }
  _buildWorld(course) {
    this.bodycam?.reset();
    this.bodycamMotion?.reset();
    const previousScares=this.horrorScares?.course===course?{
      windowTriggered:this.horrorScares.window?.triggered,
      windowStarted:this.horrorScares.window?.started,
      windowPlayed:this.horrorScares.window?.played,
      windowArmedAt:this.horrorScares.windowArmedAt,
      lastDrop:this.horrorScares.lastDrop,
      dropStarted:this.horrorScares.drop?.started,
      dropVisible:this.horrorScares.drop?.group.visible,
      dropPosition:this.horrorScares.drop?.group.position.clone(),
      dropRotation:this.horrorScares.drop?.group.rotation.y,
    }:null;
    this.afterlifeAtmosphere?.dispose();
    this.harborWorld?.dispose();this.harborWorld=null;
    this.horrorEncounters?.dispose();
    this.journeyVisuals?.release();
    this.horrorCuff?.reset();
    if (this.worldRoot) {
      const retired=this.worldRoot;
      retired.userData.afterlifeSurfaceDisposed = true;
      this.scene.remove(retired);
      // compileAsync polls material programs after returning. Keep an outgoing
      // room's resources alive until its shader poll finishes, even on restart.
      if(this._warmupPromise){
        this._retiredWorlds ||= new Set();this._retiredWorlds.add(retired);
        const release=()=>{if(this._retiredWorlds.delete(retired))disposeObject(retired);};
        this._warmupPromise.then(release,release);
      }else disposeObject(retired);
    }
    this._enemyVisuals.clear();
    this._preparedEnemyVisuals = new Map();
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'BloodworksWorld';
    this.scene.add(this.worldRoot);
    this._course = course;
    this._worldKey = course?.index ?? `${course?.w}x${course?.h}`;
    this._dungeonRevision = course?.dungeonRevision ?? 0;
    const width = (course?.w || 12) * CELL;
    const depth = (course?.h || 12) * CELL;
    const spawn = course?.playerSpawn;
    const shadowCenterX = Number.isFinite(spawn?.x) ? worldX(spawn.x) : width * .5;
    const shadowCenterZ = Number.isFinite(spawn?.y) ? worldZ(spawn.y) : depth * .5;
    this._worldKeyLight.target.position.set(shadowCenterX, 0, shadowCenterZ);
    this._worldKeyLight.position.set(shadowCenterX, 32, shadowCenterZ - 44);
    this._worldKeyLight.target.updateMatrixWorld(true);
    this._worldKeyLight.updateMatrixWorld(true);
    this._worldKeyLight.shadow.camera.updateProjectionMatrix();
    this._worldKeyLight.intensity=.48;
    this.camera.far=course.coastal?2400:220;this.camera.updateProjectionMatrix();
    if(course.harbor){
      this.horror=null;this.horrorScares=null;this.horrorEncounters=null;this.afterlifeAtmosphere=null;
      this.afterlifeMapDesign=null;this.journeyVisuals=null;this._exit=null;this._dungeonPickups=[];
      this._storyEvidence=[];this._dungeonSupplies=null;this._dungeonWallInstances=[];
      this.harborWorld=new HarborWorld(this.worldRoot,course);
      this._storyWeaponLoot=buildDungeonWeaponLoot(this.worldRoot,{...course,dungeon:true,loot:course.weaponPickups});
      this._scavengerCaches=new ScavengerCaches(this.worldRoot,course);
      this.scene.background.set(HARBOR_PALETTE.background);this.scene.fog.color.set(HARBOR_PALETTE.fog);
      this.scene.fog.near=HARBOR_PALETTE.fogNear;this.scene.fog.far=HARBOR_PALETTE.fogFar;
      if(course.coastal){this.scene.fog.near=160;this.scene.fog.far=700;}
      if(this.renderer)this.renderer.toneMappingExposure=HARBOR_PALETTE.exposure;
      this._worldKeyLight.color.setHex(0xffdfa5);this._worldKeyLight.intensity=2.5;
      this.afterlifeLighting.rebuild(this.worldRoot,false);
      this._worldStatic=null;this._worldBatch=null;this._roomBatches=[];
      const harbor=this.harborWorld;
      harbor.ready.then(()=>{if(this.harborWorld===harbor&&this.renderer){this._worldKeyLight.shadow.needsUpdate=true;this.renderer.shadowMap.needsUpdate=true;}});
      return;
    }
    this._buildFloor(width, depth);
    this._buildWalls(course);
    if (!course?.dungeon) this._buildIntakeRecoveryCavity(course);
    this._buildCover(course);
    if (!course?.dungeon) this._buildIndustrialShell(width, depth);
    this._buildExit(course?.exit || { x: 6, y: 1 });
    this.horror=buildHorrorDetails(this.worldRoot,this.materials,course);
    buildCathedralKit(this.worldRoot,this.materials,course);
    this.afterlifeMapDesign = buildAfterlifeMapDesign(this.worldRoot, this.materials, course, {
      propFactories: {
        wheelchair: () => { const prop=createAfterlifeWheelchair(); prop.userData.afterlifeSkip=true; return prop; },
        'mourning-cabinet': () => { const prop=createAfterlifeMourningCabinet({materials:{wood:this.materials.afterlifeWood}}); prop.userData.afterlifeSkip=true; return prop; },
      },
    });
    this._dungeonPickups=this._buildDungeonPickups(course);
    this._storyWeaponLoot=buildDungeonWeaponLoot(this.worldRoot,course);
    this._dungeonSupplies=new DungeonSupplies(this.worldRoot,course);
    this._scavengerCaches=new ScavengerCaches(this.worldRoot,course);
    this._storyEvidence=buildDungeonEvidence(this.worldRoot,course);
    this.journeyVisuals=new JourneyVisuals(this.worldRoot,course);
    const dynamicShadowRoots=[this.horror.organ,this.horror.core,...this._dungeonPickups.map(item=>item.root),...this._storyWeaponLoot.map(item=>item.root),...this._storyEvidence.map(item=>item.root),...(this.horror.authored?.moving||[])];
    for (const root of dynamicShadowRoots) disableShadowCasting(root);
    disableShadowCasting(this._exit?.gate);
    const animatedWorld=[this._exit?.root,this.journeyVisuals.root,...dynamicShadowRoots];
    if (this.horror.theme) {
      const theme = afterlifeTheme(this.horror.theme);
      this.scene.background.set(theme.background);
      this.scene.fog.color.set(theme.fog);
      this.scene.fog.near = theme.fogNear;
      this.scene.fog.far = theme.fogFar;
      if (this.renderer) this.renderer.toneMappingExposure = theme.exposure ?? 1.12;
      this._activeWorldPalette = {
        wall: theme.wallSurface ?? 0xd9dce0,
        panel: theme.panelSurface ?? 0xd9dce0,
      };
      this.materials.wall.color.set(this._activeWorldPalette.wall);
      this.materials.wallPanel.color.set(this._activeWorldPalette.panel);
      this.materials.floorTrim.color.set(theme.trimSurface ?? 0x774655);
      this.materials.floor.color.set(theme.floorSurface ?? 0x414644);
      this.materials.floorAlt.color.set(theme.floorAltSurface ?? 0x343a37);
      if (theme.key && this._worldKeyLight) this._worldKeyLight.color.set(theme.key);
      if (theme.rim && this._worldRimLight) this._worldRimLight.color.set(theme.rim);
    }
    this._afterlifeSurfaceDiagnostics = applyAfterlifeSurfaces(this.worldRoot, {
      sector: course?.sectorId || course?.id,
      excludeRoots: [this._exit?.root,this.journeyVisuals.root, ...this._dungeonPickups.map(item => item.root), ...this._storyWeaponLoot.map(item => item.root), ...this._storyEvidence.map(item => item.root)],
      materialRoles: new Map([
        [this.materials.wall, 'roomWall'], [this.materials.wallPanel, 'roomPanel'],
        [this.materials.wallDeep, 'roomRecess'], [this.materials.floor, 'roomFloor'],
        [this.materials.floorAlt, 'roomFloorInset'], [this.materials.floorTrim, 'roomTrim'],
        [this.materials.metal, 'roomMetal'], [this.materials.metalDark, 'roomMetal'],
        [this.materials.steel, 'roomMetal'], [this.materials.rust, 'roomRust'],
        [this.materials.hazard, 'roomHazard'], [this.materials.red, 'roomSignal'],
        [this.materials.violet, 'roomSignal'], [this.materials.orange, 'roomSignal'],
      ]),
      materialSources: this.materials,
      // Readiness is coordinated by the renderer's asset promise; no polling
      // is needed for these synchronous world clones after a start/restart.
      sourceReady: this._materialsReady,
    });
    this.afterlifeLighting.rebuild(this.worldRoot, Boolean(course?.dungeon));
    const roomChunks=this.horror.roomChunks||this.horror.authored?.roomChunks||[];
    this._roomBatches=roomChunks.map(room=>batchStaticWorld(room,animatedWorld));
    this._worldBatch=batchStaticWorld(this.worldRoot,[...animatedWorld,...roomChunks]);
    this._worldStatic=finalizeStaticWorld(this.worldRoot,animatedWorld);
    this.horrorScares=new HorrorScares(this.worldRoot,course,this._ashWitnessAsset,this.materials);
    this.horrorEncounters=new HorrorEncounterVisuals(this.worldRoot,course,this._ashWitnessAsset,this.materials);
    if(previousScares){
      this.horrorScares.lastDrop=previousScares.lastDrop;
      this.horrorScares.windowArmedAt=previousScares.windowArmedAt;
      if(this.horrorScares.window&&previousScares.windowTriggered){
        Object.assign(this.horrorScares.window,{triggered:true,started:previousScares.windowStarted,played:previousScares.windowPlayed});
      }
      if(this.horrorScares.drop&&previousScares.dropVisible){
        Object.assign(this.horrorScares.drop,{started:previousScares.dropStarted});
        this.horrorScares.drop.group.visible=true;
        this.horrorScares.drop.group.position.copy(previousScares.dropPosition);
        this.horrorScares.drop.group.rotation.y=previousScares.dropRotation;
      }
    }
    this.afterlifeAtmosphere = new AfterlifeAtmosphere(this.worldRoot, course, {
      mobile: this.width < 800,
      reducedMotion: this.settings.reducedMotion,
    });
    if (this.renderer && this._worldKeyLight?.shadow) {
      this._worldKeyLight.shadow.needsUpdate = true;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  _buildFloor(width, depth) {
    const floor = shadow(new THREE.Mesh(new THREE.PlaneGeometry(width, depth), this.materials.floor), false, true);
    floor.name = 'PlayableFloor';
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2, -0.09, depth / 2);
    this.worldRoot.add(floor);

    const tileGeo = new THREE.BoxGeometry(3.88, 0.06, 3.88);
    const tileCount = (width / CELL) * (depth / CELL);
    const tileA = new THREE.InstancedMesh(tileGeo, this.materials.floor, tileCount);
    const tileB = new THREE.InstancedMesh(tileGeo, this.materials.floorAlt, tileCount);
    tileA.name = 'FloorTilesPrimary'; tileB.name = 'FloorTilesAlternate';
    tileA.receiveShadow = true; tileB.receiveShadow = true;
    tileA.instanceMatrix.setUsage(THREE.StaticDrawUsage); tileB.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const tileObject = new THREE.Object3D();
    let tileAi = 0, tileBi = 0;
    for (let z = 0; z < depth / CELL; z++) for (let x = 0; x < width / CELL; x++) {
      tileObject.position.set(x * CELL + CELL / 2, -0.035, z * CELL + CELL / 2);
      tileObject.updateMatrix();
      if ((x + z) % 3 === 0) tileB.setMatrixAt(tileBi++, tileObject.matrix);
      else tileA.setMatrixAt(tileAi++, tileObject.matrix);
    }
    tileA.count = tileAi; tileB.count = tileBi;
    tileA.instanceMatrix.needsUpdate = true; tileB.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(tileA, tileB);
    const positions = [];
    for (let x = 0; x <= width / CELL; x++) {
      positions.push(x * CELL, 0.018, 0, x * CELL, 0.018, depth);
    }
    for (let z = 0; z <= depth / CELL; z++) {
      positions.push(0, 0.018, z * CELL, width, 0.018, z * CELL);
    }
    const seamGeo = new THREE.BufferGeometry();
    seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const seams = new THREE.LineSegments(seamGeo, new THREE.LineBasicMaterial({ color: 0x703346, transparent: true, opacity: 0.47 }));
    seams.name = 'FloorPanelSeams';
    this.worldRoot.add(seams);

    const grate = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.035, 0.9), this.materials.wallDeep, 10);
    const grateBars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.06, 0.92), this.materials.metal, 50);
    grate.name = 'FloorGrates'; grateBars.name = 'FloorGrateBars';
    grate.receiveShadow = true;
    const grateObject = new THREE.Object3D();
    let barIndex = 0;
    for (let i = 0; i < 10; i++) {
      const x = 4 + i * 4.15;
      const z = depth / 2 + (i % 2 ? 8 : -8);
      grateObject.position.set(x, 0.04, z); grateObject.updateMatrix(); grate.setMatrixAt(i, grateObject.matrix);
      for (let j = -2; j <= 2; j++) {
        grateObject.position.set(x + j * 0.48, 0.07, z); grateObject.updateMatrix(); grateBars.setMatrixAt(barIndex++, grateObject.matrix);
      }
    }
    grate.instanceMatrix.setUsage(THREE.StaticDrawUsage); grateBars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    grate.instanceMatrix.needsUpdate = true; grateBars.instanceMatrix.needsUpdate = true;
    this.worldRoot.add(grate, grateBars);
  }

  _buildWalls(course) {
    this._dungeonWallInstances = course?.dungeon ? [] : null;
    const cells = course?.renderCells || course?.cells || [];
    const seen = new Set();
    const segments = [];
    if (course?.dungeon && Array.isArray(course.walls)) {
      for (const wall of course.wallSlots || course.walls) segments.push({ x: wall.x * CELL, z: wall.z * CELL, horizontal: wall.horizontal, key: `${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}` });
    } else {
      for (let cy = 0; cy < (course?.h || 12); cy++) for (let cx = 0; cx < (course?.w || 12); cx++) {
        const sides = cells[cy * (course?.w || 12) + cx] || [0, 0, 0, 0];
        for (let d = 0; d < 4; d++) {
          if (!sides[d]) continue;
          const key = d === 0 ? `h:${cx},${cy}` : d === 2 ? `h:${cx},${cy + 1}` : d === 1 ? `v:${cx + 1},${cy}` : `v:${cx},${cy}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const horizontal = d === 0 || d === 2;
          const x = horizontal ? cx * CELL + CELL / 2 : (d === 1 ? (cx + 1) * CELL : cx * CELL);
          const z = horizontal ? (d === 0 ? cy * CELL : (cy + 1) * CELL) : cy * CELL + CELL / 2;
          segments.push({ x, z, horizontal, key });
        }
      }
    }
    const max = Math.max(1, segments.length);
    const addPool = (geometry, material, name) => {
      const pool = new THREE.InstancedMesh(geometry, material, max);
      pool.name = name;
      pool.castShadow = true;
      pool.receiveShadow = true;
      pool.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      pool.frustumCulled = false;
      return pool;
    };
    const shellH = addPool(new THREE.BoxGeometry(3.95, 6.4, 0.28), this.materials.wall, 'WallShellHorizontal');
    const shellV = addPool(new THREE.BoxGeometry(0.28, 6.4, 3.95), this.materials.wall, 'WallShellVertical');
    const panelH = addPool(new THREE.BoxGeometry(3.3, 4.75, 0.07), this.materials.wallPanel, 'WallPanelHorizontal');
    const panelV = addPool(new THREE.BoxGeometry(0.36, 4.75, 3.3), this.materials.wallPanel, 'WallPanelVertical');
    const districtSkin=districtPanelSkin(course);
    const annexPanelH=districtSkin?addPool(districtSkin.geometry(true),districtSkin.material,'AnnexPanelHorizontal'):null;
    const annexPanelV=districtSkin?addPool(districtSkin.geometry(false),districtSkin.material,'AnnexPanelVertical'):null;
    if(districtSkin){annexPanelH.userData.afterlifeSkip=true;annexPanelV.userData.afterlifeSkip=true;}
    const hiddenPanelMatrix=new THREE.Matrix4().makeScale(0,0,0);
    const trimH = addPool(new THREE.BoxGeometry(3.86, 0.15, 0.11), this.materials.floorTrim, 'WallTrimHorizontal');
    const trimV = addPool(new THREE.BoxGeometry(0.11, 0.15, 3.86), this.materials.floorTrim, 'WallTrimVertical');
    const signalH = addPool(new THREE.BoxGeometry(0.72, 0.12, 0.09), this.materials.orange, 'WallSignalsHorizontal');
    const signalV = addPool(new THREE.BoxGeometry(0.09, 0.12, 0.72), this.materials.orange, 'WallSignalsVertical');
    const pipeH = addPool(new THREE.CylinderGeometry(0.09, 0.09, 3.82, 8), this.materials.rust, 'WallPipeHorizontal');
    const pipeV = addPool(new THREE.CylinderGeometry(0.09, 0.09, 3.82, 8), this.materials.rust, 'WallPipeVertical');
    const object = new THREE.Object3D();
    let h = 0, v = 0;
    for (const segment of segments) {
      const { x, z, horizontal } = segment;
      const shell = horizontal ? shellH : shellV;
      const annex=districtSkin&&isAnnexWall(course,x/CELL,z/CELL);
      const panel = annex ? (horizontal?annexPanelH:annexPanelV) : (horizontal?panelH:panelV);
      const trim = horizontal ? trimH : trimV;
      const signal = horizontal ? signalH : signalV;
      const pipe = horizontal ? pipeH : pipeV;
      const index = horizontal ? h : v;
      if(districtSkin)(annex?(horizontal?panelH:panelV):(horizontal?annexPanelH:annexPanelV)).setMatrixAt(index,hiddenPanelMatrix);
      object.position.set(x, 3.2, z); object.rotation.set(0, 0, 0); object.updateMatrix(); shell.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.16, 2.95, horizontal ? z + 0.16 : z); object.updateMatrix(); panel.setMatrixAt(index, object.matrix);
      if(annex)panel.setColorAt(index,districtPanelTint(x/CELL,z/CELL));
      object.position.set(x, 5.65, z); object.updateMatrix(); trim.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.19, 5.1, horizontal ? z - 0.19 : z); object.updateMatrix(); signal.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.19, 5.86, horizontal ? z - 0.19 : z); object.rotation.set(horizontal ? 0 : Math.PI / 2, 0, horizontal ? Math.PI / 2 : 0); object.updateMatrix(); pipe.setMatrixAt(index, object.matrix);
      if (this._dungeonWallInstances) for (const pool of [shell, panel, trim, signal, pipe]) {
        const matrix = new THREE.Matrix4(); pool.getMatrixAt(index, matrix);
        this._dungeonWallInstances.push({ pool, index, key: segment.key, matrix, visible: true });
      }
      if (horizontal) h++; else v++;
    }
    [shellH, shellV, panelH, panelV, trimH, trimV, signalH, signalV, pipeH, pipeV].forEach(pool => { pool.count = pool === shellH || pool === panelH || pool === trimH || pool === signalH || pool === pipeH ? h : v; pool.instanceMatrix.needsUpdate = true; });
    this.worldRoot.add(shellH, shellV, panelH, panelV, trimH, trimV, signalH, signalV, pipeH, pipeV);
    if(districtSkin){annexPanelH.count=h;annexPanelV.count=v;annexPanelH.instanceMatrix.needsUpdate=true;annexPanelV.instanceMatrix.needsUpdate=true;this.worldRoot.add(annexPanelH,annexPanelV);}
    const permanent = course?.permanentWalls && new Set(course.permanentWalls.map(wall => `${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}`));
    this._buildStoryWallRelief(course, permanent ? segments.filter(segment => permanent.has(segment.key)) : segments);
    if (course?.dungeon) this._syncDungeonWalls(course);
  }

  _syncDungeonWalls(course) {
    const visible = new Set(course.walls.map(wall => `${wall.horizontal ? 'h' : 'v'}:${wall.x}:${wall.z}`));
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const slot of this._dungeonWallInstances || []) {
      const show = visible.has(slot.key);
      if (show === slot.visible) continue;
      slot.pool.setMatrixAt(slot.index, show ? slot.matrix : hidden);
      slot.pool.instanceMatrix.needsUpdate = true;
      slot.visible = show;
    }
    this._dungeonRevision = course.dungeonRevision;
    // The changed doorway must also disappear from the cached shadow map.
    if (this._worldKeyLight?.shadow) this._worldKeyLight.shadow.needsUpdate = true;
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }

  _buildStoryWallRelief(course, segments) {
    const art = course?.artDirection;
    if (!course?.dungeon || !art || !segments.length) return;

    const palette = this.materials;
    const pools = new Map();
    const matrixObject = new THREE.Object3D();
    const addPool = (name, geometry, material) => {
      const pool = new THREE.InstancedMesh(geometry, material, Math.max(1, segments.length));
      pool.name = `StoryWallRelief_${art.wallRelief}_${name}`;
      pool.userData.storyWallRelief = art.wallRelief;
      pool.castShadow = true;
      pool.receiveShadow = true;
      pool.frustumCulled = false;
      pool.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      pools.set(name, { mesh: pool, count: 0 });
      this.worldRoot.add(pool);
      return pools.get(name);
    };
    const place = (poolName, segment, along, y, scale, depth = 0, rotation = 0) => {
      const pool = pools.get(poolName);
      if (!pool || pool.count >= pool.mesh.instanceMatrix.count) return;
      const normalOffset = segment.horizontal ? .24 + depth : .38 + depth;
      matrixObject.position.set(
        segment.horizontal ? segment.x + along : segment.x + normalOffset,
        y,
        segment.horizontal ? segment.z + normalOffset : segment.z + along,
      );
      matrixObject.rotation.set(0, segment.horizontal ? 0 : Math.PI / 2, rotation);
      matrixObject.scale.set(scale[0], scale[1], scale[2]);
      matrixObject.updateMatrix();
      pool.mesh.setMatrixAt(pool.count++, matrixObject.matrix);
    };
    const every = (index, interval) => index % interval === 0;

    if (art.wallRelief === 'pressure-gauges') {
      addPool('GaugeFrame', new THREE.BoxGeometry(.08, 2.5, .13), palette.metalDark);
      addPool('GaugeBezel', new THREE.TorusGeometry(.37, .065, 6, 20), palette.gold);
      addPool('GaugeFace', new THREE.CircleGeometry(.29, 18), palette.wallDeep);
      addPool('GaugeNeedle', new THREE.BoxGeometry(.035, .23, .035), palette.orange);
      segments.forEach((segment, index) => {
        if (!every(index, 6)) return;
        for (const side of [-1, 1]) place('GaugeFrame', segment, side * 1.1, 3.15, [1, 1, 1], .035);
        place('GaugeBezel', segment, 0, 3.55, [1, 1, 1], .075);
        place('GaugeFace', segment, 0, 3.55, [1, 1, 1], .12);
        place('GaugeNeedle', segment, .035, 3.56, [1, 1, 1], .16, -.34);
      });
    } else if (art.wallRelief === 'observation-slits') {
      addPool('SlitRecess', new THREE.BoxGeometry(.48, 1.35, .1), palette.wallDeep);
      addPool('SlitGlass', new THREE.BoxGeometry(.2, .92, .055), palette.cyan);
      addPool('SlitTrim', new THREE.BoxGeometry(.07, 1.55, .12), palette.steel);
      addPool('SlitCap', new THREE.BoxGeometry(.52, .08, .14), palette.floorTrim);
      segments.forEach((segment, index) => {
        if (!every(index, 5)) return;
        place('SlitRecess', segment, 0, 3.2, [1, 1, 1], .065);
        place('SlitGlass', segment, 0, 3.25, [1, 1, 1], .145);
        for (const side of [-1, 1]) place('SlitTrim', segment, side * .3, 3.2, [1, 1, 1], .16);
        for (const y of [2.4, 4.0]) place('SlitCap', segment, 0, y, [1, 1, 1], .16);
      });
    } else if (art.wallRelief === 'skull-ossuaries') {
      // Sealed mortuary hatches: a chamfered lip, recessed face, and attached
      // pull. The former skull was a lone pale icosahedron at playing distance.
      const outline = new THREE.Shape();
      outline.moveTo(-.7, -.39); outline.lineTo(.7, -.39);
      outline.lineTo(.8, -.29); outline.lineTo(.8, .29);
      outline.lineTo(.7, .39); outline.lineTo(-.7, .39);
      outline.lineTo(-.8, .29); outline.lineTo(-.8, -.29); outline.closePath();
      const opening = new THREE.Path();
      opening.moveTo(-.65, -.27); opening.lineTo(-.65, .27);
      opening.lineTo(.65, .27); opening.lineTo(.65, -.27); opening.closePath();
      outline.holes.push(opening);
      const lip = new THREE.ExtrudeGeometry(outline, {depth:.09, steps:1, bevelEnabled:true, bevelSize:.025, bevelThickness:.025, bevelSegments:1});
      const pull = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.23, 0, 0), new THREE.Vector3(-.2, 0, .1),
        new THREE.Vector3(.2, 0, .1), new THREE.Vector3(.23, 0, 0),
      ]), 8, .025, 5, false);
      const hatch = addPool('MortuaryHatchLip', lip, palette.wornSteel || palette.steel);
      hatch.mesh.userData.afterlifeSurfaceRole = 'roomTrim';
      addPool('MortuaryHatchRecess', new THREE.BoxGeometry(1.3, .54, .04), palette.wallDeep);
      addPool('MortuaryHatchPull', pull, palette.steel);
      addPool('MortuaryHatchLabel', new THREE.BoxGeometry(.26, .075, .018), palette.floorTrim);
      segments.forEach((segment, index) => {
        if (!every(index, 5)) return;
        place('MortuaryHatchLip', segment, 0, 3.15, [1, 1, 1], .055);
        place('MortuaryHatchRecess', segment, 0, 3.15, [1, 1, 1], .06);
        place('MortuaryHatchPull', segment, 0, 3.06, [1, 1, 1], .14);
        place('MortuaryHatchLabel', segment, .38, 3.32, [1, 1, 1], .16);
      });
    } else if (art.wallRelief === 'choir-resonators') {
      addPool('ResonatorPipe', new THREE.CylinderGeometry(.07, .12, 2.25, 8), palette.gold);
      addPool('ResonatorBell', new THREE.TorusGeometry(.25, .07, 6, 15), palette.steel);
      addPool('ResonatorClapper', new THREE.SphereGeometry(.07, 8, 6), palette.orange);
      addPool('ResonatorBridge', new THREE.BoxGeometry(1.5, .1, .16), palette.metalDark);
      segments.forEach((segment, index) => {
        if (!every(index, 5)) return;
        for (let i = 0; i < 3; i++) {
          const along = (i - 1) * .39, y = 3.05 + (i % 2) * .22;
          place('ResonatorPipe', segment, along, y, [1, .74 + (i % 2) * .2, 1], .09);
          place('ResonatorBell', segment, along, y + .82, [.8, 1, 1], .1);
          place('ResonatorClapper', segment, along, y + .62, [1, 1, 1], .17);
        }
        place('ResonatorBridge', segment, 0, 2.6, [1, 1, 1], .08);
      });
    } else if (art.wallRelief === 'throat-ribs') {
      addPool('ThroatRib', new THREE.CapsuleGeometry(.095, 1.9, 4, 8), palette.steel);
      addPool('ThroatRing', new THREE.TorusGeometry(.52, .12, 7, 18), palette.rust);
      addPool('ThroatVoid', new THREE.CircleGeometry(.42, 18), palette.wallDeep);
      addPool('ThroatEmber', new THREE.SphereGeometry(.095, 8, 6), palette.red);
      segments.forEach((segment, index) => {
        if (!every(index, 5)) return;
        for (const side of [-1, 1]) place('ThroatRib', segment, side * .52, 3.2, [1, 1, 1], .1, side * -.11);
        place('ThroatRing', segment, 0, 3.38, [1.18, .64, 1], .15);
        place('ThroatVoid', segment, 0, 3.38, [1.05, .66, 1], .19);
        place('ThroatEmber', segment, 0, 3.38, [1, 1, 1], .24);
      });
    }

    for (const { mesh, count } of pools.values()) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  _buildIntakeRecoveryCavity(course) {
    if (course?.sectorId !== 'bloodworks') return;
    // The player-facing north wall is the h:*,9 segment resolved on the
    // rightward camera turn. Keep the intervention to one bay: it is a
    // silhouette break, not a new clutter layer across the room.
    const wallX = 7.5 * CELL;
    const wallZ = 9 * CELL + .55;
    const cavity = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.9, 4.78, .14), this.materials.wallDeep), true, true);
    cavity.name = 'IntakeOpenMaintenanceCavity';
    cavity.position.set(wallX, 2.96, wallZ);
    cavity.userData.noBatch = true;
    this.worldRoot.add(cavity);

    // One frame side is intentionally missing; the remaining jamb is offset
    // and slightly kicked so the opening reads from the combat lane at a glance.
    const looseJamb = shadow(new THREE.Mesh(new THREE.BoxGeometry(.13, 4.04, .16), this.materials.metal), true, true);
    looseJamb.name = 'IntakeOpenMaintenanceOffsetFrame';
    looseJamb.position.set(wallX + 1.98, 3.05, wallZ - .02);
    looseJamb.rotation.z = .075;
    looseJamb.userData.noBatch = true;
    this.worldRoot.add(looseJamb);

    const verticalFeed = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 3.3, 8), this.materials.rust), true, true);
    verticalFeed.name = 'IntakeOpenMaintenanceVerticalFeed';
    verticalFeed.position.set(wallX - 1.05, 2.55, wallZ - .08);
    verticalFeed.rotation.z = .04;
    verticalFeed.userData.noBatch = true;
    this.worldRoot.add(verticalFeed);
    const crossFeed = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.105, .105, 1.9, 8), this.materials.metalDark), true, true);
    crossFeed.name = 'IntakeOpenMaintenanceCrossFeed';
    crossFeed.position.set(wallX + .2, 2.8, wallZ - .08);
    crossFeed.rotation.z = Math.PI / 2;
    crossFeed.userData.noBatch = true;
    this.worldRoot.add(crossFeed);
  }

  _buildWallSegment(x, z, horizontal, key) {
    const shell = shadow(new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 3.95 : 0.28, 6.4, horizontal ? 0.28 : 3.95), this.materials.wall), true, true);
    shell.name = `Wall_${key}`;
    shell.position.set(x, 3.2, z);
    this.worldRoot.add(shell);
    const panel = shadow(new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 3.3 : 0.36, 4.75, horizontal ? 0.07 : 3.3), this.materials.wallPanel), false, true);
    panel.position.set(x, 2.95, z + (horizontal ? 0.16 : 0.16));
    this.worldRoot.add(panel);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 3.86 : 0.11, 0.15, horizontal ? 0.11 : 3.86), this.materials.floorTrim);
    trim.position.set(x, 5.65, z);
    this.worldRoot.add(trim);
    const signal = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 0.72 : 0.09, 0.12, horizontal ? 0.09 : 0.72), key.includes(':') && Number(key.split(':')[1].split(',')[0]) % 3 === 0 ? this.materials.red : this.materials.orange);
    signal.position.set(x, 5.1, z + (horizontal ? -0.19 : -0.19));
    this.worldRoot.add(signal);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.82, 8), this.materials.rust);
    pipe.rotation.z = horizontal ? Math.PI / 2 : 0;
    pipe.rotation.x = horizontal ? 0 : Math.PI / 2;
    pipe.position.set(x + (horizontal ? 0 : 0.19), 5.86, z + (horizontal ? -0.19 : 0));
    this.worldRoot.add(pipe);
  }

  _buildCover(course) {
    buildDungeonCover(this.worldRoot, this.materials, course);
  }

  _buildIndustrialShell(width, depth) {
    const addPipe = (x, y, z, length, axis, material = this.materials.rust, radius = 0.09) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 9), material);
      if (axis === 'x') pipe.rotation.z = Math.PI / 2;
      if (axis === 'z') pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, y, z);
      this.worldRoot.add(pipe);
      return pipe;
    };
    for (const x of [2.2, width - 2.2, width * 0.5 - 9, width * 0.5 + 9]) {
      const col = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 7.4, 10), this.materials.metalDark), true, true);
      col.position.set(x, 3.7, 2.2);
      this.worldRoot.add(col);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 16), this.materials.floorTrim);
      collar.position.set(x, 5.85, 2.2);
      this.worldRoot.add(collar);
      addPipe(x, 6.2, 2.35, 7.5, 'z', this.materials.metal);
    }
    for (const z of [2.2, depth - 2.2]) {
      addPipe(width / 2, 6.55, z, width - 3.6, 'x', this.materials.metal);
      addPipe(width / 2, 6.9, z + (z < depth / 2 ? 0.42 : -0.42), width - 8, 'x', this.materials.rust, 0.13);
      for (const x of [7, 16, 28, 37]) {
        const brace = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.3, 0.2), this.materials.metalDark), true, true);
        brace.position.set(x, 3.15, z);
        this.worldRoot.add(brace);
      }
    }
    // Cathedral ribs at the north and south façades establish scale while
    // leaving the combat lane open and readable.
    for (const x of [9, 21, 33, 39]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.13, 8, 30, Math.PI), this.materials.metal);
      rib.position.set(x, 3.4, x < width / 2 ? 2.55 : depth - 2.55);
      rib.rotation.y = x < width / 2 ? 0 : Math.PI;
      this.worldRoot.add(rib);
    }
    // Elevated gantry spans give the arena a layered, industrial silhouette.
    for (const z of [12, 24, 36]) {
      const beam = shadow(new THREE.Mesh(new THREE.BoxGeometry(width - 5, 0.3, 0.3), this.materials.metalDark), true, true);
      beam.position.set(width / 2, 5.95, z);
      this.worldRoot.add(beam);
      for (const x of [5, 13, 23, 33, 43]) {
        addPipe(x, 5.58, z, 0.85, 'y', this.materials.rust, 0.07);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.22), x % 2 ? this.materials.red : this.materials.orange);
        lamp.position.set(x, 5.72, z);
        this.worldRoot.add(lamp);
      }
    }
    // Hanging hazard placards and long vertical light blades break up empty
    // walls without covering enemy silhouettes.
    for (const x of [6, 18, 30, 42]) {
      const sign = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.08), this.materials.black), false, false);
      sign.position.set(x, 4.15, 0.52);
      this.worldRoot.add(sign);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.05), this.materials.hazard);
      stripe.position.set(x, 4.15, 0.46);
      stripe.rotation.z = -0.24;
      this.worldRoot.add(stripe);
    }
  }

  _buildExit(exit) {
    const root = new THREE.Group();
    root.name = 'SealedExit';
    const x = worldX(exit.x);
    const z = worldZ(exit.y);
    root.position.set(x, 0, z);
    const pillarGeo = new THREE.BoxGeometry(0.52, 4.1, 0.6);
    const left = shadow(new THREE.Mesh(pillarGeo, this.materials.metalDark), true, true);
    const right = shadow(new THREE.Mesh(pillarGeo, this.materials.metalDark), true, true);
    left.position.x = -1.58; right.position.x = 1.58;
    const top = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.66, 0.55, 0.65), this.materials.metal), true, true);
    top.position.y = 4.0;
    root.add(left, right, top);
    const gate = new THREE.Group();
    gate.name = 'ExitGate';
    for (let i = -2; i <= 2; i++) {
      const bar = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.25, 0.14), this.materials.red), true, false);
      bar.position.set(i * 0.52, 1.72, 0);
      gate.add(bar);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.055, 8, 28), this.materials.red);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.6;
    root.add(gate, ring);
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.4), this.materials.red);
    threshold.position.y = 0.06;
    root.add(threshold);
    this.worldRoot.add(root);
    this._exit = { root, gate, ring, threshold, unlocked: false };
  }

  _buildDungeonPickups(course) {
    if (!course?.dungeon) return [];
    return (course.keys || []).map(key => {
      const root = new THREE.Group();
      root.name = `DungeonKey_${key.id}`;
      root.position.set(worldX(key.x), 0, worldZ(key.y));
      root.userData.noBatch = true;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(.24, 0), this.materials.gold);
      core.position.y = 1.05;
      core.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.38, .035, 7, 22), this.materials.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .8;
      const glow = new THREE.PointLight(0xffc24e, .8, 5, 2);
      glow.position.copy(root.position); glow.position.y = 1.15;
      root.add(core, ring);
      this.worldRoot.add(root, glow);
      return { id: key.id, root, core, ring, glow, baseY: 1.05 };
    });
  }

  _updateDungeonPickups(run, now) {
    // Keys are updated in place by the simulation. Avoid allocating a Set on
    // every render frame just to answer a handful of membership checks.
    const collected = run.dungeonProgression?.keysCollected || [];
    for (const item of this._dungeonPickups || []) {
      const visible = !collected.includes(item.id);
      if (item.root.visible !== visible) item.root.visible = visible;
      if (item.glow.intensity !== (visible ? .8 : 0)) item.glow.intensity = visible ? .8 : 0;
      if (!visible) continue;
      item.core.position.y = item.baseY + Math.sin(now * .003 + item.core.id) * .12;
      item.core.rotation.y = now * .0012;
      item.ring.rotation.z = now * .0015;
    }
  }

  _makeEnemy(kind, variant = '') {
    const group = new THREE.Group();
    group.name = `EnemyKind${kind}`;
    const accent = [this.materials.enemyRed, this.materials.enemyViolet, this.materials.enemyOrange][kind % 3];
    const signal = [this.materials.red, this.materials.violet, this.materials.orange][kind % 3];
    const body = new THREE.Group();
    body.name = 'ArmorBody';
    const torso = shadow(new THREE.Mesh(new THREE.BoxGeometry(kind === 2 ? 0.54 : 0.44, kind === 2 ? 0.82 : 0.66, 0.36), accent), true, true);
    torso.position.y = kind === 2 ? 1.05 : 0.94;
    const chest = shadow(new THREE.Mesh(new THREE.BoxGeometry(kind === 2 ? 0.67 : 0.55, 0.34, 0.43), this.materials.enemyArmor), true, true);
    chest.position.y = kind === 2 ? 1.34 : 1.17;
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.05), signal);
    core.position.set(0, kind === 2 ? 1.38 : 1.21, -0.235);
    const head = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(kind === 2 ? 0.25 : 0.22, 1), this.materials.enemyArmor), true, true);
    head.position.y = kind === 2 ? 1.87 : 1.61;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(kind === 2 ? 0.27 : 0.26, 0.08, 0.08), signal);
    visor.position.set(0, head.position.y + 0.02, -0.21);
    const horns = new THREE.Group();
    horns.name = 'HornCrests';
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(kind === 0 ? 0.085 : 0.065, kind === 0 ? 0.5 : 0.34, 8), signal);
      horn.position.set(side * 0.16, head.position.y + 0.28, 0);
      horn.rotation.z = side * (kind === 0 ? 0.42 : 0.25);
      horns.add(horn);
    }
    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    leftArm.name = 'LeftArm'; rightArm.name = 'RightArm';
    for (const [side, arm] of [[-1, leftArm], [1, rightArm]]) {
      const upper = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 8), accent), true, true);
      upper.rotation.z = side * 0.27;
      upper.position.set(side * 0.35, 1.08, 0);
      const gauntlet = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.28), this.materials.enemyArmor), true, true);
      gauntlet.position.set(side * 0.48, 0.82, -0.06);
      arm.add(upper, gauntlet);
    }
    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();
    leftLeg.name = 'LeftLeg'; rightLeg.name = 'RightLeg';
    for (const [side, leg] of [[-1, leftLeg], [1, rightLeg]]) {
      const shin = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.56, 8), this.materials.enemyTrim), true, true);
      shin.position.set(side * 0.14, 0.4, 0);
      const foot = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.36), this.materials.enemyArmor), true, true);
      foot.position.set(side * 0.14, 0.12, -0.09);
      leg.add(shin, foot);
    }
    body.add(torso, chest, core, head, visor, horns, leftArm, rightArm, leftLeg, rightLeg);
    group.add(body);
    const variantRoot = new THREE.Group();
    variantRoot.name = 'Variant_' + (variant || 'base');
    const addVariant = mesh => { shadow(mesh, true, true); variantRoot.add(mesh); return mesh; };
    if (kind === 0 && variant === 'skitter') {
      group.scale.setScalar(0.86);
      for (const side of [-1, 1]) {
        const foreleg = addVariant(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 0.74, 6), accent));
        foreleg.position.set(side * 0.34, 0.56, -0.2);
        foreleg.rotation.set(side * 0.35, 0, side * 0.52);
        const claw = addVariant(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 6), signal));
        claw.position.set(side * 0.48, 0.24, -0.48);
        claw.rotation.x = Math.PI / 2;
      }
    } else if (kind === 0 && variant === 'bloodhound') {
      const muzzle = addVariant(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 4, 8), accent));
      muzzle.position.set(0, 1.53, -0.3);
      muzzle.rotation.x = Math.PI / 2;
      const jaw = addVariant(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.24), this.materials.gore));
      jaw.position.set(0, 1.37, -0.31);
      for (const side of [-1, 1]) {
        const ear = addVariant(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.33, 6), signal));
        ear.position.set(side * 0.19, 1.85, 0.02);
        ear.rotation.z = side * 0.44;
      }
    } else if (kind === 1 && variant === 'hexer') {
      for (let i = 0; i < 3; i++) {
        const rune = addVariant(new THREE.Mesh(new THREE.TorusGeometry(0.23 + i * 0.07, 0.018, 6, 20), signal));
        rune.name = 'HexRune';
        rune.position.set(0, 1.1 + i * 0.36, 0.08);
        rune.rotation.set(Math.PI / 2, i * 0.45, i * 0.23);
      }
    } else if (kind === 1 && variant === 'mireSinger') {
      const throat = addVariant(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.075, 8, 18), this.materials.gore));
      throat.position.set(0, 1.32, -0.26);
      throat.rotation.x = Math.PI / 2;
      for (const side of [-1, 1]) {
        const tendril = addVariant(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.06, 0.9, 6), accent));
        tendril.position.set(side * 0.27, 1.03, 0.12);
        tendril.rotation.z = side * 0.34;
      }
    } else if (kind === 2 && variant === 'brute') {
      for (const side of [-1, 1]) {
        const shoulder = addVariant(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 6), signal));
        shoulder.position.set(side * 0.45, 1.61, 0);
        shoulder.rotation.z = side * 0.78;
      }
    } else if (kind === 2 && variant === 'warden') {
      const crest = addVariant(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.48), this.materials.weaponTrim));
      crest.position.set(0, 2.18, 0.08);
    }
    group.add(variantRoot);
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(kind === 2 ? 0.42 : 0.32, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }));
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    group.add(shadowDisc);
    if (kind === 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.038, 8, 26), signal);
      ring.name = 'ShieldRing';
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.07;
      group.add(ring);
    }
    if (kind === 2) {
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.66, 10), signal);
      cannon.name = 'ShoulderCannon';
      cannon.rotation.x = Math.PI / 2;
      cannon.position.set(0.34, 1.52, -0.02);
      group.add(cannon);
      const backpack = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.18), this.materials.enemyTrim), true, true);
      backpack.position.set(0, 1.08, 0.22);
      group.add(backpack);
    }
    const telegraph = new THREE.Mesh(new THREE.RingGeometry(kind === 2 ? 0.56 : 0.36, kind === 2 ? 0.65 : 0.44, 28), this.materials.telegraph);
    telegraph.name = 'AttackTelegraph';
    telegraph.rotation.x = -Math.PI / 2;
    telegraph.position.y = 0.045;
    telegraph.visible = false;
    group.add(telegraph);
    group.userData.parts = { body, leftArm, rightArm, leftLeg, rightLeg, horns, variantRoot, telegraph, signal, ring: group.getObjectByName('ShieldRing') };
    return group;
  }

  _enemySource(enemy) {
      const useAshWitness = enemy.kind === 0 && this._ashWitnessAsset;
      const useAfterlife = useAshWitness || (enemy.kind < 2 && this._survivors?.status === 'ready' && this._afterlifeClips?.length);
      const wantsBloodworksWarden = enemy.kind === 2 && BLOODWORKS_WARDEN_VARIANTS.has(enemy.variant);
      const useBloodworksWarden = wantsBloodworksWarden && this.bloodworksWardenTemplate;
      const template = useAshWitness ? this._ashWitnessAsset.template : useAfterlife ? this._survivors.template : useBloodworksWarden ? this.bloodworksWardenTemplate : this.wardenTemplate;
      const clips = useBloodworksWarden ? this.bloodworksWardenClips : this.wardenClips;
      const useWarden = !useAfterlife && !!template && enemy.kind >= 0 && enemy.kind < 3;
      const makeActor = () => useAshWitness ? createAfterlifeModel(this._ashWitnessAsset, enemy.kind, (enemy.id * 1.618) % TAU) : useAfterlife
        ? createAfterlifeEnemy(template, this._afterlifeClips, enemy.kind, enemy.variant, (enemy.id * 1.618) % TAU)
        : useWarden ? createWarden(template,clips,enemy.kind,enemy.variant)
        : enemy.kind === 3 ? createBellwraith({ variant: enemy.variant, phase: enemy.phase || 0 }) : this._makeEnemy(enemy.kind, enemy.variant);
      return { useAfterlife, useWarden, template, makeActor };
  }

  async _prepareDungeonEnemies(course) {
    if (!course?.dungeon || this._preparedEnemyVisuals?.size || this._course!==course) return;
    const renderer=this.renderer,worldRoot=this.worldRoot;
    this._preparedEnemyVisuals ||= new Map();
    let id = 1, preparedCount=0;
    for (const point of (course.waveSpawns || []).flat()) {
      const profile = ENEMY_PROFILES[point.variant] || ENEMY_PROFILES.stalker;
      const enemy = { ...point, id: id++, kind: profile.kind };
      const key = `${enemy.kind}:${enemy.variant || ''}`;
      const entries = this._preparedEnemyVisuals.get(key) || [];
      if(entries.length>=3||preparedCount>=24)continue;
      const { useAfterlife, useWarden, template, makeActor } = this._enemySource(enemy);
      const root = makeActor();
      root.visible = false; disableShadowCasting(root); this.worldRoot.add(root);
      entries.push({ root, template: useAfterlife || useWarden ? template : null });
      preparedCount++;
      this._preparedEnemyVisuals.set(key, entries);
      // Cloning skinned actors is substantial CPU work. Let the loading UI
      // paint between small batches rather than blocking it for the whole pool.
      if(preparedCount%3===0){
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
        if(this._course!==course||this.renderer!==renderer||this.worldRoot!==worldRoot)return;
      }
    }
  }

  async _prepareCoastalEnemies(course){
    if(!course?.coastal||this._course!==course||this._coastalEnemyPreparedCourse===course)return;
    const renderer=this.renderer,worldRoot=this.worldRoot,entries=[],saved=[],previous=renderer.getRenderTarget();
    this._preparedEnemyVisuals ||= new Map();
    this._reportPreparation('Preparing coastal inhabitants');
    const current=()=>this.renderer===renderer&&this._course===course&&this.worldRoot===worldRoot;
    try{
      // The bounded harbor encounter uses these three actual runtime profiles.
      // Keep the actors in the existing consumable pool, rather than disposing
      // throwaway representatives and recreating their GPU resources in play.
      for(const [kind,variant]of [[0,'stalker'],[1,'caster'],[2,'brute']]){
        if(!current())return;
        const key=`${kind}:${variant}`,pool=this._preparedEnemyVisuals.get(key)||[];
        let entry=pool[0];
        if(!entry){const source=this._enemySource({id:kind+1,kind,variant});const root=source.makeActor();root.visible=false;disableShadowCasting(root);worldRoot.add(root);entry={root,template:source.useAfterlife||source.useWarden?source.template:null};pool.push(entry);this._preparedEnemyVisuals.set(key,pool);}
        entries.push(entry);
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      }
      if(!current())return;
      for(const [i,entry]of entries.entries()){
        const root=entry.root;saved.push({root,p:root.position.clone(),visible:root.visible,culling:[]});
        const state=saved.at(-1);root.traverse(object=>{if(object.isMesh){state.culling.push([object,object.frustumCulled]);object.frustumCulled=false;}});
        this.camera.updateWorldMatrix(true,false);this.camera.localToWorld(root.position.set((i-1)*2,-1.65,-6));worldRoot.worldToLocal(root.position);root.visible=true;root.updateMatrixWorld(true);
      }
      this.bodycam._ensureTarget();renderer.setRenderTarget(this.bodycam.target);
      await this._compilePreparedScene(renderer);
      if(!current())return;
      renderer.setRenderTarget(previous);this._renderScene();await renderer.backend.device.queue.onSubmittedWorkDone();
      if(current())this._coastalEnemyPreparedCourse=course;
    }finally{
      renderer.setRenderTarget(previous);
      for(const state of saved){state.root.position.copy(state.p);state.root.visible=state.visible;for(const [object,culled]of state.culling)object.frustumCulled=culled;state.root.updateMatrixWorld(true);}
    }
  }

  _updateEnemies(run, now) {
    const alive = new Set();
    const enemies = run.course?.enemies || [];
    const crowd=this._crowdDiagnostics ||= {visible:0,culled:0,animated:0,staggered:0};
    crowd.visible=crowd.culled=crowd.animated=crowd.staggered=0;
    for (const enemy of enemies) {
      let entry = this._enemyVisuals.get(enemy.id);
      const distance=Math.hypot(enemy.x-run.x,enemy.y-run.y);
      if(!entry&&distance>=15){crowd.culled++;continue;}
      const { useAfterlife, useWarden, template, makeActor } = this._enemySource(enemy);
      if (!entry) {
        const prepared = this._preparedEnemyVisuals?.get(`${enemy.kind}:${enemy.variant || ''}`)?.shift();
        entry = { ...(prepared || { root: makeActor(), template: useAfterlife || useWarden ? template : null }), seed: (enemy.id * 1.618) % TAU, variant: enemy.variant || '' };
        entry.root.visible = true;
        this._enemyVisuals.set(enemy.id, entry);
        disableShadowCasting(entry.root);
        this.worldRoot.add(entry.root);
      }
      if((useAfterlife||useWarden)&&entry.template!==template){this.worldRoot.remove(entry.root);disposeObject(entry.root);entry.root=makeActor();disableShadowCasting(entry.root);entry.template=template;this.worldRoot.add(entry.root);}
      alive.add(enemy.id);
      const root = entry.root;
      root.visible=distance<15;
      // Physics owns culled and frozen corpses too. A hidden collapse mixer
      // must never move their source pivot before the player returns.
      if(enemy.dead&&this.brutalCombatVisuals?.physics?.has(root)&&!this.brutalCombatVisuals.physics.isHeld(root)){
        if(root.visible)crowd.visible++;else crowd.culled++;
        continue;
      }
      if(!root.visible){
        // Returning to an old corpse must not resume a frozen death clip.
        const actor=root.userData.afterlife;
        if(enemy.dead&&root.userData.afterlifeModel&&actor?.collapseAction&&!entry.corpseSettled){
          enemyFxBegin(root);animateAfterlifeModel(root,enemy,now,entry.seed);
          const duration=actor.collapseAction.getClip().duration;
          if((now-(actor.deadAt??now))/1000>=duration){actor.collapseAction.time=duration;actor.collapseAction.paused=true;actor.mixer.update(0);entry.corpseSettled=true;}
        }
        crowd.culled++;continue;
      }
      crowd.visible++;
      // Nearby combat always updates at render rate. Distant actors retain
      // their pose between 30Hz ticks; geometry and texture data stay shared.
      const interval=distance>7&&!enemy.dead&&!enemy.attacking&&!enemy.strike&&!enemy.flash?32:0;
      if(interval&&now-(entry.lastPoseAt||0)<interval){root.position.x=worldX(enemy.x);root.position.z=worldZ(enemy.y);crowd.staggered++;continue;}
      entry.lastPoseAt=now;crowd.animated++;
      if(root.userData.afterlifeModel){root.position.set(worldX(enemy.x),(enemy.meleeZ||0)*CELL,worldZ(enemy.y));if(!enemy.dead){root.rotation.y=-(enemy.facing??Math.atan2(run.y-enemy.y,run.x-enemy.x))-Math.PI/2;delete root.userData.meleeDeathYaw;}else if(enemy.meleeHitId){root.userData.meleeDeathYaw??=root.rotation.y;root.rotation.y=root.userData.meleeDeathYaw+(enemy.meleeYaw||0);}enemyFxBegin(root);animateAfterlifeModel(root,enemy,now,entry.seed);enemyFxEnd(root,enemy,run,now);continue;}
      if(root.userData.afterlife){root.position.set(worldX(enemy.x),0,worldZ(enemy.y));if(!enemy.dead)root.rotation.y=-(enemy.facing??Math.atan2(run.y-enemy.y,run.x-enemy.x))-Math.PI/2;enemyFxBegin(root);animateAfterlifeEnemy(root,enemy,now,entry.seed);enemyFxEnd(root,enemy,run,now);continue;}
      if(root.userData.warden){root.position.set(worldX(enemy.x),0,worldZ(enemy.y));if(!enemy.dead)root.rotation.y=-(enemy.facing??Math.atan2(run.y-enemy.y,run.x-enemy.x))-Math.PI/2;enemyFxBegin(root);animateWarden(root,enemy,now,entry.seed);enemyFxEnd(root,enemy,run,now,root.userData.warden?.modelScale??1);continue;}
       if (root.userData.bellwraith) {
          const floorOffset = root.userData.bellwraith?.floorOffset ?? 0.22;
          root.position.set(worldX(enemy.x), floorOffset, worldZ(enemy.y));
          if (!enemy.dead) root.rotation.y = Math.PI / 2 - (enemy.facing ?? Math.atan2(run.y - enemy.y, run.x - enemy.x));
          enemyFxBegin(root); animateBellwraith(root, enemy, now, entry.seed); enemyFxEnd(root, enemy, run, now);
          continue;
        }
       if (enemy.dead) {
        root.visible = false;
        continue;
      }
      root.visible = true;
      const phase = (enemy.phase || 0) + now * 0.0018 + entry.seed;
      const bob = enemy.kind === 3 ? 0.22 + Math.sin(phase * 2.15) * 0.14 : enemy.kind === 1 ? Math.sin(phase * 2.4) * 0.11 : Math.abs(Math.sin(phase * 3.1)) * 0.025;
      root.position.set(worldX(enemy.x), bob, worldZ(enemy.y));
      const toward = enemy.facing ?? Math.atan2(run.y - enemy.y, run.x - enemy.x);
      root.rotation.y = -toward - Math.PI / 2;
      const parts = root.userData.parts;
      const stride = Math.sin(phase * (enemy.kind === 0 ? 7 : 3.5)) * (enemy.kind === 0 ? 0.32 : 0.12);
      parts.leftLeg.rotation.x = stride;
      parts.rightLeg.rotation.x = -stride;
      parts.leftArm.rotation.x = -stride * 0.6;
      parts.rightArm.rotation.x = stride * 0.6;
      parts.horns.rotation.y = Math.sin(phase * 2) * 0.05;
      const warning = !!enemy.attacking || (enemy.strike || 0) > 0;
      if (parts.variantRoot) {
        parts.variantRoot.rotation.y = phase * (enemy.kind === 3 ? 0.92 : 0.18);
        parts.variantRoot.position.y = enemy.kind === 3 ? Math.sin(phase * 1.8) * 0.08 : 0;
      }
      parts.telegraph.visible = warning;
      if (warning) {
        const pulse = 1 + Math.sin(now * 0.018 + enemy.id) * 0.12 + (0.58 - enemy.attack) * 0.55;
        parts.telegraph.scale.setScalar(pulse);
        parts.telegraph.material.opacity = clamp(0.28 + (0.58 - enemy.attack) * 1.4, 0.28, 0.94);
      }
      if (parts.ring) parts.ring.rotation.z = phase * 1.2;
      const hurt = clamp((enemy.flash || 0) / 0.16, 0, 1);
      root.scale.setScalar(1 + hurt * 0.045);
      parts.body.traverse(child => {
        if (!child.isMesh || !child.material?.emissive) return;
        child.material.emissiveIntensity = child.material.userData?.baseIntensity ?? 1.4 + hurt * 3.8;
      });
    }
    for (const [id, entry] of this._enemyVisuals) {
      if (!alive.has(id)) {
        this.worldRoot.remove(entry.root);
        disposeObject(entry.root);
        this._enemyVisuals.delete(id);
      }
    }
    let shadowCount = 0;
    const rotation = this._combatEuler ||= new THREE.Euler();
    const quaternion = this._combatQuat ||= new THREE.Quaternion();
    const scale = this._combatScale ||= new THREE.Vector3();
    const matrix = this._combatMatrix ||= new THREE.Matrix4();
    const position = this._enemyShadowPosition ||= new THREE.Vector3();
    quaternion.setFromEuler(rotation.set(-Math.PI / 2, 0, 0));
    for (const enemy of enemies) {
      if (enemy.dead || shadowCount >= MAX_ENEMY_SHADOWS) continue;
      const entry = this._enemyVisuals.get(enemy.id);
      if (!entry?.root.visible) continue;
      const visualScale = entry.root.userData.warden?.modelScale ?? 1;
      const radius = (enemy.kind === 2 ? 1.18 : enemy.kind === 3 ? 1.12 : .96) * visualScale;
      scale.set(radius, radius * .68, 1);
      matrix.compose(position.set(worldX(enemy.x), .026, worldZ(enemy.y)), quaternion, scale);
      this.enemyContactShadows.setMatrixAt(shadowCount++, matrix);
    }
    this.enemyContactShadows.count = shadowCount;
    this.enemyContactShadows.instanceMatrix.needsUpdate = true;
  }

  _updatePeer(run, now) {
    const peer = run?.peer;
    if (!peer) {
      if (this._peer) this._peer.root.visible = false;
      return;
    }
    if (!this._peer) {
      const root = new THREE.Group();
      root.name = 'PeerAvatar';
      const suit = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.92, 0.38), this.materials.playerSuit), true, true);
      suit.position.y = 0.86;
      const plate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 0.46), this.materials.playerTrim), true, true);
      plate.position.y = 1.21;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), this.materials.cyan);
      visor.position.set(0, 1.69, -0.23);
      const head = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), this.materials.enemyArmor), true, true);
      head.position.y = 1.6;
      const left = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 8), this.materials.playerSuit);
      const right = left.clone();
      left.position.set(-0.4, 0.88, 0); right.position.set(0.4, 0.88, 0);
      left.rotation.z = -0.25; right.rotation.z = 0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 8, 24), this.materials.cyan);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.9;
      root.add(suit, plate, visor, head, left, right, ring);
      disableShadowCasting(root);
      this._peer = { root, ring, left, right };
      this.worldRoot.add(root);
    }
    const p = this._peer;
    p.root.visible = true;
    p.root.position.set(worldX(peer.x || 0), (peer.z || 0) * CELL, worldZ(peer.y || 0));
    p.root.rotation.y = -(peer.angle || 0) - Math.PI / 2;
    p.ring.rotation.z = now * 0.0016;
    const stride = Math.sin(now * 0.012) * 0.18;
    p.left.rotation.x = stride; p.right.rotation.x = -stride;
  }

  _updateExit(run, now) {
    if (!this._exit) return;
    const active = (run.course?.enemies || []).some(e => !e.dead);
    const open = run.course?.dungeon ? run.dungeonProgression?.exitReady === true : (run.wave || 0) >= (run.waveCount || 3) && !active;
    this._exit.unlocked = open;
    const gateY = open ? 4.2 : 0;
    this._exit.gate.position.y = damp(this._exit.gate.position.y, gateY, 5, this._frameDt || 0.016);
    const pulse = 1 + Math.sin(now * 0.004) * 0.06;
    this._exit.ring.scale.setScalar(pulse);
    this._exit.ring.material = open ? this.materials.cyan : this.materials.red;
    this._exit.threshold.material = open ? this.materials.cyan : this.materials.red;
  }

  _updateSpawnTelegraphs(run, now) {
    const telegraphs = run.spawnTelegraphs || [];
    const mesh = this.spawnTelegraphRings;
    if (!mesh) return;
    const matrix = this._spawnTelegraphMatrix;
    const position = this._spawnTelegraphPosition;
    const scale = this._spawnTelegraphScale;
    const quaternion = this._spawnTelegraphQuaternion;
    let count = 0;
    for (const telegraph of telegraphs) {
      if (count >= MAX_SPAWN_TELEGRAPHS) break;
      const heavy = telegraph.kind === 2;
      const pulse = this.settings.reducedMotion || this._systemReducedMotion ? 1 : 1 + Math.sin(now * .018 + (telegraph.phase || 0) * 5 + (telegraph.order || 0) * .7) * .12;
      const radius = heavy ? 1.42 : 1;
      scale.set(radius * pulse, radius * pulse, 1);
      matrix.compose(position.set(worldX(telegraph.x), .047, worldZ(telegraph.y)), quaternion, scale);
      mesh.setMatrixAt(count++, matrix);
    }
    mesh.count = count;
    if (count) mesh.instanceMatrix.needsUpdate = true;
  }

  _updateCombat(run, now) {
    this._updateSpawnTelegraphs(run, now);
    const position = this._combatPosition ||= new THREE.Vector3();
    const rotation = this._combatEuler ||= new THREE.Euler();
    const matrix = this._combatMatrix;
    const quat = this._combatQuat;
    const scale = this._combatScale;
    let chunks = 0, droplets = 0, blood = 0;
    if (this.settings.gore) {
      for (const g of run.gore || []) {
        if(g.counter&&this.brutalCombatVisuals?.status==='ready')continue;
        if (g.chunk && chunks < MAX_GORE) {
          const spin = (g.spin || 0) + now * 0.003;
          quat.setFromEuler(rotation.set(spin * 1.3, spin * 0.7, spin * 0.5));
          scale.set((g.size || .035) * CELL * .34, (g.size || .035) * CELL * .2, (g.size || .035) * CELL * .24);
          matrix.compose(position.set(worldX(g.x), (g.z || 0) * CELL, worldZ(g.y)), quat, scale);
          this.goreChunks.setMatrixAt(chunks++, matrix);
        } else if (!g.chunk && g.z > .012 && droplets < MAX_GORE) {
          const velocity=this._dropVelocity ||= new THREE.Vector3(),up=this._dropUp ||= new THREE.Vector3(0,1,0);
          velocity.set(g.vx||0,g.vz||0,g.vy||0);const speed=velocity.length();
          if(speed>.01)quat.setFromUnitVectors(up,velocity.multiplyScalar(1/speed));else quat.identity();
          const radius=(g.size || 0.018)*CELL*.5;
          scale.set(radius*.78,radius*(1+Math.min(2.2,speed*.7)),radius*.78);
          matrix.compose(position.set(worldX(g.x), (g.z || 0) * CELL, worldZ(g.y)), quat, scale);
          this.goreDroplets.setMatrixAt(droplets++, matrix);
        }
      }
      for (const b of run.blood || []) {
        if (blood >= MAX_BLOOD) break;
        quat.setFromEuler(rotation.set(-Math.PI / 2, 0, b.angle || 0));
        const stainSize=(b.size || 0.15)*CELL;
        scale.set(stainSize*1.65,stainSize*(1.1+Math.sin(b.angle||0)*.16),1);
        matrix.compose(position.set(worldX(b.x), 0.026+(blood%5)*.0005, worldZ(b.y)), quat, scale);
        this.bloodPools.geometry.attributes.bloodState.setXY(blood, (b.baseSize??b.size)<.14?3:Math.abs(b.id||blood)%3, Math.min(1,(b.age||0)/38));
        this.bloodPools.setMatrixAt(blood++, matrix);
      }
    }
    this.goreChunks.count = chunks;
    this.goreDroplets.count = droplets;
    this.bloodPools.count = blood;
    this.goreChunks.instanceMatrix.needsUpdate = true;
    this.goreDroplets.instanceMatrix.needsUpdate = true;
    this.bloodPools.instanceMatrix.needsUpdate = true;
    this.bloodPools.geometry.attributes.bloodState.needsUpdate = true;

    const hostile = this._hostileProjectiles ||= [], reflected = this._reflectedProjectiles ||= [], core = this._coreProjectiles ||= [];
    hostile.length = reflected.length = core.length = 0;
    for (const p of run.projectiles || []) {
      if (p.kind==='rocket') continue;
      if (p.core) core.push(p);
      else if (p.reflected) reflected.push(p);
      else hostile.push(p);
    }
    const updateProjectiles = (arr, mesh, size = 1) => {
      let i = 0;
      for (const p of arr) {
        if (i >= MAX_PROJECTILES) break;
        quat.setFromEuler(rotation.set((now * 0.006 + i) % TAU, now * 0.004, now * 0.005));
        scale.setScalar(size * (p.core ? 1 + Math.sin(now * 0.01 + i) * 0.12 : 1));
        matrix.compose(position.set(worldX(p.x), (p.z || 0) * CELL, worldZ(p.y)), quat, scale);
        mesh.setMatrixAt(i++, matrix);
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      return i;
    };
    updateProjectiles(hostile, this.projectileHostile, 1);
    updateProjectiles(reflected, this.projectileReflected, 1.05);
    updateProjectiles(core, this.projectileCore, 1.2);
    this.ordnanceDetails.update(this.projectileCore);
    this.projectileWakes.update(run.projectiles,this.settings.reducedMotion);

    const pGeo = this.projectileTrails.geometry;
    const lineStart = this._combatLineStart ||= new THREE.Vector3();
    const lineEnd = this._combatLineEnd ||= new THREE.Vector3();
    let pi = 0;
    while (pi < Math.min(MAX_PROJECTILES, hostile.length + core.length)) {
      const p = pi < hostile.length ? hostile[pi] : core[pi - hostile.length];
      const a = lineStart.set(worldX(p.x), (p.z || 0) * CELL, worldZ(p.y));
      const trailAge=Math.min(.12,p.age||0);
      const b = lineEnd.set(worldX(p.x - (p.vx || 0) * trailAge), ((p.z || 0) - (p.vz || 0) * trailAge) * CELL, worldZ(p.y - (p.vy || 0) * trailAge));
      setLine(pGeo, pi++, a, b);
    }
    pGeo.setDrawRange(0, pi * 2); pGeo.attributes.position.needsUpdate = true;
    const rGeo = this.reflectedTrails.geometry;
    let ri = 0;
    for (const p of reflected) {
      if (ri >= MAX_PROJECTILES) break;
      const a = lineStart.set(worldX(p.x), (p.z || 0) * CELL, worldZ(p.y));
      const trailAge=Math.min(.12,p.age||0);
      const b = lineEnd.set(worldX(p.x - (p.vx || 0) * trailAge), ((p.z || 0) - (p.vz || 0) * trailAge) * CELL, worldZ(p.y - (p.vy || 0) * trailAge));
      setLine(rGeo, ri++, a, b);
    }
    rGeo.setDrawRange(0, ri * 2); rGeo.attributes.position.needsUpdate = true;

    const tracerGeo = this.tracerLines.geometry;
    const railGeo = this.railLines.geometry;
    let ti = 0, li = 0;
    for (const t of run.tracers || []) {
      const a = lineStart.set(worldX(t.x), (t.z || 0) * CELL, worldZ(t.y));
      const b = lineEnd.set(worldX(t.tx), (t.tz || 0) * CELL, worldZ(t.ty));
      if (t.rail) { if (li < MAX_TRACERS) setLine(railGeo, li++, a, b); }
      else if (ti < MAX_TRACERS) setLine(tracerGeo, ti++, a, b);
    }
    tracerGeo.setDrawRange(0, ti * 2); tracerGeo.attributes.position.needsUpdate = true;
    railGeo.setDrawRange(0, li * 2); railGeo.attributes.position.needsUpdate = true;

    const muzzlePoints=this._fxMuzzles ||= this.weaponGroups.map(()=>new THREE.Vector3());
    this.weaponGroups.forEach((group,i)=>group.userData.muzzle?.getWorldPosition(muzzlePoints[i]));
    this.weaponFX.explosions?.setCamera(this.camera);
    this.weaponFX.explosions?.setSettings({ reducedMotion: this.settings.reducedMotion, gore: this.settings.gore });
    this.weaponFX.update(run,this._frameDt||.016,this.settings.gore,muzzlePoints,{camera:this.camera,reducedMotion:this.settings.reducedMotion});
    let ci = 0, gi = 0;
    for (const c of run.coins || []) {
      if (ci >= MAX_COINS) break;
      const y = ((c.z || 0) + 0.12 + Math.sin(now * 0.008 + ci) * 0.04) * CELL;
      quat.setFromEuler(rotation.set(Math.PI / 2 + Math.sin(now * 0.003 + ci) * 0.16, now * 0.008 + ci * 0.7, now * 0.004));
      scale.setScalar(1 + Math.min(0.24, Math.hypot(c.vx || 0, c.vy || 0) * 0.02));
      matrix.compose(position.set(worldX(c.x), y, worldZ(c.y)), quat, scale);
      this.coins.setMatrixAt(ci, matrix);
      const center=this._glintCenter ||= new THREE.Vector3(),axis=this._glintAxis ||= new THREE.Vector3();
      const start=this._glintStart ||= new THREE.Vector3(),end=this._glintEnd ||= new THREE.Vector3();
      center.set(worldX(c.x),y,worldZ(c.y));
      const glow=.08+Math.pow(Math.max(0,Math.sin(now*.008+ci*2.4)),8)*.32;
      for(let cross=0;cross<2;cross++){
        axis.setFromMatrixColumn(this.camera.matrixWorld,cross).multiplyScalar(glow*(cross?.6:1));
        setLine(this.coinGlints.geometry,gi++,start.copy(center).sub(axis),end.copy(center).add(axis));
      }
      ci++;
    }
    this.coins.count = ci; this.coins.instanceMatrix.needsUpdate = true;
    this.coinGlints.geometry.setDrawRange(0, gi * 2); this.coinGlints.geometry.attributes.position.needsUpdate = true;

    // Keep grapple feedback spatially anchored between the left fist and the
    // selected enemy. The cable is additive and lightly sagged so it reads in
    // the fog without covering the enemy's telegraph.
    const hookGeo = this.hookLine.geometry;
    const hookTarget = (run.course?.enemies || []).find(e => e.id === run.hookTarget && !e.dead);
    if ((run.hookTime || 0) > 0 && hookTarget) {
      const fist = this.weaponGroups[clamp(run.weapon || 0, 0, this.weaponGroups.length - 1)]?.getObjectByName('LeftArm');
      const start = lineStart;
      if (fist) fist.getWorldPosition(start); else this.camera.getWorldPosition(start);
      const end = lineEnd.set(worldX(hookTarget.x), 1.12 * CELL, worldZ(hookTarget.y));
      end.y += Math.sin(now * 0.018) * 0.07 * CELL;
      setLine(hookGeo, 0, start, end);
      hookGeo.setDrawRange(0, 2);
    } else {
      hookGeo.setDrawRange(0, 0);
    }
    hookGeo.attributes.position.needsUpdate = true;
  }

  _updateCamera(run, now) {
    const dt = this._frameDt || 0.016;
    const extracting = (run.extraction?.targetId != null && ['draw', 'incise', 'rip'].includes(run.extraction.phase)) ||
      (run.extraction?.completedAt > 0 && run.time - run.extraction.completedAt < .8);
    this._extractionLean = damp(this._extractionLean || 0, extracting ? (this.settings.reducedMotion ? .45 : 1) : 0, 9, dt);
    const eye = (0.4 + (run.z || 0) - (run.slide || 0) * 0.18) * CELL;
    const target = this._cameraTarget ||= new THREE.Vector3();
    this.bodycamMotion ||= new BodycamMotion();
    const mount = this.bodycamMotion.update(run, dt, {
      enabled: this.settings.bodycam !== false && !!this.renderer,
      reducedMotion: this.settings.reducedMotion || this._systemReducedMotion,
      now,
    });
    this.camera.position.set(mount.x, mount.y, 0);
    target.set(worldX(run.x),eye,worldZ(run.y));
    target.x += Math.cos(run.angle || 0) * CELL * .16 * this._extractionLean;
    target.z += Math.sin(run.angle || 0) * CELL * .16 * this._extractionLean;
    if(extracting){
      const id=run.extraction.targetId??run.extraction.lastTargetId;
      const corpse=this._enemyVisuals.get(id)?.root,chest=corpse?.getObjectByName('Socket_Chest'),abdomen=corpse?.getObjectByName('Socket_Abdomen');
      if(chest){
        const focus=this._harvestCameraFocus ||= new THREE.Vector3(),belly=this._harvestCameraBelly ||= new THREE.Vector3();
        chest.getWorldPosition(focus);if(abdomen){abdomen.getWorldPosition(belly);focus.lerp(belly,.42);}
        const dx=focus.x-worldX(run.x),dz=focus.z-worldZ(run.y),distance=Math.hypot(dx,dz);
        // Look into the open cavity from above, instead of viewing its rim
        // edge-on from standing distance. This changes presentation only.
        const lean=Math.min(distance*.8,2.2)*this._extractionLean;
        if(distance>.001){target.x=worldX(run.x)+dx/distance*lean;target.z=worldZ(run.y)+dz/distance*lean;}
      }
    }
    target.y -= CELL * .14 * this._extractionLean;
    this.cameraRig.position.copy(target);
    const yaw=-(run.angle||0)-Math.PI/2;
    this.cameraRig.rotation.y=yaw;
    // Visual-only view punch: aim (run.pitch) is untouched, the camera just
    // snaps up with each shot so every weapon reads with its own weight.
    const kickShot=clamp(run.shot||0,0,1),kickWeapon=run.weapon||0;
    const viewPunch=this.settings.reducedMotion?0:kickShot*[.011,.034,.05,.042,.008,.03,0,0][kickWeapon]+clamp((run.meleeContact||0)/.18,0,1)*(kickWeapon===6?.02:.006);
    this.camera.rotation.order='YXZ';
    this.camera.rotation.y=0;
    this.camera.rotation.x=(run.pitch||0)-this._extractionLean*.12+viewPunch+mount.pitch;
    const rifle=run.weapon===4||run.weapon===5;
    const rifleKick=rifle?clamp(run.rifleKick||0,0,1.25):0;
    const shake=this.settings.reducedMotion?0:((run.damage||0)*.012+(run.punch||0)*.008+(run.meleeContact||0)*.035+rifleKick*.002);
    this.camera.rotation.z=Math.cos(now*.035)*shake+mount.roll;
    const dash = clamp((run.dashTime || 0) / 0.18, 0, 1);
    const aim = clamp(run.aim || 0, 0, 1);
    const bodyLens = this.settings.bodycam !== false && this.renderer;
    const motionScale = this.settings.reducedMotion || this._systemReducedMotion ? 0 : 1;
    const targetFov = (bodyLens ? 110 : 92) + dash * (bodyLens ? 5 : 12) * motionScale - aim * 14 - this._extractionLean * 38 + clamp((run.speed || 0) - 1.3, 0, 2) * (bodyLens ? .8 : 2) * motionScale + rifleKick * .65 * motionScale;
    this.camera.fov = damp(this.camera.fov, targetFov, 12, dt);
    this.camera.updateProjectionMatrix();

    const shot = clamp(run.shot || 0, 0, 1);
    // Keep gun handling independent of the bodycam and authoritative aim.
    // The entire held assembly follows this pose, preserving both grips.
    this.weaponPresentation ||= new WeaponPresentation();
    const handling = this.weaponPresentation.update(run, dt, !!this.settings.reducedMotion, now);
    this.weaponRig.position.set(handling.position.x, handling.position.y, handling.position.z);
    this.weaponRig.rotation.set(handling.rotation.x, handling.rotation.y, handling.rotation.z);
    const weapon = clamp(run.weapon || 0, 0, this.weaponGroups.length - 1);
    updateOssuaryFitting(this.weaponGroups[0],run);
    for(let i=0;i<6;i++){
      const finger=this.weaponGroups[i].userData.viewArms?.rightArm?.userData.triggerFinger;
      if(finger){finger.rotation.x=-(i===weapon?handling.trigger:0)*.22;finger.rotation.z=-(i===weapon?handling.trigger:0)*.08;}
    }
    // A broader steel surface needs enough diffuse fill to retain its finish
    // in unlit rooms. This existing light is restricted to the viewmodel layer.
    this.viewmodelFill.intensity = weapon >= 4 ? 1.05 : .42;
    const brutal=run.brutal&&run.brutal.phase!=='idle'&&run.brutal.phase!=='cancelled';
    this.weaponGroups.forEach((group, index) => { group.visible = !run.vehicle?.occupied && !extracting && !brutal && index === weapon; });
    this.weaponGroups.forEach((group,i)=>{group.position.x=[.3,.31,.29,.31,.34,.34,.32,.32][i]*Math.min(1,this.camera.aspect/.9);});
    animateOssuary(this.weaponGroups[0],weapon===0?shot:0,now*.001,dt);
    animateBreach(this.weaponGroups[1].userData.model,now*.001,weapon===1?shot:0,dt);
    animateArc(this.weaponGroups[2].userData.model,now*.001,weapon===2?shot:0,dt);
    this.weaponGroups[weapon]?.userData.animate?.(now * 0.001, shot);
    if (weapon === 3) animateReliquary(this.weaponGroups[3], shot, now * 0.001, dt);
    const rifleFrame=this._rifleFrame ||= {heat:0,charge:0,shotSequence:0,kick:0,kickYaw:0};
    rifleFrame.shotSequence=run.shotSequence||0;
    for(let i=4;i<6;i++){
      rifleFrame.heat=i===4?(run.rifleHeat||0):0;rifleFrame.charge=i===5?(run.rifleCharge||0):0;
      rifleFrame.kick=weapon===i?rifleKick:0;rifleFrame.kickYaw=weapon===i?(run.rifleKickYaw||0):0;
      rifleFrame.mode=weapon===i?(run.lastShotMode||''):'';
      animateRifle(this.weaponGroups[i],weapon===i?shot:0,now*.001,dt,rifleFrame);
    }
    const sequence=run.shotSequence||0;
    if(this._casingRun!==run||sequence<(this._lastCasingSequence||0)){
      this._casingRun=run;this._lastCasingSequence=sequence;this.rifleCasings.reset();
    }
    if(rifle&&sequence>this._lastCasingSequence){
      const port=this.weaponGroups[weapon]?.userData?.ejectionSocket;
      if(port){
        const point=this._casingPoint ||= new THREE.Vector3();
        port.getWorldPosition(point);this.weaponRig.worldToLocal(point);
        for(let n=Math.max(this._lastCasingSequence+1,sequence-2);n<=sequence;n++)this.rifleCasings.spawn(point,n,weapon);
      }
    }
    this._lastCasingSequence=sequence;
    this.rifleCasings.update(dt);
    const meleeFrame=this._meleeFrame ||= {};
    for(let i=6;i<8;i++){
      meleeFrame.active=weapon===i&&!!run.meleeActive;meleeFrame.progress=meleeFrame.active?(run.meleeProgress||0):0;
      meleeFrame.heavy=!!run.meleeHeavy;meleeFrame.contact=weapon===i?clamp((run.meleeContact||0)/.18,0,1):0;
      meleeFrame.sawRev=weapon===i?(run.sawRev||0):0;meleeFrame.sawActive=weapon===i&&!!run.sawActive;
      meleeFrame.sequence=run.meleeSequence||0;meleeFrame.reducedMotion=!!this.settings.reducedMotion;
      animateMeleeWeapon(this.weaponGroups[i].userData.model,meleeFrame,now*.001,dt);
      if(weapon===i)this._fitMeleeArms(this.weaponGroups[i]);
    }
    if (weapon < 6) fitForegroundArms(this.weaponGroups[weapon]);
    const muzzle = this.weaponGroups[weapon]?.userData?.muzzle;
    if (muzzle) {
      const muzzleWorld = new THREE.Vector3();
      muzzle.getWorldPosition(muzzleWorld);
      this.weaponRig.worldToLocal(muzzleWorld);
      this.muzzleFlash.position.copy(muzzleWorld);
      const socketRotation=this._socketRotation ||= new THREE.Quaternion();
      const rigRotation=this._rigRotation ||= new THREE.Quaternion();
      if(rifle)this.muzzleFlash.quaternion.identity();
      else{
        muzzle.getWorldQuaternion(socketRotation);this.weaponRig.getWorldQuaternion(rigRotation);
        this.muzzleFlash.quaternion.copy(rigRotation.invert().multiply(socketRotation));
      }
    }
    const flashThreshold=weapon>=4?(this.settings.reducedMotion?.72:.5):.32;
    this.muzzleFlash.children[0].visible = weapon < 6 && shot > flashThreshold;
    this.muzzleFlash.children[1].visible=rifle&&shot>flashThreshold;
    this.muzzleFlash.children[1].material.opacity=(this.settings.reducedMotion?.14:.28)*shot;
    this.muzzleFlash.scale.setScalar(([.75,1.1,.45,.85,.64,.84,0,0][weapon])*(.55+shot*.55));
    const flashPhase=(run.shotSequence||0)*2.399;
    this.muzzleFlash.children[0].rotation.z=flashPhase;
    const flashColor=[0xffc180,0xffb44b,0x64eaff,0xffa66f,0xffc58d,0xffc88f][weapon] || 0xffa66f;
    this.muzzleFlash.children[0].material.color.set(flashColor);
    this.muzzleFlash.children[0].material.emissive?.set(flashColor);
    const light = this.muzzleFlash.children.find(child => child.isPointLight);
    if (light) {light.color.set(flashColor);light.intensity = weapon < 6 && shot > flashThreshold ? (rifle?5.5:8) * shot : 0;}
    if(this.muzzleSpikes){
      const lit=weapon<6&&shot>flashThreshold,spikeLen=[1.15,1.5,.9,1.1,.9,1.3][weapon]||1;
      this.muzzleSpikes.forEach((spike,i)=>{spike.visible=lit;if(lit){spike.material.color.set(flashColor).lerp(WHITE_HOT,.4);spike.material.opacity=(this.settings.reducedMotion?.2:.6)*shot;spike.scale.set(spikeLen*(i?.7:1)*(.65+shot*.35),1+(i?0:shot*.2),1);spike.rotation.z=flashPhase+.35+i*1.19;}});
      if(weapon<6&&shot>this._muzzleShotPrev+.3)this._muzzleSmokeT=weapon===2||weapon===5?1.25:1;
      this._muzzleShotPrev=shot;
      this._muzzleSmokeT=Math.max(0,this._muzzleSmokeT-dt*1.1);
      const smokeT=weapon<6&&!this.settings.reducedMotion?this._muzzleSmokeT:0,age=1-smokeT;
      this.muzzleSmoke.forEach((puff,i)=>{puff.visible=smokeT>0;if(smokeT>0){puff.position.set((i-1)*.05*age,.05+age*(.16+i*.06),-.05-age*(.22+i*.1));puff.scale.setScalar(.5+age*(1.4+i*.5));puff.material.opacity=Math.min(1,smokeT*2.2)*smokeT*.16*(weapon===4?.7:1);puff.rotation.z=i*1.9+age*.8;}});
    }
  }

  // Every scene draw goes through the body-camera resolve so shader programs
  // compiled during warmup match the ones used in play.
  _renderScene(nowMs = (typeof performance !== 'undefined' ? performance.now() : 0)) {
    // Map/door changes still use the legacy global invalidation flag. Native
    // WebGPU only consumes per-light flags, so translate it once per change.
    if(this.renderer.isWebGPURenderer&&this.renderer.shadowMap.needsUpdate){
      this.scene.traverse(object=>{if(object.isLight&&object.castShadow)object.shadow.needsUpdate=true;});
      this.renderer.shadowMap.needsUpdate=false;
    }
    const pass = this.bodycam;
    if (pass) {
      pass.enabled = this.settings.bodycam !== false;
      pass.reducedMotion = this.settings.reducedMotion || this._systemReducedMotion;
      pass.render(this.scene, this.camera, nowMs);
    } else this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = Math.max(1, this.canvas?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280));
    const height = Math.max(1, this.canvas?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720));
    const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, width<700?1.35:1.5)*(this._renderScale||1);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    if (this.renderer) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
    } else if (this.canvas) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
    }
    // Keep resize/reflow consistent with the authored close-camera framing.
    // The rig-only readability fill and articulated hands are composed for the
    // 0.64 scale; dropping back to .55 here made a window resize silently undo
    // the intended silhouette/hand read.
    this.weaponGroups?.forEach(group=>{
      group.scale.setScalar(width<600?.4:.64);
      group.traverse(node=>{if(node.name.startsWith('MeshySleeve_')){const widthScale = width < 600 ? .78 : 1;node.scale.set(widthScale,1,widthScale);}});
    });
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setSettings(settings = {}) {
    if (typeof settings.reducedMotion === 'boolean') this.settings.reducedMotion = settings.reducedMotion;
    if (typeof settings.gore === 'boolean') this.settings.gore = settings.gore;
    if (typeof settings.bodycam === 'boolean') this.settings.bodycam = settings.bodycam;
  }

  _reportPreparation(stage) {
    this._preparationStage = stage;
    (this._preparationHistory ||= []).push({stage,at:performance.now()});
    if(this._preparationHistory.length>32)this._preparationHistory.shift();
    this.onPreparationProgress?.(stage);
  }

  async _prepareWeaponResources(course,run=null) {
    this._reportPreparation('Loading the world and its inhabitants');
    // Texture callbacks can change shader features. Wait until their final
    // materials exist before compiling both screen and transmission variants.
    const weaponResources = [];
    for (const group of this.weaponGroups) group.traverse(object => {
      if (object.userData.resourcesReady) weaponResources.push(object.userData.resourcesReady);
    });
    await Promise.all([this.harborWorld?.ready,this._materialsReady, this._wardenReady, this._survivorReady, this._ashWitnessReady, this.brutalCombatVisuals.ready, this.verminVisuals.ready, this.extractionVFX?.cutaways?.ready, roomMaterialsReady(), bloodAtlasReady(), ...weaponResources]);
    // Loaded survivor bodies and sleeves replace their fallback meshes. Run
    // their visual binding once before compiling so wound hooks/materials
    // cannot first appear on the first playable frame. Preparation already
    // owns this course and _weaponsPrepared is false, so render cannot restart
    // preparation or draw the unfinished scene.
    if(this._course!==course)return;
    if(run?.course===course)this.render(run);
    this.verminVisuals.setupArm();
    const renderer = this.renderer;
    if (!renderer || this._course !== course) return;
    if(course.coastal){
      // Prepare the exterior in every direction, not just the spawn view.
      // Otherwise turning or walking to another street compiles cold materials.
      this._reportPreparation('Preparing the open coast');
      const previousTarget=renderer.getRenderTarget(),culling=[];
      this.scene.traverseVisible(object=>{if(object.isMesh||object.isLine||object.isPoints){culling.push([object,object.frustumCulled]);object.frustumCulled=false;}});
      try{
        this.bodycam._ensureTarget();renderer.setRenderTarget(this.bodycam.target);
        await this._compilePreparedScene(renderer);
        renderer.setRenderTarget(previousTarget);
        for(const [object,culled]of culling)object.frustumCulled=culled;
        if(this.renderer!==renderer||this._course!==course)return;
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
        if(this.renderer!==renderer||this._course!==course)return;
        this._renderScene();
      }finally{renderer.setRenderTarget(previousTarget);for(const [object,culled]of culling)object.frustumCulled=culled;}
      // G and ambient crawls use hidden skinned/morph pools. Preparing only
      // visible world meshes leaves their first real draw on the input frame.
      await this._prepareInteractionResources(course);
      if(this.renderer!==renderer||this._course!==course)return;
      await this._prepareCoastalEnemies(course);
      if(this.renderer!==renderer||this._course!==course)return;
      await this._prepareHarborInteriors(course);
      if(this.renderer!==renderer||this._course!==course)return;
      this._preparedCourse=course;this._weaponsPrepared=true;
      return;
    }
    this._prepareHorrorScares(course);
    await this._prepareDungeonEnemies(course);
    if(this.renderer!==renderer||this._course!==course)return;
    // Keep a representative skinned enemy alive so its programs are compiled
    // in both output color spaces before the first spawn or Arc transmission pass.
    if (this.wardenTemplate && !this._wardenWarmup) {
      this._wardenWarmup = createWarden(this.wardenTemplate, this.wardenClips, 0);
      this._wardenWarmup.visible = false;
      this.scene.add(this._wardenWarmup);
    }
    if (this.bloodworksWardenTemplate && !this._bloodworksWardenWarmup) {
      this._bloodworksWardenWarmup = createWarden(this.bloodworksWardenTemplate, this.bloodworksWardenClips, 2, 'warden');
      this._bloodworksWardenWarmup.visible = false;
      this.scene.add(this._bloodworksWardenWarmup);
    }
    if(!this._bellWarmups){warmBellwraithVariants();this._bellWarmups=['bellwraith','echo','rustBell','ivoryBell'].map(variant=>{const actor=createBellwraith({variant});actor.visible=false;this.scene.add(actor);return actor;});}
    if(this._survivors?.status==='ready'&&!this._afterlifeWarmups){
      this._afterlifeWarmups=[0,1].map(kind=>{const actor=kind===0&&this._ashWitnessAsset?createAfterlifeModel(this._ashWitnessAsset,kind):createAfterlifeEnemy(this._survivors.template,this._afterlifeClips,kind);actor.visible=false;disableShadowCasting(actor);this.scene.add(actor);return actor;});
    }
    for(const actor of this._afterlifeWarmups||[])if(actor.userData.afterlifeModel)this.brutalCombatVisuals.physics.prepare?.(actor);
    // compileAsync alone leaves the first surgery draw's driver pipeline cold.
    // Prime both live/frozen skin masks and cap variants behind the loading UI.
    const anatomy = this.brutalCombatVisuals.anatomy;
    if (anatomy) anatomy.warmed = false;
    const anatomyPreparation = anatomy?.warmup(this._afterlifeWarmups?.find(actor => actor.userData.afterlifeModel));
    let anatomyReleased = false;
    const releaseAnatomy = () => {
      if (!anatomyPreparation || anatomyReleased) return;
      anatomyReleased = true;
      anatomyPreparation.group.removeFromParent();
      anatomyPreparation.release();
    };
    if (anatomyPreparation) {
      anatomyPreparation.group.traverse(object => { if (object.isMesh) { object.frustumCulled = false; object.castShadow = false; } });
      this.scene.add(anatomyPreparation.group);
    }
    this._reportPreparation('Preparing the lighting');
    const previousTarget = renderer.getRenderTarget();
    try {
      // Compile the actual HDR target once; it owns the game's world pass.
      this.bodycam._ensureTarget();
      renderer.setRenderTarget(this.bodycam.target);
      await renderer.compileAsync(this.scene,this.camera);
    } catch (error) {
      releaseAnatomy();
      throw error;
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
    if (this.renderer !== renderer || this._course !== course) { releaseAnatomy(); return; }
    this._reportPreparation('Getting your equipment ready');
    // Allow the loading UI to paint before the final GPU uploads.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (this.renderer !== renderer || this._course !== course) { releaseAnatomy(); return; }
    // compileAsync does not upload hidden geometry or allocate transmission
    // buffers. Upload one gun per browser frame behind the loading overlay.
    // Later floors reuse the equipment buffers and only need a world upload.
    const visibility = this.weaponGroups.map(group => group.visible);
    const hiddenResources = [];
    for (const group of [...this.weaponGroups, this.muzzleFlash]) group.traverse(object => {
      if (object === group || object.isLight) return;
      hiddenResources.push([object, object.visible, object.frustumCulled]);
      object.visible = true;
      if (object.isMesh || object.isLine || object.isPoints) object.frustumCulled = false;
    });
    if (this._wardenWarmup) {
      this._wardenWarmup.visible = true;
      this.camera.getWorldPosition(this._wardenWarmup.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 4);
    }
    if (this._bloodworksWardenWarmup) {
      this._bloodworksWardenWarmup.visible = true;
      this.camera.getWorldPosition(this._bloodworksWardenWarmup.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), 4);
    }
    for(const actor of this._bellWarmups||[]){actor.visible=true;this.camera.getWorldPosition(actor.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),4);}
    for(const actor of this._afterlifeWarmups||[]){actor.visible=true;this.camera.getWorldPosition(actor.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),4);}
    // Compile the casing material before the first automatic round. The
    // temporary instance sits below the floor and is removed before display.
    this.rifleCasings.mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,-100,0));
    this.rifleCasings.mesh.count=1;
    this.rifleCasings.mesh.instanceMatrix.needsUpdate=true;
    // Upload the bounded dungeon warning-ring pool while the loading screen is
    // active. The matrix is placed below the floor, then the empty pool is
    // restored before control resumes.
    this.spawnTelegraphRings.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -100, 0));
    this.spawnTelegraphRings.count = 1;
    this.spawnTelegraphRings.instanceMatrix.needsUpdate = true;
    // Upload the rest of the floor, including concealed scare meshes, during
    // loading rather than when the player first turns toward them. Restore
    // visibility before painting; lights retain the warmed shader layout.
    const worldResources = [];
    this.worldRoot.traverse(object => {
      if (object.isLight) return;
      worldResources.push([object, object.visible, object.frustumCulled]);
      object.visible = true;
      if (object.isMesh || object.isLine || object.isPoints) object.frustumCulled = false;
    });
    const restoreWorld = () => {
      for (const [object, visible, culled] of worldResources) {
        object.visible = visible; object.frustumCulled = culled;
      }
    };
    try {
      const weaponCount=this._equipmentUploaded?1:this.weaponGroups.length;
      for (let weapon = 0; weapon < weaponCount; weapon++) {
        if(this.renderer!==renderer||this._course!==course)return;
        this._reportPreparation('Preparing equipment '+(weapon+1)+' / '+weaponCount);
        this.weaponGroups.forEach((group, i) => { group.visible = i === weapon; });
        this._renderScene();
        if (weapon === 0) restoreWorld();
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      }
      if(this.renderer!==renderer||this._course!==course)return;
      if (anatomyPreparation) {
        await renderer.backend.device.queue.onSubmittedWorkDone();
        if(this.renderer!==renderer||this._course!==course)return;
        anatomy.warmupCourse = course;
      }
      this._equipmentUploaded=true;
    } finally {
      releaseAnatomy();
      restoreWorld();
      this.rifleCasings.mesh.count=0;
      this.spawnTelegraphRings.count = 0;
      this.spawnTelegraphRings.instanceMatrix.needsUpdate = true;
      for (const [object, visible, culled] of hiddenResources) {
        object.visible = visible;
        object.frustumCulled = culled;
      }
      if (this._wardenWarmup) this._wardenWarmup.visible = false;
      if (this._bloodworksWardenWarmup) this._bloodworksWardenWarmup.visible = false;
      for(const actor of this._bellWarmups||[])actor.visible=false;
      for(const actor of this._afterlifeWarmups||[])actor.visible=false;
      this.weaponGroups.forEach((group, i) => { group.visible = visibility[i]; });
      if(this.renderer===renderer&&this._course===course){
        if (this.menuCinematic?.active) this.menuCinematic.render(renderer);
        else this._renderScene();
      }
    }
    if(this.renderer!==renderer||this._course!==course)return;
    await this._prepareInteractionResources(course);
    if(this.renderer!==renderer||this._course!==course)return;
    this._preparedCourse = course;
    this._weaponsPrepared = true;
  }

  async _prepareInteractionResources(course){
    const renderer=this.renderer,restores=[];
    const previous=renderer.getRenderTarget();
    this._reportPreparation('Preparing hands and interaction effects');
    try{
      // The menu's run is "ready", so updateSurvivors hides the local body.
      // It becomes visible on the first playable frame and needs its own
      // prepared skinned wound materials, including surfaces below the camera.
      const body=this._survivors?.local;
      if(body){
        const visible=body.visible,culling=[];body.visible=true;
        body.traverse(object=>{if(object.isMesh){culling.push([object,object.frustumCulled]);object.frustumCulled=false;}});
        restores.push(()=>{body.visible=visible;for(const [object,culled]of culling)object.frustumCulled=culled;});
      }
      const extraction=await this.extractionVFX?.prepareWarmup?.();if(extraction)restores.push(extraction);
      const vermin=this.verminVisuals.prepareWarmup?.();if(vermin)restores.push(vermin);
      if(!restores.length||this.renderer!==renderer||this._course!==course)return;
      this.bodycam._ensureTarget();renderer.setRenderTarget(this.bodycam.target);
      await this._compilePreparedScene(renderer);
      renderer.setRenderTarget(previous);
      if(this.renderer!==renderer||this._course!==course)return;
      this._renderScene();
      await renderer.backend.device.queue.onSubmittedWorkDone();
    }finally{renderer.setRenderTarget(previous);for(const restore of restores.reverse())restore();}
  }

  async _compilePreparedScene(renderer){
    // Native shader preparation invokes updateBefore nodes, including shadows.
    // Keep shadow rendering out of that pass: culling may be disabled to warm
    // materials in every direction, which must not expand each shadow draw.
    const shadows=[];
    this.scene.traverse(object=>{if(object.isLight&&object.castShadow&&object.shadow){
      shadows.push([object.shadow,object.shadow.autoUpdate,object.shadow.needsUpdate]);
      object.shadow.autoUpdate=false;object.shadow.needsUpdate=false;
    }});
    try{
      const compilation=renderer.compileAsync(this.scene,this.camera),lost=renderer.backend?.device?.lost;
      if(lost)await Promise.race([compilation,lost.then(()=>{throw new Error('Graphics device lost during preparation. Reload the game to recover.');})]);
      else await compilation;
    }
    finally{for(const [shadow,auto,needed]of shadows){shadow.autoUpdate=auto;shadow.needsUpdate=needed;}}
  }

  async _prepareHarborInteriors(course){
    const renderer=this.renderer,world=this.harborWorld,interiors=world?.interiors;
    if(!renderer||!interiors?.rooms?.size||this._course!==course)return;
    const previous=renderer.getRenderTarget(),visibility=new Map(),culling=new Map();
    const roomLightPosition=interiors.practicalLight?.position.clone();
    const roomLightIntensities=[interiors.areaLight?.intensity,interiors.practicalLight?.intensity];
    const exteriorLightIntensities=new Map(world.root.children.filter(child=>child.isLight).map(light=>[light,light.intensity]));
    const transforms=[this.cameraRig,this.camera].filter(Boolean).map(object=>({object,p:object.position.clone(),q:object.quaternion.clone(),s:object.scale.clone(),mask:object.layers.mask}));
    const remember=object=>{if(!visibility.has(object))visibility.set(object,object.visible);};
    remember(world.root);remember(interiors.root);
    if(interiors.lightingRoot)remember(interiors.lightingRoot);
    for(const child of world.root.children)remember(child);
    for(const room of interiors.rooms.values()){remember(room);room.traverse(object=>{if(object.isMesh)culling.set(object,object.frustumCulled);});}
    const current=()=>this.renderer===renderer&&this._course===course&&this.harborWorld===world;
    try{
      world.root.visible=true;interiors.root.visible=true;
      // Match the normal room visibility boundary without touching gameplay's
      // activeInterior, interiors.active, or its exterior restoration map.
      for(const child of world.root.children)if(child!==interiors.root&&!child.isLight)child.visible=false;
      for(const [object]of culling)object.frustumCulled=false;
      this.bodycam._ensureTarget();
      for(const definition of course.harborRooms||[]){
        if(!current())return;
        const room=interiors.rooms.get(definition.id);if(!room)continue;
        this._reportPreparation(`Preparing interior: ${definition.name}`);
        for(const entry of interiors.rooms.values())entry.visible=entry===room;
        interiors.setLighting?.(definition);
        if(this.cameraRig){this.cameraRig.position.set(0,0,0);this.cameraRig.quaternion.identity();this.cameraRig.scale.set(1,1,1);this.cameraRig.updateMatrixWorld(true);}
        this.camera.position.set(definition.spawn.x*CELL,1.65,definition.spawn.y*CELL);
        this.camera.quaternion.identity();this.camera.scale.set(1,1,1);this.camera.layers.enable(0);
        this.camera.lookAt(definition.x,1.65,definition.z);this.camera.updateMatrixWorld(true);
        renderer.setRenderTarget(this.bodycam.target);
        await this._compilePreparedScene(renderer);
        if(!current())return;
        renderer.setRenderTarget(previous);this._renderScene();
        await renderer.backend.device.queue.onSubmittedWorkDone();
        if(!current())return;
        await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      }
    }finally{
      renderer.setRenderTarget(previous);
      for(const [object,value]of visibility)object.visible=value;
      for(const [object,value]of culling)object.frustumCulled=value;
      if(roomLightPosition)interiors.practicalLight.position.copy(roomLightPosition);
      if(interiors.areaLight)interiors.areaLight.intensity=roomLightIntensities[0];
      if(interiors.practicalLight)interiors.practicalLight.intensity=roomLightIntensities[1];
      for(const [light,intensity]of exteriorLightIntensities)light.intensity=intensity;
      for(const saved of transforms){saved.object.position.copy(saved.p);saved.object.quaternion.copy(saved.q);saved.object.scale.copy(saved.s);saved.object.layers.mask=saved.mask;saved.object.updateMatrix();}
      this.cameraRig?.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
    }
  }

  renderMenu(run, nowMs) {
    if (!this.renderer) return;
    if (this._warmupCourse !== run.course) this.render(run, nowMs);
    this.menuCinematic ||= new MenuCinematic({ materials: this.materials, environment: this.scene.environment });
    this.menuCinematic.active = true;
    this.menuCinematic.setAsset(this._ashWitnessAsset);
    this.menuCinematic.update(nowMs, this.width, this.height, this.settings.reducedMotion || this._systemReducedMotion);
    this.menuCinematic.render(this.renderer);
    this.canvas.dataset.menuScene = this.menuCinematic.actors.length ? 'ready' : 'loading';
  }

  queueHorrorScare(type,run,nowMs=(typeof performance !== 'undefined'?performance.now():0)) {
    this._horrorScareQueue.push({type,run:{x:run.x,y:run.y,angle:run.angle},nowMs});
    if(this._horrorScareQueue.length>3)this._horrorScareQueue.shift();
  }

  _prepareHorrorScares(course) {
    if(this.horrorEncounters&&!this.horrorEncounters.asset&&this._ashWitnessAsset){
      this.horrorEncounters.dispose();
      this.horrorEncounters=new HorrorEncounterVisuals(this.worldRoot,course,this._ashWitnessAsset,this.materials);
    }
    if(this.horrorScares&&!this.horrorScares.asset&&this._ashWitnessAsset){
      this.horrorScares.root.removeFromParent();
      this.horrorScares=new HorrorScares(this.worldRoot,course,this._ashWitnessAsset,this.materials);
    }
  }

  render(run, nowMs = (typeof performance !== 'undefined' ? performance.now() : 0)) {
    if (this.menuCinematic) { this.menuCinematic.active = false; this.menuCinematic.lastNow = null; }
    if (!run?.course) return;
    this._frameDt = this._lastNow ? clamp((nowMs - this._lastNow) / 1000, 0.001, 0.05) : 0.016;
    this._lastNow = nowMs;
    const key = run.course.index ?? `${run.course.w}:${run.course.h}`;
    if (this._worldKey !== key || this._course !== run.course) this._buildWorld(run.course);
    else if (this._dungeonRevision !== (run.course.dungeonRevision ?? 0)) this._syncDungeonWalls(run.course);
    this._prepareHorrorScares(run.course);
    if(this.horrorScares?.asset)for(const event of this._horrorScareQueue.splice(0))this.horrorScares.queue(event.type,event.run,event.nowMs);
    if(this.horrorScares)this.horrorScares.canTrigger=(kind)=>this.horrorScareGate?.(kind,run)??true;
    if(!this.freeCamera)this.horrorScares?.update(run,nowMs,this.horrorAudio,this.settings.reducedMotion||this._systemReducedMotion);
    if(this.horror){this.horror.setRoomProgression?.(run.roomProgression);this.horror.authored?.animate(this.settings.reducedMotion?0:nowMs*.001);if(this.horror.organ){const pulse=1+Math.sin(nowMs*.002)*.025;this.horror.organ.scale.set(1.5*pulse,2.1,1.15*pulse);}}
    this.brutalCombatVisuals.beginFrame();
    this.verminVisuals.beginFrame();
    this.playerInjuryVisuals.beginFrame();
    this._updateCamera(run, nowMs);
    if(run.vehicle?.occupied){
      const v=run.vehicle,back=castRay(run.course,v.x,v.y,v.angle+Math.PI,2.5).dist;
      this.cameraRig.position.set(v.x*4,5.2,v.y*4);this.cameraRig.rotation.set(0,-v.angle-Math.PI/2,0);
      this.camera.position.set(0,0,Math.max(.45,Math.min(2.3,back-.18))*4);
      this.camera.rotation.set(-.32,0,0);this.camera.fov=78;this.camera.updateProjectionMatrix();
    }
    this.harborWorld?.update(nowMs*.001,run.vehicle,run);
    if(!this.freeCamera)this.playerInjuryVisuals.applyCamera(run,nowMs);
    if(this.freeCamera){
      const view=this.freeCamera;
      this.cameraRig.position.set(view.x,view.y,view.z);
      this.cameraRig.rotation.set(0,-view.angle-Math.PI/2,0);
      this.camera.position.set(0,0,0);
      this.camera.rotation.set(view.pitch,0,0);
      this.camera.fov=75;this.camera.updateProjectionMatrix();
    }
    this.afterlifeMapDesign?.update?.(run, nowMs, this.settings.reducedMotion);
    this.journeyVisuals?.update(run,nowMs,this.settings.reducedMotion||this._systemReducedMotion);
    this.afterlifeLighting.update(this.camera, this.renderer, nowMs, this.settings.reducedMotion);
    this.afterlifeAtmosphere?.update(run, nowMs, this.camera, { reducedMotion: this.settings.reducedMotion });
    this._updateEnemies(run, nowMs);
    this._updatePeer(run, nowMs);
    this._updateExit(run, nowMs);
    this._updateDungeonPickups(run, nowMs);
    updateDungeonWeaponLoot(this._storyWeaponLoot,run.course.harbor?run.backpack.weaponPickups:run.dungeonProgression?.lootCollected,nowMs,this.settings.reducedMotion||this._systemReducedMotion,{x:run.x*4,z:run.y*4});
    this._dungeonSupplies?.update(run.dungeonProgression?.suppliesCollected);
    this._scavengerCaches?.update(run.backpack?.collected);
    updateDungeonEvidence(this._storyEvidence,run.storyRecords,nowMs,this.settings.reducedMotion||this._systemReducedMotion,this.camera);
    this._updateCombat(run, nowMs);
    updateSurvivors(this, run, nowMs);
    this.playerInjuryVisuals.update(run,nowMs,this._frameDt);
    // Final articulation follows the mixer and neck/shoulder reach. Both peers
    // use the same authoritative bite clock; only presentation is layered here.
    for(const player of [run,run.peer]){
      const bite=player?.bite;
      if(!bite?.enemyId||bite.phase==='idle')continue;
      const articulation=this._enemyVisuals.get(bite.enemyId)?.root?.userData.afterlife?.articulation;
      applyBiteArticulation(articulation,bite,nowMs,this.settings.reducedMotion||this._systemReducedMotion);
    }
    this.brutalCombatVisuals.update(run);
    // Harvest cuts follow the final imported skeleton after ragdoll sync.
    this.extractionVFX?.update(run, nowMs, this._frameDt || .016, {
      gore: this.settings.gore,
      reducedMotion: this.settings.reducedMotion,
    });
    this.verminVisuals.update(run,nowMs);
    const presenceSettings={...this.settings,reducedMotion:this.settings.reducedMotion||this._systemReducedMotion,playing:!!this.horrorPresence?.enabled};
    this.horrorEncounters?.update(run,this._frameDt,this.horrorPresence,presenceSettings);
    this.horrorCuff?.update(run,this._frameDt,this.horrorPresence,presenceSettings);
    if (this.renderer && this._warmupCourse !== run.course) {
      this._warmupCourse = run.course;
      // Campaign sectors reuse the already-uploaded actor and weapon set. A
      // dungeon floor owns authored wave/scare instances and must be warmed;
      // retaining the campaign fast path avoids replaying the full eight-gun
      // sweep during a networked or campaign sector handoff.
      if (run.course.dungeon || run.course.harbor || !this._weaponsPrepared) {
        // Preparation is scoped to a course. A later dungeon floor owns a new
        // world root and new enemy/scare instances, so it needs the same upload
        // pass as the first floor even though the weapon geometry itself is
        // shared. Keeping this on the course identity also prevents repeated
        // starts while the async pass is still in flight.
        this._weaponsPrepared = false;
        this._preparedCourse = null;
        this._warmupPromise = this._prepareWeaponResources(run.course,run);
      }
    }
    // Do not draw a half-loaded world before its async preparation completes.
    // That draw would synchronously compile temporary materials, then repeat
    // the work after the textures arrive.
    if (this.renderer && !this._weaponsPrepared) return;
    if (this.renderer) {
      this._transmissionRegion ||= new TransmissionRegion(this.renderer);
      if(this._transmissionScene!==this.worldRoot){this._transmissionRegion.refresh(this.scene);this._transmissionScene=this.worldRoot;}
      this._transmissionRegion.begin(this.camera);
      const inspectionHidden=[];
      if(this.freeCamera||run.vehicle?.occupied){
        // Preserve viewmodel lights: hiding their parent would recompile shaders.
        this.weaponRig.traverse(object=>{if(object.isMesh||object.isLine||object.isPoints){inspectionHidden.push([object,object.visible]);object.visible=false;}});
        if(this._survivors?.local){inspectionHidden.push([this._survivors.local,this._survivors.local.visible]);this._survivors.local.visible=false;}
      }
      try{this._renderScene(nowMs);}finally{for(const [object,visible] of inspectionHidden)object.visible=visible;this._transmissionRegion.end();}
    }
    if(!this._lastDiagnostics||nowMs-this._lastDiagnostics>=500){this._diag=this._collectDiagnostics(run);this._lastDiagnostics=nowMs;}
  }

  _collectDiagnostics(run) {
    let meshes = 0, instanced = 0, uniqueGeometry = new Set(), uniqueMaterial = new Set(), triangles = 0;
    this.scene.traverse(obj => {
      if (!obj.isMesh) return;
      meshes++;
      if (obj.isInstancedMesh) instanced++;
      if (obj.geometry) {
        uniqueGeometry.add(obj.geometry);
        const index = obj.geometry.index;
        triangles += index ? index.count / 3 : (obj.geometry.attributes.position?.count || 0) / 3;
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => uniqueMaterial.add(m));
        else uniqueMaterial.add(obj.material);
      }
    });
    const info = this.renderer?.info;
    return {
      renderer: 'three.js',
      backend: this.renderer ? 'webgpu' : null,
      bodycam: this.bodycam?.diagnostics() || null,
      bodycamMount: this.bodycamMotion ? { ...this.bodycamMotion.pose } : null,
      worldBatch: this._worldBatch || null,
      staticWorld: this._worldStatic || null,
      boundedLighting: this._boundedLighting,
      afterlifeLighting: this.afterlifeLighting?.diagnostics(),
      afterlifeAtmosphere: this.afterlifeAtmosphere?.diagnostics(),
      afterlifeSurfaces: this._afterlifeSurfaceDiagnostics,
      afterlifeMapDesign: this.afterlifeMapDesign?.diagnostics,
      crowd: this._crowdDiagnostics,
      afterlifeEnemies: [...this._enemyVisuals.values()].filter(e=>e.root.userData.afterlife).length,
      ashWitness: { loaded: !!this._ashWitnessAsset, error: this._ashWitnessError, instances: [...this._enemyVisuals.values()].filter(e=>e.root.userData.afterlifeModel).length, clips: this._ashWitnessAsset?.clips.map(clip => clip.name) || [],articulation:[...this._enemyVisuals.values()].filter(e=>e.root.userData.afterlifeModel).slice(0,3).map(e=>articulationDiagnostics(e.root.userData.afterlife.articulation)) },
      transmissionCoverage: this._transmissionRegion?.coverage ?? 1,
      weaponBatch: this._weaponBatch,
      survivor: {status:this._survivors?.status||'pending',source:this._survivors?.local?.userData?.source||'procedural-fallback',viewSleeves:this._survivors?.viewSleeves||0,error:this._survivors?.error||null},
      playerInjury: this.playerInjuryVisuals.diagnostics(),
      targetFrameMs: 1000 / 144,
      webgpu: !!this.renderer,
      error: this.rendererError ? String(this.rendererError.message || this.rendererError) : null,
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      renderScale:this._renderScale,
      fov: Number(this.camera.fov.toFixed(2)),
      meshes,
      instancedMeshes: instanced,
      geometries: uniqueGeometry.size,
      materials: uniqueMaterial.size,
      triangles: Math.round(triangles),
      calls: info?.render?.drawCalls ?? info?.render?.calls ?? 0,
      gpuTriangles: info?.render?.triangles || 0,
      rendererGeometries: info?.memory?.geometries || 0,
      explosions: this.weaponFX?.explosions?.diagnostics?.() || null,
      impacts: this.weaponFX?.impacts?.diagnostics?.() || null,
      extraction: this.extractionVFX?.diagnostics?.() || null,
      brutalCombat: this.brutalCombatVisuals?.diagnostics() || null,
      vermin: this.verminVisuals?.diagnostics() || null,
      rendererTextures: info?.memory?.textures || 0,
      enemyContactShadows: this.enemyContactShadows?.count || 0,
      enemies: (run.course?.enemies || []).filter(e => !e.dead).length,
      gore: this.settings.gore ? (run.gore || []).length : 0,
      blood: this.settings.gore ? (run.blood || []).length : 0,
      projectiles: (run.projectiles || []).length,
      spawnTelegraphs: this.spawnTelegraphRings?.count || 0,
      tracers: (run.tracers || []).length,
      coins: (run.coins || []).length,
      world: this.harborWorld ? 'quarantine-harbor' : this.horror?.sector || 'bloodworks',
      harbor: this.harborWorld?.diagnostics || null,
      warden: this._wardenStatus,
      wardenInstances: [...this._enemyVisuals.values()].filter(e=>e.root.userData.warden).length,
    };
  }

  diagnostics() {
    return { ...this._diag, horrorPresence:this.horrorEncounters?.diagnostics||null,horrorCuff:this.horrorCuff?.diagnostics()||null, menu: this.menuCinematic?.diagnostics(this.renderer) || null };
  }

  dispose() {
    disposeBloodAtlas();
    this._isDisposed = true;
    this.menuCinematic?.dispose();
    this.afterlifeAtmosphere?.dispose();
    this.journeyVisuals?.release();
    this.afterlifeLighting?.dispose();
    this.playerInjuryVisuals?.dispose();
    this.horrorCuff?.dispose();
    this.horrorEncounters?.dispose();
    this.verminVisuals?.dispose();
    if (this.worldRoot) this.worldRoot.userData.afterlifeSurfaceDisposed = true;
    disposeSurvivors(this);
    if (this.worldRoot) disposeObject(this.worldRoot);
    if (this.combatRoot) disposeObject(this.combatRoot);
    this.extractionVFX?.dispose();
    this.brutalCombatVisuals?.dispose();
    if (this.weaponRig) disposeObject(this.weaponRig);
    this.materials && Object.values(this.materials).forEach(m => m.dispose?.());
    this.materials.afterlifeWood.map?.dispose();
    this.materials.wornSteel.map?.dispose();
    if(this._wardenWarmup){this._wardenWarmup.removeFromParent();disposeObject(this._wardenWarmup);}
    if(this._bloodworksWardenWarmup){this._bloodworksWardenWarmup.removeFromParent();disposeObject(this._bloodworksWardenWarmup);}
    for(const actor of this._bellWarmups||[]){actor.removeFromParent();disposeObject(actor);}
    for(const actor of this._afterlifeWarmups||[]){actor.removeFromParent();disposeObject(actor);}
    if(this._ashWitnessAsset)disposeObject(this._ashWitnessAsset.template,true);
    if(this.wardenTemplate)disposeObject(this.wardenTemplate,true);
    if(this.bloodworksWardenTemplate)disposeObject(this.bloodworksWardenTemplate,true);
    this._envTarget?.dispose();
    this._transmissionRegion?.dispose();
    this.bodycam?.dispose();
    this.renderer?.dispose?.();
    this.renderer = null;
  }
}

export default Renderer;
