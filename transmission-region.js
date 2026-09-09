import * as THREE from './vendor/three.module.js';
// Same-resolution transmission rendering, restricted to the conservative union
// of all possible projected volume-refraction samples. Full viewport fallback
// is used for deformed geometry and volumes intersecting the near plane.
export class TransmissionRegion {
 constructor(renderer){
  this.renderer=renderer;this.meshes=[];this.box=new THREE.Box3();this.corner=new THREE.Vector3();this.scale=new THREE.Vector3();this.viewBox=new THREE.Box3();this.size=new THREE.Vector2();this.rect=new THREE.Vector4();this.saved=new Map();this.active=false;this.coverage=1;
  this.original=renderer.setRenderTarget;
  const self=this;
  renderer.setRenderTarget=function(target,...args){
   if(self.active&&target&&target.texture?.generateMipmaps&&target.samples>=4&&target.resolveDepthBuffer===false&&target.resolveStencilBuffer===false){
    if(!self.saved.has(target))self.saved.set(target,{scissor:target.scissor.clone(),test:target.scissorTest});
    const sx=target.width/self.size.x,sy=target.height/self.size.y;
    const x=Math.floor(self.rect.x*sx),y=Math.floor(self.rect.y*sy),right=Math.ceil((self.rect.x+self.rect.z)*sx),top=Math.ceil((self.rect.y+self.rect.w)*sy);
    target.scissor.set(x,y,right-x,top-y);target.scissorTest=true;
   }
   return self.original.call(this,target,...args);
  };
 }
 refresh(scene){this.meshes.length=0;scene.traverse(o=>{if(o.isMesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>m?.transmission>0))this.meshes.push(o);});}
 begin(camera){
  this.active=false;this.coverage=1;if(!this.meshes.length)return;
  this.renderer.getDrawingBufferSize(this.size);const outer=this.renderer.getRenderTarget();if(outer)this.size.set(outer.width,outer.height);
  camera.updateWorldMatrix(true,false);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,padding=0;
  for(const mesh of this.meshes){
   let visible=true;for(let p=mesh;p;p=p.parent)if(!p.visible){visible=false;break;}if(!visible||!mesh.layers.test(camera.layers))continue;
   if(mesh.isSkinnedMesh||mesh.isInstancedMesh||Object.keys(mesh.geometry.morphAttributes||{}).length)return;
   mesh.updateWorldMatrix(true,false);mesh.getWorldScale(this.scale);
   let expansion=0;for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){if(!(m.transmission>0))continue;if(m.thickness<0||m.thicknessMap)return;expansion=Math.max(expansion,(m.thickness||0)*Math.max(Math.abs(this.scale.x),Math.abs(this.scale.y),Math.abs(this.scale.z)));padding=Math.max(padding,4*Math.pow(2,Math.ceil(Math.log2(Math.max(this.size.x,this.size.y))*Math.min(1,Math.max(0,m.roughness))))+4);}
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();this.box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld).expandByScalar(expansion);this.viewBox.copy(this.box).applyMatrix4(camera.matrixWorldInverse);if(this.viewBox.max.z>=-camera.near)return;
   for(let i=0;i<8;i++){this.corner.set(i&1?this.box.max.x:this.box.min.x,i&2?this.box.max.y:this.box.min.y,i&4?this.box.max.z:this.box.min.z).project(camera);minX=Math.min(minX,(this.corner.x*.5+.5)*this.size.x);maxX=Math.max(maxX,(this.corner.x*.5+.5)*this.size.x);minY=Math.min(minY,(this.corner.y*.5+.5)*this.size.y);maxY=Math.max(maxY,(this.corner.y*.5+.5)*this.size.y);}
  }
  if(!Number.isFinite(minX))return;
  const x=Math.max(0,Math.floor(minX-padding)),y=Math.max(0,Math.floor(minY-padding)),right=Math.min(this.size.x,Math.ceil(maxX+padding)),top=Math.min(this.size.y,Math.ceil(maxY+padding));if(right<=x||top<=y)return;
  this.rect.set(x,y,right-x,top-y);this.coverage=this.rect.z*this.rect.w/(this.size.x*this.size.y);this.active=this.coverage<.98;
 }
 end(){this.active=false;for(const[target,saved]of this.saved){target.scissor.copy(saved.scissor);target.scissorTest=saved.test;}this.saved.clear();}
 dispose(){this.end();this.renderer.setRenderTarget=this.original;}
}
