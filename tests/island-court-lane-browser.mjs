import assert from 'node:assert/strict';

// Separate controlled starts after all governing captures; not a continuous
// tour, combat test, or substitute for raw art evidence.
export async function verifyCourtLaneJourney(page, settle, result={}) {
 const census=await page.evaluate(async()=>{
  const q=window.__DEAD_ARRIVAL__,c=q.run.course.coastal;
  const {canStand}=await import('/engine.js');
  const interiors=c.blackwaterSlice.interiors.filter(p=>p.id.startsWith('coast-lot-4-1-'));
  const sides=c.neighborhoods.alleys.filter(a=>a.zone==='coastal-park'&&a.width===4&&a.x>240&&a.x<360&&a.z>=240&&a.z<=296);
  const main={id:'main-and-crossing',a:[383.5,268],b:[240.5,268]};
  const rear=interiors.map(p=>({id:p.id,a:[p.rearDoor.x,p.rearDoor.z+(p.rearDoor.z<268?.5:-.5)],b:[p.rearDoor.x,268]}));
  const side=sides.map((p,i)=>({id:'side-passage-'+i,a:[p.x,p.z-p.depth/2+.5],b:[p.x,p.z+p.depth/2-.5]}));
  const sample=traces=>{
   let samples=0;const blocked=[];
   for(const t of traces){const dx=t.b[0]-t.a[0],dz=t.b[1]-t.a[1],length=Math.hypot(dx,dz),n=Math.ceil(length*2);
    for(let i=0;i<=n;i++)for(const offset of [-1.5,0,1.5]){
     const x=t.a[0]+dx*i/n-dz/length*offset,z=t.a[1]+dz*i/n+dx/length*offset;
     samples++;if(!canStand(q.run.course,x/4,z/4,.08))blocked.push({id:t.id,x,z});
    }
   }return{samples,blocked};
  };
  return{main,rear,side,lane:sample([main,...rear]),passages:sample(side),trees:c.forestPlacements.length};
 });
 assert.equal(census.trees,562);assert.equal(census.rear.length,12);assert.equal(census.side.length,12);
 assert.equal(census.lane.samples,1653);assert.deepEqual(census.lane.blocked,[]);assert.deepEqual(census.passages.blocked,[]);
 const walks=[];Object.assign(result,{scope:'Actual immutable native census and25 separate W-only route traversals after governing captures; controlled starts, no synthetic movement or art credit',census,walks});
 for(const trace of [census.main,...census.rear,...census.side]){
  const length=Math.hypot(trace.b[0]-trace.a[0],trace.b[1]-trace.a[1]);
  // Actual uninjured controller speed is2.05cells/s=8.2m/s. The existing
  // progress tolerance allows startup acceleration. Stop inside the route
  // and assess real progress rather than writing an endpoint.
  const duration=Math.max(100,(length-.6)/8.2*1000);
  const before=await page.evaluate(trace=>{
   const q=window.__DEAD_ARRIVAL__;if(q.inspector.active)q.requestInspector();
   const angle=Math.atan2(trace.b[1]-trace.a[1],trace.b[0]-trace.a[0]);
   Object.assign(q.run,{x:trace.a[0]/4,y:trace.a[1]/4,z:0,supportZ:null,supportId:null,structureId:null,angle,pitch:0,vx:0,vy:0,vz:0});
   return{x:q.run.x*4,z:q.run.y*4,angle,health:q.run.health};
  },trace);
  await page.keyboard.down('w');
  try{for(let remaining=duration;remaining>0;remaining-=Math.min(remaining,4000))await page.evaluate(ms=>window.advanceTime(ms),Math.min(remaining,4000));}
  finally{await page.keyboard.up('w');}
  const after=await page.evaluate(()=>{const r=window.__DEAD_ARRIVAL__.run;return{x:r.x*4,z:r.y*4,angle:r.angle,health:r.health,mode:r.mode};});
  const dx=after.x-before.x,dz=after.z-before.z;
  const progress=(dx*(trace.b[0]-trace.a[0])+dz*(trace.b[1]-trace.a[1]))/length;
  const lateralError=Math.abs(dx*(trace.b[1]-trace.a[1])-dz*(trace.b[0]-trace.a[0]))/length;
  walks.push({id:trace.id,before,after,durationMs:duration,routeLength:length,progress,lateralError});
  assert.ok(progress>length-2&&progress<=length+.2,'Actual W progress: '+trace.id);
  assert.ok(lateralError<.1,'Unsteered W stays in route: '+trace.id);
  assert.equal(after.angle,before.angle);assert.ok(after.health>0);assert.equal(after.mode,'play');
 }
 await settle();
 return result;
}
