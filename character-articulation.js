import * as THREE from './vendor/three.module.js';

const clamp=value=>THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1);
const scratch=new THREE.Quaternion();

// Controls are authored in the asset's local bone frame. Existing clip-driven
// bones and the simulation remain outside this layer's ownership.
export function createCharacterArticulation(model){
  const controls=[];
  model?.traverse(node=>{
    const metadata=node.userData?.articulation;
    if(!node.isBone||!metadata||!['jaw','tongue','lip','grip'].includes(metadata.role))return;
    const axis=new THREE.Vector3(...(metadata.axis||[1,0,0]));
    if(!axis.toArray().every(Number.isFinite)||axis.lengthSq()<1e-8)return;
    controls.push({bone:node,role:metadata.role,side:metadata.side||(/^Left/i.test(node.name)?'left':/^Right/i.test(node.name)?'right':null),axis:axis.normalize(),angle:THREE.MathUtils.clamp(Number(metadata.maxAngleRadians)||0,0,1.6),sign:metadata.sign===-1?-1:1,base:node.quaternion.clone()});
  });
  return{model,controls,applied:false,pose:{jawOpen:0,tongueLift:0,lipCurl:0,leftGrip:0,rightGrip:0},lastBitePose:{},releasePose:{},releaseTarget:{},lastBiteKey:null,lastBitePhase:null,hasJaw:controls.some(c=>c.role==='jaw'),gripControls:controls.filter(c=>c.role==='grip').length};
}

export function restoreCharacterArticulation(state){
  if(!state?.applied)return;
  for(const control of state.controls)control.bone.quaternion.copy(control.base);
  state.applied=false;
}

export function applyCharacterArticulation(state,pose={}){
  if(!state)return false;
  const values=state.pose;
  for(const key of Object.keys(values))values[key]=clamp(pose[key]);
  for(const control of state.controls){
    if(!state.applied)control.base.copy(control.bone.quaternion);
    const value=control.role==='jaw'?values.jawOpen:control.role==='tongue'?values.tongueLift:control.role==='lip'?values.lipCurl:control.side==='left'?values.leftGrip:values.rightGrip;
    scratch.setFromAxisAngle(control.axis,value*control.angle*control.sign);
    control.bone.quaternion.copy(control.base).multiply(scratch).normalize();
  }
  state.applied=true;
  return state.hasJaw;
}

export function biteArticulationPose(bite={},reducedMotion=false){
  const elapsed=Math.max(0,Number(bite.elapsed)||0),stage=Math.max(0,Number(bite.damageStage)||0);
  let jaw=0,grip=0,compression=0;
  if(bite.phase==='windup'){
    // Reserve the asset's extreme opening for authoring inspection: the scan's
    // coarse cheeks hold their shape better within this combat range.
    const reach=THREE.MathUtils.smoothstep(elapsed,0,.65);jaw=.12+.54*reach;grip=.15+.7*reach;
  }else if(bite.phase==='held'){
    // The authoritative damage beat is 1.25s, then every .9s. Open before
    // contact and close into it; do not invent a second damage clock.
    const contact=1.25+stage*.9,t=elapsed-contact;
    const preparation=THREE.MathUtils.smoothstep(t,-.42,-.20)*(1-THREE.MathUtils.smoothstep(t,-.20,-.015));
    const latch=1-THREE.MathUtils.smoothstep(elapsed,0,.26);
    const previous=1.25+Math.max(0,stage-1)*.9;
    compression=stage>0&&elapsed>=previous?1-THREE.MathUtils.smoothstep(elapsed,previous,previous+.16):0;
    jaw=.18+.48*Math.max(preparation,latch)-.08*compression;grip=.9+.06*compression;
  }else if(bite.phase==='terminal'){const release=1-THREE.MathUtils.smoothstep(elapsed,.18,.55);jaw=.12+.08*release;grip=.12+.74*release;}
  else if(bite.phase==='released'){
    const release=1-THREE.MathUtils.smoothstep(elapsed,0,.55);jaw=.2*release;grip=.85*release;
  }
  if(reducedMotion)jaw=Math.min(jaw,.42);
  return{jawOpen:jaw,tongueLift:jaw*.35+compression*.025,lipCurl:jaw*.4+compression*.045,leftGrip:grip,rightGrip:grip};
}

