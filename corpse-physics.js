import * as THREE from './vendor/three.module.js';
import * as CANNON from './vendor/cannon-es.js';
import {groundAt,capeNaturalHeight,capeStreamZ,capeStreamLevel,CAPE_TERRAIN} from './coastal-terrain.js';

// Local cosmetic physics only. Gameplay positions, hits and authority stay in
// engine.js. The visible imported skeleton is retained; none of these proxies
// are rendered. cannon-es 0.20.0 is bundled with its MIT license.
export const CORPSE_PHYSICS_LIMITS=Object.freeze({ragdolls:4,drops:12,tissueChains:2,tissuePoints:32,timestep:1/60,maxVelocity:8,maxTissueVelocity:4,maxTissueSupportAcceleration:55,maxAngularVelocity:12,wallThickness:.24,wallHeight:3.2});
// Cannon's SAP visits static/static pairs before rejecting their masks. Here
// only awake non-static bodies can contribute a pair. Query them against all
// supports using Cannon's exact filter and bounding-volume tests, without
// dropping distant supports or reducing collision detail.
export class CorpseBroadphase extends CANNON.Broadphase {
  collisionPairs(world,p1,p2){
    const bodies=world.bodies,active=[];
    for(let i=0;i<bodies.length;i++)if(bodies[i].type!==CANNON.Body.STATIC&&bodies[i].sleepState!==CANNON.Body.SLEEPING)active.push(i);
    const activeIndices=new Set(active);
    for(const i of active)for(let j=0;j<bodies.length;j++){
      if(i===j||j>i&&activeIndices.has(j))continue;
      const a=bodies[Math.min(i,j)],b=bodies[Math.max(i,j)];
      if(this.needBroadphaseCollision(a,b))this.intersectionTest(a,b,p1,p2);
    }
  }
}
// Source geometry is shared by imported clones. Values live in each source
// bone's local frame, never in a particular corpse's posed world frame.
const skinEnvelopeCache=new Map(),MAX_ENVELOPE_CACHE=64;
const STATIC=1,RAGDOLL=2,DROP=4,TISSUE=8,UP=new THREE.Vector3(0,1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>Number.isFinite(v?.x)&&Number.isFinite(v?.y)&&Number.isFinite(v?.z);
const validTissuePoints=(points,count)=>{if(!Array.isArray(points)||points.length<count)return false;for(let i=0;i<count;i++)if(!finite(points[i]))return false;return true;};
const smoothUnit=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const tissueSupportWeight=(handle,i)=>1-smoothUnit((handle.extractionProgress-(1-i/(handle.bodies.length-1))*.78)/.22);
const cv=v=>new CANNON.Vec3(v.x,v.y,v.z);
const cq=q=>new CANNON.Quaternion(q.x,q.y,q.z,q.w);
const point=new THREE.Vector3(),end=new THREE.Vector3(),direction=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
const matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),local=new THREE.Matrix4(),bodyMatrix=new THREE.Matrix4(),normal=new THREE.Vector3();

// Name order follows the actual Ash Witness export: Hips -> Spine02 ->
// Spine01 -> Spine. Never assume a conventional Spine01/Spine02 hierarchy.
const SEGMENTS=[
  ['pelvis','Hips','Spine02',null,14,.14,.42,.3],
  ['chest','Spine02','neck','pelvis',21,.16,.4,.3],
  ['head','neck','head_end','chest',4,.105,.6,.45],
  ['leftUpperArm','LeftArm','LeftForeArm','chest',2.2,.055,1.2,.7],
  ['leftForeArm','LeftForeArm','LeftHand','leftUpperArm',1.5,.047,.95,.22],
  ['leftHand','LeftHand','LeftGrip','leftForeArm',.7,.043,.5,.35],
  ['rightUpperArm','RightArm','RightForeArm','chest',2.2,.055,1.2,.7],
  ['rightForeArm','RightForeArm','RightHand','rightUpperArm',1.5,.047,.95,.22],
  ['rightHand','RightHand','RightGrip','rightForeArm',.7,.043,.5,.35],
  ['leftThigh','LeftUpLeg','LeftLeg','pelvis',6,.074,.9,.4],
  ['leftCalf','LeftLeg','LeftFoot','leftThigh',4,.065,.9,.2],
  ['leftFoot','LeftFoot','LeftToeBase','leftCalf',1.3,.055,.5,.3],
  ['rightThigh','RightUpLeg','RightLeg','pelvis',6,.074,.9,.4],
  ['rightCalf','RightLeg','RightFoot','rightThigh',4,.065,.9,.2],
  ['rightFoot','RightFoot','RightToeBase','rightCalf',1.3,.055,.5,.3],
];

// The stock cone joint chooses unrelated tangents in each body's local frame.
// Capture one shared posed world tangent so a bent imported pose starts with
// zero twist error rather than snapping toward arbitrary export bone axes.
class PosedConeConstraint extends CANNON.ConeTwistConstraint{
  constructor(a,b,options,tangentA,tangentB){super(a,b,options);this.tangentA=tangentA;this.tangentB=tangentB;}
  update(){super.update();this.bodyA.vectorToWorldFrame(this.tangentA,this.twistEquation.axisA);this.bodyB.vectorToWorldFrame(this.tangentB,this.twistEquation.axisB);}
}

function bodyFrame(body,target=bodyMatrix){return target.compose(point.set(body.position.x,body.position.y,body.position.z),rotation.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w),scale.set(1,1,1));}
function limitVector(v,max){const length=v.length();if(length>max)v.scale(max/length,v);}
function missingPart(enemy,key){
  const wound=enemy?.brutalWound,wounds=enemy?.wounds||{};
  for(const cut of enemy?.anatomy?.cuts||[]){
    const side=cut.part.startsWith('left')?'left':'right';
    if(cut.part==='head'&&key==='head'||cut.part==='torso'&&key!=='pelvis'&& !/Thigh|Calf|Foot/.test(key))return true;
    if(cut.part.endsWith('Arm')&&key.startsWith(side)&&(/Hand/.test(key)||/ForeArm/.test(key)&&cut.fraction<.6||/UpperArm/.test(key)&&cut.fraction<.08))return true;
    if(cut.part.endsWith('Leg')&&key.startsWith(side)&&(/Foot/.test(key)||/Calf/.test(key)&&cut.fraction<.6||/Thigh/.test(key)&&cut.fraction<.08))return true;
  }
  if(key==='head')return wound?.type==='twist'||!!enemy?.neckBroken||!!wounds.head&&!((enemy?.anatomy?.cuts?.filter(c=>c.part==='head').at(-1)?.fraction||0)>.15);
  if(/Arm|Hand/.test(key)){
    const side=key.startsWith('left')?'left':'right';
    return wound?.type==='chop'&&wound.side===side||wounds.arm&&wounds.armSide===side;
  }
  return false;
}
function allBones(root){const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});return bones;}
function shapeFor(node){
  if(node.skinBounds){
    const{center,half}=node.skinBounds,offset=cv(center);
    if(node.key==='head')return [[new CANNON.Sphere(Math.max(half.x,half.y,half.z)),offset]];
    // One fitted box per imported limb fits asymmetric sleeves/fingers and
    // costs one narrow-phase shape. The smooth visible skin is unchanged.
    return [[new CANNON.Box(cv(half)),offset]];
  }
  const r=node.radius,length=node.length;
  if(node.key==='head')return [[new CANNON.Sphere(Math.max(r,length*.44)),new CANNON.Vec3()]];
  if(node.key==='pelvis'||node.key==='chest')return [[new CANNON.Box(new CANNON.Vec3(r,Math.max(r*.45,length*.5),r*.72)),new CANNON.Vec3()]];
  // A capsule made from a short cylinder and two spheres. Adjacent proxies
  // never collide with one another, avoiding deep rest-pose intersections.
  const half=Math.max(0,length*.5-r*.45);
  if(half<.012)return [[new CANNON.Sphere(r),new CANNON.Vec3()]];
  return [[new CANNON.Cylinder(r,r,half*2,6),new CANNON.Vec3()],
    [new CANNON.Sphere(r),new CANNON.Vec3(0,-half,0)],[new CANNON.Sphere(r),new CANNON.Vec3(0,half,0)]];
}

