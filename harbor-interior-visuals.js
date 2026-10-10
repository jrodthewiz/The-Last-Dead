import {cloneRuntimeObject} from './runtime-clone.js';
import {harborRoomSupplies} from './harbor-interiors.js';
import * as THREE from './vendor/three.module.js';
import {createModel as makeTable} from './assets/thai-kit/folding-laminate-trestle-table.js';
import {createModel as makeChair} from './assets/thai-kit/folding-padded-banquet-chair.js';
import {createModel as makeMeter} from './assets/thai-kit/electric-meter-box.js';

export class HarborInteriorVisuals{
 constructor(world){
  this.world=world;this.root=new THREE.Group();this.root.name='HarborInteriors';world.root.add(this.root);this.rooms=new Map();this.outside=new Map();
  this.lightingRoot=new THREE.Group();this.lightingRoot.name='HarborInteriorLighting';this.root.add(this.lightingRoot);
  this.areaLight=new THREE.HemisphereLight(0xe4e6cc,0x6b6554,0);
  this.practicalLight=new THREE.PointLight(0xffe8b0,0,18,1);
  this.lightingRoot.add(this.areaLight,this.practicalLight);
  this.exteriorLightIntensities=new Map(world.root.children.filter(child=>child.isLight).map(light=>[light,light.intensity]));
  const table=makeTable(),chair=makeChair(),meter=makeMeter();
  const plaster=new THREE.MeshStandardMaterial({color:0x9b9d8e,roughness:.94}),trim=new THREE.MeshStandardMaterial({color:0x435553,roughness:.72,metalness:.3});
  const slab=new THREE.BoxGeometry(1,1,1);
  const box=(g,x,y,z,w,h,d,material,name)=>{const m=new THREE.Mesh(slab,material);m.name=name;m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;g.add(m);return m;};
  const place=(group,source,x,z,w,h,d,yaw=0)=>{const model=cloneRuntimeObject(source);model.rotation.y=yaw;world.fit(model,w,h,d);model.position.add(new THREE.Vector3(x,.14,z));group.add(model);return model;};
  for(const [i,r]of world.course.harborRooms.entries()){
   const accents=[0x526c70,0x647b78,0x8b7756,0x68735a,0x927446,0x536d78];
   const accent=new THREE.MeshStandardMaterial({color:accents[i],roughness:.86});
   const notices=[['EVACUATION RECORDS','MARA VENN / FERRY MECHANIC','NEXT: COLD STORE'],['COLD STORAGE / BAY 02','IDENTIFICATION & RECOVERY','KEEP AISLES CLEAR'],['FERRY MAINTENANCE','12 V STARTER / TESTED','RETURN TO DOCK CIRCUIT'],['NETMAKERS / CHANNEL 06','SAFEHOUSE / REST & STASH','REPORT VIA HARBOUR RADIO'],['DOCK CIRCUIT / CONTROL','BATTERY + DIESEL REQUIRED','CAUTION: AUTOMATIC BELL'],['DOCK DISPATCH / RESERVE','SEALED DIESEL / FERRY STORES','DELIVER TO POWER CONTROL']][i];
   const g=new THREE.Group();g.name=`Room:${r.id}`;g.visible=false;this.root.add(g);this.rooms.set(r.id,g);
   box(g,r.x,.02,r.z,r.width,.22,r.depth,world.materials.concrete,'InteriorFloor');
   box(g,r.x,3.6,r.z,r.width,.18,r.depth,plaster,'InteriorCeiling');
   for(const z of [r.z-r.depth/2,r.z+r.depth/2]){box(g,r.x,1.85,z,r.width,3.5,.18,plaster,'InteriorWall');box(g,r.x,.32,z+(z<r.z?.12:-.12),r.width,.24,.06,trim,'InteriorSkirting');}
   for(const x of [r.x-r.width/2,r.x+r.width/2]){box(g,x,1.85,r.z,.18,3.5,r.depth,plaster,'InteriorWall');box(g,x+(x<r.x?.12:-.12),.32,r.z,.06,.24,r.depth,trim,'InteriorSkirting');}
   for(const side of [-1,1]){
    box(g,r.x+side*(r.width/2-.105),.8,r.z,.025,.72,r.depth-.2,accent,'RoomWallDado');
    box(g,r.x+side*(r.width/2-.125),1.19,r.z,.045,.055,r.depth-.2,trim,'RoomDadoCap');
   }
   box(g,r.x,3.12,r.z-r.depth/2+.11,r.width-.2,.3,.025,accent,'RoomIdentityBand');
   const desk=r.obstacles[0];const workDesk=place(g,table,(desk.minX+desk.maxX)*2,(desk.minY+desk.maxY)*2,2.2,.85,1.4);
   place(g,chair,r.x-r.width/2+1.7,r.z+(r.depth<8?1.25:-1.45),.65,1,.65);
   if(r.width>=10&&r.depth>=8){place(g,table,r.x+r.width/2-1.7,r.z+1.5,2.2,.85,1.4);place(g,chair,r.x+r.width/2-1.7,r.z+2.7,.65,1,.65,Math.PI);}
   // Operational dressing: breaker bank, glazed frames and local work notice.
   const meterX=j=>r.x+(i===4?-2.2+j*.62:-1.5+j*.75);
   for(let j=0;j<(i===4?4:2);j++){const m=place(g,meter,meterX(j),r.z-r.depth/2+.3,.55,.8,.3);m.position.y+=1.1;}
   const lastMeter=meterX(i===4?3:1);
   box(g,(meterX(0)+lastMeter)/2,2.82,r.z-r.depth/2+.15,lastMeter-meterX(0)+.65,.045,.045,trim,'ServiceConduit');
   for(let j=0;j<(i===4?4:2);j++)box(g,meterX(j),2.34,r.z-r.depth/2+.15,.035,.96,.035,trim,'MeterConduit');
   const glass=new THREE.MeshStandardMaterial({color:0x829b9b,roughness:.28,metalness:.25,emissive:0x253737,emissiveIntensity:.35});
   for(const side of [-1,1]){
    const wx=r.x+side*(r.width/2-.13),wz=r.z-1.2;
    box(g,wx,2,wz,.07,1.25,2.4,glass,'SealedInteriorWindow');
    for(const zz of [wz-1.24,wz,wz+1.24])box(g,wx-side*.035,2,zz,.1,1.4,.075,trim,'WindowMullion');
    for(const yy of [1.3,2.7])box(g,wx-side*.035,yy,wz,.1,.08,2.55,trim,'WindowFrame');
    box(g,wx-side*.16,1.28,wz,.35,.09,2.7,plaster,'WindowSill');
    for(let slat=0;slat<4;slat++)box(g,wx-side*.065,2.58-slat*.13,wz,.08,.045,2.38,trim,'WindowUpperBlind');
   }
   for(let z=r.z-r.depth/2+1.5;z<r.z+r.depth/2;z+=3)box(g,r.x,3.43,z,r.width,.12,.1,trim,'CeilingSupport');
   const board=document.createElement('canvas');board.width=512;board.height=384;const ctx=board.getContext('2d');ctx.fillStyle='#403b2d';ctx.fillRect(0,0,512,384);
   ctx.fillStyle='#d8d2ab';ctx.fillRect(14,14,484,356);ctx.fillStyle='#263b39';ctx.font='bold 25px sans-serif';ctx.fillText(r.name,28,50);
   ctx.font='18px sans-serif';['BLACKWATER / '+String(i+1).padStart(2,'0'),...notices].forEach((line,k)=>ctx.fillText(line,28,95+k*40,455));
   ctx.strokeStyle='#62786e';ctx.strokeRect(30,266,180,80);ctx.strokeRect(240,266,240,80);ctx.beginPath();ctx.moveTo(30,306);ctx.lineTo(480,306);ctx.stroke();
   const map=new THREE.CanvasTexture(board);map.colorSpace=THREE.SRGBColorSpace;const notice=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.55),new THREE.MeshStandardMaterial({map,roughness:.9}));notice.name='OperationsNotice';notice.position.set(r.x+r.width/2-1.6,2.15,r.z-r.depth/2+.12);g.add(notice);
   const deskY=new THREE.Box3().setFromObject(workDesk).max.y;const paper=new THREE.MeshStandardMaterial({color:0xe5d9b8,roughness:.9});for(let j=0;j<3;j++)box(g,r.x-r.width/2+1.4+j*.18,deskY+.008+j*.008,r.z,.4,.008,.3,paper,'DeskManifest');
   const rackMaterials={trim,plaster,paper,wood:world.materials.rust};
   for(const p of r.details.parts)box(g,p.x,p.y,p.z,p.w,p.h,p.d,rackMaterials[p.material],`InteriorDetail:${p.role}`);
   const drum=world.thaiWorld.templates.get('oil-drum');
   for(let j=0;j<2+i%2;j++)place(g,drum,r.x-r.width/2+1+j*.85,r.z-r.depth/2+1,.65,.95,.65);
   const cache=place(g,world.thaiWorld.templates.get('municipal-wheelie-bin'),r.cache.x*4,r.cache.y*4,.75,1.15,.8);cache.name=`RoomSupplies:${r.id}`;
   const lamp=new THREE.MeshStandardMaterial({color:0xf0e8c4,emissive:0xf0e8c4,emissiveIntensity:.65});box(g,r.x,3.46,r.z,1.1,.07,.22,lamp,'CeilingLuminaire');
   // A framed interior exit is a visible interaction point, not an open wall.
   const doorZ=r.z+r.depth/2-.12;
   box(g,r.exit.x*4,1.35,doorZ,1.6,2.45,.08,trim,'InteriorExitDoor');
   for(const side of [-1,1])box(g,r.exit.x*4+side*.87,1.38,doorZ-.06,.14,2.65,.17,accent,'InteriorExitJamb');
   box(g,r.exit.x*4,2.72,doorZ-.06,1.88,.14,.17,accent,'InteriorExitLintel');
   box(g,r.exit.x*4,.15,doorZ-.24,1.9,.035,.5,world.materials.concrete,'InteriorExitThreshold');
   const handle=new THREE.Mesh(new THREE.TorusGeometry(.08,.015,6,12),world.materials.rust);handle.position.set(r.exit.x*4+.55,1.25,doorZ-.07);g.add(handle);
   const sign=world.sign(`EXIT / Q  •  ${r.name}`,r.exit.x*4,2.95,doorZ-.08,Math.PI,3.8);if(sign){g.attach(sign);}
   // Exterior entrance markers sit outside imported façades and closed lots.
   const entry=new THREE.Group();entry.name=`HarborEntrance:${r.id}`;
   const yaw=i===4?-Math.PI/2:0;
   entry.position.set(r.door.x*4-Math.sin(yaw),0,r.door.y*4-Math.cos(yaw));entry.rotation.y=yaw;world.root.add(entry);
   box(entry,0,1.3,0,1.65,2.5,.16,trim,'EntranceDoor');
   for(const x of [-.9,.9])box(entry,x,1.38,.08,.14,2.7,.25,world.materials.rust,'EntranceJamb');
   box(entry,0,2.73,.08,1.94,.16,.25,world.materials.rust,'EntranceLintel');
   box(entry,0,.13,.23,2.05,.12,.65,world.materials.concrete,'EntranceThreshold');
   box(entry,.57,1.25,.15,.06,.32,.1,world.materials.signal,'EntrancePull');
   box(entry,0,2.94,.3,2.25,.12,1.05,trim,'EntranceRainHood');
   box(entry,0,2.78,.25,.65,.055,.15,lamp,'EntranceLuminaire');
   const plaque=document.createElement('canvas');plaque.width=768;plaque.height=128;const pc=plaque.getContext('2d');
   pc.fillStyle='#1c302c';pc.fillRect(0,0,768,128);pc.strokeStyle='#a9bea0';pc.lineWidth=5;pc.strokeRect(6,6,756,116);
   pc.fillStyle='#e6e2bd';pc.textAlign='center';pc.font='bold 32px sans-serif';pc.fillText(`${String(i+1).padStart(2,'0')} / ${r.name}`,384,53,725);pc.font='24px sans-serif';pc.fillText('Q  /  ENTER & SEARCH',384,94);
   const pt=new THREE.CanvasTexture(plaque);pt.colorSpace=THREE.SRGBColorSpace;
   const label=new THREE.Mesh(new THREE.PlaneGeometry(1.52,.38),new THREE.MeshBasicMaterial({map:pt}));label.position.set(0,1.95,.09);entry.add(label);
   box(entry,0,2.58,.1,1.65,.12,.05,accent,'EntranceIdentityBand');
  }
  world.diagnostics.interiors={rooms:this.rooms.size,furniture:'Thai Kit folding tables, padded chairs and supply props',access:'Q at marked doors; Q to search and exit'};
 }
 setLighting(room){
  // Keep the light layout stable across exterior/interior transitions. Zero
  // intensity changes uniforms without replacing native WebGPU pipelines.
  this.lightingRoot.visible=true;
  this.areaLight.intensity=room?1.7:0;
  this.practicalLight.intensity=room?9:0;
  for(const [light,intensity]of this.exteriorLightIntensities)light.intensity=room?0:intensity;
  if(room)this.practicalLight.position.set(room.x,3.2,room.z);
 }
 update(run){
  const active=run?.course.activeInterior?.id||null;
  if(active!==this.active){
   if(active&&!this.active)for(const child of this.world.root.children){if(child===this.root||child.isLight)continue;this.outside.set(child,child.visible);child.visible=false;}
   if(!active&&this.active){for(const [child,visible]of this.outside)child.visible=visible;this.outside.clear();}
   for(const [id,g]of this.rooms)g.visible=id===active;this.active=active;
   this.setLighting(active?this.world.course.harborRooms.find(room=>room.id===active):null);
  }
  if(active){const supplies=this.rooms.get(active).getObjectByName(`RoomSupplies:${active}`);supplies.userData.searched=!harborRoomSupplies(run,active);}
 }
}
