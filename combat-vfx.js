import * as THREE from './vendor/three.module.js';
import {ImpactVFX,RocketVFX} from './impact-vfx.js';
import {ExplosionVFX} from './explosion-vfx.js';
const COLORS=[0xff3154,0xffb44b,0x64eaff],UP=new THREE.Vector3(0,1,0),MAX=128,SPARKS=384;
export class CombatVFX{
 constructor(parent){this.root=new THREE.Group();this.root.name='OssuaryCombatFX';parent.add(this.root);this.seen=new Set();this.origins=new Map();this.particles=[];this.object=new THREE.Object3D();this.a=new THREE.Vector3();this.b=new THREE.Vector3();this.direction=new THREE.Vector3();this.color=new THREE.Color();
 const beamGeo=new THREE.CylinderGeometry(1,1,1,5,1,true);const make=(name,geo,count,opacity)=>{const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});const mesh=new THREE.InstancedMesh(geo,material,count);mesh.name=name;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(mesh);return mesh;};
 this.beams=make('ColoredBulletTracers',beamGeo,MAX,.85);this.cores=make('TracerWhiteCores',beamGeo,MAX,.9);this.sparks=make('ImpactSparks',new THREE.OctahedronGeometry(1),SPARKS,.9);this.blood=make('BloodVelocityStreaks',new THREE.CylinderGeometry(1,.45,1,4),260,.55);this.blood.material.blending=THREE.NormalBlending;this.blood.material.color.set(0xb51c34);this.blood.material.toneMapped=true;
 this.explosions=new ExplosionVFX(this.root);this.impacts=new ImpactVFX(this.root);this.rockets=new RocketVFX(this.root);
 }
 update(run,dt,gore=true,muzzleSource=null){const reset=this.course!==run.course||run.time<this.lastTime;if(reset){this.particles.length=0;this.seen.clear();this.origins.clear();this.course=run.course;this.explosions?.clear();this.impacts.clear();}this.lastTime=run.time;let count=0;const current=new Set();
  let settings=arguments[4]||this.explosions?.settings||{};
 for(const t of run.tracers||[]){if(count>=MAX)break;const muzzle=Array.isArray(muzzleSource)?muzzleSource[t.weapon??0]:muzzleSource;current.add(t.id);const color=t.ricochet?0xffe697:COLORS[t.weapon??(t.rail?2:0)],fade=Math.min(1,t.life/(t.duration||.18));this.a.set(t.x*4,t.z*4,t.y*4);this.b.set(t.tx*4,t.tz*4,t.ty*4);
 // Only the local shooter's first segment originates at the visible muzzle; hit endpoints remain authoritative.
 const local=t.ownerId===(run.playerId||'host');
 if(muzzle&&local&&!t.ricochet&&!this.origins.has(t.id))this.origins.set(t.id,muzzle.clone());
 if(this.origins.has(t.id))this.a.copy(this.origins.get(t.id));
 this.direction.subVectors(this.b,this.a);const length=this.direction.length();this.object.position.copy(this.a).addScaledVector(this.direction,.5);this.object.quaternion.setFromUnitVectors(UP,this.direction.normalize());const width=(t.rail?.034:.018)*fade;this.object.scale.set(width,length,width);this.object.updateMatrix();this.beams.setMatrixAt(count,this.object.matrix);this.color.set(color).multiplyScalar(fade);this.beams.setColorAt(count,this.color);this.object.scale.set(width*.3,length,width*.3);this.object.updateMatrix();this.cores.setMatrixAt(count,this.object.matrix);this.color.setRGB(fade,fade,fade);this.cores.setColorAt(count,this.color);count++;
 if(!this.seen.has(t.id)&&muzzle&&local&&!t.ricochet){for(let i=0;i<4;i++){const a=i*2.399+t.id;this.particles.push({x:muzzle.x,y:muzzle.y,z:muzzle.z,vx:Math.cos(a)*.4,vy:.35+i*.1,vz:Math.sin(a)*.4,life:.16+i*.025,color});}}
 if(!this.seen.has(t.id))this.impacts.burst(t);
 if(!this.seen.has(t.id)&&['wall','floor'].includes(t.surface)&&!t.ricochet){for(let i=0;i<7;i++){const a=i*2.399+t.id,v=.8+(i%3)*.7;this.particles.push({x:this.b.x,y:this.b.y,z:this.b.z,vx:Math.cos(a)*v*.4+(t.normal?.x||0)*v,vy:.3+(i%4)*.25+(t.normal?.z||0)*v,vz:Math.sin(a)*v*.4+(t.normal?.y||0)*v,life:.22+(i%3)*.07,color});}}}
 for(const id of this.origins.keys())if(!current.has(id))this.origins.delete(id);this.seen=current;this.beams.count=this.cores.count=count;for(const mesh of[this.beams,this.cores]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
 this.particles=this.particles.slice(-SPARKS);let n=0;for(const p of this.particles){p.life-=dt;if(p.life<=0)continue;p.vy-=6*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.object.position.set(p.x,Math.max(.03,p.y),p.z);this.object.rotation.set(p.life*5,p.life*8,0);this.object.scale.set(.017,p.life*.11,.017);this.object.updateMatrix();this.sparks.setMatrixAt(n,this.object.matrix);this.color.set(p.color).multiplyScalar(Math.min(1,p.life*5));this.sparks.setColorAt(n++,this.color);}this.particles=this.particles.filter(p=>p.life>0);this.sparks.count=n;this.sparks.instanceMatrix.needsUpdate=true;if(this.sparks.instanceColor)this.sparks.instanceColor.needsUpdate=true;
 this.impacts.update(dt,settings.camera,!!settings.reducedMotion);this.rockets.update(run);
 this.explosions.setCamera(settings.camera||null);this.explosions.update(run,dt,{reducedMotion:!!settings.reducedMotion,gore});
 let b=0;if(gore)for(const p of run.gore||[]){if(b>=260||p.chunk||p.z<=.015)continue;this.object.position.set(p.x*4,p.z*4,p.y*4);this.direction.set(p.vx,p.vz,p.vy);const speed=this.direction.length();this.object.quaternion.setFromUnitVectors(UP,this.direction.normalize());this.object.scale.set(.024,Math.min(.4,speed*.13),.024);this.object.updateMatrix();this.blood.setMatrixAt(b++,this.object.matrix);}this.blood.count=b;this.blood.instanceMatrix.needsUpdate=true;
 }
}
