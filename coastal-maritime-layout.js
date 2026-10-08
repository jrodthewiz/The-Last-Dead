// Metre records shared by visuals and the parent's collision authority. Moored
// vessels remain seaward and stationary. Cars are authored shoulder parking.
export function makeCoastalMaritime(course){
 const boats=[{id:'quay-trawler',kind:'trawler',x:25,z:128,yaw:0,length:12,beam:3.6,mooring:[{x:21,z:119.3},{x:29,z:119.3}]},{id:'quay-launch',kind:'launch',x:64,z:126.6,yaw:0,length:8.4,beam:2.8,mooring:[{x:61,z:119.3},{x:69,z:119.3}]},{id:'quay-skiff',kind:'skiff',x:96,z:125.5,yaw:0,length:5.8,beam:1.95,mooring:[{x:93,z:119.3}]}].map(p=>({...p,y:course.water?.level??-1.15,bounds:{minX:p.x-p.length/2-.4,maxX:p.x+p.length/2+.4,minZ:p.z-p.beam/2-.4,maxZ:p.z+p.beam/2+.4}}));
 const candidates=[['estate',5,53,0],['van',122,48,Math.PI/2],['estate',6,108,0],['van',121,34,Math.PI/2],['estate',196,60.45,0],['estate',196,107.55,0],['estate',328,60.45,0],['van',268,180.45,0],['estate',328,227.55,0],['van',328,299.55,0],['estate',4.5,12,Math.PI/2],['van',123,105,Math.PI/2]];
 const cars=[];
 for(const [kind,x,z,yaw]of candidates){
  const length=kind==='van'?5.4:4.65,width=kind==='van'?2.35:2.13,cos=Math.abs(Math.cos(yaw)),sin=Math.abs(Math.sin(yaw));
  const hx=(length*cos+width*sin)/2+.14,hz=(length*sin+width*cos)/2+.14,b={minX:x-hx,maxX:x+hx,minZ:z-hz,maxZ:z+hz};
  const occupied=course.obstacles?.some(o=>b.maxX+1>o.minX*4&&b.minX-1<o.maxX*4&&b.maxZ+1>o.minY*4&&b.minZ-1<o.maxY*4);
  const approach=[...(course.scavengerPickups||[]),...(course.weaponPickups||[]),...(course.coastal?.blackwaterSlice?.interiors||[]).flatMap(i=>[i.route?.frontApproach,i.route?.rearApproach].filter(Boolean).map(p=>({x:p.x/4,y:p.z/4})))].some(p=>p.x*4>b.minX-2.5&&p.x*4<b.maxX+2.5&&p.y*4>b.minZ-2.5&&p.y*4<b.maxZ+2.5);
  let blocked=false;
  for(let cz=Math.floor(b.minZ/4);cz<=Math.floor(b.maxZ/4);cz++)for(let cx=Math.floor(b.minX/4);cx<=Math.floor(b.maxX/4);cx++){const c=course.cells[cz*course.w+cx];if(!c||c.every(v=>v===1))blocked=true;}
  const truck=course.vehicle,nearTruck=truck&&Math.hypot(x-truck.x*4,z-truck.y*4)<8;
  if(occupied||approach||blocked||nearTruck)continue;
  cars.push({id:`parked-${kind}-${cars.length}`,kind,x,z,y:.14,yaw,length,width,paint:['#668782','#647488','#a18a61','#786c67'][cars.length%4],bounds:b});
  if(cars.length===8)break;
 }
 return{boats,cars,diagnostics:{boats:boats.length,cars:cars.length,stationary:true,collisionUnits:'metres'}};
}
