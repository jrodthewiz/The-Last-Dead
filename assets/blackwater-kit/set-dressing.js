import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/utils/BufferGeometryUtils.js';

function seeded(seed) { let n=seed>>>0; return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296); }

// Small support forms and damaged vehicle panels are compiled by semantic
// material slot and spatial bin. They do not introduce gameplay colliders.
function writer(materials, bin=64) {
 const groups=new Map(),counts={},geometries=[],meshes=[];
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
 function append(slot,g,position=[0,0,0],rotation=[0,0,0],role='detail'){
  if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
  const mat=materials[slot]||materials.metal;
  const uv=g.attributes.uv,p=g.attributes.position,n=g.attributes.normal,meters=mat.userData.textureMeters||2;
  // These are writer-owned buffers; untargeted dressing retains exact old finish.
  if(slot==='roof'||slot==='roofZinc')g.setAttribute('roofPlane',new THREE.Float32BufferAttribute(new Float32Array(p.count*4),4));
  if(uv&&mat.map)for(let i=0;i<p.count;i++){
   const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
   uv.setXY(i,(ny>nx&&ny>nz?p.getX(i):nx>nz?p.getZ(i):p.getX(i))/meters,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/meters);
  }
  e.set(...rotation);q.setFromEuler(e);matrix.compose(new THREE.Vector3(...position),q,new THREE.Vector3(1,1,1));g.applyMatrix4(matrix);
  if(uv&&mat.map&&['brick','render','masonry','pale'].includes(slot))for(let i=0;i<p.count;i++){
   const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
   uv.setXY(i,(ny>nx&&ny>nz?p.getX(i):nx>nz?p.getZ(i):p.getX(i))/meters,(ny>nx&&ny>nz?p.getZ(i):p.getY(i))/meters);
  }
  const key=`${slot}/${Math.floor(position[0]/bin)}/${Math.floor(position[2]/bin)}`;
  if(!groups.has(key))groups.set(key,{slot,mat,pieces:[]});groups.get(key).pieces.push(g);counts[role]=(counts[role]||0)+1;
 }
 function box(slot,p,s,rotation=[0,0,0],role='detail'){append(slot,new THREE.BoxGeometry(...s),p,rotation,role);}
 function rod(slot,a,b,r=.03,role='pipe',r2=r){
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va),g=new THREE.CylinderGeometry(r2,r,delta.length(),8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));append(slot,g,va.add(vb).multiplyScalar(.5).toArray(),[0,0,0],role);
 }
 function surface(slot,points,indices,role='panel',p=[0,0,0],rotation=[0,0,0]){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(v=>[v[0],v[1]]),2));g.setIndex(indices);g.computeVertexNormals();append(slot,g,p,rotation,role);
 }
 function finish(parent,name){
  let triangles=0;
  for(const {slot,mat,pieces}of groups.values()){
   const g=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());if(!g)throw new Error(`Cannot compile dressing slot ${slot}`);
   g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,mat);mesh.name=`${name}-${slot}`;mesh.userData.blackwaterDressing=true;
   mesh.receiveShadow=true;mesh.castShadow=!['glass','foliage'].includes(slot);parent.add(mesh);meshes.push(mesh);geometries.push(g);triangles+=g.index.count/3;
  }
  let disposed=false;
  return{triangles,drawCalls:meshes.length,moduleCounts:counts,dispose(){if(disposed)return;disposed=true;meshes.forEach(m=>m.removeFromParent());geometries.forEach(g=>g.dispose());}};
 }
 return{append,box,rod,surface,finish};
}

function loft(w,slot,sections,role,skipEdges=[]){
 const vertices=[],indices=[],ring=sections[0].points.length;
 for(const section of sections)for(const [x,y]of section.points)vertices.push([x,y,section.z]);
 for(let j=0;j<sections.length-1;j++)for(let i=0;i<ring;i++){
  if(skipEdges.includes(i))continue;
  const a=j*ring+i,b=j*ring+(i+1)%ring,c=b+ring,d=a+ring;indices.push(a,d,b,b,d,c);
 }
 for(let i=1;i<ring-1;i++){indices.push(0,i,i+1);const base=(sections.length-1)*ring;indices.push(base,base+i+1,base+i);}
 w.surface(slot,vertices,indices,role);
}

