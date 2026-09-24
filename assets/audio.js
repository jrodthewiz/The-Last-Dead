/*
 * The Last Dead audio runtime.
 * Bundled, sourced samples live under ./audio. Missing or undecodable assets
 * stay silent instead of being replaced with generated oscillator audio.
 */
import { AUDIO_ASSET_MANIFEST } from './audio-manifest.js';
export { AUDIO_ASSET_MANIFEST };

const GROUPS = ['sfx', 'ui', 'ambience', 'voice', 'music'];
const GROUP_BASE_LEVELS = Object.freeze({ sfx: .68, ui: .42, ambience: .42, voice: .58, music: .45 });
const GROUP_VOLUME_DEFAULTS = Object.freeze({ sfx: 1, ui: 1, ambience: 1, voice: 1, music: 1 });
const GROUP_BY_TYPE = Object.freeze({
  ambience: 'ambience', ambient: 'ambience', voice: 'voice',
  enemyattack: 'voice', enemydeath: 'voice', moan: 'voice',
  hover: 'ui', toggle: 'ui', equip: 'ui', death: 'ui', win: 'ui', ui: 'ui', confirm: 'ui', cancel: 'ui', pause: 'ui', fail: 'ui',
});
const MIX_PROFILES = Object.freeze({
  default: { group: 'sfx', volume: .38, maxVoices: 10, highpass: 45, lowpass: 11000 },
  ambience: { group: 'ambience', volume: .32, maxVoices: 1, highpass: 38, lowpass: 5200 },
  shot: { group: 'sfx', volume: .45, maxVoices: 4, highpass: 70, lowpass: 9000, cooldown: .018 },
  mechanism: { group: 'sfx', volume: .10, maxVoices: 4, highpass: 700, lowpass: 7600, cooldown: .018 },
  'rifle-charge': { group: 'sfx', volume: .12, maxVoices: 1, highpass: 560, lowpass: 6200, cooldown: .35 },
  'bat-swing': { group: 'sfx', volume: .28, maxVoices: 4, highpass: 75, lowpass: 7800, cooldown: .045 },
  'melee-hit': { group: 'sfx', volume: .34, maxVoices: 6, highpass: 55, lowpass: 4600, cooldown: .035 },
  'melee-wall': { group: 'sfx', volume: .25, maxVoices: 4, highpass: 110, lowpass: 6200, cooldown: .12 },
  'chainsaw-start': { group: 'sfx', volume: .32, maxVoices: 1, highpass: 48, lowpass: 7600, cooldown: .12 },
  'chainsaw-motor': { group: 'sfx', volume: .23, maxVoices: 1, highpass: 42, lowpass: 7200 },
  'chainsaw-contact': { group: 'sfx', volume: .13, maxVoices: 1, highpass: 85, lowpass: 6500 },
  'chainsaw-hit': { group: 'sfx', volume: .30, maxVoices: 5, highpass: 65, lowpass: 5200, cooldown: .045 },
  'chainsaw-wall': { group: 'sfx', volume: .24, maxVoices: 4, highpass: 130, lowpass: 6800, cooldown: .065 },
  'chainsaw-stop': { group: 'sfx', volume: .21, maxVoices: 1, highpass: 45, lowpass: 6800, cooldown: .12 },
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
  enemyattack: { group: 'voice', volume: .34, maxVoices: 4, highpass: 100, lowpass: 4800, cooldown: .16, refDistance: 2.2, maxDistance: 34 },
  enemyjump: { group: 'sfx', volume: .24, maxVoices: 3, highpass: 80, lowpass: 4200, cooldown: .1, refDistance: 2, maxDistance: 30 },
  enemyland: { group: 'sfx', volume: .25, maxVoices: 3, highpass: 55, lowpass: 3300, cooldown: .1, refDistance: 2, maxDistance: 32 },
  enemydeath: { group: 'voice', volume: .30, maxVoices: 4, highpass: 65, lowpass: 4300, cooldown: .04, refDistance: 2.4, maxDistance: 36 },
  moan: { group: 'voice', volume: .18, maxVoices: 2, highpass: 90, lowpass: 3600, cooldown: .5, refDistance: 3, maxDistance: 42 },
  'distant-scream': { group: 'voice', volume: .10, maxVoices: 1, highpass: 80, lowpass: 2900, cooldown: 12, refDistance: 3, maxDistance: 45, rolloffFactor: 1.25 },
  'horror-sting': { group: 'sfx', volume: .13, maxVoices: 1, highpass: 90, lowpass: 6800, cooldown: 16 },
  'horror-reveal': { group: 'sfx', volume: .11, maxVoices: 1, highpass: 80, lowpass: 4800, cooldown: 20 },
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
const AMBIENCE_PRESETS = Object.freeze([
  { variant: 0, volume: .28, rate: .96, highpass: 40, lowpass: 3500 }, // Foundry pressure
  { variant: 1, volume: .25, rate: 1.02, highpass: 62, lowpass: 4700 }, // Ward ventilation
  { variant: 2, volume: .23, rate: .96, highpass: 40, lowpass: 4800 }, // Ossuary depth
  { variant: 2, volume: .19, rate: .88, highpass: 55, lowpass: 3900 }, // Cathedral hush
  { variant: 0, volume: .26, rate: .91, highpass: 38, lowpass: 4200 }, // Last stand pressure
]);
const SCENE_ALIASES = Object.freeze({
  game: 'play', gameplay: 'play', playing: 'play', ready: 'menu', loss: 'dead', victory: 'win',
});
const SHOT_PROFILES = Object.freeze([
  { volume: .42, highpass: 110, lowpass: 8200, cooldown: .02 },
  { volume: .50, highpass: 48, lowpass: 6400, cooldown: .08 },
  { volume: .36, highpass: 520, lowpass: 11800, cooldown: .025 },
  { volume: .43, highpass: 42, lowpass: 7600, cooldown: .08 },
  // Carrion is a short, bright automatic report. Keep a four-voice ceiling
  // and a small event cooldown so a held trigger stays punchy instead of
  // turning into a continuous wall of samples.
  { volume: .36, highpass: 92, lowpass: 9800, cooldown: .055, maxVoices: 4 },
  // Mourning is deliberately lower and longer. Two voices preserve the
  // charge/recovery punctuation when a player fires a charged shot.
  { volume: .54, highpass: 34, lowpass: 6700, cooldown: .11, maxVoices: 2 },
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const now = context => context?.currentTime ?? 0;
function sampleRms(buffer) {
  if (!buffer || !buffer.numberOfChannels || typeof buffer.getChannelData !== 'function') return 0;
  let power = 0;
  let count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index];
      if (Math.abs(sample) < .0002) continue;
      power += sample * sample;
      count++;
    }
  }
  return count ? Math.sqrt(power / count) : 0;
}
function normalizationPoolKey(key) {
  const parts = key.split(':');
  if (parts[0] === 'shot' || parts[0] === 'mechanism') return parts.length > 2 ? `${parts[0]}:${parts[1]}` : null;
  if (parts[0] === 'ambience' || parts[0].startsWith('music-')) return null;
  return parts.length > 1 ? parts.slice(0, -1).join(':') : null;
}
function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
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
    'horror-approach':'moan',
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
    this._groupVolumes = Object.fromEntries(GROUPS.map(name => [name, clamp(options.groupVolumes?.[name] ?? GROUP_VOLUME_DEFAULTS[name], 0, 1)]));
    this._atmosphereFactor = 1;
    this._atmosphereTimer = null;
    this._paused = false;
    this._ctx = null;
    this._master = null;
    this._limiter = null;
    this._groups = new Map();
    this._buffers = new Map();
    this._bufferGains = new WeakMap();
    this._normalizedPools = 0;
    this._normalizedSamples = 0;
    this._sources = new Set();
    this._ambientSource = null;
    this._ambientGain = null;
    this._ambiencePresetIndex = 0;
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
    // The chainsaw owns one persistent engine loop and one optional cutting
    // loop. Keeping the sources here prevents held input from stacking new
    // BufferSourceNodes every frame.
    this._meleeMotorSource = null;
    this._meleeMotorGain = null;
    this._meleeContactSource = null;
    this._meleeContactGain = null;
    this._meleeStartSource = null;
    this._meleeStartGain = null;
    this._meleeStopSource = null;
    this._meleeStopGain = null;
    this._meleeWeapon = -1;
    this._meleeRunning = false;
    this._meleeContacting = false;
  }

  get context() { return this._ctx; }
  get isUnlocked() { return Boolean(this._ctx && this._ctx.state === 'running'); }
  get assetsLoaded() { return this._loaded; }
  get assetCount() { return this._assetCount; }
  get loadErrors() { return this._loadErrors.slice(); }
  get scene() { return this._musicScene; }
  get musicActive() { return Boolean(this._musicSource); }
  get debugInfo() {
    return Object.freeze({ loaded: this._loaded, decoded: this._buffers.size, manifestEntries: this._assetCount, normalizedPools: this._normalizedPools, normalizedSamples: this._normalizedSamples, errors: this.loadErrors });
  }
  meleeDiagnostics() {
    return Object.freeze({
      weapon: this._meleeWeapon,
      running: this._meleeRunning,
      contacting: this._meleeContacting,
      motorSources: this._meleeMotorSource ? 1 : 0,
      contactSources: this._meleeContactSource ? 1 : 0,
      startupSources: this._meleeStartSource ? 1 : 0,
      shutdownSources: this._meleeStopSource ? 1 : 0,
    });
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
        this._limiter.threshold.value = -4;
        this._limiter.knee.value = 4;
        this._limiter.ratio.value = 20;
        this._limiter.attack.value = .003;
        this._limiter.release.value = .22;
        this._master.connect(this._limiter).connect(this._ctx.destination);
        this._groups.set('master', this._master);
        for (const name of GROUPS) {
          const gain = this._ctx.createGain();
          gain.gain.value = (GROUP_BASE_LEVELS[name] ?? .6) * this._groupVolumes[name];
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
    const level = clamp(value, 0, 1);
    if (!GROUPS.includes(group)) return level;
    this._groupVolumes[group] = level;
    const gain = this._groups.get(group);
    if (gain && this._ctx) gain.gain.setTargetAtTime(this._groupTarget(group), now(this._ctx), 0.015);
    return level;
  }

  /** Briefly lower only music and room tone so a quiet, positional cue can land. */
  duckAtmosphere(factor = .55, fadeIn = .7, hold = 1.8, fadeOut = 1.1) {
    this._atmosphereFactor = clamp(factor, .25, 1);
    if (this._atmosphereTimer) clearTimeout(this._atmosphereTimer);
    this._applyAtmosphere(fadeIn);
    this._atmosphereTimer = setTimeout(() => {
      this._atmosphereFactor = 1;
      this._applyAtmosphere(fadeOut);
      this._atmosphereTimer = null;
    }, Math.max(0, (fadeIn + hold) * 1000));
  }

  pause() {
    this._paused = true;
    this._stopMeleeLoops({ playShutdown: false, suppressTail: true });
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

  setAmbiencePreset(index = 0) {
    const next = Math.abs(Math.floor(Number(index) || 0)) % AMBIENCE_PRESETS.length;
    if (next === this._ambiencePresetIndex) return next;
    this._ambiencePresetIndex = next;
    if (!this._ctx || !this._ambientSource || this._musicScene !== 'play' || this._paused) return next;
    const t = now(this._ctx), oldSource = this._ambientSource, oldGain = this._ambientGain;
    if (oldGain) {
      oldGain.gain.cancelScheduledValues(t);
      oldGain.gain.setTargetAtTime(.0001, t, .16);
    }
    try { oldSource.stop(t + .55); } catch {}
    this._ambientSource = null;
    this._ambientGain = null;
    this._playAmbience({ fadeIn: .55 });
    return next;
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
    if (details.type === 'horror-approach') Object.assign(profile, {
      volume: .15, maxVoices: 1, highpass: 110,
      lowpass: details.occluded ? 1050 : 2550,
      detune: -75, modulationHz: 40, modulationDepth: .14,
      refDistance: 5, maxDistance: 40, rolloffFactor: 1.2,
    });
    if (name === 'hover') { profile.volume = .065; profile.cooldown = .07; }
    const mix = { ...profile, group: GROUP_BY_TYPE[name] || profile.group, ...details };
    if (name === 'shot' && index === 4 && details.mode === 'burst') {
      mix.volume = Math.min(Number(mix.volume) || .36, .34);
      mix.highpass = 105;
    }
    if (name === 'shot' && index === 5 && details.mode === 'charged') {
      mix.volume = Math.min(1, (Number(mix.volume) || .54) * 1.08);
      mix.lowpass = 7200;
    }
    const cooldown = Number(details.cooldown ?? profile.cooldown ?? 0);
    if (cooldown > 0) {
      const sourceId = details.enemyId ?? details.id ?? '';
      const key = name + ':' + index + ':' + String(sourceId);
      const time = globalThis.performance?.now?.() ?? Date.now();
      if (time - (this._lastPlay.get(key) || -Infinity) < cooldown * 1000) return false;
      this._lastPlay.set(key, time);
    }
    // The engine keeps wall collisions under one event name; route the
    // chainsaw's metal bite to its dedicated wall pool instead of a bat clang.
    const buffer = name === 'melee-wall' && index === 7
      ? this._chooseBuffer('chainsaw-wall', 0, details.variant)
      : this._chooseBuffer(name, index, details.variant);
    if (buffer) {
      this._playBuffer(buffer, name, index, mix);
      // Keep the tactile layer coupled to the real shot event. It is a tiny
      // sampled tail with the same spatial details, so it adds weapon identity
      // without a second gameplay event or a per-frame synthesizer.
      if (name === 'shot' || name === 'rocket') this._playMechanism(index, details);
      return true;
    }
    return false;
  }

  /**
   * Synchronize the sustained melee layer with authoritative gameplay state.
   *
   * `active` is the held chainsaw state, `rev` is its normalized engine ramp,
   * and `contact` is the short cut/wall contact latch. Bat swings and impacts
   * stay event driven through play('bat-swing' / 'melee-hit' / 'melee-wall').
   * This method deliberately owns at most one motor loop and one contact loop.
   */
  updateMelee(state = {}) {
    if (this._disposed) return false;
    const weapon = Math.floor(Number(state.weapon ?? -1));
    const chainsaw = weapon === 7;
    const playing = state.playing !== false && !this._paused;
    const active = chainsaw && Boolean(state.active);
    const rev = chainsaw ? clamp(state.rev, 0, 1) : 0;
    const contact = chainsaw && Boolean(state.contact);
    const position = state.position;
    const wasRunning = this._meleeRunning;
    const wasWeapon = this._meleeWeapon;
    this._meleeWeapon = weapon;

    // A screen transition, pause, death, or weapon switch tears down the
    // persistent sources. A running saw gets a sampled shutdown tail only
    // while the context is live; pause/dispose remain silent.
    if (!chainsaw || !playing) {
      this._stopMeleeLoops({
        playShutdown: Boolean(wasRunning && playing && wasWeapon === 7),
        suppressTail: !playing,
        position,
      });
      this._meleeRunning = false;
      this._meleeContacting = false;
      return false;
    }

    if (!this._ctx || this._ctx.state !== 'running' || !this._loaded) {
      // unlock() loads buffers asynchronously; keep the state so the next
      // frame starts cleanly once decoding has completed.
      this._meleeRunning = active || rev > .015;
      this._meleeContacting = contact;
      return false;
    }

    const shouldRun = active || rev > .015;
    if (shouldRun && !this._meleeMotorSource) {
      // A context may finish decoding after the first held frame. Starting
      // from a missing source still needs its sampled pull/start cue.
      this._startMeleeStart(position);
      this._startMeleeMotor(rev, position);
    }
    if (this._meleeMotorSource) this._setMeleeMotor(rev);

    if (contact && !this._meleeContactSource) this._startMeleeContact(position);
    if (!contact && this._meleeContactSource) this._stopMeleeContact();
    this._meleeRunning = shouldRun;
    this._meleeContacting = Boolean(contact);
    if (!shouldRun && this._meleeMotorSource) {
      this._stopMeleeLoops({ playShutdown: Boolean(wasRunning), position });
      this._meleeRunning = false;
      this._meleeContacting = false;
    }
    return shouldRun;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._stopMeleeLoops({ playShutdown: false, suppressTail: true, immediate: true });
    if (this._atmosphereTimer) clearTimeout(this._atmosphereTimer);
    this._atmosphereTimer = null;
    for (const source of this._sources) {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
    }
    this._sources.clear();
    this._ambientSource = null;
    this._ambientGain = null;
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

  _groupTarget(group) {
    const atmosphere = group === 'ambience' || group === 'music' ? this._atmosphereFactor : 1;
    return (GROUP_BASE_LEVELS[group] ?? .6) * this._groupVolumes[group] * atmosphere;
  }

  _applyAtmosphere(duration = .8) {
    if (!this._ctx) return;
    const t = now(this._ctx), timeConstant = Math.max(.02, Number(duration) / 3 || .02);
    for (const group of ['ambience', 'music']) {
      const gain = this._groups.get(group);
      if (!gain) continue;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(this._groupTarget(group), t, timeConstant);
    }
  }

  _resolveUrl(path) {
    try { return new URL(path, this.baseUrl).href; } catch { return path; }
  }

  _manifestEntries(type, value) {
    if ((type === 'shot' || type === 'mechanism') && Array.isArray(value) && value.some(entry => Array.isArray(entry))) {
      return value.flatMap((entry, weapon) => list(entry).map((path, variant) => ({
        key: type + ':' + weapon + ':' + variant, path,
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
    this._normalizePools();
    this._loaded = true;
  }

  _normalizePools() {
    const pools = new Map();
    for (const [key, buffer] of this._buffers) {
      const poolKey = normalizationPoolKey(key);
      if (!poolKey) continue;
      let pool = pools.get(poolKey);
      if (!pool) { pool = []; pools.set(poolKey, pool); }
      pool.push({ buffer, rms: sampleRms(buffer) });
    }
    for (const pool of pools.values()) {
      if (pool.length < 2) continue;
      const target = median(pool.map(item => item.rms).filter(value => value > 0));
      if (!target) continue;
      this._normalizedPools++;
      for (const item of pool) {
        if (!item.rms) continue;
        const level = clamp(target / item.rms, .5, 2);
        this._bufferGains.set(item.buffer, level);
        if (Math.abs(level - 1) > .01) this._normalizedSamples++;
      }
    }
  }

  _chooseBuffer(name, weapon = 0, variant) {
    const keys = [];
    if (name === 'shot' || name === 'mechanism') {
      const prefix = name + ':' + Math.max(0, weapon) + ':';
      for (const key of this._buffers.keys()) if (key.startsWith(prefix)) keys.push(key);
      if (!keys.length && weapon > 0 && weapon < 4) {
        for (const key of this._buffers.keys()) if (key.startsWith(name + ':0:')) keys.push(key);
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

  _startMeleeStart(position) {
    if (this._meleeStartSource || !this._ctx) return false;
    // A very quick release/restart should never layer a stale shutdown under
    // the new pull-start cue.
    this._stopMeleeStop(true);
    const buffer = this._chooseBuffer('chainsaw-start', 0);
    if (!buffer) return false;
    const source = this._playBuffer(buffer, 'chainsaw-start', 0, {
      group: 'sfx', fadeIn: .012, volume: .30, maxVoices: 1,
      highpass: 48, lowpass: 7600, position,
    });
    if (!source) return false;
    this._meleeStartSource = source;
    this._meleeStartGain = source._deadArrivalGain || null;
    source.addEventListener?.('ended', () => {
      if (this._meleeStartSource !== source) return;
      this._meleeStartSource = null;
      this._meleeStartGain = null;
    }, { once: true });
    return true;
  }

  _startMeleeStop(position) {
    if (!this._ctx || this._paused || this._meleeStopSource) return false;
    this._stopMeleeStart(true);
    const buffer = this._chooseBuffer('chainsaw-stop', 0);
    if (!buffer) return false;
    const source = this._playBuffer(buffer, 'chainsaw-stop', 0, {
      group: 'sfx', fadeIn: .012, volume: .21, maxVoices: 1,
      highpass: 45, lowpass: 6800, position,
    });
    if (!source) return false;
    this._meleeStopSource = source;
    this._meleeStopGain = source._deadArrivalGain || null;
    source.addEventListener?.('ended', () => {
      if (this._meleeStopSource !== source) return;
      this._meleeStopSource = null;
      this._meleeStopGain = null;
    }, { once: true });
    return true;
  }

  _stopMeleeStart(immediate = false) {
    const source = this._meleeStartSource;
    const gain = this._meleeStartGain;
    this._meleeStartSource = null;
    this._meleeStartGain = null;
    if (!source) return false;
    const t = now(this._ctx), fade = immediate ? .004 : .025;
    try {
      if (gain) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(.0001, t, Math.max(.008, fade / 3));
      }
      source.stop(t + (immediate ? .008 : .06));
    } catch { try { source.stop(); } catch {} }
    return true;
  }

  _stopMeleeStop(immediate = false) {
    const source = this._meleeStopSource;
    const gain = this._meleeStopGain;
    this._meleeStopSource = null;
    this._meleeStopGain = null;
    if (!source) return false;
    const t = now(this._ctx), fade = immediate ? .004 : .035;
    try {
      if (gain) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(.0001, t, Math.max(.008, fade / 3));
      }
      source.stop(t + (immediate ? .008 : .07));
    } catch { try { source.stop(); } catch {} }
    return true;
  }

  _startMeleeMotor(rev = 0, position) {
    if (this._meleeMotorSource || !this._ctx) return false;
    const buffer = this._chooseBuffer('chainsaw-motor', 0);
    if (!buffer) return false;
    const source = this._playBuffer(buffer, 'chainsaw-motor', 0, {
      group: 'sfx', loop: true, fadeIn: .08, volume: .22,
      maxVoices: 1, highpass: 42, lowpass: 7200,
      rate: .82 + clamp(rev, 0, 1) * .34, position,
    });
    if (!source) return false;
    this._meleeMotorSource = source;
    this._meleeMotorGain = source._deadArrivalGain || null;
    return true;
  }

  _setMeleeMotor(rev = 0) {
    const source = this._meleeMotorSource;
    if (!source || !this._ctx) return false;
    const t = now(this._ctx), level = .075 + clamp(rev, 0, 1) * .19;
    try { source.playbackRate.setTargetAtTime(.82 + clamp(rev, 0, 1) * .34, t, .045); } catch {}
    if (this._meleeMotorGain) {
      try { this._meleeMotorGain.gain.setTargetAtTime(level, t, .06); } catch {}
    }
    return true;
  }

  _startMeleeContact(position) {
    if (this._meleeContactSource || !this._ctx) return false;
    const buffer = this._chooseBuffer('chainsaw-contact', 0);
    if (!buffer) return false;
    const source = this._playBuffer(buffer, 'chainsaw-contact', 0, {
      group: 'sfx', loop: true, fadeIn: .035, volume: .12,
      maxVoices: 1, highpass: 85, lowpass: 6500, position,
    });
    if (!source) return false;
    this._meleeContactSource = source;
    this._meleeContactGain = source._deadArrivalGain || null;
    return true;
  }

  _stopMeleeContact(immediate = false) {
    const source = this._meleeContactSource;
    const gain = this._meleeContactGain;
    this._meleeContactSource = null;
    this._meleeContactGain = null;
    if (!source) return false;
    const t = now(this._ctx), fade = immediate ? .005 : .055;
    try {
      if (gain) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(.0001, t, Math.max(.01, fade / 3));
      }
      source.stop(t + (immediate ? .01 : .18));
    } catch { try { source.stop(); } catch {} }
    return true;
  }

  _stopMeleeLoops({ playShutdown = false, suppressTail = false, position, immediate = false } = {}) {
    // Pull-start is owned by the melee lifecycle, so releasing or switching
    // weapons cannot leave its transient source audible over the next state.
    this._stopMeleeStart(immediate);
    if (suppressTail) this._stopMeleeStop(immediate);
    if (playShutdown && this._ctx?.state === 'running' && !this._paused) this._startMeleeStop(position);
    const source = this._meleeMotorSource;
    const gain = this._meleeMotorGain;
    this._meleeMotorSource = null;
    this._meleeMotorGain = null;
    this._meleeRunning = false;
    this._meleeContacting = false;
    this._stopMeleeContact(immediate);
    if (!source) return false;
    const t = now(this._ctx), fade = immediate ? .005 : .08;
    try {
      if (gain) {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setTargetAtTime(.0001, t, Math.max(.01, fade / 3));
      }
      source.stop(t + (immediate ? .01 : .22));
    } catch { try { source.stop(); } catch {} }
    return true;
  }

  _playMechanism(weapon = 0, details = {}) {
    const buffer = this._chooseBuffer('mechanism', weapon, details.variant);
    if (!buffer) return false;
    const rifle = weapon === 4 || weapon === 5;
    const auto = weapon === 4;
    this._playBuffer(buffer, 'mechanism', weapon, {
      ...details,
      group: 'sfx',
      volume: details.mechanismVolume ?? (auto ? .075 : weapon === 5 ? .11 : .10),
      maxVoices: rifle ? (auto ? 3 : 2) : 4,
      highpass: auto ? 850 : 700,
      lowpass: auto ? 8200 : 7600,
      delay: details.mechanismDelay ?? (weapon === 1 ? .13 : auto ? .055 : weapon === 5 ? .095 : .025),
    });
    return true;
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
    const t = now(this._ctx), bufferGain = level * (this._bufferGains.get(buffer) ?? 1);
    if (Number(profile.fadeIn) > 0) {
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.setTargetAtTime(bufferGain, t, Math.max(.02, Number(profile.fadeIn) / 3));
    } else gain.gain.setValueAtTime(bufferGain, t);
    // Persistent melee loops need to retune their gain while they are live.
    // Keep the node private to the source so one-shot callers remain unchanged.
    source._deadArrivalGain = gain;
    source.connect(gain);
    let node = this._filterNode(gain, profile);
    source.loop = type === 'ambience' || Boolean(profile.loop);
    const modulationHz = clamp(profile.modulationHz, 0, 150);
    const modulationDepth = clamp(profile.modulationDepth, 0, .35);
    if (!source.loop && modulationHz > 0 && modulationDepth > 0 && this._ctx.createOscillator) {
      try {
        const t = now(this._ctx), tremolo = this._ctx.createGain();
        const lfo = this._ctx.createOscillator(), lfoDepth = this._ctx.createGain();
        tremolo.gain.setValueAtTime(1 - modulationDepth / 2, t);
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(modulationHz, t);
        lfoDepth.gain.setValueAtTime(modulationDepth / 2, t);
        lfo.connect(lfoDepth).connect(tremolo.gain);
        node.connect(tremolo);
        node = tremolo;
        const cleanup = () => {
          try { lfo.stop(); } catch {}
          try { lfo.disconnect(); lfoDepth.disconnect(); tremolo.disconnect(); } catch {}
        };
        source.addEventListener?.('ended', cleanup, { once: true });
        lfo.start(t);
        lfo.stop(t + buffer.duration / Math.max(.5, source.playbackRate.value) + .1);
      } catch {}
    }
    const spatial = this._createSpatialNode(profile);
    if (spatial) node.connect(spatial).connect(this._group(group));
    else node.connect(this._group(group));
    if (source.loop && type === 'ambience') {
      this._stopAmbient();
      this._ambientSource = source;
      this._ambientGain = gain;
    }
    this._track(source, source.loop, type);
    source.start(t + Math.max(0, Number(profile.delay) || 0));
    return source;
  }

  _playAmbience(details = {}) {
    if (this._ambientSource) return true;
    const preset = AMBIENCE_PRESETS[this._ambiencePresetIndex] || AMBIENCE_PRESETS[0];
    const buffer = this._chooseBuffer('ambience', 0, details.variant ?? preset.variant);
    if (buffer) {
      this._playBuffer(buffer, 'ambience', 0, { ...preset, ...details, group: 'ambience', loop: true, volume: details.volume ?? preset.volume });
      return true;
    }
    return false;
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
      this._ambientGain = null;
    }
  }
}

export default AudioSystem;
