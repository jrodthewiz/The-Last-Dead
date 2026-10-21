import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_ROOT = path.resolve(PROJECT_ROOT, 'dist');

// Keep this list deliberately explicit. A build should never accidentally
// publish tests, docs, source maps from another project, or local secrets.
export const RUNTIME_FILES = [
  'index.html',
  'legacy.html',
  'first-person-pass.js',
  'fps-arms-review.html', 'fps-arms-review.js',
  'first-person-motion.js',
  'map-playground.html',
  'app.js',
  'main.js',
  'campaign-entry.js',
  'island-basement.js','island-basement-layout.js','island-basement-visuals.js',
  'gamepad-input.js',
  'dev-flight.js',
  'dev-flight-ui.js',
  'dev-map-routes.js',
  'peer.js',
  'signaling.js',
  'engine.js',
  'campaign-journey.js',
  'journey-presentation.js',
  'journey-visuals.js',
  'district-materials.js',
  'scavenger-pack.js',
  'safehouse-storage.js',
  'scavenger-fitting.js',
  'coastal-workbenches.js',
  'coastal-scavenging.js',
  'coastal-understory-layout.js', 'coastal-understory.js', 'coastal-terrain-fields.js', 'coastal-residential-fields.js', 'coastal-root-footing.js', 'coastal-grove-court-fields.js', 'coastal-saltwood-transect.js', 'coastal-ground-hierarchy.js', 'coastal-timber-workspace.js',
  'weapon-inventory.js',
  'harbor-vehicle-fleet.js','harbor-helicopter.js','helicopter-world-collision.js','coastal-city-life-layout.js','coastal-city-life-visuals.js',
  'harbor-course.js','harbor-service-frontages.js','low-tide.js','low-tide-save.js','low-tide-visuals.js',
  'coastal-world-layout.js','coastal-world-visuals.js','coastal-world-map.js','coastal-water.js','coastal-daylight-profile.js','coastal-terrain.js','coastal-structures.js','coastal-terrain-visuals.js','cape-river.js','forest-vegetation.js',
  'coastal-neighborhood-layout.js','coastal-neighborhood-visuals.js','coastal-court-lane.js','coastal-zombie-population.js','coastal-world-polish.js','harbor-room-details.js',
  'coastal-instancing.js','coastal-maritime-layout.js','coastal-maritime-visuals.js','coastal-woodland-ground.js',
  'coastal-basement-visuals.js','coastal-port-frontage.js','coastal-town-details.js','coastal-industrial-frontage.js','coastal-cable-repair.js','coastal-town-wood.js','coastal-customs-gallery.js',
  'coastal-shoreline-art.js','coastal-residential-ridge.js','coastal-ridge-habitat.js',
  'blackwater-district-layout.js','blackwater-district-visuals.js','blackwater-render-looks.js','blackwater-street-surfaces.js','blackwater-render-pipeline.js','blackwater-graphic-style.js','blackwater-actor-style.js','blackwater-review.html','blackwater-review.js',
  'blackwater-building-batches.js','blackwater-material-sharing.js','blackwater-weapon-style.js',
  'weapon-stock-geometry.js',
  'weapon-aim.js',
  'weapon-attachment-config.js',
  'harbor-collision.js',
  'harbor-thai-layout.js',
  'harbor-thai-visuals.js',
  'community-buildings.js',
  'webgpu-material-hooks.js',
  'harbor-navigation.js',
  'harbor-visuals.js', 'harbor-detail.js', 'harbor-static-details.js', 'harbor-shadow-coverage.js', 'harbor-interiors.js', 'harbor-interior-visuals.js',
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
  'runtime-clone.js',
  'webgpu-backend.js','webgpu-shaders.js','webgpu-water.js',
  'player-injury-visuals.js',
  'brutal-combat-visuals.js',
  'chest-finisher-visuals.js',
  'body-spear-visuals.js',
  'body-spear-ray-tree.js',
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
  'zombie-behavior.js',
  'zombie-appearances.js',
  'enemy-fx.js',
  'audio.js',
  'styles.css',
  'horror-ui.css',
  'menu-cinematic.css',
  'game-interface.css',
  'weapon-breach.js',
  'weapon-arc.js',
  'style.css',
];
export const RUNTIME_DIRECTORIES = ['vendor', 'assets', 'public', 'playground', 'island', 'coop'];
// Preserve source art in the repository, but omit references and superseded
// models that the game and included review pages never request at runtime.
export const RELEASE_ASSET_EXCLUSIONS = [
  'assets/concepts',
  'assets/models/bloodworks-sentinel.glb',
  'assets/models/afterlife-ash-witness-motion-v04.glb',
  'assets/models/chest-anatomy-v1.glb',
  'assets/survivor/fps-arms-v3.glb',
  'assets/survivor/viewmodel-arms-v1.glb',
];
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

