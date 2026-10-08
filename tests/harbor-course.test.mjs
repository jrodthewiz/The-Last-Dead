import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {makeCourse,canStand,castRay,newRun,tick} from '../engine.js';
import fs from 'node:fs/promises';
import {harborNavigation,harborLocation} from '../harbor-navigation.js';

test('Power Cut connects Dock Road to the promenade with blocked store wings and reachable salvage',()=>{
 const c=makeHarborCourse(makeCourse()),r=newRun(c);
 assert.equal(castRay(c,16,17,Math.PI/2,9).dist,9);
 for(let y=18.2;y<24;y+=.4){assert.ok(canStand(c,16,y,.72));assert.equal(canStand(c,14,y,.12),false);assert.equal(canStand(c,18,y,.12),false);}
 r.mode='play';r.harborProgress.initialized=true;Object.assign(r,{x:16,y:17,angle:Math.PI/2});
 for(let i=0;i<700&&r.y<24.5;i++)tick(r,1/120,{forward:1});
 assert.ok(r.y>=24.5);assert.equal(r.backpack.scrap,4);
 r.x=16;r.y=21;assert.equal(harborLocation(r),'POWER CUT');
 r.y=28;r.backpack.weaponPickups=c.weaponPickups.slice(0,3).map(p=>p.id);
 const nav=harborNavigation(r);assert.equal(nav.target.id,'truck');assert.ok(nav.distance<68);
 assert.ok(nav.points.some(p=>p.x>=15&&p.x<17&&p.y>20&&p.y<23));
 const closed=structuredClone(c);
 for(let y=18;y<24;y++)for(let x=15;x<17;x++){
  closed.cells[y*c.w+x]=[1,1,1,1];closed.cells[(y-1)*c.w+x][2]=1;closed.cells[(y+1)*c.w+x][0]=1;
  closed.cells[y*c.w+x-1][1]=1;closed.cells[y*c.w+x+1][3]=1;
 }
 assert.equal(nav.distance,58);assert.equal(harborNavigation({...r,course:closed}).distance,82);
});

test('Netmakers gate admits walking to salvage while yard walls and store block passage',()=>{
 const c=makeHarborCourse(makeCourse()),q=c.buildings[3].yard;
 assert.equal(castRay(c,4,24.5,-Math.PI/2,2).dist,.5);
 assert.equal(castRay(c,8,24.5,-Math.PI/2,2).dist,.5);
 assert.ok(castRay(c,5.5,24.5,-Math.PI/2,4).dist>=4);
 assert.equal(canStand(c,3,22,.12),false);assert.equal(canStand(c,9,22,.12),false);
 assert.equal(canStand(c,5.5,20,.12),false);
 const r=newRun(c);r.mode='play';r.harborProgress.initialized=true;
 Object.assign(r,{x:5.5,y:24.5,angle:-Math.PI/2});
 for(let i=0;i<360&&r.y>21.5;i++)tick(r,1/120,{forward:1});
 assert.ok(r.y<22);assert.equal(r.backpack.scrap,4);
 assert.ok(q.gateWidth*4>2.4,'truck can fit through authored opening');
});
test('harbor six blocks, shore and every pickup obey authoritative collision',()=>{
 const c=makeHarborCourse(makeCourse());assert.equal(c.buildings.length,6);
 for(const b of c.buildings)assert.equal(canStand(c,b.x+1,b.y+1),false);
 const origin=c.playerSpawn,seen=new Set([`${Math.floor(origin.x)},${Math.floor(origin.y)}`]),queue=[[Math.floor(origin.x),Math.floor(origin.y)]];
 for(let i=0;i<queue.length;i++){const[x,y]=queue[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!seen.has(k)&&canStand(c,nx+.5,ny+.5,.2)&&castRay(c,x+.5,y+.5,Math.atan2(dy,dx),1).dist>=1){seen.add(k);queue.push([nx,ny]);}}}
 for(const p of [c.exit,c.vehicle,...c.scavengerPickups,...c.weaponPickups,...c.harborSpawns]){assert.ok(canStand(c,p.x,p.y,.2),JSON.stringify(p));assert.ok(seen.has(`${Math.floor(p.x)},${Math.floor(p.y)}`));}
 assert.equal(canStand(c,16,30.2),false);assert.equal(c.water.minZ,c.h*4);assert.equal(c.water.level<-.5,true);
 assert.deepEqual(c,makeHarborCourse(makeCourse()));
});
test('harbor truck has clearance along dock road and all runtime assets embed palettes',async()=>{
 const c=makeHarborCourse();for(let x=10;x<30;x+=.1)assert.ok(canStand(c,x,14,.72));
 for(const name of ['truck-flat','sedan','building-a','building-c','building-e','building-h','building-k','building-o','shipping-container-a','water-tower']){
  const b=await fs.readFile(new URL(`../assets/harbor/${name}.glb`,import.meta.url));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.length,b.readUInt32LE(8));const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert.ok(j.images.every(x=>x.uri.startsWith('data:image/png;base64,')));
 }
});
