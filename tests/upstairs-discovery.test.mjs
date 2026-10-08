import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHarborCourse} from '../harbor-course.js';
import {newRun,tick,canStand,eye} from '../engine.js';
import {actorGroundAt,traceStructureSegment} from '../coastal-structures.js';
import {createBuildingPlan} from '../assets/blackwater-kit/architecture.js';
import {collectScavengerPickup,createScavengerPack,tickScavengerPack,MAX_SCAVENGER_CACHES} from '../scavenger-pack.js';

const FOLIO='cape75-footbridge-route-folio',KIT='cape75-radio-repair-kit';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const setup=()=>{
 const course=makeHarborCourse({openWorld:true});course.enemies=[];
 const building=course.coastal.blackwaterSlice.buildings.find(p=>p.label==='CAPE LODGE 75');
 const structure=course.coastal.structures.find(p=>p.id===building.id);
 const folio=course.scavengerPickups.find(p=>p.id===FOLIO),kit=course.scavengerPickups.find(p=>p.id===KIT);
 assert.ok(folio,'the live building plan supplies the upstairs route folio');
 const run=newRun(course);Object.assign(run,{mode:'play',waveDelay:999,lowTide:null,vehicle:null});run.harborProgress.initialized=true;
 return{course,building,structure,folio,kit,run};
};
const pose=(run,item,floor=item.floorZ)=>Object.assign(run,{x:item.approach?.x??item.x,y:item.approach?.y??item.y,
 z:0,vx:0,vy:0,vz:0,supportZ:floor,supportId:null,structureId:item.roomId});
function walk(run,points){
 for(const target of points){
  let reached=false;
  for(let frame=0;frame<1800;frame++){
   if(Math.hypot(target.x-run.x,target.y-run.y)<.027&&Math.abs(actorGroundAt(run.course,run)-target.z)<.06){reached=true;break;}
   run.angle=Math.atan2(target.y-run.y,target.x-run.x);tick(run,1/120,{forward:1});
   assert.ok(Number.isFinite(eye(run)));assert.equal(run.course.activeInterior??null,null);
  }
  assert.ok(reached,`walking route stopped toward ${JSON.stringify(target)} at ${JSON.stringify({x:run.x,y:run.y,z:actorGroundAt(run.course,run),support:run.supportId})}`);
 }
}

test('authored route record rotates and serializes once, with a real existing destination and separate scrap case',()=>{
 const {course,building,folio,kit}=setup(),plan=createBuildingPlan(building),source=plan.routeFolio;
 const [x,y,z]=source.position,[ax,az]=source.approach,c=Math.cos(building.yaw),s=Math.sin(building.yaw);
 close(folio.x*4,building.x+x*c+z*s);close(folio.y*4,building.z-x*s+z*c);
 close(folio.approach.x*4,building.x+ax*c+az*s);close(folio.approach.y*4,building.z-ax*s+az*c);
 close(folio.visualBaseY,building.y+y);close(folio.itemZ*4,building.y+source.interactionPoint[1]);
 close(folio.floorZ*4,building.y+source.floorHeight);assert.equal(folio.visualYaw,building.yaw+source.yaw);
 assert.equal(folio.reachFloorTolerance,.075);assert.equal(kit.reachFloorTolerance,.075);
 assert.deepEqual(JSON.parse(JSON.stringify(folio)),folio);assert.equal(folio.visualKind,'route-folio');
 assert.equal(folio.requiresInteract,true);assert.equal(folio.amount,0);assert.equal(kit.amount,4);
 const original=course.scavengerPickups.filter(p=>p.visualKind!=='supply-case');
 assert.equal(original.filter(p=>p.visualKind!=='route-folio').length,11,'all old coast caches remain');
 assert.equal(original.length,12);assert.ok(original.length<=MAX_SCAVENGER_CACHES);
 const destination=course.coastal.landmarks.find(p=>p.id===folio.destinationId);
 assert.equal(destination.id,'forest');assert.equal(destination.name,'Cape Forest Footbridge');
 assert.equal(destination.x*4,222);assert.equal(destination.y*4,340);
});

