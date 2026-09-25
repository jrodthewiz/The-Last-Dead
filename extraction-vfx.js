import * as THREE from './vendor/three.module.js';

// Extraction is a deliberately contained close-range tableau.  The simulation
// owns the interaction and score; this module only turns the authoritative
// { targetId, phase, progress, seed } envelope into a readable, pooled visual.
// World-space corpse dressing and the camera-space tool are kept separate so a
// normal weapon can never inherit extraction state.

const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function hash01(seed, salt = 0) {
  let x = ((Number(seed) || 0) * 1664525 + 1013904223 + salt * 374761393) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: .72,
    metalness: .04,
    ...options,
  });
}

function lineBetween(mesh, start, end, width = 1) {
  const direction = mesh.userData._direction || (mesh.userData._direction = new THREE.Vector3());
  direction.subVectors(end, start);
  const length = Math.max(.0001, direction.length());
  mesh.position.copy(start).addScaledVector(direction, .5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.multiplyScalar(1 / length));
  mesh.scale.set(width, length, width);
  mesh.visible = length > .001;
}

function disposeRoot(root) {
  const geometries = new Set();
  const materials = new Set();
  root?.traverse?.(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach(value => materials.add(value));
      else materials.add(node.material);
    }
  });
  geometries.forEach(geometry => geometry.dispose?.());
  materials.forEach(value => value.dispose?.());
}

export class ExtractionVFX {
  constructor({ scene, camera, materials: library = {}, cell = 4 } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.cell = cell;
    this.settings = { gore: true, reducedMotion: false };
    this.active = false;
    this._run = null;
    this._seed = 0;
    this._phase = '';
    this._progress = 0;
    this._lastTargetId = null;
    this._variant = null;
    this._frame = 0;
    this._stageState = { overall: 0, phase: '', stage: 0, draw: 0, incise: 0, rip: 0 };

    this.root = new THREE.Group();
    this.root.name = 'ProceduralExtractionVFX';
    this.root.visible = false;
    this.root.frustumCulled = false;
    scene?.add(this.root);

    this.world = new THREE.Group();
    this.world.name = 'ExtractionCorpseDressing';
    this.world.renderOrder = 8;
    this.world.frustumCulled = false;
    this.root.add(this.world);

    this.tool = new THREE.Group();
    this.tool.name = 'ExtractionToolRig';
    this.tool.layers.set(1);
    this.tool.position.set(.04, -.08, -.03);
    this.tool.renderOrder = 30;
    this.tool.frustumCulled = false;
    camera?.add(this.tool);

    // Extraction gets its own materials so a gore toggle can hide the whole
    // tableau without mutating shared weapon/enemy materials.
    this.skinMaterial = material(library.enemyArmor?.color?.getHex?.() ?? 0x4a3f42, { roughness: .88 });
    this.skinMaterial.color.setHex(0x352426);
    this.fleshMaterial = material(0x7f2730, { roughness: .66, metalness: .02 });
    this.fleshMaterial.emissive.setHex(0x1b0308);
    this.fleshMaterial.emissiveIntensity = .32;
    this.cavityMaterial = material(0x120307, { roughness: 1, metalness: 0 });
    this.bloodMaterial = material(0x400710, {
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: .9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.bloodMaterial.emissive.setHex(0x100002);
    this.bloodMaterial.emissiveIntensity = .06;
    this.bloodBrightMaterial = material(0x5a0d18, {
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: .94,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.bloodBrightMaterial.emissive.setHex(0x0b0001);
    this.bloodBrightMaterial.emissiveIntensity = .1;
    this.woundSurfaceMaterial = new THREE.MeshBasicMaterial({color:0x510b13,side:THREE.DoubleSide,transparent:true,opacity:.92,depthWrite:false});
    this.heartSurfaceMaterial = new THREE.MeshBasicMaterial({color:0x72111f,side:THREE.DoubleSide,transparent:true,opacity:.97,depthWrite:false});
    this.metalMaterial = material(0xc6d0d2, { roughness: .27, metalness: .9 });
    this.metalMaterial.color.setHex(0xadb9bb);
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc9eef1,
      roughness: .08,
      metalness: .08,
      transmission: .12,
      transparent: true,
      opacity: .36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.gloveMaterial = material(0x282025, { roughness: .94, metalness: .02 });

    this._makeCorpse();
    this._makeTool();
    this._makePools();
    // Camera-space extraction props share the foreground layer with the
    // existing weapon rig. Object3D.layers are per-node, so set the whole
    // subtree rather than relying on the parent group's layer alone.
    this.tool.traverse(node => node.layers.set(1));
    this._vectors = {
      camera: new THREE.Vector3(),
      target: new THREE.Vector3(),
      wound: new THREE.Vector3(),
      needle: new THREE.Vector3(),
      streamEnd: new THREE.Vector3(),
      needleLocal: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      midpoint: new THREE.Vector3(),
      local: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      axis: new THREE.Vector3(),
    };
    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
  }

  _makeCorpse() {
    this.corpse = new THREE.Group();
    this.corpse.name = 'ExtractionCorpse';
    this.corpse.frustumCulled = false;
    this.world.add(this.corpse);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.38, .7, 6, 14), this.skinMaterial);
    torso.name = 'CorpseTorso';
    torso.scale.set(1.06, 1.0, .62);
    torso.position.set(0, .82, 0);
    torso.castShadow = false;
    torso.receiveShadow = false;
    this.corpse.add(torso);
    torso.visible = false;

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 8), this.skinMaterial);
    shoulder.name = 'CorpseShoulderMass';
    shoulder.scale.set(1.12, .56, .56);
    shoulder.position.set(0, 1.14, .02);
    this.corpse.add(shoulder);
    shoulder.visible = false;

    const collar = new THREE.Mesh(new THREE.TorusGeometry(.24, .045, 7, 24), this.fleshMaterial);
    collar.name = 'ExposedCollar';
    collar.scale.set(1.65, .62, 1);
    collar.position.set(0, 1.18, .30);
    this.corpse.add(collar);
    collar.visible = false;

    this.ribs = new THREE.Group();
    this.ribs.name = 'RibCage';
    for (let i = 0; i < 4; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(.205 + i * .018, .018, 6, 22), this.fleshMaterial);
      rib.name = `Rib_${i}`;
      rib.scale.set(1.45 - i * .04, .52 + i * .02, 1);
      rib.position.set((i % 2 ? -.012 : .012), .82 + i * .11, .27 + i * .008);
      this.ribs.add(rib);
    }
    this.corpse.add(this.ribs);
    this.ribs.visible = false;

