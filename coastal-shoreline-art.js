import * as THREE from './vendor/three.module.js';
import {configureCoastalRockMaterial} from './blackwater-render-looks.js';
import {MeshBasicNodeMaterial,MeshStandardNodeMaterial} from './vendor/three.webgpu.js';
import {lights,attribute} from './vendor/three.tsl.js';

// Scenery only: every vertex is seaward of the canonical collision polygon.
const COAST=[[0,0],[448,0],[448,416],[128,416],[128,120],[0,120]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const GEOLOGY_NOSES=[{x:316,z:-35},{x:90,z:274},{x:262,z:452}];
// One directional mineral grammar, lifted from the actual shore sheet. Broad
// inclined bedding planes terminate in steep, eroded steps and share their
// foot with the surrounding terrain; no intersecting standalone boulders.
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const SHELF_WINDOW=[[320,423],[325,419.2],[335,418.5],[344,420],[352,418.8],[357,421.8],[355,425.5],[349,428],[339,429],[334,432.7],[328,433],[326.5,429],[322,428]];
// One exposed crest body, not a coastal border or radial paint stamp. The
// inward rising flank retains organic soil; only the existing high bearing
// crest and falling seaward face lose cover. Exact emitted normals own that
// distinction. Northerly salt exposure is an authored ecological choice.
export function coastalShelfWindowRoles(x,y,z,normalY,normalZ,geology={},wrack=0){
 if(x<=318||x>=366||z<=417||z>=435||y<=0||wrack>0||geology.height>0||geology.jointDepth>0||geology.exposedFace>0||geology.planeWeight>0)return {weight:0,mineral:0,loose:0,lee:0};
 let inside=false,distance=Infinity;
 for(let i=0,j=SHELF_WINDOW.length-1;i<SHELF_WINDOW.length;j=i++){
  const [ax,az]=SHELF_WINDOW[j],[bx,bz]=SHELF_WINDOW[i];
  if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
  distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
 }
 const weight=inside?smooth(0,1.5,distance):0;
 const crest=smooth(2.2,3.1,y),bearing=smooth(.55,.94,Math.abs(normalY));
 const inward=smooth(.035,.25,-normalZ),outward=smooth(.03,.25,normalZ);
 const lee=inward*(1-smooth(2.3,3.3,y));
 const mineral=crest*(.48+.52*bearing)*(1-lee);
 const loose=outward*(1-smooth(3.1,3.8,y))*.56*(1-mineral);
 return {weight,mineral,loose,lee};
}
const SCARP_WIDTHS=[.45,.55,.40];
const DOMINANT_BED_ANCHORS=[[-26,-14,-6,3],[-17,-16,-8.8,8.2],[-10,-12,-2.2,4],[-6,-12,-3,7],[1,-15,-3,1],[8,-10,-1,1],[15,-13,-6,5],[26,-12,-4,3]];
function bedStarts(r,nose){
 if(nose===GEOLOGY_NOSES[0]){
  const i=Math.max(0,DOMINANT_BED_ANCHORS.findIndex((a,i)=>i<DOMINANT_BED_ANCHORS.length-1&&r>=a[0]&&r<=DOMINANT_BED_ANCHORS[i+1][0]));
  const a=DOMINANT_BED_ANCHORS[i],b=DOMINANT_BED_ANCHORS[i+1],t=clamp((r-a[0])/(b[0]-a[0]),0,1);
  return[1,2,3].map(k=>a[k]+(b[k]-a[k])*t);
 }
 return[-13+1.25*Math.sin(r*.23)+.035*r,-5.4+1.5*Math.sin(r*.17+.8)-.045*r,2.4+.9*Math.sin(r*.29+2)+.04*r];
}
function bedWidths(r,nose){
 if(nose!==GEOLOGY_NOSES[0])return SCARP_WIDTHS;
 const central=smooth(-23,-18,r)*(1-smooth(-8,-4,r));
 const previous=[.45+.65*central,.55+2.05*central,.40+.50*central];
 const visible=smooth(-8,-5,r)*(1-smooth(14,17,r)),block=clamp(r-3.5,0,1);
 const left=[1.2,3.1,.8],right=[2.4,1.3,2.6];
 return previous.map((value,i)=>value*(1-visible)+(left[i]*(1-block)+right[i]*block)*visible);
}
function dominantJoints(q,r){return[r+.55*q+2,r-.38*q-9,r-.24*q+12.4];}

function geologicalFrame(x,z,nose){
 const dx=x-nose.x,dz=z-nose.z,u=dx*.94+dz*.342,v=-dx*.342+dz*.94;
 return{q:(u+v)*Math.SQRT1_2,r:(u-v)*Math.SQRT1_2};
}
export function geologicalSample(x,z){
  let result={height:0,bedIndex:0,exposedFace:0,jointDepth:0,talus:0,capCover:0,shiftQ:0,planeWeight:0};
  for(const nose of GEOLOGY_NOSES){
    const {q,r}=geologicalFrame(x,z,nose);
    if(q < -26 || q > 25 || Math.abs(r)>26)continue;
    const end=1-smooth(15.5,25,Math.abs(r)+1.4*Math.sin(q*.19+r*.11));
    const [first,second,third]=bedStarts(r,nose);
    const widths=bedWidths(r,nose),phases=bedStarts(r,nose).map((start,i)=>(q-start)/widths[i]);
    const dominant=nose===GEOLOGY_NOSES[0];
    const ramp=t=>dominant?clamp(t,0,1):smooth(0,1,t);
    const exposedFace=Math.max(...phases.map(t=>t>0&&t<1?(dominant?1:4*t*(1-t)):0));
    const beds=[4.2,6.1,3.8].reduce((sum,h,i)=>sum+h*ramp(phases[i]),0);
    const backside=1-smooth(11,24,q);
    // Broad fractures start at the exposed face and terminate into the cap.
    // Their width exceeds the local mesh spacing, so actual triangles carry
    // the clefts. Unequal joint lengths interrupt the lower bearing beds.
    const [jointA,jointB,jointC]=dominant?dominantJoints(q,r):[r+4.3+.22*q+.7*Math.sin(q*.31),r-7.8-.15*q];
    const centralCut=dominant?6.4*Math.max(0,1-Math.abs(jointC)/1.35)*smooth(-21,-14,q)*(1-smooth(7,13,q)):0;
    const cut=centralCut+(dominant?7.0*Math.max(0,1-Math.abs(jointA)/1.2)*(1-smooth(2,10,q))*smooth(-20,-12,q)
      +3.1*Math.max(0,1-Math.abs(jointB)/2.4)*(1-smooth(-2,7,q))*smooth(-18,-10,q):4.8*Math.pow(Math.max(0,1-Math.abs(jointA)/2.8),.75)*(1-smooth(1,9,q))*smooth(-17,-11,q)
      +2.8*Math.pow(Math.max(0,1-Math.abs(jointB)/2.5),.85)*(1-smooth(-2,4,q))*smooth(-15,-9,q));
    const tilt=.16*r-.055*q;
    // Weather splits and rounds the cap along strike. The upper surface has
    // a broad irregular crest and a sheltered soil pocket, not a flat mesa.
    const cap=smooth(third+1.8,third+4.3,q);
    const capErosion=cap*(.65+.60*Math.sin(r*.19+q*.11)+.40*Math.sin(r*.09-q*.27));
    // The central block slipped between intersecting rupture planes. Its
    // displacement and missing upper lip share those exact plane coordinates.
    const centralThrow=dominant?2.4*(1-smooth(-.15,.15,jointC))*smooth(-25,-20,r)*(1-smooth(-1,5,q)):0;
    const downthrow=centralThrow+(dominant?1.9*smooth(-.20,.20,jointA)*(1-smooth(-.20,.20,jointB))*smooth(-15,-8,q)*(1-smooth(4,11,q)):0);
    const centralWeight=dominant?smooth(-23,-18,r)*(1-smooth(-8,-4,r)):0;
    // Two unequal bearing planes hinge across the central rupture. Their
    // dip and face angles change at macro scale, not via another depth slot.
    const visiblePlane=dominant?smooth(-8,-5,r)*(1-smooth(14,17,r)):0;
    const visibleDip=visiblePlane*(r-4)*(r<4?.27:-.18);
    const slabDip=(centralWeight*(r+14)*(r<-14?.24:-.12)+visibleDip)*ramp(phases[1]);
    const face=Math.max(0,beds-cut+tilt+slabDip-capErosion-downthrow)*end*backside;
    // A small broken talus apron exists only below the exposed face. Back
    // and side slopes receive no decorative ring of rubble.
    const foot=smooth(-25,-18,q)*(1-smooth(-14,-10,q))*end;
    // Fallen slab ends have the same strike/dip as their source face. Their
    // angular relief is part of this connected foot sheet, not loose primitives.
    let fragments=0;
    for(const [fq,fr,w,d,h]of (dominant?[[-21,9.55,4.0,3.6,3.2],[-17,2.54,3.3,4.2,2.2],[-23,-1.0,2.6,2.9,1.5],[-21,-17.44,3.1,3.8,2.9],[-17,-16.48,2.6,2.7,1.9],[-19,-12.8,4.5,2.6,2.4]]:[[-21,-9,2.8,4.2,1.8],[-18,-3,3.4,2.9,2.4],[-22,2,2.5,3.7,1.6],[-17,7,3.6,3.2,2.7],[-22,12,2.3,3.4,1.4]])){
      const edge=Math.max(Math.abs((q-fq+.18*(r-fr))/w),Math.abs((r-fr)/d));
      fragments=Math.max(fragments,h*Math.max(0,1-edge));
    }
    const talus=foot*(.48+fragments);
    const brokenLip=dominant?(1-smooth(1.2,.25,Math.abs(jointA))*smooth(-4,2,q))*(1-smooth(1.35,.30,Math.abs(jointC))*smooth(-7,0,q)):1;
    const lip=[.65,.90,.55].reduce((sum,n,i)=>sum+n*ramp(phases[i])*(i===2?brokenLip:1),0);
    const shiftQ=lip*end*backside*(1-smooth(6,10,q))*(1-clamp(cut/6,0,.8));
    const height=face+talus;
    if(height>result.height||(height===0&&cut>result.jointDepth)){
      const bedIndex=q<second?0:q<third?1:2;
      const capCover=cap*(1-exposedFace)*smooth(3,9,q)*(.35+.65*smooth(-.20,.70,Math.sin(r*.21+q*.12)));
      result={height,bedIndex,exposedFace,jointDepth:cut*end*backside,talus:foot,capCover:capCover*end,shiftQ,planeWeight:Math.max(centralWeight,visiblePlane)};
    }
  }
  return result;
}
export function geologicalRelief(x,z){return geologicalSample(x,z).height;}


// Authored coastal exposures and uses share fields with their rooted details.
// All centres lie in the existing seaward apron; canonical land is untouched.
function coastalEdgeFields(x,z){
 let mineral=0,heath=0;
 for(const [cx,cz,rx,rz]of [[350,-11,24,7],[282,-14,12,6],[104,294,9,19],[475,174,7,23],[289,443,22,8]]){
  const u=(x-cx)/rx,v=(z-cz)/rz,shape=Math.hypot(u,v)+.10*Math.sin(u*7+v*2);
  const tongue=1-smooth(.35,1.05,shape);mineral=Math.max(mineral,tongue);
  heath=Math.max(heath,smooth(.20,.50,shape)*(1-smooth(.82,1.2,shape)));
 }
 const along=clamp((-z-1)/21,0,1),trackX=230+.075*(-z-10);
 const trail=(1-smooth(1.7,3.9,Math.abs(x-trackX)+.28*Math.sin(z*.65)))*smooth(-.4,1.3,-z)*(1-smooth(22,26,-z));
 const gravel=trail*smooth(.4,.9,along);
 let wrack=0;
 for(const [cx,cz,rx,rz]of [[109,204,8,22],[344,441,20,7]])wrack=Math.max(wrack,1-smooth(.15,1.1,Math.hypot((x-cx)/rx,(z-cz)/rz)));
 return{mineral,heath,trail,gravel,wrack};
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
  const refined=[];
  for(let i=0;i<samples.length;i++){
    const a=samples[i],b=samples[(i+1)%samples.length];
    const near=n=>Math.hypot(a.x+a.nx*a.width*.60-n.x,a.z+a.nz*a.width*.60-n.z)<36
      ||Math.hypot(b.x+b.nx*b.width*.60-n.x,b.z+b.nz*b.width*.60-n.z)<36;
    const count=GEOLOGY_NOSES.some(near)?4:1;
    refined.push(a);
    for(let j=1;j<count;j++){
      const t=j/count,point={};for(const key of ['x','z','nx','nz','width','wild','crest'])point[key]=a[key]+(b[key]-a[key])*t;
      refined.push(point);
    }
  }
  return refined;
}
function meshFromTriangles(vertices,colors,smoothCreases=false){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  if(smoothCreases){
    const p=geometry.attributes.position,n=geometry.attributes.normal,groups=new Map();
    for(let i=0;i<p.count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*10000)).join(',');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
    }
    const original=n.array.slice();
    for(const indices of groups.values())for(const i of indices){
      const a=i*3,nx=original[a],ny=original[a+1],nz=original[a+2];let x=0,y=0,z=0;
      for(const j of indices){const b=j*3;if(nx*original[b]+ny*original[b+1]+nz*original[b+2]>.90){x+=original[b];y+=original[b+1];z+=original[b+2];}}
      const length=Math.hypot(x,y,z)||1;n.setXYZ(i,x/length,y/length,z/length);
    }
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
export function buildCoastalShorelineArt(world){
  const root=new THREE.Group();root.name='SculptedCoastalHeadland';world.root.add(root);
  const rock=new MeshStandardNodeMaterial({color:0xffffff,vertexColors:true,roughness:.94});
  rock.userData.nativeTerrainPBR=true;
  configureCoastalRockMaterial(rock);
  rock.name='CoastalStratifiedSlate';
  const foam=new MeshBasicNodeMaterial({color:0xb4ccc5,transparent:true,opacity:.40,depthWrite:false});
  foam.opacityNode=attribute('surfOpacity','float');
  foam.name='CoastalTideFoam';
  // Registered names let the native material adapter retain the semantic roles.
  world.materials.coastalShoreRock=rock;world.materials.coastalShoreFoam=foam;
  const vertices=[],colors=[],geologyAttributes=[],contourEdges=[],foamVertices=[],foamColors=[],foamOpacity=[];
  const samples=shorelineSamples();
  const palette=[new THREE.Color('#526345'),new THREE.Color('#53644c'),new THREE.Color('#77817f'),new THREE.Color('#546970'),new THREE.Color('#283f47')];
  const geologyNoses=GEOLOGY_NOSES;
  const edgeFieldCache=new WeakMap(),edgeFor=p=>{if(!edgeFieldCache.has(p))edgeFieldCache.set(p,coastalEdgeFields(p[0],p[2]));return edgeFieldCache.get(p);};
  const edgeColors=['#707b72','#75764f','#8b846a','#798180','#746c58'].map(c=>new THREE.Color(c));
  const rings=[0,.08,.14,.24,.34,.42,.52,.64,.75,.85,.93,1,1.15];
  const pointAt=(s,t,fold=true)=>{
    const offset=t===0?0:s.width*t+.5;
    const ripple=Math.sin(s.x*.17+s.z*.13)*.30+Math.sin(s.x*.061-s.z*.087)*.55;
    const profile=[[0,0],[.14,2*s.wild+s.crest],[.42,3.5*s.wild+s.crest*.82],[.75,2.2*s.wild+s.crest*.42],[.93,-.65],[1,-1.55],[1.15,-6.5]];
    const section=profile.findIndex((p,i)=>i<profile.length-1&&t>=p[0]&&t<=profile[i+1][0]);
    const a=profile[Math.max(0,section)],b=profile[Math.max(0,section)+1],f=clamp((t-a[0])/(b[0]-a[0]),0,1);
    const x=s.x+s.nx*offset,z=s.z+s.nz*offset;
    const geology=geologicalSample(x,z),y=a[1]+(b[1]-a[1])*f+(t===0?0:ripple*s.wild*(1-geology.planeWeight*smooth(1,4,geology.height)))+geology.height;
    // Folding the upper lips creates true sloping undersides while retaining
    // the original connected parameter sheet and all canonical shore contacts.
    const shift=fold?geology.shiftQ:0;
    const point=[x-shift*(.94-.342)*Math.SQRT1_2,y,z-shift*(.342+.94)*Math.SQRT1_2];
    point.geology=geology;return point;
  };
  const fineRings=[0,.05,.09,.13,.17,.21,.25,.29,.33,.37,.41,.45,.49,.53,.57,.61,.65,.69,.73,.77,.81,.85,.89,.93,.97,1.02,1.08,1.15];
  const sections=samples.map(s=>{
    const x=s.x+s.nx*s.width*.60,z=s.z+s.nz*s.width*.60;
    const nearRock=geologyNoses.some(n=>Math.hypot(x-n.x,z-n.z)<41);
    const ts=[...(nearRock?fineRings:rings)],anchors=new Map([['coast',0],['outer',1.15]]);
    if(nearRock)for(const [noseIndex,nose] of geologyNoses.entries()){
      // Insert both physical edges of each bearing face. A regular coast
      // lattice otherwise bridges a half-metre slab edge with 2m triangles.
      for(let bed=0;bed<3;bed++)for(const lipIndex of [0,1]){
        const field=t=>{const offset=s.width*t+.5,f=geologicalFrame(s.x+s.nx*offset,s.z+s.nz*offset,nose);return f.q-bedStarts(f.r,nose)[bed]-(lipIndex?bedWidths(f.r,nose)[bed]:0);};
        for(let t=0;t<1.15;t+=.05){
          let lo=t,hi=Math.min(t+.05,1.15),fl=field(lo),fh=field(hi);
          if(fl*fh>=0)continue;
          for(let j=0;j<16;j++){const mid=(lo+hi)/2,fm=field(mid);if(fl*fm<=0){hi=mid;fh=fm;}else{lo=mid;fl=fm;}}
          const hit=(lo+hi)/2,p=pointAt(s,hit,false),f=geologicalFrame(p[0],p[2],nose);
          if(Math.abs(f.r)<24 && f.q>-24&&f.q<24){
            ts.push(hit);anchors.set(`${noseIndex}:${bed}:${lipIndex===0?'start':'end'}`,hit);
          }
        }
      }
    }
    if(nearRock){
      const nose=GEOLOGY_NOSES[0];
      for(let joint=0;joint<3;joint++)for(const flank of (joint===0?[-1.2,0,1.2]:joint===1?[-2.4,0,2.4]:[-1.35,0,1.35])){
        const field=t=>{const offset=s.width*t+.5,f=geologicalFrame(s.x+s.nx*offset,s.z+s.nz*offset,nose);return dominantJoints(f.q,f.r)[joint]-flank;};
        for(let t=0;t<1.15;t+=.05){
          let lo=t,hi=Math.min(t+.05,1.15),fl=field(lo),fh=field(hi);if(fl*fh>=0)continue;
          for(let j=0;j<16;j++){const mid=(lo+hi)/2,fm=field(mid);if(fl*fm<=0){hi=mid;fh=fm;}else{lo=mid;fl=fm;}}
          const hit=(lo+hi)/2,p=pointAt(s,hit,false),f=geologicalFrame(p[0],p[2],nose);
          if(Math.abs(f.r)<24&&f.q>-21&&f.q<11){ts.push(hit);anchors.set(`rupture:${joint}:${flank}`,hit);}
        }
      }
    }
    if(nearRock)for(let t=.10;t<1;t+=.02){
      const p=pointAt(s,t,false);
      if(p.geology.talus>.08)ts.push(t);
    }
    ts.sort((a,b)=>a-b);
    for(let i=ts.length-1;i>0;i--)if(ts[i]-ts[i-1]<.00001)ts.splice(i,1);

    return{ts,points:ts.map(t=>pointAt(s,t)),anchors};
  });
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
    const ab=new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a));
    const ac=new THREE.Vector3().fromArray(c).sub(new THREE.Vector3().fromArray(a));
    const normal=ab.cross(ac).normalize(),bearingExposure=1-smooth(.45,.88,Math.abs(normal.y));
    for(const p of [a,b,c]){
      const tone=.94+.09*Math.sin(p[0]*.31+Math.sin(p[2]*.21)*1.5)*Math.sin(p[1]*.67+p[2]*.17),color=col.clone();
      if(target===vertices&&(col===palette[0]||col===palette[1])){
        let contact=0;
        for(const nose of geologyNoses){const dx=p[0]-nose.x,dz=p[2]-nose.z;contact=Math.max(contact,Math.exp(-(dx*dx+dz*dz)/500));}
        // Mineral fields spill into turf around a geological nose; the contact
        // has one spatial domain across both shelves and angular outcrops.
        const seam=.70+.25*Math.sin(p[0]*.22+Math.sin(p[2]*.11)*2);
        color.lerp(palette[2],clamp(contact*1.8*seam,0,1));
      }
      if(target===vertices){
        const geology=p.geology||geologicalSample(p[0],p[2]);
        geologyAttributes.push(Math.max(geology.exposedFace,bearingExposure*smooth(.5,3,geology.height)),clamp(geology.jointDepth/4.8,0,1),geology.talus,geology.capCover);
        if(geology.height>.08||geology.jointDepth>.2){
          // These are actual bearing units and erosion exposures, not height
          // stripes painted independently of the mesh. Clefts retain darker
          // mineral; the fallen material warms only at the exposed foot.
          const bedColors=['#48565b','#82908f','#687777'];
          const mineral=new THREE.Color(bedColors[geology.bedIndex]);
          mineral.multiplyScalar(1-.25*clamp(geology.jointDepth/4.8,0,1));
          mineral.lerp(new THREE.Color('#7e7c70'),geology.talus*.22);
          mineral.lerp(new THREE.Color('#566248'),geology.capCover*.70);
          color.lerp(mineral,Math.max(smooth(.08,1.2,geology.height),smooth(.2,2,geology.jointDepth)));
        }
        color.lerp(palette[4],clamp((.25-p[1])/2.1,0,.86));
      }
      if(target===vertices){
        const edge=edgeFor(p);
        const geology=p.geology||geologicalSample(p[0],p[2]);
        const shoreCover=1-smooth(1.5,4,geology.height);
        color.lerp(edgeColors[0],edge.mineral*shoreCover*.82);
        color.lerp(edgeColors[1],edge.heath*shoreCover*.45);
        color.lerp(edgeColors[2],edge.trail*shoreCover*.75);
        color.lerp(edgeColors[3],edge.gravel*shoreCover*.85);
        color.lerp(edgeColors[4],edge.wrack*shoreCover*.40);
      }
      targetColors.push(color.r*tone,color.g*tone,color.b*tone);
    }
  };
  for(let i=0;i<samples.length;i++){
    const a=samples[i],b=samples[(i+1)%samples.length];
    const aa=sections[i],bb=sections[(i+1)%samples.length];
    // Paired semantic contours partition the strip before triangulation.
    // A bed lip cannot fan diagonally into an unrelated neighbor's talus or
    // regular sample. Unequal interior samples zip only within that unit.
    const paired=[...aa.anchors].filter(([key])=>bb.anchors.has(key)).map(([key,at])=>({key,at,bt:bb.anchors.get(key)})).sort((a,b)=>a.at-b.at);
    // Bedding contours take priority. Rupture contours may intersect each
    // other between columns; admit them only inside the same bearing interval
    // on both sides, never reorder or erase a physical bed lip.
    const boundaries=paired.filter(p=>!p.key.startsWith('rupture:'));
    for(const p of paired.filter(p=>p.key.startsWith('rupture:'))){
      const index=boundaries.findIndex(b=>b.at>p.at);
      if(index>0&&p.bt>boundaries[index-1].bt+.00001&&p.bt<boundaries[index].bt-.00001)boundaries.splice(index,0,p);
    }
    const nearest=(ts,t)=>ts.findIndex(x=>Math.abs(x-t)<.00001);
    for(const p of boundaries)if(p.key!=='coast'&&p.key!=='outer')contourEdges.push(...aa.points[nearest(aa.ts,p.at)],...bb.points[nearest(bb.ts,p.bt)]);
    for(let band=0;band<boundaries.length-1;band++){
      const lo=boundaries[band],hi=boundaries[band+1];
      let ai=nearest(aa.ts,lo.at),bi=nearest(bb.ts,lo.bt),ae=nearest(aa.ts,hi.at),be=nearest(bb.ts,hi.bt);
      if(ai<0||bi<0||ae<0||be<0)throw new Error('Missing geological strip boundary');
      while(ai<ae||bi<be){
        const at=ai<ae?(aa.ts[ai+1]-lo.at)/(hi.at-lo.at):Infinity;
        const bt=bi<be?(bb.ts[bi+1]-lo.bt)/(hi.bt-lo.bt):Infinity;
        const t=Math.min(aa.ts[ai],bb.ts[bi]),col=palette[t<.34?0:t<.75?1:t<.85?2:t<1?3:4];
        if(Math.abs(at-bt)<.00001){
          triangle(aa.points[ai],bb.points[bi],aa.points[ai+1],col);
          triangle(aa.points[ai+1],bb.points[bi],bb.points[bi+1],col);ai++;bi++;
        }else if(at<bt){triangle(aa.points[ai],bb.points[bi],aa.points[ai+1],col);ai++;}
        else{triangle(aa.points[ai],bb.points[bi],bb.points[bi+1],col);bi++;}
      }
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
    const cap=Array.from({length:segments},(_,i)=>p(4,i));
    const faces=THREE.ShapeUtils.triangulateShape(cap.map(p=>new THREE.Vector2(p[0],p[2])),[]);
    for(const [a,b,c]of faces)triangle(cap[a],cap[c],cap[b],palette[0]);
  }
  // Rooted silhouettes and one grounded hauling cradle use the original rock
  // material and four bounded perimeter regions. No textures or new lights.
  const edgeBins=new Map(),edgeRecords=[];
  const binFor=p=>p[2]<0?'south':p[0]<128?'west':p[2]>416?'north':'east';
  const detailTriangle=(points,col,role)=>{
    const key=binFor(points[0]);if(!edgeBins.has(key))edgeBins.set(key,{vertices:[],colors:[]});
    const bin=edgeBins.get(key),c=new THREE.Color(col);bin.vertices.push(...points.flat());
    for(let i=0;i<3;i++)bin.colors.push(c.r,c.g,c.b);
  };
  const detailBox=(center,size,yaw,col,role,pitch=0)=>{
    const g=new THREE.BoxGeometry(...size);g.rotateX(pitch);g.rotateY(yaw);g.translate(...center);
    const p=g.attributes.position,index=g.index;
    for(let i=0;i<index.count;i+=3)detailTriangle([0,1,2].map(j=>[p.getX(index.getX(i+j)),p.getY(index.getX(i+j)),p.getZ(index.getX(i+j))]),col,role);
    g.dispose();edgeRecords.push({role,position:center,size});
  };
  let tuftCount=0;
  for(let i=0;i<samples.length;i+=6){
    const sample=samples[i];
    for(const t of [.22,.34,.46]){
      const p=pointAt(sample,t),field=coastalEdgeFields(p[0],p[2]);
      if(field.heath<.20||p[1]<.3||p.geology.height>2||tuftCount>=180)continue;
      const height=.38+.32*field.heath,width=.24+.15*field.heath;
      for(let blade=0;blade<4;blade++){
        const angle=blade*Math.PI*.5+i*.17,dx=Math.cos(angle)*width,dz=Math.sin(angle)*width;
        const a=[p[0]-dx,p[1]-.08,p[2]-dz],b=[p[0]+dx,p[1]-.08,p[2]+dz];
        const c=[p[0]+dx*.25-.12,p[1]+height*.62,p[2]+dz*.25-.07],d=[p[0]-dx*.25-.12,p[1]+height*.62,p[2]-dz*.25-.07],tip=[p[0]-.22,p[1]+height,p[2]-.12];
        for(const tri of [[a,b,c],[a,c,d],[d,c,tip]]){detailTriangle(tri,'#7c8658','rooted-saltgrass');detailTriangle([...tri].reverse(),'#68764e','rooted-saltgrass');}
      }
      tuftCount++;edgeRecords.push({role:'rooted-saltgrass',position:[...p],height,field:field.heath});
    }
  }
  const nearest=(x,z)=>samples.reduce((best,p)=>Math.hypot(p.x-x,p.z-z)<Math.hypot(best.x-x,best.z-z)?p:best,samples[0]);
  const cradleSample=nearest(230,0),cradle=pointAt(cradleSample,.44);
  for(const side of [-1,1])for(const offset of [-2.3,0,2.3]){
    const t=.44-offset/cradleSample.width,p=pointAt(cradleSample,t),a=pointAt(cradleSample,t-1.15/cradleSample.width),b=pointAt(cradleSample,t+1.15/cradleSample.width);
    const pitch=-Math.atan2(a[1]-b[1],a[2]-b[2]);
    detailBox([p[0]+side*1.25,p[1]+.10,p[2]],[.22,.20,2.32],0,'#796d55','obsolete-hauling-runner',pitch);
  }
  for(const offset of [-2.8,-.7,1.7]){const p=pointAt(cradleSample,.44-offset/cradleSample.width);detailBox([p[0],p[1]+.21,p[2]],[3.0,.20,.21],offset*.035,'#8c7b5e','obsolete-hauling-crossbearer');}
  detailBox([cradle[0]+.65,cradle[1]+.32,cradle[2]+2.2],[.23,.15,1.4],.23,'#655d4c','broken-hauling-member');
  for(const [cx,cz,length,yaw]of [[128,204,7.2,.42],[128,213,4.5,.18],[344,416,8.2,1.12],[353,416,4.9,1.34]]){
    const sample=nearest(cx,cz);let lo=.50,hi=1;
    for(let j=0;j<12;j++){const t=(lo+hi)/2;if(pointAt(sample,t)[1]>.35)lo=t;else hi=t;}
    const p=pointAt(sample,(lo+hi)/2);
    detailBox([p[0],p[1]+.11,p[2]],[.24,.22,length],yaw,'#82745c','storm-wrack-timber');
    detailBox([p[0]+.40,p[1]+.06,p[2]+length*.28],[.15,.11,length*.26],yaw+.35,'#6d654f','storm-wrack-split-end');
  }
  const edgeGeometries=[],edgeMeshes=[];
  for(const [key,bin]of edgeBins){
    const g=meshFromTriangles(bin.vertices,bin.colors),exposure=new Uint8Array(g.attributes.position.count*4);
    g.setAttribute('geologicalExposure',new THREE.Uint8BufferAttribute(exposure,4,true));
    const mesh=new THREE.Mesh(g,rock);mesh.name='CoastalEdgeUse:'+key;mesh.castShadow=true;mesh.receiveShadow=true;edgeMeshes.push(mesh);edgeGeometries.push(g);
  }
  const geometry=meshFromTriangles(vertices,colors,true),foamGeometry=meshFromTriangles(foamVertices,foamColors);
  let semanticQuantizationMaxError=0;
  const packedExposure=Uint8Array.from(geologyAttributes,value=>{
    if(!Number.isFinite(value)||value<0||value>1)throw new Error('Invalid normalized geological cause');
    const packed=Math.round(value*255);
    semanticQuantizationMaxError=Math.max(semanticQuantizationMaxError,Math.abs(value-packed/255));
    return packed;
  });
  geometry.userData.geologicalContourEdges=new Float32Array(contourEdges);
  geometry.setAttribute('geologicalExposure',new THREE.Uint8BufferAttribute(packedExposure,4,true));
  geometry.userData.semanticQuantizationMaxError=semanticQuantizationMaxError;
  // Color-only expression of the existing outer shelf. No height, normals,
  // geology ownership, contacts, wrack or foam data are altered by this pass.
  const shelfPosition=geometry.attributes.position,shelfNormal=geometry.attributes.normal,shelfColor=geometry.attributes.color;
  const retainedLee=new THREE.Color('#35483c'),shelfTone=new THREE.Color();
  for(let i=0;i<shelfPosition.count;i++){
    const x=shelfPosition.getX(i),y=shelfPosition.getY(i),z=shelfPosition.getZ(i);
    if(x<=318||x>=366||z<=417||z>=435)continue;
    const role=coastalShelfWindowRoles(x,y,z,shelfNormal.getY(i),shelfNormal.getZ(i),geologicalSample(x,z),coastalEdgeFields(x,z).wrack);
    if(!role.weight)continue;
    shelfTone.setRGB(shelfColor.getX(i),shelfColor.getY(i),shelfColor.getZ(i));
    shelfTone.lerp(palette[2],role.weight*role.mineral*.90).lerp(edgeColors[0],role.weight*role.loose*.70).lerp(retainedLee,role.weight*role.lee*.78);
    shelfColor.setXYZ(i,shelfTone.r,shelfTone.g,shelfTone.b);
  }
  foamGeometry.setAttribute('surfOpacity',new THREE.Float32BufferAttribute(foamOpacity,1));
  const land=new THREE.Mesh(geometry,rock);land.name='ContinuousErodedCoast';land.castShadow=true;land.receiveShadow=true;root.add(land);
  const tide=new THREE.Mesh(foamGeometry,foam);tide.name='BrokenShelfTideRibbons';tide.receiveShadow=true;root.add(tide);root.add(...edgeMeshes);
  const diagnostics={triangles:(vertices.length+foamVertices.length)/9+edgeGeometries.reduce((n,g)=>n+g.attributes.position.count/3,0),draws:2+edgeBins.size,edgeUseTriangles:edgeGeometries.reduce((n,g)=>n+g.attributes.position.count/3,0),rootedSaltgrassTufts:tuftCount,coastalEdgeUses:true,samples:samples.length,collision:'visual only; outside canonical polygon',seaStacks:2,geologicalNoses:geologyNoses.length,integratedBeddingField:true,semanticGeology:true,foldedBearingLips:true,pairedSemanticStrips:true,dominantAngularRupture:true,centralCameraRupture:true,centralUnequalBearingPlanes:true,visiblePlanarBearingBlocks:true,connectedApronGeology:true,bedThicknessRange:[3.8,6.1],adaptiveColumns:sections.filter(s=>s.ts.length>rings.length).length,featheredSurf:true,surfPeakOpacity:Math.max(...foamOpacity),maxHeadlandExtent:Math.max(...samples.map(s=>s.width)),highestCliff:geometry.boundingBox.max.y};
  if(world.diagnostics)world.diagnostics.shoreline=diagnostics;
  let disposed=false;
  return{root,diagnostics,edgeRecords,setLighting(sources){rock.lightsNode=lights(sources);},dispose(){if(disposed)return;disposed=true;for(const g of edgeGeometries)g.dispose();geometry.dispose();foamGeometry.dispose();rock.dispose();foam.dispose();root.removeFromParent();}};
}
