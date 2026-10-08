import * as THREE from './vendor/three.module.js';
import {BlackwaterPaintedMaterial} from './blackwater-render-looks.js';
import {color,float,lights,positionGeometry,positionLocal,uniform,vec3} from './vendor/three.tsl.js';

function plantGeometry(kind) {
  const p=[],uvs=[];
  const tri=(a,b,c)=>{p.push(...a,...b,...c);uvs.push(0,0,.5,.5,1,1);};
  if(kind==='grass')for(let i=0;i<9;i++){
    const a=i*2.399963,rx=Math.cos(a),rz=Math.sin(a),h=.34+(i%4)*.075;
    const base=[rx*.075,0,rz*.075],mid=[rx*.15,h*.62,rz*.15],tip=[rx*.25,h,rz*.25];
    const off=[-rz*.033,0,rx*.033];
    tri(base.map((v,j)=>v-off[j]),base.map((v,j)=>v+off[j]),mid.map((v,j)=>v-off[j]*.57));
    tri(base.map((v,j)=>v+off[j]),mid.map((v,j)=>v+off[j]*.57),mid.map((v,j)=>v-off[j]*.57));
    tri(mid.map((v,j)=>v-off[j]*.57),mid.map((v,j)=>v+off[j]*.57),tip);
  }
  else for(let f=0;f<7;f++){
    const a=f*Math.PI*2/7,rx=Math.cos(a),rz=Math.sin(a),h=.63-(f%3)*.055;
    // A continuous spine starts at the exact root; compound leaves must never
    // become disconnected cards hovering above the terrain.
    for(let i=0;i<7;i++){
      const t=i/7,n=(i+1)/7;
      const a=[rx*.58*t,h*Math.sin(t*Math.PI*.64),rz*.58*t];
      const b=[rx*.58*n,h*Math.sin(n*Math.PI*.64),rz*.58*n];
      tri([a[0]-rz*.008,a[1],a[2]+rx*.008],[a[0]+rz*.008,a[1],a[2]-rx*.008],b);
    }
    for(let i=1;i<7;i++)for(const side of [-1,1]){
      const t=i/7,r=.58*t,y=h*Math.sin(t*Math.PI*.64),w=.18*Math.sin(t*Math.PI)*side;
      const start=[rx*r,y,rz*r],end=[rx*(r+.085)-rz*w,y-.027,rz*(r+.085)+rx*w];
      tri(start,[end[0]-rx*.055,end[1],end[2]-rz*.055],[end[0]+rx*.025,end[1]+.014,end[2]+rz*.025]);
      tri([rx*(r-.012),y+.007,rz*(r-.012)],start,[rx*(r+.088),y+.045,rz*(r+.088)]);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function createCoastalUnderstory({placements,lightSources=[],cullDistance=90}={}) {
  const root=new THREE.Group();root.name='CoastalUnderstory';root.userData.noBatch=true;
  const clock=uniform(0),geometries=new Map(),materials=new Map(),buckets=new Map(),batches=[];
  const lighting=lights(lightSources.filter(l=>l?.isLight));
  for(const kind of ['grass','fern']){
    geometries.set(kind,plantGeometry(kind));
    const m=new BlackwaterPaintedMaterial({color:kind==='fern'?'#4c6f55':'#788d62',side:THREE.DoubleSide});
    m.name=`Understory:${kind}`;m.lightsNode=lighting;
    const height=positionGeometry.y.max(0),phase=clock.mul(1.4).add(positionLocal.x.mul(.22)).add(positionLocal.z.mul(.19));
    m.positionNode=positionLocal.add(vec3(phase.sin().mul(height.pow(2)).mul(.036),0,phase.mul(.77).cos().mul(height.pow(2)).mul(.022)));
    m.colorNode=color(m.color).mul(float(.73).add(height.mul(.28).min(.19)));
    m.userData={lookRole:'understory',rootedWind:true};materials.set(kind,m);
  }
  for(const p of placements||[]){const cx=Math.floor(p.x/64),cz=Math.floor(p.z/64),key=`${p.kind}/${cx}/${cz}`;
    if(!buckets.has(key))buckets.set(key,{kind:p.kind,cx,cz,items:[]});buckets.get(key).items.push(p);}
  const pose=new THREE.Object3D();
  for(const b of buckets.values()){
    const mesh=new THREE.InstancedMesh(geometries.get(b.kind),materials.get(b.kind),b.items.length);
    mesh.name=`Understory:${b.kind}:${b.cx}:${b.cz}`;mesh.layers.set(1);mesh.receiveShadow=false;mesh.castShadow=false;mesh.userData.noBatch=true;
    for(const [i,p]of b.items.entries()){pose.position.set(p.x,p.y+.004,p.z);pose.rotation.set(0,p.yaw,0);pose.scale.setScalar(p.scale);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);mesh.setColorAt(i,new THREE.Color().setRGB(.82+p.tint*.18,.88+p.tint*.12,.78+p.tint*.22));}
    mesh.computeBoundingSphere();root.add(mesh);batches.push(mesh);
  }
  let disposed=false;const cameraPoint=new THREE.Vector3();
  const stats={plants:(placements||[]).length,batches:batches.length,sharedGeometries:geometries.size,materials:materials.size,addedShadowMaps:0,
    grassTriangles:geometries.get('grass').attributes.position.count/3,fernTriangles:geometries.get('fern').attributes.position.count/3,visibleBatches:0,cullDistance};
  return {root,diagnostics:stats,update(camera,time){if(disposed)return;clock.value=Number.isFinite(time)?time:0;camera.getWorldPosition(cameraPoint);let visible=0;
    const distance=cameraPoint.y>35?Math.max(cullDistance,550):cullDistance;
    for(const mesh of batches){const b=mesh.boundingSphere;mesh.visible=Math.hypot(cameraPoint.x-b.center.x,cameraPoint.z-b.center.z)<distance+b.radius;if(mesh.visible)visible++;}stats.visibleBatches=visible;
  },dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const m of batches)m.dispose();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();}};
}
