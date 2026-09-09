/**
 * Small HTTP rendezvous client for the game's WebRTC transport.
 *
 * The server only exchanges the host offer and guest answer. Gameplay stays
 * on the ordered WebRTC DataChannel in peer.js. A room code is a short,
 * expiring bearer token; no account or browser secret is involved.
 */

export const SIGNALING_PATH = '/__dead_arrival/signal';
export const SIGNALING_TIMEOUT_MS = 12_000;
export const SIGNALING_ROOM_TIMEOUT_MS = 2 * 60 * 1000;
export const SIGNALING_POLL_MS = 500;

const ROOM_CODE_PATTERN = /^[A-Z2-9]{6}$/;

function normaliseCode(value) {
  const code = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) throw new TypeError('Enter the six-character co-op code.');
  return code;
}

function normaliseSignal(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`A WebRTC ${label} is required.`);
  return value;
}

function defaultBaseUrl() {
  const configured = globalThis.__DEAD_ARRIVAL_SIGNAL_URL__
    || (typeof window !== 'undefined' ? window.__DEAD_ARRIVAL_SIGNAL_URL__ : '')
    || '';
  if (configured) return String(configured).replace(/\/+$/, '');
  if (typeof location !== 'undefined' && location.origin) return `${location.origin}${SIGNALING_PATH}`;
  return SIGNALING_PATH;
}

