import * as THREE from './vendor/three.module.js';
import {BlackwaterPaintedMaterial,configureCoastalRockMaterial} from './blackwater-render-looks.js';
import {MeshBasicNodeMaterial} from './vendor/three.webgpu.js';
import {lights,attribute} from './vendor/three.tsl.js';

// Scenery only: every vertex is seaward of the canonical collision polygon.
const COAST=[[0,0],[448,0],[448,416],[128,416],[128,120],[0,120]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GEOLOGY_NOSES=[{x:316,z:-35},{x:90,z:274},{x:262,z:452}];
// One directional mineral grammar, lifted from the actual shore sheet. Broad
// inclined bedding planes terminate in steep, eroded steps and share their
// foot with the surrounding terrain; no intersecting standalone boulders.
function geologicalRelief(x,z){
  let relief=0;
  for(const nose of GEOLOGY_NOSES){
    const dx=x-nose.x,dz=z-nose.z,u=dx*.94+dz*.342,v=-dx*.342+dz*.94;
    const fracture=.09*Math.sin(u*.24)+.05*Math.sin(v*.42+u*.08);
    const envelope=Math.max(Math.abs(u)/25,Math.abs(v)/17)+fracture;
    const shoulder=clamp((1-envelope)/.30,0,1);
    const plane=shoulder*(10.0+.11*u-.075*v);
    const bed=Math.max(0,Math.floor((plane-.16*u)/2.05)*2.05+.16*u);
    // A torn asymmetrical notch gives the cap a lower seaward shoulder.
    const notch=2.1*Math.exp(-((u-11)**2+(v+6)**2)/65);
    relief=Math.max(relief,Math.max(0,bed-notch)*shoulder);
  }
  return relief;
}
function crest(x,z){
  return 4.2*Math.exp(-((x-445)**2+(z-386)**2)/2200)
    +6.4*Math.exp(-((x-262)**2+(z-416)**2)/2000)
    +5.1*Math.exp(-((x-128)**2+(z-274)**2)/2500);
}
export function shorelineSamples(){
  const samples=[];
  COAST.forEach(([x,z],edge)=>{
    const [xx,zz]=COAST[(edge+1)%COAST.length],length=Math.hypot(xx-x,zz-z),dx=(xx-x)/length,dz=(zz-z)/length;
    const previous=COAST[(edge+COAST.length-1)%COAST.length],pl=Math.hypot(x-previous[0],z-previous[1]);
    const pnx=(z-previous[1])/pl,pnz=-(x-previous[0])/pl;
    const count=Math.ceil(length/2.5);
    for(let j=0;j<count;j++){
      let nx=dz,nz=-dx;
      if(j===0){nx+=pnx;nz+=pnz;const dot=nx*dz+nz*(-dx);nx/=dot;nz/=dot;}
      const px=x+dx*j/count*length,pz=z+dz*j/count*length;
      // Preserve the working port apron; natural mass grows toward the cape.
      // Only the original 128 x 120 metre harbor keeps its engineered quays.
      // The long town-side southern shore is natural as well as the cape.
      const wild=Math.max(clamp((pz-120)/42,0,1),clamp((px-128)/52,0,1));
      // Broad headlands, with a recessed western cove and two northern lobes.
      // Upper shelves occupy most of this width above water, rather than a
      // thin lip lost below the sea surface in the inspection camera.
      const headland=18*Math.exp(-((px-128)**2+(pz-274)**2)/2200)
        +18*Math.exp(-((px-262)**2+(pz-416)**2)/2200)
        +12*Math.exp(-((px-424)**2+(pz-412)**2)/1600)
        +21*Math.exp(-((px-316)**2+pz**2)/1400);
      const cove=15*Math.exp(-((px-128)**2+(pz-204)**2)/750)
        +11*Math.exp(-((px-344)**2+(pz-416)**2)/1050)
        +18*Math.exp(-((px-242)**2+pz**2)/800)
        +12*Math.exp(-((px-390)**2+pz**2)/850);
      const width=2.2+wild*(31+headland-cove+6*Math.sin(px*.019+pz*.026)+3*Math.sin(px*.052-pz*.039));
      samples.push({x:px,z:pz,nx,nz,width,wild,crest:crest(px,pz)*wild});
    }
  });
  return samples;
}
function meshFromTriangles(vertices,colors){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
export function buildCoastalShorelineArt(world){
  const root=new THREE.Group();root.name='SculptedCoastalHeadland';world.root.add(root);
  const rock=new BlackwaterPaintedMaterial({color:0xffffff,vertexColors:true});
  configureCoastalRockMaterial(rock);
  rock.name='CoastalStratifiedSlate';
  const foam=new MeshBasicNodeMaterial({color:0xb4ccc5,transparent:true,opacity:.40,depthWrite:false});
  foam.opacityNode=attribute('surfOpacity','float');
  foam.name='CoastalTideFoam';
  // Registered names let the native material adapter retain the semantic roles.
  world.materials.coastalShoreRock=rock;world.materials.coastalShoreFoam=foam;
  const vertices=[],colors=[],foamVertices=[],foamColors=[],foamOpacity=[];
  const samples=shorelineSamples();
  const palette=[new THREE.Color('#526345'),new THREE.Color('#53644c'),new THREE.Color('#7b8980'),new THREE.Color('#546970'),new THREE.Color('#283f47')];
  const geologyNoses=GEOLOGY_NOSES;
  const rings=[0,.08,.14,.24,.34,.42,.52,.64,.75,.85,.93,1,1.15];
  const pointAt=(s,t)=>{
    const offset=t===0?.48:s.width*t+.5;
    const ripple=Math.sin(s.x*.17+s.z*.13)*.30+Math.sin(s.x*.061-s.z*.087)*.55;
    const profile=[[0,-.28],[.14,2*s.wild+s.crest],[.42,3.5*s.wild+s.crest*.82],[.75,2.2*s.wild+s.crest*.42],[.93,-.65],[1,-1.55],[1.15,-6.5]];
    const section=profile.findIndex((p,i)=>i<profile.length-1&&t>=p[0]&&t<=profile[i+1][0]);
    const a=profile[Math.max(0,section)],b=profile[Math.max(0,section)+1],f=clamp((t-a[0])/(b[0]-a[0]),0,1);
    const x=s.x+s.nx*offset,z=s.z+s.nz*offset;
    const y=a[1]+(b[1]-a[1])*f+(t===0?0:ripple*s.wild)+geologicalRelief(x,z);
    return[x,y,z];
  };
  const point=(s,r)=>pointAt(s,rings[r]);
  const foamStations=samples.map((s,i)=>{
    let lower=.75,upper=1.15;
    // Find the real eroded surface's tide contact, including mineral relief.
    for(let j=0;j<12;j++){const t=(lower+upper)/2;if(pointAt(s,t)[1]>-1.05)lower=t;else upper=t;}
    const contact=s.width*(lower+upper)/2+.5;
    const broken=clamp((Math.sin(i*.48)+Math.sin(i*.119)-.1)*.7,0,1);
    const width=.24+.65*(.5+.5*Math.sin(i*1.17+Math.sin(i*.16)));
    const rim=.13*Math.sin(i*1.87)+.07*Math.sin(i*.51);
    return{contact,alpha:broken*.26,width,rim};
  });
  const surfTriangle=(a,b,c)=>{
    foamVertices.push(...a.position,...b.position,...c.position);
    for(const p of [a,b,c]){foamColors.push(1,1,1);foamOpacity.push(p.alpha);}
  };
  const triangle=(a,b,c,col,target=vertices,targetColors=colors)=>{
    target.push(...a,...b,...c);
    for(const p of [a,b,c]){
      const tone=.93+.12*Math.sin(p[0]*.21+p[2]*.29+p[1]*.9),color=col.clone();
      if(target===vertices&&(col===palette[0]||col===palette[1])){
        let contact=0;
        for(const nose of geologyNoses){const dx=p[0]-nose.x,dz=p[2]-nose.z;contact=Math.max(contact,Math.exp(-(dx*dx+dz*dz)/500));}
        // Mineral fields spill into turf around a geological nose; the contact
        // has one spatial domain across both shelves and angular outcrops.
        const seam=.70+.25*Math.sin(p[0]*.22+Math.sin(p[2]*.11)*2);
        color.lerp(palette[2],clamp(contact*1.8*seam,0,1));
      }
      if(target===vertices){
        const relief=geologicalRelief(p[0],p[2]);
        color.lerp(palette[2],clamp(relief*.5,0,.96));
        const bedding=p[1]-.16*(p[0]*.94+p[2]*.342);
        const band=.5+.5*Math.sin(bedding*Math.PI/2.05);
        color.multiplyScalar(.84+band*.22);
        // Saturated wet slate at the tide, then an irregular scree contact.
        color.lerp(palette[4],clamp((.25-p[1])/2.1,0,.86));
        const joint=Math.abs(Math.sin((p[0]*.94+p[2]*.342)*.43));
        if(relief>1&&joint<.15)color.multiplyScalar(.66);
      }
      targetColors.push(color.r*tone,color.g*tone,color.b*tone);
    }
  };
  for(let i=0;i<samples.length;i++){
    const a=samples[i],b=samples[(i+1)%samples.length];
    for(let r=0;r<rings.length-1;r++){
      const aa=point(a,r),ab=point(a,r+1),ba=point(b,r),bb=point(b,r+1);
      const t=rings[r],col=palette[t<.34?0:t<.75?1:t<.85?2:t<1?3:4];
      triangle(aa,ba,ab,col);triangle(ab,ba,bb,col);
    }
    // Scalloped surf fragments feather to transparent on both water edges;
    // their longitudinal alpha field fades ends instead of cutting rectangles.
    const sa=foamStations[i],sb=foamStations[(i+1)%samples.length];
    if(a.wild>.1&&b.wild>.1&&(sa.alpha>.005||sb.alpha>.005)){
      const tide=(s,f,lane)=>{
        const extra=[-.10,f.width*.25,f.width][lane]+f.rim;
        return{position:[s.x+s.nx*(f.contact+extra),-1.02,s.z+s.nz*(f.contact+extra)],alpha:lane===1?f.alpha:0};
      };
      for(let lane=0;lane<2;lane++){
        surfTriangle(tide(a,sa,lane),tide(b,sb,lane),tide(a,sa,lane+1));
        surfTriangle(tide(a,sa,lane+1),tide(b,sb,lane),tide(b,sb,lane+1));
      }
    }
  }
  // Two deliberately placed eroded stacks punctuate the long cape silhouette.
  for(const stack of [{x:506,z:376,rx:7,rz:5,h:12,phase:.3},{x:288,z:477,rx:6,rz:9,h:11,phase:1.7}]){
    const levels=[[-5,1.3],[-.5,1],[stack.h*.40,.85],[stack.h*.72,.65],[stack.h,.36]],segments=11;
    const p=(l,i)=>{const a=i/segments*Math.PI*2+stack.phase,rag=1+.13*Math.sin(i*2.7+l*.9),[y,r]=levels[l];return[stack.x+Math.cos(a)*stack.rx*r*rag+l*.6,y+.18*Math.sin(i*2.2),stack.z+Math.sin(a)*stack.rz*r*rag-l*.35];};
    for(let l=0;l<levels.length-1;l++)for(let i=0;i<segments;i++){
      const col=palette[clamp(3-l,0,4)];triangle(p(l,i),p(l+1,i),p(l,i+1),col);triangle(p(l+1,i),p(l+1,i+1),p(l,i+1),col);
    }
    for(let i=0;i<segments;i++)triangle(p(4,i),p(4,i+1),[stack.x+2.4,stack.h+.3,stack.z-1.4],palette[0]);
  }
  const geometry=meshFromTriangles(vertices,colors),foamGeometry=meshFromTriangles(foamVertices,foamColors);
  foamGeometry.setAttribute('surfOpacity',new THREE.Float32BufferAttribute(foamOpacity,1));
  const land=new THREE.Mesh(geometry,rock);land.name='ContinuousErodedCoast';land.castShadow=true;land.receiveShadow=true;root.add(land);
  const tide=new THREE.Mesh(foamGeometry,foam);tide.name='BrokenShelfTideRibbons';tide.receiveShadow=true;root.add(tide);
  const diagnostics={triangles:(vertices.length+foamVertices.length)/9,draws:2,samples:samples.length,collision:'visual only; outside canonical polygon',seaStacks:2,geologicalNoses:geologyNoses.length,integratedBeddingField:true,featheredSurf:true,surfPeakOpacity:Math.max(...foamOpacity),maxHeadlandExtent:Math.max(...samples.map(s=>s.width)),highestCliff:geometry.boundingBox.max.y};
  if(world.diagnostics)world.diagnostics.shoreline=diagnostics;
  let disposed=false;
  return{root,diagnostics,setLighting(sources){rock.lightsNode=lights(sources);},dispose(){if(disposed)return;disposed=true;geometry.dispose();foamGeometry.dispose();rock.dispose();foam.dispose();root.removeFromParent();}};
}
