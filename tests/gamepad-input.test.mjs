import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GamepadInput,stickWithDeadzone,emptyGamepadFrame,GAMEPAD_BINDINGS} from '../gamepad-input.js';
import {newRun,makeCourse,tickPlayer,clamp,switchWeapon,nextOwnedWeapon} from '../engine.js';
import {RUNTIME_FILES,REQUIRED_RUNTIME_FILES} from '../build.mjs';
import {UI} from '../ui.js';

const pad=(index=0)=>({index,id:`pad-${index}`,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))});
const setButton=(p,index,down=true)=>{p.buttons[index]={pressed:down,value:down?1:0};};
const ready=(input,p,context='play')=>input.poll([p],{context});

test('radial deadzone rejects drift, rescales useful travel and bounds diagonal magnitude',()=>{
 for(const [x,y] of [[0,0],[.1,.1],[NaN,Infinity]])assert.deepEqual(stickWithDeadzone(x,y),{x:0,y:0});
 const half=stickWithDeadzone(.59,0);assert.ok(Math.abs(half.x-.5)<1e-10);assert.equal(half.y,0);
 const diagonal=stickWithDeadzone(1,-1);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
 assert.ok(diagonal.x>0&&diagonal.y<0);
});

test('only standard mappings are accepted; analog movement/look and held triggers are independent',()=>{
 const input=new GamepadInput(),p=pad();p.mapping='';assert.equal(ready(input,p).connected,false);
 p.mapping='standard';assert.equal(ready(input,p).armed,true);p.axes=[.6,-.8,.6,.3];setButton(p,7);setButton(p,6);setButton(p,1);setButton(p,2);
 const frame=ready(input,p);assert.ok(Math.abs(frame.forward-.8)<1e-10);assert.ok(Math.abs(frame.strafe-.6)<1e-10);
 assert.ok(frame.turn>0&&frame.lookY<0);assert.equal(frame.fire,true);assert.equal(frame.alt,true);assert.equal(frame.slide,true);assert.equal(frame.harvest,true);
 assert.equal(ready(input,p).fire,true,'continuous fire remains held, rather than edge-only');
});

test('every discrete binding emits one edge until released and freshly pressed',()=>{
 for(const action of ['jump','dash','parry','chest','hook','nextWeapon','pause','up','down','left','right']){
  const input=new GamepadInput(),p=pad();ready(input,p);setButton(p,GAMEPAD_BINDINGS[action]);
  assert.equal(ready(input,p).edges[action],true,action);
  for(let frame=0;frame<120;frame++)assert.equal(ready(input,p).edges[action],false,action);
  setButton(p,GAMEPAD_BINDINGS[action],false);ready(input,p);setButton(p,GAMEPAD_BINDINGS[action]);
  assert.equal(ready(input,p).edges[action],true,action);
 }
});

test('Y and D-pad cycle once, with deterministic simultaneous-button priority',()=>{
 for(const [button,step] of [[3,1],[12,1],[15,1],[13,-1],[14,-1]]){
  const input=new GamepadInput(),p=pad();ready(input,p);setButton(p,button);
  assert.equal(ready(input,p).weaponStep,step);assert.equal(ready(input,p).weaponStep,0);
 }
 const input=new GamepadInput(),p=pad();ready(input,p);setButton(p,3);setButton(p,14);assert.equal(ready(input,p).weaponStep,1);
});

test('menu navigation uses directional edges and confirms/cancels without emitting gameplay holds',()=>{
 const input=new GamepadInput(),p=pad();ready(input,p,'menu');p.axes=[0,-1,0,0];setButton(p,0);setButton(p,1);setButton(p,7);
 const frame=ready(input,p,'menu');assert.equal(frame.menuDirection,'up');assert.equal(frame.edges.jump,true);assert.equal(frame.edges.slide,true);
 assert.equal(frame.fire,false);assert.equal(frame.forward,0);assert.equal(frame.weaponStep,0);
 assert.equal(ready(input,p,'menu').menuDirection,null);p.axes=[0,0,0,0];ready(input,p,'menu');p.axes=[1,0,0,0];
 assert.equal(ready(input,p,'menu').menuDirection,'right');
});

test('pause, menu and blur transitions require all controls neutral before a fresh input can rearm',()=>{
 const input=new GamepadInput(),p=pad();ready(input,p);setButton(p,7);setButton(p,9);p.axes[0]=1;
 assert.equal(ready(input,p).fire,true);
 for(const context of ['menu','inactive','play']){
  const frame=ready(input,p,context);assert.equal(frame.armed,false);assert.equal(frame.fire,false);assert.equal(frame.strafe,0);assert.equal(frame.edges.pause,undefined);
 }
 setButton(p,9,false);p.axes[0]=0;assert.equal(ready(input,p).armed,false,'a held trigger still prevents rearming');
 setButton(p,7,false);assert.equal(ready(input,p).armed,true);setButton(p,9);assert.equal(ready(input,p).edges.pause,true);
 input.suppress();assert.equal(ready(input,p).armed,false);setButton(p,9,false);ready(input,p);setButton(p,7);
 assert.equal(ready(input,p).fire,true);
});

