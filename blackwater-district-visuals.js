import * as THREE from './vendor/three.module.js';
import {createModel} from './assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials,createBlackwaterSignMaterial} from './assets/blackwater-kit/materials.js';
import {createCoastalInstances} from './coastal-instancing.js';
import {createBlackwaterWreck,buildBlackwaterDressing} from './assets/blackwater-kit/set-dressing.js';
import {createBlackwaterCheckpoint} from './assets/blackwater-kit/checkpoint.js';
import {buildBlackwaterInteriorStory} from './assets/blackwater-kit/interior-story.js';
import {buildBlackwaterPracticals} from './assets/blackwater-kit/practicals.js';
import {createBlackwaterBuildingBatches} from './blackwater-building-batches.js';
import {shareBlackwaterOwnedMaterials} from './blackwater-material-sharing.js';

// The failed checkpoint transfer keeps its original footprint and four cases.
// Two remained together; one was set down sideways and one dropped apart.
export const BLACKWATER_CHECKPOINT_CASE_POSES=Object.freeze([
 Object.freeze({x:-.63,z:.04,width:.47,height:.43,depth:.28,yaw:-.18,roll:0}),
 Object.freeze({x:-.10,z:.12,width:.43,height:.38,depth:.27,yaw:.08,roll:0}),
 Object.freeze({x:.50,z:.07,width:.46,height:.40,depth:.28,yaw:-.25,roll:0,pitch:Math.PI/2}),
 Object.freeze({x:.28,z:-.30,width:.42,height:.35,depth:.25,yaw:.35,roll:0}),
]);

// Custom Vibe3D authoring sources: the district owns placement; factories own
// model anatomy. Street repetitions share material/geometry in spatial batches.
export function buildBlackwaterDistrict(parent,slice,{buildingChunkSize=48,nativeBundles=true,failedClosure=true,failedTransfer=true,groundCornerJoin=true}={}){
 const root=new THREE.Group();root.name='BlackwaterMainStreet';parent.add(root);
 const materials=createBlackwaterMaterials(),models=[];
 for(const [index,b]of slice.buildings.entries()){
  const model=createModel({kind:b.kind,width:b.width,depth:b.depth,height:b.height,districtProfile:b.districtProfile,
   seed:b.seed??1400+index,enterable:!!b.enterable,doorOffset:b.doorOffset??2,label:b.label,materials,failedClosure:failedClosure&&b.id==='coast-lot-3-0-1-0',groundCornerJoin});
  model.root.position.set(b.x,b.y??.13,b.z);model.root.rotation.y=b.yaw||0;
  model.root.name=b.id;model.root.userData.blackwaterPlacement=b.id;root.add(model.root);models.push(model);
 }
 const sharing=shareBlackwaterOwnedMaterials(models);
 const buildingBatches=createBlackwaterBuildingBatches(root,models,{chunkSize:buildingChunkSize,nativeBundles});
 const street=buildStreetProps(root,slice.props,materials,{failedTransfer});
 const dressing=buildBlackwaterDressing(root,slice,materials);
 const interiorStory=buildBlackwaterInteriorStory(root,slice,materials);
 const practicals=buildBlackwaterPracticals(root,slice,materials);
 // Scope graph selection to these existing identities, only after all actual
 // source, merged and dressing consumers prove the named physical schema.
 const roofPlaneBytes={source:0,merged:0,dressing:0};let roofPlaneConsumers=0;
 root.traverse(object=>{
  if(!object.isMesh||(object.material!==materials.roof&&object.material!==materials.roofZinc))return;
  const plane=object.geometry?.getAttribute('roofPlane');
  if(!plane||plane.itemSize!==4||plane.count!==object.geometry.attributes.position.count)throw new Error('District roof consumer lacks roofPlane: '+object.name);
  roofPlaneConsumers++;
  const owner=object.userData.blackwaterDressing?'dressing':object.userData.blackwaterBuildingBatch?'merged':'source';
  roofPlaneBytes[owner]+=plane.array.byteLength;
 });
 for(const material of [materials.roof,materials.roofZinc])material.userData.blackwaterRoofPlane=true;
 const diagnostics={roofPlane:{encoding:'0 legacy;1 zinc;1.25 zinc monitor seat;2 residential',consumers:roofPlaneConsumers,bytes:roofPlaneBytes},version:1,buildings:models.length,houses:slice.buildings.filter(b=>b.kind==='house').length,
  enterable:slice.buildings.filter(b=>b.enterable).map(b=>b.id),models:models.map((m,i)=>({id:slice.buildings[i].id,...m.diagnostics})),street,dressing:{triangles:dressing.triangles,drawCalls:dressing.drawCalls,moduleCounts:dressing.moduleCounts},
  source:'Original Blackwater kit; Vibe3D createModel/parts/ownership contract',materials:Object.keys(materials).length,interiorStory:interiorStory.diagnostics,practicals:practicals.diagnostics,buildingBatches:buildingBatches.diagnostics,materialSharing:sharing.diagnostics};
 let disposed=false;
 return{root,models,materials,diagnostics,bundleDiagnostics:buildingBatches.bundleDiagnostics,prepareRenderBundles:buildingBatches.prepareRenderBundles,dispose(){if(disposed)return;disposed=true;buildingBatches.dispose();sharing.restore();for(const m of models)m.dispose();street.dispose();dressing.dispose();interiorStory.dispose();practicals.dispose();
  materials.dispose();root.removeFromParent();}};
}

