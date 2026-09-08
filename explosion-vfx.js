import * as THREE from './vendor/three.module.js';

// Explosions are authored in simulation cells by the combat code.  Keeping
// the conversion here means the renderer can consume both network snapshots
// and local prediction without creating a second effect path.
const CELL = 4;
const TAU = Math.PI * 2;
const MAX_EXPLOSIONS = 18;
const FIRE_PER_EXPLOSION = 2;
const SMOKE_PER_EXPLOSION = 2;
const EMBERS_PER_EXPLOSION = 20;
const MAX_FIRE = MAX_EXPLOSIONS * FIRE_PER_EXPLOSION;
const MAX_SMOKE = MAX_EXPLOSIONS * SMOKE_PER_EXPLOSION;
const MAX_EMBERS = MAX_EXPLOSIONS * EMBERS_PER_EXPLOSION;
const MAX_RINGS = MAX_EXPLOSIONS;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => value * value * (3 - 2 * value);

function hash(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function worldPosition(event) {
  if (event?.worldPosition) {
    return new THREE.Vector3(event.worldPosition.x || 0, event.worldPosition.y || 0, event.worldPosition.z || 0);
  }
  if (event?.position && event.position.world) {
    return new THREE.Vector3(event.position.world.x || 0, event.position.world.y || 0, event.position.world.z || 0);
  }
  if (event?.position) {
    return new THREE.Vector3((event.position.x || 0) * CELL, (event.position.z || 0) * CELL, (event.position.y || 0) * CELL);
  }
  // Simulation coordinates use x/y for the floor and z for height.
  return new THREE.Vector3(
    (event?.x || 0) * CELL,
    (event?.z || 0) * CELL,
    (event?.y || 0) * CELL,
  );
}

function eventKey(event, prefix = 'blast') {
  if (event?.id !== undefined) return `${prefix}:${event.id}`;
  if (event?.seq !== undefined) return `${prefix}:seq:${event.seq}`;
  if (event?.shotId !== undefined) return `${prefix}:shot:${event.shotId}`;
  const p = worldPosition(event);
  const t = event?.time ?? event?.createdAt ?? event?.spawnTime ?? 0;
  return `${prefix}:${Math.round(p.x * 10)}:${Math.round(p.y * 10)}:${Math.round(p.z * 10)}:${Math.round(t * 100)}`;
}

function colorFor(event) {
  const color = new THREE.Color(event?.color ?? event?.tint ?? 0xff613d);
  if (!Number.isFinite(color.r)) color.set(0xff613d);
  return color;
}

function makeBillboardPool(name, capacity, layer, blending, depthTest = true) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 1, 1, 0, 1,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.instanceCount = 0;
  const center = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const age = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const seed = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const kind = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  geometry.setAttribute('aCenter', center);
  geometry.setAttribute('aSize', size);
  geometry.setAttribute('aAge', age);
  geometry.setAttribute('aSeed', seed);
  geometry.setAttribute('aTint', tint);
  geometry.setAttribute('aKind', kind);

  const material = new THREE.ShaderMaterial({
    name: `${name}Shader`,
    uniforms: {
      uTime: { value: 0 },
      uReducedMotion: { value: 0 },
      uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
      uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      attribute vec3 aCenter;
      attribute float aSize;
      attribute float aAge;
      attribute float aSeed;
      attribute vec3 aTint;
      attribute float aKind;
      uniform float uTime;
      uniform float uReducedMotion;
      uniform vec3 uCameraRight;
      uniform vec3 uCameraUp;
      varying vec2 vUv;
      varying float vAge;
      varying float vSeed;
      varying vec3 vTint;
      varying float vKind;
      void main() {
        vUv = uv;
        vAge = clamp(aAge, 0.0, 1.0);
        vSeed = aSeed;
        vTint = aTint;
        vKind = aKind;
        float timeWobble = sin(uTime * (1.3 + fract(aSeed * 2.17)) + aSeed * 19.0) * 0.035;
        vec3 center = aCenter + vec3(timeWobble, timeWobble * 0.6, -timeWobble);
        float pulse = 1.0 + sin(aSeed * 13.0 + uTime * 8.0) * 0.035 * (1.0 - uReducedMotion);
        float scale = aSize * pulse * mix(1.0, 0.86, uReducedMotion);
        vec3 world = center + (uCameraRight * position.x + uCameraUp * position.y) * scale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vAge;
      varying float vSeed;
      varying vec3 vTint;
      varying float vKind;
      uniform float uTime;
      void main() {
        vec2 p = vUv - 0.5;
        float radius = length(p) * 2.0;
        float disc = 1.0 - smoothstep(0.34, 1.0, radius);
        float edge = smoothstep(0.0, 0.58, radius) * (1.0 - smoothstep(0.68, 1.0, radius));
        float noise = 0.72 + 0.28 * sin((p.x * 7.0 + p.y * 11.0) + vSeed * 21.0 + uTime * 4.0);
        float fadeIn = smoothstep(0.0, 0.12, vAge);
        float fadeOut = 1.0 - smoothstep(0.62, 1.0, vAge);
        vec3 fireHot = vec3(1.0, 0.9, 0.61);
        vec3 fireMid = mix(vec3(1.0, 0.22, 0.035), vTint, 0.58);
        vec3 fireColor = mix(fireHot, fireMid, smoothstep(0.18, 0.82, radius));
        float fireAlpha = disc * edge * fadeIn * fadeOut * noise;
        vec3 smokeColor = mix(vec3(0.06, 0.045, 0.055), vec3(0.22, 0.12, 0.11), noise);
        float smokeAlpha = disc * (0.48 + edge * 0.52) * fadeIn * fadeOut * 0.62;
        vec3 emberColor = mix(fireHot, vTint, smoothstep(0.12, 0.85, radius));
        float emberAlpha = disc * fadeIn * fadeOut;
        vec3 color;
        float alpha;
        if (vKind < 0.5) {
          color = fireColor;
          alpha = fireAlpha;
        } else if (vKind < 1.5) {
          color = smokeColor;
          alpha = smokeAlpha;
        } else {
          color = emberColor;
          alpha = emberAlpha;
        }
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthTest,
    depthWrite: false,
    blending,
    toneMapped: layer !== 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = layer === 1 ? 4 : 6;
  return { mesh, geometry, material, capacity, attrs: { center, size, age, seed, tint, kind } };
}

function makeRingPool(name, capacity) {
  const source = new THREE.RingGeometry(0.72, 1.0, 48, 1);
  source.rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = source.index;
  for (const key of Object.keys(source.attributes)) geometry.setAttribute(key, source.attributes[key]);
  geometry.instanceCount = 0;
  const center = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const scale = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const age = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  geometry.setAttribute('aCenter', center);
  geometry.setAttribute('aScale', scale);
  geometry.setAttribute('aAge', age);
  geometry.setAttribute('aAlpha', alpha);
  geometry.setAttribute('aTint', tint);
  const material = new THREE.ShaderMaterial({
    name: `${name}Shader`,
    uniforms: { uReducedMotion: { value: 0 } },
    vertexShader: `
      attribute vec3 aCenter;
      attribute float aScale;
      attribute vec3 aTint;
      attribute float aAlpha;
      attribute float aAge;
      uniform float uReducedMotion;
      varying float vAge;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vAge = aAge;
        vec3 local = position;
        local.xz *= aScale * mix(1.0, 0.82, uReducedMotion);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(aCenter + local, 1.0);
        vTint = aTint;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vTint;
      varying float vAlpha;
      varying float vAge;
      void main() {
        float fade = pow(max(0.0, 1.0 - vAge), 1.6);
        gl_FragColor = vec4(vTint, vAlpha * fade);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, geometry, material, capacity, attrs: { center, scale, age, alpha, tint } };
}

export class ExplosionVFX {
  constructor(parent, options = {}) {
    this.root = new THREE.Group();
    this.root.name = 'BazookaExplosionPools';
    parent.add(this.root);
    this.maxExplosions = Math.max(1, options.maxExplosions || MAX_EXPLOSIONS);
    this.time = 0;
    this.lastRunTime = -Infinity;
    this.seen = new Set();
    this.events = Array.from({ length: this.maxExplosions }, () => null);
    this.settings = { reducedMotion: false, gore: true };
    this.camera = null;
    this._flashPosition = new THREE.Vector3();

    this.fire = makeBillboardPool('BazookaFireBillboards', this.maxExplosions * FIRE_PER_EXPLOSION, 0, THREE.AdditiveBlending);
    this.smoke = makeBillboardPool('BazookaSmokeBillboards', this.maxExplosions * SMOKE_PER_EXPLOSION, 1, THREE.NormalBlending);
    this.embers = makeBillboardPool('BazookaEmberTrails', this.maxExplosions * EMBERS_PER_EXPLOSION, 2, THREE.AdditiveBlending);
    this.rings = makeRingPool('BazookaShockwaveRings', this.maxExplosions);
    this.root.add(this.smoke.mesh, this.fire.mesh, this.rings.mesh, this.embers.mesh);
    this.flashLight = new THREE.PointLight(0xff633b, 0, 18, 2.0);
    this.flashLight.name = 'BazookaBlastFlash';
    this.root.add(this.flashLight);
  }

  setCamera(camera) {
    this.camera = camera || null;
  }

  setSettings(settings = {}) {
    if (typeof settings.reducedMotion === 'boolean') this.settings.reducedMotion = settings.reducedMotion;
    if (typeof settings.gore === 'boolean') this.settings.gore = settings.gore;
  }

  clear() {
    this.events.fill(null);
    this.seen.clear();
    this.fire.geometry.instanceCount = 0;
    this.smoke.geometry.instanceCount = 0;
    this.embers.geometry.instanceCount = 0;
    this.rings.geometry.instanceCount = 0;
    this.flashLight.intensity = 0;
  }

  spawn(event = {}) {
    const key = eventKey(event);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    let slot = this.events.findIndex(item => !item);
    if (slot < 0) {
      // Replace the oldest visual, preserving a fixed memory/overdraw budget.
      let oldest = -1;
      let oldestAge = -Infinity;
      for (let i = 0; i < this.events.length; i++) {
        if (this.events[i]?.age > oldestAge) { oldestAge = this.events[i].age; oldest = i; }
      }
      slot = oldest < 0 ? 0 : oldest;
    }
    const position = worldPosition(event);
    const radiusCells = Number.isFinite(event.radius) ? event.radius : (Number.isFinite(event.scale) ? event.scale : 1.15);
    const radius = clamp(event.radiusWorld ?? radiusCells * CELL * 0.56, 1.0, 10.5);
    const tint = colorFor(event);
    this.events[slot] = {
      key,
      position,
      radius,
      tint,
      age: 0,
      life: clamp(event.life ?? 1.2, 0.65, 2.4),
      seed: Number.isFinite(event.seed) ? event.seed : hash(position.x * 0.13 + position.z * 0.071 + this.time),
      flash: clamp(event.flash ?? event.intensity ?? 1.0, 0.35, 2.4),
      force: event.force ?? 1,
    };
    return true;
  }

  _collectEvents(run) {
    const events = [];
    const push = (source, prefix) => {
      if (!Array.isArray(source)) return;
      for (const item of source) if (item) events.push({ item, prefix });
    };
    push(run?.explosions, 'explosion');
    push(run?.blasts, 'blast');
    push(run?.blastEvents, 'blast');
    push(run?.rocketExplosions, 'rocket');
    push(run?.effects?.explosions, 'effect');
    push(run?.combat?.explosions, 'combat');
    // The fallback lets the renderer show a bazooka impact even while an older
    // simulation snapshot still calls the event a hit tracer.
    for (const tracer of run?.tracers || []) {
      if (tracer.weapon === 3 && tracer.hit && (tracer.tx !== undefined || tracer.x !== undefined)) {
        events.push({ item: { ...tracer, x: tracer.tx ?? tracer.x, y: tracer.ty ?? tracer.y, z: tracer.tz ?? tracer.z, radius: tracer.radius ?? 1.15 }, prefix: 'rocket-tracer' });
      }
    }
    return events;
  }

  _updateCameraUniforms() {
    const right = this.fire.material.uniforms.uCameraRight.value;
    const up = this.fire.material.uniforms.uCameraUp.value;
    if (this.camera) {
      const e = this.camera.matrixWorld.elements;
      right.set(e[0], e[1], e[2]).normalize();
      up.set(e[4], e[5], e[6]).normalize();
    }
    this.smoke.material.uniforms.uCameraRight.value.copy(right);
    this.smoke.material.uniforms.uCameraUp.value.copy(up);
    this.embers.material.uniforms.uCameraRight.value.copy(right);
    this.embers.material.uniforms.uCameraUp.value.copy(up);
  }

  update(run, dt = 0.016, settings = {}) {
    this.setSettings(settings);
    if (run?.time !== undefined && run.time < this.lastRunTime) this.clear();
    this.lastRunTime = run?.time ?? this.lastRunTime;
    const frame = clamp(dt, 0.001, 0.05);
    this.time += frame;
    for (const { item, prefix } of this._collectEvents(run)) {
      const key = eventKey(item, prefix);
      if (!this.seen.has(key)) this.spawn({ ...item, id: item.id ?? key });
    }
    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      if (!event) continue;
      event.age += frame;
      if (event.age > event.life) this.events[i] = null;
    }

    this._updateCameraUniforms();
    const reduced = this.settings.reducedMotion ? 1 : 0;
    for (const pool of [this.fire, this.smoke, this.embers]) {
      pool.material.uniforms.uTime.value = this.time;
      pool.material.uniforms.uReducedMotion.value = reduced;
    }
    this.rings.material.uniforms.uReducedMotion.value = reduced;

    const fire = this.fire.attrs;
    const smoke = this.smoke.attrs;
    const ember = this.embers.attrs;
    const ring = this.rings.attrs;
    let fireCount = 0, smokeCount = 0, emberCount = 0, ringCount = 0;
    let flash = 0;
    let flashEvent = null;
    for (const event of this.events) {
      if (!event) continue;
      const fireAge = clamp(event.age / Math.min(event.life, 0.62), 0, 1);
      const smokeAge = clamp(Math.max(0, event.age - 0.08) / Math.min(event.life, 1.2), 0, 1);
      const ringAge = clamp(event.age / Math.min(event.life, 0.82), 0, 1);
      const tint = event.tint;
      const setVec3 = (attribute, index, x, y, z) => {
        const offset = index * 3;
        attribute.array[offset] = x; attribute.array[offset + 1] = y; attribute.array[offset + 2] = z;
      };
      for (let layer = 0; layer < FIRE_PER_EXPLOSION && fireCount < this.fire.capacity; layer++) {
        const i = fireCount++;
        const side = layer ? -1 : 1;
        setVec3(fire.center, i, event.position.x + side * event.radius * 0.08, event.position.y + event.radius * 0.22, event.position.z + side * event.radius * 0.03);
        fire.size.array[i] = event.radius * (layer ? 0.7 : 0.94) * (1.0 - fireAge * 0.23);
        fire.age.array[i] = fireAge;
        fire.seed.array[i] = event.seed + layer * 1.37;
        setVec3(fire.tint, i, tint.r, tint.g, tint.b);
        fire.kind.array[i] = 0;
      }
      for (let layer = 0; layer < SMOKE_PER_EXPLOSION && smokeCount < this.smoke.capacity; layer++) {
        const i = smokeCount++;
        setVec3(smoke.center, i, event.position.x + (layer ? -event.radius * 0.22 : event.radius * 0.18), event.position.y + event.radius * (0.55 + layer * 0.1), event.position.z + (layer ? event.radius * 0.08 : -event.radius * 0.14));
        smoke.size.array[i] = event.radius * (0.72 + layer * 0.24) * (0.76 + smokeAge * 0.48);
        smoke.age.array[i] = smokeAge;
        smoke.seed.array[i] = event.seed + 3.1 + layer * 2.07;
        setVec3(smoke.tint, i, tint.r * 0.54, tint.g * 0.31, tint.b * 0.22);
        smoke.kind.array[i] = 1;
      }
      if (!reduced) {
        for (let spark = 0; spark < EMBERS_PER_EXPLOSION && emberCount < this.embers.capacity; spark++) {
          const delay = hash(event.seed + spark * 2.17) * 0.1;
          const age = event.age - delay;
          const life = 0.3 + hash(event.seed + spark * 4.31) * 0.55;
          if (age <= 0 || age >= life) continue;
          const t = age / life;
          const theta = hash(event.seed + spark * 5.11) * TAU;
          const lift = 0.42 + hash(event.seed + spark * 7.13) * 0.8;
          const speed = event.radius * (0.7 + hash(event.seed + spark * 3.73) * 1.7);
          const gravity = event.radius * 0.92;
          const i = emberCount++;
          setVec3(ember.center, i,
            event.position.x + Math.cos(theta) * speed * t,
            event.position.y + lift * speed * t - gravity * t * t,
            event.position.z + Math.sin(theta) * speed * t);
          ember.size.array[i] = event.radius * (0.045 + hash(event.seed + spark) * 0.07) * (1.0 - t * 0.72);
          ember.age.array[i] = t;
          ember.seed.array[i] = event.seed + spark * 0.41;
          setVec3(ember.tint, i, Math.min(1, tint.r * 1.4), Math.min(1, tint.g * 1.18), Math.min(1, tint.b * 1.1));
          ember.kind.array[i] = 2;
        }
      }
      if (ringCount < this.rings.capacity) {
        const i = ringCount++;
        setVec3(ring.center, i, event.position.x, 0.048, event.position.z);
        ring.scale.array[i] = event.radius * (0.84 + ringAge * 1.75);
        ring.age.array[i] = ringAge;
        ring.alpha.array[i] = reduced ? 0.28 * event.force : 0.78 * event.force;
        setVec3(ring.tint, i, tint.r * 1.35, tint.g * 1.06, tint.b * 0.96);
      }
      const currentFlash = event.flash * (1 - smooth(clamp(event.age / 0.42, 0, 1)));
      if (currentFlash > flash) { flash = currentFlash; flashEvent = event; }
    }
    this.fire.geometry.instanceCount = fireCount;
    this.smoke.geometry.instanceCount = smokeCount;
    this.embers.geometry.instanceCount = emberCount;
    this.rings.geometry.instanceCount = ringCount;
    for (const attr of Object.values(this.fire.attrs)) attr.needsUpdate = true;
    for (const attr of Object.values(this.smoke.attrs)) attr.needsUpdate = true;
    for (const attr of Object.values(this.embers.attrs)) attr.needsUpdate = true;
    for (const attr of Object.values(this.rings.attrs)) attr.needsUpdate = true;

    if (flashEvent) {
      this.flashLight.position.copy(flashEvent.position);
      this.flashLight.color.copy(flashEvent.tint);
      this.flashLight.intensity = flash * (this.settings.reducedMotion ? 1.8 : 8.5);
      this.flashLight.distance = clamp(flashEvent.radius * 6.5, 8, 48);
    } else {
      this.flashLight.intensity = 0;
    }
  }

  diagnostics() {
    return {
      active: this.events.reduce((count, event) => count + (event ? 1 : 0), 0),
      fire: this.fire.geometry.instanceCount,
      smoke: this.smoke.geometry.instanceCount,
      embers: this.embers.geometry.instanceCount,
      rings: this.rings.geometry.instanceCount,
      maxExplosions: this.maxExplosions,
      reducedMotion: this.settings.reducedMotion,
      gore: this.settings.gore,
    };
  }

  dispose() {
    for (const pool of [this.fire, this.smoke, this.embers, this.rings]) {
      pool.geometry.dispose();
      pool.material.dispose();
    }
    this.flashLight.dispose?.();
  }
}

export default ExplosionVFX;
