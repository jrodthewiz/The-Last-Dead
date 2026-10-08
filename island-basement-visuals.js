import * as THREE from './vendor/three.module.js';

// An unmistakable lit service ladder at the existing authored dungeon entry.
export function buildBasementReturn(root,course){
  const p=course.basementPortal;
  if(!course.dungeon||!p)return null;
  const group=new THREE.Group();group.name='CustomsBasementReturnStairs';
  group.position.set(p.x*4,0,p.y*4);group.rotation.y=-p.angle;
  const iron=new THREE.MeshStandardMaterial({color:0x53605c,roughness:.72,metalness:.4});
  const amber=new THREE.MeshStandardMaterial({color:0xeab457,emissive:0xd58a2b,emissiveIntensity:.8,roughness:.6});
  const box=(w,h,d,x,y,z,material=iron)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  // Offset behind the spawn: the usable floor remains unobstructed.
  for(const x of [-.65,.65])box(.08,3.25,.09,x,1.65,1.05);
  for(let i=0;i<10;i++)box(1.32,.065,.09,0,.35+i*.3,1.05);
  box(1.7,.46,.13,0,2.9,1.14,amber);
  for(const x of [-1,1])box(.12,.9,.12,x,.45,1.5);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#172421';ctx.fillRect(0,0,512,128);ctx.fillStyle='#f6dba2';ctx.textAlign='center';ctx.font='bold 38px sans-serif';ctx.fillText('↑ BLACKWATER ISLAND',256,53);ctx.font='24px sans-serif';ctx.fillText('CUSTOMS SERVICE STAIRS',256,95);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.42),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(0,2.9,1.06);sign.rotation.y=Math.PI;group.add(sign);
  root.add(group);return group;
}
