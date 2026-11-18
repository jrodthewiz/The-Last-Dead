import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {startServer} from '../server.mjs';
import {guardBackgroundInput} from './background-input-guard.mjs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const root=resolve(process.env.BLACKWATER_QA_ROOT || '.');
const output=resolve(process.env.BLACKWATER_QA_OUTPUT || 'output/playwright/private-bridge');
const cpu=process.env.BLACKWATER_RENDERER !== 'gpu';
const entry=process.env.BLACKWATER_QA_ENTRY || '/';
assert.ok(entry.startsWith('/') && !entry.startsWith('//') && !entry.includes('\\'));
const report={root,entry,errors:[],crossings:[]};
await mkdir(output,{recursive:true});
const server=await startServer({root,port:0});
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,
    args:cpu?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  async function player(){
    const page=await browser.newPage({viewport:{width:720,height:480},hasTouch:true});
    page.setDefaultTimeout(120000);
    await guardBackgroundInput(page);
    page.on('pageerror',error=>report.errors.push(error.message));
    const url=new URL(entry,'http://127.0.0.1:'+server.port);
    url.searchParams.set('debug','');
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BLACKWATER__?.coop);
    return page;
  }
  let host=await player();
  console.log("Host ready");
  report.adapter=await host.evaluate(()=>{
    const gl=__BLACKWATER__.renderer.getContext();
    return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
  });
  assert.equal(/SwiftShader|llvmpipe|software/i.test(report.adapter),cpu,report.adapter);
  await host.locator('#begin').tap();
  await host.waitForFunction(()=>__BLACKWATER__.mode==='playing');
  // Associate actual Web Audio source starts with their decoded reload buffer.
  await host.evaluate(async()=>{
    const {Soundscape}=await import('/island/actors.js');
    const play=Soundscape.prototype.play, start=AudioBufferSourceNode.prototype.start;
    let cue=null;
    window.reloadSources=[];
    Soundscape.prototype.play=function(name,...args){
      cue={name,buffer:this.buffers.get(name)};
      try{return play.call(this,name,...args);}finally{cue=null;}
    };
    AudioBufferSourceNode.prototype.start=function(...args){
      const result=start.apply(this,args);
      if(cue && /reload/i.test(cue.name) && this.buffer===cue.buffer){
        const samples=this.buffer.getChannelData(0);
        reloadSources.push({name:cue.name,time:this.context.currentTime,rate:this.playbackRate.value,
          rms:Math.sqrt(samples.reduce((sum,s)=>sum+s*s,0)/samples.length)});
      }
      return result;
    };
  });
  for(const [end,x,direction] of [['west',66,1],['east',374,-1]]){
    await host.evaluate(([x,d])=>__BLACKWATER__.teleport(x,0,d*Math.PI/2),[x,direction]);
    await host.keyboard.down('KeyW');
    try{await host.waitForFunction(([x,d])=>(__BLACKWATER__.state.x-x)*d>=8,[x,direction]);}
    finally{await host.keyboard.up('KeyW');}
    const pose=await host.evaluate(()=>{const {x,y,z}=__BLACKWATER__.state;return {x,y,z};});
    console.log(end,pose);
    report.crossings.push({end,...pose});
    assert.ok(pose.y>14 && Math.abs(pose.z)<1,JSON.stringify(pose));
    await host.screenshot({path:join(output,end+'.png')});
  }
  const ammo=await host.evaluate(()=>__BLACKWATER__.state.ammo);
  await host.locator('[data-touch="fire"]').tap();
  await host.waitForFunction(n=>__BLACKWATER__.state.ammo===n-1,ammo);
  await host.keyboard.press('KeyR');
  await host.waitForFunction(()=>__BLACKWATER__.combat.reload>0);
  await host.waitForFunction(n=>__BLACKWATER__.combat.reload===0 && __BLACKWATER__.state.ammo===n,ammo);
  report.reload=await host.evaluate(()=>reloadSources);
  assert.ok(report.reload.length && report.reload.every(source=>source.rms>0),'Decoded reload audio must start');
  console.log("Reload",report.reload);
  for(const [end,x,y,target] of [['west',87,14,71],['east',351,14.5,369]]){
    await host.evaluate(([x,y,target])=>__BLACKWATER__.setPhoto(x,y,24,target,y,0),[x,y,target]);
    await host.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    await host.screenshot({path:join(output,end+'-bearing.png')});
  }
  await host.context().close();
  host=await player();
  console.log('Co-op host ready');
  const guest=await player();
  await host.locator('#title-coop').tap();
  await host.locator('#coop-lobby-name').fill('Bridge QA');
  await host.locator('#coop-host').tap();
  console.log('Room hosted');
  await guest.locator('#title-coop').tap();
  await guest.getByRole('button',{name:'Join Bridge QA',exact:true}).tap();
  console.log('Guest joined');
  await host.locator('#coop-start').tap();
  for(const page of [host,guest]) await page.waitForFunction(()=>__BLACKWATER__.coop.playing && __BLACKWATER__.coop.avatar.visible);
  await guest.evaluate(()=>__BLACKWATER__.teleport(368,0,Math.PI/2));
  await guest.keyboard.down('KeyW');
  try{await guest.waitForFunction(()=>__BLACKWATER__.state.x>375);}finally{await guest.keyboard.up('KeyW');}
  const x=await guest.evaluate(()=>__BLACKWATER__.state.x);
  await host.waitForFunction(x=>Math.abs(__BLACKWATER__.coop.avatar.position.x-x)<1,x);
  report.partner=await host.evaluate(()=>({position:__BLACKWATER__.coop.avatar.position.toArray(),direct:__BLACKWATER__.coop.connection.fast}));
  assert.deepEqual(report.errors,[]);
  report.passed=true;
} catch(error){report.failure=String(error);throw error;}
finally{
  await browser?.close();
  await new Promise(done=>server.server.close(done));
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(report);
}
