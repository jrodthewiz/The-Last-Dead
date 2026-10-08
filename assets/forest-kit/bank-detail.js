import * as THREE from '../../vendor/three.module.js';
import {capeGroundHeight,capeStreamZ,capeStreamWidth} from '../../coastal-terrain.js';
import {capeSurfaceFields,capeDetailClear} from '../../coastal-terrain-fields.js';

export function buildCapeBankDetail({forest=[],material,cullDistance=110}={}){
  const root=new THREE.Group();root.name='CapeShaleAndRoots';root.userData.noBatch=true;
  const bins=new Map(),geometries=[],meshes=[];
  const stone=new THREE.Color('#9eafb1'),rootColor=new THREE.Color('#654d38'),edgeColor=new THREE.Color('#53625e');
  let seed=151041,plates=0,roots=0,triangles=0;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const triangle=(a,b,c,color)=>{
    const key=`${Math.floor(a[0]/32)}:${Math.floor(a[2]/32)}`;
    if(!bins.has(key))bins.set(key,{positions:[],colors:[],uv:[]});const bin=bins.get(key);
    for(const p of [a,b,c]){bin.positions.push(...p);bin.colors.push(color.r,color.g,color.b);bin.uv.push(p[0]/12,p[2]/12);}triangles++;
  };
  const point=(x,z,relief)=>[x,capeGroundHeight(x,z,{bridges:false})+relief,z];
  // Broad, embedded angular shelves, not solid boulders without collision.
  for(let x=134;x<431;x+=3.4)for(const side of [-1,1])for(const band of [1.3,3.8]){
    const px=x+(rand()-.5)*1.1,pz=capeStreamZ(px)+side*(capeStreamWidth(px)+band+rand()*.8),r=.38+rand()*.62;
    if(!capeDetailClear(px,pz,r)||rand()>.83)continue;
    const f=capeSurfaceFields(px,pz),tint=stone.clone().multiplyScalar(.80+.20*rand()).lerp(rootColor,f.wetness*.24),ring=[],inner=[];
    const yaw=rand()*Math.PI*2,jitter=Array.from({length:6},rand);
    for(let i=0;i<8;i++){const a=yaw+i*Math.PI/4,s=r*((i%3===1?.54:.79)+jitter[i%6]*.20),dx=Math.cos(a)*s,dz=Math.sin(a)*s*.63;ring.push(point(px+dx,pz+dz,.016));inner.push(point(px+dx*.9,pz+dz*.9,.024));}
    const center=point(px,pz,.034);
    for(let i=0;i<8;i++){
      const n=(i+1)%8,facet=tint.clone().multiplyScalar(.82+(i%3)*.11);
      triangle(center,inner[n],inner[i],facet);
      triangle(inner[i],inner[n],ring[i],edgeColor);triangle(ring[i],inner[n],ring[n],edgeColor);
    }plates++;
  }
  // Short branching ribbons remain attached to actual tree footings. Every
  // vertex follows the collision surface within 3.4 cm and stays off paths.
  for(const tree of forest.filter(p=>p.z>326&&p.id.startsWith('cape-forest-'))){
    const f=capeSurfaceFields(tree.x,tree.z);if(f.bankDistance>24&&rand()>.3)continue;
    for(let arm=0;arm<3;arm++){
      const yaw=arm*Math.PI*2/3+rand()*.8,length=.8+rand()*.85;
      const endX=tree.x+Math.cos(yaw)*length,endZ=tree.z+Math.sin(yaw)*length;
      if(!capeDetailClear(tree.x,tree.z,.35)||!capeDetailClear(endX,endZ,.15))continue;
      const tint=rootColor.clone().multiplyScalar(.88+rand()*.2),rows=[];
      for(let i=0;i<=4;i++){
        const t=i/4,a=yaw+Math.sin(t*4)*.16,x=tree.x+Math.cos(a)*(.24+t*(length-.24)),z=tree.z+Math.sin(a)*(.24+t*(length-.24)),w=.085*(1-t)+.014;
        rows.push([point(x-Math.sin(a)*w,z+Math.cos(a)*w,.018),point(x+Math.sin(a)*w,z-Math.cos(a)*w,.018),point(x,z,.034*(1-t)+.009*t)]);
      }
      for(let i=0;i<4;i++){const a=rows[i],b=rows[i+1];triangle(a[0],b[2],a[2],tint);triangle(a[0],b[0],b[2],tint);triangle(a[2],b[2],a[1],tint);triangle(a[1],b[2],b[1],tint);}roots++;
    }
  }
  for(const [key,bin]of bins){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(bin.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(bin.colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(bin.uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,material);mesh.name=`CapeBankDetail:${key}`;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);meshes.push(mesh);geometries.push(g);
  }
  let disposed=false;const cameraPoint=new THREE.Vector3();
  const diagnostics={plates,roots,triangles,batches:meshes.length,addedMaterials:0,addedTextures:0,addedShadowMaps:0,cullDistance,maximumReliefMetres:.034,visibleBatches:0};
  return {root,diagnostics,update(camera){if(disposed||!camera)return;camera.getWorldPosition(cameraPoint);let visible=0;for(const mesh of meshes){const b=mesh.geometry.boundingSphere;mesh.visible=Math.hypot(cameraPoint.x-b.center.x,cameraPoint.z-b.center.z)<cullDistance+b.radius;if(mesh.visible)visible++;}diagnostics.visibleBatches=visible;},dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();root.removeFromParent();}};
}
