import {ACCESS_SIGNATURE,ACCESS_LAYOUT} from './access-layout.js';
// Human access precedes vegetation and yard dressing. Paths follow terrain and
// route around complete building/yard footprints; the same plan reserves space.
const distance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
export function accessReserved(paths,x,z,margin=0){return paths.some(p=>p.points.some((b,i)=>i&&distance(x,z,p.points[i-1],b)<p.width/2+margin));}
function nearestRoad(x,z,roads){let best;for(const r of roads)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),p=[a[0]+dx*t,a[1]+dz*t],d=Math.hypot(p[0]-x,p[1]-z);if(!best||d<best.d)best={p,d,width:r.width};}return best;}
function push(heap,node){heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}heap[i]=node;}
function pop(heap){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
export function accessSignature(buildings,roads,exclusions){let h=2166136261;for(const c of JSON.stringify({version:3,buildings:buildings.map(b=>[b.id,b.x,b.z,b.w,b.d,b.entry]),roads,exclusions}))h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16);}
export function createAccessPaths(buildings,roads,terrain,exclusions=[],{useCache=true}={}){
 const obstacles=[...buildings.map(b=>({x:b.x,z:b.z,w:b.w+2.8,d:b.d+2.8})),...buildings.filter(b=>b.enterable).map(b=>({x:b.entry.x,z:b.entry.z+(b.entry.length-.6)/2,w:b.entry.width+2.6,d:b.entry.length-.6})),...exclusions.map(b=>({...b,w:b.w+2.4,d:b.d+2.4}))];let nearby=obstacles;const blocked=(x,z)=>nearby.some(b=>Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2);
 const lineClear=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));let y=terrain(...a);for(let i=1;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,yy=terrain(x,z);if(blocked(x,z)||yy<1||Math.abs(yy-y)>.65)return false;y=yy;}return true;};
 if(useCache&&accessSignature(buildings,roads,exclusions)===ACCESS_SIGNATURE&&ACCESS_LAYOUT.every(p=>p.points.every((v,i)=>!i||lineClear(p.points[i-1],v))))return ACCESS_LAYOUT.map(p=>({...p,points:p.points.map(v=>[...v])}));
 const paths=[];
 for(const b of buildings.filter(b=>b.enterable&&b.district==='village')){
  const start=[b.entry.x,b.entry.z+b.entry.length],road=nearestRoad(...start,roads);if(!road)continue;const shoulder=Math.min(road.d,road.width/2+.15),goal=road.p.map((v,i)=>v+(start[i]-v)/Math.max(.001,road.d)*shoulder);
  nearby=obstacles.filter(o=>o.x+o.w/2>Math.min(start[0],goal[0])-46&&o.x-o.w/2<Math.max(start[0],goal[0])+46&&o.z+o.d/2>Math.min(start[1],goal[1])-46&&o.z-o.d/2<Math.max(start[1],goal[1])+46);
  let raw;
  if(lineClear(start,goal))raw=[start,goal];else{
   const step=2,gx=Math.round((goal[0]-start[0])/step),gz=Math.round((goal[1]-start[1])/step),open=[],cost=new Map([['0,0',0]]),closed=new Set();push(open,{x:0,z:0,g:0,f:Math.hypot(gx,gz),prev:null});let end;
   for(let count=0;open.length&&count<10000;count++){const n=pop(open),key=n.x+','+n.z;if(closed.has(key))continue;closed.add(key);if(n.x===gx&&n.z===gz){end=n;break;}const x=start[0]+n.x*step,z=start[1]+n.z*step,y=terrain(x,z);
    for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=n.x+dx,nz=n.z+dz,xx=start[0]+nx*step,zz=start[1]+nz*step,k=nx+','+nz;if(closed.has(k)||nx<Math.min(0,gx)-22||nx>Math.max(0,gx)+22||nz<Math.min(0,gz)-22||nz>Math.max(0,gz)+22||blocked(xx,zz))continue;const yy=terrain(xx,zz),length=Math.hypot(dx,dz);if(yy<1||Math.abs(yy-y)>length*.9||!lineClear([x,z],[xx,zz]))continue;const g=n.g+length+Math.abs(yy-y)*2.2;if(g>=(cost.get(k)??Infinity))continue;cost.set(k,g);push(open,{x:nx,z:nz,g,f:g+Math.hypot(gx-nx,gz-nz),prev:n});}
   }
   if(!end)throw Error('No coherent access route for '+b.id);raw=[goal];for(let n=end;n;n=n.prev)raw.unshift([start[0]+n.x*step,start[1]+n.z*step]);
  }
  const points=[raw[0]];for(let i=0;i<raw.length-1;){let j=raw.length-1;while(j>i+1&&!lineClear(raw[i],raw[j]))j--;points.push(raw[j]);i=j;}
  paths.push({id:b.id,width:1.8,points});
 }
 return paths;
}

// Clip each ribbon quad to the rendered terrain's exact triangles. A wide
// strip sampled only at its ends otherwise floats or cuts through grid ridges.
export function accessSurface(paths,terrain,{minX,minZ,step}){
 const vertices=[];
 const clip=(poly,a,b)=>{const out=[],side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],s=side(p),t=side(q);if(s>=-1e-7)out.push(p);if((s>=0)!==(t>=0)){const u=s/(s-t);out.push([p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u]);}}return out;};
 for(const path of paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.001)continue;const nx=-(b[1]-a[1])/l*path.width/2,nz=(b[0]-a[0])/l*path.width/2,quad=[[a[0]+nx,a[1]+nz],[a[0]-nx,a[1]-nz],[b[0]-nx,b[1]-nz],[b[0]+nx,b[1]+nz]],xs=quad.map(p=>p[0]),zs=quad.map(p=>p[1]);
  for(let x=Math.floor((Math.min(...xs)-minX)/step)*step+minX;x<=Math.max(...xs);x+=step)for(let z=Math.floor((Math.min(...zs)-minZ)/step)*step+minZ;z<=Math.max(...zs);z+=step)for(const tri of [[[x,z],[x+step,z],[x,z+step]],[[x+step,z],[x+step,z+step],[x,z+step]]]){let poly=quad;for(let edge=0;edge<3&&poly.length;edge++)poly=clip(poly,tri[edge],tri[(edge+1)%3]);for(let j=1;j<poly.length-1;j++){const a=poly[0],b=poly[j],c=poly[j+1];if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-8)continue;for(const p of [a,c,b])vertices.push(p[0],terrain(...p)+.035,p[1]);}}
 }
 return vertices;
}
