// Local signaling-only fixture for the bundled PeerJS client protocol.
// Gameplay still crosses real RTCDataChannels; this server never sees inputs
// or snapshots. It avoids dependence on the public broker during regression QA.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';

export async function startPeerBroker(playwrightPath) {
 const require=createRequire(import.meta.url);
 const entry=require.resolve('playwright-core/lib/utilsBundle', {paths:[playwrightPath]});
 const {wsServer:WebSocketServer}=require(entry);
 const clients=new Map(),counts={opened:0,forwarded:0};
 const server=http.createServer((request,response)=>{
  response.setHeader('Access-Control-Allow-Origin','*');
  if(new URL(request.url,'http://localhost').pathname.endsWith('/id')){response.end(randomUUID());return;}
  response.writeHead(404);response.end();
 });
 const sockets=new WebSocketServer({server});
 sockets.on('connection',(socket,request)=>{
  const id=new URL(request.url,'http://localhost').searchParams.get('id');
  if(!id||clients.has(id)){socket.send(JSON.stringify({type:'ID-TAKEN'}));socket.close();return;}
  clients.set(id,socket);counts.opened++;socket.send(JSON.stringify({type:'OPEN'}));
  socket.on('message',bytes=>{
   let message;try{message=JSON.parse(bytes.toString());}catch{return;}
   if(message.type==='HEARTBEAT')return;
   if(!['OFFER','ANSWER','CANDIDATE','LEAVE'].includes(message.type))return;
   const destination=clients.get(message.dst);
   if(destination?.readyState===1){destination.send(JSON.stringify({...message,src:id}));counts.forwarded++;}
   else socket.send(JSON.stringify({type:'EXPIRE',src:message.dst}));
  });
  socket.on('close',()=>{if(clients.get(id)===socket)clients.delete(id);});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {port:server.address().port,counts,async close(){for(const socket of clients.values())socket.terminate();await new Promise(resolve=>sockets.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}
