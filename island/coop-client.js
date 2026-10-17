import {PeerSession} from '../peer.js';
export const COOP_VERSION=1;
const BASE='/api/blackwater/rooms';
export class ExpeditionConnection{
 constructor({fetchImpl=fetch,onUpdate=()=>{},onEnd=()=>{},packet=()=>({})}={}){Object.assign(this,{fetch:fetchImpl.bind(globalThis),onUpdate,onEnd,packet,role:'',code:'',token:'',status:'',remote:null,rtt:0,peer:null,fast:false,epoch:''});this.generation=0;this.failures=0;this.busy=false;this.tick=0;this.receivedTick=-1;this.signal={};this.serverState=null;}
 get active(){return !!this.token;}
 get playing(){return this.active&&this.status==='playing';}
 async request(path='',data,method=data?'POST':'GET'){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await this.fetch(BASE+path,{method,cache:'no-store',signal:controller.signal,...(data?{headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})});const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error||'The radio connection failed.'),{status:response.status});return value;}
  finally{clearTimeout(timer);}
 }
 async list(){return(await this.request()).rooms;}
 async connect(kind,{player,name,code}={}){
  await this.leave();const g=++this.generation,result=kind==='host'?await this.request('',{player,name}):await this.request('/'+String(code).trim().toUpperCase()+'/join',{player});
  if(g!==this.generation){await this.request('/'+result.code,{token:result.token},'DELETE').catch(()=>{});return;}
  Object.assign(this,result,{status:'waiting',failures:0});await this.sync();this.schedule();
 }
 schedule(){clearTimeout(this.timer);if(this.active)this.timer=setTimeout(async()=>{await this.sync();this.schedule();},this.fast?1000:this.playing?140:900);}
 networkPacket(signals=true){return{...this.packet(),net:{epoch:this.epoch,tick:++this.tick,status:this.status,...(signals?this.signal:{})}};}
 acceptPacket(packet){if(!packet?.net||packet.net.epoch!==this.epoch)return false;const tick=packet.net.tick;if(!Number.isSafeInteger(tick)||tick<=this.receivedTick)return false;this.receivedTick=tick;this.remote=packet;return true;}
 setEpoch(epoch){if(epoch===this.epoch)return;this.resetDirect();this.epoch=epoch;this.receivedTick=-1;this.remote=null;this.remoteOffer=null;if(this.role==='host'&&epoch)this.prepareDirect();}
 resetDirect(){clearInterval(this.fastTimer);this.fast=false;const peer=this.peer;this.peer=null;peer?.close();this.signal={};this.acceptedAnswer='';}
 async prepareDirect(offer=null,offerId=null){
  if(typeof RTCPeerConnection==='undefined'||!this.active)return;const generation=this.generation;this.resetDirect();
  const peer=new PeerSession({iceGatherTimeoutMs:1500,onConnect:()=>{if(this.peer!==peer||generation!==this.generation)return;this.fast=true;clearInterval(this.fastTimer);this.fastTimer=setInterval(()=>{if(this.playing&&peer.connected)peer.send(this.networkPacket(false));},75);this.schedule();},onDisconnect:()=>{if(this.peer===peer){this.fast=false;clearInterval(this.fastTimer);this.schedule();}},onMessage:packet=>{if(this.peer!==peer||!this.active||!this.acceptPacket(packet))return;if(this.role==='guest'&&packet?.net?.status==='playing')this.status='playing';this.rtt=peer.rtt??this.rtt;this.onUpdate({...this.serverState,status:this.status,packet:this.remote});}});this.peer=peer;
  try{if(this.role==='host'){const id=crypto.randomUUID(),description=await peer.host();if(this.peer===peer&&generation===this.generation)this.signal={offer:description,offerId:id};}else{this.remoteOffer=offerId;const description=await peer.join(offer);if(this.peer===peer&&generation===this.generation)this.signal={answer:description,answerFor:offerId};}if(this.peer===peer&&generation===this.generation)this.flush();}
  catch{if(this.peer===peer){this.fast=false;peer.close();}}
 }
 negotiate(result){const signal=result.packet?.net;if(!this.epoch||signal?.epoch!==this.epoch)return;if(this.role==='host'){if(signal.answer&&signal.answerFor===this.signal.offerId&&signal.answer!==this.acceptedAnswer&&this.peer){this.acceptedAnswer=signal.answer;this.peer.accept(signal.answer).catch(()=>{});}}else if(signal.offer&&signal.offerId!==this.remoteOffer)this.prepareDirect(signal.offer,signal.offerId);}
 async sync(action='sync'){
  if(!this.active||this.busy)return;this.busy=true;const g=this.generation,start=performance.now();
  try{const result=await this.request('/'+this.code+'/'+action,{token:this.token,packet:this.networkPacket()});if(g!==this.generation)return;this.rtt=this.fast?(this.peer?.rtt??performance.now()-start):performance.now()-start;this.failures=0;this.setEpoch(result.guestEpoch||'');this.serverState=result;if(this.status!=='playing')this.status=result.status;this.negotiate(result);this.acceptPacket(result.packet);this.onUpdate({...result,status:this.status,packet:this.remote});}
  catch(error){if(g===this.generation){this.failures++;if([403,404].includes(error.status)||this.failures>=4){const closing=this.leave();this.onEnd(error.message||'The expedition lost contact.');await closing;}else this.onUpdate({error:'Radio interrupted. Reconnecting…'});}}
  finally{this.busy=false;}
 }
 async start(){const g=this.generation;while(this.busy&&this.active&&g===this.generation)await new Promise(r=>setTimeout(r,20));if(this.active&&g===this.generation)await this.sync('start');}
 flush(){if(this.fast&&this.playing){this.peer.send(this.networkPacket(false));return;}if(this.flushPending)return;this.flushPending=true;const g=this.generation;(async()=>{try{while(this.busy&&this.active&&g===this.generation)await new Promise(r=>setTimeout(r,10));if(this.active&&g===this.generation)await this.sync();}finally{this.flushPending=false;}})();}
 async leave(){const {code,token}=this;this.generation++;clearTimeout(this.timer);this.resetDirect();Object.assign(this,{role:'',code:'',token:'',status:'',remote:null,remoteOffer:null,epoch:'',tick:0,receivedTick:-1,serverState:null});if(token)await this.request('/'+code,{token},'DELETE').catch(()=>{});}
}
