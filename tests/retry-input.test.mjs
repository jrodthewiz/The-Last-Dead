import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual keyboard listener without spinning up renderer assets.
const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const start=main.indexOf("addEventListener('keydown',e=>{");
const handler=main.slice(start,main.indexOf("addEventListener('keyup'",start));
function fixture(screen='play'){
 const messages=[],run={health:63,kills:12},course={id:'third-floor'},document={activeElement:{tagName:'BODY'}};
 run.course=course;
 const context=vm.createContext({screen,document,run,inspector:{active:false},packUI:{isOpen:false},keys:new Set(),pulses:new Set(),
  ui:{toast:message=>messages.push(message),escape:()=>false,root:{dataset:{}}},
  restart:()=>{context.retries=(context.retries||0)+1;},pause:()=>{context.screen='pause';},resume:()=>{context.screen='play';},
  addEventListener:(_,listener)=>{context.listener=listener;},getActiveVehicle:()=>null,switchWeapon(){},requestVermin(){},punch(){},requestChest(){},grapple(){},hookSequence:0,session:null});
 vm.runInContext(handler,context);
 const press=(code,repeat=false)=>{const event={code,repeat,preventDefault(){this.prevented=true;}};context.listener(event);return event;};
 return{context,run,course,document,messages,press};
}

test('R reports automatic replenishment without replacing the active run or its progress',()=>{
 const {context,run,course,messages,press}=fixture();
 press('KeyR');press('KeyR',true);
 assert.equal(context.retries||0,0);assert.equal(context.run,run);assert.equal(run.course,course);
 assert.equal(run.health,63);assert.equal(run.kills,12);assert.equal(context.screen,'play');
 assert.deepEqual(messages,['Weapons replenish automatically — no reload needed.']);
});

test('Enter retries once only after death or completion; R never retries in those states',()=>{
 for(const screen of ['menu','loading','play','pause','dead','win']){
  const {context,press,messages}=fixture(screen);press('KeyR');press('Enter');press('Enter',true);
  assert.equal(context.retries||0,['dead','win'].includes(screen)?1:0,screen);
  assert.equal(messages.length,screen==='play'?1:0,screen);
 }
 const {context,press}=fixture('dead');assert.equal(press('NumpadEnter').prevented,true);assert.equal(context.retries,1);
});

test('focused UI controls keep Enter activation and editable fields suppress gameplay shortcuts',()=>{
 for(const tagName of ['INPUT','TEXTAREA','SELECT','BUTTON','A']){
  const {context,document,press}=fixture('dead');document.activeElement={tagName};
  assert.equal(press('Enter').prevented,undefined);assert.equal(context.retries||0,0,tagName);
 }
 const {context,document,press,messages}=fixture();document.activeElement={tagName:'DIV',isContentEditable:true};
 press('KeyR');assert.deepEqual(messages,[]);
 document.activeElement={tagName:'BODY'};context.screen='dead';context.ui.root.dataset.settingsOpen='true';
 press('Enter');assert.equal(context.retries||0,0);
});

test('Escape retains pause/resume and closing settings takes priority',()=>{
 const {context,press}=fixture();press('Escape');assert.equal(context.screen,'pause');
 press('Escape');assert.equal(context.screen,'play');context.ui.escape=()=>true;
 press('Escape');assert.equal(context.screen,'play');
});

test('focused camera buttons do not send flight or weapon actions through the gameplay listener',()=>{
 const {context,document,press,messages}=fixture();context.inspector.active=true;document.activeElement={tagName:'BUTTON'};
 press('Space');press('KeyR');press('KeyE');
 assert.equal(context.keys.size,0);assert.equal(context.pulses.size,0);assert.deepEqual(messages,[]);
 press('Escape');assert.equal(context.screen,'pause');
});
