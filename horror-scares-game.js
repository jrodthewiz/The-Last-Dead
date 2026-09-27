import * as THREE from './vendor/three.module.js';
import {createAfterlifeModel} from './npc-afterlife-model.js';
import {createScreamMouth,setScreamMouthOpen} from './scream-mouth.js';

const CELL=4;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const dark=new THREE.MeshStandardMaterial({color:0x171516,roughness:.94});
const iron=new THREE.MeshStandardMaterial({color:0x292b2b,metalness:.7,roughness:.48});
const wood=new THREE.MeshStandardMaterial({color:0x281813,roughness:.72});
const ivory=new THREE.MeshStandardMaterial({color:0xaca394,roughness:.72});
const voidMat=new THREE.MeshBasicMaterial({color:0x050607});
const flameMat=new THREE.MeshBasicMaterial({color:0xb85431});
for(const material of [dark,iron,wood,ivory,voidMat,flameMat])material.userData.sharedLibrary=true;

function box(parent,name,size,position,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
 mesh.name=name;mesh.position.set(...position);mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,name,radius,height,position,material){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,8),material);
 mesh.name=name;mesh.position.set(...position);mesh.castShadow=false;parent.add(mesh);return mesh;
}
function cable(parent,name,a,b,radius=.017){
 const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
 const mesh=cylinder(parent,name,radius,from.distanceTo(to),[0,0,0],iron);
 mesh.position.copy(from).add(to).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
 return mesh;
}
function witness(asset,name){
 const root=createAfterlifeModel(asset,0);
 if(!root)return null;
 root.name=name;
 root.traverse(object=>{if(object.isMesh)object.castShadow=false;});
 const state=root.userData.afterlife;
 return {root,state,bones:Object.fromEntries(['Head','Spine01','LeftArm','RightArm','LeftUpLeg','RightUpLeg'].map(name=>[name,state.model.getObjectByName(name)]))};
}
function pianoVigil(parent,asset,room,materials={}){
 if(!room)return null;
 const group=new THREE.Group();group.name='PianoVigil';parent.add(group);
 const woodFinish=materials.afterlifeWood?.clone?.()||wood.clone();
 woodFinish.color.setHex(0x9e806c);woodFinish.roughness=.86;woodFinish.metalness=0;
 woodFinish.name='PianoVigil_WornWood';
 const woodShade=woodFinish.clone();woodShade.color.setHex(0x654537);woodShade.name='PianoVigil_DarkWood';
 // Keep the central combat lane clear. The console sits against the room's north wall.
 const x=(room.bounds.minX+room.bounds.maxX)*.5*CELL+5;
 const z=(room.bounds.minZ+.77)*CELL;
 group.position.set(x,0,z);
 box(group,'upright piano case',[2.9,1.1,1.12],[0,.8,0],woodFinish);
 box(group,'piano crown',[3.05,1.23,.18],[0,2.09,-.54],woodShade);
 box(group,'piano crown inset',[2.68,.91,.035],[0,2.11,-.428],woodFinish);
 for(const side of [-1,1]){
  box(group,'piano crown pilaster',[.13,1.24,.13],[side*1.47,2.09,-.405],woodFinish);
  box(group,'piano case pilaster',[.14,1.12,.14],[side*1.37,.8,.49],woodShade);
 }
 box(group,'piano cornice',[3.2,.11,.33],[0,2.73,-.49],woodFinish);
 box(group,'piano lower moulding',[3.04,.09,.2],[0,1.46,-.43],woodFinish);
 for(const y of [1.76,2.43])box(group,'piano inset rail',[2.58,.055,.06],[0,y,-.39],woodShade);
 box(group,'piano maker plaque',[.59,.12,.03],[0,2.08,-.39],iron);
 box(group,'keyboard',[2.48,.065,.43],[0,1.34,.49],ivory);
 for(let i=0;i<18;i++)box(group,'key division',[.012,.012,.43],[-1.15+i*.135,1.38,.49],iron);
 for(let i=0;i<13;i++)box(group,'black key',[.077,.055,.23],[-1.08+i*.18,1.41,.4],iron);
 for(const side of [-1,1]){
  box(group,'piano foot',[.17,.23,.81],[side*1.12,.12,0],woodShade);
  box(group,'vigil altar',[.72,1.04,.72],[side*2.48,.52,-.15],dark);
  cylinder(group,'votive candle',.047,.23,[side*2.48,1.15,-.15],ivory);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.045,.13,7),flameMat);
  flame.position.set(side*2.48,1.33,-.15);group.add(flame);
 }
 for(let i=-4;i<=4;i++)cylinder(group,'organ pipe',.066,1.2+(4-Math.abs(i))*.23,[i*.35,3.8-(4-Math.abs(i))*.115,-.8],iron);
 for(const x of [-.76,0,.76]){
  const pedal=box(group,'piano pedal',[.13,.035,.37],[x,.2,.64],iron);
  pedal.rotation.x=-.18;
 }
 for(let i=0;i<4;i++)cable(group,'piano suspension',[ -.55+i*.36,4.8,-.12],[-.5+i*.34,2.6,-.12],.013);
 const body=witness(asset,'SuspendedPianoBody');
 if(body){body.root.position.set(.75,2.78,.13);body.root.rotation.z=1.42;group.add(body.root);}
 return {group,body};
}
function makeWindow(parent,asset,room){
 if(!room)return null;
 const group=new THREE.Group();group.name='ScreamingWindow';parent.add(group);
 group.position.set((room.bounds.minX+.075)*CELL,0,(room.bounds.minZ+room.bounds.maxZ)*.5*CELL);
 group.rotation.y=-Math.PI/2;
 box(group,'black wall recess',[3.05,3.0,.025],[0,2.55,.03],voidMat);
 box(group,'left stone pier',[.38,3.8,.56],[-1.7,2.5,-.02],dark);
 box(group,'right stone pier',[.38,3.8,.56],[1.7,2.5,-.02],dark);
 box(group,'stone lintel',[3.75,.4,.56],[0,4.33,-.02],dark);
 box(group,'stone sill',[3.75,.34,.7],[0,.89,-.17],dark);
 for(const x of [-1.05,-.52,.52,1.05])cylinder(group,'window bar',.035,2.9,[x,2.53,-.35],iron);
 const actor=witness(asset,'ReachingScreamer');
 if(!actor)return {group,actor:null};
 actor.root.position.set(0,-1.6,-.13);group.add(actor.root);
 const mouthRig=createScreamMouth(actor.root);
 return {group,actor,...mouthRig,triggered:false,started:0};
}
function reachForBar(actor,armName,handName,targetLocal){
 const upper=actor.state.model.getObjectByName(armName);
 const hand=actor.state.model.getObjectByName(handName);
 if(!upper||!hand)return;
 actor.root.updateMatrixWorld(true);
 const start=upper.getWorldPosition(new THREE.Vector3());
 const end=hand.getWorldPosition(new THREE.Vector3());
 const target=actor.root.localToWorld(new THREE.Vector3(...targetLocal));
 const from=end.sub(start).normalize(),to=target.sub(start).normalize();
 const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
 const parentWorld=upper.parent.getWorldQuaternion(new THREE.Quaternion());
 upper.quaternion.premultiply(parentWorld.clone().invert().multiply(delta).multiply(parentWorld));
}
function makeDrop(parent,asset){
 const group=new THREE.Group();group.name='CeilingDropScare';parent.add(group);
 box(group,'ceiling trap',[2.45,.07,1.5],[0,5.57,0],dark);
 const actor=witness(asset,'HangingScreamer');
 if(!actor)return null;
 actor.root.position.y=5.58;group.add(actor.root);
 const noose=new THREE.Mesh(new THREE.TorusGeometry(.09,.014,6,18),iron);
 noose.position.set(0,1.66,-.06);actor.root.add(noose);
 cable(group,'neck tether',[0,5.53,0],[0,3.5,0],.016);
 group.visible=false;
 return {group,actor,started:0};
}

