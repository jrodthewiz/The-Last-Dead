import {groundHeight} from './data.js';
// Bounded local navigation. The world remains continuous; this temporary
// two-metre search grid only exists while an infected needs to go around cover.
export function walkableLine(grid,ax,az,bx,bz,r=.36){const floor=grid.floorAt||groundHeight,length=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(length/.5));let last=floor(ax,az);for(let i=1;i<=n;i++){const x=ax+(bx-ax)*i/n,z=az+(bz-az)*i/n,y=floor(x,z);if(y<.5||Math.abs(y-last)>1||grid.blocked(x,z,y,r))return false;last=y;}return true;}
// A search can be consumed synchronously by tools, or resumed in small slices
// by the live crowd. Stable heap ordering preserves the original A* tie order.
const neighbours=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const before=(a,b)=>a.f<b.f||(a.f===b.f&&a.order<b.order);
function push(heap,node){let i=heap.length;heap.push(node);while(i){const p=(i-1)>>1;if(!before(node,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=node;}
function pop(heap){const head=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&before(heap[child+1],heap[child]))child++;if(!before(heap[child],tail))break;heap[i]=heap[child];i=child;}heap[i]=tail;}return head;}
export function* searchLocalPath(grid,ax,az,bx,bz,budget=1100){
 const size=2,sx=Math.round(ax/size),sz=Math.round(az/size),gx=Math.round(bx/size),gz=Math.round(bz/size),key=(x,z)=>`${x},${z}`;
 const open=[{x:sx,z:sz,g:0,f:Math.hypot(gx-sx,gz-sz),parent:null,order:0}],best=new Map([[key(sx,sz),0]]),closed=new Set();let visited=0,order=1;
 while(open.length&&visited++<budget){const node=pop(open),id=key(node.x,node.z);if(closed.has(id)){yield;continue;}closed.add(id);
  if(Math.abs(node.x-gx)<=1&&Math.abs(node.z-gz)<=1&&walkableLine(grid,node.x*size,node.z*size,bx,bz)){const route=[{x:bx,z:bz}];let current=node;while(current.parent){route.push({x:current.x*size,z:current.z*size});current=current.parent;}return route.reverse();}
  for(const [dx,dz] of neighbours){const x=node.x+dx,z=node.z+dz,nid=key(x,z);if(closed.has(nid)||Math.abs(x-sx)>45||Math.abs(z-sz)>45)continue;const cost=node.g+Math.hypot(dx,dz);if(cost>=(best.get(nid)??Infinity))continue;if(!walkableLine(grid,node.x*size,node.z*size,x*size,z*size))continue;best.set(nid,cost);push(open,{x,z,g:cost,f:cost+Math.hypot(gx-x,gz-z),parent:node,order:order++});}
  yield;
 }
 return [];
}
export function findLocalPath(...args){const search=searchLocalPath(...args);let step;do{step=search.next();}while(!step.done);return step.value;}

// One shared budget for the entire crowd, rather than a full budget for every
// alerted actor. Round-robin slices keep an unreachable target from starving
// neighbours. A result can only be committed while its request is still valid.
export function createPathQueue(grid,{nodesPerFrame=80,milliseconds=1.5,now=()=>performance.now()}={}){
 const jobs=[],owners=new Map(),stats={requests:0,completed:0,cancelled:0,active:0,lastNodes:0,lastMs:0,maxMs:0,maxSliceMs:0,maxLatencyMs:0,totalMs:0};
 function* route(ax,az,bx,bz){if(walkableLine(grid,ax,az,bx,bz))return [];return yield* searchLocalPath(grid,ax,az,bx,bz);}
 return {stats,has:owner=>owners.has(owner),request(owner,ax,az,bx,bz,valid,complete){
  if(owners.has(owner))return false;const job={owner,valid,complete,started:now(),search:route(ax,az,bx,bz)};owners.set(owner,job);jobs.push(job);stats.requests++;stats.active=jobs.length;return true;
 },advance(){
  const start=now(),deadline=start+milliseconds;let nodes=0;
  while(jobs.length&&nodes<nodesPerFrame&&now()<deadline){const job=jobs.shift();
   if(!job.valid()){owners.delete(job.owner);stats.cancelled++;continue;}
   let result;for(let slice=0;slice<4&&nodes<nodesPerFrame;slice++){const begin=now();result=job.search.next();nodes++;stats.maxSliceMs=Math.max(stats.maxSliceMs,now()-begin);if(result.done||now()>=deadline)break;}
   if(result.done){owners.delete(job.owner);if(job.valid()){job.complete(result.value);stats.completed++;stats.maxLatencyMs=Math.max(stats.maxLatencyMs,now()-job.started);}else stats.cancelled++;}else jobs.push(job);
  }
  stats.active=jobs.length;stats.lastNodes=nodes;stats.lastMs=now()-start;stats.totalMs+=stats.lastMs;stats.maxMs=Math.max(stats.maxMs,stats.lastMs);
 },clear(){stats.cancelled+=jobs.length;jobs.length=0;owners.clear();stats.active=0;}};
}
