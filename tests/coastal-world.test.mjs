import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {canStand,castRay,newRun} from '../engine.js';
import {harborNavigation} from '../harbor-navigation.js';
import {coastalMapSvg} from '../coastal-world-map.js';
import {lowTideSnapshot,restoreLowTide} from '../low-tide-save.js';
import {makeCoastalNeighborhoods} from '../coastal-neighborhood-layout.js';
import {frontageLots} from '../assets/community/neonbay-frontage.js';

test('dense seeded lots have disjoint grid footprints, clear roads and reachable furnished courtyards',()=>{
  const c=makeHarborCourse({openWorld:true}),seen=reachable(c),lots=c.coastal.buildings;
  assert.deepEqual(makeCoastalNeighborhoods(),makeCoastalNeighborhoods());
  assert.notDeepEqual(makeCoastalNeighborhoods(1).lots,makeCoastalNeighborhoods(2).lots);
  for(const seed of [1,2,42,17031,99999]){
    const generated=makeCoastalNeighborhoods(seed);assert.ok(generated.lots.length>=70&&generated.lots.length<=100);
    for(const p of generated.lots){assert.ok(p.width>=12&&p.depth>=12);assert.equal((p.x-p.width/2)%4,0);assert.equal((p.z-p.depth/2)%4,0);}
  }
  assert.ok(new Set(lots.map(p=>p.height)).size>=5);
  assert.ok(new Set(lots.map(p=>p.width)).size>=3);
  const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
  for(const [i,p]of lots.entries()){
    for(const v of Object.values(p.collision))assert.equal(v%4,0,'grid authority');
    for(const q of lots.slice(i+1))assert.equal(overlaps(p.collision,q.collision),false,'separate footprints');
    for(const r of c.coastal.roads)assert.equal(overlaps(p.collision,{minX:r.x-r.width/2,maxX:r.x+r.width/2,minZ:r.z-r.depth/2,maxZ:r.z+r.depth/2}),false,'roads remain clear');
  }
  for(const p of c.coastal.neighborhoods.courtyards){assert.ok(canStand(c,p.x/4,p.z/4,.2));assert.ok(seen.has(`${Math.floor(p.x/4)},${Math.floor(p.z/4)}`));}
  for(const p of c.coastal.neighborhoods.props)assert.equal(canStand(c,p.x/4,p.z/4,.1),false,'furnishing proxy blocks its center');
});
test('adapted NEONBAY frontage retries depths to fit bounded grid strips',()=>{
  const lots=frontageLots({minX:0,maxX:32,minZ:0,maxZ:8},{random:()=>0,wMin:12,wMax:12,dMin:20,dMax:20,edges:[0]});
  assert.equal(lots.length,2);assert.ok(lots.every(p=>p.depth===8&&p.minZ===0&&p.maxZ===8));
});