export function enemyArticulationPose(enemy={},presentation={}){
  if(enemy.dead)return{jawOpen:.12,leftGrip:.12,rightGrip:.12};
  if(['windup','held','terminal'].includes(enemy.bitePhase))return biteArticulationPose({phase:enemy.bitePhase,elapsed:enemy.bitePhase==='windup'?(Number(enemy.biteProgress)||0)*.65:(Number(enemy.biteProgress)||0)*1.25});
  const time=Number.isFinite(presentation.time)?presentation.time:0,seed=Number(presentation.seed??enemy.id)||0;
  const idlePhase=Number.isFinite(presentation.idlePhase)?presentation.idlePhase:time*.41+seed*.173;
  // Small mixed-frequency tension follows each actor's own breath rather than
  // making an entire mob open their mouths or clench on one global sine wave.
  const breath=.7*Math.sin(idlePhase*Math.PI*2)+.3*Math.sin(time*.93+seed*.71);
  const motionClass=presentation.motionClass||enemy.locomotion;
  const burst=clamp(Number(presentation.burst??enemy.burst)||0),contortion=clamp(Number(presentation.contortion??enemy.contortion)||0);
  // Predatory runners breathe through a tense open mouth; the floor creature
  // holds its hands ready to pull. These small channels yield to every combat
  // phase below, including the same anatomical contact range as the shambler.
  const notice=clamp(Number(enemy.noticeStrength)||0);
  const idleJaw=.04+.014*breath+.075*notice+(motionClass==='runner'?.025+.032*burst:motionClass==='crawler'?.018+.028*contortion:0);
  const idleGrip=.12+.018*Math.sin(time*1.17+seed*2.399)+.14*notice+(motionClass==='crawler'?.16:motionClass==='runner'?.055*burst:0);
  const windup=enemy.attacking?1-THREE.MathUtils.clamp((Number(enemy.windup)||0)/Math.max(.01,Number(enemy.windupTime??enemy.windupDuration)||.5),0,1):0;
  let jaw=idleJaw,grip=idleGrip,tension=0;
  if(enemy.attacking){
    tension=THREE.MathUtils.smoothstep(windup,0,.92);
    jaw=.18+.43*tension;grip=.22+.60*tension;
  }else if(enemy.strike>0){
    const progress=1-THREE.MathUtils.clamp(enemy.strike/(enemy.kind===1?.22:.24),0,1),release=THREE.MathUtils.smoothstep(progress,0,1);
    jaw=THREE.MathUtils.lerp(.54,.18,release);grip=THREE.MathUtils.lerp(.88,.48,release);tension=1-release*.6;
  }else if(enemy.stagger>0||presentation.hitWeight>0){
    const recoil=clamp(Math.max((enemy.stagger||0)/.3,presentation.hitWeight||0));
    jaw=THREE.MathUtils.lerp(idleJaw,.29,recoil);grip=THREE.MathUtils.lerp(idleGrip,.22,recoil);tension=recoil*.35;
  }else if(Number.isFinite(presentation.attackRecovery)){
    const release=THREE.MathUtils.smoothstep(presentation.attackRecovery,0,.85);
    jaw=THREE.MathUtils.lerp(.18,idleJaw,release);grip=THREE.MathUtils.lerp(.48,idleGrip,release);tension=(1-release)*.4;
  }
  const bias=.025*Math.sin(seed*1.7+(Number(enemy.hits)||0)*2.399)*(1+tension);
  return{jawOpen:clamp(jaw),tongueLift:clamp(jaw*.2),lipCurl:clamp(jaw*.25+tension*.055),leftGrip:clamp(grip+bias),rightGrip:clamp(grip-bias)};
}

export function applyBiteArticulation(state,bite={},nowMs=0,reducedMotion=false){
  if(!state)return false;
  const key=`${bite.enemyId}:${bite.sequence}`;
  let presentation=bite;
  if(bite.phase==='terminal'){
    // Engine terminal time stays at zero. Only the release presentation needs
    // its own age; held/damage timing continues to use the canonical clock.
    if(state.terminalKey!==key){state.terminalKey=key;state.terminalAt=nowMs;}
    presentation={...bite,elapsed:Math.max(Number(bite.elapsed)||0,(nowMs-state.terminalAt)/1000)};
  }else{state.terminalKey=null;state.terminalAt=null;}
  let pose=biteArticulationPose(presentation,reducedMotion);
  if(bite.phase==='released'){
    if(state.lastBiteKey!==key||state.lastBitePhase!=='released'){
      Object.assign(state.releasePose,state.lastBiteKey===key?state.lastBitePose:state.pose);
      Object.assign(state.releaseTarget,state.pose);
    }
    const blend=THREE.MathUtils.smoothstep(Number(bite.elapsed)||0,0,.55);
    for(const channel of Object.keys(pose))pose[channel]=THREE.MathUtils.lerp(state.releasePose[channel]||0,state.releaseTarget[channel]||0,blend);
  }
  const applied=applyCharacterArticulation(state,pose);
  Object.assign(state.lastBitePose,state.pose);state.lastBiteKey=key;state.lastBitePhase=bite.phase;
  return applied;
}

export function articulationDiagnostics(state){
  return state?{jawRig:state.hasJaw,controls:state.controls.length,gripControls:state.gripControls,...state.pose}:{jawRig:false,controls:0,gripControls:0};
}
