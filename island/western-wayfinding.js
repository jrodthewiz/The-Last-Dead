import {ROADS,terrainHeight,roadAt} from './data.js';
import {TRAILS,PLACES,trailDistance} from './places.js';
import {accessReserved} from './access-plan.js';
import {settlementReserved} from './settlement-plan.js';
const plans=new WeakMap(),WOOD=0x6b6048,BLUE=0x799c96,CREAM=0xd4c798;

// A continuous ranger language belongs to these two routes. Placement stays
// beyond the physical walking strip and uses the same plan for art and solids.
export function westernWayfindingPlan(data){
 if(plans.has(data))return plans.get(data);
 const pieces=[],solids=[];let blazes=0,signs=0;
 const safe=(x,z,r=.22)=>{
  const road=roadAt(x,z);
  return terrainHeight(x,z)>4&&road.distance>road.width/2+r+.55&&trailDistance(x,z)>r+.55&&
   !accessReserved(data.accessPaths||[],x,z,r+.8)&&!settlementReserved(x,z,r+.6)&&
   data.buildings.every(b=>Math.abs(x-b.x)>b.w/2+r+1||Math.abs(z-b.z)>b.d/2+r+1)&&
   data.trees.every(t=>Math.hypot(x-t.x,z-t.z)>r+t.scale*.4+.5)&&
   data.rocks.every(t=>Math.hypot(x-t.x,z-t.z)>r+t.s+.4)&&
   PLACES.every(p=>Math.hypot(x-p.x,z-p.z)>6+r);
 };
 const box=(id,x,y,z,w,h,d,color,rotation=0,solid=false)=>{
  pieces.push({shape:'box',role:id,x,y,z,w,h,d,color,rotation});
  if(solid){const c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));solids.push({id:'western-'+id,x,z,w:w*c+d*s,d:w*s+d*c,y:y-h/2,h});}
 };
 const label=(text,x,y,z,w,h,a)=>{
  for(const side of [-1,1])pieces.push({shape:'label',x:x+Math.sin(a)*.13*side,y,z:z+Math.cos(a)*.13*side,w,h,rotation:a+(side<0?Math.PI:0),text:side>0?text:text.replace(/[←→]/g,c=>c==='←'?'→':'←'),colour:0x486c64});
 };
 const routes=[ROADS.find(r=>r.name==='Western Trail'),TRAILS.find(r=>r.name==='Cormorant loop')];
 for(const [ri,route]of routes.entries()){
  let along=0,next=ri?17:30;
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   while(next<along+length){
    const t=(next-along)/length,cx=a[0]+dx*t,cz=a[1]+dz*t,offset=route.width/2+1.25;
    if(PLACES.every(p=>Math.hypot(cx-p.x,cz-p.z)>p.radius+2))for(const side of [1,-1]){
     const x=cx-dz/length*offset*side,z=cz+dx/length*offset*side;
     if(!safe(x,z))continue;
     const y=terrainHeight(x,z),id='blaze-'+ri+'-'+blazes;
     box(id,x,y+.59,z,.17,1.18,.17,WOOD,0,true);
     box(id+'-paint',x,y+.91,z,.181,.25,.181,BLUE);
     box(id+'-cap',x,y+1.06,z,.184,.055,.184,CREAM);
     blazes++;break;
    }
    next+=ri?28:34;
   }
   along+=length;
  }
 }
 for(const p of [
  {id:'cormorant-fork',x:-916,z:46,a:.23,top:'← CORMORANT LOOKOUT',bottom:'WESTLIGHT / KEEPER →'},
  {id:'cormorant-return',x:-866,z:-105,a:.35,top:'CORMORANT LOOP ←',bottom:'WESTLIGHT →'},
  {id:'cape-join',x:-837,z:-244,a:.10,top:'WESTLIGHT / KEEPER',bottom:'FOLLOW THE BLUE POSTS'},
 ]){
  if(!safe(p.x,p.z,1.75))continue;
  const y=terrainHeight(p.x,p.z);
  box(p.id+'-post',p.x,y+.96,p.z,.20,1.92,.20,WOOD,p.a,true);
  for(const [j,text]of [p.top,p.bottom].entries()){
   const yy=y+1.65-j*.48;
   box(p.id+'-board-'+j,p.x,yy,p.z,3.4,.44,.12,j?0x8b805c:0x526e60,p.a,true);
   label(text,p.x,yy,p.z,3.22,.36,p.a);
  }
  box(p.id+'-blue',p.x,y+.56,p.z,.215,.22,.215,BLUE,p.a);
  signs++;
 }
 // A ranger's field map is a physical silhouette at the lookout, not another
 // loose supply box. It sits beside the shelter's existing clear approach.
 const x=-941,z=-50;
 if(safe(x,z,1.65)){
  const y=Math.max(...[-1.1,1.1].map(dx=>terrainHeight(x+dx,z)))+1.45;
  for(const dx of [-1.05,1.05]){const floor=terrainHeight(x+dx,z);box('map-leg',x+dx,(floor+y+.55)/2,z,.16,y+.55-floor,.16,WOOD,0,true);}
  box('map-frame',x,y,z,2.75,1.7,.18,WOOD,0,true);
  box('map-panel',x,y,z+.10,2.49,1.43,.025,0x6d918c);
  for(const [dx,dy,w,h]of [[-.48,.10,.80,1.08],[-.78,-.05,.45,.65],[-.20,-.27,.65,.42],[.82,.05,.48,1.08]])box('map-land',x+dx,y+dy,z+.12,w,h,.018,0xb8bd8c);
  box('map-bridge',x+.29,y+.08,z+.136,.55,.055,.018,CREAM);
  // Chunky, connected strokes survive the low-resolution picture. The loop
  // leaves the western route at the fork and rejoins below Westlight.
  const stroke=(points)=>{for(let i=1;i<points.length;i++){
   const [ax,ay]=points[i-1],[bx,by]=points[i];
   box('map-trail',(x+ax+x+bx)/2,y+ay,z+.146,Math.abs(bx-ax)+.035,.035,.018,CREAM);
   box('map-trail',x+bx,y+(ay+by)/2,z+.146,.035,Math.abs(by-ay)+.035,.018,CREAM);
  }};
  stroke([[-.44,-.33],[-.65,-.17],[-.81,.04],[-.74,.30],[-.62,.52]]);
  stroke([[-.81,.04],[-.94,.16],[-.94,.25],[-.84,.34],[-.74,.30]]);
  for(const [dx,dy]of [[-.44,-.33],[-.81,.04],[-.62,.52]])box('map-waypoint',x+dx,y+dy,z+.16,.09,.09,.02,0x425b50);
  box('map-here-surround',x-.94,y+.25,z+.164,.16,.16,.02,CREAM);
  box('map-you-are-here',x-.94,y+.25,z+.18,.085,.085,.02,0xb47651);
  pieces.push({shape:'label',x,y:y-.61,z:z+.17,w:2.2,h:.17,text:'BLUE POSTS / YOU ARE HERE',colour:0x486c64,rotation:0});
  const sx=x+1.54,floor=terrainHeight(sx,z+.25);
  box('ranger-staff',sx,floor+.81,z+.25,.07,1.62,.07,WOOD,0,true);
  box('staff-blue',sx,floor+1.28,z+.25,.08,.20,.08,BLUE);
 }
 const plan={pieces,solids,blazes,signs};plans.set(data,plan);return plan;
}
