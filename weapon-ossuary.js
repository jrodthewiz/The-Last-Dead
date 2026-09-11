import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';
import {applyWeaponMaterialProfile, stabilizeWeaponVertexWear, tagWeaponMechanism} from './weapon-materials.js';
import {applyWeaponDetailPass} from './weapon-detail-pass.js';
// Original image-guided Ossuary. Metres, +Y up, -Z muzzle direction.
const V=p=>new THREE.Vector3(...p);
function sweep(points,radii,sides=9){const curve=new THREE.CatmullRomCurve3(points.map(V)),steps=points.length*4,frames=curve.computeFrenetFrames(steps,false),pos=[],uv=[],idx=[];for(let i=0;i<=steps;i++){const t=i/steps,q=t*(radii.length-1),a=Math.min(radii.length-2,Math.floor(q)),r=THREE.MathUtils.lerp(radii[a],radii[a+1],q-a),p=curve.getPointAt(t);for(let j=0;j<=sides;j++){const ang=j/sides*Math.PI*2,v=p.clone().addScaledVector(frames.normals[i],Math.cos(ang)*r).addScaledVector(frames.binormals[i],Math.sin(ang)*r);pos.push(v.x,v.y,v.z);uv.push(j/sides,t);if(i<steps&&j<sides){const n=i*(sides+1)+j;idx.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
function profile(points,depth,bevel=.012,holes=[]){const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));for(const h of holes){const path=new THREE.Path();path.absellipse(h[0],h[1],h[2],h[3],0,Math.PI*2,true);shape.holes.push(path);}const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:18});g.translate(0,0,-depth/2);return g;}
function makeWearMap(seed=73){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,n=Math.sin((x+seed)*12.9898+(y-seed)*78.233)*43758.5453,f=n-Math.floor(n),grain=Math.sin(x*.2+Math.sin(y*.05)*2)*.5+.5,pit=Math.max(0,f-.76)*3.5,v=Math.max(38,Math.min(255,202+grain*34-pit*100));data[i]=v;data[i+1]=Math.max(0,v-9);data[i+2]=Math.max(0,v-19);data[i+3]=255;}const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.SRGBColorSpace;t.userData.sharedAsset=true;t.needsUpdate=true;return t;}
let sharedWearMap;function getWearMap(){return sharedWearMap||(sharedWearMap=makeWearMap());}
export function createOssuary(){
 const root=new THREE.Group();root.name='Ossuary';const parts={};
 const materials={
  boneDark:new THREE.MeshStandardMaterial({color:0x493631,roughness:.95,metalness:0}),
  metal:new THREE.MeshStandardMaterial({color:0x30272d,roughness:.46,metalness:.76}),
  bone:new THREE.MeshStandardMaterial({color:0xc6b18f,roughness:.88,metalness:0}),
  boneLight:new THREE.MeshStandardMaterial({color:0xe0caa7,roughness:.78,metalness:0}),
  leather:new THREE.MeshStandardMaterial({color:0x2d111a,roughness:.88,metalness:.04}),
  horn:new THREE.MeshStandardMaterial({color:0x644a35,roughness:.91,metalness:0}),
  dark:new THREE.MeshStandardMaterial({color:0x070608,roughness:.96,metalness:.05}),
  steel:new THREE.MeshStandardMaterial({color:0xa8a5a0,roughness:.3,metalness:.9}),
  ironEdge:new THREE.MeshStandardMaterial({color:0x766064,roughness:.34,metalness:.82}),
  brass:new THREE.MeshStandardMaterial({color:0x925b35,roughness:.31,metalness:.8}),
  glow:new THREE.MeshStandardMaterial({color:0xff294f,emissive:0xff123b,emissiveIntensity:2.1,roughness:.33,metalness:.08}),
  ember:new THREE.MeshStandardMaterial({color:0xff6b3b,emissive:0xb21d18,emissiveIntensity:2.4,roughness:.28,metalness:.08}),
  muzzle:new THREE.MeshBasicMaterial({color:0xff8c51,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),
  muzzleHot:new THREE.MeshBasicMaterial({color:0xffe5b0,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),
  muzzleRing:new THREE.MeshBasicMaterial({color:0xff4d32,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),
  smoke:new THREE.MeshBasicMaterial({color:0x35252d,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false})
 };
 const albedoMap=getWearMap();
 function part(name,parent=root){const g=new THREE.Group();g.name=name;parent.add(g);parts[name]=g;return g;}
 function add(parent,geo,material,p=[0,0,0],s=[1,1,1],rot=[0,0,0],name=''){const m=new THREE.Mesh(geo,materials[material]);m.position.set(...p);m.scale.set(...s);m.rotation.set(...rot);m.name=name||parent.name+'-surface-'+parent.children.length;m.userData.explodeWithParent=true;parent.add(m);return m;}
 const receiver=part('receiver');add(receiver,profile([[-.105,-.09],[.105,-.09],[.11,.07],[.06,.115],[-.06,.115],[-.11,.07]],.46), 'metal',[0,0,.005]);

 // Layered receiver plates give the silhouette a hard mechanical spine beneath the bone.
 add(receiver,profile([[-.087,-.063],[.087,-.063],[.095,.055],[.046,.087],[-.046,.087],[-.095,.055]],.018,.004),'ironEdge',[0,0,.238],[1,1,1],[0,0,0],'receiver-face-plate');
 add(receiver,profile([[-.058,-.037],[.058,-.037],[.064,.036],[-.064,.036]],.008,.002),'dark',[0,0,.249],[1,1,1],[0,0,0],'receiver-void-panel');
 add(receiver,new THREE.BoxGeometry(.03,.022,.29),'steel',[0,.132,.03],[1,1,1],[0,0,0],'receiver-sight-rail');
 for(const side of[-1,1]){
  add(receiver,sweep([[side*.108,.075,.2],[side*.132,.035,.02],[side*.12,-.055,-.18]],[.014,.018,.012],7),'ironEdge',[0,0,0],[1,1,1],[0,0,0],'receiver-side-rail-'+side);
  for(let i=0;i<3;i++)add(receiver,new THREE.CylinderGeometry(.014,.014,.012,8),'steel',[side*.118,.072-i*.06,.252],[1,1,1],[0,0,Math.PI/2],'receiver-rivet-'+side+'-'+i);
 } const barrel=part('barrel');const recoilCarriage=part('recoil-carriage');recoilCarriage.add(barrel);add(barrel,new THREE.CylinderGeometry(.086,.105,.68,6), 'metal',[0,.025,-.52],[1,1,1],[Math.PI/2,0,Math.PI/6]);for(const side of[-1,1])add(barrel,new THREE.BoxGeometry(.009,.017,.58),'steel',[side*.074,.058,-.53]);
 // Cooling fins and an inset bore make the barrel read as a loaded mechanism at close range.
 add(barrel,new THREE.CylinderGeometry(.061,.067,.7,14,1,true),'dark',[0,.025,-.53],[1,1,1],[Math.PI/2,0,0],'barrel-bore-liner');
 for(const z of[-.3,-.46,-.62,-.78]){
  add(barrel,new THREE.TorusGeometry(.104,.009,6,18),'ironEdge',[0,.025,z],[1,1,1],[Math.PI/2,0,0],'barrel-collar-'+z);
 }
 for(const side of[-1,1])for(let i=0;i<3;i++)add(barrel,new THREE.BoxGeometry(.018,.035,.11),'steel',[side*.105,.065,-.34-i*.14],[1,1,1],[0,0,side*.08],'barrel-cooling-fin-'+side+'-'+i);
 const grip=part('grip');grip.position.set(0,-.12,.14);grip.rotation.x=-.27;add(grip,profile([[-.08,.05],[.08,.05],[.105,-.3],[.07,-.36],[-.085,-.35]],.2,.019),'leather');
 const chamber=part('chamber');chamber.position.set(0,0,-.13);add(chamber,new THREE.CylinderGeometry(.153,.153,.29,24),'metal',[0,0,0],[1,1,1],[Math.PI/2,0,0]);
 const glow=part('chamber-glow',chamber);for(let i=0;i<6;i++){const a=i*Math.PI/3;add(glow,new THREE.CylinderGeometry(.039,.039,.31,10),'glow',[Math.sin(a)*.12,Math.cos(a)*.12,0],[1,1,1],[Math.PI/2,0,0]);}
 const collars=part('collars',chamber);for(const z of[-.15,.15])add(collars,new THREE.TorusGeometry(.17,.018,7,24),'bone',[0,0,z]);
 const ribs=part('ribs',chamber);for(let i=0;i<6;i++){const a=i*Math.PI/3+.25,c=Math.cos(a),s=Math.sin(a);add(ribs,sweep([[c*.157,s*.157,-.17],[c*.184,s*.184,-.09],[c*.187,s*.187,.06],[c*.16,s*.16,.17]],[.022,.033,.029,.022]),'bone');}
 const spine=part('spine');for(let i=0;i<7;i++){const z=-.79+i*.083;add(spine,new THREE.SphereGeometry(1,10,7),'bone',[0,.135,z],[.055,.038,.049]);for(const side of[-1,1])add(spine,sweep([[0,.14,z],[side*.053,.127,z+.01],[side*.085,.11,z+.03]],[.025,.023,.009],7),'bone');add(spine,sweep([[0,.15,z],[0,.2,z+.015],[0,.245,z+.034]],[.023,.018,.002],7),'bone');}
 const horn=part('horn');add(horn,sweep([[0,.07,.2],[0,.23,.22],[0,.32,.1],[0,.32,-.1],[0,.255,-.3]],[.055,.055,.044,.025,.002],12),'horn');
 for(let i=1;i<12;i++){const t=i/12,curve=new THREE.CatmullRomCurve3([[0,.07,.2],[0,.23,.22],[0,.32,.1],[0,.32,-.1],[0,.255,-.3]].map(V)),p=curve.getPointAt(t),radii=[.055,.055,.044,.025,.002],q=t*4,j=Math.min(3,Math.floor(q)),radius=THREE.MathUtils.lerp(radii[j],radii[j+1],q-j)+.001;const ring=add(horn,new THREE.TorusGeometry(radius,.005,5,12),'horn',[p.x,p.y,p.z]);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),curve.getTangentAt(t));}
 const skull=part('skull');skull.position.set(-.115,.06,-.56);skull.scale.setScalar(.65);skull.rotation.y=.36;const contour=[[-.145,-.055],[-.155,.025],[-.11,.105],[-.07,.14],[0,.185],[.07,.14],[.11,.105],[.155,.025],[.145,-.055],[.08,-.085],[.04,-.03],[-.04,-.03],[-.08,-.085]];add(skull,profile(contour,.085,.009,[[-.078,.045,.044,.027],[.078,.045,.044,.027]]),'bone');
 // The first pass read as a flat mask in three-quarter view. Give the cranium a real volume,
 // then layer the brow, cheek arches and nasal bridge over it so the skull still reads in the FPS frame.
 add(skull,new THREE.SphereGeometry(1,18,12),'boneDark',[0,.07,.012],[.145,.135,.09]);
 for(const side of[-1,1]){add(skull,sweep([[side*.14,.05,.018],[side*.105,.115,.012],[side*.035,.14,.018]],[.021,.029,.015],8),'bone');add(skull,sweep([[side*.12,-.005,.02],[side*.085,-.075,.024],[side*.025,-.092,.02]],[.018,.026,.01],8),'bone');}
 add(skull,sweep([[0,.12,.022],[0,.055,.035],[0,-.02,.032]],[.02,.023,.012],8),'bone');
 const socketRims=part('socket-rims',skull);for(const side of[-1,1])add(socketRims,new THREE.TorusGeometry(.047,.009,6,18),'bone',[side*.078,.045,.053],[1,.72,1],[0,0,0]);
 const socketGroup=part('sockets',skull);for(const side of[-1,1]){add(socketGroup,new THREE.SphereGeometry(1,12,8),'dark',[side*.078,.045,.027],[.042,.026,.023]);add(skull,sweep([[side*.145,-.02,-.035],[side*.11,.075,-.056],[side*.04,.1,-.046]],[.025,.03,.018]),'bone');}
 const bore=part('bore');add(bore,new THREE.CylinderGeometry(.055,.061,.18,16,1,true),'metal',[0,-.024,-.94],[1,1,1],[Math.PI/2,0,0]);add(bore,new THREE.CircleGeometry(.052,16),'dark',[0,-.024,-.988],[1,1,1],[0,Math.PI,0]);
 const fangs=part('fangs',skull);for(const side of[-1,1])add(fangs,sweep([[side*.12,-.025,-.022],[side*.11,-.13,-.045],[side*.072,-.19,-.055]],[.026,.016,.001]),'bone');
 const jaw=part('jaw');add(jaw,sweep([[-.12,-.08,-.95],[-.095,-.16,-.965],[0,-.18,-.97],[.095,-.16,-.965],[.12,-.08,-.95]],[.019,.022,.024,.022,.019]),'bone');for(let i=0;i<5;i++)add(jaw,sweep([[(i-2)*.025,-.17,-.975],[(i-2)*.026,-.139,-.98]],[.012,.004],7),'bone');add(jaw,profile([[-.07,-.01],[.07,-.01],[.052,-.055],[-.052,-.055]],.028,.006),'boneDark',[0,-.12,-.015]);
 const guard=part('guard');add(guard,sweep([[0,-.06,-.22],[0,-.21,-.2],[0,-.27,-.075],[0,-.21,.12],[0,-.07,.15]],[.019,.019,.022,.018,.018]),'metal');add(guard,sweep([[0,-.055,-.065],[0,-.15,-.11],[0,-.18,-.06]],[.012,.012,.007]),'steel');

 const trigger=part('trigger',guard);tagWeaponMechanism(trigger,'trigger-blade','y');
 add(trigger,new THREE.CapsuleGeometry(.014,.085,5,8),'steel',[0,-.14,-.055],[1,1,1],[Math.PI/2,0,0],'trigger-blade');
 add(trigger,new THREE.TorusGeometry(.025,.005,5,12),'brass',[0,-.112,-.055],[1,.75,1],[Math.PI/2,0,0],'trigger-pin'); const wraps=part('wraps',grip);for(let i=0;i<8;i++){const y=.015-i*.043;add(wraps,sweep([[-.092,y-.016,-.105],[.092,y+.015,-.105],[.104,y+.012,.09],[-.094,y-.025,.109],[-.092,y-.016,-.105]],[.014,.014,.014,.014,.014],6),'leather');}

 const gripSpine=part('grip-spine',grip);
 add(gripSpine,sweep([[0,.01,.11],[0,-.08,.12],[0,-.22,.105],[0,-.33,.07]],[.018,.021,.018,.012],7),'boneLight',[0,0,0],[1,1,1],[0,0,0],'grip-bone-spine');
 for(const side of[-1,1])add(gripSpine,new THREE.CylinderGeometry(.012,.012,.18,7),'brass',[side*.083,-.18,.08],[1,1,1],[0,0,Math.PI/2],'grip-side-pin-'+side); const fasteners=part('fasteners');for(const side of[-1,1])for(const z of[.12,-.03])add(fasteners,new THREE.SphereGeometry(.013,8,6),'steel',[side*.114,.01,z]);for(const side of[-1,1])add(grip,sweep([[side*.07,-.33,-.08],[side*.095,-.365,0],[side*.06,-.35,.1]],[.025,.035,.023]),'bone');
 // Paired chamber-drive rails and extractor claws make the rotary mechanism readable in motion.
 const chamberDrive=part('chamber-drive',recoilCarriage);tagWeaponMechanism(chamberDrive,'rotary-chamber-drive','z');

 // The ratchet bolt gives the revolver a visible loading cycle instead of a purely cosmetic spin.
 const bolt=part('bolt',recoilCarriage);tagWeaponMechanism(bolt,'recoil-bolt','z');
 add(bolt,new THREE.BoxGeometry(.14,.035,.19),'ironEdge',[0,.13,.09],[1,1,1],[0,0,0],'bolt-slide');
 add(bolt,new THREE.BoxGeometry(.035,.045,.22),'steel',[0,.16,.09],[1,1,1],[0,0,0],'bolt-rail');
 for(const side of[-1,1])add(bolt,new THREE.CylinderGeometry(.013,.013,.035,8),'brass',[side*.072,.145,.09],[1,1,1],[Math.PI/2,0,0],'bolt-pin-'+side); for(const side of[-1,1]){add(chamberDrive,new THREE.CylinderGeometry(.012,.016,.22,7),'steel',[side*.105,.12,-.18],[1,1,1],[Math.PI/2,0,0]);add(chamberDrive,new THREE.TorusGeometry(.027,.006,6,12),'steel',[side*.105,.12,-.18],[1,1,1],[Math.PI/2,0,0]);}
 const extractors=part('extractors',recoilCarriage);tagWeaponMechanism(extractors,'recoil-extractor','z');
 for(const side of[-1,1])add(extractors,sweep([[side*.085,.02,-.29],[side*.11,.035,-.22],[side*.1,.07,-.15]],[.012,.014,.006],7),'steel',[0,0,0]);
 // Rear death mask is an FPS readability adaptation of the muzzle motif.
 const rearMask=part('rear-death-mask');rearMask.position.set(-.105,.055,.252);rearMask.scale.setScalar(.58);rearMask.rotation.y=.38;const maskShape=[[-.11,.04],[-.08,.11],[0,.135],[.08,.11],[.11,.04],[.079,-.045],[.048,-.083],[-.048,-.083],[-.079,-.045]];
 add(rearMask,profile(maskShape,.045,.014,[[-.047,.032,.025,.019],[.047,.032,.025,.019]]),'bone');for(const side of[-1,1])add(rearMask,new THREE.SphereGeometry(1,10,7),'glow',[side*.047,.032,.004],[.024,.017,.017]);for(let i=0;i<5;i++)add(rearMask,profile([[-.008,0],[.008,0],[.006,-.032],[-.006,-.033]],.035,.002),'bone',[(i-2)*.016,-.059,.012]);
 add(rearMask,profile([[0,.013],[-.016,-.018],[.016,-.018]],.005,.001),'dark',[0,-.018,.043]);
 add(rearMask,new THREE.BoxGeometry(.075,.029,.006),'dark',[0,-.06,.044]);for(let i=0;i<5;i++)add(rearMask,new THREE.BoxGeometry(.011,.022,.009),'bone',[(i-2)*.015,-.06,.049]);
 for(const side of[-1,1]){add(rearMask,sweep([[side*.082,.06,.032],[side*.05,.061,.038],[side*.025,.045,.034]],[.012,.014,.007],7),'bone');add(rearMask,profile([[0,.012],[-.014,-.012],[.009,-.018]],.004,.001),'dark',[side*.075,-.025,.041]);}
 const muzzle=new THREE.Object3D();muzzle.name='muzzle';muzzle.position.set(0,-.024,-1.035);recoilCarriage.add(muzzle);
 const projectileOrigin=new THREE.Object3D();projectileOrigin.name='projectileOrigin';projectileOrigin.position.set(0,-.024,-1.052);recoilCarriage.add(projectileOrigin);
 // Pooled flash geometry stays resident so a first shot never creates a mesh or material.
 const muzzleFlash=new THREE.Group();muzzleFlash.name='muzzle-flash';muzzleFlash.visible=false;muzzleFlash.userData.pooled=true;
 const fx=(geo,material,p=[0,0,0],rot=[0,0,0],name='')=>{const mesh=new THREE.Mesh(geo,materials[material]);mesh.position.set(...p);mesh.rotation.set(...rot);mesh.name=name;mesh.frustumCulled=false;muzzleFlash.add(mesh);return mesh;};
 const flashCone=fx(new THREE.ConeGeometry(.095,.34,8),'muzzle',[0,0,-.17],[Math.PI/2,0,0],'flash-cone');
 const flashCore=fx(new THREE.ConeGeometry(.056,.22,7),'muzzleHot',[0,0,-.12],[Math.PI/2,0,0],'flash-core');
 const flashRing=fx(new THREE.TorusGeometry(.12,.014,8,24),'muzzleRing',[0,0,0],[0,0,0],'flash-ring');
 const flashRingInner=fx(new THREE.TorusGeometry(.073,.007,6,18),'muzzleHot',[0,0,-.035],[0,0,0],'flash-ring-inner');
 const flashSpines=[];
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;flashSpines.push(fx(new THREE.ConeGeometry(.012,.16,5),'muzzleRing',[Math.cos(a)*.09,Math.sin(a)*.09,-.045],[Math.PI/2,0,a],'flash-spine-'+i));}
 const smokeGroup=new THREE.Group();smokeGroup.name='smoke';smokeGroup.userData.pooled=true;muzzleFlash.add(smokeGroup);
 const smokePuffs=[];
 for(const spec of[[0,.018,-.04,.034],[-.028,.012,-.012,.024],[.03,.01,-.02,.022]]){const puff=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),materials.smoke);puff.position.set(spec[0],spec[1],spec[2]);puff.scale.setScalar(spec[3]);puff.userData.smokeSize=spec[3];puff.name='smoke-puff-'+smokePuffs.length;smokeGroup.add(puff);smokePuffs.push(puff);}
 recoilCarriage.add(muzzleFlash);
 const heatSocket=new THREE.Object3D();heatSocket.name='heat';heatSocket.position.set(0,.025,-.82);recoilCarriage.add(heatSocket);
 const inspectSocket=new THREE.Object3D();inspectSocket.name='inspect';inspectSocket.position.set(0,.1,.22);root.add(inspectSocket);
 const shotFx={flashCone,flashCore,flashRing,flashRingInner,flashSpines,smokeGroup,smokePuffs};
 const sockets={muzzle,projectileOrigin,muzzleFlash,recoil:recoilCarriage,heat:heatSocket,inspect:inspectSocket,grip,trigger,bolt,corePulse:chamber,shotFx,smoke:smokeGroup};
 root.userData.muzzle=muzzle;root.userData.projectileOrigin=projectileOrigin;
 // Merge only surfaces within each semantic part and material; chamber remains independently animated.
 for(const group of Object.values(parts)){const buckets=new Map();for(const child of [...group.children])if(child.isMesh){child.updateMatrix();const geometry=child.geometry.clone();geometry.applyMatrix4(child.matrix);const flat=geometry.index?geometry.toNonIndexed():geometry;for(const key of Object.keys(flat.attributes))if(!['position','normal','uv'].includes(key))flat.deleteAttribute(key);const list=buckets.get(child.material)||[];list.push(flat);buckets.set(child.material,list);group.remove(child);child.geometry.dispose();if(flat!==geometry)geometry.dispose();}
 for(const [material,geometries]of buckets){const merged=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();const mesh=new THREE.Mesh(merged,material);mesh.name=group.name+'-'+material.uuid.slice(0,4);mesh.userData.explodeWithParent=true;group.add(mesh);}}
 // Independent relief/roughness fields; no lighting baked into albedo.
 const size=1024,height=new Uint8Array(size*size),rough=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,n=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;const grain=Math.sin(x*.14+Math.sin(y*.035)*2)*.5+.5;height[i]=Math.max(0,Math.min(255,128+grain*30+n*27));const rv=Math.max(0,Math.min(255,215+Math.sin(x*.051)*Math.cos(y*.047)*20+n*12));rough[i*4]=rough[i*4+1]=rough[i*4+2]=rv;rough[i*4+3]=255;}
 const texture=(data,format=THREE.RedFormat)=>{const t=new THREE.DataTexture(data,size,size,format);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;};const bump=texture(height),roughnessMap=texture(rough,THREE.RGBAFormat);
 for(const key of ['bone','boneLight','metal','leather','steel','ironEdge','brass','horn']){const m=materials[key];m.map=albedoMap;m.bumpMap=bump;m.bumpScale=(key==='bone'||key==='boneLight')?.006:key==='leather'?.004:.0012;m.roughnessMap=roughnessMap;m.vertexColors=true;m.needsUpdate=true;}
 applyWeaponMaterialProfile(materials,{metal:{roughness:.48,metalness:.8,envMapIntensity:.44},steel:{roughness:.38,metalness:.86,envMapIntensity:.42},ironEdge:{roughness:.38,metalness:.82,envMapIntensity:.38},brass:{roughness:.38,metalness:.78,envMapIntensity:.36},bone:{roughness:.9,envMapIntensity:.25,colorScale:.92},boneLight:{roughness:.8,envMapIntensity:.26,colorScale:.92},glow:{roughness:.4,metalness:.08,envMapIntensity:.18},ember:{roughness:.3,metalness:.08,envMapIntensity:.2}});
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.material.vertexColors)return;const pos=mesh.geometry.attributes.position,colors=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),v=.8+.13*Math.sin(x*32+z*18)*Math.sin(y*41-z*15)+.07*Math.sin(x*155+y*129+z*133);colors.push(v,v*.98,v*.93);}mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));});
 stabilizeWeaponVertexWear(root,41);
 const textures={albedoMap,bump,roughnessMap};
 root.userData.sculptRuntime={parts,muzzle,chamber,sockets,materials,textures,collider:{type:'box',size:[.4,.75,1.3]},explode(amount){root.updateWorldMatrix(true,true);for(const p of Object.values(parts)){if(!p.userData.explodeHome){const bounds=new THREE.Box3();for(const mesh of p.children)if(mesh.isMesh){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox);}const center=bounds.isEmpty()?new THREE.Vector3():bounds.getCenter(new THREE.Vector3());p.userData.explodeHome=p.position.clone();p.userData.explodeDelta=center.applyQuaternion(p.quaternion).add(p.position).sub(new THREE.Vector3(0,-.05,-.4));}p.position.copy(p.userData.explodeHome).addScaledVector(p.userData.explodeDelta,amount);}},pick(raycaster){return raycaster.intersectObject(root,true)[0]?.object.parent.name;}};
 applyWeaponDetailPass(root,'ossuary');
 root.userData.ossuary={chamber,chamberDrive,extractors,bolt,trigger,materials,textures,sockets,shotFx,recoilCarriage,spin:0,recoil:0,flash:0,smoke:0,heat:0,lastShot:0};return root;
}
export function animateOssuary(root,shot=0,time=0,dt=.016,state={}){
 const s=root.userData.ossuary;if(!s)return;
 const delta=Math.max(.001,Number(dt)||.016);
 const shotValue=Number(shot)||0;
 if(shotValue>s.lastShot+.2){
  s.spin+=Math.PI/3;
  s.recoil=1;
  s.flash=1;
  s.smoke=1;
  s.heat=Math.min(1,s.heat+.28);
 }
 s.lastShot=shotValue;
 s.recoil=THREE.MathUtils.damp(s.recoil,0,16,delta);
 s.flash=Math.max(0,s.flash-delta*11);
 s.smoke=Math.max(0,s.smoke-delta*2.1);
 s.heat=THREE.MathUtils.damp(s.heat,0,1.45,delta);
 s.recoilCarriage.position.z=s.recoil*.055;
 s.recoilCarriage.rotation.x=s.recoil*-.022;
 s.recoilCarriage.rotation.y=s.recoil*.004;
 s.bolt.position.z=-s.recoil*.085+Math.sin(time*4.4+s.spin)*.004;
 s.bolt.rotation.x=s.recoil*.24;
 s.trigger.rotation.x=THREE.MathUtils.damp(s.trigger.rotation.x,-s.recoil*.18,24,delta);
 s.chamber.rotation.z=THREE.MathUtils.damp(s.chamber.rotation.z,s.spin,21,delta);
 s.chamberDrive.rotation.z=Math.sin(time*5.5+s.spin)*.12+s.recoil*.16;
 s.extractors.position.z=-s.recoil*.068;
 s.extractors.rotation.y=s.recoil*.14;
 s.materials.glow.emissiveIntensity=1.6+shotValue*4+s.heat*2.8+Math.sin(time*2.7)*.15;
 s.materials.ember.emissiveIntensity=1.8+s.heat*5.4+s.flash*5+Math.sin(time*6.5)*.18;
 const fx=s.shotFx;
 const flashAlpha=Math.min(1,s.flash*1.35);
 s.materials.muzzle.opacity=.08+flashAlpha*.9;
 s.materials.muzzleHot.opacity=.06+flashAlpha*.94;
 s.materials.muzzleRing.opacity=.03+flashAlpha*.72;
 s.materials.smoke.opacity=s.smoke*.24;
 s.sockets.muzzleFlash.visible=s.flash>.008||s.smoke>.012;
 s.sockets.muzzleFlash.scale.setScalar(.72+s.flash*1.25);
 s.sockets.muzzleFlash.rotation.z=Math.sin(time*29)*.14;
 if(fx){
  fx.flashCone.scale.set(1+flashAlpha*.25,1+flashAlpha*.55,1+flashAlpha*.25);
  fx.flashCore.scale.setScalar(.82+flashAlpha*.95);
  fx.flashRing.scale.setScalar(.8+flashAlpha*1.25);
  fx.flashRingInner.scale.setScalar(.7+flashAlpha*1.35);
  fx.flashRing.rotation.z=Math.sin(time*37)*.12;
  fx.flashRingInner.rotation.z=-Math.sin(time*31)*.16;
  for(let i=0;i<fx.flashSpines.length;i++){
   const spike=fx.flashSpines[i];
   spike.scale.set(1,1+flashAlpha*(.8+.16*(i%3)),1);
   spike.rotation.z=i/6*Math.PI*2+Math.sin(time*23+i)*.12;
  }
  for(let i=0;i<fx.smokePuffs.length;i++){
   const puff=fx.smokePuffs[i];
   const a=i*2.1+time*(.35+i*.08);
   const spread=s.smoke*(.012+i*.009);
   puff.position.x=Math.cos(a)*spread;
   puff.position.y=.012+Math.sin(a)*spread*.7+s.smoke*(.012+i*.006);
   puff.position.z=-.04-s.smoke*(.07+i*.022);
   puff.scale.setScalar(puff.userData.smokeSize*(.9+s.smoke*(1.4+i*.2)));
  }
  fx.smokeGroup.scale.setScalar(.9+s.smoke*.55);
 }
 if(state?.inspect)s.sockets.inspect.rotation.y=Math.sin(time*.75)*.08;
}
