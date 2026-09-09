import {updateSurvivors} from './assets/survivor/survivor-runtime.js';
import {installViewmodelDepthBoundary} from './assets/survivor/viewmodel-depth.js';
import * as THREE from './vendor/three.module.js';
import {buildHorrorDetails} from './world-horror.js';
import {buildCathedralKit,batchStaticWorld} from './world-polish.js';
import {finalizeStaticWorld} from './world-static.js';
import {roomMaterialsReady} from './room-materials.js';
import {TransmissionRegion} from './transmission-region.js';
import {batchStaticWeaponMeshes} from './weapon-batching.js';
import {installBoundedLightEvaluation} from './bounded-lighting.js';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {createReliquary,animateReliquary} from './weapon-reliquary.js';
import {createBellwraith,animateBellwraith,warmBellwraithVariants} from './npc-bellwraith.js';
import {createWarden,animateWarden} from './npc-warden.js';
import {createOssuary,animateOssuary} from './weapon-ossuary.js';
import {createBreach,animateBreach} from './weapon-breach.js';
import {createArc,animateArc} from './weapon-arc.js';
import {CombatVFX} from './combat-vfx.js';

// Dead Arrival's simulation is authored in 4 metre cells. The renderer keeps
// that scale explicit so camera motion, weapon framing, and enemy proportions
// stay consistent as the arena grows.
const CELL = 4;
const MAX_GORE = 260;
const MAX_BLOOD = 128;
const MAX_PROJECTILES = 96;
const MAX_TRACERS = 128;
const MAX_COINS = 64;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * Math.max(0, dt)));
const dampAngle = (a, b, lambda, dt) => {
  let d = Math.atan2(Math.sin(b-a),Math.cos(b-a));
  return a + d * (1 - Math.exp(-lambda * Math.max(0, dt)));
};
const worldX = x => x * CELL;
const worldZ = y => y * CELL;
const enemyColor = kind => [0xef405f, 0x9d67f5, 0xff8c42][kind % 3];

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

