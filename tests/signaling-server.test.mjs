import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server.mjs';

test('short-code signaling broker exchanges one offer and answer', async () => {
  const running = await startServer({ root: process.cwd(), host: '127.0.0.1', port: 0 });
  const base = `http://127.0.0.1:${running.port}/__dead_arrival/signal`;
  try {
    const offer = JSON.stringify({ v: 1, type: 'offer', sdp: 'v=0\r\n' });
    const created = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offer }),
    });
    assert.equal(created.status, 201);
    const room = await created.json();
    assert.match(room.code, /^[A-Z2-9]{6}$/);

    const receivedOffer = await fetch(`${base}/rooms/${room.code}/offer`);
    assert.equal(receivedOffer.status, 200);
    assert.equal((await receivedOffer.json()).offer, offer);

    const waiting = await fetch(`${base}/rooms/${room.code}/answer`);
    assert.equal(waiting.status, 202);

    const answer = JSON.stringify({ v: 1, type: 'answer', sdp: 'v=0\r\n' });
    const posted = await fetch(`${base}/rooms/${room.code}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    assert.equal(posted.status, 200);
    const receivedAnswer = await fetch(`${base}/rooms/${room.code}/answer`);
    assert.equal(receivedAnswer.status, 200);
    assert.equal((await receivedAnswer.json()).answer, answer);

    const closed = await fetch(`${base}/rooms/${room.code}`, { method: 'DELETE' });
    assert.equal(closed.status, 200);
    assert.equal((await fetch(`${base}/rooms/${room.code}/offer`)).status, 404);
  } finally {
    running.server.closeAllConnections?.();
    await new Promise(resolve => running.server.close(resolve));
  }
});
