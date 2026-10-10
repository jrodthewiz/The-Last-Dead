import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function bridge(){
 const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const start=source.indexOf("canvas.addEventListener('pointerdown'");
 const end=source.indexOf("document.addEventListener('pointerlockchange'",start);
 assert(start>0&&end>start);
 const canvasEvents=new Map(),globalEvents=new Map(),canvas={addEventListener:(name,fn)=>canvasEvents.set(name,fn),setPointerCapture(){}};
 const document={pointerLockElement:canvas,addEventListener(){}};
 const context={screen:'play',inspector:{active:false},canvas,document,touches:new Map(),pulses:new Set(),fire:false,alt:false,attachment:false,pointerLock(){},look(){},
  addEventListener:(name,fn)=>globalEvents.set(name,fn)};
 runInNewContext(source.slice(start,end),context);
 return{context,press:button=>canvasEvents.get('mousedown')({button}),release:button=>globalEvents.get('mouseup')({button,pointerId:1}),
  first:button=>canvasEvents.get('pointerdown')({button,pointerType:'mouse',pointerId:1})};
}

test('holding aim then pressing fire registers both buttons and independent releases',()=>{
 const b=bridge();b.first(2);b.press(2);assert.equal(b.context.alt,true);assert.equal(b.context.fire,false);
 // Chromium emits no second pointerdown for the added left button.
 b.press(0);assert.equal(b.context.fire,true);assert.equal(b.context.alt,true);
 b.release(0);assert.equal(b.context.fire,false);assert.equal(b.context.alt,true);
 b.release(2);assert.equal(b.context.alt,false);
});

test('holding fire then adding aim works, and aiming can release while fire stays held',()=>{
 const b=bridge();b.first(0);b.press(0);b.press(2);assert.equal(b.context.fire,true);assert.equal(b.context.alt,true);
 b.release(2);assert.equal(b.context.fire,true);assert.equal(b.context.alt,false);
 b.release(0);assert.equal(b.context.fire,false);
});

test('paused and uncaptured mouse presses do not fire or aim',()=>{
 const b=bridge();b.context.document.pointerLockElement=null;b.press(0);b.press(2);
 assert.equal(b.context.fire,false);assert.equal(b.context.alt,false);
 b.context.document.pointerLockElement=b.context.canvas;b.context.screen='pause';b.press(0);b.press(2);
 assert.equal(b.context.fire,false);assert.equal(b.context.alt,false);
 b.context.screen='play';b.context.inspector.active=true;b.press(0);b.press(2);
 assert.equal(b.context.fire,false);assert.equal(b.context.alt,false);
});

test('the attachment button is independent from aim and primary fire',()=>{
 const b=bridge();b.press(2);b.press(1);
 assert.equal(b.context.alt,true);assert.equal(b.context.attachment,true);assert.equal(b.context.fire,false);
 b.release(1);assert.equal(b.context.attachment,false);assert.equal(b.context.alt,true);
});
