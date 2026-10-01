// Render the actual bundled samples and Web Audio graph in an isolated browser.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.port}/assets/audio.js`);
 const result=await page.evaluate(async()=>{
  const {AudioSystem}=await import('/assets/audio.js'),{PLAYER_INJURY_CUES}=await import('/assets/audio-manifest.js');
  const library=new AudioSystem({baseUrl:location.origin+'/assets/audio.js'});library._ctx=new OfflineAudioContext(2,44100,44100);await library._loadAssets();
  const setup=()=>{const ctx=new OfflineAudioContext(2,44100*5,44100),a=new AudioSystem({volume:1});a._ctx=ctx;a._buffers=new Map(library._buffers);a._loaded=true;a._normalizePools();a._createMixGraph();return {ctx,a};};
  const measure=buffer=>{let peak=0,power=0,n=0,short=0;for(let c=0;c<2;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i+=2205){let sum=0,count=0;for(let j=i;j<Math.min(i+2205,data.length);j++){peak=Math.max(peak,Math.abs(data[j]));sum+=data[j]*data[j];count++;}power+=sum;n+=count;short=Math.max(short,Math.sqrt(sum/count));}}return{peak,peakDb:20*Math.log10(Math.max(1e-8,peak)),shortRmsDb:20*Math.log10(Math.max(1e-8,short)),rmsDb:20*Math.log10(Math.max(1e-8,Math.sqrt(power/n)))};};
  const cues={};for(const name of Object.keys(PLAYER_INJURY_CUES)){
   const {ctx,a}=setup(),played=a.play(name,0,{sequence:1,position:{x:999,y:0,z:999}});
   const sources=[...a._sources];cues[name]={played,sources:sources.length,looped:sources.some(s=>s.loop),...measure(await ctx.startRendering())};
  }
  const baseline=setup();baseline.a.play('damage',0,{variant:0,rate:1});const damage=measure(await baseline.ctx.startRendering());
  const full=setup();full.a.play('ambience',0,{variant:0});
  for(const [type,delay]of [['bite-windup',.1],['bite-start',.65],['bite-struggle',1],['bite-damage',1.5],['bite-struggle',1.8],['bite-damage',2.4],['bite-terminal',3.2]])full.a.play(type,0,{delay,sequence:1,stage:2});
  for(let i=0;i<14;i++)full.a.play('shot',4,{delay:.3+i*.19,cooldown:0,variant:0});
  const mix=measure(await full.ctx.startRendering()),controls={};
  for(const control of ['master','groups','paused']){
   const {ctx,a}=setup();if(control==='master')a.setMuted(true);if(control==='groups'){a.setGroupVolume('sfx',0);a.setGroupVolume('voice',0);}if(control==='paused')a.pause();
   controls[control]={admitted:a.play('bite-start',0,{delay:.3}),...measure(await ctx.startRendering())};
  }
  const budget=setup();let accepted=0;for(let i=0;i<50;i++)accepted+=Number(budget.a.play('bite-struggle',0,{enemyId:i}));controls.spam={accepted,sources:budget.a._sources.size};
  // Silence the authored cues while measuring the constant foley probe; their
  // waveform otherwise adds to the probe and corrupts the gain measurement.
  const duck=setup(),bus=duck.a._buses.get('foley');duck.a._master.disconnect();bus.disconnect();bus.connect(duck.ctx.destination);const ones=duck.ctx.createBuffer(1,44100*5,44100);ones.getChannelData(0).fill(1);const source=duck.ctx.createBufferSource();source.buffer=ones;source.connect(bus);source.start();duck.a.play('bite-start',0,{delay:.2});const samples=(await duck.ctx.startRendering()).getChannelData(0);controls.duck={before:samples[6615],during:samples[15435],restored:samples[132300]};
  const release=setup();release.a.play('bite-start',0,{delay:.2});release.a.play('bite-release',0,{delay:.35});const releaseAudio=await release.ctx.startRendering();controls.release=measure(releaseAudio);controls.tail=0;for(let c=0;c<2;c++)for(const value of releaseAudio.getChannelData(c).subarray(44100))controls.tail=Math.max(controls.tail,Math.abs(value));
  return{errors:library.loadErrors,cues,damage,mix,defaultVolumePeakDb:mix.peakDb-6.0206,controls};
 });
 await mkdir('.codex-temp/bite-audio',{recursive:true});await writeFile('.codex-temp/bite-audio/report.json',JSON.stringify(result,null,2));
 assert.equal(result.errors.length,0);
 for(const [name,cue]of Object.entries(result.cues)){assert.ok(cue.played&&cue.peak>.001,`${name} is audible`);assert.ok(cue.sources>=2&&cue.sources<=3&&!cue.looped,`${name} uses bounded short layers`);assert.ok(cue.peak<.92,`${name} retains headroom`);}
 assert.ok(result.cues['bite-start'].shortRmsDb>result.damage.shortRmsDb+3,'latch reads more urgently than generic damage');
 assert.ok(result.mix.peak<.95,'bite + automatic fire mix has headroom');
 for(const name of ['master','groups','paused'])assert.ok(result.controls[name].peak<.00001,`${name} silences all injury layers`);
 assert.equal(result.controls.paused.admitted,false);assert.equal(result.controls.spam.accepted,1);assert.equal(result.controls.spam.sources,2);
 assert.ok(result.controls.duck.before>.99&&result.controls.duck.during>.58&&result.controls.duck.during<.66&&result.controls.duck.restored>.99,'foley ducks briefly then recovers');
 assert.ok(result.controls.tail<.0001,'release leaves no ongoing grapple loop or delayed tail');
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
