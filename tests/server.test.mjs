import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,startServer} from '../server.mjs';

test('Railway PORT wins over legacy local port and binds publicly',()=>{
 const options=parseArgs([],{PORT:'8080',DEAD_ARRIVAL_PORT:'5200'});
 assert.equal(options.port,8080);
 assert.equal(options.host,'0.0.0.0');
 assert.equal(parseArgs([],{}).host,'127.0.0.1');
 assert.equal(parseArgs([],{PORT:'8080',HOST:'127.0.0.1'}).host,'127.0.0.1');
});
test('production host serves the built game and new weapon module',async()=>{
 const options=parseArgs([],{PORT:'8080'});
 const app=await startServer({...options,port:0});
 try{
  assert.equal(app.server.address().address,'0.0.0.0');
  for(const route of ['/', '/weapon-ossuary.js','/weapon-reliquary.js','/npc-bellwraith.js','/campaign.js','/explosion-vfx.js','/assets/audio.js','/assets/survivor/survivor-runtime.js','/assets/models/evil-warden.glb']){
   const response=await fetch(`http://127.0.0.1:${app.port}${route}`);
   assert.equal(response.status,200,route);
   if(route==='/')assert.match(await response.text(),/The Last Dead/);
   else await response.arrayBuffer();
  }
 }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
});

test('production revalidates unversioned runtime files while retaining binary asset caching',async()=>{
 const app=await startServer({port:0});
 try{
  for(const route of ['/','/main.js','/dev-map-routes.js','/menu-cinematic.css','/assets/survivor/fps-arms-v5-manifest.json']){
   const response=await fetch(`http://127.0.0.1:${app.port}${route}`,{method:'HEAD'});
   assert.equal(response.status,200,route);assert.equal(response.headers.get('cache-control'),'no-cache',route);
  }
  const response=await fetch(`http://127.0.0.1:${app.port}/assets/survivor/fps-arms-v5.glb`,{method:'HEAD'});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'public, max-age=3600');
 }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
});
