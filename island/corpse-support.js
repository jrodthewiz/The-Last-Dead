import * as T from '../vendor/three.module.js';

const up=new T.Vector3(0,1,0),normal=new T.Vector3(),point=new T.Vector3(),tilt=new T.Quaternion(),heading=new T.Quaternion();
// Presentation support, not enemy movement physics. The corpse follows the
// rendered deck normal during collapse. A single bounded skin pass seats the
// finished pose; updateEnemies shares its 384-vertex budget across all bodies.
export function supportCorpse(enemy,floorAt,dt,budget){
 let s=enemy.corpseSupport;
 if(!s){s=enemy.corpseSupport={age:0,yaw:enemy.root.rotation.y,baseY:floorAt(enemy.x,enemy.z),meshes:null,mesh:0,index:0,min:Infinity,settled:false};}
 s.age+=dt;
 if(s.settled){enemy.root.position.y=s.finalY;enemy.root.quaternion.copy(s.rotation);return 0;}
 if(!s.meshes){
  const hips=enemy.root.getObjectByName('Hips');enemy.root.updateMatrixWorld(true);if(hips)hips.getWorldPosition(point);else point.copy(enemy.root.position);
  const x=point.x,z=point.z,span=.55,nx=(floorAt(x+span,z)-floorAt(x-span,z))/(span*2),nz=(floorAt(x,z+span)-floorAt(x,z-span))/(span*2);
  normal.set(-nx,1,-nz).normalize();tilt.setFromUnitVectors(up,normal);heading.setFromAxisAngle(up,s.yaw);enemy.root.quaternion.copy(tilt).multiply(heading);enemy.root.position.y=s.baseY;enemy.root.updateMatrixWorld(true);
  const duration=enemy.action?.getClip().duration||1.5;if(enemy.action?.time<duration-.035||budget<=0)return 0;
  s.rotation=enemy.root.quaternion.clone();s.meshes=[];enemy.model.traverse(m=>{if(m.isSkinnedMesh){m.skeleton.update();s.meshes.push({mesh:m,stride:Math.max(1,Math.ceil(m.geometry.attributes.position.count/1536))});}});
 }
 enemy.root.position.y=s.baseY;enemy.root.quaternion.copy(s.rotation);enemy.root.updateMatrixWorld(true);
 let used=0;
 while(s.mesh<s.meshes.length&&used<budget){const {mesh,stride}=s.meshes[s.mesh],count=mesh.geometry.attributes.position.count;mesh.skeleton.update();for(;s.index<count&&used<budget;s.index+=stride){mesh.getVertexPosition(s.index,point).applyMatrix4(mesh.matrixWorld);s.min=Math.min(s.min,point.y-floorAt(point.x,point.z));used++;}if(s.index>=count){s.mesh++;s.index=0;}}
 if(s.mesh===s.meshes.length){if(Number.isFinite(s.min))enemy.root.position.y+=.004-s.min;s.finalY=enemy.root.position.y;s.settled=true;enemy.root.updateMatrixWorld(true);}
 return used;
}

export function clearCorpseSupport(enemy){if(!enemy.corpseSupport)return;const yaw=enemy.corpseSupport.yaw;enemy.root.rotation.set(0,yaw,0);enemy.corpseSupport=null;}
