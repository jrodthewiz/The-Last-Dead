import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,relayIds,restoreRelay,allRelaysRestored,restoredRelayCount} from '../island/simulation.js';
import {treeContactShadowGeometry} from '../island/tree-contact-shadows.js';
test('recovered relay restoration awards health once and rejects unknown stations',()=>{
 const s=freshState();s.health=20;
 assert.equal(restoreRelay(s,'unknown'),false);
 assert.equal(restoreRelay(s,relayIds[0]),true);assert.equal(s.health,45);
 assert.equal(restoreRelay(s,relayIds[0]),false);assert.equal(s.health,45);
 assert.equal(restoredRelayCount(s),1);assert.equal(allRelaysRestored(s),false);
 for(const id of relayIds.slice(1))restoreRelay(s,id);
 assert.equal(allRelaysRestored(s),true);assert.equal(restoredRelayCount(s),relayIds.length);
});
test('recovered tree shadow geometry excludes urban and invalid trees',()=>{
 const g=treeContactShadowGeometry([{x:0,z:0,scale:1,urban:true},{x:NaN,z:0,scale:1},{x:0,z:0,scale:0}],()=>0,{});
 assert.deepEqual(g,{positions:[],uvs:[],entries:[]});
});