function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Signaling was cancelled.'), { name: 'AbortError', code: 'SIGNALING_ABORTED' }));
      return;
    }
    let timer;
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(Object.assign(new Error('Signaling was cancelled.'), { name: 'AbortError', code: 'SIGNALING_ABORTED' }));
    };
    const done = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    timer = setTimeout(done, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export class SignalingError extends Error {
  constructor(message, { code = 'SIGNALING_ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'SignalingError';
    this.code = code;
    this.status = status;
  }
}

export class SignalingClient {
  constructor({ baseUrl = defaultBaseUrl(), fetchImpl = globalThis.fetch, timeoutMs = SIGNALING_TIMEOUT_MS } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('This browser does not provide fetch for co-op signaling.');
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.fetch = fetchImpl;
    this.timeoutMs = Math.max(1_000, Number(timeoutMs) || SIGNALING_TIMEOUT_MS);
    this.roomCode = '';
    this._controllers = new Set();
  }

  _url(path) {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async _request(path, { method = 'GET', body, signal, timeoutMs = this.timeoutMs } = {}) {
    const controller = new AbortController();
    this._controllers.add(controller);
    const onAbort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
    try {
      const response = await this.fetch(this._url(path), {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* empty error responses are handled below */ }
      if (!response.ok) {
        throw new SignalingError(payload?.error || `Signaling request failed (${response.status}).`, {
          code: payload?.code || `HTTP_${response.status}`,
          status: response.status,
        });
      }
      return payload || {};
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        if (signal?.aborted) throw new SignalingError('Signaling was cancelled.', { code: 'SIGNALING_ABORTED' });
        throw new SignalingError('Signaling request timed out.', { code: 'SIGNALING_TIMEOUT' });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      this._controllers.delete(controller);
    }
  }

  async createRoom(offer, { signal } = {}) {
    const payload = await this._request('/rooms', { method: 'POST', body: { offer: normaliseSignal(offer, 'offer') }, signal });
    const code = normaliseCode(payload.code);
    this.roomCode = code;
    return { ...payload, code };
  }

  async getOffer(code, { signal } = {}) {
    const roomCode = normaliseCode(code);
    const payload = await this._request(`/rooms/${roomCode}/offer`, { signal });
    if (!payload.offer) throw new SignalingError('The co-op room did not return a host offer.', { code: 'INVALID_OFFER' });
    this.roomCode = roomCode;
    return payload.offer;
  }

  async submitAnswer(code, answer, { signal } = {}) {
    const roomCode = normaliseCode(code);
    const payload = await this._request(`/rooms/${roomCode}/answer`, {
      method: 'POST',
      body: { answer: normaliseSignal(answer, 'answer') },
      signal,
    });
    this.roomCode = roomCode;
    return payload;
  }

  async getAnswer(code, { signal } = {}) {
    const roomCode = normaliseCode(code);
    const payload = await this._request(`/rooms/${roomCode}/answer`, { signal });
    return payload.answer || null;
  }

  async waitForAnswer(code, { signal, timeoutMs = SIGNALING_ROOM_TIMEOUT_MS, pollMs = SIGNALING_POLL_MS } = {}) {
    const roomCode = normaliseCode(code);
    const deadline = Date.now() + Math.max(1_000, Number(timeoutMs) || SIGNALING_ROOM_TIMEOUT_MS);
    this.roomCode = roomCode;
    while (Date.now() < deadline) {
      const answer = await this.getAnswer(roomCode, {
        signal,
        timeoutMs: Math.min(this.timeoutMs, Math.max(1_000, deadline - Date.now())),
      });
      if (answer) return answer;
      await sleep(Math.min(Math.max(100, Number(pollMs) || SIGNALING_POLL_MS), Math.max(100, deadline - Date.now())), signal);
    }
    throw new SignalingError('Nobody joined this co-op room before it expired.', { code: 'SIGNALING_TIMEOUT' });
  }

  async closeRoom(code = this.roomCode, { signal } = {}) {
    if (!code) return;
    const roomCode = normaliseCode(code);
    try { await this._request(`/rooms/${roomCode}`, { method: 'DELETE', signal }); } finally {
      if (roomCode === this.roomCode) this.roomCode = '';
    }
  }

  abort() {
    for (const controller of this._controllers) controller.abort();
    this._controllers.clear();
  }
}

let peerJsPromise;

/** Load the pinned browser bundle from the game's own vendor directory. */
export function loadPeerJs(scriptUrl = '') {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerJsPromise) return peerJsPromise;
  if (typeof document === 'undefined') return Promise.reject(new Error('PeerJS requires a browser document.'));
  const source = scriptUrl || `${new URL('./vendor/peerjs.min.js', location.href).href}`;
  peerJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-dead-arrival-peerjs]');
    if (existing) {
      existing.addEventListener('load', () => resolve(globalThis.Peer), { once: true });
      existing.addEventListener('error', () => reject(new Error('The co-op network module could not load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.dataset.deadArrivalPeerjs = 'true';
    script.addEventListener('load', () => {
      if (typeof globalThis.Peer !== 'function') reject(new Error('The co-op network module loaded without a Peer client.'));
      else resolve(globalThis.Peer);
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('The co-op network module could not load.')), { once: true });
    document.head.append(script);
  }).catch(error => {
    document.querySelector('script[data-dead-arrival-peerjs]')?.remove();
    peerJsPromise = null;
    throw error;
  });
  return peerJsPromise;
}

function peerConfig() {
  const configured = globalThis.__DEAD_ARRIVAL_PEER_CONFIG__
    || (typeof window !== 'undefined' ? window.__DEAD_ARRIVAL_PEER_CONFIG__ : null)
    || {};
  return {
    host: configured.host || '0.peerjs.com',
    port: configured.port ?? 443,
    path: configured.path || '/',
    secure: configured.secure ?? true,
    ...(configured.key ? { key: configured.key } : {}),
    ...(configured.config ? { config: configured.config } : {}),
    debug: configured.debug ?? 0,
  };
}

function randomRoomCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 0xffffffff);
  return [...values].map(value => alphabet[value % alphabet.length]).join('');
}

function peerErrorMessage(error) {
  const rawType = String(error?.type || '');
  if (rawType === 'unavailable-id') return 'That co-op code is already in use. Please create another.';
  if (rawType === 'peer-unavailable') return 'That co-op code is not hosting a breach.';
  if (rawType === 'network') return 'The co-op signaling service is unreachable.';
  return error?.message || 'The co-op connection failed.';
}

/**
 * PeerJS-backed session with the same gameplay-facing API as PeerSession.
 * PeerJS brokers the SDP through its public server; the game still sends all
 * snapshots and inputs over its reliable P2P data connection.
 */
export class PeerJsSession {
  constructor(options = {}) {
    this.role = null;
    this.connected = false;
    this.rtt = null;
    this._onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
    this._onMessage = typeof options.onMessage === 'function' ? options.onMessage : () => {};
    this._onConnect = typeof options.onConnect === 'function' ? options.onConnect : () => {};
    this._onDisconnect = typeof options.onDisconnect === 'function' ? options.onDisconnect : () => {};
    this._peer = null;
    this._pendingPeer = null;
    this._pendingCancel = null;
    this._connection = null;
    this._closed = false;
    this._started = false;
    this._connectedOnce = false;
    this._disconnectNotified = false;
    this._handshakeTimer = null;
    this._pingTimer = null;
    this._pings = new Map();
    this._pingSequence = 0;
    this._peerConfig = peerConfig();
    this._connectTimeoutMs = Math.max(5_000, Number(options.connectTimeoutMs) || 20_000);
    this._handshakeTimeoutMs = Math.max(50, Number(options.handshakeTimeoutMs) || 15_000);
  }

  _status(state, details = {}) {
    try { this._onStatus(state, { type: 'status', state, role: this.role, connected: this.connected, ...details }); } catch { /* UI cannot break transport */ }
  }

  _assertNewSession() {
    if (this._started || this._closed) throw new Error('This co-op session has already started.');
    this._started = true;
  }

  async _makePeer(id) {
    const Peer = await loadPeerJs();
    return new Promise((resolve, reject) => {
      let settled = false;
      let peer;
      try { peer = new Peer(id, this._peerConfig); } catch (error) { reject(error); return; }
      this._pendingPeer = peer;
      let timer;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this._pendingPeer === peer) this._pendingPeer = null;
        if (this._pendingCancel) this._pendingCancel = null;
        peer.off?.('open', onOpen);
        peer.off?.('error', onError);
        peer.off?.('close', onClose);
        if (error) {
          try { peer.destroy(); } catch { /* already closed */ }
          reject(error);
        } else resolve(value);
      };
      const onOpen = () => finish(null, peer);
      const onError = error => finish(error);
      const onClose = () => finish(new Error('Co-op was cancelled.'));
      this._pendingCancel = () => finish(new Error('Co-op was cancelled.'));
      timer = setTimeout(() => finish(new Error('The co-op signaling service timed out.')), this._connectTimeoutMs);
      peer.on('open', onOpen);
      peer.on('error', onError);
      peer.on('close', onClose);
      if (this._closed) finish(new Error('Co-op was cancelled.'));
    });
  }

  async host() {
    this._assertNewSession();
    this.role = 'host';
    this._status('creating-room');
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomRoomCode();
      try {
        this._peer = await this._makePeer(code);
        if (this._closed) throw new Error('Co-op was cancelled.');
        this._bindPeer();
        this._status('room-ready', { code });
        return code;
      } catch (error) {
        lastError = error;
        if (error?.type !== 'unavailable-id') break;
      }
    }
    this._started = false;
    throw new Error(peerErrorMessage(lastError));
  }

  async join(code) {
    this._assertNewSession();
    const roomCode = normaliseCode(code);
    this.role = 'guest';
    this._status('joining-room', { code: roomCode });
    this._peer = await this._makePeer();
    if (this._closed) throw new Error('Co-op was cancelled.');
    this._bindPeer();
    const connection = this._peer.connect(roomCode, { reliable: true, serialization: 'json' });
    this._bindConnection(connection);
    await new Promise((resolve, reject) => {
      let settled = false;
      let timer;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        connection.off?.('open', onOpen);
        connection.off?.('error', onError);
        connection.off?.('close', onClose);
        if (error) reject(error); else resolve();
      };
      const onOpen = () => finish();
      const onError = error => finish(error);
      const onClose = () => finish(new Error('Co-op was cancelled.'));
      timer = setTimeout(() => finish(new Error('The host did not accept the co-op connection in time.')), this._connectTimeoutMs);
      connection.on('open', onOpen);
      connection.on('error', onError);
      connection.on('close', onClose);
    }).catch(error => {
      this.close();
      throw new Error(peerErrorMessage(error));
    });
    return roomCode;
  }

  _bindPeer() {
    this._peer.on('connection', connection => {
      if (this.role !== 'host' || this._connection) {
        try { connection.close(); } catch { /* already closed */ }
        return;
      }
      this._bindConnection(connection);
    });
    this._peer.on('disconnected', () => this._status('signaling-disconnected'));
    this._peer.on('close', () => this._disconnect('signaling-closed'));
    this._peer.on('error', error => {
      this._status('peer-error', { error: peerErrorMessage(error), type: error?.type || '' });
      if (!this.connected && this._started) this._disconnect(error?.type || 'peer-error');
    });
  }

  _bindConnection(connection) {
    this._connection = connection;
    connection.on('open', () => this._onChannelOpen());
    connection.on('data', data => this._onRawMessage(data));
    connection.on('error', error => this._status('channel-error', { error: peerErrorMessage(error) }));
    connection.on('close', () => this._disconnect('channel-closed'));
  }

  _onChannelOpen() {
    this._status('channel-open');
    this._handshakeTimer = setTimeout(() => {
      if (!this.connected) {
        this._status('handshake-timeout', { timeoutMs: this._handshakeTimeoutMs });
        this.close();
      }
    }, this._handshakeTimeoutMs);
    if (this.role === 'host') this._sendInternal({ k: 'hello', v: 1 });
  }

  _sendInternal(message) {
    if (!this._connection?.open) return false;
    try { this._connection.send(message); return true; } catch (error) {
      this._status('send-error', { error: String(error?.message || error) });
      return false;
    }
  }

  _onRawMessage(message) {
    if (!message || typeof message !== 'object' || message.v !== 1 || typeof message.k !== 'string') {
      this._status('message-rejected', { reason: 'invalid-shape' });
      return;
    }
    try {
      if (JSON.stringify(message).length > 128 * 1024) {
        this._status('message-rejected', { reason: 'incoming-size' });
        return;
      }
    } catch {
      this._status('message-rejected', { reason: 'invalid-json' });
      return;
    }
    if (message.k === 'hello') {
      if (this.role !== 'guest') return;
      this._sendInternal({ v: 1, k: 'hello-ack' });
      this._markConnected();
      return;
    }
    if (message.k === 'hello-ack') {
      if (this.role === 'host') this._markConnected();
      return;
    }
    if (message.k === 'ping') {
      if (typeof message.id === 'number') this._sendInternal({ v: 1, k: 'pong', id: message.id });
      return;
    }
    if (message.k === 'pong') {
      const started = this._pings.get(message.id);
      if (started !== undefined) {
        this._pings.delete(message.id);
        this.rtt = Math.max(0, Math.round(performance.now() - started));
        this._status('rtt', { rtt: this.rtt });
      }
      return;
    }
    if (message.k === 'app' && this.connected && message.payload && typeof message.payload === 'object') {
      try { this._onMessage(message.payload, this); } catch { this._status('message-handler-error'); }
    }
  }

  _markConnected() {
    if (this.connected || this._closed) return;
    this.connected = true;
    this._connectedOnce = true;
    clearTimeout(this._handshakeTimer);
    this._status('connected');
    clearInterval(this._pingTimer);
    const ping = () => {
      if (!this.connected) return;
      const id = ++this._pingSequence;
      this._pings.set(id, performance.now());
      for (const [oldId, started] of this._pings) {
        if (performance.now() - started > 10_000 || this._pings.size > 32) this._pings.delete(oldId);
      }
      this._sendInternal({ v: 1, k: 'ping', id });
    };
    ping();
    this._pingTimer = setInterval(ping, 1_000);
    try { this._onConnect(this); } catch { /* consumer errors do not close the session */ }
  }

  _disconnect(reason) {
    const wasConnected = this.connected;
    this.connected = false;
    clearTimeout(this._handshakeTimer);
    clearInterval(this._pingTimer);
    this._handshakeTimer = null;
    this._pingTimer = null;
    if ((wasConnected || this._connectedOnce) && !this._disconnectNotified) {
      this._disconnectNotified = true;
      this._status('disconnected', { reason });
      try { this._onDisconnect({ reason, session: this }); } catch { /* consumer errors do not escape */ }
    }
  }

  send(payload) {
    if (!this.connected || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    let message;
    try {
      message = { v: 1, k: 'app', payload };
      if (JSON.stringify(message).length > 128 * 1024) {
        this._status('message-rejected', { reason: 'outgoing-size' });
        return false;
      }
    } catch { return false; }
    const buffered = this._connection?.dataChannel?.bufferedAmount || 0;
    if (buffered > 2 * 1024 * 1024) {
      this._status('message-rejected', { reason: 'backpressure', bufferedBytes: buffered });
      return false;
    }
    try { this._connection.send(message); return true; } catch (error) {
      this._status('send-error', { error: String(error?.message || error) });
      return false;
    }
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this._disconnect('local-close');
    this._pendingCancel?.();
    this._pendingCancel = null;
    try { this._pendingPeer?.destroy(); } catch { /* already closed */ }
    this._pendingPeer = null;
    try { this._connection?.close(); } catch { /* already closed */ }
    try { this._peer?.destroy(); } catch { /* already closed */ }
    this._connection = null;
    this._peer = null;
  }
}

export default SignalingClient;
