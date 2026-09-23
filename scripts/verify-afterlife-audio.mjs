#!/usr/bin/env node
/*
 * Lightweight verification for the derived afterlife audio set.
 *
 * Usage:
 *   node scripts/verify-afterlife-audio.mjs [--ffmpeg <path>]
 *
 * The check imports the live manifest, resolves every afterlife reference,
 * decodes each shipped Ogg through ffmpeg one at a time, and enforces the
 * runtime size/duration budget. It never starts a browser or writes output.
 */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIO_ASSET_MANIFEST } from '../assets/audio-manifest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const ffmpegIndex = argv.indexOf('--ffmpeg');
const FFMPEG = (ffmpegIndex >= 0 && argv[ffmpegIndex + 1])
  || process.env.FFMPEG_PATH
  || 'C:/Program Files/ImageMagick-7.1.0-Q16-HDRI/ffmpeg.exe';
const AFTERLIFE_ROOT = path.join(ROOT, 'assets', 'audio', 'afterlife');
const MAX_BYTES = 2 * 1024 * 1024;
const DURATION_LIMITS = Object.freeze({
  'air-corridor-loop.ogg': [8, 30],
  'room-creak.ogg': [1.2, 3.2],
  'enemy-onset.ogg': [.2, 1.2],
  'weapon-latch-metal.ogg': [.05, .4],
  'weapon-latch-bone.ogg': [.05, .4],
});

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function manifestPaths() {
  const paths = [];
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') return Object.values(value).forEach(visit);
    if (typeof value === 'string' && value.includes('/afterlife/')) paths.push(value);
  };
  visit(AUDIO_ASSET_MANIFEST);
  return [...new Set(paths)];
}

function parseDuration(stderr) {
  const match = /Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || '');
  if (!match) return NaN;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const referenced = manifestPaths();
const expected = Object.keys(DURATION_LIMITS).map(name => `./audio/afterlife/${name}`);
for (const rel of expected) if (!referenced.includes(rel)) fail(`manifest missing ${rel}`);

let total = 0;
for (const name of Object.keys(DURATION_LIMITS)) {
  const file = path.join(AFTERLIFE_ROOT, name);
  let bytes = 0;
  try { bytes = statSync(file).size; } catch { fail(`missing ${path.relative(ROOT, file)}`); continue; }
  total += bytes;
  const [min, max] = DURATION_LIMITS[name];
  const target = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const result = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'null', target], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`decode failed ${name}: ${(result.stderr || '').trim()}`);
    continue;
  }
  const probe = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-f', 'null', target], { encoding: 'utf8' });
  const duration = parseDuration(`${probe.stdout || ''}\n${probe.stderr || ''}`);
  if (!Number.isFinite(duration) || duration < min || duration > max) fail(`duration ${name}=${duration}s outside ${min}-${max}s`);
  console.log(`PASS ${name} ${(bytes / 1024).toFixed(1)} KiB ${duration.toFixed(2)}s`);
}

if (total > MAX_BYTES) fail(`afterlife audio budget ${(total / 1024 / 1024).toFixed(2)} MiB exceeds 2.00 MiB`);
else console.log(`PASS total ${(total / 1024).toFixed(1)} KiB <= 2.00 MiB`);
if (process.exitCode) process.exit(process.exitCode);
