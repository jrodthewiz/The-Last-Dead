import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {guardBackgroundInput,backgroundInputState} from './background-input-guard.mjs';

test('background guard fails every native capture attempt before any original API executes',async()=>{
 let init,delegated=0;
 await guardBackgroundInput({addInitScript:async fn=>{init=fn;}});
 class Element {requestPointerLock(){delegated++;}requestFullscreen(){delegated++;}}
 const context={window:{},Element,navigator:{webdriver:true,keyboard:{lock(){delegated++;}}},document:{pointerLockElement:null,fullscreenElement:null}};
 runInNewContext(`(${init.toString()})()`,context);
 const element=new Element();
 for(const [call,kind]of [[()=>element.requestPointerLock(),'pointerLock'],[()=>element.requestFullscreen(),'fullscreen'],[()=>context.navigator.keyboard.lock(),'keyboardLock']])assert.throws(call,new RegExp(`forbids native ${kind}`));
 assert.equal(delegated,0);assert.deepEqual({...context.window.__BACKGROUND_INPUT_GUARD__},{pointerLock:1,fullscreen:1,keyboardLock:1});
 const state=await backgroundInputState({evaluate:async fn=>runInNewContext(`(${fn.toString()})()`,context)});
 assert.equal(state.webdriver,true);assert.equal(state.pointerLocked,false);assert.equal(state.fullscreen,false);
});

test('missing optional native keyboard API does not weaken pointer/fullscreen rejection',async()=>{
 let init;await guardBackgroundInput({addInitScript:async fn=>{init=fn;}});
 class Element {requestPointerLock(){}requestFullscreen(){}}
 const context={window:{},Element,navigator:{webdriver:true}};
 runInNewContext(`(${init.toString()})()`,context);
 assert.throws(()=>new Element().requestPointerLock(),/forbids native pointerLock/);
 assert.throws(()=>new Element().requestFullscreen(),/forbids native fullscreen/);
 assert.equal(context.window.__BACKGROUND_INPUT_GUARD__.keyboardLock,0);
});
