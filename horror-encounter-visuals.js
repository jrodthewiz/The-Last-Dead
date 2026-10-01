import * as THREE from './vendor/three.module.js';
import {createAfterlifeModel,disposeAfterlifeModel} from './npc-afterlife-model.js';
import {applyCharacterArticulation,restoreCharacterArticulation} from './character-articulation.js';

const CELL=4,UP=new THREE.Vector3(0,1,0);
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min=0,max=1)=>THREE.MathUtils.clamp(finite(value),min,max);
const smooth=(value,start,end)=>THREE.MathUtils.smoothstep(value,start,end);
const pulse=(time,start,end)=>smooth(time,start,start+.5)*(1-smooth(time,end-.5,end));
const KINDS=new Set(['witness','transfer','strain','callback','table']);

/** A small in-run motif; intervals, rather than an audio recording. */
export function encounterRhythmPulse(time,rhythm=[]){
 const intervals=rhythm.slice(0,6).map(value=>clamp(value,.18,1.2));
 if(!intervals.length)intervals.push(.37,.62,.28,.81);
 const cycle=intervals.reduce((sum,value)=>sum+value,0)+1.05;
 const phase=((finite(time)%cycle)+cycle)%cycle;
 let onset=.35,result=0;
 for(const interval of intervals){
  const age=phase-onset;
  if(age>=0&&age<.25)result=Math.max(result,Math.sin(Math.PI*age/.25));
  onset+=interval;
 }
 return result;
}

/** Mirrors the director's single callback cue schedule exactly. */
export function encounterCallbackPulse(time,rhythm=[]){
 const intervals=rhythm.slice(-4).filter(value=>Number.isFinite(value)&&value>=.12&&value<=1.5);
 if(!intervals.length)intervals.push(.37,.62,.41);
 let onset=.75,result=0;
 for(const interval of intervals){
  onset+=interval;
  const age=finite(time)-onset;
  if(age>=0&&age<.25)result=Math.max(result,Math.sin(Math.PI*age/.25));
 }
 return result;
}

function yawBone(bone,angle){
 if(!bone||!Number.isFinite(angle))return;
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
 const delta=parent.clone().invert().multiply(new THREE.Quaternion().setFromAxisAngle(UP,angle)).multiply(parent);
 bone.quaternion.premultiply(delta).normalize();
 bone.updateWorldMatrix(false,true);
}

function pointBoneAt(bone,child,target){
 const start=bone.getWorldPosition(new THREE.Vector3()),end=child.getWorldPosition(new THREE.Vector3());
 const from=end.sub(start),to=target.clone().sub(start);
 if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return;
 const turn=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
 const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
 bone.quaternion.premultiply(parent.clone().invert().multiply(turn).multiply(parent)).normalize();
 bone.updateWorldMatrix(false,true);
}

// Two rigid links: only joint rotations change. Contact never stretches bones.
function reach(actor,targetLocal){
 const {upper,fore,hand}=actor;
 if(!upper||!fore||!hand)return false;
 actor.root.updateMatrixWorld(true);
 const target=actor.root.localToWorld(targetLocal.clone());
 const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=fore.getWorldPosition(new THREE.Vector3()),wrist=hand.getWorldPosition(new THREE.Vector3());
 const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist);
 if(a<.001||b<.001)return false;
 const direction=target.clone().sub(shoulder),distance=clamp(direction.length(),Math.abs(a-b)+.003,a+b-.003);
 direction.normalize();
 const bend=elbow.clone().sub(shoulder).addScaledVector(direction,-elbow.clone().sub(shoulder).dot(direction));
 if(bend.lengthSq()<1e-8)bend.crossVectors(direction,UP);
 if(bend.lengthSq()<1e-8)bend.set(1,0,0);
 bend.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
 const wantedElbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,height);
 const wantedWrist=shoulder.clone().addScaledVector(direction,distance);
 pointBoneAt(upper,fore,wantedElbow);pointBoneAt(fore,hand,wantedWrist);
 return true;
}

