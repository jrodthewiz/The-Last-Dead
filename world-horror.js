import * as THREE from './vendor/three.module.js';
export function buildHorrorDetails(root,materials){
 const steel=materials.metalDark,bone=new THREE.MeshStandardMaterial({color:0xb9b6a0,roughness:.82,metalness:.12}),flesh=new THREE.MeshStandardMaterial({color:0x421516,roughness:.44,metalness:.08});
 const add=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const cable=(points,radius,mat)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,radius,6,false),mat,0,0,0);
 // Structural ribs sit above jumping height and frame the uninterrupted floor.
 for(const z of [7,19,31,43]){
  cable([[.35,5.8,z],[4,8.5,z],[14,10.6,z],[24,11.5,z],[34,10.6,z],[44,8.5,z],[47.65,5.8,z]],.19,steel);
  cable([[.35,6.5,z],[4,9.2,z],[14,11.3,z],[24,12.2,z],[34,11.3,z],[44,9.2,z],[47.65,6.5,z]],.09,materials.rust);
 }
 // The organ suspended above the arena is its landmark, outside the movement volume.
 const organ=add(new THREE.SphereGeometry(1,20,14),flesh,24,8.6,17);organ.scale.set(1.5,2.1,1.15);organ.name='SuspendedOrgan';
 for(let i=0;i<5;i++){const ring=add(new THREE.TorusGeometry(1.7+i*.08,.055,6,36),bone,24,7.3+i*.65,17);ring.rotation.x=Math.PI/2;}
 for(const side of [-1,1]){cable([[24+side*.8,10,17],[24+side*3,10.6,18],[24+side*5,9.3,16],[24+side*8,10.8,17]],.105,materials.rust);cable([[24+side*1.4,8,17],[24+side*2,7.3,16],[24+side*2.3,8.1,17],[24+side*3,11.1,17]],.055,steel);}
 const core=add(new THREE.SphereGeometry(.52,16,12),materials.red,24,8.55,15.96);core.name='OrganHeart';
 function sign(text,sub,x,y,z,width=5){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#15191a';g.fillRect(0,0,1024,256);g.fillStyle='#bdbba6';g.fillRect(22,24,6,208);g.font='bold 82px monospace';g.fillText(text,55,119);g.font='28px monospace';g.fillStyle='#a85543';g.fillText(sub,58,186);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:t});const p=add(new THREE.PlaneGeometry(width,width/4),m,x,y,z);p.name='FoundrySign_'+text;return p;}
 sign('BLOODWORKS','SECTOR 09 / MATERIAL RECOVERY',24,5.9,.2,12);
 sign('NO RESCUE','REMAIN IN THE LIGHT',7.5,3.4,.23,5.5);
 sign('INTAKE 04','BIOLOGICAL WASTE',39.5,3.4,.23,5.5);
 // Warning bands and vent faces make each cover unit read as equipment.
 const ventGeo=new THREE.BoxGeometry(2.85,.055,.04),vents=new THREE.InstancedMesh(ventGeo,steel,112);let n=0;const o=new THREE.Object3D();
 for(const[x,z]of [[14,14],[34,14],[14,34],[34,34]])for(const side of[-1,1]){for(let j=0;j<14;j++){o.position.set(x,.7+j*.17,z+side*2.155);o.updateMatrix();vents.setMatrixAt(n++,o.matrix);}const label=sign('KEEP CLEAR','PRESSURIZED / 09',x,4.5,z+side*2.16,2.6);if(side<0)label.rotation.y=Math.PI;}
 vents.count=n;vents.instanceMatrix.needsUpdate=true;root.add(vents);
 // Stable contact stains use one atlas and instancing, never extra colliders.
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');let seed=77;for(let i=0;i<240;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed/4294967296*Math.PI*2;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=Math.sqrt(seed/4294967296)*112;g.fillStyle=i%3?'rgba(18,12,10,.08)':'rgba(65,12,8,.1)';g.beginPath();g.ellipse(128+Math.cos(a)*r,128+Math.sin(a)*r,4+i%17,2+i%9,a,0,Math.PI*2);g.fill();}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const stains=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),22);
 for(let i=0;i<22;i++){o.position.set(3+(i*17.3)%42,.012,3+(i*11.1)%42);o.rotation.set(-Math.PI/2,0,i*2.3);o.scale.setScalar(3+i%4);o.updateMatrix();stains.setMatrixAt(i,o.matrix);}stains.instanceMatrix.needsUpdate=true;root.add(stains);
 return{organ,core};
}
