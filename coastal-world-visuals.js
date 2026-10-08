import * as THREE from './vendor/three.module.js';
import {harborSurface} from './harbor-detail.js';
import {buildCoastalNeighborhood} from './coastal-neighborhood-visuals.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {buildCapeTerrain} from './coastal-terrain-visuals.js';

// The same land rectangles, roads and lots drive the map and collision data.
export function buildCoastalScenery(world){
 const c=world.course.coastal;if(!c)return;
 const m=world.materials;
 m.coastGrass=new THREE.MeshStandardMaterial({color:0x686e4c,roughness:1});
 m.coastStone=new THREE.MeshStandardMaterial({color:0x59625e,roughness:.96});
 m.coastWhite=new THREE.MeshStandardMaterial({color:0xc7c3ae,roughness:.88});
 m.coastRed=new THREE.MeshStandardMaterial({color:0x713f34,roughness:.8});
 harborSurface(m.coastGrass,'grass');
 for(const p of [{x:224,z:60,width:448,depth:120},{x:256,z:217,width:256,depth:194}])world.box(p.x,-.20,p.z,p.width,.36,p.depth,'coastGrass','CoastalLand');
 world.terrain=buildCapeTerrain(world);
 // Keep the original working port's paved surface and its six interiors.
 world.box(64,-.015,60,128,.09,120,'asphalt','HarborGround');
 for(const r of c.roads){
  world.box(r.x,.012,r.z,r.width+.8,.08,r.depth+.8,'concrete','CoastalRoadShoulder');
  world.box(r.x,.063,r.z,r.width,.04,r.depth,'asphalt','CoastalRoad');
  const horizontal=r.width>r.depth,length=horizontal?r.width:r.depth;
  const crosses=(x,z,pad=0)=>c.roads.some(other=>other!==r&&(other.width>other.depth)!==horizontal&&Math.abs(x-other.x)<other.width/2+pad&&Math.abs(z-other.z)<other.depth/2+pad);
  for(let t=-length/2+5;t<length/2-3;t+=10){
   const x=r.x+(horizontal?t:0),z=r.z+(horizontal?0:t);
   if(!crosses(x,z,3))world.box(x,.10,z,horizontal?4:.13,.014,horizontal?.13:4,'stripe','CoastalRoadMark');
  }
  // Two-metre pedestrian verges stop at junctions; all remain walkable.
  for(const side of [-1,1])for(let t=-length/2+1;t<length/2;t+=2){
   const offset=(horizontal?r.depth:r.width)/2+1.2;
   const x=r.x+(horizontal?t:side*offset),z=r.z+(horizontal?side*offset:t);
   if(x<129&&z<120)continue; // Preserve the original port's authored paving.
   if(crosses(x,z,.3))continue;
   world.box(x,.095,z,2,.14,2,'concrete','CoastalSidewalk');
   world.box(x+(horizontal?0:-side*.95),.17,z+(horizontal?-side*.95:0),horizontal?2:.12,.08,horizontal?.12:2,'coastWhite','CoastalCurb');
  }
 }
 // Paint crossings at the main spine junctions, outside the turning square.
 for(const z of [112,176,232])for(const side of [-1,1])for(let lane=-4.8;lane<=4.8;lane+=1.2){
  world.box(232+lane,.108,z+side*8.6,.65,.014,2.4,'coastWhite','CoastalCrosswalk');
 }
 for(const b of c.buildings){
  world.box(b.x,.035,b.z,b.width+1.8,.20,b.depth+1.8,'concrete','CoastalBuildingApron');
  const road=c.roads.filter(r=>r.width>r.depth&&Math.abs(b.x-r.x)<r.width/2).sort((a,r)=>Math.abs(a.z-b.z)-Math.abs(r.z-b.z))[0];
  if(road){
   const side=Math.sign(road.z-b.z),start=b.z+side*(b.depth/2+.9),end=road.z-side*(road.depth/2+2.2),length=Math.abs(end-start);
   if(length>.2&&length<24)world.box(b.x,.055,(start+end)/2,2.4,.12,length,'concrete','CoastalEntranceWalk');
  }
 }
 // Continuous sea walls make every solid coast edge visible to the player.
 const shore=[[0,0,448,0],[448,0,448,416],[448,416,128,416],[128,416,128,120],[128,120,0,120],[0,120,0,0]];
 const rockGeo=new THREE.DodecahedronGeometry(1,0),rocks=[];
 let seed=20261003;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(const [x,z,xx,zz]of shore){
  const length=Math.hypot(xx-x,zz-z),dx=(xx-x)/length,dz=(zz-z)/length;
  world.box((x+xx)/2,-.45,(z+zz)/2,Math.abs(xx-x)||.75,1.35,Math.abs(zz-z)||.75,'coastStone','CoastalSeaWall');
  world.box((x+xx)/2,.22,(z+zz)/2,Math.abs(xx-x)||.9,.16,Math.abs(zz-z)||.9,'concrete','CoastalSeaWallCap');
  // Rail at the shore has the same boundary as the movement grid.
  world.box((x+xx)/2,1.05,(z+zz)/2,Math.abs(xx-x)||.08,.08,Math.abs(zz-z)||.08,'rust','CoastalRail');
  world.box((x+xx)/2,.63,(z+zz)/2,Math.abs(xx-x)||.055,.055,Math.abs(zz-z)||.055,'rust','CoastalRail');
  for(let t=2;t<length;t+=5){
   world.box(x+dx*t,.64,z+dz*t,.085,1.05,.085,'rust','CoastalRailPost');
  }
  // Irregular overlapping riprap sits below the parapet, clear of walking land.
  for(let t=.7;t<length-.7;t+=.9+rand()*1.6)for(let row=0;row<2;row++){
   const along=Math.min(length-.3,t+rand()*.7),out=.9+row*.95+rand()*.6;
   rocks.push({x:x+dx*along+dz*out,z:z+dz*along-dx*out,y:-.9-row*.25,s:.55+rand()*.7,r:rand()*6.28});
  }
 }
 const rubble=createCoastalInstances(rockGeo,m.coastStone,rocks.length),pose=new THREE.Object3D();
 rocks.forEach((r,i)=>{pose.position.set(r.x,r.y,r.z);pose.rotation.set(r.r*.3,r.r,.3);pose.scale.set(r.s,r.s*.65,r.s*.8);pose.updateMatrix();rubble.setMatrixAt(i,pose.matrix);rubble.setColorAt(i,new THREE.Color().setHSL(.12+(i%5)*.012,.07,.29+(i%7)*.025));});
 rubble.name='CoastalRiprap';rubble.receiveShadow=true;rubble.computeBoundingSphere();world.root.add(rubble);
 const lighthouse=c.landmarks.find(p=>p.id.includes('lighthouse'));
 const lx=c.lighthouse?.x??(lighthouse?lighthouse.x*4:352),lz=c.lighthouse?.z??292;
 // A recognisable destination visible from both coastal drives.
 const tower=new THREE.Group();tower.name='CapeLighthouse';tower.position.set(lx,0,lz);world.root.add(tower);
 const part=(geometry,material,y)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;tower.add(mesh);return mesh;};
 part(new THREE.CylinderGeometry(3.4,4.1,1,20),m.coastStone,.5);
 part(new THREE.CylinderGeometry(1.65,2.8,18,24),m.coastWhite,9.5);
 part(new THREE.CylinderGeometry(1.9,2.15,3,24),m.coastRed,13);
 part(new THREE.CylinderGeometry(2.5,2.5,.35,24),m.dark,18.6);
 part(new THREE.CylinderGeometry(1.5,1.5,2.4,16),new THREE.MeshStandardMaterial({color:0xa7c5bc,metalness:.45,roughness:.22,emissive:0xddad5e,emissiveIntensity:.45}),20);
 part(new THREE.ConeGeometry(2.3,2,24),m.coastRed,22.1);
 part(new THREE.CylinderGeometry(.07,.07,4,8),m.rust,24);
 // Architectural detail stays inside the tower's existing collision footprint.
 const towerBox=(x,y,z,w,h,d,material)=>{const mesh=new THREE.Mesh(world.unitBox,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);tower.add(mesh);return mesh;};
 towerBox(0,1.65,2.67,1.35,2.4,.18,m.coastStone);
 towerBox(0,1.6,2.79,.96,2.05,.06,m.coastRed);
 towerBox(.32,1.55,2.85,.08,.18,.07,m.coastWhite);
 for(const y of [5,9,15]){
  const radius=2.8-(y-.5)/18*1.15;
  towerBox(0,y,radius,.75,1.1,.16,m.coastStone);
  towerBox(0,y,radius+.09,.46,.82,.03,m.dark);
  towerBox(0,y-.57,radius+.15,.95,.12,.32,m.coastWhite);
 }
 for(const y of [19.05,19.7]){
  const ring=part(new THREE.TorusGeometry(2.3,.045,6,48),m.rust,y);ring.rotation.x=Math.PI/2;
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  towerBox(Math.sin(a)*2.3,19.2,Math.cos(a)*2.3,.055,1.05,.055,m.rust);
  towerBox(Math.sin(a)*1.49,20,Math.cos(a)*1.49,.055,2.4,.055,m.coastStone);
 }
 world.sign('CAPE SIGNAL / LIGHTHOUSE',lx,2.8,lz-7,Math.PI,6);
 for(const d of c.districts.filter(d=>d.id!=='harbor'))world.sign(d.name.toUpperCase(),d.x+10,3.7,d.z+(d.id==='coastal-park'?-9:9),Math.PI,6);
 world.sign('EAST ROAD / ALL DISTRICTS →',119,3.6,52,Math.PI,6);
 world.sign('← BLACKWATER / NETMAKERS',145,3.6,60,0,6);
 world.sign('COAST ROAD / CAPE SIGNAL →',235,3.6,116,0,6);
 buildCoastalNeighborhood(world);
 // Legacy layouts retain low groundcover; generated neighborhoods use authored
 // tree courts and furniture instead of scattering shrubs through their alleys.
 const shrubs=[];
 for(let i=0;i<(c.neighborhoods?0:850);i++){
  const x=138+rand()*234,z=10+rand()*294;
  if(c.roads.some(r=>Math.abs(x-r.x)<r.width/2+3&&Math.abs(z-r.z)<r.depth/2+3)||c.buildings.some(b=>Math.abs(x-b.x)<b.width/2+3&&Math.abs(z-b.z)<b.depth/2+3)||c.buildings.some(b=>Math.abs(x-b.x)<1.8)||Math.hypot(x-lx,z-lz)<9)continue;
  shrubs.push({x,z,s:.45+rand()*.75});
 }
 if(shrubs.length){
  const plants=createCoastalInstances(new THREE.IcosahedronGeometry(1,1),m.coastGrass,shrubs.length);
  shrubs.forEach((p,i)=>{pose.position.set(p.x,p.s*.16,p.z);pose.rotation.set(0,rand()*6.28,0);pose.scale.set(p.s,p.s*.3,p.s*.8);pose.updateMatrix();plants.setMatrixAt(i,pose.matrix);});plants.name='CoastalLowScrub';plants.computeBoundingSphere();world.root.add(plants);
 }
 buildSky(world);
 batchCoastalSlabs(world);
 world.diagnostics.coastal={width:c.width,depth:c.depth,districts:c.districts.length,buildings:c.buildings.length,landmarks:c.landmarks.length,coast:'L-shaped peninsula with sea walls and open water on every outer side'};
}

