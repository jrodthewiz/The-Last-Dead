import * as THREE from './vendor/three.module.js';
import {createCoastalInstances} from './coastal-instancing.js';

// Templates are scoped to this world so normal scene teardown owns shared data.
export class HarborThaiVisuals {
 constructor(parent,layout){
  this.root=new THREE.Group();this.root.name='ThaiKitHarbor';parent.add(this.root);
  this.disposed=false;this.templates=new Map();this.diagnostics={loaded:[],errors:[],placements:0,buildings:layout.buildings.length,props:layout.props.length,coastalDrawCalls:0};
  const records=[...layout.buildings,...layout.props];
  this.ready=Promise.all([...new Set(records.map(p=>p.asset))].map(async asset=>{
   try{
    const module=await import(`./assets/thai-kit/${asset}.js`);
    if(this.disposed)return;
    const value=module.createModel();const template=value?.root||value?.group||value;
    if(!template?.isObject3D)throw new Error('Factory did not return Object3D');
    template.updateMatrixWorld(true);this.templates.set(asset,template);
    const coastal=records.filter(p=>p.asset===asset&&p.coastal);
    if(coastal.length)this.batchCoastal(template,coastal);
    for(const p of records.filter(p=>p.asset===asset)){
     if(p.coastal)continue;
     const model=template.clone(true);model.name=p.id;
     const source=new THREE.Box3().setFromObject(model),size=source.getSize(new THREE.Vector3());
     const fit=Math.min((p.fitWidth||p.width)/size.x,p.height/size.y,(p.fitDepth||p.depth)/size.z);
     if(!Number.isFinite(fit)||fit<=0)throw new Error('Invalid model bounds');
     model.scale.multiplyScalar(fit);model.updateMatrixWorld(true);
     const bounds=new THREE.Box3().setFromObject(model),centre=bounds.getCenter(new THREE.Vector3());
     model.position.sub(new THREE.Vector3(centre.x,bounds.min.y,centre.z));
     const pivot=new THREE.Group();pivot.name=`Placement:${p.id}`;pivot.add(model);pivot.rotation.y=p.yaw||0;pivot.position.set(p.x,p.y??.14,p.z);
     pivot.userData.thaiAsset=asset;pivot.userData.thaiPlacement=p.id;
     model.traverse(o=>{if(o.isMesh){o.castShadow=p.height>2;o.receiveShadow=true;}});
     this.root.add(pivot);this.diagnostics.placements++;
    }
    this.diagnostics.loaded.push(asset);
   }catch(error){this.diagnostics.errors.push(`${asset}: ${error.message}`);}
  })).then(()=>this.diagnostics);
 }
 batchCoastal(template,records){
  const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
  const batches=new Map(),pose=new THREE.Object3D(),local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),base=new THREE.Matrix4();
  for(const p of records){
   // Coastal lots describe occupied world-space footprints. Uniform fitting by
   // height left wide empty strips inside solid collision rectangles.
   const quarterTurn=Math.abs(Math.sin(p.yaw||0))>.5;
   const localWidth=quarterTurn?p.depth:p.width,localDepth=quarterTurn?p.width:p.depth;
   pose.position.set(p.x,p.y??.14,p.z);pose.rotation.set(0,p.yaw||0,0);
   pose.scale.set(localWidth/size.x,p.height/size.y,localDepth/size.z);pose.updateMatrix();
   base.copy(pose.matrix).multiply(new THREE.Matrix4().makeTranslation(-centre.x,-bounds.min.y,-centre.z));
   template.traverse(source=>{
    if(!source.isMesh)return;
    const key=`${source.uuid}/${Math.floor(p.x/64)}/${Math.floor(p.z/64)}`;
    let batch=batches.get(key);if(!batch)batches.set(key,batch={source,matrices:[],colors:[]});
    for(let i=0;i<(source.isInstancedMesh?source.count:1);i++){
     matrix.copy(base).multiply(source.matrixWorld);
     if(source.isInstancedMesh){source.getMatrixAt(i,local);matrix.multiply(local);}
     batch.matrices.push(matrix.clone());
     if(source.instanceColor){const color=new THREE.Color();source.getColorAt(i,color);batch.colors.push(color);}
    }
   });this.diagnostics.placements++;
  }
  for(const {source,matrices,colors}of batches.values()){
   const mesh=createCoastalInstances(source.geometry,source.material,matrices.length);
   mesh.name='CoastalArchitecture';mesh.userData.coastal=true;
   matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(colors[i])mesh.setColorAt(i,colors[i]);});
   mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingSphere();this.root.add(mesh);this.diagnostics.coastalDrawCalls++;
  }
 }
 dispose(){this.disposed=true;this.templates.clear();}
}