// Launchers can reuse a healthy server while detecting a stale built game.
// Source code is hashed; large bundled art also includes its size/mtime so a
// normal asset checkout invalidates the build without rereading every GLB.
export async function sourceFingerprint() {
  const hash = createHash('sha256');
  const exclusions = RELEASE_ASSET_EXCLUSIONS.map(resolveProjectChild);
  async function visit(relativePath) {
    const absolute = resolveProjectChild(relativePath);
    if (exclusions.some(p => isInside(p, absolute))) return;
    let info;try { info = await fs.lstat(absolute); } catch(error) { if(error.code==='ENOENT')return;throw error; }
    if (info.isSymbolicLink()) throw new Error(`Runtime source cannot be a symlink: ${relativePath}`);
    if (info.isDirectory()) { for(const name of (await fs.readdir(absolute)).sort())await visit(`${relativePath}/${name}`);return; }
    if (!info.isFile()) return;
    hash.update(relativePath+'\0'+info.size+'\0');
    if (/\.(?:js|mjs|html|css|json)$/.test(relativePath)) hash.update(await fs.readFile(absolute));
    else hash.update(String(info.mtimeMs));
  }
  for(const relativePath of [...RUNTIME_FILES,...RUNTIME_DIRECTORIES,'build.mjs'])await visit(relativePath);
  return hash.digest('hex');
}

// Validate the active game's module graph inside the completed bundle. A new
// root module omitted from the explicit allowlist must fail the build, rather
// than leave a production-only 404 after a successful local source run.
async function verifyGameModules(outputRoot) {
  const seen = new Set(), pending = ['island/game.js'];
  while(pending.length) {
    const name = pending.pop();if(seen.has(name))continue;seen.add(name);
    const absolute = path.resolve(outputRoot,name);
    if(!isInside(outputRoot,absolute))throw new Error(`Runtime import escapes build: ${name}`);
    let source;try { source=await fs.readFile(absolute,'utf8'); } catch { throw new Error(`Missing game module in build: ${name}`); }
    const imports=[...source.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)];
    for(const match of imports) {
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1].split(/[?#]/)[0]));
      if(!isInside(outputRoot,path.resolve(outputRoot,target))||!(await exists(path.resolve(outputRoot,target))))throw new Error(`Missing runtime import: ${name} → ${match[1]}`);
      if(/\.(?:m?js)$/.test(target))pending.push(target);
    }
  }
  return seen.size;
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
  const excludedSources = RELEASE_ASSET_EXCLUSIONS.map(resolveProjectChild);
  for (const relativePath of RUNTIME_DIRECTORIES) {
    const source = resolveProjectChild(relativePath);
    if (!(await exists(source))) {
      if (REQUIRED_RUNTIME_FILES.includes(relativePath)) throw new Error(`Missing required runtime file: ${relativePath}`);
      continue;
    }
    const destination = path.resolve(outputRoot, relativePath);
    if (!isInside(outputRoot, destination)) throw new Error(`Refusing output path: ${relativePath}`);
    await fs.cp(source, destination, {
      recursive: true, force: true, dereference: false,
      filter: candidate => !excludedSources.some(exclusion => isInside(exclusion, candidate)),
    });
    copiedDirectories.push(relativePath);
  }

  if (!(await exists(path.join(outputRoot, 'index.html')))) {
    throw new Error('The Last Dead build requires index.html in the project root.');
  }
  const modules=await verifyGameModules(outputRoot);
  const fingerprint=await sourceFingerprint();
  await fs.writeFile(path.join(outputRoot,'build-info.json'),JSON.stringify({game:'The Last Dead · Blackwater',builtAt:new Date().toISOString(),sourceFingerprint:fingerprint,modules},null,2)+'\n');
  return { outputRoot, copiedFiles, copiedDirectories, modules, fingerprint };
}

function wantsServe(argv) {
  return argv.includes('--serve');
}

if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if(process.argv.includes('--if-needed')) {
      let previous;try { previous=JSON.parse(await fs.readFile(path.join(DIST_ROOT,'build-info.json'),'utf8')); } catch {}
      if(previous?.sourceFingerprint===await sourceFingerprint()) {
        await verifyGameModules(DIST_ROOT);
        console.log(`The Last Dead build is current: ${DIST_ROOT}`);
        process.exit(0);
      }
    }
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
