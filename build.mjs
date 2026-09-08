import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(PROJECT_ROOT, 'dist');

// Keep this list deliberately explicit. A build should never accidentally
// publish tests, docs, source maps from another project, or local secrets.
export const RUNTIME_FILES = [
  'index.html',
  'app.js',
  'main.js',
  'peer.js',
  'engine.js',
  'renderer.js',
  'world-horror.js',
  'world-authored.js',
  'world-polish.js',
  'npc-warden.js',
  'weapon-ossuary.js',
  'combat-vfx.js',
  'explosion-vfx.js',
  'weapon-reliquary.js',
  'npc-bellwraith.js',
  'campaign.js',
  'ui.js',
  'audio.js',
  'styles.css',
  'horror-ui.css',
  'weapon-breach.js',
  'weapon-arc.js',
  'style.css',
];
export const RUNTIME_DIRECTORIES = ['vendor', 'assets', 'public'];
export const REQUIRED_RUNTIME_FILES = ['index.html', 'main.js', 'peer.js', 'engine.js', 'renderer.js', 'ui.js', 'audio.js', 'styles.css', 'campaign.js', 'explosion-vfx.js', 'weapon-reliquary.js', 'npc-bellwraith.js', 'world-polish.js', 'world-authored.js', 'horror-ui.css', 'weapon-breach.js', 'weapon-arc.js'];

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolveProjectChild(relativePath) {
  const absolute = path.resolve(PROJECT_ROOT, relativePath);
  if (!isInside(PROJECT_ROOT, absolute)) throw new Error(`Refusing path outside The Last Dead: ${relativePath}`);
  return absolute;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function build({ dist = DIST_ROOT } = {}) {
  const outputRoot = path.resolve(dist);
  const distRoot = path.resolve(DIST_ROOT);
  if (!isInside(distRoot, outputRoot)) {
    throw new Error(`Build output must stay inside ${distRoot}.`);
  }
  try {
    const outputInfo = await fs.lstat(outputRoot);
    if (outputInfo.isSymbolicLink()) throw new Error(`Build output cannot be a symlink: ${outputRoot}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });

  const copiedFiles = [];
  for (const relativePath of RUNTIME_FILES) {
    const source = resolveProjectChild(relativePath);
    if (!(await exists(source))) {
      if (REQUIRED_RUNTIME_FILES.includes(relativePath)) throw new Error(`Missing required runtime file: ${relativePath}`);
      continue;
    }
    const destination = path.resolve(outputRoot, relativePath);
    if (!isInside(outputRoot, destination)) throw new Error(`Refusing output path: ${relativePath}`);
    await fs.copyFile(source, destination);
    copiedFiles.push(relativePath);
  }

  const copiedDirectories = [];
  for (const relativePath of RUNTIME_DIRECTORIES) {
    const source = resolveProjectChild(relativePath);
    if (!(await exists(source))) {
      if (REQUIRED_RUNTIME_FILES.includes(relativePath)) throw new Error(`Missing required runtime file: ${relativePath}`);
      continue;
    }
    const destination = path.resolve(outputRoot, relativePath);
    if (!isInside(outputRoot, destination)) throw new Error(`Refusing output path: ${relativePath}`);
    await fs.cp(source, destination, { recursive: true, force: true, dereference: false });
    copiedDirectories.push(relativePath);
  }

  if (!(await exists(path.join(outputRoot, 'index.html')))) {
    throw new Error('The Last Dead build requires index.html in the project root.');
  }
  return { outputRoot, copiedFiles, copiedDirectories };
}

function wantsServe(argv) {
  return argv.includes('--serve');
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = await build();
    console.log(`The Last Dead build ready: ${result.outputRoot}`);
    console.log(`Files: ${result.copiedFiles.join(', ') || '(none)'}`);
    console.log(`Directories: ${result.copiedDirectories.join(', ') || '(none)'}`);
    if (wantsServe(process.argv.slice(2))) {
      const { startServer } = await import('./server.mjs');
      const running = await startServer({ root: result.outputRoot, port: process.env.DEAD_ARRIVAL_PORT || 5200 });
      console.log(`http://127.0.0.1:${running.port}/`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
