import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

const rounded=(w,h,d,r)=>{
  const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1,curveSegments:4});g.rotateX(-Math.PI/2);return g;
};
const merge=parts=>{const g=mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p));parts.forEach(p=>p.dispose());return g;};

// Three pooled draws for every recovery cache on the floor. No new collision.
export class DungeonSupplies{
  constructor(parent,course){
    this.items=(course.supplies||[]).slice(0,32);this.root=new THREE.Group();this.root.name='RecoveryCaches';this.root.userData.noBatch=true;this.root.userData.afterlifeSkip=true;parent.add(this.root);
    const caseGeometry=rounded(.86,.56,.27,.065);caseGeometry.translate(0,.08,0);
    const lid=rounded(.89,.58,.035,.06);lid.translate(0,.355,0);
    const fittings=[lid];
    for(const x of [-.27,.27]){const clasp=new THREE.BoxGeometry(.065,.12,.025);clasp.translate(x,.30,.292);fittings.push(clasp);}
    const handle=new THREE.TorusGeometry(.13,.021,6,20,Math.PI);handle.rotateX(Math.PI/2);handle.translate(0,.405,0);fittings.push(handle);
    const mark=[new THREE.BoxGeometry(.21,.006,.056),new THREE.BoxGeometry(.056,.006,.21)];mark.forEach(g=>g.translate(0,.407,.07));
    const materials=[new THREE.MeshStandardMaterial({color:0x30483c,roughness:.83,metalness:.15}),new THREE.MeshStandardMaterial({color:0x8d9180,roughness:.57,metalness:.5}),new THREE.MeshStandardMaterial({color:0xd2e3c5,roughness:.7,emissive:0x688971,emissiveIntensity:.28})];
    this.meshes=[caseGeometry,merge(fittings),merge(mark)].map((geometry,i)=>{
      const m=new THREE.InstancedMesh(geometry,materials[i],Math.max(1,this.items.length));m.name=['RecoveryCase','RecoveryLidAndClasp','RecoveryMark'][i];m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(m);return m;
    });this.object=new THREE.Object3D();this.update([]);
  }
  update(collected=[]){
    const key=collected.join('|');if(this.key===key)return;this.key=key;let count=0;
    for(const item of this.items){if(collected.includes(item.id))continue;this.object.position.set(item.x*4,0,item.y*4);this.object.rotation.y=((item.x*7+item.y*3)%5-.5)*.14;this.object.updateMatrix();for(const mesh of this.meshes)mesh.setMatrixAt(count,this.object.matrix);count++;}
    for(const mesh of this.meshes){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
  }
}
