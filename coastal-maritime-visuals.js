import * as THREE from './vendor/three.module.js';
import {uniformArray,attribute,positionLocal,positionGeometry,normalGeometry,modelNormalMatrix,vec3,vec4,mix} from './vendor/three.tsl.js';
import {makeBurntVehicleKit,BURNT_VEHICLE_IDS} from './assets/blackwater-kit/burnt-vehicle.js';
import {coastalSurfaceHeightAt} from './coastal-water.js';
import {makeMaritimeKit,createMaritimeMaterials,mergeMaritimeParts,MARITIME_PALETTE} from './assets/blackwater-kit/maritime-vehicles.js';

// Per-material merging stays static. Shared body poses move boats and the
// sixteen usable cars; wrecks stay identity and quay rope ends have zero weight.
export function buildCoastalMaritime(world,{lightSources=[]}={}){
 const layout=world.course.coastal?.maritime;
 if(!layout)return null;
 const root=new THREE.Group();root.name='CoastalMaritime';root.userData.noBatch=true;
 const poses=Array.from({length:layout.boats.length+layout.cars.length+1},()=>new THREE.Matrix4()),poseNode=uniformArray(poses,'mat4');
 const restFrames=[new THREE.Matrix4(),...layout.boats.map(p=>new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(1,1,1)).invert())];
 const carInverses=layout.cars.map(p=>new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(1,1,1)).invert());
 restFrames.push(...layout.cars.map(()=>new THREE.Matrix4()));
 const finishSpecs=[new THREE.Vector4(),...layout.boats.map(p=>new THREE.Vector4(p.length,p.beam,p.kind==='trawler'?.9:.25,p.kind==='trawler'?2.7:p.kind==='launch'?2.2:0))];
 finishSpecs.push(...layout.cars.map(()=>new THREE.Vector4()));
 const bodyBounds=Array.from({length:poses.length},()=>new THREE.Box3());
 const attachMotion=(g,body,weight=1)=>{const count=g.attributes.position.count;g.setAttribute('maritimeBody',new THREE.Float32BufferAttribute(new Float32Array(count).fill(body),1));g.setAttribute('maritimeWeight',new THREE.Float32BufferAttribute(new Float32Array(count).fill(weight),1));g.setAttribute('maritimeGradient',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));};
 const parts=new Map(Object.keys(MARITIME_PALETTE).map(k=>[k,[]]));
 for(const p of [...layout.boats,...layout.cars]){
  const kit=BURNT_VEHICLE_IDS.includes(p.id)?makeBurntVehicleKit(p.kind):makeMaritimeKit(p.kind),matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw),new THREE.Vector3(1,1,1));
  const boatIndex=layout.boats.indexOf(p),body=boatIndex>=0?boatIndex+1:layout.boats.length+1+layout.cars.indexOf(p);
  for(const [s,list]of kit)for(const g of list){attachMotion(g,body,1);g.applyMatrix4(matrix);g.computeBoundingBox();bodyBounds[body].union(g.boundingBox);const tint=new THREE.Color(s==='paint'?(p.paint||MARITIME_PALETTE.paint):'#ffffff'),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.get(s).push(g);}
  for(const [i,bollard]of (p.mooring||[]).entries()){
   const a=new THREE.Vector3(p.x+(i?1:-1)*p.length*.29,p.y+.75,p.z-p.beam*.40),b=new THREE.Vector3(bollard.x,1,bollard.z);
   // Two rope spans meet a sagged midpoint; each lands on an existing bollard.
   const mid=a.clone().lerp(b,.5);mid.y-=.20;
   for(const [start,end,startWeight,endWeight]of [[a,mid,1,.5],[mid,b,.5,0]]){const d=end.clone().sub(start),length=d.length(),g=new THREE.CylinderGeometry(.026,.026,length,6);attachMotion(g,body);const position=g.attributes.position,weight=g.attributes.maritimeWeight,gradient=g.attributes.maritimeGradient,grad=d.clone().multiplyScalar((endWeight-startWeight)/(length*length));for(let v=0;v<position.count;v++){const raw=.5+position.getY(v)/length,t=raw<1e-6?0:raw>1-1e-6?1:raw;weight.setX(v,startWeight+(endWeight-startWeight)*t);gradient.setXYZ(v,grad.x,grad.y,grad.z);}g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...start.clone().add(end).multiplyScalar(.5).toArray());parts.get('rope').push(g);}
  }
 }
 const materials=createMaritimeMaterials(lightSources,world.course.water?.level??-1.15,{restFrames,finishSpecs}),geometries=mergeMaritimeParts(parts);
 materials.get('paint').color.set('#ffffff');for(const m of materials.values())m.vertexColors=true;
 const body=attribute('maritimeBody','float').toUint(),weight=attribute('maritimeWeight','float'),rigid=poseNode.element(body);
 for(const [slot,m] of materials){
  m.positionNode=mix(positionLocal,rigid.mul(vec4(positionLocal,1)).xyz,weight);
  // NodeMaterial.normalNode is view-space (vendor setupNormal); rigid matrices
  // have unit scale, so their rotation also transforms normal directions.
  m.normalNode=modelNormalMatrix.mul(mix(normalGeometry,rigid.mul(vec4(normalGeometry,0)).xyz,weight).normalize()).normalize();
  if(slot==='rope'){
   // Exact cofactor normal transform for the rope's affine weight field. This
   // includes its changing tangent, while rigid vertices have zero gradient.
   const gradient=attribute('maritimeGradient','vec3'),delta=rigid.mul(vec4(positionGeometry,1)).xyz.sub(positionGeometry);
   const jx=mix(vec3(1,0,0),rigid.mul(vec4(1,0,0,0)).xyz,weight).add(delta.mul(gradient.x));
   const jy=mix(vec3(0,1,0),rigid.mul(vec4(0,1,0,0)).xyz,weight).add(delta.mul(gradient.y));
   const jz=mix(vec3(0,0,1),rigid.mul(vec4(0,0,1,0)).xyz,weight).add(delta.mul(gradient.z));
   const corrected=jy.cross(jz).mul(normalGeometry.x).add(jz.cross(jx).mul(normalGeometry.y)).add(jx.cross(jy).mul(normalGeometry.z));
   m.normalNode=modelNormalMatrix.mul(corrected.normalize()).normalize();
  }
  m.userData.maritimeMotion='shared rigid vessel poses; fixed quay anchors; cars fleet rigid poses';
 }
 let triangles=0;
 for(const [s,g]of geometries){g.computeBoundingBox();g.boundingBox.expandByScalar(3);g.computeBoundingSphere();g.boundingSphere.radius+=3;const mesh=new THREE.Mesh(g,materials.get(s));mesh.name=`Maritime:${s}`;mesh.layers.set(1);mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);triangles+=(g.index?.count||g.attributes.position.count)/3;}
 world.root.add(root);
 const diagnostics={boats:layout.boats.length,cars:layout.cars.length,drawCalls:root.children.length,triangles,materials:materials.size,stationary:false,moored:true,carMotion:'fleet rigid poses with identity parked transform',boatMotion:'rigid pose from shared analytic coastal wave samples',poseUniformBytes:poses.length*64,staticFinishUniformBytes:restFrames.length*80,finishCoordinates:'rest geometry in vessel-local construction frames; car rest world geometry',geometryUploadsPerUpdate:0,updateCount:0};
 world.diagnostics.maritime=diagnostics;
 const states=layout.boats.map((p,i)=>({p,inverse:restFrames[i+1],forward:new THREE.Vector3(),port:new THREE.Vector3(),up:new THREE.Vector3(),position:new THREE.Vector3(),basis:new THREE.Matrix4(),quaternion:new THREE.Quaternion(),cos:Math.cos(p.yaw),sin:Math.sin(p.yaw)}));
 const one=new THREE.Vector3(1,1,1),carPosition=new THREE.Vector3(),carQuaternion=new THREE.Quaternion(),upAxis=new THREE.Vector3(0,1,0),carPose=new THREE.Matrix4(),liveBounds=new THREE.Box3(),scratchBounds=new THREE.Box3();let disposed=false,lastTime=NaN,lastFleetRevision=-1;
 const update=(time,fleet)=>{
  if(disposed)return;const t=Number.isFinite(time)?time:0;if(t===lastTime&&(!fleet||fleet.revision===lastFleetRevision))return;lastTime=t;lastFleetRevision=fleet?.revision??-1;
  for(let i=0;i<states.length;i++){
   const s=states[i],p=s.p,dx=p.length*.32,dz=p.beam*.4;
   const hf=(coastalSurfaceHeightAt(p.x+s.cos*dx,p.z-s.sin*dx,t)-coastalSurfaceHeightAt(p.x-s.cos*dx,p.z+s.sin*dx,t))/(2*dx);
   const hp=(coastalSurfaceHeightAt(p.x+s.sin*dz,p.z+s.cos*dz,t)-coastalSurfaceHeightAt(p.x-s.sin*dz,p.z-s.cos*dz,t))/(2*dz);
   s.forward.set(s.cos,hf,-s.sin).normalize();s.port.set(s.sin,hp,s.cos);s.up.crossVectors(s.port,s.forward).normalize();s.port.crossVectors(s.forward,s.up).normalize();
   s.basis.makeBasis(s.forward,s.up,s.port);s.quaternion.setFromRotationMatrix(s.basis);s.position.set(p.x,p.y+coastalSurfaceHeightAt(p.x,p.z,t),p.z);
   poses[i+1].compose(s.position,s.quaternion,one).multiply(s.inverse);
  }
  for(let i=0;i<layout.cars.length;i++){
   const p=layout.cars[i],v=fleet?.cars.find(v=>v.id===p.id),body=layout.boats.length+1+i;
   if(v&&v.x*4===p.x&&v.y*4===p.z&&v.angle===-p.yaw&&(v.groundM||0)===0){poses[body].identity();}
   else if(v){carPosition.set(v.x*4,(v.groundM||0)+p.y,v.y*4);carQuaternion.setFromAxisAngle(upAxis,-v.angle);carPose.compose(carPosition,carQuaternion,one);poses[body].copy(carPose).multiply(carInverses[i]);}
  }
  // GPU vertex motion must be reflected in CPU culling/shadow bounds. This
  // bounded 24-box union has no buffer upload or geometry traversal.
  liveBounds.makeEmpty();for(let i=1;i<bodyBounds.length;i++)if(!bodyBounds[i].isEmpty()){scratchBounds.copy(bodyBounds[i]).applyMatrix4(poses[i]);liveBounds.union(scratchBounds);}liveBounds.expandByScalar(3);
  for(const mesh of root.children){mesh.geometry.boundingBox.copy(liveBounds);liveBounds.getBoundingSphere(mesh.geometry.boundingSphere);}
  diagnostics.updateCount++;
 };
 update(0);
 return{root,diagnostics,update,setFleet(fleet){lastFleetRevision=-1;update(lastTime,fleet);},getPose(index,target){return target.copy(poses[index]);},dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();}};
}