    this.wound = new THREE.Group();
    this.wound.name = 'VariableIncision';
    // Dress the fallen enemy mesh instead of covering it with a second,
    // upright mannequin. Local +Z on this group faces toward the ceiling.
    this.wound.position.set(-.36, .29, .22);
    this.wound.rotation.x = -Math.PI / 2;
    this.corpse.add(this.wound);
    this.cavity = new THREE.Mesh(new THREE.SphereGeometry(.19, 12, 8), this.cavityMaterial);
    this.cavity.name = 'ChestCavity';
    this.cavity.scale.set(1.35, .72, .36);
    this.wound.add(this.cavity);
    this.woundRim = new THREE.Mesh(new THREE.TorusGeometry(.2, .024, 7, 22), this.woundSurfaceMaterial);
    this.woundRim.name = 'WoundRim';
    this.woundRim.scale.set(1.3, .68, 1);
    this.wound.add(this.woundRim);
    this.incisionA = new THREE.Mesh(new THREE.BoxGeometry(.025, .34, .026), this.heartSurfaceMaterial);
    this.incisionA.name = 'IncisionEdgeA';
    this.incisionA.position.x = -.065;
    this.incisionA.rotation.z = -.24;
    this.wound.add(this.incisionA);
    this.incisionB = new THREE.Mesh(new THREE.BoxGeometry(.024, .3, .028), this.heartSurfaceMaterial);
    this.incisionB.name = 'IncisionEdgeB';
    this.incisionB.position.x = .065;
    this.incisionB.rotation.z = .22;
    this.wound.add(this.incisionB);