test('connection while controls are held and reconnect never replay a stale button press',()=>{
 const input=new GamepadInput(),p=pad();setButton(p,5);setButton(p,7);
 assert.equal(ready(input,p).armed,false);setButton(p,5,false);setButton(p,7,false);ready(input,p);setButton(p,5);
 assert.equal(ready(input,p).edges.parry,true);
 const disconnected=input.poll([]);assert.equal(disconnected.connected,false);assert.equal(disconnected.changed,true);assert.equal(disconnected.fire,false);
 assert.equal(ready(input,p).armed,false);setButton(p,5,false);ready(input,p);setButton(p,5);
 assert.equal(ready(input,p).edges.parry,true);
});

test('the active standard pad remains stable and replacement pads must rearm',()=>{
 const input=new GamepadInput(),first=pad(1),second=pad(0);ready(input,first);setButton(first,5);setButton(second,4);
 const frame=input.poll([second,first]);assert.equal(frame.edges.parry,true);assert.equal(frame.edges.hook,false);assert.equal(frame.changed,false);
 first.connected=false;const replaced=input.poll([second,first]);assert.equal(replaced.changed,true);assert.equal(replaced.armed,false);
 setButton(second,4,false);input.poll([second]);setButton(second,4);assert.equal(input.poll([second]).edges.hook,true);
});

test('look rate gives the same rotation at 30, 60 and 120Hz through the existing simulation',()=>{
 const rotations=[];
 for(const hz of [30,60,120]){
  const input=new GamepadInput(),p=pad();ready(input,p);p.axes=[0,0,.6,.3];const controls=ready(input,p);
  const run=newRun(makeCourse());run.mode='play';run.angle=0;
  for(let frame=0;frame<hz;frame++)tickPlayer(run,1/hz,{turn:controls.turn,lookY:controls.lookY});
  rotations.push([run.angle,run.pitch]);
 }
 for(const rotation of rotations)assert.ok(Math.abs(rotation[0]-rotations[0][0])<1e-10&&Math.abs(rotation[1]-rotations[0][1])<1e-10);
});

const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const inputSource=main.slice(main.indexOf('function intent('),main.indexOf("addEventListener('keydown',event=>{if(!event.repeat)useInputDevice"));
function mainHarness({guest=false}={}){
 const p=pad(),run=newRun(makeCourse()),played=[];run.mode='play';
 const context=vm.createContext({run,screen:'play',windowFocused:true,document:{hidden:false},navigator:{getGamepads:()=>[p]},inspector:{active:false},
  gamepadInput:new GamepadInput(),gamepadFrame:emptyGamepadFrame(),inputDevice:'keyboard',keys:new Set(),touches:new Map(),pulses:new Set(),settings:{},fire:false,alt:false,
  session:guest?{connected:true,role:'guest'}:null,parrySequence:0,chestSequence:0,hookSequence:0,verminSequence:0,clamp,switchWeapon,nextOwnedWeapon,attackVermin:()=>false,
  parry:()=>{context.parries=(context.parries||0)+1;},chestFinisher:()=>{context.chestActions=(context.chestActions||0)+1;},grapple:()=>{context.hooks=(context.hooks||0)+1;},audio:{play:type=>played.push(type)},
  useInputDevice:device=>{context.inputDevice=device;},ui:{gamepadNavigate:action=>{context.navigation=action;return true;}},
  pause:()=>{context.screen='pause';context.gamepadInput.suppress();context.gamepadFrame=emptyGamepadFrame();context.pulses.clear();},
  resume:()=>{context.screen='play';context.gamepadInput.suppress();context.gamepadFrame=emptyGamepadFrame();context.pulses.clear();},
  resetInput:()=>{context.gamepadInput.suppress();context.gamepadFrame=emptyGamepadFrame();context.pulses.clear();}
 });
 vm.runInContext(inputSource,context);context.updateGamepad();return{p,context,played};
}

test('actual main input bridge preserves keyboard controls and latches short trigger taps until consumed',()=>{
 const {p,context}=mainHarness();context.keys.add('KeyW');p.axes=[.4,0,.5,0];setButton(p,7);context.updateGamepad();
 let intent=context.intent();assert.equal(intent.forward,1);assert.ok(intent.strafe>0);assert.ok(intent.turn>0);assert.equal(intent.fire,true);
 setButton(p,7,false);context.updateGamepad();assert.equal(context.intent().fire,true,'a tap survives until a fixed simulation step');
 context.pulses.clear();assert.equal(context.intent().fire,false);
 setButton(p,2);context.updateGamepad();assert.equal(context.intent().harvest,true);
});

