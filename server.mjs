import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { randomInt } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 5200;
const DEFAULT_ROOT = existsSync(path.join(HERE, 'dist')) ? path.join(HERE, 'dist') : HERE;
export const SIGNALING_PATH = '/__dead_arrival/signal';
export const SIGNALING_ROOM_TTL_MS = 10 * 60 * 1000;
export const SIGNALING_MAX_BODY_BYTES = 256 * 1024;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.wasm', 'application/wasm'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.flac', 'audio/flac'],
]);

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function decodePathname(rawPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPath || '/');
  } catch {
    const error = new Error('Malformed URL encoding.');
    error.code = 'BAD_PATH';
    throw error;
  }
  if (pathname.includes('\0')) {
    const error = new Error('NUL bytes are not valid in a URL path.');
    error.code = 'BAD_PATH';
    throw error;
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

async function findFile(root, pathname, spaFallback) {
  const decoded = decodePathname(pathname);
  const rootReal = await fs.realpath(root);
  let candidate = path.resolve(root, `.${decoded}`);
  if (!isInside(root, candidate)) return null;

  let stat;
  try {
    stat = await fs.stat(candidate);
  } catch (error) {
    if (error.code !== 'ENOENT' || !spaFallback || path.extname(candidate)) return null;
    candidate = path.resolve(root, './index.html');
    if (!isInside(root, candidate)) return null;
    try { stat = await fs.stat(candidate); } catch { return null; }
  }
  if (stat.isDirectory()) {
    candidate = path.resolve(candidate, 'index.html');
    if (!isInside(root, candidate)) return null;
    try { stat = await fs.stat(candidate); } catch { return null; }
  }
  if (!stat.isFile()) return null;
  // Resolve symlinks before opening so a crafted link cannot escape --dist.
  const realFile = await fs.realpath(candidate);
  if (!isInside(rootReal, realFile)) return null;
  return { filePath: realFile, stat };
}

function contentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function sendText(response, statusCode, message) {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    ...extraHeaders,
  });
  response.end(body);
}

function signalError(response, statusCode, message, code = 'SIGNALING_ERROR') {
  sendJson(response, statusCode, { error: message, code });
}

function readJsonBody(request, maxBytes = SIGNALING_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      request.destroy();
      reject(error);
    };
    request.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        const error = new Error(`Request body exceeds the ${Math.round(maxBytes / 1024)} KiB limit.`);
        error.code = 'BODY_TOO_LARGE';
        fail(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      if (!bytes) {
        resolve({});
        return;
      }
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON body must be an object.');
        resolve(value);
      } catch (error) {
        error.code = 'BAD_JSON';
        reject(error);
      }
    });
    request.on('error', error => fail(error));
  });
}

function createRoomCode(rooms) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let code = '';
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not allocate a co-op room code.');
}

function normaliseRoomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z2-9]{6}$/.test(code) ? code : null;
}

function validSignal(value) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= SIGNALING_MAX_BODY_BYTES;
}

function sweepRooms(rooms, now = Date.now()) {
  for (const [code, room] of rooms) {
    if (now - room.createdAt > SIGNALING_ROOM_TTL_MS) rooms.delete(code);
  }
}

async function handleSignalingRequest(request, response, rooms) {
  let url;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    signalError(response, 400, 'Malformed signaling URL.', 'BAD_URL');
    return true;
  }
  const prefix = `${SIGNALING_PATH}/rooms`;
  if (url.pathname === SIGNALING_PATH || url.pathname === `${SIGNALING_PATH}/`) {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      });
      response.end();
      return true;
    }
    signalError(response, 404, 'Signaling endpoint not found.', 'NOT_FOUND');
    return true;
  }
  if (!url.pathname.startsWith(prefix)) return false;
  sweepRooms(rooms);
  const remainder = url.pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
  const parts = remainder ? remainder.split('/') : [];
  if (parts.length === 0 && request.method === 'POST') {
    let body;
    try { body = await readJsonBody(request); } catch (error) {
      signalError(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, error.message, error.code || 'BAD_JSON');
      return true;
    }
    if (!validSignal(body.offer)) {
      signalError(response, 400, 'A valid WebRTC offer is required.', 'INVALID_OFFER');
      return true;
    }
    const code = createRoomCode(rooms);
    const now = Date.now();
    rooms.set(code, { code, offer: body.offer, answer: null, createdAt: now, touchedAt: now });
    sendJson(response, 201, { code, expiresInMs: SIGNALING_ROOM_TTL_MS, pollAfterMs: 500 });
    return true;
  }
  if (parts.length < 1 || parts.length > 2) {
    signalError(response, 404, 'Signaling endpoint not found.', 'NOT_FOUND');
    return true;
  }
  const code = normaliseRoomCode(parts[0]);
  if (!code || !rooms.has(code)) {
    signalError(response, 404, 'That co-op room is missing or expired.', 'ROOM_NOT_FOUND');
    return true;
  }
  const room = rooms.get(code);
  room.touchedAt = Date.now();
  const resource = parts[1] || '';
  if (request.method === 'DELETE' && !resource) {
    rooms.delete(code);
    sendJson(response, 200, { ok: true });
    return true;
  }
  if (request.method === 'GET' && resource === 'offer') {
    sendJson(response, 200, { code, offer: room.offer, expiresInMs: Math.max(0, SIGNALING_ROOM_TTL_MS - (Date.now() - room.createdAt)) });
    return true;
  }
  if (request.method === 'GET' && resource === 'answer') {
    if (!room.answer) {
      sendJson(response, 202, { code, state: 'waiting', pollAfterMs: 500 });
      return true;
    }
    sendJson(response, 200, { code, answer: room.answer });
    return true;
  }
  if (request.method === 'POST' && resource === 'answer') {
    let body;
    try { body = await readJsonBody(request); } catch (error) {
      signalError(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, error.message, error.code || 'BAD_JSON');
      return true;
    }
    if (!validSignal(body.answer)) {
      signalError(response, 400, 'A valid WebRTC answer is required.', 'INVALID_ANSWER');
      return true;
    }
    if (room.answer && room.answer !== body.answer) {
      signalError(response, 409, 'This co-op room already has an answer.', 'ANSWER_ALREADY_SET');
      return true;
    }
    room.answer = body.answer;
    sendJson(response, 200, { ok: true, code });
    return true;
  }
  signalError(response, 404, 'Signaling endpoint not found.', 'NOT_FOUND');
  return true;
}

