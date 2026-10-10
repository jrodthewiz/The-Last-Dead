import * as THREE from './vendor/three.module.js';
import {capeGroundHeight,capePathMask} from './coastal-terrain.js';

// Authored windfall timbers have real obstacles. Their lower rings follow the
// same physical terrain as roots and feet, rather than hovering over a slope.
export function makeCapeWoodlandGround(coastal){
  const placements=[];
  for(const [i,[x,z,length,yaw,radius]] of [[332,383,3.4,-.36,.25],[346,380,2.8,.18,.22],
    [321,392,4.2,.8,.29],[228,390,3.2,-.28,.23],[214,380,3.4,.25,.26],
    [400,383,4.4,.8,.3],[422,247,3.4,.3,.25],[433,283,3.2,-.4,.24]].entries()){
    const dx=Math.sin(yaw)*length/2,dz=Math.cos(yaw)*length/2;
    const minX=x-Math.abs(dx)-radius-.12,maxX=x+Math.abs(dx)+radius+.12;
    const minZ=z-Math.abs(dz)-radius-.12,maxZ=z+Math.abs(dz)+radius+.12;
    if([minX,maxX].some(px=>[minZ,maxZ].some(pz=>capePathMask(px,pz)>.01)))continue;
    if(coastal?.roads?.some(r=>maxX>r.x-r.width/2-1&&minX<r.x+r.width/2+1&&maxZ>r.z-r.depth/2-1&&minZ<r.z+r.depth/2+1))continue;
    const id=`woodland-windfall-${i}`;
    placements.push({id,x,z,length,yaw,radius,y:capeGroundHeight(x,z),
      obstacle:{id,minX:minX/4,maxX:maxX/4,minY:minZ/4,maxY:maxZ/4}});
  }
  return placements;
}

export function buildCapeWoodlandGround({placements=[],material,cullDistance=110}={}){
  const root=new THREE.Group();root.name='CapeWindfallWood';root.userData.noBatch=true;
  const bins=new Map(),meshes=[];let triangles=0;
  for(const p of placements){
    const key=`${Math.floor(p.x/32)}/${Math.floor(p.z/32)}`;
    if(!bins.has(key))bins.set(key,{p:[],c:[],uv:[],ids:[]});const b=bins.get(key);b.ids.push(p.id);
    const faces=(a,c,d,tint)=>{for(const v of [a,c,d]){b.p.push(...v);b.c.push(...tint);b.uv.push(v[0],v[2]);}triangles++;};
    const rows=[],segments=10,sections=Math.ceil(p.length/.4),s=Math.sin(p.yaw),c=Math.cos(p.yaw);
    for(let j=0;j<=sections;j++){
      const t=j/sections,u=(t-.5)*p.length,x=p.x+s*u+Math.sin(t*4)*.045,z=p.z+c*u;
      const base=capeGroundHeight(x,z),row=[];
      for(let k=0;k<segments;k++){
        const a=k*Math.PI*2/segments,r=p.radius*(.94+.055*Math.sin(k*2.6+j*.45));
        row.push([x+c*Math.cos(a)*r,base+p.radius+Math.sin(a)*r,z-s*Math.cos(a)*r]);
      }rows.push(row);
    }
    for(let j=0;j<sections;j++)for(let k=0;k<segments;k++){
      const n=(k+1)%segments,tint=k%3===0?[.28,.20,.12]:[.43,.31,.18];
      faces(rows[j][k],rows[j+1][k],rows[j+1][n],tint);faces(rows[j][k],rows[j+1][n],rows[j][n],tint);
    }
    for(const [j,reverse] of [[0,false],[sections,true]]){
      const row=rows[j],center=row.reduce((a,v)=>a.map((q,k)=>q+v[k]/segments),[0,0,0]);
      for(let k=0;k<segments;k++){const n=(k+1)%segments;faces(center,row[reverse?n:k],row[reverse?k:n],[.65,.48,.28]);}
    }
  }
  for(const [key,b] of bins){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();g.computeBoundingSphere();
    g.setAttribute('capeBiome',new THREE.Float32BufferAttribute(new Float32Array(b.p.length/3*4),4));
    const mesh=new THREE.Mesh(g,material);mesh.name=`CapeWindfallWood:${key}`;mesh.receiveShadow=true;mesh.castShadow=true;
    mesh.userData={woodlandWindfall:true,ids:b.ids};root.add(mesh);meshes.push(mesh);
  }
  let disposed=false;const point=new THREE.Vector3();
  const diagnostics={logs:placements.length,triangles,batches:meshes.length,addedMaterials:0,addedTextures:0,addedShadowMaps:0,cullDistance,maximumDiameterMetres:.6,visibleBatches:0};
  return {root,diagnostics,update(camera){if(disposed||!camera)return;camera.getWorldPosition(point);let visible=0;
    for(const m of meshes){const b=m.geometry.boundingSphere;m.visible=Math.hypot(point.x-b.center.x,point.z-b.center.z)<cullDistance+b.radius;if(m.visible)visible++;}diagnostics.visibleBatches=visible;
  },dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.geometry.dispose();root.removeFromParent();}};
}