export class HorrorScares {
 constructor(worldRoot,course,asset,materials={}){
  this.course=course;this.asset=asset;this.root=new THREE.Group();this.root.name='HorrorScares';worldRoot.add(this.root);
  this.drop=asset?makeDrop(this.root,asset):null;
  const entry=course?.rooms?.find(room=>room.id?.endsWith('-entry'));
  this.window=asset&&course?.dungeon?makeWindow(this.root,asset,entry):null;
  this.piano=asset&&course?.dungeon&&course.dungeonIndex===1?pianoVigil(this.root,asset,entry,materials):null;
  this.pending=[];this.lastDrop=-Infinity;
 }
 queue(type,run,nowMs){
  if(type!=='drop')return;
  this.pending.push({type,x:run.x,y:run.y,angle:run.angle,nowMs});
  if(this.pending.length>2)this.pending.shift();
 }
 update(run,nowMs,audio,reducedMotion=false){
  if(!this.asset)return;
  const dt=clamp(this.lastNowMs?(nowMs-this.lastNowMs)/1000:.016,0,.05);this.lastNowMs=nowMs;
  for(const actor of [this.drop?.actor,this.window?.actor,this.piano?.body])actor?.state.mixer?.update(dt);
  for(const event of this.pending.splice(0)){
   if(!this.drop||nowMs-this.lastDrop<14000)continue;
   const {group,actor}=this.drop;
   group.position.set((event.x+Math.cos(event.angle)*.83)*CELL,0,(event.y+Math.sin(event.angle)*.83)*CELL);
   group.rotation.y=event.angle+Math.PI/2;
   group.visible=true;actor.root.position.y=5.58;
   this.drop.started=nowMs;this.lastDrop=nowMs;
   audio?.play('ceiling-scream',0,{id:'ceiling-drop',position:{x:group.position.x,y:2.7,z:group.position.z}});
  }
  if(this.drop?.group.visible){
   const t=(nowMs-this.drop.started)/1000;
   const {actor}=this.drop;
   const fall=clamp(t/.7,0,1);
   actor.root.position.y=5.58-3.65*(1-(1-fall)**3)+(t>.7?.07*Math.exp(-(t-.7)*1.5)*Math.sin((t-.7)*17):0);
   actor.root.rotation.z=Math.sin(t*9)*.11*Math.exp(-Math.max(0,t-.7)*.2);
   actor.root.rotation.x=Math.sin(t*5)*.1;
   if(!reducedMotion){
    for(const [name,sign] of [['LeftArm',1],['RightArm',-1],['LeftUpLeg',-1],['RightUpLeg',1]]){
     const bone=actor.bones[name];if(bone){bone.rotation.z+=sign*Math.sin(t*12+sign)*.38;bone.rotation.x+=Math.sin(t*9+sign)*.2;}
    }
    if(actor.bones.Head)actor.bones.Head.rotation.x+=Math.sin(t*10)*.11;
   }
   if(t>12)this.drop.group.visible=false;
  }
  const window=this.window;
  if(window?.actor){
   const distance=Math.hypot(run.x*CELL-window.group.position.x,run.y*CELL-window.group.position.z);
   if(!window.triggered&&distance<10&&audio?.assetsLoaded&&nowMs-(this.windowArmedAt??(this.windowArmedAt=nowMs))>900){
    window.triggered=true;window.started=nowMs;
    window.played=!!audio?.play('window-scream',0,{id:`window-${this.course.dungeonIndex}`,position:{x:window.group.position.x,y:2.5,z:window.group.position.z}});
   }
   if(window.triggered){
    const t=(nowMs-window.started)/1000;
    const rise=clamp(t/.43,0,1);window.actor.root.position.y=-1.6+2.5*(1-(1-rise)**3);
    window.actor.root.rotation.z=reducedMotion?0:Math.sin(t*12)*.025;
    const playerLocal=window.group.worldToLocal(new THREE.Vector3(run.x*CELL,1.6,run.y*CELL));
    if(window.actor.bones.Head)window.actor.bones.Head.rotation.y+=clamp(Math.atan2(playerLocal.x,-playerLocal.z),-.55,.55)*.72;
    const headfront=window.actor.state.model.getObjectByName('headfront');
    if(headfront){
     window.actor.root.updateMatrixWorld(true);
     window.mouth.position.copy(window.actor.root.worldToLocal(headfront.getWorldPosition(new THREE.Vector3())));
     window.mouth.position.z-=.04;
    }
    const level=window.played&&audio?.soundLevelAt('window-scream',t)||0;
    window.mouth.visible=level>.045;
    setScreamMouthOpen(window,level);
    reachForBar(window.actor,'LeftArm','LeftHand',[-.75,1.8,-.76]);
    reachForBar(window.actor,'RightArm','RightHand',[.75,1.8,-.76]);
   }
  }
 }
 get diagnostics(){return {dropVisible:!!this.drop?.group.visible,windowTriggered:!!this.window?.triggered,mouthOpen:this.window?.cavity.scale.y||0,piano:!!this.piano};}
}