export function createStaticServer({ root = DEFAULT_ROOT, spaFallback = true } = {}) {
  const absoluteRoot = path.resolve(root);
  const builtRoot = path.basename(absoluteRoot).toLowerCase() === 'dist';
  if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Static root does not exist or is not a directory: ${absoluteRoot}`);
  }
  const rooms = new Map();
  const server = http.createServer(async (request, response) => {
    if (request.url?.startsWith(SIGNALING_PATH)) {
      const handled = await handleSignalingRequest(request, response, rooms);
      if (handled) return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      sendText(response, 405, 'Method Not Allowed');
      return;
    }
    let pathname;
    try {
      // Keep the raw request target until decodePathname() performs exactly
      // one decode. URL normalisation would turn %2e%2e into .. before the
      // containment check can reject it.
      const target = request.url || '/';
      const queryIndex = target.indexOf('?');
      pathname = queryIndex >= 0 ? target.slice(0, queryIndex) : target;
      if (!pathname.startsWith('/')) pathname = new URL(target).pathname;
    } catch {
      sendText(response, 400, 'Bad Request');
      return;
    }
    try {
      const file = await findFile(absoluteRoot, pathname, spaFallback);
      if (!file) {
        sendText(response, 404, 'Not Found');
        return;
      }
      const type = contentType(file.filePath);
      const isHtml = type.startsWith('text/html');
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Length': file.stat.size,
        'Cache-Control': builtRoot ? (isHtml ? 'no-cache' : 'public, max-age=3600') : 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      const stream = createReadStream(file.filePath);
      stream.on('error', () => {
        if (!response.headersSent) sendText(response, 500, 'Internal Server Error');
        else response.destroy();
      });
      stream.pipe(response);
    } catch (error) {
      if (error?.code === 'BAD_PATH') sendText(response, 400, error.message);
      else sendText(response, 500, 'Internal Server Error');
    }
  });
  return server;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${value}`);
  return port;
}

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  let port = env.PORT ?? env.DEAD_ARRIVAL_PORT ?? DEFAULT_PORT;
  const host = env.HOST || (env.PORT ? '0.0.0.0' : '127.0.0.1');
  let root = DEFAULT_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--port' || arg === '-p') {
      port = argv[++index];
      continue;
    }
    if (arg.startsWith('--port=')) {
      port = arg.slice('--port='.length);
      continue;
    }
    if (arg === '--dist') {
      root = argv[++index];
      continue;
    }
    if (arg.startsWith('--dist=')) {
      root = arg.slice('--dist='.length);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return { port: parsePort(port), host, root: path.resolve(root), help: false };
}

export async function startServer({ port = DEFAULT_PORT, host = '127.0.0.1', root = DEFAULT_ROOT, spaFallback = true } = {}) {
  const server = createStaticServer({ root, spaFallback });
  const actualPort = parsePort(port);
  await new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', resolve);
      reject(error);
    };
    server.once('error', onError);
    server.listen(actualPort, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : actualPort;
  return { server, port: boundPort, host, root: path.resolve(root) };
}

export const defaultPort = DEFAULT_PORT;

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseArgs();
    if (options.help) {
      console.log('Usage: node server.mjs [--port 5200] [--dist ./dist]');
    } else {
      const running = await startServer(options);
      console.log(`The Last Dead serving ${running.root}`);
      console.log(`http://${running.host}:${running.port}/`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
