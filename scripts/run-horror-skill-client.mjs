// Run the installed develop-web-game client against an owned ephemeral server.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {startServer} from '../server.mjs';
const folder='output/playwright/horror-skill-client',temporary='.codex-temp/horror';
const verifyOnly=process.argv.includes('--verify-only');
let server;
if(!verifyOnly){
await mkdir(folder,{recursive:true});await mkdir(temporary,{recursive:true});
let client=await readFile('C:/Users/wolfk/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js','utf8');
client=client.replace('import { chromium } from "playwright";','import {createRequire} from "node:module"; const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||"playwright");');
client=client.replace('args: ["--use-gl=angle", "--use-angle=swiftshader"],','executablePath:process.env.CHROME_PATH,');
client=client.replace('a: "KeyA",','a: "KeyA", w:"KeyW", s:"KeyS",');
client=client.replace('await page.waitForTimeout(500);','await page.waitForFunction(()=>window.__DEAD_ARRIVAL__,null,{timeout:180000});');
client=client.replace('await page.waitForTimeout(250);','await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==="play",null,{timeout:180000});');
client=client.replace('await page.click(args.clickSelector, { timeout: 5000 });','await page.click(args.clickSelector, { timeout: 180000, noWaitAfter: true });');
// The installed client catches click errors. Always establish active play before
// admitting input, including a delayed Start that completed after its click wait.
client=client.replace('  let steps = null;','  await page.waitForFunction(()=>window.__DEAD_ARRIVAL__?.screen==="play",null,{timeout:180000});\n  fs.writeFileSync(path.join(args.screenshotDir,"initial-state.json"),await page.evaluate(()=>window.render_game_to_text()));\n  let steps = null;');
await writeFile(`${temporary}/client.mjs`,client);
await writeFile(`${temporary}/actions.json`,JSON.stringify({steps:[{buttons:['w'],frames:45},{buttons:[],frames:25},{buttons:['right'],frames:8},{buttons:['left_mouse_button'],frames:12},{buttons:['space','w'],frames:18},{buttons:[],frames:30}]}));
server=await startServer({root:'.',port:0,spaFallback:false});
}
try{
 if(!verifyOnly){
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[`${temporary}/client.mjs`,'--url',`http://127.0.0.1:${server.port}/?debug=1&dungeon=0`,'--click-selector','[data-action="start"]','--actions-file',`${temporary}/actions.json`,'--iterations','2','--screenshot-dir',folder],{stdio:'inherit'});
  child.once('error',reject);child.once('exit',resolve);
 });
 if(code!==0)throw Error(`Skill client exited ${code}`);
 }
 for(const file of await readdir(folder))if(file.startsWith('errors-')&&JSON.parse(await readFile(`${folder}/${file}`,'utf8')).length)throw Error(`Browser errors: ${file}`);
 const states=await Promise.all([0,1].map(async n=>JSON.parse(await readFile(`${folder}/state-${n}.json`,'utf8'))));
 const initial=JSON.parse(await readFile(`${folder}/initial-state.json`,'utf8'));
 if(initial.screen!=='play'||initial.mode!=='play'||states[0].screen!=='play'||states[0].mode!=='play')throw Error('Skill input loop did not reach active play');
 if(states.some(state=>!['play','dead','win'].includes(state.screen)||state.mode!==state.screen))throw Error('Skill input loop left the normal play/terminal lifecycle');
 if(Math.max(...states.map(state=>Math.hypot(state.player.x-initial.player.x,state.player.y-initial.player.y)))<.05)throw Error('Skill input loop did not move the player');
 if(states[1].horror.clock<=states[0].horror.clock)throw Error('Second skill burst did not advance active simulation');
 await writeFile(`${folder}/verification.json`,JSON.stringify({status:'PASS',iterations:2,initialScreen:initial.screen,endScreens:states.map(state=>state.screen),movementCells:Math.max(...states.map(state=>Math.hypot(state.player.x-initial.player.x,state.player.y-initial.player.y))),clockAdvance:states[1].horror.clock-states[0].horror.clock,terminalHealth:states[1].player.health,validatedRecordedRun:verifyOnly},null,2));
 console.log(`Installed game skill client passed: ${folder}`);
}finally{if(server){server.server.closeAllConnections?.();await new Promise(resolve=>server.server.close(resolve));}}
