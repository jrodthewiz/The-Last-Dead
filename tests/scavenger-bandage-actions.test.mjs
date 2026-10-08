import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createScavengerPack,bandageActionState,craftBandage,useBandage,BANDAGE_RECIPE,BANDAGE_HEAL} from '../scavenger-pack.js';

// Execute the actual UI copy projection without mounting its Three/map imports.
// Command parity below uses the actual supply/workbench modules, not mock rules.
const source=readFileSync(new URL('../scavenger-pack-ui.js',import.meta.url),'utf8');
const copy=source.slice(source.indexOf('export function bandageActionDescription('),source.indexOf('// The caller owns pause/resume')).replace('export function','function');
const context=vm.createContext({});vm.runInContext(copy,context);const describe=context.bandageActionDescription;
function run(supplies={cloth:2,antiseptic:1,bandage:1}) {
 return {mode:'pause',health:70,x:1.5,y:1.5,z:0,events:[],backpack:createScavengerPack({supplies}),course:{w:4,h:4,cells:Array.from({length:16},()=>[0,0,0,0]),coastal:{workbenches:[{id:'bench',name:'Laundry workbench',x:1.5,y:1.5,floorZ:0,itemZ:.4,reach:.6}]}}};
}
test('ready states agree with real commands, consume exact recipe, and show actual healing',()=>{
 const r=run(),state=bandageActionState(r);assert.equal(state.craft.ok,true);assert.equal(state.use.ok,true);assert.equal(state.use.amount,30);
 assert.match(describe(state,'use'),/30 health/);assert.equal(craftBandage(r).ok,true);
 assert.equal(r.backpack.supplies.cloth,0);assert.equal(r.backpack.supplies.antiseptic,0);assert.equal(r.backpack.supplies.bandage,2);
 assert.equal(useBandage(r).amount,30);assert.equal(r.health,100);assert.equal(r.backpack.supplies.bandage,1);
 assert.equal(bandageActionState(r).use.reason,'healthy');assert.match(describe(bandageActionState(r),'use'),/Full health/);
});
test('missing materials report exact deficits and rejected craft preserves supplies',()=>{
 const r=run({cloth:1,antiseptic:0,bandage:0}),state=bandageActionState(r),before=JSON.stringify(r.backpack);
 assert.deepEqual(state.craft.missing,{cloth:1,antiseptic:1});assert.equal(state.craft.reason,'materials');
 assert.match(describe(state,'craft'),/1 clean cloth \+ 1 antiseptic/);assert.equal(craftBandage(r).reason,'materials');assert.equal(JSON.stringify(r.backpack),before);
 assert.equal(state.use.reason,'empty');assert.match(describe(state,'use'),/No bandages packed/);
});
test('away from actual workbench disables crafting but carried treatment stays usable',()=>{
 const r=run();r.x=3;const state=bandageActionState(r);assert.equal(state.craft.reason,'workbench');assert.equal(craftBandage(r).reason,'workbench');
 assert.match(describe(state,'craft'),/Repair bench required/);assert.equal(state.use.ok,true);assert.equal(useBandage(r).ok,true);
});
test('bench and ingredient blockers both remain discoverable',()=>{
 const r=run({cloth:0,antiseptic:0,bandage:0});r.x=3;const state=bandageActionState(r);
 assert.equal(state.craft.reason,'workbench');assert.match(describe(state,'craft'),/need 2 clean cloth \+ 1 antiseptic/);
});
test('full bandage pocket and full health explain each independent disabled action',()=>{
 const r=run({cloth:2,antiseptic:1,bandage:3});r.health=100;const state=bandageActionState(r);
 assert.equal(state.craft.reason,'bandages-full');assert.equal(craftBandage(r).reason,'bandages-full');assert.match(describe(state,'craft'),/Three bandages/);
 assert.equal(state.use.reason,'healthy');assert.equal(useBandage(r).reason,'healthy');assert.match(describe(state,'use'),/Full health/);
});
test('caller-owned co-op lock blocks both presentations without spending or granting host authority',()=>{
 const r=run(),before=JSON.stringify(r);const state=bandageActionState(r,{canManage:false});
 assert.equal(state.craft.reason,'shared');assert.equal(state.use.reason,'shared');assert.equal(state.craft.ok,false);assert.equal(state.use.ok,false);
 assert.match(describe(state,'craft'),/unavailable in co-op/);assert.match(describe(state,'use'),/unavailable in co-op/);assert.equal(JSON.stringify(r),before);
});
test('downed run rejects both commands and generic action rejection never says ready',()=>{
 const r=run();r.health=0;const state=bandageActionState(r);assert.equal(state.craft.reason,'inactive');assert.equal(state.use.reason,'inactive');
 assert.equal(craftBandage(r).reason,'inactive');assert.equal(useBandage(r).reason,'inactive');assert.match(describe(state,'use'),/downed/);
 state.craft={...state.craft,reason:'unavailable'};assert.match(describe(state,'craft'),/Supplies unchanged/);
});
test('bench-free legacy recipe and maximum treatment retain existing authority',()=>{
 const r=run();delete r.course.coastal;r.health=10;const state=bandageActionState(r);
 assert.equal(state.craft.ok,true);assert.equal(craftBandage(r).ok,true);assert.equal(state.use.amount,BANDAGE_HEAL);assert.equal(useBandage(r).amount,BANDAGE_HEAL);
 assert.deepEqual(BANDAGE_RECIPE,{cloth:2,antiseptic:1});
});
