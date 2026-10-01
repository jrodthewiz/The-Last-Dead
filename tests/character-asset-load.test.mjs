import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {loadAfterlifeModel} from '../npc-afterlife-model.js';

const bytes=readFileSync(new URL('../art/character-rig-v05/afterlife-ash-witness-rig-v05.glb',import.meta.url));
function harness(t,response){
 const events=[],manager=new THREE.LoadingManager();
 for(const name of ['itemStart','itemEnd','itemError'])manager[name]=url=>events.push({name,url});
 manager.setURLModifier(url=>'https://assets.test/'+url);
 const loader={manager,path:'bundle/',resourcePath:'textures/',requestHeader:{'X-Asset':'rig'},withCredentials:false,parseAsync:async(buffer,path)=>{assert.equal(buffer.byteLength,bytes.length);assert.equal(path,'textures/');return{scene:new THREE.Group(),animations:[]};}};
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://assets.test/bundle/rig.glb');assert.equal(options.credentials,'same-origin');assert.deepEqual(options.headers,loader.requestHeader);return response;});
 return{loader,events};
}
test('bundled rig is fully consumed and parsed with balanced loading-manager events',async t=>{
 const h=harness(t,new Response(bytes));const asset=await loadAfterlifeModel(h.loader,'rig.glb');
 assert(asset.template.userData.afterlifeAsset);assert.deepEqual(h.events.map(e=>e.name),['itemStart','itemEnd']);
});
test('truncated GLB fails before parsing and reports the asset error',async t=>{
 const h=harness(t,new Response(bytes.subarray(0,bytes.length-32)));let parsed=false;h.loader.parseAsync=async()=>{parsed=true;};
 await assert.rejects(loadAfterlifeModel(h.loader,'rig.glb'),/Incomplete or invalid/);assert.equal(parsed,false);assert.deepEqual(h.events.map(e=>e.name),['itemStart','itemError','itemEnd']);
});
test('failed character HTTP response cannot activate an empty model',async t=>{
 const h=harness(t,new Response('Missing',{status:404}));await assert.rejects(loadAfterlifeModel(h.loader,'rig.glb'),/404/);assert.deepEqual(h.events.map(e=>e.name),['itemStart','itemError','itemEnd']);
});
