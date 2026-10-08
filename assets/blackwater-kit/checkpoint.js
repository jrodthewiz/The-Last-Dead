import * as THREE from '../../vendor/three.module.js';
import {createBlackwaterSignMaterial} from './materials.js';

// An abandoned portable control station. Its entire anatomy, including the
// document tray and the hanging gate, belongs to the existing shallow proxy.
// Geometry/sign resources are owned here; district palette materials are not.
export function createBlackwaterCheckpoint(parent,p,materials,index=0){
  if(!Number.isFinite(p.width)||!Number.isFinite(p.depth)||p.width<3.5||p.depth<.5)throw new RangeError('Checkpoint requires a footprint at least 3.5 by 0.5 metres');
  if(![p.x,p.z,p.y??.15,p.yaw??0].every(Number.isFinite))throw new RangeError('Checkpoint requires a finite placement pose');
  // Emergency directions need a bright mass even in the storefront shadow;
  // their printed hierarchy differs from the district's dark shop signs.
  const sign=createBlackwaterSignMaterial('EVACUATION','CHECKPOINT / DOCK ROAD',{
    rim:'#132339',face:'#f0da9a',border:'#132339',ink:'#132339',labelFont:'Arial, sans-serif',fallback:'#f0da9a',
  });
  sign.name='blackwater-checkpoint-evacuation-sign';sign.userData.lookRole='sign';
  const palette={metal:materials.metal,wood:materials.wood,rust:materials.rust,dark:materials.dark,fabric:materials.fabric,paper:materials.paper,sign};
  if(Object.values(palette).some(m=>!m)){sign.map?.dispose();sign.dispose();throw new TypeError('Checkpoint requires metal, wood, rust, dark, fabric and paper district materials');}
  const root=new THREE.Group();root.name=`Blackwater-${p.id||index}-authored-checkpoint`;
  root.position.set(p.x,p.y??.15,p.z);root.rotation.y=p.yaw||0;parent.add(root);
  root.userData.blackwaterCheckpoint=true;root.userData.blackwaterPlacement=p.id;
  const batches=new Map(),moduleCounts={},moduleTriangles={},placements=[],contacts=[],supports=[];
  let role='checkpoint',serial=0;
  function face(slot,points,printUV=null){
    const normal=new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).cross(new THREE.Vector3(...points[2]).sub(new THREE.Vector3(...points[0]))).normalize();
    const u=new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).normalize(),v=normal.clone().cross(u),origin=new THREE.Vector3(...points[0]),metres=palette[slot].userData.textureMeters||2.4;
    const distances=points.map(p=>{const delta=new THREE.Vector3(...p).sub(origin);return[delta.dot(u),delta.dot(v)];});
    const indices=THREE.ShapeUtils.triangulateShape(distances.map(p=>new THREE.Vector2(...p)),[]);
    if(!batches.has(slot))batches.set(slot,{positions:[],normals:[],uvs:[],indices:[]});
    const batch=batches.get(slot),base=batch.positions.length/3;
    for(let i=0;i<points.length;i++){batch.positions.push(...points[i]);batch.normals.push(...normal.toArray());batch.uvs.push(...(printUV?.[i]||distances[i].map(x=>x/metres)));}
    for(const triangle of indices){
      const [a,b,c]=triangle,geometric=new THREE.Vector3(...points[b]).sub(new THREE.Vector3(...points[a])).cross(new THREE.Vector3(...points[c]).sub(new THREE.Vector3(...points[a])));
      if(geometric.dot(normal)<0)triangle.reverse();batch.indices.push(...triangle.map(i=>base+i));
    }
    moduleTriangles[role]=(moduleTriangles[role]||0)+indices.length;
  }
  function part(name,slot,build){
    role=name;moduleCounts[name]=(moduleCounts[name]||0)+1;
    const before=new Map([...batches].map(([slot,b])=>[slot,b.positions.length]));build();
    const bounds=new THREE.Box3();
    for(const [slot,b]of batches)for(let i=before.get(slot)||0;i<b.positions.length;i+=3)bounds.expandByPoint(new THREE.Vector3(...b.positions.slice(i,i+3)));
    const placement={id:`checkpoint-${serial++}`,role:name,slot,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};placements.push(placement);return placement;
  }
  const box=(slot,center,size,name)=>part(name,slot,()=>{
    const [x,y,z]=center,[w,h,d]=size.map(n=>n/2),corners=[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]].map(a=>[a[0]+x,a[1]+y,a[2]+z]);
    for(const indices of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])face(slot,indices.map(i=>corners[i]));
  });
  const prismXY=(slot,outline,z,depth,name)=>part(name,slot,()=>{
    const a=outline.map(([x,y])=>[x,y,z-depth/2]),b=outline.map(([x,y])=>[x,y,z+depth/2]);
    face(slot,a.slice().reverse());face(slot,b);
    for(let i=0;i<a.length;i++){const j=(i+1)%a.length;face(slot,[a[i],a[j],b[j],b[i]]);}
  });
  const slabXZ=(slot,outline,bottom,top,name)=>part(name,slot,()=>{
    const a=outline.map(([x,z])=>[x,bottom,z]),b=outline.map(([x,z])=>[x,top,z]);
    face(slot,a);face(slot,b.slice().reverse());
    for(let i=0;i<a.length;i++){const j=(i+1)%a.length;face(slot,[a[i],b[i],b[j],a[j]]);}
  });
  const beam=(slot,a,b,width,z,depth,name)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),n=[-dy/length*width/2,dx/length*width/2];
    return prismXY(slot,[a.map((v,i)=>v-n[i]),b.map((v,i)=>v-n[i]),b.map((v,i)=>v+n[i]),a.map((v,i)=>v+n[i])],z,depth,name);
  };
  const rod=(slot,start,end,radius,name,sides=8)=>part(name,slot,()=>{
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),direction=b.clone().sub(a).normalize(),reference=new THREE.Vector3(...(Math.abs(direction.y)>.9?[1,0,0]:[0,1,0]));
    const u=direction.clone().cross(reference).normalize(),v=direction.clone().cross(u);
    const ring=center=>Array.from({length:sides},(_,i)=>center.clone().addScaledVector(u,Math.cos(i/sides*Math.PI*2)*radius).addScaledVector(v,Math.sin(i/sides*Math.PI*2)*radius).toArray());
    const first=ring(a),last=ring(b);face(slot,first.slice().reverse());face(slot,last);
    for(let i=0;i<sides;i++){const j=(i+1)%sides;face(slot,[first[i],first[j],last[j],last[i]]);}
  });
  const tubePost=(x,bottom,top)=>part('hollow-steel-upright','metal',()=>{
    const ring=(r,y)=>[[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,z])=>[x+dx,y,z]);
    const a=ring(.050,bottom),b=ring(.050,top),c=ring(.032,bottom),d=ring(.032,top);
    for(let i=0;i<4;i++){const j=(i+1)%4;
      face('metal',[a[i],b[i],b[j],a[j]]);face('metal',[c[j],d[j],d[i],c[i]]);
      face('metal',[b[i],d[i],d[j],b[j]]);face('metal',[a[j],c[j],c[i],a[i]]);
    }
  });
  const half=p.width/2,postX=half-.32,footHalfDepth=Math.min(.295,p.depth/2-.02),frontLimit=p.depth/2-.025;
  for(const x of [-postX,postX]){
    const outline=[[x-.19,-footHalfDepth+.045],[x-.145,-footHalfDepth],[x+.145,-footHalfDepth],[x+.19,-footHalfDepth+.045],[x+.19,footHalfDepth-.045],[x+.145,footHalfDepth],[x-.145,footHalfDepth],[x-.19,footHalfDepth-.045]];
    const foot=slabXZ('metal',outline,0,.055,'grounded-channel-foot');contacts.push({placementId:foot.id,bottom:0,probe:[x,.04,footHalfDepth-.09]});
    tubePost(x,.055,1.77);
    for(const side of [-1,1])rod('rust',[x,.055,side*(footHalfDepth-.065)],[x,.42,side*.038],.025,'foot-to-post-triangle-brace');
  }
  beam('metal',[-postX,1.70],[postX,1.70],.085,0,.085,'continuous-top-frame');
  beam('metal',[-postX,.40],[postX,.40],.065,0,.065,'lower-frame-tie');

  // The fixed left gate and its damaged right leaf share a physical hinge post.
  // The right leaf is supported by its hinges and a taut retained strap, rather
  // than an unsupported board that merely happens to sit beside the barrier.
  const hingeX=.38,hingeTop=1.075,hingeBottom=.515,tipX=postX-.13,tipTop=index%2?.68:.63,tipBottom=tipTop-(hingeTop-hingeBottom);
  beam('wood',[-postX,hingeTop],[hingeX,hingeTop],.12,-.005,.064,'fixed-timber-upper-rail');
  beam('wood',[-postX,.535],[hingeX,.535],.11,-.005,.064,'fixed-timber-lower-rail');
  const slatCount=Math.max(4,Math.round((postX+hingeX-.2)/.37));
  for(let i=0;i<slatCount;i++){
    const x=-postX+.16+i*(postX+hingeX-.30)/(slatCount-1),h=.10;
    prismXY('wood',[[x-h/2,.51],[x+h/2,.51],[x+h/2,1.09],[x+.016,1.13],[x-.011,1.10],[x-h/2,1.13]],.046,.038,'fixed-gate-split-timber-slat');
  }
  beam('metal',[hingeX,.385],[hingeX,1.16],.080,0,.080,'central-gate-hinge-post');
  beam('wood',[hingeX,hingeTop],[tipX,tipTop],.11,.040,.055,'hanging-gate-upper-frame');
  beam('wood',[hingeX,hingeBottom],[tipX,tipBottom],.105,.040,.055,'hanging-gate-lower-frame');
  beam('wood',[hingeX,hingeBottom],[hingeX,hingeTop],.080,.040,.055,'hanging-gate-hinge-stile');
  beam('wood',[tipX,tipBottom],[tipX,tipTop],.080,.040,.055,'hanging-gate-end-stile');
  const gateAt=t=>[hingeX+(tipX-hingeX)*t,hingeTop+(tipTop-hingeTop)*t,hingeBottom+(tipBottom-hingeBottom)*t];
  for(const t of [.20,.48,.78]){
    const [x,top,bottom]=gateAt(t),w=.048;
    if(t===.48){
      prismXY('wood',[[x-w,bottom-.005],[x+w,bottom-.005],[x+w,bottom+.13],[x+.014,bottom+.10],[x-.018,bottom+.18],[x-w,bottom+.14]],.077,.028,'broken-gate-bottom-splinter');
      prismXY('wood',[[x-w,top-.14],[x-.013,top-.10],[x+.018,top-.18],[x+w,top-.13],[x+w,top+.01],[x-w,top+.01]],.077,.028,'broken-gate-top-splinter');
    }else beam('wood',[x,bottom],[x,top],.087,.077,.028,'hanging-gate-retained-slat');
  }
  for(const y of [hingeBottom+.07,hingeTop-.065])rod('rust',[hingeX-.045,y,-.056],[hingeX-.045,y,.107],.039,'gate-pivot-barrel');
  const [strapX,strapTop]=gateAt(.81);
  beam('dark',[strapX,strapTop+.035],[postX,1.13],.044,.103,.018,'taut-gate-retention-strap');
  for(const y of [.69,.85]){
    rod('dark',[-postX+.08,y,.019],[-.63,y-.055,.024],.009,'fixed-gate-sparse-tension-wire',6);
    rod('dark',[-.63,y-.055,.024],[hingeX-.10,y-.016,.021],.009,'fixed-gate-sparse-tension-wire',6);
  }

  // One dominant identifier, painted by the existing sign API. Both road
  // approaches see the same original canvas; sign UVs preserve its full atlas.
  const signWidth=Math.min(2.70,p.width*.565),signHeight=signWidth/4,signX=-p.width*.085,signY=1.31;
  box('dark',[signX,signY,.068],[signWidth+.065,signHeight+.065,.056],'evacuation-sign-supported-backing');
  const signBounds=part('evacuation-identifier','sign',()=>{
    const left=signX-signWidth/2,right=signX+signWidth/2,bottom=signY-signHeight/2,top=signY+signHeight/2;
    face('sign',[[left,bottom,.097],[right,bottom,.097],[right,top,.097],[left,top,.097]],[[0,0],[1,0],[1,1],[0,1]]);
    face('sign',[[right,bottom,.039],[left,bottom,.039],[left,top,.039],[right,top,.039]],[[0,0],[1,0],[1,1],[0,1]]);
  });
  for(const x of [signX-signWidth*.39,signX+signWidth*.39]){
    box('rust',[x,1.692,.068],[.075,.16,.072],'sign-top-frame-mount');
    rod('metal',[x,1.595,.034],[x,1.595,.102],.025,'sign-mount-rivet');
  }

  // An opened registration folio remains clipped to a bracket. The metal tray
  // is fastened to the left post; its binding touches the actual tray top.
  const trayX=-postX+.065,trayZ=frontLimit-.135,trayTop=.82,bookX=trayX+.015,bookZ=trayZ,bookWidth=.45,bookDepth=.22;
  const tray=box('metal',[trayX,trayTop-.018,trayZ],[.56,.036,.27],'post-attached-document-tray');
  beam('metal',[-postX,.66],[trayX,.802],.05,trayZ-.08,.047,'document-tray-support-bracket');
  rod('rust',[-postX,.73,-.051],[-postX,.73,Math.min(frontLimit-.02,trayZ+.04)],.024,'document-bracket-post-clamp');
  const binding=box('fabric',[bookX,trayTop+.010,bookZ],[bookWidth+.025,.020,bookDepth+.020],'folio-binding-on-tray');
  supports.push({placementId:binding.id,supportId:tray.id,bottom:trayTop,top:trayTop,bounds:tray.bounds});
  const left=bookX-bookWidth/2,right=bookX+bookWidth/2,back=bookZ-bookDepth/2,front=bookZ+bookDepth/2,base=trayTop+.020;
  part('opened-registration-folio','paper',()=>{
    const points=[[left,base,back],[bookX,base+.035,back],[right,base,back],[left,base,front],[bookX,base+.035,front],[right,base,front]];
    face('paper',[points[0],points[3],points[4],points[1]]);face('paper',[points[1],points[4],points[5],points[2]]);
    face('paper',[[left,base,back],[right,base,back],[right,base,front],[left,base,front]]);
    face('paper',[points[0],points[1],points[2]]);face('paper',[points[5],points[4],points[3]]);
  });
  const strapY=base+.035*(1-.11/(bookWidth/2));
  box('dark',[bookX+.11,strapY+.009,bookZ],[.032,.016,bookDepth+.040],'registration-folio-retaining-strap');
  for(const z of [back-.013,front+.013])box('dark',[bookX+.11,base+.008,z],[.032,.030,.018],'folio-strap-retained-turn');

  const meshes=[],geometries=[],localBounds=new THREE.Box3();let triangles=0,vertices=0;
  for(const [slot,batch]of batches){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));geometry.setIndex(batch.indices);
    geometry.computeBoundingBox();geometry.computeBoundingSphere();localBounds.union(geometry.boundingBox);
    const mesh=new THREE.Mesh(geometry,palette[slot]);mesh.name=`checkpoint-${slot}`;mesh.userData.blackwaterSlot=slot;mesh.userData.blackwaterCheckpoint=true;mesh.castShadow=slot!=='sign';mesh.receiveShadow=true;
    root.add(mesh);meshes.push(mesh);geometries.push(geometry);triangles+=batch.indices.length/3;vertices+=batch.positions.length/3;
  }
  const bounds={min:localBounds.min.toArray(),max:localBounds.max.toArray()};root.updateMatrixWorld(true);
  const worldBounds=new THREE.Box3().setFromObject(root);
  let disposed=false;
  return{root,triangles,drawCalls:meshes.length,moduleCounts,bounds,
    diagnostics:{id:p.id,coordinateSystem:'local-three-metres',footprint:{width:p.width,depth:p.depth},triangles,vertices,drawCalls:meshes.length,materials:[...batches.keys()],ownedMaterials:1,ownedTextures:sign.map?1:0,addedCollisionSolids:0,
      placements,moduleTriangles,contacts,supports,sign:{label:'EVACUATION',subtitle:'CHECKPOINT / DOCK ROAD',width:signWidth,height:signHeight,placementId:signBounds.id,twoSided:true,lookRole:'sign'},
      damage:{hinge:[hingeX,hingeTop,.040],tip:[tipX,tipTop,.040],missingSlatAt:.48,retainedBy:'taut-gate-retention-strap'},document:{center:[bookX,base+.035,bookZ],trayTop,bindingBottom:trayTop},worldBounds:{min:worldBounds.min.toArray(),max:worldBounds.max.toArray()}},
    dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)mesh.removeFromParent();for(const geometry of geometries)geometry.dispose();sign.map?.dispose();sign.dispose();root.removeFromParent();},
  };
}
