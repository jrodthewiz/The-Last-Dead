import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installGameplayInput,createLookInput,wrapHeading} from '../island/gameplay-input.js';
import {finishReload,spentCases} from '../island/armory-state.js';

class Target extends EventTarget{
 constructor(name=''){super();this.name=name;this.firstElementChild={style:{}};this.dataset={touch:name};}
 setPointerCapture(id){this.capture=id;}
 getBoundingClientRect(){return {left:0,top:0,width:84,height:84};}
 send(type,values={}){const e=new Event(type,{cancelable:true});Object.assign(e,values);this.dispatchEvent(e);this['on'+type]?.(e);}
}
const win=new Target(),doc=new Target(),canvas=new Target(),look=new Target(),joystick=new Target(),fireButton=new Target('fire'),jumpButton=new Target('jump');
let firing=false,aiming=false,mode='playing',reloading=false,shots=0,yaw=0,pitch=0,actions=[];
const stick={forward:0,strafe:0};doc.pointerLockElement=canvas;
const controls=installGameplayInput({canvas,look,joystick,buttons:[fireButton,jumpButton],win,doc,getMode:()=>mode,getVehicle:()=>null,getSensitivity:()=>1,canFire:()=>!reloading,isTouch:false,lock(){doc.pointerLockElement=canvas;},fire:v=>firing=v,aim:v=>aiming=v,shoot:()=>shots++,lookBy:d=>{yaw=wrapHeading(yaw+d.yaw);pitch-=d.pitch;},action:a=>actions.push(a),stick});
const mouse={pointerId:1,pointerType:'mouse',button:0};
function press(){canvas.send('pointerdown',mouse);canvas.send('mousedown',mouse);assert.ok(firing);}
for(const release of ['mouseup','pointerup','pointercancel','lostpointercapture']){
 press();win.send(release,mouse);assert.equal(firing,false,release);
}
press();win.send('mousemove',{movementX:0,movementY:0,buttons:0});assert.equal(firing,false,'Recover a lost mouseup from physical buttons');
press();win.send('blur');assert.equal(firing,false);
press();doc.hidden=true;doc.send('visibilitychange');doc.hidden=false;assert.equal(firing,false);
press();doc.pointerLockElement=null;doc.send('pointerlockchange');assert.equal(firing,false);doc.pointerLockElement=canvas;doc.send('pointerlockchange');
canvas.send('pointerdown',{...mouse,button:2});canvas.send('mousedown',{...mouse,button:2});assert.ok(aiming);win.send('mouseup',{button:2});assert.equal(aiming,false);
reloading=true;const before=shots;canvas.send('mousedown',mouse);assert.equal(firing,false);assert.equal(shots,before,'A click during reload cannot queue persistent fire');reloading=false;
// Browser mouse semantics: only the first held button emits pointerdown;
// every button emits mousedown/mouseup, and pointerup is final-button only.
controls.reset();let held=0;
function down(button){const mask=button===0?1:2;if(!held)canvas.send('pointerdown',{...mouse,button,buttons:held|mask});held|=mask;canvas.send('mousedown',{...mouse,button,buttons:held});}
function up(button){held&=~(button===0?1:2);win.send('mouseup',{...mouse,button,buttons:held});if(!held)win.send('pointerup',{...mouse,button,buttons:0});}
for(const first of [2,0]){
 const second=first===0?2:0,start=shots;down(first);down(second);
 assert.equal(firing,true,'Both button orders fire');assert.equal(aiming,true,'Both button orders aim');assert.equal(shots,start+1,'One shot per press, no pointer/mouse duplicate');
 up(0);assert.equal(firing,false);assert.equal(aiming,true,'Fire release retains aim');
 for(let i=0;i<3;i++){down(0);assert.equal(shots,start+2+i);assert.equal(aiming,true);up(0);}
 down(0);up(2);assert.equal(firing,true,'Aim release retains fire');assert.equal(aiming,false);up(0);
}
for(const reset of [()=>win.send('blur'),()=>{doc.hidden=true;doc.send('visibilitychange');doc.hidden=false;},()=>doc.send('pointerlockchange'),()=>win.send('pointercancel',mouse)]){
 down(2);down(0);reset();assert.equal(firing,false);assert.equal(aiming,false);up(0);up(2);
}
mode='pause';let count=shots;down(2);down(0);assert.equal(shots,count);assert.equal(firing,false);assert.equal(aiming,false);up(0);up(2);mode='playing';
reloading=true;down(2);count=shots;down(0);assert.equal(shots,count);assert.equal(firing,false);up(0);up(2);reloading=false;
for(const pointerType of ['touch','pen']){
 const count=shots;canvas.send('pointerdown',{pointerId:77,pointerType,button:0});assert.equal(shots,count+1);win.send('pointerup',{pointerId:77,pointerType,button:0});assert.equal(firing,false);
}
controls.reset();
// A second touch must not cancel the held FIRE finger or replace the look finger.
fireButton.send('pointerdown',{pointerId:10,pointerType:'touch',button:0});assert.ok(firing);
jumpButton.send('pointerdown',{pointerId:11,pointerType:'touch',button:0});win.send('pointerup',{pointerId:11,pointerType:'touch',button:0});assert.ok(firing);assert.deepEqual(actions,['jump']);
win.send('lostpointercapture',{pointerId:10,pointerType:'touch'});assert.equal(firing,false);
look.send('pointerdown',{pointerId:20,pointerType:'touch',clientX:100,clientY:100});
look.send('pointermove',{pointerId:20,clientX:110,clientY:100});assert.ok(Math.abs(yaw-.05)<1e-9);
look.send('pointerdown',{pointerId:21,pointerType:'touch',clientX:800,clientY:0});
look.send('pointermove',{pointerId:21,clientX:900,clientY:0});assert.ok(Math.abs(yaw-.05)<1e-9);
look.send('pointermove',{pointerId:20,clientX:120,clientY:100});assert.ok(Math.abs(yaw-.1)<1e-9);
win.send('pointerup',{pointerId:20,pointerType:'touch'});look.send('pointermove',{pointerId:20,clientX:130,clientY:100});assert.ok(Math.abs(yaw-.1)<1e-9);
joystick.send('pointerdown',{pointerId:30,clientX:42,clientY:0});assert.equal(stick.forward,1);controls.reset();joystick.send('pointermove',{pointerId:30,clientX:42,clientY:0});assert.equal(stick.forward,0,'Reset must also forget captured movement pointers');
// Pointer-lock warp / nonfinite / full-turn packets cannot rotate the view.
yaw=pitch=0;controls.reset();win.send('mousemove',{movementX:1900,movementY:500,buttons:0});assert.equal(yaw,0);
controls.beginFrame();win.send('mousemove',{movementX:9,movementY:4,buttons:0});assert.ok(Math.abs(yaw-.018)<1e-9);assert.ok(Math.abs(pitch+.008)<1e-9);
const stable=yaw;for(const movementX of [NaN,Infinity,1920,-3840])win.send('mousemove',{movementX,movementY:0,buttons:0});assert.equal(yaw,stable);
const filter=createLookInput();filter.consume(0,0);assert.equal(filter.consume(10,0).yaw,.02);assert.equal(filter.consume(1000,0),null);
filter.beginFrame();assert.ok(filter.consume(400,0));assert.equal(filter.consume(400,0),null,'A burst in one frame cannot spin the camera');
assert.ok(Math.abs(wrapHeading(10000*Math.PI+.2)-.2)<1e-10);
// Exercise the actual game's reload begin/tick code, including the empty-mag
// automatic path, rather than a second implementation of its reload rules.
const game=fs.readFileSync(new URL('../island/game.js',import.meta.url),'utf8');
const reloadFn=game.split('\n').find(line=>line.startsWith('function doReload(){'));
const marker=game.indexOf('if(reload>0){reload=Math.max(0,reload-dt);');assert.ok(marker>0);
let end=marker,depth=0;for(let i=game.indexOf('{',marker);i<game.length;i++){if(game[i]==='{')depth++;if(game[i]==='}'&&--depth===0){end=i+1;break;}}
const actualTick=game.slice(marker,end),state={weapon:'carbine',ammo:0,reserve:48,armory:{carbine:{ammo:0,reserve:48,owned:true}}};
const context=vm.createContext({state,touch:false,mode:'playing',vehicle:null,healing:null,searchAction:null,crimson:null,shove:null,punch:null,pendingStrike:null,reload:0,reloadCount:0,reloadSpent:0,reloadEjected:false,reloadCue:0,charge:0,firing:true,aiming:true,pointerControls:{releaseCombat(){}},locomotion:()=>({vault:null}),weaponProfile:()=>({id:'carbine',kind:'bullet',capacity:8,reload:1.6}),sound:{play(){}},notify(){},finishReload,spentCases,updateHUD(){},dt:1/60});
vm.runInContext(reloadFn,context);vm.runInContext('doReload()',context);assert.equal(context.firing,false);assert.equal(context.aiming,false);assert.equal(context.reload,1.6);
for(let i=0;i<600;i++)vm.runInContext(actualTick,context);
assert.equal(context.reload,0);assert.equal(state.ammo,8);assert.equal(state.reserve,40);assert.equal(context.firing,false,'Reload completion must not resume an old held trigger');
state.ammo=0;state.reserve=0;context.firing=true;vm.runInContext('doReload()',context);assert.equal(context.firing,true,'No-reserve reload request leaves combat unchanged in v48');assert.equal(context.reload,0);
assert.ok(game.includes("camera.rotation.set(state.pitch,-state.yaw,0,'YXZ')"),'On-foot view must retain player pitch during vaults');
console.log(JSON.stringify({passed:true,mouseChordOrders:2,repeatedAimShots:6,independentReleases:true,nonMouseCanvasPaths:2,releasePaths:8,multitouchOwnership:true,lookJumpGuards:true,reloadFrames:600,reloadCompletesOnce:true}));