    this.flaps = [-1, 1].map(side => {
      const flap = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 7), this.skinMaterial);
      flap.name = side < 0 ? 'LeftChestFlap' : 'RightChestFlap';
      flap.scale.set(.88, .46, .14);
      flap.position.set(side * .055, 0, .018);
      this.wound.add(flap);
      return flap;
    });
    this.puncture = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), this.bloodMaterial);
    this.puncture.name = 'NeedlePuncture';
    this.puncture.scale.z = .22;
    this.puncture.position.z = .03;
    this.wound.add(this.puncture);

    this.heart = new THREE.Group();
    this.heart.name = 'ExtractableHeart';
    this.heart.position.set(0, 0, .035);
    this.heart.visible = false;
    this.wound.add(this.heart);
    const lobeL = new THREE.Mesh(new THREE.SphereGeometry(.095, 10, 8), this.heartSurfaceMaterial);
    lobeL.position.set(-.065, .045, .035);
    lobeL.scale.set(1, 1.12, .82);
    lobeL.name = 'HeartLobeL';
    const lobeR = lobeL.clone();
    lobeR.position.x = .065;
    lobeR.name = 'HeartLobeR';
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.105, .2, 8), this.heartSurfaceMaterial);
    tip.name = 'HeartTip';
    tip.rotation.z = Math.PI;
    tip.position.set(0, -.075, .035);
    tip.scale.set(.84, 1, .8);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.06, 1), this.heartSurfaceMaterial);
    core.name = 'HeartCore';
    core.position.z = .07;
    this.heart.add(lobeL, lobeR, tip, core);
    this.heartBase = new THREE.Vector3(0, 0, .035);

    this.vessels = [];
    const vesselSpecs = [
      [-.05, .12, -.17, .31, .018], [.05, .12, .16, .34, .015],
      [-.018, .14, -.025, .36, .013], [.02, .11, .06, .31, .012],
    ];
    for (const [x, y, endX, endY, width] of vesselSpecs) {
      const vessel = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1, 1, 7), this.woundSurfaceMaterial);
      vessel.name = 'HeartVessel';
      const a = new THREE.Vector3(x, y, .04);
      const b = new THREE.Vector3(endX, endY, .04);
      lineBetween(vessel, a, b, width);
      this.heart.add(vessel);
      this.vessels.push({ mesh: vessel, a, b, width });
    }

    this.strands = [];
    for (let i = 0; i < 6; i += 1) {
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(.008, .018, 1, 6), this.woundSurfaceMaterial);
      strand.name = 'TornSinew';
      this.wound.add(strand);
      this.strands.push(strand);
    }

    this.corpse.visible = false;
    this.heartGlow = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial({
      color: 0xff394b,
      transparent: true,
      opacity: .055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    this.heartGlow.name = 'HeartPulseGlow';
    this.heart.add(this.heartGlow);
  }

  _makeTool() {
    this.syringe = new THREE.Group();
    this.syringe.name = 'BloodSyringe';
    this.syringe.position.set(.3, -.27, -.9);
    this.syringe.rotation.set(-.75, .55, -.28);
    this.tool.add(this.syringe);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .42, 14, 1, true), this.glassMaterial);
    barrel.name = 'SyringeChamber';
    barrel.rotation.x = Math.PI / 2;
    this.syringe.add(barrel);
    this.fluid = new THREE.Mesh(new THREE.CylinderGeometry(.043, .043, .36, 12), this.bloodBrightMaterial);
    this.fluid.name = 'BloodColumn';
    this.fluid.rotation.x = Math.PI / 2;
    this.fluid.position.z = .025;
    this.fluid.scale.y = .03;
    this.syringe.add(this.fluid);
    const flange = new THREE.Mesh(new THREE.TorusGeometry(.066, .012, 6, 16), this.metalMaterial);
    flange.name = 'SyringeFlange';
    flange.rotation.x = Math.PI / 2;
    flange.position.z = .22;
    this.syringe.add(flange);
    this.plunger = new THREE.Group();
    this.plunger.name = 'SyringePlunger';
    this.syringe.add(this.plunger);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .24, 8), this.metalMaterial);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = .26;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, .028, 12), this.metalMaterial);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = .39;
    this.plunger.add(rod, cap);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(.009, .014, .3, 8), this.metalMaterial);
    needle.name = 'SyringeNeedle';
    needle.rotation.x = Math.PI / 2;
    needle.position.z = -.36;
    this.syringe.add(needle);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.014, .055, 8), this.metalMaterial);
    tip.name = 'NeedleTip';
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -.525;
    this.syringe.add(tip);
    this.needleTip = tip;

    this.bladeTool = new THREE.Group();
    this.bladeTool.name = 'IncisionBlade';
    this.bladeTool.position.set(.17, -.07, -.52);
    this.bladeTool.rotation.set(-.55, -.15, .62);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.026, .036, .24, 9), this.gloveMaterial);
    handle.rotation.z = Math.PI / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.018, .018, .3), this.metalMaterial);
    blade.name = 'SterileBlade';
    blade.position.z = -.18;
    blade.rotation.y = -.08;
    this.bladeTool.add(handle, blade);
    this.tool.add(this.bladeTool);

    this.forceps = new THREE.Group();
    this.forceps.name = 'HeartForceps';
    this.forceps.position.set(.07, -.12, -.54);
    this.forceps.rotation.set(-.3, .12, .38);
    for (const side of [-1, 1]) {
      const tong = new THREE.Mesh(new THREE.CylinderGeometry(.014, .022, .37, 7), this.metalMaterial);
      tong.name = side < 0 ? 'ForcepsLeft' : 'ForcepsRight';
      tong.rotation.z = side * .16;
      tong.position.x = side * .04;
      tong.position.z = -.14;
      this.forceps.add(tong);
    }
    this.tool.add(this.forceps);

    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .16, 4, 8), this.gloveMaterial);
    palm.name = 'ExtractionGlove';
    palm.position.set(.2, -.22, -.65);
    palm.rotation.z = -.38;
    this.tool.add(palm);

    this.syringe.visible = false;
    this.bladeTool.visible = false;
    this.forceps.visible = false;
  }

  _makePools() {
    const dropMaterial = this.bloodBrightMaterial;
    this.droplets = new THREE.InstancedMesh(new THREE.SphereGeometry(.026, 6, 5), dropMaterial, 36);
    this.droplets.name = 'ExtractionDropletPool';
    this.droplets.count = 0;
    this.droplets.frustumCulled = false;
    this.droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.world.add(this.droplets);

    this.link = new THREE.Mesh(new THREE.CylinderGeometry(.016, .022, 1, 8), this.bloodMaterial);
    this.link.name = 'BloodUptakeTube';
    this.link.frustumCulled = false;
    this.world.add(this.link);
    this.flowBead = new THREE.Mesh(new THREE.SphereGeometry(.03, 7, 5), this.bloodBrightMaterial);
    this.flowBead.name = 'BloodFlowBead';
    this.world.add(this.flowBead);
  }

  _resolveTarget(run, extraction) {
    const id = extraction?.targetId;
    if (id == null) return null;
    const enemies = run?.course?.enemies || [];
    return enemies.find(enemy => String(enemy.id) === String(id)) || extraction.target || null;
  }

  _resetVariant(seed, target, authored = null) {
    this._seed = Number(seed) || Number(target?.id) || 0;
    const n = hash01(this._seed, 2);
    this._variant = {
      scale: .91 + hash01(this._seed, 3) * .18,
      yaw: (hash01(this._seed, 4) - .5) * .22,
      woundX: (hash01(this._seed, 5) - .5) * .085,
      woundY: (hash01(this._seed, 6) - .5) * .06,
      woundScale: .86 + hash01(this._seed, 7) * .38,
      heartScale: .88 + hash01(this._seed, 8) * .28,
      heartHue: n > .52 ? 0x72111f : 0x84212a,
      dropCount: 12 + Math.floor(hash01(this._seed, 9) * 17),
      handSide: hash01(this._seed, 10) > .5 ? 1 : -1,
      drawRate: Number(authored?.drawRate) || 1,
      drawSway: Number(authored?.drawSway) || 0,
      incisionAngle: Number.isFinite(Number(authored?.incisionAngle)) ? Number(authored.incisionAngle) : (hash01(this._seed, 11) - .5) * .26,
      incisionDepth: Number(authored?.incisionDepth) || 1,
      ripArc: Number(authored?.ripArc) || 0,
      heartPulse: Number(authored?.heartPulse) || 1,
    };
    this.heartSurfaceMaterial.color.setHex(this._variant.heartHue);
    this.corpse.scale.setScalar(this._variant.scale);
    this.corpse.rotation.y = this._variant.yaw;
    this.wound.position.x = -.36 + this._variant.woundX;
    this.wound.position.y = .29 + this._variant.woundY;
    this.wound.position.z = .22;
    this.wound.rotation.z = this._variant.incisionAngle;
    this.wound.scale.set(this._variant.woundScale, 1, 1);
    this._lastTargetId = target?.id ?? null;
  }

  _stageValues(extraction) {
    const overall = clamp(Number(extraction?.progress) || 0, 0, 1);
    const phase = String(extraction?.phase || 'draw').toLowerCase();
    const explicit = Number(extraction?.stageProgress ?? extraction?.phaseProgress);
    const stage = Number.isFinite(explicit) ? clamp(explicit, 0, 1) : phase === 'draw'
      ? clamp(overall / .33, 0, 1)
      : phase === 'incise'
        ? clamp((overall - .26) / .38, 0, 1)
        : clamp((overall - .58) / .42, 0, 1);
    const draw = phase === 'draw' ? stage : 1;
    const incise = phase === 'incise' ? stage : phase === 'rip' ? 1 : 0;
    const rip = phase === 'rip' ? stage : 0;
    const state = this._stageState;
    state.overall = overall;
    state.phase = phase;
    state.stage = stage;
    state.draw = draw;
    state.incise = incise;
    state.rip = rip;
    return state;
  }

  _updateCorpse(target, now, values) {
    const { camera, target: targetPoint, wound: woundPoint } = this._vectors;
    targetPoint.set((Number(target.x) || 0) * this.cell, (Number(target.z) || 0) * this.cell, (Number(target.y) || 0) * this.cell);
    this.corpse.position.copy(targetPoint);
    this.camera.getWorldPosition(camera);
    this.corpse.rotation.y = Math.atan2(camera.x - targetPoint.x, camera.z - targetPoint.z) + this._variant.yaw;
    this.corpse.visible = true;
    this.corpse.updateMatrixWorld(true);
    this.wound.getWorldPosition(woundPoint);

    const incision = clamp(values.incise * 1.08 + values.rip * .18, 0, 1);
    this.woundRim.scale.set(1.2 + incision * .42, .62 + incision * .14, 1);
    this.cavity.scale.set(1.18 + incision * .52, .62 + incision * .22, .28 + incision * .08);
    this.cavity.visible = incision > .03;
    this.woundRim.visible = incision > .03;
    this.puncture.visible = incision <= .03 && values.draw > .03;
    this.flaps.forEach((flap, index) => {
      const side = index === 0 ? -1 : 1;
      flap.visible = incision > .03;
      flap.position.x = side * (.055 + incision * .11);
      flap.rotation.y = side * incision * .42;
    });
    this.incisionA.scale.y = .34 + incision * .28;
    this.incisionB.scale.y = .3 + incision * .24;
    this.heart.visible = incision > .38;
    const heartbeat = 1 + Math.sin(now * (8.2 + this._variant.heartPulse * .8) + this._seed) * (.045 + incision * .025) + values.rip * .04;
    const pull = values.rip * (1 + Math.max(0, Math.sin(values.rip * Math.PI)) * .08);
    this.heart.position.set(this.heartBase.x + Math.sin(this._seed + now * 2.1) * .018 * pull, this.heartBase.y + pull * (.12 + this._variant.ripArc * .04), this.heartBase.z + pull * (.3 + .2 * this._variant.woundScale));
    this.heart.scale.setScalar(this._variant.heartScale * heartbeat * (1 + pull * .16));
    this.heartGlow.scale.setScalar(1.1 + heartbeat * .08 + pull * .32);
    this.heartGlow.material.opacity = .025 + heartbeat * .015 + pull * .025;

    for (let i = 0; i < this.strands.length; i += 1) {
      const strand = this.strands[i];
      const angle = (i / this.strands.length) * TAU + hash01(this._seed, i + 20) * .35;
      const length = .08 + incision * (.17 + hash01(this._seed, i + 21) * .18) + pull * .16;
      strand.position.set(Math.cos(angle) * (.1 + incision * .04), Math.sin(angle) * (.1 + incision * .035), .07 + pull * .12);
      strand.scale.set(1, length, 1);
      strand.rotation.z = angle;
      strand.rotation.x = (hash01(this._seed, i + 22) - .5) * .8 + pull * .25;
      strand.visible = incision > .22;
    }
    return woundPoint;
  }

  _updateTool(now, values) {
    const reduced = this.settings.reducedMotion;
    const motion = reduced ? .25 : 1;
    const draw = values.draw;
    const incise = values.incise;
    const rip = values.rip;
    this.syringe.visible = incise < .02 && rip < .02;
    this.syringe.position.set(.3 + Math.sin(now * 2.4 + this._seed) * (.012 + Math.abs(this._variant.drawSway) * .12) * motion, -.27 + Math.cos(now * 2.1) * .008 * motion, -.9 - draw * .08);
    this.syringe.rotation.z = -.27 + Math.sin(now * 1.8 + this._seed) * .025 * motion;
    this.syringe.rotation.x = -.75 - draw * .08;
    const fill = clamp(values.overall * 1.05 + incise * .16 + rip * .08, .02, 1);
    this.fluid.scale.y = .03 + fill * .86;
    this.fluid.position.z = -.16 + fill * .18;
    this.plunger.position.z = -.03 + fill * .17;
    this.bladeTool.visible = incise > .02 && rip < .94;
    this.bladeTool.position.x = .05 + Math.sin(now * 2.7 + this._seed) * .015 * motion;
    this.bladeTool.position.z = -.5 - incise * .1;
    this.bladeTool.rotation.y = -.15 + incise * .25;
    this.forceps.visible = rip > .03;
    this.forceps.position.x = -.02 + Math.sin(now * 2.1 + this._seed) * .01 * motion;
    this.forceps.position.z = -.52 - rip * .08;
    this.forceps.rotation.z = .38 + Math.sin(now * 3.4) * .035 * motion;
    this.tool.visible = true;
  }

  _updateLink(woundPoint, values) {
    const needle = this._vectors.needle;
    this.needleTip.getWorldPosition(needle);
    const streamEnd = this._vectors.streamEnd;
    streamEnd.copy(needle).sub(woundPoint).normalize().multiplyScalar(.22 + values.draw * .1).add(woundPoint);
    lineBetween(this.link, woundPoint, streamEnd, .5);
    this.link.visible = values.draw > .08 && values.incise === 0 && values.rip === 0;
    this.flowBead.visible = values.overall > .18;
    if (this.flowBead.visible) {
      const t = (values.overall * 1.4 + (this._frame * .012) * (this.settings.reducedMotion ? .35 : 1)) % 1;
      this.flowBead.position.lerpVectors(woundPoint, streamEnd, t);
      this.flowBead.scale.setScalar(.7 + Math.sin(t * Math.PI) * .42);
    }
  }

  _updateDroplets(woundPoint, needlePoint, now, values) {
    const count = this.settings.gore ? Math.min(36, Math.floor(this._variant.dropCount * (values.incise * .38 + values.rip * .72 + values.draw * .18))) : 0;
    const direction = this._vectors.direction.subVectors(needlePoint, woundPoint);
    const length = Math.max(.001, direction.length());
    direction.multiplyScalar(1 / length);
    const side = this._vectors.axis.set(-direction.z, 0, direction.x).normalize();
    const position = this._vectors.local;
    const quaternion = this._quaternion;
    const scale = this._vectors.scale;
    for (let i = 0; i < count; i += 1) {
      const phase = (now * (.7 + hash01(this._seed, i + 40) * .7) + hash01(this._seed, i + 41) * 9) % 9;
      const t = clamp(phase / 9, 0, 1);
      const spread = (.018 + hash01(this._seed, i + 42) * .07) * (1 - t * .35);
      position.copy(woundPoint).lerp(needlePoint, t).addScaledVector(side, Math.sin(phase * 2.2) * spread);
      position.y += Math.cos(phase * 1.7 + i) * spread * .7 - t * t * .12;
      const size = .52 + hash01(this._seed, i + 43) * .74;
      scale.setScalar(size);
      quaternion.setFromAxisAngle(Y_AXIS, phase + i);
      this._matrix.compose(position, quaternion, scale);
      this.droplets.setMatrixAt(i, this._matrix);
    }
    this.droplets.count = count;
    this.droplets.instanceMatrix.needsUpdate = true;
  }

  update(run, nowMs = 0, dt = .016, options = {}) {
    this.settings.gore = options.gore !== false;
    this.settings.reducedMotion = options.reducedMotion === true;
    const extraction = run?.extraction;
    const settling = extraction?.phase === 'idle' && extraction.lastTargetId != null && extraction.completedAt > 0 &&
      (run?.time ?? Infinity) - extraction.completedAt >= 0 && (run?.time ?? Infinity) - extraction.completedAt < .8;
    const target = this._resolveTarget(run, extraction) || (settling
      ? (run?.course?.enemies || []).find(enemy => String(enemy.id) === String(extraction.lastTargetId))
      : null);
    const phaseName = String(extraction?.phase || '').toLowerCase();
    const progress = clamp(Number(extraction?.progress) || 0, 0, 1);
    const done = !extraction || !target || (target.extracted === true && !settling) || phaseName === 'done' || phaseName === 'complete' || (progress >= 1 && phaseName === 'finished');
    if (done || !this.settings.gore) {
      this.active = false;
      this.root.visible = false;
      this.corpse.visible = false;
      this.tool.visible = false;
      this.droplets.count = 0;
      this.link.visible = false;
      this.flowBead.visible = false;
      return;
    }
    this.active = true;
    this.root.visible = true;
    this._run = run;
    const display = settling ? {phase:'rip',progress:1,stageProgress:1,seed:extraction.lastSeed,variation:target.extractionVariation} : extraction;
    const seed = display.seed ?? target.seed ?? target.id ?? 0;
    if (this._lastTargetId !== target.id || this._seed !== Number(seed) || !this._variant) this._resetVariant(seed, target, display.variation || target.extractionVariation);
    const values = this._stageValues(display);
    this._phase = settling ? 'complete' : values.phase;
    this._progress = values.overall;
    this._frame += Math.max(1, dt * 60);
    const now = nowMs * .001;
    const woundPoint = this._updateCorpse(target, now, values);
    this._updateTool(now, values);
    this._updateLink(woundPoint, values);
    this._updateDroplets(woundPoint, this._vectors.streamEnd, now, values);
    if(settling){
      this.syringe.visible=false;
      this.bladeTool.visible=false;
      this.link.visible=false;
      this.flowBead.visible=false;
    }
  }

  diagnostics() {
    return {
      active: this.active,
      phase: this._phase,
      progress: Number(this._progress.toFixed(3)),
      targetId: this._lastTargetId,
      seed: this._seed,
      droplets: this.droplets?.count || 0,
      pooledDroplets: this.droplets?.count ?? 0,
      worldVisible: !!this.corpse?.visible,
      toolVisible: !!this.tool?.visible,
    };
  }

  reset() {
    this.active = false;
    this._run = null;
    this._phase = '';
    this._progress = 0;
    this._lastTargetId = null;
    this.root.visible = false;
    this.corpse.visible = false;
    this.tool.visible = false;
    this.droplets.count = 0;
    this.link.visible = false;
    this.flowBead.visible = false;
  }

  dispose() {
    this.reset();
    this.camera?.remove(this.tool);
    this.scene?.remove(this.root);
    disposeRoot(this.root);
    disposeRoot(this.tool);
  }
}

export default ExtractionVFX;
