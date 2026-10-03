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
export function propSegmentClear(course,x,y,xx,yy,radius=.16){
 if(!course.obstacles?.length)return true;
 const d=Math.hypot(xx-x,yy-y),steps=Math.max(1,Math.ceil(d/.08));
 for(let i=0;i<=steps;i++){const t=i/steps;if(!propCanStand(course,x+(xx-x)*t,y+(yy-y)*t,radius))return false;}
 return true;
}