function batchCoastalSlabs(world){
 const groups=new Map();
 for(const mesh of [...world.root.children]){
  if(mesh.isInstancedMesh||mesh.geometry!==world.unitBox||!mesh.name.startsWith('Coastal'))continue;
  const key=`${mesh.material.uuid}/${Math.floor(mesh.position.x/64)}/${Math.floor(mesh.position.z/64)}`;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 }
 for(const meshes of groups.values()){
  const batch=createCoastalInstances(world.unitBox,meshes[0].material,meshes.length);batch.name='CoastalStatic';batch.receiveShadow=true;
  meshes.forEach((mesh,i)=>{mesh.updateMatrix();batch.setMatrixAt(i,mesh.matrix);mesh.removeFromParent();});batch.computeBoundingSphere();world.root.add(batch);
 }
}

function buildSky(world){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,512);
 gradient.addColorStop(0,'#476477');gradient.addColorStop(.32,'#7998a8');gradient.addColorStop(.5,'#a8b9b8');gradient.addColorStop(.58,'#8ca3a5');gradient.addColorStop(1,'#5b7377');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
 // Soft banks of coastal cloud; the water reflects an analytic approximation.
 for(let i=0;i<30;i++){
  const x=(i*197)%1100-40,y=115+(i*37)%95,r=65+(i*17)%70;
  const cloud=ctx.createRadialGradient(x,y,3,x,y,r);cloud.addColorStop(0,'rgba(219,224,216,.12)');cloud.addColorStop(1,'rgba(219,224,216,0)');ctx.fillStyle=cloud;ctx.save();ctx.translate(0,y);ctx.scale(1,.28);ctx.translate(0,-y);ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,48,24),new THREE.MeshBasicMaterial({map,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false}));
 sky.name='CoastalSky';sky.position.set(192,0,160);sky.renderOrder=-10;world.root.add(sky);
}
