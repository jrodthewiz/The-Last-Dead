import * as THREE from './vendor/three.module.js';
import {BlackwaterPaintedMaterial} from './blackwater-render-looks.js';
import {MeshStandardNodeMaterial} from './vendor/three.webgpu.js';
import {color,float,lights,positionGeometry,positionLocal,uniform,vec3} from './vendor/three.tsl.js';

// One sheltered woodland fern family: older outer fronds droop and spread,
// intermediate fronds bow, and short inner growth remains partly upright.
export const FERN_FROND_TABLE=Object.freeze([
 {angle:.13,length:1.02,height:.43,curve:.94,tip:.025,leaf:.24,emergence:.07},
 {angle:2.53,length:.94,height:.49,curve:.93,tip:.020,leaf:.25,emergence:.045},
 {angle:4.92,length:1.10,height:.37,curve:.96,tip:.018,leaf:.22,emergence:.085},
 {angle:1.37,length:.70,height:.63,curve:.82,tip:.030,leaf:.23,emergence:.04},
 {angle:3.84,length:.78,height:.57,curve:.86,tip:.035,leaf:.22,emergence:.06},
 {angle:5.81,length:.34,height:.64,curve:.48,tip:.025,leaf:.12,emergence:.015},
].map(p=>Object.freeze(p)));
const fernSeed=(x,z)=>{let h=Math.imul(Math.round(x*100),374761393)^Math.imul(Math.round(z*100),668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};

function plantGeometry(kind) {
  const p=[],uvs=[],colours=[];
  const tri=(a,b,c,tint=[1,1,1])=>{p.push(...a,...b,...c);uvs.push(0,0,.5,.5,1,1);for(let i=0;i<3;i++)colours.push(...tint);};
  if(kind==='grass')for(let i=0;i<18;i++){
    // Retained outer blades curl into a low skirt; mature blades bow and
    // shorter radial runs hold upright inner growth. Each shares one footing.
    const cohort=i%3,a=i*2.399963+Math.sin(i*1.7)*.13,rx=Math.cos(a),rz=Math.sin(a),height=[.32,.42,.49][cohort]+(i%4)*.018;
    const run=[.235,.185,.085][cohort],rootRun=.025+(i%4)*.014,midRun=run*.64,sideways=Math.sin(i*2.1)*.018;
    const at=(run,y,side)=>[rx*run-rz*side,y,rz*run+rx*side];
    const width=.027+(i%4)*.004;
    const base=[at(rootRun,0,-.010),at(rootRun,0,0),at(rootRun,0,.010)];
    const mid=[at(midRun,height*.85,sideways-width),at(midRun,height*.89,sideways),at(midRun,height*.85,sideways+width)];
    const tip=at(run,height*[.63,.82,1][cohort],sideways*.8);
    const tint=cohort===0?[.73,.80,.62]:cohort===1?[.86,.94,.78]:[.96,1,.87];
    tri(base[0],mid[0],mid[1],tint);tri(base[0],mid[1],base[1],tint);
    tri(base[1],mid[1],mid[2],tint);tri(base[1],mid[2],base[2],tint);
    tri(mid[0],tip,mid[1],tint);tri(mid[1],tip,mid[2],tint);
  }
  else if(kind==='shrub'){
    const paths=[],leafRoots=[];
    for(let stem=0;stem<2;stem++){
      const root=new THREE.Vector3(stem? .028:-.028,0,0),mid=new THREE.Vector3(stem? .045:-.065,.16+stem*.035,.018),tip=new THREE.Vector3(stem?.105:-.095,.37+stem*.065,-.024);
      const main=[root,mid,tip];paths.push(main);
      for(let arm=0;arm<2;arm++){
        // Retained lower shoots make a bush, rather than two bare saplings
        // bearing a level crown. Unequal branch cohorts join the rooted stem.
        const t=.55+arm*.27,origin=root.clone().lerp(mid,t),angle=stem*2.7+arm*2.12+.5;
        paths.push([origin,origin.clone().add(new THREE.Vector3(Math.cos(angle)*.16,.065+stem*.024,Math.sin(angle)*.16)),origin.clone().add(new THREE.Vector3(Math.cos(angle)*(.28+arm*.04),.10+stem*.04-arm*.025,Math.sin(angle)*(.28+arm*.04)))]);
      }
    }
    for(const [branch,path]of paths.entries()){
      const direction=path[2].clone().sub(path[0]).normalize(),axis=new THREE.Vector3(0,0,1).cross(direction).normalize(),other=direction.clone().cross(axis).normalize(),rings=[];
      for(let section=0;section<3;section++){
        const radius=(branch%3===0?.012:.007)*(1-section*.36),ring=[];
        for(let side=0;side<3;side++){const angle=side*Math.PI*2/3,p=path[section].clone().addScaledVector(axis,Math.cos(angle)*radius).addScaledVector(other,Math.sin(angle)*radius);if(section===0&&branch%3===0)p.y=0;ring.push(p.toArray());}
        rings.push(ring);
      }
      for(let section=0;section<2;section++)for(let side=0;side<3;side++){const next=(side+1)%3;tri(rings[section][side],rings[section+1][side],rings[section+1][next],[.93,.60,.40]);tri(rings[section][side],rings[section+1][next],rings[section][next],[.93,.60,.40]);}
      tri(rings[2][0],rings[2][1],rings[2][2],[.83,.64,.45]);
      for(let leaf=0;leaf<7;leaf++){
        const t=.12+leaf*.132,section=t<.5?0:1,u=(t-section*.5)*2,anchor=path[section].clone().lerp(path[section+1],u);
        leafRoots.push(anchor.toArray());
        const angle=branch*1.73+leaf*2.399963,inclination=leaf<2?.36:[.65,-.55,.12,-.40,.82,-.08,.21][(leaf+branch)%7],direction=new THREE.Vector3(Math.cos(angle),inclination,Math.sin(angle)).normalize(),side=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle)),normal=side.clone().cross(direction).normalize();
        const length=.16+(leaf%2)*.020,width=.060+(branch%2)*.008;
        const at=(t,w,lift)=>anchor.clone().addScaledVector(direction,t*length).addScaledVector(side,w*width).addScaledVector(normal,lift).toArray();
        const ring=[at(0,0,0),at(.46,-1,.008),at(1,0,.004),at(.46,1,.008)],centre=at(.49,0,-.012);
        for(let edge=0;edge<4;edge++)tri(ring[edge],ring[(edge+1)%4],centre,edge<2?[.86,.94,.79]:[1,1,.92]);
      }
    }
    // Explicit topology provenance supports connected branch/leaf QA without
    // introducing any per-instance resources or alternate physics surface.
    p.shrubTopology={paths:paths.map(path=>path.map(p=>p.toArray())),leafRoots};
  }
  else for(const [f,preset]of FERN_FROND_TABLE.entries()){
    const {angle,height,length,curve,tip,leaf,emergence}=preset,rx=Math.cos(angle),rz=Math.sin(angle);
    const point=(t,side=0,lift=0)=>{
      const section=Math.min(5,Math.floor(t*6)),u=t*6-section;
      const y=height*(Math.sin(section/6*Math.PI*curve)*(1-u)+Math.sin((section+1)/6*Math.PI*curve)*u)+tip*t;
      const lateral=Math.sin(t*Math.PI)*emergence;
      // Fronds emerge upright from a compact crown before arching outward.
      // A linear radial run made all six basal stalks form the same sharp V.
      const run=length*(1-(Math.cos(section/6*Math.PI*.5)*(1-u)+Math.cos((section+1)/6*Math.PI*.5)*u));
      return [rx*run-rz*(side+lateral),y+lift,rz*run+rx*(side+lateral)];
    };
    // The triangular rachis has an actual ridge and continuous rooted rings.
    // Six sections rise from the crown, bow outward, then droop at the tip.
    for(let i=0;i<6;i++){
      const t=i/6,n=(i+1)/6,w=.012*(1-t)+.002,wn=.012*(1-n)+.002;
      const a=[point(t,-w),point(t,0,t===0?0:.009),point(t,w)],b=[point(n,-wn),point(n,0,.009*(1-n)),point(n,wn)];
      tri(a[0],b[0],b[1],[.72,.84,.52]);tri(a[0],b[1],a[1],[.72,.84,.52]);
      tri(a[1],b[1],b[2],[.84,.94,.62]);tri(a[1],b[2],a[2],[.84,.94,.62]);
    }
    // Signed pinnae emerge along the entire continuous rachis. A six-edge
    // lanceolate outline folds around the vein, rather than a triangular V.
    for(let i=0;i<5;i++)for(const side of [-1,1]){
      const t=.105+i*.157+(side===1?.012:0)+(f%3)*.006;
      const span=leaf*Math.pow(Math.sin(t*Math.PI),.8)*(1-t*.40),width=.037*Math.sin(t*Math.PI);
      const base=point(t),centre=point(t+.022,side*span*.5,.014);
      const outline=[base,point(t+.012-width,side*span*.30,-.003),point(t+.03-width*.65,side*span*.74,-.007),
        point(t+.06,side*span,-.013),point(t+.03+width*.65,side*span*.74,-.007),point(t+.012+width,side*span*.30,-.003)];
      for(let edge=0;edge<6;edge++)tri(outline[edge],outline[(edge+1)%6],centre,edge<3?[.83,.93,.75]:[.95,1,.84]);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.computeVertexNormals();g.computeBoundingSphere();g.userData={rooted:true,fronds:kind==='fern'?6:0,foldedPinnae:kind==='fern'?60:0,...(p.shrubTopology||{})};return g;
}

export function createCoastalUnderstory({placements,lightSources=[],cullDistance=90}={}) {
  const root=new THREE.Group();root.name='CoastalUnderstory';root.userData.noBatch=true;
  const clock=uniform(0),geometries=new Map(),materials=new Map(),buckets=new Map(),batches=[];
  const lighting=lights(lightSources.filter(l=>l?.isLight));
  for(const kind of ['grass','fern']){
    geometries.set(kind,plantGeometry(kind));
    const m=kind==='fern'?new MeshStandardNodeMaterial({color:'#526c48',vertexColors:true,roughness:.85,side:THREE.DoubleSide,emissive:'#293b24',emissiveIntensity:.10})
      :new BlackwaterPaintedMaterial({color:'#788d62',vertexColors:true,side:THREE.DoubleSide});
    m.name=`Understory:${kind}`;m.lightsNode=lighting;
    const height=positionGeometry.y.max(0),phase=clock.mul(1.4).add(positionLocal.x.mul(.22)).add(positionLocal.z.mul(.19));
    m.positionNode=positionLocal.add(vec3(phase.sin().mul(height.pow(2)).mul(.036),0,phase.mul(.77).cos().mul(height.pow(2)).mul(.022)));
    m.colorNode=color(m.color).mul(float(.73).add(height.mul(.28).min(.19)));
    m.userData={lookRole:'understory',rootedWind:true,foldedFern:kind==='fern',nativeUnderstoryPBR:kind==='fern',unlitFill:kind==='fern'?.10:0};materials.set(kind,m);
  }
  geometries.set('shrub',plantGeometry('shrub'));
  for(const p of placements||[]){const cx=Math.floor(p.x/64),cz=Math.floor(p.z/64),key=`${p.kind}/${cx}/${cz}`;
    if(!buckets.has(key))buckets.set(key,{kind:p.kind,cx,cz,items:[]});buckets.get(key).items.push(p);}
  const pose=new THREE.Object3D();
  for(const b of buckets.values()){
    const mesh=new THREE.InstancedMesh(geometries.get(b.kind),materials.get(b.kind==='shrub'?'fern':b.kind),b.items.length);
    mesh.name=`Understory:${b.kind}:${b.cx}:${b.cz}`;mesh.layers.set(1);mesh.receiveShadow=false;mesh.castShadow=false;mesh.userData.noBatch=true;
    for(const [i,p]of b.items.entries()){pose.position.set(p.x,p.y+.004,p.z);pose.rotation.set(0,p.yaw,0);pose.scale.set(p.scale*(p.widthScale??1),p.scale*(p.heightScale??1),p.scale*(p.widthScale??1));
      if(p.kind==='fern'){const seed=fernSeed(p.x,p.z);pose.scale.set(p.scale*(.88+seed*.22),p.scale*(.83+(1-seed)*.27),p.scale*(1.04-seed*.16));}
      pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);mesh.setColorAt(i,new THREE.Color().setRGB(.82+p.tint*.18,.88+p.tint*.12,.78+p.tint*.22));}
    mesh.computeBoundingSphere();root.add(mesh);batches.push(mesh);
  }
  let disposed=false;const cameraPoint=new THREE.Vector3();
  const stats={plants:(placements||[]).length,batches:batches.length,sharedGeometries:geometries.size,materials:materials.size,addedShadowMaps:0,
    grassTriangles:geometries.get('grass').attributes.position.count/3,fernTriangles:geometries.get('fern').attributes.position.count/3,shrubTriangles:geometries.get('shrub').attributes.position.count/3,visibleBatches:0,cullDistance};
  return {root,diagnostics:stats,update(camera,time){if(disposed)return;clock.value=Number.isFinite(time)?time:0;camera.getWorldPosition(cameraPoint);let visible=0;
    const distance=cameraPoint.y>35?Math.max(cullDistance,550):cullDistance;
    for(const mesh of batches){const b=mesh.boundingSphere;mesh.visible=Math.hypot(cameraPoint.x-b.center.x,cameraPoint.z-b.center.z)<distance+b.radius;if(mesh.visible)visible++;}stats.visibleBatches=visible;
  },dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const m of batches)m.dispose();for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();}};
}
