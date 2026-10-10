// Seeded residents use completed collision authority. Positions are metres
// during placement, converted once to the simulation's four-metre cells.
import {hash01} from './enemy-ai.js';
const COHORTS=['shambler','runner','shambler','injured','shambler','runner','injured','shambler'];
const APPEARANCES=['ash-witness','drowned-dockworker','fever-runner','ash-witness'];
const inRect=(x,z,p,pad=0)=>Math.abs(x-p.x)<p.width/2+pad&&Math.abs(z-p.z)<p.depth/2+pad;
export function makeCoastalZombiePopulation(course,canStand,{count=48}={}){
 if(!course.coastal)return [];
 const coastal=course.coastal,candidates=[];
 const add=(x,z,region,bounds,buildingId=null)=>candidates.push({x,z,region,bounds,buildingId});
 for(const [i,a] of coastal.neighborhoods.alleys.entries()){
  const horizontal=a.width>=a.depth;
  for(const offset of [-.28,0,.28])add(a.x+(horizontal?a.width*offset:0),a.z+(horizontal?0:a.depth*offset),`alley-${i}`,
   {minX:a.x-a.width/2+.9,maxX:a.x+a.width/2-.9,minZ:a.z-a.depth/2+.9,maxZ:a.z+a.depth/2-.9});
 }
 for(const [i,r] of coastal.roads.entries()){
  const horizontal=r.width>=r.depth,length=horizontal?r.width:r.depth;
  for(let t=-length/2+12;t<length/2-8;t+=16)for(const side of [-1,1]){
   const x=r.x+(horizontal?t:side*(r.width/2+1.5)),z=r.z+(horizontal?side*(r.depth/2+1.5):t);
   add(x,z,`sidewalk-${i}`,{minX:x-(horizontal?4:.45),maxX:x+(horizontal?4:.45),minZ:z-(horizontal?.45:4),maxZ:z+(horizontal?.45:4)});
  }
 }
 for(const interior of coastal.blackwaterSlice.interiors){
  const c=Math.cos(interior.yaw||0),s=Math.sin(interior.yaw||0);
  for(const sign of [-1,1]){
   const lx=sign*(interior.width/2-2),lz=.8;
   const x=interior.x+lx*c+lz*s,z=interior.z-lx*s+lz*c;
   add(x,z,`interior-${interior.id}`,{minX:x-.65,maxX:x+.65,minZ:z-.65,maxZ:z+.65},interior.id);
  }
 }
 const portals=coastal.blackwaterSlice.interiors.flatMap(i=>[i.door,i.rearDoor,...Object.values(i.route||{})].filter(Boolean));
 const pickups=[...(course.scavengerPickups||[]),...(course.weaponPickups||[])];
 const old=course.harborSpawns||[],selected=[],usedRegions=new Set();
 candidates.sort((a,b)=>hash01(Math.round(a.x*100),Math.round(a.z*100)+71003)-hash01(Math.round(b.x*100),Math.round(b.z*100)+71003));
 // First pass gives different lanes a resident before a second occupant.
 for(const pass of [0,1])for(const p of candidates){
  if(selected.length>=count)break;
  if(pass===0&&usedRegions.has(p.region)||selected.some(q=>q.candidate===p))continue;
  const {x,z}=p;
  if(coastal.roads.some(r=>inRect(x,z,r,.9)))continue;
  if(portals.some(q=>Math.hypot(x-q.x,z-q.z)<2.8))continue;
  if(pickups.some(q=>Math.hypot(x-q.x*4,z-q.y*4)<2.5))continue;
  if(old.some(q=>Math.hypot(x-q.x*4,z-q.y*4)<3)||selected.some(q=>Math.hypot(x-q.x*4,z-q.y*4)<4))continue;
  if(Math.hypot(x-course.playerSpawn.x*4,z-course.playerSpawn.y*4)<24||!canStand(course,x/4,z/4,.22))continue;
  const order=selected.length,locomotion=COHORTS[order%COHORTS.length];
  selected.push({id:`coastal-resident-${order}`,x:x/4,y:z/4,facing:hash01(order,71004)*Math.PI*2,
   variant:locomotion==='runner'?'bloodhound':'stalker',appearance:APPEARANCES[order%APPEARANCES.length],locomotion,
   region:p.region,buildingId:p.buildingId,roamRadius:p.buildingId?.22:1,
   roamBounds:{minX:p.bounds.minX/4,maxX:p.bounds.maxX/4,minY:p.bounds.minZ/4,maxY:p.bounds.maxZ/4},candidate:p});
  usedRegions.add(p.region);
 }
 return selected.map(({candidate,...p})=>p);
}
export function attachCoastalZombiePopulation(run,spawnEnemy,canStand){
 const course=run.course;if(!course.coastal||course.coastal.zombiePopulation)return course.coastal?.zombiePopulation||null;
 const residents=makeCoastalZombiePopulation(course,canStand);
 const population={seed:71003,requested:48,residents,spawned:0,cohorts:{}};
 course.coastal.zombiePopulation=population;
 for(const [order,p] of residents.entries()){
  spawnEnemy(run,{...p,roomId:p.buildingId,resident:true,mindState:'wander',order:order+8,spawnAnim:'none',pack:7000+Math.floor(order/3)},p);
  population.spawned++;population.cohorts[p.locomotion]=(population.cohorts[p.locomotion]||0)+1;
 }
 return population;
}
