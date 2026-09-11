/*
 * The Last Dead audio runtime.
 * Bundled samples are CC0 and live under ./audio. Every event also has a
 * procedural fallback so the game stays playable when a browser cannot decode
 * a file or the asset is unavailable.
 */
import { AUDIO_ASSET_MANIFEST } from './audio-manifest.js';
export { AUDIO_ASSET_MANIFEST };

const GROUPS = ['sfx', 'ui', 'ambience', 'voice', 'music'];
const GROUP_BY_TYPE = Object.freeze({
  ambience: 'ambience', ambient: 'ambience', voice: 'voice',
  hover: 'ui', toggle: 'ui', equip: 'ui', death: 'ui', win: 'ui', ui: 'ui', confirm: 'ui', cancel: 'ui', pause: 'ui', fail: 'ui',
});
const MIX_PROFILES = Object.freeze({
  default: { group: 'sfx', volume: .38, maxVoices: 10, highpass: 45, lowpass: 11000 },
  ambience: { group: 'ambience', volume: .32, maxVoices: 1, highpass: 38, lowpass: 5200 },
  shot: { group: 'sfx', volume: .45, maxVoices: 4, highpass: 70, lowpass: 9000, cooldown: .018 },
  rocket: { group: 'sfx', volume: .42, maxVoices: 3, highpass: 40, lowpass: 7200, cooldown: .08, refDistance: 2, maxDistance: 42 },
  explosion: { group: 'sfx', volume: .40, maxVoices: 5, highpass: 42, lowpass: 6800, cooldown: .05, refDistance: 1.8, maxDistance: 38 },
  hit: { group: 'sfx', volume: .25, maxVoices: 8, highpass: 80, lowpass: 6200, cooldown: .025 },
  blood: { group: 'sfx', volume: .21, maxVoices: 7, highpass: 70, lowpass: 3600, cooldown: .025 },
  bulletcrackle: { group: 'sfx', volume: .22, maxVoices: 6, highpass: 900, lowpass: 9000, cooldown: .04 },
  footstep: { group: 'sfx', volume: .14, maxVoices: 3, highpass: 90, lowpass: 3000, cooldown: .06 },
  jump: { group: 'sfx', volume: .18, maxVoices: 2, highpass: 80, lowpass: 5600, cooldown: .08 },
  land: { group: 'sfx', volume: .26, maxVoices: 3, highpass: 45, lowpass: 2800, cooldown: .08 },
  dash: { group: 'sfx', volume: .20, maxVoices: 3, highpass: 120, lowpass: 7200, cooldown: .05 },
  slide: { group: 'sfx', volume: .16, maxVoices: 3, highpass: 90, lowpass: 3600, cooldown: .08 },
  enemyattack: { group: 'sfx', volume: .34, maxVoices: 4, highpass: 100, lowpass: 4800, cooldown: .16, refDistance: 2.2, maxDistance: 34 },
  enemyjump: { group: 'sfx', volume: .24, maxVoices: 3, highpass: 80, lowpass: 4200, cooldown: .1, refDistance: 2, maxDistance: 30 },
  enemyland: { group: 'sfx', volume: .25, maxVoices: 3, highpass: 55, lowpass: 3300, cooldown: .1, refDistance: 2, maxDistance: 32 },
  enemydeath: { group: 'sfx', volume: .30, maxVoices: 4, highpass: 65, lowpass: 4300, cooldown: .04, refDistance: 2.4, maxDistance: 36 },
  moan: { group: 'sfx', volume: .18, maxVoices: 2, highpass: 90, lowpass: 3600, cooldown: .5, refDistance: 3, maxDistance: 42 },
  parry: { group: 'sfx', volume: .24, maxVoices: 3, highpass: 160, lowpass: 9000, cooldown: .08 },
  punch: { group: 'sfx', volume: .18, maxVoices: 4, highpass: 80, lowpass: 5200, cooldown: .06 },
  damage: { group: 'sfx', volume: .15, maxVoices: 3, highpass: 90, lowpass: 5000, cooldown: .1 },
  coin: { group: 'ui', volume: .20, maxVoices: 4, highpass: 420, lowpass: 7800, cooldown: .04 },
  ui: { group: 'ui', volume: .18, maxVoices: 3, highpass: 240, lowpass: 6800, cooldown: .04 },
  confirm: { group: 'ui', volume: .18, maxVoices: 3, highpass: 240, lowpass: 6800, cooldown: .04 },
  cancel: { group: 'ui', volume: .16, maxVoices: 3, highpass: 160, lowpass: 5000, cooldown: .04 },
  fail: { group: 'ui', volume: .16, maxVoices: 3, highpass: 160, lowpass: 5000, cooldown: .04 },
  wave: { group: 'sfx', volume: .24, maxVoices: 2, highpass: 80, lowpass: 4200, cooldown: .2 },
  win: { group: 'sfx', volume: .22, maxVoices: 2, highpass: 160, lowpass: 7800, cooldown: .2 },
});
const MUSIC_SCENES = Object.freeze({
  menu: { key: 'music-menu', volume: .17, rate: 1 },
  play: { key: 'music-play', volume: .12, rate: 1 },
  dead: { key: 'music-menu', volume: .10, rate: .92 },
  win: { key: 'music-menu', volume: .07, rate: .86 },
});
const SCENE_ALIASES = Object.freeze({
  game: 'play', gameplay: 'play', playing: 'play', ready: 'menu', loss: 'dead', victory: 'win',
});
const SHOT_PROFILES = Object.freeze([
  { volume: .42, highpass: 110, lowpass: 8200, cooldown: .02 },
  { volume: .50, highpass: 48, lowpass: 6400, cooldown: .08 },
  { volume: .36, highpass: 520, lowpass: 11800, cooldown: .025 },
  { volume: .43, highpass: 42, lowpass: 7600, cooldown: .08 },
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const now = context => context?.currentTime ?? 0;
function resolveMix(type, weapon = 0) {
  const base = MIX_PROFILES[type] || MIX_PROFILES.default;
  return type === 'shot' ? { ...base, ...(SHOT_PROFILES[weapon] || SHOT_PROFILES[0]) } : base;
}
const random = (min, max) => min + Math.random() * (max - min);
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];

function audioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function normalizeEvent(type, weapon, event) {
  let details = event && typeof event === 'object' ? { ...event } : {};
  if (weapon && typeof weapon === 'object') {
    details = { ...weapon, ...details };
    weapon = details.weapon ?? 0;
  }
  let name = String(type || details.type || '').toLowerCase().replace(/[_ ]/g, '-');
  const aliases = {
    fire: 'shot', weapon: 'shot', shoot: 'shot',
    impact: 'hit', gore: 'blood',
    kill: 'enemydeath', dead: 'death',
    'enemy-attack': 'enemyattack', attack: 'enemyattack',
    'enemy-death': 'enemydeath', enemydeath: 'enemydeath',
    ambient: 'ambience', boost: 'dash', slam: 'land',
    'rocket-launch': 'rocket', rocketfire: 'rocket',
    'rocket-detonate':'explosion','rocket-jump':'jump','spawn-telegraph':'moan',
    'sector-transition':'wave',
    menu: 'ui', select: 'confirm', error: 'fail',
  };
  name = aliases[name] || name;
  return { name, weapon: Math.max(0, Math.floor(Number(weapon) || 0)), details };
}

export class AudioSystem {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || import.meta.url;
    this.manifest = options.manifest || AUDIO_ASSET_MANIFEST;
    this._volume = clamp(options.volume ?? 0.8, 0, 1);
    this._muted = Boolean(options.muted);
    this._paused = false;
    this._ctx = null;
    this._master = null;
    this._limiter = null;
    this._groups = new Map();
    this._buffers = new Map();
    this._noiseBuffers = new Map();
    this._sources = new Set();
    this._ambientNodes = new Set();
    this._ambientSource = null;
    this._musicSource = null;
    this._musicGain = null;
    this._musicKey = '';
    this._musicScene = 'menu';
    this._resumeScene = 'menu';
    this._sceneRequested = false;
    this._loadPromise = null;
    this._assetCount = 0;
    this._loadErrors = [];
    this._loaded = false;
    this._disposed = false;
    this._lastPlay = new Map();
    this._lastVariant = new Map();
    this._voices = new Map();
  }

  get context() { return this._ctx; }
  get isUnlocked() { return Boolean(this._ctx && this._ctx.state === 'running'); }
  get assetsLoaded() { return this._loaded; }
  get assetCount() { return this._assetCount; }
  get loadErrors() { return this._loadErrors.slice(); }
  get scene() { return this._musicScene; }
  get musicActive() { return Boolean(this._musicSource); }
  get debugInfo() {
    return Object.freeze({ loaded: this._loaded, decoded: this._buffers.size, manifestEntries: this._assetCount, errors: this.loadErrors });
  }

  async unlock() {
    if (this._disposed) return false;
    const Context = audioContextConstructor();
    if (!Context) return false;
    if (!this._ctx) {
      try {
        this._ctx = new Context();
        this._master = this._ctx.createGain();
        this._limiter = this._ctx.createDynamicsCompressor();
        this._limiter.threshold.value = -12;
        this._limiter.knee.value = 18;
        this._limiter.ratio.value = 5;
        this._limiter.attack.value = .003;
        this._limiter.release.value = .22;
        this._master.connect(this._limiter).connect(this._ctx.destination);
        this._groups.set('master', this._master);
        const groupLevels = { sfx: .68, ui: .42, ambience: .42, voice: .58, music: .45 };
        for (const name of GROUPS) {
          const gain = this._ctx.createGain();
          gain.gain.value = groupLevels[name] ?? .6;
          gain.connect(this._master);
          this._groups.set(name, gain);
        }
        this._applyMasterGain();
      } catch {
        this._ctx = null;
        this._master = null;
        this._limiter = null;
        this._groups.clear();
        return false;
      }
    }
    try {
      if (this._ctx.state !== 'running') await this._ctx.resume();
    } catch {
      return false;
    }
    if (!this._loadPromise) this._loadPromise = this._loadAssets();
    await this._loadPromise;
    if (this._sceneRequested && !this._paused && this._musicScene !== 'pause') this._syncScene();
    return this._ctx.state === 'running';
  }

  setVolume(value) {
    this._volume = clamp(value, 0, 1);
    this._applyMasterGain();
    return this._volume;
  }

  setMuted(value) {
    this._muted = Boolean(value);
    this._applyMasterGain();
    return this._muted;
  }

  setGroupVolume(group, value) {
    const gain = this._groups.get(group);
    if (gain && this._ctx) gain.gain.setTargetAtTime(clamp(value, 0, 1), now(this._ctx), 0.015);
    return clamp(value, 0, 1);
  }

  pause() {
    this._paused = true;
    this._stopAmbient();
    this._fadeMusic(0.0001, .12);
    for (const [type, voices] of this._voices) if (type !== 'music' && GROUP_BY_TYPE[type] !== 'ui') {
      for (const source of voices) { try { source.stop(); } catch {} }
    }
    // Suspend the shared context after world voices are stopped. UI actions
    // can explicitly resume it on demand, keeping pause truly silent without
    // making the pause/retry controls lose their feedback cue.
    if (this._ctx?.state === 'running') {
      try { const pending = this._ctx.suspend?.(); pending?.catch?.(() => {}); } catch {}
    }
  }

  async resume() {
    this._paused = false;
    if (this._ctx && !this._muted && this._ctx.state !== 'running') {
      try { await this._ctx.resume(); } catch {}
    }
    if (this._musicScene === 'pause') this._musicScene = this._resumeScene || 'menu';
    if (this._sceneRequested) this._syncScene();
    return this.isUnlocked;
  }

  /**
   * Select the long-form background bed for the current screen. Calling this
   * repeatedly is safe: the active loop is reused and only its gain changes.
   * The first call may happen before unlock; the requested scene is remembered
   * and starts after the next user gesture unlocks Web Audio.
   */
  setScene(scene = 'menu') {
    const requested = String(scene || 'menu').toLowerCase();
    const next = SCENE_ALIASES[requested] || requested;
    if (next === 'pause') {
      if (this._musicScene !== 'pause') this._resumeScene = this._musicScene || 'menu';
      this._musicScene = 'pause';
      this._sceneRequested = true;
      this.pause();
      return this._musicScene;
    }
    const target = MUSIC_SCENES[next] ? next : 'menu';
    this._musicScene = target;
    this._resumeScene = target;
    this._sceneRequested = true;
    if (this._paused) this._paused = false;
    this._syncScene();
    return target;
  }

  stopAmbience() {
    this._stopAmbient();
  }

  updateListener(listener = {}) {
    const L = this._ctx?.listener;
    if (!L) return false;
    const set = (name, value) => {
      const target = L[name];
      if (target && typeof target.setValueAtTime === 'function') target.setValueAtTime(Number(value) || 0, now(this._ctx));
      else if (target) L[name] = Number(value) || 0;
    };
    set('positionX', listener.x);
    set('positionY', listener.y ?? listener.z);
    set('positionZ', listener.z ?? listener.y);
    if (listener.forwardX !== undefined) {
      set('forwardX', listener.forwardX); set('forwardY', listener.forwardY ?? 0); set('forwardZ', listener.forwardZ ?? -1);
      set('upX', listener.upX ?? 0); set('upY', listener.upY ?? 1); set('upZ', listener.upZ ?? 0);
    }
    return true;
  }

  play(type, weapon = 0, event = {}) {
    if (this._disposed || !this._ctx || this._ctx.state === 'closed') return false;
    const parsed = normalizeEvent(type, weapon, event);
    const name = parsed.name;
    if (this._paused && GROUP_BY_TYPE[name] !== 'ui') return false;
    if (this._paused && GROUP_BY_TYPE[name] === 'ui' && this._ctx?.state === 'suspended') {
      try { const pending = this._ctx.resume?.(); pending?.catch?.(() => {}); } catch {}
    }
    const index = parsed.weapon;
    const details = parsed.details;
    if (name === 'ambience') return this._playAmbience(details);
    const profile = { ...resolveMix(name, index) };
    if (name === 'hover') { profile.volume = .065; profile.cooldown = .07; }
    const mix = { ...profile, group: GROUP_BY_TYPE[name] || profile.group, ...details };
    const cooldown = Number(details.cooldown ?? profile.cooldown ?? 0);
    if (cooldown > 0) {
      const sourceId = details.enemyId ?? details.id ?? '';
      const key = name + ':' + index + ':' + String(sourceId);
      const time = globalThis.performance?.now?.() ?? Date.now();
      if (time - (this._lastPlay.get(key) || -Infinity) < cooldown * 1000) return false;
      this._lastPlay.set(key, time);
    }
    const buffer = this._chooseBuffer(name, index, details.variant);
    if (buffer) {
      this._playBuffer(buffer, name, index, mix);
      // Samples stand on their own; synthesis is reserved for missing assets.
      return true;
    }
    return this._synth(name, index, mix);
  }

  _synthAccent(type, weapon = 0, details = {}) {
    if (!this._ctx) return false;
    switch (type) {
      case 'shot':
      case 'rocket': this._synthWeaponAccent(type === 'rocket' ? 3 : weapon, details); return true;
      case 'explosion': this._synthExplosionAccent(details); return true;
      case 'hit': this._synthImpactAccent(details, false); return true;
      case 'blood': this._synthImpactAccent(details, true); return true;
      case 'enemyattack':
      case 'enemydeath':
      case 'enemyjump':
      case 'enemyland':
      case 'moan': this._synthCreatureAccent(type, details); return true;
      default: return false;
    }
  }

  _synthWeaponAccent(weapon = 0, details = {}) {
    const p = details.position;
    const w = Math.max(0, Math.min(3, Math.floor(Number(weapon) || 0)));
    if (w === 0) {
      this._tone({ from: 1840, to: 760, duration: .055, wave: 'square', level: .028, position: p });
      this._noise({ duration: .045, level: .032, highpass: 2300, lowpass: 11000, position: p });
    } else if (w === 1) {
      this._tone({ from: 58, to: 30, duration: .26, wave: 'sine', level: .072, position: p });
      this._noise({ duration: .18, level: .058, highpass: 70, lowpass: 1450, position: p });
    } else if (w === 2) {
      this._tone({ from: 720, to: 92, duration: .34, wave: 'sawtooth', level: .052, position: p });
      this._tone({ from: 1760, to: 460, duration: .24, wave: 'triangle', level: .036, position: p, detune: 9 });
      this._noise({ duration: .21, level: .045, highpass: 2500, lowpass: 10500, position: p });
    } else {
      this._tone({ from: 76, to: 24, duration: .42, wave: 'sine', level: .078, position: p });
      this._tone({ from: 240, to: 68, duration: .30, wave: 'triangle', level: .042, position: p });
      this._noise({ duration: .32, level: .065, highpass: 110, lowpass: 1450, position: p });
    }
    return true;
  }

  _synthExplosionAccent(details = {}) {
    const p = details.position;
    this._tone({ from: 62, to: 19, duration: .62, wave: 'sine', level: .082, position: p });
    this._noise({ duration: .38, level: .075, highpass: 110, lowpass: 1800, position: p });
    this._tone({ from: 160, to: 36, duration: .48, wave: 'triangle', level: .035, position: p });
    return true;
  }

  _synthImpactAccent(details = {}, wet = false) {
    const p = details.position;
    const kind = Math.max(0, Math.min(3, Number(details.enemyKind) || 0));
    if (wet) {
      this._tone({ from: kind === 2 ? 82 : 116, to: 42, duration: .18, wave: 'sine', level: .052, position: p });
      this._noise({ duration: .20, level: .064, highpass: 90, lowpass: kind === 2 ? 980 : 1550, position: p });
    } else if (kind === 1) {
      this._tone({ from: 540, to: 180, duration: .12, wave: 'triangle', level: .045, position: p });
      this._noise({ duration: .08, level: .035, highpass: 1600, lowpass: 6800, position: p });
    } else if (kind === 2) {
      this._tone({ from: 148, to: 54, duration: .16, wave: 'sine', level: .058, position: p });
      this._noise({ duration: .13, level: .042, highpass: 120, lowpass: 1900, position: p });
    } else {
      this._tone({ from: 260, to: 72, duration: .11, wave: 'square', level: .048, position: p });
      this._noise({ duration: .10, level: .034, highpass: 420, lowpass: 3900, position: p });
    }
    return true;
  }

  _synthCreatureAccent(type, details = {}) {
    const p = details.position;
    const kind = Math.max(0, Math.min(3, Number(details.enemyKind) || 0));
    if (type === 'enemyattack' || type === 'moan') {
      if (kind === 2) {
        this._tone({ from: 92, to: 36, duration: .48, wave: 'sine', level: .072, position: p });
        this._noise({ duration: .32, level: .060, lowpass: 700, position: p });
      } else if (kind === 1) {
        this._tone({ from: 410, to: 92, duration: .34, wave: 'sawtooth', level: .056, position: p });
        this._tone({ from: 980, to: 220, duration: .24, wave: 'triangle', level: .028, position: p });
      } else {
        this._tone({ from: 220, to: 58, duration: .42, wave: 'sawtooth', level: .060, position: p });
        this._noise({ duration: .24, level: .052, lowpass: 1700, position: p });
      }
    } else if (type === 'enemydeath') {
      if (kind === 2) {
        this._tone({ from: 74, to: 21, duration: .72, wave: 'triangle', level: .078, position: p });
        this._noise({ duration: .42, level: .068, lowpass: 900, position: p });
      } else if (kind === 1) {
        this._tone({ from: 360, to: 48, duration: .55, wave: 'sawtooth', level: .060, position: p });
        this._tone({ from: 1040, to: 220, duration: .32, wave: 'triangle', level: .036, position: p });
      } else {
        this._tone({ from: 156, to: 30, duration: .52, wave: 'sawtooth', level: .064, position: p });
        this._noise({ duration: .36, level: .052, lowpass: 1300, position: p });
      }
    } else if (type === 'enemyjump') {
      this._tone({ from: kind === 1 ? 260 : 100, to: kind === 2 ? 270 : 460, duration: .24, wave: 'triangle', level: .046, position: p });
    } else if (type === 'enemyland') {
      this._tone({ from: kind === 2 ? 72 : 96, to: 24, duration: .30, wave: 'sine', level: .066, position: p });
      this._noise({ duration: .17, level: .042, lowpass: kind === 2 ? 1100 : 1900, position: p });
    }
    return true;
  }
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const source of this._sources) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }
    this._sources.clear();
    this._ambientNodes.clear();
    this._ambientSource = null;
    this._musicSource = null;
    this._musicGain = null;
    this._musicKey = '';
    for (const gain of this._groups.values()) {
      try { gain.disconnect(); } catch {}
    }
    this._groups.clear();
    this._voices.clear();
    if (this._limiter) { try { this._limiter.disconnect(); } catch {} }
    if (this._ctx) this._ctx.close().catch(() => {});
    this._ctx = null;
    this._master = null;
    this._limiter = null;
  }

  _applyMasterGain() {
    if (!this._master || !this._ctx) return;
    const t=now(this._ctx);this._master.gain.cancelScheduledValues(t);
    if(this._muted||this._volume===0)this._master.gain.setValueAtTime(0,t);
    else this._master.gain.setTargetAtTime(this._volume,t,.015);
  }

  _group(name = 'sfx') {
    return this._groups.get(name) || this._master || this._ctx.destination;
  }

  _resolveUrl(path) {
    try { return new URL(path, this.baseUrl).href; } catch { return path; }
  }

  _manifestEntries(type, value) {
    if (type === 'shot' && Array.isArray(value) && value.some(entry => Array.isArray(entry))) {
      return value.flatMap((entry, weapon) => list(entry).map((path, variant) => ({
        key: 'shot:' + weapon + ':' + variant, path,
      })));
    }
    return list(value).map((path, variant) => ({ key: type + ':' + variant, path }));
  }

  async _loadAssets() {
    if (!this._ctx || typeof fetch !== 'function') return;
    this._loadErrors.length = 0;
    this._assetCount = 0;
    const jobs = [];
    for (const [type, value] of Object.entries(this.manifest || {})) {
      for (const entry of this._manifestEntries(type, value)) {
        if (!entry.path || typeof entry.path !== 'string') continue;
        this._assetCount++;
        jobs.push((async () => {
          try {
            const response = await fetch(this._resolveUrl(entry.path), { cache: 'force-cache' });
            if (!response.ok) throw new Error('audio asset ' + response.status);
            const data = await response.arrayBuffer();
            const buffer = await this._ctx.decodeAudioData(data);
            this._buffers.set(entry.key, buffer);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this._loadErrors.push({ key: entry.key, path: entry.path, message });
          }
        })());
      }
    }
    await Promise.all(jobs);
    this._loaded = true;
  }

  _chooseBuffer(name, weapon = 0, variant) {
    const keys = [];
    if (name === 'shot') {
      const prefix = 'shot:' + Math.max(0, weapon) + ':';
      for (const key of this._buffers.keys()) if (key.startsWith(prefix)) keys.push(key);
      if (!keys.length && weapon !== 0) {
        for (const key of this._buffers.keys()) if (key.startsWith('shot:0:')) keys.push(key);
      }
    } else {
      for (const key of this._buffers.keys()) if (key.startsWith(name + ':')) keys.push(key);
    }
    if (!keys.length) return null;
    keys.sort();
    const poolKey = name + ':' + Math.max(0, weapon);
    let index = Number.isFinite(Number(variant))
      ? Math.abs(Math.floor(Number(variant))) % keys.length
      : Math.floor(Math.random() * keys.length);
    const previous = this._lastVariant.get(poolKey);
    if (!Number.isFinite(Number(variant)) && keys.length > 1 && index === previous) index = (index + 1) % keys.length;
    this._lastVariant.set(poolKey, index);
    return this._buffers.get(keys[index]) || null;
  }

  _createSpatialNode(details) {
    const position = details.position;
    if (!position || !this._ctx || typeof this._ctx.createPanner !== 'function') return null;
    const panner = this._ctx.createPanner();
    panner.panningModel = details.panningModel || 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = Number(details.refDistance ?? 1.2);
    panner.maxDistance = Number(details.maxDistance ?? 28);
    panner.rolloffFactor = Number(details.rolloffFactor ?? 1.1);
    const set = (key, value) => {
      const target = panner[key];
      if (target && typeof target.setValueAtTime === 'function') target.setValueAtTime(Number(value) || 0, now(this._ctx));
      else if (target) target[key] = Number(value) || 0;
    };
    set('positionX', position.x);
    set('positionY', position.y ?? position.z);
    set('positionZ', position.z ?? position.y);
    return panner;
  }

  _trimVoices(type, limit = 10) {
    const voices = this._voices.get(type);
    if (!voices || !limit) return;
    while (voices.size >= limit) {
      const oldest = voices.values().next().value;
      if (!oldest) break;
      try { oldest.stop(); } catch {}
      this._sources.delete(oldest);
      voices.delete(oldest);
    }
  }

  _filterNode(input, profile) {
    let node = input;
    if (profile.highpass) {
      const highpass = this._ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = profile.highpass;
      highpass.Q.value = .55;
      node.connect(highpass);
      node = highpass;
    }
    if (profile.lowpass) {
      const lowpass = this._ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = profile.lowpass;
      lowpass.Q.value = .5;
      node.connect(lowpass);
      node = lowpass;
    }
    return node;
  }

  _playBuffer(buffer, type, weapon = 0, details = {}) {
    const profile = { ...resolveMix(type, weapon), ...details };
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    const group = profile.group || GROUP_BY_TYPE[type] || 'sfx';
    const level = clamp(profile.volume ?? .38, 0, 1);
    const maxVoices = Math.max(1, Math.floor(Number(profile.maxVoices) || 10));
    if (type !== 'ambience') this._trimVoices(type, maxVoices);
    source.buffer = buffer;
    const rateMin = type === 'footstep' ? .93 : .97;
    const rateMax = type === 'footstep' ? 1.07 : 1.03;
    source.playbackRate.value = clamp(profile.rate ?? random(rateMin, rateMax), 0.5, 2);
    if (profile.detune !== undefined) source.detune.value = Number(profile.detune) || 0;
    gain.gain.setValueAtTime(level, now(this._ctx));
    source.connect(gain);
    let node = this._filterNode(gain, profile);
    const spatial = this._createSpatialNode(profile);
    if (spatial) node.connect(spatial).connect(this._group(group));
    else node.connect(this._group(group));
    source.loop = type === 'ambience' || Boolean(profile.loop);
    if (source.loop && type === 'ambience') {
      this._stopAmbient();
      this._ambientSource = source;
    }
    this._track(source, source.loop, type);
    source.start();
    return source;
  }

  _playAmbience(details = {}) {
    if (this._ambientSource) return true;
    const buffer = this._chooseBuffer('ambience', 0, details.variant);
    if (buffer) {
      this._playBuffer(buffer, 'ambience', 0, { ...details, group: 'ambience', loop: true, volume: details.volume ?? .32 });
      return true;
    }
    return this._synthAmbience();
  }

  _syncScene() {
    if (!this._ctx || this._ctx.state === 'closed' || this._paused || this._musicScene === 'pause') return false;
    const scene = MUSIC_SCENES[this._musicScene] || MUSIC_SCENES.menu;
    if (this._musicScene === 'play') this._playAmbience();
    else this._stopAmbient();
    return this._playMusic(scene.key, scene);
  }

  _playMusic(key, details = {}) {
    const buffer = this._chooseBuffer(key, 0, details.variant);
    if (!buffer || !this._ctx) return false;
    const target = clamp(details.volume ?? .12, 0, .35);
    if (this._musicSource && this._musicKey === key) {
      this._fadeMusic(target, .28);
      if (details.rate !== undefined) this._musicSource.playbackRate.setTargetAtTime(clamp(details.rate, .5, 2), now(this._ctx), .12);
      return true;
    }
    const t = now(this._ctx);
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = clamp(details.rate ?? 1, .5, 2);
    gain.gain.setValueAtTime(.0001, t);
    const profile = { highpass: 28, lowpass: 9000 };
    source.connect(gain);
    this._filterNode(gain, profile).connect(this._group('music'));
    source.start(t);
    this._track(source, true, 'music');
    const previous = this._musicSource;
    const previousGain = this._musicGain;
    if (previous && previousGain) {
      const oldGain = previousGain.gain;
      oldGain.cancelScheduledValues(t);
      oldGain.setTargetAtTime(.0001, t, .20);
      try { previous.stop(t + .75); } catch {}
    }
    this._musicSource = source;
    this._musicGain = gain;
    this._musicKey = key;
    source.addEventListener?.('ended', () => {
      if (this._musicSource !== source) return;
      this._musicSource = null;
      this._musicGain = null;
      this._musicKey = '';
    });
    gain.gain.setTargetAtTime(target, t, .32);
    return true;
  }

  _fadeMusic(target, time = .2) {
    if (!this._musicGain || !this._ctx) return false;
    const t = now(this._ctx);
    const value = Math.max(.0001, Number(target) || 0);
    this._musicGain.gain.cancelScheduledValues(t);
    this._musicGain.gain.setTargetAtTime(value, t, Math.max(.02, Number(time) || .2));
    return true;
  }

  _track(source, persistent = false, type = '') {
    this._sources.add(source);
    let voices = null;
    if (type) {
      voices = this._voices.get(type);
      if (!voices) { voices = new Set(); this._voices.set(type, voices); }
      voices.add(source);
    }
    const cleanup = () => {
      this._sources.delete(source);
      voices?.delete(source);
    };
    source.addEventListener?.('ended', cleanup);
    if (!persistent && !source.addEventListener) source.onended = cleanup;
  }

  _stopAmbient() {
    if (this._ambientSource) {
      try { this._ambientSource.stop(); } catch {}
      this._sources.delete(this._ambientSource);
      this._voices.get('ambience')?.delete(this._ambientSource);
      try { this._ambientSource.disconnect(); } catch {}
      this._ambientSource = null;
    }
    for (const node of this._ambientNodes) {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    }
    this._ambientNodes.clear();
  }

  _noiseBuffer(seconds) {
    const key = Math.round(seconds * 10) / 10;
    if (this._noiseBuffers.has(key)) return this._noiseBuffers.get(key);
    const length = Math.max(1, Math.floor(this._ctx.sampleRate * key));
    const buffer = this._ctx.createBuffer(1, length, this._ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this._noiseBuffers.set(key, buffer);
    return buffer;
  }

  _tone({ from, to = from, duration = 0.2, wave = 'sine', level = 0.25, group = 'sfx', detune = 0, position }) {
    const t = now(this._ctx);
    const oscillator = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(1, from), t);
    if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    oscillator.detune.value = detune;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const spatial = this._createSpatialNode({ position });
    oscillator.connect(gain);
    if (spatial) gain.connect(spatial).connect(this._group(group)); else gain.connect(this._group(group));
    this._track(oscillator);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.03);
    return oscillator;
  }

  _noise({ duration = 0.12, level = 0.25, highpass = 0, lowpass = 0, group = 'sfx', position }) {
    const t = now(this._ctx);
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    source.buffer = this._noiseBuffer(duration);
    gain.gain.setValueAtTime(Math.max(0.0001, level), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let node = source;
    if (highpass) {
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = highpass; node.connect(filter); node = filter;
    }
    if (lowpass) {
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = lowpass; node.connect(filter); node = filter;
    }
    const spatial = this._createSpatialNode({ position });
    node.connect(gain);
    if (spatial) gain.connect(spatial).connect(this._group(group)); else gain.connect(this._group(group));
    this._track(source);
    source.start(t);
    source.stop(t + duration + 0.03);
    return source;
  }

  _synth(type, weapon = 0, details = {}) {
    if (!this._ctx) return false;
    const w = Math.max(0, Math.floor(Number(weapon) || 0));
    const p = details.position;
    switch (type) {
      case 'footstep':
        this._tone({ from: 82, to: 39, duration: .09, wave: 'triangle', level: .045, position: p });
        this._noise({ duration: .065, level: .05, highpass: 240, lowpass: 1800, position: p }); return true;
      case 'heartbeat': this._tone({ from: 62, to: 38, duration: .16, wave: 'sine', level: .08 }); return true;
      case 'shot':
        if (w === 1) {
          this._tone({ from: 58, to: 32, duration: .24, wave: 'triangle', level: .152, position: p });
          this._noise({ duration: .2, level: .125, highpass: 600, lowpass: 8500, position: p });
          this._tone({ from: 920, to: 160, duration: .12, wave: 'square', level: .09, position: p });
        } else if (w === 2) {
          this._tone({ from: 340, to: 52, duration: .42, wave: 'sawtooth', level: .120, position: p });
          this._noise({ duration: .32, level: .125, highpass: 900, lowpass: 7600, position: p });
          this._tone({ from: 1180, to: 180, duration: .3, wave: 'square', level: .05, position: p });
        } else if (w === 3) {
          this._tone({ from: 76, to: 24, duration: .42, wave: 'sine', level: .118, position: p });
          this._tone({ from: 240, to: 68, duration: .30, wave: 'triangle', level: .062, position: p });
          this._noise({ duration: .32, level: .12, highpass: 110, lowpass: 1450, position: p });
        } else {
          this._tone({ from: 112, to: 44, duration: .18, wave: 'triangle', level: .155, position: p });
          this._noise({ duration: .12, level: .24, highpass: 1100, lowpass: 11000, position: p });
        }
        return true;
      case 'rocket':
      case 'explosion':
        this._tone({ from: 72, to: 22, duration: .55, wave: 'sine', level: .152, position: p });
        this._noise({ duration: .48, level: .24, lowpass: 1900, position: p });
        this._tone({ from: 180, to: 38, duration: .8, wave: 'triangle', level: .09, position: p }); return true;
      case 'bulletcrackle': this._noise({ duration: .18, level: .15, highpass: 1600, lowpass: 8000, position: p }); return true;
      case 'hit':
      case 'impact':
        this._tone({ from: 180, to: 72, duration: .16, wave: 'square', level: .14, position: p });
        this._noise({ duration: .18, level: .14, highpass: 260, lowpass: 4200, position: p }); return true;
      case 'parry':
        this._tone({ from: 760, to: 2200, duration: .2, wave: 'sine', level: .120 });
        this._tone({ from: 1520, to: 3400, duration: .12, wave: 'triangle', level: .10, detune: 7 }); return true;
      case 'slide':
        this._noise({duration:.38,level:.1,highpass:130,lowpass:2300,position:p});
        this._tone({from:84,to:38,duration:.25,wave:'triangle',level:.055,position:p});return true;
      case 'dash':
        this._tone({ from: 75, to: 520, duration: .26, wave: 'sawtooth', level: .10 });
        this._noise({ duration: .3, level: .14, highpass: 500, lowpass: 4800 }); return true;
      case 'blood':
        this._tone({ from: 112, to: 48, duration: .3, wave: 'sine', level: .12, position: p });
        this._noise({ duration: .42, level: .14, lowpass: 1200, position: p }); return true;
      case 'damage': this._tone({ from: 260, to: 86, duration: .22, wave: 'sawtooth', level: .12 }); return true;
      case 'punch':
        this._tone({ from: 95, to: 38, duration: .14, wave: 'triangle', level: .14, position: p });
        this._noise({ duration: .11, level: .12, highpass: 500, lowpass: 3500, position: p }); return true;
      case 'jump': this._tone({ from: 170, to: 420, duration: .22, wave: 'triangle', level: .05 }); return true;
      case 'land':
        this._tone({ from: 72, to: 30, duration: .3, wave: 'sine', level: .15, position: p });
        this._noise({ duration: .22, level: .14, lowpass: 1600, position: p }); return true;
      case 'enemyattack':
      case 'moan':
        this._tone({ from: 190, to: 70, duration: .55, wave: 'sawtooth', level: .10, position: p });
        this._noise({ duration: .35, level: .11, lowpass: 1450, position: p }); return true;
      case 'enemydeath':
        this._tone({ from: 150, to: 26, duration: .62, wave: 'sawtooth', level: .12, position: p });
        this._noise({ duration: .56, level: .15, lowpass: 1200, position: p }); return true;
      case 'enemyjump': this._tone({ from: 90, to: 320, duration: .3, wave: 'triangle', level: .11, position: p }); return true;
      case 'enemyland': this._tone({ from: 80, to: 24, duration: .3, wave: 'sine', level: .15, position: p }); return true;
      case 'coin':
        this._tone({ from: 1120, to: 1820, duration: .12, wave: 'sine', level: .11 });
        this._tone({ from: 1680, to: 2460, duration: .2, wave: 'sine', level: .1 }); return true;
      case 'ui':
      case 'confirm': this._tone({ from: 520, to: 880, duration: .1, wave: 'triangle', level: .1, group: 'ui' }); return true;
      case 'cancel':
      case 'fail': this._tone({ from: 240, to: 110, duration: .16, wave: 'square', level: .1, group: 'ui' }); return true;
      case 'wave': this._tone({ from: 68, to: 140, duration: .65, wave: 'sawtooth', level: .10 }); return true;
      case 'win':
        this._tone({ from: 220, to: 440, duration: .26, wave: 'triangle', level: .10 });
        this._tone({ from: 330, to: 660, duration: .36, wave: 'sine', level: .08 }); return true;
      default: this._tone({ from: 180, to: 90, duration: .12, wave: 'triangle', level: .05 }); return true;
    }
  }

  _synthAmbience() {
    if (this._ambientSource || !this._ctx) return true;
    const source = this._ctx.createBufferSource();
    const filter = this._ctx.createBiquadFilter();
    const gain = this._ctx.createGain();
    source.buffer = this._noiseBuffer(8);
    source.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = 560;
    gain.gain.value = .08;
    source.connect(filter).connect(gain).connect(this._group('ambience'));
    source.start(); this._ambientSource = source; this._track(source, true);
    this._ambientNodes.add(filter); this._ambientNodes.add(gain);
    const hum = this._ctx.createOscillator(); const humGain = this._ctx.createGain();
    hum.type = 'sine'; hum.frequency.value = 47; humGain.gain.value = .055;
    hum.connect(humGain).connect(this._group('ambience')); hum.start();
    this._ambientNodes.add(hum); this._ambientNodes.add(humGain);
    return true;
  }
}

export default AudioSystem;
