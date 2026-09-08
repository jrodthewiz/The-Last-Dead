import * as THREE from './vendor/three.module.js';
export const HORROR_SECTOR_THEMES = Object.freeze({
 bloodworks: Object.freeze({ background: 0x0b0e18, fog: 0x101817, fogNear: 32, fogFar: 100, key: 0xffd2a3, rim: 0xe83b23, accent: 0xff3154 }),
 ossuary: Object.freeze({ background: 0x090b17, fog: 0x17132b, fogNear: 26, fogFar: 92, key: 0xc5b8ff, rim: 0x745cff, accent: 0xc98cff }),
 choir: Object.freeze({ background: 0x140c0b, fog: 0x261612, fogNear: 24, fogFar: 88, key: 0xffc484, rim: 0xd54832, accent: 0xffb15e }),
});
export function getHorrorSectorTheme(course = {}) {
 const id = String(course.id || course.sectorId || (course.index === 1 ? 'ossuary' : course.index === 2 ? 'choir' : 'bloodworks')).toLowerCase();
 return { id, ...(HORROR_SECTOR_THEMES[id] || HORROR_SECTOR_THEMES.bloodworks) };
}
export function buildHorrorDetails(root,materials,course={}){
 const sectorTheme=getHorrorSectorTheme(course);
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
 if(sectorTheme.id==='bloodworks')sign('BLOODWORKS','SECTOR 09 / MATERIAL RECOVERY',24,5.9,.2,12);
 sign('NO RESCUE','REMAIN IN THE LIGHT',7.5,3.4,.23,5.5);
 sign('INTAKE 04','BIOLOGICAL WASTE',39.5,3.4,.23,5.5);
 const o=new THREE.Object3D();
 // Stable contact stains use one atlas and instancing, never extra colliders.
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');let seed=77;for(let i=0;i<240;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed/4294967296*Math.PI*2;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=Math.sqrt(seed/4294967296)*112;g.fillStyle=i%3?'rgba(18,12,10,.08)':'rgba(65,12,8,.1)';g.beginPath();g.ellipse(128+Math.cos(a)*r,128+Math.sin(a)*r,4+i%17,2+i%9,a,0,Math.PI*2);g.fill();}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const stains=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),22);
 for(let i=0;i<22;i++){o.position.set(3+(i*17.3)%42,.012,3+(i*11.1)%42);o.rotation.set(-Math.PI/2,0,i*2.3);o.scale.setScalar(3+i%4);o.updateMatrix();stains.setMatrixAt(i,o.matrix);}stains.instanceMatrix.needsUpdate=true;root.add(stains);
 if (sectorTheme.id === 'ossuary') {
  const boneAccent = materials.enemyViolet || bone;
  for (const x of [6, 16, 26, 36, 46]) {
   const spine = add(new THREE.CylinderGeometry(.12, .18, 7.6, 9), bone, x, 3.8, 2.7);
   spine.rotation.z = Math.PI / 2;
   for (let rib = 0; rib < 5; rib++) {
    const ribMesh = add(new THREE.TorusGeometry(1.35 - rib * .08, .075, 7, 22, Math.PI), bone, x, 1.2 + rib * .95, 2.88);
    ribMesh.rotation.set(0, Math.PI / 2, Math.PI);
   }
  }
  for (const [x, z] of [[7, 9], [41, 9], [7, 33], [41, 33]]) {
   const skull = add(new THREE.IcosahedronGeometry(.48, 1), boneAccent, x, 5.4, z);
   skull.name = 'OssuarySkull';
   const eyeL = add(new THREE.SphereGeometry(.07, 8, 6), materials.violet, x - .18, 5.46, z - .4);
   const eyeR = add(new THREE.SphereGeometry(.07, 8, 6), materials.violet, x + .18, 5.46, z - .4);
   eyeL.scale.y = eyeR.scale.y = .65;
  }
  sign('OSSUARY', 'SECTOR 17 / THE DEAD ARE LOAD-BEARING', 24, 6.25, .24, 11);
 } else if (sectorTheme.id === 'choir') {
  const bellMetal = materials.gold || steel;
  for (const [x, z] of [[7, 8], [17, 17], [27, 8], [37, 17], [9, 34], [24, 30], [40, 34]]) {
   const bell = new THREE.Group();
   bell.name = 'ChoirBell';
   bell.position.set(x, 5.25 + ((x + z) % 3) * .18, z);
   const shell = new THREE.Mesh(new THREE.TorusGeometry(.42, .13, 9, 26), bellMetal);
   shell.rotation.x = Math.PI / 2;
   const lip = new THREE.Mesh(new THREE.CylinderGeometry(.5, .58, .12, 16), bellMetal);
   lip.position.y = -.24;
   const clapper = new THREE.Mesh(new THREE.SphereGeometry(.105, 8, 6), materials.orange);
   clapper.position.y = -.52;
   bell.add(shell, lip, clapper);
   root.add(bell);
   const cablePoints = [new THREE.Vector3(x, 7.5, z), new THREE.Vector3(x, 6.6, z + .08), new THREE.Vector3(x, 5.74, z)];
   const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints), 12, .035, 5, false), steel);
   root.add(cable);
  }
  for (const [x, z] of [[8, 24], [24, 22], [40, 24]]) {
   const mouth = add(new THREE.TorusGeometry(1.05, .14, 10, 32), flesh, x, 2.35, z);
   mouth.rotation.x = Math.PI / 2;
   const tongue = add(new THREE.CapsuleGeometry(.08, .62, 4, 8), materials.orange, x, 2.1, z - .03);
   tongue.rotation.x = Math.PI / 2;
  }
  sign('CHOIR OF TEETH', 'THRESHOLD / NO EXIT SIGNAL', 24, 6.25, .24, 12);
 }
 return{organ,core,sector:sectorTheme.id,theme:sectorTheme};
}
