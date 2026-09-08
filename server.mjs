import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 5200;
const DEFAULT_ROOT = existsSync(path.join(HERE, 'dist')) ? path.join(HERE, 'dist') : HERE;

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

export function createStaticServer({ root = DEFAULT_ROOT, spaFallback = true } = {}) {
  const absoluteRoot = path.resolve(root);
  const builtRoot = path.basename(absoluteRoot).toLowerCase() === 'dist';
  if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Static root does not exist or is not a directory: ${absoluteRoot}`);
  }
  return http.createServer(async (request, response) => {
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
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${value}`);
  return port;
}

export function parseArgs(argv = process.argv.slice(2), env = process.env) {
  let port = env.DEAD_ARRIVAL_PORT ?? env.PORT ?? DEFAULT_PORT;
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
  return { port: parsePort(port), root: path.resolve(root), help: false };
}

export async function startServer({ port = DEFAULT_PORT, root = DEFAULT_ROOT, spaFallback = true } = {}) {
  const server = createStaticServer({ root, spaFallback });
  const actualPort = parsePort(port);
  await new Promise((resolve, reject) => {
    const onError = error => {
      server.off('listening', resolve);
      reject(error);
    };
    server.once('error', onError);
    server.listen(actualPort, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : actualPort;
  return { server, port: boundPort, root: path.resolve(root) };
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
      console.log(`http://127.0.0.1:${running.port}/`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