function buildStreetProps(parent,props,materials,{failedTransfer=true}={}){
 const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10),rubble=new THREE.DodecahedronGeometry(1,0);
 const caseShape=new THREE.Shape();caseShape.moveTo(-.39,-.47);caseShape.lineTo(.39,-.47);caseShape.quadraticCurveTo(.47,-.47,.47,-.39);caseShape.lineTo(.47,.39);caseShape.quadraticCurveTo(.47,.47,.39,.47);caseShape.lineTo(-.39,.47);caseShape.quadraticCurveTo(-.47,.47,-.47,.39);caseShape.lineTo(-.47,-.39);caseShape.quadraticCurveTo(-.47,-.47,-.39,-.47);
 const caseGeometry=new THREE.ExtrudeGeometry(caseShape,{depth:.94,steps:1,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1,curveSegments:4});caseGeometry.translate(0,0,-.47);
 const groups=new Map(),pose=new THREE.Object3D(),partPose=new THREE.Object3D(),base=new THREE.Matrix4(),ownedMaterials=[],wrecks=[],checkpoints=[];
 const caseMaterials=['#59656a','#83715b'].map((color,index)=>{const mat=new THREE.MeshStandardMaterial({color,roughness:.95});mat.name=`blackwater-evacuation-case-${index}`;mat.userData.lookRole='cloth';ownedMaterials.push(mat);return mat;});
 const m=(name,fallback='metal')=>materials[name]||materials[fallback]||Object.values(materials)[0];
 function emit(geometry,material,name,x,y,z,w,h,d,rot=[0,0,0]){
  partPose.position.set(x,y,z);partPose.rotation.set(...rot);partPose.scale.set(w,h,d);partPose.updateMatrix();
  const matrix=base.clone().multiply(partPose.matrix),key=`${geometry.uuid}/${material.uuid}/${Math.floor(pose.position.x/64)}/${Math.floor(pose.position.z/64)}`;
  if(!groups.has(key))groups.set(key,{geometry,material,name,matrices:[]});groups.get(key).matrices.push(matrix);
 }
 const cube=(slot,name,x,y,z,w,h,d,rot)=>emit(box,m(slot),name,x,y,z,w,h,d,rot);
 for(const [index,p]of props.entries()){
  pose.position.set(p.x,.15,p.z);pose.rotation.set(0,p.yaw||0,0);pose.scale.set(1,1,1);pose.updateMatrix();base.copy(pose.matrix);
  if(p.kind==='wreck'){
   wrecks.push(createBlackwaterWreck(parent,p,materials,index));
  }else if(p.kind==='barricade'){
   checkpoints.push(createBlackwaterCheckpoint(parent,p,materials,index));
  }else if(p.kind==='rubble'){
   let seed=index+173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<16;i++)emit(rubble,m(i%3?'masonry':'brick'),'Evacuation:broken-masonry',(random()-.5)*p.width,.12+random()*.12,(random()-.5)*p.depth,.08+random()*.22,.05+random()*.12,.09+random()*.25,[random(),random()*6,random()]);
   for(let i=0;i<3;i++)cube('wood','Evacuation:split-timber',(random()-.5)*p.width,.12,(random()-.5)*p.depth,.10,.055,1+random(),[0,random()*5,.03]);
  }else if(p.kind==='luggage'){
   if(failedTransfer&&p.id==='blackwater-checkpoint-bags'){
    const propBase=base.clone(),casePose=new THREE.Object3D();
    for(const [i,a]of BLACKWATER_CHECKPOINT_CASE_POSES.entries()){
     const pitch=a.pitch||0,halfHeight=(Math.abs(Math.cos(pitch))*(Math.abs(Math.cos(a.roll))*a.height+Math.abs(Math.sin(a.roll))*a.width)+Math.abs(Math.sin(pitch))*a.depth)*.53;
     casePose.position.set(a.x,halfHeight+.018,a.z);casePose.rotation.set(pitch,a.yaw,a.roll,'YXZ');casePose.updateMatrix();base.copy(propBase).multiply(casePose.matrix);
     emit(caseGeometry,caseMaterials[i%2],'Evacuation:rounded-case',0,0,0,a.width,a.height,a.depth);
     cube('metal','Evacuation:case-handle',0,a.height/2+.018,0,.19,.035,.025);
     for(const side of [-1,1])cube('dark','Evacuation:case-binding',side*a.width*.28,0,0,.025,a.height*1.025,a.depth*1.05);
     for(const side of [-1,1])cube('rust','Evacuation:case-clasp',side*a.width*.26,a.height*.23,a.depth/2+.01,.035,.05,.025);
     // The departure tag remains attached to the dropped case, not road clutter.
     if(i===2)cube('pale','Evacuation:attached-case-tag',.055,a.height/2+.036,0,.13,.006,.09,[0,.08,0]);
    }
    base.copy(propBase);
   }else{
   for(let i=0;i<4;i++){
    const x=(i%2-.5)*.63,z=(Math.floor(i/2)-.5)*.47;
    emit(caseGeometry,caseMaterials[i%2],'Evacuation:rounded-case',x,.25,z,.47,.43,.28,[0,(i-1.5)*.15,0]);
    cube('metal','Evacuation:case-handle',x,.48,z,.19,.035,.025);
    for(const side of [-1,1])cube('dark','Evacuation:case-binding',x+side*.13,.25,z,.025,.44,.295,[0,(i-1.5)*.15,0]);
    for(const side of [-1,1])cube('rust','Evacuation:case-clasp',x+side*.12,.35,z+.15,.035,.05,.035);
   }
   }
  }else if(p.kind==='fence'){
   for(const x of [-p.width/2,p.width/2])cube('wood','Garden:post',x,.65,0,.11,1.3,.11);
   for(const y of [.35,.9])cube('wood','Garden:rail',0,y,0,p.width,.095,.06);
   for(let x=-p.width/2+.16;x<p.width/2;x+=.24)cube('pale','Garden:chipped-picket',x,.62,0,.13,1.08,.05);
  }else if(p.kind==='utility'){
   cube('wood','Utility:weathered-pole',0,3.2,0,.18,6.4,.18);
   cube('metal','Utility:crossbar',0,5.85,0,1.8,.1,.1);
   for(const x of [-.6,0,.6])emit(cylinder,m('pale'),'Utility:insulator',x,6,0,.1,.16,.1);
   cube('metal','Utility:junction-box',.15,1.9,0,.38,.55,.28);
  }else if(p.kind==='poster'){
   cube('wood','Evacuation:notice-board',0,1.45,0,p.width,1.65,.12);
   const sign=createBlackwaterSignMaterial(p.id.includes('pharmacy')?'FIRST AID':p.id.includes('missing')?'STILL MISSING':'EVACUATION CLOSED',p.id.includes('missing')?'VENN / BAY 02 / REPORT TO CUSTOMS':'REPORT TO NETMAKERS / DOCK ROAD');ownedMaterials.push(sign);
   emit(box,sign,'Evacuation:printed-notice',0,1.63,.079,p.width*.9,.44,.02);
   cube('pale','Evacuation:torn-paper',-.2,1.13,.076,p.width*.36,.38,.023,[0,0,.12]);
   for(const side of [-1,1])cube('wood','Evacuation:board-leg',side*p.width*.34,.66,0,.1,1.32,.1);
  }
 }
 // Debris follows the failed checkpoint, rather than decorating every lot.
 pose.position.set(0,0,0);pose.rotation.set(0,0,0);pose.updateMatrix();base.copy(pose.matrix);
 let seed=6813;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<60;i++){
  const x=158+random()*61,z=(i%2?50.4:61.6)+(random()-.5)*1.4;
  // Keep the doorway and truck centre open; these are scattered small fragments.
  if(Math.abs(x-202)<2.8&&z<52)continue;
  emit(rubble,m(i%4?'masonry':'brick'),'Checkpoint:fragment-trail',x,.13+random()*.06,z,.04+random()*.12,.03+random()*.07,.05+random()*.14,[random(),random()*6,random()]);
  if(i%4===0)cube('pale','Checkpoint:discarded-paper',x,.10,z,.22,.008,.32,[0,random()*6,0]);
 }
 // Seated cable spans connect visible utility poles, with gravity sag.
 for(const [a,b]of [[[185,6.15,50],[207.4,6.15,49.6]],[[185,6.15,50],[186,5.9,63.7]]]){
  for(let i=0;i<12;i++){
   const point=t=>new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-Math.sin(t*Math.PI)*.65,a[2]+(b[2]-a[2])*t);
   const start=point(i/12),end=point((i+1)/12),direction=end.clone().sub(start),center=start.clone().add(end).multiplyScalar(.5);
   const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()),e=new THREE.Euler().setFromQuaternion(q);
   emit(cylinder,m('dark'),'Utility:sagging-cables',...center.toArray(),.015,direction.length(),.015,e.toArray().slice(0,3));
  }
 }
 let instances=0,triangles=0;const meshes=[];
 for(const item of groups.values()){
  const mesh=createCoastalInstances(item.geometry,item.material,item.matrices.length);mesh.name=item.name;
  item.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;parent.add(mesh);meshes.push(mesh);
  instances+=item.matrices.length;triangles+=(item.geometry.index?.count||item.geometry.attributes.position.count)/3*item.matrices.length;
 }
 return{props:props.length,instances,triangles:triangles+[...wrecks,...checkpoints].reduce((sum,w)=>sum+w.triangles,0),drawCalls:meshes.length+[...wrecks,...checkpoints].reduce((sum,w)=>sum+w.drawCalls,0),wrecks:wrecks.map(w=>({triangles:w.triangles,drawCalls:w.drawCalls,modules:w.moduleCounts})),checkpoints:checkpoints.map(w=>w.diagnostics),dispose(){for(const mesh of meshes){mesh.dispose();mesh.removeFromParent();}for(const wreck of wrecks)wreck.dispose();for(const checkpoint of checkpoints)checkpoint.dispose();for(const geometry of [box,cylinder,rubble,caseGeometry])geometry.dispose();for(const material of ownedMaterials){material.map?.dispose();material.dispose();}}};
}
