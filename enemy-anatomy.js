// Authoritative anatomy in arena cells (4 metres). Renderers consume these
// serializable cuts; neither visible geometry nor cosmetic physics owns damage.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const ANATOMY_LIMITS=Object.freeze({cutsPerEnemy:8,brainFinishReserve:1});
export const BODY_PARTS=Object.freeze({leftArm:3,rightArm:4,leftLeg:1,rightLeg:2,head:5,torso:0});
const threshold={leftArm:4.5,rightArm:4.5,leftLeg:5.3,rightLeg:5.3,head:8,torso:12};
const posedBodies=new WeakMap();
// Optional rig-derived capsule positions. This read-only collision input is
// cosmetic-pose data; all hit decisions, tissue state and revival stay here.
export function setEnemyBodyPose(enemy,segments){posedBodies.set(enemy,{x:enemy.x,y:enemy.y,segments});}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const length=v=>Math.sqrt(dot(v,v));
const normal=v=>{const d=length(v)||1;return v.map(x=>x/d);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

export function supportsAnatomy(e){return e?.kind===0&&!e.boss&&!e.isBoss;}
export function partCut(e,part){return e.anatomy?.cuts?.filter(c=>c.part===part).at(-1);}
export function missingArm(e,side){return !!partCut(e,side+'Arm')||!!(e.wounds?.arm&&e.wounds.armSide===side);}
export function anatomyMotion(e){
 const legs=Number(!!partCut(e,'leftLeg'))+Number(!!partCut(e,'rightLeg'));
 const arms=Number(missingArm(e,'left'))+Number(missingArm(e,'right'));
 return {legs,arms,crawl:legs>0,speed:legs?(legs===2?.24:.32)*(arms===2?.65:1):arms?.92:1,damage:arms===2?.5:arms?.7:1};
}

// A small articulated capsule set makes the gap between the legs and removed
// distal sections pass-through. These are gameplay proxies, never visible limbs.
function bodySegments(e){
 const out=[],crawl=e.locomotion==='crawl'||e.dead,lean=crawl?-1.25:0;
 const transform=p=>[p[0],p[1]*Math.cos(lean)-p[2]*Math.sin(lean)+(crawl?.025:0),p[1]*Math.sin(lean)+p[2]*Math.cos(lean)];
 const add=(part,path,radius)=>{
  if(part==='head'&&(e.neckBroken||e.wounds?.head&&!partCut(e,'head')))return;
  const cut=partCut(e,part),remain=cut?cut.fraction:part.endsWith('Arm')&&missingArm(e,part.startsWith('left')?'left':'right')?0:1;
  if(remain<=.015)return;
  for(let i=0;i<path.length-1;i++){
   const start=i/(path.length-1),end=(i+1)/(path.length-1);if(remain<=start)break;
   out.push({part,a:transform(path[i]),b:transform(mix(path[i],path[i+1],clamp((remain-start)/(end-start),0,1))),start,end:Math.min(end,remain),radius});
  }
 };
 add('torso',[[0,.25,0],[0,.355,0]],.060);
 add('head',[[0,.395,0],[0,.445,-.006]],.038);
 for(const [side,sign]of [['left',1],['right',-1]]){
  add(side+'Arm',[[sign*.049,.359,0],[sign*.073,.290,-.013],[sign*.064,.217,-.027]],.024);
  add(side+'Leg',[[sign*.027,.245,0],[sign*.034,.135,0],[sign*.043,.022,-.012]],.026);
 }
 return out;
}
function sphereHit(o,d,c,r){const q=sub(o,c),b=dot(q,d),h=b*b-dot(q,q)+r*r;if(h<0)return Infinity;const t=-b-Math.sqrt(h);return t>=0?t:dot(q,q)<=r*r?0:Infinity;}
function capsuleHit(o,d,a,b,r){
 const ba=sub(b,a),oa=sub(o,a),baba=dot(ba,ba),bard=dot(ba,d),baoa=dot(ba,oa),rdoa=dot(d,oa),oaoa=dot(oa,oa);
 const A=baba-bard*bard,B=baba*rdoa-baoa*bard,C=baba*oaoa-baoa*baoa-r*r*baba,h=B*B-A*C;
 let t=Math.min(sphereHit(o,d,a,r),sphereHit(o,d,b,r));
 if(h>=0&&Math.abs(A)>1e-12){const v=(-B-Math.sqrt(h))/A,y=baoa+v*bard;if(v>=0&&y>0&&y<baba)t=Math.min(t,v);}
 return t;
}
export function traceEnemyBody(e,origin,direction,max=Infinity){
 if(!supportsAnatomy(e))return null;
 const posed=posedBodies.get(e);
 if(posed){
  const o=[origin.x,origin.z,origin.y],d=normal([direction.x,direction.z,direction.y]),shift=[e.x-posed.x,0,e.y-posed.y];let best=null;
  for(const segment of posed.segments){const a=segment.a.map((v,i)=>v+shift[i]),b=segment.b.map((v,i)=>v+shift[i]),t=capsuleHit(o,d,a,b,segment.radius);if(t<=max&&(!best||t<best.distance)){const axis=sub(b,a),p=o.map((v,i)=>v+d[i]*t),along=clamp(dot(sub(p,a),axis)/(dot(axis,axis)||1),0,1);best={part:segment.part,distance:t,fraction:segment.start+(segment.end-segment.start)*along};}}
  if(best)best.hit={x:origin.x+direction.x*best.distance,y:origin.y+direction.y*best.distance,z:origin.z+direction.z*best.distance,part:best.part,fraction:best.fraction};
  return best;
 }
 const facing=e.facing??Math.atan2(origin.y-e.y,origin.x-e.x),sx=-Math.sin(facing),sy=Math.cos(facing),fx=Math.cos(facing),fy=Math.sin(facing);
 const dx=origin.x-e.x,dy=origin.y-e.y,o=[dx*sx+dy*sy,origin.z-(e.meleeZ||0),-(dx*fx+dy*fy)];
 const d=normal([direction.x*sx+direction.y*sy,direction.z,-(direction.x*fx+direction.y*fy)]);
 let result=null;
 for(const segment of bodySegments(e)){
  const t=capsuleHit(o,d,segment.a,segment.b,segment.radius);
  if(t<=max&&(!result||t<result.distance)){
   const local=o.map((v,i)=>v+d[i]*t),axis=sub(segment.b,segment.a),along=clamp(dot(sub(local,segment.a),axis)/(dot(axis,axis)||1),0,1);
   result={part:segment.part,distance:t,local,fraction:segment.start+(segment.end-segment.start)*along};
  }
 }
 if(result)result.hit={x:origin.x+direction.x*result.distance,y:origin.y+direction.y*result.distance,z:origin.z+direction.z*result.distance,part:result.part,fraction:result.fraction};
 return result;
}
export function locateBodyPart(e,hit){
 if(hit?.part&&BODY_PARTS[hit.part]!==undefined)return hit.part;
 const facing=e.facing??0,dx=(hit?.x??e.x)-e.x,dy=(hit?.y??e.y)-e.y,lateral=-dx*Math.sin(facing)+dy*Math.cos(facing),z=(hit?.z??.32)-(e.meleeZ||0),side=lateral>=0?'left':'right';
 return z>=.385?'head':z<.235?side+'Leg':Math.abs(lateral)>.05?side+'Arm':'torso';
}
export function applyAnatomyDamage(e,amount,hit,time=0,source='bullet'){
 if(!supportsAnatomy(e)||!hit||hit.brutal||!Number.isFinite(hit.z))return null;
 const part=locateBodyPart(e,hit),previous=partCut(e,part);
 if(!previous&&part.endsWith('Arm')&&missingArm(e,part.startsWith('left')?'left':'right'))return null;
 if(part==='head'){
  const peripheral=Number.isFinite(hit.fraction)?hit.fraction>.62:hit.z-(e.meleeZ||0)>.426&&!e.dead;
  e.brainIntegrity=Math.max(0,(e.brainIntegrity??1)-amount*(source==='blunt'?.015:peripheral?.035:.10));
  if(e.brainIntegrity<=.001)e.hp=Math.min(0,e.hp);
 }
 const a=e.anatomy ||= {damage:{},cuts:[],serial:0};
 const cutting=source==='slice'||source==='chainsaw',blunt=source==='blunt';
 a.damage[part]=(a.damage[part]||0)+amount*(cutting?1.8:blunt?.45:1);
 if(part==='head'&&(e.brainIntegrity??1)<=.001)a.damage[part]=threshold.head;
 // Ordinary torso bullets wound the body. Only a cutting edge bisects it.
 const finishHead=part==='head'&&(e.brainIntegrity??1)<=.001&&!e.neckBroken&&(!previous||previous.fraction>.051);
 const budgetExhausted=a.cuts.length>=ANATOMY_LIMITS.cutsPerEnemy&&(!finishHead||a.cuts.length>=ANATOMY_LIMITS.cutsPerEnemy+ANATOMY_LIMITS.brainFinishReserve);
 if(a.damage[part]<threshold[part]||part==='torso'&&!cutting||budgetExhausted)return null;
 const z=(hit.z-(e.meleeZ||0));let fraction=Number.isFinite(hit.fraction)?clamp(hit.fraction,.05,.88):part.endsWith('Leg')?clamp((.245-z)/.223,.08,.86):part.endsWith('Arm')?clamp((.359-z)/.142,.05,.88):part==='head'?clamp((z-.39)/.065,.05,.8):clamp((z-.26)/.13,.03,.9);
 if(part==='head'&&(e.brainIntegrity??1)<=.001)fraction=.05;
 const facing=e.facing??0,angle=hit.angle??facing,pitch=hit.pitch||0;
 const tilt=normal([Math.sin(angle-facing)*.45,Math.cos(pitch),-Math.sin(pitch)*.65]);
 if(previous&&fraction>=previous.fraction-.04&&dot(previous.tilt||[0,1,0],tilt)>.95)return null;
 // A new angle can trim the stump, but never restore a removed distal section.
 if(previous)fraction=Math.min(fraction,previous.fraction);
 const cut={id:++a.serial,part,region:BODY_PARTS[part],fraction,tilt,source,at:time,force:clamp(amount*.12,.35,2),impulse:[Math.cos(angle),.32,Math.sin(angle)]};
 a.cuts.push(cut);a.damage[part]=0;e.wounds ||= {arm:false,leg:false,eye:false};e.wounds[part]=true;e.wounded=true;
 if(part.endsWith('Arm')){e.wounds.arm=true;e.wounds.armSide=part.startsWith('left')?'left':'right';}
 if(part.endsWith('Leg')){e.wounds.leg=true;e.wounds.legSide=part.startsWith('left')?'left':'right';e.locomotion='crawl';e.crawlSince??=time;e.stagger=Math.max(e.stagger||0,.65);e.attacking=false;e.strike=0;e.windup=0;e.slashHit=true;}
 if(part==='head'){
  e.brainIntegrity=Math.min(e.brainIntegrity??1,clamp((fraction-.42)/.5,0,1));
  if(e.brainIntegrity<=.001){e.hp=Math.min(0,e.hp);e.neckBroken=fraction<.15;}
 }
 if(part==='torso')e.hp=Math.min(0,e.hp);
 const motion=anatomyMotion(e);e.baseMoveSpeed??=e.moveSpeed??.3;e.moveSpeed=e.baseMoveSpeed*motion.speed;e.drip=.2;
 return cut;
}

export function canReanimate(e){return supportsAnatomy(e)&&e.reanimates===true&&(e.brainIntegrity??1)>.001&&!e.neckBroken&&!e.heartRemoved&&!partCut(e,'torso')&&!(e.reanimations>0);}
export function isThreat(e){return !e.dead||e.reanimate?.phase==='down';}
export function beginReanimation(e,time){
 if(!canReanimate(e))return false;
 e.dead=true;e.hp=0;e.deathTime=0;e.attacking=false;e.windup=0;e.strike=0;e.slashHit=true;
 e.reanimate={phase:'down',at:time,wakeAt:time+2.6+(e.id%7)*.24};return true;
}
export function advanceReanimation(e,time){
 if(e.reanimate?.phase!=='down'||time<e.reanimate.wakeAt)return false;
 if((e.brainIntegrity??1)<=.001||e.neckBroken||e.heartRemoved||partCut(e,'torso')){e.reanimate.phase='finished';return false;}
 e.dead=false;e.reanimations=(e.reanimations||0)+1;e.hp=Math.max(4,(e.maxHp||12)*.58);e.reanimate={phase:'rise',at:time,until:time+.95};
 e.enraged=true;e.baseMoveSpeed=(e.baseMoveSpeed??e.moveSpeed??.3)*1.36;e.moveSpeed=e.baseMoveSpeed*anatomyMotion(e).speed;
 e.attackCooldown=(e.attackCooldown||.8)*.78;e.attack=.95;e.stagger=.95;e.biteCooldown=1.4;
 if(e.mind){e.mind.state='stalk';e.state='stagger';e.mind.firstAttack=0;e.mind.token=false;e.mind.t=0;}
 return true;
}
