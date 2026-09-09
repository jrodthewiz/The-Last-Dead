import test from 'node:test';
import assert from 'node:assert/strict';
import { PeerJsSession, SignalingClient, SignalingError } from '../signaling.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('creates a room and normalises a copied code', async () => {
  const calls = [];
  const client = new SignalingClient({
    baseUrl: 'https://signal.example.test/__dead_arrival/signal/',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(201, { code: 'abC234', expiresInMs: 600_000 });
    },
  });
  const room = await client.createRoom('{"v":1,"type":"offer","sdp":"v=0"}');
  assert.equal(room.code, 'ABC234');
  assert.equal(client.roomCode, 'ABC234');
  assert.equal(calls[0].url, 'https://signal.example.test/__dead_arrival/signal/rooms');
  assert.equal(JSON.parse(calls[0].init.body).offer.startsWith('{'), true);
});

test('polls a room until the host answer arrives', async () => {
  let polls = 0;
  const client = new SignalingClient({
    baseUrl: 'https://signal.example.test/__dead_arrival/signal',
    fetchImpl: async (url) => {
      polls += 1;
      if (url.endsWith('/offer')) return response(200, { offer: 'host-offer' });
      return polls < 3 ? response(202, { state: 'waiting' }) : response(200, { answer: 'guest-answer' });
    },
  });
  assert.equal(await client.getOffer(' ab c234 '), 'host-offer');
  const answer = await client.waitForAnswer('ABC234', { pollMs: 100, timeoutMs: 2_000 });
  assert.equal(answer, 'guest-answer');
  assert.equal(polls, 3);
});

test('cancels a pending poll without leaving a live timer', async () => {
  const abort = new AbortController();
  const client = new SignalingClient({
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    }),
  });
  const pending = client.waitForAnswer('ABC234', { signal: abort.signal, timeoutMs: 2_000, pollMs: 100 });
  abort.abort();
  await assert.rejects(pending, error => error instanceof SignalingError && error.code === 'SIGNALING_ABORTED');
});

test('closing a session cancels a pending public peer allocation immediately', async () => {
  const originalPeer = globalThis.Peer;
  class PendingPeer {
    constructor() { this.listeners = new Map(); }
    on(name, handler) { this.listeners.set(name, handler); }
    off(name, handler) { if (this.listeners.get(name) === handler) this.listeners.delete(name); }
    destroy() { this.listeners.get('close')?.(); }
  }
  globalThis.Peer = PendingPeer;
  try {
    const session = new PeerJsSession({ connectTimeoutMs: 5_000 });
    const pending = session.host();
    session.close();
    await assert.rejects(pending, /cancel/i);
  } finally {
    if (originalPeer === undefined) delete globalThis.Peer;
    else globalThis.Peer = originalPeer;
  }
});

test('a peer that opens but never completes the handshake is closed', async () => {
  const originalPeer = globalThis.Peer;
  const statuses = [];
  class FakeConnection {
    constructor() { this.listeners = new Map(); this.open = false; this.closed = false; }
    on(name, handler) { this.listeners.set(name, [...(this.listeners.get(name) || []), handler]); }
    off(name, handler) { this.listeners.set(name, (this.listeners.get(name) || []).filter(listener => listener !== handler)); }
    emit(name, ...args) { for (const listener of this.listeners.get(name) || []) listener(...args); }
    send() {}
    close() { this.closed = true; this.emit('close'); }
  }
  class FakePeer {
    constructor() { this.listeners = new Map(); setTimeout(() => this.listeners.get('open')?.('fake-peer'), 0); }
    on(name, handler) { this.listeners.set(name, handler); }
    off(name, handler) { if (this.listeners.get(name) === handler) this.listeners.delete(name); }
    connect() {
      const connection = new FakeConnection();
      setTimeout(() => { connection.open = true; connection.emit('open'); }, 0);
      return connection;
    }
    destroy() { this.listeners.get('close')?.(); }
  }
  globalThis.Peer = FakePeer;
  try {
    const session = new PeerJsSession({ connectTimeoutMs: 5_000, handshakeTimeoutMs: 50, onStatus: state => statuses.push(state) });
    await session.join('ABC234');
    await new Promise(resolve => setTimeout(resolve, 90));
    assert.equal(session._closed, true);
    assert.ok(statuses.includes('handshake-timeout'));
  } finally {
    if (originalPeer === undefined) delete globalThis.Peer;
    else globalThis.Peer = originalPeer;
  }
});
