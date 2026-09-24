import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import AudioSystem from '../assets/audio.js';
import { AUDIO_ASSET_MANIFEST } from '../assets/audio-manifest.js';

const assetPath = relative => path.resolve('assets', relative.replace(/^\.\//, ''));

test('melee manifest points at real dedicated audio files', () => {
  const required = [
    'bat-swing', 'melee-hit', 'melee-wall',
    'chainsaw-start', 'chainsaw-motor', 'chainsaw-contact',
    'chainsaw-hit', 'chainsaw-wall', 'chainsaw-stop',
  ];
  for (const key of required) {
    assert.ok(Array.isArray(AUDIO_ASSET_MANIFEST[key]), `${key} pool is missing`);
    assert.ok(AUDIO_ASSET_MANIFEST[key].length > 0, `${key} pool is empty`);
    for (const file of AUDIO_ASSET_MANIFEST[key]) {
      assert.ok(fs.existsSync(assetPath(file)), `${key} asset does not exist: ${file}`);
    }
  }
  assert.equal(AUDIO_ASSET_MANIFEST.shot.length, 6, 'the six existing weapon pools remain intact');
  assert.equal(AUDIO_ASSET_MANIFEST.mechanism.length, 6, 'the six existing mechanism pools remain intact');
});

class FakeParam {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor() { this.listeners = new Map(); this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() {}
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

class FakeSource extends FakeNode {
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.playbackRate = new FakeParam(1);
    this.detune = new FakeParam(0);
    this.started = 0;
    this.stopped = 0;
    this.loop = false;
    ctx.sources.push(this);
  }
  start() { this.started++; }
  stop() { this.stopped++; }
}

class FakeContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.sources = [];
    this.listener = {};
  }
  createBufferSource() { return new FakeSource(this); }
  createGain() { const node = new FakeNode(); node.gain = new FakeParam(1); return node; }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { const node = new FakeNode(); node.frequency = new FakeParam(0); node.Q = new FakeParam(0); return node; }
  createPanner() { const node = new FakeNode(); for (const key of ['positionX', 'positionY', 'positionZ']) node[key] = new FakeParam(0); return node; }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

test('chainsaw update keeps one motor and one contact loop across held frames', () => {
  const audio = new AudioSystem();
  const context = new FakeContext();
  audio._ctx = context;
  audio._master = audio._groups.set('master', context.createGain()).get('master');
  audio._groups.set('sfx', context.createGain());
  audio._loaded = true;
  audio._buffers.set('chainsaw-start:0', { duration: 1.5, numberOfChannels: 1 });
  audio._buffers.set('chainsaw-motor:0', { duration: 7, numberOfChannels: 1 });
  audio._buffers.set('chainsaw-contact:0', { duration: 4.5, numberOfChannels: 1 });
  audio._buffers.set('chainsaw-stop:0', { duration: 1.8, numberOfChannels: 1 });

  audio.updateMelee({ weapon: 7, active: true, rev: .8, contact: true, playing: true });
  assert.ok(audio._meleeMotorSource?.loop, 'motor source should be persistent');
  assert.ok(audio._meleeContactSource?.loop, 'contact source should be persistent');
  const sourceCount = context.sources.length;
  audio.updateMelee({ weapon: 7, active: true, rev: .95, contact: true, playing: true });
  assert.equal(context.sources.length, sourceCount, 'held input must not stack loops');

  audio.updateMelee({ weapon: 7, active: false, rev: 0, contact: false, playing: true });
  assert.equal(audio._meleeMotorSource, null);
  assert.equal(audio._meleeContactSource, null);
  assert.equal(audio.meleeDiagnostics().startupSources, 0, 'release stops the pull-start transient');
  assert.equal(audio.meleeDiagnostics().shutdownSources, 1, 'release owns one shutdown tail');
  assert.equal(context.sources.filter(source => source.stopped > 0).length, 3, 'release stops startup and both persistent sources');
  assert.ok(context.sources.some(source => source.started && source !== audio._meleeMotorSource), 'release has a sampled shutdown source');
  audio.updateMelee({ weapon: 7, active: true, rev: .3, contact: false, playing: true });
  assert.equal(audio.meleeDiagnostics().shutdownSources, 0, 'quick restart cancels the pending shutdown tail');
  assert.equal(audio.meleeDiagnostics().startupSources, 1, 'quick restart owns one fresh startup cue');
  audio.updateMelee({ weapon: 7, active: false, rev: 0, contact: false, playing: false });
  assert.equal(audio.meleeDiagnostics().shutdownSources, 0, 'pause/death suppresses a pending shutdown tail');
  assert.equal(audio.meleeDiagnostics().startupSources, 0, 'pause/death stops the fresh startup cue');
  assert.ok(context.sources.every(source => source.stopped > 0), 'pause/death stops every melee source');
  audio.dispose();
});
