import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const out='output/playwright/community-buildings';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu']});
const report={errors:[],backends:[]};
try{
 for(const backend of ['webgl','webgpu']){
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'||m.text().includes('THREE.TSL:'))report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:5200/tests/fixtures/low-tide.html?renderer=${backend}`);
  await page.waitForFunction(()=>window.qaReady);
  const metrics=await page.evaluate(async()=>{
   const {world,run,scene,camera,renderer}=lowTideQA;run.course.activeInterior=null;world.update(0,run.vehicle,run);
   const THREE=await import('/vendor/three.module.js');scene.add(new THREE.HemisphereLight(0xd7e5e7,0x706953,1.8));const sun=new THREE.DirectionalLight(0xffe5ba,2);sun.position.set(-20,50,60);scene.add(sun);
   camera.position.set(52,10,222);camera.lookAt(68,9,262);renderer.render(scene,camera);
   const rows=world.root.children.filter(o=>o.name==='FarBankCommunityArchitecture');
   return {native:!!renderer.backend?.isWebGPUBackend,rows:rows.map(r=>({...r.userData,position:r.position.toArray(),meshes:r.children.length})),rooms:run.course.harborRooms.length};
  });
  await page.locator('#ui').evaluate(e=>e.style.display='none');
  await page.screenshot({path:`${out}/${backend}-row.png`});
  assert.equal(metrics.rows.length,3);assert.equal(metrics.rooms,6);assert.equal(metrics.rows.reduce((n,r)=>n+r.draws,0),12);
  assert.ok(metrics.rows.reduce((n,r)=>n+r.triangles,0)<18000);
  if(backend==='webgpu')assert.ok(metrics.native);
  report.backends.push({backend,...metrics});await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
