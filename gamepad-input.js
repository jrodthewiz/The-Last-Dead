// Standard-mapped browser gamepads feed the same intents as keyboard/mouse.
// No browser globals are needed here: callers supply each fresh pad snapshot.
export const GAMEPAD_BINDINGS=Object.freeze({jump:0,slide:1,harvest:2,nextWeapon:3,hook:4,parry:5,alt:6,fire:7,pause:9,dash:10,chest:11,up:12,down:13,left:14,right:15});
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function stickWithDeadzone(x,y,deadzone=.18){
 x=clamp(finite(x),-1,1);y=clamp(finite(y),-1,1);deadzone=clamp(finite(deadzone),0,.95);
 const length=Math.hypot(x,y);
 if(length<=deadzone)return{x:0,y:0};
 const strength=(Math.min(1,length)-deadzone)/(1-deadzone);
 return{x:x/length*strength,y:y/length*strength};
}
export function emptyGamepadFrame(){return{connected:false,changed:false,active:false,armed:false,forward:0,strafe:0,turn:0,lookY:0,fire:false,alt:false,slide:false,harvest:false,edges:{},weaponStep:0,menuDirection:null};}
const buttonDown=(pad,index)=>{const button=pad.buttons?.[index];return !!button?.pressed||finite(button?.value)>.5;};
const identity=pad=>`${pad.index}:${pad.id||''}`;

export class GamepadInput {
 constructor({deadzone=.18,yawSpeed=2.8,pitchSpeed=2}={}){
  this.deadzone=deadzone;this.yawSpeed=yawSpeed;this.pitchSpeed=pitchSpeed;
  this.padKey=null;this.context=null;this.suppressed=true;this.previous={};this.direction=null;
 }
 suppress(){this.suppressed=true;this.previous={};this.direction=null;}
 poll(pads=[],{context='play'}={}){
  const available=Array.from(pads||[]).filter(pad=>pad&&pad.connected!==false&&pad.mapping==='standard').sort((a,b)=>a.index-b.index);
  const pad=available.find(pad=>identity(pad)===this.padKey)||available[0];
  const key=pad?identity(pad):null,changed=key!==this.padKey;
  if(changed||context!==this.context){this.suppress();this.padKey=key;this.context=context;}
  const frame=emptyGamepadFrame();frame.connected=!!pad;frame.changed=changed;
  if(!pad)return frame;
  const buttons=Object.fromEntries(Object.entries(GAMEPAD_BINDINGS).map(([action,index])=>[action,buttonDown(pad,index)]));
  const move=stickWithDeadzone(pad.axes?.[0],pad.axes?.[1],this.deadzone),aim=stickWithDeadzone(pad.axes?.[2],pad.axes?.[3],this.deadzone);
  // Also consider unmapped buttons (e.g. Guide/Select) when rearming. A fresh
  // press/release must occur after every lifecycle transition, not a stale hold.
  const neutral=!Array.from(pad.buttons||[]).some((_,index)=>buttonDown(pad,index))&&!move.x&&!move.y&&!aim.x&&!aim.y;
  if(context==='inactive'){this.suppress();return frame;}
  if(this.suppressed){
   if(neutral){this.suppressed=false;this.previous=buttons;this.direction=null;frame.armed=true;}
   return frame;
  }
  frame.armed=true;
  frame.edges=Object.fromEntries(Object.entries(buttons).map(([action,down])=>[action,down&&!this.previous[action]]));
  frame.active=Object.values(buttons).some(Boolean)||!!move.x||!!move.y||!!aim.x||!!aim.y;
  if(context==='play'){
   frame.forward=-move.y;frame.strafe=move.x;
   // engine.tickPlayer applies turn * 2 rad/s and lookY rad/s at fixed dt.
   frame.turn=aim.x*this.yawSpeed/2;frame.lookY=-aim.y*this.pitchSpeed;
   for(const action of ['fire','alt','slide','harvest'])frame[action]=buttons[action];
   frame.weaponStep=frame.edges.nextWeapon||frame.edges.up||frame.edges.right?1:frame.edges.down||frame.edges.left?-1:0;
  }else if(context==='menu'){
   const direction=buttons.up?'up':buttons.down?'down':buttons.left?'left':buttons.right?'right'
    :Math.abs(move.y)>.5?(move.y<0?'up':'down'):Math.abs(move.x)>.5?(move.x<0?'left':'right'):null;
   frame.menuDirection=direction&&direction!==this.direction?direction:null;this.direction=direction;
  }
  this.previous=buttons;return frame;
 }
}