export function createBlackwaterWreck(parent,p,materials,index=0){
 const root=new THREE.Group();root.name=`Blackwater-${p.id}-authored-wreck`;parent.add(root);
 root.position.set(p.x,.15,p.z);root.rotation.y=(p.yaw||0)+(p.width>p.depth?Math.PI/2:0);
 const headlamp=new THREE.MeshStandardMaterial({color:'#ccd5cc',roughness:.19,metalness:.12,emissive:'#a1b29b',emissiveIntensity:.08});
 headlamp.name='blackwater-headlamp-lens';headlamp.userData.lookRole='headlamp';
 const tailLamp=new THREE.MeshStandardMaterial({color:'#702c20',roughness:.30,metalness:.05});tailLamp.name='blackwater-tail-lamp';tailLamp.userData.lookRole='tailLamp';
 const w=writer({...materials,headlamp,tailLamp},Infinity),width=Math.min(p.width,p.depth),length=Math.max(p.width,p.depth),van=length>5;
 const half=width/2,rng=seeded(991+index*127);
 const bodySections=[[-.49,.78,.61],[-.42,.96,.75],[-.31,1,.81],[.18,1,.77],[.34,.92,.68],[.48,.76,.58]];
 loft(w,'carPaint',bodySections.map(([z,spread,top],i)=>({z:z*length,points:[[-half*spread,.21],[-half*spread,.50],[-half*spread*.88,top+(i===4?.10:0)],[half*spread*.88,top-.025],[half*spread,.49],[half*spread,.21]]})),'tapered-vehicle-body',[0,1,3,4]);
 // The side sheets have true wheel-arch cutouts; tyres are not pasted onto
 // closed cuboid sides. Profile strips also taper the front/rear fenders.
 for(const side of [-1,1]){
  const points=[],indices=[],segments=56;
  for(let j=0;j<=segments;j++){
   const normalized=-.49+j/segments*.97,z=normalized*length;
   let k=0;while(k<bodySections.length-2&&normalized>bodySections[k+1][0])k++;
   const a=bodySections[k],b=bodySections[k+1],t=(normalized-a[0])/(b[0]-a[0]);
   const spread=THREE.MathUtils.lerp(a[1],b[1],t),top=THREE.MathUtils.lerp(a[2],b[2],t);
   let bottom=.21;
   for(const wheelZ of [-length*.32,length*.31]){
    const delta=Math.abs(z-wheelZ);if(delta<.375)bottom=Math.max(bottom,.31+Math.sqrt(.375**2-delta**2));
   }
   bottom=Math.min(bottom,top-.075);
   points.push([side*half*spread,bottom,z],[side*half*spread*.88,top-.015,z]);
  }
  for(let j=0;j<segments;j++){
   const a=j*2;indices.push(...(side<0?[a,a+2,a+1,a+1,a+2,a+3]:[a,a+1,a+2,a+1,a+3,a+2]));
  }
  w.surface('carPaint',points,indices,'sculpted-wheel-arch-fender');
 }
 const cabin=van?[[-.40,.89,1.86],[-.29,.85,1.94],[.07,.80,1.91],[.25,.93,1.03]]:[[-.29,.78,1.14],[-.16,.69,1.48],[.08,.63,1.46],[.25,.81,.86]];
 loft(w,'carPaint',cabin.map(([z,spread,top])=>({z:z*length,points:[[-half*.91,.75],[-half*spread,top-.12],[-half*spread*.86,top],[half*spread*.86,top-.035],[half*spread,top-.13],[half*.91,.75]]})),'tapered-vehicle-cabin');
 // Each window is a sloping quadrilateral seated into the authored cabin.
 const roofY=van?1.91:1.46,z0=(van?-.29:-.16)*length,z1=(van?.07:.08)*length;
 for(const side of [-1,1]){
  const xb=side*half*.917,xt=side*half*(van?.89:.68);
  w.surface('glass',[[xb,.92,z0],[xb,.93,z1],[xt,roofY-.13,z1],[xt,roofY-.13,z0]],side<0?[0,1,2,0,2,3]:[0,2,1,0,3,2],'sloping-side-window');
  w.rod('metal',[xb,.83,z0-.045],[xt,roofY-.04,z0-.045],.025,'vehicle-window-frame');
  w.rod('metal',[xb,.83,z1+.04],[xt,roofY-.04,z1+.04],.028,'vehicle-window-frame');
  w.rod('metal',[xt,roofY-.04,z0],[xt,roofY-.04,z1],.027,'vehicle-roof-drip-rail');
  w.rod('dark',[side*half*.983,.30,-length*.02],[side*half*.983,.78,-length*.02],.012,'door-seam');
  w.box('metal',[side*half*.981,.75,-length*.08],[.035,.05,.19],[0,0,0],'vehicle-door-handle');
  for(const z of [-length*.32,length*.31]){
   const tyre=new THREE.TorusGeometry(.255,.082,7,20);tyre.rotateY(Math.PI/2);w.append('rubber',tyre,[side*half*.90,.31,z],[0,0,0],'rounded-pneumatic-tyre');
   const rim=new THREE.CylinderGeometry(.195,.195,.025,16);rim.rotateZ(Math.PI/2);w.append('metal',rim,[side*half*.975,.31,z],[0,0,0],'wheel-rim');
   const well=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:9},(_,j)=>{const a=j/8*Math.PI;return new THREE.Vector3(side*half*.969,.31+Math.sin(a)*.37,z+Math.cos(a)*.38);})),16,.026,5,false);
   w.append('rust',well,[0,0,0],[0,0,0],'curved-wheel-arch');
   for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5;w.rod('dark',[side*half*.992,.31,z],[side*half*.992,.31+Math.sin(a)*.15,z+Math.cos(a)*.15],.011,'wheel-spoke');
   }
  }
  // Detached mirrors and bent bumper brackets are functional asymmetry.
  w.rod('metal',[side*half*.85,1.05,length*.11],[side*half*.94,1.08,length*.16],.018,'mirror-arm');
  w.box('dark',[side*half*.94,1.08,length*.16],[.06,.13,.20],[0,side*.2,.05],'broken-mirror');
 }
 const frontLow=(van?.221:.237)*length,frontHigh=(van?.106:.105)*length,topWidth=half*(van?.65:.55),lowerWidth=half*(van?.79:.73),lowY=van?1.18:1.01,highY=roofY-.15;
 w.surface('glass',[[-lowerWidth,lowY,frontLow],[lowerWidth,lowY,frontLow],[topWidth,highY,frontHigh],[-topWidth,highY,frontHigh]],[0,1,2,0,2,3],'slanted-windshield');
 for(const side of [-1,1]){
  w.rod('rubber',[side*lowerWidth,lowY,frontLow+.007],[side*topWidth,highY,frontHigh+.007],.027,'windscreen-rubber-seal');
  w.rod('carPaint',[side*(lowerWidth+.055),lowY-.055,frontLow-.025],[side*(topWidth+.055),highY+.045,frontHigh-.025],.042,'windshield-pillar');
 }
 w.rod('rubber',[-topWidth,highY,frontHigh+.008],[topWidth,highY,frontHigh+.008],.027,'windscreen-top-seal');
 w.rod('rubber',[-lowerWidth,lowY,frontLow+.008],[lowerWidth,lowY,frontLow+.008],.031,'windscreen-bottom-seal');
 if(van)w.rod('rubber',[0,lowY,frontLow+.012],[0,highY,frontHigh+.012],.020,'windscreen-centre-divider');
 for(const side of [-1,1]){
  w.rod('dark',[side*half*.60,lowY+.017,frontLow+.016],[side*half*.23,lowY+.16,frontLow-length*.024],.010,'windscreen-wiper-arm');
  w.rod('rubber',[side*half*.23,lowY+.16,frontLow-length*.024],[side*half*.16,lowY+.33,frontLow-length*.058],.013,'windscreen-wiper-blade');
 }
 // Folded hood is a real bent sheet with irregular ridges and highlights.
 const hoodPoints=[],hoodIndices=[],rows=5,columns=6;
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
  const t=j/rows,s=i/columns,x=(s-.5)*width*.84,z=length*(.26+t*.205);
  const y=.86-t*.22+Math.sin(s*Math.PI*4+t*3)*.055+(i===2&&j>1?.105:0)+(rng()-.5)*.025;
  hoodPoints.push([x,y,z]);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i;hoodIndices.push(a,a+columns+1,a+1,a+1,a+columns+1,a+columns+2);}
 w.surface('metal',hoodPoints,hoodIndices,'crumpled-sheet-hood');
 w.rod('rust',[-half*.81,.41,length*.46],[half*.74,.34,length*.478],.07,'bent-front-bumper');
 w.box('dark',[0,.46,length*.481],[width*.43,.20,.026],[0,0,0],'radiator-opening');
 for(let i=0;i<6;i++)w.box('metal',[-width*.19+i*width*.075,.46,length*.489],[.015,.16,.026],[0,0,0],'radiator-slat');
 for(const side of [-1,1]){
  w.box('rubber',[side*half*.64,.57,length*.481],[width*.22,.16,.026],[0,0,side*.05],'headlamp-black-insert');
  const lens=new THREE.SphereGeometry(.11,12,7);lens.scale(1.45,.60,.19);w.append('headlamp',lens,[side*half*.64,.57,length*.499],[0,0,side*.05],'sculpted-headlight-lens');
  w.box('tailLamp',[side*half*.70,.59,-length*.487],[width*.10,.14,.022],[0,0,0],'rear-light');
 }
 w.box('pale',[0,.30,length*.475],[.32,.11,.022],[0,0,.08],'vehicle-number-plate');
 if(van){
  for(const z of [-length*.38,-length*.12])w.rod('metal',[-half*.73,2.03,z],[half*.73,2.03,z],.027,'van-roof-rack');
  for(const side of [-1,1])w.rod('metal',[side*half*.73,2.03,-length*.40],[side*half*.73,2.03,-length*.10],.027,'van-roof-rail');
 }
 const result=w.finish(root,'authored-wreck');let disposed=false;
 return{root,...result,dispose(){if(disposed)return;disposed=true;result.dispose();headlamp.dispose();tailLamp.dispose();root.removeFromParent();}};
}

