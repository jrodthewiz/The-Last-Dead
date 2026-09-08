import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {startServer} from '../server.mjs';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const preview=await startServer({root:path.resolve('dist'),port:0,host:'127.0.0.1'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--use-angle=d3d11']});
try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${preview.port}/`);const results=await page.evaluate(async()=>{
 const {AudioSystem,AUDIO_ASSET_MANIFEST}=await import('/assets/audio.js');const types=['shot','footstep','jump','land','enemy-attack','kill','explosion','slide','hook','sector-transition'];const result=[];
 for(const type of types){const context=new OfflineAudioContext(1,44100,44100),a=new AudioSystem();a._ctx=context;a._master=context.createGain();a._master.connect(context.destination);await a._loadAssets();a.play(type,0,{cooldown:0});const rendered=await context.startRendering(),samples=rendered.getChannelData(0);let peak=0,power=0;for(const v of samples){peak=Math.max(peak,Math.abs(v));power+=v*v;}result.push({type,peak,rms:Math.sqrt(power/samples.length),decoded:a.debugInfo.decoded});}
 return result;
});await writeFile('docs/build07/audio-signal.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(r=>r.rms<.00001||!Number.isFinite(r.peak)))process.exitCode=1;
}finally{await browser.close();preview.server.closeAllConnections();await new Promise(r=>preview.server.close(r));}
