/*
 * The Last Dead audio runtime.
 * Bundled samples are CC0 and live under ./audio. Every event also has a
 * procedural fallback so the game stays playable when a browser cannot decode
 * a file or the asset is unavailable.
 */
export const AUDIO_ASSET_MANIFEST = Object.freeze({
  ambience: ['./audio/ambience/ossuary-dungeon.ogg'],
  shot: [
    ['./audio/sfx/cc0-gunshot.mp3', './audio/sfx/cc0-gunshot-heavy.wav'],
    ['./audio/sfx/cc0-gunshot-heavy.wav', './audio/sfx/cc0-explosion.mp3'],
    ['./audio/sfx/cc0-bullet-crackle.wav', './audio/sfx/cc0-gunshot.mp3'],
  ],
  hit: ['./audio/sfx/cc0-bullet-hit.wav', './audio/sfx/cc0-splat-hit.wav'],
  blood: ['./audio/sfx/cc0-splat-hit.wav', './audio/sfx/cc0-bullet-hit.wav'],
  explosion: ['./audio/sfx/cc0-explosion.mp3', './audio/sfx/cc0-dull-explosion.wav'],
  rocket: ['./audio/sfx/cc0-explosion-distant.mp3', './audio/sfx/cc0-dull-explosion.wav'],
  bulletcrackle: ['./audio/sfx/cc0-bullet-crackle.wav'],
  footstep: [
    './audio/movement/footstep-01.ogg', './audio/movement/footstep-02.ogg',
    './audio/movement/footstep-03.ogg', './audio/movement/footstep-04.ogg',
    './audio/movement/footstep-05.ogg', './audio/movement/footstep-06.ogg',
  ],
  jump: ['./audio/movement/jump-land.mp3'],
  land: ['./audio/movement/jump-land.mp3', './audio/enemy/enemy-land.wav'],
  enemyattack: ['./audio/enemy/enemy-scream.wav', './audio/enemy/enemy-moan.wav'],
  enemyjump: ['./audio/enemy/enemy-jump.wav'],
  enemyland: ['./audio/enemy/enemy-land.wav'],
  enemydeath: ['./audio/enemy/enemy-death-01.wav', './audio/enemy/enemy-death-02.wav'],
  moan: ['./audio/enemy/enemy-moan.wav'],
  ui: ['./audio/ui/ui-button.mp3'],
  coin: ['./audio/ui/coin-01.mp3', './audio/ui/coin-02.mp3'],
});