export function buildBlackwaterDressing(parent,slice,materials){
 const root=new THREE.Group();root.name='Blackwater-authored-evacuation-details';parent.add(root);
 const w=writer(materials),rng=seeded(426811),counts={};
 function leaf(x,y,z,size,angle,tilt=.45){
  const shape=new THREE.Shape();shape.moveTo(0,-size*.5);shape.quadraticCurveTo(size*.36,-size*.16,0,size*.5);shape.quadraticCurveTo(-size*.36,-size*.16,0,-size*.5);
  const g=new THREE.ShapeGeometry(shape,3);g.computeVertexNormals();w.append('foliage',g,[x,y,z],[tilt,angle,angle*.35],'broad-leaf');
 }
 function weeds(x,z,radius=.22,count=7){
  for(let i=0;i<count;i++){
   const a=rng()*Math.PI*2,r=radius*rng(),px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,h=.13+rng()*.32;
   w.rod('foliage',[px,.12,pz],[px+.05*Math.cos(a),.12+h,pz+.05*Math.sin(a)],.005,'curb-weed-stem',.002);
   leaf(px,.12+h*.57,pz,.16,a,.9);leaf(px+.025*Math.cos(a),.12+h*.9,pz+.025*Math.sin(a),.11,a+Math.PI*.4,.8);
  }
 }
 function bush(x,z,size=1){
  for(let i=0;i<6;i++){
   const a=i*Math.PI*2/6,end=[x+Math.cos(a)*size*.38,.39+size*.47,z+Math.sin(a)*size*.38];
   w.rod('wood',[x,.14,z],end,.021,'shrubs-woody-branches',.009);
   for(let j=0;j<16;j++){
    const b=rng()*Math.PI*2,r=rng()*size*.34;
    leaf(end[0]+Math.cos(b)*r,end[1]+(rng()-.5)*size*.49,end[2]+Math.sin(b)*r,.18+rng()*.19,b,rng()*Math.PI);
   }
  }
 }
 function drain(x,z){
  w.box('dark',[x,.122,z],[.83,.035,.47],[0,0,0],'storm-drain-recess');
  for(let i=0;i<9;i++)w.box('metal',[x-.36+i*.09,.15,z],[.026,.033,.46],[0,0,0],'storm-drain-grille');
  for(const side of [-1,1])w.box('rust',[x,.151,z+side*.245],[.87,.031,.037],[0,0,0],'drain-frame');
 }
 for(const x of [162.5,180.5,196.2,208.7,219.3])for(const z of [49.6,62.4]){drain(x,z);weeds(x+.53,z,.20,5);}
 for(const [x,z,size]of [[180.9,63.6,1.25],[197.7,63.4,.9],[206,64.1,.7],[212.3,63.7,1.05],[194.4,48.3,.48],[206.7,48.6,.45]])bush(x,z,size);
 // Broken impact masonry and shutters land in localized curb fans. Nothing
 // larger than knee height is added outside existing scenery footprints.
 for(const building of slice.buildings.filter(b=>b.z>30&&b.z<50)){
  const z=building.z+building.depth/2+.32, x=building.x-building.width*.27;
  for(let i=0;i<42;i++){
   const px=x+(rng()-.5)*3.1,pz=z+rng()*.95;
   if(Math.abs(px-202)<2.3)continue;
   const g=new THREE.DodecahedronGeometry(.11+rng()*.12,0);g.scale(1,.35+rng()*.34,.75+rng()*.45);
   w.append(i%3?'brick':'masonry',g,[px,.15+rng()*.065,pz],[rng(),rng()*6,rng()],'collapsed-facade-rubble');
  }
  for(let i=0;i<5;i++)w.box('wood',[x+(rng()-.5)*2,.21,z+.6],[.07,.055,.7+rng()*.5],[0,rng()*6,.12],'split-window-timber');
 }
 // Refugee belongings share one visual story: opened cases, sleeping blanket,
 // queue tape and supplies dropped beside the stopped van at the pharmacy.
 const bagX=213.8,bagZ=61.1;
 for(let i=0;i<6;i++){
  const x=bagX+(rng()-.5)*2.2,z=bagZ+.9+rng()*.55;
  const bag=new THREE.SphereGeometry(.21,10,6);bag.scale(1.15,.65,.78);w.append(i%2?'wood':'rubber',bag,[x,.26,z],[0,rng()*6,.3],'soft-evacuation-duffel');
  w.rod('dark',[x-.12,.26,z],[x+.12,.28,z],.02,'duffel-strap');
 }
 w.box('wood',[213.1,.17,62.1],[1.2,.032,.75],[0,.28,.03],'abandoned-ground-blanket');
 for(let i=0;i<12;i++){
  const x=212.4+rng()*2.2,z=61.8+rng()*.8;
  w.box(i%3?'pale':'metal',[x,.18,z],[.08+rng()*.13,.10+rng()*.13,.075],[0,rng()*6,rng()*.3],'dropped-evacuation-supplies');
 }
 for(const x of [192.2,207.8]){
  w.rod('rust',[x,.1,48.65],[x,.71,48.65],.035,'queue-tape-post');
  w.box('pale',[x,.70,48.65],[.11,.11,.08],[0,0,0],'queue-post-cap');
 }
 // A torn tape hangs to one side of the portal instead of sealing it.
 w.surface('pale',[[192.2,.68,48.65],[197.6,.42,48.9],[197.6,.49,48.9],[192.2,.75,48.65]],[0,1,2,0,2,3],'fallen-queue-tape');
 // A recognizable first-aid trolley and triage chairs, parked in the pharmacy
 // curb apron. They sit away from x200..204 and z53..59 passages.
 const tx=209.4,tz=49.25;
 w.box('metal',[tx,.49,tz],[1.13,.065,.67],[0,-.07,0],'triage-trolley-lower-tray');
 w.box('pale',[tx,.96,tz],[1.19,.055,.73],[0,-.07,0],'triage-trolley-upper-tray');
 for(const side of [-1,1])for(const end of [-1,1]){
  const x=tx+side*.48,z=tz+end*.27;
  w.rod('metal',[x,.23,z],[x,1.11,z],.022,'triage-trolley-frame');
  const wheel=new THREE.TorusGeometry(.075,.022,5,12);wheel.rotateY(Math.PI/2);w.append('rubber',wheel,[x,.20,z],[0,0,0],'trolley-caster-wheel');
 }
 for(const z of [tz-.34,tz+.34])w.rod('metal',[tx-.55,1.04,z],[tx+.55,1.04,z],.021,'trolley-tray-rail');
 w.rod('metal',[tx+.54,1.11,tz-.28],[tx+.54,1.11,tz+.28],.026,'trolley-push-handle');
 w.box('wood',[tx-.17,1.04,tz],[.53,.13,.42],[0,.06,0],'triage-first-aid-bag');
 w.box('pale',[tx-.17,1.12,tz+.21],[.23,.10,.019],[0,0,0],'first-aid-kit-symbol');
 w.box('pale',[tx-.17,1.12,tz+.21],[.09,.23,.019],[0,0,0],'first-aid-kit-symbol');
 for(const x of [207.3,210.5]){
  const z=49.0;
  w.box('wood',[x,.49,z],[.45,.04,.48],[0,.09,0],'abandoned-triage-chair-seat');
  w.box('wood',[x,.83,z-.21],[.45,.43,.042],[.12,.09,0],'abandoned-triage-chair-back');
  for(const side of [-1,1])for(const end of [-1,1])w.rod('metal',[x+side*.23,.15,z+end*.25],[x+side*.19,.49,z+end*.20],.019,'triage-chair-frame');
 }
 // Ground litter is sparse in the drive lane, dense in curb eddies.
 for(let i=0;i<116;i++){
  const x=157+rng()*66,z=(i%2?49.2:62.6)+(rng()-.5)*.7;
  if(Math.abs(x-202)<2.3&&z<52)continue;
  const size=.12+rng()*.15;
  w.surface(i%5?'pale':'wood',[[0,0,0],[size,.012,0],[size*.94,.006,size*1.35],[size*.05,.035,size*1.25]],[0,1,2,0,2,3],'creased-litter',[x,.135,z],[0,rng()*6,0]);
  if(i%8===0)weeds(x,z,.15,4);
 }
 // Distant industrial silhouettes terminate the westward view outside this
 // playable slice. The low foreground street remains entirely unobstructed.
 for(const [x,z,width,depth,height]of [[129,35,16,15,5.9],[128,79,18,12,4.3],[109,43,14,15,8.1]]){
  w.box('masonry',[x,-.015,z],[width+.75,.15,depth+1.0],[0,0,0],'industrial-ground-pad');
  w.box('brick',[x,height/2,z],[width,height,depth],[0,0,0],'industrial-background-mass');
  const faceX=x+width/2+.03;
  for(let y=2;y<height-1;y+=3)for(let dz=-depth/2+2;dz<depth/2-1;dz+=2.6){
   w.box('dark',[faceX,y,z+dz],[.04,1.25,1.55],[0,0,0],'distant-industrial-window');
   w.box('metal',[faceX+.04,y,z+dz],[.05,1.27,.045],[0,0,0],'industrial-window-mullion');
   w.box('pale',[faceX+.04,y-.69,z+dz],[.12,.10,1.74],[0,0,0],'industrial-window-sill');
  }
  for(let dz=-depth/2+.3;dz<depth/2;dz+=3.1)w.box('masonry',[faceX+.05,height/2,z+dz],[.19,height,.29],[0,0,0],'warehouse-structural-rib');
  w.box('metal',[faceX+.08,1.35,z],[.13,2.70,3.2],[0,0,0],'warehouse-loading-door');
  for(let y=.30;y<2.7;y+=.24)w.box('dark',[faceX+.16,y,z],[.027,.035,3.09],[0,0,0],'loading-door-corrugation');
  w.box('metal',[x,height+.12,z],[width+.12,.25,depth+.12],[0,0,0],'industrial-roof-edge');
  const slope=Math.atan2(2,depth/2),length=Math.hypot(2,depth/2);
  for(const side of [-1,1])w.box('roof',[x,height+1,z+side*depth/4],[width,.15,length],[side*slope,0,0],'industrial-pitched-roof');
  w.surface('brick',[[faceX,height,z-depth/2],[faceX,height,z+depth/2],[faceX,height+2,z]],[0,2,1],'warehouse-roof-gable');
 }
 for(const [x,z,h]of [[120,32,18],[109,72,22]]){
  w.box('masonry',[x,-.015,z],[3.2,.15,3.2],[0,0,0],'chimney-ground-pad');
  const g=new THREE.CylinderGeometry(.72,1.07,h,14);w.append('brick',g,[x,h/2,z],[0,0,0],'tapered-mill-chimney');
  for(const y of [h-1.4,h-.25])w.append('metal',new THREE.TorusGeometry(.80,.07,6,16),[x,y,z],[Math.PI/2,0,0],'chimney-iron-band');
 }
 // Riveted elevated water tank: legs, diagonal bracing, access ladder, conical
 // roof and safety ring produce a distinct silhouette instead of a box tower.
 const towerX=125,towerZ=69.5,towerY=12.5;
 w.box('masonry',[towerX,-.015,towerZ],[6.5,.15,6.5],[0,0,0],'water-tower-ground-pad');
 for(const [sx,sz]of [[-1,-1],[-1,1],[1,-1],[1,1]]){
  const a=[towerX+sx*2.6,.12,towerZ+sz*2.6],b=[towerX+sx*1.8,towerY,towerZ+sz*1.8];
  w.rod('rust',a,b,.11,'water-tower-splayed-leg',.07);
  w.rod('rust',[towerX+sx*2.25,5.4,towerZ+sz*2.25],[towerX-sx*1.95,10.0,towerZ+sz*1.95],.037,'water-tower-diagonal-brace');
 }
 const tank=new THREE.CylinderGeometry(2.45,2.35,4.2,24);w.append('metal',tank,[towerX,towerY+2.1,towerZ],[0,0,0],'water-tower-tank');
 for(const y of [towerY+.15,towerY+2,towerY+4.1])w.append('rust',new THREE.TorusGeometry(2.46,.055,6,24),[towerX,y,towerZ],[Math.PI/2,0,0],'water-tank-hoop');
 w.append('roof',new THREE.ConeGeometry(2.54,1.55,24),[towerX,towerY+4.98,towerZ],[0,0,0],'water-tank-conical-roof');
 w.rod('metal',[towerX+2.34,.2,towerZ],[towerX+2.48,towerY+4.2,towerZ],.031,'water-tower-access-ladder');
 w.rod('metal',[towerX+2.34,.2,towerZ+.44],[towerX+2.48,towerY+4.2,towerZ+.44],.031,'water-tower-access-ladder');
 for(let y=.8;y<towerY+4.1;y+=.45)w.rod('rust',[towerX+2.36,y,towerZ],[towerX+2.36,y,towerZ+.44],.019,'water-ladder-rung');
 // An elevated mill service bridge frames the distant road as a continuation.
 for(const z of [47.5,64.5])w.rod('rust',[104,.15,z],[104,7.9,z],.19,'mill-bridge-support');
 w.box('metal',[104,8,56],[2.1,.21,17.4],[0,0,0],'mill-elevated-service-bridge');
 for(const x of [103.03,104.97]){
  w.rod('rust',[x,9,47.4],[x,9,64.6],.031,'mill-bridge-railing');
  for(let z=47.5;z<64.5;z+=1.2)w.rod('metal',[x,8.12,z],[x,9,z],.026,'mill-bridge-railing-post');
 }
 // The gantry now overlaps a closed, low service checkpoint rather than
 // framing the empty horizon. Pads meet the inspection ground at x136; the
 // gate is remote scenery beyond the authored playable street boundary.
 w.box('masonry',[122,-.025,56],[34,.14,24],[0,0,0],'closed-service-court-ground');
 w.box('masonry',[104,-.025,56],[5,.14,19.5],[0,0,0],'gantry-ground-pad');
 for(const z of [49.65,53.85,58.15,62.35]){
  w.rod('metal',[133,.08,z],[133,2.68,z],.070,'closed-checkpoint-gate-post');
  w.box('pale',[133,2.71,z],[.18,.13,.18],[0,0,0],'checkpoint-post-cap');
 }
 for(const [start,end]of [[49.8,53.7],[54.0,58.0],[58.3,62.2]]){
  for(const y of [.52,2.23])w.rod('metal',[133.03,y,start],[133.03,y,end],.042,'closed-checkpoint-gate-rail');
  w.rod('rust',[133.035,.53,start],[133.035,2.22,end],.026,'checkpoint-gate-diagonal');
  for(let z=start+.12;z<end;z+=.28)w.rod('metal',[133.04,.54,z],[133.04,2.22,z],.019,'checkpoint-gate-bar');
 }
 // Staggered concrete traffic blocks have sloping shoulders and an interrupted
 // sightline. There is no tall opaque wall across the downtown composition.
 for(const z of [51.4,55.8,60.2]){
  w.box('masonry',[136.1,.36,z],[.88,.61,2.70],[0,.035,0],'low-closed-checkpoint-barrier');
  w.box('pale',[136.12,.76,z],[.49,.18,2.74],[0,.035,0],'checkpoint-barrier-shoulder');
  for(let dz=-1.05;dz<=1.05;dz+=.52)w.box('rust',[136.57,.54,z+dz],[.018,.19,.22],[0,0,-.25],'barrier-worn-warning-stripe');
 }
 // A small service gatehouse, backed by the mills and water tower, supplies the
 // third depth layer. Its window, inset door and pitched canopy read as a place.
 w.box('masonry',[119,1.65,59],[7.0,3.18,6.0],[0,0,0],'abandoned-service-gatehouse');
 w.box('dark',[122.54,1.62,60.1],[.055,1.19,1.93],[0,0,0],'gatehouse-recessed-window');
 for(const z of [59.1,60.1,61.1])w.box('metal',[122.59,1.62,z],[.062,1.24,.056],[0,0,0],'gatehouse-window-mullion');
 w.box('metal',[122.58,1.23,57.25],[.09,2.3,1.2],[0,0,0],'gatehouse-closed-door');
 w.box('pale',[122.65,2.50,57.25],[.16,.12,1.36],[0,0,0],'gatehouse-door-lintel');
 for(const side of [-1,1])w.box('roof',[119,3.82,59+side*1.51],[7.25,.15,3.28],[side*.36,0,0],'service-gatehouse-pitched-roof');
 w.surface('masonry',[[122.5,3.24,56],[122.5,3.24,62],[122.5,4.42,59]],[0,2,1],'gatehouse-roof-gable');
 w.box('metal',[119,4.46,59],[7.22,.11,.12],[0,0,0],'gatehouse-ridge');
 bush(132.1,49.2,1.1);bush(132.2,62.8,1.2);bush(127.7,54.0,.75);
 const result=w.finish(root,'evacuation-detail');return{root,...result,dispose(){result.dispose();root.removeFromParent();}};
}
