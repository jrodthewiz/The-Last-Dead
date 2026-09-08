import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..');
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    process.env.FINDLE_PLAYWRIGHT_PATH,
    'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright',
    path.resolve(PROJECT_ROOT, '..', 'Dogfight', 'node_modules', 'playwright'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch { /* try the next known location */ }
  }
  throw new Error('Playwright was not found. Set FINDLE_PLAYWRIGHT_PATH to the installed package.');
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  return candidates.find(existsSync);
}

async function waitForConnected(page) {
  await page.waitForFunction(() => Boolean(window.__deadArrivalSession?.connected), undefined, { timeout: 20_000 });
}

function rawStatus(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method: 'GET' }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
    request.end();
  });
}
async function installPeer(page, label) {
  await page.goto(`${page.__deadArrivalBase}/tests/network-fixture.html`, { waitUntil: 'load' });
  await page.evaluate(async peerLabel => {
    const { PeerSession } = await import(`/peer.js?peer=${encodeURIComponent(peerLabel)}`);
    window.__deadArrivalEvents = [];
    window.__deadArrivalMessages = [];
    window.__deadArrivalSession = new PeerSession({
      // The local test intentionally exercises host candidates without a
      // public relay. Production can omit this to use the standard STUN URL.
      stunUrls: [],
      iceGatherTimeoutMs: 3_000,
      onStatus: (state, event) => window.__deadArrivalEvents.push(event),
      onMessage: message => window.__deadArrivalMessages.push(message),
    });
  }, label);
}

async function main() {
  const playwright = loadPlaywright();
  const executablePath = chromeExecutable();
  if (!executablePath) throw new Error('Chrome executable not found; set CHROME_PATH explicitly.');

  const running = await startServer({ root: PROJECT_ROOT, port: 0, spaFallback: false });
  const base = `http://127.0.0.1:${running.port}`;
  let browser;
  try {
    const peerResponse = await fetch(`${base}/peer.js`);
    assert.equal(peerResponse.status, 200);
    assert.match(peerResponse.headers.get('content-type') || '', /javascript/);
    const traversalStatus = await rawStatus(running.port, '/%2e%2e/peer.js');
    assert.equal(traversalStatus, 404, 'path traversal must stay inside --dist');

    const { chromium } = playwright;
    browser = await chromium.launch({ headless: true, executablePath });
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    // Playwright page objects are extensible; this avoids duplicating the
    // ephemeral base URL in every evaluate call.
    hostPage.__deadArrivalBase = base;
    guestPage.__deadArrivalBase = base;
    try {
      await Promise.all([installPeer(hostPage, 'host'), installPeer(guestPage, 'guest')]);
      const offer = await hostPage.evaluate(() => window.__deadArrivalSession.host());
      assert.match(offer, /"type":"offer"/);
      const answer = await guestPage.evaluate(value => window.__deadArrivalSession.join(value), offer);
      assert.match(answer, /"type":"answer"/);
      await hostPage.evaluate(value => window.__deadArrivalSession.accept(value), answer);
      await Promise.all([waitForConnected(hostPage), waitForConnected(guestPage)]);

      assert.equal(await hostPage.evaluate(() => window.__deadArrivalSession.send({ t: 'event', id: 7, action: 'start' })), true);
      await guestPage.waitForFunction(() => window.__deadArrivalMessages.some(message => message.t === 'event'), undefined, { timeout: 5_000 });

      for (let sequence = 0; sequence < 5; sequence += 1) {
        const accepted = await hostPage.evaluate(s => window.__deadArrivalSession.send({ t: 'snapshot', s, state: { x: s * 2, gore: s } }), sequence);
        assert.equal(accepted, true);
      }
      await guestPage.waitForFunction(() => window.__deadArrivalMessages.filter(message => message.t === 'snapshot').length === 5, undefined, { timeout: 5_000 });
      const order = await guestPage.evaluate(() => window.__deadArrivalMessages.filter(message => message.t === 'snapshot').map(message => message.s));
      assert.deepEqual(order, [0, 1, 2, 3, 4], 'ordered channel must preserve snapshot order');

      assert.equal(await guestPage.evaluate(() => window.__deadArrivalSession.send({ t: 'input', i: { forward: 1, turn: 0.2 } })), true);
      await hostPage.waitForFunction(() => window.__deadArrivalMessages.some(message => message.t === 'input'), undefined, { timeout: 5_000 });
      await hostPage.waitForFunction(() => typeof window.__deadArrivalSession.rtt === 'number', undefined, { timeout: 5_000 });
      assert.equal(await guestPage.evaluate(() => window.__deadArrivalSession.send(['invalid-top-level'])), false);

      await guestPage.evaluate(() => window.__deadArrivalSession.close());
      await hostPage.waitForFunction(() => window.__deadArrivalEvents.some(event => event.state === 'disconnected'), undefined, { timeout: 5_000 });
      console.log(`WebRTC two-context test passed (host RTT ${await hostPage.evaluate(() => window.__deadArrivalSession.rtt)} ms).`);
    } finally {
      await Promise.allSettled([hostContext.close(), guestContext.close()]);
    }
  } finally {
    await browser?.close();
    running.server.closeIdleConnections?.();
    running.server.closeAllConnections?.();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 1_000);
      running.server.close(() => { clearTimeout(timer); resolve(); });
    });
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
