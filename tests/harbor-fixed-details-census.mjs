import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {HarborWorld} from '../harbor-visuals.js';
import {makeHarborCourse} from '../harbor-course.js';
import {instanceHarborStaticDetails,isFixedHarborDetail,isStaticHarborDetail} from '../harbor-static-details.js';
// Resolve the frozen helper against this scene's THREE identity: a second
// vendor module would reject every hook by prototype identity, invalidating
// the baseline. Its source remains byte-preserved in the frozen archive.
const baselineSource=fs.readFileSync('output/qa-runtime/island-environment-v77/harbor-static-details.js','utf8')
 .replace("'./vendor/three.module.js'",JSON.stringify(new URL('../vendor/three.module.js',import.meta.url).href))
 .replace("'./coastal-instancing.js'",JSON.stringify(new URL('../coastal-instancing.js',import.meta.url).href));
const {instanceHarborStaticDetails:baseline,isStaticHarborDetail:baselineEligible}=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
const previous=globalThis.document;
const ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:20}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>ctx}),createElementNS:()=>{const handlers={};return{width:1,height:1,addEventListener:(event,callback)=>handlers[event]=callback,removeEventListener(){},set src(value){queueMicrotask(()=>handlers.load?.());}};}};
const world=new HarborWorld(new THREE.Scene(),makeHarborCourse({openWorld:true,cityLootSeed:7317}));
try{
 await world.ready;assert.deepEqual(world.diagnostics.errors,[]);
 world.coastalGraphic.dispose();world.coastalGraphic=null;world.staticDetails.dispose();world.staticDetails=null;
 const original=[];world.root.traverseVisible(o=>{if(o.isMesh)original.push({object:o,visible:o.visible});});
 const count=()=>{let draws=0,triangles=0;world.root.traverseVisible(o=>{if(!o.isMesh)return;draws+=Array.isArray(o.material)?o.geometry.groups.length:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});return{draws,triangles};};
 const old=baseline(world.root,{eligible:o=>baselineEligible(o,world)}),before={diagnostics:old.diagnostics,allVisible:count()};old.dispose();
 const next=instanceHarborStaticDetails(world.root,{eligible:o=>isStaticHarborDetail(o,world),mergeEligible:o=>isFixedHarborDetail(o,world)}),after={diagnostics:next.diagnostics,allVisible:count()};
 assert.equal(after.allVisible.triangles,before.allVisible.triangles);assert(after.allVisible.draws<before.allVisible.draws);
 const excludedCounts={};world.root.traverseVisible(o=>{if(o.isMesh&&/^(ThaiKitBoundaryFence|SignMount|EntranceDoor|EntrancePull)$/.test(o.name))excludedCounts[o.name]=(excludedCounts[o.name]||0)+1;});
 next.dispose();for(const p of original)assert.equal(p.object.visible,p.visible,p.object.name);
 const report={scope:'Actual seed7317 HarborWorld CPU scene census, mocked canvas/image loading; all-visible theoretical submissions, not native culling/FPS. Baseline frozenv77 helper vs candidate on identical assembled scene. Building chunk changes elsewhere do not affect paired scope.',nativeBaseline:'output/playwright/island-art-v80/report.json',before,after,delta:{draws:after.allVisible.draws-before.allVisible.draws,triangles:after.allVisible.triangles-before.allVisible.triangles},retainedOriginalVisibleNames:excludedCounts,sourceRestore:true};
 fs.writeFileSync('output/island-static-detail-performance-findings.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{world.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
