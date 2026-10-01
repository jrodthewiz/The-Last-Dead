// Adapt the bundled skill client only for this repository's explicit browser
// paths and asynchronous asset warmup; keep its input/capture/error loop.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const source=process.env.WEB_GAME_CLIENT||'C:/Users/wolfk/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js';
const output=process.env.DEAD_ARRIVAL_OUTPUT||'output/playwright/v2-skill-client';
let script=await readFile(source,'utf8');
script=script.replace('import { chromium } from "playwright";','import {createRequire} from "node:module"; const require=createRequire(import.meta.url); const {chromium}=require(process.env.PLAYWRIGHT_PATH||"playwright");');
script=script.replace('args: ["--use-gl=angle", "--use-angle=swiftshader"],','executablePath: process.env.CHROME_PATH,');
script=script.replace('a: "KeyA",','a: "KeyA", w: "KeyW",');
script=script.replace('await page.waitForTimeout(500);','await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.renderer?._weaponsPrepared,null,{timeout:180000});');
script=script.replace('await page.waitForTimeout(250);','await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==="play",null,{timeout:180000});');
// One final directed inspection of the formerly primitive floor gore.
script=script.replace('  await browser.close();',`  const residue = await page.evaluate(async()=>{
  const d=window.__DEAD_ARRIVAL__,mesh=d.renderer.worldRoot.getObjectByName('WorldLife_limbs');
  if(!mesh?.count)return null;
  const THREE=await import('./vendor/three.module.js'),m=new THREE.Matrix4(),p=new THREE.Vector3();
  mesh.getMatrixAt(0,m);p.setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld);
  Object.assign(d.run,{mode:'ready',x:p.x/4,y:p.z/4+1.1,z:0,angle:-Math.PI/2,pitch:-.36});
  d.run.course.enemies=[];mesh.geometry.computeBoundingBox();
  return {instances:mesh.count,localHeight:mesh.geometry.boundingBox.max.y-mesh.geometry.boundingBox.min.y,material:mesh.material.name};
 });
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(args.screenshotDir,'floor-residue.png')});
 fs.writeFileSync(path.join(args.screenshotDir,'floor-residue.json'),JSON.stringify(residue,null,2));
 const finalErrors=consoleErrors.drain();if(finalErrors.length)throw new Error(JSON.stringify(finalErrors));
 await browser.close();`);
await mkdir('.codex-temp/v2',{recursive:true});await writeFile('.codex-temp/v2/skill-client.mjs',script);
await writeFile('.codex-temp/v2/actions.json',JSON.stringify({steps:[{buttons:['w'],frames:90},{buttons:['left_mouse_button'],frames:24},{buttons:['right'],frames:15},{buttons:['space','w'],frames:30},{buttons:[],frames:30}]}));
const child=spawn(process.execPath,['.codex-temp/v2/skill-client.mjs','--url',process.env.DEAD_ARRIVAL_URL||'http://127.0.0.1:5200/?debug=1&dungeon=0','--click-selector','[data-action="start"]','--actions-file','.codex-temp/v2/actions.json','--iterations','2','--screenshot-dir',output],{stdio:'inherit'});
child.on('exit',code=>process.exitCode=code??1);child.on('error',error=>{console.error(error.message);process.exitCode=1;});
