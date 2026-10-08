import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FramebufferTexture,DataTexture,HalfFloatType,UnsignedByteType} from '../vendor/three.module.js';

// Execute the actual vendored texture lifecycle; only GPU allocation is
// replaced. A native browser restart also verifies the real copy/driver path.
const source=readFileSync(new URL('../vendor/three.webgpu.js',import.meta.url),'utf8');
const marker='\tupdateTexture( texture, options = {} ) {';
const start=source.indexOf(marker,source.indexOf('class Textures '))+marker.length;
const end=source.indexOf('\n\t/**\n\t * Updates the sampler',start);
assert(start>=marker.length&&end>start);
const update=new Function('UnsignedByteType',`return function(texture,options={}){${source.slice(start,end).replace(/}\s*$/,'')}}`)(UnsignedByteType);
function harness(target){
 const allocations=[],states=new WeakMap();
 const manager={renderer:{getRenderTarget:()=>target},backend:{createTexture(texture,options){allocations.push({texture,target:options.renderTarget,type:texture.type,format:options.renderTarget?'rgba16float':'bgra8unorm'});},destroyTexture(){}},get(texture){if(!states.has(texture))states.set(texture,{});return states.get(texture);},getSize:()=>({width:1280,height:800,depth:1}),needsMipmaps:()=>true,getMipLevels:()=>11,info:{createTexture(){}},_destroyTexture(){}};
 return{manager,allocations,update:(texture,options)=>update.call(manager,texture,options)};
}

test('HDR framebuffer binding initialization and later copy use one matching target allocation',()=>{
 const hdr={texture:{type:HalfFloatType}},h=harness(hdr),texture=new FramebufferTexture(1280,800);
 h.update(texture); // Bindings._init does not supply options.
 assert.equal(h.allocations[0].target,hdr);assert.equal(h.allocations[0].type,HalfFloatType);assert.equal(h.allocations[0].format,'rgba16float');
 h.update(texture,{renderTarget:hdr});assert.equal(h.allocations.length,1,'copy reuses correctly initialized texture without reallocation');
 texture.dispose();
});

test('explicit canvas context remains authoritative while a different HDR target is bound',()=>{
 const h=harness({texture:{type:HalfFloatType}}),texture=new FramebufferTexture(1280,800);
 h.update(texture,{renderTarget:null});assert.equal(h.allocations[0].target,null);assert.equal(texture.type,UnsignedByteType);assert.equal(h.allocations[0].format,'bgra8unorm');
 texture.dispose();
});

test('ordinary image/storage allocation does not inherit a framebuffer target',()=>{
 const h=harness({texture:{type:HalfFloatType}}),texture=new DataTexture();texture.isStorageTexture=true;texture.type=UnsignedByteType;
 h.update(texture);assert.equal(h.allocations[0].target,undefined);assert.equal(texture.type,UnsignedByteType);texture.dispose();
});
