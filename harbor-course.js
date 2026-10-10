import {attachLowTide} from './low-tide.js';
import {attachIslandBasement} from './island-basement-layout.js';
import {makeHarborRooms} from './harbor-interiors.js';
import {makeHarborThaiLayout} from './harbor-thai-layout.js';
import {attachCoastalWorld} from './coastal-world-layout.js';
import {registerImmutablePropObstacles} from './harbor-collision.js';
// Four-metre cells remain the collision authority; visual assets fit inside them.
export function makeHarborCourse(base = {}) {
  const w=32,h=30, cells=Array.from({length:w*h},(_,i)=>[i<w?1:0,i%w===w-1?1:0,i>=w*(h-1)?1:0,i%w===0?1:0]);
  const names=['CUSTOMS HOUSE','COLD STORAGE','FERRY WORKSHOP','NETMAKERS','POWER DEPOT','DOCK OFFICES'];
  const models=['building-a','building-c','building-e','building-h','building-k','building-o'];
  const buildings=[],blocks=[];
  for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
    const x=3+col*10,y=4+row*14,index=row*3+col;
    buildings.push({id:`harbor-block-${index}`,name:names[index],model:models[index],x,y,w:6,h:6,height:[12,9,10,8,14,11][index],rotation:index%2?Math.PI:0});
    if(index===3)buildings[index].yard={x,y:y+2,w:6,h:4,gateX:x+2,gateWidth:2};
    if(index===4)buildings[index].passage={x:x+2,y,w:2,h:6,name:'POWER CUT'};
    for(let cy=y;cy<y+(index===3?2:6);cy++)for(let cx=x;cx<x+6;cx++){
      if(index===4&&cx>=x+2&&cx<x+4)continue;
      blocks.push([cx,cy]);
    }
  }
  for(const[x,y]of blocks){cells[y*w+x]=[1,1,1,1];if(y)cells[(y-1)*w+x][2]=1;if(x<w-1)cells[y*w+x+1][3]=1;if(y<h-1)cells[(y+1)*w+x][0]=1;if(x)cells[y*w+x-1][1]=1;}
  const yard=buildings[3].yard;
  for(let y=yard.y;y<yard.y+yard.h;y++){
    cells[y*w+yard.x][3]=cells[y*w+yard.x-1][1]=1;
    cells[y*w+yard.x+yard.w-1][1]=cells[y*w+yard.x+yard.w][3]=1;
  }
  for(let x=yard.x;x<yard.x+yard.w;x++)if(x<yard.gateX||x>=yard.gateX+yard.gateWidth){
    cells[(yard.y+yard.h-1)*w+x][2]=cells[(yard.y+yard.h)*w+x][0]=1;
  }
  const scavengerPickups=[[15.2,16],[11.5,8],[21.5,22],[27,27]].map(([x,y],i)=>({id:`harbor-scrap-${i}`,roomId:`harbor-${i}`,x,y,amount:4,label:'Dockyard salvage',color:0xd59a56}));
  const weaponPickups=[[17.2,16,6],[19.7,17,1],[21.5,11,4],[29.8,25.5,7],[11,25.5,5],[2,12,3]].map(([x,y,weapon],i)=>({id:`harbor-weapon-${i}`,x,y,weapon,weaponIndex:weapon,label:['Salvage bat','Breach shotgun','Carrion rifle','Ripper chainsaw','Mourning rifle','Reliquary'][i]}));
  Object.assign(scavengerPickups[1],{x:5.5,y:21.5,label:'Netmakers tool cache'});
  Object.assign(weaponPickups[4],{x:7.5,y:21.5,label:'Netmakers marksman rifle'});
  Object.assign(scavengerPickups[2],{x:16,y:21.5,label:'Power Cut maintenance cache'});
  const course={...base,id:'harbor-quarantine',sectorId:'harbor-quarantine',name:'QUARANTINE HARBOR',tag:'COASTAL SALVAGE',color:'#80aba6',index:0,sectorIndex:0,campaign:false,dungeon:false,extended:false,harbor:true,scavenging:true,w,h,cells,blocks,buildings,
    playerSpawn:{x:16,y:16,angle:0},exit:{x:30,y:28},points:[{x:16,y:16},{x:30,y:28}],turns:[],enemies:[],
    spawnPoints:[{x:2,y:8},{x:11,y:5},{x:16,y:23.5},{x:29,y:26}],harborSpawns:[{x:2,y:8},{x:11,y:5},{x:16,y:23.5},{x:29,y:26}],
    vehicle:{id:'dock-truck',x:16,y:14,angle:0,halfLength:.65,halfWidth:.3,speed:0},
    water:{minX:-120,maxX:248,minZ:120,maxZ:380,level:-1.15},scavengerPickups,weaponPickups};
  course.thaiLayout=makeHarborThaiLayout(course);
  course.obstacles=course.thaiLayout.colliders.map(p=>({id:p.id,minX:p.minX/4,maxX:p.maxX/4,minY:p.minZ/4,maxY:p.maxZ/4}));
  course.harborRooms=makeHarborRooms(course);
  if(course.lowTide){course.harborRooms[1].name='COLD STORAGE / BAY 02';course.harborRooms[3].name='NETMAKERS SAFEHOUSE';}
  attachLowTide(course);
  if(base.openWorld)attachCoastalWorld(course);
  attachIslandBasement(course);
  // Outdoor prop authority is complete, including the service stair walls.
  // Mutable legacy/interior courses deliberately retain linear collision.
  if(course.coastal)registerImmutablePropObstacles(course);
  return course;
}