test('each authored pickup requires its own floor at the same horizontal coordinates',()=>{
 const {run,folio,kit}=setup();pose(run,{...folio,approach:null},kit.floorZ);
 assert.equal(collectScavengerPickup(run,folio.id).reason,'out-of-reach');
 tickScavengerPack(run,{interact:true});assert.equal(run.events.filter(e=>e.type==='scavenger-route-prompt').length,0);
 pose(run,{...kit,approach:null},folio.floorZ);
 assert.equal(collectScavengerPickup(run,kit.id).reason,'out-of-reach');assert.equal(run.backpack.scrap,0);
});

test('the real desktop ray is clear and the same support remains reachable during a carried jump',()=>{
 const {run,course,folio}=setup();pose(run,folio);
 assert.ok(canStand(course,run.x,run.y,.16,folio.floorZ),'the authored approach clears the real chair and desk');
 assert.equal(traceStructureSegment(course,{x:run.x,y:run.y,z:eye(run)},{x:folio.x,y:folio.y,z:folio.itemZ}),null);
 run.z=.10;assert.equal(collectScavengerPickup(run,folio.id).ok,true,'a valid jump below the real ceiling retains upper support');
 assert.equal(run.backpack.scrap,0);close(run.events.at(-1).z,folio.itemZ);
 const tallRoom={scavenging:true,w:4,h:4,cells:Array.from({length:16},()=>[0,0,0,0]),
  scavengerPickups:[{id:'supported-high-jump-case',x:1.5,y:1.5,floorZ:0,itemZ:.35,amount:4}]};
 const jumper={course:tallRoom,mode:'play',health:100,x:1.5,y:1.5,z:.4,events:[],backpack:createScavengerPack()};
 assert.equal(collectScavengerPickup(jumper,'supported-high-jump-case').ok,true,'height-authored reach supports a carried jump exceeding the legacy relative cap');
});

test('finite wall and slab intersections reject reach, while stale lower grid walls do not extend upstairs',()=>{
 const {run,course,structure,folio,kit}=setup();pose(run,folio);
 const finiteCourse={scavenging:true,w:5,h:5,cells:Array.from({length:25},()=>[0,0,0,0]),
  coastal:{structures:[{id:'finite-house',bounds:{minX:1,maxX:3,minY:1,maxY:3,minZ:0,maxZ:2},solids:[]}]},
  scavengerPickups:[{id:'upper-test-case',x:2.02,y:1.5,floorZ:.6,itemZ:.8,amount:4}]};
 finiteCourse.cells[6][1]=1;
 const upstairs={course:finiteCourse,mode:'play',health:100,x:1.98,y:1.5,z:0,supportZ:.6,structureId:'finite-house',events:[],backpack:createScavengerPack()};
 assert.equal(collectScavengerPickup(upstairs,'upper-test-case').ok,true,'finite house replaces the lower grid wall at its actual crossed edge');
 const mid={x:(run.x+folio.x)/2,y:(run.y+folio.y)/2,z:(eye(run)+folio.itemZ)/2};
 structure.solids.push({id:'test-finite-wall',kind:'wall',support:false,minX:mid.x-.01,maxX:mid.x+.01,minY:mid.y-.01,maxY:mid.y+.01,minZ:mid.z-.1,maxZ:mid.z+.1});
 assert.equal(collectScavengerPickup(run,folio.id).reason,'out-of-reach');structure.solids.pop();
 // A deliberately mis-authored lower item cannot bypass the slab merely by
 // claiming the actor's floor. The actual eye-to-item segment still owns reach.
 pose(run,{...kit,approach:null},folio.floorZ);const oldFloor=kit.floorZ;kit.floorZ=folio.floorZ;
 assert.ok(traceStructureSegment(course,{x:run.x,y:run.y,z:eye(run)},{x:kit.x,y:kit.y,z:kit.itemZ}));
 assert.equal(collectScavengerPickup(run,kit.id).reason,'out-of-reach');kit.floorZ=oldFloor;
});

test('terrain cache reach keeps the closed grid rule for buildings without finite structure opt-in',()=>{
 const course={scavenging:true,w:5,h:5,cells:Array.from({length:25},()=>[0,0,0,0]),
  coastal:{terrain:{},structures:[]},scavengerPickups:[{id:'terrain-cache',x:2.02,y:1.5,amount:4}]};
 const run={course,mode:'play',health:100,x:1.98,y:1.5,z:0,events:[],backpack:createScavengerPack()};
 course.cells[6][1]=1;
 assert.equal(collectScavengerPickup(run,'terrain-cache').reason,'out-of-reach');
 course.cells[6][1]=0;assert.equal(collectScavengerPickup(run,'terrain-cache').ok,true);close(run.events[0].z,.05);
});