function makeSkinContacts(actor,ownedGeometry){
 const patches=[];
 actor.state.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,positions=mesh.geometry.attributes.position;
  if(!skin||!weights||!positions)return;
  const indices=[],vertices=[],usedBones=new Set();
  for(let i=0;i<positions.count;i++){
   let handWeight=0;
   for(let j=0;j<4;j++)if(['RightHand','RightGrip'].includes(mesh.skeleton.bones[skin.getComponent(i,j)]?.name))handWeight+=weights.getComponent(i,j);
   if(handWeight>.32){
    indices.push(i);
    const influences=[];
    for(let j=0;j<4;j++){
     const weight=weights.getComponent(i,j),bone=skin.getComponent(i,j);
     if(weight>0){influences.push({bone,weight});usedBones.add(bone);}
    }
    vertices.push({index:i,influences});
   }
  }
  if(!indices.length)return;
  mesh.geometry=mesh.geometry.clone();ownedGeometry.add(mesh.geometry);
  const stride=Math.max(1,Math.ceil(indices.length/192));
  patches.push({mesh,indices,vertices,surfaceVertices:vertices.filter((_,i)=>i%stride===0),usedBones:[...usedBones],boneMatrices:new Map([...usedBones].map(index=>[index,new THREE.Matrix4()])),base:new Float32Array(mesh.geometry.attributes.position.array)});
 });
 return patches;
}

function prepareSkinPatch(patch,inverseRoot){
 const {mesh}=patch;
 const prefix=new THREE.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
 for(const index of patch.usedBones){
  const matrix=patch.boneMatrices.get(index);
  matrix.multiplyMatrices(mesh.skeleton.bones[index].matrixWorld,mesh.skeleton.boneInverses[index]);
  matrix.premultiply(prefix).multiply(mesh.bindMatrix);
 }
}

function skinLocalMatrix(patch,vertex,result){
 result.elements.fill(0);
 for(const {bone,weight}of vertex.influences){
  const boneMatrix=patch.boneMatrices.get(bone);
  for(let k=0;k<16;k++)result.elements[k]+=boneMatrix.elements[k]*weight;
 }
 return result;
}