test('actual main input bridge sends single parry/hook sequences and respects guest authority',()=>{
 for(const guest of [false,true]){
  const {p,context}=mainHarness({guest});setButton(p,5);setButton(p,4);
  for(let frame=0;frame<60;frame++)context.updateGamepad();
  assert.equal(context.parrySequence,1);assert.equal(context.hookSequence,1);
  assert.equal(context.parries||0,guest?0:1);assert.equal(context.hooks||0,guest?0:1);
  context.run.health=0;setButton(p,5,false);setButton(p,4,false);context.updateGamepad();setButton(p,5);setButton(p,4);context.updateGamepad();
  assert.equal(context.parrySequence,1);assert.equal(context.hookSequence,1,'downed players cannot enqueue extra abilities');
 }
});

test('R3 sends its own single chest sequence and a guest never predicts the finisher',()=>{
 assert.equal(GAMEPAD_BINDINGS.chest,11);
 for(const guest of [false,true]){
  const {p,context,played}=mainHarness({guest});setButton(p,11);
  for(let frame=0;frame<120;frame++)context.updateGamepad();
  assert.equal(context.chestSequence,1);assert.equal(context.intent().chest,1);assert.equal(context.chestActions||0,guest?0:1);
  assert.equal(context.parrySequence,0);assert.deepEqual(played,[],'canonical host events own chest audio');
  setButton(p,11,false);context.updateGamepad();setButton(p,11);context.updateGamepad();assert.equal(context.chestSequence,2);
  context.run.health=0;setButton(p,11,false);context.updateGamepad();setButton(p,11);context.updateGamepad();assert.equal(context.chestSequence,2);
 }
});

test('actual Start pause/resume suppresses held trigger and disconnect clears input instead of firing',()=>{
 const {p,context}=mainHarness();setButton(p,7);setButton(p,9);context.updateGamepad();assert.equal(context.screen,'pause');
 setButton(p,9,false);context.updateGamepad();setButton(p,9);context.updateGamepad();assert.equal(context.screen,'pause','a held trigger has not rearmed Start');
 setButton(p,7,false);setButton(p,9,false);context.updateGamepad();setButton(p,9);context.updateGamepad();assert.equal(context.screen,'play');
 setButton(p,9,false);context.updateGamepad();assert.equal(context.intent().fire,false);
 setButton(p,7);context.updateGamepad();assert.equal(context.intent().fire,true);
 context.navigator.getGamepads=()=>[];context.updateGamepad();assert.equal(context.screen,'pause');assert.equal(context.intent().fire,undefined);
 assert.equal(context.pulses.size,0);assert.equal(context.inputDevice,'keyboard');
});

test('build explicitly includes and requires the standalone gamepad adapter',()=>{
 assert.ok(RUNTIME_FILES.includes('gamepad-input.js'));assert.ok(REQUIRED_RUNTIME_FILES.includes('gamepad-input.js'));
});

test('an open controls sheet scrolls its actual overflow ancestor; closing it restores menu focus navigation',()=>{
 const priorDocument=globalThis.document,priorStyle=globalThis.getComputedStyle;
 let focusMoves=0,clicks=0;
 const toggle={tagName:'BUTTON',type:'button',closest:()=>null,getClientRects:()=>[{}],
  focus(){globalThis.document.activeElement=toggle;focusMoves++;},click(){guide.hidden=!guide.hidden;clicks++;},setAttribute(name,value){this[name]=value;}};
 const other={...toggle,focus(){globalThis.document.activeElement=other;focusMoves++;}};
 const scroller={scrollHeight:1500,clientHeight:720,scrollTop:0,overflowY:'auto',parentElement:null,querySelectorAll:()=>[toggle,other]};
 const wrapper={scrollHeight:1500,clientHeight:1500,overflowY:'visible',parentElement:scroller};
 const guide={hidden:false,scrollHeight:900,clientHeight:900,overflowY:'visible',parentElement:wrapper};
 const root={contains:node=>[guide,wrapper,scroller].includes(node),querySelector:selector=>selector==='.field-guide'?guide:selector==='[data-action="guide"]'?toggle:selector==='.screen:not([hidden])'?scroller:null};
 const ui=Object.create(UI.prototype);ui.root=root;
 try{
  globalThis.document={activeElement:toggle};globalThis.getComputedStyle=node=>({overflowY:node.overflowY});
  assert.equal(ui.gamepadNavigate('down'),true);assert.equal(scroller.scrollTop,320);assert.equal(focusMoves,0);
  ui.gamepadNavigate('down');ui.gamepadNavigate('down');assert.equal(scroller.scrollTop,780,'scrolling reaches the final bindings without overshooting');
  ui.gamepadNavigate('up');assert.equal(scroller.scrollTop,460);assert.equal(focusMoves,0);
  ui.gamepadNavigate('confirm');assert.equal(guide.hidden,true);assert.equal(clicks,1,'A toggles the Controls trigger rather than another menu action');
  ui.gamepadNavigate('down');assert.equal(globalThis.document.activeElement,other,'normal menu focus traversal resumes when closed');
  guide.hidden=false;assert.equal(ui.gamepadNavigate('cancel'),true);assert.equal(guide.hidden,true);assert.equal(toggle['aria-expanded'],'false');
 }finally{
  if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;
  if(priorStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=priorStyle;
 }
});
