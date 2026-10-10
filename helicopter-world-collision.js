import * as THREE from './vendor/three.module.js';
import {createModel} from './assets/blackwater-kit/architecture.js';
import {createBlackwaterMaterials} from './assets/blackwater-kit/materials.js';
import {capeGroundHeight,capeStreamZ,capeStreamWidth} from './coastal-terrain.js';
const cache=new WeakMap(),CELL=16,LANDING_POINTS=[[0,0],[-2.3,-1],[2.3,-1],[-2.3,1],[2.3,1]];const PARTS=[{cx:.1,y:1.6,l:3.0,w:1.5,h:1.4},{cx:-4.1,y:2.55,l:2.5,w:1.4,h:1.1},{cx:-.5,y:3.25,l:5.4,w:5.4,h:.90}];
export function createHelicopterWorldCollision(course,fleet){
 const cacheKey=course.coastal||course;let shared=cache.get(cacheKey);if(!shared){const volumes=[],materials=createBlackwaterMaterials({loadTextures:false});try{
  for(const [index,p]of(course.coastal?.blackwaterSlice?.buildings||[]).entries()){const m=createModel({...p,seed:p.seed??1400+index,materials});try{m.root.position.set(p.x,p.y??.13,p.z);m.root.rotation.y=p.yaw||0;m.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m.root);volumes.push({id:p.id,minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,minY:b.min.y,maxY:b.max.y,source:'actual compiled architecture bounds'});}finally{m.dispose();}}
 }finally{materials.dispose();}
 for(const b of course.buildings||[])if(!b.kit)volumes.push({id:b.id,minX:b.x*4,maxX:(b.x+b.w)*4,minZ:b.y*4,maxZ:(b.y+b.h)*4,minY:0,maxY:b.height+6,source:'legacy harbor building conservative roof envelope'});
 for(const t of course.coastal?.forestPlacements||[]){const radius=t.height*(t.species==='conifer'?.30:.40);volumes.push({id:t.id,minX:t.x-radius,maxX:t.x+radius,minZ:t.z-radius,maxZ:t.z+radius,minY:t.y,maxY:t.y+t.height+1,source:'conservative tree crown/trunk volume'});}
 const light=course.coastal?.lighthouse;if(light)volumes.push({id:'coast-lighthouse',minX:light.x-light.radius,maxX:light.x+light.radius,minZ:light.z-light.radius,maxZ:light.z+light.radius,minY:0,maxY:32,source:'lighthouse envelope'});
 const named=new Set(volumes.map(v=>v.id)),movable=new Set(fleet.cars.map(c=>c.id));for(const o of course.obstacles||[])if(!named.has(o.id)&&!movable.has(o.id))volumes.push({id:o.id,minX:o.minX*4,maxX:o.maxX*4,minZ:o.minY*4,maxZ:o.maxY*4,minY:0,maxY:o.id.includes('lamp')?6:o.id.startsWith('street-')?2.5:1.8,source:'static prop envelope'});
 const buckets=new Map();for(let i=0;i<volumes.length;i++){const v=volumes[i];for(let z=Math.floor(v.minZ/CELL);z<=Math.floor(v.maxZ/CELL);z++)for(let x=Math.floor(v.minX/CELL);x<=Math.floor(v.maxX/CELL);x++){const key=x+'/'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}}shared={volumes,buckets};cache.set(cacheKey,shared);}
 const stamps=new Uint32Array(shared.volumes.length);let stamp=0;const diagnostics={volumes:shared.volumes.length,scratchBytes:stamps.byteLength,queries:0,candidateVisits:0,blockedId:null,constructionSource:'actual architecture AABBs incl stack; conservative harbor/tree/prop proxies; no frame geometry queries'};
 function blocked(x,z,altitude,angle,ignoreId){diagnostics.queries++;diagnostics.blockedId=null;const c=Math.cos(angle),s=Math.sin(angle);
  const parts=PARTS;
  for(const part of parts){const cx=x+c*part.cx,cz=z+s*part.cx,rx=Math.abs(c)*part.l+Math.abs(s)*part.w,rz=Math.abs(s)*part.l+Math.abs(c)*part.w,minX=cx-rx,maxX=cx+rx,minZ=cz-rz,maxZ=cz+rz,minY=altitude+part.y-part.h,maxY=altitude+part.y+part.h;const check=v=>v.id!==ignoreId&&maxY>v.minY+.01&&minY<v.maxY-.01&&maxX>v.minX&&minX<v.maxX&&maxZ>v.minZ&&minZ<v.maxZ;
   if(++stamp>=4294967295){stamps.fill(0);stamp=1;}for(let zz=Math.floor(minZ/CELL);zz<=Math.floor(maxZ/CELL);zz++)for(let xx=Math.floor(minX/CELL);xx<=Math.floor(maxX/CELL);xx++)for(const id of shared.buckets.get(xx+'/'+zz)||[]){if(stamps[id]===stamp)continue;stamps[id]=stamp;diagnostics.candidateVisits++;const v=shared.volumes[id];if(check(v)){diagnostics.blockedId=v.id;return true;}}
   for(const v of fleet.vehicles)if(v.id!==ignoreId){const vc=Math.cos(v.angle),vs=Math.sin(v.angle),l=(v.halfLength||.65)*4,w=(v.halfWidth||.3)*4,rx=Math.abs(vc)*l+Math.abs(vs)*w,rz=Math.abs(vs)*l+Math.abs(vc)*w,bottom=v.type==='helicopter'?v.altitudeM:(v.groundM||0);
    if(maxY>bottom+.01&&minY<bottom+(v.heightM||2.8)-.01&&maxX>v.x*4-rx&&minX<v.x*4+rx&&maxZ>v.y*4-rz&&minZ<v.y*4+rz){diagnostics.blockedId=v.id;return true;}}

  }
  return false;
 }
 // Height-aware camera ray through the same static volume authority. Grid DDA
 // visits every crossed bucket; unlike 2D prop rays it can pass above low props.
 function ray(x,z,angle,max=96,height=5,slope=0,ignoreId){
  diagnostics.queries++;const dx=Math.cos(angle),dz=Math.sin(angle),dy=slope;let best=max,hit=null;
  if(++stamp>=4294967295){stamps.fill(0);stamp=1;}
  let gx=Math.floor(x/CELL),gz=Math.floor(z/CELL),travel=0;
  const sx=dx>=0?1:-1,sz=dz>=0?1:-1,deltaX=Math.abs(dx)<1e-12?Infinity:CELL/Math.abs(dx),deltaZ=Math.abs(dz)<1e-12?Infinity:CELL/Math.abs(dz);
  let tx=Math.abs(dx)<1e-12?Infinity:((gx+(sx>0?1:0))*CELL-x)/dx,tz=Math.abs(dz)<1e-12?Infinity:((gz+(sz>0?1:0))*CELL-z)/dz;
  while(travel<=best){
   for(const id of shared.buckets.get(gx+'/'+gz)||[]){if(stamps[id]===stamp)continue;stamps[id]=stamp;const v=shared.volumes[id];if(v.id===ignoreId)continue;diagnostics.candidateVisits++;
    let near=0,far=best;for(let axis=0;axis<3;axis++){const origin=axis===0?x:axis===1?height:z,direction=axis===0?dx:axis===1?dy:dz,lo=axis===0?v.minX:axis===1?v.minY:v.minZ,hi=axis===0?v.maxX:axis===1?v.maxY:v.maxZ;
     if(Math.abs(direction)<1e-12){if(origin<lo||origin>hi){far=-1;break;}}else{let a=(lo-origin)/direction,b=(hi-origin)/direction;if(a>b){const t=a;a=b;b=t;}near=Math.max(near,a);far=Math.min(far,b);if(far<near)break;}}
    if(far>=near&&far>=0&&near<best){best=Math.max(.08,near);hit=v.id;}
   }
   if(tx<tz){travel=tx;tx+=deltaX;gx+=sx;}else{travel=tz;tz+=deltaZ;gz+=sz;}
  }
  return {dist:best/4,side:0,u:0,obstacleId:hit,aerial:true};
 }
 function landing(x,z,angle){if(!course.coastal||x<5.5||x>course.coastal.width-5.5||z<5.5||z>course.coastal.depth-5.5||(x<128&&z>120))return null;const c=Math.cos(angle),s=Math.sin(angle);let min=Infinity,max=-Infinity;for(const [a,b]of LANDING_POINTS){const xx=x+c*a-s*b,zz=z+s*a+c*b,h=capeGroundHeight(xx,zz,{bridges:false});if(!Number.isFinite(h)||(xx>=128&&Math.abs(zz-capeStreamZ(xx))<capeStreamWidth(xx)+1.2))return null;min=Math.min(min,h);max=Math.max(max,h);}if(max-min>.40)return null;return max;}
 return {diagnostics,volumes:shared.volumes,blocked,landing,ray,dispose(){stamps.fill(0);}};
}
