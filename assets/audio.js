/*
 * The Last Dead audio runtime.
 * Bundled, sourced samples live under ./audio. Missing or undecodable assets
 * stay silent instead of being replaced with generated oscillator audio.
 */
import { AUDIO_ASSET_MANIFEST, AUDIO_ASSET_TRIMS_DB, PLAYER_INJURY_CUES, BRUTAL_COMBAT_CUES, VERMIN_CUES } from './audio-manifest.js';
export { AUDIO_ASSET_MANIFEST };

const GROUPS = ['sfx', 'ui', 'ambience', 'voice', 'music'];
const GROUP_BASE_LEVELS = Object.freeze({ sfx: 1, ui: .5, ambience: .62, voice: .78, music: .38 });
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
  'extract-start': { group: 'sfx', volume: .12, maxVoices: 2, highpass: 480, lowpass: 6200, cooldown: .08 },
  'extract-draw': { group: 'sfx', volume: .24, maxVoices: 2, highpass: 45, lowpass: 2200, cooldown: .1 },
  'extract-incise': { group: 'sfx', volume: .25, maxVoices: 2, highpass: 90, lowpass: 3900, cooldown: .1 },
  'extract-rip': { group: 'sfx', volume: .32, maxVoices: 3, highpass: 48, lowpass: 3600, cooldown: .1 },
  'extract-complete': { group: 'sfx', volume: .17, maxVoices: 2, highpass: 42, lowpass: 2600, cooldown: .08 },
  'extract-cancel': { group: 'sfx', volume: .08, maxVoices: 1, highpass: 550, lowpass: 5800, cooldown: .08 },
  bulletcrackle: { group: 'sfx', volume: .22, maxVoices: 6, highpass: 900, lowpass: 9000, cooldown: .04 },
  footstep: { group: 'sfx', volume: .21, maxVoices: 3, highpass: 85, lowpass: 5600, cooldown: .06 },
  jump: { group: 'sfx', volume: .18, maxVoices: 2, highpass: 80, lowpass: 5600, cooldown: .08 },
  land: { group: 'sfx', volume: .26, maxVoices: 3, highpass: 45, lowpass: 2800, cooldown: .08 },
  dash: { group: 'sfx', volume: .20, maxVoices: 3, highpass: 120, lowpass: 7200, cooldown: .05 },
  slide: { group: 'sfx', volume: .16, maxVoices: 3, highpass: 90, lowpass: 3600, cooldown: .08 },
  enemyattack: { group: 'voice', volume: .50, maxVoices: 3, highpass: 100, lowpass: 5800, cooldown: .16, refDistance: 2.5, maxDistance: 30, priority: 3 },
  enemyjump: { group: 'sfx', volume: .24, maxVoices: 3, highpass: 80, lowpass: 4200, cooldown: .1, refDistance: 2, maxDistance: 30 },
  enemyland: { group: 'sfx', volume: .25, maxVoices: 3, highpass: 55, lowpass: 3300, cooldown: .1, refDistance: 2, maxDistance: 32 },
  enemydeath: { group: 'voice', volume: .30, maxVoices: 4, highpass: 65, lowpass: 4300, cooldown: .04, refDistance: 2.4, maxDistance: 36 },
  moan: { group: 'voice', volume: .19, maxVoices: 2, highpass: 95, lowpass: 3600, cooldown: 1.2, refDistance: 2.5, maxDistance: 34, priority: 1 },
  'distant-scream': { group: 'voice', volume: .10, maxVoices: 1, highpass: 80, lowpass: 2900, cooldown: 12, refDistance: 3, maxDistance: 45, rolloffFactor: 1.25 },
  'ceiling-scream': { group: 'voice', volume: .32, maxVoices: 1, highpass: 75, lowpass: 4200, cooldown: 12, refDistance: 3, maxDistance: 25, rolloffFactor: 1.4 },
  'window-scream': { group: 'voice', volume: .40, maxVoices: 1, highpass: 85, lowpass: 4400, cooldown: 12, refDistance: 4, maxDistance: 26, rolloffFactor: 1.2 },
  'horror-sting': { group: 'sfx', volume: .13, maxVoices: 1, highpass: 90, lowpass: 6800, cooldown: 16 },
  'horror-reveal': { group: 'sfx', volume: .17, maxVoices: 1, highpass: 80, lowpass: 4800, cooldown: 20 },
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
  { volume: .82, highpass: 65, lowpass: 10500, bodyDb: 3, cooldown: .02 },
  { volume: .88, highpass: 35, lowpass: 9200, bodyDb: 3.5, cooldown: .08 },
  { volume: .55, highpass: 340, lowpass: 11800, cooldown: .025 },
  { volume: .75, highpass: 32, lowpass: 8400, bodyDb: 2, cooldown: .08 },
  // Carrion is a short, bright automatic report. Keep a four-voice ceiling
  // and a small event cooldown so a held trigger stays punchy instead of
  // turning into a continuous wall of samples.
  { volume: .76, highpass: 65, lowpass: 11000, bodyDb: 2.5, cooldown: .055, maxVoices: 4 },
  // Mourning is deliberately lower and longer. Two voices preserve the
  // charge/recovery punctuation when a player fires a charged shot.
  { volume: .88, highpass: 32, lowpass: 9000, bodyDb: 3, cooldown: .11, maxVoices: 2 },
]);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const now = context => context?.currentTime ?? 0;
function sampleRms(buffer) {
  if (!buffer || !buffer.numberOfChannels || typeof buffer.getChannelData !== 'function') return 0;
  let power = 0;
  let count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    // Peak 50ms energy matches repeated reports better than their tail length.
    const window=Math.max(1,Math.round(buffer.sampleRate*.05));
    for(let offset=0;offset<samples.length;offset+=window){let sum=0,n=0;for(let i=offset;i<Math.min(samples.length,offset+window);i++){sum+=samples[i]*samples[i];n++;}power=Math.max(power,sum/Math.max(1,n));count=1;}
  }
  return count ? Math.sqrt(power / count) : 0;
}
function normalizationPoolKey(key) {
  const parts = key.split(':');
  if (parts[0] === 'shot' || parts[0] === 'mechanism') return parts.length > 2 ? `${parts[0]}:${parts[1]}` : null;
  if (parts[0] === 'ambience' || parts[0].startsWith('music-')) return null;
  return ['enemyattack','enemydeath','moan','footstep'].includes(parts[0])&&parts.length>1?parts.slice(0,-1).join(':'):null;
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
    this._buses = new Map();
    this._duckGains = new Map();
    this._outputTrim = null;
    this._mixInput = null;
    this._roomInput = null;
    this._listenerPosition = {x:0,y:0,z:0};
    this._spatialSources = new Set();
    this._spatialEmitters = new Map();
    this._droppedVoices = 0;
    this._duckEvents = 0;
    this._buffers = new Map();
    this._soundEnvelopes = new Map();
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
  // RMS frames are derived from the decoded sound, keeping the face motion
  // synchronized with the exact scream sample the listener hears.
  soundLevelAt(type, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    let envelope = this._soundEnvelopes.get(type);
    if (!envelope) {
      const entry = [...this._buffers.entries()].find(([key]) => key.startsWith(type + ':'));
      if (!entry) return 0;
      const buffer = entry[1], samples = buffer.getChannelData(0);
      const step = Math.max(1, Math.round(buffer.sampleRate * .025));
      const levels = new Float32Array(Math.ceil(samples.length / step));
      let peak = 0;
      for (let i = 0; i < levels.length; i++) {
        let energy = 0;
        const start = i * step, end = Math.min(samples.length, start + step);
        for (let j = start; j < end; j++) energy += samples[j] * samples[j];
        const level = Math.sqrt(energy / Math.max(1, end - start));
        levels[i] = level; peak = Math.max(peak, level);
      }
      envelope = { levels, peak: Math.max(.001, peak), duration: buffer.duration };
      this._soundEnvelopes.set(type, envelope);
    }
    if (seconds >= envelope.duration) return 0;
    const at = seconds / .025, index = Math.floor(at), fraction = at - index;
    const level = (envelope.levels[index] || 0) * (1 - fraction) + (envelope.levels[index + 1] || 0) * fraction;
    return clamp(Math.pow(level / envelope.peak, .75), 0, 1);
  }
  get debugInfo() {
    return Object.freeze({ loaded: this._loaded, decoded: this._buffers.size, manifestEntries: this._assetCount, normalizedPools: this._normalizedPools, normalizedSamples: this._normalizedSamples, errors: this.loadErrors, mix:this.mixDiagnostics() });
  }
  mixDiagnostics() {
    return {version:2,master:this._volume,muted:this._muted,paused:this._paused,
      outputTrim:this._outputTrim?.gain.value??.86,limiterReductionDb:this._limiter?.reduction??0,
      topology:'bus groups → compressor → 0.86 headroom → user master → output',
      groups:Object.fromEntries(GROUPS.map(name=>[name,{base:GROUP_BASE_LEVELS[name],user:this._groupVolumes[name],current:this._groups.get(name)?.gain.value??0}])),
      duckGains:Object.fromEntries([...this._duckGains].map(([name,node])=>[name,node.gain.value])),
      activeVoices:this._sources.size,droppedVoices:this._droppedVoices,duckEvents:this._duckEvents,
      calibratedSources:Object.keys(AUDIO_ASSET_TRIMS_DB).length,roomTaps:this._roomInput?2:0};
  }
  _createMixGraph() {
    const ctx=this._ctx;
    this._master=ctx.createGain();this._mixInput=ctx.createGain();this._outputTrim=ctx.createGain();this._outputTrim.gain.value=.86;
    this._limiter=ctx.createDynamicsCompressor();
    Object.assign(this._limiter.threshold,{value:-5});this._limiter.knee.value=3;this._limiter.ratio.value=16;this._limiter.attack.value=.001;this._limiter.release.value=.12;
    this._mixInput.connect(this._limiter).connect(this._outputTrim).connect(this._master).connect(ctx.destination);
    this._groups.set('master',this._master);
    for(const name of GROUPS){const gain=ctx.createGain(),duck=ctx.createGain();gain.gain.value=this._groupTarget(name);gain.connect(duck).connect(this._mixInput);this._groups.set(name,gain);this._duckGains.set(name,duck);}
    for(const name of ['weapons','foley','injury']){const gain=ctx.createGain();gain.connect(this._group('sfx'));this._buses.set(name,gain);this._duckGains.set(name,gain);}
    // Two quiet, non-feedback early reflections give dry bundled reports a
    // shared concrete room. They inherit source distance and the SFX slider.
    if(ctx.createDelay){this._roomInput=ctx.createGain();this._roomInput.gain.value=.09;
      for(const [seconds,pan]of [[.037,-.35],[.079,.35]]){const delay=ctx.createDelay(.2),filter=ctx.createBiquadFilter();delay.delayTime.value=seconds;filter.type='lowpass';filter.frequency.value=3400;this._roomInput.connect(delay).connect(filter);if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;filter.connect(p).connect(this._group('sfx'));}else filter.connect(this._group('sfx'));}}
    this._applyMasterGain();
  }
  _duckBus(name,factor,start,hold,release){
    const node=this._duckGains.get(name);if(!node)return;
    const p=node.gain;p.cancelScheduledValues(start);p.setTargetAtTime(factor,start,.012);p.setTargetAtTime(1,start+hold,release);this._duckEvents++;
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
        this._createMixGraph();
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
    this.stopSpatialEmitters();
    for(const source of [...this._spatialSources])this._stopSpatialSource(source,true);
    this._stopMeleeLoops({ playShutdown: false, suppressTail: true });
    this._stopAmbient();
    this._fadeMusic(0.0001, .12);
    for(const node of this._duckGains.values())if(this._ctx){node.gain.cancelScheduledValues(now(this._ctx));node.gain.setValueAtTime(1,now(this._ctx));}
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
    if(target!=='play')this.stopSpatialEmitters();
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
    this._listenerPosition={x:Number(listener.x)||0,y:Number(listener.y??listener.z)||0,z:Number(listener.z??listener.y)||0};
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
    if(!L.positionX?.setValueAtTime)L.setPosition?.(this._listenerPosition.x,this._listenerPosition.y,this._listenerPosition.z);
    if (listener.forwardX !== undefined) {
      set('forwardX', listener.forwardX); set('forwardY', listener.forwardY ?? 0); set('forwardZ', listener.forwardZ ?? -1);
      set('upX', listener.upX ?? 0); set('upY', listener.upY ?? 1); set('upZ', listener.upZ ?? 0);
      if(!L.forwardX?.setValueAtTime)L.setOrientation?.(listener.forwardX,listener.forwardY??0,listener.forwardZ??-1,listener.upX??0,listener.upY??1,listener.upZ??0);
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
    if (VERMIN_CUES[name]) return this._playVermin(name,details);
    if (PLAYER_INJURY_CUES[name]) return this._playPlayerInjury(name,details);
    if(['brutal-start','brutal-contact','brutal-extract','brutal-release'].includes(name))return this._playBrutalCounter(name,details);
    const profile = { ...resolveMix(name, index) };
    if (details.type === 'horror-approach') Object.assign(profile, {
      volume: .15, maxVoices: 1, highpass: 110,
      lowpass: details.occluded ? 1050 : 2550,
      detune: -75, modulationHz: 40, modulationDepth: .14,
      refDistance: 5, maxDistance: 40, rolloffFactor: 1.2,
    });
    if (name === 'hover') { profile.volume = .065; profile.cooldown = .07; }
    const mix = { ...profile, group: GROUP_BY_TYPE[name] || profile.group, ...details };
    const extractionSound = {
      'extract-start': ['mechanism', 5, 1.08],
      'extract-draw': ['blood', 0, .68],
      'extract-incise': ['melee-hit', 0, .82],
      'extract-rip': ['blood', 0, .87],
      'extract-complete': ['heartbeat', 0, .91],
      'extract-cancel': ['mechanism', 5, .88],
    }[name];
    if (extractionSound) {
      const seed = Number(details.seed) || 0;
      mix.rate = clamp(extractionSound[2] + Math.sin(seed * .000031 + name.length * 1.41) * .055, .55, 1.2);
      mix.volume = clamp(Number(profile.volume) + Math.sin(seed * .000017 + name.length) * .025, .05, .4);
      // The body seed chooses repeatable sample variants and timing without
      // manufacturing or loading new audio during a live extraction.
      mix.variant = name === 'extract-incise' ? 3 : Math.abs(seed) % 2;
    }
    if (name === 'shot' && index === 4) {
      const heat = clamp(Number(details.heat) || 0, 0, 1);
      const sequence = Number(details.sequence) || 0;
      // A quiet mechanical report on each round carries the automatic rhythm;
      // a small deterministic pitch shift keeps consecutive rounds distinct.
      mix.rate = clamp(1 + Math.sin(sequence * 2.399) * .025 - heat * .028, .94, 1.04);
      mix.volume = details.mode === 'burst' ? .72 : .78;
      mix.highpass = details.mode === 'burst' ? 78 : 65;
      mix.mechanismVolume = details.mode === 'burst' ? .095 : .085;
      mix.mechanismDelay = .042;
    }
    if (name === 'shot' && index === 5 && details.mode === 'charged') {
      mix.volume = Math.min(1, (Number(mix.volume) || .54) * 1.08);
      mix.lowpass = 7200;
    }
    const cooldown = Number(details.cooldown ?? profile.cooldown ?? 0);
    if (cooldown > 0) {
      const sourceId = details.enemyId ?? details.id ?? details.playerId ?? '';
      const key = name + ':' + index + ':' + String(sourceId);
      const time = globalThis.performance?.now?.() ?? Date.now();
      if (time - (this._lastPlay.get(key) || -Infinity) < cooldown * 1000) return false;
      this._lastPlay.set(key, time);
    }
    // The engine keeps wall collisions under one event name; route the
    // chainsaw's metal bite to its dedicated wall pool instead of a bat clang.
    const buffer = extractionSound
      ? this._chooseBuffer(extractionSound[0], extractionSound[1], mix.variant)
      : name === 'melee-wall' && index === 7
      ? this._chooseBuffer('chainsaw-wall', 0, details.variant)
      : this._chooseBuffer(name, index, details.variant);
    if (buffer) {
      const played=this._playBuffer(buffer, name, index, mix);
      if(!played)return false;
      if (name === 'extract-rip') {
        const tear = this._chooseBuffer('melee-hit', 0, 3);
        if (tear) this._playBuffer(tear, name, index, {...mix,volume:.12,highpass:120,lowpass:3100,rate:mix.rate*.8,delay:.11});
      }
      // Keep the tactile layer coupled to the real shot event. It is a tiny
      // sampled tail with the same spatial details, so it adds weapon identity
      // without a second gameplay event or a per-frame synthesizer.
      if (name === 'shot' || name === 'rocket') this._playMechanism(index, name === 'shot' && index === 4
        ? { ...details, mechanismVolume: mix.mechanismVolume, mechanismDelay: mix.mechanismDelay }
        : details);
      return true;
    }
    return false;
  }

  resetCounterCues() {
    for(const key of this._lastPlay.keys())if(key.startsWith('counter:')||key.startsWith('vermin:'))this._lastPlay.delete(key);
  }

  _playVermin(name,details={}) {
    const layers=VERMIN_CUES[name];if(!layers)return false;
    const key=`vermin:${name}:${details.playerId||'host'}:${details.ratId||0}:${details.enemyId||0}:${details.sequence||0}:${details.bites||0}:${details.crawlSequence||details.infestationSequence||0}`;
    if(this._lastPlay.has(key))return false;
    this._lastPlay.set(key,now(this._ctx));
    if(this._lastPlay.size>512)for(const [id]of this._lastPlay){if(id.startsWith('vermin:')){this._lastPlay.delete(id);if(this._lastPlay.size<384)break;}}
    let played=false;
    for(const [index,layer]of layers.entries()){
      const buffer=this._chooseBuffer(layer.pool,0,(Number(details.sequence)||0)+index);if(!buffer)continue;
      played=!!this._playBuffer(buffer,'vermin-foley',0,{...details,...layer,group:'sfx',mixBus:'foley',maxVoices:4,priority:name==='vermin-bite'?2:1,
        position:name==='vermin-bite'||name==='vermin-crawl'||name==='vermin-pickup'?null:details.position,
        refDistance:1.5,maxDistance:16,rolloffFactor:1.35,loop:false,
        delay:Math.max(0,Number(details.delay)||0)+(layer.delay||0)})||played;
    }
    return played;
  }

  _playBrutalCounter(name,details={}) {
    const cue=name==='brutal-start'?'start':name==='brutal-extract'?details.kind+'-extract':name==='brutal-release'?details.kind+'-release':details.kind;
    const layers=BRUTAL_COMBAT_CUES[cue];if(!layers)return false;
    const at=now(this._ctx)+Math.max(0,Number(details.delay)||0),key=`counter:${name}:${details.playerId||'host'}:${details.enemyId||0}:${details.sequence||0}`;
    if(this._lastPlay.has(key))return false;
    this._lastPlay.set(key,at);
    // Limit the deduplication ledger as well as voices in long runs.
    if(this._lastPlay.size>512)for(const [id]of this._lastPlay){if(id.startsWith('counter:')){this._lastPlay.delete(id);if(this._lastPlay.size<384)break;}}
    let played=false;
    for(const [index,layer]of layers.entries()){
      const buffer=this._chooseBuffer(layer.pool,0,layer.variant??((Number(details.sequence)||0)+index));if(!buffer)continue;
      played=!!this._playBuffer(buffer,name,0,{...details,...layer,group:'sfx',mixBus:'injury',maxVoices:6,priority:4,
        delay:Math.max(0,Number(details.delay)||0)+(layer.delay||0),rate:layer.rate*(1+Math.sin((Number(details.sequence)||0)*2.399+index)*.018)})||played;
    }
    return played;
  }

  _playPlayerInjury(name, details = {}) {
    const cue=PLAYER_INJURY_CUES[name],time=now(this._ctx),at=time+Math.max(0,Number(details.delay)||0);
    const key=`injury:${name}`,previous=this._lastPlay.get(key);
    // Audio clock scheduling also makes deterministic offline renders valid.
    // One global victim cooldown prevents multiple attackers stacking a cue.
    if(previous!==undefined&&at-previous<cue.cooldown)return false;
    this._lastPlay.set(key,at);
    if(name==='bite-release'||name==='bite-terminal'){
      for(const type of ['bite-windup','bite-start','bite-struggle','bite-damage'])for(const source of this._voices.get(type)||[]){
        try{source._deadArrivalGain?.gain.cancelScheduledValues(at);source._deadArrivalGain?.gain.setTargetAtTime(.0001,at,.008);source.stop(at+.035);}catch{}
      }
    }
    const severity=name==='bite-damage'?1+Math.min(3,Math.max(0,Number(details.stage)||0))*.045:1;
    let played=false;
    for(const [index,layer]of cue.layers.entries()){
      const variant=layer.variant??(Number.isFinite(Number(details.sequence))?Number(details.sequence)+index:undefined);
      const buffer=this._chooseBuffer(layer.pool,0,variant);if(!buffer)continue;
      const source=this._playBuffer(buffer,name,0,{...layer,group:layer.group||'sfx',mixBus:'injury',
        volume:layer.volume*severity,maxVoices:6,priority:5,position:null,occluded:false,
        rate:layer.rate+(Math.sin((Number(details.sequence)||0)*2.399+index)*.018),
        delay:Math.max(0,Number(details.delay)||0)+(layer.delay||0),loop:false});
      played=!!source||played;
    }
    if(played){
      this._duckBus('music',cue.duck,at,.28,.22);
      this._duckBus('ambience',Math.max(.58,cue.duck),at,.22,.25);
      this._duckBus('foley',.62,at,.18,.16);
      this._duckBus('weapons',name==='bite-terminal'?.72:.88,at,.12,.12);
    }
    return played;
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
    this.stopSpatialEmitters();
    this._spatialSources.clear();
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
    this._buses.clear();this._duckGains.clear();
    for(const node of [this._roomInput,this._mixInput,this._outputTrim])try{node?.disconnect();}catch{}
    this._roomInput=null;this._mixInput=null;this._outputTrim=null;
    this._voices.clear();
    this._soundEnvelopes.clear();
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
    this._normalizedPools=0;this._normalizedSamples=0;
    const pools = new Map();
    for (const [key, buffer] of this._buffers) {
      const trim=10**((AUDIO_ASSET_TRIMS_DB[key]||0)/20);
      this._bufferGains.set(buffer,trim);
      const poolKey = normalizationPoolKey(key);
      if (!poolKey) continue;
      let pool = pools.get(poolKey);
      if (!pool) { pool = []; pools.set(poolKey, pool); }
      pool.push({ buffer, rms: sampleRms(buffer)*trim, trim });
    }
    for (const pool of pools.values()) {
      if (pool.length < 2) continue;
      const target = median(pool.map(item => item.rms).filter(value => value > 0));
      if (!target) continue;
      this._normalizedPools++;
      for (const item of pool) {
        if (!item.rms) continue;
        const level = clamp(target / item.rms, .708, 1.413);
        this._bufferGains.set(item.buffer, item.trim*level);
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

  // Keyed world samples own their panner for their entire lifetime. Ordinary
  // play() calls stay one-shots; moving enemy calls can opt into trackKey.
  startSpatialEmitter(id, cue, details = {}) {
    if (!id || this._disposed || this._paused || !this._ctx || this._ctx.state === 'closed' || !details.position) return false;
    if (this._spatialEmitters.has(id)) return this.updateSpatialEmitter(id, details);
    if (this._spatialEmitters.size >= 4) return false;
    const buffer = this._chooseBuffer(cue, 0, details.variant);
    if (!buffer) return false;
    const loop = Boolean(details.loop), type = loop ? 'spatial-bed' : 'spatial-detail';
    const source = this._playBuffer(buffer, type, 0, {group:'ambience',volume:.08,highpass:120,lowpass:5200,
      refDistance:2,maxDistance:24,rolloffFactor:1.25,fadeIn:loop?.6:.08,rate:1,priority:1,
      ...details,loop,maxVoices:4,emitterId:id});
    if (!source) return false;
    this._spatialEmitters.set(id, source);
    return true;
  }

  updateSpatialEmitter(id, details = {}) {
    const source = this._spatialEmitters.get(id);
    if (!source || !this._spatialSources.has(source)) return false;
    this._updateSpatialSource(source, details);
    return true;
  }

  stopSpatialEmitter(id, {immediate = false} = {}) {
    const source = this._spatialEmitters.get(id);
    if (!source) return false;
    this._spatialEmitters.delete(id);
    this._stopSpatialSource(source, immediate);
    return true;
  }

  stopSpatialEmitters({immediate = true} = {}) {
    for (const id of [...this._spatialEmitters.keys()]) this.stopSpatialEmitter(id, {immediate});
  }

  updateTrackedSources(resolve, occlusion) {
    if (this._disposed || this._paused) return;
    for (const source of this._spatialSources) {
      if (source._emitterId) continue; // The room director supplies these poses.
      const key = source._spatialProfile?.trackKey;
      let pose = key ? resolve?.(key) : {position:source._spatialProfile.position};
      if (!pose) {this._stopSpatialSource(source);continue;}
      if(key)pose={...pose,position:{...pose.position,y:pose.position.y+(Number(source._spatialProfile.trackOffsetY)||0)}};
      const occluded = occlusion ? occlusion(pose.position) : pose.occluded;
      this._updateSpatialSource(source, {...pose,occluded});
    }
  }

  spatialDiagnostics() {
    const describe = source => ({id:source._emitterId||null,type:source._spatialType,
      trackKey:source._spatialProfile?.trackKey||null,position:{...source._spatialProfile?.position},
      occluded:!!source._spatialProfile?.occluded,loop:source.loop,
      gain:source._deadArrivalGain?.gain.value??0,lowpass:source._spatialLowpass?.frequency.value??null});
    return {listener:{...this._listenerPosition},emitters:[...this._spatialEmitters.values()].map(describe),
      tracked:[...this._spatialSources].filter(s=>s._spatialProfile?.trackKey).map(describe),
      sources:this._spatialSources.size,paused:this._paused};
  }

  _stopSpatialSource(source, immediate = false) {
    this._spatialSources.delete(source);
    if (source._emitterId && this._spatialEmitters.get(source._emitterId) === source) this._spatialEmitters.delete(source._emitterId);
    const t=now(this._ctx);
    try {
      if (!immediate) {source._deadArrivalGain.gain.cancelScheduledValues(t);source._deadArrivalGain.gain.setTargetAtTime(.0001,t,.035);}
      source.stop(immediate?t:t+.15);
    } catch {}
    if(immediate){this._sources.delete(source);this._voices.get(source._spatialType)?.delete(source);}
  }

  _updateSpatialSource(source, details = {}) {
    const profile=source._spatialProfile;if(!profile||!this._ctx)return;
    Object.assign(profile,details);
    if(details.position) this._setSpatialPosition(source._spatialPanner,details.position,true);
    const L=this._listenerPosition,p=profile.position,t=now(this._ctx);
    const distance=Math.hypot(p.x-L.x,p.y-L.y,p.z-L.z);
    const lowpass=Math.min(profile.lowpass||20000,distance>5?Math.max(1900,7600-distance*180):20000,
      profile.occluded?(distance<3?2300:1300):20000);
    source._spatialLowpass?.frequency.setTargetAtTime(lowpass,t,.06);
    // Leave a one-shot's authored end fade intact. Its scheduled stop still
    // bounds the lifetime while moving/occlusion updates run at 20 Hz.
    const target=clamp(profile.volume??.38,0,1)*(source._normalizationGain??1)*(profile.occluded?.78:1);
    if ((!source._spatialEndAt || t<source._spatialEndAt-.1) && Math.abs(target-source._spatialGainTarget)>1e-7) {
      source._spatialGainTarget=target;
      source._deadArrivalGain.gain.cancelScheduledValues(t);
      source._deadArrivalGain.gain.setTargetAtTime(target,t,.06);
      if(source._spatialEndAt){const end=source._spatialEndAt;source._deadArrivalGain.gain.setValueAtTime(target,end-.025);source._deadArrivalGain.gain.linearRampToValueAtTime(.0001,end);}
    }
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
    panner.refDistance = clamp(details.refDistance ?? 1.2,.1,100);
    panner.maxDistance = clamp(details.maxDistance ?? 28,panner.refDistance,1000);
    panner.rolloffFactor = clamp(details.rolloffFactor ?? 1.1,0,10);
    this._setSpatialPosition(panner,position);
    return panner;
  }

  _setSpatialPosition(panner, position, smooth = false) {
    if(!panner)return;
    const p=[position.x,position.y??position.z,position.z??position.y].map(v=>Number.isFinite(v)?v:0),t=now(this._ctx);
    if(panner.positionX?.setValueAtTime) for(const [i,key]of ['positionX','positionY','positionZ'].entries()) {
      if(smooth)panner[key].setTargetAtTime(p[i],t,.025);else panner[key].setValueAtTime(p[i],t);
    } else panner.setPosition?.(...p);
  }

  _trimVoices(type, limit = 10, priority = 1) {
    const voices = this._voices.get(type);
    if (!voices || !limit) return true;
    while (voices.size >= limit) {
      const oldest = [...voices].sort((a,b)=>(a._mixPriority||1)-(b._mixPriority||1))[0];
      if (!oldest) break;
      if(priority<(oldest._mixPriority||1)){this._droppedVoices++;return false;}
      try {oldest._deadArrivalGain?.gain.setTargetAtTime(.0001,now(this._ctx),.005);oldest.stop(now(this._ctx)+.02);} catch {}
      this._sources.delete(oldest);
      this._spatialSources.delete(oldest);
      if(oldest._emitterId&&this._spatialEmitters.get(oldest._emitterId)===oldest)this._spatialEmitters.delete(oldest._emitterId);
      voices.delete(oldest);
      this._droppedVoices++;
    }
    return true;
  }

  _filterNode(input, profile, owner = null) {
    let node = input;
    if(profile.bodyDb){const body=this._ctx.createBiquadFilter();body.type='lowshelf';body.frequency.value=180;body.gain.value=profile.bodyDb;node.connect(body);owner?._spatialNodes.push(body);node=body;}
    if (profile.highpass) {
      const highpass = this._ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = profile.highpass;
      highpass.Q.value = .55;
      node.connect(highpass);
      owner?._spatialNodes.push(highpass);
      node = highpass;
    }
    if (profile.lowpass) {
      const lowpass = this._ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = profile.lowpass;
      lowpass.Q.value = .5;
      node.connect(lowpass);
      if(owner){owner._spatialNodes.push(lowpass);owner._spatialLowpass=lowpass;}
      node = lowpass;
    }
    return node;
  }

  _playBuffer(buffer, type, weapon = 0, details = {}) {
    const profile = { ...resolveMix(type, weapon), ...details };
    const spatialProfile = profile.position ? {...profile,position:{...profile.position}} : null;
    const position=profile.position,L=this._listenerPosition;
    const distance=position?Math.hypot((position.x||0)-L.x,(position.y||0)-L.y,(position.z||0)-L.z):0;
    // Distant idle crowds do not consume the voice budget needed by an attack.
    if((type==='moan'&&distance>26)||(profile.maxDistance&&distance>profile.maxDistance*1.2)){this._droppedVoices++;return null;}
    if(type==='moan'&&(this._voices.get('enemyattack')?.size||0)>0){this._droppedVoices++;return null;}
    if(position&&distance>5)profile.lowpass=Math.min(profile.lowpass||10000,Math.max(1900,7600-distance*180));
    if(profile.occluded&&position){profile.lowpass=Math.min(profile.lowpass||10000,distance<3?2300:1300);profile.volume=(profile.volume??.3)*.78;}
    const source = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    const group = profile.group || GROUP_BY_TYPE[type] || 'sfx';
    const level = clamp(profile.volume ?? .38, 0, 1);
    const maxVoices = Math.max(1, Math.floor(Number(profile.maxVoices) || 10));
    source._mixPriority=(profile.priority||1)/(1+distance*.08);
    if (type !== 'ambience'&&!this._trimVoices(type, maxVoices,source._mixPriority))return null;
    source.buffer = buffer;
    const rateMin = type === 'footstep' ? .93 : .97;
    const rateMax = type === 'footstep' ? 1.07 : 1.03;
    source.playbackRate.value = clamp(profile.rate ?? random(rateMin, rateMax), 0.5, 2);
    if (profile.detune !== undefined) source.detune.value = Number(profile.detune) || 0;
    const t = now(this._ctx), bufferGain = level * (this._bufferGains.get(buffer) ?? 1);
    const at=t+Math.max(0,Number(profile.delay)||0);
    if(type==='shot'||type==='explosion'){
      this._duckBus('music',.58,at,.16,.16);this._duckBus('ambience',.78,at,.12,.20);
    }else if(['enemyattack','ceiling-scream','window-scream','damage'].includes(type)&&distance<9){
      this._duckBus('weapons',.76,at,.16,.12);this._duckBus('foley',.58,at,.20,.18);this._duckBus('music',.48,at,.24,.24);
    }
    if (Number(profile.fadeIn) > 0) {
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.setTargetAtTime(bufferGain, t, Math.max(.02, Number(profile.fadeIn) / 3));
    } else gain.gain.setValueAtTime(bufferGain, t);
    // Persistent melee loops need to retune their gain while they are live.
    // Keep the node private to the source so one-shot callers remain unchanged.
    source._deadArrivalGain = gain;
    source._spatialGainTarget=bufferGain;
    if(spatialProfile){source._spatialProfile=spatialProfile;source._spatialType=type;source._emitterId=profile.emitterId||null;
      source._spatialNodes=[gain];source._normalizationGain=this._bufferGains.get(buffer)??1;}
    source.connect(gain);
    let node = this._filterNode(gain, profile, spatialProfile?source:null);
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
    if(spatial){node.connect(spatial);node=spatial;source._spatialPanner=spatial;source._spatialNodes.push(spatial);this._spatialSources.add(source);}
    const weaponBus=type==='shot'||type==='mechanism'||type==='rocket'||type==='explosion'||type.startsWith('chainsaw');
    node.connect(group==='sfx'?(this._buses.get(profile.mixBus||(weaponBus?'weapons':'foley'))||this._group(group)):this._group(group));
    if(this._roomInput&&['shot','explosion','melee-wall'].includes(type))node.connect(this._roomInput);
    if (source.loop && type === 'ambience') {
      this._stopAmbient();
      this._ambientSource = source;
      this._ambientGain = gain;
    }
    this._track(source, source.loop, type);
    source.start(at,source.loop?clamp(profile.offset??0,0,Math.max(0,buffer.duration-.005)):0);
    if(!source.loop&&Number(profile.duration)>0){
      const end=at+Math.min(Number(profile.duration),buffer.duration/Math.max(.5,source.playbackRate.value));
      source._spatialEndAt=end;
      gain.gain.setValueAtTime(bufferGain,Math.max(at,end-.025));
      gain.gain.linearRampToValueAtTime(.0001,end);
      source.stop(end+.005);
    }
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
      this._spatialSources.delete(source);
      if(source._emitterId&&this._spatialEmitters.get(source._emitterId)===source)this._spatialEmitters.delete(source._emitterId);
      for(const node of source._spatialNodes||[])try{node.disconnect();}catch{}
      try{source.disconnect();}catch{}
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
