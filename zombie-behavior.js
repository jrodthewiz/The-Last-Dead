// Renderer-free gait and local social memory. Every decision is seeded by id;
// the frame snapshot prevents a newly alerted actor cascading through a whole
// horde in one update. A relay carries an observed location, never a live target.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LOW = new Set(['crawl', 'crawler']);
export const isLowZombie = e => LOW.has(e?.locomotion);

// Preserve the observed support plane as well as X/Y. Z is an actor's height
// above that plane, so it cannot identify an upstairs observation by itself.
export function sensedLocation(source) {
  return {x:source.x,y:source.y,
    ...(Number.isFinite(source.z)?{z:source.z}:{}),
    ...(Number.isFinite(source.supportZ)?{supportZ:source.supportZ}:{}),
    ...(source.structureId?{structureId:source.structureId}:{})};
}

export function setupZombie(e, hash) {
  if (e.kind !== 0 && !['stalker', 'bloodhound', 'skitter'].includes(e.variant)) return;
  e.locomotion ||= e.variant === 'skitter' ? 'crawler' : e.variant === 'bloodhound' ? 'runner' : 'shambler';
  e.motionIntent = 'idle'; e.burst = 0;
  // The contorted subtype keeps the same low footprint and combat rules.
  e.contortion = 0;
  if (e.mind) e.mind.gait ||= {phase:'pace', time:0, cooldown:.6 + hash(e.id, 83)*1.8, variation:.92 + hash(e.id,84)*.16,
    contortStrength:e.variant === 'skitter' && hash(e.id,81)<.38 ? .65+hash(e.id,82)*.35 : 0,contortPhase:hash(e.id,89)*Math.PI*2};
}

export function noteSighting(ctx, e, target, confirmed=true) {
  const m = e.mind, previous = m.observation;
  const key = target.playerId || (target === ctx.course?.peer ? 'peer' : 'host');
  const elapsed = previous ? ctx.time - previous.time : 0;
  let vx = 0, vy = 0;
  if (previous?.key === key && elapsed > 1e-5 && elapsed < .5) {
    vx = (target.x-previous.x)/elapsed; vy = (target.y-previous.y)/elapsed;
    // A teleport or correction must not create a long interception leap.
    const speed = Math.hypot(vx,vy), scale = speed > 3.2 ? 3.2/speed : 1;
    vx *= scale; vy *= scale;
  }
  m.observation = {x:target.x,y:target.y,time:ctx.time,key};
  m.sighting = {...sensedLocation(target),vx,vy,time:ctx.time,key,source:e.id,hops:0,confirmed};
}

export function hordeFrame(ctx) {
  if (ctx.horde?.time === ctx.time) return ctx.horde;
  ctx.horde = {time:ctx.time, members:ctx.alive.filter(e=>!e.dead).map(e=>({
    id:e.id,...sensedLocation(e),pack:e.pack,sighting:e.mind?.sighting ? {...e.mind.sighting} : null,
  })).sort((a,b)=>a.id-b.id),neighbors:new Map(),visibility:new Map()};
  ctx.horde.byId=new Map(ctx.horde.members.map(o=>[o.id,o]));
  return ctx.horde;
}

function localNeighbors(ctx,e) {
  // A handful of closest voices provides a bounded social neighborhood.
  const frame=hordeFrame(ctx);
  if(frame.neighbors.has(e.id))return frame.neighbors.get(e.id);
  const origin=frame.byId.get(e.id)||e,nearest=[];
  // Maintain six nearest without a full-population sort or array per query.
  for(const o of frame.members){
    if(o.id===e.id)continue;
    const distance=Math.hypot(o.x-origin.x,o.y-origin.y);
    if(distance>=5.2)continue;
    const item={neighbor:o,distance};let at=0;
    while(at<nearest.length&&(nearest[at].distance<distance||nearest[at].distance===distance&&nearest[at].neighbor.id<o.id))at++;
    if(at<6){nearest.splice(at,0,item);if(nearest.length>6)nearest.pop();}
  }
  const result=nearest.map(item=>item.neighbor);frame.neighbors.set(e.id,result);return result;
}

function neighborVisible(ctx,e,o) {
  const frame=hordeFrame(ctx),key=`${e.id}:${o.id}`;
  if(frame.visibility.has(key))return frame.visibility.get(key);
  const origin=frame.byId.get(e.id)||e,distance=Math.hypot(o.x-origin.x,o.y-origin.y);
  const visible=ctx.env.sensorLine?ctx.env.sensorLine(ctx.course,origin,o):ctx.env.castRay(ctx.course,origin.x,origin.y,Math.atan2(o.y-origin.y,o.x-origin.x)).dist>distance-.08;
  frame.visibility.set(key,visible);return visible;
}

export function hearHorde(ctx,e,hash) {
  const m=e.mind;
  if(m.socialPending && ctx.time>=m.socialPending.at){
    const signal=m.socialPending.sighting;m.socialPending=null;
    if(ctx.time-signal.time<3.5 && (!m.sighting || signal.time>m.sighting.time)){
      m.sighting={...signal,hops:signal.hops+1};
      m.lastKnown=sensedLocation(signal);m.noise={...m.lastKnown,t:0};
      m.socialReceiptAt=ctx.time;
      m.aware=Math.max(m.aware,1);m.lostFor=0;m.startle=Math.max(m.startle,.32);
      m.firstAttack=Math.max(m.firstAttack,.7);
    }
  }
  if(m.socialPending || e.attacking || e.strike>0) return;
  let signal=null;
  for(const neighbor of localNeighbors(ctx,e)){
    const sight=neighbor.sighting;
    if(!sight || sight.confirmed===false || sight.hops>=2 || ctx.time-sight.time>2.7 || sight.time<=(m.sighting?.time??-Infinity))continue;
    if(!neighborVisible(ctx,e,neighbor))continue;
    if(!signal || sight.time>signal.time || sight.time===signal.time&&sight.source<signal.source)signal=sight;
  }
  if(signal)m.socialPending={at:ctx.time+.28+hash(e.id,86)*.38,sighting:{...signal}};
}