test('Q is required in tick, prompts once on entry and re-entry, and the public collector is an explicit action',()=>{
 const {run,folio}=setup();pose(run,folio);
 for(let frame=0;frame<120;frame++)tickScavengerPack(run);
 assert.equal(run.backpack.collected.includes(folio.id),false);assert.equal(run.events.filter(e=>e.type==='scavenger-route-prompt').length,1);
 const approach={x:run.x,y:run.y};run.x+=1;tickScavengerPack(run);Object.assign(run,approach);tickScavengerPack(run);
 assert.equal(run.events.filter(e=>e.type==='scavenger-route-prompt').length,2);
 run.coastalDestination='lighthouse';tickScavengerPack(run,{interact:true});
 assert.equal(run.coastalDestination,'forest');assert.equal(run.events.filter(e=>e.type==='scavenger-route').length,1);
 tickScavengerPack(run,{interact:true});assert.equal(collectScavengerPickup(run,folio.id).reason,'collected');
 run.backpack=createScavengerPack();assert.equal(collectScavengerPickup(run,folio.id).ok,true,'direct collection already represents an explicit action');
});

test('a full scrap pack keeps cases but permits the route record, with shared peer history and physical event height',()=>{
 const {run,course,folio}=setup();pose(run,folio);run.backpack=createScavengerPack({scrap:12});
 course.scavengerPickups.unshift({...folio,id:'test-upper-scrap-case',visualKind:'case',requiresInteract:false,destinationId:undefined,amount:4});
 tickScavengerPack(run,{interact:true});
 assert.equal(run.backpack.scrap,12);assert.ok(!run.backpack.collected.includes('test-upper-scrap-case'));
 assert.ok(run.backpack.collected.includes(folio.id));assert.equal(run.events.filter(e=>e.type==='scavenger-full').length,1);
 const event=run.events.find(e=>e.type==='scavenger-route');close(event.z,folio.itemZ);
 assert.equal(event.destinationId,'forest');assert.equal(event.destinationName,'Cape Forest Footbridge');assert.ok(event.label.length);
 run.backpack=createScavengerPack({scrap:12});run.events=[];
 run.peer={world:run,course,mode:'play',health:100,playerId:'peer'};pose(run.peer,folio);run.x=10;run.y=10;
 tickScavengerPack(run,{peerInteract:true});assert.equal(run.peer.backpack,run.backpack);
 assert.equal(run.peer.coastalDestination,'forest');assert.equal(run.events.find(e=>e.type==='scavenger-route').playerId,'peer');
 pose(run,folio);tickScavengerPack(run,{interact:true});assert.equal(run.events.filter(e=>e.type==='scavenger-route').length,1);
 assert.equal(run.backpack.collected.filter(id=>id===folio.id).length,1);
});

test('actual street, stairs and bedroom walking discovers the upstairs route only through the engine Q input',()=>{
 const {run,structure,folio}=setup();Object.assign(run,{x:158/4,y:237/4,z:0,vx:0,vy:0,vz:0,supportZ:null,supportId:null,structureId:null});
 walk(run,[{x:158/4,y:241.6/4,z:.05},...structure.stairPath,
  {x:158/4,y:252.5/4,z:folio.floorZ},{x:161.0/4,y:252.5/4,z:folio.floorZ},{...folio.approach,z:folio.floorZ}]);
 assert.ok(actorGroundAt(run.course,run)>.65);assert.equal(run.z,0);assert.equal(run.mode,'play');
 assert.ok(!run.backpack.collected.includes(folio.id),'walking does not automatically take the route');
 assert.equal(run.events.filter(e=>e.type==='scavenger-route-prompt').length,1);
 const before={x:run.x,y:run.y,floor:actorGroundAt(run.course,run)};tick(run,1/120,{interact:true});
 assert.ok(run.backpack.collected.includes(folio.id));assert.equal(run.coastalDestination,'forest');
 assert.ok(Math.hypot(run.x-before.x,run.y-before.y)<.02);close(actorGroundAt(run.course,run),before.floor);
 assert.equal(run.backpack.scrap,0);assert.equal(run.events.filter(e=>e.type==='scavenger-route').length,1);
});
