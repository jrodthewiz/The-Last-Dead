import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/wolfk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve('promotion/descent-film');
const toolConfig=path.join(root,'.tesseract-work/tools.json');
const ffmpeg = process.env.FFMPEG_PATH || (existsSync(toolConfig)?JSON.parse(await readFile(toolConfig,'utf8')).ffmpeg:'C:/Program Files/ImageMagick-7.1.0-Q16-HDRI/ffmpeg.exe');
export const shots = [
  {floor:0,name:'Receiving Dock',from:[7.5,24.6,1.65],to:[6.7,24.4,1.8],look:[3.8,23.7,1.9],duration:4.5},
  {floor:0,name:'Pulse Court',from:[18.2,9.3,1.7],to:[17.5,9.0,2.1],look:[17,7,2.7],duration:4},
  {floor:0,name:'Furnace Vault',from:[7.7,6.5,1.8],to:[7.2,6.2,2],look:[5,5,2.6],duration:3.5},
  {floor:1,name:'Sterile Intake',from:[8.8,21.8,1.65],to:[8.2,21.7,1.75],look:[5.5,21.0,1.6],duration:4.5},
  {floor:1,name:'Surgery Theater',from:[19,9.2,1.75],to:[18.4,8.9,2],look:[17,7,2],duration:4},
  {floor:1,name:'Ward A',from:[8.8,18.6,1.65],to:[8.1,18.2,1.7],look:[4.5,17,1.6],duration:3.5},
  {floor:2,name:'Bone Gate',from:[35,28,1.7],to:[34.5,27.8,1.85],look:[32.5,26.5,2.3],duration:4.5},
  {floor:2,name:'Reliquary Court',from:[21,10.2,1.8],to:[20.2,10.0,2.05],look:[19,8,2.8],duration:4},
  {floor:2,name:'Bone Vault',from:[7.5,5.8,1.7],to:[7,5.5,1.85],look:[5,4,2.4],duration:3.5},
  {floor:3,name:'Bell Nave',from:[18,18.2,1.7],to:[17.4,17.8,2],look:[17,15,3.4],duration:4.5},
  {floor:3,name:'Resonance Court',from:[19,11.2,1.8],to:[18.2,10.8,2.15],look:[17,8,3],duration:4},
  {floor:3,name:'Organ Loft',from:[30.5,7.4,1.65],to:[30,7,1.9],look:[28,5,3],duration:3.5},
  {floor:4,name:'Descent Mouth',from:[16.6,21.0,1.7],to:[16.1,20.7,1.9],look:[14,19.7,2.5],duration:4.5},
  {floor:4,name:'First Throat',from:[17.3,17.1,1.75],to:[16.6,17.0,2],look:[14.5,16,2.8],duration:4},
  {floor:4,name:'Last Chamber',from:[17.2,6.3,1.75],to:[16.2,6,2.05],look:[14.5,4,3],duration:5.5},
];
const customPath=path.join(root,'.tesseract-work/shots.json');
if(existsSync(customPath)) shots.splice(0,shots.length,...JSON.parse(await readFile(customPath,'utf8')));
const mode=process.argv[2]||'scout';
const selected=process.argv[3] ? process.argv[3].split(',').map(Number) : shots.map((_,i)=>i);
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync),args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
process.once('SIGINT',async()=>{await browser.close();process.exit(130)});
const errors=[];
try {
 const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 p.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await p.route('**/__trailer_capture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><base href="/"><style>html,body{margin:0;background:black;overflow:hidden}canvas{width:100vw;height:100vh;display:block}</style></head><body><canvas id="world"></canvas><script type="module">
 import {Renderer} from '/renderer.js';
 import {newRun} from '/engine.js';
 import {ENEMY_PROFILES} from '/campaign.js';
 import {makeDungeonCourse} from '/playground/map/dungeon-course.js';
 import {roomMaterialsReady} from '/room-materials.js';
 const canvas=document.querySelector('canvas'), r=new Renderer(canvas);
 let run,pose,clock=10000;
 // This capture never displays viewmodels. Load all resources but avoid compiling
 // eight hidden weapons for every floor; ordinary scene rendering warms visible shaders.
 r._prepareWeaponResources=async function(){
   await Promise.all([this._materialsReady,this._wardenReady,this._ashWitnessReady,this._survivorReady,roomMaterialsReady()]);
   this._weaponsPrepared=true;
 };
 r._updateCamera=function(){
   this.cameraRig.position.set(pose.p[0]*4,pose.p[2],pose.p[1]*4);this.cameraRig.rotation.set(0,0,0);
   this.camera.position.set(0,0,0);this.cameraRig.updateMatrixWorld(true);
   this.camera.lookAt(pose.look[0]*4,pose.look[2],pose.look[1]*4);this.camera.fov=pose.fov||61;this.camera.updateProjectionMatrix();this.weaponRig.visible=false;
 };
 window.capture={async load(floor){
   run=newRun(makeDungeonCourse(floor));run.mode='play';
   // Cinematic staging uses the actual floor's authored enemy types and spawn points.
   // The game scene and character animation render normally; combat AI is held for camera work.
   run.course.enemies=run.course.waveSpawns.flat().map((s,i)=>{
     const p=ENEMY_PROFILES[s.variant];return {id:i+1,x:s.x,y:s.y,z:0,kind:p.kind,variant:s.variant,
       hp:p.hp,maxHp:p.hp,dead:false,flash:0,attack:2,phase:i,moveSpeed:p.speed,baseMoveSpeed:p.speed,
       attackCooldown:p.attack,spawnedAt:0,wounds:{arm:false,leg:false,eye:false},hits:0,drip:0,
       slashDir:0,slashReach:0,slashHalf:0,slashHit:true,pack:Math.floor(i/2),slot:i%4,slotSign:i%2?1:-1};
   });
   pose={p:[run.x,run.y,1.7],look:[run.x,run.y-2,1.7]};
   r.render(run,clock);
   await Promise.all([r._materialsReady,r._wardenReady,r._ashWitnessReady,roomMaterialsReady(),r._warmupPromise]);
   r._renderScale=1;r.resize();
   for(let i=0;i<20;i++)r.render(run,clock+=1000/24);
   return {floor,name:run.course.name,diagnostics:r.diagnostics()};
 },frame(shot,progress){
   const u=progress*progress*(3-2*progress);
   pose={p:shot.from.map((v,i)=>v+(shot.to[i]-v)*u),look:shot.look,fov:shot.fov||61};
   run.x=pose.p[0];run.y=pose.p[1];run.time=clock/1000;
   run.angle=Math.atan2(pose.look[1]-pose.p[1],pose.look[0]-pose.p[0]);
   r.render(run,clock+=1000/24);
   return canvas.toDataURL('image/jpeg',.96).split(',')[1];
 },info(){return r.diagnostics()}};
 window.ready=true;
 </script></body></html>`}));
 await p.goto('http://127.0.0.1:5200/__trailer_capture',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForFunction(()=>window.ready,null,{timeout:60000});
 let floor=-1;const report=[];
 for(const index of selected){const shot=shots[index];const stem=String(index+1).padStart(2,'0')+'-'+shot.name.toLowerCase().replaceAll(' ','-');
  if(shot.floor!==floor){console.log('Loading floor '+(shot.floor+1));report.push(await p.evaluate(f=>window.capture.load(f),shot.floor));floor=shot.floor;}
  if(mode==='scout'){
   const data=await p.evaluate(s=>window.capture.frame(s,.5),shot);await writeFile(path.join(root,'Previews',stem+'.jpg'),Buffer.from(data,'base64'));
   console.log('Scouted '+stem);
  }else{
   const target=path.join(root,'Sources',stem+'.mp4');
   const ff=spawn(ffmpeg,['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-threads','3','-crf','17','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',target],{stdio:['pipe','ignore','pipe'],windowsHide:true});
   let stderr='';ff.stderr.on('data',v=>stderr+=v);const finished=once(ff,'close');
   for(let frame=0;frame<shot.duration*24;frame++){
    const data=await p.evaluate(({s,u})=>window.capture.frame(s,u),{s:shot,u:frame/(shot.duration*24-1)});
    if(!ff.stdin.write(Buffer.from(data,'base64')))await once(ff.stdin,'drain');
    if(frame%48===0)console.log(stem+' frame '+frame+'/'+Math.round(shot.duration*24));
   }
   ff.stdin.end();const [code]=await finished;if(code)throw new Error(stderr);
   console.log('Captured '+stem+' '+shot.duration+'s');
  }
 }
 await writeFile(path.join(root,'.tesseract-work',mode+'-report.json'),JSON.stringify({shots,errors,floors:report},null,2));
 if(errors.length)console.log('Capture errors: '+JSON.stringify(errors));
}finally{await browser.close()}
