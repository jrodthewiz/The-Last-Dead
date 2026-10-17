// Metres, Y up; player heading is (sin(yaw), 0, -cos(yaw)). The same
// collision grid and support query own walking, vault planning and commitment.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const runtime=new WeakMap();
export function locomotion(s){if(!runtime.has(s))runtime.set(s,{buffer:0,coyote:0,vault:null,landing:0,vx:0,vz:0});return runtime.get(s);}
export function resetLocomotion(s){runtime.delete(s);}
export function bodyClear(grid,x,y,z,r=.42,height=1.8){
 if(Math.abs(x)>=1400||Math.abs(z)>=900)return false;
 for(const b of grid.query(x,z,r)){if(y+.025>=b.y+b.h||y+height<=b.y+.015)continue;const dx=Math.max(Math.abs(x-b.x)-b.w/2,0),dz=Math.max(Math.abs(z-b.z)-b.d/2,0);if(dx*dx+dz*dz<r*r)return false;}return true;
}
export function vaultPoint(v,p){
 const across=smooth((p-.28)/.44),lift=smooth(p/.27),lower=smooth((p-.73)/.27);
 return {x:v.from.x+(v.to.x-v.from.x)*across,z:v.from.z+(v.to.z-v.from.z)*across,y:v.from.y+(v.top-v.from.y)*lift+(v.to.y-v.top)*lower};
}
export function findVault(s,grid,floorAt){
 if(Math.abs(s.y-floorAt(s.x,s.z))>.12||s.vy>1)return null;
 const dx=Math.sin(s.yaw),dz=-Math.cos(s.yaw);let obstacle=null;
 for(let d=.45;d<=1.15&&!obstacle;d+=.1){const x=s.x+dx*d,z=s.z+dz*d;for(const b of grid.query(x,z,.32)){
  const top=b.y+b.h;if(top<s.y+.45||top>s.y+1.32||Math.abs(x-b.x)>b.w/2+.12||Math.abs(z-b.z)>b.d/2+.12)continue;obstacle=b;break;
 }}
 if(!obstacle)return null;
 for(let distance=1.35;distance<=3.1;distance+=.1){
  const x=s.x+dx*distance,z=s.z+dz*distance,y=floorAt(x,z),top=obstacle.y+obstacle.h+.08;
  if(Math.abs(y-s.y)>.5||!bodyClear(grid,x,y,z)||top<y+.08)continue;
  const v={from:{x:s.x,y:s.y,z:s.z},to:{x,y,z},top,time:0,duration:.68,hand:{x:s.x+dx*.85,y:top-.06,z:s.z+dz*.85}};
  // Check complete 1.8 m body clearance, including the lift and descent. This
  // rejects deep obstacles, overhangs and blocked landing corridors.
  let clear=true;for(let i=0;i<=48;i++){const p=vaultPoint(v,i/48);if(!bodyClear(grid,p.x,p.y,p.z)){clear=false;break;}}
  if(clear)return v;
 }return null;
}
export function advanceVault(s,dt){const m=locomotion(s),v=m.vault;if(!v)return false;v.time=Math.min(v.duration,v.time+dt);Object.assign(s,vaultPoint(v,v.time/v.duration));s.vy=0;m.vx=m.vz=0;if(v.time>=v.duration){m.vault=null;m.landing=.35;m.buffer=m.coyote=0;}return true;}
