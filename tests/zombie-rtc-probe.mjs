import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {startPeerBroker} from './peerjs-broker-fixture.mjs';
import {startServer} from '../server.mjs';
const pw=process.env.PLAYWRIGHT_PATH||'playwright',{chromium}=createRequire(import.meta.url)(pw),broker=await startPeerBroker(pw),server=await startServer({root:'dist',host:'127.0.0.1',port:0});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--disable-features=WebRtcHideLocalIpsWithMdns']});
const pages=[],result={statuses:[],errors:[]};
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext(),p=await context.newPage();pages.push(p);
  // Same application origin, without the game/graphics loop.
  await p.goto(`http://127.0.0.1:${server.port}/signaling.js`);
  await p.evaluate(async port=>{window.__DEAD_ARRIVAL_PEER_CONFIG__={host:'127.0.0.1',port,path:'/',secure:false,config:{iceServers:[]},debug:3};const {PeerJsSession}=await import('./signaling.js');window.__rtcLog=[];window.__rtcMessages=[];window.__rtcSession=new PeerJsSession({onStatus:(s,d)=>window.__rtcLog.push({s,d}),onMessage:m=>window.__rtcMessages.push(m)});},broker.port);
 }
 const code=await pages[0].evaluate(()=>window.__rtcSession.host());await pages[1].evaluate(code=>window.__rtcSession.join(code),code);
 await pages[0].waitForFunction(()=>window.__rtcSession.connected,null,{timeout:25000});
 await pages[1].evaluate(()=>window.__rtcSession.send({t:'probe',data:'actual RTC channel'}));await pages[0].waitForFunction(()=>window.__rtcMessages.some(m=>m.t==='probe'),null,{timeout:5000});result.status='PASS';
}catch(e){result.status='FAIL';result.failure=e.stack;process.exitCode=1;}
finally{
 result.clients=await Promise.all(pages.map(p=>p.evaluate(()=>{const s=window.__rtcSession,pc=s?._connection?.peerConnection;return{log:window.__rtcLog,messages:window.__rtcMessages,connected:s?.connected,rtc:pc&&{state:pc.connectionState,ice:pc.iceConnectionState,gathering:pc.iceGatheringState}};}).catch(e=>({failure:e.message}))));
 result.signaling={...broker.counts};await browser.close();await broker.close();server.server.closeAllConnections();await new Promise(r=>server.server.close(r));await mkdir('output/playwright/zombie-live-quality',{recursive:true});await writeFile('output/playwright/zombie-live-quality/rtc-probe.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
