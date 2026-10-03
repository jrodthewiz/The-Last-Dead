// Authored coastal expansion. Metres describe visuals; four-metre cells remain
// the sole building/shore collision authority. Legacy harbor rooms stay intact.
import {makeCoastalNeighborhoods} from './coastal-neighborhood-layout.js';
export function attachCoastalWorld(course) {
  const oldW=course.w,oldH=course.h,oldCells=course.cells,w=96,h=80;
  const cells=Array.from({length:w*h},()=>[0,0,0,0]);
  for(let y=0;y<oldH;y++)for(let x=0;x<oldW;x++){
    cells[y*w+x]=oldCells[y*oldW+x].slice();
    if(x===oldW-1)cells[y*w+x][1]=0;
  }
  const block=(x,y)=>{
    cells[y*w+x]=[1,1,1,1];
    if(y>0)cells[(y-1)*w+x][2]=1;
    if(x<w-1)cells[y*w+x+1][3]=1;
    if(y<h-1)cells[(y+1)*w+x][0]=1;
    if(x>0)cells[y*w+x-1][1]=1;
  };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(y>=30&&x<32)block(x,y);
    if(y===0)cells[y*w+x][0]=1;
    if(x===w-1)cells[y*w+x][1]=1;
    if(y===h-1)cells[y*w+x][2]=1;
    if(x===0)cells[y*w+x][3]=1;
  }
  const buildings=[];
  const add=(id,name,asset,x,z,width,depth,height,zone,yaw=0)=>{
    const collision={minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2};
    const p={id,name,asset,x,z,y:.13,width:width-.7,depth:depth-.7,height,yaw,zone,collision,coastal:true};
    buildings.push(p);course.thaiLayout.buildings.push(p);
    const b={id,name,model:'building-a',x:collision.minX/4,y:collision.minZ/4,w:width/4,h:depth/4,height,rotation:0,coastal:true};
    for(let cy=b.y;cy<b.y+b.h;cy++)for(let cx=b.x;cx<b.x+b.w;cx++){
      block(cx,cy);course.blocks.push([cx,cy]);
    }
  };
  const neighborhoods=makeCoastalNeighborhoods();
  for(const p of neighborhoods.lots)add(p.id,p.name,p.asset,p.x,p.z,p.width,p.depth,p.height,p.zone,p.yaw);
  for(const p of neighborhoods.props)course.obstacles.push({id:p.id,minX:(p.x-p.width/2)/4,maxX:(p.x+p.width/2)/4,minY:(p.z-p.depth/2)/4,maxY:(p.z+p.depth/2)/4});
  const roads=[
    {x:192,z:56,width:384,depth:12},{x:192,z:112,width:384,depth:12},
    ...[176,232,304].map(z=>({x:256,z,width:256,depth:12})),
    ...[144,232,368].map(x=>({x,z:160,width:12,depth:320})),
  ];
  const districts=[
    {id:'harbor',name:'QUARANTINE HARBOR',minX:0,maxX:128,minZ:0,maxZ:120,x:64,z:56},
    {id:'residential',name:'SALTWIND RESIDENTIAL',minX:128,maxX:384,minZ:0,maxZ:120,x:232,z:56},
    {id:'industrial',name:'EAST WORKS',minX:128,maxX:384,minZ:120,maxZ:232,x:232,z:176},
    {id:'coastal-park',name:'LIGHTHOUSE CAPE',minX:128,maxX:384,minZ:232,maxZ:320,x:232,z:304},
  ];
  const landmarks=[
    {id:'saltwind',name:'Saltwind Square',x:58,y:14},
    {id:'works',name:'East Works',x:58,y:44},
    {id:'inlet',name:'Inlet Overlook',x:36,y:66},
    {id:'lighthouse',name:'Lighthouse Cape',x:88,y:76},
  ];
  for(const [i,p]of landmarks.entries()){
    course.scavengerPickups.push({id:`coast-scrap-${p.id}`,roomId:`coast-${p.id}`,x:p.x,y:p.y,amount:4,label:`${p.name} supply cache`,color:0xd59a56});
    if(i%2===1)course.weaponPickups.push({id:`coast-weapon-${p.id}`,x:p.x+1,y:p.y,weapon:i===1?4:5,weaponIndex:i===1?4:5,label:i===1?'Works rifle':'Cape marksman rifle'});
  }
  // A few dispersed exterior spawn candidates; the existing population cap stays in charge.
  course.harborSpawns.push({x:48,y:14},{x:58,y:38},{x:76,y:58},{x:36,y:73});
  // The round lighthouse base has a conservative rectangular collision proxy.
  const lighthouse={x:357,z:292,radius:4.1};
  course.obstacles.push({id:'coast-lighthouse',minX:(lighthouse.x-lighthouse.radius)/4,maxX:(lighthouse.x+lighthouse.radius)/4,minY:(lighthouse.z-lighthouse.radius)/4,maxY:(lighthouse.z+lighthouse.radius)/4});
  Object.assign(course,{w,h,cells,openWorld:true,name:'LOW TIDE COAST',tag:'OPEN COAST',
    water:{minX:-1800,maxX:2200,minZ:-1800,maxZ:2200,level:-1.15},
    coastal:{width:w*4,depth:h*4,land:[{x:192,z:60,width:384,depth:120},{x:256,z:220,width:256,depth:200}],buildings,districts,landmarks,roads,lighthouse,neighborhoods,
      shore:[{x:64,z:120,width:128,depth:1},{x:128,z:220,width:1,depth:200},{x:256,z:320,width:256,depth:1},{x:384,z:160,width:1,depth:320},{x:192,z:0,width:384,depth:1},{x:0,z:60,width:1,depth:120}]}});
  return course;
}
