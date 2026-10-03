import {lowTideTarget} from './low-tide.js';
import {coastalTarget,coastalMapSvg} from './coastal-world-map.js';
import {harborRoomSupplies} from './harbor-interiors.js';
// Street routes use the same reciprocal cell walls as movement; no straight
// objective arrows through closed lots. Cache by cell and objective changes.
import {propSegmentClear} from './harbor-collision.js';
const cache=new WeakMap();
const coastEdges=new WeakMap();
function streetSegmentClear(c,n,j,d,op,start,x,y,xx,yy){
 if(!c.coastal||n===start)return propSegmentClear(c,x,y,xx,yy);
 let cached=coastEdges.get(c);
 if(!cached||cached.cells!==c.cells||cached.obstacles!==c.obstacles){cached={cells:c.cells,obstacles:c.obstacles,edges:new Uint8Array(c.w*c.h*4)};coastEdges.set(c,cached);}
 const index=n*4+d;if(cached.edges[index])return cached.edges[index]===1;
 const clear=propSegmentClear(c,x,y,xx,yy),value=clear?1:2;cached.edges[index]=value;cached.edges[j*4+op]=value;return clear;
}
export function harborLocation(run){
 if(run.course.activeInterior)return run.course.activeInterior.name;
 const {x,y}=run,q=run.course.buildings.find(b=>b.yard)?.yard;
 if(run.course.coastal&&(x>=32||y>=30)){const d=run.course.coastal.districts.find(d=>x*4>=d.minX&&x*4<d.maxX&&y*4>=d.minZ&&y*4<d.maxZ);return d?.name||'COAST ROAD';}
 const passage=run.course.buildings.find(b=>b.passage)?.passage;
 if(passage&&x>=passage.x&&x<=passage.x+passage.w&&y>=passage.y&&y<=passage.y+passage.h)return passage.name;
 if(q&&x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h)return 'NETMAKERS YARD';
 if(y>=25)return x>=27?'FERRY APPROACH':'SEAFRONT PROMENADE';
 if(y>=11&&y<=17)return 'DOCK ROAD';
 return x<13?'WEST SERVICE LANE':x<23?'POWER LANE':'FERRY LANE';
}
export function harborNavigation(run){
 const c=run.course;if(!c?.harbor)return null;
 if(c.activeInterior){const p=lowTideTarget(run)||c.activeInterior.exit;return {target:{...p,id:p.id||"room-exit",label:p.label||"Door / return to harbor"},points:[p],distance:Math.round(Math.hypot(p.x-run.x,p.y-run.y)*4),bearing:Math.atan2(p.y-run.y,p.x-run.x)-run.angle};}
 const count=run.backpack?.weaponPickups?.length||0;
 const destination=coastalTarget(run);
 const missionTarget=destination?{...destination,label:destination.name}:lowTideTarget(run);
 const targets=missionTarget?[missionTarget]:count<3?(c.weaponPickups||[]).filter(p=>!run.backpack?.weaponPickups?.includes(p.id)):
  (run.vehicle?.distance||0)<8?[{...run.vehicle,id:'truck',label:run.vehicle?.occupied?'Drive 32 m along Dock Road':'Dock truck'}]:[{...c.exit,id:'ferry',label:'Ferry extraction'}];
 const sx=Math.floor(run.x),sy=Math.floor(run.y),start=sy*c.w+sx;
 const key=`${start}/${targets.map(t=>`${t.id}:${t.label}:${t.x.toFixed(1)},${t.y.toFixed(1)}`).join('|')}`;
 let saved=cache.get(c);
 if(!saved||saved.key!==key){
  const parent=new Int32Array(c.w*c.h).fill(-1),queue=[start];parent[start]=start;
  for(let i=0;i<queue.length;i++){
   const n=queue[i],x=n%c.w,y=Math.floor(n/c.w);
   for(const [dx,dy,d,op]of[[0,-1,0,2],[1,0,1,3],[0,1,2,0],[-1,0,3,1]]){
    const xx=x+dx,yy=y+dy,j=yy*c.w+xx;
    if(xx<0||yy<0||xx>=c.w||yy>=c.h||parent[j]!==-1||c.cells[n][d]||c.cells[j][op])continue;
    if(!streetSegmentClear(c,n,j,d,op,start,n===start?run.x:x+.5,n===start?run.y:y+.5,xx+.5,yy+.5))continue;
    parent[j]=n;queue.push(j);
   }
  }
  let best=null;
  for(const target of targets){
   let n=Math.floor(target.y)*c.w+Math.floor(target.x);if(parent[n]===-1)continue;
   const cells=[];while(n!==start){cells.push(n);n=parent[n];}cells.reverse();
   if(!best||cells.length<best.cells.length)best={target,cells};
  }
  saved={key,...best};cache.set(c,saved);
 }
 if(!saved.target)return null;
 const points=[...saved.cells.map(n=>({x:n%c.w+.5,y:Math.floor(n/c.w)+.5})),{x:saved.target.x,y:saved.target.y}];
 while(points.length>1&&Math.hypot(points[0].x-run.x,points[0].y-run.y)<.25)points.shift();
 const point=points[0];let distance=0,previous=run;for(const p of points){distance+=Math.hypot(p.x-previous.x,p.y-previous.y);previous=p;}
 return {target:saved.target,points,distance:Math.round(distance*4),bearing:Math.atan2(point.y-run.y,point.x-run.x)-run.angle};
}
export function harborMapSvg(run){
 if(run.course.activeInterior){
  const r=run.course.activeInterior,left=r.x-r.width/2,top=r.z-r.depth/2;
  const x=v=>(v*4-left)*20,y=v=>(v*4-top)*20;
  const target=lowTideTarget(run);
  const marker=target?`<path d="M0,-7 7,0 0,7 -7,0Z" transform="translate(${x(target.x)} ${y(target.y)})" fill="none" stroke="#efbb6c" stroke-width="2"/>`:'';
  const furniture=r.obstacles.map(b=>`<rect x="${x(b.minX)}" y="${y(b.minY)}" width="${(b.maxX-b.minX)*80}" height="${(b.maxY-b.minY)*80}" fill="#758378"/>`).join('');
  return `<svg class="harbor-field-map" viewBox="-12 -20 ${r.width*20+24} ${r.depth*20+46}" role="img" aria-label="Interior room plan with furniture, supplies and exit"><rect width="${r.width*20}" height="${r.depth*20}" fill="#263831" stroke="#b8c0a4" stroke-width="3"/>${furniture}${marker}<circle cx="${x(r.cache.x)}" cy="${y(r.cache.y)}" r="5" fill="${!harborRoomSupplies(run,r.id)?'#637366':'#efbb6c'}"/><circle cx="${x(r.exit.x)}" cy="${y(r.exit.y)}" r="6" fill="#9bd3b5"/><text x="${x(r.exit.x)}" y="${y(r.exit.y)-10}" fill="#d7e5bd" text-anchor="middle" font-size="9">EXIT / Q</text><path d="M6,0 -4,-4 -2,0 -4,4Z" fill="#fff3cc" transform="translate(${x(run.x)} ${y(run.y)}) rotate(${run.angle*180/Math.PI})"/></svg>`;
 }
 const c=run.course,nav=harborNavigation(run),scale=10;
 if(c.coastal)return coastalMapSvg(run,nav);
 const blocks=c.blocks.map(([x,y])=>`<rect x="${x*scale}" y="${y*scale}" width="10" height="10"/>`).join('')+(c.obstacles||[]).map(b=>`<rect x="${b.minX*scale}" y="${b.minY*scale}" width="${(b.maxX-b.minX)*scale}" height="${(b.maxY-b.minY)*scale}"/>`).join('');
 let walls='';for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){const v=c.cells[y*c.w+x];if(v[0])walls+=`M${x*10},${y*10}h10`;if(v[3])walls+=`M${x*10},${y*10}v10`;}
 const labels=c.buildings.map((b,i)=>`<text x="${(b.x+3)*10}" y="${(b.y+1.3)*10}" text-anchor="middle">${i+1}</text>`).join('');
 const doors=(c.harborRooms||[]).map(r=>`<rect x="${r.door.x*10-2.5}" y="${r.door.y*10-3.5}" width="5" height="7" rx="1" fill="${harborRoomSupplies(run,r.id)?'#9bd3b5':'#637366'}" stroke="#101d18" stroke-width="1"><title>Q: ${r.name}</title></rect>`).join('');
 const finds=c.weaponPickups.filter(p=>!run.backpack?.weaponPickups?.includes(p.id)).map(p=>`<circle cx="${p.x*10}" cy="${p.y*10}" r="3"/>`).join('');
 const route=nav?`<polyline points="${[run,...nav.points].map(p=>`${p.x*10},${p.y*10}`).join(' ')}" fill="none" stroke="#efbb6c" stroke-width="2" stroke-dasharray="4 3"/>`:'';
 return `<svg class="harbor-field-map" viewBox="-4 -8 328 334" role="img" aria-label="Blackwater harbor street map, numbered landmarks, remaining weapons, truck, ferry and suggested walking route">
 <rect x="0" y="0" width="320" height="300" fill="#263831"/><rect x="0" y="300" width="320" height="24" fill="#234b55"/>
 <g fill="#111d1a">${blocks}</g><path d="${walls}M0,300h320M320,0v300" fill="none" stroke="#7d8d78" stroke-width="1"/>
 <g fill="#abbba5" font-size="10" font-family="sans-serif">${labels}</g>${route}${doors}<g fill="#e7bf77">${finds}</g>
 <rect x="${run.vehicle.x*10-4}" y="${run.vehicle.y*10-2}" width="8" height="4" fill="#b7d2df"/>
 <path d="M${c.exit.x*10},${c.exit.y*10}v-10h8l-3,3 3,3h-8" fill="#9bd3b5" stroke="#9bd3b5"/>
 <path d="M6,0 -4,-4 -2,0 -4,4Z" fill="#fff3cc" stroke="#151e19" stroke-width="1" transform="translate(${run.x*10} ${run.y*10}) rotate(${run.angle*180/Math.PI})"/>
 <text x="8" y="317" fill="#b5d5db" font-size="8" font-family="sans-serif">SOUTH / WATERFRONT</text></svg>`;
}
