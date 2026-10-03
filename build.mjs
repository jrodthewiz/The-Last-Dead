import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(PROJECT_ROOT, 'dist');

// Keep this list deliberately explicit. A build should never accidentally
// publish tests, docs, source maps from another project, or local secrets.
export const RUNTIME_FILES = [
  'index.html',
  'map-playground.html',
  'app.js',
  'main.js',
  'campaign-entry.js',
  'gamepad-input.js',
  'dev-flight.js',
  'peer.js',
  'signaling.js',
  'engine.js',
  'campaign-journey.js',
  'journey-presentation.js',
  'journey-visuals.js',
  'district-materials.js',
  'scavenger-pack.js',
  'scavenger-fitting.js',
  'weapon-inventory.js',
  'harbor-course.js','low-tide.js','low-tide-save.js','low-tide-visuals.js',
  'coastal-world-layout.js','coastal-world-visuals.js','coastal-world-map.js','coastal-water.js',
  'coastal-neighborhood-layout.js','coastal-neighborhood-visuals.js',
  'coastal-instancing.js',
  'harbor-collision.js',
  'harbor-thai-layout.js',
  'harbor-thai-visuals.js',
  'community-buildings.js',
  'webgpu-material-hooks.js',
  'harbor-navigation.js',
  'harbor-visuals.js', 'harbor-detail.js', 'harbor-interiors.js', 'harbor-interior-visuals.js',
  'harbor-vehicle.js',
  'scavenger-pack-ui.js',
  'scavenger-pack.css',
  'dungeon-encounter-design.js',
  'enemy-anatomy.js',
  'enemy-cut-geometry.js',
  'enemy-anatomy-visuals.js',
  'enemy-cut-worker.js',
  'enemy-cut-preview.js',
  'vermin-system.js',
  'vermin-visuals.js',
  'enemy-variation.js',
  'room-kit.js',
  'room-progression.js',
  'renderer.js',
  'webgpu-backend.js','webgpu-shaders.js','webgpu-water.js',
  'player-injury-visuals.js',
  'brutal-combat-visuals.js',
  'chest-finisher-visuals.js',
  'corpse-physics.js',
  'hand-grip-rig.js',
  'horror-scares-game.js',
  'horror-presence.js',
  'horror-presence-audio.js',
  'spatial-audio.js',
  'room-atmosphere-audio.js',
  'horror-encounter-visuals.js',
  'horror-cuff-visuals.js',
  'scream-mouth.js',
  'menu-cinematic.js',
  'world-horror.js',
  'world-authored.js',
  'world-setdressing.js',
  'dungeon-place-kit.js',
  'dungeon-cover-kit.js',
  'dungeon-weapon-loot.js',
  'dungeon-evidence.js',
  'dungeon-wayfinding.js',
  'dungeon-landmarks.js',
  'dungeon-supplies.js',
  'dungeon-art-direction.js',
  'dungeon-architecture.js',
  'world-polish.js',
  'world-static.js',
  'bounded-lighting.js',
  'afterlife-lighting.js',
  'afterlife-atmosphere.js',
  'afterlife-surfaces.js',
  'world-afterlife-design.js',
  'afterlife-props.js',
  'blood-surface.js',
  'blood-deposits.js',
  'npc-afterlife.js',
  'npc-afterlife-model.js',
  'character-articulation.js',
  'transmission-region.js',
  'weapon-batching.js',
  'room-materials.js',
  'npc-warden.js',
  'weapon-ossuary.js',
  'combat-vfx.js',
  'combat-detail-v2.js',
  'fluid-blood.js',
  'soft-tissue-compliance.js',
  'secondary-vfx.js',
  'impact-vfx.js',
  'weapon-materials.js',
  'weapon-occult-redesign.js',
  'weapon-rifles.js',
  'weapon-casings.js',
  'weapon-grime.js',
  'weapon-presentation.js',
  'extraction-vfx.js',
  'extraction-anatomy.js',
  'extraction-cutaway.js',
  'extraction-surface.js',
  'extraction-tissue-materials.js',
  'weapon-melee.js',
  'melee-reaction.js',
  'weapon-detail-pass.js',
  'explosion-vfx.js',
  'weapon-reliquary.js',
  'npc-bellwraith.js',
  'campaign.js',
  'ui.js',
  'bodycam-pass.js',
  'bodycam-motion.js',
  'enemy-ai.js',
  'enemy-fx.js',
  'audio.js',
  'styles.css',
  'horror-ui.css',
  'menu-cinematic.css',
  'weapon-breach.js',
  'weapon-arc.js',
  'style.css',
];
export const RUNTIME_DIRECTORIES = ['vendor', 'assets', 'public', 'playground'];
export const REQUIRED_RUNTIME_FILES = ['index.html', 'map-playground.html', 'main.js', 'gamepad-input.js', 'peer.js', 'engine.js', 'renderer.js', 'bodycam-pass.js', 'enemy-ai.js', 'enemy-fx.js', 'ui.js', 'audio.js', 'styles.css', 'campaign.js', 'explosion-vfx.js', 'weapon-reliquary.js', 'npc-bellwraith.js', 'world-polish.js', 'world-authored.js', 'dungeon-place-kit.js', 'dungeon-cover-kit.js', 'dungeon-weapon-loot.js', 'dungeon-evidence.js', 'dungeon-art-direction.js', 'dungeon-architecture.js', 'horror-ui.css', 'weapon-breach.js', 'weapon-arc.js', 'impact-vfx.js', 'weapon-materials.js', 'weapon-detail-pass.js', 'scream-mouth.js'];

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
      const { startLocalServer } = await import('./server.mjs');
      const running = await startLocalServer({ root: result.outputRoot, port: process.env.DEAD_ARRIVAL_PORT || 5200 });
      console.log(`http://127.0.0.1:${running.port}/`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
