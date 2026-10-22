// One ground-floor shell owns both visible openings and collision. Coordinates
// are building-local; the front door faces +Z and stays three metres wide.
export function houseShell(b){
 const walls=[],windows=[];
 for(let side=0;side<4;side++){
  const along=side<2?b.w:b.d,count=Math.floor(along/3.4),span=along/count,openings=[];
  for(let bay=0;bay<count;bay++){
   const u=(bay+.5)*span-along/2;
   if(side===0&&!b.upper&&Math.abs(u)<2.8)continue;
   // Bespoke shop fronts own their front glazing and sign panels.
   if(side===0&&!b.upper&&['building-54','building-55','building-78'].includes(b.id))continue;
   openings.push({a:u-.625,b:u+.625,lo:1.075,hi:2.725});windows.push({side,u});
  }
  if(side===0&&!b.upper)openings.push({a:-1.5,b:1.5,lo:0,hi:2.7});
  openings.sort((a,b)=>a.a-b.a);let cursor=-along/2;
  const slab=(a,c,lo,hi)=>{if(c-a<.001||hi-lo<.001)return;walls.push(side<2?{x:(a+c)/2,z:(side===0?1:-1)*b.d/2,w:c-a,d:.4,y:lo,h:hi-lo}:{x:(side===2?1:-1)*b.w/2,z:(a+c)/2,w:.4,d:c-a,y:lo,h:hi-lo});};
  for(const o of openings){slab(cursor,o.a,0,3.4);slab(o.a,o.b,0,o.lo);slab(o.a,o.b,o.hi,3.4);cursor=o.b;}slab(cursor,along/2,0,3.4);
 }
 return {walls,windows};
}
