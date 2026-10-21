import * as T from '../vendor/three.module.js';
import {consoleMaterial} from './retro-materials.js';
import {CRIMSON} from './close-combat.js';

// One impact has a direction and an aftermath. The same fixed pools carry
// bone chips, torn flesh and the connected -> stretched -> severed tissue.
export function createCrimsonTissue(scene,floorAt,onTear){
 const material=consoleMaterial(new T.MeshLambertMaterial({flatShading:true,color:0xffffff}));
 const debris=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),material,32);
 const strands=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,5),material,72);
 debris.name='Crimson bone and flesh';strands.name='Crimson extraction tissue';
 for(const mesh of [debris,strands]){mesh.frustumCulled=false;mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(mesh.count*3).fill(1),3);scene.add(mesh);}
 const bits=Array.from({length:32},()=>({life:0,p:new T.Vector3(),v:new T.Vector3(),turn:new T.Euler(),scale:new T.Vector3()}));
 const pulls=Array.from({length:4},()=>({life:0,age:0,frame:null,source:null,broken:false,cuts:Array.from({length:3},()=>({ready:false,hasEnd:false,wound:new T.Vector3(),organ:new T.Vector3(),lastEnd:new T.Vector3()}))}));
 const dummy=new T.Object3D(),color=new T.Color(),right=new T.Vector3(),up=new T.Vector3(0,1,0),start=new T.Vector3(),end=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),axis=new T.Vector3(),side=new T.Vector3();
 const anchors=new WeakMap();let anchorTemplate=null;
 function prepareOrgan(root){const meshes=[];root.updateWorldMatrix(true,true);root.traverse(m=>{if(m.isMesh)meshes.push(m);});if(!anchorTemplate){anchorTemplate=[[-.014,.061,.029],[.010,.057,.042],[-.032,.056,-.018]].map(target=>{let best=Infinity,result=null;for(let m=0;m<meshes.length;m++){const mesh=meshes[m];for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,a);mesh.localToWorld(a);root.worldToLocal(a);const distance=a.distanceToSquared(b.fromArray(target));if(distance<best){best=distance;result={mesh:m,index:i};}}}return result;});}anchors.set(root,anchorTemplate.map(p=>({mesh:meshes[p.mesh],index:p.index})));}
 let nextBit=0,nextPull=0;
 const smooth=(t,a,b)=>T.MathUtils.smoothstep(t,a,b);
 function burst(frame,tearing=false){
  right.set(1,0,0).applyQuaternion(frame.rotation);
  for(let i=0;i<(tearing?6:14);i++){
   const slot=nextBit++%bits.length,p=bits[slot],bone=!tearing&&i%5===0,back=!tearing&&i<10;
   p.p.copy(back?frame.exit:frame.entry);p.v.copy(frame.front).multiplyScalar(back?-4.2-i*.12:tearing?1.6:1.9).addScaledVector(right,Math.sin(i*2.4)*(tearing?.6:1.25));p.v.y+=.45+i%3*.35;
   p.scale.set(bone?.009:.023,bone?.065:tearing?.048:.032,bone?.017:.018);p.life=bone?2.3:2.0;p.turn.set(i*.7,i*1.3,i*.4);
   debris.setColorAt(slot,color.setHex(bone?0xb7a486:i%2?0x792b26:0xa34838));
  }debris.instanceColor.needsUpdate=true;
 }
 function point(out,u,pull,index,half){
  const f=pull.frame,relax=smooth(pull.age,pull.breakAge||0,(pull.breakAge||0)+.16);
  if(!pull.broken){
   const tension=T.MathUtils.clamp(start.distanceTo(end)/.25,0,1);
   out.lerpVectors(start,end,u).addScaledVector(side,Math.sin(Math.PI*u)*(.012+Math.sin(pull.age*13+index*2)*.006));
   out.y-=Math.sin(Math.PI*u)*(.038*(1-tension)+.008);
  }else{
   const origin=half?end:start,length=half?.085:.105,cut=pull.cuts[index];
   out.copy(origin).addScaledVector(half?cut.organ:cut.wound,u*(1-relax));
   out.y-=length*u*relax;out.addScaledVector(side,Math.sin(Math.PI*u)*(.012+Math.sin(pull.age*10+index)*.007)*Math.exp(-pull.age*1.6));
  }if(pull.broken)out.y=Math.max(out.y,pull.floor);return out;
 }
 function writeStrands(){
  for(let slot=0;slot<pulls.length;slot++){
   const p=pulls[slot];if(p.life>0){right.set(1,0,0).applyQuaternion(p.frame.rotation);side.copy(right);p.floor=floorAt(p.frame.entry.x,p.frame.entry.z)+.012;}
   for(let i=0;i<3;i++){
    if(p.life>0){
     const cut=p.cuts[i];start.copy(p.frame.entry).addScaledVector(right,(i-1)*.022);start.y+=(i%2?-.027:.018);
     if(p.source){p.source.updateWorldMatrix(true,true);const anchor=anchors.get(p.source)?.[i];if(anchor)anchor.mesh.getVertexPosition(anchor.index,end).applyMatrix4(anchor.mesh.matrixWorld);else end.set((i-1)*.016,.014,.005).applyMatrix4(p.source.matrixWorld);cut.lastEnd.copy(end);cut.hasEnd=true;}else end.copy(cut.hasEnd?cut.lastEnd:start);
     if(p.broken&&!cut.ready){p.broken=false;point(a,.5,p,i,false);p.broken=true;cut.wound.subVectors(a,start);cut.organ.subVectors(a,end);cut.ready=true;}
    }
    for(let link=0;link<6;link++){
     const id=slot*18+i*6+link,half=link>=3,hidden=p.life<=0||p.broken&&half&&!p.source;
     if(hidden)dummy.scale.setScalar(0);
     else{
      const segment=p.broken?link%3:link,total=p.broken?3:6;
      point(a,segment/total,p,i,half);point(b,(segment+1)/total,p,i,half);axis.subVectors(b,a);const length=axis.length();
      dummy.position.lerpVectors(a,b,.5);dummy.quaternion.setFromUnitVectors(up,axis.divideScalar(Math.max(length,1e-6)));
      const tension=p.broken?0:T.MathUtils.clamp(start.distanceTo(end)/.25,0,1),radius=(i===1?.008:.0065)*(1-tension*.28)*Math.min(1,p.life*3);
      dummy.scale.set(radius*(1-.22*(segment+.5)/total),length+.001,radius*.70*(1-.22*(segment+.5)/total));
     }dummy.updateMatrix();strands.setMatrixAt(id,dummy.matrix);
    }
   }
  }strands.instanceMatrix.needsUpdate=true;
 }
 const api={prepareOrgan,burst,extract(frame,source,action){const p=pulls[nextPull++%pulls.length];Object.assign(p,{frame,source,action,age:0,life:3.2,broken:false,released:false});for(const c of p.cuts)c.ready=c.hasEnd=false;},
  release(frame,source){for(const p of pulls)if(p.life>0&&p.frame===frame){if(!p.broken)p.breakAge=p.age;p.broken=true;p.source=source;p.action=null;p.released=true;}},
  sever(frame){for(const p of pulls)if(p.life>0&&p.frame===frame&&!p.released){if(!p.broken)p.breakAge=p.age;p.broken=true;p.source=p.action=null;}},
  get active(){return {fragments:bits.filter(p=>p.life>0).length,strands:pulls.filter(p=>p.life>0).length*3};},
  update(dt){
   for(let i=0;i<bits.length;i++){
    const p=bits[i];if(p.life>0){p.life=Math.max(0,p.life-dt);p.v.y-=8*dt;p.p.addScaledVector(p.v,dt);const floor=floorAt(p.p.x,p.p.z)+.012;if(p.p.y<floor){p.p.y=floor;p.v.set(0,0,0);}else{p.turn.x+=dt*6;p.turn.z+=dt*4;}}
    dummy.position.copy(p.p);dummy.rotation.copy(p.turn);dummy.scale.copy(p.scale).multiplyScalar(p.life>0?Math.min(1,p.life*4):0);dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);
   }debris.instanceMatrix.needsUpdate=true;
   for(const p of pulls)if(p.life>0){p.life=Math.max(0,p.life-dt);p.age=!p.broken&&p.action?Math.max(0,p.action.time-CRIMSON.extract):p.age+dt;if(!p.broken&&p.age>=.30){p.breakAge=p.age;p.broken=true;burst(p.frame,true);onTear?.(p.frame);}}
   writeStrands();
  },clear(){for(const p of bits)p.life=0;for(const p of pulls){p.life=0;p.frame=p.source=p.action=null;}api.update(0);}
 };
 for(let i=0;i<strands.count;i++)strands.setColorAt(i,color.setHex(i%3?0x9e4b3d:0x6b2527));strands.instanceColor.needsUpdate=true;
 api.update(0);return api;
}
