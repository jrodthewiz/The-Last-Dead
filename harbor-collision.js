// Static prop AABBs in simulation cells. The visual layout owns their measured
// footprints; movement, line-of-sight and navigation consume the same records.
export function propCanStand(course,x,y,radius=0){
 for(const b of course.obstacles||[]){
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