function reachable(c){
  const origin=c.playerSpawn,seen=new Set([`${Math.floor(origin.x)},${Math.floor(origin.y)}`]),q=[[Math.floor(origin.x),Math.floor(origin.y)]];
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(!seen.has(key)&&canStand(c,nx+.5,ny+.5,.2)&&castRay(c,x+.5,y+.5,Math.atan2(dy,dx),1).dist>=1){seen.add(key);q.push([nx,ny]);}
    }
  }
  return seen;
}
test('coastal expansion preserves harbor rooms and chapter while connecting ground-floor exploration destinations',()=>{
  const legacy=makeHarborCourse({lowTide:true}),c=makeHarborCourse({lowTide:true,openWorld:true});
  assert.deepEqual(c.buildings,legacy.buildings);
  assert.deepEqual(c.harborRooms,legacy.harborRooms);
  assert.deepEqual(c.lowTideStations,legacy.lowTideStations);
  assert.equal(c.w,112);assert.equal(c.h,104);assert.ok(c.coastal.buildings.length>=70&&c.coastal.buildings.length<=100);
  const seen=reachable(c);
  for(const p of [c.vehicle,c.exit,...c.coastal.landmarks,...c.scavengerPickups,...c.weaponPickups,...c.harborSpawns,...c.harborRooms.map(r=>r.door)]){
    const target=p.approach||p;
    assert.ok(canStand(c,target.x,target.y,p.approach?.1:.2,p.floorZ),`clear destination ${JSON.stringify(p)}`);
    if(p.floorZ>.15){
      // The upstairs discovery suite walks the real stairs with explicit support
      // heights; a flat street graph cannot certify an upper-floor journey.
      assert.ok(c.coastal.structures.some(s=>s.id===p.roomId));continue;
    }
    if(p.approach||c.coastal.landmarks.includes(p)&&!seen.has(`${Math.floor(target.x)},${Math.floor(target.y)}`)){
      // Furniture can occupy a coarse cell centre while its real approach is
      // walkable. Verify the actual door + indoor route instead of that centre.
      const marker={id:`test-${p.id}`,name:p.label||p.name||p.id,x:target.x,y:target.y};c.coastal.landmarks.push(marker);
      try{const run={course:c,...c.playerSpawn,backpack:{weaponPickups:[]},coastalDestination:marker.id};
        const nav=harborNavigation(run);assert.ok(nav,`reachable indoor destination ${p.id}`);
        let prior=run;for(const point of nav.points){const steps=Math.max(1,Math.ceil(Math.hypot(point.x-prior.x,point.y-prior.y)/.04));
          for(let i=0;i<=steps;i++)assert.ok(canStand(c,prior.x+(point.x-prior.x)*i/steps,prior.y+(point.y-prior.y)*i/steps,.1),`clear indoor route ${p.id}`);prior=point;}
      }finally{c.coastal.landmarks.pop();}
    }else assert.ok(seen.has(`${Math.floor(target.x)},${Math.floor(target.y)}`),`reachable destination ${JSON.stringify(p)}`);
  }
  assert.deepEqual(c,makeHarborCourse({lowTide:true,openWorld:true}));
});
test('ocean inlet and sealed building footprints block traversal with reciprocal walls',()=>{
  const c=makeHarborCourse({openWorld:true});
  for(let y=30;y<c.h;y++)for(let x=0;x<32;x++)assert.equal(canStand(c,x+.5,y+.5,.2),false);
  for(const b of c.coastal.buildings)assert.equal(canStand(c,b.x/4,b.z/4,.2),b.enterable===true);
  assert.equal(canStand(c,c.coastal.lighthouse.x/4,c.coastal.lighthouse.z/4,.2),false);
  const tower=c.coastal.lighthouse;
  for(const {collision:b}of c.coastal.buildings)assert.ok(tower.x+tower.radius<=b.minX||tower.x-tower.radius>=b.maxX||tower.z+tower.radius<=b.minZ||tower.z-tower.radius>=b.maxZ,'lighthouse clears building footprints');
  for(let y=0;y<c.h;y++)for(let x=0;x<c.w;x++){
    const cell=c.cells[y*c.w+x];
    if(x<c.w-1)assert.equal(cell[1],c.cells[y*c.w+x+1][3],`east ${x},${y}`);
    if(y<c.h-1)assert.equal(cell[2],c.cells[(y+1)*c.w+x][0],`south ${x},${y}`);
  }
  assert.ok(c.water.minX<0&&c.water.maxX>384&&c.water.minZ<0&&c.water.maxZ>320);
});
test('truck has a continuous broad route from harbor to residential works and cape',()=>{
  const c=makeHarborCourse({openWorld:true});
  for(let x=10;x<=92;x+=.15)assert.ok(canStand(c,x,14,.72),`harbor road ${x}`);
  for(let y=14;y<=76;y+=.15)assert.ok(canStand(c,58,y,.72),`spine ${y}`);
  for(let x=36;x<=92;x+=.15)assert.ok(canStand(c,x,76,.72),`cape road ${x}`);
});
test('selected coastal destinations produce walkable routes and full-coast map markers',()=>{
  const c=makeHarborCourse({openWorld:true,lowTide:true}),r=newRun(c);
  for(const id of ['lighthouse','saltwind','works','inlet']){
    r.coastalDestination=id;
    const nav=harborNavigation(r),target=c.coastal.landmarks.find(p=>p.id===id);
    assert.ok(nav,`route exists for ${id}`);assert.equal(nav.target.id,id);
    assert.deepEqual(nav.points.at(-1),{x:target.x,y:target.y});
    let prior=r;
    for(const p of nav.points){
      const distance=Math.hypot(p.x-prior.x,p.y-prior.y),steps=Math.max(1,Math.ceil(distance/.1));
      for(let i=0;i<=steps;i++)assert.ok(canStand(c,prior.x+(p.x-prior.x)*i/steps,prior.y+(p.y-prior.y)*i/steps,.1),`${id} route segment at ${p.x},${p.y}`);
      prior=p;
    }
    const svg=coastalMapSvg(r,nav),view=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    assert.ok(view[0]<=0&&view[1]<=0&&view[0]+view[2]>=384&&view[1]+view[3]>=320,'map covers coast');
    assert.ok(svg.includes('<polyline points='),'map displays chosen route');
    for(const p of c.coastal.landmarks){assert.ok(svg.includes(`<title>${p.name}</title>`));assert.ok(svg.includes(`translate(${p.x*4} ${p.y*4})`));}
  }
});
test('coastal collected cache and weapon identifiers survive safehouse checkpoint round trip',()=>{
  const r=newRun(makeHarborCourse({openWorld:true,lowTide:true}));
  r.lowTide.shelter=true;
  const collected=r.course.scavengerPickups.filter(p=>p.id.startsWith('coast-')).map(p=>p.id);
  const weaponPickups=r.course.weaponPickups.filter(p=>p.id.startsWith('coast-')).map(p=>p.id);
  Object.assign(r.backpack,{collected,weaponPickups,scrap:8});r.ownedWeapons=[0,4,5];
  const saved=JSON.parse(JSON.stringify(lowTideSnapshot(r)));
  const restored=newRun(makeHarborCourse({openWorld:true,lowTide:true}));
  assert.equal(restoreLowTide(restored,saved),true);
  assert.deepEqual(restored.backpack.collected,collected);assert.deepEqual(restored.backpack.weaponPickups,weaponPickups);
  assert.equal(restored.backpack.scrap,8);assert.deepEqual(restored.ownedWeapons,[0,4,5]);
});
