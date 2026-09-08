/**
 * Dead Arrival's small, opinionated transport layer.
 *
 * Signalling is deliberately out of band: a host creates an offer, a guest
 * turns that offer into an answer, and the host accepts the answer.  The
 * resulting DataChannel is ordered and reliable, so gameplay code can send
 * both short events and authoritative snapshots through send().
 */

export const PEER_PROTOCOL_VERSION = 1;
// Large enough for authoritative snapshots with gore/tracer state while
// remaining small enough to reject accidental full asset uploads.
export const DEFAULT_MAX_MESSAGE_BYTES = 128 * 1024;
export const DEFAULT_ICE_GATHER_TIMEOUT_MS = 8_000;

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const DATA_CHANNEL_LABEL = 'dead-arrival-v1';
const DATA_CHANNEL_PROTOCOL = 'dead-arrival/1';
const SIGNAL_MAX_BYTES = 256 * 1024;
const HANDSHAKE_TIMEOUT_MS = 15_000;
const PING_INTERVAL_MS = 1_000;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object';
const isPlainObject = value => {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function byteLength(value) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength;
  return unescape(encodeURIComponent(value)).length;
}

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function validateJsonShape(value, depth = 0, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth > 8 || !isObject(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    if (value.length > 2048) valid = false;
    for (const item of value) {
      if (!validateJsonShape(item, depth + 1, seen)) {
        valid = false;
        break;
      }
    }
  } else if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length > 128) valid = false;
    for (const key of keys) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        valid = false;
        break;
      }
      if (typeof value[key] === 'string' && value[key].length > 64 * 1024) {
        valid = false;
        break;
      }
      if (!validateJsonShape(value[key], depth + 1, seen)) {
        valid = false;
        break;
      }
    }
  } else {
    valid = false;
  }
  seen.delete(value);
  return valid;
}

function makeIceServers(options) {
  // Read connection credentials once while constructing the browser-owned
  // RTCPeerConnection. We intentionally do not retain the options or expose
  // these values through PeerSession or the signalling payload.
  const stunInput = options && (options.stunUrls ?? options.stunUrl);
  const stunUrls = stunInput === undefined
    ? DEFAULT_STUN_URLS
    : (Array.isArray(stunInput) ? stunInput : [stunInput]);
  const servers = [];
  const usableStun = stunUrls.filter(url => typeof url === 'string' && url.trim());
  if (usableStun.length) servers.push({ urls: usableStun });

  const turn = options && options.turn;
  const turnUrl = turn && (turn.urls ?? turn.url)
    ? (turn.urls ?? turn.url)
    : options && options.turnUrl;
  if (turnUrl) {
    const turnUrls = Array.isArray(turnUrl) ? turnUrl : [turnUrl];
    const turnServer = { urls: turnUrls.filter(url => typeof url === 'string' && url.trim()) };
    const username = turn && turn.username !== undefined ? turn.username : options.turnUsername;
    const credential = turn && turn.credential !== undefined ? turn.credential : options.turnCredential;
    if (username !== undefined) turnServer.username = username;
    if (credential !== undefined) turnServer.credential = credential;
    if (turnServer.urls.length) servers.push(turnServer);
  }
  return servers;
}

function parseSignal(signal, expectedType) {
  if (typeof signal !== 'string' || !signal.trim()) throw new TypeError('A non-empty SDP string is required.');
  if (byteLength(signal) > SIGNAL_MAX_BYTES) throw new RangeError('SDP payload exceeds the 256 KiB limit.');
  let parsed;
  try {
    parsed = JSON.parse(signal);
  } catch {
    parsed = { v: PEER_PROTOCOL_VERSION, type: expectedType, sdp: signal.trim() };
  }
  if (!isPlainObject(parsed) || parsed.v !== PEER_PROTOCOL_VERSION || parsed.type !== expectedType || typeof parsed.sdp !== 'string') {
    throw new TypeError(`Expected a Dead Arrival v${PEER_PROTOCOL_VERSION} ${expectedType} envelope.`);
  }
  if (!parsed.sdp.startsWith('v=0')) throw new TypeError('SDP is missing the v=0 header.');
  return { type: parsed.type, sdp: parsed.sdp };
}

