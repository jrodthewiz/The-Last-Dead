import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServer} from '../server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const output='output/playwright/vermin-v1/audio';await mkdir(output,{recursive:true});
const server=await startServer({root:process.cwd()+'/dist',port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto(`http://127.0.0.1:${server.port}/assets/audio.js`);
 const result=await page.evaluate(async()=>{
  const {AudioSystem}=await import('/assets/audio.js'),{VERMIN_CUES}=await import('/assets/audio-manifest.js'),rate=44100;
  const library=new AudioSystem();library._ctx=new OfflineAudioContext(2,rate,rate);await library._loadAssets();
  const setup=()=>{const ctx=new OfflineAudioContext(2,rate*4,rate),audio=new AudioSystem({volume:1});ctx.close=async()=>{};audio._ctx=ctx;audio._buffers=new Map(library._buffers);audio._loaded=true;audio._normalizePools();audio._createMixGraph();return{ctx,audio};};
  const measure=b=>{let peak=0,last=-1,sum=0;for(let c=0;c<2;c++)for(let i=0;i<b.length;i++){const x=b.getChannelData(c)[i];peak=Math.max(peak,Math.abs(x));sum+=x*x;if(Math.abs(x)>1e-5)last=Math.max(last,i);}return{peak,peakDb:20*Math.log10(Math.max(1e-9,peak)),rms:Math.sqrt(sum/(b.length*2)),lastActive:last/rate};};
  const event=(sequence=1,extra={})=>({playerId:'host',ratId:12,enemyId:42,sequence,...extra});
  const cues={};for(const name of Object.keys(VERMIN_CUES)){const {ctx,audio}=setup(),played=audio.play(name,0,event(1,{delay:.2})),sources=[...audio._sources];cues[name]={played,sources:sources.length,looped:sources.some(s=>s.loop),...measure(await ctx.startRendering())};}
  const muted={};for(const control of ['master','sfx','pause']){const {ctx,audio}=setup();audio.play('vermin-crawl',0,event(1,{delay:.3}));if(control==='master')audio.setMuted(true);if(control==='sfx')audio.setGroupVolume('sfx',0);if(control==='pause')audio.pause();muted[control]={admitted:audio.play('vermin-infest',0,event(2,{delay:.5})),...measure(await ctx.startRendering())};}
  const d=setup(),first=d.audio.play('vermin-bite',0,event(1,{bites:1})),voices=d.audio._sources.size,duplicate=d.audio.play('vermin-bite',0,event(1,{bites:1})),afterDuplicate=d.audio._sources.size,next=d.audio.play('vermin-bite',0,event(1,{bites:2}));d.audio.resetCounterCues();const restart=d.audio.play('vermin-bite',0,event(1,{bites:1}));await d.ctx.startRendering();
  const b=setup();for(let i=1;i<80;i++)b.audio.play('vermin-crawl',0,event(i));const budget=b.audio._sources.size;await b.ctx.startRendering();
  const m=setup();m.audio.play('ambience');for(let i=0;i<15;i++)m.audio.play('shot',4,{delay:.1+i*.18,cooldown:0,variant:0});for(const [i,name]of Object.keys(VERMIN_CUES).entries())m.audio.play(name,0,event(i+1,{delay:.2+i*.2,bites:1}));const mix=measure(await m.ctx.startRendering());
  const cleanup=setup();cleanup.audio.play('vermin-infest',0,event(1,{delay:.3}));cleanup.audio.dispose();const remaining=cleanup.audio._sources.size,postDispose=cleanup.audio.play('vermin-bite',0,event(2));await cleanup.ctx.startRendering();
  return{loadErrors:library.loadErrors,loaded:library._assetCount,cues,muted,dedup:{first,voices,duplicate,afterDuplicate,next,restart},budget,mix,cleanup:{remaining,postDispose}};
 });
 assert.deepEqual(errors,[]);assert.deepEqual(result.loadErrors,[]);
 for(const [name,cue]of Object.entries(result.cues)){assert(cue.played&&cue.peak>.0005,`${name} audible`);assert(!cue.looped&&cue.sources<=2);assert(cue.peak<.7&&cue.lastActive<1,`${name} short and quiet`);}
 for(const m of Object.values(result.muted))assert(m.peak<1e-5,'mute/group/pause silence scheduled layers');assert.equal(result.muted.pause.admitted,false);
 assert(result.dedup.first&&result.dedup.next&&result.dedup.restart);assert.equal(result.dedup.duplicate,false);assert.equal(result.dedup.voices,result.dedup.afterDuplicate);assert(result.budget<=4);
 assert(result.mix.peak<.95&&result.mix.peak>.001);assert.equal(result.cleanup.remaining,0);assert.equal(result.cleanup.postDispose,false);
 result.status='PASS';await writeFile(`${output}/report.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,loaded:result.loaded,cues:Object.keys(result.cues).length,budget:result.budget,mix:result.mix,errors}));
}finally{await browser.close();server.server.closeAllConnections();await new Promise(r=>server.server.close(r));}