const GROUPS = ['sfx', 'ui', 'ambience', 'voice', 'music'];
const GROUP_BY_TYPE = Object.freeze({
  ambience: 'ambience', ambient: 'ambience', voice: 'voice',
  ui: 'ui', confirm: 'ui', cancel: 'ui', pause: 'ui', fail: 'ui',
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const now = context => context?.currentTime ?? 0;
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
    kill: 'enemydeath', dead: 'enemydeath', death: 'enemydeath',
    'enemy-attack': 'enemyattack', attack: 'enemyattack',
    'enemy-death': 'enemydeath', enemydeath: 'enemydeath',
    ambient: 'ambience', boost: 'dash', slam: 'land',
    'rocket-launch': 'rocket', rocketfire: 'rocket',
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
    this._groups = new Map();
    this._buffers = new Map();
    this._noiseBuffers = new Map();
    this._sources = new Set();
    this._ambientNodes = new Set();
    this._ambientSource = null;
    this._loadPromise = null;
    this._assetCount = 0;
    this._loadErrors = [];
    this._loaded = false;
    this._disposed = false;
    this._lastPlay = new Map();
  }

  get context() { return this._ctx; }
  get isUnlocked() { return Boolean(this._ctx && this._ctx.state === 'running'); }
  get assetsLoaded() { return this._loaded; }
  get assetCount() { return this._assetCount; }
  get loadErrors() { return this._loadErrors.slice(); }
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
        this._master.connect(this._ctx.destination);
        this._groups.set('master', this._master);
        for (const name of GROUPS) {
          const gain = this._ctx.createGain();
          gain.gain.value = name === 'ambience' ? 0.62 : name === 'voice' ? 0.9 : 1;
          gain.connect(this._master);
          this._groups.set(name, gain);
        }
        this._applyMasterGain();
      } catch {
        this._ctx = null;
        this._master = null;
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
    if (this._ctx && this._ctx.state === 'running') this._ctx.suspend().catch(() => {});
  }

  async resume() {
    this._paused = false;
    if (this._ctx && !this._muted && this._ctx.state !== 'running') {
      try { await this._ctx.resume(); } catch {}
    }
    return this.isUnlocked;
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
    if (this._disposed || !this._ctx || this._paused || this._ctx.state === 'closed') return false;
    const parsed = normalizeEvent(type, weapon, event);
    const name = parsed.name;
    const index = parsed.weapon;
    const details = parsed.details;
    if (name === 'ambience') return this._playAmbience(details);
    const cooldown = Number(details.cooldown ?? 0);
    if (cooldown > 0) {
      const key = name + ':' + index + ':' + String(details.id ?? '');
      const time = globalThis.performance?.now?.() ?? Date.now();
      if (time - (this._lastPlay.get(key) || -Infinity) < cooldown * 1000) return false;
      this._lastPlay.set(key, time);
    }
    const buffer = this._chooseBuffer(name, index, details.variant);
    if (buffer) {
      this._playBuffer(buffer, name, details);
      return true;
    }
    return this._synth(name, index, details);
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
    for (const gain of this._groups.values()) {
      try { gain.disconnect(); } catch {}
    }
    this._groups.clear();
    if (this._ctx) this._ctx.close().catch(() => {});
    this._ctx = null;
    this._master = null;
  }

  _applyMasterGain() {
    if (!this._master || !this._ctx) return;
    this._master.gain.setTargetAtTime(this._muted ? 0 : this._volume, now(this._ctx), 0.015);
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
    const index = Number.isFinite(Number(variant))
      ? Math.abs(Math.floor(Number(variant))) % keys.length
      : Math.floor(Math.random() * keys.length);
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

  _playBuffer(buffer, type, details = {}) {
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    const group = details.group || GROUP_BY_TYPE[type] || 'sfx';
    const level = clamp(details.volume ?? (type === 'ambience' ? 0.76 : type === 'shot' ? 0.9 : 0.82), 0, 2);
    source.buffer = buffer;
    source.playbackRate.value = clamp(details.rate ?? random(0.96, 1.04), 0.5, 2);
    if (details.detune !== undefined) source.detune.value = Number(details.detune) || 0;
    gain.gain.setValueAtTime(level, now(this._ctx));
    const spatial = this._createSpatialNode(details);
    if (spatial) source.connect(gain).connect(spatial).connect(this._group(group));
    else source.connect(gain).connect(this._group(group));
    source.loop = type === 'ambience' || Boolean(details.loop);
    if (source.loop && type === 'ambience') {
      this._stopAmbient();
      this._ambientSource = source;
    }
    this._track(source, source.loop);
    source.start();
    return source;
  }

  _playAmbience(details = {}) {
    if (this._ambientSource) return true;
    const buffer = this._chooseBuffer('ambience', 0, details.variant);
    if (buffer) {
      this._playBuffer(buffer, 'ambience', { ...details, group: 'ambience', loop: true });
      return true;
    }
    return this._synthAmbience();
  }

  _track(source, persistent = false) {
    this._sources.add(source);
    if (!persistent) source.addEventListener?.('ended', () => this._sources.delete(source));
  }

  _stopAmbient() {
    if (this._ambientSource) {
      try { this._ambientSource.stop(); } catch {}
      this._sources.delete(this._ambientSource);
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
        this._tone({ from: 82, to: 39, duration: .09, wave: 'triangle', level: .075, position: p });
        this._noise({ duration: .065, level: .08, highpass: 240, lowpass: 1800, position: p }); return true;
      case 'heartbeat': this._tone({ from: 62, to: 38, duration: .16, wave: 'sine', level: .13 }); return true;
      case 'shot':
        if (w === 1) {
          this._tone({ from: 58, to: 32, duration: .24, wave: 'triangle', level: .42, position: p });
          this._noise({ duration: .2, level: .58, highpass: 600, lowpass: 8500, position: p });
          this._tone({ from: 920, to: 160, duration: .12, wave: 'square', level: .12, position: p });
        } else if (w === 2) {
          this._tone({ from: 340, to: 52, duration: .42, wave: 'sawtooth', level: .28, position: p });
          this._noise({ duration: .32, level: .36, highpass: 900, lowpass: 7600, position: p });
          this._tone({ from: 1180, to: 180, duration: .3, wave: 'square', level: .11, position: p });
        } else {
          this._tone({ from: 112, to: 44, duration: .18, wave: 'triangle', level: .45, position: p });
          this._noise({ duration: .12, level: .38, highpass: 1100, lowpass: 11000, position: p });
        }
        return true;
      case 'rocket':
      case 'explosion':
        this._tone({ from: 72, to: 22, duration: .55, wave: 'sine', level: .42, position: p });
        this._noise({ duration: .48, level: .65, lowpass: 1900, position: p });
        this._tone({ from: 180, to: 38, duration: .8, wave: 'triangle', level: .18, position: p }); return true;
      case 'bulletcrackle': this._noise({ duration: .18, level: .25, highpass: 1600, lowpass: 8000, position: p }); return true;
      case 'hit':
      case 'impact':
        this._tone({ from: 180, to: 72, duration: .16, wave: 'square', level: .22, position: p });
        this._noise({ duration: .18, level: .24, highpass: 260, lowpass: 4200, position: p }); return true;
      case 'parry':
        this._tone({ from: 760, to: 2200, duration: .2, wave: 'sine', level: .28 });
        this._tone({ from: 1520, to: 3400, duration: .12, wave: 'triangle', level: .16, detune: 7 }); return true;
      case 'dash':
        this._tone({ from: 75, to: 520, duration: .26, wave: 'sawtooth', level: .16 });
        this._noise({ duration: .3, level: .24, highpass: 500, lowpass: 4800 }); return true;
      case 'blood':
        this._tone({ from: 112, to: 48, duration: .3, wave: 'sine', level: .2, position: p });
        this._noise({ duration: .42, level: .23, lowpass: 1200, position: p }); return true;
      case 'damage': this._tone({ from: 260, to: 86, duration: .22, wave: 'sawtooth', level: .2 }); return true;
      case 'punch':
        this._tone({ from: 95, to: 38, duration: .14, wave: 'triangle', level: .34, position: p });
        this._noise({ duration: .11, level: .2, highpass: 500, lowpass: 3500, position: p }); return true;
      case 'jump': this._tone({ from: 170, to: 420, duration: .22, wave: 'triangle', level: .11 }); return true;
      case 'land':
        this._tone({ from: 72, to: 30, duration: .3, wave: 'sine', level: .4, position: p });
        this._noise({ duration: .22, level: .24, lowpass: 1600, position: p }); return true;
      case 'enemyattack':
      case 'moan':
        this._tone({ from: 190, to: 70, duration: .55, wave: 'sawtooth', level: .16, position: p });
        this._noise({ duration: .35, level: .17, lowpass: 1450, position: p }); return true;
      case 'enemydeath':
        this._tone({ from: 150, to: 26, duration: .62, wave: 'sawtooth', level: .2, position: p });
        this._noise({ duration: .56, level: .25, lowpass: 1200, position: p }); return true;
      case 'enemyjump': this._tone({ from: 90, to: 320, duration: .3, wave: 'triangle', level: .17, position: p }); return true;
      case 'enemyland': this._tone({ from: 80, to: 24, duration: .3, wave: 'sine', level: .25, position: p }); return true;
      case 'coin':
        this._tone({ from: 1120, to: 1820, duration: .12, wave: 'sine', level: .17 });
        this._tone({ from: 1680, to: 2460, duration: .2, wave: 'sine', level: .1 }); return true;
      case 'ui':
      case 'confirm': this._tone({ from: 520, to: 880, duration: .1, wave: 'triangle', level: .1, group: 'ui' }); return true;
      case 'cancel':
      case 'fail': this._tone({ from: 240, to: 110, duration: .16, wave: 'square', level: .1, group: 'ui' }); return true;
      case 'wave': this._tone({ from: 68, to: 140, duration: .65, wave: 'sawtooth', level: .16 }); return true;
      case 'win':
        this._tone({ from: 220, to: 440, duration: .26, wave: 'triangle', level: .16 });
        this._tone({ from: 330, to: 660, duration: .36, wave: 'sine', level: .13 }); return true;
      default: this._tone({ from: 180, to: 90, duration: .12, wave: 'triangle', level: .08 }); return true;
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
