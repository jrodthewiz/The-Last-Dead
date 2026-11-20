import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as T from '../vendor/three.module.js';
import {installGameplayInput} from '../island/gameplay-input.js';
import {WEAPONS,weaponProfile,storeAmmo,retainCase,spentCases,finishReload,repeatsWhileHeld} from '../island/armory-state.js';
class Target extends EventTarget {
 constructor(){super();this.firstElementChild={style:{}};}
 send(type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,props);this.dispatchEvent(e);}
}
const source=fs.readFileSync(new URL('../island/game.js',import.meta.url),'utf8');
const state={weapon:'carbine',ammo:8,reserve:48,armory:{carbine:{owned:true,ammo:8,reserve:48}}};
const camera=new T.PerspectiveCamera();camera.updateMatrixWorld();
const ctx=vm.createContext({T,WEAPONS,armoryModels:{models:WEAPONS.map(()=>({userData:{rifle:{sockets:{ejectionSocket:new T.Object3D()}}}}))},state,camera,mode:'playing',touch:false,vehicle:null,healing:null,crimson:null,shove:null,punch:null,pendingStrike:null,searchAction:null,restore:null,meleeFollowup:null,weaponWasVisible:true,reload:0,reloadCount:0,reloadSpent:0,reloadCue:0,reloadEjected:false,shotCooldown:0,recoil:0,charge:0,heat:0,barrelCooling:false,shotSequence:0,firing:false,aiming:false,firstPersonMotion:{obstructed:false},locomotion:()=>({vault:null}),weaponProfile,storeAmmo,retainCase,spentCases,finishReload,repeatsWhileHeld,weaponDamageMultiplier:()=>1,actors:{enemies:[]},sound:{play(){}},updateHUD(){},notify(){},trace:()=>[],wallDistance:(_o,_d,r)=>r,feedback:{casing(){},trail(){}},rifle:{flash:new T.Object3D()},SALVAGE_RESPONSE:{},hearNoise(){},coop:null,dt:1/60});
vm.runInContext(source.slice(source.indexOf('function shoot(melee=false){'),source.indexOf('function crimsonApproach')),ctx);
for(const name of ['handsFree','canUseWeapon','canFireInput','canAim','doReload'])vm.runInContext(source.split('\n').find(line=>line.startsWith('function '+name+'(')),ctx);
const marker=source.indexOf('if(reload>0){reload=Math.max(0,reload-dt);');let depth=0,end;
for(let i=source.indexOf('{',marker);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}
const reloadTick=source.slice(marker,end);
const canvas=new Target(),win=new Target(),doc=new Target();doc.pointerLockElement=canvas;
const controls=installGameplayInput({canvas,look:new Target(),joystick:new Target(),buttons:[],win,doc,getMode:()=>ctx.mode,getVehicle:()=>ctx.vehicle,getSensitivity:()=>1,canFire:()=>vm.runInContext('canFireInput()',ctx),isTouch:false,lock(){},fire:v=>ctx.firing=v,aim:v=>ctx.aiming=v&&vm.runInContext('canAim()',ctx),shoot:()=>vm.runInContext('shoot()',ctx),lookBy(){},action(){},stick:{}});ctx.pointerControls=controls;
let held=0;
function down(button){const mask=button===0?1:2,props={pointerType:'mouse',pointerId:1,button,buttons:held|mask};if(!held)canvas.send('pointerdown',props);held|=mask;canvas.send('mousedown',props);}
function up(button){held&=~(button===0?1:2);const props={pointerType:'mouse',pointerId:1,button,buttons:held};win.send('mouseup',props);if(!held)win.send('pointerup',props);}
function tick(frames){for(let i=0;i<frames;i++){ctx.shotCooldown=Math.max(0,ctx.shotCooldown-ctx.dt);vm.runInContext(reloadTick,ctx);vm.runInContext('if(firing&&repeatsWhileHeld(weaponProfile(state)))shoot()',ctx);}}
// Exact input module drives the real shoot function, with world/render effects stubbed.
down(2);down(0);assert.equal(ctx.aiming,true);assert.equal(state.ammo,7);tick(60);assert.equal(state.ammo,7,'Carbine remains one shot per press');up(0);down(0);assert.equal(state.ammo,6,'Second click while aiming spends one round');up(2);assert.equal(ctx.firing,true);assert.equal(ctx.aiming,false);up(0);tick(30);down(0);assert.equal(state.ammo,5,'Hip shot');down(2);assert.equal(ctx.aiming,true,'Hip to aim transition');up(0);up(2);
// Reload releases both inputs. Pressing FIRE during it cannot resume on completion.
vm.runInContext('doReload()',ctx);assert.equal(ctx.firing,false);assert.equal(ctx.aiming,false);assert.equal(ctx.reload,1.6);down(2);down(0);tick(120);assert.equal(state.ammo,8);assert.equal(state.reserve,45);assert.equal(ctx.firing,false);up(0);up(2);down(2);down(0);assert.equal(state.ammo,7);up(0);up(2);
// Empty-mag auto reload follows the same gate and never queues an old trigger.
tick(30);state.ammo=0;storeAmmo(state);down(2);down(0);assert.ok(ctx.reload>0);assert.equal(ctx.firing,false);tick(120);assert.equal(state.ammo,8);assert.equal(state.reserve,37);up(0);up(2);
state.ammo=0;state.reserve=0;storeAmmo(state);down(2);down(0);assert.equal(ctx.firing,false);assert.equal(ctx.reload,0);up(0);up(2);
// Automatic weapon repeats while both inputs are held; release/focus loss stops it.
state.weapon='carrion';state.ammo=30;state.reserve=90;state.armory.carrion={owned:true,ammo:30,reserve:90};ctx.shotCooldown=0;down(2);down(0);tick(20);assert.ok(state.ammo<29);assert.equal(ctx.aiming,true);const remaining=state.ammo;win.send('blur');tick(20);assert.equal(state.ammo,remaining);assert.equal(ctx.firing,false);assert.equal(ctx.aiming,false);up(0);up(2);
// Existing obstruction/reload/action gates retain authority.
ctx.firstPersonMotion.obstructed=true;down(2);down(0);assert.equal(ctx.firing,false);assert.equal(ctx.aiming,false);up(0);up(2);
console.log(JSON.stringify({passed:true,actualShootFunction:true,renderedPlay:false,aimedAndHipAmmo:true,semiAutomaticHeldAndRepeated:true,automaticHeld:true,reloadAndEmptyMagazine:true,focusLoss:true,obstructionGate:true}));
