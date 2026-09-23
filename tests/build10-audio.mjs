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
const result = { processed: [], browser: null, settings: null, errors };
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
    const generatedMethods = ['_synth', '_synthAccent', '_synthAmbience']
      .filter(name => typeof mod.AudioSystem.prototype[name] === 'function');
    const originalGroup = a._group;
    const routedGroups = [];
    let voiceEventPlayed = false;
    try {
      a._group = function (name) { routedGroups.push(name); return originalGroup.call(this, name); };
      voiceEventPlayed = a.play('enemyattack');
    } finally {
      a._group = originalGroup;
    }
    return {
      loaded: a.debugInfo.loaded,
      decoded: a.debugInfo.decoded,
      manifestEntries: a.debugInfo.manifestEntries,
      normalizedPools: a.debugInfo.normalizedPools,
      normalizedSamples: a.debugInfo.normalizedSamples,
      loadErrors: a.debugInfo.errors,
      generatedMethods,
      voiceEventPlayed,
      routedGroups,
    };
  });
  await page.evaluate(() => window.__DEAD_ARRIVAL__.pause());
  await page.locator('.pause-screen [data-action="settings"]').click();
  const testVolumes = { volume: .67, sfxVolume: .82, voiceVolume: .61, musicVolume: .37, ambienceVolume: .44, uiVolume: .29 };
  for (const [name, value] of Object.entries(testVolumes)) {
    await page.locator(`[data-setting="${name}"]`).evaluate((slider, next) => {
      slider.value = String(next);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
  result.settings = await page.evaluate(() => ({
    saved: JSON.parse(localStorage.getItem('dead-arrival-prefs-v1') || '{}'),
    liveMaster: window.__DEAD_ARRIVAL__.audio._volume,
    liveGroups: { ...window.__DEAD_ARRIVAL__.audio._groupVolumes },
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__DEAD_ARRIVAL__?.ui?.prefs));
  result.settings.restored = await page.evaluate(() => ({
    prefs: { ...window.__DEAD_ARRIVAL__.ui.prefs },
    master: window.__DEAD_ARRIVAL__.audio._volume,
    groups: { ...window.__DEAD_ARRIVAL__.audio._groupVolumes },
  }));
  await writeFile('docs/build10-audio/audio-runtime.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  const settingsPersisted = Object.entries(testVolumes).every(([name, value]) => Math.abs(Number(result.settings.restored.prefs[name]) - value) < .001);
  const groupSettings = { sfxVolume: 'sfx', voiceVolume: 'voice', musicVolume: 'music', ambienceVolume: 'ambience', uiVolume: 'ui' };
  const liveApplied = Object.entries(groupSettings).every(([pref, group]) => Math.abs(Number(result.settings.liveGroups[group]) - testVolumes[pref]) < .001);
  const restoredApplied = Object.entries(groupSettings).every(([pref, group]) => Math.abs(Number(result.settings.restored.groups[group]) - testVolumes[pref]) < .001);
  if (!result.processed.every(item => item.exists && item.bytes > 1000) || !result.browser.loaded || !result.browser.manifestEntries || result.browser.decoded !== result.browser.manifestEntries || result.browser.normalizedPools < 20 || result.browser.normalizedSamples < 60 || result.browser.loadErrors.length || result.browser.generatedMethods.length || !result.browser.voiceEventPlayed || !result.browser.routedGroups.includes('voice') || !settingsPersisted || !liveApplied || !restoredApplied || errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  preview.server.closeAllConnections();
  await new Promise(resolve => preview.server.close(resolve));
}
