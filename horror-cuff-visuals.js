import * as THREE from './vendor/three.module.js';

// The fabric itself moves. No proxy insect, overlay or second sleeve is drawn.
export const HORROR_CUFF_LIMITS = Object.freeze({geometries:1,maxVertices:16000,maxLiftMeters:.006,threatRadiusCells:5});
const CUFF_ENTRY_SECONDS=1.3;
const IDLE_PHASES=new Set(['idle','cancelled','released','complete','completed']),EMPTY=Object.freeze([]);
const clamp=THREE.MathUtils.clamp;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const smooth=(a,b,value)=>THREE.MathUtils.smoothstep(value,a,b);
const sleeveName=/^(?:TLD_ViewSleeve_|ForearmSleeve$|RuggedJacketSleeve$|ViewSleeve$)/i;
function visible(node){if(!node)return false;for(let current=node;current;current=current.parent)if(current.visible===false)return false;return true;}
function busy(action){return !!action?.phase&&!IDLE_PHASES.has(action.phase);}

/** A nondamaging, source-surface fold controlled by the encounter's phase. */
export class HorrorCuffVisuals {
  constructor(renderer){
    this.renderer=renderer;this.disposed=false;this.status='idle';this.suppression='inactive';this.record=null;this.eventId=null;this.cancelledId=null;
    this.run=null;this.course=null;this.lastTime=0;this.geometryCreates=0;this.geometryDisposals=0;this.maxDisplacement=0;this.movedVertices=0;
    this.elapsed=0;this.duration=0;this.progress=0;this.foldCenter=0;this.reducedMotion=false;this.limbState='unknown';
    this.point=new THREE.Vector3();this.wrist=new THREE.Vector3();this.normal=new THREE.Vector3();this.scale=new THREE.Vector3();
    this.sourceMesh=null;this.sourceScore=-1;
    // Reuse a traversal callback rather than creating one for every frame.
    this.inspectMesh=mesh=>{
      if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||!visible(mesh)||!sleeveName.test(mesh.name))return;
      const position=mesh.geometry?.attributes?.position,normal=mesh.geometry?.attributes?.normal;
      if(!position||!normal||position.isInterleavedBufferAttribute||normal.isInterleavedBufferAttribute||position.itemSize!==3||position.count<12||position.count>HORROR_CUFF_LIMITS.maxVertices)return;
      const score=/^TLD_ViewSleeve_/i.test(mesh.name)?3:/^ForearmSleeve$/i.test(mesh.name)?2:1;
      if(score>this.sourceScore){this.sourceMesh=mesh;this.sourceScore=score;}
    };
  }

  _restore(){
    const record=this.record;if(!record)return;
    record.geometry.attributes.position.array.set(record.positions);
    record.geometry.attributes.normal.array.set(record.normals);
    record.geometry.attributes.position.needsUpdate=true;record.geometry.attributes.normal.needsUpdate=true;
    // An asset owner may have replaced the geometry while this effect was
    // active. Never put our stale source back over that replacement.
    if(record.mesh.geometry===record.geometry)record.mesh.geometry=record.source;
    this.maxDisplacement=0;this.movedVertices=0;
  }

  _release(){
    if(!this.record)return;
    this._restore();this.record.geometry.dispose();this.geometryDisposals++;this.record=null;
  }

  _suppress(reason,cancel=false){
    this._restore();this.status='suppressed';this.suppression=reason;
    if(cancel&&this.eventId!==null)this.cancelledId=this.eventId;
    return false;
  }

  _available(run,state,settings){
    if(this.disposed)return 'disposed';
    if(!state?.enabled||state.active?.kind!=='cuff')return 'inactive';
    if(run?.mode!=='play'||settings.playing===false||run.paused)return 'paused';
    if(finite(run.health)<=0)return 'dead';
    if(this.renderer.freeCamera)return 'inspection';
    if(run.playerWounds?.rightArm==='severed'||run.playerWounds?.rightArm==='missing')return 'missing-limb';
    if(busy(run.bite)||busy(run.brutal)||busy(run.extraction)||busy(run.verminHand))return 'hand-action';
    if(run.meleeActive||run.sawActive||run.rifleCharging||finite(run.shot)>.02||finite(run.punch)>.02||finite(run.parryTime)>0||finite(run.hookTime)>0)return 'weapon-action';
    if(finite(run.damage)>.05||finite(run.dashTime)>0||finite(run.slide)>.1||run.slam)return 'player-action';
    const encounter=run.dungeonProgression?.encounter||run.roomProgression?.encounter;
    if(finite(encounter?.active)>0)return 'combat';
    const world=run.world||run;
    for(const enemy of world.course?.enemies||EMPTY){
      if(enemy.dead||enemy.health===0)continue;
      if(Math.hypot(finite(enemy.x,1e6)-finite(run.x),finite(enemy.y,1e6)-finite(run.y))<HORROR_CUFF_LIMITS.threatRadiusCells)return 'nearby-threat';
    }
    return null;
  }

  _findSource(run){
    const group=this.renderer.weaponGroups?.[Math.trunc(finite(run.weapon))],arm=group?.userData?.viewArms?.rightArm;
    this.sourceMesh=null;this.sourceScore=-1;
    if(!visible(group)||!visible(arm))return null;
    const forearm=arm.userData.foregroundArmFit?.forearm;
    (forearm&&visible(forearm)?forearm:arm).traverse(this.inspectMesh);
    return this.sourceMesh;
  }

  _own(mesh,arm){
    this._release();
    const source=mesh.geometry,geometry=source.clone(),position=geometry.attributes.position,normal=geometry.attributes.normal;
    this.geometryCreates++;
    // All buffers, UVs, groups and material assignment retain the exact source
    // topology. Only this mesh receives the owned position/normal arrays.
    geometry.userData={...geometry.userData,horrorCuffOwned:true};delete geometry.userData.sharedAsset;
    position.setUsage(THREE.DynamicDrawUsage);normal.setUsage(THREE.DynamicDrawUsage);
    const count=position.count,positions=Float32Array.from(position.array),normals=Float32Array.from(normal.array);
    const axial=new Float32Array(count),angular=new Float32Array(count),heights=new Float32Array(count),normalScratch=new Float32Array(normals.length);
    geometry.computeBoundingBox();const bounds=geometry.boundingBox,size=bounds.getSize(this.scale);
    const axis=size.y>=size.x&&size.y>=size.z?1:size.x>=size.z?0:2;
    const min=axis===0?bounds.min.x:axis===1?bounds.min.y:bounds.min.z,length=axis===0?size.x:axis===1?size.y:size.z;
    if(length<1e-5){geometry.dispose();this.geometryDisposals++;return null;}
    const center=bounds.getCenter(this.normal);
    mesh.updateWorldMatrix(true,false);
    const grip=arm.userData.foregroundArmFit?.wrist||arm.userData.gripSocket||arm.userData.hand;
    if(grip?.getWorldPosition){grip.getWorldPosition(this.wrist);mesh.worldToLocal(this.wrist);}else this.wrist.copy(center);
    const wristAxis=axis===0?this.wrist.x:axis===1?this.wrist.y:this.wrist.z;
    const cuffAtMax=Math.abs(wristAxis-min-length)<Math.abs(wristAxis-min);
    this.renderer.camera?.getWorldPosition(this.point);mesh.worldToLocal(this.point);this.point.sub(center);this.point.setComponent(axis,0);
    if(this.point.lengthSq()<1e-8)this.point.set(axis===0?0:1,axis===1?0:1,axis===2?0:1);
    this.point.normalize();
    let radialCount=0;
    for(let i=0;i<count;i++){
      this.wrist.fromArray(positions,i*3).sub(center);this.wrist.setComponent(axis,0);
      const radialLength=this.wrist.length();
      const coordinate=(positions[i*3+axis]-min)/length;
      axial[i]=cuffAtMax?1-coordinate:coordinate;
      // A single visible-side patch, rather than inflating a whole ring.
      const alignment=radialLength>1e-6?clamp(this.wrist.dot(this.point)/radialLength,0,1):0;
      angular[i]=Math.pow(alignment,8);
      if(angular[i]>.05)radialCount++;
    }
    if(radialCount<3){geometry.dispose();this.geometryDisposals++;return null;}
    // The baseline fallback has relatively few longitudinal rings. Its wider
    // fold prevents temporal popping while the authored asset stays localized.
    const width=count<400?.105:.068;
    if(source.boundingSphere)geometry.boundingSphere=source.boundingSphere.clone();else geometry.computeBoundingSphere();
    geometry.boundingSphere.radius+=HORROR_CUFF_LIMITS.maxLiftMeters*4;
    this.record={mesh,source,geometry,positions,normals,axial,angular,heights,normalScratch,axis,length,width};
    return this.record;
  }

  _normals(record){
    const p=record.geometry.attributes.position.array,n=record.normalScratch,index=record.geometry.index?.array;
    n.fill(0);
    const triangleCount=index?index.length:p.length/3;
    // Recalculate with scalar scratch values: no temporary vectors or arrays
    // are created in the frame loop.
    for(let t=0;t<triangleCount;t+=3){
      const a=(index?index[t]:t)*3,b=(index?index[t+1]:t+1)*3,c=(index?index[t+2]:t+2)*3;
      const abx=p[a]-p[b],aby=p[a+1]-p[b+1],abz=p[a+2]-p[b+2];
      const cbx=p[c]-p[b],cby=p[c+1]-p[b+1],cbz=p[c+2]-p[b+2];
      const x=cby*abz-cbz*aby,y=cbz*abx-cbx*abz,z=cbx*aby-cby*abx;
      n[a]+=x;n[a+1]+=y;n[a+2]+=z;n[b]+=x;n[b+1]+=y;n[b+2]+=z;n[c]+=x;n[c+1]+=y;n[c+2]+=z;
    }
    const output=record.geometry.attributes.normal.array;
    for(let i=0;i<record.heights.length;i++){
      if(Math.abs(record.heights[i])<1e-7)continue;
      const at=i*3,length=Math.hypot(n[at],n[at+1],n[at+2]);
      if(length>1e-8){output[at]=n[at]/length;output[at+1]=n[at+1]/length;output[at+2]=n[at+2]/length;}
    }
  }

  update(run,dt,state,settings={}){
    if(this.disposed)return false;
    const course=(run?.world||run)?.course,time=finite(run?.time);
    const transition=this.run!==null&&(this.run!==run||this.course!==course||time<this.lastTime-.05);
    if(this.run!==run||this.course!==course||time<this.lastTime-.05){this._release();this.eventId=null;this.cancelledId=null;}
    this.run=run;this.course=course;this.lastTime=time;
    const active=state?.active,id=active?.id??null;
    const eventChanged=id!==this.eventId;
    this.limbState=run?.playerWounds?.rightArm||'intact';
    if(eventChanged){this._restore();this.eventId=id;this.cancelledId=null;}
    if(transition&&active?.kind==='cuff')return this._suppress('transition',true);
    const reason=this._available(run,state,settings);
    if(reason)return this._suppress(reason,reason!=='inactive'&&reason!=='paused');
    if(this.cancelledId===id)return this._suppress('cancelled');
    const rawElapsed=Math.max(0,finite(active.elapsed)),rawDuration=Math.max(CUFF_ENTRY_SECONDS+.6,finite(active.duration,4.5));
    this.elapsed=rawElapsed;this.duration=rawDuration;
    if(rawElapsed<CUFF_ENTRY_SECONDS)return this._suppress('entry');
    const elapsed=rawElapsed-CUFF_ENTRY_SECONDS,duration=rawDuration-CUFF_ENTRY_SECONDS;
    if(elapsed>=duration)return this._suppress('settled');
    const mesh=this._findSource(run);
    if(!mesh)return this._suppress('missing-sleeve',true);
    if(this.record&&(this.record.mesh!==mesh||(this.record.source!==mesh.geometry&&this.record.geometry!==mesh.geometry))){
      this._release();if(!eventChanged)return this._suppress('asset-swap',true);
    }
    const arm=this.renderer.weaponGroups[Math.trunc(finite(run.weapon))].userData.viewArms.rightArm;
    const record=this.record||this._own(mesh,arm);
    if(!record)return this._suppress('unsupported-sleeve',true);
    this._restore();mesh.geometry=record.geometry;mesh.updateWorldMatrix(true,false);mesh.getWorldScale(this.scale);
    const worldScale=Math.max(Math.abs(this.scale.x),Math.abs(this.scale.y),Math.abs(this.scale.z),.001);
    const reduced=!!(settings.reducedMotion||this.renderer.settings?.reducedMotion||this.renderer._systemReducedMotion);
    const progress=clamp(elapsed/duration,0,1),envelope=smooth(0,.15,progress)*(1-smooth(.74,1,progress));
    const center=reduced?.24:.09+smooth(.04,.82,progress)*.48;
    const lift=Math.min(record.length*.055,(reduced?.0025:HORROR_CUFF_LIMITS.maxLiftMeters)*envelope/worldScale);
    this.progress=progress;this.foldCenter=center;this.reducedMotion=reduced;
    const p=record.geometry.attributes.position.array,width=record.width;
    for(let i=0;i<record.heights.length;i++){
      const distance=(record.axial[i]-center)/width,bulge=Math.exp(-distance*distance*.5);
      // A shallow shoulder beside the lift reads as stretched cloth rather
      // than a protruding insect or a swelling arm.
      const shoulder=Math.exp(-Math.pow((record.axial[i]-center-width*1.9)/(width*.72),2)*.5)*.19;
      const edge=smooth(.025,.095,record.axial[i])*(1-smooth(.76,.92,record.axial[i]));
      const height=lift*(bulge-shoulder)*record.angular[i]*edge,at=i*3;
      record.heights[i]=height;
      p[at]=record.positions[at]+record.normals[at]*height;
      p[at+1]=record.positions[at+1]+record.normals[at+1]*height;
      p[at+2]=record.positions[at+2]+record.normals[at+2]*height;
      if(Math.abs(height)>1e-6)this.movedVertices++;
      this.maxDisplacement=Math.max(this.maxDisplacement,Math.abs(height)*worldScale);
    }
    this._normals(record);record.geometry.attributes.position.needsUpdate=true;record.geometry.attributes.normal.needsUpdate=true;
    this.status='active';this.suppression=null;return this.movedVertices>0;
  }

  reset(){this._release();this.run=null;this.course=null;this.eventId=null;this.cancelledId=null;this.lastTime=0;this.elapsed=0;this.duration=0;this.progress=0;this.foldCenter=0;this.status='idle';this.suppression='inactive';}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.status='disposed';this.suppression='disposed';}
  diagnostics(){return {status:this.status,suppression:this.suppression,eventId:this.eventId,phase:this.status==='active'?(this.reducedMotion?'static-fold':this.progress<.74?'travel':'settle'):this.suppression==='entry'?'entry':'none',elapsed:this.elapsed,duration:this.duration,entrySeconds:CUFF_ENTRY_SECONDS,progress:this.progress,foldPathFraction:this.foldCenter,reducedMotion:this.reducedMotion,limb:'rightArm',limbState:this.limbState,source:this.record?.mesh.name||null,sourceVertices:this.record?.positions.length/3||0,ownedGeometries:this.record?1:0,geometryCreates:this.geometryCreates,geometryDisposals:this.geometryDisposals,drawCallsAdded:0,materialsAdded:0,skinMutation:false,movedVertices:this.movedVertices,maxDisplacementMeters:this.maxDisplacement,limits:HORROR_CUFF_LIMITS};}
}
