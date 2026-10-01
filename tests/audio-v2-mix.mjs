// Actual Chromium Web Audio decode/render verification; no user's tab is used.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const baselineFile=new URL('../scripts/audio-v2-baseline.json',import.meta.url);
const before=process.argv.includes('--before'),out=path.resolve('.codex-temp/audio-v2');
await mkdir(out,{recursive:true});
const server=await startServer({root:process.cwd(),port:0,spaFallback:false});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.port}/assets/audio.js`);
 const results=await page.evaluate(async({before})=>{
  const {AudioSystem}=await import(before?'/.codex-temp/audio-v2/audio-before.js':'/assets/audio.js');
  const decode=new OfflineAudioContext(2,44100,44100),library=new AudioSystem({baseUrl:location.origin+'/assets/audio.js'});library._ctx=decode;await library._loadAssets();
  const db=x=>20*Math.log10(Math.max(1e-8,x));
  function measure(buffer){let peak=0,power=0,count=0,active=0,activeN=0,maxWindow=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++){const x=data[i];peak=Math.max(peak,Math.abs(x));power+=x*x;count++;if(Math.abs(x)>.0002){active+=x*x;activeN++;}}for(let i=0;i<data.length;i+=2205){let sum=0,n=0;for(let j=i;j<Math.min(data.length,i+2205);j++){sum+=data[j]*data[j];n++;}maxWindow=Math.max(maxWindow,Math.sqrt(sum/Math.max(1,n)));}}const rms=Math.sqrt(power/count);return{duration:buffer.duration,peakDb:db(peak),rmsDb:db(rms),activeRmsDb:db(Math.sqrt(active/Math.max(1,activeN))),shortRmsDb:db(maxWindow),crestDb:db(peak)-db(rms),peak};}
  const sources=Object.fromEntries([...library._buffers].map(([key,b])=>[key,measure(b)]));
  function setup(){const ctx=new OfflineAudioContext(2,44100*4,44100),a=new AudioSystem({volume:1});a._ctx=ctx;a._buffers=new Map(library._buffers);a._loaded=true;a._normalizePools();
   if(a._createMixGraph)a._createMixGraph();else{a._master=ctx.createGain();a._master.gain.value=1;a._limiter=ctx.createDynamicsCompressor();Object.assign(a._limiter.threshold,{value:-4});a._limiter.knee.value=4;a._limiter.ratio.value=20;a._limiter.attack.value=.003;a._limiter.release.value=.22;a._master.connect(a._limiter).connect(ctx.destination);a._groups.set('master',a._master);for(const [name,level]of Object.entries({sfx:.68,ui:.42,ambience:.42,voice:.58,music:.45})){const gain=ctx.createGain();gain.gain.value=level;gain.connect(a._master);a._groups.set(name,gain);}}
   return{ctx,a};}
  const cases=[];for(let i=0;i<6;i++)cases.push({name:'shot-'+i,type:'shot',weapon:i});cases.push({name:'attack-near',type:'enemyattack',position:{x:1,y:0,z:0}},{name:'attack-far',type:'enemyattack',position:{x:12,y:0,z:0}},{name:'footstep',type:'footstep'},{name:'ambience',type:'ambience'},{name:'music',type:'music'});
  const rendered=[];
  for(const c of cases){const{ctx,a}=setup();if(c.type==='music')a._playMusic('music-play',{volume:.12});else a.play(c.type,c.weapon||0,{variant:0,rate:1,cooldown:0,position:c.position});const audio=await ctx.startRendering();rendered.push({name:c.name,...measure(audio)});}
  const{ctx,a}=setup();a.play('ambience',0,{variant:0,rate:1});a._playMusic('music-play',{volume:.12});
  const events=[];for(let i=0;i<16;i++)events.push({type:'shot',weapon:4,time:.2+i*.11});for(let i=0;i<6;i++){events.push({type:'hit',time:.24+i*.22});events.push({type:'enemyattack',time:.3+i*.25,position:{x:(i%2?1:-1)*3,y:0,z:-2}});}events.push({type:'explosion',time:.9});events.sort((x,y)=>x.time-y.time);for(const e of events)a.play(e.type,e.weapon||0,{variant:0,rate:1,cooldown:0,maxVoices:32,delay:e.time,position:e.position});
  const mixed=await ctx.startRendering(),stress=measure(mixed);const diagnostics=a.mixDiagnostics?.()||null;
  const controls={};
  if(!before){
   for(const name of ['master-mute','sfx-mute','voice-mute','master-half']){const{ctx,a}=setup();if(name==='master-mute')a.setMuted(true);if(name==='sfx-mute')a.setGroupVolume('sfx',0);if(name==='voice-mute')a.setGroupVolume('voice',0);if(name==='master-half')a.setVolume(.5);a.play(name==='voice-mute'?'enemyattack':'shot',4,{variant:0,rate:1,cooldown:0,delay:.3});controls[name]=measure(await ctx.startRendering());}
   const duck=setup(),bus=duck.a._buses.get('weapons');bus.disconnect();bus.connect(duck.ctx.destination);const ones=duck.ctx.createBuffer(1,44100*4,44100);ones.getChannelData(0).fill(1);const src=duck.ctx.createBufferSource();src.buffer=ones;src.connect(bus);src.start();duck.a._duckBus('weapons',.76,.2,.2,.12);const samples=(await duck.ctx.startRendering()).getChannelData(0);controls.duck={before:samples[4410],during:samples[15435],after:samples[88200]};
   const budget=setup();for(let i=0;i<3;i++)budget.a.play('enemyattack',0,{id:i,variant:0,cooldown:0,position:{x:1,y:0,z:0}});controls.farVoiceAdmitted=budget.a.play('enemyattack',0,{id:99,variant:0,cooldown:0,position:{x:20,y:0,z:0}});controls.idleMoanAdmitted=budget.a.play('moan',0,{variant:0,cooldown:0});controls.attackVoices=budget.a._voices.get('enemyattack').size;
  }
  const wav=new ArrayBuffer(44+mixed.length*4),view=new DataView(wav),write=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};write(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);write(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,44100,true);view.setUint32(28,44100*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,mixed.length*4,true);for(let i=0;i<mixed.length;i++)for(let c=0;c<2;c++)view.setInt16(44+i*4+c*2,Math.max(-32768,Math.min(32767,Math.round(mixed.getChannelData(c)[i]*32767))),true);const u8=new Uint8Array(wav);let binary='';for(let i=0;i<u8.length;i+=8192)binary+=String.fromCharCode(...u8.subarray(i,i+8192));
  return{version:before?'before':'v2',errors:library.loadErrors,sourceCount:library._buffers.size,sources,rendered,stress,diagnostics,controls,stressWav:btoa(binary)};
 },{before});
 await writeFile(path.join(out,before?'before-mix.wav':'after-mix.wav'),Buffer.from(results.stressWav,'base64'));delete results.stressWav;
 await writeFile(path.join(out,before?'before.json':'after.json'),JSON.stringify(results,null,2));
 assert.equal(results.errors.length,0,'all source assets decode');assert(results.sourceCount>100);
 if(!before){assert(results.stress.peak<.95,'dense combat mix has output headroom');assert(results.diagnostics?.version===2);const baseline=JSON.parse(await readFile(baselineFile,'utf8'));for(const weapon of [0,1,4,5]){const next=results.rendered.find(r=>r.name==='shot-'+weapon),old=baseline.rendered.find(r=>r.name===next.name);assert(next.shortRmsDb>old.shortRmsDb+3,'weapon '+weapon+' report gains meaningful weight');}assert(results.rendered.find(r=>r.name==='attack-near').shortRmsDb>results.rendered.find(r=>r.name==='attack-far').shortRmsDb+5,'distance preserves nearby threat priority');for(const name of ['master-mute','sfx-mute','voice-mute'])assert(results.controls[name].peak<.00001,name+' stays silent including room return');assert(results.controls.duck.during<.8&&results.controls.duck.after>.99,'real rendered bus ducks and restores');assert.equal(results.controls.farVoiceAdmitted,false);assert.equal(results.controls.idleMoanAdmitted,false);assert.equal(results.controls.attackVoices,3);}
 console.log(JSON.stringify({version:results.version,sourceCount:results.sourceCount,rendered:results.rendered.map(({name,peakDb,shortRmsDb})=>({name,peakDb,shortRmsDb})),stress:results.stress,diagnostics:results.diagnostics},null,2));
}finally{await browser.close();server.server.closeAllConnections();await new Promise(resolve=>server.server.close(resolve));}
