import { createRequire } from 'node:module';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const processed = [
  'assets/audio/sfx/processed/ossuary-shot.wav',
  'assets/audio/sfx/processed/breach-shot.wav',
  'assets/audio/sfx/processed/arc-lance.wav',
  'assets/audio/sfx/processed/reliquary-launch.wav',
  'assets/audio/sfx/processed/impact-metal-flesh.wav',
  'assets/audio/sfx/processed/blood-burst.wav',
];
const preview = await startServer({ root: path.resolve('dist'), port: 0, host: '127.0.0.1' });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--use-angle=d3d11'] });
const errors = [];
const result = { processed: [], browser: null, accentSignals: [], errors };
try {
  for (const file of processed) {
    const info = await stat(file);
    result.processed.push({ file, bytes: info.size, exists: info.isFile() });
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`); });
  page.setDefaultTimeout(60000);await page.bringToFront();
  await page.goto(`http://127.0.0.1:${preview.port}/?debug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__DEAD_ARRIVAL__?.audio?.debugInfo?.loaded === true, undefined, { timeout: 60000 });
  result.browser = await page.evaluate(async () => {
    const d = window.__DEAD_ARRIVAL__;
    const a = d.audio;
    const mod = await import('/assets/audio.js');
    const mini = new mod.AudioSystem({ manifest: {} });
    const signals = [];
    const render = async (type, weapon = 0, details = {}) => {
      const context = new OfflineAudioContext(1, 48000 * 1.25, 48000);
      mini._ctx = context;
      mini._master = context.createGain();
      mini._master.connect(context.destination);
      mini._groups.clear();
      mini._sources.clear();
      const normalizedType = type === 'kill' ? 'enemydeath' : type;
      mini._synth(normalizedType, weapon, details);
      mini._synthAccent(normalizedType, weapon, details);
      const rendered = await context.startRendering();
      const samples = rendered.getChannelData(0);
      let peak = 0, power = 0, finite = true;
      for (const value of samples) {
        finite = finite && Number.isFinite(value);
        peak = Math.max(peak, Math.abs(value));
        power += value * value;
      }
      signals.push({ type, weapon, enemyKind: details.enemyKind, peak, rms: Math.sqrt(power / samples.length), finite });
    };
    for (let weapon = 0; weapon < 4; weapon++) await render('shot', weapon, { cooldown: 0 });
    for (const kind of [0, 1, 2]) {
      await render('enemyattack', 0, { enemyKind: kind, cooldown: 0 });
      await render('kill', 0, { enemyKind: kind, cooldown: 0 });
      await render('hit', 0, { enemyKind: kind, cooldown: 0 });
    }
    await render('explosion', 3, { cooldown: 0 });
    return {
      loaded: a.debugInfo.loaded,
      decoded: a.debugInfo.decoded,
      manifestEntries: a.debugInfo.manifestEntries,
      loadErrors: a.debugInfo.errors,
      signals,
    };
  });
  result.accentSignals = result.browser.signals;
  await writeFile('docs/build10-audio/audio-runtime.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.processed.every(item => item.exists && item.bytes > 1000) || !result.browser.loaded || result.browser.decoded < 37 || result.browser.loadErrors.length || result.accentSignals.some(signal => !signal.finite || signal.rms <= 0 || signal.peak >= 1.05) || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  preview.server.closeAllConnections();
  await new Promise(resolve => preview.server.close(resolve));
}