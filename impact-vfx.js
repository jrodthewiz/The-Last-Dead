import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {createBloodSurfaceMaterial} from './blood-surface.js';
import {BloodDeposits} from './blood-deposits.js';
import {castRay} from './engine.js';
const MAX_MARKS=96,MAX_SMOKE=96,MAX_SPLASH=32,MAX_WOUNDS=32,MAX_SPLASH_DROPS=160;
const DROP_COLORS=Object.freeze([0x43080b,0x6f0d12,0x8c1718,0x350609]);
const vertex=`attribute float life; attribute float seed; attribute float wet; attribute float stretch; varying vec2 vUv; varying float vLife; varying float vSeed; varying float vWet; varying float vStretch; void main(){vUv=uv;vLife=life;vSeed=seed;vWet=wet;vStretch=stretch;vec2 local=uv*2.-1.;float dome=(1.-smoothstep(.06,.9,length(local)))*vWet*(.012+.008*(.5+.5*sin(vSeed*19.7)));vec3 displaced=position;displaced.z+=dome;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(displaced,1.);}`;
const markFragment=`varying vec2 vUv;varying float vLife;void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x);float edge=.77+.08*sin(a*9.)+.045*sin(a*17.);float chip=1.-smoothstep(edge-.13,edge,r);float hole=1.-smoothstep(.12,.27,r);float ridge=smoothstep(.2,.3,r)*(1.-smoothstep(.31,.43,r));vec3 color=mix(vec3(.038,.024,.023),vec3(.22,.15,.10),ridge*.6);gl_FragColor=vec4(color,(chip*.67+hole*.28)*vLife);}`;
const smokeFragment=`varying vec2 vUv;varying float vLife;void main(){vec2 p=vUv*2.-1.;float n=sin(p.x*12.+sin(p.y*8.))*sin(p.y*11.+sin(p.x*5.));float shape=1.-smoothstep(.22,.98,length(p)+n*.09);float alpha=shape*vLife*.21;if(alpha<.002)discard;gl_FragColor=vec4(vec3(.32,.27,.24),alpha);}`;
// Brief directional fluid sheets share the same lit atlas as floor residue.
const bloodFragment=null;
function poolMesh(count,name,fragment,{impact=false}={}){
 const geometry=new THREE.PlaneGeometry(1,1);
 for(const key of ['life','seed','wet','stretch'])geometry.setAttribute(key,new THREE.InstancedBufferAttribute(new Float32Array(count),1));
 const isBlood=fragment===null;
 if(isBlood)geometry.setAttribute('bloodState',new THREE.InstancedBufferAttribute(new Float32Array(count*2),2));
 const material=isBlood?createBloodSurfaceMaterial({instanced:true,impact}):new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 if(isBlood){
  const baseCompile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   baseCompile(shader);
   shader.vertexShader='attribute float life; attribute float stretch; varying float vBloodLife;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBloodLife=life; transformed.y*=1.+stretch*.22;');
   shader.fragmentShader='varying float vBloodLife;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=vBloodLife;\n#include <alphatest_fragment>');
  };
   material.customProgramCacheKey=()=> `blood-impact-atlas-v3-${impact?'impact':'residue'}`;
 }
 const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=count;return mesh;
}
export class ImpactVFX{
 constructor(parent){this.root=new THREE.Group();this.root.name='SurfaceImpactFX';parent.add(this.root);this.marks=poolMesh(MAX_MARKS,'BallisticScars',markFragment);this.smoke=poolMesh(MAX_SMOKE,'ImpactDust',smokeFragment);this.splashes=poolMesh(MAX_SPLASH,'FleshImpactSplashes',bloodFragment,{impact:true});this.wounds=poolMesh(MAX_WOUNDS,'FleshImpactWounds',bloodFragment,{impact:true});this.bloodDrops=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshPhysicalMaterial({color:0x551016,vertexColors:true,roughness:.24,metalness:0,clearcoat:.24,clearcoatRoughness:.18,transparent:true,opacity:.94,depthWrite:false}),MAX_SPLASH_DROPS);this.bloodDrops.name='FleshImpactDroplets';this.bloodDrops.frustumCulled=false;this.bloodDrops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bloodDrops.setColorAt(0,new THREE.Color(0x551016));this.bloodDrops.instanceColor.setUsage(THREE.DynamicDrawUsage);this.root.add(this.marks,this.smoke,this.splashes,this.wounds,this.bloodDrops);this.object=new THREE.Object3D();this.normal=new THREE.Vector3();this.forward=new THREE.Vector3(0,0,1);this.shotDirection=new THREE.Vector3();this.tangent=new THREE.Vector3();this.bitangent=new THREE.Vector3();this.basis=new THREE.Matrix4();this.roll=new THREE.Quaternion();this.dropColor=new THREE.Color();this.markCursor=0;this.smokeCursor=0;this.splashCursor=0;this.woundCursor=0;this.dropCursor=0;this.markPool=Array.from({length:MAX_MARKS},()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion(),age:99,duration:8,size:1}));this.smokePool=Array.from({length:MAX_SMOKE},()=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),age:99,duration:1,size:1,spin:0}));this.splashPool=Array.from({length:MAX_SPLASH},()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion(),age:99,duration:1,size:.16,stretch:0,seed:0,variant:1}));this.woundPool=Array.from({length:MAX_WOUNDS},()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion(),age:99,duration:1,size:.16,stretch:0,seed:0,variant:0}));this.dropPool=Array.from({length:MAX_SPLASH_DROPS},()=>({position:new THREE.Vector3(),velocity:new THREE.Vector3(),age:99,duration:.8,size:.014,spin:0,deposit:false}));this.deposits=new BloodDeposits(this.root);this.clear();}
 clear(){this.deposits?.clear();for(const p of [...this.markPool,...this.smokePool,...this.splashPool,...this.woundPool,...this.dropPool])p.age=99;for(const mesh of[this.marks,this.smoke,this.splashes,this.wounds]){mesh.geometry.attributes.life.array.fill(0);mesh.geometry.attributes.seed.array.fill(0);mesh.geometry.attributes.wet.array.fill(0);mesh.geometry.attributes.stretch.array.fill(0);mesh.geometry.attributes.life.needsUpdate=true;mesh.geometry.attributes.seed.needsUpdate=true;mesh.geometry.attributes.wet.needsUpdate=true;mesh.geometry.attributes.stretch.needsUpdate=true;}this.markCursor=this.smokeCursor=this.splashCursor=this.woundCursor=this.dropCursor=0;this.bloodDrops.count=0;this.active={marks:0,smoke:0};this.detailActive={splashes:0,wounds:0,drops:0,deposits:0};}
 burst(t,gore=true,enemies=null,course=null){
  const isSurface=t.surface==='wall'||t.surface==='floor';
  if(isSurface&&t.normal){const p=this.markPool[this.markCursor++%MAX_MARKS];this.normal.set(t.normal.x,t.normal.z,t.normal.y).normalize();p.position.set(t.tx*4,t.tz*4,t.ty*4).addScaledVector(this.normal,.018);p.rotation.setFromUnitVectors(this.forward,this.normal);p.age=0;p.duration=7+(t.id%4);p.size=t.weapon===2?.32:.13+(t.id%4)*.017;
   for(let i=0;i<2;i++){const q=this.smokePool[this.smokeCursor++%MAX_SMOKE];q.position.copy(p.position);q.velocity.copy(this.normal).multiplyScalar(.2+i*.16);q.velocity.x+=Math.sin(t.id*2.399+i)*.13;q.velocity.z+=Math.cos(t.id*2.399+i)*.13;q.velocity.y+=.13;q.age=0;q.duration=.55+i*.25;q.size=.25+i*.15;q.spin=t.id*.37+i;}}
  if(t.surface!=='flesh'||!gore)return;
  const splash=this.splashPool[this.splashCursor++%MAX_SPLASH];
  const wound=this.woundPool[this.woundCursor++%MAX_WOUNDS];
  splash.target=null;
  wound.target=null;
  let targetDistance=.35;
  for(const enemy of enemies||[]){const distance=Math.hypot(enemy.x-t.tx,enemy.y-t.ty);if(distance<targetDistance){targetDistance=distance;splash.target=enemy;}}
  wound.target=splash.target;
  const dx=(t.tx??t.x)- (t.x??0),dy=(t.ty??t.y)- (t.y??0),dz=(t.tz??t.z)- (t.z??0);
  // Flesh endpoints are actor centerlines, not mesh surface raycasts. The
  // engine's supplied normal belongs to the wall behind the target. Present
  // the short contact spray toward the incoming shot, just ahead of the body.
  this.normal.set(-dx,-dz,-dy);
  if(this.normal.lengthSq()<.001)this.normal.set(0,1,0); else this.normal.normalize();
  splash.position.set((t.tx??t.x)*4,(t.tz??t.z)*4,(t.ty??t.y)*4).addScaledVector(this.normal,.34);
  splash.anchorX=this.normal.x*.34;splash.anchorZ=this.normal.z*.34;
  if(splash.target){splash.position.x=splash.target.x*4+splash.anchorX;splash.position.z=splash.target.y*4+splash.anchorZ;}
  const seed=Math.abs(Math.sin((Number(t.id)||0)*12.9898))*1.0;
  this.shotDirection.set(dx,dz,dy).addScaledVector(this.normal,-this.shotDirection.dot(this.normal));
  if(this.shotDirection.lengthSq()<.001){this.tangent.set(0,1,0);if(Math.abs(this.tangent.dot(this.normal))>.92)this.tangent.set(1,0,0);this.tangent.addScaledVector(this.normal,-this.tangent.dot(this.normal)).normalize();}else this.tangent.copy(this.shotDirection).normalize();
  this.bitangent.crossVectors(this.tangent,this.normal).normalize();this.basis.makeBasis(this.bitangent,this.tangent,this.normal);splash.rotation.setFromRotationMatrix(this.basis);this.roll.setFromAxisAngle(this.normal,(seed-.5)*.32);splash.rotation.premultiply(this.roll);splash.seed=seed;splash.variant=(Number(t.weapon)||0)%2===0?1:3;splash.stretch=.62+seed*.72+(Number(t.weapon)%3)*.08;splash.age=0;splash.duration=.28+seed*.09;splash.size=.58+seed*.17+(Number(t.weapon)%3)*.06;
  const energy=t.heavy||t.charged?1.7:t.weapon===1||t.weapon===5?1.35:1;
  splash.size*=energy;
  wound.position.set((t.tx??t.x)*4,(t.tz??t.z)*4,(t.ty??t.y)*4).addScaledVector(this.normal,.205);
  wound.anchorX=this.normal.x*.205;wound.anchorZ=this.normal.z*.205;
  if(wound.target){wound.position.x=wound.target.x*4+wound.anchorX;wound.position.z=wound.target.y*4+wound.anchorZ;}
  wound.rotation.copy(splash.rotation);wound.seed=(seed*1.731+.17)%1;wound.variant=0;wound.stretch=.16+seed*.22;wound.age=0;wound.duration=.48+seed*.12;wound.size=(.2+seed*.06)*energy;
  for(let i=0;i<9;i++){
   const q=this.dropPool[this.dropCursor++%MAX_SPLASH_DROPS],a=i*2.399+(Number(t.id)||0);
   q.position.copy(splash.position);
   q.velocity.copy(this.normal).multiplyScalar((.9+(i%4)*.42)*energy)
    .addScaledVector(this.tangent,Math.sin(a)*.65*energy).addScaledVector(this.bitangent,Math.cos(a)*.48*energy);
   q.velocity.y+=.22+(i%3)*.13;q.age=0;q.duration=1.05+(i%5)*.13;
   q.size=.014+(i%3)*.004+seed*.003;q.spin=a;q.deposit=i%3===0;
  }
  // Only a nearby, actually hit wall receives the forward spatter. The
  // reverse-facing wound spray above stays attached for less than 1/3 second.
  if(course&&Math.hypot(dx,dy)>.001&&!t.melee){
   const angle=Math.atan2(dy,dx),wall=castRay(course,t.tx,t.ty,angle,.85);
   const height=t.tz+dz/Math.hypot(dx,dy)*wall.dist;
   if(wall.dist<.85&&height>.035&&height<1.4){
    this.shotDirection.set((t.tx+Math.cos(angle)*wall.dist)*4,height*4,(t.ty+Math.sin(angle)*wall.dist)*4);
    this.normal.set(wall.side===0?-Math.sign(dx):0,0,wall.side===1?-Math.sign(dy):0);
    this.deposits.add(this.shotDirection,this.normal,.62*energy,1,Number(t.id)||0);
   }
  }
 }
 update(dt,camera,reducedMotion=false,gore=true){let marks=0,smoke=0,splashes=0,wounds=0,drops=0;const stamp=(mesh,p,slot,scale,alpha,wet=0,stretch=0)=>{this.object.position.copy(p.position);this.object.scale.setScalar(scale);this.object.updateMatrix();mesh.setMatrixAt(slot,this.object.matrix);mesh.geometry.attributes.life.setX(slot,alpha);if(mesh.geometry.attributes.seed)mesh.geometry.attributes.seed.setX(slot,p.seed||0);if(mesh.geometry.attributes.wet)mesh.geometry.attributes.wet.setX(slot,wet);if(mesh.geometry.attributes.stretch)mesh.geometry.attributes.stretch.setX(slot,stretch);if(mesh.geometry.attributes.bloodState)mesh.geometry.attributes.bloodState.setXY(slot,p.variant??1,1-wet);};
 for(let i=0;i<MAX_MARKS;i++){const p=this.markPool[i];p.age+=dt;const alive=p.age<p.duration;this.object.quaternion.copy(p.rotation);stamp(this.marks,p,i,p.size,alive?Math.min(1,(p.duration-p.age)/2):0);if(alive)marks++;}
 for(let i=0;i<MAX_SMOKE;i++){const p=this.smokePool[i];p.age+=dt;const alive=p.age<p.duration&&!reducedMotion;if(alive){p.position.addScaledVector(p.velocity,dt);smoke++;}if(camera)camera.getWorldQuaternion(this.object.quaternion);else this.object.quaternion.identity();this.object.rotateZ(p.spin);const u=Math.min(1,p.age/p.duration);stamp(this.smoke,p,i,p.size*(1+u*2),alive?Math.sin(Math.PI*u)*(1-u):0);}
 for(let i=0;i<MAX_SPLASH;i++){const p=this.splashPool[i];p.age+=dt;const alive=p.age<p.duration&&gore;if(alive&&p.target&&!p.target.dead){p.position.x=p.target.x*4+p.anchorX;p.position.z=p.target.y*4+p.anchorZ;}if(!alive)p.target=null;const progress=Math.min(1,p.age/p.duration);this.object.quaternion.copy(p.rotation);const opacity=1-Math.max(0,(progress-.3)/.7);stamp(this.splashes,p,i,p.size*(.82+progress*.42),alive?opacity:0,alive?1-progress:0,p.stretch);if(alive)splashes++;}
 for(let i=0;i<MAX_WOUNDS;i++){const p=this.woundPool[i];p.age+=dt;const alive=p.age<p.duration&&gore;if(alive&&p.target&&!p.target.dead){p.position.x=p.target.x*4+p.anchorX;p.position.z=p.target.y*4+p.anchorZ;}if(!alive)p.target=null;const progress=Math.min(1,p.age/p.duration);this.object.quaternion.copy(p.rotation);const opacity=alive?Math.sin(Math.min(1,progress)*Math.PI)*.92:0;stamp(this.wounds,p,i,p.size*(.76+progress*.34),opacity,alive?Math.max(0,1-progress*1.45):0,p.stretch);if(alive)wounds++;}
 for(let i=0;i<MAX_SPLASH_DROPS;i++){
  const p=this.dropPool[i];p.age+=dt;
  if(p.age>=p.duration||!gore||reducedMotion)continue;
  p.velocity.y-=4.8*dt;p.position.addScaledVector(p.velocity,dt);
  if(p.position.y<.028){
   if(p.deposit&&this.deposits){p.position.y=.012;this.normal.set(0,1,0);this.deposits.add(p.position,this.normal,.085+p.size*5,3,p.spin);}
   p.age=p.duration;continue;
  }
  this.object.position.copy(p.position);
  const speed=p.velocity.length();
  this.shotDirection.copy(p.velocity).normalize();this.normal.set(0,1,0);
  if(speed>.001)this.object.quaternion.setFromUnitVectors(this.normal,this.shotDirection);else this.object.quaternion.identity();
  const fade=Math.max(0,1-p.age/p.duration);
   this.object.scale.set(p.size*(.9+fade*.1),p.size*(1.2+Math.min(3.5,speed*2.1))*fade,p.size*(.9+fade*.1));
   this.object.updateMatrix();this.bloodDrops.setMatrixAt(drops,this.object.matrix);this.dropColor.setHex(DROP_COLORS[Math.abs(Math.floor(p.spin*17))%DROP_COLORS.length]);this.bloodDrops.setColorAt(drops,this.dropColor);drops++;
 }
 this.bloodDrops.count=drops;
 for(const mesh of[this.marks,this.smoke,this.splashes,this.wounds,this.bloodDrops]){mesh.instanceMatrix.needsUpdate=true;for(const key of ['life','seed','wet','stretch','bloodState'])if(mesh.geometry?.attributes?.[key])mesh.geometry.attributes[key].needsUpdate=true;}if(this.bloodDrops.instanceColor)this.bloodDrops.instanceColor.needsUpdate=true;
 // Keep the original diagnostics contract stable for existing telemetry while
 // retaining richer flesh-pool counts for local debugging.
 this.deposits?.update(dt,gore);
 this.active={marks,smoke};this.detailActive={splashes,wounds,drops,deposits:this.deposits?.active||0};}
 diagnostics(){return{...this.active,capacity:{marks:MAX_MARKS,smoke:MAX_SMOKE}};}
}
function merged(parts){const geometries=parts.map(([g,p,r])=>{const m=new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1));g.applyMatrix4(m);if(g.index){const flat=g.toNonIndexed();g.dispose();return flat;}return g;});const geometry=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();return geometry;}
export class RocketVFX{
 constructor(parent){this.root=new THREE.Group();this.root.name='ReliquaryRocketFX';parent.add(this.root);this.object=new THREE.Object3D();this.direction=new THREE.Vector3();this.forward=new THREE.Vector3(0,0,-1);const parts=[[new THREE.CylinderGeometry(.075,.09,.42,12),[0,0,0],[Math.PI/2,0,0]]];for(let i=0;i<4;i++)parts.push([new THREE.BoxGeometry(.025,.23,.16),[0,0,.13],[0,0,i*Math.PI/2]]);const shell=merged(parts);const nose=new THREE.ConeGeometry(.08,.2,12);nose.rotateX(-Math.PI/2);nose.translate(0,0,-.31);const jet=new THREE.ConeGeometry(.09,.55,10);jet.rotateX(Math.PI/2);jet.translate(0,0,.46);const make=(g,m,name)=>{const mesh=new THREE.InstancedMesh(g,m,64);mesh.name=name;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(mesh);return mesh;};this.shell=make(shell,new THREE.MeshStandardMaterial({color:0x55423b,metalness:.68,roughness:.5}),'RocketIronBody');this.nose=make(nose,new THREE.MeshStandardMaterial({color:0xc1a780,roughness:.75}),'RocketBoneTip');this.jet=make(jet,new THREE.MeshBasicMaterial({color:0xff622b,transparent:true,opacity:.66,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),'RocketExhaust');}
 update(run){let i=0;for(const p of run.projectiles||[]){if(p.kind!=='rocket'||p.life<=0||i>=64)continue;this.direction.set(p.vx,p.vz,p.vy).normalize();this.object.quaternion.setFromUnitVectors(this.forward,this.direction);this.object.position.set(p.x*4,p.z*4,p.y*4);this.object.scale.setScalar(1);this.object.updateMatrix();this.shell.setMatrixAt(i,this.object.matrix);this.nose.setMatrixAt(i,this.object.matrix);this.object.scale.set(1,1,.8+Math.sin((p.age||0)*71)*.16);this.object.updateMatrix();this.jet.setMatrixAt(i,this.object.matrix);i++;}for(const m of[this.shell,this.nose,this.jet]){m.count=i;m.instanceMatrix.needsUpdate=true;}}
}
