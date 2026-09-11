import * as THREE from './vendor/three.module.js';

// One deterministic mask shared by the entire stain pool: a wet central body,
// capillary lobes and detached satellite drops, rather than circular discs.
export function createBloodMask() {
  const size=128,pixels=new Uint8Array(size*size*4);
  const drops=Array.from({length:15},(_,i)=>{const a=i*2.399963,r=.66+(i%4)*.075;return [Math.cos(a)*r,Math.sin(a)*r,.025+(i%3)*.014];});
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+.5)/size*2-1,py=(y+.5)/size*2-1,a=Math.atan2(py,px),r=Math.hypot(px,py);
    const edge=.57+.085*Math.sin(a*5+.4)+.055*Math.sin(a*9-1)+.035*Math.cos(a*17);
    let alpha=Math.max(0,Math.min(1,(edge-r)*65));
    for(const [dx,dy,rad] of drops)alpha=Math.max(alpha,Math.max(0,Math.min(1,(rad-Math.hypot(px-dx,py-dy))*80)));
    const i=(y*size+x)*4,wet=.65+.35*Math.max(0,1-r/.7);
    pixels[i]=Math.round(255*wet);pixels[i+1]=Math.round(238*wet);pixels[i+2]=Math.round(230*wet);pixels[i+3]=Math.round(alpha*255);
  }
  const texture=new THREE.DataTexture(pixels,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}

// A velocity-shaped luminous envelope behind projectile cores. One draw call,
// fixed storage, and no additional lights or emission after projectile death.
export class ProjectileWakes {
  constructor(parent,capacity=96){
    this.capacity=capacity;
    const geometry=new THREE.CylinderGeometry(.008,.07,1,7,1,true);
    geometry.translate(0,-.5,0);
    const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.44,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
    this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.name='VelocityProjectileWakes';
    this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(this.mesh);
    this.position=new THREE.Vector3();this.velocity=new THREE.Vector3();this.scale=new THREE.Vector3();this.up=new THREE.Vector3(0,1,0);this.rotation=new THREE.Quaternion();this.matrix=new THREE.Matrix4();this.color=new THREE.Color();
  }
  update(projectiles,reducedMotion=false){
    let count=0;
    for(const p of projectiles||[]){
      if(count>=this.capacity)break;
      if(p.kind==='rocket')continue;
      this.velocity.set(p.vx||0,p.vz||0,p.vy||0);const speed=this.velocity.length();
      if(speed<.01)continue;
      this.rotation.setFromUnitVectors(this.up,this.velocity.multiplyScalar(1/speed));
      this.position.set(p.x*4,(p.z||0)*4,p.y*4);
      const length=Math.min(reducedMotion?.28:1.7,speed*4*Math.min(p.age||0,.09));
      this.scale.set(p.core?1.5:1,length,p.core?1.5:1);
      this.matrix.compose(this.position,this.rotation,this.scale);this.mesh.setMatrixAt(count,this.matrix);
      this.color.set(p.reflected?0x79eeff:p.core?0xffc66e:0xff4267);this.mesh.setColorAt(count++,this.color);
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
}
