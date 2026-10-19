const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrapHeading=yaw=>Math.atan2(Math.sin(yaw),Math.cos(yaw));

// Relative mouse packets can jump on pointer-lock transitions/window edges.
// Reject discontinuities instead of letting a single packet turn the player.
// Normal packets are applied immediately; there is no camera smoothing/lag.
export function createLookInput(){
 let first=true,budget=0;
 return {reset(){first=true;budget=0;},beginFrame(){budget=0;},consume(dx,dy,sensitivity=1,scale=.002){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(sensitivity))return null;
  if(first){first=false;return null;}
  const yaw=dx*scale*sensitivity,pitch=dy*scale*sensitivity,amount=Math.hypot(yaw,pitch);
  if(amount>1.2||budget+amount>Math.PI/2)return null;
  budget+=amount;return {yaw,pitch};
 }};
}

export function installGameplayInput({canvas,look,joystick,buttons,win=window,doc=document,getMode,getVehicle,getSensitivity,canFire=()=>true,isTouch,lock,fire,aim,shoot,lookBy,action,stick}){
 const mouseLook=createLookInput(),touchLook=createLookInput();let fireSource=null,aimSource=null,lookId=null,stickId=null,lookX=0,lookY=0;
 const releaseFire=()=>{fireSource=null;fire(false);},releaseAim=()=>{aimSource=null;aim(false);};
 function releaseCombat(){releaseFire();releaseAim();}
 function clearStick(){stickId=null;stick.forward=stick.strafe=0;joystick.firstElementChild.style.transform='';}
 function reset(){releaseCombat();lookId=null;clearStick();mouseLook.reset();touchLook.reset();}
 function pressFire(source){if(!canFire())return;fireSource=source;fire(true);shoot();}
 function releasePointer(e){if(fireSource===e.pointerId)releaseFire();if(aimSource===e.pointerId)releaseAim();if(lookId===e.pointerId)lookId=null;if(stickId===e.pointerId)clearStick();}
 canvas.addEventListener('pointerdown',e=>{
  if(getMode()==='playing'){
   if(!isTouch&&doc.pointerLockElement!==canvas){lock();return;}
   if(e.button===0)pressFire(e.pointerType==='mouse'?'mouse':e.pointerId);
   if(e.button===2){aimSource='mouse';aim(true);}
  }else if(['photo','flight'].includes(getMode()))canvas.requestPointerLock?.()?.catch?.(()=>{});
 });
 function mouseRelease(e){if(e.button===0&&fireSource==='mouse')releaseFire();if(e.button===2&&aimSource==='mouse')releaseAim();}
 // Both mouse and pointer releases matter while pointer lock is active.
 win.addEventListener('mouseup',mouseRelease);win.addEventListener('pointerup',e=>{mouseRelease(e);releasePointer(e);});
 win.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')releaseCombat();releasePointer(e);});
 win.addEventListener('lostpointercapture',e=>{if(e.pointerType==='mouse')releaseCombat();releasePointer(e);});
 win.addEventListener('blur',reset);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)reset();});
 doc.addEventListener('pointerlockchange',()=>{releaseCombat();mouseLook.reset();});
 win.addEventListener('mousemove',e=>{
  if(doc.pointerLockElement!==canvas)return;
  // Recover even when a browser/OS swallowed the corresponding mouseup.
  if(Number.isInteger(e.buttons)){if(!(e.buttons&1)&&fireSource==='mouse')releaseFire();if(!(e.buttons&2)&&aimSource==='mouse')releaseAim();}
  if(!['playing','photo','flight'].includes(getMode())||getVehicle())return;
  const delta=mouseLook.consume(e.movementX,e.movementY,getSensitivity());if(delta)lookBy(delta);
 });
 function updateStick(e){const r=joystick.getBoundingClientRect(),dx=clamp((e.clientX-r.left-r.width/2)/42,-1,1),dy=clamp((e.clientY-r.top-r.height/2)/42,-1,1);stick.strafe=dx;stick.forward=-dy;joystick.firstElementChild.style.transform=`translate(${dx*30}px,${dy*30}px)`;}
 joystick.onpointerdown=e=>{if(getMode()!=='playing'||stickId!==null)return;stickId=e.pointerId;joystick.setPointerCapture(e.pointerId);updateStick(e);};
 joystick.onpointermove=e=>{if(e.pointerId===stickId&&getMode()==='playing')updateStick(e);};
 joystick.onpointerup=joystick.onpointercancel=joystick.onlostpointercapture=releasePointer;
 look.onpointerdown=e=>{if(getMode()!=='playing'||getVehicle()||lookId!==null||e.pointerType==='mouse')return;lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;touchLook.reset();touchLook.consume(0,0);look.setPointerCapture(e.pointerId);};
 look.onpointermove=e=>{if(e.pointerId!==lookId||getMode()!=='playing'||getVehicle())return;const delta=touchLook.consume(e.clientX-lookX,e.clientY-lookY,getSensitivity(),.005);lookX=e.clientX;lookY=e.clientY;if(delta)lookBy(delta);};
 look.onpointerup=look.onpointercancel=look.onlostpointercapture=releasePointer;
 for(const button of buttons){
  button.onpointerdown=e=>{e.preventDefault();if(getMode()!=='playing')return;button.setPointerCapture(e.pointerId);const name=button.dataset.touch;if(name==='fire')pressFire(e.pointerId);else action(name);};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=releasePointer;
 }
 return {reset,releaseCombat,releaseFire,beginFrame(){mouseLook.beginFrame();touchLook.beginFrame();}};
}
