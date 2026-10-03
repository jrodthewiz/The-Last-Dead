import * as THREE from './vendor/three.module.js';
import {createHarborTenement} from './community-buildings.js';
import {createModel as makeFence} from './assets/thai-kit/chain-link-fence-panel.js';

// Shared, metre-scaled surface detail avoids stretched UVs on large road slabs.
export function harborSurface(material,kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,512);let seed=9127;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<pixels.data.length;i+=4){const v=kind==='asphalt'?145+random()*70:180+random()*42;pixels.data.set([v,v,v,255],i);}
 ctx.putImageData(pixels,0,0);
 if(kind==='metal'){
  for(let x=0;x<512;x+=16){const g=ctx.createLinearGradient(x,0,x+16,0);g.addColorStop(0,'#656c6b');g.addColorStop(.35,'#c2c6b9');g.addColorStop(.65,'#c2c6b9');g.addColorStop(1,'#656c6b');ctx.fillStyle=g;ctx.fillRect(x,0,16,512);}
  ctx.fillStyle='#615442';for(let i=0;i<90;i++)ctx.fillRect(random()*512,random()*512,1+random()*3,random()*70);
 }else if(kind==='grass'){
  // Soft soil variation and fine blades, without paving joints.
  for(let i=0;i<180;i++){
   const x=random()*512,y=random()*512,r=8+random()*38,g=ctx.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,random()>.5?'rgba(65,72,45,.16)':'rgba(227,215,168,.18)');g.addColorStop(1,'rgba(90,100,65,0)');
   ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.strokeStyle='rgba(68,81,42,.24)';ctx.lineWidth=.7;
  for(let i=0;i<7000;i++){const x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*3-1.5,y-1-random()*4);ctx.stroke();}
 }else if(kind==='concrete'){
  ctx.strokeStyle='#66665f';ctx.lineWidth=2;ctx.strokeRect(1,1,510,510);
  ctx.strokeStyle='#aaaa9e';ctx.lineWidth=3;ctx.strokeRect(5,5,502,502);
 }else{
  ctx.strokeStyle='rgba(40,43,40,.32)';ctx.lineWidth=1;
  for(let i=0;i<6;i++){let x=random()*512,y=random()*512;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<8;j++){x+=random()*30-15;y+=random()*20;ctx.lineTo(x,y);}ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.colorSpace=THREE.SRGBColorSpace;
 material.userData.harborSurface=texture;material.map=texture;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 harborWorldPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 harborPosition=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    harborPosition=instanceMatrix*harborPosition;
   #endif
   harborWorldPosition=(modelMatrix*harborPosition).xyz;`);
  shader.fragmentShader='varying vec3 harborWorldPosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`diffuseColor *= texture2D(map,${kind==='metal'?'vec2(harborWorldPosition.x+harborWorldPosition.z,harborWorldPosition.y)':'harborWorldPosition.xz'}/${kind==='asphalt'?'3.0':'2.0'});`);
 };
 material.customProgramCacheKey=()=>`harbor-surface-${kind}-1`;
}

export function finishHarborDetail(world){
 const root=world.root,template=makeFence(),bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
 template.updateMatrixWorld(true);
 const batches=new Map(),matrix=new THREE.Matrix4(),transform=new THREE.Object3D();
 const walls=[];root.traverse(o=>{if(o.isMesh&&/^(BoundaryWall|BuildingBoundary|NetmakersYardWall|NetmakersGateLeft|NetmakersGateRight|NetmakersStoreBoundary|PowerCutOuterBoundary|PowerCutWingEnd)$/.test(o.name))walls.push(o);});
 let panels=0;
 for(const wall of walls){
  const alongX=wall.scale.x>wall.scale.z,length=alongX?wall.scale.x:wall.scale.z,count=Math.ceil(length/3.1),span=length/count;
  for(let i=0;i<count;i++){
   transform.position.set(wall.position.x+(alongX?-length/2+(i+.5)*span:0),.12,wall.position.z+(alongX?0:-length/2+(i+.5)*span));
   transform.rotation.set(0,alongX?0:Math.PI/2,0);transform.scale.set(span/size.x,Math.max(1.4,wall.scale.y)/size.y,.38/size.z);transform.updateMatrix();
   const centered=new THREE.Matrix4().makeTranslation(-centre.x,-bounds.min.y,-centre.z);
   template.traverse(mesh=>{if(!mesh.isMesh)return;const key=`${mesh.uuid}/${Math.floor(transform.position.x/32)}/${Math.floor(transform.position.z/32)}`;let batch=batches.get(key);if(!batch)batches.set(key,batch={source:mesh,matrices:[]});matrix.copy(transform.matrix).multiply(centered).multiply(mesh.matrixWorld);batch.matrices.push(matrix.clone());});panels++;
  }
  wall.removeFromParent();
 }
 for(const {source,matrices}of batches.values()){const mesh=new THREE.InstancedMesh(source.geometry,source.material,matrices.length);mesh.name='ThaiKitBoundaryFence';matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}
 // Reuse detailed building geometry across the water instead of cube silhouettes.
 const background=root.children.filter(o=>o.name==='FarBankWarehouse');
 // Ground the far-bank silhouette above the analytic wave crests.
 if(!world.course.coastal){world.box(68,-.4,270,240,1.6,44,'concrete','FarBankQuay');
 world.box(68,.52,248.4,240,.24,.8,'dark','FarBankQuayCap');}
 for(const [i,old]of background.entries()){
  // The upstream kit has party walls: use it as a joined waterfront row,
  // facing the playable quay. Interior/collision authority stays in the harbor.
  if(i>=3&&i<=5){
   const model=createHarborTenement({seed:[.43,.71,.28][i-3],floors:i===4?3:2});
   model.name='FarBankCommunityArchitecture';
   model.rotation.y=0;world.fit(model,16,24,18);
   model.position.add(new THREE.Vector3(52+(i-3)*16,.4,262));
   model.traverse(o=>{if(o.isMesh)o.castShadow=false;});
   root.add(model);old.removeFromParent();continue;
  }
  const key=i%2?'bangkok-apartment-block':'concrete-walk-up-flat-block',source=world.thaiWorld.templates.get(key);if(!source)continue;
  const model=source.clone(true);model.name='FarBankArchitecture';world.fit(model,22,13+i%3*5,18);model.position.add(new THREE.Vector3(old.position.x,.4,old.position.z));model.traverse(o=>{if(o.isMesh)o.castShadow=false;});root.add(model);old.removeFromParent();
 }
 // One source model serves parked and driven trucks; no extra factory allocation.
 const truck=world.thaiWorld.templates.get('toyota-hilux').clone(true);truck.name='DriveableThaiHilux';truck.rotation.y=Math.PI/2;world.fit(truck,5.2,2.65,2.4);truck.traverse(o=>{if(o.isMesh)o.castShadow=false;});world.vehicle.add(truck);
 world.diagnostics.detail={fencePanels:panels,fenceDrawCalls:batches.size,vehicle:'Thai Kit Hilux',backgroundBuildings:background.length};
}

export function harborMooring(world,x,z,buoy=false){
 const profile=(buoy?[[0,0],[.45,0],[.65,.18],[.65,.48],[.38,.8],[.13,1],[.13,1.65],[.22,1.7],[.22,1.82],[0,1.82]]:[[0,0],[.24,0],[.24,.12],[.12,.18],[.12,.8],[.22,.84],[.22,.95],[.15,1.04],[0,1.04]]).map(p=>new THREE.Vector2(...p));
 const key=buoy?'buoyGeometry':'bollardGeometry';world[key]??=new THREE.LatheGeometry(profile,12);
 const mesh=new THREE.Mesh(world[key],world.materials.rust);mesh.name=buoy?'NavigationBuoy':'CastMooringBollard';mesh.position.set(x,buoy?-.8:.13,z);mesh.receiveShadow=true;world.root.add(mesh);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(buoy?.145:.125,.025,5,12),world.materials.signal);ring.rotation.x=Math.PI/2;ring.position.set(x,buoy?.55:.78,z);ring.name='MooringReflectiveBand';world.root.add(ring);
}