export function hordeSteering(ctx,e) {
  let x=0,y=0,count=0,cx=0,cy=0;
  for(const o of localNeighbors(ctx,e)){
    const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy);
    if(d<.52 && d>1e-4){const k=(.52-d)/.52*1.35;x+=dx/d*k;y+=dy/d*k;}
    else if(d<=1e-4){x+=Math.cos(e.id*2.4)*.5;y+=Math.sin(e.id*2.4)*.5;}
    // Cohesion follows nearby bodies only when they share a recent observed
    // destination and the actual connecting lane is open.
    if(d>1.1 && d<3.2 && e.mind?.sighting && e.mind.sighting.confirmed!==false && o.sighting && o.sighting.confirmed!==false && ctx.time-e.mind.sighting.time<3.5 && ctx.time-o.sighting.time<3.5 &&
      Math.hypot(e.mind.sighting.x-o.sighting.x,e.mind.sighting.y-o.sighting.y)<1.2 && neighborVisible(ctx,e,o)){
      cx+=o.x;cy+=o.y;count++;
    }
  }
  if(count){const dx=cx/count-e.x,dy=cy/count-e.y,d=Math.hypot(dx,dy)||1;x+=dx/d*.13;y+=dy/d*.13;}
  return{x:clamp(x,-1.2,1.2),y:clamp(y,-1.2,1.2)};
}

export function gaitSpeed(ctx,e,visible,d,hash) {
  const g=e.mind.gait;
  if(!g)return 1;
  g.time+=ctx.dt;g.cooldown=Math.max(0,g.cooldown-ctx.dt);
  const crawler=isLowZombie(e),runner=e.locomotion==='runner';
  const hunting=['stalk','flank','attack'].includes(e.mind.state);
  if(!visible || !hunting || e.mind.startle>0 || e.attacking || e.strike>0){
    if(g.phase!=='pace'){g.phase='recover';g.time=0;g.cooldown=Math.max(g.cooldown,1.2);}
    e.burst=Math.max(0,(e.burst||0)-ctx.dt*4);
    return(crawler?.60:1)*g.variation;
  }
  if((runner||crawler) && g.phase==='pace' && g.cooldown<=0 && d>1.6 && d<(runner?8:4.5)){
    g.phase='coil';g.time=0;
  }
  if(g.phase==='coil'){
    e.burst=clamp(g.time/.28,0,1)*.3;
    if(g.time>=.28){g.phase='burst';g.time=0;}
    return(crawler?.32:.58)*g.variation;
  }
  if(g.phase==='burst'){
    e.burst=1;
    if(g.time>=(crawler?.64:1.1)+hash(e.id,87)*.22 || d<.7){g.phase='recover';g.time=0;g.cooldown=2.3+hash(e.id,88)*1.2;}
    return(crawler?1.12:1.85)*g.variation;
  }
  if(g.phase==='recover'){
    e.burst=Math.max(0,(e.burst||0)-ctx.dt*3);
    if(g.time>=.8){g.phase='pace';g.time=0;}
    return(crawler?.50:.66)*g.variation;
  }
  e.burst=0;
  return(crawler?.60:1)*g.variation;
}

export function interceptGoal(ctx,e,target,clear) {
  const sight=e.mind.sighting;
  if(e.locomotion!=='runner' || !sight || sight.hops!==0 || ctx.time-sight.time>.15)return target;
  const lead=.28+Math.min(.32,Math.hypot(target.x-e.x,target.y-e.y)*.04);
  let dx=sight.vx*lead,dy=sight.vy*lead;
  const distance=Math.hypot(dx,dy),scale=distance>1.1?1.1/distance:1;
  dx*=scale;dy*=scale;
  const goal={...sensedLocation(target),x:target.x+dx,y:target.y+dy};
  return ctx.env.canStand(ctx.course,goal.x,goal.y,.18)&&clear(ctx.env,ctx.course,e.x,e.y,goal.x,goal.y,.18)?goal:target;
}

export function motionIntent(e,ctx) {
  e.motionIntent=e.moving>1e-5 ? isLowZombie(e)?'crawl':e.locomotion==='runner'&&(e.burst>.3||e.moving>1.35)?'run':'walk':e.mind?.state==='notice'?'watch':'idle';
  const g=e.mind?.gait;
  if(g&&ctx){
    const pause=(e.motionIntent==='idle'||e.motionIntent==='watch') && e.locomotion==='crawler' && !e.attacking && !(e.strike>0) && !(e.stagger>0);
    const wave=Math.max(0,Math.sin(ctx.time*1.15+g.contortPhase));
    const desired=pause?g.contortStrength*wave*wave:0;
    e.contortion+=(desired-e.contortion)*(1-Math.exp(-ctx.dt*3.5));
  }
}
