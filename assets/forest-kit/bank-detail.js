import * as THREE from '../../vendor/three.module.js';
import {capeGroundHeight,capeStreamZ,capeStreamWidth,capePathMask} from '../../coastal-terrain.js';
import {capeSurfaceFields,capeDetailClear,CAPE_RESIDENTIAL_TRANSITION,capeResidentialCoastFields,makeCapeRootShoulders,capeRootShoulderField,capeTrailCentreDistance,capeBiomeWeights} from '../../coastal-terrain-fields.js';

export function buildCapeBankDetail({forest=[],material,cullDistance=110,underlayAt=null}={}){
  const root=new THREE.Group();root.name='CapeShaleAndRoots';root.userData.noBatch=true;
  const bins=new Map(),geometries=[],meshes=[];
  const stone=new THREE.Color('#9eafb1'),rootColor=new THREE.Color('#654d38'),edgeColor=new THREE.Color('#53625e');
  const shoulders=makeCapeRootShoulders(forest);
  let seed=151041,plates=0,roots=0,duffFragments=0,fallenBranches=0,mineralPockets=0,shoulderFaces=0,contourIntersections=0,triangles=0,sourceTriangles=0;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const emit=(a,b,c,color,shoulder=false)=>{
    if(triangles>=60000)return;
    // New canopy distributions can move curved root/drift vertices closer to
    // path shoulders than their source endpoints. Check final conformed faces.
    if(![a,b,c].every(p=>shoulder?capeTrailCentreDistance(p[0],p[2])>=1.5&&capeSurfaceFields(p[0],p[2]).bankDistance>=9:capePathMask(p[0],p[2])<=.015))return;
    if(shoulder&&[a,b,c].some(p=>CAPE_RESIDENTIAL_TRANSITION.extent[0]<p[0]||[222,340].some(x=>Math.abs(p[0]-x)<3.1&&Math.abs(p[2]-capeStreamZ(x))<12)))return;
    const key=`${Math.floor(a[0]/32)}:${Math.floor(a[2]/32)}`;
    if(!bins.has(key))bins.set(key,{positions:[],colors:[],uv:[],biome:[]});const bin=bins.get(key);
    for(const p of [a,b,c]){bin.positions.push(...p);bin.uv.push(p[0]/12,p[2]/12);
      if(shoulder==='bed'){
        const f=capeRootShoulderField(p[0],p[2],shoulders),m=f.moss,blend=THREE.MathUtils.smoothstep(f.cover,.06,.85)*.65;
        const base=underlayAt?.(p[0],p[2])||{color:new THREE.Color('#526957').toArray(),biome:capeBiomeWeights(p[0],p[2])};
        const tint=new THREE.Color('#443e30').multiplyScalar(f.litter).add(new THREE.Color('#355342').multiplyScalar(m)).add(new THREE.Color('#89918d').multiplyScalar(f.mineral)),target=[f.litter,m,0,f.mineral];
        bin.colors.push(...base.color.map((c,i)=>c*(1-blend)+tint.toArray()[i]*blend));bin.biome.push(...base.biome.map((v,i)=>v*(1-blend)+target[i]*blend));
      }
      else{bin.colors.push(color.r,color.g,color.b);bin.biome.push(0,0,0,0);}
    }triangles++;if(shoulder==='bed')shoulderFaces++;
  };
  const clip=(polygon,distance)=>{
    const out=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);
      if(da>=-1e-9)out.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));
      }
    }
    return out;
  };
  const triangle=(a,b,c,color,shoulder=false)=>{
    sourceTriangles++;
    let source=[a,b,c].map(p=>[p[0],p[2],p[1]-capeGroundHeight(p[0],p[2],{bridges:false})]);
    if(shoulder==='bed'){
      // March the actual ecological contour, not the grid-cell footprint.
      // Bisection puts boundary vertices on the field edge, with no duff tint
      // or raised lip there. Surface roles come from the exact underlay.
      source=clipBedContour(source);
    }
    const minX=Math.floor(Math.min(a[0],b[0],c[0])),maxX=Math.floor(Math.max(a[0],b[0],c[0]));
    const minZ=Math.floor(Math.min(a[2],b[2],c[2])),maxZ=Math.floor(Math.max(a[2],b[2],c[2]));
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
      let polygon=source;
      for(const plane of [p=>p[0]-x,p=>x+1-p[0],p=>p[1]-z,p=>z+1-p[1]])polygon=clip(polygon,plane);
      for(const side of [-1,1]){
        let cut=clip(polygon,p=>side*(p[0]+p[1]-x-z-1));
        if(shoulder==='bed')cut=clipBedContour(cut);
        const points=cut.map(p=>[p[0],capeGroundHeight(p[0],p[1],{bridges:false})+(shoulder==='bed'?.034*THREE.MathUtils.smoothstep(capeRootShoulderField(p[0],p[1],shoulders).cover,.06,.85):p[2]),p[1]]);
        for(let j=1;j<points.length-1;j++){
          const u=points[j],v=points[j+1],o=points[0];
          if(Math.abs((u[0]-o[0])*(v[2]-o[2])-(v[0]-o[0])*(u[2]-o[2]))>1e-10)emit(o,u,v,color,shoulder);
        }
      }
    }
  };
  const clipBedContour=source=>{
    const out=[],field=p=>capeRootShoulderField(p[0],p[1],shoulders).cover-.06;
    for(let i=0;i<source.length;i++){
      const a=source[i],b=source[(i+1)%source.length],da=field(a),db=field(b);
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){let low=0,high=1;for(let j=0;j<24;j++){const t=(low+high)/2,p=a.map((v,k)=>v+(b[k]-v)*t);if((field(p)>=0)===(da>=0))low=t;else high=t;}const t=(low+high)/2;out.push(a.map((v,k)=>v+(b[k]-v)*t));contourIntersections++;}
    }
    return out;
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
      // Denser canopy must not multiply the decorative root-detail budget.
      // Each complete ribbon uses sixteen triangles; never truncate a root.
      if(sourceTriangles+16>11500)break;
      const yaw=arm*Math.PI*2/3+rand()*.8,length=1.2+rand()*1.05;
      const endX=tree.x+Math.cos(yaw)*length,endZ=tree.z+Math.sin(yaw)*length;
      if(!capeDetailClear(tree.x,tree.z,.35)||!capeDetailClear(endX,endZ,.15))continue;
      const tint=rootColor.clone().multiplyScalar(.88+rand()*.2),rows=[];
      for(let i=0;i<=4;i++){
        const t=i/4,a=yaw+Math.sin(t*4)*.16,x=tree.x+Math.cos(a)*(.24+t*(length-.24)),z=tree.z+Math.sin(a)*(.24+t*(length-.24)),w=.18*(1-t)+.022;
        rows.push([point(x-Math.sin(a)*w,z+Math.cos(a)*w,.008),point(x+Math.sin(a)*w,z-Math.cos(a)*w,.008),point(x,z,.10*(1-t)*(1-t)+.009*t)]);
      }
      for(let i=0;i<4;i++){const a=rows[i],b=rows[i+1];triangle(a[0],b[2],a[2],tint);triangle(a[0],b[0],b[2],tint);triangle(a[2],b[2],a[1],tint);triangle(a[1],b[2],b[1],tint);}roots++;
    }
  }
  // Fallen needles and birch leaf fragments occur in root-centred drifts,
  // never as solid obstacles. Reuse this material/tile system and the reserved
  // 2500 triangles, so added forest-floor legibility cannot grow the budget.
  const floorTrees=forest.filter(p=>p.id.startsWith('cape-forest-')&&(p.z>326||p.x>386&&p.z>120));
  for(const tree of floorTrees){
    if(sourceTriangles+8>13800)break;
    const driftColor=tree.species==='conifer'?new THREE.Color('#85715a'):new THREE.Color('#a59666');
    const yaw=rand()*6.283,radius=.75+rand()*1.2,cx=tree.x+Math.cos(yaw)*radius,cz=tree.z+Math.sin(yaw)*radius;
    if(!capeDetailClear(cx,cz,.25))continue;
    const missing=new Set();
    for(const x of [cx-.6,cx+.6])for(const z of [cz-.6,cz+.6]){
      const key=`${Math.floor(x/32)}:${Math.floor(z/32)}`;if(!bins.has(key))missing.add(key);
    }
    if(bins.size+missing.size>40)continue;
    for(let leaf=0;leaf<4;leaf++){
      const angle=yaw+(rand()-.5)*.65,x=cx+(rand()-.5)*.45,z=cz+(rand()-.5)*.45;
      const length=tree.species==='conifer'?.19+rand()*.12:.12+rand()*.1,width=tree.species==='conifer'?.012:.045;
      const dx=Math.cos(angle),dz=Math.sin(angle),a=point(x-dx*length,z-dz*length,.010),b=point(x+dx*length,z+dz*length,.012);
      const side=point(x-dz*width,z+dx*width,.015),other=point(x+dz*width,z-dx*width,.015);
      triangle(a,side,b,driftColor);triangle(a,b,other,driftColor);duffFragments++;
    }
  }
  // A few readable forked windfall ribbons sit beside, rather than across,
  // the footpaths. Their broad lateral silhouettes remain low decorative
  // relief; feet/projectiles retain the canonical terrain surface.
  for(const [cx,cz,yaw] of [[346,374,.14],[345,384,-.23],[334,379,.18],[334,389,-.18],[228,384,.23],[216,392,-.16],[404,265,.2],[407,239,-.12]]){
    if(sourceTriangles+18>14000)break;
    const rows=[];let clear=true;
    for(let j=0;j<=4;j++){
      const t=j/4,x=cx+Math.sin(yaw)*t*2.8+Math.sin(t*4)*.18,z=cz+Math.cos(yaw)*t*2.8,w=.10*(1-t)+.025;
      if(!capeDetailClear(x,z,.3)){clear=false;break;}
      rows.push([point(x-w,z,.018),point(x+w,z,.018),point(x,z,.033)]);
    }
    if(!clear)continue;
    const bark=new THREE.Color('#9b7953'),shade=new THREE.Color('#554d3b');
    for(let j=0;j<4;j++){
      const a=rows[j],b=rows[j+1];triangle(a[0],b[2],a[2],bark);triangle(a[0],b[0],b[2],shade);
      triangle(a[2],b[2],a[1],bark);triangle(a[1],b[2],b[1],shade);
    }
    const fork=point(cx+.7,cz+1.7,.022),base=rows[2][2];
    triangle(base,point(cx+.25,cz+1.4,.025),fork,bark);triangle(base,fork,point(cx+.68,cz+1.76,.018),shade);
    fallenBranches++;
  }
  // Two low inset slate exposures continue the offshore mineral strike. Their
  // shallow top follows the same physical ground; they are not solid boulders.
  for(const pocket of CAPE_RESIDENTIAL_TRANSITION.slate){
    const ring=[],centre=point(pocket.x,pocket.z,.027);
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6,u=Math.cos(angle)*pocket.rx*.90,v=Math.sin(angle)*pocket.rz*.88;
      const x=Math.min(445,pocket.x+u*.94-v*.342),z=pocket.z+u*.342+v*.94;
      ring.push(point(x,z,.009+.007*(i%3)));
    }
    for(let i=0;i<12;i++)triangle(centre,ring[(i+1)%12],ring[i],stone.clone().multiplyScalar(.68+(i%4)*.055));
    mineralPockets++;
  }
  // Joined shallow duff banks bridge actual root flares and sheltered path
  // margins. The scalloped field also owns their atlas roles and terrain tint.
  // This is soft centimetre-scale accumulation, never a second solid surface.
  for(const shoulder of shoulders){
    const minX=Math.floor(Math.min(shoulder.treeX,shoulder.pathX+shoulder.side*2.55)-2.4),maxX=Math.ceil(Math.max(shoulder.treeX,shoulder.pathX+shoulder.side*2.55)+2.4);
    for(let x=minX;x<maxX;x+=.75)for(let z=Math.floor(shoulder.treeZ-7.5);z<shoulder.treeZ+7.5;z+=.75){
      const corners=[[x,z],[x+.75,z],[x,z+.75],[x+.75,z+.75]],fields=corners.map(p=>capeRootShoulderField(...p,shoulders));
      if(fields.every(f=>f.cover<.06))continue;
      if(triangles+24>60000)continue;
      const points=corners.map(([x,z],i)=>point(x,z,.034*THREE.MathUtils.smoothstep(fields[i].cover,.06,.85)));
      triangle(points[0],points[2],points[1],rootColor,'bed');triangle(points[2],points[3],points[1],rootColor,'bed');
    }
    for(let arm=0;arm<3;arm++){
      const angle=(shoulder.side===-1?0:Math.PI)+(arm-1)*1.35,rows=[];
      for(let j=0;j<=4;j++){
        const t=j/4,a=angle+Math.sin(t*3)*.16,run=.18+t*1.65,x=shoulder.treeX+Math.cos(a)*run,z=shoulder.treeZ+Math.sin(a)*run,w=.20*(1-t)+.025;
        rows.push([point(x-Math.sin(a)*w,z+Math.cos(a)*w,.008),point(x+Math.sin(a)*w,z-Math.cos(a)*w,.008),point(x,z,.085*(1-t)*(1-t)+.009)]);
      }
      for(let j=0;j<4;j++){const a=rows[j],b=rows[j+1];triangle(a[0],b[2],a[2],rootColor,'root');triangle(a[0],b[0],b[2],rootColor,'root');triangle(a[2],b[2],a[1],rootColor,'root');triangle(a[1],b[2],b[1],rootColor,'root');}
      roots++;
    }
  }
  for(const [key,bin]of bins){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(bin.positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(bin.colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(bin.uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    g.setAttribute('capeBiome',new THREE.Float32BufferAttribute(bin.biome,4));
    const mesh=new THREE.Mesh(g,material);mesh.name=`CapeBankDetail:${key}`;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);meshes.push(mesh);geometries.push(g);
  }
  let disposed=false;const cameraPoint=new THREE.Vector3();
  const diagnostics={plates,roots,duffFragments,fallenBranches,mineralPockets,shoulderBeds:shoulders.length,shoulderFaces,contourIntersections,triangles,sourceTriangles,batches:meshes.length,addedMaterials:0,addedTextures:0,addedShadowMaps:0,cullDistance,maximumReliefMetres:.10,visibleBatches:0,detailBudget:60000,physicalConformance:'clipped exactly to the authoritative 1m ground triangles'};
  return {root,diagnostics,update(camera){if(disposed||!camera)return;camera.getWorldPosition(cameraPoint);let visible=0;for(const mesh of meshes){const b=mesh.geometry.boundingSphere;mesh.visible=Math.hypot(cameraPoint.x-b.center.x,cameraPoint.z-b.center.z)<cullDistance+b.radius;if(mesh.visible)visible++;}diagnostics.visibleBatches=visible;},dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();root.removeFromParent();}};
}