export class CorpsePhysics{
  constructor({maxRagdolls=4,maxDrops=12,maxTissueChains=2,lifetime=18}={}){
    this.maxRagdolls=clamp(Math.floor(maxRagdolls),1,12);this.maxDrops=clamp(Math.floor(maxDrops),1,32);this.lifetime=lifetime;
    this.maxTissueChains=clamp(Math.floor(Number.isFinite(maxTissueChains)?maxTissueChains:2),1,CORPSE_PHYSICS_LIMITS.tissueChains);
    this.rigs=new Map();this.frozen=new Map();this.drops=new Map();this.tissueChains=new Map();this.statics=[];this.groundBodies=[];this.structureBodies=[];this.structureSupports=[];this.structureBounds=[];this.structureDiagnostics=null;this.terrainDiagnostics=null;this.supportHistory=new WeakMap();this.supportSnapshots=[];this.lastTime=null;this.accumulator=0;this.nextId=1;this.course=null;this.disposed=false;
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true,quatNormalizeSkip:0,quatNormalizeFast:false});
    // The coastal world contains thousands of static support colliders. A
    // dense pair matrix clears O(bodies²) entries on every corpse step, even
    // though only a few dynamic bodies touch them. Keep exact active pairs.
    this.world.collisionMatrix=new CANNON.ObjectCollisionMatrix();
    this.world.collisionMatrixPrevious=new CANNON.ObjectCollisionMatrix();
    this.world.broadphase=new CorpseBroadphase();this.world.solver.iterations=12;this.world.solver.tolerance=1e-7;
    // Average coplanar box contacts into one friction pair. Four support
    // points retain their normal constraints without eight redundant tangents.
    this.world.narrowphase.enableFrictionReduction=true;
    const contact=this.world.defaultContactMaterial;contact.friction=.68;contact.restitution=.035;
    contact.contactEquationStiffness=3e7;contact.contactEquationRelaxation=4;contact.frictionEquationStiffness=1e7;contact.frictionEquationRelaxation=4;
    this.steps=0;this.culledRagdolls=0;this.culledDrops=0;this.culledTissueChains=0;this.clampedFrames=0;this.terrainSweepCorrections=0;this.structureSweepCorrections=0;
  }
  has(root){return this.rigs.has(root)||this.frozen.has(root);}
  get(root){return this.rigs.get(root)||this.frozen.get(root)||null;}
  isHeld(root){return !!this.rigs.get(root)?.held;}
  rebuild(course){
    if(this.disposed)return;
    this.reset();this._buildCourseStatics(course);return this;
  }
  syncCourseWalls(course){
    if(this.disposed)return false;
    if(course!==this.course){this.rebuild(course);return true;}
    if((course?.dungeonRevision??0)===this.courseRevision&&course?.coastal?.structures===this.structureSource)return false;
    this._buildCourseStatics(course);return true;
  }
  _buildCourseStatics(course){
    for(const body of this.statics)this.world.removeBody(body);this.statics=[];this.groundBodies=[];this.structureBodies=[];this.structureSupports=[];this.structureBounds=[];this.structureDiagnostics=null;this.terrainDiagnostics=null;this.course=course;this.courseRevision=course?.dungeonRevision??0;this.structureSource=course?.coastal?.structures;
    const width=Math.max(1,course?.w||12),depth=Math.max(1,course?.h||12);
    if(course?.coastal?.terrain)this._buildTerrainGround(width*4,depth*4);
    else{
      // Flat courses retain their inexpensive infinite support plane.
      const ground=new CANNON.Body({mass:0,type:CANNON.Body.STATIC,shape:new CANNON.Plane(),collisionFilterGroup:STATIC,collisionFilterMask:RAGDOLL|DROP|TISSUE});
      ground.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(ground);this.statics.push(ground);this.groundBodies.push(ground);
    }
    this._buildStructureStatics(this.structureSource);
    const horizontal=new Map(),vertical=new Map(),skipped=new Set();
    const add=(map,line,offset)=>{
      const horizontalAxis=map===horizontal;
      if(this.structureBounds.some(b=>horizontalAxis?line>=b.minY-1e-7&&line<=b.maxY+1e-7&&offset>=b.minX-1e-7&&offset+1<=b.maxX+1e-7:line>=b.minX-1e-7&&line<=b.maxX+1e-7&&offset>=b.minY-1e-7&&offset+1<=b.maxY+1e-7)){
        skipped.add(`${horizontalAxis?'h':'v'}:${line}:${offset}`);return;
      }
      if(!map.has(line))map.set(line,new Set());map.get(line).add(offset);
    };
    for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
      const walls=course?.cells?.[z*width+x];if(!walls)continue;
      if(walls[0])add(horizontal,z,x);if(walls[2])add(horizontal,z+1,x);
      if(walls[3])add(vertical,x,z);if(walls[1])add(vertical,x+1,z);
    }
    // Even a simplified course has an explicit outer physical boundary.
    for(let x=0;x<width;x++){add(horizontal,0,x);add(horizontal,depth,x);}
    for(let z=0;z<depth;z++){add(vertical,0,z);add(vertical,width,z);}
    const halfHeight=CORPSE_PHYSICS_LIMITS.wallHeight*.5,halfThickness=CORPSE_PHYSICS_LIMITS.wallThickness*.5;
    const merge=(map,horizontalAxis)=>{for(const[line,values]of map){const sorted=[...values].sort((a,b)=>a-b);let start=sorted[0],previous=start;
      const emit=finish=>{const center=(start+finish+1)*2,length=(finish-start+1)*2;
        this._staticBox(horizontalAxis?new THREE.Vector3(center,halfHeight,line*4):new THREE.Vector3(line*4,halfHeight,center),
          horizontalAxis?new THREE.Vector3(length+.015,halfHeight,halfThickness):new THREE.Vector3(halfThickness,halfHeight,length+.015));};
      for(let i=1;i<sorted.length;i++){if(sorted[i]!==previous+1){emit(previous);start=sorted[i];}previous=sorted[i];}if(start!==undefined)emit(previous);
    }};
    merge(horizontal,true);merge(vertical,false);
    if(this.structureDiagnostics)this.structureDiagnostics.skippedCourseWallSegments=skipped.size;
  }
  groundHeightAt(x,z){return groundAt(this.course,x/4,z/4)*4;}
  _buildStructureStatics(structures){
    if(!Array.isArray(structures)||!structures.length)return;
    let rejectedSolids=0;
    for(const structure of structures){
      const bounds=structure?.bounds;
      if(!bounds||![bounds.minX,bounds.maxX,bounds.minY,bounds.maxY].every(Number.isFinite)||bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY||!Array.isArray(structure.solids))continue;
      let built=0;
      for(const solid of structure.solids){
        const values=[solid.minX,solid.maxX,solid.minY,solid.maxY,solid.minZ,solid.maxZ];
        if(!values.every(Number.isFinite)||solid.minX>=solid.maxX||solid.minY>=solid.maxY||solid.minZ>=solid.maxZ){rejectedSolids++;continue;}
        // Course X/Y are horizontal, course Z is height; Cannon/Three are
        // metre-scaled Y-up. Convert the shared finite box exactly once.
        const minX=solid.minX*4,maxX=solid.maxX*4,minZ=solid.minY*4,maxZ=solid.maxY*4,bottom=solid.minZ*4,top=solid.maxZ*4;
        const body=this._staticBox(new THREE.Vector3((minX+maxX)/2,(bottom+top)/2,(minZ+maxZ)/2),new THREE.Vector3((maxX-minX)/2,(top-bottom)/2,(maxZ-minZ)/2));
        body.userData={structureId:structure.id,solidId:solid.id,kind:solid.kind,support:!!solid.support};this.structureBodies.push(body);built++;
        if(solid.support){this.structureSupports.push({minX,maxX,minZ,maxZ,top,body});this.groundBodies.push(body);}
      }
      // A rejected/empty replacement must not remove its legacy walls.
      if(built)this.structureBounds.push({...bounds});
    }
    this.structureDiagnostics={structures:this.structureBounds.length,solids:this.structureBodies.length,supports:this.structureSupports.length,rejectedSolids,skippedCourseWallSegments:0};
  }
  _crossedStructureSupport(previous,x,z,bottom){
    let floor=-Infinity;
    for(const surface of this.structureSupports){
      // The previous *bottom*, rather than the top/centre, identifies which
      // side of a slab owned the body. Ceiling occupants cannot be lifted up.
      if(surface.top>previous.bottom+.003||bottom>=surface.top||surface.top<=floor||x<surface.minX||x>surface.maxX||z<surface.minZ||z>surface.maxZ)continue;
      const fall=previous.bottom-bottom,t=fall>1e-9?clamp((previous.bottom-surface.top)/fall,0,1):0;
      const crossX=previous.x+(x-previous.x)*t,crossZ=previous.z+(z-previous.z)*t;
      if(crossX>=surface.minX&&crossX<=surface.maxX&&crossZ>=surface.minZ&&crossZ<=surface.maxZ)floor=surface.top;
    }
    return floor;
  }
  _terrainHeightfield(x,z,width,depth,spacing,sample){
    const nx=Math.round(width/spacing),nz=Math.round(depth/spacing),data=Array.from({length:nz+1},(_,iz)=>Float64Array.from({length:nx+1},(_,ix)=>sample(x+ix*spacing,z+iz*spacing)));
    const shape=new CANNON.Heightfield(data,{elementSize:spacing});
    const body=new CANNON.Body({mass:0,type:CANNON.Body.STATIC,shape,position:new CANNON.Vec3(x,0,z),collisionFilterGroup:STATIC,collisionFilterMask:RAGDOLL|DROP|TISSUE});
    // Cannon is z-up. Local x -> world z, local y -> world x, local z ->
    // world y swaps horizontal axes without reversing either sample order.
    // Both heightfields therefore split each metre cell at u+v=1. A simple
    // -pi/2 rotation plus reversed z samples would use the wrong diagonal.
    body.quaternion.set(-.5,-.5,-.5,.5);body.userData={ground:'heightfield',spacing,x,z,width,depth};
    this.world.addBody(body);this.statics.push(body);this.groundBodies.push(body);return body;
  }
  _buildTerrainGround(width,depth){
    this._terrainHeightfield(0,0,width,depth,1,capeNaturalHeight);
    let samples=(width+1)*(depth+1),triangles=width*depth*2,bridgeCount=0;
    for(const bx of CAPE_TERRAIN.bridges){
      const z=capeStreamZ(bx),deck=capeStreamLevel(bx)+.65;
      if(bx-2.15<0||bx+2.15>width||z-11<0||z+11>depth)continue;
      // The authoritative bridge edge is abrupt at +/-2.15m. A combined
      // 1m raster would raise a false strip outside the deck over the ford.
      // Keep the precise rectangular deck and rasterize only its two short,
      // smooth approaches at 10cm spacing. Walking under bridges is unsupported.
      const bridge=this._staticBox(new THREE.Vector3(bx,deck-.12,z),new THREE.Vector3(2.15,.12,5.3));
      bridge.userData={ground:'bridge-deck',x:bx,z,width:4.3,depth:10.6};this.groundBodies.push(bridge);bridgeCount++;
      const insideHeight=(x,z)=>this.groundHeightAt(clamp(x,bx-2.15+1e-7,bx+2.15-1e-7),z);
      this._terrainHeightfield(bx-2.15,z-11,4.3,5.7,.1,insideHeight);
      this._terrainHeightfield(bx-2.15,z+5.3,4.3,5.7,.1,insideHeight);
      samples+=2*58*44;triangles+=2*57*43*2;
    }
    this.terrainDiagnostics={spacing:1,approachSpacing:.1,width,depth,samples,triangles,bridgeCount,heightfieldBodies:1+bridgeCount*2,
      naturalTriangleError:0,approachHeightTolerance:.003,sampleBytes:samples*8};
  }
  _staticBox(position,half){const body=new CANNON.Body({mass:0,type:CANNON.Body.STATIC,position:cv(position),shape:new CANNON.Box(cv(half)),collisionFilterGroup:STATIC,collisionFilterMask:RAGDOLL|DROP|TISSUE});this.world.addBody(body);this.statics.push(body);return body;}
  ensureRagdoll(root,enemy,{held=false,impulse=null,velocity=null}={}){
    if(this.disposed||!root)return null;
    const previous=this.get(root);
    if(previous){
      previous.enemy=enemy;
      if(previous.held&&!held)this._release(previous,impulse,velocity);
      // Released/frozen bodies cannot be re-held or receive duplicate impulses.
      return previous;
    }
    if(this.rigs.size>=this.maxRagdolls){
      const oldest=[...this.rigs.values()].filter(s=>!s.held).sort((a,b)=>a.born-b.born||a.id-b.id)[0];
      if(!oldest)return null;this._freeze(oldest);this.culledRagdolls++;
    }
    root.updateWorldMatrix(true,true);const bones=allBones(root),hips=root.getObjectByName('Hips'),head=root.getObjectByName('head_end')||root.getObjectByName('Head');
    if(!hips||!head||!bones.length)return null;
    hips.getWorldPosition(point);head.getWorldPosition(end);
    const size=clamp(point.distanceTo(end)*2/1.8,.35,1.6),state={id:this.nextId++,root,enemy,held:!!held,released:!held,frozen:false,born:this.lastTime??0,nodes:[],constraints:[],bindings:[],bones,original:bones.map(b=>({bone:b,position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}))};
    const byKey=new Map(),byBone=new Map();
    for(const[key,name,tip,parentKey,mass,radius,angle,twist]of SEGMENTS){
      if(missingPart(enemy,key))continue;
      const bone=root.getObjectByName(name),endBone=root.getObjectByName(tip);if(!bone||!endBone)continue;
      bone.getWorldPosition(point);endBone.getWorldPosition(end);direction.copy(end).sub(point);const length=direction.length();if(length<.012)continue;
      rotation.setFromUnitVectors(UP,direction.normalize());const center=point.clone().add(end).multiplyScalar(.5);
      const node={key,bone,endBone,parentKey,mass,radius:radius*size,length,angle,twist,motionVelocity:new CANNON.Vec3(),lastPosition:center.clone()};
      node.body=new CANNON.Body({mass:held?0:mass,type:held?CANNON.Body.KINEMATIC:CANNON.Body.DYNAMIC,position:cv(center),quaternion:cq(rotation),linearDamping:.38,angularDamping:.72,
        allowSleep:true,sleepSpeedLimit:.16,sleepTimeLimit:1.1,collisionFilterGroup:RAGDOLL,collisionFilterMask:STATIC|DROP});
      this.world.addBody(node.body);state.nodes.push(node);byKey.set(key,node);byBone.set(bone,node);
    }
    if(state.nodes.length<5){for(const node of state.nodes)this.world.removeBody(node.body);return null;}
    state.byBone=byBone;state.size=size;this._fitSkinProxies(state,byBone,size);
    for(const node of state.nodes)for(const[shape,offset]of shapeFor(node))node.body.addShape(shape,offset);
    for(const node of state.nodes){const parent=byKey.get(node.parentKey);if(!parent)continue;
      node.bone.getWorldPosition(point);const pivot=cv(point),axis=new CANNON.Vec3();node.body.vectorToWorldFrame(new CANNON.Vec3(0,1,0),axis);
      const tangent=new CANNON.Vec3();axis.tangents(tangent,new CANNON.Vec3());tangent.normalize();
      const joint=new PosedConeConstraint(parent.body,node.body,{pivotA:parent.body.pointToLocalFrame(pivot),pivotB:node.body.pointToLocalFrame(pivot),
        axisA:parent.body.vectorToLocalFrame(axis),axisB:node.body.vectorToLocalFrame(axis),angle:node.angle,twistAngle:node.twist,collideConnected:false,maxForce:12000},
        parent.body.vectorToLocalFrame(tangent),node.body.vectorToLocalFrame(tangent));
      for(const equation of joint.equations)equation.setSpookParams(6e6,4,CORPSE_PHYSICS_LIMITS.timestep);
      joint.coneEquation.setSpookParams(2e5,8,CORPSE_PHYSICS_LIMITS.timestep);joint.twistEquation.setSpookParams(2e5,8,CORPSE_PHYSICS_LIMITS.timestep);
      this.world.addConstraint(joint);state.constraints.push(joint);node.joint=joint;node.parentNode=parent;
    }
    for(const bone of bones){let owner=bone;while(owner&&!byBone.has(owner))owner=owner.parent;
      const node=byBone.get(owner);if(!node)continue;
      // Missing chains remain children of a driven parent, but their own
      // masked geometry has no disconnected physics bodies or constraints.
      const binding={bone,node,offset:new THREE.Matrix4(),localPosition:bone.position.clone(),localScale:bone.scale.clone(),worldQuaternion:new THREE.Quaternion()};state.bindings.push(binding);
    }
    this._captureOffsets(state);this.rigs.set(root,state);root.userData.corpsePhysics={id:state.id,held:state.held,frozen:false,engine:'cannon-es-0.20.0'};
    if(!held)this._initialImpulse(state,impulse,velocity);
    return state;
  }
  bindRagdoll(root,enemy,options){return this.ensureRagdoll(root,enemy,options);}
  prepare(root){
    if(!root)return 0;root.updateWorldMatrix(true,true);let prepared=0;
    root.traverse(mesh=>{const g=mesh.geometry;if(!mesh.isSkinnedMesh||!g?.attributes.skinIndex||!g.attributes.skinWeight)return;
      // Three refreshes an attached skin's bindMatrixInverse only through
      // SkinnedMesh.updateMatrixWorld, not Object3D.updateWorldMatrix. Warmup
      // runs before the first render of a normalized/rotated clone; without
      // this refresh CPU vertex sampling double-applies its wrapper transform
      // and permanently caches envelopes in the wrong source-bone frame.
      mesh.updateMatrixWorld(true);
      const key=g.userData?.corpseSourceGeometry||g.uuid;if(skinEnvelopeCache.has(key))return;
      const bounds=new Map(),frames=new Map(mesh.skeleton.bones.map(b=>[b,new THREE.Matrix4().copy(b.matrixWorld).invert()])),vertex=new THREE.Vector3(),index=g.attributes.skinIndex,weight=g.attributes.skinWeight;
      for(let i=0;i<g.attributes.position.count;i++){
        let slot=0;for(let j=1;j<4;j++)if(weight.getComponent(i,j)>weight.getComponent(i,slot))slot=j;
        const bone=mesh.skeleton.bones[index.getComponent(i,slot)];if(!bone)continue;
        if(!bounds.has(bone.name))bounds.set(bone.name,new THREE.Box3());
        mesh.getVertexPosition(i,vertex);vertex.applyMatrix4(mesh.matrixWorld).applyMatrix4(frames.get(bone));bounds.get(bone.name).expandByPoint(vertex);
      }
      const envelopes=[];for(const[name,box]of bounds){const corners=[];for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)corners.push(new THREE.Vector3(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z));envelopes.push({name,corners});}
      skinEnvelopeCache.set(key,envelopes);while(skinEnvelopeCache.size>MAX_ENVELOPE_CACHE)skinEnvelopeCache.delete(skinEnvelopeCache.keys().next().value);prepared++;
    });return prepared;
  }
  _fitSkinProxies(state,byBone,size){
    this.prepare(state.root);
    const vertex=new THREE.Vector3(),bounds=new Map(state.nodes.map(n=>[n,new THREE.Box3()]));
    const frames=new Map(state.nodes.map(n=>[n,bodyFrame(n.body,new THREE.Matrix4()).clone().invert()]));
    // Prepared source envelopes follow the current source bones, including
    // centimetre-scale exports, normalization, IK and wrist/grip deformation.
    // Per-death work maps eight corners per bone rather than scanning skins.
    state.root.traverse(mesh=>{const g=mesh.geometry;if(!mesh.isSkinnedMesh||!g?.attributes.skinIndex||!g.attributes.skinWeight)return;
      const envelopes=skinEnvelopeCache.get(g.userData?.corpseSourceGeometry||g.uuid)||[];
      for(const envelope of envelopes){const bone=mesh.skeleton.bones.find(b=>b.name===envelope.name);if(!bone)continue;
        let owner=bone,masked=false;
        while(owner&&!byBone.has(owner)){
          if(owner.name==='neck'&&missingPart(state.enemy,'head')||owner.name==='LeftArm'&&missingPart(state.enemy,'leftUpperArm')||owner.name==='RightArm'&&missingPart(state.enemy,'rightUpperArm')){masked=true;break;}
          owner=owner.parent;
        }
        const node=byBone.get(owner);if(masked||!node)continue;
        for(const corner of envelope.corners){vertex.copy(corner).applyMatrix4(bone.matrixWorld).applyMatrix4(frames.get(node));
          // Reject inconsistent/outlier skin attribution rather than letting
          // a stray export weight create a metre-wide collider.
          if(Math.abs(vertex.x)>.35*size||Math.abs(vertex.z)>.35*size||Math.abs(vertex.y)>node.length*.5+.3*size)continue;
          bounds.get(node).expandByPoint(vertex);
        }
      }
    });
    for(const node of state.nodes){const fit=bounds.get(node);if(fit.isEmpty())continue;
      const center=fit.getCenter(new THREE.Vector3()),half=fit.getSize(new THREE.Vector3()).multiplyScalar(.5).addScalar(.008);
      half.x=Math.max(.025,half.x);half.y=Math.max(.025,half.y);half.z=Math.max(.025,half.z);node.skinBounds={center,half};
    }
  }
  _captureOffsets(state){for(const binding of state.bindings){binding.bone.updateWorldMatrix(true,false);inverse.copy(bodyFrame(binding.node.body)).invert();binding.offset.multiplyMatrices(inverse,binding.bone.matrixWorld);binding.localPosition.copy(binding.bone.position);binding.localScale.copy(binding.bone.scale);}}
  _captureHeld(state,dt){
    state.root.updateWorldMatrix(true,true);
    for(const node of state.nodes){node.bone.getWorldPosition(point);node.endBone.getWorldPosition(end);direction.copy(end).sub(point);rotation.setFromUnitVectors(UP,direction.normalize());point.add(end).multiplyScalar(.5);
      if(dt>0){node.motionVelocity.set((point.x-node.lastPosition.x)/dt,(point.y-node.lastPosition.y)/dt,(point.z-node.lastPosition.z)/dt);limitVector(node.motionVelocity,4);}
      node.lastPosition.copy(point);node.body.position.copy(cv(point));node.body.quaternion.copy(cq(rotation));node.body.velocity.set(0,0,0);node.body.angularVelocity.set(0,0,0);node.body.aabbNeedsUpdate=true;
    }
    this._captureOffsets(state);
  }
  _initialImpulse(state,impulse,velocity){
    for(const node of state.nodes){if(finite(velocity))node.body.velocity.copy(cv(velocity));else if(state.released)node.body.velocity.copy(node.motionVelocity);limitVector(node.body.velocity,CORPSE_PHYSICS_LIMITS.maxVelocity);}
    const chest=state.nodes.find(n=>n.key==='chest')||state.nodes[0];
    if(finite(impulse))chest.body.applyImpulse(cv(impulse));
    else{
      // Symmetric upright corpses otherwise balance unnaturally. A small,
      // seeded release impulse creates a physical fall without teleporting.
      const seed=Number(state.enemy?.id)||state.id,axis=new CANNON.Vec3(Math.sin(seed*2.399)*1.7,.25,Math.cos(seed*2.399)*1.7);
      chest.body.applyImpulse(axis,new CANNON.Vec3(.03,.12,0));
    }
    for(const node of state.nodes)node.body.wakeUp();
  }
  _release(state,impulse,velocity){
    this._captureHeld(state,0);state.held=false;state.released=true;state.born=this.lastTime??state.born;
    // The authored hold can materially change the contact-time cloth, wrist
    // and spine frames. Fit the current release pose once from prepared local
    // envelopes; keeping the original shape offsets lets the final skin hang
    // outside colliders even when the rigid bodies themselves are grounded.
    this._fitSkinProxies(state,state.byBone,state.size);
    for(const node of state.nodes){for(const shape of [...node.body.shapes])node.body.removeShape(shape);for(const[shape,offset]of shapeFor(node))node.body.addShape(shape,offset);node.body.aabbNeedsUpdate=true;}
    // Authored hold/IK can change the spine's aggregate chord or arm pose.
    // Rebase every physical joint at the final visible pose before release.
    for(const node of state.nodes){const joint=node.joint;if(!joint)continue;node.bone.getWorldPosition(point);const pivot=cv(point),axis=new CANNON.Vec3(),tangent=new CANNON.Vec3();
      node.body.vectorToWorldFrame(new CANNON.Vec3(0,1,0),axis);axis.tangents(tangent,new CANNON.Vec3());tangent.normalize();
      node.parentNode.body.pointToLocalFrame(pivot,joint.pivotA);node.body.pointToLocalFrame(pivot,joint.pivotB);
      node.parentNode.body.vectorToLocalFrame(axis,joint.axisA);node.body.vectorToLocalFrame(axis,joint.axisB);
      node.parentNode.body.vectorToLocalFrame(tangent,joint.tangentA);node.body.vectorToLocalFrame(tangent,joint.tangentB);
    }
    for(const node of state.nodes){node.body.type=CANNON.Body.DYNAMIC;node.body.mass=node.mass;node.body.updateMassProperties();}
    state.root.userData.corpsePhysics.held=false;this._initialImpulse(state,impulse,velocity);
  }
  _syncRig(state){
    if(state.held)return;
    state.root.updateWorldMatrix(true,true);
    for(const binding of state.bindings){
      const bone=binding.bone;matrix.multiplyMatrices(bodyFrame(binding.node.body),binding.offset);matrix.decompose(point,binding.worldQuaternion,scale);
      // A constrained solver has a small finite joint-position tolerance.
      // Translate only Hips; all other source translations stay exact, then
      // solve their world orientations into the actual parent local frame.
      if(bone.name==='Hips'){
        inverse.copy(bone.parent.matrixWorld).invert();point.applyMatrix4(inverse);bone.position.copy(point);
      }else bone.position.copy(binding.localPosition);
      // Parent matrices are current: bindings follow hierarchy traversal order.
      // getWorldQuaternion would update the entire ancestor chain per bone.
      bone.parent.matrixWorld.decompose(end,rotation,scale);rotation.invert();bone.quaternion.copy(rotation).multiply(binding.worldQuaternion).normalize();bone.scale.copy(binding.localScale);
      bone.updateMatrix();bone.updateWorldMatrix(false,false);
    }
    state.root.updateWorldMatrix(true,true);
    state.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  }
  _freeze(state){
    this._syncRig(state);for(const constraint of state.constraints)this.world.removeConstraint(constraint);for(const node of state.nodes)this.world.removeBody(node.body);
    state.frozen=true;state.held=false;state.frozenPose=state.bones.map(b=>({bone:b,position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}));
    this.rigs.delete(state.root);this.frozen.set(state.root,state);state.root.userData.corpsePhysics={id:state.id,held:false,frozen:true,engine:'cannon-es-0.20.0'};
  }
  addDrop(mesh,{velocity=null,angularVelocity=null,radius=.06,mass=.6,lifetime=8}={}){
    if(this.disposed||!mesh)return null;
    for(const handle of this.drops.values())if(handle.mesh===mesh)return handle;
    if(this.drops.size>=this.maxDrops){this.removeDrop(this.drops.values().next().value);this.culledDrops++;}
    mesh.updateWorldMatrix(true,true);inverse.copy(mesh.matrixWorld).invert();const bounds=new THREE.Box3();const vertex=new THREE.Vector3(),toLocal=new THREE.Matrix4(),instanceLocal=new THREE.Matrix4(),instanceMatrix=new THREE.Matrix4();
    mesh.traverse(o=>{const positions=o.geometry?.attributes?.position;if(!positions)return;toLocal.multiplyMatrices(inverse,o.matrixWorld);
      const instances=o.isInstancedMesh?o.count:1;
      for(let instance=0;instance<instances;instance++){
        if(o.isInstancedMesh){o.getMatrixAt(instance,instanceMatrix);instanceLocal.multiplyMatrices(toLocal,instanceMatrix);}else instanceLocal.copy(toLocal);
        for(let i=0;i<positions.count;i++){if(o.getVertexPosition)o.getVertexPosition(i,vertex);else vertex.fromBufferAttribute(positions,i);vertex.applyMatrix4(instanceLocal);bounds.expandByPoint(vertex);}
      }
    });
    if(bounds.isEmpty())bounds.set(new THREE.Vector3(-radius,-radius,-radius),new THREE.Vector3(radius,radius,radius));
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());mesh.matrixWorld.decompose(point,rotation,scale);
    const worldScale=scale.clone(),worldCenter=center.clone().applyMatrix4(mesh.matrixWorld),half=new CANNON.Vec3(Math.max(.015,size.x*Math.abs(scale.x)*.5),Math.max(.015,size.y*Math.abs(scale.y)*.5),Math.max(.015,size.z*Math.abs(scale.z)*.5));
    const body=new CANNON.Body({mass:clamp(mass,.03,12),shape:new CANNON.Box(half),position:cv(worldCenter),quaternion:cq(rotation),linearDamping:.18,angularDamping:.38,
      allowSleep:true,sleepSpeedLimit:.12,sleepTimeLimit:.8,collisionFilterGroup:DROP,collisionFilterMask:STATIC|RAGDOLL|DROP});
    if(finite(velocity))body.velocity.copy(cv(velocity));if(finite(angularVelocity))body.angularVelocity.copy(cv(angularVelocity));limitVector(body.velocity,CORPSE_PHYSICS_LIMITS.maxVelocity);limitVector(body.angularVelocity,CORPSE_PHYSICS_LIMITS.maxAngularVelocity);
    const handle={id:this.nextId++,mesh,body,centerLocal:center,worldScale,born:this.lastTime??0,lifetime,removed:false};this.world.addBody(body);this.drops.set(handle.id,handle);return handle;
  }
  addTissueChain(points,{radius=.014,mass=.035,maxChains=this.maxTissueChains,supportPoints=null,extractionProgress=0}={}){
    if(this.disposed||!Array.isArray(points)||points.length<2)return null;
    const positions=points.slice(0,CORPSE_PHYSICS_LIMITS.tissuePoints);if(!positions.every(finite))return null;
    if(supportPoints!==null&&!validTissuePoints(supportPoints,positions.length))return null;
    radius=clamp(Number.isFinite(radius)?radius:.014,.008,.03);mass=clamp(Number.isFinite(mass)?mass:.035,.01,.1);
    const budget=clamp(Math.floor(Number.isFinite(maxChains)?maxChains:this.maxTissueChains),1,this.maxTissueChains);
    while(this.tissueChains.size>=budget){this.removeTissueChain(this.tissueChains.values().next().value);this.culledTissueChains++;}
    const handle={id:this.nextId++,bodies:[],constraints:[],lengths:[],totalLength:0,radius,mass,anchor:new THREE.Vector3().copy(positions[0]),pull:null,pullCompliance:false,
      points:positions.map(p=>new THREE.Vector3().copy(p)),supportPoints:supportPoints?positions.map((_,i)=>new THREE.Vector3().copy(supportPoints[i])):null,
      extractionProgress:clamp(Number.isFinite(extractionProgress)?extractionProgress:0,0,1),born:this.lastTime??0,removed:false};
    for(let i=0;i<positions.length;i++){
      // A small distance-linked particle chain permits bending in every axis.
      // Static-only masks let folded bowel start inside the torso without
      // fighting its enclosing ragdoll or its own close packed loops.
      const body=new CANNON.Body({mass:i?mass:0,type:i?CANNON.Body.DYNAMIC:CANNON.Body.KINEMATIC,position:cv(positions[i]),shape:new CANNON.Sphere(radius),
        fixedRotation:true,linearDamping:.38,angularDamping:1,allowSleep:!!i,sleepSpeedLimit:.065,sleepTimeLimit:1,
        collisionFilterGroup:TISSUE,collisionFilterMask:STATIC});
      this.world.addBody(body);handle.bodies.push(body);
      if(i){const length=body.position.distanceTo(handle.bodies[i-1].position),joint=new CANNON.DistanceConstraint(handle.bodies[i-1],body,length,120);
        joint.collideConnected=false;joint.distanceEquation.setSpookParams(1e6,4,CORPSE_PHYSICS_LIMITS.timestep);
        this.world.addConstraint(joint);handle.constraints.push(joint);handle.lengths.push(length);handle.totalLength+=length;
      }
    }
    this.tissueChains.set(handle.id,handle);return handle;
  }
  setTissueChain(handle,{anchor=null,pull=null,supportPoints=undefined,extractionProgress=undefined,pullCompliance=undefined}={}){
    if(this.disposed||!handle||handle.removed||this.tissueChains.get(handle.id)!==handle||anchor!==null&&!finite(anchor)||pull!==null&&!finite(pull))return false;
    if(supportPoints!==undefined&&supportPoints!==null&&!validTissuePoints(supportPoints,handle.bodies.length))return false;
    if(extractionProgress!==undefined&&!Number.isFinite(extractionProgress))return false;
    if(pullCompliance!==undefined&&typeof pullCompliance!=='boolean')return false;
    const first=handle.bodies[0],last=handle.bodies[handle.bodies.length-1];let moved=false;
    if(pullCompliance!==undefined){moved=pullCompliance!==handle.pullCompliance;handle.pullCompliance=pullCompliance;}
    if(anchor){moved=moved||handle.anchor.distanceToSquared(anchor)>1e-10;handle.anchor.copy(anchor);first.position.set(anchor.x,anchor.y,anchor.z);first.velocity.set(0,0,0);first.aabbNeedsUpdate=true;}
    if(pull){
      moved=moved||!handle.pull||handle.pull.distanceToSquared(pull)>1e-10;
      if(!handle.pull)handle.pull=new THREE.Vector3();handle.pull.copy(pull);
      // Hands can move farther than the material's full contour length. The
      // physical endpoint stops at full extension rather than overconstraining
      // two scripted endpoints and injecting an unbounded solver impulse.
      direction.copy(handle.pull).sub(handle.anchor);const distance=direction.length();
      if(distance>handle.totalLength*.98)handle.pull.copy(handle.anchor).addScaledVector(direction,handle.totalLength*.98/distance);
      const type=handle.pullCompliance?CANNON.Body.DYNAMIC:CANNON.Body.KINEMATIC;
      if(last.type!==type){last.type=type;last.mass=handle.pullCompliance?handle.mass:0;last.updateMassProperties();last.wakeUp();}
      // The compliant guide is an intent for the next fixed tick. Updating it
      // after physics cannot stretch the last rendered link by teleporting it.
      if(!handle.pullCompliance){last.position.set(handle.pull.x,handle.pull.y,handle.pull.z);last.velocity.set(0,0,0);last.aabbNeedsUpdate=true;}
    }else if(handle.pull){
      handle.pull=null;last.type=CANNON.Body.DYNAMIC;last.mass=handle.mass;last.updateMassProperties();last.wakeUp();moved=true;
    }
    if(supportPoints===null){moved=moved||!!handle.supportPoints;handle.supportPoints=null;}
    else if(supportPoints){
      if(!handle.supportPoints)handle.supportPoints=handle.bodies.map(()=>new THREE.Vector3());
      for(let i=0;i<handle.bodies.length;i++){moved=moved||handle.supportPoints[i].distanceToSquared(supportPoints[i])>1e-10;handle.supportPoints[i].copy(supportPoints[i]);}
    }
    if(extractionProgress!==undefined){const next=clamp(extractionProgress,0,1);moved=moved||Math.abs(next-handle.extractionProgress)>1e-5;handle.extractionProgress=next;}
    if(moved)for(const body of handle.bodies)if(body.type===CANNON.Body.DYNAMIC)body.wakeUp();return true;
  }
  tissueChainPoints(handle,targetArray=null){
    if(!handle||handle.removed||this.tissueChains.get(handle.id)!==handle)return null;
    const output=targetArray||handle.points;output.length=handle.bodies.length;
    for(let i=0;i<handle.bodies.length;i++){const body=handle.bodies[i];if(!output[i]?.isVector3)output[i]=new THREE.Vector3();output[i].set(body.position.x,body.position.y,body.position.z);}return output;
  }
  removeTissueChain(handle){
    if(!handle||handle.removed||this.tissueChains.get(handle.id)!==handle)return false;
    for(const constraint of handle.constraints)this.world.removeConstraint(constraint);for(const body of handle.bodies)this.world.removeBody(body);
    this.tissueChains.delete(handle.id);handle.removed=true;return true;
  }
  _supportTissueChain(handle){
    const rest=handle.supportPoints;if(!rest)return;
    const bodies=handle.bodies,stiffness=18*18,damping=26;
    for(let i=1;i<bodies.length;i++){
      const body=bodies[i];if(body.type!==CANNON.Body.DYNAMIC)continue;
      const weight=tissueSupportWeight(handle,i);if(weight<=0)continue;
      // Distributed mesentery support retains the authored packed coil. The
      // damped spring follows the torso through forces, allowing compliant
      // lag and wobble; gravity support represents attachment inside the body.
      body.force.x+=handle.mass*weight*((rest[i].x-body.position.x)*stiffness-body.velocity.x*damping-this.world.gravity.x);
      body.force.y+=handle.mass*weight*((rest[i].y-body.position.y)*stiffness-body.velocity.y*damping-this.world.gravity.y);
      body.force.z+=handle.mass*weight*((rest[i].z-body.position.z)*stiffness-body.velocity.z*damping-this.world.gravity.z);
    }
    // Weak curvature springs spread a sharp hinge across neighboring nodes.
    // As mesentery separates, the residual curl becomes softer and the bowel
    // can uncoil under traction instead of behaving like a rigid lattice.
    for(let i=1;i<bodies.length-1;i++){
      const a=bodies[i-1],b=bodies[i],c=bodies[i+1],weight=tissueSupportWeight(handle,i),retain=.12+.88*weight,
        dx=a.position.x-2*b.position.x+c.position.x-(rest[i-1].x-2*rest[i].x+rest[i+1].x)*retain,
        dy=a.position.y-2*b.position.y+c.position.y-(rest[i-1].y-2*rest[i].y+rest[i+1].y)*retain,
        dz=a.position.z-2*b.position.z+c.position.z-(rest[i-1].z-2*rest[i].z+rest[i+1].z)*retain,
        bend=handle.mass*24;
      if(b.type===CANNON.Body.DYNAMIC){b.force.x+=dx*bend*2;b.force.y+=dy*bend*2;b.force.z+=dz*bend*2;}
      if(a.type===CANNON.Body.DYNAMIC){a.force.x-=dx*bend;a.force.y-=dy*bend;a.force.z-=dz*bend;}
      if(c.type===CANNON.Body.DYNAMIC){c.force.x-=dx*bend;c.force.y-=dy*bend;c.force.z-=dz*bend;}
    }
  }
  _pullTissueChain(handle){
    if(!handle.pull||!handle.pullCompliance)return;
    const body=handle.bodies[handle.bodies.length-1],target=handle.pull;
    // A soft hand guide transmits traction through the distance chain. It can
    // lag and sag under gravity rather than creating a rigid upright branch.
    const stiffness=10*10,damping=14;
    body.force.x+=handle.mass*((target.x-body.position.x)*stiffness-body.velocity.x*damping);
    body.force.y+=handle.mass*((target.y-body.position.y)*stiffness-body.velocity.y*damping);
    body.force.z+=handle.mass*((target.z-body.position.z)*stiffness-body.velocity.z*damping);
  }
  _boundTissueChain(handle){
    // A long, light chain converges more slowly than the corpse's short heavy
    // joints. This extension guard bounds its finite solver compliance while
    // Cannon continues to resolve forces, sag, sleeping and static contacts.
    const bodies=handle.bodies,lengths=handle.lengths;
    const bound=i=>{const a=bodies[i],b=bodies[i+1],dx=b.position.x-a.position.x,dy=b.position.y-a.position.y,dz=b.position.z-a.position.z,
      distance=Math.sqrt(dx*dx+dy*dy+dz*dz),maximum=lengths[i]*1.035;
      if(distance<=maximum||distance<1e-9)return;
      const wa=handle.pull&&!handle.pullCompliance&&a.type===CANNON.Body.DYNAMIC?1:0,wb=b.type===CANNON.Body.DYNAMIC?1:0;if(!wa&&!wb)return;
      const correction=(1-maximum/distance)/(wa+wb);
      if(wa){a.position.x+=dx*correction;a.position.y+=dy*correction;a.position.z+=dz*correction;a.aabbNeedsUpdate=true;}
      if(wb){b.position.x-=dx*correction;b.position.y-=dy*correction;b.position.z-=dz*correction;b.aabbNeedsUpdate=true;}
      const separation=(dx*(b.velocity.x-a.velocity.x)+dy*(b.velocity.y-a.velocity.y)+dz*(b.velocity.z-a.velocity.z))/(distance*distance*(wa+wb));
      if(separation>0){if(wa){a.velocity.x+=dx*separation;a.velocity.y+=dy*separation;a.velocity.z+=dz*separation;}
        if(wb){b.velocity.x-=dx*separation;b.velocity.y-=dy*separation;b.velocity.z-=dz*separation;}}
    };
    for(let pass=0;pass<8;pass++){for(let i=0;i<lengths.length;i++)bound(i);for(let i=lengths.length-1;i>=0;i--)bound(i);}
    for(const body of bodies){
      limitVector(body.velocity,CORPSE_PHYSICS_LIMITS.maxTissueVelocity);
      // A constraint correction may pull a tiny sphere through its support.
      // Preserve terrain fallback, but accept an indoor top only from the
      // particle's previous side and actual swept crossing of that floor piece.
      const previous=this.supportHistory.get(body),bottom=body.position.y-handle.radius*.9;
      const structureFloor=previous?this._crossedStructureSupport(previous,body.position.x,body.position.z,bottom):-Infinity;
      const floor=Math.max(this.groundHeightAt(body.position.x,body.position.z),structureFloor)+handle.radius*.9;
      if(body.type===CANNON.Body.DYNAMIC&&this.statics.length&&body.position.y<floor){body.position.y=floor;if(body.velocity.y<0)body.velocity.y=0;body.aabbNeedsUpdate=true;}
    }
  }
  removeDrop(handle){if(!handle||handle.removed)return false;this._syncDrop(handle);this.world.removeBody(handle.body);this.drops.delete(handle.id);handle.removed=true;return true;}
  _captureTerrainSupport(){
    const previous=this.supportSnapshots;previous.length=0;
    if(!this.terrainDiagnostics&&!this.structureSupports.length)return null;
    for(const body of this.world.bodies){
      if(body.type!==CANNON.Body.DYNAMIC||body.sleepState===CANNON.Body.SLEEPING&&body.collisionFilterGroup!==TISSUE||body.collisionFilterGroup===TISSUE&&!this.structureSupports.length)continue;
      body.updateAABB();
      let snapshot=this.supportHistory.get(body);
      if(!snapshot){snapshot={body};this.supportHistory.set(body,snapshot);}
      snapshot.x=body.position.x;snapshot.z=body.position.z;snapshot.bottom=body.aabb.lowerBound.y;snapshot.top=body.aabb.upperBound.y;
      snapshot.terrain=body.collisionFilterGroup!==TISSUE&&!!this.terrainDiagnostics&&snapshot.top>=this.groundHeightAt(snapshot.x,snapshot.z)-.001;previous.push(snapshot);
    }
    return previous;
  }
  _sweepTerrainSupport(previous){
    if(!previous)return;
    for(const snapshot of previous){
      const body=snapshot.body;if(body.sleepState===CANNON.Body.SLEEPING)continue;
      body.updateAABB();const terrainFloor=snapshot.terrain?this.groundHeightAt(body.position.x,body.position.z):-Infinity;
      const structureFloor=this._crossedStructureSupport(snapshot,body.position.x,body.position.z,body.aabb.lowerBound.y);
      const floor=Math.max(body.aabb.upperBound.y<terrainFloor-.001?terrainFloor:-Infinity,body.aabb.upperBound.y<structureFloor-.001?structureFloor:-Infinity);
      // Cannon's heightfield contact uses triangle top faces. A thin proxy can
      // cross entirely below one between 60Hz steps (8m/s moves 13cm). Only
      // repair that complete swept crossing, not normal resting penetration.
      // Subsequent native contacts retain slope friction and joint ownership.
      if(!Number.isFinite(floor))continue;
      body.position.y+=floor-body.aabb.lowerBound.y+.001;
      if(body.velocity.y<0)body.velocity.y=0;body.aabbNeedsUpdate=true;
      if(floor===structureFloor)this.structureSweepCorrections++;else this.terrainSweepCorrections++;
    }
  }
  removeRagdoll(root,{restore=true}={}){
    const state=this.get(root);if(!state)return false;
    if(!state.frozen){for(const constraint of state.constraints)this.world.removeConstraint(constraint);for(const node of state.nodes)this.world.removeBody(node.body);}
    this.rigs.delete(root);this.frozen.delete(root);delete root.userData.corpsePhysics;
    if(restore)for(const pose of state.original){pose.bone.position.copy(pose.position);pose.bone.quaternion.copy(pose.quaternion);pose.bone.scale.copy(pose.scale);pose.bone.updateMatrix();}
    root.updateWorldMatrix(true,true);return true;
  }
  update(run){
    if(this.disposed)return;
    const time=Number(run?.time);if(!Number.isFinite(time))return;
    if(this.lastTime===null){this.lastTime=time;for(const state of this.rigs.values())state.born=time;for(const handle of this.drops.values())handle.born=time;return;}
    // Peer snapshots can correct their predicted player clock backward. This
    // cosmetic clock waits for it to catch up; restart/course ownership calls
    // reset or rebuild explicitly, rather than undoing a guest's corpse pose.
    if(time<this.lastTime-1e-6)return;
    const elapsed=time-this.lastTime;this.lastTime=time;if(elapsed<=0||run?.mode==='pause'||run?.mode==='paused')return;
    const dt=Math.min(.12,elapsed);if(elapsed>.12)this.clampedFrames++;
    // An exploration frame has only static walls in this cosmetic world.
    // Advance the clock without doing 60Hz broadphase/solver work or banking
    // an idle backlog for the next corpse/drop to inherit.
    if(!this.rigs.size&&!this.drops.size&&!this.tissueChains.size){this.accumulator=0;return;}
    for(const state of this.rigs.values())if(state.held)this._captureHeld(state,dt);
    this.accumulator+=dt;const step=CORPSE_PHYSICS_LIMITS.timestep;
    while(this.accumulator+1e-10>=step){
      for(const state of this.rigs.values())for(const node of state.nodes){limitVector(node.body.velocity,CORPSE_PHYSICS_LIMITS.maxVelocity);limitVector(node.body.angularVelocity,CORPSE_PHYSICS_LIMITS.maxAngularVelocity);}
      for(const handle of this.drops.values()){limitVector(handle.body.velocity,CORPSE_PHYSICS_LIMITS.maxVelocity);limitVector(handle.body.angularVelocity,CORPSE_PHYSICS_LIMITS.maxAngularVelocity);}
      for(const handle of this.tissueChains.values()){
        this._supportTissueChain(handle);this._pullTissueChain(handle);for(const body of handle.bodies){
          if(body.type===CANNON.Body.DYNAMIC)limitVector(body.force,handle.mass*CORPSE_PHYSICS_LIMITS.maxTissueSupportAcceleration);
          limitVector(body.velocity,CORPSE_PHYSICS_LIMITS.maxTissueVelocity);body.angularVelocity.set(0,0,0);
        }
      }
      const terrainSupport=this._captureTerrainSupport();
      this.world.step(step);this._sweepTerrainSupport(terrainSupport);this.accumulator=Math.max(0,this.accumulator-step);this.steps++;
      for(const handle of this.tissueChains.values())this._boundTissueChain(handle);
    }
    for(const state of [...this.rigs.values()])if(!state.held&&time-state.born>this.lifetime)this._freeze(state);
    for(const handle of [...this.drops.values()])if(time-handle.born>handle.lifetime)this.removeDrop(handle);
  }
  sync(){
    if(this.disposed)return;
    for(const state of this.rigs.values())this._syncRig(state);
    for(const state of this.frozen.values()){for(const pose of state.frozenPose){pose.bone.position.copy(pose.position);pose.bone.quaternion.copy(pose.quaternion);pose.bone.scale.copy(pose.scale);pose.bone.updateMatrix();}state.root.updateWorldMatrix(true,true);}
    for(const handle of this.drops.values())this._syncDrop(handle);
  }
  _syncDrop(handle){
    bodyFrame(handle.body);normal.copy(handle.centerLocal).multiply(handle.worldScale).negate().applyQuaternion(rotation);point.add(normal);
    matrix.compose(point,rotation,handle.worldScale);if(handle.mesh.parent){handle.mesh.parent.updateWorldMatrix(true,false);inverse.copy(handle.mesh.parent.matrixWorld).invert();local.multiplyMatrices(inverse,matrix);}else local.copy(matrix);
    local.decompose(handle.mesh.position,handle.mesh.quaternion,handle.mesh.scale);handle.mesh.updateMatrix();handle.mesh.updateWorldMatrix(false,true);
  }
  reset(){
    for(const handle of [...this.tissueChains.values()])this.removeTissueChain(handle);for(const handle of [...this.drops.values()])this.removeDrop(handle);for(const root of [...this.rigs.keys(),...this.frozen.keys()])this.removeRagdoll(root);
    this.lastTime=null;this.accumulator=0;this.world.time=0;this.world.stepnumber=0;this.world.accumulator=0;this.steps=0;this.culledRagdolls=0;this.culledDrops=0;this.culledTissueChains=0;this.clampedFrames=0;this.terrainSweepCorrections=0;this.structureSweepCorrections=0;this.supportSnapshots.length=0;this.supportHistory=new WeakMap();
  }
  dispose(){if(this.disposed)return;this.reset();for(const body of this.statics)this.world.removeBody(body);this.statics=[];this.groundBodies=[];this.structureBodies=[];this.structureSupports=[];this.structureBounds=[];this.structureDiagnostics=null;this.structureSource=null;this.terrainDiagnostics=null;this.course=null;this.disposed=true;}
  diagnostics(){return{engine:'cannon-es-0.20.0',timestep:CORPSE_PHYSICS_LIMITS.timestep,ragdolls:this.rigs.size,frozen:this.frozen.size,held:[...this.rigs.values()].filter(s=>s.held).length,drops:this.drops.size,
    tissueChains:this.tissueChains.size,tissueBodies:[...this.tissueChains.values()].reduce((n,h)=>n+h.bodies.length,0),tissueConstraints:[...this.tissueChains.values()].reduce((n,h)=>n+h.constraints.length,0),maxTissueChains:this.maxTissueChains,culledTissueChains:this.culledTissueChains,
    tissueSupportedParticles:[...this.tissueChains.values()].reduce((n,h)=>n+(h.supportPoints?h.bodies.filter((b,i)=>i>0&&b.type===CANNON.Body.DYNAMIC&&tissueSupportWeight(h,i)>0).length:0),0),maxTissueSupportAcceleration:CORPSE_PHYSICS_LIMITS.maxTissueSupportAcceleration,
    tissueCompliantGuides:[...this.tissueChains.values()].filter(h=>h.pull&&h.pullCompliance).length,
    bodies:this.world.bodies.length,dynamicBodies:this.world.bodies.filter(b=>b.type===CANNON.Body.DYNAMIC).length,constraints:this.world.constraints.length,staticColliders:this.statics.length,sleeping:this.world.bodies.filter(b=>b.sleepState===CANNON.Body.SLEEPING).length,
    terrain:this.terrainDiagnostics?{...this.terrainDiagnostics}:null,structure:this.structureDiagnostics?{...this.structureDiagnostics}:null,groundColliders:this.groundBodies.length,terrainSweepCorrections:this.terrainSweepCorrections,structureSweepCorrections:this.structureSweepCorrections,
    steps:this.steps,maxRagdolls:this.maxRagdolls,maxDrops:this.maxDrops,culledRagdolls:this.culledRagdolls,culledDrops:this.culledDrops,clampedFrames:this.clampedFrames,preparedSkinGeometries:skinEnvelopeCache.size,solverIterations:this.world.solver.iterations,frictionReduction:this.world.narrowphase.enableFrictionReduction,ccd:this.structureSupports.length?'60 Hz native contacts plus previous-side terrain/structure swept support; 8 m/s speed clamp; no general CCD':this.terrainDiagnostics?'60 Hz native contacts plus terrain-only swept support; 8 m/s speed clamp; no general CCD':'60 Hz fixed steps, 8 m/s speed clamp; no full CCD',collisionScope:(this.terrainDiagnostics?'1m cape terrain, exact bridge decks, 0.1m approaches and course wall segments; cosmetic bodies only; no under-bridge traversal':'flat floor and course wall segments; cosmetic bodies only')+(this.structureBodies.length?'; shared finite coastal structure slabs, stairs, furniture, walls and rails':'')};}
}
