import * as T from '../vendor/three.module.js';

// Warm spill under street fixtures. One shared radial texture and one instanced
// draw per district keeps the lamp pools from becoming a draw-call tax.
export function createLightPools(scene,positions){
 if(!positions.length)return null;
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,4,64,64,64);
 g.addColorStop(0,'rgba(255,198,118,.95)');
 g.addColorStop(.32,'rgba(255,174,92,.50)');
 g.addColorStop(.72,'rgba(255,142,70,.15)');
 g.addColorStop(1,'rgba(255,130,60,0)');
 ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const geometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
 const material=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.58,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-4});
 const mesh=new T.InstancedMesh(geometry,material,positions.length);mesh.name='Warm lamp pools';mesh.frustumCulled=false;
 const dummy=new T.Object3D();
 for(let i=0;i<positions.length;i++){
  const p=positions[i];
  dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation||0,0);dummy.scale.set(p.width,p.depth*0.55,p.depth*0.55);
  dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);
 return mesh;
}