/** Presentation only. Placement and encounter time belong to the director. */
export class HorrorEncounterVisuals {
 constructor(worldRoot,course,asset,materials={}){
  this.course=course;this.asset=asset;this.materialSources=materials;
  this.root=new THREE.Group();this.root.name='HorrorEncounterVisuals';this.root.visible=false;worldRoot.add(this.root);
  this.geometries=new Set();this.materials=new Set();this.actor=null;this.scene=null;this.eventId=null;this.disposed=false;
  this.metrics={elapsed:0,torsoYaw:0,headYaw:0,contactError:0,compression:0,deformedVertices:0,filamentLength:0,residue:0,tableLift:0,rhythmPulse:0};
 }
 _material(role,source,options){
  const material=source?.clone?.()||new THREE.MeshStandardMaterial();
  delete material.userData.sharedLibrary;delete material.userData.sharedAsset;material.userData.horrorEncounterOwned=true;
  material.name=`HorrorEncounter_${role}`;
  for(const [key,value]of Object.entries(options||{})){
   if(material[key]?.isColor)material[key].set(value);else material[key]=value;
  }
  this.materials.add(material);return material;
 }
 _geometry(geometry){this.geometries.add(geometry);return geometry;}
 _mesh(parent,name,geometry,material,position=[0,0,0]){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.receiveShadow=true;mesh.castShadow=false;parent.add(mesh);return mesh;
 }
 _box(parent,name,size,position,material){return this._mesh(parent,name,this._geometry(new THREE.BoxGeometry(...size)),material,position);}
 _bar(parent,name,a,b,radius,material){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=from.distanceTo(to);
  const mesh=this._mesh(parent,name,this._geometry(new THREE.CylinderGeometry(radius,radius,length,8)),material);
  mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(UP,to.sub(from).normalize());return mesh;
 }
 _build(){
  if(this.scene||this.disposed)return;
  const group=new THREE.Group();group.name='RememberingWard';this.root.add(group);this.scene={group};
  const src=this.materialSources;
  const metal=this._material('worn iron',src.wornSteel||src.metal,{color:0x6f7974,roughness:.74,metalness:.5});
  const dark=this._material('contact shadow',src.metalDark,{color:0x1d2522,roughness:.88,metalness:.15});
  const enamel=this._material('clean enamel',src.wornSteel,{color:0xcacbbe,roughness:.27,metalness:.09});
  const cloth=this._material('washed linen',src.afterlifeWood,{color:0x9d9988,roughness:.96,metalness:0});
  const oil=this._material('oil and fibers',null,{color:0x2c3022,roughness:.34,metalness:0});
  const tissue=this._material('biological residue',null,{color:0x4d291f,roughness:.44,metalness:0});
  // The player's close lantern is an inverse-square light. A lit flat pane
  // creates a broad specular hotspot directly over the anatomical contact.
  // Put the glass read into its frame/etched marks; the very slight neutral
  // fill is nonreflective so the real hand remains legible at inspection range.
  const glass=new THREE.MeshBasicMaterial({color:0x9aa49e,transparent:true,opacity:.025,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  glass.name='HorrorEncounter_clear observation glass';glass.userData.horrorEncounterOwned=true;this.materials.add(glass);
  this.scene.oil=oil;this.scene.tissue=tissue;
  if(this.asset){
   const root=createAfterlifeModel(this.asset,0,7301);
   if(root){
    root.name='RememberingWard_Specimen';group.add(root);
    const state=root.userData.afterlife;
    root.traverse(node=>{if(node.isMesh)node.castShadow=false;});
    const bones=[];state.model.traverse(node=>{if(node.isBone)bones.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()});});
    this.actor={root,state,bones,upper:state.model.getObjectByName('RightArm'),fore:state.model.getObjectByName('RightForeArm'),hand:state.model.getObjectByName('RightHand'),grip:state.model.getObjectByName('RightGrip'),head:state.model.getObjectByName('Head'),spine:state.model.getObjectByName('Spine01')||state.model.getObjectByName('Spine'),patches:[]};
    this.actor.patches=makeSkinContacts(this.actor,this.geometries);
    for(const material of state.materials||[])this.materials.add(material);
    this.geometries.add(state.warningRing.geometry);this.materials.add(state.warningRing.material);
   }
  }
  this.root.updateMatrixWorld(true);
  const shoulder=this.actor?.upper?this.actor.root.worldToLocal(this.actor.upper.getWorldPosition(new THREE.Vector3())):new THREE.Vector3(.25,1.45,0);
  // The fixture follows the authored shoulder's reachable workspace, not the
  // other way around. A fixed visual anchor never changes world collision.
  this.scene.target=shoulder.clone().add(new THREE.Vector3(.025,-.17,-.35));
  this.scene.restHand=this.actor?.hand?this.actor.root.worldToLocal(this.actor.hand.getWorldPosition(new THREE.Vector3())):new THREE.Vector3(.25,.85,0);
  const target=this.scene.target;
  const fixture=new THREE.Group();fixture.name='WardContactFixture';group.add(fixture);this.scene.fixture=fixture;
  const fixtureX=target.x,planeZ=target.z-.075;
  this.scene.planeZ=planeZ;
  // The observer stands on local -Z. Keep the pressure window open above
  // the cabinet: a full-height backing on this side would hide the specimen
  // and its contact behind a convincing-looking but entirely opaque slab.
  this._box(fixture,'recess toe kick',[1.14,.15,.10],[fixtureX,.13,planeZ-.24],dark);
  this._box(fixture,'enamel lower cabinet',[1.08,.70,.20],[fixtureX,.53,planeZ-.13],enamel);
  this._box(fixture,'cabinet upper lip',[1.16,.055,.30],[fixtureX,.91,planeZ-.06],metal);
  for(const x of[-.57,.57]){
   this._box(fixture,'glass side seal',[.055,1.55,.075],[fixtureX+x,1.58,planeZ],dark);
   this._box(fixture,'raised iron jamb',[.06,1.63,.065],[fixtureX+x,1.58,planeZ-.028],metal);
  }
  for(const y of[.81,2.38])this._box(fixture,'glass rail',[1.20,.07,.085],[fixtureX,y,planeZ],metal);
  this.scene.glass=this._mesh(fixture,'clear pressure pane',this._geometry(new THREE.PlaneGeometry(1.08,1.50)),glass,[fixtureX,1.59,planeZ]);
  const handle=new THREE.Group();handle.name='CleanEnamelHandle';handle.position.set(target.x,target.y,planeZ+.011);fixture.add(handle);this.scene.handle=handle;
  for(const x of[-.115,.115])this._bar(handle,'handle standoff',[x,0,0],[x,0,.055],.018,metal);
  this._bar(handle,'enamel grip',[-.115,0,.055],[.115,0,.055],.024,enamel);
  this._box(fixture,'cabinet door seam',[.007,.55,.007],[fixtureX,.51,planeZ-.022],dark);
  for(let i=0;i<6;i++)this._box(fixture,'etched pressure graduation',[i%2?.027:.046,.006,.001],[fixtureX-.41,.98+i*.092,planeZ+.002],metal);
  this._bar(fixture,'supply tube',[fixtureX+.42,.2,planeZ-.26],[fixtureX+.42,2.09,planeZ-.26],.035,metal);
  for(const y of[.28,1.94])this._bar(fixture,'tube collar',[fixtureX+.42,y-.028,planeZ-.26],[fixtureX+.42,y+.028,planeZ-.26],.051,dark);
  // An irregular solid smear sits on the enamel surface after visible contact.
  const smearShape=new THREE.Shape();smearShape.moveTo(-.07,-.015);smearShape.bezierCurveTo(-.034,.033,.033,.026,.074,.006);smearShape.bezierCurveTo(.027,-.015,-.026,-.039,-.07,-.015);
  const residue=this._mesh(handle,'transferred residue',this._geometry(new THREE.ShapeGeometry(smearShape,8)),oil,[0,0,.080]);
  residue.visible=false;this.scene.residue=residue;
  const filament=new THREE.Group();filament.name='ContactTransferFilament';group.add(filament);this.scene.filament=filament;
  const filamentGeometry=this._geometry(new THREE.CylinderGeometry(.007,.007,1,6));
  for(let i=0;i<7;i++)this._mesh(filament,`taut fiber ${i}`,filamentGeometry,oil);
  this._table(group,metal,dark,cloth);
  const pipes=new THREE.Group();pipes.name='RememberingPipeChoir';pipes.position.set(target.x-.24,0,target.z-.09);group.add(pipes);this.scene.pipes=pipes;this.scene.diaphragms=[];
  const diaphragmGeometry=this._geometry(new THREE.CircleGeometry(.095,14));
  for(let i=0;i<3;i++){
   const x=(i-1)*.24,height=2.15+(i===1?.23:i===2?-.12:0);
   this._bar(pipes,'resonance pipe',[x,.10,-.13],[x,height,-.13],.07,metal);
   this._bar(pipes,'pipe foot',[x-.11,.06,-.13],[x+.11,.06,-.13],.022,dark);
   this._bar(pipes,'membrane ferrule',[x,1.05,-.13],[x,1.05,.01],.104,metal);
   const disc=this._mesh(pipes,'breathing diaphragm',diaphragmGeometry,cloth,[x,1.05,.018]);this.scene.diaphragms.push(disc);
  }
  this._bar(pipes,'touch reed', [.14,target.y,.09],[.34,target.y,.09],.025,enamel);
  this._bar(pipes,'reed return spring',[.24,target.y,-.13],[.24,target.y,.09],.018,metal);
  // Grounding is authored in the fixture: feet/legs meet y=0, dark contact
  // rails sit at .025. No dynamic lights or combat-shaped warning rings.
  this._box(group,'fixture contact foot',[1.28,.045,.52],[fixtureX,.025,planeZ-.11],dark);
 }
 _table(group,metal,dark,cloth){
  const table=new THREE.Group();table.name='ListeningSurgicalTable';group.add(table);this.scene.table=table;
  this._box(table,'table mattress',[1.25,.14,2.15],[0,.96,0],dark);
  for(const side of[-1,1]){
   this._bar(table,'rolled table rail',[side*.67,1.03,-1.14],[side*.67,1.03,1.14],.032,metal);
   for(const z of[-.83,.83]){
    this._bar(table,'angled table leg',[side*.52,.86,z],[side*.64,.06,z+.09*side],.04,metal);
    this._bar(table,'table foot',[side*.64-.10,.04,z],[side*.64+.10,.04,z],.033,dark);
   }
  }
  this._bar(table,'stretcher cross brace',[-.6,.25,0],[.6,.25,0],.028,metal);
  const geometry=this._geometry(new THREE.PlaneGeometry(1.59,2.52,18,26));
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getY(i);
   const over=Math.max(0,(Math.abs(x)-.53)/.26);
   const body=.10*Math.exp(-Math.pow(x/.31,4))*Math.exp(-Math.pow((z+.05)/.91,6));
   positions.setXYZ(i,x,1.054+body-.39*over*over+.009*Math.sin(z*17+x*13),z);
  }
  geometry.computeVertexNormals();
  const sheet=this._mesh(table,'linen over hidden specimen',geometry,cloth);sheet.material.side=THREE.DoubleSide;
  this.scene.sheet=sheet;this.scene.sheetBase=new Float32Array(positions.array);
  for(const z of[-.88,.88])this._box(table,'restraint buckle',[.11,.018,.055],[.70,.94,z],metal);
 }
 _restore(){
  if(!this.actor)return;
  restoreCharacterArticulation(this.actor.state.articulation);
  for(const {node,position,quaternion,scale}of this.actor.bones){node.position.copy(position);node.quaternion.copy(quaternion);node.scale.copy(scale);}
  for(const patch of this.actor.patches){patch.mesh.geometry.attributes.position.array.set(patch.base);patch.mesh.geometry.attributes.position.needsUpdate=true;}
 }
 _sample(time){
  if(!this.actor)return;
  this._restore();this.actor.state.mixer?.setTime(time);
  for(const item of this.actor.bones){item.position.copy(item.node.position);item.quaternion.copy(item.node.quaternion);item.scale.copy(item.node.scale);}
  this.actor.root.position.set(0,0,0);this.actor.root.rotation.set(0,0,0);this.actor.root.scale.setScalar(1);
  this.root.updateMatrixWorld(true);
 }
 _filament(from,to,amount,gore){
  const {filament,oil,tissue}=this.scene;
  filament.visible=amount>0&&from.distanceTo(to)>.028;
  this.metrics.filamentLength=filament.visible?from.distanceTo(to):0;
  if(!filament.visible)return;
  const count=filament.children.length;
  for(let i=0;i<count;i++){
   const start=from.clone().lerp(to,i/count),end=from.clone().lerp(to,(i+1)/count);
   start.y-=Math.sin(Math.PI*i/count)*.045;end.y-=Math.sin(Math.PI*(i+1)/count)*.045;
   const segment=filament.children[i];segment.material=gore?tissue:oil;
   segment.position.copy(start).add(end).multiplyScalar(.5);
   segment.quaternion.setFromUnitVectors(UP,end.sub(start).normalize());
   segment.scale.set(clamp(amount,.2,1),start.distanceTo(from.clone().lerp(to,(i+1)/count)),clamp(amount,.2,1));
   // Use the sagged endpoint length, rather than the unsagged chord.
   const next=from.clone().lerp(to,(i+1)/count);next.y-=Math.sin(Math.PI*(i+1)/count)*.045;
   segment.scale.y=start.distanceTo(next);
  }
 }
 _pressure(amount){
  this.metrics.compression=0;this.metrics.deformedVertices=0;
  if(!this.actor||amount<=0)return;
  this.root.updateMatrixWorld(true);
  const inverseRoot=this.root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  const center=this.scene.target,plane=this.scene.planeZ+.006;
  for(const patch of this.actor.patches){
   prepareSkinPatch(patch,inverseRoot);
   const positions=patch.mesh.geometry.attributes.position;
   for(const vertex of patch.vertices){
    const {index}=vertex;
    point.fromArray(patch.base,index*3);
    skinLocalMatrix(patch,vertex,matrix);
    point.applyMatrix4(matrix);
    const radial=Math.hypot(point.x-center.x,point.y-center.y);
    if(radial>.14||point.z>plane+.025)continue;
    const compression=Math.min(.016,Math.max(0,plane+.012-point.z))*amount*(1-smooth(radial,.055,.14));
    if(compression<=0)continue;
    point.z+=compression;
    // A narrow skin patch flattens; the rest of the hand retains its silhouette.
    point.applyMatrix4(matrix.invert());
    positions.setXYZ(index,point.x,point.y,point.z);
    this.metrics.compression=Math.max(this.metrics.compression,compression);this.metrics.deformedVertices++;
   }
   positions.needsUpdate=true;
  }
 }
 _handSurface(){
  if(!this.actor)return null;
  this.root.updateMatrixWorld(true);
  const inverseRoot=this.root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  let surface=null;
  for(const patch of this.actor.patches){
   prepareSkinPatch(patch,inverseRoot);
   for(const vertex of patch.surfaceVertices){
    point.fromArray(patch.base,vertex.index*3);skinLocalMatrix(patch,vertex,matrix);
    point.applyMatrix4(matrix);
    if(!surface||point.z<surface.z)surface=point.clone();
   }
  }
  return surface;
 }
 update(run,dt,state,settings={}){
  if(this.disposed)return;
  const active=state?.enabled!==false&&state?.active;
  if(!active||!KINDS.has(active.kind)||!Number.isFinite(active.anchor?.x)||!Number.isFinite(active.anchor?.y)){
   this.root.visible=false;this.eventId=null;this.kind=null;this._restore();return;
  }
  this._build();
  const time=clamp(active.elapsed,0,Math.max(0,finite(active.duration,20)));
  // Canonical elapsed drives every pose. A frozen elapsed (pause/dt=0) is exact.
  this.eventId=active.id;this.kind=active.kind;this.root.visible=true;
  this.root.position.set(active.anchor.x*CELL,0,active.anchor.y*CELL);
  this.root.rotation.y=-finite(active.anchor.angle)-Math.PI/2;
  this._sample(time);
  Object.assign(this.metrics,{elapsed:time,torsoYaw:0,headYaw:0,contactError:0,compression:0,deformedVertices:0,filamentLength:0,residue:0,tableLift:0,rhythmPulse:0});
  const scene=this.scene,actor=this.actor,reduced=!!settings.reducedMotion,gore=settings.gore!==false;
  scene.fixture.visible=['transfer','strain'].includes(active.kind);scene.table.visible=active.kind==='table';scene.pipes.visible=active.kind==='callback';
  scene.glass.visible=['strain','transfer'].includes(active.kind);scene.handle.visible=active.kind==='transfer';scene.filament.visible=false;scene.residue.visible=false;
  const sheet=scene.sheet.geometry.attributes.position;sheet.array.set(scene.sheetBase);
  for(const diaphragm of scene.diaphragms)diaphragm.position.z=.018;
  if(active.kind==='witness'&&actor){
   const turn=(reduced?.20:.48)*smooth(time,1,2.35);
   const headTurn=(reduced?.20:.48)*smooth(time,reduced?1:1.43,reduced?2.35:2.74);
   const localPlayer=this.root.worldToLocal(new THREE.Vector3(finite(run?.x)*CELL,1.55,finite(run?.y)*CELL));
   const track=clamp(-Math.atan2(localPlayer.x,-localPlayer.z),-.26,.26)*(1-smooth(time,2.5,3.5));
   yawBone(actor.spine,turn);yawBone(actor.head,headTurn-turn+track);
   this.metrics.torsoYaw=turn;this.metrics.headYaw=headTurn+track;
   applyCharacterArticulation(actor.state.articulation,{jawOpen:.035,leftGrip:.15,rightGrip:.15});
  }else if(['transfer','strain','callback'].includes(active.kind)&&actor){
   const contact=active.kind==='callback'?smooth(time,.12,.66):pulse(time,.5,active.kind==='strain'?5.3:3.55);
   const rhythm=active.kind==='callback'?encounterCallbackPulse(time,active.rhythm||state.memory?.rhythm):0;
   const grip=active.kind==='strain'?.58+.20*smooth(time,2.3,4.2):active.kind==='callback'?.12+.64*rhythm:.35;
   applyCharacterArticulation(actor.state.articulation,{jawOpen:.04,leftGrip:.12,rightGrip:grip*contact});
   const target=scene.restHand.clone().lerp(scene.target,contact);
   // A tiny withdrawal attempt stays within the reach workspace and keeps the
   // strained knuckle readable through its transparent observation pane.
   if(active.kind==='strain')target.z+=(reduced?0:.012*Math.sin(time*4))*smooth(time,2.5,3.1)*contact;
   reach(actor,target);
   if(actor.grip&&actor.hand){
    const wrist=actor.hand.getWorldPosition(new THREE.Vector3());
    const forward=actor.root.localToWorld(new THREE.Vector3(0,0,-1)).sub(actor.root.getWorldPosition(new THREE.Vector3())).normalize();
    pointBoneAt(actor.hand,actor.grip,wrist.addScaledVector(forward,.2));
   }
   // Place the actual scanned knuckle on the surface. The wrist-to-knuckle
   // offset differs between exports, so do not assume an unweighted proxy is
   // the contact point. Two bounded passes solve the small joint correction.
   if(contact>.01&&active.kind!=='callback')for(let pass=0;pass<2;pass++){
    const surface=this._handSurface();
    if(!surface)break;
    const desired=active.kind==='strain'?scene.planeZ+.002:scene.planeZ+.080;
    target.z+=clamp(desired-surface.z,-.12,.12)*contact;
    reach(actor,target);
    if(actor.grip&&actor.hand){
     const wrist=actor.hand.getWorldPosition(new THREE.Vector3()),forward=actor.root.localToWorld(new THREE.Vector3(0,0,-1)).sub(actor.root.getWorldPosition(new THREE.Vector3())).normalize();
     pointBoneAt(actor.hand,actor.grip,wrist.addScaledVector(forward,.2));
    }
   }
   actor.root.updateMatrixWorld(true);
   if(actor.hand){
    const hand=actor.root.worldToLocal(actor.hand.getWorldPosition(new THREE.Vector3()));
    this.metrics.contactError=hand.distanceTo(target);
    const point=this._handSurface()||hand.clone().add(new THREE.Vector3(0,0,-.07));
    if(active.kind==='transfer'){
     const stain=smooth(time,1.38,1.65);scene.residue.visible=stain>0;scene.residue.scale.setScalar(Math.max(.001,stain));scene.residue.material=gore?scene.tissue:scene.oil;
     this.metrics.residue=stain;
     const start=scene.handle.position.clone().add(new THREE.Vector3(0,0,.08));
     this._filament(point,start,(reduced?.48:1)*pulse(time,1.78,3.55),gore);
    }
   }
   if(active.kind==='strain')this._pressure(contact*(reduced?.45:1));
   if(active.kind==='callback'){
    this.metrics.rhythmPulse=rhythm;
    for(let i=0;i<scene.diaphragms.length;i++)scene.diaphragms[i].position.z=.018+rhythm*(reduced?.007:.024)*(1-i*.16);
   }
  }else if(active.kind==='table'){
   if(actor){actor.root.position.set(0,.84,.96);actor.root.rotation.x=-Math.PI/2;actor.root.scale.setScalar(.90);}
   const breath=encounterRhythmPulse(time,active.rhythm||state.memory?.rhythm);
   const lift=(reduced?.018:.072)*breath*smooth(time,.4,1.2),centerZ=-.31+.24*smooth(time,1,4);
   for(let i=0;i<sheet.count;i++){
    const x=sheet.getX(i),z=sheet.getZ(i),weight=Math.exp(-Math.pow((x-.13)/.19,2)-Math.pow((z-centerZ)/.25,2));
    sheet.setY(i,scene.sheetBase[i*3+1]+lift*weight);
   }
   this.metrics.tableLift=lift;this.metrics.rhythmPulse=breath;
   scene.sheet.geometry.computeVertexNormals();
  }
  sheet.needsUpdate=true;
  this.root.updateMatrixWorld(true);
 }
 reset(){
  this.root.visible=false;this.eventId=null;this.kind=null;this._restore();
  Object.assign(this.metrics,{elapsed:0,torsoYaw:0,headYaw:0,contactError:0,compression:0,deformedVertices:0,filamentLength:0,residue:0,tableLift:0,rhythmPulse:0});
 }
 dispose(){
  if(this.disposed)return;
  this.reset();disposeAfterlifeModel(this.actor?.root);
  // The template mesh and packed texture maps belong to the renderer. Only
  // our geometry copies, warning ring and cloned materials are released here.
  for(const geometry of this.geometries)geometry.dispose();
  for(const material of this.materials)material.dispose();
  this.geometries.clear();this.materials.clear();this.root.removeFromParent();this.root.clear();this.actor=null;this.scene=null;this.disposed=true;
 }
 get diagnostics(){
  let meshes=0,triangles=0;const geometry=new Set(),materials=new Set(),textures=new Set();
  this.root.traverse(node=>{
   if(!node.isMesh)return;meshes++;geometry.add(node.geometry);triangles+=(node.geometry.index?.count||node.geometry.attributes.position?.count||0)/3;
   for(const material of Array.isArray(node.material)?node.material:[node.material]){if(!material)continue;materials.add(material);for(const key of['map','normalMap','roughnessMap','metalnessMap'])if(material[key])textures.add(material[key]);}
  });
  return {visible:this.root.visible,activeKind:this.kind||null,eventId:this.eventId,anchor:{x:this.root.position.x/CELL,y:this.root.position.z/CELL,angle:-this.root.rotation.y-Math.PI/2},worldPosition:this.root.position.toArray(),specimen:!!this.actor,handSkinVertices:this.actor?.patches.reduce((sum,patch)=>sum+patch.indices.length,0)||0,activeSpecimens:this.root.visible&&this.actor?1:0,...this.metrics,meshes,triangles:Math.round(triangles),geometries:geometry.size,materials:materials.size,textures:textures.size,ownedGeometries:this.geometries.size,ownedMaterials:this.materials.size,disposed:this.disposed};
 }
}
