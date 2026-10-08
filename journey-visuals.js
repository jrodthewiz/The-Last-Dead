import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

const CELL = 4;
const STATION_OFFSET = 1.4;
const STATION_SCALE = .82;
const clamp = value => Math.max(0, Math.min(1, value));
const LABELS = {
 'cargo-pump':['RECEIVING LINE','CARGO PUMP'], 'ward-a-relay':['ISOLATION A','RETURN CIRCUIT'],
 'drain-relay':['ISOLATION D','DRAIN CIRCUIT'], 'name-reliquary':['BURIAL LEDGER','RECOVER THE NAMES'],
 'name-return':['COURT OF NAMES','RETURN THE NAMES'], 'nave-chime':['I / NAVE','CONTAINMENT CHIME'],
 'tower-chime':['II / TOWER','CONTAINMENT CHIME'], 'chancel-chime':['III / CHANCEL','CONTAINMENT CHIME'],
 'transfer-stop':['TRANSFER INTAKE','EMERGENCY BRAKE'],
};

function labelTexture(lines) {
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle='#e1d9c5';ctx.fillRect(0,0,512,128);ctx.fillStyle='#292b29';
 ctx.fillRect(8,8,496,3);ctx.fillRect(8,117,496,3);ctx.textAlign='center';
 ctx.font='bold 30px monospace';ctx.fillText(lines[0],256,53,480);
 ctx.font='22px monospace';ctx.fillText(lines[1],256,91,480);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

// Presentation owns no gameplay state or collision. All assemblies stay inside
// the reserved station cell; the simulation's exact operating point stays free.
export class JourneyVisuals {
 constructor(world,course) {
  this.root=new THREE.Group();this.root.name='NoFurtherTransfersMechanisms';
  this.root.userData.noBatch=true;this.root.userData.afterlifeSkip=true;
  this.entries=[];this.geometries=new Set();this.materials=new Set();this.textures=new Set();
  this.disposed=false;
  if(!course?.journeyEnabled)return;
  world.add(this.root);
  const art=course.artDirection||{};
  // The close player light is deliberately strong. Calibrate only these new
  // service props in linear space so their hue survives without clipped faces.
  const material=(color,metalness=.35,roughness=.86)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});m.color.multiplyScalar(.3);this.materials.add(m);return m;};
  this.steel=material(art.panelSurface??0x4f4445);
  this.trim=material(art.trimSurface??0x825148,.4,.88);
  this.porcelain=material(art.wallSurface??0xb8ae99,.05,.9);
  this.dark=material(0x242725,.2,.9);
  this.brass=material(art.accent2??0xd4b678,.62,.84);
  this.box=this.geometry(new THREE.BoxGeometry(1,1,1));
  this.cylinder=this.geometry(new THREE.CylinderGeometry(1,1,1,12));
  this.ring=this.geometry(new THREE.TorusGeometry(1,.095,6,24));
  for(const station of course.journeyStations||[])this.build(station,course);
  const attached=new Set(),attachedMaterials=new Set();this.root.traverse(node=>{if(node.geometry)attached.add(node.geometry);if(node.material)attachedMaterials.add(node.material);});
  for(const geometry of this.geometries)if(!attached.has(geometry)){geometry.dispose();this.geometries.delete(geometry);}
  for(const material of this.materials)if(!attachedMaterials.has(material)){material.dispose();this.materials.delete(material);}
  this.root.updateMatrixWorld(true);
 }
 geometry(geometry){this.geometries.add(geometry);return geometry;}
 mesh(group,geometry,material,x,y,z,sx=1,sy=1,sz=1){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
  mesh.receiveShadow=true;group.add(mesh);return mesh;
 }
 build(station,course){
  const group=new THREE.Group();group.name=`JourneyStation_${station.id}`;
  // The front faces the room centre, with a deterministic cell-side offset.
  const room=course.rooms?.find(room=>room.id===station.roomId), dx=(room?.center.x??station.x)-station.x, dz=(room?.center.y??station.y)-station.y;
  const yaw=Math.abs(dx)+Math.abs(dz)>.01?Math.atan2(dx,dz):0;
  group.rotation.y=yaw;group.scale.setScalar(STATION_SCALE);group.position.set(station.x*CELL-Math.sin(yaw)*STATION_OFFSET,0,station.y*CELL-Math.cos(yaw)*STATION_OFFSET);
  group.userData.stationId=station.id;group.userData.operatingPoint={x:station.x*CELL,z:station.y*CELL};
  this.root.add(group);
  const staticRoot=new THREE.Group(),moving=new THREE.Group();group.add(staticRoot,moving);
  const box=(m,x,y,z,sx,sy,sz)=>this.mesh(staticRoot,this.box,m,x,y,z,sx,sy,sz);
  const cylinder=(m,x,y,z,sx,sy,sz)=>this.mesh(staticRoot,this.cylinder,m,x,y,z,sx,sy,sz);
  box(this.dark,0,.08,0,1.25,.16,.85);
  box(this.trim,0,.18,0,1.12,.08,.75);
  for(const x of [-.43,.43])for(const z of [-.28,.28])cylinder(this.brass,x,.23,z,.045,.045,.045);
  const entry={id:station.id,kind:station.kind,root:group,moving,status:null};
  if(station.kind==='pump'){
   cylinder(this.steel,0,.88,0,.39,1.2,.39);
   for(const y of [.34,1.4])cylinder(this.trim,0,y,0,.46,.12,.46);
   const axle=cylinder(this.dark,0,.9,.3,.11,.36,.11);axle.rotation.x=Math.PI/2;
   const wheel=new THREE.Group();wheel.position.set(0,.9,.43);moving.add(wheel);
   this.mesh(wheel,this.ring,this.brass,0,0,0,.35,.35,.35);
   for(let i=0;i<4;i++){const spoke=this.mesh(wheel,this.box,this.trim,0,0,0,.055,.65,.055);spoke.rotation.z=i*Math.PI/4;}
   this.mesh(wheel,this.cylinder,this.brass,0,0,0,.12,.14,.12).rotation.x=Math.PI/2;
   entry.wheel=wheel;
   for(const x of [-.5,.5])cylinder(this.trim,x,.72,-.2,.08,1,.08);
   const dialMaterial=new THREE.MeshBasicMaterial({color:0x222827}),dialInk=new THREE.MeshBasicMaterial({color:0xc3bfac});this.materials.add(dialMaterial);this.materials.add(dialInk);
   const gauge=cylinder(dialMaterial,0,1.83,.22,.22,.065,.22);gauge.rotation.x=Math.PI/2;
   for(let i=0;i<7;i++){const angle=-1.15+i*2.3/6,tick=box(dialInk,Math.sin(angle)*.17,1.83+Math.cos(angle)*.17,.257,.018,.034,.012);tick.rotation.z=-angle;}
   const needle=new THREE.Group();needle.position.set(0,1.83,.26);moving.add(needle);
   this.mesh(needle,this.box,dialInk,0,.075,0,.018,.15,.012);entry.needle=needle;
  }else if(station.kind==='relay'){
   box(this.porcelain,0,1.02,0,1.06,1.55,.48);
   box(this.dark,0,1.2,.27,.78,.72,.035);
   for(const x of [-.26,0,.26])box(this.brass,x,1.2,.3,.075,.57,.04);
   const shutter=this.mesh(moving,this.box,this.steel,0,1.86,.35,.83,.77,.08);entry.shutter=shutter;
   const handle=new THREE.Group();handle.position.set(.29,.69,.42);moving.add(handle);
   this.mesh(handle,this.box,this.trim,0,.17,0,.06,.34,.06);
   this.mesh(handle,this.cylinder,this.dark,0,.34,0,.08,.25,.08).rotation.z=Math.PI/2;entry.handle=handle;
  }else if(station.kind==='reliquary'||station.kind==='socket'){
   box(this.porcelain,0,.6,0,1.04,.8,.65);
   box(this.dark,0,1.04,0,.85,.05,.52);
   const casket=new THREE.Group();casket.position.y=1.08;moving.add(casket);
   const body=this.mesh(casket,this.box,this.trim,0,.21,0,.75,.42,.46);
   this.mesh(casket,this.box,this.brass,0,.46,0,.83,.08,.53);
   for(const x of [-.27,0,.27])this.mesh(casket,this.box,this.porcelain,x,.22,.244,.17,.25,.025);
   for(const x of [-.33,.33])this.mesh(casket,this.ring,this.brass,x,.22,.26,.07,.07,.07);
   body.name='NameLedgerCasket';entry.casket=casket;
   box(this.trim,0,.96,.39,1.02,.11,.08);
  }else if(station.kind==='chime'){
   for(const x of [-.45,.45])box(this.trim,x,1.28,0,.12,2.1,.18);
   box(this.trim,0,2.27,0,1.06,.14,.2);
   const bellRoot=new THREE.Group();bellRoot.position.y=2.14;moving.add(bellRoot);
   const profile=[[.09,0],[.14,-.08],[.2,-.3],[.24,-.57],[.37,-.82],[.46,-.9],[.48,-.96],[.42,-1.01],[.38,-.95],[.3,-.81],[.16,-.32],[.09,-.13]];
   const bellGeometry=this.geometry(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),24));
   this.mesh(bellRoot,bellGeometry,this.brass,0,0,0);
   const striker=this.mesh(bellRoot,this.cylinder,this.dark,0,-.58,0,.035,.8,.035);
   this.mesh(bellRoot,this.cylinder,this.trim,0,-.98,0,.09,.13,.09);
   entry.bell=bellRoot;entry.striker=striker;
  }else{
   box(this.steel,0,.92,0,1.15,1.35,.58);
   box(this.porcelain,0,1.45,.32,.87,.22,.035);
   const brake=new THREE.Group();brake.position.set(0,.65,.36);moving.add(brake);
   this.mesh(brake,this.box,this.brass,0,.34,0,.08,.68,.08);
   this.mesh(brake,this.cylinder,this.trim,0,.68,0,.085,.55,.085).rotation.z=Math.PI/2;entry.brake=brake;
   const drum=this.mesh(moving,this.cylinder,this.trim,0,1.2,-.37,.3,.88,.3);drum.rotation.z=Math.PI/2;entry.drum=drum;
  }
  // Material merging keeps the many authored fasteners and supports bounded.
  const buckets=new Map();staticRoot.updateMatrixWorld(true);
  for(const mesh of staticRoot.children){mesh.updateMatrix();const g=mesh.geometry.clone().applyMatrix4(mesh.matrix);const list=buckets.get(mesh.material)||[];list.push(g);buckets.set(mesh.material,list);}
  staticRoot.clear();
  for(const [material,parts] of buckets){const merged=mergeGeometries(parts,false);for(const part of parts)part.dispose();this.geometry(merged);this.mesh(staticRoot,merged,material,0,0,0);}
  const texture=labelTexture(LABELS[station.id]||[station.label,'TRANSFER SERVICE']);
  if(texture){this.textures.add(texture);const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});this.materials.add(material);this.mesh(group,this.box,material,0,2.65,0,1.8,.45,.028).name='StationInstructionPlate';}
  const signalMaterial=new THREE.MeshStandardMaterial({color:0xe2a35e,emissiveIntensity:.2,roughness:.86});signalMaterial.color.multiplyScalar(.3);signalMaterial.emissive.copy(signalMaterial.color);this.materials.add(signalMaterial);
  entry.signal=this.mesh(group,this.cylinder,signalMaterial,-.42,1.68,.43,.065,.04,.065);entry.signal.rotation.x=Math.PI/2;
  this.entries.push(entry);
 }
 update(run,nowMs=0,reducedMotion=false){
  const journey=run?.journey;if(!journey||this.disposed)return;
  const time=Number.isFinite(run.time)?run.time:nowMs*.001;
  for(const entry of this.entries){
   const state=journey.stations?.find(station=>station.id===entry.id);if(!state)continue;
   const complete=state.status==='complete',active=state.status==='active';
   if(entry.status!==state.status){entry.status=state.status;entry.signal.material.color.setHex(complete?0xb0c7aa:active?0xe2a35e:0x676860).multiplyScalar(.3);entry.signal.material.emissive.copy(entry.signal.material.color);entry.signal.material.emissiveIntensity=active?.3:complete?.12:0;}
   const hold=active?clamp(journey.progress||0):complete?1:0;
   if(entry.wheel){
    if(complete&&entry.pumpStarted==null)entry.pumpStarted=time-(journey.elapsed||0);
    const cycling=journey.phase==='cycling',elapsed=Math.min(3,journey.elapsed||0);
    entry.wheel.rotation.z=reducedMotion?(complete?Math.PI/4:0):cycling?Math.PI/2+elapsed*4:complete?Math.PI/2+12+Math.max(0,time-entry.pumpStarted-3)*.5:hold*Math.PI/2;
    entry.needle.rotation.z=.95-(cycling?clamp(elapsed/3):complete?1:hold*.25)*1.9;
   }
   if(entry.shutter)entry.shutter.position.y=1.86-hold*.66;
   if(entry.handle)entry.handle.rotation.x=-hold*Math.PI*.62;
   if(entry.casket){entry.casket.visible=entry.kind==='reliquary'?!complete:complete;entry.casket.position.y=1.08+(reducedMotion?0:active?Math.sin(time*1.5)*.025:0);}
   if(entry.bell){const ringing=journey.phase==='chord'||complete&&journey.phase!=='complete';entry.bell.rotation.z=reducedMotion?0:ringing?Math.sin(time*5)*.13:0;entry.striker.rotation.z=-entry.bell.rotation.z*.6;}
   if(entry.brake)entry.brake.rotation.x=-hold*1.4;
   if(entry.drum){
    const stopping=journey.phase==='shutdown'||journey.phase==='complete';
    if(stopping&&entry.stopStarted==null)entry.stopStarted=time-(journey.elapsed||0);
    const elapsed=Math.min(5,journey.elapsed||0),angle=stopping?1.4*(entry.stopStarted+elapsed-elapsed*elapsed/10):time*1.4;
    entry.drum.rotation.x=reducedMotion?0:angle;
   }
  }
 }
 diagnostics(){let meshes=0,triangles=0;this.root.traverse(node=>{if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});return{stations:this.entries.length,meshes,triangles,geometries:this.geometries.size,materials:this.materials.size};}
 // Renderer world disposal is deferred while compileAsync polls its resources.
 // Release references immediately; outgoing-world disposal owns GPU release.
 release(){this.entries.length=0;this.geometries.clear();this.materials.clear();this.textures.clear();this.disposed=true;}
 dispose(){if(this.disposed)return;for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.root.removeFromParent();this.release();}
}
