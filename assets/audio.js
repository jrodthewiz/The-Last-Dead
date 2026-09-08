/*
 * Dead Arrival audio runtime.
 *
 * The provider files are optional.  When they are present they are loaded on
 * the first user gesture; when they are missing (the normal offline/dev
 * case), the same gameplay calls fall back to a small Web Audio synthesizer.
 * The constructor never resumes the AudioContext and never starts ambience,
 * so a menu can be silent until the player explicitly clicks/taps to play.
 */

export const AUDIO_ASSET_MANIFEST = Object.freeze({
  ambience: './audio/ambience/bloodworks-loop.mp3',
  shot: [
    './audio/sfx/weapon-hand-cannon.mp3',
    './audio/sfx/weapon-breach-shotgun.mp3',
    './audio/sfx/weapon-arc-lance.mp3',
  ],
  hit: './audio/sfx/hit-metal-flesh.mp3',
  parry: './audio/sfx/parry-impact.mp3',
  dash: './audio/sfx/dash-burst.mp3',
  blood: './audio/sfx/blood-burst.mp3',
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const now = context => context?.currentTime ?? 0;

function audioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function asList(value) {
  return Array.isArray(value) ? value : [value];
}

/**
 * Small browser audio manager for combat, movement and ambience.
 *
 * `unlock()` should be called from a user gesture (pointerdown/key press).
 * `play()` is intentionally a no-op before unlock, which keeps autoplay
 * policy and the silent title screen predictable.
 */
export class AudioSystem {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || import.meta.url;
    // Provider files are opt-in. The first playable build has no MP3s because
    // generation was blocked by missing provider keys, so default unlock must
    // not issue 404 fetches or add console noise. Pass { providerAssets: true }
    // (or a custom manifest) when generated files are actually present.
    const providerManifest = options.providerAssets === true
      ? AUDIO_ASSET_MANIFEST
      : (options.providerAssets && typeof options.providerAssets === 'object' ? options.providerAssets : null);
    this.manifest = options.manifest || providerManifest || {};
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
    this._disposed = false;
  }

  get context() {
    return this._ctx;
  }

  get isUnlocked() {
    return Boolean(this._ctx && this._ctx.state === 'running');
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
        for (const name of ['sfx', 'ui', 'ambience', 'voice', 'music']) {
          const gain = this._ctx.createGain();
          gain.gain.value = name === 'ambience' ? 0.65 : 1;
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

  pause() {
    this._paused = true;
    if (this._ctx && this._ctx.state === 'running') this._ctx.suspend().catch(() => {});
  }

  async resume() {
    this._paused = false;
    if (this._ctx && !this._muted && this._ctx.state !== 'running') {
      try { await this._ctx.resume(); } catch { /* browser can reject after tab close */ }
    }
    return this.isUnlocked;
  }

  /**
   * Play a named event. `weapon` is the engine weapon index for `shot`.
   * Returns false before unlock and true once a buffer or fallback is queued.
   */
  play(type, weapon = 0) {
    if (this._disposed || !this._ctx || this._paused || this._ctx.state === 'closed') return false;
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'ambience' || normalized === 'ambient') {
      return this._playAmbience();
    }

    const key = normalized === 'shot' || normalized === 'fire' || normalized === 'weapon'
      ? `shot:${Math.max(0, Math.floor(Number(weapon) || 0))}`
      : normalized;
    const buffer = this._buffers.get(key);
    if (buffer) {
      this._playBuffer(buffer, normalized, normalized === 'shot' ? 0.9 : 0.8);
      return true;
    }
    return this._synth(normalized, weapon);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const source of this._sources) {
      try { source.stop(); } catch { /* source may already have ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    this._sources.clear();
    this._ambientNodes.clear();
    this._ambientSource = null;
    for (const gain of this._groups.values()) {
      try { gain.disconnect(); } catch { /* already disconnected */ }
    }
    this._groups.clear();
    if (this._ctx) this._ctx.close().catch(() => {});
    this._ctx = null;
    this._master = null;
  }

  _applyMasterGain() {
    if (!this._master || !this._ctx) return;
    const value = this._muted ? 0 : this._volume;
    this._master.gain.setTargetAtTime(value, now(this._ctx), 0.015);
  }

  _group(name = 'sfx') {
    return this._groups.get(name) || this._master || this._ctx.destination;
  }

  _resolveUrl(path) {
    try { return new URL(path, this.baseUrl).href; } catch { return path; }
  }

  async _loadAssets() {
    if (!this._ctx || typeof fetch !== 'function') return;
    const jobs = [];
    for (const [type, entries] of Object.entries(this.manifest)) {
      for (const [index, path] of asList(entries).entries()) {
        if (!path) continue;
        const key = type === 'shot' ? `shot:${index}` : type;
        jobs.push((async () => {
          try {
            const response = await fetch(this._resolveUrl(path));
            if (!response.ok) throw new Error(`audio asset ${response.status}`);
            const data = await response.arrayBuffer();
            const buffer = await this._ctx.decodeAudioData(data);
            this._buffers.set(key, buffer);
          } catch {
            // Missing/generated files are expected in offline builds. The
            // corresponding event will use `_synth` instead.
          }
        })());
      }
    }
    await Promise.all(jobs);
  }

  _playBuffer(buffer, type, level = 1) {
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = level;
    source.connect(gain).connect(type === 'ambience' ? this._group('ambience') : this._group('sfx'));
    source.loop = type === 'ambience';
    if (source.loop) {
      this._stopAmbient();
      this._ambientSource = source;
    }
    this._track(source, source.loop);
    source.start();
    return source;
  }

  _playAmbience() {
    if (this._ambientSource) return true;
    const buffer = this._buffers.get('ambience');
    if (buffer) {
      this._playBuffer(buffer, 'ambience', 0.7);
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
      try { this._ambientSource.stop(); } catch { /* already stopped */ }
      this._sources.delete(this._ambientSource);
      try { this._ambientSource.disconnect(); } catch { /* already disconnected */ }
      this._ambientSource = null;
    }
    for (const node of this._ambientNodes) {
      try { node.stop?.(); } catch { /* already stopped */ }
      try { node.disconnect?.(); } catch { /* already disconnected */ }
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

  _tone({ from, to = from, duration = 0.2, wave = 'sine', level = 0.25, group = 'sfx', detune = 0 }) {
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
    oscillator.connect(gain).connect(this._group(group));
    this._track(oscillator);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.03);
    return oscillator;
  }

  _noise({ duration = 0.12, level = 0.25, highpass = 0, lowpass = 0, group = 'sfx' }) {
    const t = now(this._ctx);
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    source.buffer = this._noiseBuffer(duration);
    gain.gain.setValueAtTime(Math.max(0.0001, level), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    let node = source;
    if (highpass) {
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      node.connect(filter);
      node = filter;
    }
    if (lowpass) {
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      node.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(this._group(group));
    this._track(source);
    source.start(t);
    source.stop(t + duration + 0.03);
    return source;
  }

  _synth(type, weapon = 0) {
    if (!this._ctx) return false;
    const w = Math.max(0, Math.floor(Number(weapon) || 0));
    switch (type) {
      case 'footstep':
        this._tone({from:82,to:39,duration:.09,wave:'triangle',level:.075});
        this._noise({duration:.065,level:.08,highpass:240,lowpass:1800});
        return true;
      case 'heartbeat':
        this._tone({from:62,to:38,duration:.16,wave:'sine',level:.13});
        return true;
      case 'shot':
      case 'fire':
      case 'weapon':
        if (w === 1) {
          this._tone({ from: 58, to: 32, duration: 0.24, wave: 'triangle', level: 0.42 });
          this._noise({ duration: 0.2, level: 0.58, highpass: 600, lowpass: 8500 });
          this._tone({ from: 920, to: 160, duration: 0.12, wave: 'square', level: 0.12 });
        } else if (w === 2) {
          this._tone({ from: 340, to: 52, duration: 0.42, wave: 'sawtooth', level: 0.28 });
          this._noise({ duration: 0.32, level: 0.36, highpass: 900, lowpass: 7600 });
          this._tone({ from: 1180, to: 180, duration: 0.3, wave: 'square', level: 0.11 });
        } else {
          this._tone({ from: 112, to: 44, duration: 0.18, wave: 'triangle', level: 0.45 });
          this._noise({ duration: 0.12, level: 0.38, highpass: 1100, lowpass: 11000 });
        }
        return true;
      case 'hit':
      case 'impact':
        this._tone({ from: 180, to: 72, duration: 0.16, wave: 'square', level: 0.22 });
        this._noise({ duration: 0.18, level: 0.24, highpass: 260, lowpass: 4200 });
        return true;
      case 'parry':
        this._tone({ from: 760, to: 2_200, duration: 0.2, wave: 'sine', level: 0.28 });
        this._tone({ from: 1_520, to: 3_400, duration: 0.12, wave: 'triangle', level: 0.16, detune: 7 });
        return true;
      case 'dash':
      case 'boost':
        this._tone({ from: 75, to: 520, duration: 0.26, wave: 'sawtooth', level: 0.16 });
        this._noise({ duration: 0.3, level: 0.24, highpass: 500, lowpass: 4_800 });
        return true;
      case 'blood':
      case 'kill':
      case 'gore':
        this._tone({ from: 112, to: 48, duration: 0.3, wave: 'sine', level: 0.2 });
        this._noise({ duration: 0.42, level: 0.23, lowpass: 1_200 });
        return true;
      case 'damage':
        this._tone({ from: 260, to: 86, duration: 0.22, wave: 'sawtooth', level: 0.2 });
        return true;
      case 'punch':
        this._tone({ from: 95, to: 38, duration: 0.14, wave: 'triangle', level: 0.34 });
        this._noise({ duration: 0.11, level: 0.2, highpass: 500, lowpass: 3_500 });
        return true;
      case 'jump':
        this._tone({ from: 170, to: 420, duration: 0.22, wave: 'triangle', level: 0.11 });
        return true;
      case 'land':
      case 'slam':
        this._tone({ from: 72, to: 30, duration: 0.3, wave: 'sine', level: 0.4 });
        this._noise({ duration: 0.22, level: 0.24, lowpass: 1_600 });
        return true;
      case 'coin':
        this._tone({ from: 1_120, to: 1_820, duration: 0.12, wave: 'sine', level: 0.17 });
        this._tone({ from: 1_680, to: 2_460, duration: 0.2, wave: 'sine', level: 0.1 });
        return true;
      case 'wave':
        this._tone({ from: 68, to: 140, duration: 0.65, wave: 'sawtooth', level: 0.16 });
        return true;
      case 'win':
        this._tone({ from: 220, to: 440, duration: 0.26, wave: 'triangle', level: 0.16 });
        this._tone({ from: 330, to: 660, duration: 0.36, wave: 'sine', level: 0.13 });
        return true;
      case 'dead':
        this._tone({ from: 120, to: 32, duration: 0.55, wave: 'sawtooth', level: 0.18 });
        return true;
      default:
        this._tone({ from: 180, to: 90, duration: 0.12, wave: 'triangle', level: 0.08 });
        return true;
    }
  }

  _synthAmbience() {
    if (this._ambientSource || !this._ctx) return true;
    const source = this._ctx.createBufferSource();
    const filter = this._ctx.createBiquadFilter();
    const gain = this._ctx.createGain();
    source.buffer = this._noiseBuffer(8);
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 560;
    gain.gain.value = 0.08;
    source.connect(filter).connect(gain).connect(this._group('ambience'));
    source.start();
    this._ambientSource = source;
    this._track(source, true);
    this._ambientNodes.add(filter);
    this._ambientNodes.add(gain);

    const hum = this._ctx.createOscillator();
    const humGain = this._ctx.createGain();
    hum.type = 'sine';
    hum.frequency.value = 47;
    humGain.gain.value = 0.055;
    hum.connect(humGain).connect(this._group('ambience'));
    hum.start();
    this._ambientNodes.add(hum);
    this._ambientNodes.add(humGain);
    return true;
  }
}

export default AudioSystem;
