import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const server = await startServer({ root: fileURLToPath(new URL('../dist/', import.meta.url)), port: 0 });
let browser;
const report = { label: process.argv[2] || 'after', errors: [] }, directory = 'output/playwright/performance';
await mkdir(directory, { recursive: true });
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/preview-probe.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#121212"></body></html>' }));
  await page.goto(`http://127.0.0.1:${server.port}/preview-probe.html`);
  report.result = await page.evaluate(async warmPipeline => {
    const THREE = await import('./vendor/three.module.js'), { GLTFLoader } = await import('./vendor/loaders/GLTFLoader.js');
    const { createAfterlifeModel } = await import('./npc-afterlife-model.js');
    const { previewGeometry, cutPreviewMaterial } = await import('./enemy-cut-preview.js');
    const asset = await new GLTFLoader().loadAsync('./assets/models/afterlife-ash-witness-rig-v05.glb');
    const actor = createAfterlifeModel({ template: asset.scene, clips: asset.animations }, 0, 1);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 800/600, .1, 30), renderer = new THREE.WebGLRenderer({ antialias: true });
    camera.position.set(0, 1.2, 4); camera.lookAt(0, 1, 0); renderer.setSize(800,600); document.body.append(renderer.domElement);
    scene.add(actor, new THREE.HemisphereLight(0xffffff, 0x333333, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(2,4,3); scene.add(light);
    renderer.render(scene,camera); const gl = renderer.getContext(); gl.finish();
    const entries = []; actor.traverse(mesh => { if(mesh.isSkinnedMesh) entries.push({ mesh, geometry: mesh.geometry, material: mesh.material }); });
    const start = performance.now();
    for (const entry of entries) {
      entry.preview = previewGeometry(entry.geometry, entry.mesh); entry.mesh.geometry = entry.preview;
      const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
      entry.materials = materials.map(material => cutPreviewMaterial(material, { region: 1, plane: new THREE.Vector4(0,1,0,-1.5) }));
      entry.mesh.material = Array.isArray(entry.material) ? entry.materials : entry.materials[0];
    }
    const constructionMs = performance.now() - start;
    await renderer.compileAsync(scene,camera);
    if (warmPipeline) {
      renderer.render(scene,camera); gl.finish();
      for (const entry of entries) { entry.preview.dispose(); entry.preview = previewGeometry(entry.geometry,entry.mesh); entry.mesh.geometry = entry.preview; }
    }
    const original = gl.bufferData, uploads = { calls: 0, bytes: 0 };
    gl.bufferData = function(target,data,...args) { uploads.calls++; uploads.bytes += typeof data === 'number' ? data : data.byteLength; return original.call(this,target,data,...args); };
    const t = performance.now(); renderer.render(scene,camera); gl.finish(); const renderMs = performance.now() - t;
    const result = { meshes: entries.length, vertices: entries.map(entry => entry.geometry.attributes.position.count), constructionMs, renderMs, uploads: { ...uploads },
      sharedSourceAttributes: entries.every(entry => entry.preview.attributes.position === entry.geometry.attributes.position),
      maskBytes: entries.reduce((sum,entry) => sum + entry.preview.attributes.anatomyA.array.byteLength + entry.preview.attributes.anatomyB.array.byteLength,0) };
    for (const entry of entries) { entry.mesh.geometry = entry.geometry; entry.mesh.material = entry.material; entry.preview.dispose(); entry.materials.forEach(material => material.dispose()); }
    uploads.calls = uploads.bytes = 0;
    renderer.render(scene,camera); gl.finish(); result.restoreUploads = { ...uploads };
    gl.bufferData = original;
    result.contextLost = gl.isContextLost(); result.triangles = renderer.info.render.triangles;
    // Keep the restored source visible for screenshot inspection.
    return result;
  }, !!process.env.CUT_PREVIEW_WARM);
  console.log(JSON.stringify(report));
  assert.deepEqual(report.errors, []); assert.equal(report.result.contextLost, false);
  assert.equal(report.result.restoreUploads.calls, 0, 'disposing a preview cannot invalidate source buffers');
  if (report.label !== 'before') {
    assert.equal(report.result.sharedSourceAttributes, true);
    assert.equal(report.result.uploads.bytes, report.result.maskBytes, 'only the region masks are new GPU buffers');
  }
  await page.screenshot({ path: `${directory}/cut-preview-${report.label}.png` });
} finally {
  await writeFile(`${directory}/cut-preview-${report.label}.json`, JSON.stringify(report,null,2));
  await browser?.close(); await new Promise(resolve => server.server.close(resolve));
}
