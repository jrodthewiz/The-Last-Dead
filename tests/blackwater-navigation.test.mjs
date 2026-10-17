import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialGrid,createWorldData,createColliders,random} from '../island/data.js';
import {supportHeight} from '../island/simulation.js';
import {findLocalPath,createPathQueue,walkableLine} from '../island/navigation.js';
import {updateEnemies,navigationMetrics,resetNavigation} from '../island/actors.js';
import {hearNoise} from '../island/enemy-behavior.js';
import {interruptEnemy} from '../island/shove.js';
const actor=(id,x,z)=>({id,x,z,role:'shambler',phase:1,alive:true,health:70,home:{x,z},hit:0,notice:0,cooldown:0,navTimer:0,path:[],attackTimer:0,actions:{},state:'',mixer:{update(){}},root:{position:{x,y:14,z,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0}}});
const makeGrid=()=>{const grid=new SpatialGrid([{x:507,z:10,w:7,d:12,y:0,h:35}]);grid.floorAt=()=>14;return grid;};

test('allocation-free collision checks preserve the deduplicated query result at cell boundaries',()=>{
 const data=createWorldData(),grid=new SpatialGrid(createColliders(data)),rng=random(103),boxes=[...new Set([...grid.cells.values()].flat())];
 for(let i=0;i<5000;i++){
  const b=boxes[i%boxes.length],x=i%2?b.x+(rng()-.5)*(b.w+2):Math.round((rng()*2800-1400)/32)*32,z=i%2?b.z+(rng()-.5)*(b.d+2):Math.round((rng()*1800-900)/32)*32,y=i%3?b.y+rng()*b.h:supportHeight(data,x,z),r=.1+rng()*.8;
  let expected=false;for(const c of grid.query(x,z,r)){if(y+1.5<c.y||y>c.y+c.h)continue;const dx=Math.max(Math.abs(x-c.x)-c.w/2,0),dz=Math.max(Math.abs(z-c.z)-c.d/2,0);if(dx*dx+dz*dz<r*r){expected=true;break;}}
  assert.equal(grid.blocked(x,z,y,r),expected);
 }
});

test('six blocked searches share a bounded fair queue and match synchronous safe routes',()=>{
 const grid=makeGrid(),queue=createPathQueue(grid,{nodesPerFrame:12,milliseconds:Infinity,now:()=>0}),results=new Map();
 for(let i=0;i<6;i++)queue.request(i,500,7+i*.2,521,10,()=>true,path=>results.set(i,path));
 let frames=0;while(queue.stats.active&&frames++<500){queue.advance();assert.ok(queue.stats.lastNodes<=12);}
 assert.equal(results.size,6);assert.ok(frames>1&&frames<500);
 for(let i=0;i<6;i++){const path=results.get(i);assert.deepEqual(path,findLocalPath(grid,500,7+i*.2,521,10));assert.ok(path.length>2);let a=[500,7+i*.2];for(const b of path){assert.ok(walkableLine(grid,...a,b.x,b.z));a=[b.x,b.z];}}
});

test('queue cooperatively yields on time, cancels invalid owners and cannot publish after reset',()=>{
 const grid=makeGrid();let clock=0,valid=true,published=0;
 const queue=createPathQueue(grid,{nodesPerFrame:80,milliseconds:1.5,now:()=>clock+=.05});
 queue.request('old',500,8,521,10,()=>valid,()=>published++);queue.advance();assert.ok(queue.stats.lastNodes<80&&queue.stats.active===1);
 valid=false;queue.advance();assert.equal(published,0);assert.equal(queue.stats.cancelled,1);
 queue.request('same-id',500,8,521,10,()=>true,()=>published++);queue.advance();queue.clear();
 queue.request('same-id',500,8,521,10,()=>true,()=>published++);for(let i=0;i<200&&queue.stats.active;i++)queue.advance();
 assert.equal(published,1);assert.equal(queue.stats.active,0);
});

test('moving targets complete paths, pursuit clears cover, and queued actors still react and attack',()=>{
 const grid=makeGrid(),enemies=Array.from({length:6},(_,i)=>actor('dead-'+i,500+(i%2)*.2,8+Math.floor(i/2)*.2)),player={x:521,y:14,z:10};let damage=0,completed=false;
 for(let i=0;i<1200;i++){
  player.z=10+Math.sin(i/60)*1.2;if(i%120===0)hearNoise(enemies,player.x,player.z,60);
  if(i===3)interruptEnemy(enemies[0],player);updateEnemies(enemies,player,grid,1/60,i/60,()=>damage++);
  if(i===3)assert.ok(enemies[0].hit>0&&enemies[0].attackTimer===0);
  completed||=navigationMetrics(grid).completed>0;
  for(const e of enemies)assert.equal(grid.blocked(e.x,e.z,14,.3),false);
 }
 assert.ok(completed);assert.ok(enemies.some(e=>e.x>510));assert.ok(damage>0);
 // All three invalidation paths prevent an old search from publishing.
 for(const reason of ['dead','far','retarget','retry']){
  resetNavigation(grid);const e=actor('reused',500,8);e.notice=8;e.lastKnown={x:507,z:10};e.seesPlayer=false;e.sightTimer=100;
  updateEnemies([e],player,grid,1/60,0,()=>{});
  assert.equal(navigationMetrics(grid).active,1,'unreachable target leaves a real search pending');
  if(reason==='dead')e.alive=false;if(reason==='far'){e.x=-600;e.z=300;}if(reason==='retarget')e.lastKnown={x:550,z:40};if(reason==='retry'){resetNavigation(grid);e.notice=0;e.lastKnown=null;}
  e.navTimer=100;for(let i=0;i<100;i++)updateEnemies([e],player,grid,1/60,i/60,()=>{});
  assert.deepEqual(e.path,[],reason);
 }
});
