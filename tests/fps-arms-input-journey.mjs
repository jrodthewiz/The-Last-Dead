import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function verifyFPSInputJourney(page,output){
 const skillPath='C:/Users/wolfk/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js';
 let client=await readFile(skillPath,'utf8');
 client=client.replace('import { chromium } from "playwright";','').split('async function main()')[0];
 client=client.replace('a: "KeyA",','a: "KeyA", w: "KeyW",');
 const modulePath=resolve(output,'installed-skill-client.mjs');
 await writeFile(modulePath,client+'\nexport {doChoreography,getCanvasHandle};\n');
 const {doChoreography,getCanvasHandle}=await import(pathToFileURL(modulePath));
 const canvas=await getCanvasHandle(page),rows=[];
 await page.evaluate(()=>{
  const q=window.__DEAD_ARRIVAL__,advance=window.advanceTime,clock=window.__FPS_RENDER_QA__;
  q.run.course.enemies=[];Object.assign(q.run,{pitch:-.025,speed:0,vx:0,vy:0,slide:0,shot:0,aim:0,meleeActive:false,health:100});
  window.advanceTime=ms=>{advance(ms);clock.now+=ms;clock.draw(q.run,clock.now);};
 });
 const controls=await page.addStyleTag({content:'.touch-layer{display:block!important}.touch-left,.touch-look,.touch-operate,.touch-extract,.touch-attachment{display:none!important}'});
 const step=frames=>doChoreography(page,canvas,[{buttons:[],frames}]);
 const capture=async label=>{
  const row=await page.evaluate(async label=>{
   const q=window.__DEAD_ARRIVAL__,{fpsGripDiagnostics}=await import('/assets/survivor/fps-arms.js');
   await q.renderer.renderer.backend.device.queue.onSubmittedWorkDone();
   return {label,state:JSON.parse(window.render_game_to_text()),aim:q.run.aim,speed:q.run.speed,shot:q.run.shot,shotAge:q.renderer.weaponPresentation.shotAge,cooldown:q.run.cooldowns[q.run.weapon],sawActive:q.run.sawActive,meleeSequence:q.run.meleeSequence,meleeActive:q.run.meleeActive,grips:fpsGripDiagnostics(q.renderer.weaponGroups[q.run.weapon])};
  },label);
  for(const arm of row.grips.arms){assert(arm.gap<1e-5);assert(arm.rotationGap<1e-5);assert(arm.wristDegrees<=arm.wristLimitDegrees+.005);}
  await page.screenshot({path:`${output}/input-${label}.png`});rows.push(row);await writeFile(`${output}/input-progress.json`,JSON.stringify(rows,null,2));console.log('FPS input journey',label);return row;
 };
 const hold=async action=>{const box=await page.locator(`.touch-button[data-action="${action}"]`).boundingBox();assert(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();};
 for(const weapon of [0,1,4]){
  await page.keyboard.press(String(weapon+1));await step(3);const draw=await capture(`${weapon}-draw`);assert.equal(draw.state.player.weapon,weapon);assert.equal(draw.grips.phase,'draw');await step(40);
  const before=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).player);
  await doChoreography(page,canvas,[{buttons:['w'],frames:18}]);const walk=await capture(`${weapon}-walk`);
  assert(walk.speed>.15&&walk.grips.phase==='walk');assert(Math.hypot(walk.state.player.x-before.x,walk.state.player.y-before.y)>.03);await step(30);
  await hold('alt');await step(35);const aim=await capture(`${weapon}-aim`);assert(aim.aim>.95);await page.mouse.up();await step(35);
  const shots=await page.evaluate(()=>window.__DEAD_ARRIVAL__.run.shotSequence||0);
  for(let repeat=0;repeat<3;repeat++){
   await page.locator('.touch-button[data-action="fire"]').click();await step(3);
   const shot=await capture(`${weapon}-fire-${repeat}`);
   // Legacy firearms emit actual shot pulses/events without the rifle-only
   // shotSequence counter. Verify their fresh production kick and cooldown.
   if(weapon>=4)assert.equal(shot.state.shots,shots+repeat+1);
   assert(shot.shot>.4&&shot.shotAge<.1&&shot.cooldown>0);assert.equal(shot.grips.phase,'fire');await step(60);
  }
  await capture(`${weapon}-recovered`);
 }
 for(const weapon of [6,7]){
  await page.keyboard.press(String(weapon+1));await step(40);
  if(weapon===6)await page.locator('.touch-button[data-action="alt"]').click();else await hold('fire');
  await step(12);const attack=await capture(`${weapon}-attack`);
  assert(weapon===6?attack.meleeActive:attack.sawActive);await page.mouse.up();await step(75);await capture(`${weapon}-recovered`);
 }
 await controls.evaluate(node=>node.remove());
 return {scope:'Real W and number keys, actual pointer clicks/holds on production touch FIRE/AIM controls exposed at desktop size; controlled simulation/render clock and enemy-free starting area. No native pointer lock.',skillPath,rows};
}