function encodeSignal(description) {
  const envelope = JSON.stringify({ v: PEER_PROTOCOL_VERSION, type: description.type, sdp: description.sdp });
  if (byteLength(envelope) > SIGNAL_MAX_BYTES) throw new RangeError('Generated SDP exceeds the 256 KiB limit.');
  return envelope;
}

function waitForIceGathering(peer, timeoutMs, emitStatus) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve(peer.localDescription);
  return new Promise(resolve => {
    let settled = false;
    const finish = timedOut => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', onState);
      if (timedOut) emitStatus('ice-timeout', { timeoutMs });
      resolve(peer.localDescription);
    };
    const onState = () => {
      if (peer.iceGatheringState === 'complete') finish(false);
    };
    const timer = setTimeout(() => finish(true), timeoutMs);
    peer.addEventListener('icegatheringstatechange', onState);
  });
}

export class PeerSession {
  constructor(options = {}) {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is unavailable: this browser does not expose RTCPeerConnection.');
    }
    const {
      onStatus,
      onMessage,
      onConnect,
      onDisconnect,
      maxMessageBytes,
      iceGatherTimeoutMs,
    } = options || {};
    this.role = null;
    this.connected = false;
    this.rtt = null;
    this._onStatus = typeof onStatus === 'function' ? onStatus : () => {};
    this._onMessage = typeof onMessage === 'function' ? onMessage : () => {};
    this._onConnect = typeof onConnect === 'function' ? onConnect : () => {};
    this._onDisconnect = typeof onDisconnect === 'function' ? onDisconnect : () => {};
    this._maxMessageBytes = clampInteger(maxMessageBytes, DEFAULT_MAX_MESSAGE_BYTES, 4 * 1024, 512 * 1024);
    this._iceGatherTimeoutMs = clampInteger(iceGatherTimeoutMs, DEFAULT_ICE_GATHER_TIMEOUT_MS, 500, 30_000);
    this._pc = new RTCPeerConnection({ iceServers: makeIceServers(options || {}) });
    this._channel = null;
    this._closed = false;
    this._started = false;
    this._connectedOnce = false;
    this._disconnectNotified = false;
    this._handshakeTimer = null;
    this._pingTimer = null;
    this._pings = new Map();
    this._pingSequence = 0;
    this._bindPeerConnection();
  }

  _status(state, details = {}) {
    try {
      const event = { type: 'status', state, role: this.role, connected: this.connected, ...details };
      // Keep the first argument a compact string for HUD callbacks; the
      // structured event remains available as the second argument.
      this._onStatus(state, event);
    } catch {
      // Status reporting must never break transport state transitions.
    }
  }

  _bindPeerConnection() {
    this._pc.addEventListener('connectionstatechange', () => {
      const state = this._pc.connectionState;
      this._status(`connection-${state}`);
      if (state === 'failed') this._disconnect('connection-failed');
      if (state === 'closed') this._disconnect('connection-closed');
    });
    this._pc.addEventListener('iceconnectionstatechange', () => {
      this._status(`ice-${this._pc.iceConnectionState}`);
      if (this._pc.iceConnectionState === 'failed') this._disconnect('ice-failed');
    });
    this._pc.addEventListener('icecandidateerror', event => {
      this._status('ice-candidate-error', { code: event.errorCode, text: event.errorText || '' });
    });
    this._pc.addEventListener('datachannel', event => {
      if (this.role !== 'guest' || this._channel) {
        try { event.channel.close(); } catch { /* already closed */ }
        return;
      }
      this._bindChannel(event.channel);
    });
  }

  _bindChannel(channel) {
    this._channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.addEventListener('open', () => this._onChannelOpen());
    channel.addEventListener('message', event => this._onRawMessage(event.data));
    channel.addEventListener('error', event => this._status('channel-error', { error: String(event?.error || 'DataChannel error') }));
    channel.addEventListener('close', () => this._disconnect('channel-closed'));
  }

  _onChannelOpen() {
    this._status('channel-open');
    this._handshakeTimer = setTimeout(() => {
      if (!this.connected) this._status('handshake-timeout', { timeoutMs: HANDSHAKE_TIMEOUT_MS });
    }, HANDSHAKE_TIMEOUT_MS);
    if (this.role === 'host') this._sendInternal({ k: 'hello', v: PEER_PROTOCOL_VERSION });
  }

  _sendInternal(message) {
    if (!this._channel || this._channel.readyState !== 'open') return false;
    let encoded;
    try {
      encoded = JSON.stringify(message);
    } catch {
      return false;
    }
    if (byteLength(encoded) > this._maxMessageBytes) {
      this._status('message-rejected', { reason: 'outgoing-size', bytes: byteLength(encoded) });
      return false;
    }
    try {
      this._channel.send(encoded);
      return true;
    } catch (error) {
      this._status('send-error', { error: String(error?.message || error) });
      return false;
    }
  }

  _onRawMessage(raw) {
    if (typeof raw !== 'string') {
      this._status('message-rejected', { reason: 'binary-not-supported' });
      return;
    }
    const bytes = byteLength(raw);
    if (bytes > this._maxMessageBytes) {
      this._status('message-rejected', { reason: 'incoming-size', bytes });
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      this._status('message-rejected', { reason: 'invalid-json' });
      return;
    }
    if (!isPlainObject(message) || !validateJsonShape(message) || message.v !== PEER_PROTOCOL_VERSION || typeof message.k !== 'string') {
      this._status('message-rejected', { reason: 'invalid-shape' });
      return;
    }
    if (message.k === 'hello') {
      if (this.role !== 'guest' || message.v !== PEER_PROTOCOL_VERSION) {
        this._status('message-rejected', { reason: 'unexpected-hello' });
        return;
      }
      this._sendInternal({ v: PEER_PROTOCOL_VERSION, k: 'hello-ack' });
      this._markConnected();
      return;
    }
    if (message.k === 'hello-ack') {
      if (this.role !== 'host') {
        this._status('message-rejected', { reason: 'unexpected-hello-ack' });
        return;
      }
      this._markConnected();
      return;
    }
    if (message.k === 'ping') {
      if (typeof message.id === 'number') this._sendInternal({ v: PEER_PROTOCOL_VERSION, k: 'pong', id: message.id });
      return;
    }
    if (message.k === 'pong') {
      const started = this._pings.get(message.id);
      if (started !== undefined) {
        this._pings.delete(message.id);
        this.rtt = Math.max(0, Math.round(now() - started));
        this._status('rtt', { rtt: this.rtt });
      }
      return;
    }
    if (message.k === 'app') {
      if (!this.connected || !isPlainObject(message.payload) || !validateJsonShape(message.payload)) {
        this._status('message-rejected', { reason: 'unexpected-app-message' });
        return;
      }
      try {
        this._onMessage(message.payload, this);
      } catch {
        this._status('message-handler-error');
      }
      return;
    }
    this._status('message-rejected', { reason: 'unknown-kind', kind: message.k });
  }

  _markConnected() {
    if (this.connected || this._closed) return;
    this.connected = true;
    this._connectedOnce = true;
    clearTimeout(this._handshakeTimer);
    this._status('connected');
    this._startPing();
    try { this._onConnect(this); } catch { /* consumer errors do not close the peer */ }
  }

  _startPing() {
    clearInterval(this._pingTimer);
    const ping = () => {
      if (!this.connected) return;
      const id = ++this._pingSequence;
      this._pings.set(id, now());
      for (const [oldId, started] of this._pings) {
        if (now() - started > 10_000) this._pings.delete(oldId);
      }
      this._sendInternal({ v: PEER_PROTOCOL_VERSION, k: 'ping', id });
    };
    ping();
    this._pingTimer = setInterval(ping, PING_INTERVAL_MS);
  }

  _disconnect(reason) {
    const wasConnected = this.connected;
    this.connected = false;
    clearInterval(this._pingTimer);
    clearTimeout(this._handshakeTimer);
    this._pingTimer = null;
    if ((wasConnected || this._connectedOnce) && !this._disconnectNotified) {
      this._disconnectNotified = true;
      this._status('disconnected', { reason });
      try { this._onDisconnect({ reason, session: this }); } catch { /* consumer errors do not escape */ }
    }
  }

  _assertNewSession() {
    if (this._started || this._closed) throw new Error('PeerSession can only be started once.');
    this._started = true;
  }

  /** Create and fully ICE-gather a host offer for manual copy/paste. */
  async host() {
    this._assertNewSession();
    this.role = 'host';
    this._status('creating-offer');
    const channel = this._pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
      protocol: DATA_CHANNEL_PROTOCOL,
    });
    this._bindChannel(channel);
    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    await waitForIceGathering(this._pc, this._iceGatherTimeoutMs, (state, details) => this._status(state, details));
    if (!this._pc.localDescription) throw new Error('WebRTC did not produce a local offer.');
    this._status('offer-ready');
    return encodeSignal(this._pc.localDescription);
  }

  /** Apply a host offer and return a fully ICE-gathered guest answer. */
  async join(offer) {
    this._assertNewSession();
    this.role = 'guest';
    this._status('accepting-offer');
    const description = parseSignal(offer, 'offer');
    await this._pc.setRemoteDescription(description);
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);
    await waitForIceGathering(this._pc, this._iceGatherTimeoutMs, (state, details) => this._status(state, details));
    if (!this._pc.localDescription) throw new Error('WebRTC did not produce a local answer.');
    this._status('answer-ready');
    return encodeSignal(this._pc.localDescription);
  }

  /** Apply the guest's answer to the host peer connection. */
  async accept(answer) {
    if (this.role !== 'host' || !this._started || this._closed) throw new Error('accept() requires an active host session.');
    this._status('accepting-answer');
    await this._pc.setRemoteDescription(parseSignal(answer, 'answer'));
    this._status('answer-accepted');
  }

  /** Send a JSON-safe application object over the ordered reliable channel. */
  send(payload) {
    if (!this.connected || !isPlainObject(payload) || !validateJsonShape(payload)) return false;
    let message;
    try {
      message = JSON.stringify({ v: PEER_PROTOCOL_VERSION, k: 'app', payload });
    } catch {
      return false;
    }
    const bytes = byteLength(message);
    if (bytes > this._maxMessageBytes) {
      this._status('message-rejected', { reason: 'outgoing-size', bytes });
      return false;
    }
    if (!this._channel || this._channel.readyState !== 'open') return false;
    // Reliable ordered channels queue rather than drop. Let the host skip a
    // frame before an unbounded queue turns a slow peer into a memory leak.
    if (this._channel.bufferedAmount > this._maxMessageBytes * 16) {
      this._status('message-rejected', { reason: 'backpressure', bufferedBytes: this._channel.bufferedAmount });
      return false;
    }
    try {
      this._channel.send(message);
      return true;
    } catch (error) {
      this._status('send-error', { error: String(error?.message || error) });
      return false;
    }
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._disconnect('local-close');
    try { this._channel?.close(); } catch { /* already closed */ }
    try { this._pc.close(); } catch { /* already closed */ }
    this._channel = null;
    // Keep the closed RTCPeerConnection object for late statechange events;
    // it contains only browser-owned ICE state and cannot be reused.
  }
}

export default PeerSession;
