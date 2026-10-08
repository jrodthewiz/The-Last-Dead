import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCourse,newRun,castRay} from '../engine.js';
import {makeHarborCourse} from '../harbor-course.js';
import {harborNavigation,harborLocation,harborMapSvg} from '../harbor-navigation.js';
const fresh=()=>newRun(makeHarborCourse(makeCourse()));
function clearRoute(r,nav){let p=r;for(const next of nav.points){const d=Math.hypot(next.x-p.x,next.y-p.y);if(d>.001)assert.ok(castRay(r.course,p.x,p.y,Math.atan2(next.y-p.y,next.x-p.x),d+.01).dist>=d-.001,`blocked segment ${JSON.stringify([p.x,p.y,next.x,next.y])}`);p=next;}}
test('street routes enter Netmakers through its gate, not closed walls',()=>{
 const r=fresh();r.x=2.5;r.y=21.5;r.backpack.weaponPickups=r.course.weaponPickups.filter(p=>p.weaponIndex!==5).map(p=>p.id);
 // Keep the scavenging objective while selecting only the yard rifle.
 r.course.weaponPickups=[r.course.weaponPickups[4]];r.backpack.weaponPickups=[];
 const nav=harborNavigation(r);assert.equal(nav.target.weaponIndex,5);clearRoute(r,nav);
 assert.ok(nav.points.some(p=>p.y>=24));assert.ok(nav.distance>Math.hypot(7.5-r.x,21.5-r.y)*4);
 r.x=5.5;r.y=22;assert.equal(harborLocation(r),'NETMAKERS YARD');
});
test('guidance changes from salvage to truck to ferry and removes collected map markers',()=>{
 const r=fresh();const first=harborNavigation(r);assert.ok(first.target.id.startsWith('harbor-weapon'));clearRoute(r,first);
 const before=(harborMapSvg(r).match(/<circle/g)||[]).length;
 r.backpack.weaponPickups=r.course.weaponPickups.slice(0,3).map(p=>p.id);
 assert.equal(harborNavigation(r).target.id,'truck');assert.equal((harborMapSvg(r).match(/<circle/g)||[]).length,before-3);
 r.vehicle.distance=8;const ferry=harborNavigation(r);assert.equal(ferry.target.id,'ferry');clearRoute(r,ferry);
 r.x=30;r.y=28;assert.equal(harborLocation(r),'FERRY APPROACH');assert.ok(harborNavigation(r).distance<1);
});

test('all room entrances have clear routes from the dock spawn and field map markers',()=>{
 for(let i=0;i<6;i++){
  const r=fresh(),room=r.course.harborRooms[i];
  r.course.weaponPickups=[{...room.door,id:`entrance-${i}`}];
  const nav=harborNavigation(r);assert.ok(nav,room.name);clearRoute(r,nav);
  assert.equal(nav.target.id,`entrance-${i}`);
  assert.ok(harborMapSvg(r).includes(`<title>Q: ${room.name}</title>`));
 }
});