function disposeObject(root, forceShared = false) {
  const geometries = new Set();
  const materials = new Set();
  root?.traverse?.(obj => {
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => materials.add(m));
      else materials.add(obj.material);
    }
  });
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
  constructor(canvas) {
    this.canvas = canvas;
    this._boundedLighting=typeof location==='undefined'||new URLSearchParams(location.search).get('lightBranch')!=='0' ? installBoundedLightEvaluation() : false;
    this.settings = { reducedMotion: false, gore: true };
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
    this._enemyVisuals = new Map();
    this._peer = null;
    this._exit = null;
    this._diag = {};

    this._materialManager = new THREE.LoadingManager();
    this._materialsReady = new Promise(resolve => { this._materialManager.onLoad = resolve; });
    this.materials = this._createMaterials();
    Object.values(this.materials).forEach(m=>{m.userData.sharedLibrary=true;});
    this._loadMaterialReference();
    this._loadWeaponMaterials();
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: false,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.setPixelRatio(1);
    } catch (error) {
      // Keep the renderer object inspectable in headless smoke tests. A
      // browser with WebGL will replace this with the normal path above.
      this.renderer = null;
      this.rendererError = error;
    }

    this._setupEnvironment();
    this._setupLighting();
    this._buildCombatPools();
    this._buildWeaponRig();
    this._wardenStatus='loading';
    this._wardenReady = new Promise(resolve => new GLTFLoader().load('./assets/models/evil-warden.glb',g=>{g.scene.traverse(o=>{if(o.geometry)o.geometry.userData.sharedAsset=true;for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){for(const value of Object.values(m))if(value?.isTexture)value.userData.sharedAsset=true;}});this.wardenTemplate=g.scene;this.wardenClips=g.animations;this._wardenStatus='ready';resolve();},undefined,e=>{this._wardenStatus='fallback';resolve();}));
    this.resize();
  }

  _setupEnvironment() {
    if (!this.renderer) return;
    // Soft reflected studio/ceiling light gives metals readable faces, even in shadow.
    const c=document.createElement('canvas');c.width=1024;c.height=512;
    const g=c.getContext('2d'),gradient=g.createLinearGradient(0,0,0,512);
    gradient.addColorStop(0,'#aebacb');gradient.addColorStop(.46,'#7d8898');gradient.addColorStop(.65,'#464a53');gradient.addColorStop(1,'#28232a');g.fillStyle=gradient;g.fillRect(0,0,1024,512);
    for(let i=0;i<5;i++){g.fillStyle=i%2?'#ffe3c3':'#e9f2ff';g.fillRect(65+i*190,70,94,65);g.fillStyle='#b09b87';g.fillRect(85+i*190,245,70,10);}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(this.renderer);this._envTarget=pmrem.fromEquirectangular(texture);this.scene.environment=this._envTarget.texture;this.scene.environmentIntensity=.65;texture.dispose();pmrem.dispose();
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
    this.materials.floorAlt.color.set(0x343a37);
    for(const m of[this.materials.weapon,this.materials.weaponDark,this.materials.weaponTrim,this.materials.metal,this.materials.steel,this.materials.enemyArmor])m.envMapIntensity=1.7;
  }

  _createMaterials() {
    return {
      floor: mat(0x303542, 0.84, 0.28),
      floorAlt: mat(0x444252, 0.78, 0.34),
      floorTrim: mat(0x774655, 0.5, 0.5),
      wall: mat(0x455061, 0.78, 0.46),
      wallPanel: mat(0x667184, 0.67, 0.48),
      wallDeep: mat(0x171d2a, 0.9, 0.22),
      metal: mat(0x8794a5, 0.54, 0.72),
      metalDark: mat(0x303b4d, 0.65, 0.58),
      steel: mat(0x9ba7b4, 0.42, 0.82),
      rust: mat(0x87404a, 0.8, 0.3),
      hazard: mat(0xe37d31, 0.38, 0.72),
      black: mat(0x060a11, 0.82, 0.22),
      red: emissive(0xef405f, 1.85),
      violet: emissive(0x9d67f5, 1.8),
      orange: emissive(0xff8c42, 1.9),
      cyan: emissive(0x57e9ff, 1.7),
      gold: emissive(0xffc24e, 1.35, { roughness: 0.25, metalness: 0.86 }),
      blood: mat(0x641721, 0.86, 0.12, { transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide }),
      gore: mat(0x8e2237, 0.64, 0.18),
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
      viewPlate: mat(0x8d7c5c, .73, .18),
      playerSuit: mat(0x0f1b28, 0.38, 0.78),
      playerTrim: emissive(0x62d6e9, 1.45),
    };
  }

  _loadMaterialReference() {
    if (typeof document === 'undefined') return;
    try {
      const texture = new THREE.TextureLoader(this._materialManager).load('./assets/textures/crypt-wall-albedo.webp', loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = THREE.RepeatWrapping;
        loaded.wrapT = THREE.RepeatWrapping;
        loaded.repeat.set(1, 1);
        const bump=loaded.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
        loaded.anisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
        for (const material of [this.materials.wall, this.materials.wallPanel]) {
          material.map = loaded;
          material.bumpMap=bump;material.bumpScale=.065;material.roughness=.79;
          material.color.set(0xd9dce0);
          material.metalness=.28;
          material.envMapIntensity=1.25;
          material.needsUpdate = true;
        }
      });
      texture.colorSpace = THREE.SRGBColorSpace;
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
    const hemi = new THREE.HemisphereLight(0xbacac5, 0x20100d, 1.25);
    hemi.name = 'CathedralFill';
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffd2a3, 2.2);
    key.name = 'ForgeKey';
    key.position.set(24, 32, -20);
    key.target.position.set(24, 0, 24);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -36;
    key.shadow.camera.right = 36;
    key.shadow.camera.top = 36;
    key.shadow.camera.bottom = -36;
    key.shadow.bias = -0.0006;
    this.scene.add(key, key.target);
    const coolFill = new THREE.DirectionalLight(0x8ba9ab, 1.2);
    coolFill.name = 'CoolArenaFill';
    coolFill.position.set(-34, 12, 14);
    coolFill.target.position.set(24, 1.5, 24);
    this.scene.add(coolFill, coolFill.target);
    const rim = new THREE.DirectionalLight(0xe83b23, 1.05);
    rim.name = 'AbyssRim';
    rim.position.set(-28, 14, 42);
    rim.target.position.set(24, 0, 24);
    this.scene.add(rim, rim.target);
    const pools = [
      [0xff3a59, 4.2, 9, 7],
      [0x7e4eff, 3.4, 39, 9],
      [0xff7b3e, 3.5, 28, 35],
      [0x26d8f0, 2.6, 7, 39],
    ];
    for (const [color, intensity, x, z] of pools) {
      const light = new THREE.PointLight(color, intensity, 24, 2.0);
      light.position.set(x, 4.3, z);
      this.scene.add(light);
    }
  }

  _buildCombatPools() {
    this.combatRoot = new THREE.Group();
    this.combatRoot.name = 'CombatVfxPools';
    this.scene.add(this.combatRoot);

    this.goreChunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.65, 0), this.materials.gore, MAX_GORE);
    this.goreChunks.name = 'GoreChunks';
    this.goreChunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.goreChunks);
    this.goreDroplets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 7, 5), this.materials.gore, MAX_GORE);
    this.goreDroplets.name = 'GoreDroplets';
    this.goreDroplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.goreDroplets);
    this.bloodPools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 22), this.materials.blood, MAX_BLOOD);
    this.bloodPools.name = 'BloodPools';
    this.bloodPools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.bloodPools);

    const projectileGeo = new THREE.IcosahedronGeometry(0.12, 1);
    const projectileCoreGeo = new THREE.IcosahedronGeometry(0.19, 1);
    this.projectileHostile = new THREE.InstancedMesh(projectileGeo, this.materials.red, MAX_PROJECTILES);
    this.projectileReflected = new THREE.InstancedMesh(projectileGeo, this.materials.cyan, MAX_PROJECTILES);
    this.projectileCore = new THREE.InstancedMesh(projectileCoreGeo, this.materials.orange, MAX_PROJECTILES);
    this.projectileHostile.name = 'HostileProjectiles';
    this.projectileReflected.name = 'ReflectedProjectiles';
    this.projectileCore.name = 'CoreProjectiles';
    this.projectileHostile.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileReflected.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileCore.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.projectileHostile, this.projectileReflected, this.projectileCore);

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

    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.045, 18), this.materials.gold, MAX_COINS);
    this.coins.name = 'RicochetCoins';
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.combatRoot.add(this.coins);
    this.coinGlints = new THREE.LineSegments(lineGeometry(MAX_COINS), new THREE.LineBasicMaterial({ color: 0xfff2a7, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
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
    this.camera.add(this.weaponRig);
    this.weaponGroups = [this._makePulseRevolver(), this._makeBreachShotgun(), this._makeArcLance(), this._makeReliquaryAsset()];
    this.weaponGroups.forEach((group, index) => {
      group.scale.setScalar(0.55);
      group.visible = index === 0;
      // Viewmodels use the room's reflected light without world-shadow occlusion.
      // Their close camera placement should not cast oversized shadows into the arena.
      group.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false;for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material?.isMeshStandardMaterial)material.envMapIntensity=material.userData.weaponSurface?.envMapIntensity??1.45;}});
      this.weaponRig.add(group);
    });
    this.muzzleFlash = new THREE.Group();
    this.muzzleFlash.name = 'MuzzleFlash';
    const flashSize=96,flashPixels=new Uint8Array(flashSize*flashSize*4);
    for(let y=0;y<flashSize;y++)for(let x=0;x<flashSize;x++){
      const px=(x+.5)/flashSize*2-1,py=(y+.5)/flashSize*2-1,r=Math.hypot(px,py),a=Math.atan2(py,px);
      const edge=.42+.28*Math.pow(Math.abs(Math.cos(a*3)),8)+.10*Math.sin(a*11);
      const alpha=clamp((edge-r)*5,0,1)*Math.max(0,1-r*.65),i=(y*flashSize+x)*4;
      flashPixels[i]=255;flashPixels[i+1]=245;flashPixels[i+2]=225;flashPixels[i+3]=Math.round(alpha*255);
    }
    const flashTexture=new THREE.DataTexture(flashPixels,flashSize,flashSize);flashTexture.colorSpace=THREE.SRGBColorSpace;flashTexture.needsUpdate=true;
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(.42,.42),new THREE.MeshBasicMaterial({map:flashTexture,color:0xffba78,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    flash.name='MuzzlePressureFlare';
    this.muzzleFlash.add(flash);
    const flashLight = new THREE.PointLight(0xffb85c, 0, 3, 2);
    flashLight.name = 'MuzzleLight';
    this.muzzleFlash.add(flashLight);
    // Keep the light in the scene's light list even while its intensity is zero.
    // Hiding its parent changes shader defines for every lit material on firing.
    flash.visible = false;
    this.weaponRig.add(this.muzzleFlash);
    this._weaponBatch=this.weaponGroups.map(group=>{const {root,...stats}=batchStaticWeaponMeshes(group,{preserve:['WeaponRig','MuzzleFlash']});return stats;});
    installViewmodelDepthBoundary(this.weaponRig);
  }

  _makeArm(side, color = this.materials.viewSleeve, weapon = 0) {
    const arm = new THREE.Group();
    arm.name = `${side < 0 ? 'Left' : 'Right'}Arm`;
    const support = side < 0;
    const wrist = support ? new THREE.Vector3(-.14,-.20,[-.48,-.52,-.57,-.62][weapon]) : new THREE.Vector3(.095,[-.28,-.32,-.38,-.25][weapon],.16);
    arm.position.copy(wrist);
    const elbow = new THREE.Vector3(side*.4,-.85,.9).sub(wrist);
    const segment = (start,end,r0,r1,material,name) => {
      const delta=end.clone().sub(start), mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,delta.length(),12),material);
      mesh.name=name;mesh.position.copy(start).addScaledVector(delta,.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());arm.add(mesh);return mesh;
    };
    segment(new THREE.Vector3(),elbow,.085,.13,color,'TaperedSleeve');
    segment(new THREE.Vector3(),elbow.clone().multiplyScalar(.17),.096,.103,this.materials.viewGlove,'WristCuff');
    const palm=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),this.materials.viewGlove);
    palm.name='GripPalm';palm.scale.set(.075,.105,.095);palm.position.set(support?.025:-.015,.025,-.025);arm.add(palm);
    for(let i=0;i<4;i++){
      const y=.075-i*.047;
      const start=new THREE.Vector3(support?.06:-.035,y,-.045);
      const knuckle=new THREE.Vector3(support?.13:-.11,y-.005,-.105);
      const tip=new THREE.Vector3(support?.12:-.16,y-.018,-.055);
      segment(start,knuckle,.026,.024,this.materials.viewGlove,`Finger${i}Proximal`);
      segment(knuckle,tip,.024,.019,this.materials.viewGlove,`Finger${i}Tip`);
      const plate=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),this.materials.viewPlate);plate.scale.set(1,.65,1.2);plate.position.copy(knuckle);arm.add(plate);
    }
    segment(new THREE.Vector3(0,.10,.035),new THREE.Vector3(support?.085:-.09,.06,-.025),.032,.025,this.materials.viewGlove,'Thumb');
    for(let i=0;i<3;i++){
      const plate=new THREE.Mesh(new THREE.BoxGeometry(.115,.018,.075),this.materials.viewPlate);
      plate.name='ForearmPlate';plate.position.copy(elbow).multiplyScalar(.3+i*.15);plate.position.y+=.055;plate.rotation.x=-.35;arm.add(plate);
    }
    return arm;
  }

  _makePulseRevolver() {
    const group=createOssuary();group.position.set(.3,-.31,-.78);group.rotation.set(.035,.045,-.025);group.add(this._makeArm(1));return group;
  }

  _makeBreachShotgun() {
    const group=new THREE.Group(),model=createBreach();group.name='BreachShotgun';
    group.position.set(.31,-.32,-.88);group.rotation.set(.035,.045,-.025);
    group.add(model,this._makeArm(-1,this.materials.viewSleeve,1),this._makeArm(1,this.materials.viewSleeve,1));group.userData.model=model;group.userData.muzzle=model.userData.muzzle;return group;
  }

  _makeArcLance() {
    const group=new THREE.Group(),model=createArc();group.name='ArcLance';
    group.position.set(.29,-.31,-.94);group.rotation.set(.035,.045,-.025);
    group.add(model,this._makeArm(-1,this.materials.viewSleeve,2),this._makeArm(1,this.materials.viewSleeve,2));group.userData.model=model;group.userData.muzzle=model.userData.muzzle;return group;
  }
  _makeReliquaryAsset() {
    const group = createReliquary({ variant: 'bone-rocket' });
    group.position.set(0.31, -0.32, -0.9);
    group.rotation.set(.035,.045,-.025);
    group.name = 'ReliquaryBazooka';
    group.add(this._makeArm(-1,this.materials.viewSleeve,3),this._makeArm(1,this.materials.viewSleeve,3));
    return group;
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
    if (this.worldRoot) {
      const retired=this.worldRoot;
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
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'BloodworksWorld';
    this.scene.add(this.worldRoot);
    this._course = course;
    this._worldKey = course?.index ?? `${course?.w}x${course?.h}`;
    const width = (course?.w || 12) * CELL;
    const depth = (course?.h || 12) * CELL;
    this._buildFloor(width, depth);
    this._buildWalls(course);
    this._buildCover(course);
    this._buildIndustrialShell(width, depth);
    this._buildExit(course?.exit || { x: 6, y: 1 });
    this.horror=buildHorrorDetails(this.worldRoot,this.materials,course);
    buildCathedralKit(this.worldRoot,this.materials,course);
    const animatedWorld=[this._exit?.root,this.horror.organ,this.horror.core,...(this.horror.authored?.moving||[])];
    const roomChunks=this.horror.roomChunks||this.horror.authored?.roomChunks||[];
    this._roomBatches=roomChunks.map(room=>batchStaticWorld(room,animatedWorld));
    this._worldBatch=batchStaticWorld(this.worldRoot,[...animatedWorld,...roomChunks]);
    this._worldStatic=finalizeStaticWorld(this.worldRoot,animatedWorld);
    if (this.horror.theme) {
      this.scene.background.set(this.horror.theme.background);
      this.scene.fog.color.set(this.horror.theme.fog);
      this.scene.fog.near = this.horror.theme.fogNear;
      this.scene.fog.far = this.horror.theme.fogFar;
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
    const cells = course?.renderCells || course?.cells || [];
    const seen = new Set();
    const segments = [];
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
      const panel = horizontal ? panelH : panelV;
      const trim = horizontal ? trimH : trimV;
      const signal = horizontal ? signalH : signalV;
      const pipe = horizontal ? pipeH : pipeV;
      const index = horizontal ? h : v;
      object.position.set(x, 3.2, z); object.rotation.set(0, 0, 0); object.updateMatrix(); shell.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.16, 2.95, horizontal ? z + 0.16 : z); object.updateMatrix(); panel.setMatrixAt(index, object.matrix);
      object.position.set(x, 5.65, z); object.updateMatrix(); trim.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.19, 5.1, horizontal ? z - 0.19 : z); object.updateMatrix(); signal.setMatrixAt(index, object.matrix);
      object.position.set(horizontal ? x : x + 0.19, 5.86, horizontal ? z - 0.19 : z); object.rotation.set(horizontal ? 0 : Math.PI / 2, 0, horizontal ? Math.PI / 2 : 0); object.updateMatrix(); pipe.setMatrixAt(index, object.matrix);
      if (horizontal) h++; else v++;
    }
    [shellH, shellV, panelH, panelV, trimH, trimV, signalH, signalV, pipeH, pipeV].forEach(pool => { pool.count = pool === shellH || pool === panelH || pool === trimH || pool === signalH || pool === pipeH ? h : v; pool.instanceMatrix.needsUpdate = true; });
    this.worldRoot.add(shellH, shellV, panelH, panelV, trimH, trimV, signalH, signalV, pipeH, pipeV);
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
    for (const [cx, cy] of course?.blocks || []) {
      const x = cx * CELL + CELL / 2;
      const z = cy * CELL + CELL / 2;
      const root = new THREE.Group();
      root.name = `CoverBlock_${cx}_${cy}`;
      root.position.set(x, 0, z);
      const core = shadow(new THREE.Mesh(new THREE.BoxGeometry(3.44, 3.25, 3.44), this.materials.wall), true, true);
      core.position.y = 1.63;
      root.add(core);
      const cap = shadow(new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.7, 0.3, 8), this.materials.metalDark), true, true);
      cap.position.y = 3.29;
      cap.rotation.y = Math.PI / 8;
      root.add(cap);
      const capInset = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.15, 0.1, 8), this.materials.floorTrim);
      capInset.position.y = 3.47;
      root.add(capInset);
      for (const side of [-1, 1]) {
        const plate = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 2.42), side > 0 ? this.materials.enemyViolet : this.materials.enemyRed), false, true);
        plate.position.set(side * 1.75, 1.65, 0);
        root.add(plate);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.85, 0.16), this.materials.metal);
        brace.position.set(side * 1.82, 1.65, 1.22);
        root.add(brace);
      }
      for (const side of [-1, 1]) {
        const hazard = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.16, 0.09), this.materials.hazard);
        hazard.position.set(0, 2.58, side * 1.75);
        root.add(hazard);
      }
      this.worldRoot.add(root);
    }
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

  _updateEnemies(run, now) {
    const alive = new Set();
    const enemies = run.course?.enemies || [];
    for (const enemy of enemies) {
      let entry = this._enemyVisuals.get(enemy.id);
      const useWarden = !!this.wardenTemplate && enemy.kind >= 0 && enemy.kind < 3;
      if (!entry) {
        entry = { root: useWarden ? createWarden(this.wardenTemplate,this.wardenClips,enemy.kind,enemy.variant) : enemy.kind === 3 ? createBellwraith({ variant: enemy.variant, phase: enemy.phase || 0 }) : this._makeEnemy(enemy.kind, enemy.variant), seed: (enemy.id * 1.618) % TAU, variant: enemy.variant || '' };
        this._enemyVisuals.set(enemy.id, entry);
        this.worldRoot.add(entry.root);
      }
      if(useWarden&&!entry.root.userData.warden){this.worldRoot.remove(entry.root);disposeObject(entry.root);entry.root=createWarden(this.wardenTemplate,this.wardenClips,enemy.kind,enemy.variant);this.worldRoot.add(entry.root);}
      alive.add(enemy.id);
      const root = entry.root;
      if(root.userData.warden){root.position.set(worldX(enemy.x),0,worldZ(enemy.y));root.rotation.y=-Math.atan2(run.y-enemy.y,run.x-enemy.x)-Math.PI/2;animateWarden(root,enemy,now,entry.seed);continue;}
       if (root.userData.bellwraith) {
          const floorOffset = root.userData.bellwraith?.floorOffset ?? 0.22;
          root.position.set(worldX(enemy.x), floorOffset, worldZ(enemy.y));
          root.rotation.y = Math.PI / 2 - Math.atan2(run.y - enemy.y, run.x - enemy.x);
          animateBellwraith(root, enemy, now, entry.seed);
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
      const toward = Math.atan2(run.y - enemy.y, run.x - enemy.x);
      root.rotation.y = -toward - Math.PI / 2;
      const parts = root.userData.parts;
      const stride = Math.sin(phase * (enemy.kind === 0 ? 7 : 3.5)) * (enemy.kind === 0 ? 0.32 : 0.12);
      parts.leftLeg.rotation.x = stride;
      parts.rightLeg.rotation.x = -stride;
      parts.leftArm.rotation.x = -stride * 0.6;
      parts.rightArm.rotation.x = stride * 0.6;
      parts.horns.rotation.y = Math.sin(phase * 2) * 0.05;
      const warning = enemy.attack >= 0 && enemy.attack < (enemy.kind === 0 ? 0.3 : 0.58);
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
    const open = (run.wave || 0) >= 3 && !active;
    this._exit.unlocked = open;
    const gateY = open ? 4.2 : 0;
    this._exit.gate.position.y = damp(this._exit.gate.position.y, gateY, 5, this._frameDt || 0.016);
    const pulse = 1 + Math.sin(now * 0.004) * 0.06;
    this._exit.ring.scale.setScalar(pulse);
    this._exit.ring.material = open ? this.materials.cyan : this.materials.red;
    this._exit.threshold.material = open ? this.materials.cyan : this.materials.red;
  }

  _updateCombat(run, now) {
    const position = this._combatPosition ||= new THREE.Vector3();
    const rotation = this._combatEuler ||= new THREE.Euler();
    const matrix = this._combatMatrix;
    const quat = this._combatQuat;
    const scale = this._combatScale;
    let chunks = 0, droplets = 0, blood = 0;
    if (this.settings.gore) {
      for (const g of run.gore || []) {
        if (g.chunk && chunks < MAX_GORE) {
          const spin = (g.spin || 0) + now * 0.003;
          quat.setFromEuler(rotation.set(spin * 1.3, spin * 0.7, spin * 0.5));
          scale.setScalar((g.size || 0.035) * CELL * (g.chunk ? 1.2 : 0.72));
          matrix.compose(position.set(worldX(g.x), (g.z || 0) * CELL, worldZ(g.y)), quat, scale);
          this.goreChunks.setMatrixAt(chunks++, matrix);
        } else if (!g.chunk && droplets < MAX_GORE) {
          quat.identity();
          scale.setScalar((g.size || 0.018) * CELL);
          matrix.compose(position.set(worldX(g.x), (g.z || 0) * CELL, worldZ(g.y)), quat, scale);
          this.goreDroplets.setMatrixAt(droplets++, matrix);
        }
      }
      for (const b of run.blood || []) {
        if (blood >= MAX_BLOOD) break;
        quat.setFromEuler(rotation.set(-Math.PI / 2, 0, b.angle || 0));
        scale.set((b.size || 0.15) * CELL, (b.size || 0.15) * CELL, 1);
        matrix.compose(position.set(worldX(b.x), 0.052, worldZ(b.y)), quat, scale);
        this.bloodPools.setMatrixAt(blood++, matrix);
      }
    }
    this.goreChunks.count = chunks;
    this.goreDroplets.count = droplets;
    this.bloodPools.count = blood;
    this.goreChunks.instanceMatrix.needsUpdate = true;
    this.goreDroplets.instanceMatrix.needsUpdate = true;
    this.bloodPools.instanceMatrix.needsUpdate = true;

    const hostile = [], reflected = [], core = [];
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

    const pGeo = this.projectileTrails.geometry;
    let pi = 0;
    for (const p of hostile.concat(core)) {
      if (pi >= MAX_PROJECTILES) break;
      const a = new THREE.Vector3(worldX(p.x), (p.z || 0) * CELL, worldZ(p.y));
      const trailAge=Math.min(.12,p.age||0);
      const b = new THREE.Vector3(worldX(p.x - (p.vx || 0) * trailAge), ((p.z || 0) - (p.vz || 0) * trailAge) * CELL, worldZ(p.y - (p.vy || 0) * trailAge));
      setLine(pGeo, pi++, a, b);
    }
    pGeo.setDrawRange(0, pi * 2); pGeo.attributes.position.needsUpdate = true;
    const rGeo = this.reflectedTrails.geometry;
    let ri = 0;
    for (const p of reflected) {
      if (ri >= MAX_PROJECTILES) break;
      const a = new THREE.Vector3(worldX(p.x), (p.z || 0) * CELL, worldZ(p.y));
      const trailAge=Math.min(.12,p.age||0);
      const b = new THREE.Vector3(worldX(p.x - (p.vx || 0) * trailAge), ((p.z || 0) - (p.vz || 0) * trailAge) * CELL, worldZ(p.y - (p.vy || 0) * trailAge));
      setLine(rGeo, ri++, a, b);
    }
    rGeo.setDrawRange(0, ri * 2); rGeo.attributes.position.needsUpdate = true;

    const tracerGeo = this.tracerLines.geometry;
    const railGeo = this.railLines.geometry;
    let ti = 0, li = 0;
    for (const t of run.tracers || []) {
      const a = new THREE.Vector3(worldX(t.x), (t.z || 0) * CELL, worldZ(t.y));
      const b = new THREE.Vector3(worldX(t.tx), (t.tz || 0) * CELL, worldZ(t.ty));
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
      const center = new THREE.Vector3(worldX(c.x), y, worldZ(c.y));
      const glow = 0.22 + Math.abs(Math.sin(now * 0.016 + ci)) * 0.28;
      setLine(this.coinGlints.geometry, gi++, new THREE.Vector3(center.x - glow, center.y, center.z), new THREE.Vector3(center.x + glow, center.y, center.z));
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
      const start = new THREE.Vector3();
      if (fist) fist.getWorldPosition(start); else this.camera.getWorldPosition(start);
      const end = new THREE.Vector3(worldX(hookTarget.x), 1.12 * CELL, worldZ(hookTarget.y));
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
    const eye = (0.4 + (run.z || 0) - (run.slide || 0) * 0.18) * CELL;
    const target = this._cameraTarget ||= new THREE.Vector3();
    target.set(worldX(run.x),eye,worldZ(run.y));
    this.cameraRig.position.copy(target);
    const yaw=-(run.angle||0)-Math.PI/2;
    this.cameraRig.rotation.y=yaw;
    this.camera.rotation.x=run.pitch||0;
    const shake=this.settings.reducedMotion?0:((run.damage||0)*.012+(run.punch||0)*.008);
    this.camera.rotation.z=Math.cos(now*.035)*shake;
    const dash = clamp((run.dashTime || 0) / 0.18, 0, 1);
    const aim = clamp(run.aim || 0, 0, 1);
    const targetFov = 92 + dash * 12 - aim * 14 + clamp((run.speed || 0) - 1.3, 0, 2) * 2;
    this.camera.fov = damp(this.camera.fov, targetFov, 12, dt);
    this.camera.updateProjectionMatrix();

    const sway = this.settings.reducedMotion ? 0.002 : 0.012;
    const shot = clamp(run.shot || 0, 0, 1);
    const punch = clamp(run.punch || 0, 0, 1);
    this.weaponRig.position.x = damp(this.weaponRig.position.x, 0.02 - aim * .10 + Math.sin((run.distance || 0) * 7) * sway * (1 - aim), 15, dt);
    this.weaponRig.position.y = damp(this.weaponRig.position.y, -0.012 + Math.cos((run.distance || 0) * 7) * sway * 0.6, 15, dt);
    this.weaponRig.position.z = damp(this.weaponRig.position.z, shot * [0.06,0.11,0.035,0.075][run.weapon||0] - punch * 0.045, 24, dt);
    this.weaponRig.rotation.x = damp(this.weaponRig.rotation.x, shot * [0.085,0.12,0.045,0.07][run.weapon||0] + punch * 0.1, 22, dt);
    this.weaponRig.rotation.y = damp(this.weaponRig.rotation.y, aim * -0.02, 16, dt);
    this.weaponRig.rotation.z = damp(this.weaponRig.rotation.z, Math.sin((run.distance || 0) * 4.1) * sway * 0.7, 14, dt);
    const weapon = clamp(run.weapon || 0, 0, this.weaponGroups.length - 1);
    this.weaponGroups.forEach((group, index) => { group.visible = index === weapon; });
    this.weaponGroups.forEach((group,i)=>{group.position.x=[.3,.31,.29,.31][i]*Math.min(1,this.camera.aspect/.9);});
    animateOssuary(this.weaponGroups[0],weapon===0?shot:0,now*.001,dt);
    animateBreach(this.weaponGroups[1].userData.model,now*.001,weapon===1?shot:0,dt);
    animateArc(this.weaponGroups[2].userData.model,now*.001,weapon===2?shot:0,dt);
    this.weaponGroups[weapon]?.userData.animate?.(now * 0.001, shot);
    if (weapon === 3) animateReliquary(this.weaponGroups[3], shot, now * 0.001, dt);
    const muzzle = this.weaponGroups[weapon]?.userData?.muzzle;
    if (muzzle) {
      const muzzleWorld = new THREE.Vector3();
      muzzle.getWorldPosition(muzzleWorld);
      this.weaponRig.worldToLocal(muzzleWorld);
      this.muzzleFlash.position.copy(muzzleWorld);
      const socketRotation=this._socketRotation ||= new THREE.Quaternion();
      const rigRotation=this._rigRotation ||= new THREE.Quaternion();
      muzzle.getWorldQuaternion(socketRotation);this.weaponRig.getWorldQuaternion(rigRotation);
      this.muzzleFlash.quaternion.copy(rigRotation.invert().multiply(socketRotation));
    }
    this.muzzleFlash.children[0].visible = shot > 0.32;
    this.muzzleFlash.scale.setScalar(([.75,1.1,.45,.85][weapon])*(.55+shot*.55));
    this.muzzleFlash.children[0].rotation.z=now*.023;
    const flashColor=[0xff3154,0xffb44b,0x64eaff,0xff683f][weapon] || 0xff683f;
    this.muzzleFlash.children[0].material.color.set(flashColor);
    this.muzzleFlash.children[0].material.emissive?.set(flashColor);
    const light = this.muzzleFlash.children.find(child => child.isPointLight);
    if (light) {light.color.set(flashColor);light.intensity = shot > 0.32 ? 8 * shot : 0;}
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
    this.weaponGroups?.forEach(group=>group.scale.setScalar(width<600?.4:.55));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setSettings(settings = {}) {
    if (typeof settings.reducedMotion === 'boolean') this.settings.reducedMotion = settings.reducedMotion;
    if (typeof settings.gore === 'boolean') this.settings.gore = settings.gore;
  }

  async _prepareWeaponResources(course) {
    // Texture callbacks can change shader features. Wait until their final
    // materials exist before compiling both screen and transmission variants.
    const weaponResources = [];
    for (const group of this.weaponGroups) group.traverse(object => {
      if (object.userData.resourcesReady) weaponResources.push(object.userData.resourcesReady);
    });
    await Promise.all([this._materialsReady, this._wardenReady, roomMaterialsReady(), ...weaponResources]);
    const renderer = this.renderer;
    if (!renderer || this._course !== course) return;
    // Keep a representative skinned enemy alive so its programs are compiled
    // in both output color spaces before the first spawn or Arc transmission pass.
    if (this.wardenTemplate && !this._wardenWarmup) {
      this._wardenWarmup = createWarden(this.wardenTemplate, this.wardenClips, 0);
      this._wardenWarmup.visible = false;
      this.scene.add(this._wardenWarmup);
    }
    if(!this._bellWarmups){warmBellwraithVariants();this._bellWarmups=['bellwraith','echo','rustBell','ivoryBell'].map(variant=>{const actor=createBellwraith({variant});actor.visible=false;this.scene.add(actor);return actor;});}
    const screenPrograms = renderer.compileAsync(this.scene, this.camera);
    const previousTarget = renderer.getRenderTarget();
    const linearTarget = new THREE.WebGLRenderTarget(1, 1);
    let transmissionPrograms;
    try {
      renderer.setRenderTarget(linearTarget);
      transmissionPrograms = renderer.compileAsync(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
    }
    try {
      await Promise.all([screenPrograms, transmissionPrograms]);
    } finally {
      linearTarget.dispose();
    }
    if (this.renderer !== renderer || this._course !== course) return;
    // compileAsync does not upload hidden geometry or allocate transmission
    // buffers. Exercise the real render path for every gun in one task, then
    // restore the current view before the browser can paint an intermediate gun.
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
    for(const actor of this._bellWarmups||[]){actor.visible=true;this.camera.getWorldPosition(actor.position).addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),4);}
    try {
      for (let weapon = 0; weapon < this.weaponGroups.length; weapon++) {
        this.weaponGroups.forEach((group, i) => { group.visible = i === weapon; });
        renderer.render(this.scene, this.camera);
      }
    } finally {
      for (const [object, visible, culled] of hiddenResources) {
        object.visible = visible;
        object.frustumCulled = culled;
      }
      if (this._wardenWarmup) this._wardenWarmup.visible = false;
      for(const actor of this._bellWarmups||[])actor.visible=false;
      this.weaponGroups.forEach((group, i) => { group.visible = visibility[i]; });
      renderer.render(this.scene, this.camera);
    }
    this._weaponsPrepared = true;
  }

  render(run, nowMs = (typeof performance !== 'undefined' ? performance.now() : 0)) {
    if (!run?.course) return;
    this._frameDt = this._lastNow ? clamp((nowMs - this._lastNow) / 1000, 0.001, 0.05) : 0.016;
    this._lastNow = nowMs;
    const key = run.course.index ?? `${run.course.w}:${run.course.h}`;
    if (this._worldKey !== key || this._course !== run.course) this._buildWorld(run.course);
    if(this.horror){this.horror.setRoomProgression?.(run.roomProgression);this.horror.authored?.animate(this.settings.reducedMotion?0:nowMs*.001);const pulse=1+Math.sin(nowMs*.002)*.025;this.horror.organ.scale.set(1.5*pulse,2.1,1.15*pulse);}
    this._updateCamera(run, nowMs);
    this._updateEnemies(run, nowMs);
    this._updatePeer(run, nowMs);
    this._updateExit(run, nowMs);
    this._updateCombat(run, nowMs);
    updateSurvivors(this, run, nowMs);
    if (this.renderer && this._warmupCourse !== run.course) {
      this._warmupCourse = run.course;
      this._warmupPromise = this._prepareWeaponResources(run.course);
    }
    if (this.renderer) {
      this._transmissionRegion ||= new TransmissionRegion(this.renderer);
      if(this._transmissionScene!==this.worldRoot){this._transmissionRegion.refresh(this.scene);this._transmissionScene=this.worldRoot;}
      this._transmissionRegion.begin(this.camera);
      try{this.renderer.render(this.scene,this.camera);}finally{this._transmissionRegion.end();}
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
      worldBatch: this._worldBatch || null,
      staticWorld: this._worldStatic || null,
      boundedLighting: this._boundedLighting,
      transmissionCoverage: this._transmissionRegion?.coverage ?? 1,
      weaponBatch: this._weaponBatch,
      targetFrameMs: 1000 / 144,
      webgl: !!this.renderer,
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
      calls: info?.render?.calls || 0,
      gpuTriangles: info?.render?.triangles || 0,
      rendererGeometries: info?.memory?.geometries || 0,
      explosions: this.weaponFX?.explosions?.diagnostics?.() || null,
      impacts: this.weaponFX?.impacts?.diagnostics?.() || null,
      rendererTextures: info?.memory?.textures || 0,
      enemies: (run.course?.enemies || []).filter(e => !e.dead).length,
      gore: this.settings.gore ? (run.gore || []).length : 0,
      blood: this.settings.gore ? (run.blood || []).length : 0,
      projectiles: (run.projectiles || []).length,
      tracers: (run.tracers || []).length,
      coins: (run.coins || []).length,
      world: this.horror?.sector || 'bloodworks',
      warden: this._wardenStatus,
      wardenInstances: [...this._enemyVisuals.values()].filter(e=>e.root.userData.warden).length,
    };
  }

  diagnostics() {
    return { ...this._diag };
  }

  dispose() {
    if (this.worldRoot) disposeObject(this.worldRoot);
    if (this.combatRoot) disposeObject(this.combatRoot);
    if (this.weaponRig) disposeObject(this.weaponRig);
    this.materials && Object.values(this.materials).forEach(m => m.dispose?.());
    if(this._wardenWarmup){this._wardenWarmup.removeFromParent();disposeObject(this._wardenWarmup);}
    for(const actor of this._bellWarmups||[]){actor.removeFromParent();disposeObject(actor);}
    if(this.wardenTemplate)disposeObject(this.wardenTemplate,true);
    this._envTarget?.dispose();
    this._transmissionRegion?.dispose();
    this.renderer?.dispose?.();
    this.renderer = null;
  }
}

export default Renderer;
