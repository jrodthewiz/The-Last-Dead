// Static prop AABBs in simulation cells. The visual layout owns their measured
// footprints; movement, line-of-sight and navigation consume the same records.
const propIndexes=new WeakMap(),PROP_CELL=2,MAX_PROP_BUCKETS=65536,MAX_PROP_REFERENCES=1048576;
// Explicit construction finalization, never an identity-only cache of mutable
// authority. Validate and build everything before freezing any caller record.
export function registerImmutablePropObstacles(course){
 if(!course?.coastal)return false;
 const obstacles=course.obstacles;
 if(!Array.isArray(obstacles))throw new TypeError('Static prop authority must be an array');
 const previous=propIndexes.get(course);
 if(previous?.obstacles===obstacles)return true;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let i=0;i<obstacles.length;i++){
  const element=Object.getOwnPropertyDescriptor(obstacles,String(i)),b=element?.value;
  if(!element||!('value'in element)||!b||(Object.getPrototypeOf(b)!==Object.prototype&&Object.getPrototypeOf(b)!==null))throw new TypeError('Static prop records must be plain own array data');
  for(const key of ['minX','maxX','minY','maxY']){
   const field=b&&Object.getOwnPropertyDescriptor(b,key);
   if(!field||!('value'in field)||!Number.isFinite(field.value))throw new TypeError('Static prop bounds must be finite own numeric data');
  }
  if(b.minX>b.maxX||b.minY>b.maxY)throw new RangeError('Static prop bounds are inverted');
  minX=Math.min(minX,Math.floor(b.minX/PROP_CELL));minY=Math.min(minY,Math.floor(b.minY/PROP_CELL));
  maxX=Math.max(maxX,Math.floor(b.maxX/PROP_CELL));maxY=Math.max(maxY,Math.floor(b.maxY/PROP_CELL));
 }
 if(!obstacles.length)minX=minY=maxX=maxY=0;
 const columns=maxX-minX+1,rows=maxY-minY+1;
 if(!Number.isSafeInteger(minX)||!Number.isSafeInteger(minY)||!Number.isSafeInteger(maxX)||!Number.isSafeInteger(maxY)||columns*rows>MAX_PROP_BUCKETS)throw new RangeError('Static prop index extent exceeds its bounded grid');
 const buckets=new Array(columns*rows);let references=0,occupied=0;
 for(let i=0;i<obstacles.length;i++){
  const b=obstacles[i],x0=Math.floor(b.minX/PROP_CELL)-minX,x1=Math.floor(b.maxX/PROP_CELL)-minX,y0=Math.floor(b.minY/PROP_CELL)-minY,y1=Math.floor(b.maxY/PROP_CELL)-minY;
  references+=(x1-x0+1)*(y1-y0+1);
  if(references>MAX_PROP_REFERENCES)throw new RangeError('Static prop index references exceed the bounded budget');
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const slot=y*columns+x;
   if(!buckets[slot]){buckets[slot]=[];occupied++;}
   buckets[slot].push(i);
  }
 }
 const index={minX,minY,columns,rows,buckets,stamps:new Uint32Array(obstacles.length),candidates:new Uint32Array(obstacles.length),stamp:0,references,occupied};
 for(const b of obstacles)Object.freeze(b);
 Object.freeze(obstacles);
 propIndexes.set(course,{obstacles,index,work:previous?.work||null});return true;
}
// QA opt-in: no counter objects or candidate arrays are created per query.
export function setPropCollisionMeasurement(course,enabled=true){
 let entry=propIndexes.get(course);
 if(!entry){entry={obstacles:null,index:null,work:null};propIndexes.set(course,entry);}
 entry.work=enabled?{queries:0,indexedQueries:0,linearQueries:0,narrowVisits:0,bucketVisits:0}:null;
 return entry.work;
}
export function propCollisionDiagnostics(course){
 const entry=propIndexes.get(course),index=entry?.obstacles===course.obstacles?entry.index:null;
 return{registered:!!index,obstacles:course.obstacles?.length||0,buckets:index?.buckets.length||0,occupiedBuckets:index?.occupied||0,references:index?.references||0,scratchBytes:index?(index.stamps.byteLength+index.candidates.byteLength):0,work:entry?.work?{...entry.work}:null};
}
export function propCanStand(course,x,y,radius=0){
 const entry=propIndexes.get(course),work=entry?.work,index=entry?.obstacles===course.obstacles?entry.index:null;
 if(work)work.queries++;
 if(index&&Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(radius)&&radius>=0&&radius<=4){
  const pad=Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(y),radius)*4;
  const x0=Math.max(0,Math.floor((x-radius-pad)/PROP_CELL)-index.minX),x1=Math.min(index.columns-1,Math.floor((x+radius+pad)/PROP_CELL)-index.minX);
  const y0=Math.max(0,Math.floor((y-radius-pad)/PROP_CELL)-index.minY),y1=Math.min(index.rows-1,Math.floor((y+radius+pad)/PROP_CELL)-index.minY);
  if((x1-x0+1)*(y1-y0+1)<=64){
   if(work)work.indexedQueries++;
   if(x0>x1||y0>y1)return true;
   if(++index.stamp>=0xffffffff){index.stamps.fill(0);index.stamp=1;}
   let count=0;
   for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){
    if(work)work.bucketVisits++;
    const bucket=index.buckets[yy*index.columns+xx];if(!bucket)continue;
    for(const id of bucket)if(index.stamps[id]!==index.stamp){index.stamps[id]=index.stamp;index.candidates[count++]=id;}
   }
   // Original authority order, without allocating a typed-array view or Set.
   for(let i=1;i<count;i++){const id=index.candidates[i];let j=i;while(j&&index.candidates[j-1]>id){index.candidates[j]=index.candidates[j-1];j--;}index.candidates[j]=id;}
   for(let i=0;i<count;i++){
    const b=course.obstacles[index.candidates[i]];
    if(work)work.narrowVisits++;
    const dx=x-Math.max(b.minX,Math.min(b.maxX,x)),dy=y-Math.max(b.minY,Math.min(b.maxY,y));
    if(dx*dx+dy*dy<radius*radius||x>b.minX&&x<b.maxX&&y>b.minY&&y<b.maxY)return false;
   }
   return true;
  }
 }
 if(work)work.linearQueries++;
 for(const b of course.obstacles||[]){
  if(work)work.narrowVisits++;
  const dx=x-Math.max(b.minX,Math.min(b.maxX,x)),dy=y-Math.max(b.minY,Math.min(b.maxY,y));
  if(dx*dx+dy*dy<radius*radius||x>b.minX&&x<b.maxX&&y>b.minY&&y<b.maxY)return false;
 }
 return true;
}
export function propRay(course,x,y,angle,max){
 const dx=Math.cos(angle),dy=Math.sin(angle);let nearest=null;
 for(const b of course.obstacles||[]){
  let enter=0,exit=max,side=0;
  if(Math.abs(dx)<1e-10){if(x<b.minX||x>b.maxX)continue;}
  else{let a=(b.minX-x)/dx,z=(b.maxX-x)/dx;if(a>z)[a,z]=[z,a];if(a>enter){enter=a;side=0;}exit=Math.min(exit,z);}
  if(Math.abs(dy)<1e-10){if(y<b.minY||y>b.maxY)continue;}
  else{let a=(b.minY-y)/dy,z=(b.maxY-y)/dy;if(a>z)[a,z]=[z,a];if(a>enter){enter=a;side=1;}exit=Math.min(exit,z);}
  if(exit<enter||exit<0||enter>max)continue;
  const dist=Math.max(.02,enter);if(!nearest||dist<nearest.dist){const hit=side===0?y+dy*dist:x+dx*dist;nearest={dist,side,u:hit-Math.floor(hit),obstacleId:b.id};}
 }
 return nearest;
}
// For disjoint convex shapes the nearest pair is an endpoint against the box,
// or a box corner against the segment. Intersection is handled separately.
function pointBoxDistanceSquared(x,y,b){
 const dx=x-Math.max(b.minX,Math.min(b.maxX,x)),dy=y-Math.max(b.minY,Math.min(b.maxY,y));
 return dx*dx+dy*dy;
}
function cornerSegmentDistanceSquared(cx,cy,x,y,dx,dy,lengthSquared){
 const t=Math.max(0,Math.min(1,((cx-x)*dx+(cy-y)*dy)/lengthSquared));
 const ex=cx-x-dx*t,ey=cy-y-dy*t;return ex*ex+ey*ey;
}
export function propSegmentClear(course,x,y,xx,yy,radius=.16){
 if(!course.obstacles?.length)return true;
 const dx=xx-x,dy=yy-y,lengthSquared=dx*dx+dy*dy,radiusSquared=radius*radius;
 if(!lengthSquared)return propCanStand(course,x,y,radius);
 for(const b of course.obstacles){
  let enter=0,exit=1;
  if(dx===0){if(x<b.minX||x>b.maxX)exit=-1;}
  else{const a=(b.minX-x)/dx,z=(b.maxX-x)/dx;enter=Math.max(enter,Math.min(a,z));exit=Math.min(exit,Math.max(a,z));}
  if(dy===0){if(y<b.minY||y>b.maxY)exit=-1;}
  else{const a=(b.minY-y)/dy,z=(b.maxY-y)/dy;enter=Math.max(enter,Math.min(a,z));exit=Math.min(exit,Math.max(a,z));}
  if(enter<=exit){
   if(radiusSquared>0)return false;
   // With zero radius, touching a face/corner is clear, as in propCanStand.
   const t=(enter+exit)/2,px=x+dx*t,py=y+dy*t;
   if(px>b.minX&&px<b.maxX&&py>b.minY&&py<b.maxY)return false;
  }
  if(radiusSquared>0){
   const distanceSquared=Math.min(pointBoxDistanceSquared(x,y,b),pointBoxDistanceSquared(xx,yy,b),
    cornerSegmentDistanceSquared(b.minX,b.minY,x,y,dx,dy,lengthSquared),
    cornerSegmentDistanceSquared(b.minX,b.maxY,x,y,dx,dy,lengthSquared),
    cornerSegmentDistanceSquared(b.maxX,b.minY,x,y,dx,dy,lengthSquared),
    cornerSegmentDistanceSquared(b.maxX,b.maxY,x,y,dx,dy,lengthSquared));
   if(distanceSquared<radiusSquared)return false;
  }
 }
 return true;
}
